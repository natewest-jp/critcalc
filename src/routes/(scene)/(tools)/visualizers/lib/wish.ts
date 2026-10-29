// Wish odds — how many pulls a number of COPIES takes.
//
// Model of record: docs/library/game/wish-mechanics.md (pity tables from
// GGanalysis / large-sample community analysis; featured rules from official
// banner details). Every target — a 5★ character's constellations, a featured
// 4★'s constellations, a charted weapon's refinements — is the same chain:
// a pity counter, a guarantee flag and a copy count, stepped one pull at a
// time. Deliberate simplifications, each measured against GGanalysis
// (docs/rounds/wish-odds-pass-2026-10-04.md §1):
//   - Capturing Radiance is the OFFICIAL consolidated 55%, independent per 5★
//     (the interior counter is not fully reverse-engineered; GGanalysis's
//     conservative counter model differs by <1% at C6).
//   - A 5★ pushing a 4★ to the next pull is left out (+1 pull at 4★ C6).
//   - Which of the three featured 4★s you get splits evenly (⚓ Nate).

export type BannerId = 'character' | 'fourStar' | 'weapon';

export type BannerDef = {
	id: BannerId;
	/** Flat rate before soft pity */
	base: number;
	/** First pull (1-indexed, counting from the last drop of this rarity) of the ramp */
	softStart: number;
	/** Per-pull probability increase during the ramp */
	ramp: number;
	/** Pull at which a drop is certain (empirical table, not marketing copy) */
	hard: number;
	/** P(the drop is featured) when the guarantee is NOT held */
	featured: number;
	/** P(a featured drop is YOUR target) — the 4★ trio splits three ways */
	pick: number;
};

export const BANNERS: Record<BannerId, BannerDef> = {
	// 0.6% flat through 73, +6%/pull from 74, certain at 90; consolidated 55%
	// featured (official, incl. Capturing Radiance)
	character: {
		id: 'character',
		base: 0.006,
		softStart: 74,
		ramp: 0.06,
		hard: 90,
		featured: 0.55,
		pick: 1
	},
	// 5.1% through 8, 56.1% on the 9th, certain on the 10th; 50% one of the
	// three featured, losing guarantees the next. ⚠️ The featured three are NOT
	// in the banner's off-rate pool (wiki Wish Pool, e.g. Surging Ballad
	// 2026-09-23), so a lost 50/50 never yields one — no off-banner path.
	fourStar: {
		id: 'fourStar',
		base: 0.051,
		softStart: 9,
		ramp: 0.51,
		hard: 10,
		featured: 0.5,
		pick: 1 / 3
	},
	// 0.7% flat through 62, +7%/pull from 63, certain at 77 (official ceiling
	// says "within 80" — the ramp saturates first); charted weapon = 75%
	// featured pair × 50% split = 37.5%; 1 fate point since 5.0
	weapon: {
		id: 'weapon',
		base: 0.007,
		softStart: 63,
		ramp: 0.07,
		hard: 77,
		featured: 0.375,
		pick: 1
	}
};

/** P(a drop of this banner's rarity on this pull), where `pull` counts from the last one (1-indexed). */
export function rateAt(banner: BannerDef, pull: number): number {
	if (pull >= banner.hard) return 1;
	if (pull < banner.softStart) return banner.base;
	return Math.min(1, banner.base + (pull - banner.softStart + 1) * banner.ramp);
}

/**
 * pmf over "which of MY NEXT pulls lands the next drop", starting from
 * `pity` pulls already accumulated (0 ≤ pity < hard). Index 0 is unused;
 * pmf[k] = P(next drop on my k-th pull from now). Sums to 1.
 */
export function dropPmf(banner: BannerDef, pity = 0): number[] {
	const startAt = clampPity(banner, pity);
	const out: number[] = [0];
	let alive = 1;
	for (let k = 1; startAt + k <= banner.hard; k++) {
		const p = rateAt(banner, startAt + k);
		out.push(alive * p);
		alive *= 1 - p;
	}
	return out;
}

/**
 * Closed form for ONE copy of a pick-1 target (5★ character, charted weapon):
 * featured on the first drop at the banner's rate, else certain on the
 * second, pity restarting at 0 for it. Kept as the cross-check on
 * `copiesCdfs`, which must agree with it exactly.
 */
export function featuredPmf(banner: BannerDef, pity = 0, guaranteed = false): number[] {
	const first = dropPmf(banner, pity);
	if (guaranteed) return first;
	const second = dropPmf(banner, 0);
	const out = new Array<number>(first.length + second.length - 1).fill(0);
	for (let i = 1; i < first.length; i++) {
		out[i] += banner.featured * first[i];
		for (let j = 1; j < second.length; j++) {
			out[i + j] += (1 - banner.featured) * first[i] * second[j];
		}
	}
	return out;
}

export function clampPity(banner: BannerDef, pity: number): number {
	return Math.min(Math.max(0, Math.round(pity)), banner.hard - 1);
}

/** Tail mass left past the last pull computed — the 4★ chain never ends on its own. */
const TAIL = 1e-6;
/** Hard stop for the walk: past every target's 99.9999th percentile (5★ C6 worst case is 1260). */
const MAX_PULLS = 4000;

/**
 * Cumulative chances for 1…`need` more copies. `out[j][n]` = P(at least j
 * copies within n pulls); `out[0]` is unused, every array starts at 0 pulls.
 *
 * One forward walk over (pity, guarantee, copies so far), copies capped at
 * `need` (absorbing). Stops once the last copy is certain to within `TAIL`,
 * or exactly at the walk's end for the finite 5★ chains.
 */
export function copiesCdfs(
	banner: BannerDef,
	need: number,
	pity = 0,
	guaranteed = false
): number[][] {
	const P = banner.hard; // pity states 0…hard−1
	const C = need + 1; // copies 0…need
	const idx = (p: number, g: number, c: number) => (p * 2 + g) * C + c;
	let cur = new Float64Array(P * 2 * C);
	let nxt = new Float64Array(P * 2 * C);
	cur[idx(clampPity(banner, pity), guaranteed ? 1 : 0, 0)] = 1;

	const rates = Array.from({ length: P }, (_, p) => rateAt(banner, p + 1));
	const out: number[][] = Array.from({ length: C }, () => [0]);
	const { featured, pick } = banner;

	for (let n = 1; n <= MAX_PULLS; n++) {
		nxt.fill(0);
		for (let p = 0; p < P; p++) {
			const r = rates[p];
			const miss = 1 - r;
			for (let g = 0; g < 2; g++) {
				// P(the drop is your target), and where the guarantee goes after it
				const pTarget = g ? pick : featured * pick;
				const pFeaturedOther = g ? 1 - pick : featured * (1 - pick);
				const pLost = g ? 0 : 1 - featured;
				for (let c = 0; c < C; c++) {
					const m = cur[idx(p, g, c)];
					if (m === 0) continue;
					if (miss > 0 && p + 1 < P) nxt[idx(p + 1, g, c)] += m * miss;
					const hit = m * r;
					nxt[idx(0, 0, Math.min(c + 1, need))] += hit * pTarget;
					nxt[idx(0, 0, c)] += hit * pFeaturedOther;
					nxt[idx(0, 1, c)] += hit * pLost;
				}
			}
		}
		[cur, nxt] = [nxt, cur];

		// at least j copies = mass at c ≥ j
		const atC = new Float64Array(C);
		for (let i = 0; i < cur.length; i++) atC[i % C] += cur[i];
		let acc = 0;
		for (let j = need; j >= 1; j--) {
			acc += atC[j];
			out[j].push(Math.min(1, acc));
		}
		if (atC[need] >= 1 - TAIL) break;
	}
	return out;
}

/**
 * The cdf of the TOTAL pulls two independent goals take (a character and its
 * weapon: separate pities, and you stop pulling each banner at its goal).
 */
export function sumCdf(a: number[], b: number[]): number[] {
	const pa = toPmf(a);
	const pb = toPmf(b);
	const pmf = new Array<number>(pa.length + pb.length - 1).fill(0);
	for (let i = 1; i < pa.length; i++) {
		if (pa[i] === 0) continue;
		for (let j = 1; j < pb.length; j++) pmf[i + j] += pa[i] * pb[j];
	}
	return toCdf(pmf);
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

export function toPmf(cdf: number[]): number[] {
	return cdf.map((c, k) => (k === 0 ? 0 : c - cdf[k - 1]));
}

/** Mean, median and 90th percentile of a cdf (`at(n)` reads it past its end as certain). */
export function cdfStats(cdf: number[]) {
	let mean = 0;
	for (let k = 1; k < cdf.length; k++) mean += 1 - cdf[k - 1];
	const percentile = (q: number) => {
		for (let k = 1; k < cdf.length; k++) if (cdf[k] >= q) return k;
		return cdf.length - 1;
	};
	return { mean, median: percentile(0.5), p90: percentile(0.9) };
}

/** P(done within n pulls) — past the computed end the goal is certain to within `TAIL`. */
export function cdfAt(cdf: number[], n: number): number {
	if (n <= 0) return 0;
	return n < cdf.length ? cdf[n] : cdf[cdf.length - 1];
}
