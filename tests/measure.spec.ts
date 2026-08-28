import { describe, it, expect } from 'vitest'

import { consumeAndMeasure, instrumentStream } from '../src/measure.js'
import type { StreamChunk } from '../src/types.js'

async function* chunks(list: StreamChunk[]): AsyncGenerator<StreamChunk> {
  for (const c of list) yield c
}

describe('stream measurement', () => {
  it('captures first content, first text, usage, and a stop finish', async () => {
    const m = await consumeAndMeasure(chunks([
      { type: 'reasoning-delta', index: 0, text: 'think' },
      { type: 'text-delta', index: 0, text: 'hi' },
      { type: 'usage', usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 5 } },
      { type: 'finish', reason: { kind: 'stop' } },
    ]))
    expect(m.ttftMs).not.toBeNull()
    expect(m.ttftTextMs).not.toBeNull()
    expect(m.ok).toBe(true)
    expect(m.outputTokens).toBe(2)
    expect(m.cacheReadTokens).toBe(5)
    expect(m.e2eMs).not.toBeNull()
  })

  it('marks an error finish as failed', async () => {
    const m = await consumeAndMeasure(chunks([
      { type: 'finish', reason: { kind: 'error', failure: {} } },
    ]))
    expect(m.ok).toBe(false)
    expect(m.errorKind).toBe('error')
  })

  it('treats tool-call delta as first content too', async () => {
    const m = await consumeAndMeasure(chunks([
      { type: 'tool-call-delta', index: 0, id: 't1', argumentsDelta: '{}' },
      { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } },
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ]))
    expect(m.ttftMs).not.toBeNull()
    expect(m.ttftTextMs).toBeNull()
    expect(m.ok).toBe(true)
  })

  it('passes chunks through instrumentStream unchanged', async () => {
    const input: StreamChunk[] = [{ type: 'text-delta', index: 0, text: 'a' }]
    const collected: StreamChunk[] = []
    for await (const c of instrumentStream(chunks(input))) collected.push(c)
    expect(collected).toEqual(input)
  })

  it('propagates a thrown error and records a failure', async () => {
    async function* failing(): AsyncGenerator<StreamChunk> {
      yield { type: 'text-delta', index: 0, text: 'x' }
      throw new Error('boom')
    }
    const gen = instrumentStream(failing())
    await expect((async () => {
      for await (const _c of gen) { /* consume */ }
    })()).rejects.toThrow('boom')
  })
})
