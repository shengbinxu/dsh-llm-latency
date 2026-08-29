/**
 * Text (markdown-table) formatting for the `latency_report` model tool.
 */
import type { StatsStore, KeySummary } from './metrics.js';
import type { ComparisonResult } from './comparison.js';
import type { SessionCompareResult } from './session.js';
/** Format a pre-filtered list of key summaries as an overall comparison table. */
export declare function formatSummaryRows(rows: KeySummary[]): string;
/** Overall (windowed) comparison table over the durable store. */
export declare function formatSummaryTable(store: StatsStore, from: number, to: number): string;
/** Cross-vendor comparison table for one canonical model and window. */
export declare function formatComparisonTable(result: ComparisonResult): string;
/** Session comparison table. */
export declare function formatSessionTable(result: SessionCompareResult): string;
