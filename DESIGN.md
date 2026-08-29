# dsh-llm-latency 设计文档

面向 DeepSeek Harness 的「按厂商 / 模型」LLM 延迟与缓存命中统计插件。本文档是实现的唯一权威：代码改动必须与本文保持一致，不一致时先改本文再改代码。

## 1. 目标与范围

- **被动记录**：每次真实模型调用都被测量并落盘，不要求用户显式开启。
- **三类对比**：
  1. **总览**：全量（或某时间窗内）按厂商 · 模型排行。
  2. **时段对比**：任选时间窗（如「今天 10:00–10:30」），对同一模型跨厂商输出分位数、失败率、缓存命中、样本量与显著性。
  3. **会话对比**：给两个会话发相同提示词、各锁一个厂商的同一模型，跑完后对比整段会话；前提是会话内模型未切换。
- **两个一级指标**：延迟（含 429 / 超时等失败分解）与缓存命中率。
- **非目标**：主动对拍（重放同一请求做 A/B）、请求快照、抗缓存轮次——已移除。

## 2. 数据模型（`stats.json` v2）

```ts
interface ErrorCounts { rateLimited: number; timeout: number; aborted: number; server: number; other: number }

interface Sample {
  ts: number; vendor: string; provider: string; model: string; sessionId?: string
  ttftMs: number | null; ttftTextMs: number | null; e2eMs: number | null
  outputTokens: number; inputTokens: number; cacheReadTokens: number; cacheWriteTokens: number
  ok: boolean; errorKind: keyof ErrorCounts | null
}

interface BucketAgg {            // 一个 epochHour，key = floor(ts / 3600_000)
  ttft: number[]; ttftText: number[]; e2e: number[]
  ok: number; fail: number; errors: ErrorCounts
  inputTokens: number; outputTokens: number; cacheRead: number; cacheWrite: number
  decodeMs: number; spikes: number
}

interface KeyAgg {
  buckets: Record<string, BucketAgg>
  recent: Sample[]
}

interface SessionAgg {
  vendor: string; provider: string; model: string
  models: string[]                 // 去重；length > 1 表示会话内换过模型
  firstTs: number; lastTs: number
  calls: number; ok: number; fail: number; errors: ErrorCounts
  ttft: number[]; e2e: number[]
  firstCallInputTokens: number
  firstCallTtftMs: number | null
  inputTokens: number; outputTokens: number; cacheRead: number; cacheWrite: number
  decodeMs: number; spikes: number
}

interface StatsStore { version: 2; retentionDays: number; keys: Record<string, KeyAgg>; sessions: Record<string, SessionAgg> }
```

### 2.1 合并性

bucket / key / session 合并 = 逐字段求和 + 直方图 `mergeHist`。保留 `mergeStore` 的跨进程折叠语义。

### 2.2 有界性

- 每次 `recordSample` 后裁剪：丢弃 `epochHour < now - retentionDays` 的桶、`lastTs` 过期的会话。
- `recent` 环按 `recentLimit` 截断；会话数按 `lastTs` 取最新 `sessionLimit` 条。

### 2.3 时段查询

取 `[from, to)` 内所有桶合并得到该窗口分位数 / token / 失败分解。窗口落在 `recent` 环内且样本够时，用环内原始样本算精确分位数与中位数置信区间。

### 2.4 子小时精度

近期窗口（环覆盖内）精确到分钟级；更旧数据按整点桶量化。

## 3. 指标定义

- **TTFT**（主）：stream 首次拉取 → 首个内容 chunk（text / reasoning / tool-call）毫秒数。
- **TTFT-visible**（次）：首个 `text-delta` 毫秒数。
- **e2e**：到流结束毫秒数。
- **tok/s**：`outputTokens / (decodeMs / 1000)`，`decodeMs = Σ(e2e - ttft)` 累计，精确可合并。
- **缓存命中率**：`cacheRead / (input + cacheRead + cacheWrite)`。
- **缓存写入率**：`cacheWrite / (input + cacheRead + cacheWrite)`。
- **失败率分解**：`rateLimited / timeout / aborted / server / other` 各占总尝试数比例。
- **分位数**：P50 / P90 / P95 / P99（直方图线性插值近似；环内样本可精确）。
- **毛刺**：`ttft > spikeFloorMs`（默认 10000ms）的次数。

## 4. 错误分类

harness 契约：失败经 `finish` chunk 的 `reason: { kind:'error'|'aborted', failure: LlmFailure }` 暴露，`LlmFailure` 含 `code`（稳定机读码）与 `status`（HTTP 状态）。

| 输入 | 分类 |
|---|---|
| `code === 'RATE_LIMIT'` 或 `status === 429` | `rateLimited` |
| `code` 含 `TIMEOUT` | `timeout` |
| `kind === 'aborted'` / `code === 'ABORTED'` | `aborted` |
| `code === 'SERVER'` 或 `status >= 500` | `server` |
| 其余 | `other` |

抛错路径（流 `next()` reject）读 `error.code` / `error.status` 同规则分类。重试按「尝试」记录（每次 `llm/stream` 独立），429 计数为尝试级。

## 5. 会话维度

- `recordSample` 同时写入 `keys` 与 `sessions[sessionId]`；`sessionId` 缺失只写 `keys`。
- **单模型判定**：`models.length === 1` 才可作为 A/B 对比单元；否则标记「会话内模型有切换，对比无效」。
- **相同提示词等价性代理**：展示 `firstCallInputTokens` 与 `firstCallTtftMs`；两会话首轮输入 token 差异 > 20% 时标记「首轮输入量差异大，提示词可能不同」。
- 会话对比不做 bootstrap CI（会话样本量通常足够，「相同提示词」已控制混淆）；显著性靠分位数差 + 样本量 + 失败率呈现。
- 已知特性：子代理（subagent）的独立会话也计入列表，靠模型 / 时间 / 调用数 / 输入 token 辨识。

## 6. 时段对比方法论

同模型跨厂商在**同一选中时段**内：

1. 双方样本切到同一 `[from, to)`。
2. 每厂商输出 `n(成功/总)`、失败分解、TTFT P50/P90/P95/P99、e2e P50、tok/s、缓存命中/写入率、毛刺。
3. 中位数 CI：窗口在环内且 `ok ≥ minSamplesForComparison`（默认 20）时，用环内 TTFT 做 bootstrap（2000 次）得 95% CI。
4. 显著性：CI 不重叠 → 「差异显著」；重叠 / 不可用 → 「差异不显著 / 证据不足」。
5. 护栏：`n < 阈值` 标「样本不足」；样本量差 > 5× 标「时段样本量悬殊，存在混淆」。

## 7. 模型归一化

- 配置 `modelAliases: Record<string /*canonical*/, string[] /*各厂商 model id*/>`。
- `canonicalModel(model)`：反查别名表命中则归 canonical；否则用原始 id。

## 8. API

- `GET /llm-latency/` 仪表盘
- `GET /llm-latency/stats.json?from=&to=&model=&vendors=` 窗口化总览
- `GET /llm-latency/comparison.json?model=&vendors=&from=&to=` 时段跨厂商对比
- `GET /llm-latency/sessions.json?model=&vendors=` 会话列表
- `GET /llm-latency/sessions-compare.json?ids=` 选中会话对比
- `GET /llm-latency/models.json` canonical 模型及厂商覆盖数
- `GET /llm-latency/timeseries.json?model=&vendors=&from=&to=` 每小时序列

## 9. 配置

| 键 | 默认值 | 含义 |
|---|---|---|
| `retentionDays` | `30` | 数据保留天数 |
| `recentLimit` | `2000` | 每 key 精确样本环上限 |
| `sessionLimit` | `500` | 保留的会话数上限 |
| `modelAliases` | `{}` | canonical 模型 → 各厂商 model id |
| `minSamplesForComparison` | `20` | 显著性所需最少成功样本 |
| `spikeFloorMs` | `10000` | 毛刺阈值 |

## 10. 迁移

`version` 升为 2。加载 v1 时：用每个 key 的 `recent` 样本（含真实 ts，无 sessionId）重建 v2 桶；会话 map 为空；v1 全时直方图 / 小时桶因丢失日历日期而丢弃。迁移失败或格式不符 → 空 store，不阻断启动。

## 11. 限制

- 错误分类依赖 harness `LlmFailure.code/status` 契约；抛错路径防御性兜底。
- 子小时精度仅在 recent 环内；更旧数据按整点桶。
- 直方图分位数为近似（log 档位线性插值）；环内可精确。
- v1 全时聚合不可迁移；v1 样本无 sessionId，会话维度从 v2 起累积。
