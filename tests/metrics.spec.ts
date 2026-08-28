import { describe, it, expect } from 'vitest'

import {
  emptyStore,
  emptyHist,
  recordHist,
  histPercentile,
  histTotal,
  cacheHitShare,
  recordSample,
  summarizeStore,
  aggKey,
  mergeStore,
} from '../src/metrics.js'
import type { Sample } from '../src/sample.js'

function sample(partial: Partial<Sample>): Sample {
  return {
    ts: Date.now(),
    vendor: 'vendor-a',
    provider: 'p',
    model: 'm',
    ttftMs: null,
    ttftTextMs: null,
    e2eMs: null,
    outputTokens: 0,
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    ok: true,
    errorKind: null,
    source: 'live',
    cold: null,
    ...partial,
  }
}

describe('histogram', () => {
  it('returns null for an empty histogram', () => {
    expect(histPercentile(emptyHist(), 0.5)).toBeNull()
    expect(histTotal(emptyHist())).toBe(0)
  })

  it('interpolates the median across bins', () => {
    const h = emptyHist()
    for (const v of [100, 200, 300]) recordHist(h, v)
    // 100 -> [64,128), 200 -> [128,256), 300 -> [256,512).
    // median target 1.5 lands in the [128,256) bin -> 128 + 0.5*128 = 192.
    expect(histPercentile(h, 0.5)).toBeCloseTo(192)
  })

  it('p95 of a single value is that value', () => {
    const h = emptyHist()
    recordHist(h, 1000)
    expect(histPercentile(h, 0.95)).toBeGreaterThan(500)
    expect(histPercentile(h, 0.95)).toBeLessThan(1500)
  })
})

describe('cacheHitShare', () => {
  it('uses the billed-input fold and returns null for no input', () => {
    expect(cacheHitShare(50, 40, 10)).toBeCloseTo(0.4)
    expect(cacheHitShare(0, 0, 0)).toBeNull()
  })
})

describe('recordSample and summarize', () => {
  it('aggregates samples and derives p50 and cache hit share', () => {
    const store = emptyStore()
    recordSample(store, sample({ ttftMs: 100, e2eMs: 200, outputTokens: 10, inputTokens: 100, cacheReadTokens: 50 }))
    recordSample(store, sample({ ttftMs: 300, e2eMs: 400, outputTokens: 20, inputTokens: 100, cacheReadTokens: 50 }))
    const rows = summarizeStore(store)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.count).toBe(2)
    expect(rows[0]!.okCount).toBe(2)
    // billed input = 200 uncached + 100 cacheRead; share = 100 / 300 = 1/3.
    expect(rows[0]!.cacheHitPct).toBeCloseTo(1 / 3)
    expect(rows[0]!.tokensPerSecond).not.toBeNull()
    expect(rows[0]!.ttftP50).not.toBeNull()
  })

  it('keeps failures out of success latency', () => {
    const store = emptyStore()
    recordSample(store, sample({ ttftMs: 100, e2eMs: 200, ok: true }))
    recordSample(store, sample({ ttftMs: null, e2eMs: 50, ok: false, errorKind: 'error' }))
    const row = summarizeStore(store)[0]!
    expect(row.okCount).toBe(1)
    expect(row.failCount).toBe(1)
    // Histogram interpolation recovers ~the bin midpoint, not the exact value.
    expect(row.ttftP50).toBeGreaterThan(60)
    expect(row.ttftP50).toBeLessThan(130)
  })

  it('uses a stable aggregate key', () => {
    expect(aggKey('a', 'b', 'c')).toBe('a|b|c')
  })
})

describe('mergeStore', () => {
  it('sums histograms and counts across stores', () => {
    const a = emptyStore()
    const b = emptyStore()
    recordSample(a, sample({ ttftMs: 100, e2eMs: 200 }))
    recordSample(b, sample({ ttftMs: 300, e2eMs: 400 }))
    mergeStore(a, b)
    const row = summarizeStore(a)[0]!
    expect(row.count).toBe(2)
    expect(row.ttftP50).toBeGreaterThan(100)
  })
})
