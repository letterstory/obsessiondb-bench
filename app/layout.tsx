import type { Metadata } from "next";
import Link from "next/link";
import { bench } from "@/lib/bench";
import "./globals.css";

export const metadata: Metadata = {
	metadataBase: new URL(bench.site),
	title: {
		default: `${bench.name}: ObsessionDB vs ClickHouse Cloud on ClickBench`,
		template: `%s · ${bench.name}`,
	},
	description: bench.tagline,
	alternates: { canonical: "/" },
	openGraph: {
		siteName: bench.name,
		type: "website",
		url: bench.site,
		title: bench.name,
		description: bench.tagline,
	},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<script async src="https://lettervisit.com/v.js" data-key="lv_pub_rfj96k4u6z899fafczsqotu8"></script>
			</head>
			<body>
				<header className="site-header">
					<div className="wrap">
						<Link href="/" className="brand">
							{bench.name}
						</Link>
						<nav aria-label="Main">
							<Link href="/">Leaderboard</Link>
							<Link href="/results">Results</Link>
							<Link href="/methodology">Methodology</Link>
							<Link href="/replicate">Replicate</Link>
							<a href={bench.repo}>Code on GitHub</a>
						</nav>
					</div>
				</header>
				<main className="wrap">{children}</main>
				<footer className="site-footer">
					<div className="wrap">
						<p>
							<a href="/results/latest.json">results/latest.json</a> · <a href="/llms.txt">llms.txt</a> · <a href={bench.repo}>Code on GitHub</a> · {bench.license} license
						</p>
					</div>
				</footer>
			</body>
		</html>
	);
}
