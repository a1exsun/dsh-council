export interface ModelRef {
  readonly provider: string
  readonly providerName: string
  readonly model: string
  readonly modelName: string
  readonly key: string
  readonly optionLabel: string
}

export interface CatalogFailure {
  readonly provider: string
  readonly message: string
}

export interface ModelDirectory {
  readonly models: readonly ModelRef[]
  readonly failures: readonly CatalogFailure[]
}

export interface CouncilSelection {
  readonly answerers: readonly ModelRef[]
  readonly reviewers: readonly ModelRef[]
  readonly arbiter: ModelRef
  readonly question: string
}

export interface ReviewEvaluation {
  readonly answerId: string
  readonly strengths: readonly string[]
  readonly weaknesses: readonly string[]
}

export interface UniqueInsight {
  readonly answerId: string
  readonly insight: string
}

export interface ReviewerOutput {
  readonly evaluations: readonly ReviewEvaluation[]
  readonly consensus: readonly string[]
  readonly contradictions: readonly string[]
  readonly coverageGaps: readonly string[]
  readonly uniqueInsights: readonly UniqueInsight[]
  readonly blindSpots: readonly string[]
  readonly ranking: readonly string[]
}

export interface ArbiterOutput {
  readonly answerMarkdown: string
  readonly consensus: readonly string[]
  readonly contradictions: readonly string[]
  readonly blindSpots: readonly string[]
  readonly confidenceNotes: string
}

export type CouncilStage = 'answer' | 'review' | 'arbiter'

export interface CallFailure {
  readonly stage: CouncilStage
  readonly model: ModelRef
  readonly message: string
}

export interface AnswerRecord {
  readonly answerId: string
  readonly model: ModelRef
  readonly text: string
  readonly childId?: string
}

export interface ReviewRecord {
  readonly reviewId: string
  readonly model: ModelRef
  readonly output: ReviewerOutput
  readonly childId?: string
}

export interface AggregateRank {
  readonly answerId: string
  readonly averageRank: number
  readonly votes: number
}

export interface CouncilResult {
  readonly selection: CouncilSelection
  readonly directoryFailures: readonly CatalogFailure[]
  readonly answers: readonly AnswerRecord[]
  readonly reviews: readonly ReviewRecord[]
  readonly aggregateRanking: readonly AggregateRank[]
  readonly arbiter: ArbiterOutput
  readonly failures: readonly CallFailure[]
}
