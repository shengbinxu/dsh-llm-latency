import type { Sample } from './sample.js'

/** Counts and durations for exactly the successful calls eligible for each rate. */
export interface ThroughputAgg {
  outputRateTokens: number
  outputRateMs: number
  outputRateSamples: number
  overallRateTokens: number
  overallRateMs: number
  overallRateSamples: number
}

export function emptyThroughput(): ThroughputAgg {
  return { outputRateTokens: 0, outputRateMs: 0, outputRateSamples: 0, overallRateTokens: 0, overallRateMs: 0, overallRateSamples: 0 }
}

/** Visible-answer tokens require an explicit reasoning count and no unpriced tool output. */
export function visibleOutputTokens(sample: Sample): number | null {
  if (!sample.ok || sample.hasOutputUsage !== true || sample.hasToolCalls !== false) return null
  const reasoning = sample.reasoningTokens
  if (typeof reasoning !== 'number' || !Number.isFinite(reasoning) || reasoning < 0) return null
  const visible = sample.outputTokens - reasoning
  return Number.isFinite(visible) && visible > 0 ? visible : null
}

export function sampleThroughput(sample: Sample): ThroughputAgg {
  const out = emptyThroughput()
  const tokens = visibleOutputTokens(sample)
  if (tokens === null || sample.ttftTextMs === null) return out
  if (typeof sample.lastTextMs === 'number' && sample.lastTextMs > sample.ttftTextMs) {
    out.outputRateTokens = tokens
    out.outputRateMs = sample.lastTextMs - sample.ttftTextMs
    out.outputRateSamples = 1
  }
  if (sample.e2eMs !== null && sample.e2eMs > 0) {
    out.overallRateTokens = tokens
    out.overallRateMs = sample.e2eMs
    out.overallRateSamples = 1
  }
  return out
}

/** Missing aggregate fields belong to historical data and contribute no eligible samples. */
export function mergeThroughput(dst: ThroughputAgg, src: Partial<ThroughputAgg>): void {
  for (const key of Object.keys(emptyThroughput()) as Array<keyof ThroughputAgg>) dst[key] += src[key] ?? 0
}

export function throughputRate(tokens: number, durationMs: number): number | null {
  return tokens > 0 && durationMs > 0 ? tokens * 1000 / durationMs : null
}
