import type { StatsStore } from './metrics.js';
import type { Sample } from './sample.js';
/** A recent view uses exact retained samples, never overlapping hourly buckets. */
export interface RecentLatencyRow {
    vendor: string;
    model: string;
    count: number;
    okCount: number;
    failCount: number;
    medianTtftMs: number | null;
    medianFirstTextMs: number | null;
    lastSeen: number | null;
    latest: Sample | null;
}
/**
 * Summarize recorded primary calls started within [from, to].
 * Idle vendor/model pairs remain visible with null current metrics and their last sampling time.
 * Ring limits can reduce the retained sample count; auxiliary calls never enter these rings.
 */
export declare function recentLatency(store: StatsStore, from: number, to: number): RecentLatencyRow[];
