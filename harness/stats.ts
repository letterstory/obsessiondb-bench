// Percentiles use linear interpolation between closest ranks (the same as numpy's default).
export function percentile(values: number[], p: number): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const rank = (p / 100) * (sorted.length - 1);
	const low = Math.floor(rank);
	const high = Math.ceil(rank);
	return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

export function sum(values: number[]): number {
	return values.reduce((a, b) => a + b, 0);
}

export function geomean(values: number[]): number | null {
	if (values.length === 0 || values.some((v) => !(v > 0))) return null;
	return Math.exp(sum(values.map((v) => Math.log(v))) / values.length);
}

export function round(value: number | null, digits: number): number | null {
	if (value === null || !Number.isFinite(value)) return null;
	const f = 10 ** digits;
	return Math.round(value * f) / f;
}

// Small deterministic PRNG, so every contender gets the same shuffled order.
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function shuffled<T>(items: T[], seed: number): T[] {
	const random = mulberry32(seed);
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
