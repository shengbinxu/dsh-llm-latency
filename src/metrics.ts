/**
 * Mergeable latency aggregation: log-ish histograms for percentile queries,
 * per-hour buckets for time-of-day spikes, and a bounded recent-sample ring.
 * Every structure merges by summing, so a store can be reloaded from disk and
 * folded across processes without loss.
 */

import type { Sample } from './sample.js'

/** Histogram bin edges in milliseconds; values land in [edge, nextEdge). */
export const HIST_EDGES = [0, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072] as const

/** Number of bins = edges + 1 (the last bin holds every value >= the last edge). */
export function emptyHist(): number[] {
  return new Array<number>(HIST_EDGES.length + 1).fill(0)
}

/** Index of the bin `valueMs` falls into. */
export function binIndex(valueMs: number): number {
  for (let i = 0; i < HIST_EDGES.length; i += 1) {
    if (valueMs < (HIST_EDGES[i] as number)) return i
  }
  return HIST_EDGES.length
}

/** Record one value into a histogram in place. */
export function recordHist(hist: number[], valueMs: number): void {
  const i = binIndex(valueMs)
  hist[i] = (hist[i] as number) + 1
}

/** Merge `src` into `dst` in place. */
export function mergeHist(dst: number[], src: readonly number[]): void {
  for (let i = 0; i < dst.length; i += 1) {
    dst[i] = (dst[i] as number) + (src[i] ?? 0)
  }
}

/** Sum a histogram. */
export function histTotal(hist: readonly number[]): number {
  let total = 0
  for (const c of hist) total += c
  return total
}

/**
 * Approximate the p-th percentile (0..1) in milliseconds from a histogram.
 * Linear interpolation within the containing bin. Returns null for an empty
 * histogram.
 */
export function histPercentile(hist: readonly number[], p: number): number | null {
  const total = histTotal(hist)
  if (total === 0) return null
  const target = p * total
  let cumulative = 0
  for (let i = 0; i < hist.length; i += 1) {
    const count = hist[i] as number
    if (count === 0) continue
    const next = cumulative + count
    if (next >= target) {
      const lo = i === 0 ? 0 : (HIST_EDGES[i - 1] as number)
      const hi = i < HIST_EDGES.length ? (HIST_EDGES[i] as number) : (HIST_EDGES[HIST_EDGES.length - 1] as number) * 2
      const frac = (target - cumulative) / count
      return lo + frac * (hi - lo)
    }
    cumulative = next
  }
  // Unreachable when total > 0, but keep the tail defined.
  return HIST_EDGES[HIST_EDGES.length - 1] as number
}

/** 24 per-hour buckets of [count, ttftSumMs, ttftMaxMs, e2eSumMs]. */
export function emptyHours(): number[][] {
  return Array.from({ length: 24 }, () => [0, 0, 0, 0])
}

/** Per vendor|provider|model aggregate. */
export interface KeyAgg {
  count: number
  okCount: number
  failCount: number
  ttft: number[]
  ttftText: number[]
  e2e: number[]
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  hours: number[][]
  spikes: number
  recent: Sample[]
}

/** The persisted top-level store. */
export interface StatsStore {
  version: 1
  keys: Record<string, KeyAgg>
}

export function emptyKeyAgg(): KeyAgg {
  return {
    count: 0,
    okCount: 0,
    failCount: 0,
    ttft: emptyHist(),
    ttftText: emptyHist(),
    e2e: emptyHist(),
    inputTokens: 0,
    outputTokens: 0,
    cacheRead: 0,
    cacheWrite: 0,
    hours: emptyHours(),
    spikes: 0,
    recent: [],
  }
}

export function emptyStore(): StatsStore {
  return { version: 1, keys: {} }
}

/** Stable aggregate key combining the real vendor host and provider/model. */
export function aggKey(vendor: string, provider: string, model: string): string {
  return `${vendor}|${provider}|${model}`
}

/** Cached-input share (0..1) matching the harness native `billedInputTokens` fold. */
export function cacheHitShare(inputTokens: number, cacheRead: number, cacheWrite: number): number | null {
  const billed = inputTokens + cacheRead + cacheWrite
  if (billed <= 0) return null
  return cacheRead / billed
}

/** A spike is a first-token delay above `spikePct` of the key's median, or `spikeFloorMs`, whichever is higher. */
export const SPIKE_PCT = 3
export const SPIKE_FLOOR_MS = 10000

/**
 * Record one sample into a store in place, mutating the aggregate under its key.
 * `recentLimit` bounds the retained per-key sample ring.
 */
export function recordSample(store: StatsStore, sample: Sample, recentLimit = 200): void {
  const key = aggKey(sample.vendor, sample.provider, sample.model)
  let agg = store.keys[key]
  if (agg === undefined) {
    agg = emptyKeyAgg()
    store.keys[key] = agg
  }
  agg.count += 1
  if (sample.ok) {
    agg.okCount += 1
    if (sample.ttftMs !== null && sample.ttftMs !== undefined) recordHist(agg.ttft, sample.ttftMs)
    if (sample.ttftTextMs !== null && sample.ttftTextMs !== undefined) recordHist(agg.ttftText, sample.ttftTextMs)
    if (sample.e2eMs !== null && sample.e2eMs !== undefined) recordHist(agg.e2e, sample.e2eMs)
  } else {
    agg.failCount += 1
  }
  agg.inputTokens += sample.inputTokens
  agg.outputTokens += sample.outputTokens
  agg.cacheRead += sample.cacheReadTokens
  agg.cacheWrite += sample.cacheWriteTokens

  const hour = new Date(sample.ts).getHours()
  const bucket = agg.hours[hour] as number[]
  bucket[0] = (bucket[0] as number) + 1
  if (sample.ttftMs !== null && sample.ttftMs !== undefined) {
    bucket[1] = (bucket[1] as number) + sample.ttftMs
    if (sample.ttftMs > (bucket[2] as number)) bucket[2] = sample.ttftMs
  }
  if (sample.e2eMs !== null && sample.e2eMs !== undefined) bucket[3] = (bucket[3] as number) + sample.e2eMs

  // Spike detection uses the current median so far; a cold start falls back to the floor.
  if (sample.ok && sample.ttftMs !== null && sample.ttftMs !== undefined) {
    const median = histPercentile(agg.ttft, 0.5)
    const threshold = median === null ? SPIKE_FLOOR_MS : Math.max(SPIKE_FLOOR_MS, SPIKE_PCT * median)
    if (sample.ttftMs > threshold) agg.spikes += 1
  }

  agg.recent.push(sample)
  if (agg.recent.length > recentLimit) agg.recent.splice(0, agg.recent.length - recentLimit)
}

/** Merge `src` into `dst` in place. */
export function mergeStore(dst: StatsStore, src: StatsStore, recentLimit = 200): void {
  for (const [key, srcAgg] of Object.entries(src.keys)) {
    let dstAgg = dst.keys[key]
    if (dstAgg === undefined) {
      dstAgg = emptyKeyAgg()
      dst.keys[key] = dstAgg
    }
    dstAgg.count += srcAgg.count
    dstAgg.okCount += srcAgg.okCount
    dstAgg.failCount += srcAgg.failCount
    mergeHist(dstAgg.ttft, srcAgg.ttft)
    mergeHist(dstAgg.ttftText, srcAgg.ttftText)
    mergeHist(dstAgg.e2e, srcAgg.e2e)
    dstAgg.inputTokens += srcAgg.inputTokens
    dstAgg.outputTokens += srcAgg.outputTokens
    dstAgg.cacheRead += srcAgg.cacheRead
    dstAgg.cacheWrite += srcAgg.cacheWrite
    dstAgg.spikes += srcAgg.spikes
    for (let h = 0; h < 24; h += 1) {
      const d = dstAgg.hours[h] as number[]
      const s = srcAgg.hours[h] as number[]
      d[0] = (d[0] as number) + (s[0] as number)
      d[1] = (d[1] as number) + (s[1] as number)
      if ((s[2] as number) > (d[2] as number)) d[2] = s[2] as number
      d[3] = (d[3] as number) + (s[3] as number)
    }
    dstAgg.recent.push(...srcAgg.recent)
    if (dstAgg.recent.length > recentLimit) dstAgg.recent.splice(0, dstAgg.recent.length - recentLimit)
  }
}

/** Read-only summary computed from one aggregate for display and reporting. */
export interface KeySummary {
  key: string
  vendor: string
  provider: string
  model: string
  count: number
  okCount: number
  failCount: number
  ttftP50: number | null
  ttftP95: number | null
  ttftTextP50: number | null
  e2eP50: number | null
  e2eP95: number | null
  tokensPerSecond: number | null
  cacheHitPct: number | null
  inputTokens: number
  outputTokens: number
  spikes: number
  /** Hour-of-day index (0..23) with the highest mean TTFT among hours with samples. */
  peakHour: number | null
}

export function summarizeKey(key: string, agg: KeyAgg): KeySummary {
  const [vendor, provider, model] = key.split('|') as [string, string, string]
  const decodeMs = decodeTotalMs(agg)
  const tokensPerSecond = agg.outputTokens > 0 && decodeMs > 0 ? (agg.outputTokens / (decodeMs / 1000)) : null
  let peakHour: number | null = null
  let peakMean = -1
  for (let h = 0; h < 24; h += 1) {
    const bucket = agg.hours[h] as number[]
    const count = bucket[0] as number
    if (count === 0) continue
    const mean = (bucket[1] as number) / count
    if (mean > peakMean) {
      peakMean = mean
      peakHour = h
    }
  }
  return {
    key,
    vendor,
    provider,
    model,
    count: agg.count,
    okCount: agg.okCount,
    failCount: agg.failCount,
    ttftP50: histPercentile(agg.ttft, 0.5),
    ttftP95: histPercentile(agg.ttft, 0.95),
    ttftTextP50: histPercentile(agg.ttftText, 0.5),
    e2eP50: histPercentile(agg.e2e, 0.5),
    e2eP95: histPercentile(agg.e2e, 0.95),
    tokensPerSecond,
    cacheHitPct: cacheHitShare(agg.inputTokens, agg.cacheRead, agg.cacheWrite),
    inputTokens: agg.inputTokens,
    outputTokens: agg.outputTokens,
    spikes: agg.spikes,
    peakHour,
  }
}

/**
 * Sum of decode wall time across samples, approximated from per-sample
 * (e2e - ttft) for samples carrying both. Used to derive tokens/second.
 */
function decodeTotalMs(agg: KeyAgg): number {
  let ms = 0
  for (const s of agg.recent) {
    if (s.e2eMs !== null && s.ttftMs !== null && s.e2eMs > s.ttftMs) ms += s.e2eMs - s.ttftMs
  }
  return ms
}

/** All key summaries, sorted by first-token p50 ascending. */
export function summarizeStore(store: StatsStore): KeySummary[] {
  return Object.entries(store.keys)
    .map(([key, agg]) => summarizeKey(key, agg))
    .sort((a, b) => (a.ttftP50 ?? Infinity) - (b.ttftP50 ?? Infinity))
}
