/**
 * Mergeable latency aggregation: log-ish histograms for percentile queries,
 * calendar-aligned per-hour buckets for arbitrary time-window slices, per-session
 * aggregates for controlled A/B comparisons, and a bounded recent-sample ring.
 * Every structure merges by summing, so a store can be reloaded from disk and
 * folded across processes without loss.
 */

import type { Sample, ErrorKind } from './sample.js'

/** Histogram bin edges in milliseconds; values land in [edge, nextEdge). */
export const HIST_EDGES = [
  0, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 8000, 12000, 20000, 30000, 60000, 120000,
] as const

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

/** Failure-class counts carried by buckets, keys, and sessions. */
export type ErrorCounts = Record<ErrorKind, number>

export function emptyErrorCounts(): ErrorCounts {
  return { rateLimited: 0, timeout: 0, aborted: 0, server: 0, other: 0 }
}

export function addErrorCounts(dst: ErrorCounts, kind: ErrorKind | null, count = 1): void {
  if (kind === null) return
  dst[kind] = (dst[kind] as number) + count
}

export function mergeErrorCounts(dst: ErrorCounts, src: ErrorCounts): void {
  for (const k of Object.keys(dst) as ErrorKind[]) {
    dst[k] = (dst[k] as number) + (src[k] ?? 0)
  }
}

export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000

/** Epoch hour of a millisecond timestamp. */
export function epochHour(ts: number): number {
  return Math.floor(ts / HOUR_MS)
}

/** One calendar-aligned hour bucket, mergeable by summing. */
export interface BucketAgg {
  ttft: number[]
  ttftText: number[]
  e2e: number[]
  ok: number
  fail: number
  errors: ErrorCounts
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  decodeMs: number
  spikes: number
}

export function emptyBucket(): BucketAgg {
  return {
    ttft: emptyHist(),
    ttftText: emptyHist(),
    e2e: emptyHist(),
    ok: 0,
    fail: 0,
    errors: emptyErrorCounts(),
    inputTokens: 0,
    outputTokens: 0,
    cacheRead: 0,
    cacheWrite: 0,
    decodeMs: 0,
    spikes: 0,
  }
}

/** Per vendor|provider|model aggregate: hour buckets plus a recent-sample ring. */
export interface KeyAgg {
  buckets: Record<string, BucketAgg>
  recent: Sample[]
}

export function emptyKeyAgg(): KeyAgg {
  return { buckets: {}, recent: [] }
}

/** Per-session aggregate for controlled same-prompt A/B comparisons. */
export interface SessionAgg {
  vendor: string
  provider: string
  model: string
  models: string[]
  firstTs: number
  lastTs: number
  calls: number
  ok: number
  fail: number
  errors: ErrorCounts
  ttft: number[]
  e2e: number[]
  firstCallInputTokens: number
  firstCallTtftMs: number | null
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  decodeMs: number
  spikes: number
}

export function emptySessionAgg(sample: Sample): SessionAgg {
  return {
    vendor: sample.vendor,
    provider: sample.provider,
    model: sample.model,
    models: [sample.model],
    firstTs: sample.ts,
    lastTs: sample.ts,
    calls: 0,
    ok: 0,
    fail: 0,
    errors: emptyErrorCounts(),
    ttft: emptyHist(),
    e2e: emptyHist(),
    firstCallInputTokens: 0,
    firstCallTtftMs: null,
    inputTokens: 0,
    outputTokens: 0,
    cacheRead: 0,
    cacheWrite: 0,
    decodeMs: 0,
    spikes: 0,
  }
}

/** The persisted top-level store. */
export interface StatsStore {
  version: 2
  retentionDays: number
  keys: Record<string, KeyAgg>
  sessions: Record<string, SessionAgg>
}

export function emptyStore(retentionDays = 30): StatsStore {
  return { version: 2, retentionDays, keys: {}, sessions: {} }
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

/** Cached-input write share (0..1): how much of billed input filled the prefix cache. */
export function cacheWriteShare(inputTokens: number, cacheRead: number, cacheWrite: number): number | null {
  const billed = inputTokens + cacheRead + cacheWrite
  if (billed <= 0) return null
  return cacheWrite / billed
}

export interface RecordOptions {
  recentLimit: number
  retentionDays: number
  sessionLimit: number
  spikeFloorMs: number
  now?: number
}

function recordTokens(b: { inputTokens: number; outputTokens: number; cacheRead: number; cacheWrite: number; decodeMs: number }, sample: Sample): void {
  b.inputTokens += sample.inputTokens
  b.outputTokens += sample.outputTokens
  b.cacheRead += sample.cacheReadTokens
  b.cacheWrite += sample.cacheWriteTokens
  if (sample.ok && sample.e2eMs !== null && sample.ttftMs !== null && sample.e2eMs > sample.ttftMs) {
    b.decodeMs += sample.e2eMs - sample.ttftMs
  }
}

function recordLatencies(
  b: { ttft: number[]; ttftText?: number[]; e2e: number[]; spikes: number },
  sample: Sample,
  spikeFloorMs: number,
): void {
  if (!sample.ok) return
  if (sample.ttftMs !== null) {
    recordHist(b.ttft, sample.ttftMs)
    if (sample.ttftMs > spikeFloorMs) b.spikes += 1
  }
  if (b.ttftText !== undefined && sample.ttftTextMs !== null) recordHist(b.ttftText, sample.ttftTextMs)
  if (sample.e2eMs !== null) recordHist(b.e2e, sample.e2eMs)
}

function recordOutcome(b: { ok: number; fail: number; errors: ErrorCounts }, sample: Sample): void {
  if (sample.ok) {
    b.ok += 1
  } else {
    b.fail += 1
    addErrorCounts(b.errors, sample.errorKind)
  }
}

/**
 * Record one sample into a store in place, mutating the hour bucket, the recent
 * ring, and (when the sample carries a session id) the session aggregate.
 */
export function recordSample(store: StatsStore, sample: Sample, opts: RecordOptions): void {
  const now = opts.now ?? Date.now()
  const key = aggKey(sample.vendor, sample.provider, sample.model)
  let agg = store.keys[key]
  if (agg === undefined) {
    agg = emptyKeyAgg()
    store.keys[key] = agg
  }

  const hour = epochHour(sample.ts)
  if (hour >= epochHour(now - opts.retentionDays * DAY_MS)) {
    let bucket = agg.buckets[String(hour)]
    if (bucket === undefined) {
      bucket = emptyBucket()
      agg.buckets[String(hour)] = bucket
    }
    recordOutcome(bucket, sample)
    recordLatencies(bucket, sample, opts.spikeFloorMs)
    recordTokens(bucket, sample)
  }

  agg.recent.push(sample)
  if (agg.recent.length > opts.recentLimit) agg.recent.splice(0, agg.recent.length - opts.recentLimit)

  pruneKey(agg, now, opts.retentionDays)

  if (sample.sessionId !== undefined) {
    let session = store.sessions[sample.sessionId]
    if (session === undefined) {
      session = emptySessionAgg(sample)
      store.sessions[sample.sessionId] = session
    }
    if (!session.models.includes(sample.model)) session.models.push(sample.model)
    session.lastTs = Math.max(session.lastTs, sample.ts)
    if (session.firstCallInputTokens === 0 && session.calls === 0) {
      session.firstCallInputTokens = sample.inputTokens
      session.firstCallTtftMs = sample.ttftMs
    }
    session.calls += 1
    recordOutcome(session, sample)
    recordLatencies(session, sample, opts.spikeFloorMs)
    recordTokens(session, sample)
  }

  pruneSessions(store, now, opts)
}

function pruneKey(agg: KeyAgg, now: number, retentionDays: number): void {
  const cutoff = epochHour(now - retentionDays * DAY_MS)
  for (const h of Object.keys(agg.buckets)) {
    if (Number(h) < cutoff) delete agg.buckets[h]
  }
}

function pruneSessions(store: StatsStore, now: number, opts: RecordOptions): void {
  const cutoff = now - opts.retentionDays * DAY_MS
  for (const [id, s] of Object.entries(store.sessions)) {
    if (s.lastTs < cutoff) delete store.sessions[id]
  }
  const ids = Object.keys(store.sessions)
  if (ids.length <= opts.sessionLimit) return
  ids.sort((a, b) => (store.sessions[b]?.lastTs ?? 0) - (store.sessions[a]?.lastTs ?? 0))
  for (const id of ids.slice(opts.sessionLimit)) delete store.sessions[id]
}

export function mergeBucket(dst: BucketAgg, src: BucketAgg): void {
  mergeHist(dst.ttft, src.ttft)
  mergeHist(dst.ttftText, src.ttftText)
  mergeHist(dst.e2e, src.e2e)
  dst.ok += src.ok
  dst.fail += src.fail
  mergeErrorCounts(dst.errors, src.errors)
  dst.inputTokens += src.inputTokens
  dst.outputTokens += src.outputTokens
  dst.cacheRead += src.cacheRead
  dst.cacheWrite += src.cacheWrite
  dst.decodeMs += src.decodeMs
  dst.spikes += src.spikes
}

/** Merge `src` into `dst` in place. */
export function mergeStore(dst: StatsStore, src: StatsStore, opts: RecordOptions): void {
  for (const [key, srcAgg] of Object.entries(src.keys)) {
    let dstAgg = dst.keys[key]
    if (dstAgg === undefined) {
      dstAgg = emptyKeyAgg()
      dst.keys[key] = dstAgg
    }
    for (const [hour, srcBucket] of Object.entries(srcAgg.buckets)) {
      let dstBucket = dstAgg.buckets[hour]
      if (dstBucket === undefined) {
        dstBucket = emptyBucket()
        dstAgg.buckets[hour] = dstBucket
      }
      mergeBucket(dstBucket, srcBucket)
    }
    dstAgg.recent.push(...srcAgg.recent)
    if (dstAgg.recent.length > opts.recentLimit) dstAgg.recent.splice(0, dstAgg.recent.length - opts.recentLimit)
  }
  for (const [id, srcSession] of Object.entries(src.sessions)) {
    const dstSession = dst.sessions[id]
    if (dstSession === undefined) {
      dst.sessions[id] = structuredCloneSession(srcSession)
    } else {
      mergeSession(dstSession, srcSession)
    }
  }
  pruneSessions(dst, opts.now ?? Date.now(), opts)
}

function mergeSession(dst: SessionAgg, src: SessionAgg): void {
  mergeHist(dst.ttft, src.ttft)
  mergeHist(dst.e2e, src.e2e)
  dst.ok += src.ok
  dst.fail += src.fail
  mergeErrorCounts(dst.errors, src.errors)
  dst.inputTokens += src.inputTokens
  dst.outputTokens += src.outputTokens
  dst.cacheRead += src.cacheRead
  dst.cacheWrite += src.cacheWrite
  dst.decodeMs += src.decodeMs
  dst.spikes += src.spikes
  dst.calls += src.calls
  dst.firstTs = Math.min(dst.firstTs, src.firstTs)
  dst.lastTs = Math.max(dst.lastTs, src.lastTs)
  for (const m of src.models) if (!dst.models.includes(m)) dst.models.push(m)
  if (src.firstTs < dst.firstTs || dst.calls === 0) {
    dst.firstCallInputTokens = src.firstCallInputTokens
    dst.firstCallTtftMs = src.firstCallTtftMs
  }
}

function structuredCloneSession(s: SessionAgg): SessionAgg {
  return {
    ...s,
    models: [...s.models],
    errors: { ...s.errors },
    ttft: [...s.ttft],
    e2e: [...s.e2e],
  }
}

/** Merge all buckets whose hour overlaps [from, to]; the end hour is included. */
export function sliceBuckets(agg: KeyAgg, from: number, to: number): BucketAgg {
  const out = emptyBucket()
  for (const [hour, bucket] of Object.entries(agg.buckets)) {
    const h = Number(hour)
    const hStart = h * HOUR_MS
    const hEnd = hStart + HOUR_MS
    // Include a bucket only when its hour [hStart, hEnd) overlaps [from, to).
    if (hStart < to && hEnd > from) mergeBucket(out, bucket)
  }
  return out
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
  errors: ErrorCounts
  ttftP50: number | null
  ttftP90: number | null
  ttftP95: number | null
  ttftP99: number | null
  ttftTextP50: number | null
  e2eP50: number | null
  e2eP95: number | null
  tokensPerSecond: number | null
  cacheHitPct: number | null
  cacheWritePct: number | null
  inputTokens: number
  outputTokens: number
  spikes: number
}

function tokensPerSecond(outputTokens: number, decodeMs: number): number | null {
  return outputTokens > 0 && decodeMs > 0 ? outputTokens / (decodeMs / 1000) : null
}

export function summarizeBucket(vendor: string, provider: string, model: string, b: BucketAgg): KeySummary {
  return {
    key: `${vendor}|${provider}|${model}`,
    vendor,
    provider,
    model,
    count: b.ok + b.fail,
    okCount: b.ok,
    failCount: b.fail,
    errors: { ...b.errors },
    ttftP50: histPercentile(b.ttft, 0.5),
    ttftP90: histPercentile(b.ttft, 0.9),
    ttftP95: histPercentile(b.ttft, 0.95),
    ttftP99: histPercentile(b.ttft, 0.99),
    ttftTextP50: histPercentile(b.ttftText, 0.5),
    e2eP50: histPercentile(b.e2e, 0.5),
    e2eP95: histPercentile(b.e2e, 0.95),
    tokensPerSecond: tokensPerSecond(b.outputTokens, b.decodeMs),
    cacheHitPct: cacheHitShare(b.inputTokens, b.cacheRead, b.cacheWrite),
    cacheWritePct: cacheWriteShare(b.inputTokens, b.cacheRead, b.cacheWrite),
    inputTokens: b.inputTokens,
    outputTokens: b.outputTokens,
    spikes: b.spikes,
  }
}

/** Summarize one key over a time window; `[from,to)` defaults to the whole retention window. */
export function summarizeKey(key: string, agg: KeyAgg, from: number, to: number): KeySummary {
  const [vendor, provider, model] = key.split('|') as [string, string, string]
  return summarizeBucket(vendor, provider, model, sliceBuckets(agg, from, to))
}

/** All key summaries over a window, sorted by first-token p50 ascending. */
export function summarizeStore(store: StatsStore, from: number, to: number): KeySummary[] {
  return Object.entries(store.keys)
    .map(([key, agg]) => summarizeKey(key, agg, from, to))
    .filter((s) => s.count > 0)
    .sort((a, b) => (a.ttftP50 ?? Infinity) - (b.ttftP50 ?? Infinity))
}

/** Read-only per-session summary for the session comparison view. */
export interface SessionSummary {
  id: string
  vendor: string
  provider: string
  model: string
  models: string[]
  singleModel: boolean
  firstTs: number
  lastTs: number
  calls: number
  okCount: number
  failCount: number
  errors: ErrorCounts
  ttftP50: number | null
  ttftP95: number | null
  e2eP50: number | null
  firstCallInputTokens: number
  firstCallTtftMs: number | null
  tokensPerSecond: number | null
  cacheHitPct: number | null
  cacheWritePct: number | null
  inputTokens: number
  outputTokens: number
  spikes: number
}

export function summarizeSession(id: string, s: SessionAgg): SessionSummary {
  return {
    id,
    vendor: s.vendor,
    provider: s.provider,
    model: s.model,
    models: [...s.models],
    singleModel: s.models.length === 1,
    firstTs: s.firstTs,
    lastTs: s.lastTs,
    calls: s.calls,
    okCount: s.ok,
    failCount: s.fail,
    errors: { ...s.errors },
    ttftP50: histPercentile(s.ttft, 0.5),
    ttftP95: histPercentile(s.ttft, 0.95),
    e2eP50: histPercentile(s.e2e, 0.5),
    firstCallInputTokens: s.firstCallInputTokens,
    firstCallTtftMs: s.firstCallTtftMs,
    tokensPerSecond: tokensPerSecond(s.outputTokens, s.decodeMs),
    cacheHitPct: cacheHitShare(s.inputTokens, s.cacheRead, s.cacheWrite),
    cacheWritePct: cacheWriteShare(s.inputTokens, s.cacheRead, s.cacheWrite),
    inputTokens: s.inputTokens,
    outputTokens: s.outputTokens,
    spikes: s.spikes,
  }
}

export function summarizeSessions(store: StatsStore): SessionSummary[] {
  return Object.entries(store.sessions)
    .map(([id, s]) => summarizeSession(id, s))
    .sort((a, b) => b.lastTs - a.lastTs)
}
