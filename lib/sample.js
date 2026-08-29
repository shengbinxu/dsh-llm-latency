export function newSample(partial) {
    return {
        ts: partial.ts,
        vendor: partial.vendor,
        provider: partial.provider,
        model: partial.model,
        ...(partial.sessionId === undefined ? {} : { sessionId: partial.sessionId }),
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
