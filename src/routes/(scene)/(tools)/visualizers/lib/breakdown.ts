// Damage Breakdown — the hit as a product of multiplier buckets, from real
// character-sheet inputs. Outputs are RELATIVE for attack-scaling hits
// ("×8.06 vs a bare hit" — the talent multiplier is the one bucket a sheet
// can't supply); additive chunks, transformative and Lunar/Stellar reaction
// damage are printed exactly, because their formulas are complete without
// talent multipliers (the precedent Reaction Curves set). Formula pieces reused
// from defres.ts (DEF/RES) and reactionCurves.ts (level table + EM curves);
// roll steps from artifactOdds.

import { defMultiplier, resMultiplier } from './defres';
import {
	additiveDamage,
	ampMultiplier,
	specialReactionDamage,
	transformativeDamage,
	TOP_CONTRIBUTOR_SHARE
} from './reactionCurves';
import { substatById, type SubstatId } from './artifactOdds';

export type FamilyId = 'direct' | 'additive' | 'transformative' | 'lunar';

/** The stat a direct hit scales on — it decides which substat rolls apply. */
export type ScalingStat = 'atk' | 'hp' | 'def';

export type SheetInputs = {
	/** Base scaling stat (ATK for most characters; HP/DEF for their scalers) */
	base: number;
	/** % bonus to the scaling stat (artifacts + weapon), whole number */
	statPct: number;
	/** Flat bonus to the scaling stat */
	statFlat: number;
	/** Elemental/physical DMG bonus %, whole number */
	dmgPct: number;
	/** CRIT Rate %, whole number */
	cr: number;
	/** CRIT DMG %, whole number */
	cd: number;
	em: number;
	/** Reaction Bonus %, whole number — adds inside the EM bracket (4pc Crimson
	 *  Witch, Aubade, a weapon's "Reaction DMG +X%"). */
	rbPct: number;
	/** Lunar/Stellar Base DMG Bonus %, whole number — its own bracket (Moonsign
	 *  benedictions, the Stellar Jubilee passives). */
	baseDmgPct: number;
	/** Lunar/Stellar Elevation %, whole number — the outermost bracket. */
	elevationPct: number;
	charLevel: number;
	enemyLevel: number;
	/** Enemy RES %, whole number (post-shred) */
	enemyRes: number;
	/** Enemy DEF reduction ("shred") %, whole number */
	defShredPct: number;
	/** DEF ignore %, whole number — multiplies with shred on the enemy side */
	defIgnorePct: number;
};

export const DEFAULT_SHEET: SheetInputs = {
	base: 800,
	statPct: 55,
	statFlat: 1200,
	dmgPct: 61.6,
	cr: 70,
	cd: 140,
	em: 200,
	rbPct: 0,
	// one benediction's cap: a Lunar or Stellar reaction needs an enabler in the
	// party, and every current enabler carries one
	baseDmgPct: 14,
	elevationPct: 0,
	charLevel: 90,
	enemyLevel: 100,
	enemyRes: 10,
	defShredPct: 0,
	defIgnorePct: 0
};

/** Slider ranges for the reaction buckets, from what the game offers today
 *  (2026-10, 7.1). Reaction Bonus: RB_MAX, shared with Reaction Curves.
 *  Base DMG Bonus: two benedictions (14% each) + Ineffa C1 (≤50%) + Flins (20%)
 *  ≈ 98% on Lunar-Charged. Elevation: Odette C6 (45%) + Sandrone C6 (20%) ≈ 65%
 *  on the Stellar reactions. Sources: the corpus census + gcsim, 2026-10-01. */
export { RB_MAX } from './reactionCurves';
export const BASE_DMG_MAX = 150;
export const ELEVATION_MAX = 100;

export type ReactionDef = {
	id: string;
	/** The reaction's name, alone */
	name: string;
	/** The multiplier the formula uses */
	mult: number;
	/** The multiplier one character sees — `mult` × the top-contributor share for
	 *  Lunar/Stellar, `mult` itself everywhere else */
	shown: number;
	/** The reaction as a sentence names it, when the picker label (a comma
	 *  list) doesn't read as one — "Stellar Swirl blast after 3+ swirls" */
	phrase?: string;
};

const r = (id: string, name: string, mult: number): ReactionDef => ({
	id,
	name,
	mult,
	shown: mult
});
const lunarR = (id: string, name: string, mult: number, phrase?: string): ReactionDef => ({
	id,
	name,
	mult,
	shown: Math.round(mult * TOP_CONTRIBUTOR_SHARE * 100) / 100,
	phrase
});

export const REACTIONS: Record<FamilyId, ReactionDef[]> = {
	direct: [
		r('none', 'No reaction', 1),
		r('vape2', 'Vaporize', 2),
		r('vape15', 'Vaporize', 1.5),
		r('melt2', 'Melt', 2),
		r('melt15', 'Melt', 1.5)
	],
	additive: [r('spread', 'Spread', 1.25), r('aggravate', 'Aggravate', 1.15)],
	transformative: [
		r('hyperbloom', 'Hyperbloom', 3),
		r('burgeon', 'Burgeon', 3),
		r('shatter', 'Shatter', 3),
		r('overload', 'Overloaded', 2.75),
		r('ec', 'Electro-Charged', 2),
		r('bloom', 'Bloom', 2),
		r('superconduct', 'Superconduct', 1.5),
		r('swirl', 'Swirl', 0.6),
		r('burning', 'Burning', 0.25)
	],
	lunar: [
		lunarR('lc', 'Lunar-Charged', 3),
		lunarR('lcrys', 'Lunar-Crystallize', 1.6),
		lunarR('ssw', 'Stellar Swirl', 0.75),
		lunarR(
			'sswBlast12',
			'Stellar Swirl blast, 1–2 swirls',
			2,
			'Stellar Swirl blast after 1–2 swirls'
		),
		lunarR('sswBlast3', 'Stellar Swirl blast, 3+ swirls', 3, 'Stellar Swirl blast after 3+ swirls')
	]
};

const clampPct01 = (pct: number) => Math.min(1, Math.max(0, pct / 100));
const rbOf = (i: SheetInputs) => Math.max(0, i.rbPct) / 100;

// ── Bucket factors (direct family) ─────────────────────────────────────────

export const scalingTotal = (i: SheetInputs) => i.base * (1 + i.statPct / 100) + i.statFlat;
/** Scaling stat's multiplier over a bare (base-only) stat line */
export const scalingFactor = (i: SheetInputs) =>
	1 + i.statPct / 100 + (i.base > 0 ? i.statFlat / i.base : 0);
export const dmgFactor = (i: SheetInputs) => 1 + Math.max(0, i.dmgPct) / 100;
/** Average crit multiplier: 1 + CR·CD */
export const critFactor = (i: SheetInputs) => 1 + (clampPct01(i.cr) * Math.max(0, i.cd)) / 100;
export const ampFactor = (i: SheetInputs, mult: number) =>
	mult <= 1 ? 1 : ampMultiplier(mult, i.em, rbOf(i));
export const defFactor = (i: SheetInputs) =>
	defMultiplier(i.charLevel, i.enemyLevel, i.defShredPct / 100, i.defIgnorePct / 100);
export const resFactor = (i: SheetInputs) => resMultiplier(i.enemyRes / 100);

/** Direct hit: total multiplier vs a bare hit (base stat, no bonuses, no enemy) */
export function directTotal(i: SheetInputs, reactionMult: number): number {
	return (
		scalingFactor(i) *
		dmgFactor(i) *
		critFactor(i) *
		ampFactor(i, reactionMult) *
		defFactor(i) *
		resFactor(i)
	);
}

// ── Additive family (Spread / Aggravate) ───────────────────────────────────

/** The exact flat chunk the reaction adds to the hit's base damage */
export const additiveChunk = (i: SheetInputs, mult: number) =>
	additiveDamage(mult, i.charLevel, i.em, rbOf(i));

/** The chunk after riding DMG%, crit, DEF and RES with the rest of the hit */
export const additiveEffective = (i: SheetInputs, mult: number) =>
	additiveChunk(i, mult) * dmgFactor(i) * critFactor(i) * defFactor(i) * resFactor(i);

// ── Transformative family ──────────────────────────────────────────────────

/** Exact transformative damage after enemy RES (no crit, ATK, or DMG%) */
export const transformativeTotal = (i: SheetInputs, mult: number) =>
	transformativeDamage(mult, i.charLevel, i.em, rbOf(i)) * resFactor(i);

// ── Lunar / Stellar family (reaction damage) ───────────────────────────────

export const baseDmgFactor = (i: SheetInputs) => 1 + Math.max(0, i.baseDmgPct) / 100;
export const elevationFactor = (i: SheetInputs) => 1 + Math.max(0, i.elevationPct) / 100;

/** One character's Lunar/Stellar reaction hit as the top contributor, on
 *  average: level × reaction × (EM + Reaction Bonus) × Base DMG Bonus ×
 *  Elevation × crit × RES. No DEF — these reactions ignore it (gcsim
 *  `IgnoreDefPercent: 1`). */
export const lunarTotal = (i: SheetInputs, mult: number) =>
	TOP_CONTRIBUTOR_SHARE *
	specialReactionDamage(mult, i.charLevel, i.em, rbOf(i)) *
	baseDmgFactor(i) *
	elevationFactor(i) *
	critFactor(i) *
	resFactor(i);

// ── Family-uniform total (marginal-gain arithmetic works on ratios) ────────

export function familyTotal(family: FamilyId, i: SheetInputs, reactionMult: number): number {
	if (family === 'direct') return directTotal(i, reactionMult);
	if (family === 'additive') return additiveEffective(i, reactionMult);
	if (family === 'lunar') return lunarTotal(i, reactionMult);
	return transformativeTotal(i, reactionMult);
}

// ── "What the next roll buys" ──────────────────────────────────────────────

/** Average 5★ substat roll, in display units (% stats → whole numbers) */
export function averageRoll(id: SubstatId): number {
	const s = substatById(id);
	const avg = s.tiers.reduce((a, b) => a + b, 0) / s.tiers.length;
	return s.isPct ? avg * 100 : avg;
}

export type LabStat = {
	key: keyof SheetInputs;
	/** The stat's name as the game writes it */
	label: string;
	step: number;
	/** Whether `step` is a percentage (formatting) */
	isPct: boolean;
};

const STAT_NAMES: Record<ScalingStat, string> = { atk: 'ATK', hp: 'HP', def: 'DEF' };
const PCT_ROLL: Record<ScalingStat, SubstatId> = { atk: 'atkPct', hp: 'hpPct', def: 'defPct' };

export const statName = (s: ScalingStat) => STAT_NAMES[s];

/** The substats whose rolls feed a family's formula. ⛔ DMG Bonus is not here:
 *  no artifact substat carries it, so any step it took would be invented, and
 *  an invented step's bar can't be compared with real rolls. */
export function labStats(
	family: FamilyId,
	reactionMult: number,
	scaling: ScalingStat = 'atk'
): LabStat[] {
	const roll = (key: keyof SheetInputs, label: string, id: SubstatId): LabStat => ({
		key,
		label,
		step: averageRoll(id),
		isPct: substatById(id).isPct
	});
	const name = STAT_NAMES[scaling];
	const statPct = roll('statPct', `${name}%`, PCT_ROLL[scaling]);
	const statFlat = roll('statFlat', `Flat ${name}`, scaling);
	const cr = roll('cr', 'CRIT Rate', 'cr');
	const cd = roll('cd', 'CRIT DMG', 'cd');
	const em = roll('em', 'Elemental Mastery', 'em');
	if (family === 'direct') {
		const base = [statPct, statFlat, cr, cd];
		return reactionMult > 1 ? [...base, em] : base;
	}
	if (family === 'additive' || family === 'lunar') return [em, cr, cd];
	return [em];
}

/** Relative gain of one roll-step of `stat` from the current sheet */
export function marginalGain(
	family: FamilyId,
	i: SheetInputs,
	reactionMult: number,
	stat: LabStat
): number {
	const patched = { ...i, [stat.key]: (i[stat.key] as number) + stat.step };
	const before = familyTotal(family, i, reactionMult);
	if (before <= 0) return 0;
	return familyTotal(family, patched, reactionMult) / before - 1;
}
