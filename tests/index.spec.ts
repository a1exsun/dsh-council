import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CommandDefinition, CommandInvocation } from '@deepseek-ai/dsh-commands'
import type { SubagentRun, SubagentStartRequest } from '@deepseek-ai/dsh-subagent'
import { describe, expect, it } from 'vitest'
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

function harness(
  ask = async () => pickerAnswers,
  provider: { capabilities: { outputSchema: boolean; depthLimit: boolean; toolFilter: boolean; persona: boolean } } | null = {
    capabilities: { outputSchema: true, depthLimit: true, toolFilter: true, persona: true },
  },
) {
  let command: CommandDefinition | undefined
  let preStep: PreStepListener | undefined
  const childRequests: SubagentStartRequest[] = []
  const disposed: string[] = []
  const renamed: string[] = []
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
    subagents: {
      getProvider: () => provider ?? undefined,
      async start(_provider: string, request: SubagentStartRequest): Promise<SubagentRun> {
        childRequests.push(request)
        const label = request.label ?? ''
        const structured = label.startsWith('Council review')
          ? review
          : label.startsWith('Council arbiter') ? arbiter : undefined
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
    on(event: string, listener: PreStepListener) {
      if (event === 'agent/pre-step') preStep = listener
      return () => { preStep = undefined }
    },
    effect(factory: () => Generator<unknown, void, unknown>) {
      const iterator = factory()
      for (let step = iterator.next(); !step.done; step = iterator.next()) { /* mount effects */ }
      return () => {}
    },
  } as unknown as Context
  apply(ctx, config)
  return {
    command: () => command,
    childRequests,
    disposed,
    renamed,
    preStep: () => preStep,
  }
}

function agentWithHistory(blank = false, listener?: () => PreStepListener | undefined): Agent {
  const events: Array<{ type: string }> = blank ? [] : [{ type: 'turn/start' }]
  let idle = Promise.resolve()
  const agent = {
    id: blank ? 'blank-root' : 'root',
    session: { snapshotEvents: () => events },
    ctx: {},
    followup(message: unknown) {
      events.push({ type: 'turn/start' })
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
  return agent as unknown as Agent
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
      text: '当前会话已有 Council 正在运行。',
    })
    release?.(pickerAnswers)
    await expect(first).resolves.toMatchObject({ kind: 'success' })
  })

  it('registers during boot and reports a missing runtime provider only when invoked', async () => {
    const test = harness(async () => pickerAnswers, null)
    await expect(test.command()?.handler(invocation())).resolves.toEqual({
      kind: 'error',
      text: 'Council 失败：subagent provider "spawn" is not registered',
    })
  })

  it('retains a command started on a blank session without making another model call', async () => {
    const test = harness()
    const blankAgent = agentWithHistory(true, test.preStep)
    const result = await test.command()?.handler(invocation('', blankAgent))
    expect(result).toMatchObject({ kind: 'success' })
    expect(test.renamed).toEqual(['Council'])
    expect(blankAgent.session.snapshotEvents().some(event => event.type === 'turn/start')).toBe(true)
    expect(blankAgent.session.snapshotEvents().some(event => event.type === 'step/start')).toBe(false)
    expect(test.childRequests).toHaveLength(4)
  })
})
