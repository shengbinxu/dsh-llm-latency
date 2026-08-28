/**
 * Capture a lossless, owned snapshot of a real request so a benchmark can
 * replay the same long-context workload across vendors. Messages and tools are
 * plain wire JSON (the adapter itself serializes them), so a JSON round-trip
 * clones them into data the plugin owns.
 */
/**
 * Clone a request into a replayable snapshot, or return null when it is too
 * large or cannot be serialized.
 * @param options - the intercepted request.
 * @param maxBytes - hard JSON size cap for retained snapshots.
 */
export function snapshotRequest(options, maxBytes) {
    let messages;
    let tools;
    try {
        messages = JSON.parse(JSON.stringify(options.messages));
        tools = JSON.parse(JSON.stringify(options.tools ?? []));
    }
    catch {
        return null;
    }
    const byteSize = JSON.stringify(messages).length + JSON.stringify(tools).length + (options.system?.length ?? 0);
    if (byteSize > maxBytes)
        return null;
    return {
        provider: options.provider,
        model: options.model,
        system: options.system,
        messages,
        tools,
        maxTokens: options.maxTokens,
        reasoningEffort: options.reasoningEffort,
        byteSize,
    };
}
