import type { ObjectJsonSchema } from '@deepseek-ai/dsh-tools'
import type { CouncilCopy } from './locales.js'
import type {
  AggregateRank,
  AnswerRecord,
  ArbiterOutput,
  CallFailure,
  CouncilResult,
  ModelRef,
  ReviewRecord,
  ReviewerOutput,
} from './types.js'

const stringArraySchema = {
  type: 'array',
  items: { type: 'string' },
} as const

export function reviewerSchema(answerIds: readonly string[]): ObjectJsonSchema {
  const answerId: { type: 'string'; enum: string[] } = { type: 'string', enum: [...answerIds] }
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'evaluations',
      'consensus',
      'contradictions',
      'coverageGaps',
      'uniqueInsights',
      'blindSpots',
      'ranking',
    ],
    properties: {
      evaluations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['answerId', 'strengths', 'weaknesses'],
          properties: {
            answerId,
            strengths: stringArraySchema,
            weaknesses: stringArraySchema,
          },
        },
      },
      consensus: stringArraySchema,
      contradictions: stringArraySchema,
      coverageGaps: stringArraySchema,
      uniqueInsights: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['answerId', 'insight'],
          properties: { answerId, insight: { type: 'string' } },
        },
      },
      blindSpots: stringArraySchema,
      ranking: { type: 'array', items: answerId },
    },
  }
}

export const arbiterSchema: ObjectJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['answerMarkdown', 'consensus', 'contradictions', 'blindSpots', 'confidenceNotes'],
  properties: {
    answerMarkdown: { type: 'string' },
    consensus: stringArraySchema,
    contradictions: stringArraySchema,
    blindSpots: stringArraySchema,
    confidenceNotes: { type: 'string' },
  },
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseReviewerOutput(value: unknown, answerIds: readonly string[]): ReviewerOutput | undefined {
  if (!isRecord(value)
    || !Array.isArray(value.evaluations)
    || !isStringArray(value.consensus)
    || !isStringArray(value.contradictions)
    || !isStringArray(value.coverageGaps)
    || !Array.isArray(value.uniqueInsights)
    || !isStringArray(value.blindSpots)
    || !isStringArray(value.ranking)) return undefined

  const allowed = new Set(answerIds)
  const evaluations = value.evaluations.map((entry) => {
    if (!isRecord(entry)
      || typeof entry.answerId !== 'string'
      || !allowed.has(entry.answerId)
      || !isStringArray(entry.strengths)
      || !isStringArray(entry.weaknesses)) return undefined
    return {
      answerId: entry.answerId,
      strengths: entry.strengths,
      weaknesses: entry.weaknesses,
    }
  })
  if (evaluations.some(entry => entry === undefined)) return undefined

  const uniqueInsights = value.uniqueInsights.map((entry) => {
    if (!isRecord(entry)
      || typeof entry.answerId !== 'string'
      || !allowed.has(entry.answerId)
      || typeof entry.insight !== 'string') return undefined
    return { answerId: entry.answerId, insight: entry.insight }
  })
  if (uniqueInsights.some(entry => entry === undefined)) return undefined

  const ranking = value.ranking
  if (ranking.length !== answerIds.length
    || new Set(ranking).size !== ranking.length
    || ranking.some(id => !allowed.has(id))) return undefined
  if (evaluations.length !== answerIds.length
    || new Set(evaluations.map(entry => entry?.answerId)).size !== answerIds.length) return undefined

  return {
    evaluations: evaluations as ReviewerOutput['evaluations'],
    consensus: value.consensus,
    contradictions: value.contradictions,
    coverageGaps: value.coverageGaps,
    uniqueInsights: uniqueInsights as ReviewerOutput['uniqueInsights'],
    blindSpots: value.blindSpots,
    ranking,
  }
}

export function parseArbiterOutput(value: unknown): ArbiterOutput | undefined {
  if (!isRecord(value)
    || typeof value.answerMarkdown !== 'string'
    || value.answerMarkdown.trim() === ''
    || !isStringArray(value.consensus)
    || !isStringArray(value.contradictions)
    || !isStringArray(value.blindSpots)
    || typeof value.confidenceNotes !== 'string'
    || value.confidenceNotes.trim() === '') return undefined
  return {
    answerMarkdown: value.answerMarkdown,
    consensus: value.consensus,
    contradictions: value.contradictions,
    blindSpots: value.blindSpots,
    confidenceNotes: value.confidenceNotes,
  }
}

export function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    const current = copy[index]
    const replacement = copy[other]
    if (current === undefined || replacement === undefined) continue
    copy[index] = replacement
    copy[other] = current
  }
  return copy
}

export function aggregateRankings(reviews: readonly ReviewRecord[]): AggregateRank[] {
  const positions = new Map<string, number[]>()
  for (const review of reviews) {
    review.output.ranking.forEach((answerId, index) => {
      const values = positions.get(answerId) ?? []
      values.push(index + 1)
      positions.set(answerId, values)
    })
  }
  return [...positions].map(([answerId, values]) => ({
    answerId,
    averageRank: values.reduce((sum, value) => sum + value, 0) / values.length,
    votes: values.length,
  })).sort((left, right) => left.averageRank - right.averageRank || left.answerId.localeCompare(right.answerId))
}

export function answerPrompt(question: string, copy: CouncilCopy): string {
  return copy.answerPrompt(JSON.stringify({ question }))
}

export function reviewPrompt(question: string, answers: readonly AnswerRecord[], copy: CouncilCopy): string {
  return copy.reviewPrompt(JSON.stringify({
    question,
    answers: answers.map(answer => ({ id: answer.answerId, text: answer.text })),
  }))
}

export function arbiterPrompt(
  question: string,
  answers: readonly AnswerRecord[],
  reviews: readonly ReviewRecord[],
  aggregateRanking: readonly AggregateRank[],
  copy: CouncilCopy,
): string {
  return copy.arbiterPrompt(JSON.stringify({
    question,
    answers: answers.map(answer => ({ id: answer.answerId, text: answer.text })),
    reviews: reviews.map(review => ({ id: review.reviewId, ...review.output })),
    aggregateRanking,
  }))
}

function list(items: readonly string[], empty: string): string[] {
  return items.length === 0 ? [`- ${empty}`] : items.map(item => `- ${item}`)
}

function failureLine(failure: CallFailure, copy: CouncilCopy): string {
  return `- ${copy.stage(failure.stage)}: ${failure.model.key} — ${failure.message}`
}

export function renderCouncilResult(result: CouncilResult, copy: CouncilCopy): string {
  const answerMapping = result.answers.map(answer => `- ${answer.answerId} → ${answer.model.key}`)
  const reviewMapping = result.reviews.map(review => `- ${review.reviewId} → ${review.model.key}`)
  const ranking = result.aggregateRanking.map((entry, index) => {
    const answer = result.answers.find(candidate => candidate.answerId === entry.answerId)
    return `${index + 1}. ${entry.answerId} → ${answer?.model.key ?? copy.unknownAnswer} (${copy.averageRank(entry.averageRank, entry.votes)})`
  })
  const directoryFailures = result.directoryFailures.map(failure => `- ${copy.catalogStage}: ${failure.provider} — ${failure.message}`)
  const failures = [...directoryFailures, ...result.failures.map(failure => failureLine(failure, copy))]
  return [
    copy.decisionHeading,
    '',
    result.arbiter.answerMarkdown,
    '',
    copy.auditHeading,
    '',
    copy.mappingHeading,
    '',
    ...answerMapping,
    ...reviewMapping,
    `- ${copy.arbiterRole} → ${result.selection.arbiter.key}`,
    '',
    copy.rankingHeading,
    '',
    ...ranking,
    '',
    copy.consensusHeading,
    '',
    ...list(result.arbiter.consensus, copy.noConsensus),
    '',
    copy.contradictionsHeading,
    '',
    ...list(result.arbiter.contradictions, copy.noContradictions),
    '',
    copy.blindSpotsHeading,
    '',
    ...list(result.arbiter.blindSpots, copy.noBlindSpots),
    '',
    copy.confidenceHeading,
    '',
    result.arbiter.confidenceNotes,
    '',
    copy.failuresHeading,
    '',
    ...(failures.length === 0 ? [`- ${copy.noFailures}`] : failures),
  ].join('\n')
}

export function renderFailureAudit(
  message: string,
  directoryFailures: readonly { provider: string; message: string }[],
  failures: readonly CallFailure[],
  copy: CouncilCopy,
): string {
  const lines = [
    copy.failed(message),
    ...directoryFailures.map(failure => `${copy.catalogStage}: ${failure.provider} — ${failure.message}`),
    ...failures.map(failure => `${copy.stage(failure.stage)}: ${failure.model.key} — ${failure.message}`),
  ]
  return lines.join('\n')
}
