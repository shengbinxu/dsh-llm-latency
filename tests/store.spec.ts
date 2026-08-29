import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadStore } from '../src/store.js'

const tempDirs: string[] = []
afterEach(() => {
  for (const d of tempDirs) {
    try {
      rmSync(d, { recursive: true, force: true })
    } catch {
      // ignore cleanup failure
    }
  }
  tempDirs.length = 0
})

describe('store migration', () => {
  it('migrates a v1 recent ring into v2 hour buckets', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-latency-store-'))
    tempDirs.push(dir)
    const path = join(dir, 'stats.json')
    const v1 = {
      version: 1,
      keys: {
        'a|p|m': {
          recent: [{
            ts: Date.now(), vendor: 'a', provider: 'p', model: 'm',
            ttftMs: 100, ttftTextMs: null, e2eMs: 200,
            outputTokens: 1, inputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0,
            ok: true, errorKind: null, source: 'live', cold: null,
          }],
        },
      },
    }
    writeFileSync(path, JSON.stringify(v1))
    const store = loadStore(path)
    expect(store.version).toBe(2)
    expect(Object.keys(store.keys)).toHaveLength(1)
    const agg = Object.values(store.keys)[0]!
    expect(agg.recent).toHaveLength(1)
    expect(Object.values(agg.buckets)).toHaveLength(1)
  })

  it('returns an empty store for an unknown version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-latency-store-'))
    tempDirs.push(dir)
    const path = join(dir, 'stats.json')
    writeFileSync(path, JSON.stringify({ version: 99, keys: {} }))
    const store = loadStore(path)
    expect(store.version).toBe(2)
    expect(Object.keys(store.keys)).toHaveLength(0)
  })
})
