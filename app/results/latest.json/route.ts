import { latestRaw } from "@/lib/bench";

export const dynamic = "force-static";

export function GET() {
	const raw = latestRaw();
	if (raw === null) {
		return new Response("No run has been published yet.\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}
	return new Response(raw, { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
