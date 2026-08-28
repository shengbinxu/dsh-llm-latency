/**
 * dsh-llm-latency host plugin.
 *
 * Intercepts the `llm/stream` waterfall to record per-vendor/per-model latency
 * (first token, first visible text, end-to-end, tokens/s, cache hit share),
 * persists aggregates under `$DSH_HOME/llm-latency/stats.json`, exposes a
 * dashboard and JSON endpoints, and can replay the most recent real request
 * across vendors for an anti-cache A/B benchmark.
 */
import { freshMeasurement, applyChunk, measurementToSample } from './measure.js';
import { recordSample, summarizeStore } from './metrics.js';
import { loadStore, saveStore, statsFile } from './store.js';
import { createVendorResolver } from './vendor.js';
import { snapshotRequest } from './capture.js';
import { benchmarkOptions, runBenchmark } from './benchmark.js';
import { formatSummaryTable, formatBenchmarkTable } from './report.js';
import { renderDashboardHtml } from './dashboard.js';
import { registerTools } from './tools.js';
export const name = 'llm-latency';
function sendJson(res, code, body) {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}
export function apply(ctx, config = {}) {
    const snapshotLimit = config.snapshotLimit ?? 8;
    const snapshotMaxBytes = config.snapshotMaxBytes ?? 4_000_000;
    const benchmarkRounds = config.benchmarkRounds ?? 3;
    const cacheBust = config.cacheBust ?? false;
    const path = config.statsPath ?? statsFile();
    let store = loadStore(path);
    const vendor = createVendorResolver(ctx);
    const snapshots = [];
    const disposers = [];
    const persist = () => saveStore(path, store);
    function captureSnapshot(options) {
        const snap = snapshotRequest(options, snapshotMaxBytes);
        if (snap === null)
            return;
        const last = snapshots[snapshots.length - 1];
        // Cheap de-dupe: same byte size almost always means the same repeated context.
        if (last !== undefined && last.byteSize === snap.byteSize)
            return;
        snapshots.push(snap);
        if (snapshots.length > snapshotLimit)
            snapshots.shift();
    }
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
                    m.errorKind = 'error';
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
                    source: 'live',
                });
                recordSample(store, sample);
                persist();
            }
        })();
    }
    disposers.push(ctx.on('llm/stream', (rawOptions, rawNext) => {
        const options = rawOptions;
        const next = rawNext;
        // Benchmark-owned options are measured by the benchmark itself.
        if (benchmarkOptions.has(options))
            return next();
        // Auxiliary calls (compaction, session-title) are not user-facing latency.
        if (options.purpose !== undefined)
            return next();
        captureSnapshot(options);
        return wrapLive(options, next);
    }));
    async function listTargets() {
        const llm = ctx.get('llm');
        const targets = [];
        const seen = new Set();
        const latest = snapshots[snapshots.length - 1];
        if (latest !== undefined) {
            targets.push({ provider: latest.provider, model: latest.model, name: latest.model, vendor: vendor.vendorOf(latest.provider) });
            seen.add(`${latest.provider}|${latest.model}`);
        }
        if (llm === undefined)
            return targets;
        for (const p of llm.listProviders()) {
            try {
                const models = await llm.listModels(p.id);
                for (const m of models) {
                    const key = `${p.id}|${m.id}`;
                    if (seen.has(key))
                        continue;
                    seen.add(key);
                    targets.push({ provider: p.id, model: m.id, name: m.name, vendor: vendor.vendorOf(p.id) });
                }
            }
            catch {
                // model discovery unavailable for this provider; skip
            }
        }
        return targets;
    }
    const reportText = () => '以下为按厂商/模型的延迟对比：\n\n' + formatSummaryTable(store);
    async function benchmarkText(args) {
        const llm = ctx.get('llm');
        const latest = snapshots[snapshots.length - 1];
        if (llm === undefined)
            return '未找到 llm 服务，无法对拍。';
        if (latest === undefined)
            return '暂无真实请求快照可供对拍。请先发起一次请求。';
        let targets = await listTargets();
        if (args.providers !== undefined && args.providers.length > 0) {
            targets = targets.filter((t) => args.providers?.includes(t.provider) ?? false);
        }
        if (targets.length < 2)
            return '可对拍的目标路由不足两个。';
        const results = await runBenchmark(llm, latest, targets.map((t) => ({ provider: t.provider, model: t.model })), { rounds: args.rounds ?? benchmarkRounds, cacheBust: args.cacheBust ?? cacheBust, vendorOf: (p) => vendor.vendorOf(p) }, (sample) => { recordSample(store, sample); persist(); });
        return '对拍完成（复用最新真实长上下文）。\n\n' + formatBenchmarkTable(results);
    }
    disposers.push(registerTools(ctx, { reportText, benchmarkText }));
    const webServer = ctx.get('webServer');
    if (webServer !== undefined) {
        disposers.push(webServer.register({
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
                    sendJson(res, 200, { summaries: summarizeStore(store) });
                    return;
                }
                if (req.method === 'GET' && pathname === '/llm-latency/targets.json') {
                    sendJson(res, 200, { targets: await listTargets() });
                    return;
                }
                if (req.method === 'POST' && pathname === '/llm-latency/benchmark') {
                    const llm = ctx.get('llm');
                    const latest = snapshots[snapshots.length - 1];
                    if (llm === undefined || latest === undefined) {
                        sendJson(res, 400, { error: 'no llm service or no snapshot available yet' });
                        return;
                    }
                    let body;
                    try {
                        body = JSON.parse(await readBody(req));
                    }
                    catch {
                        sendJson(res, 400, { error: 'invalid JSON body' });
                        return;
                    }
                    const targets = (body.targets ?? []).filter((t) => t !== null && typeof t === 'object' && typeof t.provider === 'string' && typeof t.model === 'string');
                    if (targets.length < 2) {
                        sendJson(res, 400, { error: 'need at least two targets' });
                        return;
                    }
                    const results = await runBenchmark(llm, latest, targets, {
                        rounds: Math.max(1, Math.min(10, body.rounds ?? benchmarkRounds)),
                        cacheBust: body.cacheBust ?? cacheBust,
                        vendorOf: (p) => vendor.vendorOf(p),
                    }, (sample) => { recordSample(store, sample); persist(); });
                    sendJson(res, 200, { results });
                    return;
                }
                sendJson(res, 404, { error: 'not found' });
            },
        }));
    }
    return () => {
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
