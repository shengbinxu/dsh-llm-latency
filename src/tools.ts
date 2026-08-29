/**
 * Model-visible tool: `latency_report`.
 */

import type { Context, ToolService } from './types.js'

export interface ReportArgs {
  model?: string
  vendors?: string[]
  from?: number
  to?: number
  sessionIds?: string[]
}

export interface ToolDeps {
  runReport(args: ReportArgs): Promise<string>
}

function textRender(): (args: unknown, value: unknown) => { type: 'text'; text: string }[] {
  return (_args: unknown, value: unknown) => [{ type: 'text', text: String(value) }]
}

/** Register the report tool against the `tools` service; returns a disposer. */
export function registerTools(ctx: Context, deps: ToolDeps): () => void {
  const tools: ToolService = ctx.tools

  return tools.register({
    name: 'latency_report',
    description:
      '按厂商/模型汇总已记录的 LLM 调用延迟与缓存命中对比：首 token、端到端延迟、吐字速率、缓存命中率、失败(429/超时)。支持按时间窗(from/to 为 epoch 毫秒)、按模型、按厂商、或按会话(sessionIds)对比；同模型跨厂商、同时段对比更有参考价值。',
    parameters: {
      type: 'object',
      properties: {
        model: { type: 'string', description: '限定的 canonical 模型名；省略则全部模型' },
        vendors: { type: 'array', items: { type: 'string' }, description: '限定的厂商；省略则全部' },
        from: { type: 'number', description: '起始 epoch 毫秒；省略则为最早' },
        to: { type: 'number', description: '结束 epoch 毫秒；省略则为当前' },
        sessionIds: { type: 'array', items: { type: 'string' }, description: '按会话对比时的会话 id 列表' },
      },
      additionalProperties: false,
    },
    output: { schema: { type: 'string' }, render: textRender() },
    async execute(args: unknown): Promise<unknown> {
      const a = (args ?? {}) as ReportArgs
      return await deps.runReport(a)
    },
  })
}
