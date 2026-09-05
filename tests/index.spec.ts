import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CommandDefinition, CommandInvocation } from '@deepseek-ai/dsh-commands'
import type { SubagentRun, SubagentStartRequest } from '@deepseek-ai/dsh-subagent'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, type Config } from '../src/index.js'

const config: Config = {
  answerMaxTokens: 16_384,
  reviewMaxTokens: 16_384,
  arbiterMaxTokens: 16_384,
  childTimeoutMs: 300_000,
  runTimeoutMs: 900_000,
  subagentProvider: 'spawn',
}

const pickerAnswers = {
  answers: [
    { id: 'answerers', selected: ['A — Provider [p/a]', 'B — Provider [p/b]'] },
    { id: 'reviewers', selected: ['C — Provider [p/c]'] },
    { id: 'arbiter', selected: ['A — Provider [p/a]'] },
    { id: 'question', selected: [], custom: 'Question' },
  ],
}

const review = {
  evaluations: [
    { answerId: 'Answer A', strengths: ['good'], weaknesses: [] },
    { answerId: 'Answer B', strengths: ['good'], weaknesses: [] },
  ],
  consensus: ['common'],
  contradictions: [],
  coverageGaps: [],
  uniqueInsights: [],
  blindSpots: [],
  ranking: ['Answer A', 'Answer B'],
}

const arbiter = {
  answerMarkdown: 'Final answer',
  consensus: ['common'],
  contradictions: [],
  blindSpots: [],
  confidenceNotes: 'High confidence',
}

type PreStepListener = (
  payload: { agent: Agent },
  next: () => Promise<{ kind: 'enter'; messages: Array<{ id?: string }> }>,
) => Promise<{ kind: string; messages?: Array<{ id?: string }> }>
type SettingsListener = (namespace: string) => void
type TestAgent = Agent & {
  readonly recordedEvents: Array<{ type: string }>
  session: Agent['session'] & { blank: boolean }
}

function harness(
  ask = async () => pickerAnswers,
  provider: { capabilities: { outputSchema: boolean; depthLimit: boolean; toolFilter: boolean; persona: boolean } } | null = {
    capabilities: { outputSchema: true, depthLimit: true, toolFilter: true, persona: true },
  },
  initialLocale: 'en' | 'zh' = 'en',
  configuration = config,
) {
  let command: CommandDefinition | undefined
  let preStep: PreStepListener | undefined
  let settingsUpdated: SettingsListener | undefined
  let locale = initialLocale
  const childRequests: SubagentStartRequest[] = []
  const disposed: string[] = []
  const renamed: string[] = []
  const cleanups: Array<() => unknown> = []
  const ctx = {
    commands: {
      register(definition: CommandDefinition) {
        command = definition
        return () => {}
      },
    },
    llm: {
      listProviders: () => [{ id: 'p', name: 'Provider' }],
      listModels: async () => [
        { provider: 'p', id: 'a', name: 'A' },
        { provider: 'p', id: 'b', name: 'B' },
        { provider: 'p', id: 'c', name: 'C' },
      ],
    },
    userQuestions: { ask },
    sessionTitle: {
      rename(_session: unknown, title: string) { renamed.push(title) },
    },
    settings: { get: () => ({ preference: locale }) },
    sessionProjections: {
      snapshot: (session: { blank: boolean }) => ({
        asOfSeq: -1,
        values: { sessionListMetadata: { blank: session.blank, lastPromptAt: null } },
      }),
    },
    subagents: {
      getProvider: () => provider ?? undefined,
      async start(_provider: string, request: SubagentStartRequest): Promise<SubagentRun> {
        childRequests.push(request)
        const properties = request.outputSchema?.properties
        const ranking = properties?.ranking?.items?.enum?.filter((item): item is string => typeof item === 'string')
        const structured = ranking !== undefined
          ? {
              ...review,
              evaluations: ranking.map(answerId => ({ answerId, strengths: ['good'], weaknesses: [] })),
              ranking,
            }
          : properties?.answerMarkdown === undefined ? undefined : arbiter
        const id = `child-${childRequests.length}`
        return {
          id: id as SubagentRun['id'],
          localAgent: undefined,
          result: Promise.resolve({
            stopReason: 'completed',
            output: structured === undefined ? [{ type: 'text', text: `Answer ${id}` }] : [],
            ...(structured === undefined ? {} : { structured }),
          }),
          async dispose() { disposed.push(id) },
        }
      },
    },
    on(event: string, listener: PreStepListener | SettingsListener) {
      if (event === 'agent/pre-step') preStep = listener as PreStepListener
      if (event === 'settings/updated') settingsUpdated = listener as SettingsListener
      return () => {
        if (event === 'agent/pre-step') preStep = undefined
        if (event === 'settings/updated') settingsUpdated = undefined
      }
    },
    effect(factory: () => Generator<unknown, void, unknown>) {
      const iterator = factory()
      for (let step = iterator.next(); !step.done; step = iterator.next()) {
        if (typeof step.value === 'function') cleanups.push(step.value as () => unknown)
      }
      return () => {}
    },
  } as unknown as Context
  apply(ctx, configuration)
  return {
    ctx,
    async dispose() { await Promise.all(cleanups.reverse().map(cleanup => cleanup())) },
    command: () => command,
    childRequests,
    disposed,
    renamed,
    preStep: () => preStep,
    setLocale(next: 'en' | 'zh') {
      locale = next
      settingsUpdated?.('locale')
    },
  }
}

function agentWithHistory(blank = false, listener?: () => PreStepListener | undefined): TestAgent {
  const events: Array<{ type: string }> = blank ? [] : [{ type: 'turn/start' }]
  let idle = Promise.resolve()
  const agent = {
    id: blank ? 'blank-root' : 'root',
    session: { blank },
    recordedEvents: events,
    ctx: {},
    followup(message: unknown) {
      events.push({ type: 'turn/start' })
      agent.session.blank = false
      idle = Promise.resolve(listener?.()?.(
        { agent: agent as unknown as Agent },
        () => Promise.resolve({ kind: 'enter', messages: [message as { id?: string }] }),
      )).then((decision) => {
        if (decision?.kind !== 'enter' || decision.messages?.length !== 0) {
          throw new Error('blank-session pre-step was not consumed')
        }
        events.push({ type: 'turn/end' })
      })
    },
    whenIdle: () => idle,
  }
  return agent as unknown as TestAgent
}

const existingAgent = agentWithHistory()
const invocation = (rawInput = '', agent: Agent = existingAgent) => ({
  commandId: 'command-1',
  agent,
  rawInput,
  attachments: [],
  signal: new AbortController().signal,
}) as unknown as CommandInvocation

describe('DSH command integration', () => {
  afterEach(() => vi.useRealTimers())
  it('registers /council and runs children with the selected routes and Web-only filter', async () => {
    const test = harness()
    const command = test.command()
    expect(command).toMatchObject({ name: 'council', recordInput: false })
    const result = await command?.handler(invocation())
    expect(result?.kind).toBe('success')
    expect(result?.text).toContain('Final answer')
    expect(test.renamed).toEqual([])
    expect(test.childRequests).toHaveLength(4)
    expect(test.childRequests.every(request => request.toolFilter?.allow?.join(',') === 'web_search,web_fetch')).toBe(true)
    expect(test.childRequests.map(request => request.agentOptions)).toEqual([
      { provider: 'p', model: 'a', maxTokens: 16_384 },
      { provider: 'p', model: 'b', maxTokens: 16_384 },
      { provider: 'p', model: 'c', maxTokens: 16_384 },
      { provider: 'p', model: 'a', maxTokens: 16_384 },
    ])
    expect(test.disposed).toHaveLength(4)
  })

  it('rejects arguments and overlapping runs in the same session', async () => {
    let release: ((value: typeof pickerAnswers) => void) | undefined
    const waiting = new Promise<typeof pickerAnswers>(resolve => { release = resolve })
    const test = harness(() => waiting)
    const command = test.command()
    await expect(command?.handler(invocation(' unexpected'))).resolves.toMatchObject({ kind: 'error' })
    const first = command?.handler(invocation())
    await expect(command?.handler(invocation())).resolves.toEqual({
      kind: 'error',
      text: 'A Council run is already active in this session.',
    })
    release?.(pickerAnswers)
    await expect(first).resolves.toMatchObject({ kind: 'success' })
  })

  it('registers during boot and reports a missing runtime provider only when invoked', async () => {
    const test = harness(async () => pickerAnswers, null)
    await expect(test.command()?.handler(invocation())).resolves.toEqual({
      kind: 'error',
      text: 'Council failed: subagent provider "spawn" is not registered',
    })
  })

  it('retains a command started on a blank session without making another model call', async () => {
    const test = harness()
    const blankAgent = agentWithHistory(true, test.preStep)
    const result = await test.command()?.handler(invocation('', blankAgent))
    expect(result).toMatchObject({ kind: 'success' })
    expect(test.renamed).toEqual(['Council'])
    expect(blankAgent.recordedEvents.some(event => event.type === 'turn/start')).toBe(true)
    expect(blankAgent.recordedEvents.some(event => event.type === 'step/start')).toBe(false)
    expect(test.childRequests).toHaveLength(4)
  })

  it('uses the live DSH locale for command metadata, workflow copy, and blank-session title', async () => {
    const test = harness(async () => pickerAnswers, undefined, 'zh')
    expect(test.command()?.description).toBe('运行匿名多模型议会')
    const blankAgent = agentWithHistory(true, test.preStep)
    const result = await test.command()?.handler(invocation('', blankAgent))
    expect(result?.text).toContain('# 议会裁决')
    expect(test.childRequests[0]?.label).toContain('议会回答')
    expect(test.childRequests[0]?.persona).toContain('简体中文')
    expect(test.renamed).toEqual(['议会'])

    test.setLocale('en')
    expect(test.command()?.description).toBe('Run an anonymous multi-model council')
  })

  it.each([
    ['en' as const, 'Council was canceled.'],
    ['zh' as const, '议会已取消。'],
  ])('localizes DSH question cancellation in %s', async (locale, expected) => {
    const cancelled = Object.assign(new Error('the user cancelled ask_user_question'), { code: 'ASK_CANCELLED' })
    const test = harness(async () => Promise.reject(cancelled), undefined, locale)
    await expect(test.command()?.handler(invocation())).resolves.toEqual({ kind: 'error', text: expected })
  })

  it('does not clear a user message batched with the blank-session marker', async () => {
    const test = harness()
    const userMessage = { id: 'ordinary-message' }
    const mixedAgent = agentWithHistory(true, () => async (payload, next) => {
      const decision = await next()
      const result = await test.preStep()?.(payload, async () => ({
        ...decision, messages: [...decision.messages, userMessage],
      }))
      expect(result?.messages).toEqual([userMessage])
      return { kind: 'enter', messages: [] }
    })
    expect(await test.command()?.handler(invocation('', mixedAgent))).toMatchObject({ kind: 'success' })
  })

  it('does not rename or create an extra turn when the user activates the session during a run', async () => {
    const blankAgent = agentWithHistory(true)
    const test = harness(async () => {
      blankAgent.session.blank = false
      return pickerAnswers
    })
    expect(await test.command()?.handler(invocation('', blankAgent))).toMatchObject({ kind: 'success' })
    expect(test.renamed).toEqual([])
    expect(blankAgent.recordedEvents).toEqual([])
  })

  it('keeps the final answer when retaining the session fails', async () => {
    const test = harness()
    const blankAgent = agentWithHistory(true, test.preStep)
    blankAgent.followup = () => { throw new Error('session closed') }
    const result = await test.command()?.handler(invocation('', blankAgent))
    expect(result?.text).toContain('Final answer')
    expect(result?.text).toContain('session closed')
  })

  it('returns a localized command error when the projection is missing', async () => {
    const test = harness(undefined, undefined, 'zh')
    test.ctx.sessionProjections.snapshot = () => ({ asOfSeq: -1, values: {} })
    expect(await test.command()?.handler(invocation())).toEqual({
      kind: 'error', text: '议会失败：DSH 会话元数据不可用。',
    })
    expect(test.childRequests).toHaveLength(0)
  })

  it('bounds a hung provider catalog while preserving the healthy provider', async () => {
    vi.useFakeTimers()
    const test = harness(undefined, undefined, 'en', { ...config, childTimeoutMs: 20 })
    test.ctx.llm.listProviders = () => [{ id: 'p', name: 'Provider' }, { id: 'hung', name: 'Hung' }]
    const listModels = test.ctx.llm.listModels
    test.ctx.llm.listModels = provider => provider === 'hung' ? new Promise(() => {}) : listModels(provider)
    const result = test.command()!.handler(invocation())
    await vi.advanceTimersByTimeAsync(21)
    expect(await result).toMatchObject({ kind: 'success' })
    expect((await result).text).toContain('Provider model discovery timed out.')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('releases session admission after cancellation during catalog discovery', async () => {
    const test = harness()
    const listModels = test.ctx.llm.listModels
    test.ctx.llm.listModels = () => new Promise(() => {})
    const controller = new AbortController()
    const pending = test.command()!.handler({ ...invocation(), signal: controller.signal })
    controller.abort()
    expect(await pending).toEqual({ kind: 'error', text: 'Council was canceled.' })
    test.ctx.llm.listModels = listModels
    expect(await test.command()!.handler(invocation())).toMatchObject({ kind: 'success' })
  })

  it('disposes a child whose result never settles when the command is cancelled', async () => {
    const test = harness()
    const controller = new AbortController()
    const disposed: string[] = []
    test.ctx.subagents.start = async () => ({
      id: 'pending-child' as SubagentRun['id'],
      localAgent: undefined,
      result: new Promise(() => {}),
      async dispose() { disposed.push('done') },
    })
    const started = vi.spyOn(test.ctx.subagents, 'start')
    const pending = test.command()!.handler({ ...invocation(), signal: controller.signal })
    await vi.waitFor(() => expect(started).toHaveBeenCalledTimes(2))
    controller.abort()
    expect(await pending).toMatchObject({ kind: 'error', text: 'Council was canceled.' })
    await vi.waitFor(() => expect(disposed).toHaveLength(2))
  })

  it('unloads promptly while a question provider ignores cancellation', async () => {
    const test = harness(async () => new Promise(() => {}))
    const pending = test.command()!.handler(invocation())
    await test.dispose()
    expect(await pending).toMatchObject({ kind: 'error', text: 'Council was canceled.' })
    expect(test.childRequests).toHaveLength(0)
  })

  it('keeps an in-progress run in its original language while later invocations use the new language', async () => {
    const test = harness(async () => { test.setLocale('zh'); return pickerAnswers })
    expect((await test.command()!.handler(invocation())).text).toContain('# Council Decision')
    expect(test.command()?.description).toBe('运行匿名多模型议会')
    expect((await test.command()!.handler(invocation())).text).toContain('# 议会裁决')
  })

  it.each([
    { childTimeoutMs: 0 }, { runTimeoutMs: 2 ** 31 }, { answerMaxTokens: NaN },
    { reviewMaxTokens: 1.5 }, { arbiterMaxTokens: Infinity }, { subagentProvider: ' ' },
    { runTimeoutMs: 1 },
  ])('rejects invalid configuration before registering the command: %o', (override) => {
    expect(() => harness(undefined, undefined, 'en', { ...config, ...override })).toThrow('dsh-council:')
  })
})
