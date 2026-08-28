import { describe, it, expect } from 'vitest'

import { snapshotRequest } from '../src/capture.js'
import type { GenerateOptions } from '../src/types.js'

describe('snapshotRequest', () => {
  it('clones messages and tools into owned plain data', () => {
    const options: GenerateOptions = {
      provider: 'deepseek-official',
      model: 'deepseek-v4',
      system: 'sys',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      tools: [{ name: 'read', parameters: {} }],
    }
    const snap = snapshotRequest(options, 1_000_000)
    expect(snap).not.toBeNull()
    expect(snap!.provider).toBe('deepseek-official')
    expect(snap!.messages).toHaveLength(1)
    expect(snap!.tools).toHaveLength(1)
    // The clone must not share references with the source.
    expect(snap!.messages).not.toBe(options.messages)
  })

  it('returns null when the request exceeds the byte cap', () => {
    const options: GenerateOptions = {
      provider: 'p',
      model: 'm',
      messages: [{ role: 'user', content: 'x'.repeat(10000) }],
    }
    expect(snapshotRequest(options, 100)).toBeNull()
  })
})
