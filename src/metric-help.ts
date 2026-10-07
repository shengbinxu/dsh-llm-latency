/** Calculation definitions rendered independently of the active dashboard tab. */
export const METRIC_HELP = [
  ['样本 / 调用', '成功数 / 总尝试数；失败、中止各计一次。辅助调用仅进请求日志，不进入排行。'],
  ['首次响应等待', '从首次拉取模型流到首个非空文本、推理或工具调用增量；可能早于用户看到答案。'],
  ['首字等待', '从首次拉取模型流到首个非空 回答文字增量；包括联网、排队和开始回答前的推理。'],
  ['端到端', '从首次拉取模型流到模型流结束；不是整轮 Agent 耗时，不包含轮内其它工具执行。'],
  ['回答文字速度（词元/秒）', '单请求：可见输出 token ÷（末段非空文本时间 − 首段非空文本时间），毫秒换算成秒。'],
  ['回答整体速度（词元/秒）', '单请求：可见输出 token ÷ 完整模型流耗时，包含首字之前的等待。'],
  ['可见输出词元 / 有效样本', '服务端 outputTokens − reasoningTokens；必须有独立推理计数（明确的 0 也有效）、输出 usage 和可见文本，且不能混有工具调用。缺失计数、旧历史、失败或无效分母显示 —，不使用字符估算。单段文本可算整体吞吐率，不能算输出吞吐率。'],
  ['汇总吞吐率', '各指标分别用有效样本的 Σ可见输出 token ÷ Σ对应耗时；是时长加权汇总，不是单请求速率平均值或中位数。吞吐样本列为输出有效数 / 整体有效数。当前 pi-ai 未传出独立 reasoningTokens，因此该适配器的这两项可能显示 —。'],
  ['中位数 / 90%、95%、99%等待值', '仅成功请求的延迟分位数，从毫秒直方图分桶内线性插值估计；中位数表示约一半样本不超过该值；95%等待值表示约 95% 的样本不超过该值。'],
  ['缓存命中 / 缓存写入', '命中 = ΣcacheRead ÷ Σ(input + cacheRead + cacheWrite)；写入 = ΣcacheWrite ÷ 同一分母。input 为未缓存输入；没有输入时显示 —，未报告缓存字段按 0 计。'],
  ['输入 / 输出词元数', '词元是模型计量文本的单位，不等于汉字数。输入列是服务端未缓存输入词元；输出列是总输出词元，可能包含推理和工具调用，不等同于可见输出。'],
  ['失败 / 状态', '失败次数或某类失败数 ÷ 全部尝试数；分类含 429、超时、5xx、中止和其他。重试若单独经过模型流，会作为新的尝试记录。'],
  ['首轮首次响应等待 / 首轮输入', '会话首个被记录调用的首内容延迟和未缓存输入 token；会话起止时间为首末请求的发起时间。'],
  ['毛刺', '成功请求的首次响应等待 超过配置 spikeFloorMs 的次数，默认阈值 10 秒。'],
  ['显著性 / 时间窗口', '近期成功的首次响应等待样本足够时，bootstrap 重采样 2000 次求中位数 95% 置信区间；两厂商区间不重叠标记差异显著，仅针对首次响应等待，不代表吞吐率显著。排行按与所选窗口重叠的整小时桶汇总，边界小时可能包含窗口外请求；会话数据按完整会话汇总。'],
  ['总输出速度（词元/秒）', '沿用旧版统计：累计服务端总输出词元 ÷ 成功请求从首次内容到结束的累计耗时（秒）。可能包含推理和工具输出，且累计输出包含失败请求已报告的输出，失败较多时可能偏高。不是纯回答文字速度；分母无效时显示 —。'],
] as const

/** English explanations served to the native Client dashboard. */
export const METRIC_HELP_EN = [
  ['Samples / calls', 'Successful calls / total attempts. Failures and aborts each count once. Auxiliary calls appear only in the request log.'],
  ['First token / TTFT', 'Time from the first stream pull to the first non-empty text, reasoning, or tool-call delta. It can precede the visible answer.'],
  ['Time to first visible text', 'Time from the first stream pull to the first non-empty text delta. It includes network, queue, and pre-answer reasoning time.'],
  ['End-to-end', 'Time from the first stream pull to stream completion. It excludes other tools in the Agent turn.'],
  ['Output throughput (tokens/s)', 'Per call: visible output tokens divided by the time from the first to last non-empty text delta, in seconds.'],
  ['Overall throughput (tokens/s)', 'Per call: visible output tokens divided by full model-stream duration, including the wait before the first text.'],
  ['Visible output tokens / eligible samples', 'Provider outputTokens minus reasoningTokens. A call needs output usage, an explicit reasoning count (zero is valid), visible text, and no tool-call deltas. Missing counts, old samples, failures, or invalid durations show —. No character estimates are used. One text delta supports overall throughput only.'],
  ['Aggregate throughput', 'Each rate divides eligible visible-token sums by its matching duration sums. This is a duration-weighted rate, not a mean or median of call rates. The sample column shows eligible output / overall counts. The current pi-ai adapter does not expose separate reasoningTokens, so its visible rates may show —.'],
  ['p50 / p90 / p95 / p99', 'Latency percentiles use linear interpolation within millisecond histogram buckets. p50 is an approximate median; p95 means about 95% of samples are no slower than this value.'],
  ['Cache hit / cache write', 'Hit = ΣcacheRead ÷ Σ(input + cacheRead + cacheWrite); write = ΣcacheWrite ÷ the same denominator. Input is uncached input. Missing cache fields count as zero; no input shows —.'],
  ['Input / output tokens', 'Input is uncached input tokens. Output is total output tokens and may include reasoning or tool calls, so it is not the same as visible output.'],
  ['Failures / status', 'Failure count or one failure class divided by all attempts. Classes include 429, timeout, 5xx, abort, and other. A retry that starts a new model stream counts as a new attempt.'],
  ['First-call TTFT / input', 'The first recorded call’s first-content latency and uncached input tokens. Session start and end use the first and last request start times.'],
  ['Spike', 'Successful calls whose TTFT exceeds spikeFloorMs. The default threshold is 10 seconds.'],
  ['Significance / time window', 'When enough recent successful TTFT samples exist, 2,000 bootstrap resamples estimate a 95% median confidence interval. Non-overlapping vendor intervals are marked significant for TTFT only, not throughput. Rankings merge whole-hour buckets overlapping the selected window, so edge buckets may include requests outside it. Session data covers the full session.'],
  ['Total output speed (tokens/s)', 'Legacy cumulative total-output tokens divided by successful calls’ cumulative duration from first content to completion. Includes reasoning and tools; reported failed-call output remains in the numerator, so failures may inflate this rate. This is not visible-answer throughput.'],
] as const
