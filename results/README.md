# Results

`latest.json` is the last run; `history/<YYYY-MM-DD>.json` keeps every run. Written by
`npm run bench`, never by hand.

- `version`: 1
- `bench`: `obsessionbench`
- `ran_at`: when the run started (ISO 8601, UTC)
- `environment`: where it ran and the versions it ran against (strings)
- `summary`: one sentence a writer can quote
- `contenders`: one entry per contender in `bench.json`. `id` is `subject` for ObsessionDB, else the
  competitor's id. `status` is `ok`, `skipped` or `failed`; a contender that is not `ok` has every metric
  `null` and `notes` saying why. `metrics` has one field per metric key in `bench.json` (the value aggregated
  over every scenario, as METHODOLOGY.md says).

```json
{
	"version": 1,
	"bench": "obsessionbench",
	"ran_at": "2026-01-01T00:00:00Z",
	"environment": {
		"runner": "describe the machine",
		"node": "24.x"
	},
	"summary": "One sentence a writer can quote, with the numbers.",
	"contenders": [
		{
			"id": "subject",
			"name": "ObsessionDB",
			"status": "ok",
			"metrics": {
				"p99_latency_ms": 0,
				"p50_latency_ms": 0,
				"suite_seconds": 0,
				"concurrent_p99_ms": 0,
				"load_rows_per_sec": 0,
				"cost_per_1k_queries_usd": 0
			},
			"notes": null
		},
		{
			"id": "clickhouse-cloud",
			"name": "ClickHouse Cloud",
			"status": "skipped",
			"metrics": {
				"p99_latency_ms": null,
				"p50_latency_ms": null,
				"suite_seconds": null,
				"concurrent_p99_ms": null,
				"load_rows_per_sec": null,
				"cost_per_1k_queries_usd": null
			},
			"notes": "Why it could not run."
		}
	]
}
```
