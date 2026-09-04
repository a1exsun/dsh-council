# dsh-council

`dsh-council` is a DeepSeek Harness bundle that runs an anonymous, multi-model deliberation from the existing chat composer.

Type `/council` to select answerers, reviewers, a final arbiter, and the question. Every invocation reads the live DSH provider/model directory instead of keeping a separate model configuration.

## How it works

1. Two to eight answerers receive the question independently and run in parallel.
2. One to eight reviewers receive randomly labelled answers (`Answer A`, `Answer B`, …), compare them using Fusion-style dimensions, and return a complete anonymous ranking.
3. One arbiter receives only the anonymous answers, anonymous reviews, and aggregate ranking, then returns the final answer and audit findings.

Each role runs as a fresh DSH `spawn` subagent. The child can use `web_search` and `web_fetch`, but cannot use shell, filesystem, delegation, or council tools. The current conversation history is not copied into the children. Raw work remains available in DSH's ordinary subagent sessions; the command result contains the final answer and a compact audit summary.

When `/council` starts from the provisional New Session screen, the plugin retains that Session with a model-free empty turn and names it `Council`. The command result therefore remains visible in the sidebar and survives a page refresh without an extra main-agent completion. Existing conversations keep their current title and history unchanged.

The pipeline follows OpenRouter Fusion's parallel panel, structured comparison, and final synthesis, with Karpathy LLM Council's anonymous peer review and ranking.

## Development

Requirements: Node.js `^22.19.0 || >=24.0.0` and pnpm `11.7.0`.

```sh
pnpm install --ignore-workspace
pnpm test
pnpm typecheck
pnpm build
```

## Install into DSH

Build the checkout, add it to the Web profile, then restart the running Web process:

```sh
pnpm build
dsh plugin --profile web add .
dsh --profile web --dump-config
dsh web
```

When `dsh` is being run through npm rather than a global executable, use `npm exec @deepseek-ai/dsh --` in place of `dsh`.

The config dump must contain the `dsh-council` bundle layer and plugin row. Installation changes the selected DSH profile; development tests do not modify it.

## Configuration

Defaults use the deep budget selected for V1:

```yaml
- id: dsh-council
  config:
    answerMaxTokens: 16384
    reviewMaxTokens: 16384
    arbiterMaxTokens: 16384
    childTimeoutMs: 300000
    runTimeoutMs: 900000
    subagentProvider: spawn
```

`runTimeoutMs` must be greater than or equal to `childTimeoutMs`. The configured subagent provider must support personas, tool filtering, and structured output.

## Failure behavior

- Provider catalog failures are shown in the audit while models from successful catalogs remain selectable.
- The pipeline continues when at least one answer and one valid review survive.
- A failed or invalid arbiter result fails the command.
- Cancelling the command, reaching the overall deadline, or unloading the plugin aborts and disposes active children.
- A second `/council` in the same session is rejected while the first is active; other sessions remain independent.

The role prompts ask each child to use at most four Web calls, matching the Fusion default. DSH does not currently expose an enforceable per-child tool-call count through its public subagent API, so the child and overall timeouts are the hard execution bounds.

## Cost

A run performs one call per selected answerer, one per selected reviewer, and one arbiter call, plus any Web-backed follow-up steps. With the maximum roster this is seventeen child agents, so review the selected models before submitting the picker.
