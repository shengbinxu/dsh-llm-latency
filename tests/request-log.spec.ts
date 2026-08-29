import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createRequestLogStore, appendRequestLog, queryRequestLog } from '../src/request-log.js'
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
    ...partial,
  }
}

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

describe('request log', () => {
  it('appends and filters by vendor, status, and free text', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-latency-log-'))
    tempDirs.push(dir)
    const store = createRequestLogStore(join(dir, 'requests.jsonl'), 100, 7)

    appendRequestLog(store, sample({ vendor: 'a', model: 'm', requestId: 'req-1', ok: true }))
    appendRequestLog(store, sample({ vendor: 'b', model: 'm', errorKind: 'rateLimited', ok: false, requestId: 'req-2' }))

    expect(queryRequestLog(store, {}, 10, 0).total).toBe(2)
    expect(queryRequestLog(store, { vendor: 'a' }, 10, 0).total).toBe(1)
    expect(queryRequestLog(store, { status: 'rateLimited' }, 10, 0).total).toBe(1)
    expect(queryRequestLog(store, { status: 'ok' }, 10, 0).total).toBe(1)
    const byQ = queryRequestLog(store, { q: 'req-2' }, 10, 0)
    expect(byQ.total).toBe(1)
    expect(byQ.records[0]!.requestId).toBe('req-2')
  })

  it('sorts newest first and paginates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-latency-log-'))
    tempDirs.push(dir)
    const store = createRequestLogStore(join(dir, 'requests.jsonl'), 100, 7)
    for (let i = 0; i < 5; i += 1) {
      appendRequestLog(store, sample({ ts: 1000 + i * 100, requestId: 'r' + i }))
    }
    const page = queryRequestLog(store, {}, 2, 0)
    expect(page.total).toBe(5)
    expect(page.records).toHaveLength(2)
    expect(page.records[0]!.ts).toBeGreaterThan(page.records[1]!.ts)
    expect(page.records[0]!.requestId).toBe('r4')
  })
})
