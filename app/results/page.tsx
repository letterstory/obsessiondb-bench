import type { Metadata } from "next";
import { ContenderNotes, EndToEnd, Environment, Instances, JsonLd, Leaderboard, MetricsTable, QueryTable } from "@/components/Leaderboard";
import { bench, datasetJsonLd, formatDate, formatDay, formatValue, history, latest, primaryMetric } from "@/lib/bench";

const description = `Every ${bench.name} run, newest first: ObsessionDB and ClickHouse Cloud on ClickBench, with each run's environment and raw numbers.`;

export const metadata: Metadata = {
	title: "Results",
	description,
	alternates: { canonical: "/results" },
};

const contenders = [bench.subject, ...bench.competitors];

// history() only returns YYYY-MM-DD.json names; keep just the date digits for anchors and ids.
const runId = (file: string) => /^(\d{4}-\d{2}-\d{2})/.exec(file)?.[1] ?? "run";

export default function ResultsPage() {
	const runs = history();
	return (
		<>
			<JsonLd data={datasetJsonLd(latest(), "/results", description)} />
			<section className="hero hero-small">
				<p className="eyebrow">{bench.name} · archive</p>
				<h1>Results</h1>
				<p className="lede">
					Every run the harness wrote to <code>results/history/</code>, newest first. The latest as raw JSON:{" "}
					<a href="/results/latest.json">results/latest.json</a>. Code: <a href={bench.repo}>{bench.repo.replace("https://", "")}</a>.
				</p>
			</section>
			{runs.length === 0 ? (
				<p>No run has been published yet.</p>
			) : (
				<>
					<div className="table-scroll" role="region" aria-label="Runs" tabIndex={0}>
						<table className="metrics runs-index">
							<caption>
								{primaryMetric.label} per run, {primaryMetric.better} is better
							</caption>
							<thead>
								<tr>
									<th scope="col">Run</th>
									{contenders.map((c) => (
										<th scope="col" key={c.id} className="num">
											{c.name}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{runs.map(({ file, results }) => (
									<tr key={file}>
										<th scope="row">
											<a href={`#${runId(file)}`}>
												<time dateTime={results.ran_at}>{formatDay(results.ran_at)}</time>
											</a>
										</th>
										{contenders.map((c) => {
											const r = results.contenders.find((x) => x.id === c.id);
											return (
												<td key={c.id} className="num">
													{r ? (r.status === "ok" ? formatValue(r.metrics[primaryMetric.key], primaryMetric) : r.status) : "—"}
												</td>
											);
										})}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{runs.map(({ file, results }) => (
						<section key={file} id={runId(file)} className="run" aria-labelledby={`h-${runId(file)}`}>
							<div className="section-head">
								<h2 id={`h-${runId(file)}`}>
									<time dateTime={results.ran_at}>{formatDate(results.ran_at)}</time>
								</h2>
								<p className="run-meta">
									<code>results/history/{file}</code>
								</p>
							</div>
							<div className="compare">
								<Leaderboard results={results} />
								<Instances results={results} />
							</div>
							<p className="summary">{results.summary}</p>
							<MetricsTable results={results} caption={`Every metric, run of ${formatDay(results.ran_at)}`} />
							<ContenderNotes results={results} />
							<QueryTable results={results} />
							<EndToEnd results={results} />
							<Environment results={results} />
						</section>
					))}
				</>
			)}
		</>
	);
}
