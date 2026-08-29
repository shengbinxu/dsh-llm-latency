/**
 * dsh-llm-latency host plugin.
 *
 * Intercepts the `llm/stream` waterfall to record per-vendor/per-model/per-session
 * latency (first token, first visible text, end-to-end, tokens/s, cache hit share)
 * and failure classes (429/timeout/5xx/abort), persists aggregates under
 * `$DSH_HOME/llm-latency/stats.json`, and exposes a dashboard + JSON endpoints
 * for overall, time-window, and session comparisons.
 */
import { freshMeasurement, applyChunk, measurementToSample, classifyThrownError } from './measure.js';
import { recordSample, summarizeStore, summarizeSessions, summarizeBucket, emptyBucket, mergeBucket, DAY_MS, } from './metrics.js';
import { loadStore, saveStore, statsFile, DEFAULT_RECORD_OPTIONS } from './store.js';
import { createVendorResolver } from './vendor.js';
import { canonicalModel } from './model.js';
import { compareVendors } from './comparison.js';
import { compareSessions } from './session.js';
import { formatSummaryRows, formatComparisonTable, formatSessionTable } from './report.js';
import { renderDashboardHtml } from './dashboard.js';
import { registerTools } from './tools.js';
import { createRequestLogStore, requestLogPath, appendRequestLog, queryRequestLog, compactRequestLog } from './request-log.js';
export const name = 'llm-latency';
/** Required services: the tool registry and the web-server route table. */
export const inject = ['tools', 'webServer'];
function sendJson(res, code, body) {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
}
/** Parse a comma-separated or repeated query parameter into a string list. */
function listParam(url, name) {
    const all = url.searchParams.getAll(name);
    if (all.length === 0)
        return undefined;
    const out = [];
    for (const v of all) {
        for (const piece of v.split(',')) {
            const t = piece.trim();
            if (t.length > 0)
                out.push(t);
        }
    }
    return out.length > 0 ? out : undefined;
}
export function apply(ctx, config = {}) {
    const recordOptions = {
        recentLimit: config.recentLimit ?? DEFAULT_RECORD_OPTIONS.recentLimit,
        retentionDays: config.retentionDays ?? DEFAULT_RECORD_OPTIONS.retentionDays,
        sessionLimit: config.sessionLimit ?? DEFAULT_RECORD_OPTIONS.sessionLimit,
        spikeFloorMs: config.spikeFloorMs ?? DEFAULT_RECORD_OPTIONS.spikeFloorMs,
    };
    const modelAliases = config.modelAliases ?? {};
    const minSamples = config.minSamplesForComparison ?? 20;
    const path = config.statsPath ?? statsFile();
    let store = loadStore(path, recordOptions);
    const vendor = createVendorResolver(ctx);
    const logStore = createRequestLogStore(config.logPath ?? requestLogPath(), config.logLimit ?? 5000, config.logRetentionDays ?? 7);
    const disposers = [];
    const persist = () => saveStore(path, store);
    function wrapLive(options, next) {
        return (async function* () {
            const startedAt = Date.now();
            const m = freshMeasurement();
            try {
                const source = next();
                for await (const chunk of source) {
                    applyChunk(m, chunk, Date.now() - startedAt);
                    yield chunk;
                }
            }
            catch (error) {
                if (m.errorKind === null) {
                    m.ok = false;
                    m.errorKind = classifyThrownError(error);
                }
                // A thrown error bypasses the finish chunk; capture its facts directly.
                if (error !== null && typeof error === 'object') {
                    const e = error;
                    if (m.failureCode === undefined && typeof e.code === 'string')
                        m.failureCode = e.code;
                    if (m.failureStatus === undefined && typeof e.status === 'number')
                        m.failureStatus = e.status;
                    if (m.failureMessage === undefined && typeof e.message === 'string')
                        m.failureMessage = e.message;
                    if (m.requestId === undefined && typeof e.requestId === 'string')
                        m.requestId = e.requestId;
                }
                throw error;
            }
            finally {
                m.e2eMs = Date.now() - startedAt;
                const sample = measurementToSample(m, {
                    ts: startedAt,
                    vendor: vendor.vendorOf(options.provider),
                    provider: options.provider,
                    model: options.model,
                    ...(typeof options.sessionId === 'string' ? { sessionId: options.sessionId } : {}),
                });
                if (options.purpose !== undefined)
                    sample.purpose = options.purpose;
                const credRef = vendor.credentialRefOf(options.provider);
                if (credRef !== undefined)
                    sample.credentialRef = credRef;
                appendRequestLog(logStore, sample);
                // Auxiliary calls (compaction, session-title) are logged but not aggregated.
                if (options.purpose === undefined) {
                    recordSample(store, sample, recordOptions);
                    persist();
                }
            }
        })();
    }
    disposers.push(ctx.on('llm/stream', (rawOptions, rawNext) => {
        const options = rawOptions;
        const next = rawNext;
        return wrapLive(options, next);
    }));
    function parseWindow(url) {
        const toRaw = url.searchParams.get('to');
        const fromRaw = url.searchParams.get('from');
        const to = toRaw !== null ? Number(toRaw) : Date.now();
        const from = fromRaw !== null ? Number(fromRaw) : to - recordOptions.retentionDays * DAY_MS;
        return { from: Number.isFinite(from) ? from : 0, to: Number.isFinite(to) ? to : Date.now() };
    }
    function listModels() {
        const map = new Map();
        for (const key of Object.keys(store.keys)) {
            const [v, , model] = key.split('|');
            const c = canonicalModel(model, modelAliases);
            let set = map.get(c);
            if (set === undefined) {
                set = new Set();
                map.set(c, set);
            }
            set.add(v);
        }
        return [...map.entries()]
            .map(([model, vendors]) => ({ model, vendors: [...vendors].sort() }))
            .sort((a, b) => a.model.localeCompare(b.model));
    }
    function timeseries(canonical, vendors, from, to) {
        const per = new Map();
        for (const [key, agg] of Object.entries(store.keys)) {
            const [v, , model] = key.split('|');
            if (canonicalModel(model, modelAliases) !== canonical)
                continue;
            if (vendors !== undefined && !vendors.includes(v))
                continue;
            for (const [hourStr, bucket] of Object.entries(agg.buckets)) {
                const h = Number(hourStr);
                const hStart = h * 3_600_000;
                if (hStart >= to || hStart + 3_600_000 <= from)
                    continue;
                const k = `${v}|${h}`;
                let b = per.get(k);
                if (b === undefined) {
                    b = emptyBucket();
                    per.set(k, b);
                }
                mergeBucket(b, bucket);
            }
        }
        const series = [...per.entries()].map(([k, b]) => {
            const [v, hourStr] = k.split('|');
            const s = summarizeBucket(v, '*', canonical, b);
            return { hour: Number(hourStr), vendor: v, ttftP50: s.ttftP50, cacheHitPct: s.cacheHitPct };
        });
        series.sort((a, b) => a.hour - b.hour || a.vendor.localeCompare(b.vendor));
        return { series };
    }
    async function runReport(args) {
        if (args.sessionIds !== undefined && args.sessionIds.length > 0) {
            const result = compareSessions(store, args.sessionIds, modelAliases);
            return formatSessionTable(result);
        }
        const { from, to } = {
            from: typeof args.from === 'number' && Number.isFinite(args.from) ? args.from : Date.now() - recordOptions.retentionDays * DAY_MS,
            to: typeof args.to === 'number' && Number.isFinite(args.to) ? args.to : Date.now(),
        };
        if (args.model !== undefined) {
            const result = compareVendors(store, args.model, modelAliases, from, to, args.vendors, { minSamples });
            return formatComparisonTable(result);
        }
        const rows = summarizeStore(store, from, to)
            .filter((s) => args.vendors === undefined || args.vendors.includes(s.vendor));
        return '以下为按厂商/模型的延迟对比：\n\n' + formatSummaryRows(rows);
    }
    disposers.push(registerTools(ctx, { runReport }));
    disposers.push(ctx.webServer.register({
        kind: 'prefix',
        path: '/llm-latency',
        handler: async (req, res) => {
            const url = new URL(req.url ?? '/', 'http://localhost');
            const pathname = url.pathname;
            if (req.method === 'GET' && (pathname === '/llm-latency' || pathname === '/llm-latency/')) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Cache-Control', 'no-store');
                res.end(renderDashboardHtml());
                return;
            }
            if (req.method === 'GET' && pathname === '/llm-latency/stats.json') {
                const { from, to } = parseWindow(url);
                const model = url.searchParams.get('model') ?? undefined;
                const vendors = listParam(url, 'vendors');
                let rows = summarizeStore(store, from, to);
                if (model !== undefined)
                    rows = rows.filter((s) => canonicalModel(s.model, modelAliases) === model);
                if (vendors !== undefined)
                    rows = rows.filter((s) => vendors.includes(s.vendor));
                sendJson(res, 200, { summaries: rows });
                return;
            }
            if (req.method === 'GET' && pathname === '/llm-latency/comparison.json') {
                const { from, to } = parseWindow(url);
                const model = url.searchParams.get('model');
                if (model === null) {
                    sendJson(res, 400, { error: 'missing model' });
                    return;
                }
                const vendors = listParam(url, 'vendors');
                sendJson(res, 200, compareVendors(store, model, modelAliases, from, to, vendors, { minSamples }));
                return;
            }
            if (req.method === 'GET' && pathname === '/llm-latency/sessions.json') {
                const model = url.searchParams.get('model') ?? undefined;
                const vendors = listParam(url, 'vendors');
                let sessions = summarizeSessions(store);
                if (model !== undefined)
                    sessions = sessions.filter((s) => canonicalModel(s.model, modelAliases) === model);
                if (vendors !== undefined)
                    sessions = sessions.filter((s) => vendors.includes(s.vendor));
                sendJson(res, 200, { sessions: sessions.map((s) => ({ ...s, canonical: canonicalModel(s.model, modelAliases) })) });
                return;
            }
            if (req.method === 'GET' && pathname === '/llm-latency/sessions-compare.json') {
                const ids = listParam(url, 'ids');
                if (ids === undefined || ids.length === 0) {
                    sendJson(res, 400, { error: 'missing ids' });
                    return;
                }
                sendJson(res, 200, compareSessions(store, ids, modelAliases));
                return;
            }
            if (req.method === 'GET' && pathname === '/llm-latency/models.json') {
                sendJson(res, 200, { models: listModels() });
                return;
            }
            if (req.method === 'GET' && pathname === '/llm-latency/timeseries.json') {
                const { from, to } = parseWindow(url);
                const model = url.searchParams.get('model');
                if (model === null) {
                    sendJson(res, 400, { error: 'missing model' });
                    return;
                }
                sendJson(res, 200, timeseries(model, listParam(url, 'vendors'), from, to));
                return;
            }
            if (req.method === 'GET' && pathname === '/llm-latency/log.json') {
                const from = url.searchParams.get('from');
                const to = url.searchParams.get('to');
                const limit = Math.min(500, Number(url.searchParams.get('limit')) || 100);
                const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
                const result = queryRequestLog(logStore, {
                    q: url.searchParams.get('q') ?? undefined,
                    vendor: url.searchParams.get('vendor') ?? undefined,
                    model: url.searchParams.get('model') ?? undefined,
                    status: url.searchParams.get('status') ?? undefined,
                    from: from !== null ? Number(from) : undefined,
                    to: to !== null ? Number(to) : undefined,
                }, limit, offset);
                sendJson(res, 200, result);
                return;
            }
            sendJson(res, 404, { error: 'not found' });
        },
    }));
    return () => {
        compactRequestLog(logStore);
        for (const dispose of [...disposers].reverse()) {
            try {
                dispose();
            }
            catch {
                // best-effort disposal
            }
        }
    };
}
