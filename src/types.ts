/**
 * Local structural contracts for the subset of the DeepSeek Harness LLM API this
 * plugin reads at runtime. Kept self-contained (no `@deepseek-ai/*` imports) so
 * the plugin builds and publishes without depending on unpublished packages.
 *
 * Field shapes mirror the harness source of record:
 *   packages/llm/llm/src/types.ts  (GenerateOptions, StreamChunk, TokenUsage, FinishReason)
 *   packages/core/tools/src/index.ts (ToolDefinition)
 */

/** Cordis Context subset the plugin uses; the real context satisfies this. */
export interface Context {
  get(name: string): unknown
  on(name: string, listener: (...args: unknown[]) => unknown): () => void
  effect(callback: () => (() => void) | void | undefined, label?: string): () => void
}

/** One registered provider route. */
export interface ProviderInfo {
  id: string
  name: string
}

/** One provider-owned model entry. */
export interface ModelInfo {
  provider: string
  id: string
  name: string
}

/** The `llm` service subset the plugin reads. */
export interface LlmService {
  listProviders(): readonly ProviderInfo[]
  listModels(provider: string): Promise<readonly ModelInfo[]>
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>
}

/** The `tools` registry subset the plugin uses. */
export interface ToolService {
  register(definition: ToolDefinition): () => void
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: {
    schema: unknown
    render(args: unknown, value: unknown): ContentBlock[]
  }
  execute(args: unknown, exec: ToolRunContext): Promise<unknown>
}

export interface ToolRunContext {
  signal?: unknown
}

export type ContentBlock = { type: 'text'; text: string }

/** A fully assembled model request. */
export interface GenerateOptions {
  provider: string
  model: string
  reasoningEffort?: string
  messages: readonly Message[]
  system?: string
  tools?: readonly unknown[]
  temperature?: number
  maxTokens?: number
  stop?: string[]
  signal?: unknown
  sessionId?: unknown
  purpose?: 'compaction' | 'session-title'
}

/** A conversation message; content is opaque JSON for replay purposes. */
export interface Message {
  role: string
  content?: unknown
  [k: string]: unknown
}

/** Raw streaming protocol emitted by adapters. */
export type StreamChunk =
  | { type: 'block-start'; index: number; blockType: string }
  | { type: 'text-delta'; index: number; text: string }
  | { type: 'reasoning-delta'; index: number; text: string }
  | { type: 'tool-call-delta'; index: number; id: string; name?: string; argumentsDelta: string }
  | { type: 'block-end'; index: number; block: unknown }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'finish'; reason: FinishReason }

/**
 * Token accounting for one call. Counts are DISJOINT: `inputTokens` is uncached
 * input only; `cacheReadTokens`/`cacheWriteTokens` report cached input
 * separately (billed input = sum of the three).
 */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}

export type FinishReason =
  | { kind: 'stop' }
  | { kind: 'tool-calls' }
  | { kind: 'max-tokens' }
  | { kind: 'aborted'; failure: unknown }
  | { kind: 'error'; failure: unknown }
  // Merge-extensible fallback for providers/harness versions that add kinds.
  | { kind: string; [k: string]: unknown }
