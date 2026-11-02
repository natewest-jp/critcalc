// Wish odds — how many pulls a number of COPIES takes.
//
// Model of record: docs/library/game/wish-mechanics.md (pity tables from
// GGanalysis / large-sample community analysis; featured rules from official
// banner details). Every target — a 5★ character's constellations, a featured
// 4★'s constellations, a charted weapon's refinements — is the same chain:
// a pity counter, a guarantee flag and a copy count, stepped one pull at a
// time. Deliberate simplifications, each measured against GGanalysis
// (docs/rounds/wish-odds-pass-2026-10-04.md §1):
//   - Capturing Radiance has two readings. With the counter unknown, every
//     50/50 is the OFFICIAL consolidated 55%, independent per 5★. With it
//     known, the community's counter model (docs/library/game/
//     capturing-radiance.md) runs as a fourth part of the chain.
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
export function featuredPmf(
	banner: BannerDef,
	pity = 0,
	guaranteed = false,
	counter: RadianceCounter | null = null
): number[] {
	const first = dropPmf(banner, pity);
	if (guaranteed) return first;
	const second = dropPmf(banner, 0);
	const win = featuredChance(banner, counter);
	const out = new Array<number>(first.length + second.length - 1).fill(0);
	for (let i = 1; i < first.length; i++) {
		out[i] += win * first[i];
		for (let j = 1; j < second.length; j++) {
			out[i + j] += (1 - win) * first[i] * second[j];
		}
	}
	return out;
}

// ── Capturing Radiance's counter ────────────────────────────────────────────
// The community model (docs/library/game/capturing-radiance.md §2): a hidden
// counter, 0–3, set to 1 when 5.0 went live. A lost 50/50 adds 1, a won one
// takes 1 off (not below 0), a Radiance sets it to 1, and only 50/50s move it.

export type RadianceCounter = 0 | 1 | 2 | 3;

/**
 * P(a 50/50 triggers Capturing Radiance) at each counter value. Counter 2's
 * is an estimate: 1/11 is the value that makes the long-run rate exactly the
 * official 55%; the community's estimates run from 2% to 20% (§4a).
 */
export const RADIANCE_CHANCE: readonly [number, number, number, number] = [0, 0, 1 / 11, 1];
/** Where a Radiance leaves the counter. */
export const RADIANCE_RESET: RadianceCounter = 1;

/**
 * P(a non-guaranteed drop of this banner is featured): the banner's flat rate,
 * or, for the character banner with a known counter, the counter's. A
 * Radiance makes the drop featured; otherwise it is a plain 50/50.
 */
export function featuredChance(banner: BannerDef, counter: RadianceCounter | null = null): number {
	if (banner.id !== 'character' || counter === null) return banner.featured;
	const r = RADIANCE_CHANCE[counter];
	return r + (1 - r) / 2;
}

/** The counter after a 50/50: a Radiance resets it, a plain win steps down, a loss steps up. */
export function nextCounter(
	counter: RadianceCounter,
	outcome: 'radiance' | 'won' | 'lost'
): RadianceCounter {
	if (outcome === 'radiance') return RADIANCE_RESET;
	if (outcome === 'won') return Math.max(0, counter - 1) as RadianceCounter;
	return Math.min(3, counter + 1) as RadianceCounter;
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
 * One forward walk over (pity, guarantee, Radiance counter when known, copies
 * so far), copies capped at `need` (absorbing). Stops once the last copy is
 * certain to within `TAIL`, or exactly at the walk's end for the finite 5★
 * chains.
 */
export function copiesCdfs(
	banner: BannerDef,
	need: number,
	pity = 0,
	guaranteed = false,
	counter: RadianceCounter | null = null
): number[][] {
	const P = banner.hard; // pity states 0…hard−1
	const C = need + 1; // copies 0…need
	// The Radiance counter is a fourth part of the state only when it is known
	// (and only on the character banner); otherwise one flat-rate slot.
	const radiance = banner.id === 'character' && counter !== null;
	const K = radiance ? 4 : 1;
	const idx = (p: number, g: number, k: number, c: number) => ((p * 2 + g) * K + k) * C + c;
	let cur = new Float64Array(P * 2 * K * C);
	let nxt = new Float64Array(P * 2 * K * C);
	cur[idx(clampPity(banner, pity), guaranteed ? 1 : 0, radiance ? counter : 0, 0)] = 1;

	const rates = Array.from({ length: P }, (_, p) => rateAt(banner, p + 1));
	const out: number[][] = Array.from({ length: C }, () => [0]);
	const { featured, pick } = banner;

	for (let n = 1; n <= MAX_PULLS; n++) {
		nxt.fill(0);
		for (let p = 0; p < P; p++) {
			const r = rates[p];
			const miss = 1 - r;
			for (let g = 0; g < 2; g++) {
				for (let k = 0; k < K; k++) {
					for (let c = 0; c < C; c++) {
						const m = cur[idx(p, g, k, c)];
						if (m === 0) continue;
						if (miss > 0 && p + 1 < P) nxt[idx(p + 1, g, k, c)] += m * miss;
						const hit = m * r;
						const got = Math.min(c + 1, need);
						if (g) {
							// a guarantee: featured for certain, and the counter stays put
							nxt[idx(0, 0, k, got)] += hit * pick;
							nxt[idx(0, 0, k, c)] += hit * (1 - pick);
						} else if (radiance) {
							// a 50/50 under the counter model (pick is 1 on this banner)
							const rad = RADIANCE_CHANCE[k];
							const coin = (1 - rad) / 2;
							const kc = k as RadianceCounter;
							nxt[idx(0, 0, nextCounter(kc, 'radiance'), got)] += hit * rad;
							nxt[idx(0, 0, nextCounter(kc, 'won'), got)] += hit * coin;
							nxt[idx(0, 1, nextCounter(kc, 'lost'), c)] += hit * coin;
						} else {
							nxt[idx(0, 0, 0, got)] += hit * featured * pick;
							nxt[idx(0, 0, 0, c)] += hit * featured * (1 - pick);
							nxt[idx(0, 1, 0, c)] += hit * (1 - featured);
						}
					}
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
 * The most pulls `need` more copies can take: every drop at hard pity, and
 * every 50/50 lost that the rules let you lose. `null` where nothing caps it
 * (a featured 4★: a guarantee can keep landing on the other two).
 *
 * The rules: with the Radiance counter known, the counter model's (a loss is
 * impossible at 3). With it unknown, only what is official: you can't lose
 * more than three 50/50s in a row (taken from a streak of 0, the worst case).
 * The weapon banner's fate point makes every second drop certain.
 */
export function worstCasePulls(
	banner: BannerDef,
	need: number,
	pity = 0,
	guaranteed = false,
	counter: RadianceCounter | null = null
): number | null {
	if (need <= 0) return 0;
	if (banner.pick < 1) return null;

	// Most drops from (copies, guarantee, k): k is the counter when known, else
	// the current streak of lost 50/50s.
	const memo = new Map<string, number>();
	const drops = (c: number, g: boolean, k: number): number => {
		if (c >= need) return 0;
		const key = `${c},${g},${k}`;
		const hit = memo.get(key);
		if (hit !== undefined) return hit;
		let best: number;
		if (g) best = 1 + drops(c + 1, false, k);
		else if (banner.id !== 'character') best = 1 + drops(c, true, k);
		else if (counter !== null) {
			const kc = k as RadianceCounter;
			const r = RADIANCE_CHANCE[kc];
			best = 1 + drops(c + 1, false, nextCounter(kc, r > 0 ? 'radiance' : 'won'));
			if (r > 0 && r < 1) best = Math.max(best, 1 + drops(c + 1, false, nextCounter(kc, 'won')));
			if (r < 1) best = Math.max(best, 1 + drops(c, true, nextCounter(kc, 'lost')));
		} else {
			best = 1 + drops(c + 1, false, 0);
			if (k < 3) best = Math.max(best, 1 + drops(c, true, k + 1));
		}
		memo.set(key, best);
		return best;
	};
	// Unknown counter: a held guarantee means one loss is already in the streak.
	const d = drops(0, guaranteed, counter ?? (guaranteed ? 1 : 0));
	return banner.hard - clampPity(banner, pity) + (d - 1) * banner.hard;
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
