/**
 * Text (markdown-table) formatting for the latency-report model tool.
 */
import { summarizeStore } from './metrics.js';
function ms(v) {
    if (v === null)
        return '—';
    return v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(2)}s`;
}
function pct(v) {
    return v === null ? '—' : `${(v * 100).toFixed(1)}%`;
}
function tps(v) {
    return v === null ? '—' : v.toFixed(1);
}
/** Passive (live) latency comparison table over the durable store. */
export function formatSummaryTable(store) {
    const rows = summarizeStore(store);
    if (rows.length === 0) {
        return '暂无采样数据。发起一些请求后，这里会按厂商/模型给出首 token、端到端延迟、吐字速率与缓存命中的对比。';
    }
    const lines = [
        '| 厂商 / 模型 | 样本(成功/总) | 首token p50 | 首token p95 | 端到端 p50 | 吐字 tok/s | 缓存命中 | 毛刺 |',
        '|---|---|---|---|---|---|---|---|',
    ];
    for (const r of rows) {
        lines.push(`| ${r.vendor} · ${r.model} | ${r.okCount}/${r.count} | ${ms(r.ttftP50)} | ${ms(r.ttftP95)} | ${ms(r.e2eP50)} | ${tps(r.tokensPerSecond)} | ${pct(r.cacheHitPct)} | ${r.spikes} |`);
    }
    return lines.join('\n');
}
/** Benchmark comparison table. */
export function formatBenchmarkTable(results) {
    if (results.length === 0)
        return '无对拍结果。';
    const lines = [
        '| 厂商 / 模型 | 轮次(成功/总) | 首token p50 | 首token p95 | 端到端 p50 | 吐字 tok/s | 缓存命中 |',
        '|---|---|---|---|---|---|---|',
    ];
    for (const r of results) {
        lines.push(`| ${r.vendor} · ${r.model} | ${r.okCount}/${r.rounds} | ${ms(r.ttftP50)} | ${ms(r.ttftP95)} | ${ms(r.e2eP50)} | ${tps(r.tokensPerSecond)} | ${pct(r.cacheHitPct)} |`);
    }
    return lines.join('\n');
}
