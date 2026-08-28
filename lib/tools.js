/**
 * Model-visible tools: `latency_report` and `latency_benchmark`.
 */
function textRender() {
    return (_args, value) => [{ type: 'text', text: String(value) }];
}
/** Register both tools against the `tools` service; returns a combined disposer. */
export function registerTools(ctx, deps) {
    const tools = ctx.get('tools');
    if (tools === undefined)
        return () => { };
    const disposers = [];
    disposers.push(tools.register({
        name: 'latency_report',
        description: '按厂商/模型汇总已记录的模型调用延迟对比：首 token、端到端延迟、吐字速率、缓存命中率与毛刺数量。用于客观对比不同平台（如 DeepSeek 官网、阿里云百炼、腾讯云）同一模型或同类模型的响应速度。',
        parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        output: { schema: { type: 'string' }, render: textRender() },
        async execute() {
            return deps.reportText();
        },
    }));
    disposers.push(tools.register({
        name: 'latency_benchmark',
        description: '复用最近一次真实请求的长上下文，并发对拍多个厂商/模型路由，输出同输入、同时刻的延迟对比。会产生真实调用费用。',
        parameters: {
            type: 'object',
            properties: {
                rounds: { type: 'number', description: '每个目标路由跑的轮数，默认 3' },
                cacheBust: { type: 'boolean', description: '为 true 时向 system 注入随机前缀以打破前缀缓存，测冷算力' },
                providers: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '限定参与对拍的 provider 路由 id；省略则对比全部已配置路由',
                },
            },
            additionalProperties: false,
        },
        output: { schema: { type: 'string' }, render: textRender() },
        async execute(args) {
            const a = (args ?? {});
            return await deps.benchmarkText(a);
        },
    }));
    return () => {
        for (const dispose of disposers) {
            try {
                dispose();
            }
            catch {
                // best-effort disposal
            }
        }
    };
}
