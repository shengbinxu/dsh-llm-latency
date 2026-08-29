/**
 * Streaming measurement: wraps an AsyncIterable<StreamChunk>, capturing
 * first-token / first-text / end-to-end latency and token usage as chunks flow.
 *
 * Timing starts on the first pull of the wrapper generator, which is also when
 * the underlying adapter lazily issues the HTTP request (the adapter stream is
 * an `async function*` whose fetch runs on first `next()`).
 */
import type { Sample, ErrorKind } from './sample.js';
import type { StreamChunk } from './types.js';
/** Accumulated measurement state for one in-flight stream. */
export interface Measurement {
    ttftMs: number | null;
    ttftTextMs: number | null;
    e2eMs: number | null;
    outputTokens: number;
    inputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    ok: boolean;
    errorKind: ErrorKind | null;
    requestId?: string;
    failureCode?: string;
    failureStatus?: number;
    failureMessage?: string;
}
export declare function freshMeasurement(): Measurement;
/**
 * Map a terminal failure to a provider-neutral class. `kind` is the finish
 * reason tag ('error' / 'aborted'); `code`/`status` come from the harness
 * `LlmFailure` carried on the reason (or from a thrown `LlmError`).
 */
export declare function classifyError(args: {
    kind?: string;
    code?: string;
    status?: number;
}): ErrorKind;
/** Classify a thrown error from the stream body (transport / adapter-level). */
export declare function classifyThrownError(error: unknown): ErrorKind;
/** Apply one chunk to a measurement; `elapsedMs` is time since stream start. */
export declare function applyChunk(m: Measurement, chunk: StreamChunk, elapsedMs: number): void;
/**
 * Wrap `source` and measure it while passing every chunk through unchanged.
 * The generator body (and therefore the timing start) runs on first pull.
 */
export declare function instrumentStream(source: AsyncIterable<StreamChunk>): AsyncGenerator<StreamChunk, Measurement, void>;
/** Consume an iterable to completion, measuring it without re-emitting chunks. */
export declare function consumeAndMeasure(source: AsyncIterable<StreamChunk>): Promise<Measurement>;
/** Fold a measurement into a finished sample. */
export declare function measurementToSample(m: Measurement, base: {
    ts: number;
    vendor: string;
    provider: string;
    model: string;
    sessionId?: string;
}): Sample;
