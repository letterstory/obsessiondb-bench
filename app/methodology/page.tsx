import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";

export const metadata: Metadata = {
	title: "Methodology",
	description: "How ObsessionBench runs ObsessionDB and ClickHouse Cloud on ClickBench: the setup, the fairness rules, how cost is worked out and what is counted.",
	alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
	return <Markdown file="METHODOLOGY.md" />;
}
