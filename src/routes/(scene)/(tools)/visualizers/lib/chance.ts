// How the odds instruments print a chance (Wish Odds now; Artifact Odds to
// follow). Precise enough to tell small chances apart, since players care
// about the exact figure even when it is tiny:
//   - in the middle, one decimal: 63.5%
//   - under 1%, three significant figures: 0.0423%
//   - over 99%, enough decimals to show what is left: 99.958%, 99.9958%
//   - never a certainty the model doesn't have, nor a zero it doesn't either:
//     beyond FLOOR the ends print as "<0.0001%" and ">99.9999%".
// Exactly 0 and exactly 1 print as 0% and 100%; a caller that knows a chance
// is certain (a goal past its worst case) passes 1.

/** The smallest share of a percent printed; beyond it the ends say < or >. */
const FLOOR = 1e-4;
/** Digits after the point at most (FLOOR's). */
const MAX_DECIMALS = 4;

const fmt = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', opts);
const MIDDLE = fmt({ minimumFractionDigits: 1, maximumFractionDigits: 1 });
const SMALL = fmt({ maximumSignificantDigits: 3 });
const EDGE = fmt({ maximumFractionDigits: MAX_DECIMALS });

export function formatChance(p: number): string {
	if (!(p > 0)) return '0%';
	if (p >= 1) return '100%';
	const pct = p * 100;
	const left = 100 - pct;
	if (pct < FLOOR) return `<${EDGE.format(FLOOR)}%`;
	if (left < FLOOR) return `>${EDGE.format(100 - FLOOR)}%`;
	if (pct < 1) return `${SMALL.format(pct)}%`;
	if (left < 1) {
		// as many decimals as it takes to show two figures of what is left
		const decimals = Math.min(MAX_DECIMALS, Math.max(1, Math.ceil(-Math.log10(left)) + 1));
		const s = fmt({ minimumFractionDigits: 1, maximumFractionDigits: decimals }).format(pct);
		// rounding up to 100 would print a certainty: keep the last digit short of it
		return Number(s) >= 100 ? `>${EDGE.format(100 - FLOOR)}%` : `${s}%`;
	}
	return `${MIDDLE.format(pct)}%`;
}
