import type { MetadataRoute } from "next";
import { absolute, latest } from "@/lib/bench";

export default function sitemap(): MetadataRoute.Sitemap {
	const lastModified = latest()?.ran_at;
	return ["/", "/results", "/methodology", "/replicate", "/results/latest.json", "/llms.txt"].map((p) => ({
		url: absolute(p),
		...(lastModified ? { lastModified } : {}),
	}));
}
