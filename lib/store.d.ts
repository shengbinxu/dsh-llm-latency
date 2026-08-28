/**
 * Best-effort durable persistence of the aggregate store to a JSON file under
 * `$DSH_HOME/llm-latency/stats.json`. Writes are atomic (tmp + rename); any
 * failure leaves the in-memory store intact and measurement keeps running.
 */
import { type StatsStore } from './metrics.js';
export declare function statsDir(): string;
export declare function statsFile(): string;
/** Load the store, returning an empty store on any parse/IO failure. */
export declare function loadStore(path: string): StatsStore;
/** Atomically write the store; failures are swallowed by design. */
export declare function saveStore(path: string, store: StatsStore): void;
