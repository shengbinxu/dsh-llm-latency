/**
 * Best-effort durable persistence of the aggregate store to a JSON file under
 * `$DSH_HOME/llm-latency/stats.json`. Writes are atomic (tmp + rename); any
 * failure leaves the in-memory store intact and measurement keeps running.
 */

import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { env } from 'node:process'
import { join, dirname } from 'node:path'

import { emptyStore, type StatsStore } from './metrics.js'

export function statsDir(): string {
  const home = env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'llm-latency')
}

export function statsFile(): string {
  return join(statsDir(), 'stats.json')
}

/** Load the store, returning an empty store on any parse/IO failure. */
export function loadStore(path: string): StatsStore {
  try {
    if (!existsSync(path)) return emptyStore()
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as StatsStore
    if (parsed === null || typeof parsed !== 'object' || parsed.version !== 1 || typeof parsed.keys !== 'object') {
      return emptyStore()
    }
    return parsed
  } catch {
    return emptyStore()
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
