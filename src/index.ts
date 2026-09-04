import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { SubagentResult, SubagentRun } from '@deepseek-ai/dsh-subagent'
import type { AskUserQuestionItem } from '@deepseek-ai/dsh-user-questions'
import {
  CouncilRunError,
  runCouncil,
  type ChildOutcome,
  type ChildRequest,
  type CouncilAnswer,
  type CouncilConfig,
  type CouncilQuestion,
  type CouncilRuntime,
} from './council.js'
import { renderCouncilResult, renderFailureAudit } from './protocol.js'
import type { CatalogFailure, ModelDirectory, ModelRef } from './types.js'

export const name = 'dsh-council'
export const inject = ['commands', 'llm', 'userQuestions', 'subagents']

export interface Config extends CouncilConfig {}

export const Config: z<Config> = z.object({
  answerMaxTokens: z.number().step(1).min(1).default(16_384),
  reviewMaxTokens: z.number().step(1).min(1).default(16_384),
  arbiterMaxTokens: z.number().step(1).min(1).default(16_384),
  childTimeoutMs: z.number().step(1).min(1).default(300_000),
  runTimeoutMs: z.number().step(1).min(1).default(900_000),
  subagentProvider: z.string().default('spawn'),
})

const WEB_TOOLS = ['web_search', 'web_fetch'] as const
const USAGE = 'Usage: /council (no arguments)'

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message
  return 'unknown failure'
}

function textOf(result: SubagentResult): string {
  return result.output
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
}

async function discover(ctx: Context, signal: AbortSignal): Promise<ModelDirectory> {
  signal.throwIfAborted()
  const providers = ctx.llm.listProviders()
  const settlements = await Promise.allSettled(providers.map(provider => ctx.llm.listModels(provider.id)))
  signal.throwIfAborted()
  const models: ModelRef[] = []
  const failures: CatalogFailure[] = []
  settlements.forEach((settlement, index) => {
    const provider = providers[index]
    if (provider === undefined) return
    if (settlement.status === 'rejected') {
      failures.push({ provider: provider.id, message: messageOf(settlement.reason) })
      return
    }
    for (const model of settlement.value) {
      const key = `${provider.id}/${model.id}`
      models.push({
        provider: provider.id,
        providerName: provider.name,
        model: model.id,
        modelName: model.name,
        key,
        optionLabel: `${model.name} — ${provider.name} [${key}]`,
      })
    }
  })
  models.sort((left, right) => left.providerName.localeCompare(right.providerName)
    || left.modelName.localeCompare(right.modelName)
    || left.key.localeCompare(right.key))
  return { models, failures }
}

function answersFromDsh(
  answers: readonly { readonly id: string; readonly selected: readonly string[]; readonly custom?: string }[],
): CouncilAnswer[] {
  return answers.map(answer => ({
    id: answer.id,
    selected: answer.selected,
    ...(answer.custom === undefined ? {} : { custom: answer.custom }),
  }))
}

function questionsForDsh(questions: readonly CouncilQuestion[]): AskUserQuestionItem[] {
  return questions.map(question => ({
    id: question.id,
    question: question.question,
    ...(question.header === undefined ? {} : { header: question.header }),
    ...(question.detail === undefined ? {} : { detail: question.detail }),
    ...(question.options === undefined ? {} : { options: [...question.options] }),
    ...(question.multiSelect === undefined ? {} : { multiSelect: question.multiSelect }),
  }))
}

async function settleRun(run: SubagentRun): Promise<ChildOutcome> {
  try {
    const result = await run.result
    return {
      stopReason: result.stopReason,
      text: textOf(result),
      ...(result.structured === undefined ? {} : { structured: result.structured }),
      ...(result.diagnostic === undefined ? {} : { diagnostic: result.diagnostic }),
      childId: String(run.id),
    }
  } finally {
    await run.dispose()
  }
}

function runtimeFor(ctx: Context, parent: Agent, provider: string): CouncilRuntime {
  return {
    discover: signal => discover(ctx, signal),
    async ask(questions, signal) {
      const result = await ctx.userQuestions.ask({
        agent: parent,
        questions: questionsForDsh(questions),
        signal,
      })
      return answersFromDsh(result.answers)
    },
    async runChild(request: ChildRequest) {
      const childSignal = AbortSignal.any([request.signal, AbortSignal.timeout(request.timeoutMs)])
      const run = await ctx.subagents.start(provider, {
        label: request.label,
        prompt: [{ type: 'text', text: request.prompt }],
        parent,
        signal: childSignal,
        agentOptions: {
          provider: request.model.provider,
          model: request.model.model,
          maxTokens: request.maxTokens,
        },
        persona: request.persona,
        toolFilter: { allow: WEB_TOOLS },
        ...(request.outputSchema === undefined ? {} : { outputSchema: request.outputSchema }),
      })
      return settleRun(run)
    },
    random: Math.random,
  }
}

async function executeCouncil(
  ctx: Context,
  config: Config,
  invocation: CommandInvocation,
  lifecycleSignal: AbortSignal,
): Promise<CommandResult> {
  if (invocation.rawInput.trim() !== '') return { kind: 'error', text: USAGE }
  const signal = AbortSignal.any([invocation.signal, lifecycleSignal])
  try {
    const provider = ctx.subagents.getProvider(config.subagentProvider)
    if (provider === undefined) {
      throw new Error(`subagent provider "${config.subagentProvider}" is not registered`)
    }
    if (!provider.capabilities.toolFilter
      || !provider.capabilities.persona
      || !provider.capabilities.outputSchema) {
      throw new Error(`subagent provider "${config.subagentProvider}" lacks required capabilities`)
    }
    const result = await runCouncil(runtimeFor(ctx, invocation.agent, config.subagentProvider), config, signal)
    return { kind: 'success', text: renderCouncilResult(result) }
  } catch (error: unknown) {
    if (error instanceof CouncilRunError) {
      return {
        kind: 'error',
        text: renderFailureAudit(error.message, error.directoryFailures, error.failures),
      }
    }
    if (signal.aborted) return { kind: 'error', text: 'Council 已取消。' }
    return { kind: 'error', text: `Council 失败：${messageOf(error)}` }
  }
}

export function apply(ctx: Context, config: Config): void {
  if (config.runTimeoutMs < config.childTimeoutMs) {
    throw new Error('dsh-council: runTimeoutMs must be greater than or equal to childTimeoutMs')
  }
  const activeAgents = new Set<string>()
  const activeOperations = new Set<Promise<CommandResult>>()
  const lifecycle = new AbortController()
  const handler = (invocation: CommandInvocation): Promise<CommandResult> => {
    const agentId = String(invocation.agent.id)
    if (activeAgents.has(agentId)) {
      return Promise.resolve({ kind: 'error', text: '当前会话已有 Council 正在运行。' })
    }
    activeAgents.add(agentId)
    const operation = executeCouncil(ctx, config, invocation, lifecycle.signal)
    activeOperations.add(operation)
    const retire = (): void => {
      activeAgents.delete(agentId)
      activeOperations.delete(operation)
    }
    void operation.then(retire, retire)
    return operation
  }

  ctx.effect(function* () {
    yield async () => {
      lifecycle.abort(new Error('dsh-council plugin disposed'))
      await Promise.allSettled(activeOperations)
    }
    yield ctx.commands.register({
      name: 'council',
      description: 'Run an anonymous multi-model council',
      recordInput: false,
      handler,
    })
  }, 'dsh-council lifecycle')
}

export type {
  ArbiterOutput,
  CouncilResult,
  CouncilSelection,
  ModelDirectory,
  ModelRef,
  ReviewerOutput,
} from './types.js'
