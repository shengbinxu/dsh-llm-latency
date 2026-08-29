/**
 * Cross-vendor comparison over one canonical model and one time window.
 *
 * Statistical rigor: percentiles come from merged histograms; the median's
 * 95% bootstrap CI (and exact percentiles) come from the recent sample ring
 * when the window falls inside the ring's coverage. Two vendors differ
 * significantly when their median CIs do not overlap. Sample-size guards flag
 * insufficient evidence and gross sample imbalance.
 */

import type { StatsStore, KeySummary, BucketAgg } from './metrics.js'
import { sliceBuckets, summarizeBucket, emptyBucket, mergeBucket } from './metrics.js'
import { canonicalModel, type ModelAliases } from './model.js'

export interface MedianCi {
  median: number
  lo: number
  hi: number
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
}

/**
 * 95% bootstrap confidence interval of the median, percentile method.
 * Returns null when fewer than two samples are available.
 */
export function bootstrapMedianCi(values: readonly number[], resamples = 2000): MedianCi | null {
  if (values.length < 2) return null
  const n = values.length
  const medians: number[] = []
  for (let i = 0; i < resamples; i += 1) {
    const sample: number[] = []
    for (let j = 0; j < n; j += 1) {
      sample.push(values[Math.floor(Math.random() * n)] as number)
    }
    const m = median(sample)
    if (m !== null) medians.push(m)
  }
  medians.sort((a, b) => a - b)
  const lo = medians[Math.floor(0.025 * (medians.length - 1))] as number
  const hi = medians[Math.floor(0.975 * (medians.length - 1))] as number
  return { median: median(values) ?? lo, lo, hi }
}

/** Do two median CIs overlap? Non-overlap is the significance criterion. */
export function ciSignificant(a: MedianCi, b: MedianCi): boolean {
  return a.hi < b.lo || b.hi < a.lo
}

export interface VendorRow {
  vendor: string
  summary: KeySummary
  exactTtftP50: number | null
  medianCi: MedianCi | null
}

export interface ComparisonResult {
  model: string
  from: number
  to: number
  rows: VendorRow[]
  warnings: string[]
}

export interface CompareOptions {
  minSamples: number
}

/** Merge the window slices of every key matching a vendor's model set. */
function vendorBucket(store: StatsStore, vendor: string, modelIds: readonly string[], from: number, to: number): BucketAgg {
  const out = emptyBucket()
  for (const [key, agg] of Object.entries(store.keys)) {
    const [v] = key.split('|') as [string]
    const model = (key.split('|') as [string, string, string])[2]
    if (v !== vendor || !modelIds.includes(model)) continue
    mergeBucket(out, sliceBuckets(agg, from, to))
  }
  return out
}

function ringTtft(store: StatsStore, vendor: string, modelIds: readonly string[], from: number, to: number): number[] {
  const out: number[] = []
  for (const [key, agg] of Object.entries(store.keys)) {
    const parts = key.split('|') as [string, string, string]
    if (parts[0] !== vendor || !modelIds.includes(parts[2])) continue
    for (const s of agg.recent) {
      if (s.ok && s.ttftMs !== null && s.ts >= from && s.ts <= to) out.push(s.ttftMs)
    }
  }
  return out
}

/** Compare one canonical model across its vendors over `[from, to)`. */
export function compareVendors(
  store: StatsStore,
  canonical: string,
  aliases: ModelAliases,
  from: number,
  to: number,
  vendors: readonly string[] | undefined,
  opts: CompareOptions,
): ComparisonResult {
  const modelIds = new Set<string>()
  for (const [key] of Object.entries(store.keys)) {
    const model = (key.split('|') as [string, string, string])[2]
    if (canonicalModel(model, aliases) === canonical) modelIds.add(model)
  }
  const vendorSet = new Set<string>()
  for (const [key] of Object.entries(store.keys)) {
    const v = (key.split('|') as [string])[0]
    const model = (key.split('|') as [string, string, string])[2]
    if (modelIds.has(model)) vendorSet.add(v)
  }
  const targetVendors = [...vendorSet].filter((v) => vendors === undefined || vendors.includes(v)).sort()

  const rows: VendorRow[] = []
  for (const vendor of targetVendors) {
    const bucket = vendorBucket(store, vendor, [...modelIds], from, to)
    if (bucket.ok + bucket.fail === 0) continue
    const exact = ringTtft(store, vendor, [...modelIds], from, to)
    rows.push({
      vendor,
      summary: summarizeBucket(vendor, '*', canonical, bucket),
      exactTtftP50: median(exact),
      medianCi: exact.length >= opts.minSamples ? bootstrapMedianCi(exact) : null,
    })
  }
  rows.sort((a, b) => (a.summary.ttftP50 ?? Infinity) - (b.summary.ttftP50 ?? Infinity))

  const warnings: string[] = []
  const withCi = rows.filter((r) => r.medianCi !== null)
  if (rows.length < 2) {
    warnings.push('可对比的厂商不足两个。')
  }
  for (const r of rows) {
    if (r.summary.okCount < opts.minSamples) {
      warnings.push(`${r.vendor} 样本不足（${r.summary.okCount} < ${opts.minSamples}），结论仅供参考。`)
    }
  }
  const counts = rows.map((r) => r.summary.okCount)
  const max = Math.max(...counts, 0)
  const min = Math.min(...counts.filter((c) => c > 0), 0)
  if (rows.length >= 2 && min > 0 && max / min > 5) {
    warnings.push('厂商间样本量悬殊（>5×），时段使用强度不同可能造成混淆。')
  }

  return { model: canonical, from, to, rows, warnings }
}
