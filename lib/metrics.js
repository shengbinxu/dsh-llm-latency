/**
 * Mergeable latency aggregation: log-ish histograms for percentile queries,
 * calendar-aligned per-hour buckets for arbitrary time-window slices, per-session
 * aggregates for controlled A/B comparisons, and a bounded recent-sample ring.
 * Every structure merges by summing, so a store can be reloaded from disk and
 * folded across processes without loss.
 */
/** Histogram bin edges in milliseconds; values land in [edge, nextEdge). */
export const HIST_EDGES = [
    0, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 8000, 12000, 20000, 30000, 60000, 120000,
];
/** Number of bins = edges + 1 (the last bin holds every value >= the last edge). */
export function emptyHist() {
    return new Array(HIST_EDGES.length + 1).fill(0);
}
/** Index of the bin `valueMs` falls into. */
export function binIndex(valueMs) {
    for (let i = 0; i < HIST_EDGES.length; i += 1) {
        if (valueMs < HIST_EDGES[i])
            return i;
    }
    return HIST_EDGES.length;
}
/** Record one value into a histogram in place. */
export function recordHist(hist, valueMs) {
    const i = binIndex(valueMs);
    hist[i] = hist[i] + 1;
}
/** Merge `src` into `dst` in place. */
export function mergeHist(dst, src) {
    for (let i = 0; i < dst.length; i += 1) {
        dst[i] = dst[i] + (src[i] ?? 0);
    }
}
/** Sum a histogram. */
export function histTotal(hist) {
    let total = 0;
    for (const c of hist)
        total += c;
    return total;
}
/**
 * Approximate the p-th percentile (0..1) in milliseconds from a histogram.
 * Linear interpolation within the containing bin. Returns null for an empty
 * histogram.
 */
export function histPercentile(hist, p) {
    const total = histTotal(hist);
    if (total === 0)
        return null;
    const target = p * total;
    let cumulative = 0;
    for (let i = 0; i < hist.length; i += 1) {
        const count = hist[i];
        if (count === 0)
            continue;
        const next = cumulative + count;
        if (next >= target) {
            const lo = i === 0 ? 0 : HIST_EDGES[i - 1];
            const hi = i < HIST_EDGES.length ? HIST_EDGES[i] : HIST_EDGES[HIST_EDGES.length - 1] * 2;
            const frac = (target - cumulative) / count;
            return lo + frac * (hi - lo);
        }
        cumulative = next;
    }
    // Unreachable when total > 0, but keep the tail defined.
    return HIST_EDGES[HIST_EDGES.length - 1];
}
export function emptyErrorCounts() {
    return { rateLimited: 0, timeout: 0, aborted: 0, server: 0, other: 0 };
}
export function addErrorCounts(dst, kind, count = 1) {
    if (kind === null)
        return;
    dst[kind] = dst[kind] + count;
}
export function mergeErrorCounts(dst, src) {
    for (const k of Object.keys(dst)) {
        dst[k] = dst[k] + (src[k] ?? 0);
    }
}
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
/** Epoch hour of a millisecond timestamp. */
export function epochHour(ts) {
    return Math.floor(ts / HOUR_MS);
}
export function emptyBucket() {
    return {
        ttft: emptyHist(),
        ttftText: emptyHist(),
        e2e: emptyHist(),
        ok: 0,
        fail: 0,
        errors: emptyErrorCounts(),
        inputTokens: 0,
        outputTokens: 0,
        cacheRead: 0,
        cacheWrite: 0,
        decodeMs: 0,
        spikes: 0,
    };
}
export function emptyKeyAgg() {
    return { buckets: {}, recent: [] };
}
export function emptySessionAgg(sample) {
    return {
        vendor: sample.vendor,
        provider: sample.provider,
        model: sample.model,
        models: [sample.model],
        firstTs: sample.ts,
        lastTs: sample.ts,
        calls: 0,
        ok: 0,
        fail: 0,
        errors: emptyErrorCounts(),
        ttft: emptyHist(),
        e2e: emptyHist(),
        firstCallInputTokens: 0,
        firstCallTtftMs: null,
        inputTokens: 0,
        outputTokens: 0,
        cacheRead: 0,
        cacheWrite: 0,
        decodeMs: 0,
        spikes: 0,
    };
}
export function emptyStore(retentionDays = 30) {
    return { version: 2, retentionDays, keys: {}, sessions: {} };
}
/** Stable aggregate key combining the real vendor host and provider/model. */
export function aggKey(vendor, provider, model) {
    return `${vendor}|${provider}|${model}`;
}
/** Cached-input share (0..1) matching the harness native `billedInputTokens` fold. */
export function cacheHitShare(inputTokens, cacheRead, cacheWrite) {
    const billed = inputTokens + cacheRead + cacheWrite;
    if (billed <= 0)
        return null;
    return cacheRead / billed;
}
/** Cached-input write share (0..1): how much of billed input filled the prefix cache. */
export function cacheWriteShare(inputTokens, cacheRead, cacheWrite) {
    const billed = inputTokens + cacheRead + cacheWrite;
    if (billed <= 0)
        return null;
    return cacheWrite / billed;
}
function recordTokens(b, sample) {
    b.inputTokens += sample.inputTokens;
    b.outputTokens += sample.outputTokens;
    b.cacheRead += sample.cacheReadTokens;
    b.cacheWrite += sample.cacheWriteTokens;
    if (sample.ok && sample.e2eMs !== null && sample.ttftMs !== null && sample.e2eMs > sample.ttftMs) {
        b.decodeMs += sample.e2eMs - sample.ttftMs;
    }
}
function recordLatencies(b, sample, spikeFloorMs) {
    if (!sample.ok)
        return;
    if (sample.ttftMs !== null) {
        recordHist(b.ttft, sample.ttftMs);
        if (sample.ttftMs > spikeFloorMs)
            b.spikes += 1;
    }
    if (b.ttftText !== undefined && sample.ttftTextMs !== null)
        recordHist(b.ttftText, sample.ttftTextMs);
    if (sample.e2eMs !== null)
        recordHist(b.e2e, sample.e2eMs);
}
function recordOutcome(b, sample) {
    if (sample.ok) {
        b.ok += 1;
    }
    else {
        b.fail += 1;
        addErrorCounts(b.errors, sample.errorKind);
    }
}
/**
 * Record one sample into a store in place, mutating the hour bucket, the recent
 * ring, and (when the sample carries a session id) the session aggregate.
 */
export function recordSample(store, sample, opts) {
    const now = opts.now ?? Date.now();
    const key = aggKey(sample.vendor, sample.provider, sample.model);
    let agg = store.keys[key];
    if (agg === undefined) {
        agg = emptyKeyAgg();
        store.keys[key] = agg;
    }
    const hour = epochHour(sample.ts);
    if (hour >= epochHour(now - opts.retentionDays * DAY_MS)) {
        let bucket = agg.buckets[String(hour)];
        if (bucket === undefined) {
            bucket = emptyBucket();
            agg.buckets[String(hour)] = bucket;
        }
        recordOutcome(bucket, sample);
        recordLatencies(bucket, sample, opts.spikeFloorMs);
        recordTokens(bucket, sample);
    }
    agg.recent.push(sample);
    if (agg.recent.length > opts.recentLimit)
        agg.recent.splice(0, agg.recent.length - opts.recentLimit);
    pruneKey(agg, now, opts.retentionDays);
    if (sample.sessionId !== undefined) {
        let session = store.sessions[sample.sessionId];
        if (session === undefined) {
            session = emptySessionAgg(sample);
            store.sessions[sample.sessionId] = session;
        }
        if (!session.models.includes(sample.model))
            session.models.push(sample.model);
        session.lastTs = Math.max(session.lastTs, sample.ts);
        if (session.firstCallInputTokens === 0 && session.calls === 0) {
            session.firstCallInputTokens = sample.inputTokens;
            session.firstCallTtftMs = sample.ttftMs;
        }
        session.calls += 1;
        recordOutcome(session, sample);
        recordLatencies(session, sample, opts.spikeFloorMs);
        recordTokens(session, sample);
    }
    pruneSessions(store, now, opts);
}
function pruneKey(agg, now, retentionDays) {
    const cutoff = epochHour(now - retentionDays * DAY_MS);
    for (const h of Object.keys(agg.buckets)) {
        if (Number(h) < cutoff)
            delete agg.buckets[h];
    }
}
function pruneSessions(store, now, opts) {
    const cutoff = now - opts.retentionDays * DAY_MS;
    for (const [id, s] of Object.entries(store.sessions)) {
        if (s.lastTs < cutoff)
            delete store.sessions[id];
    }
    const ids = Object.keys(store.sessions);
    if (ids.length <= opts.sessionLimit)
        return;
    ids.sort((a, b) => (store.sessions[b]?.lastTs ?? 0) - (store.sessions[a]?.lastTs ?? 0));
    for (const id of ids.slice(opts.sessionLimit))
        delete store.sessions[id];
}
export function mergeBucket(dst, src) {
    mergeHist(dst.ttft, src.ttft);
    mergeHist(dst.ttftText, src.ttftText);
    mergeHist(dst.e2e, src.e2e);
    dst.ok += src.ok;
    dst.fail += src.fail;
    mergeErrorCounts(dst.errors, src.errors);
    dst.inputTokens += src.inputTokens;
    dst.outputTokens += src.outputTokens;
    dst.cacheRead += src.cacheRead;
    dst.cacheWrite += src.cacheWrite;
    dst.decodeMs += src.decodeMs;
    dst.spikes += src.spikes;
}
/** Merge `src` into `dst` in place. */
export function mergeStore(dst, src, opts) {
    for (const [key, srcAgg] of Object.entries(src.keys)) {
        let dstAgg = dst.keys[key];
        if (dstAgg === undefined) {
            dstAgg = emptyKeyAgg();
            dst.keys[key] = dstAgg;
        }
        for (const [hour, srcBucket] of Object.entries(srcAgg.buckets)) {
            let dstBucket = dstAgg.buckets[hour];
            if (dstBucket === undefined) {
                dstBucket = emptyBucket();
                dstAgg.buckets[hour] = dstBucket;
            }
            mergeBucket(dstBucket, srcBucket);
        }
        dstAgg.recent.push(...srcAgg.recent);
        if (dstAgg.recent.length > opts.recentLimit)
            dstAgg.recent.splice(0, dstAgg.recent.length - opts.recentLimit);
    }
    for (const [id, srcSession] of Object.entries(src.sessions)) {
        const dstSession = dst.sessions[id];
        if (dstSession === undefined) {
            dst.sessions[id] = structuredCloneSession(srcSession);
        }
        else {
            mergeSession(dstSession, srcSession);
        }
    }
    pruneSessions(dst, opts.now ?? Date.now(), opts);
}
function mergeSession(dst, src) {
    mergeHist(dst.ttft, src.ttft);
    mergeHist(dst.e2e, src.e2e);
    dst.ok += src.ok;
    dst.fail += src.fail;
    mergeErrorCounts(dst.errors, src.errors);
    dst.inputTokens += src.inputTokens;
    dst.outputTokens += src.outputTokens;
    dst.cacheRead += src.cacheRead;
    dst.cacheWrite += src.cacheWrite;
    dst.decodeMs += src.decodeMs;
    dst.spikes += src.spikes;
    dst.calls += src.calls;
    dst.firstTs = Math.min(dst.firstTs, src.firstTs);
    dst.lastTs = Math.max(dst.lastTs, src.lastTs);
    for (const m of src.models)
        if (!dst.models.includes(m))
            dst.models.push(m);
    if (src.firstTs < dst.firstTs || dst.calls === 0) {
        dst.firstCallInputTokens = src.firstCallInputTokens;
        dst.firstCallTtftMs = src.firstCallTtftMs;
    }
}
function structuredCloneSession(s) {
    return {
        ...s,
        models: [...s.models],
        errors: { ...s.errors },
        ttft: [...s.ttft],
        e2e: [...s.e2e],
    };
}
/** Merge all buckets whose hour overlaps [from, to]; the end hour is included. */
export function sliceBuckets(agg, from, to) {
    const out = emptyBucket();
    for (const [hour, bucket] of Object.entries(agg.buckets)) {
        const h = Number(hour);
        const hStart = h * HOUR_MS;
        const hEnd = hStart + HOUR_MS;
        // Include a bucket only when its hour [hStart, hEnd) overlaps [from, to).
        if (hStart < to && hEnd > from)
            mergeBucket(out, bucket);
    }
    return out;
}
function tokensPerSecond(outputTokens, decodeMs) {
    return outputTokens > 0 && decodeMs > 0 ? outputTokens / (decodeMs / 1000) : null;
}
export function summarizeBucket(vendor, provider, model, b) {
    return {
        key: `${vendor}|${provider}|${model}`,
        vendor,
        provider,
        model,
        count: b.ok + b.fail,
        okCount: b.ok,
        failCount: b.fail,
        errors: { ...b.errors },
        ttftP50: histPercentile(b.ttft, 0.5),
        ttftP90: histPercentile(b.ttft, 0.9),
        ttftP95: histPercentile(b.ttft, 0.95),
        ttftP99: histPercentile(b.ttft, 0.99),
        ttftTextP50: histPercentile(b.ttftText, 0.5),
        e2eP50: histPercentile(b.e2e, 0.5),
        e2eP95: histPercentile(b.e2e, 0.95),
        tokensPerSecond: tokensPerSecond(b.outputTokens, b.decodeMs),
        cacheHitPct: cacheHitShare(b.inputTokens, b.cacheRead, b.cacheWrite),
        cacheWritePct: cacheWriteShare(b.inputTokens, b.cacheRead, b.cacheWrite),
        inputTokens: b.inputTokens,
        outputTokens: b.outputTokens,
        spikes: b.spikes,
    };
}
/** Summarize one key over a time window; `[from,to)` defaults to the whole retention window. */
export function summarizeKey(key, agg, from, to) {
    const [vendor, provider, model] = key.split('|');
    return summarizeBucket(vendor, provider, model, sliceBuckets(agg, from, to));
}
/** All key summaries over a window, sorted by first-token p50 ascending. */
export function summarizeStore(store, from, to) {
    return Object.entries(store.keys)
        .map(([key, agg]) => summarizeKey(key, agg, from, to))
        .filter((s) => s.count > 0)
        .sort((a, b) => (a.ttftP50 ?? Infinity) - (b.ttftP50 ?? Infinity));
}
export function summarizeSession(id, s) {
    return {
        id,
        vendor: s.vendor,
        provider: s.provider,
        model: s.model,
        models: [...s.models],
        singleModel: s.models.length === 1,
        firstTs: s.firstTs,
        lastTs: s.lastTs,
        calls: s.calls,
        okCount: s.ok,
        failCount: s.fail,
        errors: { ...s.errors },
        ttftP50: histPercentile(s.ttft, 0.5),
        ttftP95: histPercentile(s.ttft, 0.95),
        e2eP50: histPercentile(s.e2e, 0.5),
        firstCallInputTokens: s.firstCallInputTokens,
        firstCallTtftMs: s.firstCallTtftMs,
        tokensPerSecond: tokensPerSecond(s.outputTokens, s.decodeMs),
        cacheHitPct: cacheHitShare(s.inputTokens, s.cacheRead, s.cacheWrite),
        cacheWritePct: cacheWriteShare(s.inputTokens, s.cacheRead, s.cacheWrite),
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        spikes: s.spikes,
    };
}
export function summarizeSessions(store) {
    return Object.entries(store.sessions)
        .map(([id, s]) => summarizeSession(id, s))
        .sort((a, b) => b.lastTs - a.lastTs);
}
