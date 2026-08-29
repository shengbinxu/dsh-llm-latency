import { describe, it, expect } from 'vitest'

import { bootstrapMedianCi, ciSignificant, compareVendors, median } from '../src/comparison.js'
import { emptyStore, recordSample, type RecordOptions } from '../src/metrics.js'
import type { Sample } from '../src/sample.js'

const OPTS: RecordOptions = { recentLimit: 1000, retentionDays: 30, sessionLimit: 10, spikeFloorMs: 10_000 }

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
    ...partial,
  }
}

describe('median and bootstrap CI', () => {
  it('computes the median', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBeNull()
  })

  it('bounds the median and widens with spread', () => {
    const tight = bootstrapMedianCi(Array.from({ length: 50 }, () => 500 + Math.random() * 10), 500)
    const wide = bootstrapMedianCi(Array.from({ length: 50 }, (_, i) => i * 100), 500)
    expect(tight!.lo).toBeLessThanOrEqual(tight!.median)
    expect(tight!.median).toBeLessThanOrEqual(tight!.hi)
    expect(wide!.hi - wide!.lo).toBeGreaterThan(tight!.hi - tight!.lo)
  })

  it('returns null for fewer than two samples', () => {
    expect(bootstrapMedianCi([1])).toBeNull()
    expect(bootstrapMedianCi([])).toBeNull()
  })
})

describe('ciSignificant', () => {
  it('is significant when intervals do not overlap', () => {
    expect(ciSignificant({ median: 100, lo: 95, hi: 105 }, { median: 200, lo: 195, hi: 205 })).toBe(true)
    expect(ciSignificant({ median: 100, lo: 90, hi: 150 }, { median: 120, lo: 100, hi: 200 })).toBe(false)
  })
})

describe('compareVendors', () => {
  it('groups by canonical model and reports no warning on balanced sufficient samples', () => {
    const store = emptyStore(30)
    for (let i = 0; i < 30; i += 1) {
      recordSample(store, sample({ vendor: 'a', model: 'm', ttftMs: 100 + i }), OPTS)
      recordSample(store, sample({ vendor: 'b', model: 'm', ttftMs: 300 + i }), OPTS)
    }
    const r = compareVendors(store, 'm', {}, Date.now() - 3_600_000, Date.now(), undefined, { minSamples: 20 })
    expect(r.rows.map((x) => x.vendor).sort()).toEqual(['a', 'b'])
    expect(r.rows.every((x) => x.medianCi !== null)).toBe(true)
    expect(r.warnings).toHaveLength(0)
  })

  it('flags insufficient samples', () => {
    const store = emptyStore(30)
    recordSample(store, sample({ vendor: 'a', model: 'm', ttftMs: 100 }), OPTS)
    recordSample(store, sample({ vendor: 'b', model: 'm', ttftMs: 300 }), OPTS)
    const r = compareVendors(store, 'm', {}, Date.now() - 3_600_000, Date.now(), undefined, { minSamples: 20 })
    expect(r.warnings.some((w) => w.includes('样本不足'))).toBe(true)
  })
})
