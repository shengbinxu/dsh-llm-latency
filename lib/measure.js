/**
 * Streaming measurement: wraps an AsyncIterable<StreamChunk>, capturing
 * first-token / first-text / end-to-end latency and token usage as chunks flow.
 *
 * Timing starts on the first pull of the wrapper generator, which is also when
 * the underlying adapter lazily issues the HTTP request (the adapter stream is
 * an `async function*` whose fetch runs on first `next()`).
 */
import { newSample } from './sample.js';
export function freshMeasurement() {
    return {
        ttftMs: null,
        ttftTextMs: null,
        e2eMs: null,
        outputTokens: 0,
        inputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        ok: true,
        errorKind: null,
    };
}
/**
 * Map a terminal failure to a provider-neutral class. `kind` is the finish
 * reason tag ('error' / 'aborted'); `code`/`status` come from the harness
 * `LlmFailure` carried on the reason (or from a thrown `LlmError`).
 */
export function classifyError(args) {
    if (args.kind === 'aborted')
        return 'aborted';
    const code = args.code ?? '';
    if (code === 'RATE_LIMIT' || args.status === 429)
        return 'rateLimited';
    if (code.toUpperCase().includes('TIMEOUT'))
        return 'timeout';
    if (code === 'ABORTED')
        return 'aborted';
    if (code === 'SERVER' || (args.status !== undefined && args.status >= 500))
        return 'server';
    return 'other';
}
/** Classify a thrown error from the stream body (transport / adapter-level). */
export function classifyThrownError(error) {
    if (error === null || typeof error !== 'object')
        return 'other';
    const e = error;
    const code = typeof e.code === 'string' ? e.code : '';
    const status = typeof e.status === 'number' ? e.status : undefined;
    const kind = e.name === 'AbortError' ? 'aborted' : undefined;
    return classifyError({ kind, code, status });
}
function isContentChunk(chunk) {
    return chunk.type === 'text-delta' || chunk.type === 'reasoning-delta' || chunk.type === 'tool-call-delta';
}
/** Apply one chunk to a measurement; `elapsedMs` is time since stream start. */
export function applyChunk(m, chunk, elapsedMs) {
    if (isContentChunk(chunk)) {
        if (m.ttftMs === null)
            m.ttftMs = elapsedMs;
        if (chunk.type === 'text-delta' && m.ttftTextMs === null)
            m.ttftTextMs = elapsedMs;
        return;
    }
    if (chunk.type === 'usage') {
        m.outputTokens = chunk.usage.outputTokens ?? 0;
        m.inputTokens = chunk.usage.inputTokens ?? 0;
        m.cacheReadTokens = chunk.usage.cacheReadTokens ?? 0;
        m.cacheWriteTokens = chunk.usage.cacheWriteTokens ?? 0;
        return;
    }
    if (chunk.type === 'finish') {
        const reason = chunk.reason;
        const kind = reason?.kind;
        if (kind === 'error' || kind === 'aborted') {
            m.ok = false;
            m.errorKind = classifyError({ kind, code: reason?.failure?.code, status: reason?.failure?.status });
            m.requestId = reason?.failure?.requestId;
            m.failureCode = reason?.failure?.code;
            m.failureStatus = reason?.failure?.status;
            m.failureMessage = reason?.failure?.message;
        }
    }
}
/**
 * Wrap `source` and measure it while passing every chunk through unchanged.
 * The generator body (and therefore the timing start) runs on first pull.
 */
export async function* instrumentStream(source) {
    const startedAt = Date.now();
    const m = freshMeasurement();
    try {
        for await (const chunk of source) {
            applyChunk(m, chunk, Date.now() - startedAt);
            yield chunk;
        }
    }
    catch (error) {
        if (m.errorKind === null) {
            m.ok = false;
            m.errorKind = classifyThrownError(error);
        }
        throw error;
    }
    finally {
        m.e2eMs = Date.now() - startedAt;
    }
    return m;
}
/** Consume an iterable to completion, measuring it without re-emitting chunks. */
export async function consumeAndMeasure(source) {
    const gen = instrumentStream(source);
    let result = await gen.next();
    while (!result.done) {
        result = await gen.next();
    }
    return result.value ?? freshMeasurement();
}
/** Fold a measurement into a finished sample. */
export function measurementToSample(m, base) {
    const sample = newSample(base);
    sample.ttftMs = m.ttftMs;
    sample.ttftTextMs = m.ttftTextMs;
    sample.e2eMs = m.e2eMs;
    sample.outputTokens = m.outputTokens;
    sample.inputTokens = m.inputTokens;
    sample.cacheReadTokens = m.cacheReadTokens;
    sample.cacheWriteTokens = m.cacheWriteTokens;
    sample.ok = m.ok;
    sample.errorKind = m.errorKind;
    if (m.requestId !== undefined)
        sample.requestId = m.requestId;
    if (m.failureCode !== undefined)
        sample.failureCode = m.failureCode;
    if (m.failureStatus !== undefined)
        sample.failureStatus = m.failureStatus;
    if (m.failureMessage !== undefined)
        sample.failureMessage = m.failureMessage;
    return sample;
}
