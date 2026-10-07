import { describe, expect, it } from 'vitest'
import { emptyStore, recordSample, type RecordOptions } from '../src/metrics.js'
import { recentLatency } from '../src/recent.js'
import type { Sample } from '../src/sample.js'

const options: RecordOptions = { recentLimit: 100, retentionDays: 30, sessionLimit: 10, spikeFloorMs: 10_000 }
function sample(ts: number, ttftMs: number, extra: Partial<Sample> = {}): Sample {
  return { ts, vendor: 'vendor', provider: 'provider', model: 'model', ttftMs,
    ttftTextMs: ttftMs + 50, e2eMs: ttftMs + 100, inputTokens: 10, outputTokens: 10,
    cacheReadTokens: 0, cacheWriteTokens: 0, ok: true, errorKind: null, ...extra }
}

describe('current latency from retained samples', () => {
  it('excludes old samples even when they occupy the same hourly aggregation bucket', () => {
    const now = Date.now()
    const store = emptyStore()
    recordSample(store, sample(now - 16 * 60_000, 100), options)
    recordSample(store, sample(now - 1_000, 10_000), options)
    const [row] = recentLatency(store, now - 15 * 60_000, now)
    expect(row!.count).toBe(1)
    expect(row!.medianTtftMs).toBe(10_000)
    expect(row!.latest!.ttftMs).toBe(10_000)
  })

  it('marks idle models without displaying old latency as a current measurement', () => {
    const now = Date.now()
    const store = emptyStore()
    recordSample(store, sample(now - 20 * 60_000, 250), options)
    expect(recentLatency(store, now - 15 * 60_000, now)[0]).toMatchObject({
      count: 0, latest: null, medianTtftMs: null, medianFirstTextMs: null,
      lastSeen: now - 20 * 60_000,
    })
  })

  it('retains the latest failure while calculating the median from successful requests only', () => {
    const now = Date.now()
    const store = emptyStore()
    recordSample(store, sample(now - 3_000, 100), options)
    recordSample(store, sample(now - 2_000, 300), options)
    recordSample(store, sample(now - 1_000, 9_000, { ok: false, errorKind: 'timeout' }), options)
    expect(recentLatency(store, now - 15 * 60_000, now)[0]).toMatchObject({
      count: 3, okCount: 2, failCount: 1, medianTtftMs: 200,
      latest: { ok: false, errorKind: 'timeout' },
    })
  })

  it('keeps vendors separate and merges same-vendor providers for the same model', () => {
    const now = Date.now()
    const store = emptyStore()
    recordSample(store, sample(now - 3_000, 100), options)
    recordSample(store, sample(now - 2_000, 300, { provider: 'second-provider' }), options)
    recordSample(store, sample(now - 1_000, 800, { vendor: 'other-vendor' }), options)
    const rows = recentLatency(store, now - 15 * 60_000, now)
    expect(rows).toHaveLength(2)
    expect(rows.find(row => row.vendor === 'vendor')).toMatchObject({ count: 2, medianTtftMs: 200 })
    expect(rows.find(row => row.vendor === 'other-vendor')).toMatchObject({ count: 1, medianTtftMs: 800 })
  })
})
