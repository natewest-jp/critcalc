// Artifact Odds — the 5★ artifact probability model. Exact enumeration and
// convolution throughout, no Monte Carlo.
//
// Sources (re-verified 2026-10-06, Fandom wiki via its API):
// - Substat tier values: docs/Main Stat and Sub Stat Artifact Values.xlsx
//   (Dimbreath datamine via OJ of Steel)
// - Weights, main-stat odds, tier & line-pick uniformity: wiki Artifact/Distribution
// - Initial line counts, sets, slots, 5★ per run: wiki Loot System/Artifact Drop
//   Distribution (domains 80% 3-line / 20% 4-line; bosses & strongboxes 66/34;
//   ½ per set, ⅕ per slot; a domain run at AR45+ averages 1.065 5★)
// - Stygian Onslaught's Disturbance Outbreak: 20 Dire Prestige per 20 Original
//   Resin, and every 120 Prestige adds one random 5★ from the domain's two sets
//   (the in-game rules text, quoted on wiki Stygian Onslaught)
// - Reshaping (5.7): wiki Artifact#Reshaping — two lines selected, every
//   upgrade roll reallocated with at least 2 (Standard) / 3 (Advanced, every 6
//   Hallowed Exegesis = 6 Dust) / 4 (Decreed, the third Advanced) into the pair
// - Defined pieces (Sanctifying Elixir, 5.5 patch notes): "guaranteed to get at
//   least 2 rolls for the defined Minor Affixes when fully leveled up"
//
// ⚓ THE FLOOR IS A TOP-UP (Nate, 2026-10-06). Neither the game nor a datamine
// says HOW a guarantee is met, and the three readings disagree a lot (5 rolls,
// ≥2: P(3+ into the pair) is 50% top-up, 61.5% re-draw, 87.5% forced). Top-up —
// rolls land uniformly, and a pair that would end below the floor ends AT it —
// is what the two independent exact models in the wild compute: Genshin
// Optimizer's `rollCountProb` ("forced into the selected bins if required") and
// SiriYu's enlightenment solver (forces the late picks once the floor is at
// risk; the same count distribution). ⛔ Revisit only with in-game samples.
//
// Model notes:
// - A +20 5★ receives 5 upgrades (+4/8/12/16/20). A 3-line piece spends its
//   first adding the 4th line, leaving 4 value rolls.
// - A value roll picks one of the 4 lines (25%) and one of 4 tiers (70/80/90/
//   100% of max), uniformly.
// - Initial lines are sequential weighted draws without replacement from the
//   slot's pool (main stat and existing lines excluded) — so the joint
//   distribution of "the 4 lines" is identical whether the 4th arrives at
//   drop or at +4.

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

export type MainStat = {
	id: MainStatId;
	name: string;
	chance: number;
	/** The chance is for each of several stats this entry stands for (the 7 elements) */
	each?: boolean;
};

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
			// ⚠️ ONE element: each of the seven is 5% (35% together), so the
			// chance is per element and the chip says so (`each`)
			{ id: 'elemDmg', name: 'Elemental DMG', chance: 0.05, each: true },
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

// ── Line presence (exact, sequential weighted draws) ────────────────────────

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

/** P(the next line drawn is `id`), given the lines a piece already has. */
export function nextLineChance(main: MainStatId, have: SubstatId[], id: SubstatId): number {
	const pool = substatPool(main).filter((s) => !have.includes(s.id));
	const s = pool.find((x) => x.id === id);
	return s ? s.weight / pool.reduce((acc, x) => acc + x.weight, 0) : 0;
}

/** Initial line-count odds by source: the share of 5★ drops that start with 4 lines. */
export const FOUR_LINE = { domain: 0.2, boss: 0.34 } as const;

// ── Upgrade rolls and the floor ─────────────────────────────────────────────

/** Value rolls a +20 5★ receives: 5 from a 4-line start, 4 from a 3-line one. */
export const rollEvents = (fourLineStart: boolean) => (fourLineStart ? 5 : 4);

/** Value rolls still to come at a level (once the piece has its 4 lines). */
export const rollsLeftAt = (level: number) => 5 - Math.floor(Math.min(20, level) / 4);

/** Floors: none (farmed), a defined piece / Standard reshape, Advanced, Decreed. */
export const FLOORS = [0, 2, 3, 4] as const;
export type Floor = (typeof FLOORS)[number];

/** Dust of Enlightenment per reshape (flower and plume 1, the rest 2). */
export const reshapeDust = (slot: SlotId) => (slot === 'flower' || slot === 'plume' ? 1 : 2);

/** Hallowed Exegesis (one per Dust) an Advanced Reshape consumes. */
export const ADVANCED_EXEGESIS = 6;

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

/**
 * NEW rolls into the target lines over `events` upgrades, each landing in them
 * with chance `hit`, under a TOP-UP floor (see the header): the target lines
 * end with at least `floor` rolls counting the `already` they hold. Index =
 * new rolls. P(k) is the binomial's above the floor; every outcome that would
 * end below it ends exactly at it.
 */
export function floorDist(events: number, hit: number, floor = 0, already = 0): number[] {
	const base = binomialDist(events, hit);
	const need = Math.min(events, Math.max(0, floor - already));
	return base.map((p, k) =>
		k < need ? 0 : k === need ? base.slice(0, need + 1).reduce((a, b) => a + b, 0) : p
	);
}

// ── The value of the target pair ────────────────────────────────────────────
// One engine for every chart that asks "how good are the target lines": the
// Level up histogram, a piece's future, the population it is ranked against,
// and a reshape's outcome. It carries the two lines' sums JOINTLY in integer
// units so the result can be rounded the way the game displays each line.
//
// - `cv` (the crit pair): units are centi-percent of each stat (CR 2.72% =
//   272), and a value is 2 × CR + CD as displayed — each line rounded to 0.1
//   first, so "same as your piece" means same on screen. Kept in tenths of CV.
// - `rv` (any other pair): roll value, each roll worth 70/80/90/100 regardless
//   of stat. Summing ATK% and ER in game units would mean nothing; summing
//   how good each roll was does.

export type ValueUnit = 'cv' | 'rv';

/** A line's tier steps in the unit's integer resolution. */
export function unitTiers(unit: ValueUnit, id: SubstatId): number[] {
	if (unit === 'rv') return [70, 80, 90, 100];
	return substatById(id).tiers.map((t) => Math.round(t * 10000));
}

/**
 * The pair's two line sums, keyed `a × KEY + b` — a is always the pair's
 * FIRST stat and b its second (for `cv`: CR then CD), and a line the piece
 * doesn't have stays at 0.
 */
export type Joint = Map<number, number>;
const KEY = 100_000;

/** A line's possible sums (value → chance); absent = the line isn't there. */
export type LineSums = Map<number, number> | null;

/** Independent start values for the pair's two lines. */
export function jointOf(a: LineSums, b: LineSums): Joint {
	const out: Joint = new Map();
	for (const [va, pa] of a ?? new Map([[0, 1]]))
		for (const [vb, pb] of b ?? new Map([[0, 1]]))
			out.set(va * KEY + vb, (out.get(va * KEY + vb) ?? 0) + pa * pb);
	return out;
}

/** One uniform tier: a fresh line's initial roll. */
export const uniformLine = (tiers: number[]): Map<number, number> =>
	new Map(tiers.map((t) => [t, 1 / tiers.length]));

/**
 * The pair after k more rolls INTO it, k weighted by `counts[k]`. Each such
 * roll picks one of the pair's lines the piece HAS uniformly (both community
 * models agree on this for a topped-up roll too), and a tier uniformly.
 * `tiersA`/`tiersB` null = that line isn't on the piece.
 */
export function addPairRolls(
	start: Joint,
	counts: number[],
	tiersA: number[] | null,
	tiersB: number[] | null
): Joint {
	const lines = (tiersA ? 1 : 0) + (tiersB ? 1 : 0);
	const out: Joint = new Map();
	let cur = start;
	for (let k = 0; k < counts.length; k++) {
		if (k > 0) {
			if (lines === 0) break;
			const next: Joint = new Map();
			const w = 1 / lines / 4;
			for (const [key, p] of cur) {
				if (tiersA)
					for (const t of tiersA) next.set(key + t * KEY, (next.get(key + t * KEY) ?? 0) + p * w);
				if (tiersB) for (const t of tiersB) next.set(key + t, (next.get(key + t) ?? 0) + p * w);
			}
			cur = next;
		}
		if (counts[k] === 0) continue;
		for (const [key, p] of cur) out.set(key, (out.get(key) ?? 0) + p * counts[k]);
	}
	return out;
}

/** Mix weighted joints (a 3-line piece's possible 4th lines). */
export function mixJoints(parts: { w: number; joint: Joint }[]): Joint {
	const out: Joint = new Map();
	for (const { w, joint } of parts)
		for (const [key, p] of joint) out.set(key, (out.get(key) ?? 0) + w * p);
	return out;
}

/** A value distribution in display units (CV or RV), ascending. */
export type ValueDist = { x: number; p: number }[];

/** The displayed value of a pair state (CV from each line rounded to 0.1, or RV). */
export function pairValue(unit: ValueUnit, a: number, b: number): number {
	if (unit === 'rv') return a + b;
	// a is CR in centi-%, b CD; tenths of CV, as integers, then to CV
	return (2 * Math.round(a / 10) + Math.round(b / 10)) / 10;
}

export function toValues(unit: ValueUnit, joint: Joint): ValueDist {
	const out = new Map<number, number>();
	for (const [key, p] of joint) {
		const v = pairValue(unit, Math.floor(key / KEY), key % KEY);
		out.set(v, (out.get(v) ?? 0) + p);
	}
	return [...out.entries()].map(([x, p]) => ({ x, p })).sort((a, b) => a.x - b.x);
}

/**
 * A pair's value at +20 on a piece that has both lines (by +4): one initial
 * roll each, then `events` upgrades at ½ into the pair under `floor`. The
 * Level up chart, and the population a finished piece is ranked against.
 */
export function pairOutcome(
	unit: ValueUnit,
	pair: [SubstatId, SubstatId],
	events: number,
	floor = 0,
	/** Which of the pair the piece has (a one-line piece is ranked among its kind) */
	has: [boolean, boolean] = [true, true]
): ValueDist {
	const [ta, tb] = pair.map((id, i) => (has[i] ? unitTiers(unit, id) : null));
	const lines = Number(has[0]) + Number(has[1]);
	const start = jointOf(ta && uniformLine(ta), tb && uniformLine(tb));
	const counts = floorDist(events, lines / 4, lines === 2 ? floor : 0);
	return toValues(unit, addPairRolls(start, counts, ta, tb));
}

/** Mean and CDF-based percentiles of a value distribution. */
export function distStats(dist: ValueDist) {
	const mean = dist.reduce((acc, d) => acc + d.x * d.p, 0);
	const quantile = (q: number) => {
		let acc = 0;
		for (const d of dist) {
			acc += d.p;
			if (acc >= q - 1e-12) return d.x;
		}
		return dist[dist.length - 1]?.x ?? 0;
	};
	return { mean, p10: quantile(0.1), median: quantile(0.5), p90: quantile(0.9) };
}

/**
 * P(an outcome is below / equal to / above a piece's value). The piece's own
 * value can be uncertain (a roll value read from a rounded display), so it is
 * a distribution too; "equal" compares displayed values.
 */
export function compareTo(dist: ValueDist, piece: ValueDist) {
	let below = 0;
	let equal = 0;
	for (const v of piece) {
		for (const d of dist) {
			if (Math.abs(d.x - v.x) < 1e-6) equal += d.p * v.p;
			else if (d.x < v.x) below += d.p * v.p;
		}
	}
	return { below, equal, above: Math.max(0, 1 - below - equal) };
}

/** Mid-rank percentile: below, plus half the ties (a typical piece reads p50). */
export function percentileOf(dist: ValueDist, piece: ValueDist): number {
	const { below, equal } = compareTo(dist, piece);
	return below + equal / 2;
}

/** The mean of a value distribution (where a marker for it is drawn). */
export const meanOf = (dist: ValueDist) => dist.reduce((acc, d) => acc + d.x * d.p, 0);

// ── Farming ─────────────────────────────────────────────────────────────────

export const RESIN_PER_RUN = 20;
/** Original Resin a day: one every 8 minutes. */
export const RESIN_PER_DAY = 180;
/** A domain run at AR45+ yields 1.065 5★ on average: one, and a second 6.5% of the time. */
export const EXTRA_FIVE_STAR = 0.065;
/** During a Disturbance Outbreak, one more 5★ for every this much resin spent. */
export const OUTBREAK_RESIN_PER_PIECE = 120;
/** A domain's 5★ come from two sets; a drop is either with equal chance. */
export const SET_CHANCE = 1 / 2;
/** Five slots, equally likely. */
export const SLOT_CHANCE = 1 / 5;

/** Chance one 5★ from the domain is the piece you want. */
export const pieceChance = (mainChance: number, linesChance: number) =>
	SET_CHANCE * SLOT_CHANCE * mainChance * linesChance;

/** P(no wanted piece yet) after spending `resin` (whole runs only). */
export function farmMiss(resin: number, q: number, outbreak: boolean): number {
	const runs = Math.floor(resin / RESIN_PER_RUN);
	const bonus = outbreak ? Math.floor((runs * RESIN_PER_RUN) / OUTBREAK_RESIN_PER_PIECE) : 0;
	return Math.pow(1 - q, runs + bonus) * Math.pow(1 - EXTRA_FIVE_STAR * q, runs);
}

/** Resin to the first wanted piece: mean, half by, unlucky tenth (run-granular). */
export function farmStats(q: number, outbreak: boolean) {
	if (!(q > 0)) return { mean: Infinity, median: Infinity, p90: Infinity };
	let mean = 0;
	let median = 0;
	let p90 = 0;
	for (let runs = 0; ; runs++) {
		const resin = runs * RESIN_PER_RUN;
		const miss = farmMiss(resin, q, outbreak);
		mean += RESIN_PER_RUN * miss;
		if (!median && miss <= 0.5) median = resin;
		if (!p90 && miss <= 0.1) p90 = resin;
		if (miss < 1e-9 || runs > 5_000_000) break;
	}
	return { mean, median, p90 };
}
