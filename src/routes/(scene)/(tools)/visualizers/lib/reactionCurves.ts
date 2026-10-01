// Reaction damage scaling — the five EM formulas + character level multipliers.
//
// Sources: KQM TCL (docs/library/game/elemental-reactions.md Sections 2–4) for the EM bonus
// formulas and reaction multipliers; fandom wiki (via MediaWiki API,
// Elemental_Reaction/Level_Scaling + Crystallize) for levels 1–90 of the per-level
// multiplier tables and the crystallize shield bonus; gcsim
// (`pkg/core/combat/reaction.dm.go`, `internal/template/crystallize/shield.go`) for
// levels 91–100, whose 1–90 agree with the wiki's to the published precision. The
// Lunar/Stellar formula is gcsim's `CalcSpecialReactionDmg` — see
// docs/library/game/lunar-reactions.md and stellar-reactions.md.
//
// ⚠️ Only 95 and 100 are reachable above 90 (Masterless Stellar Fortuna jumps
// straight to them); the tables carry 91–99 so they stay a plain index, and
// `snapLevel` / `stepLevel` keep the slider off them.
//
// All values are pre-resistance and pre-crit. A Reaction Bonus (4pc Crimson
// Witch, Mona C1, …) adds inside the EM bracket, so every damage helper takes one
// as an optional fraction; Crystallize's shield has no such bracket.

/** Character level multiplier, index 0 = level 1 (fandom wiki 1–90, gcsim 91–100) */
export const CHAR_LEVEL_MULT = [
	17.165605, 18.535048, 19.904854, 21.274903, 22.6454, 24.649613, 26.640643, 28.868587, 31.367679,
	34.143343, 37.201, 40.66, 44.446668, 48.563519, 53.74848, 59.081897, 64.420047, 69.724455,
	75.123137, 80.584775, 86.112028, 91.703742, 97.244628, 102.812644, 108.409563, 113.201694,
	118.102906, 122.979318, 129.72733, 136.29291, 142.67085, 149.029029, 155.416987, 161.825495,
	169.106313, 176.518077, 184.072741, 191.709518, 199.556908, 207.382042, 215.3989, 224.165667,
	233.50216, 243.350573, 256.063067, 268.543493, 281.526075, 295.013648, 309.067188, 323.601597,
	336.757542, 350.530312, 364.482705, 378.619181, 398.600417, 416.398254, 434.386996, 452.951051,
	472.606217, 492.88489, 513.568543, 539.103198, 565.510563, 592.538753, 624.443427, 651.470148,
	679.49683, 707.79406, 736.671422, 765.640231, 794.773403, 824.677397, 851.157781, 877.74209,
	914.229123, 946.746752, 979.411386, 1011.223022, 1044.791746, 1077.443668, 1109.99754,
	1142.976615, 1176.369483, 1210.184393, 1253.835659, 1288.952801, 1325.484092, 1363.456928,
	1405.097377, 1446.853458, 1462.788, 1475.6956, 1497.9644, 1516.9423, 1561.468, 1593.5062,
	1621.0258, 1643.8679, 1662.1382, 1674.8092
];

/** Crystallize shield level multiplier, index 0 = level 1 (fandom wiki 1–90, gcsim 91–100) */
export const CRYSTALLIZE_LEVEL_MULT = [
	91.1791, 98.707667, 106.23622, 113.764771, 121.293322, 128.821878, 136.350422, 143.878978,
	151.407522, 158.936078, 169.991484, 181.076253, 192.190362, 204.048207, 215.938996, 227.86275,
	247.685944, 267.542105, 287.431209, 303.826417, 320.225217, 336.627633, 352.319267, 368.010913,
	383.702548, 394.432358, 405.18147, 415.949907, 426.737645, 437.544709, 450.600004, 463.700301,
	476.845577, 491.127512, 502.554564, 514.012104, 531.409589, 549.979601, 568.58488, 584.99652,
	605.670375, 626.386206, 646.052333, 665.755638, 685.496096, 700.839402, 723.333147, 745.865265,
	768.435731, 786.791945, 809.538812, 832.329057, 855.162654, 878.039628, 899.484802, 919.362018,
	946.039586, 974.764223, 1003.578617, 1030.077002, 1056.634974, 1085.246306, 1113.924427,
	1149.25872, 1178.064819, 1200.223743, 1227.660294, 1257.242987, 1284.917392, 1314.75288,
	1342.665216, 1372.752485, 1396.320986, 1427.312436, 1458.374528, 1482.335772, 1511.910837,
	1541.549377, 1569.153701, 1596.814298, 1622.419626, 1648.074031, 1666.376146, 1684.678276,
	1702.980391, 1726.104684, 1754.671567, 1785.86656, 1817.137404, 1851.060358, 1885.0671, 1921.7493,
	1958.5233, 2006.1941, 2041.569, 2054.4722, 2065.975, 2174.7227, 2186.7683, 2198.814
];

export const MAX_LEVEL = 100;

/** The Reaction Bonus sliders' ceiling, shared by Reaction Curves and Damage
 *  Anatomy. What the game offers at 7.1: Ifa's A1 alone reaches 225% on Swirl,
 *  and 7.x weapons + Aubade + Ascendant Gleam stack past 150% on Lunar/Stellar
 *  (gcsim, 2026-10-01). */
export const RB_MAX = 250;

/** The levels a character can actually hold: 1–90, then 95 and 100. */
export const isReachableLevel = (level: number) => level <= 90 || level === 95 || level === 100;

/** Where a DRAGGED slider value lands: the nearest reachable level, so the
 *  answer depends on the pointer's position alone. ⚠️ Deciding by direction of
 *  travel instead made a drag flicker between stops: with the pointer held at
 *  92, "up from 90" gave 95 and then "down from 95" gave 90, event after event. */
export function snapLevel(raw: number): number {
	const n = Math.min(MAX_LEVEL, Math.max(1, Math.round(raw)));
	if (isReachableLevel(n)) return n;
	if (n < 95) return n - 90 < 95 - n ? 90 : 95;
	return n - 95 < 100 - n ? 95 : 100;
}

/** One keyboard step from a reachable level — 90 → 95 → 100 and back. A key
 *  press has a direction and no position, so it steps; it never snaps. */
export function stepLevel(level: number, dir: 1 | -1): number {
	if (dir > 0) return level >= 95 ? 100 : level >= 90 ? 95 : level + 1;
	return level > 95 ? 95 : level > 90 ? 90 : Math.max(1, level - 1);
}

const atLevel = (table: number[], level: number) =>
	table[Math.min(MAX_LEVEL, Math.max(1, Math.round(level))) - 1];

export const levelMult = (level: number) => atLevel(CHAR_LEVEL_MULT, level);
export const crystallizeLevelMult = (level: number) => atLevel(CRYSTALLIZE_LEVEL_MULT, level);

// ── The five EM curves — every one is k·EM/(c+EM), only the constants differ ──

/** One EM bonus curve, `k·EM/(c+EM)`: `k` is the ceiling it approaches, `c` the
 *  EM at which it reaches half of that. */
export type EmCurve = { k: number; c: number };

export const AMP_CURVE: EmCurve = { k: 2.78, c: 1400 };
export const TRANSFORMATIVE_CURVE: EmCurve = { k: 16, c: 2000 };
export const ADDITIVE_CURVE: EmCurve = { k: 5, c: 1200 };
/** Lunar-Charged, Lunar-Crystallize and Stellar Swirl (gcsim `CalcSpecialReactionDmg`) */
export const SPECIAL_CURVE: EmCurve = { k: 6, c: 2000 };
export const CRYSTALLIZE_CURVE: EmCurve = { k: 4.44, c: 1400 };

export const emBonus = ({ k, c }: EmCurve, em: number) => (k * em) / (c + em);

/** The EM at which a curve's bonus reaches `target` — the inverse of `emBonus`.
 *  Infinity when the target is at or past the curve's ceiling. */
export function emForBonus({ k, c }: EmCurve, target: number): number {
	if (target <= 0) return 0;
	if (target >= k) return Infinity;
	return (target * c) / (k - target);
}

/** How much MORE EM, from `em`, buys the same as a Reaction Bonus of `rb` — the
 *  two add inside one bracket, so a flat bonus is worth less EM where the curve
 *  is steep and more where it has flattened. */
export const emWorthOfBonus = (curve: EmCurve, em: number, rb: number) =>
	emForBonus(curve, emBonus(curve, em) + rb) - em;

/** Amplifying (vape/melt): 2.78 × EM / (1400 + EM) */
export const ampEmBonus = (em: number) => emBonus(AMP_CURVE, em);
/** Transformative: 16 × EM / (2000 + EM) */
export const transformativeEmBonus = (em: number) => emBonus(TRANSFORMATIVE_CURVE, em);
/** Additive (spread/aggravate): 5 × EM / (1200 + EM) */
export const additiveEmBonus = (em: number) => emBonus(ADDITIVE_CURVE, em);
/** Lunar / Stellar: 6 × EM / (2000 + EM) */
export const specialEmBonus = (em: number) => emBonus(SPECIAL_CURVE, em);
/** Crystallize shield: 4.44 × EM / (1400 + EM) */
export const crystallizeEmBonus = (em: number) => emBonus(CRYSTALLIZE_CURVE, em);

/** Final amp multiplier on the triggering hit (base 2 forward, 1.5 reverse) */
export const ampMultiplier = (base: number, em: number, rb = 0) => base * (1 + ampEmBonus(em) + rb);

/** Transformative reaction damage before enemy RES */
export const transformativeDamage = (mult: number, level: number, em: number, rb = 0) =>
	mult * levelMult(level) * (1 + transformativeEmBonus(em) + rb);

/** Flat damage added to the triggering hit by spread (1.25) / aggravate (1.15) */
export const additiveDamage = (mult: number, level: number, em: number, rb = 0) =>
	mult * levelMult(level) * (1 + additiveEmBonus(em) + rb);

/** The top contributor's share of a Lunar / Stellar reaction hit. Each party member
 *  who contributes is computed on their own, then the results are summed at
 *  0.6 / 0.3 / 0.05 / 0.05, highest first (gcsim `lcContributorMult` and siblings). */
export const TOP_CONTRIBUTOR_SHARE = 0.6;

/** One contributor's Lunar-Charged / Lunar-Crystallize / Stellar Swirl damage
 *  before RES and crit, with no Base DMG Bonus or Elevation. `mult` is the
 *  reaction's own constant (LC 3 · LCrys 1.6 · Stellar Swirl 0.75, its Vortex
 *  blast 2 or 3); scale by `TOP_CONTRIBUTOR_SHARE` for what one character deals. */
export const specialReactionDamage = (mult: number, level: number, em: number, rb = 0) =>
	mult * levelMult(level) * (1 + specialEmBonus(em) + rb);

/** Crystallize shield absorption before element-matching bonuses */
export const crystallizeShieldHp = (level: number, em: number) =>
	crystallizeLevelMult(level) * (1 + crystallizeEmBonus(em));
