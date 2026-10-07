import { describe, expect, it } from 'vitest'
import { applyChunk, freshMeasurement, measurementToSample } from '../src/measure.js'
import { emptyStore, recordSample, summarizeStore, summarizeSessions, mergeStore } from '../src/metrics.js'
import { sampleThroughput, throughputRate, visibleOutputTokens } from '../src/throughput.js'
import { renderDashboardHtml } from '../src/dashboard.js'
import { formatSummaryRows } from '../src/report.js'

const opts = { recentLimit: 100, retentionDays: 30, sessionLimit: 100, spikeFloorMs: 10000 }
function measured() {
  const m = freshMeasurement()
  applyChunk(m, { type: 'text-delta', index: 0, text: '' }, 10)
  applyChunk(m, { type: 'reasoning-delta', index: 0, text: 'think' }, 100)
  applyChunk(m, { type: 'text-delta', index: 1, text: 'first' }, 1000)
  applyChunk(m, { type: 'text-delta', index: 1, text: 'last' }, 3000)
  applyChunk(m, { type: 'usage', usage: { inputTokens: 10, outputTokens: 120, reasoningTokens: 20 } }, 4000)
  m.e2eMs = 5000
  return measurementToSample(m, { ts: Date.now(), vendor: 'v', provider: 'p', model: 'm', sessionId: 's' })
}

describe('visible throughput', () => {
  it('uses first and last nonempty text, subtracting separately reported reasoning', () => {
    const sample = measured()
    expect(sample.ttftMs).toBe(100)
    expect(sample.ttftTextMs).toBe(1000)
    expect(sample.lastTextMs).toBe(3000)
    expect(visibleOutputTokens(sample)).toBe(100)
    const rate = sampleThroughput(sample)
    expect(throughputRate(rate.outputRateTokens, rate.outputRateMs)).toBe(50)
    expect(throughputRate(rate.overallRateTokens, rate.overallRateMs)).toBe(20)
  })
  it('keeps unknown reasoning, failures, legacy samples and tool output out of both rates', () => {
    for (const patch of [{ reasoningTokens: null }, { reasoningTokens: undefined }, { reasoningTokens: 121 }, { ok: false }, { hasToolCalls: true }, { hasOutputUsage: false }, { lastTextMs: undefined, hasOutputUsage: undefined }]) {
      const rate = sampleThroughput({ ...measured(), ...patch })
      expect(rate.outputRateSamples).toBe(0)
      expect(rate.overallRateSamples).toBe(0)
    }
  })
  it('preserves the legacy total-output rate when separate reasoning usage is unavailable', () => {
    const store = emptyStore()
    recordSample(store, { ...measured(), reasoningTokens: null }, opts)
    const row = summarizeStore(store, 0, Date.now() + 1)[0]!
    expect(row.tokensPerSecond).toBeCloseTo(120 * 1000 / (5000 - 100))
    expect(row.outputTokensPerSecond).toBeNull()
    expect(row.overallTokensPerSecond).toBeNull()
    expect(renderDashboardHtml()).toContain('总输出速度（词元/秒）')
    expect(renderDashboardHtml()).toContain('回答文字速度（词元/秒）')
  })
  it('reports only overall rate for a single text chunk', () => {
    const rate = sampleThroughput({ ...measured(), lastTextMs: 1000 })
    expect(rate.outputRateSamples).toBe(0)
    expect(rate.overallRateSamples).toBe(1)
  })
  it('accepts an explicit zero reasoning count and rejects invalid durations', () => {
    expect(visibleOutputTokens({ ...measured(), reasoningTokens: 0 })).toBe(120)
    expect(sampleThroughput({ ...measured(), e2eMs: 0 }).overallRateSamples).toBe(0)
    expect(sampleThroughput({ ...measured(), ttftTextMs: null }).overallRateSamples).toBe(0)
  })
  it('merges matched token and duration sums across buckets and sessions', () => {
    const a = emptyStore(), b = emptyStore()
    recordSample(a, measured(), opts)
    recordSample(b, { ...measured(), lastTextMs: 2000, e2eMs: 1000 }, opts)
    recordSample(b, { ...measured(), ok: false, outputTokens: 10000 }, opts)
    mergeStore(a, b, opts)
    const row = summarizeStore(a, 0, Date.now() + 1)[0]!
    expect(row.outputTokensPerSecond).toBeCloseTo(200 / 3)
    expect(row.overallTokensPerSecond).toBeCloseTo(200 / 6)
    expect(row.outputRateSamples).toBe(2)
    const session = summarizeSessions(a)[0]!
    expect(session.overallTokensPerSecond).toBe(row.overallTokensPerSecond)
    const report = formatSummaryRows([row])
    expect(report).toContain('输出 token/s')
    expect(report).toContain('整体 token/s')
  })
  it('renders calculation help even when there are no samples', () => {
    const html = renderDashboardHtml()
    expect(html).toContain('指标计算说明')
    expect(html).toContain('末段非空文本时间 − 首段非空文本时间')
    expect(html).toContain('reasoningTokens')
    expect(html).toContain('不是单请求速率平均值或中位数')
    expect(html).toContain('outputTokensPerSecond,overallTokensPerSecond')
    expect(html).toMatchSnapshot()
  })
})
