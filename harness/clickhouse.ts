// A minimal client for the ClickHouse HTTP interface, used the same way for every contender.
// Built on node:http(s) so long loads are not cut off by fetch's header and body timeouts.
import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";

export type Connection = {
	url: URL;
	user: string;
	password: string;
	secrets: string[];
};

export type QueryOptions = {
	database?: string;
	queryId?: string;
	settings?: Record<string, string | number>;
	timeoutMs: number;
};

export type QueryResult = {
	body: string;
	ms: number;
};

export class QueryError extends Error {
	// "http" when the service answered with an error, "network" when it could not be reached.
	kind: "http" | "network" | "timeout";
	status: number | null;
	// Whether trying again later can help: a service that is still waking up, not a wrong setting.
	retryable: boolean;
	constructor(message: string, kind: "http" | "network" | "timeout", status: number | null = null, retryable = false) {
		super(message);
		this.kind = kind;
		this.status = status;
		this.retryable = retryable;
	}
}

const agents = {
	"http:": new http.Agent({ keepAlive: true, maxSockets: 64 }),
	"https:": new https.Agent({ keepAlive: true, maxSockets: 64 }),
};

// Removes every credential value from a message before it is logged or written.
export function redact(message: string, secrets: string[]): string {
	let out = message;
	for (const secret of secrets) {
		if (secret && secret.length >= 3) out = out.split(secret).join("[redacted]");
	}
	return out;
}

export function connect(host: string, port: string, user: string, password: string): Connection {
	const secrets = [password, host, user, port].filter((s) => s.length > 0);
	const trimmedPort = port.trim();
	if (!/^\d{1,5}$/.test(trimmedPort) || Number(trimmedPort) > 65535) {
		throw new QueryError("the port variable is not a valid port number", "network");
	}
	const raw = /^https?:\/\//i.test(host.trim()) ? host.trim() : `https://${host.trim()}`;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new QueryError("the host variable is not a valid host name", "network");
	}
	url.port = trimmedPort;
	url.pathname = "/";
	url.search = "";
	return { url, user, password, secrets };
}

const NETWORK_ERRORS: Record<string, string> = {
	ECONNREFUSED: "connection refused",
	ECONNRESET: "connection reset",
	ENOTFOUND: "host not found",
	EAI_AGAIN: "DNS lookup failed",
	EHOSTUNREACH: "host unreachable",
	ENETUNREACH: "network unreachable",
	ETIMEDOUT: "connection timed out",
	CERT_HAS_EXPIRED: "TLS certificate expired",
	DEPTH_ZERO_SELF_SIGNED_CERT: "self-signed TLS certificate",
	ERR_SSL_WRONG_VERSION_NUMBER: "TLS handshake failed (is the port an HTTPS port?)",
	EPROTO: "TLS handshake failed (is the port an HTTPS port?)",
};

const RETRYABLE = new Set(["ECONNREFUSED", "ECONNRESET", "EAI_AGAIN", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "EPIPE"]);

export function query(conn: Connection, sql: string, options: QueryOptions): Promise<QueryResult> {
	const url = new URL(conn.url);
	if (options.database) url.searchParams.set("database", options.database);
	if (options.queryId) url.searchParams.set("query_id", options.queryId);
	url.searchParams.set("wait_end_of_query", "1");
	for (const [name, value] of Object.entries(options.settings ?? {})) url.searchParams.set(name, String(value));

	const lib = url.protocol === "http:" ? http : https;
	const agent = agents[url.protocol === "http:" ? "http:" : "https:"];
	const body = Buffer.from(sql, "utf8");

	return new Promise((resolve, reject) => {
		const start = performance.now();
		let settled = false;
		const finish = (error: QueryError | null, result?: QueryResult) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (error) reject(new QueryError(redact(error.message, conn.secrets), error.kind, error.status, error.retryable));
			else resolve(result as QueryResult);
		};
		const req = lib.request(
			url,
			{
				method: "POST",
				agent,
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
					"Content-Length": body.length,
					"X-ClickHouse-User": conn.user,
					"X-ClickHouse-Key": conn.password,
				},
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on("data", (chunk: Buffer) => chunks.push(chunk));
				res.on("error", (err: NodeJS.ErrnoException) => finish(networkError(err)));
				res.on("end", () => {
					const ms = performance.now() - start;
					const text = Buffer.concat(chunks).toString("utf8");
					const status = res.statusCode ?? 0;
					if (status !== 200) {
						const detail = text.trim().replace(/\s+/g, " ").slice(0, 400) || "no message";
						finish(new QueryError(`HTTP ${status}: ${detail}`, "http", status, status >= 500));
					} else {
						finish(null, { body: text, ms });
					}
				});
			},
		);
		const timer = setTimeout(() => {
			finish(new QueryError(`timed out after ${Math.round(options.timeoutMs / 1000)} s`, "timeout", null, true));
			req.destroy();
		}, options.timeoutMs);
		req.on("error", (err: NodeJS.ErrnoException) => finish(networkError(err)));
		req.end(body);
	});
}

function networkError(err: NodeJS.ErrnoException): QueryError {
	const code = err.code ?? "";
	const known = NETWORK_ERRORS[code];
	const message = known ? `${known} (${code})` : `request failed${code ? ` (${code})` : ""}: ${err.message.split("\n")[0]}`;
	return new QueryError(message, "network", null, RETRYABLE.has(code));
}
