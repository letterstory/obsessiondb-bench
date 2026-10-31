import type { MetadataRoute } from "next";
import { absolute } from "@/lib/bench";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{ userAgent: "*", allow: "/" },
			{ userAgent: ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"], allow: "/" },
		],
		sitemap: absolute("/sitemap.xml"),
	};
}
