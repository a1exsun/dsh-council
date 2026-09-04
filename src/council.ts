import type { ObjectJsonSchema } from '@deepseek-ai/dsh-tools'
import type { CouncilCopy } from './locales.js'
import {
  aggregateRankings,
  answerPrompt,
  arbiterPrompt,
  arbiterSchema,
  parseArbiterOutput,
  parseReviewerOutput,
  reviewPrompt,
  reviewerSchema,
  shuffle,
} from './protocol.js'
import type {
  AnswerRecord,
  ArbiterOutput,
  CallFailure,
  CouncilResult,
  CouncilSelection,
  CouncilStage,
  ModelDirectory,
  ModelRef,
  ReviewRecord,
} from './types.js'

export interface CouncilConfig {
  readonly answerMaxTokens: number
  readonly reviewMaxTokens: number
  readonly arbiterMaxTokens: number
  readonly childTimeoutMs: number
  readonly runTimeoutMs: number
  readonly subagentProvider: string
}

export interface CouncilQuestion {
  readonly id: string
  readonly question: string
  readonly header?: string
  readonly detail?: string
  readonly options?: readonly { readonly label: string; readonly description?: string }[]
  readonly multiSelect?: boolean
}

export interface CouncilAnswer {
  readonly id: string
  readonly selected: readonly string[]
  readonly custom?: string
}

export interface ChildRequest {
  readonly stage: CouncilStage
  readonly label: string
  readonly model: ModelRef
  readonly prompt: string
  readonly persona: string
  readonly maxTokens: number
  readonly outputSchema?: ObjectJsonSchema
  readonly timeoutMs: number
  readonly signal: AbortSignal
}

export interface ChildOutcome {
  readonly stopReason: string
  readonly text: string
  readonly structured?: unknown
  readonly diagnostic?: string
  readonly childId?: string
}

export interface CouncilRuntime {
  discover(signal: AbortSignal): Promise<ModelDirectory>
  ask(questions: readonly CouncilQuestion[], signal: AbortSignal): Promise<readonly CouncilAnswer[]>
  runChild(request: ChildRequest): Promise<ChildOutcome>
  random(): number
}

export class CouncilRunError extends Error {
  constructor(
    message: string,
    readonly directoryFailures: ModelDirectory['failures'],
    readonly failures: readonly CallFailure[],
  ) {
    super(message)
    this.name = 'CouncilRunError'
  }
}

function messageOf(error: unknown, copy: CouncilCopy): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message
  return copy.unknownFailure
}

function childFailure(
  stage: CouncilStage,
  model: ModelRef,
  outcome: ChildOutcome,
  copy: CouncilCopy,
): CallFailure {
  const detail = outcome.diagnostic?.trim()
  return {
    stage,
    model,
    message: detail === undefined || detail === '' ? copy.childStopped(outcome.stopReason) : detail,
  }
}

function thrownFailure(stage: CouncilStage, model: ModelRef, error: unknown, copy: CouncilCopy): CallFailure {
  return { stage, model, message: messageOf(error, copy) }
}

function selectedModels(
  answer: CouncilAnswer | undefined,
  byLabel: ReadonlyMap<string, ModelRef>,
  minimum: number,
  maximum: number,
  role: string,
  copy: CouncilCopy,
): ModelRef[] {
  if (answer?.custom?.trim()) throw new Error(copy.customModel(role))
  const labels = answer?.selected ?? []
  const models = labels.map(label => byLabel.get(label))
  if (models.some(model => model === undefined)) throw new Error(copy.unknownModel(role))
  const resolved = models as ModelRef[]
  if (resolved.length < minimum || resolved.length > maximum) {
    throw new Error(copy.selectionCount(role, minimum, maximum))
  }
  if (new Set(resolved.map(model => model.key)).size !== resolved.length) {
    throw new Error(copy.duplicateModel(role))
  }
  return resolved
}

export function parseSelection(
  directory: ModelDirectory,
  answers: readonly CouncilAnswer[],
  copy: CouncilCopy,
): CouncilSelection {
  const byId = new Map(answers.map(answer => [answer.id, answer]))
  const byLabel = new Map(directory.models.map(model => [model.optionLabel, model]))
  const answerers = selectedModels(byId.get('answerers'), byLabel, 2, 8, copy.answererRole, copy)
  const reviewers = selectedModels(byId.get('reviewers'), byLabel, 1, 8, copy.reviewerRole, copy)
  const arbiters = selectedModels(byId.get('arbiter'), byLabel, 1, 1, copy.arbiterRole, copy)
  const promptAnswer = byId.get('question')
  if ((promptAnswer?.selected.length ?? 0) > 0) throw new Error(copy.questionTextOnly)
  const question = promptAnswer?.custom?.trim() ?? ''
  if (question === '') throw new Error(copy.questionRequired)
  return { answerers, reviewers, arbiter: arbiters[0] as ModelRef, question }
}

export function selectionQuestions(directory: ModelDirectory, copy: CouncilCopy): CouncilQuestion[] {
  const options = directory.models.map(model => ({
    label: model.optionLabel,
    description: model.key,
  }))
  const detail = directory.failures.length === 0
    ? undefined
    : copy.unavailableCatalogs(directory.failures.map(failure => failure.provider))
  return [
    {
      id: 'answerers',
      header: copy.answererHeader,
      question: copy.answererQuestion,
      options,
      multiSelect: true,
      ...(detail === undefined ? {} : { detail }),
    },
    {
      id: 'reviewers',
      header: copy.reviewerHeader,
      question: copy.reviewerQuestion,
      options,
      multiSelect: true,
    },
    {
      id: 'arbiter',
      header: copy.arbiterHeader,
      question: copy.arbiterQuestion,
      options,
    },
    {
      id: 'question',
      header: copy.topicHeader,
      question: copy.topicQuestion,
    },
  ]
}

async function runStage(
  runtime: CouncilRuntime,
  requests: readonly ChildRequest[],
): Promise<readonly PromiseSettledResult<ChildOutcome>[]> {
  return Promise.allSettled(requests.map(request => runtime.runChild(request)))
}

export async function runCouncil(
  runtime: CouncilRuntime,
  config: CouncilConfig,
  commandSignal: AbortSignal,
  copy: CouncilCopy,
): Promise<CouncilResult> {
  commandSignal.throwIfAborted()
  const directory = await runtime.discover(commandSignal)
  if (directory.models.length < 2) {
    throw new CouncilRunError(copy.noModels, directory.failures, [])
  }
  const selection = parseSelection(
    directory,
    await runtime.ask(selectionQuestions(directory, copy), commandSignal),
    copy,
  )
  const runSignal = AbortSignal.any([commandSignal, AbortSignal.timeout(config.runTimeoutMs)])
  const failures: CallFailure[] = []

  const answerRequests = selection.answerers.map((model, index): ChildRequest => ({
    stage: 'answer',
    label: copy.childAnswer(index, model.key),
    model,
    prompt: answerPrompt(selection.question, copy),
    persona: copy.answerPersona,
    maxTokens: config.answerMaxTokens,
    timeoutMs: config.childTimeoutMs,
    signal: runSignal,
  }))
  const answerSettlements = await runStage(runtime, answerRequests)
  runSignal.throwIfAborted()
  const successfulAnswers: { model: ModelRef; outcome: ChildOutcome }[] = []
  answerSettlements.forEach((settlement, index) => {
    const model = selection.answerers[index] as ModelRef
    if (settlement.status === 'rejected') failures.push(thrownFailure('answer', model, settlement.reason, copy))
    else if (settlement.value.stopReason !== 'completed' || settlement.value.text.trim() === '') {
      failures.push(childFailure('answer', model, settlement.value, copy))
    } else successfulAnswers.push({ model, outcome: settlement.value })
  })
  if (successfulAnswers.length === 0) {
    throw new CouncilRunError(copy.noAnswers, directory.failures, failures)
  }

  const answers: AnswerRecord[] = shuffle(successfulAnswers, () => runtime.random()).map((entry, index) => ({
    answerId: copy.answerId(index),
    model: entry.model,
    text: entry.outcome.text.trim(),
    ...(entry.outcome.childId === undefined ? {} : { childId: entry.outcome.childId }),
  }))
  const answerIds = answers.map(answer => answer.answerId)
  const reviewRequests = selection.reviewers.map((model, index): ChildRequest => ({
    stage: 'review',
    label: copy.childReview(index, model.key),
    model,
    prompt: reviewPrompt(selection.question, answers, copy),
    persona: copy.reviewPersona,
    maxTokens: config.reviewMaxTokens,
    outputSchema: reviewerSchema(answerIds),
    timeoutMs: config.childTimeoutMs,
    signal: runSignal,
  }))
  const reviewSettlements = await runStage(runtime, reviewRequests)
  runSignal.throwIfAborted()
  const reviews: ReviewRecord[] = []
  reviewSettlements.forEach((settlement, index) => {
    const model = selection.reviewers[index] as ModelRef
    if (settlement.status === 'rejected') {
      failures.push(thrownFailure('review', model, settlement.reason, copy))
      return
    }
    const output = settlement.value.stopReason === 'completed'
      ? parseReviewerOutput(settlement.value.structured, answerIds)
      : undefined
    if (output === undefined) {
      failures.push(childFailure('review', model, {
        ...settlement.value,
        diagnostic: settlement.value.diagnostic ?? copy.invalidReview,
      }, copy))
      return
    }
    reviews.push({
      reviewId: copy.reviewId(index),
      model,
      output,
      ...(settlement.value.childId === undefined ? {} : { childId: settlement.value.childId }),
    })
  })
  if (reviews.length === 0) {
    throw new CouncilRunError(copy.noReviews, directory.failures, failures)
  }

  const aggregateRanking = aggregateRankings(reviews)
  const arbiterRequest: ChildRequest = {
    stage: 'arbiter',
    label: copy.childArbiter(selection.arbiter.key),
    model: selection.arbiter,
    prompt: arbiterPrompt(selection.question, answers, reviews, aggregateRanking, copy),
    persona: copy.arbiterPersona,
    maxTokens: config.arbiterMaxTokens,
    outputSchema: arbiterSchema,
    timeoutMs: config.childTimeoutMs,
    signal: runSignal,
  }
  let arbiterOutcome: ChildOutcome
  try {
    arbiterOutcome = await runtime.runChild(arbiterRequest)
  } catch (error: unknown) {
    failures.push(thrownFailure('arbiter', selection.arbiter, error, copy))
    throw new CouncilRunError(copy.arbiterFailed, directory.failures, failures)
  }
  const arbiter: ArbiterOutput | undefined = arbiterOutcome.stopReason === 'completed'
    ? parseArbiterOutput(arbiterOutcome.structured)
    : undefined
  if (arbiter === undefined) {
    failures.push(childFailure('arbiter', selection.arbiter, {
      ...arbiterOutcome,
      diagnostic: arbiterOutcome.diagnostic ?? copy.invalidArbiter,
    }, copy))
    throw new CouncilRunError(copy.arbiterInvalid, directory.failures, failures)
  }

  return {
    selection,
    directoryFailures: directory.failures,
    answers,
    reviews,
    aggregateRanking,
    arbiter,
    failures,
  }
}
