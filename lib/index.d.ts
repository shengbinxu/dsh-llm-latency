/**
 * dsh-llm-latency host plugin.
 *
 * Intercepts the `llm/stream` waterfall to record per-vendor/per-model latency
 * (first token, first visible text, end-to-end, tokens/s, cache hit share),
 * persists aggregates under `$DSH_HOME/llm-latency/stats.json`, exposes a
 * dashboard and JSON endpoints, and can replay the most recent real request
 * across vendors for an anti-cache A/B benchmark.
 */
import type { Context } from './types.js';
export declare const name = "llm-latency";
export interface Config {
    /** Number of distinct real-request snapshots retained for benchmarking. */
    snapshotLimit?: number;
    /** Hard JSON size cap (bytes) for one retained snapshot. */
    snapshotMaxBytes?: number;
    /** Default benchmark rounds per target route. */
    benchmarkRounds?: number;
    /** Default cache-busting mode (break prefix cache for cold-compute comparison). */
    cacheBust?: boolean;
    /** Override the aggregate store file path (defaults to `$DSH_HOME/llm-latency/stats.json`). */
    statsPath?: string;
}
export declare function apply(ctx: Context, config?: Config): () => void;
