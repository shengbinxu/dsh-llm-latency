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
<title>LLM 厂商延迟对比</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 24px; max-width: 1120px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 1px solid #8884; padding-bottom: 4px; }
  .controls { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin: 12px 0; }
  button { padding: 6px 14px; border: 1px solid #8886; border-radius: 6px; background: transparent; cursor: pointer; }
  button:hover { background: #8882; }
  input[type=number] { width: 52px; padding: 4px; }
  .hint { color: #888; font-size: 12px; margin: 4px 0 12px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 4px; font-size: 13px; }
  th, td { border: 1px solid #8884; padding: 5px 10px; text-align: right; white-space: nowrap; }
  th:first-child, td:first-child { text-align: left; }
  th { background: #8882; font-weight: 600; }
  .targets { display: flex; flex-wrap: wrap; gap: 8px 16px; }
  .targets label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
  .empty { color: #888; font-size: 13px; }
  .ok { color: #2e7d32; } .bad { color: #c62828; }
</style>
</head>
<body>
<h1>LLM 厂商延迟对比</h1>
<div class="controls">
  <button id="refresh">刷新</button>
  <button id="export">导出 CSV</button>
  <button id="bench">开始对拍</button>
  <label>轮数 <input id="rounds" type="number" min="1" max="10" value="3" /></label>
  <label><input id="cacheBust" type="checkbox" /> 冷缓存（打破前缀缓存）</label>
</div>
<div class="hint" id="hint">对拍会复用最近一次真实请求的长上下文，并产生真实调用费用。</div>

<h2>目标厂商</h2>
<div class="targets" id="targets"><div class="empty">加载中…</div></div>

<h2>日常采样（被动记录）</h2>
<div id="summary"></div>

<h2>对拍结果</h2>
<div id="benchOut"></div>

<script>
(function () {
  var lastStats = null;

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

  function makeTable(headers, rows) {
    var table = el('table');
    var thead = el('thead');
    var tr = el('tr');
    for (var i = 0; i < headers.length; i++) {
      var th = el('th');
      th.textContent = headers[i];
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    table.appendChild(thead);
    var tbody = el('tbody');
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var tr2 = el('tr');
      for (var c = 0; c < row.length; c++) {
        var td = el('td');
        td.textContent = row[c];
        tr2.appendChild(td);
      }
      tbody.appendChild(tr2);
    }
    table.appendChild(tbody);
    return table;
  }

  function renderSummary(data) {
    var box = document.getElementById('summary');
    box.innerHTML = '';
    var list = (data && data.summaries) || [];
    if (list.length === 0) {
      var e = el('div', 'empty');
      e.textContent = '暂无采样数据。';
      box.appendChild(e);
      return;
    }
    var rows = [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      rows.push([
        r.vendor + ' · ' + r.model,
        r.okCount + '/' + r.count,
        ms(r.ttftP50), ms(r.ttftP95), ms(r.e2eP50),
        tps(r.tokensPerSecond), pct(r.cacheHitPct), String(r.spikes)
      ]);
    }
    box.appendChild(makeTable(
      ['厂商 / 模型', '样本', '首token p50', '首token p95', '端到端 p50', 'tok/s', '缓存命中', '毛刺'],
      rows
    ));
  }

  function renderTargets(data) {
    var box = document.getElementById('targets');
    box.innerHTML = '';
    var list = (data && data.targets) || [];
    if (list.length === 0) {
      var e = el('div', 'empty');
      e.textContent = '未发现可对拍的厂商路由。';
      box.appendChild(e);
      return;
    }
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var label = el('label');
      var cb = el('input');
      cb.type = 'checkbox';
      cb.value = t.provider + '::' + t.model;
      cb.checked = i < 4;
      var span = el('span');
      span.textContent = t.vendor + ' · ' + t.model + ' (' + t.provider + ')';
      label.appendChild(cb);
      label.appendChild(span);
      box.appendChild(label);
    }
  }

  function renderBench(data) {
    var box = document.getElementById('benchOut');
    box.innerHTML = '';
    var list = (data && data.results) || [];
    if (list.length === 0) {
      var e = el('div', 'empty');
      e.textContent = '尚未对拍。';
      box.appendChild(e);
      return;
    }
    var rows = [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      rows.push([
        r.vendor + ' · ' + r.model,
        r.okCount + '/' + r.rounds,
        ms(r.ttftP50), ms(r.ttftP95), ms(r.e2eP50),
        tps(r.tokensPerSecond), pct(r.cacheHitPct)
      ]);
    }
    box.appendChild(makeTable(
      ['厂商 / 模型', '轮次', '首token p50', '首token p95', '端到端 p50', 'tok/s', '缓存命中'],
      rows
    ));
  }

  function loadStats() {
    fetch('/llm-latency/stats.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { lastStats = d; renderSummary(d); })
      .catch(function () {});
  }

  function loadTargets() {
    fetch('/llm-latency/targets.json')
      .then(function (r) { return r.json(); })
      .then(renderTargets)
      .catch(function () {});
  }

  function runBench() {
    var boxes = document.querySelectorAll('#targets input:checked');
    var targets = [];
    for (var i = 0; i < boxes.length; i++) {
      var parts = boxes[i].value.split('::');
      targets.push({ provider: parts[0], model: parts[1] });
    }
    if (targets.length < 2) {
      alert('至少选择两个厂商/模型才能对比。');
      return;
    }
    var rounds = parseInt(document.getElementById('rounds').value, 10) || 3;
    var cacheBust = document.getElementById('cacheBust').checked;
    var hint = document.getElementById('hint');
    hint.textContent = '对拍进行中…（会真实调用，请稍候）';
    fetch('/llm-latency/benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets: targets, rounds: rounds, cacheBust: cacheBust })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { hint.textContent = '对拍完成。'; renderBench(d); })
      .catch(function (e) { hint.textContent = '对拍失败：' + e.message; });
  }

  function exportCsv() {
    if (!lastStats || !lastStats.summaries || lastStats.summaries.length === 0) return;
    var lines = ['vendor,model,count,okCount,failCount,ttftP50Ms,ttftP95Ms,e2eP50Ms,tokensPerSecond,cacheHitPct,spikes'];
    var list = lastStats.summaries;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      lines.push([
        r.vendor, r.model, r.count, r.okCount, r.failCount,
        r.ttftP50, r.ttftP95, r.e2eP50, r.tokensPerSecond, r.cacheHitPct, r.spikes
      ].join(','));
    }
    var blob = new Blob([lines.join('\\n')], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'llm-latency.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('refresh').onclick = loadStats;
  document.getElementById('export').onclick = exportCsv;
  document.getElementById('bench').onclick = runBench;

  loadStats();
  loadTargets();
  setInterval(loadStats, 5000);
})();
</script>
</body>
</html>`;
}
