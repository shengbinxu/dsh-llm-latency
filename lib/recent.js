import { median } from './comparison.js';
/**
 * Summarize recorded primary calls started within [from, to].
 * Idle vendor/model pairs remain visible with null current metrics and their last sampling time.
 * Ring limits can reduce the retained sample count; auxiliary calls never enter these rings.
 */
export function recentLatency(store, from, to) {
    const groups = new Map();
    for (const [key, aggregate] of Object.entries(store.keys)) {
        const [vendor, , model] = key.split('|');
        const identity = JSON.stringify([vendor, model]);
        const group = groups.get(identity) ?? { vendor: vendor, model: model, samples: [] };
        group.samples.push(...aggregate.recent);
        groups.set(identity, group);
    }
    return [...groups.values()].map(group => {
        const history = group.samples.filter(sample => sample.ts <= to).sort((a, b) => b.ts - a.ts);
        const current = history.filter(sample => sample.ts >= from);
        const successes = current.filter(sample => sample.ok);
        return {
            vendor: group.vendor,
            model: group.model,
            count: current.length,
            okCount: successes.length,
            failCount: current.length - successes.length,
            medianTtftMs: median(successes.flatMap(sample => sample.ttftMs === null ? [] : [sample.ttftMs])),
            medianFirstTextMs: median(successes.flatMap(sample => sample.ttftTextMs === null ? [] : [sample.ttftTextMs])),
            lastSeen: history[0]?.ts ?? null,
            latest: current[0] ?? null,
        };
    }).sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0) || a.vendor.localeCompare(b.vendor));
}
