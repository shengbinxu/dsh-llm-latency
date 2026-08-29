/**
 * Best-effort durable persistence of the aggregate store to a JSON file under
 * `$DSH_HOME/llm-latency/stats.json`. Writes are atomic (tmp + rename); any
 * failure leaves the in-memory store intact and measurement keeps running.
 */

import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { env } from 'node:process'
import { join, dirname } from 'node:path'

import { emptyStore, recordSample, type RecordOptions, type StatsStore } from './metrics.js'
import type { Sample, ErrorKind } from './sample.js'

export const DEFAULT_RECORD_OPTIONS: RecordOptions = {
  recentLimit: 2000,
  retentionDays: 30,
  sessionLimit: 500,
  spikeFloorMs: 10_000,
}

export function statsDir(): string {
  const home = env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'llm-latency')
}

export function statsFile(): string {
  return join(statsDir(), 'stats.json')
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** Best-effort v1 → v2: replay the v1 `recent` ring into v2 hour buckets. */
function migrateV1(parsed: { keys?: unknown }, opts: RecordOptions): StatsStore {
  const store = emptyStore(opts.retentionDays)
  const keys = parsed.keys
  if (keys === null || typeof keys !== 'object') return store
  for (const agg of Object.values(keys as Record<string, unknown>)) {
    const recent = (agg as { recent?: unknown } | null)?.recent
    if (!Array.isArray(recent)) continue
    for (const raw of recent) {
      const sample = migrateV1Sample(raw)
      if (sample !== null) recordSample(store, sample, opts)
    }
  }
  return store
}

function migrateV1Sample(raw: unknown): Sample | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.ts !== 'number' || typeof r.vendor !== 'string') return null
  const kind: ErrorKind | null =
    r.errorKind === 'aborted' ? 'aborted' : r.errorKind === 'error' ? 'other' : null
  return {
    ts: r.ts,
    vendor: r.vendor,
    provider: typeof r.provider === 'string' ? r.provider : '',
    model: typeof r.model === 'string' ? r.model : '',
    ttftMs: numOrNull(r.ttftMs),
    ttftTextMs: numOrNull(r.ttftTextMs),
    e2eMs: numOrNull(r.e2eMs),
    outputTokens: num(r.outputTokens),
    inputTokens: num(r.inputTokens),
    cacheReadTokens: num(r.cacheReadTokens),
    cacheWriteTokens: num(r.cacheWriteTokens),
    ok: r.ok !== false,
    errorKind: kind,
  }
}

/**
 * Load the store. v2 stores load as-is (validation only); v1 stores migrate
 * their `recent` rings; anything else returns an empty store.
 */
export function loadStore(path: string, opts: RecordOptions = DEFAULT_RECORD_OPTIONS): StatsStore {
  try {
    if (!existsSync(path)) return emptyStore(opts.retentionDays)
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown; keys?: unknown }
    if (parsed === null || typeof parsed !== 'object') return emptyStore(opts.retentionDays)
    if (parsed.version === 2) {
      const store = parsed as unknown as StatsStore
      if (typeof store.keys === 'object' && typeof store.sessions === 'object') {
        store.retentionDays = opts.retentionDays
        return store
      }
      return emptyStore(opts.retentionDays)
    }
    if (parsed.version === 1) return migrateV1(parsed, opts)
    return emptyStore(opts.retentionDays)
  } catch {
    return emptyStore(opts.retentionDays)
  }
}

/** Atomically write the store; failures are swallowed by design. */
export function saveStore(path: string, store: StatsStore): void {
  try {
    mkdirSync(dirname(path), { recursive: true })
    const tmp = `${path}.tmp`
    writeFileSync(tmp, JSON.stringify(store), 'utf8')
    renameSync(tmp, path)
  } catch {
    // Persistence is best-effort; measurement continues in memory.
  }
}
