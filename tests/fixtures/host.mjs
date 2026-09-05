import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'

export const name = 'council-smoke'
export const inject = ['commands', 'agents', 'agentPresets', 'llm', 'settings', 'sessions', 'sessionPersistence', 'sessionProjections', 'userQuestions', 'subagents']
const calls = []
const guardChecks = []
let forbiddenExecutions = 0
class TestAdapter extends LlmAdapter {
  async listModels(provider) {
    return ['a', 'b', 'c'].map(id => ({ provider, id, name: id }))
  }
  async *stream(options) {
    options.signal?.throwIfAborted()
    if (JSON.stringify(options.messages).includes('PARENT_HISTORY_SENTINEL')) {
      assert.equal(options.sessionId, 'session-council-host-zh', 'Parent history leaked into a child')
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Parent history established.' } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }
    calls.push(options)
    assert(!JSON.stringify(options.messages).includes('PARENT_HISTORY_SENTINEL'), 'Children must start without parent history')
    const allowed = new Set(['web_search', 'web_fetch', 'structured_output'])
    assert((options.tools ?? []).every(tool => allowed.has(tool.name)), 'Unexpected child tool access')
    const tool = options.tools?.find(tool => tool.name === 'structured_output')
    let block
    if (!tool) block = { type: 'text', text: 'Independent test answer.' }
    else {
      const ranking = tool.parameters.properties.ranking?.items.enum
      const output = ranking ? {
        evaluations: ranking.map(answerId => ({ answerId, strengths: ['supported'], weaknesses: [] })),
        consensus: ['shared evidence'], contradictions: [], coverageGaps: [], uniqueInsights: [], blindSpots: [], ranking,
      } : {
        answerMarkdown: 'HOST_VERIFIED_FINAL', consensus: ['shared evidence'], contradictions: [],
        blindSpots: [], confidenceNotes: 'Deterministic fixture; not a model quality benchmark.',
      }
      const prompt = JSON.stringify(options.messages)
      assert(!prompt.includes('council-test/'), 'Model routing metadata leaked into deliberation input')
      block = { type: 'tool-call', id: `call-${calls.length}`, name: 'structured_output', arguments: JSON.stringify(output) }
    }
    yield { type: 'block-start', index: 0, blockType: block.type }
    yield { type: 'block-end', index: 0, block }
    yield { type: 'finish', reason: { kind: tool ? 'tool-calls' : 'stop' } }
  }
}

export function apply(ctx) {
  ctx.on('session/event', (_session, event) => {
    if (event.type === 'turn/end' && event.data.reason.kind === 'error') process.stderr.write(`${JSON.stringify(event)}\n`)
  }, { global: true })
  ctx.on('agent/created', ({ agent }) => {
    if (!agent.session.header.parentSession?.startsWith('session-council-host-')) return
    const schema = { type: 'object', additionalProperties: false, properties: {}, required: [] }
    agent.ctx.tools.register({
      name: 'council_forbidden_probe', description: 'Verify that child-local tools cannot bypass Council.',
      parameters: schema,
      output: { schema, render: () => [] },
      async execute() { forbiddenExecutions += 1; return {} },
    })
    guardChecks.push(agent.ctx.tools.execute({
      name: 'council_forbidden_probe', arguments: {}, agent,
      callId: `guard-${guardChecks.length}`, signal: new AbortController().signal,
    }).then(result => assert.equal(result.isError, true)))
  }, { global: true })
  ctx.llm.registerAdapter(['council-test'], new TestAdapter())
  ctx.on('user-questions/request', async ({ questions }) => {
    process.stdout.write('SMOKE picker answered\n')
    assert.deepEqual(questions.map(question => question.id), ['answerers', 'reviewers', 'arbiter', 'question'])
    const select = id => questions[0].options.find(option => option.label.endsWith(`[council-test/${id}]`)).label
    return { answers: [
      { id: 'answerers', selected: [select('a'), select('b')] },
      { id: 'reviewers', selected: [select('c')] },
      { id: 'arbiter', selected: [select('a')] },
      { id: 'question', selected: [], custom: 'Compare two independent solutions.' },
    ] }
  }, { global: true, prepend: true })
  const exit = ctx.get('appExit')
  void (async () => {
    await ctx.get('loader').await()
    process.stdout.write('SMOKE host loaded\n')
    for (const locale of ['en', 'zh']) {
      await ctx.settings.update('locale', { preference: locale })
      const handle = await ctx.agents.create({
        sessionId: `session-council-host-${locale}`,
        meta: { cwd: process.cwd() }, agentOptions: { provider: 'council-test', model: 'a' },
        setup: async agentContext => { await ctx.agentPresets.mount(agentContext) },
      })
      const { agent } = handle
      await agent.whenIdle()
      if (locale === 'zh') {
        agent.followup(createUserMessage({ content: [{ type: 'text', text: 'PARENT_HISTORY_SENTINEL' }], source: { kind: 'user' } }))
        await agent.whenIdle()
      }
      const stepsBefore = agent.session.snapshotEvents().filter(event => event.type === 'step/start').length
      process.stdout.write(`SMOKE ${locale} invoking council\n`)
      const execution = await ctx.commands.execute(agent, '/council', [], new AbortController().signal)
      assert.equal(execution?.result.kind, 'success', execution?.result.text)
      assert(execution.result.text.includes('HOST_VERIFIED_FINAL'))
      assert(execution.result.text.includes(locale === 'en' ? '# Council Decision' : '# 议会裁决'))
      assert.equal(ctx.sessionProjections.snapshot(agent.session).values.sessionListMetadata.blank, false)
      const events = agent.session.snapshotEvents()
      assert(events.some(event => event.type === 'command/done' && event.data.text.includes('HOST_VERIFIED_FINAL')))
      assert.equal(events.filter(event => event.type === 'step/start').length, stepsBefore, 'Unexpected parent model completion')
      await ctx.sessions.flush(agent.session)
      await handle.dispose()
      const reloaded = await ctx.sessionPersistence.load(agent.id)
      assert(reloaded.events.some(event => event.type === 'command/done' && event.data.text?.includes('HOST_VERIFIED_FINAL')), 'Final result must survive cold reload')
    }
    await Promise.all(guardChecks)
    assert.equal(guardChecks.length, 8)
    assert.equal(forbiddenExecutions, 0)
    assert.equal(calls.length, 8)
    writeFileSync('report.json', JSON.stringify({ calls: calls.length, guardChecks: guardChecks.length, coldReloads: 2, locales: ['en', 'zh'] }))
    process.stdout.write('COUNCIL_HOST_OK\n')
    exit(0)
  })().catch(error => { process.stderr.write(`${error.stack}\n`); exit(1) })
}
