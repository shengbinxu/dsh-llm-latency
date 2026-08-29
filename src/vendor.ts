/**
 * Provider attribution: map a provider route id to its real vendor identity
 * (base-URL host) and its credential reference name (the `apiKeyEnv` the route
 * resolves its key through). Provider ids alone are just routes; both facts
 * come from the provider's settings section, with the provider id as fallback.
 */

import type { Context } from './types.js'

export interface VendorResolver {
  /** Resolve the display vendor for one provider route. */
  vendorOf(provider: string): string
  /** Resolve the credential reference name for one provider route, when configured. */
  credentialRefOf(provider: string): string | undefined
}

interface RouteFacts {
  host: string
  credentialRef?: string
}

interface ProviderConfig {
  baseURL?: unknown
  apiKeyEnv?: unknown
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function put(out: Record<string, RouteFacts>, id: string, cfg: ProviderConfig): void {
  const baseURL = cfg.baseURL
  const ref = cfg.apiKeyEnv
  const facts = out[id] ?? { host: id }
  if (typeof baseURL === 'string' && baseURL.length > 0) facts.host = hostOf(baseURL)
  if (typeof ref === 'string' && ref.length > 0) facts.credentialRef = ref
  out[id] = facts
}

/** Collect provider -> host + credentialRef from one settings value, if it has that shape. */
function collect(value: unknown, out: Record<string, RouteFacts>): void {
  if (value === null || typeof value !== 'object') return
  const root = value as Record<string, unknown>
  const providers = root.providers
  if (providers !== null && typeof providers === 'object') {
    for (const [id, cfg] of Object.entries(providers as Record<string, unknown>)) {
      put(out, id, cfg as ProviderConfig)
    }
  }
  // Single-route providers (llm-deepseek) put baseURL/apiKeyEnv at the top level.
  if (typeof root.baseURL === 'string' || typeof root.apiKeyEnv === 'string') {
    const id = typeof root.provider === 'string' ? root.provider : 'deepseek'
    put(out, id, root as ProviderConfig)
  }
}

export function createVendorResolver(ctx: Context): VendorResolver {
  let cache: Record<string, RouteFacts> = {}

  function refresh(): Record<string, RouteFacts> {
    const result: Record<string, RouteFacts> = {}
    const settings = ctx.get('settings') as { get(ns: string): unknown } | undefined
    if (settings !== undefined) {
      for (const ns of ['llm-pi-ai', 'llm-deepseek', 'llm']) {
        collect(settings.get(ns), result)
      }
    }
    const llm = ctx.get('llm') as { listProviders(): readonly { id: string; name: string }[] } | undefined
    if (llm !== undefined) {
      try {
        for (const p of llm.listProviders()) {
          if (result[p.id] === undefined) result[p.id] = { host: p.id }
        }
      } catch {
        // provider enumeration is best-effort; fall back to provider ids
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
      return cache[provider]?.host ?? provider
    },
    credentialRefOf(provider) {
      return cache[provider]?.credentialRef
    },
  }
}
