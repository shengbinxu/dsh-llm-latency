/**
 * Text (markdown-table) formatting for the latency-report model tool.
 */
import { type StatsStore } from './metrics.js';
import type { BenchmarkTargetResult } from './benchmark.js';
/** Passive (live) latency comparison table over the durable store. */
export declare function formatSummaryTable(store: StatsStore): string;
/** Benchmark comparison table. */
export declare function formatBenchmarkTable(results: BenchmarkTargetResult[]): string;
