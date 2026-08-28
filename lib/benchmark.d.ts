/**
 * Cross-vendor A/B benchmark that replays one real long-context request across
 * multiple target routes, with anti-cache methodology:
 *   - each round appends a unique trailing user message (breaks exact-match cache),
 *   - `cacheBust` additionally prefixes the system prompt (breaks prefix cache),
 *   - targets within a round run concurrently (same wall-clock moment),
 *   - the first round is tagged `cold`, repeats are `warm`.
 *
 * Options objects created here are added to `benchmarkOptions` so the live
 * `llm/stream` interceptor passes them through without double-recording; this
 * module measures and records them itself.
 */
import type { LlmService } from './types.js';
import type { RequestSnapshot } from './capture.js';
import type { Sample } from './sample.js';
import { histPercentile, emptyHist, recordHist } from './metrics.js';
/** Live options objects tagged by the benchmark; the interceptor passes these through. */
export declare const benchmarkOptions: Set<object>;
export interface BenchmarkTarget {
    provider: string;
    model: string;
}
export interface BenchmarkOptions {
    rounds: number;
    cacheBust: boolean;
    maxTokens?: number;
    vendorOf: (provider: string) => string;
}
export interface BenchmarkTargetResult {
    provider: string;
    model: string;
    vendor: string;
    rounds: number;
    okCount: number;
    failCount: number;
    ttftP50: number | null;
    ttftP95: number | null;
    e2eP50: number | null;
    tokensPerSecond: number | null;
    cacheHitPct: number | null;
    samples: Sample[];
}
/** Run one replay benchmark over all targets and fold per-target results. */
export declare function runBenchmark(llm: LlmService, base: RequestSnapshot, targets: readonly BenchmarkTarget[], opts: BenchmarkOptions, onSample: (sample: Sample) => void): Promise<BenchmarkTargetResult[]>;
/** Convenience: p50/p95 from a small sample array, kept for tests. */
export declare function smallPercentile(values: readonly number[], p: number): number | null;
export { emptyHist, recordHist, histPercentile };
