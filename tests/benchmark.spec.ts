import { describe, it, expect } from 'vitest'

import { runBenchmark, smallPercentile } from '../src/benchmark.js'
import type { LlmService, StreamChunk, GenerateOptions } from '../src/types.js'
import type { RequestSnapshot } from '../src/capture.js'
import type { Sample } from '../src/sample.js'

function fakeLlm(): LlmService {
  return {
    listProviders: () => [],
    listModels: async () => [],
    stream: async function* (options: GenerateOptions): AsyncGenerator<StreamChunk> {
      yield { type: 'text-delta', index: 0, text: `hi ${options.provider}` }
      yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  }
}

describe('runBenchmark', () => {
  it('measures every target and tags the first round as cold', async () => {
    const base: RequestSnapshot = {
      provider: 'a',
      model: 'm',
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      tools: [],
      byteSize: 10,
    }
    const samples: Sample[] = []
    const results = await runBenchmark(
      fakeLlm(),
      base,
      [
        { provider: 'a', model: 'm' },
        { provider: 'b', model: 'm' },
      ],
      { rounds: 2, cacheBust: false, vendorOf: (p) => p },
      (s) => samples.push(s),
    )
    expect(results).toHaveLength(2)
    for (const r of results) {
      expect(r.rounds).toBe(2)
      expect(r.okCount).toBe(2)
      expect(r.ttftP50).not.toBeNull()
    }
    expect(samples).toHaveLength(4)
    expect(samples.filter((s) => s.cold === true)).toHaveLength(2)
  })
})

describe('smallPercentile', () => {
  it('returns the median and null for empty input', () => {
    expect(smallPercentile([1, 2, 3], 0.5)).toBe(2)
    expect(smallPercentile([], 0.5)).toBeNull()
  })
})
