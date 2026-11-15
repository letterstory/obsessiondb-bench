import {
	bench,
	bestValue,
	contenderUrl,
	formatMs,
	formatParts,
	formatValue,
	isScored,
	perQueryMedians,
	primaryMetric,
	ranked,
	type ContenderResult,
	type Results,
} from "@/lib/bench";

const order = [bench.subject.id, ...bench.competitors.map((c) => c.id)];

// Each contender keeps one colour everywhere: the subject the accent, the rest neutrals.
function series(id: string): string {
	const i = order.indexOf(id);
	return `series-${i < 0 ? order.length : i}`;
}

function ContenderName({ c }: { c: ContenderResult }) {
	const url = contenderUrl(c.id);
	return url ? <a href={url}>{c.name}</a> : <>{c.name}</>;
}

function Status({ status }: { status: ContenderResult["status"] }) {
	return <span className={`status status-${status}`}>{status}</span>;
}

// The ranked leaderboard on the primary metric: one row per contender, best first.
export function Leaderboard({ results }: { results: Results }) {
	const rows = ranked(results);
	const values = rows.filter(isScored).map((c) => c.metrics[primaryMetric.key] as number);
	const max = values.length ? Math.max(...values) : 0;
	const lead = values[0];
	let rank = 0;
	return (
		<figure className="board">
			<figcaption className="board-head">
				<span className="board-title">{primaryMetric.label}</span>
				<span className="board-sub">
					Server-side, {primaryMetric.better} is better · <code>{primaryMetric.key}</code>
				</span>
			</figcaption>
			<ol className="board-rows">
				{rows.map((c) => {
					const scored = isScored(c);
					if (scored) rank += 1;
					const value = c.metrics[primaryMetric.key] as number;
					const parts = formatParts(scored ? value : null, primaryMetric);
					const ratio = scored && rank > 1 && lead > 0 ? value / lead : null;
					return (
						<li key={c.id} className={`board-row ${series(c.id)}`}>
							<span className="board-rank" aria-label={scored ? `Rank ${rank}` : "Not ranked"}>
								{scored ? rank : "—"}
							</span>
							<span className="board-who">
								<span className="swatch" aria-hidden="true" />
								<ContenderName c={c} />
								<Status status={c.status} />
							</span>
							<span className="board-value">
								<span className="big-num">{parts.num}</span>
								{parts.unit ? <span className="big-unit">{parts.unit}</span> : null}
							</span>
							<span className="board-bar" aria-hidden="true">
								{scored && max > 0 ? <span className="bar" style={{ width: `${Math.max((value / max) * 100, 1.5)}%` }} /> : null}
							</span>
							<span className="board-ratio">
								{ratio !== null ? `${ratio.toFixed(2)}× the leader's time` : scored ? "Leader" : "Not measured"}
							</span>
							{!scored && c.notes ? <span className="board-note">{c.notes}</span> : null}
						</li>
					);
				})}
			</ol>
		</figure>
	);
}

function region(results: Results, id: string): string | null {
	const r = results.environment[`${id}_region`];
	return r ? r.replace(/ \(as set up.*\)$/, "") : null;
}

// The two services run on different instance sizes; this sits next to every comparison.
export function Instances({ results }: { results: Results }) {
	const sized = results.contenders.filter((c) => results.environment[`${c.id}_instance`]);
	if (sized.length === 0) return null;
	return (
		<aside className="caveat" aria-labelledby={`sizes-${results.ran_at}`}>
			<h3 id={`sizes-${results.ran_at}`} className="caveat-title">
				Instance sizes differ
			</h3>
			<dl className="caveat-list">
				{sized.map((c) => (
					<div key={c.id} className={series(c.id)}>
						<dt>
							<span className="swatch" aria-hidden="true" />
							{c.name}
						</dt>
						<dd>
							{results.environment[`${c.id}_instance`]}
							{region(results, c.id) ? <span className="muted"> · {region(results, c.id)}</span> : null}
						</dd>
					</div>
				))}
			</dl>
			<p className="caveat-foot">
				Read the numbers with this in mind. The <a href="/methodology">methodology</a> says which work each size favours.
			</p>
		</aside>
	);
}

// Every metric, one row each, with a column per contender: narrow enough for a phone.
export function MetricsTable({ results, caption }: { results: Results; caption?: string }) {
	const contenders = ranked(results);
	return (
		<div className="table-scroll" role="region" aria-label={caption ?? "All metrics"} tabIndex={0}>
			<table className="metrics">
				{caption ? <caption>{caption}</caption> : null}
				<thead>
					<tr>
						<th scope="col">Metric</th>
						{contenders.map((c) => (
							<th scope="col" key={c.id} className={`num ${series(c.id)}`}>
								<span className="th-name">
									<span className="swatch" aria-hidden="true" />
									{c.name}
								</span>
								<Status status={c.status} />
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{bench.metrics.map((m) => {
						const best = contenders.filter((c) => c.status === "ok").length > 1 ? bestValue(results, m) : null;
						return (
							<tr key={m.key} className={m.primary ? "is-primary" : undefined}>
								<th scope="row">
									<span className="metric-label">
										{m.label}
										{m.primary ? <span className="tag">Primary</span> : null}
									</span>
									<span className="metric-meta">
										{m.better} is better<code> · {m.key}</code>
									</span>
								</th>
								{contenders.map((c) => {
									const v = c.metrics[m.key];
									const isBest = best !== null && v === best;
									return (
										<td key={c.id} className={isBest ? "num is-best" : "num"}>
											{formatValue(v, m)}
											{isBest ? <span className="best">Best</span> : null}
										</td>
									);
								})}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

export function ContenderNotes({ results }: { results: Results }) {
	const withNotes = results.contenders.filter((c) => c.notes);
	if (withNotes.length === 0) return null;
	return (
		<ul className="notes">
			{withNotes.map((c) => (
				<li key={c.id}>
					<strong>{c.name}:</strong> {c.notes}
				</li>
			))}
		</ul>
	);
}

const LOG_TICKS = [1, 10, 100, 1000, 10000, 100000];

// Median server time of each of the 43 queries, one column per query, on a log scale.
export function QueryChart({ results }: { results: Results }) {
	const { contenders, queries } = perQueryMedians(results);
	if (contenders.length === 0 || queries.length === 0) return null;
	const all = queries.flatMap((q) => q.ms).filter((v): v is number => v !== null);
	if (all.length === 0) return null;
	const floor = 1;
	const top = LOG_TICKS.find((t) => t >= Math.max(...all)) ?? LOG_TICKS[LOG_TICKS.length - 1];
	const ticks = LOG_TICKS.filter((t) => t <= top);
	const W = 960;
	const H = 300;
	const m = { l: 52, r: 12, t: 12, b: 34 };
	const step = (W - m.l - m.r) / queries.length;
	const x = (i: number) => m.l + step * (i + 0.5);
	const y = (ms: number) => {
		const v = Math.log10(Math.max(ms, floor));
		return m.t + (H - m.t - m.b) * (1 - v / Math.log10(top));
	};
	const tickLabel = (t: number) => (t >= 1000 ? `${t / 1000} s` : `${t} ms`);
	const id = `chart-${results.ran_at.replace(/[^0-9]/g, "")}`;

	let lowerCount: number | null = null;
	if (contenders.length === 2) {
		lowerCount = queries.filter((q) => q.ms[0] !== null && q.ms[1] !== null && (q.ms[0] as number) < (q.ms[1] as number)).length;
	}
	const comparable = queries.filter((q) => q.ms.every((v) => v !== null)).length;

	return (
		<figure className="chart" aria-labelledby={`${id}-title`}>
			<div className="chart-head">
				<div>
					<h3 id={`${id}-title`} className="chart-title">
						Median server time per query
					</h3>
					<p className="chart-sub">
						{queries.length} ClickBench queries, log scale, lower is better.
						{lowerCount !== null
							? ` ${contenders[0].name} was faster on ${lowerCount} of ${comparable}.`
							: ""}
					</p>
				</div>
				<ul className="legend">
					{contenders.map((c) => (
						<li key={c.id} className={series(c.id)}>
							<span className="swatch" aria-hidden="true" />
							{c.name}
						</li>
					))}
				</ul>
			</div>
			<div className="chart-scroll" role="region" aria-label="Chart, scrolls sideways on small screens" tabIndex={0}>
				<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-title ${id}-desc`} className="chart-svg">
					<desc id={`${id}-desc`}>
						Dot plot of each query's median server time per contender. The same numbers are in the table below the chart.
					</desc>
					{ticks.map((t) => (
						<g key={t}>
							<line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="grid" />
							<text x={m.l - 8} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
								{tickLabel(t)}
							</text>
						</g>
					))}
					{queries.map((q, i) => {
						const vals = q.ms.filter((v): v is number => v !== null);
						return (
							<g key={q.query}>
								{vals.length > 1 ? <line x1={x(i)} x2={x(i)} y1={y(Math.min(...vals))} y2={y(Math.max(...vals))} className="stem" /> : null}
								{q.ms.map((v, ci) =>
									v === null ? null : (
										<circle key={contenders[ci].id} cx={x(i) + (ci - (contenders.length - 1) / 2) * 3} cy={y(v)} r={4} className={`dot ${series(contenders[ci].id)}`}>
											<title>{`Q${q.query}, ${contenders[ci].name}: ${formatMs(v)}`}</title>
										</circle>
									),
								)}
								{(q.query === 1 || q.query % 5 === 0 || q.query === queries.length) && (
									<text x={x(i)} y={H - m.b + 18} className="axis" textAnchor="middle">
										Q{q.query}
									</text>
								)}
							</g>
						);
					})}
				</svg>
			</div>
			<QueryTable results={results} />
		</figure>
	);
}

export function QueryTable({ results }: { results: Results }) {
	const { contenders, queries } = perQueryMedians(results);
	if (contenders.length === 0) return null;
	return (
		<details className="disclosure">
			<summary>Per-query medians as a table</summary>
			<div className="table-scroll" role="region" aria-label="Per-query median server times" tabIndex={0}>
				<table className="compact">
					<thead>
						<tr>
							<th scope="col">Query</th>
							{contenders.map((c) => (
								<th scope="col" key={c.id} className="num">
									{c.name}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{queries.map((q) => (
							<tr key={q.query}>
								<th scope="row">Q{q.query}</th>
								{q.ms.map((v, i) => (
									<td key={contenders[i].id} className="num">
										{v === null ? "failed" : formatMs(v)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</details>
	);
}

export function EndToEnd({ results }: { results: Results }) {
	const keys = ["geomean_query_ms", "p99_latency_ms", "p50_latency_ms", "suite_seconds", "concurrent_p99_ms"];
	const metrics = bench.metrics.filter((m) => keys.includes(m.key));
	const measured = results.contenders.filter((c) => c.details?.end_to_end);
	if (measured.length === 0) return null;
	return (
		<details className="disclosure">
			<summary>End-to-end times at the client</summary>
			<p className="muted">Measured where the bench ran, so they include the network distance to each service. The leaderboard uses server time.</p>
			<div className="table-scroll" role="region" aria-label="End-to-end times at the client" tabIndex={0}>
				<table className="compact">
					<thead>
						<tr>
							<th scope="col">Metric</th>
							{measured.map((c) => (
								<th scope="col" key={c.id} className="num">
									{c.name}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{metrics.map((m) => (
							<tr key={m.key}>
								<th scope="row">{m.label}</th>
								{measured.map((c) => (
									<td key={c.id} className="num">
										{formatValue(c.details?.end_to_end?.[m.key], m)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</details>
	);
}

export function Environment({ results }: { results: Results }) {
	return (
		<details className="disclosure">
			<summary>Environment</summary>
			<dl className="env">
				{Object.entries(results.environment).map(([key, value]) => (
					<div key={key}>
						<dt>{key}</dt>
						<dd>{value}</dd>
					</div>
				))}
			</dl>
		</details>
	);
}

export function JsonLd({ data }: { data: unknown }) {
	return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
