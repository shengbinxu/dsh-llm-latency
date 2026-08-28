# dsh-llm-latency

[English](README.md) · [中文](README.zh.md)

Per-vendor / per-model LLM latency telemetry and a cross-vendor A/B benchmark for
DeepSeek Harness. It answers one question with numbers: **"is vendor X actually
slower, or is it just the long context?"**

- **Passive telemetry** — every real model call is measured (first token, first
  visible text, end-to-end, tokens/sec, cache-hit share) and aggregated per
  `vendor|provider|model`.
- **Anti-cache A/B benchmark** — replays the most recent **real long-context
  request** concurrently across the vendors you pick, so the comparison uses the
  same input at the same moment.
- **Dashboard + tools** — a self-contained HTML dashboard plus `latency_report`
  and `latency_benchmark` model tools, and CSV export for evidence.

## Install

```sh
dsh plugin --profile web add github:<you>/dsh-llm-latency
```

Then restart the profile. The plugin applies after `dsh-base` (it needs the
`llm` service), intercepts `llm/stream`, and serves the dashboard at:

```
http://127.0.0.1:<port>/llm-latency/
```

## Usage

- **Dashboard**: open `/llm-latency/`, pick two or more targets, click
  **开始对拍 (run benchmark)**. Passive stats refresh every 5 seconds; **导出 CSV**
  downloads a report.
- **Model tools**: ask the agent to *"帮我看看各厂商延迟对比"*
  (`latency_report`), or *"对比一下这几个厂商"* (`latency_benchmark`).

## Where data lives

Aggregates persist at `$DSH_HOME/llm-latency/stats.json` (default
`~/.dsh/llm-latency/stats.json`). Delete the file to reset.

## Anti-cache methodology

Replaying an identical context is confounded by three caches: exact-match,
prefix caching (DeepSeek official and the Anthropic family both do this), and
cold/warm asymmetry. The plugin counters this by:

1. **Fresh tail per round** — a unique trailing user message breaks exact-match
   caching while preserving the long-context prefix workload.
2. **Cold/warm separation** — the first exposure of a context is tagged `cold`,
   repeats are `warm`; both are reported separately.
3. **Cache observation, not guessing** — `usage.cacheReadTokens` /
   `cacheWriteTokens` are surfaced per sample, so the cache-hit share becomes a
   visible column instead of a hidden confound.
4. **Optional `cacheBust`** — inject a random system-prompt prefix to break
   prefix caching and measure cold compute only (labeled, since it removes a
   real optimization).

The primary fairness metric is **first-token latency (TTFT)** — prefill-dominated
and independent of output length. End-to-end is normalized to tokens/sec.

## Configuration

Set in `cordis.patch.yml` (or override the row):

| Key | Default | Meaning |
| --- | --- | --- |
| `snapshotLimit` | `8` | Distinct real-request snapshots retained for benchmarking |
| `snapshotMaxBytes` | `4000000` | JSON byte cap for one retained snapshot |
| `benchmarkRounds` | `3` | Benchmark rounds per target route |
| `cacheBust` | `false` | Break prefix cache for cold-compute comparison |

## How it works

The plugin registers a waterfall listener on `llm/stream`, wraps the returned
`AsyncIterable<StreamChunk>`, and starts its clock on the **first pull** — the
moment the adapter lazily issues the HTTP request. Retries are separate
`llm/stream` calls (they happen at the `agent/request-error` layer), so failed
attempts are recorded as failures and never pollute success latency.

## License

MIT
