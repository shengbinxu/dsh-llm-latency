import { describe, it, expect } from 'vitest'

import {
  emptyStore,
  emptyHist,
  recordHist,
  histPercentile,
  histTotal,
  cacheHitShare,
  cacheWriteShare,
  recordSample,
  summarizeStore,
  summarizeSessions,
  aggKey,
  mergeStore,
  type RecordOptions,
} from '../src/metrics.js'
import type { Sample } from '../src/sample.js'

const OPTS: RecordOptions = { recentLimit: 100, retentionDays: 30, sessionLimit: 10, spikeFloorMs: 10_000 }

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

describe('histogram', () => {
  it('returns null for an empty histogram', () => {
    expect(histPercentile(emptyHist(), 0.5)).toBeNull()
    expect(histTotal(emptyHist())).toBe(0)
  })

  it('interpolates the median across bins', () => {
    const h = emptyHist()
    for (const v of [100, 200, 300]) recordHist(h, v)
    // 100 -> [100,200), 200 -> [200,300), 300 -> [300,500).
    // median target 1.5 lands in the [200,300) bin -> 200 + 0.5*100 = 250.
    expect(histPercentile(h, 0.5)).toBeCloseTo(250)
  })

  it('p95 of a single value interpolates within its bin', () => {
    const h = emptyHist()
    recordHist(h, 1000)
    // 1000 falls at the lower edge of [1000,1500); p95 -> 1000 + 0.95*500 = 1475.
    expect(histPercentile(h, 0.95)).toBeCloseTo(1475)
  })
})

describe('cache shares', () => {
  it('uses the billed-input fold and returns null for no input', () => {
    expect(cacheHitShare(50, 40, 10)).toBeCloseTo(0.4)
    expect(cacheWriteShare(50, 40, 10)).toBeCloseTo(0.1)
    expect(cacheHitShare(0, 0, 0)).toBeNull()
  })
})

describe('recordSample and summarize', () => {
  it('aggregates samples and derives p50 and cache hit share', () => {
    const store = emptyStore(30)
    recordSample(store, sample({ ttftMs: 100, e2eMs: 200, outputTokens: 10, inputTokens: 100, cacheReadTokens: 50 }), OPTS)
    recordSample(store, sample({ ttftMs: 300, e2eMs: 400, outputTokens: 20, inputTokens: 100, cacheReadTokens: 50 }), OPTS)
    const rows = summarizeStore(store, 0, Date.now())
    expect(rows).toHaveLength(1)
    expect(rows[0]!.count).toBe(2)
    expect(rows[0]!.okCount).toBe(2)
    // billed input = 200 uncached + 100 cacheRead; share = 100 / 300 = 1/3.
    expect(rows[0]!.cacheHitPct).toBeCloseTo(1 / 3)
    expect(rows[0]!.tokensPerSecond).not.toBeNull()
    expect(rows[0]!.ttftP50).not.toBeNull()
  })

  it('keeps failures out of success latency', () => {
    const store = emptyStore(30)
    recordSample(store, sample({ ttftMs: 500, e2eMs: 700, ok: true }), OPTS)
    recordSample(store, sample({ ttftMs: null, e2eMs: 50, ok: false, errorKind: 'rateLimited' }), OPTS)
    const row = summarizeStore(store, 0, Date.now())[0]!
    expect(row.okCount).toBe(1)
    expect(row.failCount).toBe(1)
    expect(row.errors.rateLimited).toBe(1)
    expect(row.ttftP50).not.toBeNull()
  })

  it('uses a stable aggregate key', () => {
    expect(aggKey('a', 'b', 'c')).toBe('a|b|c')
  })
})

describe('time-window slicing', () => {
  it('includes only buckets overlapping the window', () => {
    const store = emptyStore(30)
    const hourStart = Math.floor(Date.now() / 3_600_000) * 3_600_000
    const tPrev = hourStart - 3_600_000 // previous hour
    const tCur = hourStart // current hour
    recordSample(store, sample({ ts: tPrev, ttftMs: 100 }), OPTS)
    recordSample(store, sample({ ts: tCur, ttftMs: 300 }), OPTS)
    // A window ending exactly at the current-hour boundary covers only the previous hour.
    const rows = summarizeStore(store, tPrev, hourStart)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.count).toBe(1)
  })
})

describe('session aggregation', () => {
  it('tracks single-model sessions and first-call input tokens', () => {
    const store = emptyStore(30)
    recordSample(store, sample({ sessionId: 's1', ttftMs: 100, inputTokens: 500 }), OPTS)
    recordSample(store, sample({ sessionId: 's1', ttftMs: 300, inputTokens: 1000 }), OPTS)
    const sessions = summarizeSessions(store)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.singleModel).toBe(true)
    expect(sessions[0]!.firstCallInputTokens).toBe(500)
    expect(sessions[0]!.calls).toBe(2)
  })

  it('flags a session that switched models', () => {
    const store = emptyStore(30)
    recordSample(store, sample({ sessionId: 's2', model: 'm1' }), OPTS)
    recordSample(store, sample({ sessionId: 's2', model: 'm2' }), OPTS)
    const s = summarizeSessions(store).find((x) => x.id === 's2')!
    expect(s.singleModel).toBe(false)
    expect(s.models).toHaveLength(2)
  })
})

describe('mergeStore', () => {
  it('sums histograms and counts across stores', () => {
    const a = emptyStore(30)
    const b = emptyStore(30)
    recordSample(a, sample({ ttftMs: 100, e2eMs: 200 }), OPTS)
    recordSample(b, sample({ ttftMs: 300, e2eMs: 400 }), OPTS)
    mergeStore(a, b, OPTS)
    const row = summarizeStore(a, 0, Date.now())[0]!
    expect(row.count).toBe(2)
    expect(row.ttftP50).toBeGreaterThan(100)
  })
})
