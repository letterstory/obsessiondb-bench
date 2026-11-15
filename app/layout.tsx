import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { bench } from "@/lib/bench";
import "@fontsource-variable/inter";
import "./globals.css";

// Letter Visitors tag, exactly as AGENTS.md gives it.
const visitors = "(function(w,d){var h=null;try{var l=w.localStorage,p=JSON.parse(l.getItem(\"lv:vp:\"+\"lv_pub_rfj96k4u6z899fafczsqotu8\")||\"[]\"),q=(location.pathname||\"/\").replace(/\\/{2,}/g,\"/\").replace(/(.)\\/+$/,\"$1\");if(!l.getItem(\"lv:seen:\"+\"lv_pub_rfj96k4u6z899fafczsqotu8\")||p.indexOf(q)>=0){h=d.createElement(\"style\");h.textContent=\"html{opacity:0!important}\";d.head.appendChild(h)}l.setItem(\"lv:seen:\"+\"lv_pub_rfj96k4u6z899fafczsqotu8\",\"1\")}catch(e){}w.__lvReveal=function(){if(h&&h.parentNode)h.parentNode.removeChild(h);h=null};setTimeout(function(){if(h)w.__lvLate=1;w.__lvReveal()},1000);var s=d.createElement(\"script\");s.src=\"https://lettervisit.com/v.js?k=lv_pub_rfj96k4u6z899fafczsqotu8\";s.async=true;s.setAttribute(\"data-key\",\"lv_pub_rfj96k4u6z899fafczsqotu8\");s.onerror=w.__lvReveal;d.head.appendChild(s)})(window,document)";

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
				<script dangerouslySetInnerHTML={{ __html: visitors }} />
			</head>
			<body>
				<a href="#content" className="skip">
					Skip to content
				</a>
				<header className="site-header">
					<div className="wrap header-row">
						<Link href="/" className="brand" aria-label={`${bench.name} home`}>
							<Logo name={bench.name} />
						</Link>
						<nav aria-label="Main">
							<Link href="/">Leaderboard</Link>
							<Link href="/results">Results</Link>
							<Link href="/methodology">Methodology</Link>
							<Link href="/replicate">Replicate</Link>
							<a href={bench.repo} className="nav-ext">
								GitHub
							</a>
						</nav>
					</div>
				</header>
				<main id="content" className="wrap">
					{children}
				</main>
				<footer className="site-footer">
					<div className="wrap footer-row">
						<Link href="/" className="brand" aria-label={`${bench.name} home`}>
							<Logo name={bench.name} />
						</Link>
						<p>
							<a href="/results/latest.json">results/latest.json</a>
							<a href="/llms.txt">llms.txt</a>
							<a href={bench.repo}>Code on GitHub</a>
							<span>{bench.license} license</span>
						</p>
					</div>
				</footer>
			</body>
		</html>
	);
}
