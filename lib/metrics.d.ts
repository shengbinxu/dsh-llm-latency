/**
 * Mergeable latency aggregation: log-ish histograms for percentile queries,
 * per-hour buckets for time-of-day spikes, and a bounded recent-sample ring.
 * Every structure merges by summing, so a store can be reloaded from disk and
 * folded across processes without loss.
 */
import type { Sample } from './sample.js';
/** Histogram bin edges in milliseconds; values land in [edge, nextEdge). */
export declare const HIST_EDGES: readonly [0, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];
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
/** 24 per-hour buckets of [count, ttftSumMs, ttftMaxMs, e2eSumMs]. */
export declare function emptyHours(): number[][];
/** Per vendor|provider|model aggregate. */
export interface KeyAgg {
    count: number;
    okCount: number;
    failCount: number;
    ttft: number[];
    ttftText: number[];
    e2e: number[];
    inputTokens: number;
    outputTokens: number;
    cacheRead: number;
    cacheWrite: number;
    hours: number[][];
    spikes: number;
    recent: Sample[];
}
/** The persisted top-level store. */
export interface StatsStore {
    version: 1;
    keys: Record<string, KeyAgg>;
}
export declare function emptyKeyAgg(): KeyAgg;
export declare function emptyStore(): StatsStore;
/** Stable aggregate key combining the real vendor host and provider/model. */
export declare function aggKey(vendor: string, provider: string, model: string): string;
/** Cached-input share (0..1) matching the harness native `billedInputTokens` fold. */
export declare function cacheHitShare(inputTokens: number, cacheRead: number, cacheWrite: number): number | null;
/** A spike is a first-token delay above `spikePct` of the key's median, or `spikeFloorMs`, whichever is higher. */
export declare const SPIKE_PCT = 3;
export declare const SPIKE_FLOOR_MS = 10000;
/**
 * Record one sample into a store in place, mutating the aggregate under its key.
 * `recentLimit` bounds the retained per-key sample ring.
 */
export declare function recordSample(store: StatsStore, sample: Sample, recentLimit?: number): void;
/** Merge `src` into `dst` in place. */
export declare function mergeStore(dst: StatsStore, src: StatsStore, recentLimit?: number): void;
/** Read-only summary computed from one aggregate for display and reporting. */
export interface KeySummary {
    key: string;
    vendor: string;
    provider: string;
    model: string;
    count: number;
    okCount: number;
    failCount: number;
    ttftP50: number | null;
    ttftP95: number | null;
    ttftTextP50: number | null;
    e2eP50: number | null;
    e2eP95: number | null;
    tokensPerSecond: number | null;
    cacheHitPct: number | null;
    inputTokens: number;
    outputTokens: number;
    spikes: number;
    /** Hour-of-day index (0..23) with the highest mean TTFT among hours with samples. */
    peakHour: number | null;
}
export declare function summarizeKey(key: string, agg: KeyAgg): KeySummary;
/** All key summaries, sorted by first-token p50 ascending. */
export declare function summarizeStore(store: StatsStore): KeySummary[];
