/**
 * Cross-vendor comparison over one canonical model and one time window.
 *
 * Statistical rigor: percentiles come from merged histograms; the median's
 * 95% bootstrap CI (and exact percentiles) come from the recent sample ring
 * when the window falls inside the ring's coverage. Two vendors differ
 * significantly when their median CIs do not overlap. Sample-size guards flag
 * insufficient evidence and gross sample imbalance.
 */
import type { StatsStore, KeySummary } from './metrics.js';
import { type ModelAliases } from './model.js';
export interface MedianCi {
    median: number;
    lo: number;
    hi: number;
}
export declare function median(values: readonly number[]): number | null;
/**
 * 95% bootstrap confidence interval of the median, percentile method.
 * Returns null when fewer than two samples are available.
 */
export declare function bootstrapMedianCi(values: readonly number[], resamples?: number): MedianCi | null;
/** Do two median CIs overlap? Non-overlap is the significance criterion. */
export declare function ciSignificant(a: MedianCi, b: MedianCi): boolean;
export interface VendorRow {
    vendor: string;
    summary: KeySummary;
    exactTtftP50: number | null;
    medianCi: MedianCi | null;
}
export interface ComparisonResult {
    model: string;
    from: number;
    to: number;
    rows: VendorRow[];
    warnings: string[];
}
export interface CompareOptions {
    minSamples: number;
}
/** Compare one canonical model across its vendors over `[from, to)`. */
export declare function compareVendors(store: StatsStore, canonical: string, aliases: ModelAliases, from: number, to: number, vendors: readonly string[] | undefined, opts: CompareOptions): ComparisonResult;
