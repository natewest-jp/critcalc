// Enemy DEF & RES multipliers — the two hidden factors every hit passes
// through. Formulas verified against gcsim pkg/enemy/damage.go (defmod /
// resmod) and KQM TCL; docs/library/game/damage-formula.md holds the spec.
//
// Note on the RES 75% boundary: gcsim's branch ordering skips the exact
// res == 0.75 case (a measure-zero fallthrough); the two adjacent formulas
// agree at 0.25 there, so the continuous form below is the correct one.

import type { ShredElement, ShredSource } from '$lib/capabilities/shredSources';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * DEF damage multiplier. Equal character/enemy levels with no modifiers is
 * exactly 0.5 — the "hidden 50% tax". DEF reduction (shred) and DEF ignore
 * are separate knobs that multiply together on the enemy side; several
 * reductions ADD before that (gcsim sums its DefMods), as do several ignores.
 *
 * ⚠️ There is no cap on reduction. gcsim's `defadj > 0.9` clamp is on the
 * POSITIVE side — an enemy's DEF can be RAISED by at most 90% — and has been
 * since 2022; a reduction reaches the formula whole.
 */
export function defMultiplier(
	charLevel: number,
	enemyLevel: number,
	defReduction = 0,
	defIgnore = 0
): number {
	const cl = charLevel + 100;
	const enemySide = (enemyLevel + 100) * (1 - clamp01(defReduction)) * (1 - clamp01(defIgnore));
	return cl / (cl + enemySide);
}

/**
 * RES damage multiplier for a FINAL resistance value (base − shred, as a
 * fraction: 0.10 = 10%). Three regimes:
 *   res < 0      → 1 − res/2   (each negative point only counts half)
 *   0 ≤ res < ¾  → 1 − res     (linear)
 *   res ≥ ¾      → 1/(4·res+1) (diminishing)
 * An immune enemy (`Infinity`) takes nothing — immunity is not a RES value,
 * so no shred reaches it.
 */
export function resMultiplier(res: number): number {
	if (res === Infinity) return 0;
	if (res < 0) return 1 - res / 2;
	if (res < 0.75) return 1 - res;
	return 1 / (4 * res + 1);
}

/** Base RES the instrument offers, whole percent. Most enemies resist 10%;
 *  bosses commonly sit at 30, 60 or 90, and some reach 200 (⚓ Nate's read of
 *  the Stygian Onslaught bosses, 2026-10-06). */
export const BASE_RES_MIN = -50;
export const BASE_RES_MAX = 200;
export const RES_RUNGS = [10, 30, 60, 90, 200] as const;

/** The enemy level slider's ceiling. */
export const ENEMY_LEVEL_MAX = 110;

// ── Sources ────────────────────────────────────────────────────────────────

/** One amount a source can take. Most sources have one; a debuff gated apart
 *  by conditions has several (Escoffier's 5/10/15/55% by party, Durin's 20%
 *  or his rite's 35%) — picked, never summed. */
export type SourceOption = { amount: number; ability: string; minCon: number };

/** One chip: an in-game debuff (or ignore) from one character or set. */
export type SourceGroup = {
	key: string;
	owner: string;
	ownerName: string;
	ownerKind: ShredSource['ownerKind'];
	stat: ShredSource['stat'];
	scope?: ShredSource['scope'];
	target?: ShredSource['target'];
	/** RES only: the elements it lowers. */
	elements: ShredElement[];
	/** Ascending by amount. */
	options: SourceOption[];
};

/** Rows → chips. Rows sharing an owner and a `mod` are ONE debuff, so they
 *  become one chip whose distinct amounts are options; every other row is a
 *  chip of its own (and sums with its owner's others — Citlali's C2). */
export function groupSources(rows: readonly ShredSource[]): SourceGroup[] {
	const groups = new Map<string, SourceGroup>();
	rows.forEach((r) => {
		// Stable across data edits, because a share link carries it: a debuff's
		// mod, else its entry's name — numbered when one entry hosts two.
		let key = [r.owner, r.stat, r.scope ?? '', r.mod ?? r.ability].join('|');
		if (r.mod === undefined)
			for (let n = 2; groups.has(key); n++) key = key.replace(/#\d+$/, '') + `#${n}`;
		let g = groups.get(key);
		if (!g) {
			g = {
				key,
				owner: r.owner,
				ownerName: r.ownerName,
				ownerKind: r.ownerKind,
				stat: r.stat,
				...(r.scope && { scope: r.scope }),
				...(r.target && { target: r.target }),
				elements: [],
				options: []
			};
			groups.set(key, g);
		}
		for (const e of r.elements) if (!g.elements.includes(e)) g.elements.push(e);
		const same = g.options.find((o) => o.amount === r.amount);
		if (same) same.minCon = Math.min(same.minCon, r.minCon);
		else g.options.push({ amount: r.amount, ability: r.ability, minCon: r.minCon });
	});
	for (const g of groups.values()) g.options.sort((a, b) => a.amount - b.amount);
	return [...groups.values()];
}

/** Does this chip act on a hit of `element`? DEF shred and ignore always do. */
export const appliesTo = (g: SourceGroup, element: ShredElement) =>
	g.stat !== 'res' || g.elements.includes(element);

export type ShredTotals = {
	/** Percent points, summed. */
	res: number;
	def: number;
	ignore: number;
};

/** Sum the picked chips that act on a hit of `element`, whole percent. A pick
 *  maps a chip's key to the amount chosen for it. */
export function sumPicks(
	groups: readonly SourceGroup[],
	picks: ReadonlyMap<string, number>,
	element: ShredElement
): ShredTotals {
	const t: ShredTotals = { res: 0, def: 0, ignore: 0 };
	for (const g of groups) {
		const amount = picks.get(g.key);
		if (amount === undefined || !appliesTo(g, element)) continue;
		t[g.stat] += amount;
	}
	return t;
}
