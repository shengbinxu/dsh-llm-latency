/**
 * Append-only request log: every measured model call is persisted as one JSON
 * line under `$DSH_HOME/llm-latency/requests.jsonl`. An in-memory mirror (capped
 * by count and retention) backs search/filter; the file is compacted to the
 * mirror periodically. All IO is best-effort — logging never breaks a request.
 */
import type { Sample } from './sample.js';
export interface RequestLogFilter {
    /** Free text matched against requestId / vendor / provider / model / sessionId / credentialRef. */
    q?: string;
    vendor?: string;
    model?: string;
    /** 'ok' | 'fail' | an ErrorKind. */
    status?: string;
    from?: number;
    to?: number;
}
export interface RequestLogStore {
    records: Sample[];
    path: string;
    limit: number;
    retentionDays: number;
    appends: number;
}
export declare function requestLogPath(): string;
export declare function createRequestLogStore(path: string, limit: number, retentionDays: number): RequestLogStore;
/** Load the tail of the log into an in-memory mirror, dropping expired records. */
export declare function loadRequestLog(path: string, limit: number, retentionDays: number): Sample[];
/** Append one record (memory + file) and compact the file every `limit` appends. */
export declare function appendRequestLog(store: RequestLogStore, sample: Sample): void;
/** Rewrite the file to the in-memory mirror, dropping expired records. */
export declare function compactRequestLog(store: RequestLogStore): void;
/** Filter the mirror, newest first, with offset/limit pagination. */
export declare function queryRequestLog(store: RequestLogStore, filter: RequestLogFilter, limit: number, offset: number): {
    records: Sample[];
    total: number;
};
