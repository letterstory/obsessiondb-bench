import { marked } from "marked";
import { readDoc } from "@/lib/bench";

export function Markdown({ file }: { file: "METHODOLOGY.md" | "REPLICATE.md" }) {
	const html = marked.parse(readDoc(file), { async: false, gfm: true });
	return <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
