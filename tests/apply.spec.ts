import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply, name } from '../src/index.js'
import { loadStore } from '../src/store.js'
import type { Context, GenerateOptions, StreamChunk } from '../src/types.js'

interface FakeCtx {
  listeners: Map<string, Array<(...args: unknown[]) => unknown>>
  services: Map<string, unknown>
  toolsDisposers: (() => void)[]
  get(n: string): unknown
  on(n: string, l: (...args: unknown[]) => unknown): () => void
  effect(cb: () => (() => void) | void | undefined): () => void
  tools: { register(def: unknown): () => void }
  webServer: { register(route: unknown): () => void }
}

function fakeCtx(): FakeCtx & Context {
  const listeners = new Map<string, Array<(...args: unknown[]) => unknown>>()
  const services = new Map<string, unknown>()
  const toolsDisposers: (() => void)[] = []
  return {
    listeners,
    services,
    toolsDisposers,
    get(n: string) {
      return services.get(n)
    },
    on(n: string, l: (...args: unknown[]) => unknown) {
      const arr = listeners.get(n) ?? []
      arr.push(l)
      listeners.set(n, arr)
      return () => {
        const cur = listeners.get(n) ?? []
        listeners.set(n, cur.filter((x) => x !== l))
      }
    },
    effect(cb) {
      const d = cb()
      return d ?? (() => {})
    },
    tools: {
      register() {
        toolsDisposers.push(() => {})
        return () => {}
      },
    },
    webServer: {
      register() {
        return () => {}
      },
    },
  } as unknown as FakeCtx & Context
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

describe('apply wiring', () => {
  it('exports the plugin name and wires the llm/stream waterfall', async () => {
    expect(name).toBe('llm-latency')
    const ctx = fakeCtx()
    const dir = mkdtempSync(join(tmpdir(), 'llm-latency-'))
    tempDirs.push(dir)
    const statsPath = join(dir, 'stats.json')

    const dispose = apply(ctx, { statsPath })
    expect(ctx.listeners.has('llm/stream')).toBe(true)
    // The single latency_report tool registers through the injected tools service.
    expect(ctx.toolsDisposers).toHaveLength(1)

    const listener = ctx.listeners.get('llm/stream')![0]!
    const options: GenerateOptions = {
      provider: 'deepseek-official',
      model: 'deepseek-v4',
      messages: [{ role: 'user', content: 'hi' }],
    }
    const next = async function* (): AsyncGenerator<StreamChunk> {
      yield { type: 'text-delta', index: 0, text: 'a' }
      yield { type: 'usage', usage: { inputTokens: 5, outputTokens: 1, cacheReadTokens: 0 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }

    const wrapped = listener(options, next) as AsyncIterable<StreamChunk>
    const got: StreamChunk[] = []
    for await (const c of wrapped) got.push(c)
    expect(got).toHaveLength(3)

    // The wrapper's finally persisted one sample under its vendor|provider|model key.
    expect(existsSync(statsPath)).toBe(true)
    const store = loadStore(statsPath)
    expect(Object.keys(store.keys)).toHaveLength(1)
    const agg = Object.values(store.keys)[0]!
    expect(agg.recent).toHaveLength(1)
    const buckets = Object.values(agg.buckets)
    expect(buckets).toHaveLength(1)
    expect(buckets[0]!.ok).toBe(1)
    expect(buckets[0]!.fail).toBe(0)

    dispose()
    expect(ctx.listeners.get('llm/stream') ?? []).toHaveLength(0)
  })

  it('passes auxiliary (purpose) calls through unmeasured', async () => {
    const ctx = fakeCtx()
    const dir = mkdtempSync(join(tmpdir(), 'llm-latency-'))
    tempDirs.push(dir)
    const statsPath = join(dir, 'stats.json')
    const dispose = apply(ctx, { statsPath })

    const listener = ctx.listeners.get('llm/stream')![0]!
    const options: GenerateOptions = {
      provider: 'p',
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      purpose: 'compaction',
    }
    const next = async function* (): AsyncGenerator<StreamChunk> {
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
    const wrapped = listener(options, next) as AsyncIterable<StreamChunk>
    for await (const _c of wrapped) { /* consume */ }

    // No store file is created for skipped calls.
    expect(existsSync(statsPath)).toBe(false)
    dispose()
  })
})
