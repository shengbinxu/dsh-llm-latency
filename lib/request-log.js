/**
 * Append-only request log: every measured model call is persisted as one JSON
 * line under `$DSH_HOME/llm-latency/requests.jsonl`. An in-memory mirror (capped
 * by count and retention) backs search/filter; the file is compacted to the
 * mirror periodically. All IO is best-effort — logging never breaks a request.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { env } from 'node:process';
import { join, dirname } from 'node:path';
import { DAY_MS } from './metrics.js';
export function requestLogPath() {
    const home = env.DSH_HOME ?? join(homedir(), '.dsh');
    return join(home, 'llm-latency', 'requests.jsonl');
}
export function createRequestLogStore(path, limit, retentionDays) {
    return {
        records: loadRequestLog(path, limit, retentionDays),
        path,
        limit,
        retentionDays,
        appends: 0,
    };
}
/** Load the tail of the log into an in-memory mirror, dropping expired records. */
export function loadRequestLog(path, limit, retentionDays) {
    try {
        if (!existsSync(path))
            return [];
        const cutoff = Date.now() - retentionDays * DAY_MS;
        const out = [];
        for (const line of readFileSync(path, 'utf8').split('\n')) {
            if (line.length === 0)
                continue;
            try {
                const s = JSON.parse(line);
                if (s.ts >= cutoff)
                    out.push(s);
            }
            catch {
                // skip malformed lines
            }
        }
        if (out.length > limit)
            out.splice(0, out.length - limit);
        return out;
    }
    catch {
        return [];
    }
}
/** Append one record (memory + file) and compact the file every `limit` appends. */
export function appendRequestLog(store, sample) {
    store.records.push(sample);
    if (store.records.length > store.limit)
        store.records.splice(0, store.records.length - store.limit);
    try {
        mkdirSync(dirname(store.path), { recursive: true });
        appendFileSync(store.path, JSON.stringify(sample) + '\n', 'utf8');
    }
    catch {
        // best-effort persistence
    }
    store.appends += 1;
    if (store.appends >= store.limit) {
        store.appends = 0;
        compactRequestLog(store);
    }
}
/** Rewrite the file to the in-memory mirror, dropping expired records. */
export function compactRequestLog(store) {
    try {
        const cutoff = Date.now() - store.retentionDays * DAY_MS;
        const keep = store.records.filter((s) => s.ts >= cutoff);
        const body = keep.map((s) => JSON.stringify(s)).join('\n') + (keep.length > 0 ? '\n' : '');
        const tmp = `${store.path}.tmp`;
        writeFileSync(tmp, body, 'utf8');
        renameSync(tmp, store.path);
    }
    catch {
        // best-effort compaction
    }
}
/** Filter the mirror, newest first, with offset/limit pagination. */
export function queryRequestLog(store, filter, limit, offset) {
    const q = filter.q?.trim().toLowerCase();
    const filtered = store.records.filter((s) => {
        if (filter.vendor !== undefined && s.vendor !== filter.vendor)
            return false;
        if (filter.model !== undefined && s.model !== filter.model)
            return false;
        if (filter.from !== undefined && s.ts < filter.from)
            return false;
        if (filter.to !== undefined && s.ts > filter.to)
            return false;
        if (filter.status !== undefined) {
            if (filter.status === 'ok') {
                if (!s.ok)
                    return false;
            }
            else if (filter.status === 'fail') {
                if (s.ok)
                    return false;
            }
            else if (s.errorKind !== filter.status) {
                return false;
            }
        }
        if (q !== undefined) {
            const hay = [s.requestId, s.vendor, s.provider, s.model, s.sessionId, s.credentialRef, s.failureCode]
                .filter((x) => typeof x === 'string')
                .join(' ')
                .toLowerCase();
            if (!hay.includes(q))
                return false;
        }
        return true;
    });
    const total = filtered.length;
    const sorted = filtered.slice().sort((a, b) => b.ts - a.ts);
    return { records: sorted.slice(offset, offset + limit), total };
}
