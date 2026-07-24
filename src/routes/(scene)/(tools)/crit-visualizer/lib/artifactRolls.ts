// 5★ artifact substat probability model — exact enumeration, no Monte Carlo.
//
// Sources (verified 2026-07-07):
// - Substat tier values: docs/Main Stat and Sub Stat Artifact Values.xlsx
//   (Dimbreath datamine via OJ of Steel)
// - Weights, main-stat odds, tier & slot-pick uniformity: wiki Artifact/Distribution
// - Initial line counts by source: wiki Loot System/Artifact Drop Distribution
//   (domains 80% 3-line / 20% 4-line; bosses & strongbox 66% / 34%)
// - Reshaping (Dust of Enlightenment): wiki Artifact#Reshaping — 2 affixes
//   selected; all enhancement rolls reallocated with ≥2 guaranteed into the
//   pair; Advanced (≥3) at 6 Hallowed Exegesis; Decreed (≥4) on the 3rd
//   consecutive Advanced.
//
// Model notes:
// - A +20 5★ receives 5 enhancement events (+4/8/12/16/20). A 3-line piece
//   spends its first event adding the 4th line, leaving 4 value rolls.
// - Upgrade rolls pick uniformly among the 4 lines (25%) and one of 4 value
//   tiers uniformly (70/80/90/100% of max).
// - Initial lines are sequential weighted draws without replacement from the
//   slot's pool (main stat and existing lines excluded) — so the joint
//   distribution of "the 4 lines" is identical whether the 4th arrives at
//   drop or at +4.
// - ASSUMPTION (flagged in-app): the reshape guarantee is modeled as a
//   conditional distribution — Binomial(E, ½) truncated to ≥ the guarantee
//   and renormalized. The wiki wording ("guarantees that at least N will be
//   allocated") doesn't distinguish this from forced allocation; revisit if
//   a datamine settles it.

// ── Substats ────────────────────────────────────────────────────────────────

export type SubstatId =
	| 'hp'
	| 'atk'
	| 'def'
	| 'hpPct'
	| 'atkPct'
	| 'defPct'
	| 'er'
	| 'em'
	| 'cr'
	| 'cd';

export type Substat = {
	id: SubstatId;
	name: string;
	short: string;
	weight: number;
	/** Roll tiers (70/80/90/100% of max), datamined values. % stats in decimal. */
	tiers: [number, number, number, number];
	isPct: boolean;
};

export const SUBSTATS: Substat[] = [
	{
		id: 'hp',
		name: 'HP',
		short: 'HP',
		weight: 6,
		tiers: [209.13, 239.0, 268.88, 298.75],
		isPct: false
	},
	{
		id: 'atk',
		name: 'ATK',
		short: 'ATK',
		weight: 6,
		tiers: [13.62, 15.56, 17.51, 19.45],
		isPct: false
	},
	{
		id: 'def',
		name: 'DEF',
		short: 'DEF',
		weight: 6,
		tiers: [16.2, 18.52, 20.83, 23.15],
		isPct: false
	},
	{
		id: 'hpPct',
		name: 'HP%',
		short: 'HP%',
		weight: 4,
		tiers: [0.0408, 0.0466, 0.0525, 0.0583],
		isPct: true
	},
	{
		id: 'atkPct',
		name: 'ATK%',
		short: 'ATK%',
		weight: 4,
		tiers: [0.0408, 0.0466, 0.0525, 0.0583],
		isPct: true
	},
	{
		id: 'defPct',
		name: 'DEF%',
		short: 'DEF%',
		weight: 4,
		tiers: [0.051, 0.0583, 0.0656, 0.0729],
		isPct: true
	},
	{
		id: 'er',
		name: 'Energy Recharge',
		short: 'ER',
		weight: 4,
		tiers: [0.0453, 0.0518, 0.0583, 0.0648],
		isPct: true
	},
	{
		id: 'em',
		name: 'Elemental Mastery',
		short: 'EM',
		weight: 4,
		tiers: [16.32, 18.65, 20.98, 23.31],
		isPct: false
	},
	{
		id: 'cr',
		name: 'CRIT Rate',
		short: 'CR',
		weight: 3,
		tiers: [0.0272, 0.0311, 0.035, 0.0389],
		isPct: true
	},
	{
		id: 'cd',
		name: 'CRIT DMG',
		short: 'CD',
		weight: 3,
		tiers: [0.0544, 0.0622, 0.0699, 0.0777],
		isPct: true
	}
];

export const substatById = (id: SubstatId) => SUBSTATS.find((s) => s.id === id)!;

// ── Slots & main stats ──────────────────────────────────────────────────────

// Main stats that are also substats use the SubstatId; the rest never collide
// with the substat pool.
export type MainStatId = SubstatId | 'elemDmg' | 'physDmg' | 'healing';

export type SlotId = 'flower' | 'plume' | 'sands' | 'goblet' | 'circlet';

export type MainStat = { id: MainStatId; name: string; chance: number };

export const SLOTS: { id: SlotId; name: string; mains: MainStat[] }[] = [
	{ id: 'flower', name: 'Flower', mains: [{ id: 'hp', name: 'HP', chance: 1 }] },
	{ id: 'plume', name: 'Plume', mains: [{ id: 'atk', name: 'ATK', chance: 1 }] },
	{
		id: 'sands',
		name: 'Sands',
		mains: [
			{ id: 'hpPct', name: 'HP%', chance: 0.2668 },
			{ id: 'atkPct', name: 'ATK%', chance: 0.2666 },
			{ id: 'defPct', name: 'DEF%', chance: 0.2666 },
			{ id: 'er', name: 'Energy Recharge', chance: 0.1 },
			{ id: 'em', name: 'Elemental Mastery', chance: 0.1 }
		]
	},
	{
		id: 'goblet',
		name: 'Goblet',
		mains: [
			{ id: 'hpPct', name: 'HP%', chance: 0.1925 },
			{ id: 'atkPct', name: 'ATK%', chance: 0.1925 },
			{ id: 'defPct', name: 'DEF%', chance: 0.19 },
			{ id: 'elemDmg', name: 'Elemental DMG', chance: 0.05 },
			{ id: 'physDmg', name: 'Physical DMG', chance: 0.05 },
			{ id: 'em', name: 'Elemental Mastery', chance: 0.025 }
		]
	},
	{
		id: 'circlet',
		name: 'Circlet',
		mains: [
			{ id: 'hpPct', name: 'HP%', chance: 0.22 },
			{ id: 'atkPct', name: 'ATK%', chance: 0.22 },
			{ id: 'defPct', name: 'DEF%', chance: 0.22 },
			{ id: 'cr', name: 'CRIT Rate', chance: 0.1 },
			{ id: 'cd', name: 'CRIT DMG', chance: 0.1 },
			{ id: 'healing', name: 'Healing Bonus', chance: 0.1 },
			{ id: 'em', name: 'Elemental Mastery', chance: 0.04 }
		]
	}
];

/** The weighted substat pool for a piece: all substats except its main stat. */
export const substatPool = (main: MainStatId): Substat[] => SUBSTATS.filter((s) => s.id !== main);

// ── Initial line presence (exact, sequential weighted draws) ────────────────

// P(every substat in `need` appears within `draws` weighted draws without
// replacement from `pool`).
export function presenceProbability(pool: Substat[], need: SubstatId[], draws: number): number {
	const needSet = new Set(need);
	if ([...needSet].some((id) => !pool.some((s) => s.id === id))) return 0;

	function recurse(remaining: Substat[], missing: Set<SubstatId>, left: number): number {
		if (missing.size === 0) return 1;
		if (left === 0 || missing.size > left) return 0;

		const total = remaining.reduce((acc, s) => acc + s.weight, 0);
		let p = 0;

		for (const s of remaining) {
			const nextMissing = missing.has(s.id)
				? new Set([...missing].filter((id) => id !== s.id))
				: missing;
			p +=
				(s.weight / total) *
				recurse(
					remaining.filter((x) => x.id !== s.id),
					nextMissing,
					left - 1
				);
		}

		return p;
	}

	return recurse(pool, needSet, draws);
}

// Initial line-count odds by source
export type SourceId = 'domain' | 'boss' | 'elixir';
export const SOURCES: { id: SourceId; name: string; fourLine: number }[] = [
	{ id: 'domain', name: 'Domain', fourLine: 0.2 },
	{ id: 'boss', name: 'Boss / Strongbox', fourLine: 0.34 },
	// Sanctifying Elixir: crafted — main stat and both target substats are
	// CHOSEN, so the presence draw is skipped entirely; 3/4-line odds match
	// domain drops (community consensus). Since 5.5 the two crafted substats
	// are guaranteed ≥2 of the upgrade rolls — see elixirRollDist /
	// cvDistributionMinPairRolls.
	{ id: 'elixir', name: 'Sanctifying Elixir', fourLine: 0.2 }
];

/** The 5.5 Elixir buff: the two crafted substats get at least this many upgrade rolls. */
export const ELIXIR_MIN_PAIR_ROLLS = 2;

// ── Upgrade roll distributions ──────────────────────────────────────────────

/** Enhancement value-roll events for a +20 5★: 5 if 4 starting lines, else 4. */
export const rollEvents = (fourLineStart: boolean) => (fourLineStart ? 5 : 4);

const binomialCoeff = (n: number, k: number): number => {
	let c = 1;
	for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
	return c;
};

/** P(X = 0…n) for X ~ Binomial(n, p) */
export function binomialDist(n: number, p: number): number[] {
	return Array.from(
		{ length: n + 1 },
		(_, k) => binomialCoeff(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k)
	);
}

/** Rolls into a 2-line pair across `events` uniform picks: Binomial(events, ½) */
export const pairRollDist = (events: number) => binomialDist(events, 0.5);

/**
 * Reshape outcome: Binomial(events, ½) conditioned on ≥ `guarantee`
 * (see ASSUMPTION in the header). Index = rolls into the selected pair.
 */
export function reshapeDist(events: number, guarantee: number): number[] {
	const base = pairRollDist(events);
	const g = Math.min(guarantee, events);
	const tail = base.slice(g).reduce((a, b) => a + b, 0);
	return base.map((p, k) => (k < g ? 0 : p / tail));
}

// ── Crit-value distribution at +20 (exact convolution) ─────────────────────
// Assumes CR and CD are both starting lines. Each line's initial value is one
// uniform tier; each of the `events` rolls hits CR (25%), CD (25%), or
// something else (50%), with a uniform tier when it hits.
// CV is tracked in integer centi-CV to keep the support exact:
//   CR tier → 2 × [2.72, 3.11, 3.50, 3.89] = [544, 622, 700, 778]
//   CD tier → [544, 622, 699, 777]

const CR_CV = [544, 622, 700, 778];
const CD_CV = [544, 622, 699, 777];

type Dist = Map<number, number>;

function convolveUniform(dist: Dist, values: number[], weightEach: number): Dist {
	const next: Dist = new Map();
	for (const [v, p] of dist) {
		for (const add of values) {
			const key = v + add;
			next.set(key, (next.get(key) ?? 0) + p * weightEach);
		}
	}
	return next;
}

/** Exact CV distribution (in CV display units) at +20, sorted ascending. */
export function cvDistribution(events: number): { cv: number; p: number }[] {
	// Initial CR line + initial CD line, one uniform tier each
	let dist: Dist = new Map([[0, 1]]);
	dist = convolveUniform(dist, CR_CV, 0.25);
	dist = convolveUniform(dist, CD_CV, 0.25);

	// Each enhancement event: 25% CR tier, 25% CD tier, 50% elsewhere
	for (let i = 0; i < events; i++) {
		const next: Dist = new Map();
		for (const [v, p] of dist) {
			next.set(v, (next.get(v) ?? 0) + p * 0.5);
			for (const add of CR_CV) next.set(v + add, (next.get(v + add) ?? 0) + p * 0.0625);
			for (const add of CD_CV) next.set(v + add, (next.get(v + add) ?? 0) + p * 0.0625);
		}
		dist = next;
	}

	return [...dist.entries()]
		.map(([centiCv, p]) => ({ cv: centiCv / 100, p }))
		.sort((a, b) => a.cv - b.cv);
}

/**
 * CV distribution at +20 conditioned on the crit pair receiving at least
 * `minPairRolls` of the `events` upgrade rolls — the Sanctifying Elixir's
 * post-5.5 guarantee, modeled (like Reshape) as conditional redistribution.
 * Tracks the joint (pair-roll count, cv) distribution, filters, renormalizes,
 * and marginalizes cv. Key packing: count × 10^6 + centiCv (max centiCv for
 * 2 initial + 5 rolled tiers ≈ 5,446 ≪ 10^6).
 */
export function cvDistributionMinPairRolls(
	events: number,
	minPairRolls: number
): { cv: number; p: number }[] {
	const PACK = 1_000_000;
	// Initial lines are not upgrade rolls: count starts at 0
	let dist: Dist = new Map([[0, 1]]);
	dist = convolveUniform(dist, CR_CV, 0.25);
	dist = convolveUniform(dist, CD_CV, 0.25);

	for (let i = 0; i < events; i++) {
		const next: Dist = new Map();
		for (const [key, p] of dist) {
			next.set(key, (next.get(key) ?? 0) + p * 0.5);
			const bumped = key + PACK; // this event hit the pair
			for (const add of CR_CV) next.set(bumped + add, (next.get(bumped + add) ?? 0) + p * 0.0625);
			for (const add of CD_CV) next.set(bumped + add, (next.get(bumped + add) ?? 0) + p * 0.0625);
		}
		dist = next;
	}

	const min = Math.min(minPairRolls, events);
	const kept = [...dist.entries()].filter(([key]) => Math.floor(key / PACK) >= min);
	const mass = kept.reduce((acc, [, p]) => acc + p, 0);
	const marginal: Dist = new Map();
	for (const [key, p] of kept) {
		const centiCv = key % PACK;
		marginal.set(centiCv, (marginal.get(centiCv) ?? 0) + p / mass);
	}
	return [...marginal.entries()]
		.map(([centiCv, p]) => ({ cv: centiCv / 100, p }))
		.sort((a, b) => a.cv - b.cv);
}

/** Mean and CDF-based percentiles of a {cv, p} distribution. */
export function distStats(dist: { cv: number; p: number }[]) {
	const mean = dist.reduce((acc, d) => acc + d.cv * d.p, 0);
	const percentile = (q: number) => {
		let acc = 0;
		for (const d of dist) {
			acc += d.p;
			if (acc >= q) return d.cv;
		}
		return dist[dist.length - 1]?.cv ?? 0;
	};
	return { mean, p10: percentile(0.1), median: percentile(0.5), p90: percentile(0.9) };
}
