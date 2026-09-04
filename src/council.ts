import type { ObjectJsonSchema } from '@deepseek-ai/dsh-tools'
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

const ANSWER_PERSONA = 'You are an anonymous answerer in a deliberation council. Produce an independent, evidence-focused answer. Use no more than four web tool calls.'
const REVIEW_PERSONA = 'You are an anonymous reviewer in a deliberation council. Compare candidate answers impartially and finish through structured_output. Use no more than four web tool calls.'
const ARBITER_PERSONA = 'You are the anonymous final arbiter of a deliberation council. Resolve disagreements and finish through structured_output. Use no more than four web tool calls.'

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message
  return 'unknown failure'
}

function childFailure(stage: CouncilStage, model: ModelRef, outcome: ChildOutcome): CallFailure {
  const detail = outcome.diagnostic?.trim()
  return {
    stage,
    model,
    message: detail === undefined || detail === '' ? `child stopped with ${outcome.stopReason}` : detail,
  }
}

function thrownFailure(stage: CouncilStage, model: ModelRef, error: unknown): CallFailure {
  return { stage, model, message: messageOf(error) }
}

function selectedModels(
  answer: CouncilAnswer | undefined,
  byLabel: ReadonlyMap<string, ModelRef>,
  minimum: number,
  maximum: number,
  role: string,
): ModelRef[] {
  if (answer?.custom?.trim()) throw new Error(`${role}必须从当前模型目录中选择，不能手写路由。`)
  const labels = answer?.selected ?? []
  const models = labels.map(label => byLabel.get(label))
  if (models.some(model => model === undefined)) throw new Error(`${role}包含不在当前目录中的模型。`)
  const resolved = models as ModelRef[]
  if (resolved.length < minimum || resolved.length > maximum) {
    throw new Error(`${role}必须选择 ${minimum}–${maximum} 个模型。`)
  }
  if (new Set(resolved.map(model => model.key)).size !== resolved.length) {
    throw new Error(`${role}不能包含重复模型。`)
  }
  return resolved
}

export function parseSelection(directory: ModelDirectory, answers: readonly CouncilAnswer[]): CouncilSelection {
  const byId = new Map(answers.map(answer => [answer.id, answer]))
  const byLabel = new Map(directory.models.map(model => [model.optionLabel, model]))
  const answerers = selectedModels(byId.get('answerers'), byLabel, 2, 8, '回答人')
  const reviewers = selectedModels(byId.get('reviewers'), byLabel, 1, 8, '评审人')
  const arbiters = selectedModels(byId.get('arbiter'), byLabel, 1, 1, '裁决人')
  const promptAnswer = byId.get('question')
  if ((promptAnswer?.selected.length ?? 0) > 0) throw new Error('问题必须使用文本输入。')
  const question = promptAnswer?.custom?.trim() ?? ''
  if (question === '') throw new Error('问题不能为空。')
  return { answerers, reviewers, arbiter: arbiters[0] as ModelRef, question }
}

export function selectionQuestions(directory: ModelDirectory): CouncilQuestion[] {
  const options = directory.models.map(model => ({
    label: model.optionLabel,
    description: model.key,
  }))
  const detail = directory.failures.length === 0
    ? undefined
    : `以下 provider 目录读取失败，未列入选择：${directory.failures.map(failure => failure.provider).join('、')}`
  return [
    {
      id: 'answerers',
      header: '回答人',
      question: '选择 2–8 个独立回答问题的模型。',
      options,
      multiSelect: true,
      ...(detail === undefined ? {} : { detail }),
    },
    {
      id: 'reviewers',
      header: '评审人',
      question: '选择 1–8 个评审匿名回答的模型。',
      options,
      multiSelect: true,
    },
    {
      id: 'arbiter',
      header: '裁决人',
      question: '选择一个负责最终汇总与裁决的模型。',
      options,
    },
    {
      id: 'question',
      header: '议题',
      question: '输入本次需要议会回答的问题。',
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
): Promise<CouncilResult> {
  commandSignal.throwIfAborted()
  const directory = await runtime.discover(commandSignal)
  if (directory.models.length < 2) {
    throw new CouncilRunError('当前可用模型不足两个。', directory.failures, [])
  }
  const selection = parseSelection(directory, await runtime.ask(selectionQuestions(directory), commandSignal))
  const runSignal = AbortSignal.any([commandSignal, AbortSignal.timeout(config.runTimeoutMs)])
  const failures: CallFailure[] = []

  const answerRequests = selection.answerers.map((model, index): ChildRequest => ({
    stage: 'answer',
    label: `Council answer ${index + 1}: ${model.key}`,
    model,
    prompt: answerPrompt(selection.question),
    persona: ANSWER_PERSONA,
    maxTokens: config.answerMaxTokens,
    timeoutMs: config.childTimeoutMs,
    signal: runSignal,
  }))
  const answerSettlements = await runStage(runtime, answerRequests)
  runSignal.throwIfAborted()
  const successfulAnswers: { model: ModelRef; outcome: ChildOutcome }[] = []
  answerSettlements.forEach((settlement, index) => {
    const model = selection.answerers[index] as ModelRef
    if (settlement.status === 'rejected') failures.push(thrownFailure('answer', model, settlement.reason))
    else if (settlement.value.stopReason !== 'completed' || settlement.value.text.trim() === '') {
      failures.push(childFailure('answer', model, settlement.value))
    } else successfulAnswers.push({ model, outcome: settlement.value })
  })
  if (successfulAnswers.length === 0) {
    throw new CouncilRunError('没有回答人成功返回非空答案。', directory.failures, failures)
  }

  const answers: AnswerRecord[] = shuffle(successfulAnswers, () => runtime.random()).map((entry, index) => ({
    answerId: `Answer ${String.fromCharCode(65 + index)}`,
    model: entry.model,
    text: entry.outcome.text.trim(),
    ...(entry.outcome.childId === undefined ? {} : { childId: entry.outcome.childId }),
  }))
  const answerIds = answers.map(answer => answer.answerId)
  const reviewRequests = selection.reviewers.map((model, index): ChildRequest => ({
    stage: 'review',
    label: `Council review ${index + 1}: ${model.key}`,
    model,
    prompt: reviewPrompt(selection.question, answers),
    persona: REVIEW_PERSONA,
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
      failures.push(thrownFailure('review', model, settlement.reason))
      return
    }
    const output = settlement.value.stopReason === 'completed'
      ? parseReviewerOutput(settlement.value.structured, answerIds)
      : undefined
    if (output === undefined) {
      failures.push(childFailure('review', model, {
        ...settlement.value,
        diagnostic: settlement.value.diagnostic ?? 'reviewer returned an invalid or incomplete structured ranking',
      }))
      return
    }
    reviews.push({
      reviewId: `Review ${index + 1}`,
      model,
      output,
      ...(settlement.value.childId === undefined ? {} : { childId: settlement.value.childId }),
    })
  })
  if (reviews.length === 0) {
    throw new CouncilRunError('没有评审人成功返回有效评审。', directory.failures, failures)
  }

  const aggregateRanking = aggregateRankings(reviews)
  const arbiterRequest: ChildRequest = {
    stage: 'arbiter',
    label: `Council arbiter: ${selection.arbiter.key}`,
    model: selection.arbiter,
    prompt: arbiterPrompt(selection.question, answers, reviews, aggregateRanking),
    persona: ARBITER_PERSONA,
    maxTokens: config.arbiterMaxTokens,
    outputSchema: arbiterSchema,
    timeoutMs: config.childTimeoutMs,
    signal: runSignal,
  }
  let arbiterOutcome: ChildOutcome
  try {
    arbiterOutcome = await runtime.runChild(arbiterRequest)
  } catch (error: unknown) {
    failures.push(thrownFailure('arbiter', selection.arbiter, error))
    throw new CouncilRunError('裁决人调用失败。', directory.failures, failures)
  }
  const arbiter: ArbiterOutput | undefined = arbiterOutcome.stopReason === 'completed'
    ? parseArbiterOutput(arbiterOutcome.structured)
    : undefined
  if (arbiter === undefined) {
    failures.push(childFailure('arbiter', selection.arbiter, {
      ...arbiterOutcome,
      diagnostic: arbiterOutcome.diagnostic ?? 'arbiter returned invalid structured output',
    }))
    throw new CouncilRunError('裁决人未返回有效裁决。', directory.failures, failures)
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
