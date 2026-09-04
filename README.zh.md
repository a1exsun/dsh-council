# dsh-council

[English](README.md) | [中文](README.zh.md)

`dsh-council` 是一个 DeepSeek Harness Bundle，可从现有聊天输入框启动匿名多模型议会。

输入 `/council`，依次选择回答人、评审人、最终裁决人和本次议题。每次调用都会读取 DSH 当前生效的 provider/model 目录，不维护另一份模型配置。

## 工作流程

1. 2–8 个回答人并行、独立回答议题。
2. 1–8 个评审人接收随机标记的回答（`回答 A`、`回答 B`……），按 Fusion 分析维度进行比较，并返回完整匿名排名。
3. 一个裁决人只接收匿名回答、匿名评审和聚合排名，输出最终答案与审计结论。

每个角色都作为全新的 DSH `spawn` 子代理运行。子代理可以使用 `web_search` 和 `web_fetch`，但不能使用 Shell、文件系统、委派或议会工具。当前对话历史不会复制到子代理。完整过程保留在 DSH 原生子代理会话中；命令结果包含最终答案和精简审计摘要。

当 `/council` 从临时“新会话”页面启动时，插件会通过一个不调用模型的空回合保留该会话，并将其命名为“议会”。命令结果会留在侧栏，刷新后仍可重新打开，且不会产生额外的主 Agent 补全。已有对话的标题和历史不受影响。

整体流程以 OpenRouter Fusion 的并行回答、结构化比较和最终综合为主，并加入 Karpathy LLM Council 的匿名互评与排名。

## 多语言

命令跟随 DSH 实时的 `locale.preference` 设置。中文（`zh` 与 `zh-*`）和英文覆盖指令描述、选择问题、校验与失败信息、子代理标签、模型 persona 与提示词、审计结果和空白会话标题。没有 Council 词典的其他语言按 DSH 的最终回退规则使用英文。切换 DSH 语言后，`/council` 描述会立即更新；已经运行的议会保持启动时的语言，避免同一结果混用语言。

## 开发

要求 Node.js `^22.19.0 || >=24.0.0` 和 pnpm `11.7.0`。

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

## 安装到 DSH

构建当前 checkout，将其加入 Web profile，然后重启 Web 进程：

```sh
pnpm build
dsh plugin --profile web add .
dsh --profile web --dump-config
dsh web
```

如果通过 npm 运行 DSH，请使用 `npm exec @deepseek-ai/dsh --` 替代 `dsh`。

配置输出必须包含 `dsh-council` Bundle 层和插件行。安装会修改所选 DSH profile；开发测试不会修改它。

## 配置

V1 默认采用深入预算：

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

`runTimeoutMs` 必须大于或等于 `childTimeoutMs`。配置的子代理 provider 必须支持 persona、工具过滤和结构化输出。

## 失败处理

- 单个 provider 目录读取失败会写入审计；其他成功目录中的模型仍可选择。
- 至少保留一份成功回答和一份有效评审时，流程继续。
- 裁决结果失败或无效时，整次命令失败。
- 用户取消、整体超时或插件卸载会中止并释放全部活动子代理。
- 同一会话已有议会运行时，再次调用 `/council` 会被拒绝；不同会话互不影响。

角色提示词要求每个子代理最多调用四次 Web 工具，与 Fusion 默认值一致。DSH 公共子代理 API 当前不能强制限制单个子代理的工具调用次数，因此单子代理超时和整体超时是硬执行边界。

## 成本

每轮会为每个回答人和评审人各发起一次子代理调用，并增加一次裁决调用和可能的 Web 后续步骤。最大阵容共 17 个子代理，请在提交选择器前检查所选模型。
