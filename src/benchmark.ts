/**
 * Cross-vendor A/B benchmark that replays one real long-context request across
 * multiple target routes, with anti-cache methodology:
 *   - each round appends a unique trailing user message (breaks exact-match cache),
 *   - `cacheBust` additionally prefixes the system prompt (breaks prefix cache),
 *   - targets within a round run concurrently (same wall-clock moment),
 *   - the first round is tagged `cold`, repeats are `warm`.
 *
 * Options objects created here are added to `benchmarkOptions` so the live
 * `llm/stream` interceptor passes them through without double-recording; this
 * module measures and records them itself.
 */

import { randomUUID } from 'node:crypto'

import type { LlmService, GenerateOptions, Message } from './types.js'
import type { RequestSnapshot } from './capture.js'
import { consumeAndMeasure, measurementToSample } from './measure.js'
import type { Sample } from './sample.js'
import { histPercentile, emptyHist, recordHist } from './metrics.js'

/** Live options objects tagged by the benchmark; the interceptor passes these through. */
export const benchmarkOptions = new Set<object>()

export interface BenchmarkTarget {
  provider: string
  model: string
}

export interface BenchmarkOptions {
  rounds: number
  cacheBust: boolean
  maxTokens?: number
  vendorOf: (provider: string) => string
}

export interface BenchmarkTargetResult {
  provider: string
  model: string
  vendor: string
  rounds: number
  okCount: number
  failCount: number
  ttftP50: number | null
  ttftP95: number | null
  e2eP50: number | null
  tokensPerSecond: number | null
  cacheHitPct: number | null
  samples: Sample[]
}

function buildOptions(base: RequestSnapshot, target: BenchmarkTarget, nonce: string, opts: BenchmarkOptions): GenerateOptions {
  const messages: Message[] = [...(base.messages as Message[]), { role: 'user', content: `\n\n[llm-latency-bench ${nonce}]` }]
  const system = opts.cacheBust ? `[${nonce}] ${base.system ?? ''}` : base.system
  return {
    provider: target.provider,
    model: target.model,
    system,
    messages,
    tools: base.tools,
    ...(base.reasoningEffort === undefined ? {} : { reasoningEffort: base.reasoningEffort }),
    ...(opts.maxTokens === undefined ? (base.maxTokens === undefined ? {} : { maxTokens: base.maxTokens }) : { maxTokens: opts.maxTokens }),
  }
}

/** Shuffle a copy of an array in place (Fisher-Yates). */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i] as T
    out[i] = out[j] as T
    out[j] = tmp
  }
  return out
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))
  return sorted[idx] as number
}

async function measureOne(
  llm: LlmService,
  base: RequestSnapshot,
  target: BenchmarkTarget,
  round: number,
  opts: BenchmarkOptions,
): Promise<Sample> {
  const nonce = `${round}-${randomUUID().slice(0, 8)}`
  const options = buildOptions(base, target, nonce, opts)
  benchmarkOptions.add(options)
  try {
    const m = await consumeAndMeasure(llm.stream(options))
    return measurementToSample(m, {
      ts: Date.now(),
      vendor: opts.vendorOf(target.provider),
      provider: target.provider,
      model: target.model,
      source: 'benchmark',
      cold: round === 1,
    })
  } finally {
    benchmarkOptions.delete(options)
  }
}

/** Run one replay benchmark over all targets and fold per-target results. */
export async function runBenchmark(
  llm: LlmService,
  base: RequestSnapshot,
  targets: readonly BenchmarkTarget[],
  opts: BenchmarkOptions,
  onSample: (sample: Sample) => void,
): Promise<BenchmarkTargetResult[]> {
  const byTarget = new Map<string, Sample[]>()
  const keyOf = (t: BenchmarkTarget): string => `${t.provider}|${t.model}`

  for (let round = 1; round <= opts.rounds; round += 1) {
    const order = shuffled(targets)
    const results = await Promise.all(order.map(async (target) => {
      let sample: Sample
      try {
        sample = await measureOne(llm, base, target, round, opts)
      } catch {
        // Transport or adapter-level failure becomes an error sample.
        sample = {
          ts: Date.now(),
          vendor: opts.vendorOf(target.provider),
          provider: target.provider,
          model: target.model,
          ttftMs: null,
          ttftTextMs: null,
          e2eMs: null,
          outputTokens: 0,
          inputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          ok: false,
          errorKind: 'error',
          source: 'benchmark',
          cold: round === 1,
        }
      }
      onSample(sample)
      const key = keyOf(target)
      const list = byTarget.get(key) ?? []
      list.push(sample)
      byTarget.set(key, list)
      return sample
    }))
    void results
  }

  const out: BenchmarkTargetResult[] = []
  for (const target of targets) {
    const samples = byTarget.get(keyOf(target)) ?? []
    const ok = samples.filter((s) => s.ok)
    const ttft = ok.map((s) => s.ttftMs).filter((v): v is number => v !== null).sort((a, b) => a - b)
    const e2e = ok.map((s) => s.e2eMs).filter((v): v is number => v !== null).sort((a, b) => a - b)
    let outputTokens = 0
    let decodeMs = 0
    let cacheRead = 0
    let inputTokens = 0
    let cacheWrite = 0
    for (const s of ok) {
      outputTokens += s.outputTokens
      cacheRead += s.cacheReadTokens
      inputTokens += s.inputTokens
      cacheWrite += s.cacheWriteTokens
      if (s.e2eMs !== null && s.ttftMs !== null && s.e2eMs > s.ttftMs) decodeMs += s.e2eMs - s.ttftMs
    }
    const billed = inputTokens + cacheRead + cacheWrite
    out.push({
      provider: target.provider,
      model: target.model,
      vendor: opts.vendorOf(target.provider),
      rounds: samples.length,
      okCount: ok.length,
      failCount: samples.length - ok.length,
      ttftP50: percentile(ttft, 0.5),
      ttftP95: percentile(ttft, 0.95),
      e2eP50: percentile(e2e, 0.5),
      tokensPerSecond: outputTokens > 0 && decodeMs > 0 ? outputTokens / (decodeMs / 1000) : null,
      cacheHitPct: billed > 0 ? cacheRead / billed : null,
      samples,
    })
  }
  out.sort((a, b) => (a.ttftP50 ?? Infinity) - (b.ttftP50 ?? Infinity))
  return out
}

/** Convenience: p50/p95 from a small sample array, kept for tests. */
export function smallPercentile(values: readonly number[], p: number): number | null {
  return percentile([...values].sort((a, b) => a - b), p)
}

// Re-export for tests to exercise histogram building without the runtime.
export { emptyHist, recordHist, histPercentile }
