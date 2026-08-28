/**
 * Model-visible tools: `latency_report` and `latency_benchmark`.
 */
import type { Context } from './types.js';
export interface ToolDeps {
    reportText: () => string;
    benchmarkText: (args: {
        rounds?: number;
        cacheBust?: boolean;
        providers?: string[];
    }) => Promise<string>;
}
/** Register both tools against the `tools` service; returns a combined disposer. */
export declare function registerTools(ctx: Context, deps: ToolDeps): () => void;
