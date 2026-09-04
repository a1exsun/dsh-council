import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import { createUserMessage, type ContentBlock } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-title'
import type {} from '@deepseek-ai/dsh-settings'
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
import { copyForSettings, type CouncilCopy } from './locales.js'
import { renderCouncilResult, renderFailureAudit } from './protocol.js'
import type { CatalogFailure, ModelDirectory, ModelRef } from './types.js'

export const name = 'dsh-council'
export const inject = ['commands', 'llm', 'userQuestions', 'sessionTitle', 'settings', 'subagents']

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

interface BlankRetention {
  readonly messageId: string
  consumed: boolean
}

/** Whether this command entered a Session that already owns an ordinary turn. */
function hasStartedTurn(agent: Agent): boolean {
  return agent.session.snapshotEvents().some((event: SessionEvent) => event.type === 'turn/start')
}

/** Promote a provisional New Session without issuing another model request. */
async function retainBlankCommandSession(
  ctx: Context,
  agent: Agent,
  pending: Map<string, BlankRetention>,
  copy: CouncilCopy,
): Promise<void> {
  const message = createUserMessage({
    content: [],
    source: { kind: 'plugin', plugin: name },
  })
  const retention: BlankRetention = { messageId: String(message.id), consumed: false }
  const agentId = String(agent.id)
  pending.set(agentId, retention)
  try {
    agent.followup(message)
    await agent.whenIdle()
  } finally {
    pending.delete(agentId)
  }
  if (!retention.consumed) throw new Error('dsh-council: failed to activate the blank command session')
  ctx.sessionTitle.rename(agent.session, copy.sessionTitle)
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message
  return fallback
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  return typeof error.code === 'string' ? error.code : undefined
}

function textOf(result: SubagentResult): string {
  return result.output
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
}

async function discover(ctx: Context, signal: AbortSignal, copy: CouncilCopy): Promise<ModelDirectory> {
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
      failures.push({ provider: provider.id, message: messageOf(settlement.reason, copy.unknownFailure) })
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

function runtimeFor(ctx: Context, parent: Agent, provider: string, copy: CouncilCopy): CouncilRuntime {
  return {
    discover: signal => discover(ctx, signal, copy),
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
  blankRetentions: Map<string, BlankRetention>,
  copy: CouncilCopy,
): Promise<CommandResult> {
  if (invocation.rawInput.trim() !== '') return { kind: 'error', text: copy.usage }
  const signal = AbortSignal.any([invocation.signal, lifecycleSignal])
  const startedBlank = !hasStartedTurn(invocation.agent)
  let result: CommandResult
  try {
    const provider = ctx.subagents.getProvider(config.subagentProvider)
    if (provider === undefined) {
      throw new Error(copy.providerMissing(config.subagentProvider))
    }
    if (!provider.capabilities.toolFilter
      || !provider.capabilities.persona
      || !provider.capabilities.outputSchema) {
      throw new Error(copy.providerCapabilities(config.subagentProvider))
    }
    const council = await runCouncil(
      runtimeFor(ctx, invocation.agent, config.subagentProvider, copy),
      config,
      signal,
      copy,
    )
    result = { kind: 'success', text: renderCouncilResult(council, copy) }
  } catch (error: unknown) {
    const code = errorCode(error)
    if (code === 'ASK_CANCELLED' || code === 'ASK_ABORTED') {
      return { kind: 'error', text: copy.canceled }
    }
    if (error instanceof CouncilRunError) {
      result = {
        kind: 'error',
        text: renderFailureAudit(error.message, error.directoryFailures, error.failures, copy),
      }
    } else if (signal.aborted) {
      return { kind: 'error', text: copy.canceled }
    } else {
      result = { kind: 'error', text: copy.failed(messageOf(error, copy.unknownFailure)) }
    }
  }
  if (startedBlank) await retainBlankCommandSession(ctx, invocation.agent, blankRetentions, copy)
  return result
}

export function apply(ctx: Context, config: Config): void {
  if (config.runTimeoutMs < config.childTimeoutMs) {
    throw new Error('dsh-council: runTimeoutMs must be greater than or equal to childTimeoutMs')
  }
  const activeAgents = new Set<string>()
  const activeOperations = new Set<Promise<CommandResult>>()
  const blankRetentions = new Map<string, BlankRetention>()
  const lifecycle = new AbortController()
  // A root listener is required: preset-scoped listeners added after Agent
  // creation do not join the already-mounted pre-step chain.
  ctx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    const retention = blankRetentions.get(String(agent.id))
    if (retention === undefined || decision.kind === 'reject') return decision
    if (!decision.messages.some(message => String(message.id) === retention.messageId)) return decision
    retention.consumed = true
    blankRetentions.delete(String(agent.id))
    return { ...decision, messages: [] }
  }, { global: true })
  const handler = (invocation: CommandInvocation): Promise<CommandResult> => {
    const copy = copyForSettings(ctx.settings.get('locale'))
    const agentId = String(invocation.agent.id)
    if (activeAgents.has(agentId)) {
      return Promise.resolve({ kind: 'error', text: copy.alreadyRunning })
    }
    activeAgents.add(agentId)
    const operation = executeCouncil(ctx, config, invocation, lifecycle.signal, blankRetentions, copy)
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
    let disposeCommand = (): void => {}
    const registerCommand = (): void => {
      disposeCommand()
      const copy = copyForSettings(ctx.settings.get('locale'))
      disposeCommand = ctx.commands.register({
        name: 'council',
        description: copy.commandDescription,
        recordInput: false,
        handler,
      })
    }
    registerCommand()
    const disposeLocaleWatch = ctx.on('settings/updated', (namespace) => {
      if (String(namespace) === 'locale') registerCommand()
    })
    yield () => {
      disposeLocaleWatch()
      disposeCommand()
    }
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
