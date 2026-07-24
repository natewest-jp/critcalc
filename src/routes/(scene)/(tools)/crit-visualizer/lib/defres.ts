// Enemy DEF & RES multipliers — the two hidden factors every hit passes
// through. Formulas verified against gcsim pkg/enemy/damage.go (defmod /
// resmod) and KQM TCL.
//
// Note on the RES 75% boundary: gcsim's branch ordering skips the exact
// res == 0.75 case (a measure-zero fallthrough); the two adjacent formulas
// agree at 0.25 there, so the continuous form below is the correct one.

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * DEF damage multiplier. Equal character/enemy levels with no modifiers is
 * exactly 0.5 — the "hidden 50% tax". DEF reduction (shred) and DEF ignore
 * are separate knobs that multiply together on the enemy side.
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
 */
export function resMultiplier(res: number): number {
	if (res < 0) return 1 - res / 2;
	if (res < 0.75) return 1 - res;
	return 1 / (4 * res + 1);
}
