// npm run bench: runs every contender in bench.json on every scenario and writes
// results/latest.json and results/history/<YYYY-MM-DD>.json (shape: results/README.md).
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { connect, query, QueryError, redact, type Connection } from "./clickhouse.ts";
import { geomean, percentile, round, shuffled, sum } from "./stats.ts";

type Bench = {
	slug: string;
	subject: { id: string; name: string; url: string; env?: string[] };
	competitors: { id: string; name: string; url: string; env?: string[] }[];
	metrics: { key: string; label: string; unit: string; better: "lower" | "higher"; primary: boolean }[];
	scenarios: { key: string; label: string }[];
};

type Price = { usd_per_hour: number | null; basis: string; source_url: string; read_on: string | null };

type Setup = {
	clickbench: { repo: string; commit: string; create: string; queries: string; dataset: string; dataset_files: number };
	database: string;
	defaults: { scale: number; repetitions: number };
	query_timeout_seconds: number;
	load_timeout_seconds: number;
	concurrent: { clients: number; rounds: number; seed: number };
	contenders: Record<string, { env: string[]; instance: string; region: string; price: Price }>;
};

type Contender = { id: string; name: string; env: string[]; instance: string; region: string; price: Price | null };

type Metrics = Record<string, number | null>;

type ContenderResult = {
	id: string;
	name: string;
	status: "ok" | "skipped" | "failed";
	metrics: Metrics;
	notes: string | null;
	details?: Record<string, unknown>;
};

type Run = { queryId: string; e2eMs: number };

type QueryOutcome = {
	query: number;
	runs: Run[];
	error: string | null;
};

const root = path.resolve(import.meta.dirname, "..");
const bench: Bench = JSON.parse(await readFile(path.join(root, "bench.json"), "utf8"));
const setup: Setup = JSON.parse(await readFile(path.join(root, "harness", "setup.json"), "utf8"));

const scale = intFromEnv("BENCH_SCALE", setup.defaults.scale, 1, setup.clickbench.dataset_files);
const repetitions = intFromEnv("BENCH_REPETITIONS", setup.defaults.repetitions, 1, 1000);
const queryTimeoutMs = setup.query_timeout_seconds * 1000;
const loadTimeoutMs = setup.load_timeout_seconds * 1000;
const { clients, rounds, seed } = setup.concurrent;
const database = setup.database;
// system.query_log reports whole milliseconds, so a sub-millisecond median can read 0; the
// geometric mean counts it as 1 ms.
const GEOMEAN_FLOOR_MS = 1;
const querySettings = { use_query_cache: 0, max_execution_time: setup.query_timeout_seconds, log_queries: 1 };

const ranAt = new Date();
const ranAtIso = ranAt.toISOString().replace(/\.\d{3}Z$/, "Z");
const runId = `${ranAtIso.replace(/[-:]/g, "").toLowerCase()}-${randomBytes(3).toString("hex")}`;
const latestPath = path.join(root, "results", "latest.json");
const historyPath = path.join(root, "results", "history", `${ranAtIso.slice(0, 10)}.json`);

const contenders: Contender[] = [bench.subject, ...bench.competitors].map((c) => {
	const extra = setup.contenders[c.id];
	return {
		id: c.id,
		name: c.name,
		env: c.env ?? extra?.env ?? [],
		instance: extra?.instance ?? "not stated",
		region: extra?.region ?? "not stated",
		price: extra?.price ?? null,
	};
});

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < min || value > max) {
		console.error(`${name} must be a whole number from ${min} to ${max}.`);
		process.exit(1);
	}
	return value;
}

function log(message: string) {
	console.log(`[bench] ${message}`);
}

function emptyMetrics(): Metrics {
	return Object.fromEntries(bench.metrics.map((m) => [m.key, null]));
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function datasetPattern(): string {
	const files = scale === 1 ? "0" : `{0..${scale - 1}}`;
	return setup.clickbench.dataset.replace("{n}", files);
}

// ClickBench's own schema and queries, pinned to one commit and fetched at run time.
async function loadClickBench(): Promise<{ create: string; queries: string[] }> {
	const base = setup.clickbench.repo.replace("https://github.com/", "https://raw.githubusercontent.com/");
	const get = async (file: string) => {
		const res = await fetch(`${base}/${setup.clickbench.commit}/${file}`, { signal: AbortSignal.timeout(30_000) });
		if (!res.ok) throw new Error(`could not fetch ClickBench ${file}: HTTP ${res.status}`);
		return res.text();
	};
	const [create, queriesText] = await Promise.all([get(setup.clickbench.create), get(setup.clickbench.queries)]);
	const queries = queriesText
		.split("\n")
		.map((line) => line.trim().replace(/;$/, ""))
		.filter((line) => line.length > 0);
	if (queries.length !== 43) throw new Error(`expected 43 ClickBench queries, found ${queries.length}`);
	return { create: create.trim().replace(/;$/, ""), queries };
}

async function scalar(conn: Connection, sql: string, timeoutMs = queryTimeoutMs, db?: string): Promise<string> {
	const res = await query(conn, `${sql} FORMAT TabSeparated`, { timeoutMs, database: db });
	return res.body.trim();
}

// Hosted services idle and cold-start: keep trying until the service answers, then run a few
// untimed queries before anything is timed.
async function wakeUp(conn: Connection): Promise<void> {
	const deadline = Date.now() + 5 * 60_000;
	for (;;) {
		try {
			await query(conn, "SELECT 1", { timeoutMs: queryTimeoutMs });
			break;
		} catch (error) {
			const e = error as QueryError;
			if (!(e instanceof QueryError) || !e.retryable || Date.now() > deadline) throw error;
			log(`  not answering yet (${e.message}); retrying`);
			await sleep(10_000);
		}
	}
	for (let i = 0; i < 3; i++) await query(conn, "SELECT 1", { timeoutMs: queryTimeoutMs });
}

// Reads each query's server-side duration from system.query_log.
async function serverTimes(conn: Connection, ids: string[]): Promise<{ times: Map<string, number>; error: string | null }> {
	const times = new Map<string, number>();
	if (ids.length === 0) return { times, error: null };
	try {
		await query(conn, "SYSTEM FLUSH LOGS", { timeoutMs: queryTimeoutMs });
	} catch {
		// Not every user may flush logs; the log is flushed on its own every few seconds.
	}
	const since = Math.floor(ranAt.getTime() / 1000) - 300;
	const sources = ["clusterAllReplicas('default', system.query_log)", "system.query_log"];
	let sourceIndex = 0;
	let lastError: string | null = null;
	const deadline = Date.now() + 120_000;
	for (;;) {
		const missing = ids.filter((id) => !times.has(id));
		if (missing.length === 0) return { times, error: null };
		for (let i = 0; i < missing.length; i += 400) {
			const batch = missing.slice(i, i + 400);
			const sql =
				`SELECT query_id, query_duration_ms FROM ${sources[sourceIndex]} ` +
				`WHERE event_date >= toDate(toDateTime(${since})) AND event_time >= toDateTime(${since}) ` +
				`AND type = 'QueryFinish' AND query_id IN (${batch.map((id) => `'${id}'`).join(",")}) FORMAT TabSeparated`;
			try {
				const res = await query(conn, sql, { timeoutMs: queryTimeoutMs });
				for (const line of res.body.split("\n")) {
					const [id, ms] = line.split("\t");
					if (id && ms !== undefined && !times.has(id)) times.set(id, Number(ms));
				}
				lastError = null;
			} catch (error) {
				lastError = errorMessage(error);
				if (sourceIndex < sources.length - 1) {
					sourceIndex++;
					i -= 400;
					continue;
				}
				return { times, error: `system.query_log could not be read: ${lastError}` };
			}
		}
		if (ids.every((id) => times.has(id))) return { times, error: null };
		if (Date.now() > deadline) {
			const found = ids.filter((id) => times.has(id)).length;
			return { times, error: `system.query_log had ${found} of ${ids.length} queries after waiting 2 minutes` };
		}
		await sleep(5_000);
	}
}

async function runQuery(conn: Connection, sql: string, queryId: string): Promise<Run> {
	const res = await query(conn, sql, { database, queryId, settings: querySettings, timeoutMs: queryTimeoutMs + 5_000 });
	return { queryId, e2eMs: res.ms };
}

function slug(id: string): string {
	return id.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function runContender(c: Contender, clickbench: { create: string; queries: string[] } | null): Promise<{ result: ContenderResult; version: string | null }> {
	const base = { id: c.id, name: c.name };
	const missing = c.env.filter((name) => !process.env[name]?.trim());
	if (c.env.length === 0 || missing.length > 0) {
		const names = c.env.length ? missing.join(", ") : "no environment variables are configured for it";
		log(`${c.name}: skipped (not set: ${names})`);
		return {
			result: { ...base, status: "skipped", metrics: emptyMetrics(), notes: `Not run: credentials not set (${names}).` },
			version: null,
		};
	}

	const value = (suffix: string) => process.env[c.env.find((n) => n.endsWith(suffix)) ?? ""] ?? "";
	const secrets = c.env.map((n) => process.env[n] ?? "");
	const failed = (stage: string, error: unknown): { result: ContenderResult; version: null } => {
		const reason = redact(errorMessage(error), secrets);
		log(`${c.name}: failed during ${stage}: ${reason}`);
		return { result: { ...base, status: "failed", metrics: emptyMetrics(), notes: `Failed during ${stage}: ${reason}` }, version: null };
	};

	let conn: Connection;
	try {
		conn = connect(value("_HOST"), value("_PORT"), value("_USER"), value("_PASSWORD"));
	} catch (error) {
		return failed("connection setup", error);
	}
	if (!clickbench) return failed("setup", new Error("the ClickBench schema and queries could not be fetched"));

	const notes: string[] = [];
	const q = slug(c.id);
	let version: string;
	try {
		log(`${c.name}: connecting and warming up`);
		await wakeUp(conn);
		version = await scalar(conn, "SELECT version()");
	} catch (error) {
		return failed("connection", error);
	}

	// Scenario: load
	let rows: number;
	let loadSeconds: number;
	const insertId = `obsessionbench-${runId}-${q}-load`;
	try {
		log(`${c.name}: loading ${scale} ClickBench file(s)`);
		await query(conn, `CREATE DATABASE IF NOT EXISTS ${database}`, { timeoutMs: queryTimeoutMs });
		await query(conn, "DROP TABLE IF EXISTS hits SYNC", { database, timeoutMs: queryTimeoutMs * 5 });
		await query(conn, clickbench.create, { database, timeoutMs: queryTimeoutMs });
		const source = `url('${datasetPattern()}', 'Parquet')`;
		rows = Number(await scalar(conn, `SELECT count() FROM ${source}`, queryTimeoutMs * 10));
		if (!Number.isFinite(rows) || rows <= 0) throw new Error("the dataset reported no rows");
		const threads = Number(await scalar(conn, "SELECT greatest(1, intDiv(getSetting('max_threads'), 4))"));
		const start = performance.now();
		await query(conn, `INSERT INTO hits SELECT * FROM ${source}`, {
			database,
			queryId: insertId,
			settings: { max_insert_threads: threads, max_execution_time: 0 },
			timeoutMs: loadTimeoutMs,
		});
		const countDeadline = Date.now() + 10 * 60_000;
		for (;;) {
			const count = Number(await scalar(conn, "SELECT count() FROM hits", queryTimeoutMs, database));
			if (count === rows) break;
			if (count > rows) throw new Error(`the table holds ${count} rows, expected ${rows}`);
			if (Date.now() > countDeadline) throw new Error(`the table holds ${count} rows after 10 minutes, expected ${rows}`);
			await sleep(2_000);
		}
		loadSeconds = (performance.now() - start) / 1000;
		log(`${c.name}: loaded ${rows} rows in ${loadSeconds.toFixed(1)} s`);
	} catch (error) {
		return failed("the data load", error);
	}

	// Scenario: clickbench_warm. Each query: one untimed warm-up run, then the timed runs.
	const warm: QueryOutcome[] = [];
	for (const [i, sql] of clickbench.queries.entries()) {
		const outcome: QueryOutcome = { query: i + 1, runs: [], error: null };
		try {
			await runQuery(conn, sql, `obsessionbench-${runId}-${q}-warmup-q${i + 1}`);
			for (let r = 1; r <= repetitions; r++) {
				outcome.runs.push(await runQuery(conn, sql, `obsessionbench-${runId}-${q}-warm-q${i + 1}-r${r}`));
			}
		} catch (error) {
			outcome.runs = [];
			outcome.error = errorMessage(error);
		}
		warm.push(outcome);
		log(`${c.name}: Q${i + 1} ${outcome.error ? `failed (${outcome.error})` : `${Math.round(outcome.runs.reduce((m, r) => Math.max(m, r.e2eMs), 0))} ms max end-to-end`}`);
	}
	const warmOk = warm.filter((o) => !o.error);
	if (warmOk.length === 0) {
		return failed("the warm ClickBench run", new Error(`every query failed; the first error: ${warm[0]?.error}`));
	}

	// Scenario: concurrent. Same seed for every contender: client k, round r uses seed + k * 100 + r.
	log(`${c.name}: ${clients} concurrent clients x ${rounds} rounds`);
	const concurrentRuns: Run[] = [];
	const concurrentErrors: string[] = [];
	const concurrentFailedQueries = new Map<number, number>();
	const indices = clickbench.queries.map((_, i) => i);
	await Promise.all(
		Array.from({ length: clients }, async (_, k) => {
			for (let r = 1; r <= rounds; r++) {
				for (const i of shuffled(indices, seed + k * 100 + r)) {
					try {
						concurrentRuns.push(await runQuery(conn, clickbench.queries[i], `obsessionbench-${runId}-${q}-conc-c${k + 1}-r${r}-q${i + 1}`));
					} catch (error) {
						concurrentErrors.push(`Q${i + 1}: ${errorMessage(error)}`);
						concurrentFailedQueries.set(i + 1, (concurrentFailedQueries.get(i + 1) ?? 0) + 1);
					}
				}
			}
		}),
	);

	// Server-side times from system.query_log.
	log(`${c.name}: reading server-side times from system.query_log`);
	const warmIds = warmOk.flatMap((o) => o.runs.map((r) => r.queryId));
	const lookup = await serverTimes(conn, [...warmIds, ...concurrentRuns.map((r) => r.queryId), insertId]);
	const server = (id: string) => lookup.times.get(id);
	const warmServerFound = warmIds.filter((id) => server(id) !== undefined).length;
	const concurrentServerFound = concurrentRuns.filter((r) => server(r.queryId) !== undefined).length;
	const warmServerComplete = warmServerFound === warmIds.length;
	const concurrentServerComplete = concurrentRuns.length > 0 && concurrentServerFound === concurrentRuns.length;
	// Only the metrics of the scenario whose server-side times are missing are left out.
	if (lookup.error) {
		if (!warmServerComplete) {
			notes.push(
				`Server-side times missing for the clickbench_warm scenario (${warmServerFound} of ${warmIds.length} found; ${lookup.error}), so geomean_query_ms, suite_seconds, p50_latency_ms, p99_latency_ms and cost_per_1k_queries_usd are null; end-to-end times are in details.`,
			);
		}
		if (concurrentRuns.length > 0 && !concurrentServerComplete) {
			notes.push(
				`Server-side times missing for the concurrent scenario (${concurrentServerFound} of ${concurrentRuns.length} found; ${lookup.error}), so concurrent_p99_ms is null; the end-to-end p99 is in details.`,
			);
		}
		if (warmServerComplete && (concurrentRuns.length === 0 || concurrentServerComplete)) {
			notes.push(`Server-side time for the load's insert is missing (${lookup.error}); load_rows_per_sec is timed at the client and is not affected.`);
		}
	}

	const warmServer = warmIds.map((id) => server(id)).filter((v): v is number => v !== undefined);
	const warmE2e = warmOk.flatMap((o) => o.runs.map((r) => r.e2eMs));
	const medianOf = (values: number[]) => percentile(values, 50) as number;
	const failedQueries = warm.filter((o) => o.error).map((o) => `Q${o.query}`);
	if (failedQueries.length) {
		notes.push(
			`${failedQueries.length} of ${warm.length} queries failed in clickbench_warm (${failedQueries.join(", ")}) and are left out of the latency metrics; geomean_query_ms and suite_seconds are null because the suite did not complete.`,
		);
	}
	if (concurrentErrors.length) {
		const named = [...concurrentFailedQueries.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([n, count]) => `Q${n}${count > 1 ? ` x${count}` : ""}`)
			.join(", ");
		notes.push(`${concurrentErrors.length} of ${clients * rounds * indices.length} concurrent queries failed (${named}) and are left out of concurrent_p99_ms.`);
	}

	const suiteComplete = failedQueries.length === 0;
	const serverMedians = warmOk.map((o) => medianOf(o.runs.map((r) => server(r.queryId) ?? NaN)));
	const e2eMedians = warmOk.map((o) => medianOf(o.runs.map((r) => r.e2eMs)));
	const totalServerMs = sum(warmServer);

	let cost: number | null = null;
	if (!c.price || c.price.usd_per_hour === null) {
		notes.push("No list price is recorded for this contender yet, so cost_per_1k_queries_usd is null.");
	} else if (warmServerComplete) {
		cost = ((c.price.usd_per_hour * (totalServerMs / 3_600_000)) / warmServer.length) * 1000;
	}

	const metrics: Metrics = emptyMetrics();
	const set = (key: string, v: number | null) => {
		if (key in metrics) metrics[key] = v;
	};
	set("geomean_query_ms", warmServerComplete && suiteComplete ? round(geomean(serverMedians.map((ms) => Math.max(ms, GEOMEAN_FLOOR_MS))), 1) : null);
	set("p99_latency_ms", warmServerComplete ? round(percentile(warmServer, 99), 1) : null);
	set("p50_latency_ms", warmServerComplete ? round(percentile(warmServer, 50), 1) : null);
	set("suite_seconds", warmServerComplete && suiteComplete ? round(sum(serverMedians) / 1000, 3) : null);
	set("concurrent_p99_ms", concurrentServerComplete ? round(percentile(concurrentRuns.map((r) => server(r.queryId) as number), 99), 1) : null);
	set("load_rows_per_sec", round(rows / loadSeconds, 0));
	set("cost_per_1k_queries_usd", round(cost, 6));

	try {
		await query(conn, "DROP TABLE IF EXISTS hits SYNC", { database, timeoutMs: queryTimeoutMs * 5 });
	} catch (error) {
		notes.push(`The hits table could not be dropped after the run: ${errorMessage(error)}`);
	}

	const details = {
		version,
		load: {
			rows,
			seconds: round(loadSeconds, 3),
			files: scale,
			server_insert_ms: server(insertId) ?? null,
		},
		end_to_end: {
			geomean_query_ms: suiteComplete ? round(geomean(e2eMedians.map((ms) => Math.max(ms, GEOMEAN_FLOOR_MS))), 1) : null,
			p99_latency_ms: round(percentile(warmE2e, 99), 1),
			p50_latency_ms: round(percentile(warmE2e, 50), 1),
			suite_seconds: suiteComplete ? round(sum(e2eMedians) / 1000, 3) : null,
			concurrent_p99_ms: round(percentile(concurrentRuns.map((r) => r.e2eMs), 99), 1),
		},
		clickbench_warm: warm.map((o) => ({
			query: o.query,
			status: o.error ? "failed" : "ok",
			error: o.error,
			server_ms: o.error ? null : o.runs.map((r) => server(r.queryId) ?? null),
			end_to_end_ms: o.error ? null : o.runs.map((r) => round(r.e2eMs, 1)),
		})),
		concurrent: {
			clients,
			rounds,
			seed,
			queries_ok: concurrentRuns.length,
			queries_failed: concurrentErrors.length,
			failed_queries: Object.fromEntries([...concurrentFailedQueries.entries()].sort((a, b) => a[0] - b[0]).map(([n, count]) => [`Q${n}`, count])),
			errors: concurrentErrors.slice(0, 20),
		},
		price: c.price,
	};

	log(`${c.name}: done`);
	return {
		result: { ...base, status: "ok", metrics, notes: notes.length ? redact(notes.join(" "), secrets) : null, details },
		version,
	};
}

function formatMs(v: number): string {
	return v >= 100 ? Math.round(v).toLocaleString("en-US") : String(v);
}

function summarize(results: ContenderResult[], rows: number | null): string {
	const primary = bench.metrics.find((m) => m.primary) ?? bench.metrics[0];
	const measured = results
		.filter((r) => r.status === "ok" && r.metrics[primary.key] !== null)
		.sort((a, b) => ((a.metrics[primary.key] as number) - (b.metrics[primary.key] as number)) * (primary.better === "lower" ? 1 : -1));
	const others = results.filter((r) => !measured.includes(r));
	const othersText = others.map((r) => `${r.name} ${r.status === "ok" ? `ran but has no ${primary.key} (see notes)` : r.status}`).join(", ");
	if (measured.length === 0) {
		return `No contender was measured in this run (${othersText}); each contender's notes say why.`;
	}
	const list = measured.map((r) => `${r.name} ${formatMs(r.metrics[primary.key] as number)} ${primary.unit}`).join(", ");
	const size = rows ? ` over ${rows.toLocaleString("en-US")} rows` : "";
	return `${primary.label} (server-side, ${primary.better} is better) on the 43 ClickBench queries${size}, ${repetitions} warm runs each: ${list}${others.length ? `; not measured: ${othersText}` : ""}.`;
}

function runnerDescription(): string {
	const cpus = os.cpus();
	const memGb = Math.round(os.totalmem() / 1024 ** 3);
	return `${os.type()} ${os.release()} ${os.arch()}, ${cpus.length} x ${cpus[0]?.model?.trim() ?? "unknown CPU"}, ${memGb} GB RAM`;
}

function harnessCommit(): string {
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
	} catch {
		return "unknown";
	}
}

async function writeAtomic(target: string, text: string) {
	await mkdir(path.dirname(target), { recursive: true });
	const tmp = path.join(path.dirname(target), `.${path.basename(target)}.tmp`);
	await writeFile(tmp, text);
	await rename(tmp, target);
}

async function main() {
	log(`run ${runId}: scale ${scale} file(s), ${repetitions} repetitions, ${contenders.length} contenders`);
	const environment: Record<string, string> = {
		runner: runnerDescription(),
		node: process.version,
		harness_commit: harnessCommit(),
		clickbench: `${setup.clickbench.repo} @ ${setup.clickbench.commit} (${setup.clickbench.create}, ${setup.clickbench.queries})`,
		scale: `BENCH_SCALE=${scale}: ${scale} of ${setup.clickbench.dataset_files} ClickBench partitioned parquet files (${datasetPattern()})`,
		repetitions: `BENCH_REPETITIONS=${repetitions}`,
		query_timeout: `${setup.query_timeout_seconds} s`,
		concurrency: `${clients} clients x ${rounds} rounds, seed ${seed}`,
		geomean: `geomean_query_ms is the geometric mean of the 43 per-query median server times (medians under ${GEOMEAN_FLOOR_MS} ms count as ${GEOMEAN_FLOOR_MS} ms)`,
		query_settings: Object.entries(querySettings).map(([k, v]) => `${k}=${v}`).join(", "),
		client: "ClickHouse HTTP interface over HTTPS, node:https with keep-alive, wait_end_of_query=1",
	};

	let clickbench: { create: string; queries: string[] } | null = null;
	try {
		clickbench = await loadClickBench();
		log(`ClickBench: ${clickbench.queries.length} queries at ${setup.clickbench.commit.slice(0, 12)}`);
	} catch (error) {
		environment.clickbench_error = errorMessage(error);
		log(`ClickBench files unavailable: ${errorMessage(error)}`);
	}

	const results: ContenderResult[] = [];
	let rows: number | null = null;
	for (const c of contenders) {
		let outcome: { result: ContenderResult; version: string | null };
		try {
			outcome = await runContender(c, clickbench);
		} catch (error) {
			const secrets = c.env.map((n) => process.env[n] ?? "");
			const reason = redact(errorMessage(error), secrets);
			log(`${c.name}: failed: ${reason}`);
			outcome = { result: { id: c.id, name: c.name, status: "failed", metrics: emptyMetrics(), notes: `Failed: ${reason}` }, version: null };
		}
		results.push(outcome.result);
		const loaded = (outcome.result.details?.load as { rows?: number } | undefined)?.rows;
		if (rows === null && typeof loaded === "number") rows = loaded;
		environment[`${c.id}_version`] = outcome.version ?? `not measured (${outcome.result.status})`;
		environment[`${c.id}_region`] = `${c.region} (as set up for the run; see METHODOLOGY.md)`;
		environment[`${c.id}_instance`] = c.instance;
		environment[`${c.id}_price`] =
			c.price && c.price.usd_per_hour !== null
				? `$${c.price.usd_per_hour}/hour, ${c.price.basis}, read ${c.price.read_on ?? "on an unrecorded date"} from ${c.price.source_url}`
				: `not recorded (${c.price?.source_url ?? "no pricing page"})`;

		const doc = {
			version: 1,
			bench: bench.slug,
			ran_at: ranAtIso,
			environment,
			summary: summarize(results, rows),
			contenders: results,
		};
		const text = JSON.stringify(doc, null, "\t") + "\n";
		await writeAtomic(latestPath, text);
		await writeAtomic(historyPath, text);
	}
	log(`wrote ${path.relative(root, latestPath)} and ${path.relative(root, historyPath)}`);
	log(summarize(results, rows));
}

await main();
