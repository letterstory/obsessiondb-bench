import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

export type Metric = {
	key: string;
	label: string;
	unit: string;
	better: "lower" | "higher";
	primary: boolean;
};

export type BenchConfig = {
	slug: string;
	name: string;
	tagline: string;
	site: string;
	repo: string;
	license: string;
	subject: { id: string; name: string; url: string };
	competitors: { id: string; name: string; url: string; env: string[] }[];
	metrics: Metric[];
	scenarios: { key: string; label: string; description: string }[];
};

export type ContenderResult = {
	id: string;
	name: string;
	status: "ok" | "skipped" | "failed";
	metrics: Record<string, number | null>;
	notes: string | null;
	details?: {
		end_to_end?: Record<string, number | null>;
		[key: string]: unknown;
	};
};

export type Results = {
	version: number;
	bench: string;
	ran_at: string;
	environment: Record<string, string>;
	summary: string;
	contenders: ContenderResult[];
};

export const bench: BenchConfig = JSON.parse(readFileSync(path.join(root, "bench.json"), "utf8"));

export const primaryMetric: Metric = bench.metrics.find((m) => m.primary) ?? bench.metrics[0];

export function readDoc(file: "METHODOLOGY.md" | "REPLICATE.md"): string {
	const full = file === "METHODOLOGY.md" ? path.join(root, "METHODOLOGY.md") : path.join(root, "REPLICATE.md");
	return readFileSync(full, "utf8");
}

export function latestRaw(): string | null {
	const file = path.join(root, "results", "latest.json");
	return existsSync(file) ? readFileSync(file, "utf8") : null;
}

export function latest(): Results | null {
	const raw = latestRaw();
	return raw ? (JSON.parse(raw) as Results) : null;
}

export function history(): { file: string; results: Results }[] {
	const dir = path.join(root, "results", "history");
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
		.sort()
		.reverse()
		.map((file) => ({ file, results: JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Results }));
}

// Contenders with a primary-metric value first, best first; then the rest in bench.json order.
export function ranked(results: Results): ContenderResult[] {
	const sign = primaryMetric.better === "lower" ? 1 : -1;
	const value = (c: ContenderResult) => (c.status === "ok" ? c.metrics[primaryMetric.key] : null);
	const scored = results.contenders.filter((c) => value(c) !== null && value(c) !== undefined);
	const rest = results.contenders.filter((c) => !scored.includes(c));
	return [...scored.sort((a, b) => ((value(a) as number) - (value(b) as number)) * sign), ...rest];
}

export function formatValue(value: number | null | undefined, metric: Metric): string {
	if (value === null || value === undefined) return "—";
	if (metric.unit === "USD") return `$${value.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
	const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
	return `${value.toLocaleString("en-US", { maximumFractionDigits: digits })} ${metric.unit}`;
}

// The number and unit apart, so a page can set them in different sizes.
export function formatParts(value: number | null | undefined, metric: Metric): { num: string; unit: string } {
	if (value === null || value === undefined) return { num: "—", unit: "" };
	if (metric.unit === "USD") return { num: `$${value.toLocaleString("en-US", { maximumFractionDigits: 6 })}`, unit: "" };
	const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
	return { num: value.toLocaleString("en-US", { maximumFractionDigits: digits }), unit: metric.unit };
}

export function formatMs(ms: number): string {
	if (ms >= 1000) return `${(ms / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} s`;
	return `${ms.toLocaleString("en-US", { maximumFractionDigits: 1 })} ms`;
}

export function formatDay(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" });
}

export function isScored(c: ContenderResult): boolean {
	const v = c.metrics[primaryMetric.key];
	return c.status === "ok" && v !== null && v !== undefined;
}

// The best value of a metric among contenders that ran, or null when none has one.
export function bestValue(results: Results, metric: Metric): number | null {
	const values = results.contenders
		.filter((c) => c.status === "ok")
		.map((c) => c.metrics[metric.key])
		.filter((v): v is number => typeof v === "number");
	if (values.length === 0) return null;
	return metric.better === "lower" ? Math.min(...values) : Math.max(...values);
}

function median(values: number[]): number | null {
	if (values.length === 0) return null;
	const s = [...values].sort((a, b) => a - b);
	const mid = (s.length - 1) / 2;
	return (s[Math.floor(mid)] + s[Math.ceil(mid)]) / 2;
}

type WarmQuery = { query: number; status: string; server_ms: (number | null)[] | null };

// Each ClickBench query's median server time per contender, from the run's raw timings.
export function perQueryMedians(results: Results): { contenders: ContenderResult[]; queries: { query: number; ms: (number | null)[] }[] } {
	const contenders = results.contenders.filter((c) => c.status === "ok" && Array.isArray(c.details?.clickbench_warm));
	const byQuery = new Map<number, (number | null)[]>();
	contenders.forEach((c, i) => {
		for (const q of c.details?.clickbench_warm as WarmQuery[]) {
			const row = byQuery.get(q.query) ?? contenders.map(() => null);
			const times = (q.server_ms ?? []).filter((v): v is number => typeof v === "number");
			row[i] = q.status === "ok" && times.length > 0 ? median(times) : null;
			byQuery.set(q.query, row);
		}
	});
	const queries = [...byQuery.entries()].sort((a, b) => a[0] - b[0]).map(([query, ms]) => ({ query, ms }));
	return { contenders, queries };
}

export function rowsLoaded(results: Results): number | null {
	for (const c of results.contenders) {
		const rows = (c.details?.load as { rows?: number } | undefined)?.rows;
		if (typeof rows === "number") return rows;
	}
	return null;
}

export function formatDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

export function contenderUrl(id: string): string | null {
	if (id === bench.subject.id) return bench.subject.url;
	return bench.competitors.find((c) => c.id === id)?.url ?? null;
}

export function absolute(pathname: string): string {
	return new URL(pathname, bench.site).toString();
}

export function datasetJsonLd(results: Results | null, pathname: string, description: string) {
	return {
		"@context": "https://schema.org",
		"@type": "Dataset",
		name: `${bench.name} results`,
		description,
		url: absolute(pathname),
		license: "https://opensource.org/licenses/MIT",
		creator: { "@type": "Organization", name: "Letter (The Letter Company)" },
		isAccessibleForFree: true,
		variableMeasured: bench.metrics.map((m) => ({
			"@type": "PropertyValue",
			name: m.label,
			propertyID: m.key,
			unitText: m.unit,
		})),
		...(results ? { dateModified: results.ran_at, temporalCoverage: results.ran_at } : {}),
		distribution: [
			{
				"@type": "DataDownload",
				encodingFormat: "application/json",
				contentUrl: absolute("/results/latest.json"),
			},
		],
	};
}
