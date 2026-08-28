/**
 * Mergeable latency aggregation: log-ish histograms for percentile queries,
 * per-hour buckets for time-of-day spikes, and a bounded recent-sample ring.
 * Every structure merges by summing, so a store can be reloaded from disk and
 * folded across processes without loss.
 */
/** Histogram bin edges in milliseconds; values land in [edge, nextEdge). */
export const HIST_EDGES = [0, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];
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
/** 24 per-hour buckets of [count, ttftSumMs, ttftMaxMs, e2eSumMs]. */
export function emptyHours() {
    return Array.from({ length: 24 }, () => [0, 0, 0, 0]);
}
export function emptyKeyAgg() {
    return {
        count: 0,
        okCount: 0,
        failCount: 0,
        ttft: emptyHist(),
        ttftText: emptyHist(),
        e2e: emptyHist(),
        inputTokens: 0,
        outputTokens: 0,
        cacheRead: 0,
        cacheWrite: 0,
        hours: emptyHours(),
        spikes: 0,
        recent: [],
    };
}
export function emptyStore() {
    return { version: 1, keys: {} };
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
/** A spike is a first-token delay above `spikePct` of the key's median, or `spikeFloorMs`, whichever is higher. */
export const SPIKE_PCT = 3;
export const SPIKE_FLOOR_MS = 10000;
/**
 * Record one sample into a store in place, mutating the aggregate under its key.
 * `recentLimit` bounds the retained per-key sample ring.
 */
export function recordSample(store, sample, recentLimit = 200) {
    const key = aggKey(sample.vendor, sample.provider, sample.model);
    let agg = store.keys[key];
    if (agg === undefined) {
        agg = emptyKeyAgg();
        store.keys[key] = agg;
    }
    agg.count += 1;
    if (sample.ok) {
        agg.okCount += 1;
        if (sample.ttftMs !== null && sample.ttftMs !== undefined)
            recordHist(agg.ttft, sample.ttftMs);
        if (sample.ttftTextMs !== null && sample.ttftTextMs !== undefined)
            recordHist(agg.ttftText, sample.ttftTextMs);
        if (sample.e2eMs !== null && sample.e2eMs !== undefined)
            recordHist(agg.e2e, sample.e2eMs);
    }
    else {
        agg.failCount += 1;
    }
    agg.inputTokens += sample.inputTokens;
    agg.outputTokens += sample.outputTokens;
    agg.cacheRead += sample.cacheReadTokens;
    agg.cacheWrite += sample.cacheWriteTokens;
    const hour = new Date(sample.ts).getHours();
    const bucket = agg.hours[hour];
    bucket[0] = bucket[0] + 1;
    if (sample.ttftMs !== null && sample.ttftMs !== undefined) {
        bucket[1] = bucket[1] + sample.ttftMs;
        if (sample.ttftMs > bucket[2])
            bucket[2] = sample.ttftMs;
    }
    if (sample.e2eMs !== null && sample.e2eMs !== undefined)
        bucket[3] = bucket[3] + sample.e2eMs;
    // Spike detection uses the current median so far; a cold start falls back to the floor.
    if (sample.ok && sample.ttftMs !== null && sample.ttftMs !== undefined) {
        const median = histPercentile(agg.ttft, 0.5);
        const threshold = median === null ? SPIKE_FLOOR_MS : Math.max(SPIKE_FLOOR_MS, SPIKE_PCT * median);
        if (sample.ttftMs > threshold)
            agg.spikes += 1;
    }
    agg.recent.push(sample);
    if (agg.recent.length > recentLimit)
        agg.recent.splice(0, agg.recent.length - recentLimit);
}
/** Merge `src` into `dst` in place. */
export function mergeStore(dst, src, recentLimit = 200) {
    for (const [key, srcAgg] of Object.entries(src.keys)) {
        let dstAgg = dst.keys[key];
        if (dstAgg === undefined) {
            dstAgg = emptyKeyAgg();
            dst.keys[key] = dstAgg;
        }
        dstAgg.count += srcAgg.count;
        dstAgg.okCount += srcAgg.okCount;
        dstAgg.failCount += srcAgg.failCount;
        mergeHist(dstAgg.ttft, srcAgg.ttft);
        mergeHist(dstAgg.ttftText, srcAgg.ttftText);
        mergeHist(dstAgg.e2e, srcAgg.e2e);
        dstAgg.inputTokens += srcAgg.inputTokens;
        dstAgg.outputTokens += srcAgg.outputTokens;
        dstAgg.cacheRead += srcAgg.cacheRead;
        dstAgg.cacheWrite += srcAgg.cacheWrite;
        dstAgg.spikes += srcAgg.spikes;
        for (let h = 0; h < 24; h += 1) {
            const d = dstAgg.hours[h];
            const s = srcAgg.hours[h];
            d[0] = d[0] + s[0];
            d[1] = d[1] + s[1];
            if (s[2] > d[2])
                d[2] = s[2];
            d[3] = d[3] + s[3];
        }
        dstAgg.recent.push(...srcAgg.recent);
        if (dstAgg.recent.length > recentLimit)
            dstAgg.recent.splice(0, dstAgg.recent.length - recentLimit);
    }
}
export function summarizeKey(key, agg) {
    const [vendor, provider, model] = key.split('|');
    const decodeMs = decodeTotalMs(agg);
    const tokensPerSecond = agg.outputTokens > 0 && decodeMs > 0 ? (agg.outputTokens / (decodeMs / 1000)) : null;
    let peakHour = null;
    let peakMean = -1;
    for (let h = 0; h < 24; h += 1) {
        const bucket = agg.hours[h];
        const count = bucket[0];
        if (count === 0)
            continue;
        const mean = bucket[1] / count;
        if (mean > peakMean) {
            peakMean = mean;
            peakHour = h;
        }
    }
    return {
        key,
        vendor,
        provider,
        model,
        count: agg.count,
        okCount: agg.okCount,
        failCount: agg.failCount,
        ttftP50: histPercentile(agg.ttft, 0.5),
        ttftP95: histPercentile(agg.ttft, 0.95),
        ttftTextP50: histPercentile(agg.ttftText, 0.5),
        e2eP50: histPercentile(agg.e2e, 0.5),
        e2eP95: histPercentile(agg.e2e, 0.95),
        tokensPerSecond,
        cacheHitPct: cacheHitShare(agg.inputTokens, agg.cacheRead, agg.cacheWrite),
        inputTokens: agg.inputTokens,
        outputTokens: agg.outputTokens,
        spikes: agg.spikes,
        peakHour,
    };
}
/**
 * Sum of decode wall time across samples, approximated from per-sample
 * (e2e - ttft) for samples carrying both. Used to derive tokens/second.
 */
function decodeTotalMs(agg) {
    let ms = 0;
    for (const s of agg.recent) {
        if (s.e2eMs !== null && s.ttftMs !== null && s.e2eMs > s.ttftMs)
            ms += s.e2eMs - s.ttftMs;
    }
    return ms;
}
/** All key summaries, sorted by first-token p50 ascending. */
export function summarizeStore(store) {
    return Object.entries(store.keys)
        .map(([key, agg]) => summarizeKey(key, agg))
        .sort((a, b) => (a.ttftP50 ?? Infinity) - (b.ttftP50 ?? Infinity));
}
