// Damage Anatomy — the hit as a product of multiplier buckets, from real
// character-sheet inputs. Outputs are RELATIVE for attack-scaling hits
// ("×8.06 vs a bare hit" — never a hit number the game could contradict);
// additive chunks and transformative damage are printed exactly, because
// their formulas are complete without talent multipliers (the precedent
// Reaction Curves set). Formula pieces reused from defres.ts (DEF/RES) and
// reactionCurves.ts (level table + EM curves); roll steps from artifactRolls.

import { defMultiplier, resMultiplier } from './defres';
import { additiveDamage, ampMultiplier, transformativeDamage } from './reactionCurves';
import { substatById, type SubstatId } from './artifactRolls';

export type FamilyId = 'direct' | 'additive' | 'transformative';

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
	charLevel: number;
	enemyLevel: number;
	/** Enemy RES %, whole number (post-shred) */
	enemyRes: number;
};

export const DEFAULT_SHEET: SheetInputs = {
	base: 800,
	statPct: 55,
	statFlat: 1200,
	dmgPct: 61.6,
	cr: 70,
	cd: 140,
	em: 200,
	charLevel: 90,
	enemyLevel: 100,
	enemyRes: 10
};

export type ReactionDef = { id: string; label: string; mult: number };

export const REACTIONS: Record<FamilyId, ReactionDef[]> = {
	direct: [
		{ id: 'none', label: 'No Reaction', mult: 1 },
		{ id: 'vape2', label: 'Vaporize ×2', mult: 2 },
		{ id: 'vape15', label: 'Vaporize ×1.5', mult: 1.5 },
		{ id: 'melt2', label: 'Melt ×2', mult: 2 },
		{ id: 'melt15', label: 'Melt ×1.5', mult: 1.5 }
	],
	additive: [
		{ id: 'spread', label: 'Spread ×1.25', mult: 1.25 },
		{ id: 'aggravate', label: 'Aggravate ×1.15', mult: 1.15 }
	],
	transformative: [
		{ id: 'hyperbloom', label: 'Hyperbloom ×3', mult: 3 },
		{ id: 'burgeon', label: 'Burgeon ×3', mult: 3 },
		{ id: 'shatter', label: 'Shatter ×3', mult: 3 },
		{ id: 'overload', label: 'Overload ×2.75', mult: 2.75 },
		{ id: 'ec', label: 'Electro-Charged ×2', mult: 2 },
		{ id: 'bloom', label: 'Bloom ×2', mult: 2 },
		{ id: 'superconduct', label: 'Superconduct ×1.5', mult: 1.5 },
		{ id: 'swirl', label: 'Swirl ×0.6', mult: 0.6 },
		{ id: 'burning', label: 'Burning ×0.25', mult: 0.25 }
	]
};

const clampPct01 = (pct: number) => Math.min(1, Math.max(0, pct / 100));

// ── Bucket factors (direct family) ─────────────────────────────────────────

export const scalingTotal = (i: SheetInputs) => i.base * (1 + i.statPct / 100) + i.statFlat;
/** Scaling stat's multiplier over a bare (base-only) stat line */
export const scalingFactor = (i: SheetInputs) =>
	1 + i.statPct / 100 + (i.base > 0 ? i.statFlat / i.base : 0);
export const dmgFactor = (i: SheetInputs) => 1 + Math.max(0, i.dmgPct) / 100;
/** Average crit multiplier: 1 + CR·CD */
export const critFactor = (i: SheetInputs) => 1 + (clampPct01(i.cr) * Math.max(0, i.cd)) / 100;
export const ampFactor = (i: SheetInputs, mult: number) =>
	mult <= 1 ? 1 : ampMultiplier(mult, i.em);
export const defFactor = (i: SheetInputs) => defMultiplier(i.charLevel, i.enemyLevel);
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
	additiveDamage(mult, i.charLevel, i.em);

/** The chunk after riding DMG%, crit, DEF and RES with the rest of the hit */
export const additiveEffective = (i: SheetInputs, mult: number) =>
	additiveChunk(i, mult) * dmgFactor(i) * critFactor(i) * defFactor(i) * resFactor(i);

// ── Transformative family ──────────────────────────────────────────────────

/** Exact transformative damage after enemy RES (no crit, ATK, or DMG%) */
export const transformativeTotal = (i: SheetInputs, mult: number) =>
	transformativeDamage(mult, i.charLevel, i.em) * resFactor(i);

// ── Family-uniform total (marginal-gain arithmetic works on ratios) ────────

export function familyTotal(family: FamilyId, i: SheetInputs, reactionMult: number): number {
	if (family === 'direct') return directTotal(i, reactionMult);
	if (family === 'additive') return additiveEffective(i, reactionMult);
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
	label: string;
	/** Step description, e.g. "+5.0% per roll" */
	stepLabel: string;
	step: number;
};

/** The adjustable stats that actually feed a family's formula. dmgPct has no
 * substat, so its step is a nominal +10% (labeled as such). */
export function labStats(family: FamilyId, reactionMult: number): LabStat[] {
	const pct = (n: number) => `+${n.toFixed(1)}% per roll`;
	const flat = (n: number) => `+${n.toFixed(1)} per roll`;
	const rows: Record<string, LabStat> = {
		statPct: {
			key: 'statPct',
			label: 'Stat%',
			stepLabel: pct(averageRoll('atkPct')),
			step: averageRoll('atkPct')
		},
		statFlat: {
			key: 'statFlat',
			label: 'Flat stat',
			stepLabel: flat(averageRoll('atk')),
			step: averageRoll('atk')
		},
		cr: {
			key: 'cr',
			label: 'CRIT Rate',
			stepLabel: pct(averageRoll('cr')),
			step: averageRoll('cr')
		},
		cd: {
			key: 'cd',
			label: 'CRIT DMG',
			stepLabel: pct(averageRoll('cd')),
			step: averageRoll('cd')
		},
		em: { key: 'em', label: 'EM', stepLabel: flat(averageRoll('em')), step: averageRoll('em') },
		dmgPct: { key: 'dmgPct', label: 'DMG Bonus', stepLabel: '+10% (no substat)', step: 10 }
	};
	if (family === 'direct') {
		const base = [rows.statPct, rows.statFlat, rows.cr, rows.cd, rows.dmgPct];
		return reactionMult > 1 ? [...base, rows.em] : base;
	}
	if (family === 'additive') return [rows.em, rows.cr, rows.cd, rows.dmgPct];
	return [rows.em];
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
