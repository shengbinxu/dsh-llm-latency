/**
 * Session-level comparison: pick sessions (usually two), each pinned to one
 * vendor's model for the same prompt, and compare their whole-run aggregates.
 * Validity is gated on the session never switching models, and the first-turn
 * input-token count is surfaced as a "same prompt" equivalence proxy.
 */
import { summarizeSession } from './metrics.js';
import { canonicalModel } from './model.js';
/** Compare the given session ids; warnings cover model-switch and prompt-size mismatch. */
export function compareSessions(store, ids, aliases) {
    const rows = [];
    for (const id of ids) {
        const agg = store.sessions[id];
        if (agg === undefined)
            continue;
        const summary = summarizeSession(id, agg);
        rows.push({ summary, canonical: canonicalModel(summary.model, aliases) });
    }
    const warnings = [];
    for (const r of rows) {
        if (!r.summary.singleModel) {
            warnings.push(`会话 ${r.summary.id.slice(0, 8)} 内切换过模型（${r.summary.models.join(', ')}），对比无效。`);
        }
    }
    const canonicals = new Set(rows.map((r) => r.canonical));
    if (canonicals.size > 1) {
        warnings.push('所选会话不是同一模型，对比价值有限。');
    }
    const withFirst = rows.filter((r) => r.summary.firstCallInputTokens > 0);
    if (withFirst.length >= 2) {
        const tokens = withFirst.map((r) => r.summary.firstCallInputTokens);
        const max = Math.max(...tokens);
        const min = Math.min(...tokens);
        if (min > 0 && max / min > 1.2) {
            warnings.push('首轮输入 token 差异 >20%，提示词可能不同。');
        }
    }
    return { rows, warnings };
}
