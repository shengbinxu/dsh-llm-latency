/** One recorded model-call latency sample (owned plain JSON, no live objects). */
export interface Sample {
  /** Epoch millis when the stream was first pulled (request dispatch). */
  ts: number
  /** Real vendor identity, resolved from the provider route's base URL host when known. */
  vendor: string
  /** Registered provider route id. */
  provider: string
  /** Model id. */
  model: string
  /** Owning session id, when the request came from an agent-loop session. */
  sessionId?: string
  /** Provider request id, when surfaced (failures carry it; successes pending a harness change). */
  requestId?: string
  /** Credential reference name the provider route resolves its key through. */
  credentialRef?: string
  /** Auxiliary call purpose, when this is not a user-facing conversation call. */
  purpose?: 'compaction' | 'session-title'
  /** First content delta latency in ms, or null when no content arrived. */
  ttftMs: number | null
  /** First text-delta (visible answer) latency in ms, or null. */
  ttftTextMs: number | null
  /** Full stream duration in ms. */
  e2eMs: number | null
  outputTokens: number
  inputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  ok: boolean
  /** Failure class for failed attempts; null for successful ones. */
  errorKind: ErrorKind | null
  /** Stable failure code from the harness `LlmFailure`, when the call failed. */
  failureCode?: string
  /** HTTP status from the harness `LlmFailure`, when the call failed. */
  failureStatus?: number
  /** Failure message, when the call failed. */
  failureMessage?: string
}

/** Provider-neutral failure classes a sample can carry. */
export type ErrorKind = 'rateLimited' | 'timeout' | 'aborted' | 'server' | 'other'

export function newSample(partial: {
  ts: number
  vendor: string
  provider: string
  model: string
  sessionId?: string
}): Sample {
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
  }
}
