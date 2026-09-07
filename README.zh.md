# DSH Council

[English](README.md) · **简体中文**

运行在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 中的多模型议会插件。让多个模型独立回答、匿名互评，最终给出综合结论与可检查的审计摘要。

https://github.com/user-attachments/assets/c643490c-1076-4abe-a832-e10f02eb5eda

<sub><a href="https://pub-f78f78d2a5b946ba86b28de8b5fe74e3.r2.dev/dsh-council-promo.2a531116217c.mp4">下载视频</a> · <a href="promo/CREDITS.md">视频署名</a></sub>

## 工作流程

1. **回答：** 2–8 个模型并行、独立作答。
2. **评审：** 1–8 个评审人比较匿名回答、指出遗漏并排名。
3. **裁决：** 一个裁决人综合回答与评审，给出最终建议。

Council 复用 DSH 已配置的模型和凭据。各角色独立选择模型，同一模型可参与多个角色。中英文交互跟随 DSH 的语言设置。

结果包含置信说明、共识、分歧、盲点、模型身份和平均排名。原始回答与评审可在 DSH 子会话中查看。

## 安装

需要 **Node.js `^22.19.0 || >=24.0.0`**、**pnpm 11.7.0**，以及已配置并认证至少两个模型的 DSH。

```sh
git clone https://github.com/a1exsun/dsh-council.git
cd dsh-council
pnpm install --frozen-lockfile
pnpm build
npx --yes @deepseek-ai/dsh@latest plugin --profile web add .
npx --yes @deepseek-ai/dsh@latest web
```

如果 DSH Web 已在运行，请重启。

## 使用

在 DSH Web 对话中输入：

```text
/council
```

依次选择回答人、评审人和裁决人，然后输入议题。例如：

> 为三个工作进程比较 PostgreSQL 租约与托管消息队列。说明工作进程在产生外部副作用后、确认任务前崩溃时，两种方案各自如何恢复。推荐一种设计并说明假设。

参与者使用全新上下文，请在议题中提供所需信息。模型选择仅用于本轮。

- **费用：** 每轮有 4–17 个模型参与者，每个参与者可能进行多次请求并使用 Web 工具。
- **隐私：** 议题和中间回答会发送给所选模型服务。详见[安全说明](SECURITY.md)。
- **准确性：** 多个模型一致不能保证结论正确，请检查证据与置信说明。

## 配置

默认配置可直接使用。如需调整限额，在 DSH profile 的 `dsh-council` 条目中设置 `config`：

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

Token 限额作用于单次模型请求。超时单位为毫秒，`runTimeoutMs` 不得小于 `childTimeoutMs`。

## 参与贡献

开发环境、测试和问题反馈见 [CONTRIBUTING.md](CONTRIBUTING.md)。

灵感来自 [LLM Council](https://github.com/karpathy/llm-council) 与 [OpenRouter Fusion](https://openrouter.ai/docs/guides/features/plugins/fusion)。
