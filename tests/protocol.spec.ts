import { describe, expect, it } from 'vitest'
import {
  aggregateRankings,
  arbiterPrompt,
  parseArbiterOutput,
  parseReviewerOutput,
  renderCouncilResult,
  renderFailureAudit,
  reviewPrompt,
  shuffle,
} from '../src/protocol.js'
import { localeCopies } from '../src/locales.js'
import type { AnswerRecord, CouncilResult, ModelRef, ReviewRecord } from '../src/types.js'

const model = (key: string): ModelRef => {
  const [provider = '', id = ''] = key.split('/')
  return {
    provider,
    providerName: provider,
    model: id,
    modelName: id,
    key,
    optionLabel: key,
  }
}

const validReview = {
  evaluations: [
    { answerId: 'Answer A', strengths: ['accurate'], weaknesses: [] },
    { answerId: 'Answer B', strengths: [], weaknesses: ['thin'] },
  ],
  consensus: ['shared fact'],
  contradictions: ['different conclusion'],
  coverageGaps: ['missing case'],
  uniqueInsights: [{ answerId: 'Answer A', insight: 'useful detail' }],
  blindSpots: ['no benchmark'],
  ranking: ['Answer A', 'Answer B'],
}

describe('structured outputs', () => {
  it('accepts a complete review and rejects incomplete or duplicate rankings', () => {
    expect(parseReviewerOutput(validReview, ['Answer A', 'Answer B'])).toEqual(validReview)
    expect(parseReviewerOutput({ ...validReview, ranking: ['Answer A'] }, ['Answer A', 'Answer B'])).toBeUndefined()
    expect(parseReviewerOutput({ ...validReview, ranking: ['Answer A', 'Answer A'] }, ['Answer A', 'Answer B'])).toBeUndefined()
    expect(parseReviewerOutput({ ...validReview, evaluations: [validReview.evaluations[0]] }, ['Answer A', 'Answer B'])).toBeUndefined()
  })

  it('requires a non-empty final answer and confidence note', () => {
    const value = {
      answerMarkdown: 'Final answer',
      consensus: [],
      contradictions: [],
      blindSpots: [],
      confidenceNotes: 'High confidence',
    }
    expect(parseArbiterOutput(value)).toEqual(value)
    expect(parseArbiterOutput({ ...value, answerMarkdown: ' ' })).toBeUndefined()
  })

  it.each([
    { evaluations: [{ answerId: 'missing', strengths: [], weaknesses: [] }] },
    { uniqueInsights: [{ answerId: 'missing', insight: 'x' }] },
    { uniqueInsights: [{ answerId: 'Answer A', insight: ' ' }] },
    { consensus: [' '] }, { ranking: ['Answer A', 'missing'] },
  ])('rejects malformed reviewer evidence: %o', (change) => {
    expect(parseReviewerOutput({ ...validReview, ...change }, ['Answer A', 'Answer B'])).toBeUndefined()
  })
})

describe('anonymous protocol', () => {
  const answers: AnswerRecord[] = [
    { answerId: 'Answer A', model: model('secret-provider/secret-model'), text: 'First text' },
    { answerId: 'Answer B', model: model('other-provider/other-model'), text: 'Second text' },
  ]
  const reviews: ReviewRecord[] = [
    { reviewId: 'Review 1', model: model('reviewer/secret'), output: validReview },
  ]

  it('does not place provider or model identities in reviewer and arbiter prompts', () => {
    const review = reviewPrompt('Question', answers, localeCopies.en)
    const arbiter = arbiterPrompt('Question', answers, reviews, aggregateRankings(reviews), localeCopies.en)
    for (const prompt of [review, arbiter]) {
      expect(prompt).not.toContain('secret-provider')
      expect(prompt).not.toContain('other-provider')
      expect(prompt).not.toContain('reviewer/secret')
    }
    expect(review).toContain('Answer A')
    expect(arbiter).toContain('Review 1')
  })

  it('aggregates average positions with a stable label tie-break', () => {
    const second = {
      ...validReview,
      ranking: ['Answer B', 'Answer A'],
    }
    expect(aggregateRankings([...reviews, {
      reviewId: 'Review 2', model: model('reviewer/two'), output: second,
    }])).toEqual([
      { answerId: 'Answer A', averageRank: 1.5, votes: 2 },
      { answerId: 'Answer B', averageRank: 1.5, votes: 2 },
    ])
  })

  it('shuffles through an injected random source', () => {
    expect(shuffle(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a'])
  })

  it('reveals identities only in the user-facing audit', () => {
    const result: CouncilResult = {
      selection: {
        answerers: answers.map(answer => answer.model),
        reviewers: reviews.map(review => review.model),
        arbiter: model('arbiter/final'),
        question: 'Question',
      },
      directoryFailures: [{ provider: 'offline', message: 'catalog unavailable' }],
      answers,
      reviews,
      aggregateRanking: aggregateRankings(reviews),
      arbiter: {
        answerMarkdown: 'Final answer',
        consensus: ['C'],
        contradictions: ['D'],
        blindSpots: ['B'],
        confidenceNotes: 'N',
      },
      failures: [{ stage: 'review', model: model('p/failed'), message: 'refused' }],
    }
    const rendered = renderCouncilResult(result, localeCopies.en)
    expect(rendered).toContain('secret-provider/secret-model')
    expect(rendered).toContain('arbiter/final')
    expect(rendered).toContain('Final answer')
    expect(rendered).toContain('catalog unavailable')
    expect(rendered).toContain('refused')
  })

  it.each(['en', 'zh'] as const)('keeps catalog and stage failures in the %s audit', (locale) => {
    const copy = localeCopies[locale]
    const rendered = renderFailureAudit(copy.noAnswers, [{ provider: 'offline', message: 'offline' }],
      [{ stage: 'answer', model: model('p/a'), message: 'refused' }], copy)
    expect(rendered).toContain(copy.failed(copy.noAnswers))
    expect(rendered).toContain(`${copy.catalogStage}: offline`)
    expect(rendered).toContain(`${copy.stage('answer')}: p/a`)
  })
})
