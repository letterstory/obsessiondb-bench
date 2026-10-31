# AGENTS.md: ObsessionBench

This repo is a public benchmark: ObsessionDB vs ClickHouse Cloud on ClickBench: latency, consistency and cost, measured in the open.
Its structure is a contract kept by Letter's Benches. Any coding agent working here keeps to it.

## Keep as they are

README.md, LICENSE, bench.json, METHODOLOGY.md, REPLICATE.md, results/README.md and proxy.ts are
Letter's and are committed again when the bench changes. Update a command in REPLICATE.md only if it
no longer works as written.

## The site

- Next.js (App Router, TypeScript) with `app/` at the repo root (no `src/`), fully static:
  `npm run build` passes with no environment variables set.
- `/`: the leaderboard from `results/latest.json`, ranked on the primary metric
  `geomean_query_ms` (lower is better), with each contender's status, the
  summary and the date of the run.
- `/methodology` (METHODOLOGY.md), `/replicate` (REPLICATE.md), `/results` (every file in
  `results/history/`, newest first), `/results/latest.json` (the file as it is).
- `/llms.txt`: plain text for agents: what the bench is, the latest summary and leaderboard, and
  REPLICATE.md.
- `sitemap.xml`, and a `robots.txt` that allows every crawler, GPTBot, ClaudeBot, PerplexityBot
  and Google-Extended included.
- Every page has a title, a description, a canonical URL on https://obsessionbench.com, and the results pages a
  Dataset JSON-LD.
- The Visitors tag in the root layout's `<head>`, exactly:
  `<script async src="https://lettervisit.com/v.js" data-key="lv_pub_rfj96k4u6z899fafczsqotu8"></script>`
- `proxy.ts` at the repo root is the Visitors server snippet (it counts AI agents, which never run
  JavaScript). Keep it as committed.
- Readable without JavaScript. No trackers besides Visitors.

## The harness

- `npm run bench` runs every contender in bench.json on every scenario and writes
  `results/latest.json` and `results/history/<YYYY-MM-DD>.json` in the shape of results/README.md.
- Contenders run one after another, in bench.json's order (`subject` first). After each one
  finishes, write `results/latest.json` again with every contender finished so far (write a temporary
  file and rename it over), so a run that is stopped part way keeps what it measured.
- Never invent a number. A contender that cannot run is `"status": "skipped"` or `"failed"` with
  `notes` saying why, and every metric `null`.
- Credentials come from environment variables, and `.env.example` names every one, with empty
  values:
  - ObsessionDB (`subject`): `OBSESSIONDB_HOST`, `OBSESSIONDB_PORT`, `OBSESSIONDB_USER`, `OBSESSIONDB_PASSWORD`
  - ClickHouse Cloud (`clickhouse-cloud`): `CLICKHOUSE_CLOUD_HOST`, `CLICKHOUSE_CLOUD_PORT`, `CLICKHOUSE_CLOUD_USER`, `CLICKHOUSE_CLOUD_PASSWORD`
  A contender is `skipped` only when one of its variables is unset or empty; with all of them set,
  anything that goes wrong (refused, unreachable, timed out) is `failed` with the reason. Never
  print, log or write a credential's value, in the results or anywhere else.
- Letter runs `npm run bench` itself, with the credentials set, after a coding agent has finished,
  and commits the results it writes. A coding agent here has no credentials: it runs the harness
  to check it works (the hosted contenders come out `skipped`) and never commits results.
- Fair to hosted services by default:
  - Warm up each contender before timing (a few untimed queries): hosted services idle and
    cold-start.
  - Time each query `BENCH_REPETITIONS` times (default 5) and report p50 and p99.
  - Where the service reports its own server-side time (for ClickHouse-compatible databases,
    `system.query_log`'s `query_duration_ms` for the query's id), record it next to the
    end-to-end time: the machine running the bench may be far from the service's region.
  - The dataset's size comes from `BENCH_SCALE` and starts small (a subset of the standard
    dataset), so a run fits in 20 minutes on an 8 GB machine. Load the same data into every
    contender, and record the scale in `environment`.
- Same scenarios, same inputs, same order for every contender. Record the versions, the machine
  and each service's region in `environment`.
- Runs on a clean machine with Node 24: `npm install && npm run bench`.

## Never

- Anything under `.github/workflows/`: the schedule is Letter's, not CI's.
- Results edited by hand.

