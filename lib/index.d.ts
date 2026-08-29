/**
 * dsh-llm-latency host plugin.
 *
 * Intercepts the `llm/stream` waterfall to record per-vendor/per-model/per-session
 * latency (first token, first visible text, end-to-end, tokens/s, cache hit share)
 * and failure classes (429/timeout/5xx/abort), persists aggregates under
 * `$DSH_HOME/llm-latency/stats.json`, and exposes a dashboard + JSON endpoints
 * for overall, time-window, and session comparisons.
 */
import type { Context } from './types.js';
import { type ModelAliases } from './model.js';
export declare const name = "llm-latency";
/** Required services: the tool registry and the web-server route table. */
export declare const inject: string[];
export interface Config {
    /** Data retention window in days; older hour buckets and sessions are pruned. */
    retentionDays?: number;
    /** Per-key exact-sample ring cap. */
    recentLimit?: number;
    /** Number of sessions retained (most recent first). */
    sessionLimit?: number;
    /** TTFT above this many ms counts as a spike. */
    spikeFloorMs?: number;
    /** Canonical model name -> provider model ids, for same-model cross-vendor grouping. */
    modelAliases?: ModelAliases;
    /** Minimum ok samples before a median confidence interval is reported. */
    minSamplesForComparison?: number;
    /** Override the aggregate store file path (defaults to `$DSH_HOME/llm-latency/stats.json`). */
    statsPath?: string;
    /** Request-log mirror cap (number of recent records kept for search/filter). */
    logLimit?: number;
    /** Request-log retention window in days. */
    logRetentionDays?: number;
    /** Override the request-log file path (defaults to `$DSH_HOME/llm-latency/requests.jsonl`). */
    logPath?: string;
}
export declare function apply(ctx: Context, config?: Config): () => void;
