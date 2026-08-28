/**
 * Capture a lossless, owned snapshot of a real request so a benchmark can
 * replay the same long-context workload across vendors. Messages and tools are
 * plain wire JSON (the adapter itself serializes them), so a JSON round-trip
 * clones them into data the plugin owns.
 */
import type { GenerateOptions } from './types.js';
export interface RequestSnapshot {
    provider: string;
    model: string;
    system?: string;
    messages: unknown[];
    tools: unknown[];
    maxTokens?: number;
    reasoningEffort?: string;
    byteSize: number;
}
/**
 * Clone a request into a replayable snapshot, or return null when it is too
 * large or cannot be serialized.
 * @param options - the intercepted request.
 * @param maxBytes - hard JSON size cap for retained snapshots.
 */
export declare function snapshotRequest(options: GenerateOptions, maxBytes: number): RequestSnapshot | null;
