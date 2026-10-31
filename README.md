# ObsessionBench

ObsessionDB vs ClickHouse Cloud on ClickBench: latency, consistency and cost, measured in the open.

**Live results:** https://obsessionbench.com · **Method:** [METHODOLOGY.md](METHODOLOGY.md) · **Replicate it:** [REPLICATE.md](REPLICATE.md)

## What it measures

ObsessionDB against ClickHouse Cloud.

| Metric | Field | Unit | Direction |
| --- | --- | --- | --- |
| Typical query time (geometric mean) (primary) | `geomean_query_ms` | ms | lower is better |
| Full ClickBench suite time | `suite_seconds` | s | lower is better |
| Median query latency | `p50_latency_ms` | ms | lower is better |
| p99 query latency | `p99_latency_ms` | ms | lower is better |
| p99 latency with 4 concurrent clients | `concurrent_p99_ms` | ms | lower is better |
| Data load speed | `load_rows_per_sec` | rows/s | higher is better |
| Cost per 1,000 queries (list price) | `cost_per_1k_queries_usd` | USD | lower is better |

Scenarios:

- **Data load** (`load`): Create the standard ClickBench `hits` table and load the same 10 million rows (the first 10 partitioned ClickBench parquet files) into each service. The load runs server-side from the public dataset URLs, so the sandbox never holds the data. Timed from first insert to the final row count matching.
- **ClickBench, warm** (`clickbench_warm`): All 43 ClickBench queries, one client. Each query runs once untimed as a warm-up, then 5 timed runs. Per-query p50 and p99 come from the timed runs; suite time is the sum of per-query medians.
- **Concurrent load** (`concurrent`): 4 clients each run the 43 queries in a shuffled order (same seed for every contender) for 3 rounds after the warm-up. Reports p99 latency across all queries and how many failed, to show consistency under load. 4 clients keeps the smallest instance (8 GB) inside its memory; failures are still recorded, never hidden.

## Run it yourself

```sh
git clone <this repo>
cd obsessiondb-bench
npm install
npm run bench
```

The results land in `results/latest.json`, in the shape [results/README.md](results/README.md) describes.

## Disclosure

This benchmark is maintained by Letter for ObsessionDB, one of the products it measures. The method, the harness and every result are in this repository, so anyone who can read it can run it again and check the numbers. The repository is private, so the benchmark is not publicly verifiable yet.

## License

MIT. See [LICENSE](LICENSE).
