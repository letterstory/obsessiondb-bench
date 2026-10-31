import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";

export const metadata: Metadata = {
	title: "Replicate",
	description: "Reproduce ObsessionBench yourself: what you need, how to run the harness against your own accounts and how to compare with the published results.",
	alternates: { canonical: "/replicate" },
};

export default function ReplicatePage() {
	return <Markdown file="REPLICATE.md" />;
}
