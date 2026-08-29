/**
 * Self-contained HTML dashboard served at `/llm-latency/`. Plain HTML/CSS/JS;
 * it fetches the same JSON endpoints the REST surface exposes, so there is no
 * client bundle and no slot-prop coupling. Embedded JS deliberately avoids
 * template literals so it survives string interpolation.
 */
export function renderDashboardHtml() {
    return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>LLM 观测台</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f5f6f8;
    --card: #ffffff;
    --border: #e6e8ee;
    --border-strong: #d6dae3;
    --text: #161a23;
    --muted: #6b7280;
    --accent: #4f46e5;
    --accent-strong: #4338ca;
    --accent-soft: #eef2ff;
    --ok: #059669;
    --ok-soft: #d1fae5;
    --warn: #b45309;
    --warn-soft: #fef3c7;
    --danger: #dc2626;
    --danger-soft: #fee2e2;
    --neutral-soft: #eef0f4;
    --radius: 14px;
    --shadow: 0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.08);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0c0f17;
      --card: #151a27;
      --border: #232a3b;
      --border-strong: #2e3750;
      --text: #e7eaf2;
      --muted: #8a93a8;
      --accent: #818cf8;
      --accent-strong: #6366f1;
      --accent-soft: #1c2138;
      --ok: #34d399;
      --ok-soft: #0e2f24;
      --warn: #fbbf24;
      --warn-soft: #33270a;
      --danger: #f87171;
      --danger-soft: #3b1516;
      --neutral-soft: #1c2230;
      --shadow: 0 1px 2px rgba(0,0,0,.4), 0 2px 6px rgba(0,0,0,.35);
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }
  .shell { max-width: 1280px; margin: 0 auto; padding: 28px 24px 64px; }
  .header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -.02em; }
  .header .sub { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
  .live { display: inline-flex; align-items: center; gap: 7px; color: var(--muted); font-size: 12px; padding: 5px 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--card); }
  .live .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); animation: pulse 2.2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }

  .tabs { display: inline-flex; gap: 4px; padding: 4px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); margin-bottom: 14px; }
  .tabs button { border: none; background: transparent; color: var(--muted); font-size: 14px; font-weight: 500; padding: 8px 18px; border-radius: 8px; cursor: pointer; transition: color .12s, background .12s; }
  .tabs button:hover { color: var(--text); }
  .tabs button.active { background: var(--accent); color: #fff; }

  .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 14px 16px; margin-bottom: 12px; }
  .field { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--muted); }
  input, select { font-size: 13px; color: var(--text); background: var(--card); border: 1px solid var(--border-strong); border-radius: 8px; padding: 7px 10px; }
  input:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .btn { font-size: 13px; font-weight: 500; color: var(--text); background: var(--card); border: 1px solid var(--border-strong); border-radius: 8px; padding: 7px 14px; cursor: pointer; transition: background .12s, border-color .12s; }
  .btn:hover { background: var(--neutral-soft); }
  .btn.primary { background: var(--accent); border-color: transparent; color: #fff; }
  .btn.primary:hover { background: var(--accent-strong); }

  .vendors { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
  .vendors label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); padding: 4px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--card); cursor: pointer; user-select: none; }
  .vendors label:has(input:checked) { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
  .vendors input { accent-color: var(--accent); margin: 0; }

  .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 6px 0; margin-bottom: 14px; }
  .card h2 { margin: 0; padding: 14px 18px 10px; font-size: 15px; font-weight: 650; }

  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th { position: sticky; top: 0; background: var(--card); color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; text-align: right; padding: 10px 16px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  th:first-child, td:first-child { text-align: left; }
  td { padding: 10px 16px; border-bottom: 1px solid var(--border); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  td:first-child { font-variant-numeric: normal; }
  tbody tr { transition: background .08s; }
  tbody tr:hover { background: var(--accent-soft); }
  tbody tr:last-child td { border-bottom: none; }

  .badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 18px; }
  .badge.ok { color: var(--ok); background: var(--ok-soft); }
  .badge.rateLimited { color: var(--warn); background: var(--warn-soft); }
  .badge.timeout, .badge.server, .badge.fail { color: var(--danger); background: var(--danger-soft); }
  .badge.aborted, .badge.other { color: var(--muted); background: var(--neutral-soft); }
  .muted { color: var(--muted); }
  .sig-yes { color: var(--ok); font-weight: 600; }
  .sig-weak { color: var(--muted); }

  .empty { text-align: center; color: var(--muted); padding: 48px 20px; font-size: 14px; }
  .warn { color: var(--warn); font-size: 12.5px; margin: 8px 2px; }
  .hint { color: var(--muted); font-size: 12px; margin: 8px 2px; }

  .chart { width: 100%; height: 300px; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 8px 4px; font-size: 12px; color: var(--muted); }
  .legend .item { display: inline-flex; align-items: center; gap: 6px; }
  .legend .swatch { width: 10px; height: 10px; border-radius: 3px; }
</style>
</head>
<body>
<div class="shell">
  <header class="header">
    <div>
      <h1>LLM 观测台</h1>
      <p class="sub">厂商延迟对比 · 缓存命中率 · 请求日志</p>
    </div>
    <div class="live"><span class="dot"></span>被动记录中</div>
  </header>

  <nav class="tabs" id="tabs">
    <button data-view="overview" class="active">总览</button>
    <button data-view="compare">时段对比</button>
    <button data-view="sessions">会话对比</button>
    <button data-view="log">请求日志</button>
  </nav>

  <div class="toolbar">
    <label class="field">模型
      <select id="modelSel"><option value="">全部</option></select>
    </label>
    <label class="field">时段
      <select id="rangeSel">
        <option value="all" selected>全部</option>
        <option value="1h">最近 1 小时</option>
        <option value="24h">最近 24 小时</option>
        <option value="7d">最近 7 天</option>
        <option value="today">今天</option>
        <option value="custom">自定义</option>
      </select>
    </label>
    <label class="field">从 <input id="from" type="datetime-local" /></label>
    <label class="field">到 <input id="to" type="datetime-local" /></label>
    <button class="btn primary" id="refresh">刷新</button>
    <button class="btn" id="export">导出 CSV</button>
  </div>

  <div class="vendors" id="vendors"></div>
  <div id="content"></div>
</div>

<script>
(function () {
  var view = 'overview';
  var models = [];
  var vendors = [];
  var selectedVendors = [];
  var lastData = null;
  var COLORS = ['#6366f1', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6'];

  function el(tag, cls) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
  }
  function ms(v) {
    if (v === null || v === undefined) return '—';
    return v < 1000 ? Math.round(v) + 'ms' : (v / 1000).toFixed(2) + 's';
  }
  function pct(v) {
    if (v === null || v === undefined) return '—';
    return (v * 100).toFixed(1) + '%';
  }
  function tps(v) {
    return (v === null || v === undefined) ? '—' : v.toFixed(1);
  }
  function cacheHit(s) {
    var billed = s.inputTokens + s.cacheReadTokens + s.cacheWriteTokens;
    if (billed <= 0) return null;
    return s.cacheReadTokens / billed;
  }
  function errorSummary(s) {
    var t = s.count || (s.okCount + s.failCount);
    if (t === 0) return '0';
    var parts = [];
    if (s.errors.rateLimited > 0) parts.push('429 ' + Math.round(s.errors.rateLimited / t * 100) + '%');
    if (s.errors.timeout > 0) parts.push('超时 ' + Math.round(s.errors.timeout / t * 100) + '%');
    if (s.errors.server > 0) parts.push('5xx ' + Math.round(s.errors.server / t * 100) + '%');
    if (s.errors.aborted > 0) parts.push('中止 ' + Math.round(s.errors.aborted / t * 100) + '%');
    return parts.length === 0 ? '0' : parts.join(' · ');
  }
  function statusBadge(s) {
    var kind = s.ok ? 'ok' : (s.errorKind || 'other');
    var label = kind === 'ok' ? '成功' : kind === 'rateLimited' ? '429 限流' : kind === 'timeout' ? '超时' : kind === 'server' ? '5xx' : kind === 'aborted' ? '中止' : '失败';
    var b = el('span', 'badge ' + kind);
    b.textContent = label;
    return b;
  }
  function makeTable(headers, rows) {
    var wrap = el('div', 'table-wrap');
    var table = el('table');
    var thead = el('thead');
    var tr = el('tr');
    for (var i = 0; i < headers.length; i++) { var th = el('th'); th.textContent = headers[i]; tr.appendChild(th); }
    thead.appendChild(tr); table.appendChild(thead);
    var tbody = el('tbody');
    for (var r = 0; r < rows.length; r++) {
      var tr2 = el('tr');
      for (var c = 0; c < rows[r].length; c++) {
        var td = el('td');
        var cell = rows[r][c];
        if (cell === null || cell === undefined) td.textContent = '—';
        else if (typeof cell === 'string' || typeof cell === 'number') td.textContent = cell;
        else td.appendChild(cell);
        tr2.appendChild(td);
      }
      tbody.appendChild(tr2);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }
  function empty(msg) {
    var e = el('div', 'empty');
    e.textContent = msg;
    return e;
  }
  function card(title) {
    var c = el('div', 'card');
    if (title) { var h = el('h2'); h.textContent = title; c.appendChild(h); }
    return c;
  }
  function qs() {
    var p = [];
    var model = document.getElementById('modelSel').value;
    if (model) p.push('model=' + encodeURIComponent(model));
    if (selectedVendors.length > 0) p.push('vendors=' + encodeURIComponent(selectedVendors.join(',')));
    return p.length > 0 ? '?' + p.join('&') : '';
  }
  function windowQs() {
    var w = currentWindow();
    var p = ['from=' + w.from, 'to=' + w.to];
    var model = document.getElementById('modelSel').value;
    if (model) p.push('model=' + encodeURIComponent(model));
    if (selectedVendors.length > 0) p.push('vendors=' + encodeURIComponent(selectedVendors.join(',')));
    return '?' + p.join('&');
  }
  function currentWindow() {
    var range = document.getElementById('rangeSel').value;
    var to = Date.now();
    var from = to - 30 * 24 * 3600 * 1000;
    if (range === '1h') from = to - 3600 * 1000;
    else if (range === '24h') from = to - 24 * 3600 * 1000;
    else if (range === '7d') from = to - 7 * 24 * 3600 * 1000;
    else if (range === 'today') { var d = new Date(); d.setHours(0, 0, 0, 0); from = d.getTime(); }
    else if (range === 'custom') {
      var f = document.getElementById('from').value;
      var t = document.getElementById('to').value;
      if (f) from = new Date(f).getTime();
      if (t) to = new Date(t).getTime();
    }
    return { from: from, to: to };
  }

  function renderOverview() {
    fetch('/llm-latency/stats.json' + windowQs())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        lastData = d.summaries;
        var box = document.getElementById('content');
        box.innerHTML = '';
        if (!d.summaries || d.summaries.length === 0) { box.appendChild(empty('该时段暂无采样数据。')); return; }
        var rows = [];
        for (var i = 0; i < d.summaries.length; i++) {
          var s = d.summaries[i];
          rows.push([s.vendor + ' · ' + s.model, s.okCount + '/' + s.count,
            ms(s.ttftP50), ms(s.ttftP95), ms(s.e2eP50), tps(s.tokensPerSecond),
            pct(s.cacheHitPct), pct(s.cacheWritePct), errorSummary(s)]);
        }
        var c = card('厂商 · 模型 延迟排行');
        c.appendChild(makeTable(['厂商 / 模型', '样本', '首token p50', '首token p95', '端到端 p50', 'tok/s', '缓存命中', '缓存写入', '失败'], rows));
        box.appendChild(c);
      })
      .catch(function () {});
  }

  function renderCompare() {
    var model = document.getElementById('modelSel').value;
    var box = document.getElementById('content');
    box.innerHTML = '';
    if (!model) { box.appendChild(empty('请先在上方选择一个模型，再跨厂商对比。')); return; }
    fetch('/llm-latency/comparison.json' + windowQs())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var rows = [];
        var sigSet = {};
        var withCi = [];
        for (var i = 0; i < d.rows.length; i++) { if (d.rows[i].medianCi !== null) withCi.push(d.rows[i]); }
        for (var a = 0; a < withCi.length; a++) {
          for (var b = a + 1; b < withCi.length; b++) {
            var x = withCi[a].medianCi; var y = withCi[b].medianCi;
            if (x.hi < y.lo || y.hi < x.lo) { sigSet[withCi[a].vendor] = true; sigSet[withCi[b].vendor] = true; }
          }
        }
        for (var i = 0; i < d.rows.length; i++) {
          var r = d.rows[i];
          var s = r.summary;
          var sigCell;
          if (r.medianCi === null) { sigCell = el('span', 'sig-weak'); sigCell.textContent = '证据不足'; }
          else if (sigSet[r.vendor]) { sigCell = el('span', 'sig-yes'); sigCell.textContent = '差异显著'; }
          else { sigCell = el('span', 'sig-weak'); sigCell.textContent = '无显著差异'; }
          rows.push([s.vendor, s.okCount + '/' + s.count, ms(s.ttftP50), ms(s.ttftP90), ms(s.ttftP95), ms(s.ttftP99),
            ms(s.e2eP50), tps(s.tokensPerSecond), pct(s.cacheHitPct), pct(s.cacheWritePct), errorSummary(s), sigCell]);
        }
        var c = card('同模型跨厂商对比 · ' + model);
        c.appendChild(makeTable(['厂商', '样本', 'TTFT p50', 'p90', 'p95', 'p99', '端到端 p50', 'tok/s', '缓存命中', '缓存写入', '失败', '显著性'], rows));
        box.appendChild(c);
        for (var w = 0; w < d.warnings.length; w++) {
          var wn = el('div', 'warn'); wn.textContent = '⚠ ' + d.warnings[w]; box.appendChild(wn);
        }
        var btn = el('button', 'btn'); btn.textContent = '显示 TTFT 时间曲线'; btn.style.marginTop = '10px';
        btn.onclick = function () { renderChart(model); };
        box.appendChild(btn);
      })
      .catch(function () {});
  }

  function renderChart(model) {
    var existing = document.getElementById('chartBox');
    var box = existing || el('div');
    if (!existing) { box.id = 'chartBox'; document.getElementById('content').appendChild(box); }
    box.innerHTML = '';
    fetch('/llm-latency/timeseries.json' + windowQs())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var byVendor = {};
        var hourSet = {};
        for (var i = 0; i < d.series.length; i++) {
          var s = d.series[i];
          (byVendor[s.vendor] = byVendor[s.vendor] || {})[s.hour] = s.ttftP50;
          hourSet[s.hour] = true;
        }
        var hs = Object.keys(hourSet).map(Number).sort(function (a, b) { return a - b; });
        if (hs.length === 0) { box.appendChild(empty('无时序数据。')); return; }
        var W = 1160, H = 300, padL = 58, padR = 18, padT = 16, padB = 30;
        var minH = hs[0], maxH = hs[hs.length - 1];
        var maxY = 0;
        for (var v in byVendor) for (var h in byVendor[v]) if (byVendor[v][h] !== null && byVendor[v][h] > maxY) maxY = byVendor[v][h];
        if (maxY <= 0) maxY = 1;
        function px(h) { return padL + (h - minH) / Math.max(1, (maxH - minH)) * (W - padL - padR); }
        function py(y) { return H - padB - (y / maxY) * (H - padT - padB); }
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'chart');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        function text(x, y, str, fill, anchor) {
          var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          t.setAttribute('x', x); t.setAttribute('y', y);
          t.style.fill = fill; t.style.fontSize = '11px';
          t.setAttribute('text-anchor', anchor || 'middle');
          t.textContent = str;
          return t;
        }
        function line(x1, y1, x2, y2, stroke, width, dash) {
          var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
          l.style.stroke = stroke; l.style.strokeWidth = String(width || 1);
          if (dash) l.style.strokeDasharray = dash;
          return l;
        }
        for (var g = 0; g <= 4; g++) {
          var val = maxY * g / 4;
          var y = py(val);
          svg.appendChild(line(padL, y, W - padR, y, 'var(--border)', 1, '3 4'));
          svg.appendChild(text(padL - 8, y + 4, ms(val), 'var(--muted)', 'end'));
        }
        var labelStep = Math.max(1, Math.ceil((maxH - minH) / 8));
        for (var i2 = 0; i2 < hs.length; i2++) {
          var h = hs[i2];
          if ((h - minH) % labelStep !== 0) continue;
          var d2 = new Date(h * 3600 * 1000);
          var hh = ('0' + d2.getHours()).slice(-2);
          svg.appendChild(text(px(h), H - 8, hh + ':00', 'var(--muted)'));
        }
        var ci = 0;
        var legend = el('div', 'legend');
        for (var v2 in byVendor) {
          var color = COLORS[ci % COLORS.length]; ci += 1;
          var pts = [];
          for (var i3 = 0; i3 < hs.length; i3++) {
            var val = byVendor[v2][hs[i3]];
            if (val === null || val === undefined) continue;
            pts.push(px(hs[i3]).toFixed(1) + ',' + py(val).toFixed(1));
          }
          if (pts.length > 0) {
            var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            poly.setAttribute('points', pts.join(' '));
            poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', color); poly.setAttribute('stroke-width', '2.5');
            poly.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(poly);
          }
          var item = el('span', 'item');
          var sw = el('span', 'swatch'); sw.style.background = color;
          var name = el('span'); name.textContent = v2;
          item.appendChild(sw); item.appendChild(name);
          legend.appendChild(item);
        }
        box.appendChild(svg);
        legend.insertBefore(el('span', 'muted'), legend.firstChild).textContent = 'TTFT p50 · ';
        box.appendChild(legend);
      })
      .catch(function () {});
  }

  function renderSessions() {
    var box = document.getElementById('content');
    box.innerHTML = '';
    fetch('/llm-latency/sessions.json' + qs())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.sessions || d.sessions.length === 0) { box.appendChild(empty('暂无会话数据。会话维度从 v2 起累积。')); return; }
        var list = d.sessions;
        var rows = [];
        for (var i = 0; i < list.length; i++) {
          var s = list[i];
          var cb = el('input'); cb.type = 'checkbox'; cb.value = s.id;
          rows.push([cb, s.id.slice(0, 8),
            s.vendor + ' · ' + s.model + (s.singleModel ? '' : ' ⚠换模'),
            new Date(s.firstTs).toLocaleString() + ' ~ ' + new Date(s.lastTs).toLocaleString(),
            String(s.calls), ms(s.firstCallTtftMs), String(s.firstCallInputTokens),
            ms(s.ttftP50), pct(s.cacheHitPct), String(s.failCount)]);
        }
        var c = card('会话列表');
        c.appendChild(makeTable(['选', '会话', '厂商 · 模型', '起止时间', '调用', '首轮TTFT', '首轮输入tok', 'TTFT p50', '缓存命中', '失败'], rows));
        box.appendChild(c);
        var btn = el('button', 'btn primary'); btn.textContent = '对比选中会话'; btn.style.marginTop = '10px';
        btn.onclick = function () {
          var cbs = document.querySelectorAll('#content tbody input:checked');
          var ids = [];
          for (var i2 = 0; i2 < cbs.length; i2++) ids.push(cbs[i2].value);
          if (ids.length < 2) { alert('至少选择两个会话。'); return; }
          compareSessionsByIds(ids, box);
        };
        box.appendChild(btn);
      })
      .catch(function () {});
  }

  function compareSessionsByIds(ids, box) {
    fetch('/llm-latency/sessions-compare.json?ids=' + encodeURIComponent(ids.join(',')))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var rows = [];
        for (var i = 0; i < d.rows.length; i++) {
          var s = d.rows[i].summary;
          rows.push([s.id.slice(0, 8), s.vendor + ' · ' + s.model + (s.singleModel ? '' : ' ⚠换模'),
            s.okCount + '/' + s.calls, ms(s.firstCallTtftMs), String(s.firstCallInputTokens),
            ms(s.ttftP50), ms(s.ttftP95), pct(s.cacheHitPct), statusBadge(s)]);
        }
        var c = card('会话对比');
        c.appendChild(makeTable(['会话', '厂商 · 模型', '调用(成功/总)', '首轮TTFT', '首轮输入tok', 'TTFT p50', 'TTFT p95', '缓存命中', '状态'], rows));
        box.appendChild(c);
        for (var w = 0; w < d.warnings.length; w++) { var wn = el('div', 'warn'); wn.textContent = '⚠ ' + d.warnings[w]; box.appendChild(wn); }
      })
      .catch(function () {});
  }

  var logState = { q: '', status: '', offset: 0, pageSize: 50 };
  function renderLog() {
    var box = document.getElementById('content');
    box.innerHTML = '';
    var toolbar = el('div', 'toolbar');
    var q = el('input');
    q.placeholder = '搜索 requestId / 厂商 / 模型 / 会话 / key / 错误码';
    q.value = logState.q;
    q.style.flex = '1';
    q.style.minWidth = '260px';
    var st = el('select');
    var statuses = [['', '全部状态'], ['ok', '成功'], ['fail', '失败'], ['rateLimited', '429 限流'], ['timeout', '超时'], ['server', '5xx'], ['aborted', '中止']];
    for (var si = 0; si < statuses.length; si++) {
      var so = el('option'); so.value = statuses[si][0]; so.textContent = statuses[si][1]; st.appendChild(so);
    }
    st.value = logState.status;
    var go = el('button', 'btn primary'); go.textContent = '查询';
    var prev = el('button', 'btn'); prev.textContent = '上一页';
    var next = el('button', 'btn'); next.textContent = '下一页';
    toolbar.appendChild(q); toolbar.appendChild(st); toolbar.appendChild(go); toolbar.appendChild(prev); toolbar.appendChild(next);
    box.appendChild(toolbar);
    var tableBox = el('div'); box.appendChild(tableBox);
    function load() {
      var params = 'limit=' + logState.pageSize + '&offset=' + logState.offset;
      if (logState.q) params += '&q=' + encodeURIComponent(logState.q);
      if (logState.status) params += '&status=' + encodeURIComponent(logState.status);
      if (selectedVendors.length === 1) params += '&vendor=' + encodeURIComponent(selectedVendors[0]);
      fetch('/llm-latency/log.json?' + params)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          tableBox.innerHTML = '';
          if (!d.records || d.records.length === 0) { tableBox.appendChild(empty('没有匹配的请求记录。')); return; }
          var rows = [];
          for (var i = 0; i < d.records.length; i++) {
            var s = d.records[i];
            rows.push([
              new Date(s.ts).toLocaleString(),
              s.vendor, s.model, (s.sessionId || '').slice(0, 8),
              s.requestId || '', s.credentialRef || '',
              ms(s.ttftMs), ms(s.e2eMs),
              String(s.inputTokens), String(s.outputTokens),
              pct(cacheHit(s)),
              statusBadge(s)
            ]);
          }
          var c = card();
          c.appendChild(makeTable(['时间', '厂商', '模型', '会话', '请求ID', 'key', '首token', '端到端', '输入tok', '输出tok', '缓存命中', '状态'], rows));
          tableBox.appendChild(c);
          var hint = el('div', 'hint');
          hint.textContent = '共 ' + d.total + ' 条 · 第 ' + (Math.floor(logState.offset / logState.pageSize) + 1) + ' 页';
          tableBox.appendChild(hint);
        })
        .catch(function () {});
    }
    go.onclick = function () { logState.q = q.value; logState.status = st.value; logState.offset = 0; load(); };
    prev.onclick = function () { if (logState.offset > 0) { logState.offset = Math.max(0, logState.offset - logState.pageSize); load(); } };
    next.onclick = function () { logState.offset += logState.pageSize; load(); };
    load();
  }

  function loadModels() {
    fetch('/llm-latency/models.json')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        models = d.models || [];
        var sel = document.getElementById('modelSel');
        var prev = sel.value;
        sel.innerHTML = '';
        var opt = el('option'); opt.value = ''; opt.textContent = '全部'; sel.appendChild(opt);
        for (var i = 0; i < models.length; i++) {
          var o = el('option'); o.value = models[i].model; o.textContent = models[i].model; sel.appendChild(o);
        }
        if (prev) sel.value = prev;
        var vset = {};
        for (var i2 = 0; i2 < models.length; i2++) for (var j = 0; j < models[i2].vendors.length; j++) vset[models[i2].vendors[j]] = true;
        vendors = Object.keys(vset).sort();
        var vbox = document.getElementById('vendors');
        vbox.innerHTML = '';
        for (var k = 0; k < vendors.length; k++) {
          (function (vendor) {
            var label = el('label');
            var cb = el('input'); cb.type = 'checkbox'; cb.value = vendor;
            cb.onchange = function () {
              selectedVendors = [];
              var boxes = document.querySelectorAll('#vendors input:checked');
              for (var m = 0; m < boxes.length; m++) selectedVendors.push(boxes[m].value);
              render();
            };
            label.appendChild(cb);
            var span = el('span'); span.textContent = vendor; label.appendChild(span);
            vbox.appendChild(label);
          })(vendors[k]);
        }
      })
      .catch(function () {});
  }

  function exportCsv() {
    if (!lastData || lastData.length === 0) return;
    var lines = ['vendor,model,count,okCount,failCount,ttftP50Ms,ttftP95Ms,e2eP50Ms,tokensPerSecond,cacheHitPct,cacheWritePct'];
    for (var i = 0; i < lastData.length; i++) {
      var r = lastData[i];
      lines.push([r.vendor, r.model, r.count, r.okCount, r.failCount, r.ttftP50, r.ttftP95, r.e2eP50, r.tokensPerSecond, r.cacheHitPct, r.cacheWritePct].join(','));
    }
    var blob = new Blob([lines.join('\\n')], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'llm-latency.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function render() {
    if (view === 'overview') renderOverview();
    else if (view === 'compare') renderCompare();
    else if (view === 'log') renderLog();
    else renderSessions();
  }

  var tabButtons = document.querySelectorAll('#tabs button');
  for (var i = 0; i < tabButtons.length; i++) {
    (function (btn) {
      btn.onclick = function () {
        view = btn.getAttribute('data-view');
        for (var j = 0; j < tabButtons.length; j++) tabButtons[j].className = '';
        btn.className = 'active';
        render();
      };
    })(tabButtons[i]);
  }
  document.getElementById('refresh').onclick = function () { loadModels(); render(); };
  document.getElementById('export').onclick = exportCsv;
  document.getElementById('modelSel').onchange = render;
  document.getElementById('rangeSel').onchange = render;
  loadModels();
  render();
  setInterval(function () { if (view === 'overview') renderOverview(); }, 10000);
})();
</script>
</body>
</html>`;
}
