# dsh-llm-latency

[English](README.md) · [中文](README.zh.md)

面向 DeepSeek Harness 的「按厂商 / 模型」LLM 延迟统计与跨厂商对拍插件。它用数据回答一个问题：**到底是某家平台真的慢，还是只是上下文太长？**

- **被动埋点**——每一次真实模型调用都被测量（首 token、首个可见文本、端到端、吐字速率、缓存命中率），并按 `厂商|provider|模型` 聚合。
- **抗缓存主动对拍**——复用最近一次**真实长上下文请求**，并发发给多个厂商路由，做到同输入、同时刻对比。
- **仪表盘 + 工具**——自带一个自包含 HTML 仪表盘，加上 `latency_report` / `latency_benchmark` 两个模型工具，还支持导出 CSV 作为证据。

## 安装

```sh
dsh plugin --profile web add github:<你>/dsh-llm-latency
```

安装后重启 profile。插件在 `dsh-base` 之后生效（依赖 `llm` 服务），拦截 `llm/stream`，并把仪表盘挂在：

```
http://127.0.0.1:<端口>/llm-latency/
```

## 使用

- **仪表盘**：打开 `/llm-latency/`，勾选两个以上目标，点「开始对拍」。被动统计每 5 秒刷新一次；「导出 CSV」下载报表。
- **模型工具**：直接对 agent 说「帮我看看各厂商延迟对比」（`latency_report`），或「对比一下这几个厂商」（`latency_benchmark`）。

## 数据存储位置

聚合结果持久化在 `$DSH_HOME/llm-latency/stats.json`（默认 `~/.dsh/llm-latency/stats.json`）。删除该文件即可清零。

## 抗缓存方法论

原样重放同一份上下文会被三种缓存污染：精确匹配缓存、前缀缓存（DeepSeek 官方、Anthropic 系都有）、以及冷/热不对称。插件用以下手段对抗：

1. **每轮换新尾部**——每轮追加一条唯一的 user 消息，打破精确匹配缓存，同时保留长上下文前缀的工作量。
2. **冷/热分离**——某份上下文的首次出现标为 `cold`，重复出现标为 `warm`，报表分开呈现。
3. **观测缓存而非猜测**——`usage.cacheReadTokens` / `cacheWriteTokens` 会逐样本记录，缓存命中率变成可见的一列，而不是隐藏的干扰。
4. **可选 `cacheBust`**——向 system 注入随机前缀，彻底打破前缀缓存，只测「冷算力」（会明确标注，因为这会抹掉厂商的真实优化）。

公平性主指标是**首 token 延迟（TTFT）**——由 prefill 主导、与输出长度无关。端到端延迟按 tokens/s 归一化。

## 配置

在 `cordis.patch.yml` 中设置（或覆盖对应行）：

| 键 | 默认值 | 含义 |
| --- | --- | --- |
| `snapshotLimit` | `8` | 保留用于对拍的不同真实请求快照数 |
| `snapshotMaxBytes` | `4000000` | 单个快照的 JSON 字节上限 |
| `benchmarkRounds` | `3` | 每个目标路由的对拍轮数 |
| `cacheBust` | `false` | 是否打破前缀缓存、只测冷算力 |

## 实现原理

插件在 `llm/stream` 上注册 waterfall 监听器，包装返回的 `AsyncIterable<StreamChunk>`，并在**首次拉取**时起表——那一刻正是适配器惰性发起 HTTP 请求的时机。重试发生在 `agent/request-error` 层，因此每次重试都是独立的一次 `llm/stream`，失败尝试会被记为失败、绝不混入成功延迟。

## License

MIT
