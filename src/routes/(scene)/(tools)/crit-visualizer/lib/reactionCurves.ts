// Reaction damage scaling — the three EM formulas + character level multipliers.
//
// Sources: KQM TCL (docs/library/game/elemental-reactions.md Sections 2–4) for the EM bonus
// formulas and reaction multipliers; fandom wiki (via MediaWiki API,
// Elemental_Reaction/Level_Scaling + Crystallize) for the per-level character
// multiplier table and the crystallize shield bonus. Characters cap at level
// 90 — the wiki's 91–99 character column is blank, so the table stops there.
//
// All values are pre-resistance and exclude +% reaction bonuses (4pc Crimson
// Witch, Mona C1, etc.) — this module exposes the base scaling shape only.

/** Character level multiplier, index 0 = level 1 (fandom wiki, v5.x) */
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
	1405.097377, 1446.853458
];

/** Crystallize shield level multiplier, index 0 = level 1 (fandom wiki, v5.x) */
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
	1702.980391, 1726.104684, 1754.671567, 1785.86656, 1817.137404, 1851.060358
];

export const MAX_LEVEL = 90;

const atLevel = (table: number[], level: number) =>
	table[Math.min(MAX_LEVEL, Math.max(1, Math.round(level))) - 1];

export const levelMult = (level: number) => atLevel(CHAR_LEVEL_MULT, level);
export const crystallizeLevelMult = (level: number) => atLevel(CRYSTALLIZE_LEVEL_MULT, level);

// ── The three EM curves (plus crystallize's) — each with its own constants ──

/** Amplifying (vape/melt): 2.78 × EM / (1400 + EM) */
export const ampEmBonus = (em: number) => (2.78 * em) / (1400 + em);
/** Transformative: 16 × EM / (2000 + EM) */
export const transformativeEmBonus = (em: number) => (16 * em) / (2000 + em);
/** Additive (spread/aggravate): 5 × EM / (1200 + EM) */
export const additiveEmBonus = (em: number) => (5 * em) / (1200 + em);
/** Crystallize shield: 4.44 × EM / (1400 + EM) */
export const crystallizeEmBonus = (em: number) => (4.44 * em) / (1400 + em);

/** Final amp multiplier on the triggering hit (base 2 forward, 1.5 reverse) */
export const ampMultiplier = (base: number, em: number) => base * (1 + ampEmBonus(em));

/** Transformative reaction damage before enemy RES */
export const transformativeDamage = (mult: number, level: number, em: number) =>
	mult * levelMult(level) * (1 + transformativeEmBonus(em));

/** Flat damage added to the triggering hit by spread (1.25) / aggravate (1.15) */
export const additiveDamage = (mult: number, level: number, em: number) =>
	mult * levelMult(level) * (1 + additiveEmBonus(em));

/** Crystallize shield absorption before element-matching bonuses */
export const crystallizeShieldHp = (level: number, em: number) =>
	crystallizeLevelMult(level) * (1 + crystallizeEmBonus(em));
