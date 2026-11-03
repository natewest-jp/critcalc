import { toOklab, fromOklab, type RGB } from './critRamp';

// Pure calc + geometry for the Crit Visualizer. Single source of truth shared by
// +page.svelte (sliders/readouts) and CritHeatmap.svelte (canvas + SVG rendering).

// ── Axis bounds ─────────────────────────────────────────────────────────────

export const CR_MIN = 0.05;
export const CR_MAX = 1.0;
export const CD_MIN = 0.5;
export const CD_MAX = 3.0;

// ── Core math ───────────────────────────────────────────────────────────────

export const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

// Average damage multiplier: 1 + CR × CD. CR is clamped to [0, 1] and CD floored
// at 0 so out-of-range inputs can't produce nonsense values — this matters for
// canvas pixel math and keeps the page readout consistent with the chart.
export const averageDamageMultiplier = (critRate: number, critDamage: number) =>
	1 + clamp(critRate, 0, 1) * Math.max(0, critDamage);

// Probability that zero crits land across `hitsPerRotation` independent hits.
export const zeroCritProbability = (critRate: number, hitsPerRotation: number) =>
	Math.pow(1 - clamp(critRate, 0, 1), Math.max(1, Math.round(hitsPerRotation)));

// ── Display ─────────────────────────────────────────────────────────────────

/** A multiplier as the instruments write it: the × leads, two decimals. */
export const formatMultiplier = (multiplier: number) => `×${multiplier.toFixed(2)}`;

/**
 * A chance as a percentage. One decimal, except at the ends, where rounding
 * would state something false: a no-crit risk of 0.3⁸ is 0.007%, and "0.0%"
 * reads as "cannot happen".
 */
export function formatChance(probability: number): string {
	if (probability > 0 && probability < 0.0005) return '<0.1%';
	if (probability < 1 && probability > 0.9995) return '>99.9%';
	return `${(probability * 100).toFixed(1)}%`;
}

// ── Crit count distribution ─────────────────────────────────────────────────

/**
 * The chance that exactly k of `hits` crit, for every k from 0 to `hits` —
 * the binomial distribution, since every hit's crit is its own independent
 * roll. Index 0 is the no-crit risk; the whole array is what "Roll" samples
 * one point from. Built by the ratio between neighbours rather than by
 * factorials, which stays exact enough at the slider's 60 hits.
 */
export function critCountDistribution(critRate: number, hits: number): number[] {
	const n = Math.max(1, Math.round(hits));
	const p = clamp(critRate, 0, 1);
	const out = new Array<number>(n + 1).fill(0);
	if (p === 0) out[0] = 1;
	else if (p === 1) out[n] = 1;
	else {
		out[0] = Math.pow(1 - p, n);
		for (let k = 0; k < n; k++) out[k + 1] = (out[k] * (n - k) * p) / ((k + 1) * (1 - p));
	}
	return out;
}

/** The rotation's average multiplier when exactly `crits` of `hits` crit. */
export const rotationMultiplier = (crits: number, hits: number, critDamage: number) =>
	1 + (crits / Math.max(1, hits)) * Math.max(0, critDamage);

// ── Crit value ──────────────────────────────────────────────────────────────

// KQM crit value: CV = 2·CR + CD. Decimal units like the rest of this module —
// multiply by 100 for the conventional display number (e.g. 0.7/1.4 → 280 CV).
export const critValue = (critRate: number, critDamage: number) => 2 * critRate + critDamage;

// CR at a given CD along an equal-CV budget line (every build reachable at that
// total crit value). Used to draw the budget curve over the heatmap.
export const cvLineCR = (cv: number, critDamage: number) => (cv - critDamage) / 2;

/**
 * The best split of a crit-value budget: the point on the equal-CV line where
 * the average multiplier peaks. Unconstrained that is CR = CV/4, CD = CV/2
 * (CR·CD is maximised along 2·CR + CD = CV), but the game bounds both stats —
 * CRIT Rate past 100% is wasted and neither stat goes below its base — and
 * because the product is concave along the line, the bounded optimum is the
 * unconstrained one clamped to the line's reachable stretch. So a budget too
 * big for a 2:1 split puts CR at 100% and the rest into CD.
 */
export function bestSplit(cv: number): { critRate: number; critDamage: number } {
	const critRate = clamp(cv / 4, CR_MIN, Math.max(CR_MIN, Math.min(CR_MAX, (cv - CD_MIN) / 2)));
	return { critRate, critDamage: cv - 2 * critRate };
}

/**
 * One rotation of independent crit checks — the "Roll it" sampler. Each hit
 * is a coin flip at `critRate`; plain Math.random is all the randomness a
 * visualization needs (inject `rng` for deterministic tests).
 */
export function sampleRotation(
	critRate: number,
	hits: number,
	rng: () => number = Math.random
): boolean[] {
	return Array.from({ length: Math.max(0, Math.round(hits)) }, () => rng() < critRate);
}

// ── Isolines ────────────────────────────────────────────────────────────────

// Multiplier values rendered as dashed contour lines on the heatmap.
export const ISOLINE_VALUES = [1.3, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5];

// ── No-crit risk ramp ───────────────────────────────────────────────────────
// Chart palette — preserved verbatim per the redesign brief guardrails.
//
// ⚠ THIS RAMP IS THE PARENT OF --ui-*, NOT A COPY OF IT. The UI state family was
// taken FROM these four stops (⚓ Nate's pick), which is why they coincide; § Laws
// still says a UI state colour may not appear inside a visualization, so this
// stays a literal table rather than reaching for var(). The two are a PAIR that
// has to be re-synced by hand when either moves.
//
// ↻ 2026-08-12: re-synced, after the census found it had silently become two
// families. #4ecca3 was the pre-nudge positive; --ui-positive was pushed to
// #51c89a to escape the old anemo and this table never followed, so the chart
// and the tokens disagreed for months. The token has since moved again — same
// hue, Genshin's lightness, to clear --el-anemo-bar — and the ramp follows it
// this time. ✅ With #f6d365 promoted to --ui-provisional the same day, all four
// stops are now token values, which is the state this table was always assumed
// to be in.
export const RISK_STOPS: ReadonlyArray<{ readonly max: number; readonly color: string }> = [
	{ max: 0.05, color: '#5be0ac' }, // = --ui-positive
	{ max: 0.2, color: '#f6d365' }, // = --ui-provisional
	{ max: 0.5, color: '#f4a261' }, // = --ui-warning
	{ max: Infinity, color: '#e63946' } // = --ui-danger
];

export const zeroCritRiskColor = (probability: number) =>
	RISK_STOPS.find((stop) => probability < stop.max)!.color;

/**
 * The risk ramp as a CONTINUOUS colour, for the hits slider's track. The same
 * four colours as RISK_STOPS, each pinned to a risk inside its band and
 * blended in OKLab between them (an sRGB blend of green and orange goes
 * muddy). ⚓ Pure green holds through the low end, so a build that cannot miss
 * — CRIT Rate 100% — paints no yellow at all. 🎛️ The anchors are a look, not
 * a rule; the bands above stay the rule.
 */
const RISK_ANCHORS: ReadonlyArray<readonly [number, string]> = [
	[0.02, RISK_STOPS[0].color],
	[0.12, RISK_STOPS[1].color],
	[0.35, RISK_STOPS[2].color],
	[0.6, RISK_STOPS[3].color]
];

const hexToRgb = (hex: string): RGB => [
	parseInt(hex.slice(1, 3), 16),
	parseInt(hex.slice(3, 5), 16),
	parseInt(hex.slice(5, 7), 16)
];

export function riskColorSmooth(probability: number): string {
	const first = RISK_ANCHORS[0];
	const last = RISK_ANCHORS[RISK_ANCHORS.length - 1];
	if (probability <= first[0]) return first[1];
	if (probability >= last[0]) return last[1];
	const i = RISK_ANCHORS.findIndex(([at]) => at > probability);
	const [p0, c0] = RISK_ANCHORS[i - 1];
	const [p1, c1] = RISK_ANCHORS[i];
	const t = (probability - p0) / (p1 - p0);
	const a = toOklab(hexToRgb(c0));
	const b = toOklab(hexToRgb(c1));
	const [r, g, bl] = fromOklab(
		[0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t) as [number, number, number]
	);
	return `rgb(${r}, ${g}, ${bl})`;
}

/** The hit counts the hits-per-rotation slider spans. */
export const HITS_MIN = 1;
/** ↻ 60, was 40 (Nate 2026-11-03, a streamer's ask). */
export const HITS_MAX = 60;

/**
 * The hits-per-rotation slider's track: each hit count painted the risk colour
 * of a whole rotation landing zero crits AT THAT COUNT, for the build's own
 * CRIT Rate — so the track recolours as CRIT Rate moves.
 * ↻ 2026-10-02 (⚓ Nate): it was the four stops spread evenly over 1–40 hits,
 * which painted the default 8 hits orange at any CRIT Rate — at 70% that is a
 * 0.007% risk. One stop per hit, each from the continuous ramp, so CSS has
 * only near neighbours to blend.
 */
export function riskGradient(critRate: number, min = HITS_MIN, max = HITS_MAX): string {
	const stops: string[] = [];
	for (let hits = min; hits <= max; hits++) {
		const at = max === min ? 0 : ((hits - min) / (max - min)) * 100;
		stops.push(`${riskColorSmooth(zeroCritProbability(critRate, hits))} ${+at.toFixed(2)}%`);
	}
	return `linear-gradient(to right, ${stops.join(', ')})`;
}

// ── The field's axes (the stage, 2026-11-03) ────────────────────────────────
// CRIT DMG runs across, CRIT Rate up. ⚓ The CRIT Rate axis reaches down to 0%
// although no build can (CR_MIN, the base 5%), because the companion strip
// shares it: a rotation's crits as a share of its hits, and a rotation with no
// crit sits at 0% (Nate 2026-11-03). The field draws the unreachable 0–5% band
// veiled.

/** The bottom of the CRIT Rate axis. Builds stop at CR_MIN above it. */
export const CR_AXIS_MIN = 0;

/** The field's plot rectangle in the chart's pixels. The two axes are
 *  normalised separately (their ranges are unrelated), so any aspect is
 *  honest. */
export type FieldRect = { x0: number; y0: number; w: number; h: number };

export const cdToX = (critDamage: number, r: FieldRect) =>
	r.x0 + ((critDamage - CD_MIN) / (CD_MAX - CD_MIN)) * r.w;
export const crToY = (critRate: number, r: FieldRect) =>
	r.y0 + (1 - (critRate - CR_AXIS_MIN) / (CR_MAX - CR_AXIS_MIN)) * r.h;
export const xToCD = (x: number, r: FieldRect) => CD_MIN + ((x - r.x0) / r.w) * (CD_MAX - CD_MIN);
export const yToCR = (y: number, r: FieldRect) =>
	CR_AXIS_MIN + (1 - (y - r.y0) / r.h) * (CR_MAX - CR_AXIS_MIN);

/** The crit count whose row on the strip is nearest a CRIT Rate: the strip
 *  draws k crits of n hits at k / n on the shared axis. */
export const countAtRate = (rate: number, hits: number) => {
	const n = Math.max(1, Math.round(hits));
	return clamp(Math.round(rate * n), 0, n);
};
