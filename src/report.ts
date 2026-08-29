/**
 * Text (markdown-table) formatting for the `latency_report` model tool.
 */

import type { StatsStore, KeySummary } from './metrics.js'
import { summarizeStore } from './metrics.js'
import type { ComparisonResult } from './comparison.js'
import { ciSignificant } from './comparison.js'
import type { SessionCompareResult } from './session.js'

function ms(v: number | null): string {
  if (v === null) return '—'
  return v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(2)}s`
}

function pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`
}

function tps(v: number | null): string {
  return v === null ? '—' : v.toFixed(1)
}

function errorSummary(s: KeySummary): string {
  const total = s.count
  if (total === 0) return '—'
  const parts: string[] = []
  if (s.errors.rateLimited > 0) parts.push(`429:${(s.errors.rateLimited / total * 100).toFixed(0)}%`)
  if (s.errors.timeout > 0) parts.push(`超时:${(s.errors.timeout / total * 100).toFixed(0)}%`)
  if (s.errors.server > 0) parts.push(`5xx:${(s.errors.server / total * 100).toFixed(0)}%`)
  if (s.errors.aborted > 0) parts.push(`中止:${(s.errors.aborted / total * 100).toFixed(0)}%`)
  return parts.length === 0 ? '0' : parts.join(' ')
}

/** Format a pre-filtered list of key summaries as an overall comparison table. */
export function formatSummaryRows(rows: KeySummary[]): string {
  if (rows.length === 0) {
    return '该时段暂无采样数据。'
  }
  const lines = [
    '| 厂商 / 模型 | 样本(成功/总) | 首token p50 | 首token p95 | 端到端 p50 | 吐字 tok/s | 缓存命中 | 失败 |',
    '|---|---|---|---|---|---|---|---|',
  ]
  for (const r of rows) {
    lines.push(
      `| ${r.vendor} · ${r.model} | ${r.okCount}/${r.count} | ${ms(r.ttftP50)} | ${ms(r.ttftP95)} | ${ms(r.e2eP50)} | ${tps(r.tokensPerSecond)} | ${pct(r.cacheHitPct)} | ${errorSummary(r)} |`,
    )
  }
  return lines.join('\n')
}

/** Overall (windowed) comparison table over the durable store. */
export function formatSummaryTable(store: StatsStore, from: number, to: number): string {
  return formatSummaryRows(summarizeStore(store, from, to))
}

/** Cross-vendor comparison table for one canonical model and window. */
export function formatComparisonTable(result: ComparisonResult): string {
  if (result.rows.length === 0) {
    return `模型 ${result.model} 在该时段无采样数据。`
  }
  const lines = [
    `## 同模型跨厂商对比：${result.model}`,
    '',
    '| 厂商 | 样本(成功/总) | 首token p50 | 首token p95 | 端到端 p50 | 吐字 tok/s | 缓存命中 | 缓存写入 | 失败 | 显著性 |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ]
  const significant = new Set<number>()
  for (let i = 0; i < result.rows.length; i += 1) {
    for (let j = i + 1; j < result.rows.length; j += 1) {
      const a = result.rows[i]?.medianCi
      const b = result.rows[j]?.medianCi
      if (a !== null && a !== undefined && b !== null && b !== undefined && ciSignificant(a, b)) {
        significant.add(i)
        significant.add(j)
      }
    }
  }
  for (let i = 0; i < result.rows.length; i += 1) {
    const r = result.rows[i] as NonNullable<(typeof result.rows)[number]>
    const s = r.summary
    const ci = r.medianCi
    const sig = ci === null ? '证据不足' : significant.has(i) ? '有显著差异' : '无显著差异'
    lines.push(
      `| ${s.vendor} | ${s.okCount}/${s.count} | ${ms(s.ttftP50)} | ${ms(s.ttftP95)} | ${ms(s.e2eP50)} | ${tps(s.tokensPerSecond)} | ${pct(s.cacheHitPct)} | ${pct(s.cacheWritePct)} | ${errorSummary(s)} | ${sig} |`,
    )
  }
  for (const w of result.warnings) lines.push('', `> ⚠️ ${w}`)
  return lines.join('\n')
}

/** Session comparison table. */
export function formatSessionTable(result: SessionCompareResult): string {
  if (result.rows.length === 0) {
    return '未找到所选会话。'
  }
  const lines = [
    '| 会话 | 厂商 · 模型 | 调用(成功/总) | 首轮TTFT | 首轮输入token | 首token p50 | 首token p95 | 缓存命中 | 失败 |',
    '|---|---|---|---|---|---|---|---|---|',
  ]
  for (const r of result.rows) {
    const s = r.summary
    lines.push(
      `| ${s.id.slice(0, 8)} | ${s.vendor} · ${s.model}${s.singleModel ? '' : ' ⚠️换模'} | ${s.okCount}/${s.calls} | ${ms(s.firstCallTtftMs)} | ${s.firstCallInputTokens} | ${ms(s.ttftP50)} | ${ms(s.ttftP95)} | ${pct(s.cacheHitPct)} | ${s.failCount === 0 ? '0' : `${s.failCount}次`} |`,
    )
  }
  for (const w of result.warnings) lines.push('', `> ⚠️ ${w}`)
  return lines.join('\n')
}
