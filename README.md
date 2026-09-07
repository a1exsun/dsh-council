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

<p><a href="#installation">Installation</a> · <a href="#how-it-works">How it works</a> · <a href="#configuration">Configuration</a> · <a href="#contributing">Contributing</a></p>

https://github.com/user-attachments/assets/c643490c-1076-4abe-a832-e10f02eb5eda


</div>

---

## How it works

1. **Answer:** 2–8 models respond independently in parallel.
2. **Review:** 1–8 reviewers compare anonymous answers, identify gaps, and rank them.
3. **Decide:** one arbiter weighs the answers and reviews to produce a final recommendation.

Council uses your configured DSH providers and credentials. Choose models separately for each role; the same model can serve in multiple roles. English and Chinese follow DSH's language setting.

The result includes confidence notes, consensus, disagreements, blind spots, model identities, and average rankings. Original answers and reviews remain available in DSH's child sessions.

## Installation

Requires **Node.js `^22.19.0 || >=24.0.0`**, **pnpm 11.7.0**, and DSH with at least two configured, authenticated models.

```sh
git clone https://github.com/a1exsun/dsh-council.git
cd dsh-council
pnpm install --frozen-lockfile
pnpm build
npx --yes @deepseek-ai/dsh@latest plugin --profile web add .
npx --yes @deepseek-ai/dsh@latest web
```

Restart DSH Web if it is already running.

## Usage

Enter this command in a DSH Web conversation:

```text
/council
```

Choose the answerers, reviewers, and arbiter, then enter your question. For example:

> Compare PostgreSQL leasing with a managed message queue for three workers. Explain how each recovers when a worker crashes after an external side effect but before acknowledging the job. Recommend one design and state its assumptions.

Each participant starts with fresh context, so include the information it needs in your question. Model selections apply to one run.

- **Cost:** each run creates 4–17 model participants. Each may make multiple requests and use Web tools.
- **Privacy:** the question and intermediate answers are sent to your selected providers. See [Security](SECURITY.md).
- **Accuracy:** agreement among models does not guarantee correctness. Review the evidence and confidence notes.

## Configuration

The defaults work without additional configuration. To adjust limits, set `config` on the `dsh-council` entry in your DSH profile:

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

Token limits apply per model request. Timeouts are in milliseconds; `runTimeoutMs` must be at least `childTimeoutMs`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, tests, and bug reports.

Inspired by [LLM Council](https://github.com/karpathy/llm-council) and [OpenRouter Fusion](https://openrouter.ai/docs/guides/features/plugins/fusion).
