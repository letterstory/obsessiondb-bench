import { bench, formatValue, latest, primaryMetric, ranked, readDoc } from "@/lib/bench";

export const dynamic = "force-static";

export function GET() {
	const results = latest();
	const lines: string[] = [
		`# ${bench.name}`,
		"",
		`> ${bench.tagline}`,
		"",
		`A public benchmark of ${bench.subject.name} (${bench.subject.url}) against ${bench.competitors.map((c) => `${c.name} (${c.url})`).join(", ")}.`,
		`Primary metric: ${primaryMetric.label} (\`${primaryMetric.key}\`, ${primaryMetric.unit}, ${primaryMetric.better} is better).`,
		"Built by Letter (The Letter Company) for ObsessionDB, a Letter customer. The code, data source and raw results are in the repo.",
		"",
		`- Leaderboard: ${bench.site}/`,
		`- Methodology: ${bench.site}/methodology`,
		`- Replicate: ${bench.site}/replicate`,
		`- All runs: ${bench.site}/results`,
		`- Raw latest results: ${bench.site}/results/latest.json`,
		"",
		"## Latest run",
		"",
	];
	if (results) {
		lines.push(`Ran at: ${results.ran_at}`, "", `Summary: ${results.summary}`, "", "Leaderboard:", "");
		ranked(results).forEach((c, i) => {
			const metrics = bench.metrics.map((m) => `${m.key}=${formatValue(c.metrics[m.key], m)}`).join(", ");
			lines.push(`${i + 1}. ${c.name} (${c.id}) [${c.status}]: ${metrics}${c.notes ? `. Notes: ${c.notes}` : ""}`);
		});
	} else {
		lines.push("No run has been published yet.");
	}
	lines.push("", "## Replicate", "", readDoc("REPLICATE.md").trim(), "");
	return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
