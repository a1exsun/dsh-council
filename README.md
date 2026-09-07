<div align="center">

<p><strong>English</strong> · <a href="README.zh.md">简体中文</a></p>
<h1>DSH Council</h1>
<p><strong>Independent answers. Anonymous reviews. One reasoned decision.</strong></p>
<p>Multi-model deliberation inside <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>.</p>

<p>
<img src="https://img.shields.io/badge/DSH-plugin-6D5DFB?style=flat-square" alt="DSH plugin">
<img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square" alt="Strict TypeScript">
<img src="https://img.shields.io/badge/Node.js-22.19%2B%20%7C%2024%2B-339933?style=flat-square" alt="Node.js 22.19+ or 24+">
<img src="https://img.shields.io/badge/languages-English%20%2F%20中文-222222?style=flat-square" alt="English and Chinese">
</p>

<p><a href="#quick-start">Quick start</a> · <a href="#the-deliberation">How it works</a> · <a href="#configuration">Configuration</a> · <a href="#development">Development</a></p>

<!-- DEMO VIDEO: GitHub-native inline player; persistent original is stored in R2. -->

https://github.com/user-attachments/assets/c643490c-1076-4abe-a832-e10f02eb5eda

<p>1:30 · English · Real DSH recordings · <a href="https://pub-f78f78d2a5b946ba86b28de8b5fe74e3.r2.dev/dsh-council-promo.2a531116217c.mp4">R2 original</a></p>
<p><sub>Music: “Cipher” — Kevin MacLeod (<a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100844">incompetech.com</a>), <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Excerpt edited and faded. <a href="promo/README.md">Remotion source and credits</a>.</sub></p>

</div>

---

Run `/council` in your existing DSH Web conversation. Choose who answers, who reviews, and who decides. Council collects independent responses, compares them anonymously, and returns a final synthesis with an audit you can inspect.

It reuses DSH's configured providers and credentials. No separate model list or OpenRouter account is required.

<table>
<tr>
<td width="33%"><strong>01 · Answer</strong><br>2–8 models work independently in parallel.</td>
<td width="33%"><strong>02 · Review</strong><br>1–8 reviewers assess and rank anonymous answers.</td>
<td width="33%"><strong>03 · Decide</strong><br>One arbiter synthesizes evidence and resolves disagreements.</td>
</tr>
</table>

## What you get

| Capability | Behavior |
| :--- | :--- |
| **Live model discovery** | Every invocation reads all configured provider catalogs. |
| **Separate roles** | Choose answerers, reviewers, and an arbiter; cross-role reuse is allowed. |
| **Anonymous comparison** | Shuffled answer labels; no routing metadata in review or arbitration inputs. |
| **Structured reviews** | Strengths, weaknesses, consensus, contradictions, coverage gaps, unique insights, blind spots, and complete rankings. |
| **Web evidence** | Children can use DSH's `web_search` and `web_fetch` when available. |
| **Inspectable output** | Final answer, identity mapping, average ranks, confidence notes, and failures. |
| **Bilingual interaction** | English and Simplified Chinese follow DSH's language setting. |

Useful for competing explanations, substantial evidence, and design trade-offs. Agreement among models is not independent verification and does not guarantee correctness.

## Quick start

### 1. Prepare the checkout

Clone or download this repository, then run:

```sh
cd dsh-council
pnpm install --frozen-lockfile
pnpm check
```

Requirements: **Node.js `^22.19.0 || >=24.0.0`**, **pnpm 11.7.0**, and DSH. The latest host verified for this release is **DSH `0.1.2-rc.1`**. DSH is a developer preview with evolving APIs; the host test resolves npm `latest` on each run.

### 2. Install into DSH

From the built checkout:

```sh
npx --yes @deepseek-ai/dsh@latest plugin --profile web add .
npx --yes @deepseek-ai/dsh@latest --profile web --dump-config
npx --yes @deepseek-ai/dsh@latest web
```

Restart an already-running Web process after installation or rebuilding. The configuration dump should contain a `dsh-council` entry.

Configure and authenticate at least two model routes in DSH. Catalog discovery reads advertised routes; it does **not** make paid test completions or guarantee every listed model is callable.

### 3. Deliberate

Enter the command with no arguments:

```text
/council
```

1. **Answerers:** select 2–8 models.
2. **Reviewers:** select 1–8 models.
3. **Arbiter:** select exactly one model.
4. **Topic:** type the question.

Example:

> Design a crash-safe job queue for three workers. Specify delivery guarantees, lease expiry, idempotency, and recovery after a crash between committing an external side effect and acknowledging a job. Compare two designs and identify their assumptions.

Selections apply to one run. Invoke `/council` again to refresh catalogs and select a new panel.

## The deliberation

**Answer → review → arbitration.** Each stage waits for the previous stage. Every participant is a fresh DSH `spawn` child; parent conversation history is not copied. Include necessary context in the topic.

Surviving answers are shuffled and labelled `Answer A`, `Answer B`, and so on. Reviewers receive the question and those answers. The arbiter receives anonymous answers, structured reviews, and average ranking positions. Lower average rank is better; ties are displayed in label order. The arbiter decides from the evidence rather than mechanically selecting the highest-ranked answer.

<details>
<summary><strong>What is included in the result?</strong></summary>

- The final answer and confidence notes.
- Answerer, reviewer, and arbiter identity mappings.
- Average ranks and vote counts.
- Consensus, disagreements, and blind spots.
- Failed provider catalogs and participants.

Raw answers and reviews remain in DSH's child-session records. From a blank New Session, Council retains its result using an empty, model-free turn and a localized title. If you start a normal conversation while Council runs, that session keeps its existing state.

</details>

<details>
<summary><strong>How does this relate to Fusion and LLM Council?</strong></summary>

Comparison dimensions draw on [OpenRouter Fusion](https://openrouter.ai/docs/guides/features/plugins/fusion); anonymous review and ranking draw on [Karpathy's LLM Council](https://github.com/karpathy/llm-council). Council implements its own DSH orchestration and calls your configured model routes. It does not call the Fusion endpoint.

</details>

## Language

Council follows DSH's live `locale.preference`: `zh` and `zh-*` select Simplified Chinese; other settings use English. This covers command discovery, questions, validation, labels, personas, prompts, audits, and new-session titles.

Switching language immediately updates command discovery; an in-progress council keeps its starting language. Provider names and upstream diagnostics are preserved. Model output language is requested through prompts, not enforced by a translation engine.

## Configuration

Set the `config` of the `dsh-council` entry in your DSH profile. A DSH patch file looks like:

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

| Setting | Default | Meaning |
| :--- | ---: | :--- |
| `answerMaxTokens` | `16384` | Per-request output token cap for answerers. |
| `reviewMaxTokens` | `16384` | Per-request output token cap for reviewers. |
| `arbiterMaxTokens` | `16384` | Per-request output token cap for the arbiter. |
| `childTimeoutMs` | `300000` | Deadline for each child and each provider catalog read. |
| `runTimeoutMs` | `900000` | Deliberation deadline, starting after selection. |
| `subagentProvider` | `spawn` | DSH child execution provider. |

Numbers must be positive integers. Timeouts cannot exceed `2147483647` ms; `runTimeoutMs` must be at least `childTimeoutMs`. The subagent provider must use fresh context and support model selection, personas, tool filtering, and structured output. Human selection time is outside the execution budget.

## Reliability and boundaries

| Situation | Behavior |
| :--- | :--- |
| A catalog fails or times out | Healthy catalogs remain selectable; failures appear in the audit. |
| Some participants fail | Continue with at least one non-empty answer and one valid review. |
| All answerers or all reviewers fail | Stop before the next stage and report the failure audit. |
| Invalid or failed arbiter | Fail the run without inventing a final answer. |
| Cancellation, deadline, or unload | Abort active work and dispose published child handles. |
| Another run in the same session | Reject it until the active operation finishes. Separate sessions remain independent. |

**Cost.** A panel creates `answerers + reviewers + 1` children: 4–17 per run. Web tools and structured-output retries can require multiple model requests per child. Token limits are per request, not a spending cap.

**Tools.** The allowlist contains `web_search` and `web_fetch`; DSH also supplies `structured_output` to reviewers and the arbiter. Local children use native tool presentation and an execution guard that also blocks child-local delegation tools. The request for at most four Web calls per child is advisory. Catalog reads have no DSH cancellation parameter: Council stops waiting on timeout, but the adapter's underlying read may finish later.

**Data.** The question and intermediate evidence go to selected providers and normal DSH session storage. Routing metadata is removed from deliberation inputs, but models can self-identify in response text. Anonymity reduces identity bias; it is not a privacy guarantee. See [SECURITY.md](SECURITY.md).

## Development

```sh
pnpm check           # Types, deterministic tests, production build
pnpm test:coverage   # Coverage report and enforced thresholds
pnpm test:host       # Pack → install latest DSH → full EN/ZH host runs
pnpm pack            # Build a distributable tarball
```

The host test uses a temporary DSH home, a fresh npm installation, real command registration and spawn children, and deterministic model responses. Network access is needed to install packages; no provider credentials or paid completions are used. It validates integration, not real model quality.

```text
src/
├── index.ts       DSH integration, discovery, lifecycle, session retention
├── council.ts     Selection and three-stage orchestration
├── protocol.ts    Validation, anonymous payloads, rankings, rendering
├── locales.ts     English / Simplified Chinese copy and prompts
├── async.ts       Cancellation and disposable deadlines
└── types.ts       Shared data contracts
```

Contributions: [CONTRIBUTING.md](CONTRIBUTING.md). Audit and release checks: [release readiness](docs/release-readiness.md).

## Project status

Version `0.1.0`, preparing for its first public release. Installation is from source; a published npm package or hosted demo is not assumed. The open-source license and final GitHub URL must be selected before publication.

<div align="center">
<sub>Built for DeepSeek Harness · Inspired by multi-model deliberation</sub><br>
<a href="#dsh-council">Back to top ↑</a>
</div>
