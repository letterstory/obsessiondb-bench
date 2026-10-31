import type { Metadata } from "next";
import Link from "next/link";
import { ContenderNotes, EndToEnd, Environment, JsonLd, Leaderboard } from "@/components/Leaderboard";
import { bench, datasetJsonLd, formatDate, latest, primaryMetric } from "@/lib/bench";

const description = `${bench.tagline} The leaderboard from the latest run, ranked on ${primaryMetric.label.toLowerCase()}.`;

export const metadata: Metadata = {
	title: { absolute: `${bench.name}: ObsessionDB vs ClickHouse Cloud on ClickBench` },
	description,
	alternates: { canonical: "/" },
};

export default function Home() {
	const results = latest();
	return (
		<>
			<JsonLd data={datasetJsonLd(results, "/", description)} />
			<section className="intro">
				<h1>{bench.name}</h1>
				<p className="lede">{bench.tagline}</p>
			</section>

			<section>
				<h2>Leaderboard</h2>
				{results ? (
					<>
						<p className="run-meta">
							Run of <time dateTime={results.ran_at}>{formatDate(results.ran_at)}</time>. Ranked on {primaryMetric.label.toLowerCase()} ({primaryMetric.better} is
							better).
						</p>
						<p className="summary">{results.summary}</p>
						<Leaderboard results={results} />
						<ContenderNotes results={results} />
						<EndToEnd results={results} />
						<Environment results={results} />
					</>
				) : (
					<p>No run has been published yet. The first results appear here once the harness has run.</p>
				)}
			</section>

			<section>
				<h2>What is measured</h2>
				<ul className="scenarios">
					{bench.scenarios.map((s) => (
						<li key={s.key}>
							<strong>{s.label}.</strong> {s.description.replace(/`/g, "")}
						</li>
					))}
				</ul>
				<p>
					How it is run and why it is fair: <Link href="/methodology">methodology</Link>. Run it yourself: <Link href="/replicate">replicate</Link>. Every run:{" "}
					<Link href="/results">results</Link>.
				</p>
			</section>
		</>
	);
}
