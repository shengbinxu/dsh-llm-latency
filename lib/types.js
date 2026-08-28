/**
 * Local structural contracts for the subset of the DeepSeek Harness LLM API this
 * plugin reads at runtime. Kept self-contained (no `@deepseek-ai/*` imports) so
 * the plugin builds and publishes without depending on unpublished packages.
 *
 * Field shapes mirror the harness source of record:
 *   packages/llm/llm/src/types.ts  (GenerateOptions, StreamChunk, TokenUsage, FinishReason)
 *   packages/core/tools/src/index.ts (ToolDefinition)
 */
export {};
