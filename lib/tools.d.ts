/**
 * Model-visible tool: `latency_report`.
 */
import type { Context } from './types.js';
export interface ReportArgs {
    model?: string;
    vendors?: string[];
    from?: number;
    to?: number;
    sessionIds?: string[];
}
export interface ToolDeps {
    runReport(args: ReportArgs): Promise<string>;
}
/** Register the report tool against the `tools` service; returns a disposer. */
export declare function registerTools(ctx: Context, deps: ToolDeps): () => void;
