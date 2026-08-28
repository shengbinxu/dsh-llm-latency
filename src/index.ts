/**
 * dsh-llm-latency host plugin.
 *
 * Intercepts the `llm/stream` waterfall to record per-vendor/per-model latency
 * (first token, first visible text, end-to-end, tokens/s, cache hit share),
 * persists aggregates under `$DSH_HOME/llm-latency/stats.json`, exposes a
 * dashboard and JSON endpoints, and can replay the most recent real request
 * across vendors for an anti-cache A/B benchmark.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

import type { Context, GenerateOptions, LlmService, StreamChunk } from './types.js'
import { freshMeasurement, applyChunk, measurementToSample } from './measure.js'
import { recordSample, summarizeStore, type StatsStore } from './metrics.js'
import { loadStore, saveStore, statsFile } from './store.js'
import { createVendorResolver } from './vendor.js'
import { snapshotRequest, type RequestSnapshot } from './capture.js'
import { benchmarkOptions, runBenchmark, type BenchmarkTarget } from './benchmark.js'
import { formatSummaryTable, formatBenchmarkTable } from './report.js'
import { renderDashboardHtml } from './dashboard.js'
import { registerTools } from './tools.js'

export const name = 'llm-latency'

export interface Config {
  /** Number of distinct real-request snapshots retained for benchmarking. */
  snapshotLimit?: number
  /** Hard JSON size cap (bytes) for one retained snapshot. */
  snapshotMaxBytes?: number
  /** Default benchmark rounds per target route. */
  benchmarkRounds?: number
  /** Default cache-busting mode (break prefix cache for cold-compute comparison). */
  cacheBust?: boolean
  /** Override the aggregate store file path (defaults to `$DSH_HOME/llm-latency/stats.json`). */
  statsPath?: string
}

interface WebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

interface TargetInfo {
  provider: string
  model: string
  name: string
  vendor: string
}

function sendJson(res: ServerResponse, code: number, body: unknown): void {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function apply(ctx: Context, config: Config = {}): () => void {
  const snapshotLimit = config.snapshotLimit ?? 8
  const snapshotMaxBytes = config.snapshotMaxBytes ?? 4_000_000
  const benchmarkRounds = config.benchmarkRounds ?? 3
  const cacheBust = config.cacheBust ?? false

  const path = config.statsPath ?? statsFile()
  let store: StatsStore = loadStore(path)
  const vendor = createVendorResolver(ctx)
  const snapshots: RequestSnapshot[] = []
  const disposers: (() => void)[] = []

  const persist = (): void => saveStore(path, store)

  function captureSnapshot(options: GenerateOptions): void {
    const snap = snapshotRequest(options, snapshotMaxBytes)
    if (snap === null) return
    const last = snapshots[snapshots.length - 1]
    // Cheap de-dupe: same byte size almost always means the same repeated context.
    if (last !== undefined && last.byteSize === snap.byteSize) return
    snapshots.push(snap)
    if (snapshots.length > snapshotLimit) snapshots.shift()
  }

  function wrapLive(options: GenerateOptions, next: () => AsyncIterable<StreamChunk>): AsyncIterable<StreamChunk> {
    return (async function* () {
      const startedAt = Date.now()
      const m = freshMeasurement()
      try {
        const source = next()
        for await (const chunk of source) {
          applyChunk(m, chunk, Date.now() - startedAt)
          yield chunk
        }
      } catch (error) {
        if (m.errorKind === null) {
          m.ok = false
          m.errorKind = 'error'
        }
        throw error
      } finally {
        m.e2eMs = Date.now() - startedAt
        const sample = measurementToSample(m, {
          ts: startedAt,
          vendor: vendor.vendorOf(options.provider),
          provider: options.provider,
          model: options.model,
          source: 'live',
        })
        recordSample(store, sample)
        persist()
      }
    })()
  }

  disposers.push(ctx.on('llm/stream', (rawOptions, rawNext) => {
    const options = rawOptions as GenerateOptions
    const next = rawNext as () => AsyncIterable<StreamChunk>
    // Benchmark-owned options are measured by the benchmark itself.
    if (benchmarkOptions.has(options)) return next()
    // Auxiliary calls (compaction, session-title) are not user-facing latency.
    if (options.purpose !== undefined) return next()
    captureSnapshot(options)
    return wrapLive(options, next)
  }))

  async function listTargets(): Promise<TargetInfo[]> {
    const llm = ctx.get('llm') as LlmService | undefined
    const targets: TargetInfo[] = []
    const seen = new Set<string>()
    const latest = snapshots[snapshots.length - 1]
    if (latest !== undefined) {
      targets.push({ provider: latest.provider, model: latest.model, name: latest.model, vendor: vendor.vendorOf(latest.provider) })
      seen.add(`${latest.provider}|${latest.model}`)
    }
    if (llm === undefined) return targets
    for (const p of llm.listProviders()) {
      try {
        const models = await llm.listModels(p.id)
        for (const m of models) {
          const key = `${p.id}|${m.id}`
          if (seen.has(key)) continue
          seen.add(key)
          targets.push({ provider: p.id, model: m.id, name: m.name, vendor: vendor.vendorOf(p.id) })
        }
      } catch {
        // model discovery unavailable for this provider; skip
      }
    }
    return targets
  }

  const reportText = (): string => '以下为按厂商/模型的延迟对比：\n\n' + formatSummaryTable(store)

  async function benchmarkText(args: { rounds?: number; cacheBust?: boolean; providers?: string[] }): Promise<string> {
    const llm = ctx.get('llm') as LlmService | undefined
    const latest = snapshots[snapshots.length - 1]
    if (llm === undefined) return '未找到 llm 服务，无法对拍。'
    if (latest === undefined) return '暂无真实请求快照可供对拍。请先发起一次请求。'
    let targets = await listTargets()
    if (args.providers !== undefined && args.providers.length > 0) {
      targets = targets.filter((t) => args.providers?.includes(t.provider) ?? false)
    }
    if (targets.length < 2) return '可对拍的目标路由不足两个。'
    const results = await runBenchmark(
      llm,
      latest,
      targets.map((t): BenchmarkTarget => ({ provider: t.provider, model: t.model })),
      { rounds: args.rounds ?? benchmarkRounds, cacheBust: args.cacheBust ?? cacheBust, vendorOf: (p) => vendor.vendorOf(p) },
      (sample) => { recordSample(store, sample); persist() },
    )
    return '对拍完成（复用最新真实长上下文）。\n\n' + formatBenchmarkTable(results)
  }

  disposers.push(registerTools(ctx, { reportText, benchmarkText }))

  const webServer = ctx.get('webServer') as { register(route: WebRoute): () => void } | undefined
  if (webServer !== undefined) {
    disposers.push(webServer.register({
      kind: 'prefix',
      path: '/llm-latency',
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const pathname = url.pathname
        if (req.method === 'GET' && (pathname === '/llm-latency' || pathname === '/llm-latency/')) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(renderDashboardHtml())
          return
        }
        if (req.method === 'GET' && pathname === '/llm-latency/stats.json') {
          sendJson(res, 200, { summaries: summarizeStore(store) })
          return
        }
        if (req.method === 'GET' && pathname === '/llm-latency/targets.json') {
          sendJson(res, 200, { targets: await listTargets() })
          return
        }
        if (req.method === 'POST' && pathname === '/llm-latency/benchmark') {
          const llm = ctx.get('llm') as LlmService | undefined
          const latest = snapshots[snapshots.length - 1]
          if (llm === undefined || latest === undefined) {
            sendJson(res, 400, { error: 'no llm service or no snapshot available yet' })
            return
          }
          let body: { targets?: BenchmarkTarget[]; rounds?: number; cacheBust?: boolean }
          try {
            body = JSON.parse(await readBody(req)) as typeof body
          } catch {
            sendJson(res, 400, { error: 'invalid JSON body' })
            return
          }
          const targets = (body.targets ?? []).filter(
            (t) => t !== null && typeof t === 'object' && typeof t.provider === 'string' && typeof t.model === 'string',
          )
          if (targets.length < 2) {
            sendJson(res, 400, { error: 'need at least two targets' })
            return
          }
          const results = await runBenchmark(
            llm,
            latest,
            targets,
            {
              rounds: Math.max(1, Math.min(10, body.rounds ?? benchmarkRounds)),
              cacheBust: body.cacheBust ?? cacheBust,
              vendorOf: (p) => vendor.vendorOf(p),
            },
            (sample) => { recordSample(store, sample); persist() },
          )
          sendJson(res, 200, { results })
          return
        }
        sendJson(res, 404, { error: 'not found' })
      },
    }))
  }

  return () => {
    for (const dispose of [...disposers].reverse()) {
      try {
        dispose()
      } catch {
        // best-effort disposal
      }
    }
  }
}
