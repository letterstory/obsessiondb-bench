# Methodology

## Setup

- **ObsessionDB:** free developer tier, single node, 4 vCPU / 8 GB RAM, region eu-central.
- **ClickHouse Cloud:** 1 replica, fixed 12 GiB / 3 vCPU (autoscaling off: min = max), region AWS eu-central-1. This is the closest single-node size ClickHouse Cloud offers to ObsessionDB's instance; it has 1 fewer vCPU and 4 GB more memory, and the site states both sizes.
- Both are reached over HTTPS (port 8443) from the same sandbox, with the same client library and settings.
- Data: the public ClickBench `hits` dataset (https://github.com/ClickHouse/ClickBench), first 10 partitioned parquet files (10 million rows). The size is a setting in the harness, so it can be raised.

## Fairness rules

- Same schema (ClickBench's own `create.sql` for ClickHouse), same data, same queries, same order and seed for every contender.
- Warm-up before timing: every query runs once untimed, so ClickHouse Cloud's idle wake-up and first-touch caching aren't counted against it.
- No vendor-specific tuning beyond what ClickBench's ClickHouse setup uses. No query result cache (`use_query_cache = 0`).
- Two timings for every query: **server time** from `system.query_log` (`query_duration_ms`), which removes network distance, and **end-to-end time** at the client. Headline latency metrics use server time; end-to-end is published alongside.
- Each run records the service versions (`SELECT version()`), region and instance size in the results.

## Cost

- Cost per 1,000 queries = (the vendor's public list price per hour for the instance size used) x (total server time of the warm suite) / (queries run) x 1,000.
- List prices are read from each vendor's public pricing page and written into the results with the date and URL. Free tiers and trial credits are not used as the price: ObsessionDB's free tier is priced at its nearest paid equivalent of the same size.

## What is and isn't counted

- A query that errors or times out (60 s) is recorded as failed for that contender, never given a number.
- A contender whose credentials are missing is recorded as skipped with the reason.
- Results are only what the harness wrote in `results/latest.json`, committed after the run. Nothing is edited by hand.

## Disclosure

This benchmark was built by Letter (The Letter Company) for ObsessionDB, a Letter customer. The code, data source and raw results are in the repo, so anyone can rerun it against their own accounts and check the numbers.

## Contenders

- **ObsessionDB** (`subject`): https://obsessiondb.com. Reads `OBSESSIONDB_HOST`, `OBSESSIONDB_PORT`, `OBSESSIONDB_USER`, `OBSESSIONDB_PASSWORD`.
- **ClickHouse Cloud** (`clickhouse-cloud`): https://clickhouse.com/cloud. Reads `CLICKHOUSE_CLOUD_HOST`, `CLICKHOUSE_CLOUD_PORT`, `CLICKHOUSE_CLOUD_USER`, `CLICKHOUSE_CLOUD_PASSWORD`.

## Metrics

| Metric | Field | Unit | Direction |
| --- | --- | --- | --- |
| p99 query latency (primary) | `p99_latency_ms` | ms | lower is better |
| Median query latency | `p50_latency_ms` | ms | lower is better |
| Full ClickBench suite time | `suite_seconds` | s | lower is better |
| p99 latency with 8 concurrent clients | `concurrent_p99_ms` | ms | lower is better |
| Data load speed | `load_rows_per_sec` | rows/s | higher is better |
| Cost per 1,000 queries (list price) | `cost_per_1k_queries_usd` | USD | lower is better |

## Scenarios

- **Data load** (`load`): Create the standard ClickBench `hits` table and load the same 10 million rows (the first 10 partitioned ClickBench parquet files) into each service. The load runs server-side from the public dataset URLs, so the sandbox never holds the data. Timed from first insert to the final row count matching.
- **ClickBench, warm** (`clickbench_warm`): All 43 ClickBench queries, one client. Each query runs once untimed as a warm-up, then 5 timed runs. Per-query p50 and p99 come from the timed runs; suite time is the sum of per-query medians.
- **Concurrent load** (`concurrent`): 8 clients each run the 43 queries in a shuffled order (same seed for every contender) for 3 rounds after the warm-up. Reports p99 latency across all queries, to show consistency under load.

## What a result means

Every contender runs every scenario, with the same inputs, in the same environment, on the same
day. A contender that could not run (no access, an outage, a rate limit) is recorded as
`skipped` or `failed` with the reason, and never given a number.
