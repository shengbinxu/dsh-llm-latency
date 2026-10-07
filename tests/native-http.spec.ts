import { describe, expect, it, vi } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../src/index.js'
import type { Context, WebRoute } from '../src/types.js'

/** HTTP entry tests use isolated persistence paths and Node's actual response object. */
describe('native dashboard HTTP and unload', () => {
  it('serves both metric languages and preserves the standalone dashboard', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'latency-native-'))
    const socket = new Socket()
    let route: WebRoute | undefined
    const releases: Array<() => void> = []
    const routeRelease = vi.fn()
    const context: Context = {
      get: () => undefined,
      on: () => () => {},
      effect: callback => {
        const release = callback() || (() => {})
        releases.push(release)
        return release
      },
      tools: { register: () => () => {} },
      webServer: { register: value => { route = value; return routeRelease } },
    }
    const dispose = apply(context, { statsPath: join(directory, 'stats.json'), logPath: join(directory, 'requests.jsonl') })
    try {
      async function request(path: string): Promise<string> {
        const req = new IncomingMessage(socket)
        req.method = 'GET'
        req.url = path
        const res = new ServerResponse(req)
        let body = ''
        vi.spyOn(res, 'end').mockImplementation((value: string | Uint8Array) => {
          body = String(value)
          return res
        })
        await route!.handler(req, res)
        expect(res.statusCode).toBe(200)
        return body
      }
      const zh = JSON.parse(await request('/llm-latency/metrics.json'))
      const en = JSON.parse(await request('/llm-latency/metrics.json?lang=en'))
      expect(zh.items).toHaveLength(16)
      expect(en.items).toHaveLength(16)
      expect(zh.items[0].name).toBe('样本 / 调用')
      expect(en.items[0].name).toBe('Samples / calls')
      expect(en.items[6].explanation).toContain('explicit reasoning count')
      expect(await request('/llm-latency/')).toContain('<title>LLM 观测台</title>')
      releases.forEach(release => release())
      dispose()
      expect(routeRelease).toHaveBeenCalledTimes(1)
    } finally {
      dispose()
      socket.destroy()
      // This exact directory was minted by this test above.
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
