// Artifact Odds — the 5★ artifact probability model. Exact enumeration and
// convolution throughout, no Monte Carlo.
//
// Sources (re-verified 2026-10-06, Fandom wiki via its API):
// - Substat tier values: Dimbreath's datamine, via OJ of Steel's community
//   table "Main Stat and Sub Stat Artifact Values" (not redistributed here)
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

/**
 * THE piece's main stat when several are accepted (Drop takes any of them):
 * the first in the order they were PICKED, never the slot's list order — a
 * sands with [ER, ATK%] accepted is an ER sands. ⚠️ Reading it in list order
 * pinned every sands to ATK% (the list's second entry outranks ER), so
 * picking another main did nothing and ATK% could never be a substat.
 */
export function primaryMain(slot: SlotId, accepted: MainStatId[]): MainStat {
	const mains = SLOTS.find((s) => s.id === slot)!.mains;
	for (const id of accepted) {
		const m = mains.find((x) => x.id === id);
		if (m) return m;
	}
	return mains[0];
}

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

/**
 * P(at least `atLeast` of `want` appear within `draws` weighted draws without
 * replacement from `pool`).
 */
export function presenceAtLeast(
	pool: Substat[],
	want: SubstatId[],
	atLeast: number,
	draws: number
): number {
	if (atLeast <= 0) return 1;
	const wanted = new Set(want.filter((id) => pool.some((s) => s.id === id)));
	if (wanted.size < atLeast) return 0;

	function recurse(remaining: Substat[], found: number, left: number): number {
		if (found >= atLeast) return 1;
		if (left === 0) return 0;
		const total = remaining.reduce((acc, s) => acc + s.weight, 0);
		let p = 0;
		for (const s of remaining)
			p +=
				(s.weight / total) *
				recurse(
					remaining.filter((x) => x.id !== s.id),
					found + (wanted.has(s.id) ? 1 : 0),
					left - 1
				);
		return p;
	}
	return recurse(pool, 0, draws);
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

// ── The value of your stats ─────────────────────────────────────────────────
// ⚓ "What counts as good" is the PLAYER's set of stats (1–4), not a pair:
// a reshape selects two lines, but a piece is worth what all your stats got.
// One engine answers every value chart — Level up, a piece's future, the
// population a finished piece is ranked against, and a reshape — by walking
// every way the remaining upgrades can split across the four lines (at most
// 56 for 5 upgrades) and adding each wanted line's rolls.
//
// - `cv` (your stats are crit only): units are centi-percent of each stat
//   (CR 2.72% = 272), and the value is 2 × CR + CD AS DISPLAYED — each line
//   rounded to 0.1 first, so "same as your piece" means same on screen.
// - `rolls` (anything else): useful rolls — each upgrade into your stats
//   counts by its size, a top roll 1 and the smallest 0.7 (roll value / 100).
//   Adding ATK% to ER in game units would mean nothing; adding how good each
//   roll was does.

export type ValueUnit = 'cv' | 'rolls';

/** A line's tier steps in the unit's integer resolution (centi-% or roll value). */
export function unitTiers(unit: ValueUnit, id: SubstatId): number[] {
	if (unit === 'rolls') return [70, 80, 90, 100];
	return substatById(id).tiers.map((t) => Math.round(t * 10000));
}

/** CV when every one of your stats (main stat aside) is CR or CD; useful rolls otherwise. */
export const unitFor = (wantedSubs: SubstatId[]): ValueUnit =>
	wantedSubs.length > 0 && wantedSubs.every((id) => id === 'cr' || id === 'cd') ? 'cv' : 'rolls';

/** One uniform tier: a fresh line's first roll. */
export const uniformLine = (tiers: number[]): Map<number, number> =>
	new Map(tiers.map((t) => [t, 1 / tiers.length]));

/** A value distribution in display units (CV, or useful rolls), ascending. */
export type ValueDist = { x: number; p: number }[];
/** …tagged with how many upgrades landed in your stats by +20 (the bars' colours). */
export type Outcome = { x: number; k: number; p: number }[];

/** One of the piece's four lines, as the engine sees it. */
export type LineState = {
	id: SubstatId;
	/** One of your stats — its rolls count */
	wanted: boolean;
	/** Selected for a reshape (or a defined piece's two lines) — the floor's lines */
	selected: boolean;
	/** The line's sum so far in the unit (unused when not wanted) */
	start: Map<number, number>;
};

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

/**
 * Every split of `rolls` upgrades across 4 lines, with its chance. Rolls pick
 * a line uniformly; under a floor the TOP-UP reading applies (see the header,
 * and Genshin Optimizer's `rollCountProb`): a split that leaves the selected
 * lines above the floor keeps its plain chance, and every split that would
 * leave them at or below it collapses onto "exactly at the floor", spread
 * uniformly within and outside the selected lines. `already` = rolls the
 * selected lines hold from earlier upgrades (a defined piece mid-level).
 */
export function countVectors(
	rolls: number,
	selected: boolean[],
	floor = 0,
	already = 0
): { n: number[]; p: number }[] {
	const nSel = selected.filter(Boolean).length;
	const need = Math.min(rolls, Math.max(0, floor - already));
	const out: { n: number[]; p: number }[] = [];
	const multi = (n: number[], lines: number) =>
		factorial(n.reduce((a, b) => a + b, 0)) /
		n.reduce((a, b) => a * factorial(b), 1) /
		Math.pow(
			lines,
			n.reduce((a, b) => a + b, 0)
		);
	const atOrBelow = binomialDist(rolls, nSel / 4)
		.slice(0, need + 1)
		.reduce((a, b) => a + b, 0);

	for (let a = 0; a <= rolls; a++)
		for (let b = 0; a + b <= rolls; b++)
			for (let c = 0; a + b + c <= rolls; c++) {
				const n = [a, b, c, rolls - a - b - c];
				const base = multi(n, 4);
				if (need === 0 || nSel === 0 || nSel === 4) {
					out.push({ n, p: base });
					continue;
				}
				const t = n.reduce((acc, k, i) => acc + (selected[i] ? k : 0), 0);
				if (t > need) out.push({ n, p: base });
				else if (t === need) {
					const inSel = n.filter((_, i) => selected[i]);
					const outSel = n.filter((_, i) => !selected[i]);
					out.push({ n, p: atOrBelow * multi(inSel, nSel) * multi(outSel, 4 - nSel) });
				}
			}
	return out.filter((v) => v.p > 0);
}

/** `start` plus `k` uniform tiers, for k = 0…max. */
function rollPowers(start: Map<number, number>, tiers: number[], max: number) {
	const out = [start];
	for (let k = 1; k <= max; k++) {
		const next = new Map<number, number>();
		for (const [v, p] of out[k - 1])
			for (const t of tiers) next.set(v + t, (next.get(v + t) ?? 0) + p / tiers.length);
		out.push(next);
	}
	return out;
}

/** The value of your stats on screen: CV from each line rounded to 0.1, or useful rolls. */
export function shownValue(unit: ValueUnit, cr: number, cd: number, rv = 0): number {
	if (unit === 'rolls') return rv / 100;
	return (2 * Math.round(cr / 10) + Math.round(cd / 10)) / 10;
}

/**
 * The value of your stats at +20: four lines, `rolls` upgrades still to
 * come under `floor` on the selected lines. `pastWanted` = upgrades your
 * stats already took (they colour the bars with the new ones).
 */
export function outcome(
	unit: ValueUnit,
	lines: LineState[],
	rolls: number,
	floor = 0,
	already = 0,
	pastWanted = 0
): Outcome {
	const vectors = countVectors(
		rolls,
		lines.map((l) => l.selected),
		floor,
		already
	);
	const powers = lines.map((l) =>
		l.wanted ? rollPowers(l.start, unitTiers(unit, l.id), rolls) : null
	);
	const acc = new Map<number, { x: number; k: number; p: number }>();
	const add = (x: number, k: number, p: number) => {
		const key = Math.round(x * 100) * 16 + k;
		const e = acc.get(key);
		if (e) e.p += p;
		else acc.set(key, { x, k, p });
	};

	for (const { n, p } of vectors) {
		const k = pastWanted + n.reduce((s, ni, i) => s + (lines[i].wanted ? ni : 0), 0);
		if (unit === 'cv') {
			const of = (id: SubstatId) => {
				const i = lines.findIndex((l) => l.wanted && l.id === id);
				return i < 0 ? new Map([[0, 1]]) : powers[i]![n[i]];
			};
			for (const [cr, pa] of of('cr'))
				for (const [cd, pb] of of('cd')) add(shownValue('cv', cr, cd), k, p * pa * pb);
		} else {
			let sum = new Map([[0, 1]]);
			lines.forEach((l, i) => {
				if (!l.wanted) return;
				const next = new Map<number, number>();
				for (const [v, pv] of sum)
					for (const [w, pw] of powers[i]![n[i]]) next.set(v + w, (next.get(v + w) ?? 0) + pv * pw);
				sum = next;
			});
			for (const [rv, pv] of sum) add(shownValue('rolls', 0, 0, rv), k, p * pv);
		}
	}
	return [...acc.values()].sort((a, b) => a.x - b.x || a.k - b.k);
}

/** Mix weighted outcomes (a 3-line piece's possible 4th lines). */
export function mixOutcomes(parts: { w: number; out: Outcome }[]): Outcome {
	const acc = new Map<number, { x: number; k: number; p: number }>();
	for (const { w, out } of parts)
		for (const o of out) {
			const key = Math.round(o.x * 100) * 16 + o.k;
			const e = acc.get(key);
			if (e) e.p += w * o.p;
			else acc.set(key, { ...o, p: w * o.p });
		}
	return [...acc.values()].sort((a, b) => a.x - b.x || a.k - b.k);
}

/** Drop the colour tag: one chance per value. */
export function collapse(out: Outcome): ValueDist {
	const acc = new Map<number, number>();
	for (const o of out) acc.set(o.x, (acc.get(o.x) ?? 0) + o.p);
	return [...acc.entries()].map(([x, p]) => ({ x, p })).sort((a, b) => a.x - b.x);
}

/**
 * A fresh piece with `wantedIds` among its lines (by +4), levelled to +20:
 * one first roll each, then `events` upgrades. Under a floor the selected
 * lines are your stats first (a defined piece is defined on what you want).
 * The Level up chart, and the population a finished piece is ranked against.
 */
export function freshOutcome(
	unit: ValueUnit,
	wantedIds: SubstatId[],
	events: number,
	floor = 0,
	selectedIds?: SubstatId[]
): Outcome {
	const filler: SubstatId[] = (['hp', 'def', 'atk', 'em'] as SubstatId[]).filter(
		(id) => !wantedIds.includes(id)
	);
	const ids = [...wantedIds, ...filler].slice(0, 4);
	const sel = selectedIds ?? ids.slice(0, 2);
	const lines = ids.map((id, i) => ({
		id,
		wanted: i < wantedIds.length,
		selected: sel.includes(id),
		start: uniformLine(unitTiers(unit, id))
	}));
	return outcome(unit, lines, events, floor);
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
	return {
		mean,
		p10: quantile(0.1),
		p25: quantile(0.25),
		median: quantile(0.5),
		p75: quantile(0.75),
		p90: quantile(0.9)
	};
}

/**
 * P(an outcome is below / equal to / above a reference). The reference can
 * be uncertain (useful rolls read off a rounded display), so it is a
 * distribution too; "equal" compares displayed values.
 */
export function compareTo(dist: ValueDist, ref: ValueDist) {
	let below = 0;
	let equal = 0;
	for (const v of ref) {
		for (const d of dist) {
			if (Math.abs(d.x - v.x) < 1e-6) equal += d.p * v.p;
			else if (d.x < v.x) below += d.p * v.p;
		}
	}
	return { below, equal, above: Math.max(0, 1 - below - equal) };
}

/** Mid-rank percentile: below, plus half the ties (a typical piece reads 50). */
export function percentileOf(dist: ValueDist, ref: ValueDist): number {
	const { below, equal } = compareTo(dist, ref);
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
export const pieceChance = (mainChance: number, linesChance: number, eitherSet = false) =>
	(eitherSet ? 1 : SET_CHANCE) * SLOT_CHANCE * mainChance * linesChance;

/**
 * The chance a piece of this slot has an accepted main stat AND at least
 * `atLeast` of your stats among its 4 lines (by +4). A main stat that is one
 * of your stats counts toward them — a CRIT Rate circlet needs only one more.
 */
export function targetLinesChance(
	mains: { id: MainStatId; chance: number }[],
	wanted: SubstatId[],
	atLeast: number
): number {
	return mains.reduce((acc, m) => {
		const onMain = wanted.includes(m.id as SubstatId) ? 1 : 0;
		const subs = wanted.filter((id) => id !== m.id);
		return acc + m.chance * presenceAtLeast(substatPool(m.id), subs, atLeast - onMain, 4);
	}, 0);
}

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
