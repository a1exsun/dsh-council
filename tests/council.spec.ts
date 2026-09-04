import { describe, expect, it } from 'vitest'
import {
  parseSelection,
  runCouncil,
  selectionQuestions,
  type ChildOutcome,
  type ChildRequest,
  type CouncilAnswer,
  type CouncilConfig,
  type CouncilRuntime,
} from '../src/council.js'
import type { ModelDirectory, ModelRef } from '../src/types.js'

const config: CouncilConfig = {
  answerMaxTokens: 16_384,
  reviewMaxTokens: 16_384,
  arbiterMaxTokens: 16_384,
  childTimeoutMs: 300_000,
  runTimeoutMs: 900_000,
  subagentProvider: 'spawn',
}

function model(key: string): ModelRef {
  const [provider = '', id = ''] = key.split('/')
  return { provider, providerName: provider, model: id, modelName: id, key, optionLabel: key }
}

const models = [model('p/a'), model('p/b'), model('p/c'), model('p/d')]
const directory: ModelDirectory = { models, failures: [] }
const pickerAnswers: CouncilAnswer[] = [
  { id: 'answerers', selected: ['p/a', 'p/b'] },
  { id: 'reviewers', selected: ['p/c', 'p/d'] },
  { id: 'arbiter', selected: ['p/a'] },
  { id: 'question', selected: [], custom: 'What is the answer?' },
]

const review = (ranking: string[]) => ({
  evaluations: ranking.map(answerId => ({ answerId, strengths: ['good'], weaknesses: [] })),
  consensus: ['common'],
  contradictions: [],
  coverageGaps: [],
  uniqueInsights: [],
  blindSpots: [],
  ranking,
})

const arbiter = {
  answerMarkdown: 'Council answer',
  consensus: ['common'],
  contradictions: [],
  blindSpots: [],
  confidenceNotes: 'High confidence',
}

function successfulRuntime(overrides: Partial<CouncilRuntime> = {}) {
  const calls: ChildRequest[] = []
  const stageCounts = { answer: 0, review: 0 }
  let releaseAnswers: (() => void) | undefined
  let releaseReviews: (() => void) | undefined
  const answerBarrier = new Promise<void>(resolve => { releaseAnswers = resolve })
  const reviewBarrier = new Promise<void>(resolve => { releaseReviews = resolve })
  const runtime: CouncilRuntime = {
    discover: async () => directory,
    ask: async () => pickerAnswers,
    random: () => 0.999,
    async runChild(request) {
      calls.push(request)
      if (request.stage === 'answer') {
        stageCounts.answer += 1
        if (stageCounts.answer === 2) releaseAnswers?.()
        await answerBarrier
        return { stopReason: 'completed', text: `Answer from ${request.model.model}`, childId: request.model.key }
      }
      if (request.stage === 'review') {
        stageCounts.review += 1
        if (stageCounts.review === 2) releaseReviews?.()
        await reviewBarrier
        return {
          stopReason: 'completed',
          text: '',
          structured: review(request.model.model === 'c'
            ? ['Answer A', 'Answer B']
            : ['Answer B', 'Answer A']),
          childId: request.model.key,
        }
      }
      return { stopReason: 'completed', text: '', structured: arbiter, childId: request.model.key }
    },
    ...overrides,
  }
  return { runtime, calls }
}

describe('selection', () => {
  it('builds four questions and reports failed provider catalogs', () => {
    const questions = selectionQuestions({
      models,
      failures: [{ provider: 'broken', message: 'offline' }],
    })
    expect(questions.map(question => question.id)).toEqual(['answerers', 'reviewers', 'arbiter', 'question'])
    expect(questions[0]?.detail).toContain('broken')
  })

  it('allows cross-role reuse but rejects custom model routes', () => {
    expect(parseSelection(directory, pickerAnswers).arbiter.key).toBe('p/a')
    expect(() => parseSelection(directory, pickerAnswers.map(answer => answer.id === 'reviewers'
      ? { ...answer, custom: 'p/unknown' }
      : answer))).toThrow(/不能手写路由/)
  })
})

describe('council orchestration', () => {
  it('runs each stage in parallel, enforces stage barriers, and keeps final inputs anonymous', async () => {
    const { runtime, calls } = successfulRuntime()
    const result = await runCouncil(runtime, config, new AbortController().signal)
    expect(calls.map(call => call.stage)).toEqual(['answer', 'answer', 'review', 'review', 'arbiter'])
    expect(calls.filter(call => call.stage === 'answer').every(call => call.maxTokens === 16_384)).toBe(true)
    expect(calls.filter(call => call.stage === 'review').every(call => call.outputSchema !== undefined)).toBe(true)
    const finalPrompt = calls.at(-1)?.prompt ?? ''
    expect(finalPrompt).not.toContain('p/a')
    expect(finalPrompt).not.toContain('p/b')
    expect(finalPrompt).not.toContain('p/c')
    expect(result.arbiter.answerMarkdown).toBe('Council answer')
    expect(result.aggregateRanking).toEqual([
      { answerId: 'Answer A', averageRank: 1.5, votes: 2 },
      { answerId: 'Answer B', averageRank: 1.5, votes: 2 },
    ])
  })

  it('continues with one successful answer and one successful review', async () => {
    const { runtime } = successfulRuntime({
      async runChild(request): Promise<ChildOutcome> {
        if (request.stage === 'answer') {
          return request.model.model === 'a'
            ? { stopReason: 'completed', text: 'Only answer' }
            : { stopReason: 'error', text: '', diagnostic: 'answer failed' }
        }
        if (request.stage === 'review') {
          return request.model.model === 'c'
            ? { stopReason: 'completed', text: '', structured: review(['Answer A']) }
            : { stopReason: 'error', text: '', diagnostic: 'review failed' }
        }
        return { stopReason: 'completed', text: '', structured: arbiter }
      },
    })
    const result = await runCouncil(runtime, config, new AbortController().signal)
    expect(result.answers).toHaveLength(1)
    expect(result.reviews).toHaveLength(1)
    expect(result.failures).toHaveLength(2)
  })

  it('fails when every answerer fails', async () => {
    const { runtime } = successfulRuntime({
      runChild: async request => request.stage === 'answer'
        ? { stopReason: 'error', text: '' }
        : { stopReason: 'completed', text: '', structured: arbiter },
    })
    await expect(runCouncil(runtime, config, new AbortController().signal))
      .rejects.toMatchObject({ name: 'CouncilRunError', message: '没有回答人成功返回非空答案。' })
  })

  it('fails when the arbiter returns no structured result', async () => {
    const base = successfulRuntime()
    const original = base.runtime.runChild
    base.runtime.runChild = async request => request.stage === 'arbiter'
      ? { stopReason: 'completed', text: 'plain text only' }
      : original(request)
    await expect(runCouncil(base.runtime, config, new AbortController().signal))
      .rejects.toMatchObject({ name: 'CouncilRunError', message: '裁决人未返回有效裁决。' })
  })
})
