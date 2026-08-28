/**
 * Vendor attribution: map a provider route id to a real vendor identity.
 * Provider ids alone are just routes; the vendor is the base URL host when the
 * provider is configured with one (e.g. Alibaba Bailian `dashscope.aliyuncs.com`
 * vs DeepSeek official `api.deepseek.com`). Falls back to the provider id.
 */

import type { Context } from './types.js'

export interface VendorResolver {
  /** Resolve the display vendor for one provider route. */
  vendorOf(provider: string): string
  /** Snapshot of provider route -> vendor host. */
  providers(): Record<string, string>
}

interface ProviderConfig {
  baseURL?: unknown
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Collect provider -> baseURL host from one settings value, if it has that shape. */
function collect(value: unknown, out: Record<string, string>): void {
  if (value === null || typeof value !== 'object') return
  const root = value as Record<string, unknown>
  const providers = root.providers
  if (providers !== null && typeof providers === 'object') {
    for (const [id, cfg] of Object.entries(providers as Record<string, unknown>)) {
      const baseURL = (cfg as ProviderConfig | undefined)?.baseURL
      if (typeof baseURL === 'string' && baseURL.length > 0) out[id] = hostOf(baseURL)
    }
  }
  const baseURL = root.baseURL
  if (typeof baseURL === 'string' && baseURL.length > 0) {
    const id = typeof root.provider === 'string' ? root.provider : 'deepseek'
    out[id] = hostOf(baseURL)
  }
}

export function createVendorResolver(ctx: Context): VendorResolver {
  let cache: Record<string, string> = {}

  function refresh(): Record<string, string> {
    const result: Record<string, string> = {}
    const settings = ctx.get('settings') as { get(ns: string): unknown } | undefined
    if (settings !== undefined) {
      for (const ns of ['llm-pi-ai', 'llm-deepseek', 'llm']) {
        collect(settings.get(ns), result)
      }
    }
    const llm = ctx.get('llm') as { listProviders(): readonly { id: string; name: string }[] } | undefined
    if (llm !== undefined) {
      for (const p of llm.listProviders()) {
        if (result[p.id] === undefined) result[p.id] = p.id
      }
    }
    return result
  }

  cache = refresh()
  ctx.on('settings/updated', () => {
    cache = refresh()
  })

  return {
    vendorOf(provider) {
      return cache[provider] ?? provider
    },
    providers() {
      return { ...cache }
    },
  }
}
