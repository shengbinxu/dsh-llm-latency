/** One recorded model-call latency sample (owned plain JSON, no live objects). */
export interface Sample {
  /** Epoch millis when the stream was first pulled (request dispatch). */
  ts: number
  /** Real vendor identity, resolved from the provider route's base URL host when known. */
  vendor: string
  /** Registered provider route id. */
  provider: string
  /** Model id. */
  model: string
  /** First content delta latency in ms, or null when no content arrived. */
  ttftMs: number | null
  /** First text-delta (visible answer) latency in ms, or null. */
  ttftTextMs: number | null
  /** Full stream duration in ms. */
  e2eMs: number | null
  outputTokens: number
  inputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  ok: boolean
  errorKind: 'error' | 'aborted' | null
  source: 'live' | 'benchmark'
  /** Benchmark-only: true on a cold (first) exposure of a context, false on repeat. */
  cold: boolean | null
}

export function newSample(partial: {
  ts: number
  vendor: string
  provider: string
  model: string
  source: 'live' | 'benchmark'
  cold?: boolean | null
}): Sample {
  return {
    ts: partial.ts,
    vendor: partial.vendor,
    provider: partial.provider,
    model: partial.model,
    ttftMs: null,
    ttftTextMs: null,
    e2eMs: null,
    outputTokens: 0,
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    ok: true,
    errorKind: null,
    source: partial.source,
    cold: partial.cold ?? null,
  }
}
