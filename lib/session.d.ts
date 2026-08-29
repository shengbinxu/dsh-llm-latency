/**
 * Session-level comparison: pick sessions (usually two), each pinned to one
 * vendor's model for the same prompt, and compare their whole-run aggregates.
 * Validity is gated on the session never switching models, and the first-turn
 * input-token count is surfaced as a "same prompt" equivalence proxy.
 */
import type { StatsStore } from './metrics.js';
import { type SessionSummary } from './metrics.js';
import { type ModelAliases } from './model.js';
export interface SessionCompareRow {
    summary: SessionSummary;
    canonical: string;
}
export interface SessionCompareResult {
    rows: SessionCompareRow[];
    warnings: string[];
}
/** Compare the given session ids; warnings cover model-switch and prompt-size mismatch. */
export declare function compareSessions(store: StatsStore, ids: readonly string[], aliases: ModelAliases): SessionCompareResult;
