import type { Metadata } from "next";
import { ContenderNotes, EndToEnd, Environment, JsonLd, Leaderboard } from "@/components/Leaderboard";
import { bench, datasetJsonLd, formatDate, history, latest } from "@/lib/bench";

const description = `Every ${bench.name} run, newest first: ObsessionDB and ClickHouse Cloud on ClickBench, with each run's environment and raw numbers.`;

export const metadata: Metadata = {
	title: "Results",
	description,
	alternates: { canonical: "/results" },
};

export default function ResultsPage() {
	const runs = history();
	return (
		<>
			<JsonLd data={datasetJsonLd(latest(), "/results", description)} />
			<h1>Results</h1>
			<p>
				Every run the harness wrote to <code>results/history/</code>, newest first. The latest run as raw JSON:{" "}
				<a href="/results/latest.json">results/latest.json</a>.
			</p>
			{runs.length === 0 ? (
				<p>No run has been published yet.</p>
			) : (
				runs.map(({ file, results }) => (
					<section key={file} id={file.replace(/\.json$/, "")} className="run">
						<h2>
							<time dateTime={results.ran_at}>{formatDate(results.ran_at)}</time>
						</h2>
						<p className="muted">
							<code>results/history/{file}</code>
						</p>
						<p className="summary">{results.summary}</p>
						<Leaderboard results={results} />
						<ContenderNotes results={results} />
						<EndToEnd results={results} />
						<Environment results={results} />
					</section>
				))
			)}
		</>
	);
}
