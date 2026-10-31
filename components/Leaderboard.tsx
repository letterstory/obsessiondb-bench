import { bench, contenderUrl, formatValue, primaryMetric, ranked, type Results } from "@/lib/bench";

export function Leaderboard({ results }: { results: Results }) {
	const rows = ranked(results);
	let rank = 0;
	return (
		<div className="table-scroll">
			<table className="leaderboard">
				<thead>
					<tr>
						<th scope="col">#</th>
						<th scope="col">Contender</th>
						<th scope="col">Status</th>
						{bench.metrics.map((m) => (
							<th scope="col" key={m.key} className={m.primary ? "num primary" : "num"}>
								{m.label}
								<span className="dir">{m.better} is better</span>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((c) => {
						const scored = c.status === "ok" && c.metrics[primaryMetric.key] !== null && c.metrics[primaryMetric.key] !== undefined;
						if (scored) rank += 1;
						const url = contenderUrl(c.id);
						return (
							<tr key={c.id}>
								<td>{scored ? rank : "—"}</td>
								<th scope="row">{url ? <a href={url}>{c.name}</a> : c.name}</th>
								<td>
									<span className={`status status-${c.status}`}>{c.status}</span>
								</td>
								{bench.metrics.map((m) => (
									<td key={m.key} className={m.primary ? "num primary" : "num"}>
										{formatValue(c.metrics[m.key], m)}
									</td>
								))}
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

export function EndToEnd({ results }: { results: Results }) {
	const keys = ["p99_latency_ms", "p50_latency_ms", "suite_seconds", "concurrent_p99_ms"];
	const metrics = bench.metrics.filter((m) => keys.includes(m.key));
	const measured = results.contenders.filter((c) => c.details?.end_to_end);
	if (measured.length === 0) return null;
	return (
		<>
			<h3>End-to-end times at the client</h3>
			<p className="muted">Measured where the bench ran, so they include the network distance to each service. The leaderboard uses server time.</p>
			<div className="table-scroll">
				<table>
					<thead>
						<tr>
							<th scope="col">Contender</th>
							{metrics.map((m) => (
								<th scope="col" key={m.key} className="num">
									{m.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{measured.map((c) => (
							<tr key={c.id}>
								<th scope="row">{c.name}</th>
								{metrics.map((m) => (
									<td key={m.key} className="num">
										{formatValue(c.details?.end_to_end?.[m.key], m)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}

export function Environment({ results }: { results: Results }) {
	return (
		<details className="environment">
			<summary>Environment</summary>
			<dl>
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
