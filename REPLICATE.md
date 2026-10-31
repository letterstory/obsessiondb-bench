# Replicate ObsessionBench

For a person or an AI agent: how to reproduce the published results and check them.

## 1. What you need

Node.js 24, npm and git, and network access to each contender's service. A contender that needs
credentials reads them from the environment variables named in `.env.example`; without them, the
contender is recorded as `skipped`, never scored.

- ObsessionDB (`subject`): `OBSESSIONDB_HOST`, `OBSESSIONDB_PORT`, `OBSESSIONDB_USER`, `OBSESSIONDB_PASSWORD`
- ClickHouse Cloud (`clickhouse-cloud`): `CLICKHOUSE_CLOUD_HOST`, `CLICKHOUSE_CLOUD_PORT`, `CLICKHOUSE_CLOUD_USER`, `CLICKHOUSE_CLOUD_PASSWORD`

Use your own account on each service. `BENCH_SCALE` sets the dataset's size and `BENCH_REPETITIONS`
how many times each query is timed; the defaults are what the published results used.

## 2. Get the code

```sh
git clone <this repo>
cd obsessiondb-bench
npm install
```

## 3. Run it

```sh
npm run bench
```

It runs every contender in `bench.json` on every scenario and writes `results/latest.json` and
`results/history/<YYYY-MM-DD>.json` (the shape is in `results/README.md`).

## 4. Compare with the published results

The published file is `results/latest.json` on `main`.
The same results, readable: https://obsessionbench.com

Compare each contender's metrics. Run-to-run noise is expected; METHODOLOGY.md says what counts
as a real difference. The primary metric is `p99_latency_ms` (lower is better).

## 5. Report a difference

Open an issue on the repo with your `results/latest.json` and the
`environment` it recorded.
