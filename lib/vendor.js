/**
 * Vendor attribution: map a provider route id to a real vendor identity.
 * Provider ids alone are just routes; the vendor is the base URL host when the
 * provider is configured with one (e.g. Alibaba Bailian `dashscope.aliyuncs.com`
 * vs DeepSeek official `api.deepseek.com`). Falls back to the provider id.
 */
function hostOf(url) {
    try {
        return new URL(url).host;
    }
    catch {
        return url;
    }
}
/** Collect provider -> baseURL host from one settings value, if it has that shape. */
function collect(value, out) {
    if (value === null || typeof value !== 'object')
        return;
    const root = value;
    const providers = root.providers;
    if (providers !== null && typeof providers === 'object') {
        for (const [id, cfg] of Object.entries(providers)) {
            const baseURL = cfg?.baseURL;
            if (typeof baseURL === 'string' && baseURL.length > 0)
                out[id] = hostOf(baseURL);
        }
    }
    const baseURL = root.baseURL;
    if (typeof baseURL === 'string' && baseURL.length > 0) {
        const id = typeof root.provider === 'string' ? root.provider : 'deepseek';
        out[id] = hostOf(baseURL);
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
                        result[p.id] = p.id;
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
            return cache[provider] ?? provider;
        },
        providers() {
            return { ...cache };
        },
    };
}
