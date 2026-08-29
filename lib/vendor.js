/**
 * Provider attribution: map a provider route id to its real vendor identity
 * (base-URL host) and its credential reference name (the `apiKeyEnv` the route
 * resolves its key through). Provider ids alone are just routes; both facts
 * come from the provider's settings section, with the provider id as fallback.
 */
function hostOf(url) {
    try {
        return new URL(url).host;
    }
    catch {
        return url;
    }
}
function put(out, id, cfg) {
    const baseURL = cfg.baseURL;
    const ref = cfg.apiKeyEnv;
    const facts = out[id] ?? { host: id };
    if (typeof baseURL === 'string' && baseURL.length > 0)
        facts.host = hostOf(baseURL);
    if (typeof ref === 'string' && ref.length > 0)
        facts.credentialRef = ref;
    out[id] = facts;
}
/** Collect provider -> host + credentialRef from one settings value, if it has that shape. */
function collect(value, out) {
    if (value === null || typeof value !== 'object')
        return;
    const root = value;
    const providers = root.providers;
    if (providers !== null && typeof providers === 'object') {
        for (const [id, cfg] of Object.entries(providers)) {
            put(out, id, cfg);
        }
    }
    // Single-route providers (llm-deepseek) put baseURL/apiKeyEnv at the top level.
    if (typeof root.baseURL === 'string' || typeof root.apiKeyEnv === 'string') {
        const id = typeof root.provider === 'string' ? root.provider : 'deepseek';
        put(out, id, root);
    }
}
export function createVendorResolver(ctx) {
    let cache = {};
    function refresh() {
        const result = {};
        const settings = ctx.get('settings');
        if (settings !== undefined) {
            for (const ns of ['llm-pi-ai', 'llm-deepseek', 'llm']) {
                collect(settings.get(ns), result);
            }
        }
        const llm = ctx.get('llm');
        if (llm !== undefined) {
            try {
                for (const p of llm.listProviders()) {
                    if (result[p.id] === undefined)
                        result[p.id] = { host: p.id };
                }
            }
            catch {
                // provider enumeration is best-effort; fall back to provider ids
            }
        }
        return result;
    }
    cache = refresh();
    ctx.on('settings/updated', () => {
        cache = refresh();
    });
    return {
        vendorOf(provider) {
            return cache[provider]?.host ?? provider;
        },
        credentialRefOf(provider) {
            return cache[provider]?.credentialRef;
        },
    };
}
