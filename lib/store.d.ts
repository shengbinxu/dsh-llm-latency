/**
 * Best-effort durable persistence of the aggregate store to a JSON file under
 * `$DSH_HOME/llm-latency/stats.json`. Writes are atomic (tmp + rename); any
 * failure leaves the in-memory store intact and measurement keeps running.
 */
import { type RecordOptions, type StatsStore } from './metrics.js';
export declare const DEFAULT_RECORD_OPTIONS: RecordOptions;
export declare function statsDir(): string;
export declare function statsFile(): string;
/**
 * Load the store. v2 stores load as-is (validation only); v1 stores migrate
 * their `recent` rings; anything else returns an empty store.
 */
export declare function loadStore(path: string, opts?: RecordOptions): StatsStore;
/** Atomically write the store; failures are swallowed by design. */
export declare function saveStore(path: string, store: StatsStore): void;
