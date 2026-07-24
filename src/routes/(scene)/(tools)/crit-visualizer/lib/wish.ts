// Wish odds — 5★ timing and featured-item distributions.
//
// Model of record: docs/library/game/wish-mechanics.md (pity tables from
// GGanalysis / large-sample community analysis; featured rules from official
// banner details). Deliberate simplification, stated in-app: Capturing
// Radiance is modeled at its OFFICIAL consolidated 55% featured rate — the
// interior loss-counter is not fully reverse-engineered, so we don't guess.

export type BannerId = 'character' | 'weapon';

export type BannerDef = {
	id: BannerId;
	/** Flat rate before soft pity */
	base: number;
	/** First pull (1-indexed, counting from last 5★) of the soft-pity ramp */
	softStart: number;
	/** Per-pull probability increase during the ramp */
	ramp: number;
	/** Pull at which the 5★ is certain (empirical table, not marketing copy) */
	hard: number;
	/** P(featured/charted item) on a NON-guaranteed 5★ */
	featured: number;
};

export const BANNERS: Record<BannerId, BannerDef> = {
	// 0.6% flat through 73, +6%/pull from 74, certain at 90; consolidated 55%
	// featured (official, incl. Capturing Radiance)
	character: { id: 'character', base: 0.006, softStart: 74, ramp: 0.06, hard: 90, featured: 0.55 },
	// 0.7% flat through 62, +7%/pull from 63, certain at 77 (official ceiling
	// says "within 80" — the ramp saturates first); charted weapon = 75%
	// featured pair × 50% split = 37.5%; 1 fate point since 5.0
	weapon: { id: 'weapon', base: 0.007, softStart: 63, ramp: 0.07, hard: 77, featured: 0.375 }
};

/** P(5★ on this pull), where `pull` counts from the last 5★ (1-indexed). */
export function fiveStarChance(banner: BannerDef, pull: number): number {
	if (pull >= banner.hard) return 1;
	if (pull < banner.softStart) return banner.base;
	return Math.min(1, banner.base + (pull - banner.softStart + 1) * banner.ramp);
}

/**
 * pmf over "which of MY NEXT pulls lands the first 5★", starting from
 * `pity` pulls already accumulated (0 ≤ pity < hard). Index 0 is unused;
 * pmf[k] = P(first 5★ on my k-th pull from now). Sums to 1.
 */
export function fiveStarPmf(banner: BannerDef, pity = 0): number[] {
	const startAt = Math.min(Math.max(0, Math.round(pity)), banner.hard - 1);
	const out: number[] = [0];
	let alive = 1;
	for (let k = 1; startAt + k <= banner.hard; k++) {
		const p = fiveStarChance(banner, startAt + k);
		out.push(alive * p);
		alive *= 1 - p;
	}
	return out;
}

/**
 * pmf over "which of my next pulls lands the FEATURED item" (promotional
 * character / charted weapon). With the guarantee held (lost 50/50 or fate
 * point), it's simply the first-5★ pmf. Otherwise: featured on the first 5★
 * with the banner's consolidated rate, else guaranteed on the second
 * (pity restarts at 0 for it). Worst case = 2 five-stars — exact under the
 * official rules for both banners.
 */
export function featuredPmf(banner: BannerDef, pity = 0, guaranteed = false): number[] {
	const first = fiveStarPmf(banner, pity);
	if (guaranteed) return first;
	const second = fiveStarPmf(banner, 0);
	const out = new Array<number>(first.length + second.length - 1).fill(0);
	for (let i = 1; i < first.length; i++) {
		out[i] += banner.featured * first[i];
		for (let j = 1; j < second.length; j++) {
			out[i + j] += (1 - banner.featured) * first[i] * second[j];
		}
	}
	return out;
}

/** Cumulative form of a pmf: cdf[k] = P(landed within k pulls). */
export function toCdf(pmf: number[]): number[] {
	const out = new Array<number>(pmf.length).fill(0);
	let acc = 0;
	for (let k = 1; k < pmf.length; k++) {
		acc += pmf[k];
		out[k] = acc;
	}
	return out;
}

export function pmfStats(pmf: number[]) {
	let mean = 0;
	for (let k = 1; k < pmf.length; k++) mean += k * pmf[k];
	const percentile = (q: number) => {
		let acc = 0;
		for (let k = 1; k < pmf.length; k++) {
			acc += pmf[k];
			if (acc >= q) return k;
		}
		return pmf.length - 1;
	};
	return { mean, median: percentile(0.5), p90: percentile(0.9) };
}
