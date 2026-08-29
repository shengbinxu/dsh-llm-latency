/**
 * Mergeable latency aggregation: log-ish histograms for percentile queries,
 * calendar-aligned per-hour buckets for arbitrary time-window slices, per-session
 * aggregates for controlled A/B comparisons, and a bounded recent-sample ring.
 * Every structure merges by summing, so a store can be reloaded from disk and
 * folded across processes without loss.
 */
import type { Sample, ErrorKind } from './sample.js';
/** Histogram bin edges in milliseconds; values land in [edge, nextEdge). */
export declare const HIST_EDGES: readonly [0, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 8000, 12000, 20000, 30000, 60000, 120000];
/** Number of bins = edges + 1 (the last bin holds every value >= the last edge). */
export declare function emptyHist(): number[];
/** Index of the bin `valueMs` falls into. */
export declare function binIndex(valueMs: number): number;
/** Record one value into a histogram in place. */
export declare function recordHist(hist: number[], valueMs: number): void;
/** Merge `src` into `dst` in place. */
export declare function mergeHist(dst: number[], src: readonly number[]): void;
/** Sum a histogram. */
export declare function histTotal(hist: readonly number[]): number;
/**
 * Approximate the p-th percentile (0..1) in milliseconds from a histogram.
 * Linear interpolation within the containing bin. Returns null for an empty
 * histogram.
 */
export declare function histPercentile(hist: readonly number[], p: number): number | null;
/** Failure-class counts carried by buckets, keys, and sessions. */
export type ErrorCounts = Record<ErrorKind, number>;
export declare function emptyErrorCounts(): ErrorCounts;
export declare function addErrorCounts(dst: ErrorCounts, kind: ErrorKind | null, count?: number): void;
export declare function mergeErrorCounts(dst: ErrorCounts, src: ErrorCounts): void;
export declare const HOUR_MS = 3600000;
export declare const DAY_MS = 86400000;
/** Epoch hour of a millisecond timestamp. */
export declare function epochHour(ts: number): number;
/** One calendar-aligned hour bucket, mergeable by summing. */
export interface BucketAgg {
    ttft: number[];
    ttftText: number[];
    e2e: number[];
    ok: number;
    fail: number;
    errors: ErrorCounts;
    inputTokens: number;
    outputTokens: number;
    cacheRead: number;
    cacheWrite: number;
    decodeMs: number;
    spikes: number;
}
export declare function emptyBucket(): BucketAgg;
/** Per vendor|provider|model aggregate: hour buckets plus a recent-sample ring. */
export interface KeyAgg {
    buckets: Record<string, BucketAgg>;
    recent: Sample[];
}
export declare function emptyKeyAgg(): KeyAgg;
/** Per-session aggregate for controlled same-prompt A/B comparisons. */
export interface SessionAgg {
    vendor: string;
    provider: string;
    model: string;
    models: string[];
    firstTs: number;
    lastTs: number;
    calls: number;
    ok: number;
    fail: number;
    errors: ErrorCounts;
    ttft: number[];
    e2e: number[];
    firstCallInputTokens: number;
    firstCallTtftMs: number | null;
    inputTokens: number;
    outputTokens: number;
    cacheRead: number;
    cacheWrite: number;
    decodeMs: number;
    spikes: number;
}
export declare function emptySessionAgg(sample: Sample): SessionAgg;
/** The persisted top-level store. */
export interface StatsStore {
    version: 2;
    retentionDays: number;
    keys: Record<string, KeyAgg>;
    sessions: Record<string, SessionAgg>;
}
export declare function emptyStore(retentionDays?: number): StatsStore;
/** Stable aggregate key combining the real vendor host and provider/model. */
export declare function aggKey(vendor: string, provider: string, model: string): string;
/** Cached-input share (0..1) matching the harness native `billedInputTokens` fold. */
export declare function cacheHitShare(inputTokens: number, cacheRead: number, cacheWrite: number): number | null;
/** Cached-input write share (0..1): how much of billed input filled the prefix cache. */
export declare function cacheWriteShare(inputTokens: number, cacheRead: number, cacheWrite: number): number | null;
export interface RecordOptions {
    recentLimit: number;
    retentionDays: number;
    sessionLimit: number;
    spikeFloorMs: number;
    now?: number;
}
/**
 * Record one sample into a store in place, mutating the hour bucket, the recent
 * ring, and (when the sample carries a session id) the session aggregate.
 */
export declare function recordSample(store: StatsStore, sample: Sample, opts: RecordOptions): void;
export declare function mergeBucket(dst: BucketAgg, src: BucketAgg): void;
/** Merge `src` into `dst` in place. */
export declare function mergeStore(dst: StatsStore, src: StatsStore, opts: RecordOptions): void;
/** Merge all buckets whose hour overlaps [from, to]; the end hour is included. */
export declare function sliceBuckets(agg: KeyAgg, from: number, to: number): BucketAgg;
/** Read-only summary computed from one aggregate for display and reporting. */
export interface KeySummary {
    key: string;
    vendor: string;
    provider: string;
    model: string;
    count: number;
    okCount: number;
    failCount: number;
    errors: ErrorCounts;
    ttftP50: number | null;
    ttftP90: number | null;
    ttftP95: number | null;
    ttftP99: number | null;
    ttftTextP50: number | null;
    e2eP50: number | null;
    e2eP95: number | null;
    tokensPerSecond: number | null;
    cacheHitPct: number | null;
    cacheWritePct: number | null;
    inputTokens: number;
    outputTokens: number;
    spikes: number;
}
export declare function summarizeBucket(vendor: string, provider: string, model: string, b: BucketAgg): KeySummary;
/** Summarize one key over a time window; `[from,to)` defaults to the whole retention window. */
export declare function summarizeKey(key: string, agg: KeyAgg, from: number, to: number): KeySummary;
/** All key summaries over a window, sorted by first-token p50 ascending. */
export declare function summarizeStore(store: StatsStore, from: number, to: number): KeySummary[];
/** Read-only per-session summary for the session comparison view. */
export interface SessionSummary {
    id: string;
    vendor: string;
    provider: string;
    model: string;
    models: string[];
    singleModel: boolean;
    firstTs: number;
    lastTs: number;
    calls: number;
    okCount: number;
    failCount: number;
    errors: ErrorCounts;
    ttftP50: number | null;
    ttftP95: number | null;
    e2eP50: number | null;
    firstCallInputTokens: number;
    firstCallTtftMs: number | null;
    tokensPerSecond: number | null;
    cacheHitPct: number | null;
    cacheWritePct: number | null;
    inputTokens: number;
    outputTokens: number;
    spikes: number;
}
export declare function summarizeSession(id: string, s: SessionAgg): SessionSummary;
export declare function summarizeSessions(store: StatsStore): SessionSummary[];
