window.__ModuleLoader__.load({
  id: 'dsh-llm-latency',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const h = React.createElement;
    const NS = 'llm-latency';
    const PANEL_ID = 'llm-latency';

    const zh = {
      'sidebar.label': 'LLM 观测台',
      'entry.label': '观测',
      'entry.title': '打开 LLM 观测速览',
      'title': 'LLM 观测台',
      'subtitle': '按厂商、模型和会话查看延迟、吞吐、缓存命中与请求日志',
      'hint.response': '从首次拉取模型返回流（适配器通常此时才发起请求）开始，到收到第一段非空文字、推理内容或工具调用信息为止。不计心跳、用量统计或结束信号；不等于从点击发送到看到答案的时间。',
      'hint.text': '从首次拉取模型返回流开始，到收到第一段非空回答文字为止。推理内容和工具调用不算回答文字；没有返回文字的请求不参与此项统计。计时止于收到文字，不包含界面渲染时间。',
      'hint.median': '中位数：将统计范围内有该指标记录的成功请求排序，取中间值；偶数个样本取中间两个值的平均。两项指标的有效样本可能不同。速览使用精确保留样本，历史页面的分位数由直方图近似估计。',
      'recording': '被动记录',
      'throughput.unavailable': '当前窗口没有可计算回答文字速度的样本：需独立推理词元计数、输出用量与无工具增量的可见文本请求。缺失时显示 —，不代表速率为 0。',
      'tab.overview': '总览',
      'tab.compare': '时段对比',
      'tab.sessions': '会话对比',
      'tab.log': '请求日志',
      'filter.model': '模型',
      'filter.allModels': '全部模型',
      'filter.range': '时间范围',
      'filter.1h': '最近 1 小时',
      'filter.24h': '最近 24 小时',
      'filter.7d': '最近 7 天',
      'filter.30d': '最近 30 天',
      'filter.today': '今天',
      'filter.custom': '自定义',
      'filter.from': '从',
      'filter.to': '到',
      'filter.vendors': '厂商',
      'action.refresh': '刷新',
      'action.export': '导出 CSV',
      'action.openFull': '打开完整观测台',
      'action.close': '关闭',
      'action.retry': '重试',
      'action.chart': '显示首次响应等待曲线',
      'action.compareSessions': '对比选中会话',
      'action.search': '查询',
      'action.previous': '上一页',
      'action.next': '下一页',
      'help.title': '指标计算说明',
      'overview.heading': '厂商 · 模型延迟排行',
      'compare.heading': '同模型跨厂商对比',
      'sessions.heading': '会话列表',
      'sessions.compareHeading': '会话对比',
      'log.heading': '请求记录',
      'log.searchPlaceholder': '搜索 requestId / 厂商 / 模型 / 会话 / key / 错误码',
      'log.statusAll': '全部状态',
      'status.ok': '成功',
      'status.fail': '失败',
      'status.rateLimited': '429 限流',
      'status.timeout': '超时',
      'status.server': '5xx',
      'status.aborted': '中止',
      'status.other': '其他',
      'column.vendorModel': '厂商 / 模型',
      'column.vendor': '厂商',
      'column.model': '模型',
      'help.metric': '指标',
      'help.explanation': '计算逻辑与限制',
      'sessions.selected': '已选 {count} 个会话',
      'column.samples': '样本',
      'column.ttft50': '首次响应等待（中位数）',
      'column.ttft90': '90%等待值',
      'column.ttft95': '95%等待值',
      'column.ttft99': '99%等待值',
      'column.e2e50': '完整请求耗时（中位数）',
      'column.firstText50': '首字等待（中位数）',
      'column.totalRate': '总输出速度（词元/秒）',
      'hint.totalRate': '沿用旧版口径：累计总输出词元除以成功请求从首次内容到结束的累计耗时。总输出可能包含推理和工具调用；旧版累计输出也包含失败请求已报告的输出，因此失败较多时可能偏高。它不是纯回答文字的输出速度。',
      'column.outputRate': '回答文字速度（词元/秒）',
      'column.overallRate': '回答整体速度（词元/秒）',
      'column.rateSamples': '吞吐样本',
      'column.cacheHit': '缓存命中',
      'column.cacheWrite': '缓存写入',
      'column.failures': '失败',
      'column.significance': '显著性',
      'column.select': '选',
      'column.session': '会话',
      'column.startEnd': '起止时间',
      'column.calls': '调用',
      'column.firstCallTtft': '首轮首次响应等待',
      'column.firstCallInput': '首轮输入词元数',
      'column.ttftP50': '首次响应等待（中位数）',
      'column.ttftP95': '首次响应等待（95%等待值）',
      'column.time': '时间',
      'column.requestId': '请求 ID',
      'column.key': '凭据',
      'column.firstToken': '首次响应等待',
      'column.firstText': '首字等待',
      'column.e2e': '完整请求耗时',
      'column.inputTokens': '输入词元数',
      'column.outputTokens': '输出词元数',
      'column.cache': '缓存命中',
      'column.status': '状态',
      'empty.noSamples': '该时间范围暂无采样数据',
      'empty.chooseModel': '请先选择一个模型，再跨厂商对比',
      'empty.noVendors': '可对比的厂商不足两个',
      'empty.noSessions': '暂无会话数据',
      'empty.noRecords': '没有匹配的请求记录',
      'empty.noSeries': '暂无时序数据',
      'empty.chartModel': '选择模型后查看首次响应等待曲线',
      'empty.help': '无法加载指标说明',
      'error.load': '数据加载失败，请重试',
      'error.models': '模型目录加载失败',
      'error.compare': '至少选择两个会话',
      'warning.weakEvidence': '证据不足',
      'warning.significant': '差异显著',
      'warning.notSignificant': '无显著差异',
      'warning.modelSwitch': '会话内切换过模型',
      'warning.sessionModel': '所选会话不是同一模型，对比价值有限',
      'warning.promptSize': '首轮输入词元数差异超过 20%，提示词可能不同',
      'count.page': '{total} 条 · 第 {page} 页',
      'recent.title': '近期延迟',
      'recent.note': '最近已完成请求的实测值；没有新请求就没有新样本，不主动调用模型。中位数来自时间窗内保留的成功样本，不使用历史小时桶。',
      'recent.window': '采样窗口',
      'recent.15': '最近 15 分钟',
      'recent.60': '最近 1 小时',
      'recent.180': '最近 3 小时',
      'recent.last': '最近一次首次响应等待',
      'recent.median': '近期首次响应等待（中位数）',
      'recent.firstText': '近期首字等待（中位数）',
      'recent.sampled': '最后采样',
      'recent.idle': '暂无近期样本',
      'slow.title': '较慢请求',
      'slow.empty': '暂无请求记录',
      'total.calls': '请求数',
      'total.models': '模型数',
      'total.vendors': '厂商数',
      'total.failures': '失败数',
    };

    const en = {
      'sidebar.label': 'LLM Latency',
      'entry.label': 'Latency',
      'entry.title': 'Open the LLM latency overview',
      'title': 'LLM Latency',
      'subtitle': 'Latency, throughput, cache hits, and request logs by vendor, model, and session',
      'hint.response': 'From the first pull of the model stream to the first non-empty text, reasoning, or tool-call delta. Heartbeats, usage, and finish signals do not count. This is not click-to-answer time.',
      'hint.text': 'From the first stream pull to the first non-empty visible-answer text delta. Reasoning and tool calls do not count. Calls without visible text are excluded. Browser rendering time is not included.',
      'hint.median': 'Sort successful calls with this metric and take the middle value, averaging the middle two for an even count. The two metrics may have different eligible samples. Quick-view medians use exact retained samples; historical percentiles use histogram estimates.',
      'recording': 'Passive recording',
      'throughput.unavailable': 'No eligible visible-answer throughput samples in this window. Rates require separate reasoning counts, output usage, and visible text without tool-call deltas. Missing data is —, not zero.',
      'tab.overview': 'Overview',
      'tab.compare': 'Time comparison',
      'tab.sessions': 'Sessions',
      'tab.log': 'Request log',
      'filter.model': 'Model',
      'filter.allModels': 'All models',
      'filter.range': 'Time range',
      'filter.1h': 'Last hour',
      'filter.24h': 'Last 24 hours',
      'filter.7d': 'Last 7 days',
      'filter.30d': 'Last 30 days',
      'filter.today': 'Today',
      'filter.custom': 'Custom',
      'filter.from': 'From',
      'filter.to': 'To',
      'filter.vendors': 'Vendors',
      'action.refresh': 'Refresh',
      'action.export': 'Export CSV',
      'action.openFull': 'Open full dashboard',
      'action.close': 'Close',
      'action.retry': 'Retry',
      'action.chart': 'Show TTFT timeline',
      'action.compareSessions': 'Compare selected sessions',
      'action.search': 'Search',
      'action.previous': 'Previous',
      'action.next': 'Next',
      'help.title': 'Metric definitions',
      'overview.heading': 'Latency by vendor and model',
      'compare.heading': 'Compare vendors for one model',
      'sessions.heading': 'Sessions',
      'sessions.compareHeading': 'Session comparison',
      'log.heading': 'Request records',
      'log.searchPlaceholder': 'Search request ID, vendor, model, session, key, or error code',
      'log.statusAll': 'All statuses',
      'status.ok': 'Success',
      'status.fail': 'Failure',
      'status.rateLimited': '429 rate limited',
      'status.timeout': 'Timeout',
      'status.server': '5xx',
      'status.aborted': 'Aborted',
      'status.other': 'Other',
      'column.vendorModel': 'Vendor / model',
      'column.vendor': 'Vendor',
      'column.model': 'Model',
      'help.metric': 'Metric',
      'help.explanation': 'Calculation and limitations',
      'sessions.selected': '{count} sessions selected',
      'column.samples': 'Samples',
      'column.ttft50': 'TTFT p50',
      'column.ttft90': 'p90',
      'column.ttft95': 'p95',
      'column.ttft99': 'p99',
      'column.e2e50': 'End-to-end p50',
      'column.firstText50': 'First text p50',
      'column.totalRate': 'Total output tokens/s',
      'hint.totalRate': 'Legacy rate: cumulative total-output tokens divided by successful calls’ cumulative time from first content to completion. Total output may include reasoning, tools, and reported failed-call output; failures can inflate this legacy rate. It is not visible-answer throughput.',
      'column.outputRate': 'Visible-answer tokens/s',
      'column.overallRate': 'Overall tokens/s',
      'column.rateSamples': 'Rate samples',
      'column.cacheHit': 'Cache hit',
      'column.cacheWrite': 'Cache write',
      'column.failures': 'Failures',
      'column.significance': 'Significance',
      'column.select': 'Select',
      'column.session': 'Session',
      'column.startEnd': 'Start / end',
      'column.calls': 'Calls',
      'column.firstCallTtft': 'First-call TTFT',
      'column.firstCallInput': 'First-call input tokens',
      'column.ttftP50': 'TTFT p50',
      'column.ttftP95': 'TTFT p95',
      'column.time': 'Time',
      'column.requestId': 'Request ID',
      'column.key': 'Credential',
      'column.firstToken': 'First token',
      'column.firstText': 'First text',
      'column.e2e': 'End-to-end',
      'column.inputTokens': 'Input tokens',
      'column.outputTokens': 'Output tokens',
      'column.cache': 'Cache hit',
      'column.status': 'Status',
      'empty.noSamples': 'No samples in this time range',
      'empty.chooseModel': 'Choose a model to compare vendors',
      'empty.noVendors': 'Fewer than two vendors can be compared',
      'empty.noSessions': 'No session data yet',
      'empty.noRecords': 'No matching request records',
      'empty.noSeries': 'No time-series data',
      'empty.chartModel': 'Choose a model to view its TTFT timeline',
      'empty.help': 'Metric definitions could not be loaded',
      'error.load': 'Could not load data. Try again.',
      'error.models': 'Could not load the model list',
      'error.compare': 'Select at least two sessions',
      'warning.weakEvidence': 'Insufficient evidence',
      'warning.significant': 'Significant difference',
      'warning.notSignificant': 'No significant difference',
      'warning.modelSwitch': 'The session switched models',
      'warning.sessionModel': 'The selected sessions use different models',
      'warning.promptSize': 'First-call input tokens differ by more than 20%',
      'count.page': '{total} records · page {page}',
      'recent.title': 'Recent latency',
      'recent.note': 'Measured completed calls only. No new request means no new sample; this panel never calls a model. Medians use retained successful samples in this exact window, not historical hour buckets.',
      'recent.window': 'Sampling window',
      'recent.15': 'Last 15 minutes',
      'recent.60': 'Last hour',
      'recent.180': 'Last 3 hours',
      'recent.last': 'Latest TTFT',
      'recent.median': 'Recent median TTFT',
      'recent.firstText': 'Recent median first text',
      'recent.sampled': 'Last sample',
      'recent.idle': 'No recent samples',
      'slow.title': 'Slower requests',
      'slow.empty': 'No request records yet',
      'total.calls': 'Requests',
      'total.models': 'Models',
      'total.vendors': 'Vendors',
      'total.failures': 'Failures',
    };

    const CSS = `
.llm-latency-metric-label { cursor:help; border-bottom:1px dotted var(--dsw-alias-border-l2); }
.llm-latency-metric-tip { position:fixed; z-index:1200; max-width:min(360px,calc(100vw - 24px)); max-height:calc(100vh - 24px); overflow:auto; padding:10px 12px; border:1px solid var(--dsw-alias-border-l2); border-radius:var(--dsw-radius-sm,6px); background:var(--dsw-alias-bg-overlay); color:var(--dsw-alias-label-primary); font-size:13px; line-height:21px; white-space:normal; box-shadow:var(--dsw-elevation-soft); }

.llm-latency-page { box-sizing:border-box; display:flex; flex-direction:column; width:100%; height:100%; min-height:0; padding:20px 24px 16px; color:var(--dsw-alias-label-primary); font-size:13px; line-height:20px; }
.llm-latency-page *, .llm-latency-dialog * { box-sizing:border-box; }
.llm-latency-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:14px; }
.llm-latency-title { margin:0; font-size:20px; line-height:28px; font-weight:500; }
.llm-latency-subtitle { margin:3px 0 0; color:var(--dsw-alias-label-secondary); font-size:13px; line-height:20px; }
.llm-latency-passive { flex:none; color:var(--dsw-alias-label-secondary); font-size:12px; }
.llm-latency-tabs { display:flex; flex-wrap:wrap; gap:4px; border-bottom:1px solid var(--dsw-alias-border-l1); margin-bottom:12px; }
.llm-latency-tab { min-height:34px; padding:0 12px; border:0; border-bottom:2px solid transparent; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; cursor:pointer; }
.llm-latency-tab[aria-selected="true"] { color:var(--dsw-alias-brand-primary); border-bottom-color:var(--dsw-alias-brand-primary); }
.llm-latency-toolbar { display:flex; align-items:flex-end; flex-wrap:wrap; gap:8px 12px; padding:0 0 12px; border-bottom:1px solid var(--dsw-alias-border-l1); }
.llm-latency-field { display:flex; flex-direction:column; gap:4px; min-width:110px; color:var(--dsw-alias-label-secondary); font-size:12px; }
.llm-latency-control { min-width:0; height:30px; padding:0 8px; border:1px solid var(--dsw-alias-border-l2); border-radius:var(--dsw-radius-sm,6px); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; }
.llm-latency-control:focus-visible, .llm-latency-button:focus-visible, .llm-latency-tab:focus-visible, .llm-latency-entry:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
.llm-latency-button { display:inline-flex; align-items:center; justify-content:center; min-height:30px; padding:0 10px; border:1px solid var(--dsw-alias-border-l2); border-radius:var(--dsw-radius-sm,6px); background:transparent; color:var(--dsw-alias-label-primary); font:inherit; cursor:pointer; }
.llm-latency-button:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-1); }
.llm-latency-button:disabled { opacity:.45; cursor:not-allowed; }
.llm-latency-button-primary { border-color:var(--dsw-alias-brand-primary); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-brand-primary); }
.llm-latency-vendors { display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:10px 0; }
.llm-latency-vendor { display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border:1px solid var(--dsw-alias-border-l1); border-radius:var(--dsw-radius-sm,6px); color:var(--dsw-alias-label-secondary); cursor:pointer; }
.llm-latency-vendor input { margin:0; accent-color:var(--dsw-alias-brand-primary); }
.llm-latency-results { flex:1; min-height:0; overflow:auto; padding:12px 2px 8px; }
.llm-latency-section { margin:0 0 18px; }
.llm-latency-section-title { margin:0 0 8px; font-size:14px; line-height:22px; font-weight:500; }
.llm-latency-table-wrap { width:100%; overflow:auto; }
.llm-latency-table { width:100%; border-collapse:collapse; font-size:13px; line-height:19px; }
.llm-latency-table th { position:sticky; top:0; z-index:1; padding:8px 10px; border-bottom:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font-size:12px; font-weight:500; text-align:left; white-space:nowrap; }
.llm-latency-table td { padding:8px 10px; border-bottom:1px solid var(--dsw-alias-border-l1); color:var(--dsw-alias-label-primary); text-align:left; white-space:nowrap; font-variant-numeric:tabular-nums; }
.llm-latency-table tbody tr:hover { background:var(--dsw-alias-bg-layer-1); }
.llm-latency-empty { display:flex; min-height:140px; align-items:center; justify-content:center; color:var(--dsw-alias-label-secondary); text-align:center; }
.llm-latency-error { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:8px 0; padding:8px 10px; border-left:2px solid var(--dsw-alias-state-error-primary); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); }
.llm-latency-warning { margin:8px 0; color:var(--dsw-alias-state-warn-primary); }
.llm-latency-status-ok { color:var(--dsw-alias-state-success-primary) !important; }
.llm-latency-status-fail { color:var(--dsw-alias-state-error-primary) !important; }
.llm-latency-muted { color:var(--dsw-alias-label-secondary) !important; }
.llm-latency-metric-help { margin:10px 0; border-bottom:1px solid var(--dsw-alias-border-l1); }
.llm-latency-metric-help td { white-space:normal; vertical-align:top; min-width:150px; }
.llm-latency-metric-help summary { padding:8px 0; color:var(--dsw-alias-label-secondary); cursor:pointer; }
.llm-latency-chart { display:block; width:100%; min-width:600px; height:300px; overflow:visible; }
.llm-latency-chart text { fill:var(--dsw-alias-label-secondary); font:12px sans-serif; }
.llm-latency-grid { stroke:var(--dsw-alias-border-l1); stroke-dasharray:3 4; }
.llm-latency-series-0 { stroke:var(--dsw-alias-brand-primary); }
.llm-latency-series-1 { stroke:var(--dsw-alias-state-success-primary); }
.llm-latency-series-2 { stroke:var(--dsw-alias-state-warn-primary); }
.llm-latency-series-3 { stroke:var(--dsw-alias-state-idle-primary); }
.llm-latency-legend { display:flex; flex-wrap:wrap; gap:12px; margin:8px 0; color:var(--dsw-alias-label-secondary); }
.llm-latency-legend-item { display:flex; align-items:center; gap:5px; }
.llm-latency-swatch { width:12px; height:2px; background:var(--dsw-alias-brand-primary); }
.llm-latency-swatch-1 { background:var(--dsw-alias-state-success-primary); }
.llm-latency-swatch-2 { background:var(--dsw-alias-state-warn-primary); }
.llm-latency-swatch-3 { background:var(--dsw-alias-state-idle-primary); }
.llm-latency-footer { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 0; color:var(--dsw-alias-label-secondary); }
.llm-latency-backdrop { pointer-events:auto; position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:max(24px,var(--dsh-frame-overlay-top,24px)) 24px; }
.llm-latency-mask { position:absolute; inset:var(--dsh-frame-chrome-top,0px) 0 0; background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.35)); backdrop-filter:var(--dsw-mask-blur,none); pointer-events:none; }
.llm-latency-dialog { position:relative; z-index:1; display:flex; flex-direction:column; width:min(1080px,100%); max-height:100%; overflow:hidden; border-radius:var(--dsw-radius-panel,12px); background:var(--dsw-alias-bg-layer-2); box-shadow:var(--dsw-elevation-prominent); color:var(--dsw-alias-label-primary); }
.llm-latency-dialog:focus { outline:none; }
.llm-latency-dialog-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:20px 20px 12px; border-bottom:1px solid var(--dsw-alias-border-l1); }
.llm-latency-dialog-body { min-height:0; overflow:auto; padding:12px 20px; }
.llm-latency-dialog-foot { display:flex; justify-content:flex-end; gap:8px; padding:12px 20px 16px; border-top:1px solid var(--dsw-alias-border-l1); }
.llm-latency-entry { height:28px; padding:0 8px; border:0; border-radius:var(--dsw-radius-sm,6px); background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:13px; cursor:pointer; }
.llm-latency-entry:hover, .llm-latency-entry[aria-pressed="true"] { background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-brand-primary); }
.llm-latency-sidebar-mark { display:inline-flex; align-items:center; justify-content:center; border:1.5px solid currentColor; border-radius:4px; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:1; font-weight:500; }
[data-platform='darwin'] .llm-latency-page { padding-top:calc(20px + var(--dsh-frame-top-clearance,0px)); }
@media (max-width:760px) { .llm-latency-page { padding:14px 12px; } .llm-latency-heading { flex-direction:column; gap:4px; } .llm-latency-dialog-head { padding:16px 14px 10px; } .llm-latency-dialog-body { padding:10px 14px; } .llm-latency-dialog-foot { padding:10px 14px 12px; } .llm-latency-backdrop { padding:12px; } }
`;

    async function getJson(path, signal) {
      const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }

    function formatMs(value) {
      if (value === null || value === undefined || !Number.isFinite(value)) return '—';
      return value < 1000 ? Math.round(value) + '毫秒' : (value / 1000).toFixed(2) + '秒';
    }

    function formatRate(value) {
      return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(1);
    }

    function formatPercent(value) {
      return value === null || value === undefined || !Number.isFinite(value) ? '—' : (value * 100).toFixed(1) + '%';
    }

    function formatDate(value) {
      return value === null || value === undefined ? '—' : new Date(value).toLocaleString();
    }

    function windowBounds(range, from, to) {
      const end = Date.now();
      let start = end - 30 * 24 * 60 * 60 * 1000;
      if (range === '1h') start = end - 60 * 60 * 1000;
      else if (range === '24h') start = end - 24 * 60 * 60 * 1000;
      else if (range === '7d') start = end - 7 * 24 * 60 * 60 * 1000;
      else if (range === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        start = today.getTime();
      } else if (range === 'custom') {
        if (from) start = new Date(from).getTime();
        if (to) return { from: start, to: new Date(to).getTime() };
      }
      return { from: start, to: end };
    }

    function query(filter, withWindow) {
      const params = new URLSearchParams();
      if (withWindow) {
        const bounds = windowBounds(filter.range, filter.from, filter.to);
        params.set('from', String(bounds.from));
        params.set('to', String(bounds.to));
      }
      if (filter.model) params.set('model', filter.model);
      if (filter.vendors.length) params.set('vendors', filter.vendors.join(','));
      const suffix = params.toString();
      return suffix ? '?' + suffix : '';
    }

    function errorSummary(summary, t) {
      const count = summary.count || summary.okCount + summary.failCount;
      if (!count) return '0';
      const parts = [];
      const errors = summary.errors || {};
      if (errors.rateLimited > 0) parts.push('429 ' + Math.round(errors.rateLimited / count * 100) + '%');
      if (errors.timeout > 0) parts.push(t('status.timeout') + ' ' + Math.round(errors.timeout / count * 100) + '%');
      if (errors.server > 0) parts.push('5xx ' + Math.round(errors.server / count * 100) + '%');
      if (errors.aborted > 0) parts.push(t('status.aborted') + ' ' + Math.round(errors.aborted / count * 100) + '%');
      return parts.length ? parts.join(' · ') : '0';
    }

    function statusLabel(sample, t) {
      if (sample.ok) return t('status.ok');
      const kind = sample.errorKind || 'other';
      const keys = { rateLimited: 'status.rateLimited', timeout: 'status.timeout', server: 'status.server', aborted: 'status.aborted', other: 'status.other' };
      return t(keys[kind] || keys.other);
    }

    /** Component-owned hover explanation, portaled outside scrolling table containers. */
    function MetricHint({ label, description }) {
      const [open, setOpen] = React.useState(false);
      const [position, setPosition] = React.useState({ left: 0, top: 0 });
      const owner = React.useRef(null);
      const popup = React.useRef(null);
      const timer = React.useRef(null);
      const id = React.useId();
      const show = () => { window.clearTimeout(timer.current); setOpen(true); };
      const hide = () => { timer.current = window.setTimeout(() => setOpen(false), 120); };
      React.useEffect(() => () => window.clearTimeout(timer.current), []);
      React.useLayoutEffect(() => {
        if (!open || !owner.current || !popup.current) return;
        const anchor = owner.current.getBoundingClientRect();
        const box = popup.current.getBoundingClientRect();
        const left = Math.max(12, Math.min(anchor.left, window.innerWidth - box.width - 12));
        const below = anchor.bottom + 8;
        const top = below + box.height <= window.innerHeight - 12
          ? below : Math.max(12, anchor.top - box.height - 8);
        setPosition({ left, top });
      }, [open, description]);
      React.useEffect(() => {
        if (!open) return undefined;
        const close = () => setOpen(false);
        const key = event => { if (event.key === 'Escape') close(); };
        const outside = event => { if (!owner.current?.contains(event.target) && !popup.current?.contains(event.target)) close(); };
        window.addEventListener('keydown', key);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
        window.addEventListener('pointerdown', outside);
        return () => {
          window.removeEventListener('keydown', key);
          window.removeEventListener('resize', close);
          window.removeEventListener('scroll', close, true);
          window.removeEventListener('pointerdown', outside);
        };
      }, [open]);
      return h(React.Fragment, null,
        h('span', { ref: owner, className: 'llm-latency-metric-label', tabIndex: 0,
          onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: () => setOpen(false),
          'aria-describedby': open ? id : undefined }, label),
        open ? createPortal(h('div', { ref: popup, id, role: 'tooltip', className: 'llm-latency-metric-tip',
          style: position, onMouseEnter: show, onMouseLeave: hide }, description), document.body) : null);
    }

    function metricHeader(t, key) {
      if (key === 'column.totalRate') return h(MetricHint, { label: t(key), description: t('hint.totalRate') });
      const text = key.includes('firstText') || key === 'column.firstText';
      const description = t(text ? 'hint.text' : 'hint.response')
        + (key.includes('50') || key.includes('median') || key === 'recent.firstText' ? ' ' + t('hint.median') : '');
      return h(MetricHint, { label: t(key), description });
    }

    function Table(props) {
      if (!props.rows || !props.rows.length) return h('div', { className: 'llm-latency-empty' }, props.empty || props.t('empty.noSamples'));
      return h('div', { className: 'llm-latency-table-wrap' },
        h('table', { className: 'llm-latency-table' },
          h('thead', null, h('tr', null, props.headers.map((header, i) => h('th', { key: 'h' + i }, header)))),
          h('tbody', null, props.rows.map((row, rowIndex) => h('tr', { key: row.key || 'r' + rowIndex }, row.cells.map((cell, cellIndex) => h('td', { key: 'c' + cellIndex }, cell)))))));
    }

    function ErrorNotice({ message, onRetry, t }) {
      if (!message) return null;
      return h('div', { className: 'llm-latency-error', role: 'alert' },
        h('span', null, message),
        h('button', { className: 'llm-latency-button', type: 'button', onClick: onRetry }, t('action.retry')));
    }

    function Chart({ data, t }) {
      const series = data && data.series ? data.series : [];
      const hours = Array.from(new Set(series.map((point) => point.hour))).sort((a, b) => a - b);
      if (!hours.length) return h('div', { className: 'llm-latency-empty' }, t('empty.noSeries'));
      const vendors = Array.from(new Set(series.map((point) => point.vendor))).sort();
      const width = 1160, height = 300, left = 68, right = 20, top = 18, bottom = 36;
      const maxHour = hours[hours.length - 1];
      const minHour = hours[0];
      const maxY = Math.max(1, ...series.map((point) => point.ttftP50 || 0));
      const x = (hour) => left + (hour - minHour) / Math.max(1, maxHour - minHour) * (width - left - right);
      const y = (value) => height - bottom - value / maxY * (height - top - bottom);
      const nodes = [];
      for (let grid = 0; grid <= 4; grid += 1) {
        const value = maxY * grid / 4;
        const position = y(value);
        nodes.push(h('line', { key: 'g' + grid, className: 'llm-latency-grid', x1: left, y1: position, x2: width - right, y2: position }));
        nodes.push(h('text', { key: 'gt' + grid, x: left - 8, y: position + 4, textAnchor: 'end' }, formatMs(value)));
      }
      const step = Math.max(1, Math.ceil((maxHour - minHour) / 8));
      hours.forEach((hour) => {
        if ((hour - minHour) % step !== 0) return;
        const date = new Date(hour * 3600000);
        const label = String(date.getHours()).padStart(2, '0') + ':00';
        nodes.push(h('text', { key: 'x' + hour, x: x(hour), y: height - 10, textAnchor: 'middle' }, label));
      });
      vendors.forEach((vendor, index) => {
        const points = series.filter((point) => point.vendor === vendor && point.ttftP50 !== null)
          .map((point) => x(point.hour).toFixed(1) + ',' + y(point.ttftP50).toFixed(1)).join(' ');
        if (points) nodes.push(h('polyline', { key: 'p' + vendor, className: 'llm-latency-series-' + (index % 4), points, fill: 'none', strokeWidth: 2.5, strokeLinejoin: 'round' }));
      });
      return h('div', null,
        h('svg', { className: 'llm-latency-chart', viewBox: '0 0 ' + width + ' ' + height, role: 'img', 'aria-label': t('action.chart') }, nodes),
        h('div', { className: 'llm-latency-legend' }, vendors.map((vendor, index) => h('span', { className: 'llm-latency-legend-item', key: vendor },
          h('span', { className: 'llm-latency-swatch llm-latency-swatch-' + (index % 4) }), vendor))));
    }

    function DashboardPage(props) {
      const t = props.t;
      const locale = props.useLocale((state) => state.active);
      const [tab, setTab] = React.useState('overview');
      const [models, setModels] = React.useState([]);
      const [model, setModel] = React.useState('');
      const [range, setRange] = React.useState('30d');
      const [from, setFrom] = React.useState('');
      const [to, setTo] = React.useState('');
      const [vendors, setVendors] = React.useState([]);
      const [summaries, setSummaries] = React.useState([]);
      const [comparison, setComparison] = React.useState(null);
      const [series, setSeries] = React.useState(null);
      const [showChart, setShowChart] = React.useState(false);
      const [sessions, setSessions] = React.useState([]);
      const [selectedSessions, setSelectedSessions] = React.useState([]);
      const [sessionComparison, setSessionComparison] = React.useState(null);
      const [records, setRecords] = React.useState([]);
      const [recordTotal, setRecordTotal] = React.useState(0);
      const [logQuery, setLogQuery] = React.useState('');
      const [logStatus, setLogStatus] = React.useState('');
      const [logOffset, setLogOffset] = React.useState(0);
      const [metricHelp, setMetricHelp] = React.useState([]);
      const [loading, setLoading] = React.useState(false);
      const [error, setError] = React.useState('');
      const [metricError, setMetricError] = React.useState(false);
      const [refreshKey, setRefreshKey] = React.useState(0);

      React.useEffect(() => {
        const controller = new AbortController();
        getJson('/llm-latency/models.json', controller.signal).then((data) => {
          setModels(data.models || []);

        }).catch((cause) => { if (cause.name !== 'AbortError') setError(t('error.models')); });
        return () => controller.abort();
      }, []);

      React.useEffect(() => {
        const controller = new AbortController();
        getJson('/llm-latency/metrics.json?lang=' + encodeURIComponent(locale === 'en' ? 'en' : 'zh'), controller.signal)
          .then((data) => { setMetricHelp(data.items || []); setMetricError(false); })
          .catch((cause) => { if (cause.name !== 'AbortError') setMetricError(true); });
        return () => controller.abort();
      }, [locale]);

      React.useEffect(() => {
        if (tab !== 'overview') return undefined;
        const timer = window.setInterval(() => setRefreshKey((value) => value + 1), 10000);
        return () => window.clearInterval(timer);
      }, [tab]);

      React.useEffect(() => {
        const controller = new AbortController();
        const params = query({ model, range, from, to, vendors }, true);
        let active = true;
        setLoading(true);
        setError('');
        const run = async () => {
          try {
            if (tab === 'overview') {
              const data = await getJson('/llm-latency/stats.json' + params, controller.signal);
              if (active) setSummaries(data.summaries || []);
            } else if (tab === 'compare') {
              if (!model) { if (active) setComparison(null); return; }
              const data = await getJson('/llm-latency/comparison.json' + params, controller.signal);
              if (active) setComparison(data);
              if (showChart) {
                const chartData = await getJson('/llm-latency/timeseries.json' + params, controller.signal);
                if (active) setSeries(chartData);
              }
            } else if (tab === 'sessions') {
              const data = await getJson('/llm-latency/sessions.json' + query({ model, range, from, to, vendors }, false), controller.signal);
              if (active) setSessions(data.sessions || []);
            } else if (tab === 'log') {
              const logParams = new URLSearchParams({ limit: '50', offset: String(logOffset) });
              if (logQuery) logParams.set('q', logQuery);
              if (logStatus) logParams.set('status', logStatus);
              if (vendors.length === 1) logParams.set('vendor', vendors[0]);
              if (model) logParams.set('model', model);
              const bounds = windowBounds(range, from, to);
              logParams.set('from', String(bounds.from));
              logParams.set('to', String(bounds.to));
              const data = await getJson('/llm-latency/log.json?' + logParams.toString(), controller.signal);
              if (active) { setRecords(data.records || []); setRecordTotal(data.total || 0); }
            }
          } catch (cause) {
            if (active && !(cause && cause.name === 'AbortError')) setError(t('error.load'));
          } finally {
            if (active) setLoading(false);
          }
        };
        run();
        return () => { active = false; controller.abort(); };
      }, [tab, model, range, from, to, vendors, showChart, logQuery, logStatus, logOffset, refreshKey]);

      function toggleVendor(vendor) {
        setVendors((current) => current.includes(vendor) ? current.filter((item) => item !== vendor) : current.concat([vendor]));
      }

      function toggleSession(id) {
        setSelectedSessions((current) => current.includes(id) ? current.filter((item) => item !== id) : current.concat([id]));
      }

      async function compareSelectedSessions() {
        if (selectedSessions.length < 2) { setError(t('error.compare')); return; }
        try {
          setError('');
          const data = await getJson('/llm-latency/sessions-compare.json?ids=' + encodeURIComponent(selectedSessions.join(',')));
          setSessionComparison(data);
        } catch {
          setError(t('error.load'));
        }
      }

      async function refreshChart() {
        if (!model) return;
        try {
          setError('');
          const data = await getJson('/llm-latency/timeseries.json' + query({ model, range, from, to, vendors }, true));
          setSeries(data);
          setShowChart(true);
        } catch {
          setError(t('error.load'));
        }
      }

      async function exportCsv() {
        try {
          const data = await getJson('/llm-latency/stats.json' + query({ model, range, from, to, vendors }, true));
          const header = ['vendor', 'model', 'count', 'okCount', 'failCount', 'ttftP50Ms', 'ttftP95Ms', 'e2eP50Ms', 'ttftTextP50Ms', 'tokensPerSecond', 'outputTokensPerSecond', 'overallTokensPerSecond', 'outputRateSamples', 'overallRateSamples', 'cacheHitPct', 'cacheWritePct'];
          const rows = (data.summaries || []).map((item) => [item.vendor, item.model, item.count, item.okCount, item.failCount, item.ttftP50, item.ttftP95, item.e2eP50, item.ttftTextP50, item.tokensPerSecond, item.outputTokensPerSecond, item.overallTokensPerSecond, item.outputRateSamples, item.overallRateSamples, item.cacheHitPct, item.cacheWritePct]);
          const csv = [header, ...rows].map((row) => row.map((cell) => '"' + String(cell === null || cell === undefined ? '' : cell).replace(/"/g, '""') + '"').join(',')).join('\r\n');
          const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'llm-latency.csv';
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
          setError(t('error.load'));
        }
      }

      const tabButtons = ['overview', 'compare', 'sessions', 'log'].map((id) => h('button', {
        key: id, type: 'button', className: 'llm-latency-tab', role: 'tab',
        'aria-selected': tab === id, onClick: () => { setTab(id); setError(''); },
      }, t('tab.' + id)));

      const filterBar = h('div', { className: 'llm-latency-toolbar' },
        h('label', { className: 'llm-latency-field' }, t('filter.model'),
          h('select', { className: 'llm-latency-control', value: model, onChange: (event) => setModel(event.target.value) },
            h('option', { value: '' }, t('filter.allModels')),
            models.map((item) => h('option', { key: item.model, value: item.model }, item.model)))),
        h('label', { className: 'llm-latency-field' }, t('filter.range'),
          h('select', { className: 'llm-latency-control', value: range, onChange: (event) => setRange(event.target.value) },
            ['1h', '24h', '7d', '30d', 'today', 'custom'].map((item) => h('option', { key: item, value: item }, t('filter.' + item))))),
        range === 'custom' ? h('label', { className: 'llm-latency-field' }, t('filter.from'), h('input', { className: 'llm-latency-control', type: 'datetime-local', value: from, onChange: (event) => setFrom(event.target.value) })) : null,
        range === 'custom' ? h('label', { className: 'llm-latency-field' }, t('filter.to'), h('input', { className: 'llm-latency-control', type: 'datetime-local', value: to, onChange: (event) => setTo(event.target.value) })) : null,
        h('button', { type: 'button', className: 'llm-latency-button', disabled: loading, onClick: () => setRefreshKey((value) => value + 1) }, loading ? '…' : t('action.refresh')),
        h('button', { type: 'button', className: 'llm-latency-button', onClick: exportCsv }, t('action.export')));

      const vendorBar = h('div', { className: 'llm-latency-vendors', 'aria-label': t('filter.vendors') },
        vendors.length ? h('span', { className: 'llm-latency-muted' }, t('filter.vendors') + ':') : null,
        Array.from(new Set(models.flatMap((item) => item.vendors))).sort().map((vendor) => h('label', { className: 'llm-latency-vendor', key: vendor },
          h('input', { type: 'checkbox', checked: vendors.includes(vendor), onChange: () => toggleVendor(vendor) }), vendor)));

      const helpSection = h('details', { className: 'llm-latency-metric-help' },
        h('summary', null, t('help.title')),
        metricError ? h('div', { className: 'llm-latency-empty' }, t('empty.help'))
          : h(Table, { t, headers: [t('help.metric'), t('help.explanation')], rows: metricHelp.map((item, index) => ({ key: 'metric-' + index, cells: [item.name, item.explanation] })), empty: t('empty.help') }));

      let body;
      if (tab === 'overview') {
        body = h('section', { className: 'llm-latency-section' },
          h('h2', { className: 'llm-latency-section-title' }, t('overview.heading')),
          h(Table, { t,
            headers: [t('column.vendorModel'), t('column.samples'), metricHeader(t, 'column.ttft50'), t('column.ttft95'), t('column.e2e50'), metricHeader(t, 'column.firstText50'), metricHeader(t, 'column.totalRate'), t('column.outputRate'), t('column.overallRate'), t('column.rateSamples'), t('column.cacheHit'), t('column.cacheWrite'), t('column.failures')],
            rows: summaries.map((item) => ({ key: item.vendor + '|' + item.model, cells: [item.vendor + ' · ' + item.model, item.okCount + '/' + item.count, formatMs(item.ttftP50), formatMs(item.ttftP95), formatMs(item.e2eP50), formatMs(item.ttftTextP50), formatRate(item.tokensPerSecond ?? (item.ok && item.e2eMs > item.ttftMs && item.ttftMs !== null ? item.outputTokens * 1000 / (item.e2eMs - item.ttftMs) : null)), formatRate(item.outputTokensPerSecond), formatRate(item.overallTokensPerSecond), (item.outputRateSamples || 0) + '/' + (item.overallRateSamples || 0), formatPercent(item.cacheHitPct), formatPercent(item.cacheWritePct), errorSummary(item, t)] })),
          }));
      } else if (tab === 'compare') {
        if (!model) body = h('div', { className: 'llm-latency-empty' }, t('empty.chooseModel'));
        else if (comparison) {
          const withCi = comparison.rows.filter((row) => row.medianCi !== null);
          const significant = new Set();
          for (let i = 0; i < withCi.length; i += 1) for (let j = i + 1; j < withCi.length; j += 1) {
            const a = withCi[i].medianCi, b = withCi[j].medianCi;
            if (a.hi < b.lo || b.hi < a.lo) { significant.add(withCi[i].vendor); significant.add(withCi[j].vendor); }
          }
          const rows = comparison.rows.map((row) => {
            const status = row.medianCi === null ? t('warning.weakEvidence') : significant.has(row.vendor) ? t('warning.significant') : t('warning.notSignificant');
            return { key: row.vendor, cells: [row.vendor, row.summary.okCount + '/' + row.summary.count, formatMs(row.summary.ttftP50), formatMs(row.summary.ttftP90), formatMs(row.summary.ttftP95), formatMs(row.summary.ttftP99), formatMs(row.summary.e2eP50), formatMs(row.summary.ttftTextP50), formatRate(row.summary.tokensPerSecond), formatRate(row.summary.outputTokensPerSecond), formatRate(row.summary.overallTokensPerSecond), (row.summary.outputRateSamples || 0) + '/' + (row.summary.overallRateSamples || 0), formatPercent(row.summary.cacheHitPct), formatPercent(row.summary.cacheWritePct), errorSummary(row.summary, t), status] };
          });
          body = h(React.Fragment, null,
            h('section', { className: 'llm-latency-section' },
              h('h2', { className: 'llm-latency-section-title' }, t('compare.heading') + ' · ' + model),
              h(Table, { t, headers: [t('column.vendor'), t('column.samples'), metricHeader(t, 'column.ttft50'), t('column.ttft90'), t('column.ttft95'), t('column.ttft99'), t('column.e2e50'), metricHeader(t, 'column.firstText50'), metricHeader(t, 'column.totalRate'), t('column.outputRate'), t('column.overallRate'), t('column.rateSamples'), t('column.cacheHit'), t('column.cacheWrite'), t('column.failures'), t('column.significance')], rows })),
            comparison.warnings.map((warning, index) => h('div', { key: 'warn' + index, className: 'llm-latency-warning' }, warning)),
            h('button', { type: 'button', className: 'llm-latency-button', onClick: refreshChart }, t('action.chart')),
            showChart ? h(Chart, { data: series, t }) : null);
        } else body = h('div', { className: 'llm-latency-empty' }, loading ? '…' : t('empty.noSamples'));
      } else if (tab === 'sessions') {
        const sessionRows = sessions.map((item) => ({ key: item.id, cells: [
          h('input', { type: 'checkbox', checked: selectedSessions.includes(item.id), onChange: () => toggleSession(item.id), 'aria-label': item.id }),
          item.id.slice(0, 8), item.vendor + ' · ' + item.model + (item.singleModel ? '' : ' ⚠'),
          formatDate(item.firstTs) + ' ~ ' + formatDate(item.lastTs), item.calls,
          formatMs(item.firstCallTtftMs), item.firstCallInputTokens, formatMs(item.ttftP50),
          formatRate(item.tokensPerSecond ?? (item.ok && item.e2eMs > item.ttftMs && item.ttftMs !== null ? item.outputTokens * 1000 / (item.e2eMs - item.ttftMs) : null)), formatRate(item.outputTokensPerSecond), formatRate(item.overallTokensPerSecond),
          (item.outputRateSamples || 0) + '/' + (item.overallRateSamples || 0), formatPercent(item.cacheHitPct), item.failCount,
        ] }));
        body = h(React.Fragment, null,
          h('section', { className: 'llm-latency-section' },
            h('h2', { className: 'llm-latency-section-title' }, t('sessions.heading')),
            h(Table, { t, headers: [t('column.select'), t('column.session'), t('column.vendorModel'), t('column.startEnd'), t('column.calls'), metricHeader(t, 'column.firstCallTtft'), t('column.firstCallInput'), metricHeader(t, 'column.ttftP50'), metricHeader(t, 'column.totalRate'), t('column.outputRate'), t('column.overallRate'), t('column.rateSamples'), t('column.cacheHit'), t('column.failures')], rows: sessionRows, empty: t('empty.noSessions') }),
            h('div', { className: 'llm-latency-footer' },
              h('span', null, t('sessions.selected', { count: selectedSessions.length })),
              h('button', { type: 'button', className: 'llm-latency-button', onClick: compareSelectedSessions }, t('action.compareSessions')))),
          sessionComparison ? h('section', { className: 'llm-latency-section' },
            h('h2', { className: 'llm-latency-section-title' }, t('sessions.compareHeading')),
            sessionComparison.warnings.map((warning, index) => h('div', { key: 'sw' + index, className: 'llm-latency-warning' }, warning)),
            h(Table, { t, headers: [t('column.session'), t('column.vendorModel'), t('column.calls'), metricHeader(t, 'column.firstCallTtft'), t('column.firstCallInput'), metricHeader(t, 'column.ttftP50'), metricHeader(t, 'column.ttftP95'), metricHeader(t, 'column.totalRate'), t('column.outputRate'), t('column.overallRate'), t('column.rateSamples'), t('column.cacheHit'), t('column.failures')], rows: sessionComparison.rows.map((row) => ({ key: row.summary.id, cells: [row.summary.id.slice(0, 8), row.summary.vendor + ' · ' + row.summary.model, row.summary.okCount + '/' + row.summary.calls, formatMs(row.summary.firstCallTtftMs), row.summary.firstCallInputTokens, formatMs(row.summary.ttftP50), formatMs(row.summary.ttftP95), formatRate(row.summary.tokensPerSecond), formatRate(row.summary.outputTokensPerSecond), formatRate(row.summary.overallTokensPerSecond), (row.summary.outputRateSamples || 0) + '/' + (row.summary.overallRateSamples || 0), formatPercent(row.summary.cacheHitPct), row.summary.failCount] })) })) : null);
      } else {
        const statuses = ['', 'ok', 'fail', 'rateLimited', 'timeout', 'server', 'aborted'];
        body = h(React.Fragment, null,
          h('div', { className: 'llm-latency-toolbar' },
            h('label', { className: 'llm-latency-field', style: { flex: '1 1 260px' } }, t('log.heading'),
              h('input', { className: 'llm-latency-control', value: logQuery, placeholder: t('log.searchPlaceholder'), onChange: (event) => { setLogQuery(event.target.value); setLogOffset(0); } })),
            h('label', { className: 'llm-latency-field' }, t('column.status'),
              h('select', { className: 'llm-latency-control', value: logStatus, onChange: (event) => { setLogStatus(event.target.value); setLogOffset(0); } },
                statuses.map((status) => h('option', { key: status || 'all', value: status }, status ? t('status.' + status) : t('log.statusAll'))))),
            h('button', { type: 'button', className: 'llm-latency-button', onClick: () => setRefreshKey((value) => value + 1) }, t('action.search'))),
          h(Table, { t, headers: [t('column.time'), t('column.vendor'), t('column.model'), t('column.session'), t('column.requestId'), t('column.key'), metricHeader(t, 'column.firstToken'), metricHeader(t, 'column.firstText'), t('column.e2e'), metricHeader(t, 'column.totalRate'), t('column.outputRate'), t('column.overallRate'), t('column.inputTokens'), t('column.outputTokens'), t('column.cache'), t('column.status')], rows: records.map((item) => ({ key: item.ts + ':' + item.requestId, cells: [formatDate(item.ts), item.vendor, item.model, item.sessionId ? item.sessionId.slice(0, 8) : '—', item.requestId || '—', item.credentialRef || '—', formatMs(item.ttftMs), formatMs(item.ttftTextMs), formatMs(item.e2eMs), formatRate(item.tokensPerSecond ?? (item.ok && item.e2eMs > item.ttftMs && item.ttftMs !== null ? item.outputTokens * 1000 / (item.e2eMs - item.ttftMs) : null)), formatRate(item.outputTokensPerSecond), formatRate(item.overallTokensPerSecond), item.inputTokens, item.outputTokens, formatPercent(item.inputTokens + item.cacheReadTokens + item.cacheWriteTokens > 0 ? item.cacheReadTokens / (item.inputTokens + item.cacheReadTokens + item.cacheWriteTokens) : null), statusLabel(item, t)] })) }),
          h('div', { className: 'llm-latency-footer' },
            h('span', null, t('count.page', { total: recordTotal, page: Math.floor(logOffset / 50) + 1 })),
            h('span', null,
              h('button', { type: 'button', className: 'llm-latency-button', disabled: logOffset === 0, onClick: () => setLogOffset((offset) => Math.max(0, offset - 50)) }, t('action.previous')),
              ' ',
              h('button', { type: 'button', className: 'llm-latency-button', disabled: logOffset + 50 >= recordTotal, onClick: () => setLogOffset((offset) => offset + 50) }, t('action.next')))));
      }

      return h(React.Fragment, null,
        h('style', null, CSS),
        h('main', { className: 'llm-latency-page' },
          h('header', { className: 'llm-latency-heading' },
            h('div', null, h('h1', { className: 'llm-latency-title' }, t('title')), h('p', { className: 'llm-latency-subtitle' }, t('subtitle'))),
            h('span', { className: 'llm-latency-passive' }, t('recording'))),
          h('nav', { className: 'llm-latency-tabs', role: 'tablist' }, tabButtons),
          filterBar,
          vendorBar,
          h(ErrorNotice, { message: error, onRetry: () => setRefreshKey((value) => value + 1), t }),
          helpSection,
          h('div', { className: 'llm-latency-results', role: 'tabpanel' },
            tab === 'overview' && summaries.length > 0 && summaries.every(item => !item.outputRateSamples && !item.overallRateSamples)
              ? h('p', { className: 'llm-latency-subtitle' }, t('throughput.unavailable')) : null,
            body)));
    }

    function SidebarMark({ size }) {
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M4 4v16h16M8 16v-4m5 4V8m5 8V5' }));
    }

    function ComposerEntry(props) {
      const open = props.usePanelState((state) => state.open);
      return h(React.Fragment, null,
        h('style', null, CSS),
        h('button', { type: 'button', className: 'llm-latency-entry', title: props.t('entry.title'), 'aria-pressed': open, onClick: props.openPanel }, props.t('entry.label')));
    }

    function QuickPanel(props) {
      const t = props.t;
      const locale = props.useLocale((state) => state.active);
      const open = props.usePanelState((state) => state.open);
      const [recent, setRecent] = React.useState([]);
      const [minutes, setMinutes] = React.useState(15);
      const [error, setError] = React.useState('');
      const [refreshKey, setRefreshKey] = React.useState(0);
      const dialogRef = React.useRef(null);

      React.useEffect(() => {
        if (!open) return undefined;
        const previous = document.activeElement;
        if (dialogRef.current) dialogRef.current.focus();
        return () => {
          if (previous && document.contains(previous) && typeof previous.focus === 'function') previous.focus();
        };
      }, [open]);

      React.useEffect(() => {
        if (!open) return undefined;
        const controller = new AbortController();
        let active = true;
        const load = async () => {
          try {
            setError('');
            const data = await getJson('/llm-latency/recent.json?minutes=' + minutes, controller.signal);
            if (!active) return;
            setRecent(data.rows || []);
          } catch (cause) {
            if (active && !(cause && cause.name === 'AbortError')) setError(t('error.load'));
          }
        };
        load();
        const timer = window.setInterval(() => setRefreshKey((value) => value + 1), 10000);
        return () => { active = false; controller.abort(); window.clearInterval(timer); };
      }, [open, refreshKey, locale, minutes]);

      React.useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); props.closePanel(); }
          if (event.key === 'Tab' && dialogRef.current) {
            const targets = Array.from(dialogRef.current.querySelectorAll('button:not(:disabled), input, select, [tabindex="0"]'));
            const first = targets[0], last = targets[targets.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); if (last) last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); if (first) first.focus(); }
          }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, [open, props.closePanel]);

      if (!open) return null;
      return h('div', { className: 'llm-latency-backdrop', onPointerDown: (event) => { if (event.target === event.currentTarget) props.closePanel(); } },
        h('div', { className: 'llm-latency-mask' }),
        h('section', { className: 'llm-latency-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('title'), tabIndex: -1, ref: dialogRef },
          h('style', null, CSS),
          h('header', { className: 'llm-latency-dialog-head' },
            h('div', null, h('h2', { className: 'llm-latency-title' }, t('title')), h('p', { className: 'llm-latency-subtitle' }, t('recording'))),
            h('button', { type: 'button', className: 'llm-latency-button', onClick: props.closePanel }, t('action.close'))),
          h('div', { className: 'llm-latency-dialog-body' },
            h(ErrorNotice, { message: error, onRetry: () => setRefreshKey((value) => value + 1), t }),
            h('div', { className: 'llm-latency-toolbar' },
              h('label', { className: 'llm-latency-field' }, t('recent.window'),
                h('select', { className: 'llm-latency-control', value: minutes, onChange: event => setMinutes(Number(event.target.value)) },
                  [15, 60, 180].map(value => h('option', { key: value, value }, t('recent.' + value))))),
              h('button', { type: 'button', className: 'llm-latency-button', onClick: () => setRefreshKey(value => value + 1) }, t('action.refresh'))),
            h('p', { className: 'llm-latency-subtitle' }, t('recent.note')),
            h('section', { className: 'llm-latency-section' },
              h('h3', { className: 'llm-latency-section-title' }, t('recent.title')),
              h(Table, { t,
                headers: [t('column.vendorModel'), metricHeader(t, 'recent.last'), metricHeader(t, 'recent.median'), metricHeader(t, 'recent.firstText'), t('column.samples'), t('recent.sampled'), t('column.status')],
                rows: recent.map(item => ({ key: item.vendor + '|' + item.model,
                  cells: [item.vendor + ' · ' + item.model,
                    item.latest ? formatMs(item.latest.ttftMs) : '—',
                    formatMs(item.medianTtftMs), formatMs(item.medianFirstTextMs),
                    item.okCount + '/' + item.count, formatDate(item.lastSeen),
                    item.latest ? statusLabel(item.latest, t) : t('recent.idle')],
                })), empty: t('empty.noSamples') }))),
          h('footer', { className: 'llm-latency-dialog-foot' },
            h('button', { type: 'button', className: 'llm-latency-button llm-latency-button-primary', onClick: props.openDashboard }, t('action.openFull')))));
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'llm-latency: dictionaries');
      const t = ctx.locale.bind(NS);
      const localeSource = {
        getSnapshot: () => ctx.locale.getSnapshot(),
        subscribe: (listener) => ctx.locale.subscribe(listener),
      };
      let snapshot = { open: false };
      const listeners = new Set();
      const panelState = {
        getSnapshot: () => snapshot,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      };
      const setOpen = open => {
        if (snapshot.open === open) return;
        snapshot = { open };
        listeners.forEach(listener => listener());
      };
      const openPanel = () => setOpen(true);
      const closePanel = () => setOpen(false);
      const openDashboard = () => {
        closePanel();
        ctx.layout.selectPanel(PANEL_ID);
      };

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main', key: PANEL_ID, locale: NS,
        inject: () => ({ hooks: { locale: localeSource } }),
      }, DashboardPage));
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: PANEL_ID, order: 15, locale: NS,
        label: () => t('sidebar.label'),
      }, SidebarMark));
      ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
        name: 'conversation.input.left', id: 'llm-latency-entry', order: 20, locale: NS,
        inject: () => ({ hooks: { panelState }, openPanel }),
      }, ComposerEntry));
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay', id: 'llm-latency-quick-panel', order: 20, locale: NS,
        inject: () => ({ hooks: { panelState, locale: localeSource }, closePanel, openDashboard }),
      }, QuickPanel));
    }

    return { inject: ['slots', 'locale', 'layout'], apply };
  },
});
