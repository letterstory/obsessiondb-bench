import type { Metadata } from "next";
import Link from "next/link";
import { ContenderNotes, EndToEnd, Environment, Instances, JsonLd, Leaderboard, MetricsTable, QueryChart } from "@/components/Leaderboard";
import { bench, datasetJsonLd, formatDate, latest, perQueryMedians, primaryMetric, rowsLoaded } from "@/lib/bench";

const description = `${bench.tagline} The leaderboard from the latest run, ranked on ${primaryMetric.label.toLowerCase()}.`;

export const metadata: Metadata = {
	title: { absolute: `${bench.name}: ObsessionDB vs ClickHouse Cloud on ClickBench` },
	description,
	alternates: { canonical: "/" },
};

const [headline, lede] = bench.tagline.includes(": ") ? bench.tagline.split(/: (.+)/) : [bench.tagline, ""];

export default function Home() {
	const results = latest();
	const rows = results ? rowsLoaded(results) : null;
	const reps = results?.environment.repetitions?.match(/\d+/)?.[0];
	const queries = results ? perQueryMedians(results).queries.length : 0;
	return (
		<>
			<JsonLd data={datasetJsonLd(results, "/", description)} />
			<section className="hero">
				<p className="eyebrow">{bench.name} · public benchmark</p>
				<h1>{headline}</h1>
				{lede ? <p className="lede">{lede.charAt(0).toUpperCase() + lede.slice(1)}</p> : null}
			</section>

			<section aria-labelledby="leaderboard">
				<div className="section-head">
					<h2 id="leaderboard">Leaderboard</h2>
					{results ? (
						<p className="run-meta">
							<span>
								Latest run <time dateTime={results.ran_at}>{formatDate(results.ran_at)}</time>
							</span>
							{rows ? <span>{rows.toLocaleString("en-US")} rows</span> : null}
							{reps && queries ? (
								<span>
									{queries} queries × {reps} timed runs
								</span>
							) : null}
							<a href="/results/latest.json">Raw JSON</a>
						</p>
					) : null}
				</div>
				{results ? (
					<>
						<div className="compare">
							<Leaderboard results={results} />
							<Instances results={results} />
						</div>
						<p className="summary">{results.summary}</p>
						<QueryChart results={results} />
					</>
				) : (
					<p>No run has been published yet. The first results appear here once the harness has run.</p>
				)}
			</section>

			{results ? (
				<section aria-labelledby="all-metrics">
					<div className="section-head">
						<h2 id="all-metrics">All metrics</h2>
						<p className="run-meta">
							<span>Latency and cost from server time; load speed timed at the client</span>
						</p>
					</div>
					<MetricsTable results={results} caption="Every metric from the latest run" />
					<ContenderNotes results={results} />
					<EndToEnd results={results} />
					<Environment results={results} />
				</section>
			) : null}

			<section aria-labelledby="measured">
				<div className="section-head">
					<h2 id="measured">What is measured</h2>
				</div>
				<ol className="scenarios">
					{bench.scenarios.map((s) => (
						<li key={s.key}>
							<h3>{s.label}</h3>
							<p>{s.description.replace(/`/g, "")}</p>
						</li>
					))}
				</ol>
				<ul className="next-links">
					<li>
						<Link href="/methodology">
							<strong>Methodology</strong>
							<span>How it is run and why it is fair</span>
						</Link>
					</li>
					<li>
						<Link href="/replicate">
							<strong>Replicate</strong>
							<span>Run it yourself against your own accounts</span>
						</Link>
					</li>
					<li>
						<Link href="/results">
							<strong>Results</strong>
							<span>Every run, newest first</span>
						</Link>
					</li>
				</ul>
			</section>
		</>
	);
}
