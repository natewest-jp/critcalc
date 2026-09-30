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

// ── Crit value ──────────────────────────────────────────────────────────────

// KQM crit value: CV = 2·CR + CD. Decimal units like the rest of this module —
// multiply by 100 for the conventional display number (e.g. 0.7/1.4 → 280 CV).
export const critValue = (critRate: number, critDamage: number) => 2 * critRate + critDamage;

// CR at a given CD along an equal-CV budget line (every build reachable at that
// total crit value). Used to draw the budget curve over the heatmap.
export const cvLineCR = (cv: number, critDamage: number) => (cv - critDamage) / 2;

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

// Multiplier values rendered as dashed contour lines on the heatmap and used
// for the "nearest contour" readout in the build panel.
export const ISOLINE_VALUES = [1.3, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5];

// The isoline value closest to the given multiplier, plus how far off it is.
export function nearestIsoline(multiplier: number): { value: number; delta: number } {
	let best = ISOLINE_VALUES[0];
	let delta = Math.abs(multiplier - best);

	for (const isoline of ISOLINE_VALUES) {
		const nextDelta = Math.abs(multiplier - isoline);
		if (nextDelta < delta) {
			best = isoline;
			delta = nextDelta;
		}
	}

	return { value: best, delta };
}

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

// CSS gradient mirroring the risk ramp, high risk → low risk (left → right on
// the hits/rotation slider: more hits = lower no-crit risk).
export const riskRampGradient = `linear-gradient(to right, ${[...RISK_STOPS]
	.reverse()
	.map((stop) => stop.color)
	.join(', ')})`;

// ── Chart geometry ──────────────────────────────────────────────────────────
// Canvas size and plot margins (pixels). PAD reserves room for tick labels.

export const SIZE = 720;
// PAD reserves room for tick labels (left/bottom) and, on the right, the
// isoline value column + its rotated AVERAGE DMG identity label.
// ↻ 2026-09-30 (⚓ Nate): the three axis titles sit a set gap past their tick
// labels — they used to hang off the box edge at 11 / 20 / 25px — and the plot
// took the room back. One gap PER AXIS, because one number does not read as one
// gap: CRIT RATE is measured from the widest tick ("100%", at the top), while
// the title sits beside two-digit ticks 7px narrower; and a text box carries
// empty room below the digits and above the capitals, which the eye adds to
// CRIT DMG's gap. 🎛️ Nate's values, by eye.
export const AXIS_TITLE_GAP = { cr: 4, cd: 6, avg: 8 };
export const PAD = {
	top: 24,
	right: 50 + AXIS_TITLE_GAP.avg,
	bottom: 42 + AXIS_TITLE_GAP.cd,
	left: 61 + AXIS_TITLE_GAP.cr
};

// The pixel box the plot is drawn into. Because the CR and CD axes are already
// normalized independently (unrelated ranges), the box need NOT be square — the
// heatmap fills whatever rectangle it's given and distorts no true geometry.
// `pad` stays fixed px so tick labels don't scale with the box.
export type PlotGeometry = { width: number; height: number; pad: typeof PAD };
export const DEFAULT_GEOMETRY: PlotGeometry = { width: SIZE, height: SIZE, pad: PAD };

export const plotWidth = (g: PlotGeometry = DEFAULT_GEOMETRY) => g.width - g.pad.left - g.pad.right;
export const plotHeight = (g: PlotGeometry = DEFAULT_GEOMETRY) =>
	g.height - g.pad.top - g.pad.bottom;

// Default-geometry plot dimensions (the square SIZE box — used by tests).
export const PLOT_WIDTH = plotWidth();
export const PLOT_HEIGHT = plotHeight();

// Stat value → pixel, within a given plot geometry (defaults to the square box).
export const cdToX = (critDamage: number, g: PlotGeometry = DEFAULT_GEOMETRY) =>
	g.pad.left + ((critDamage - CD_MIN) / (CD_MAX - CD_MIN)) * plotWidth(g);
export const crToY = (critRate: number, g: PlotGeometry = DEFAULT_GEOMETRY) =>
	g.pad.top + (1 - (critRate - CR_MIN) / (CR_MAX - CR_MIN)) * plotHeight(g);

// Pixel → stat value (pointer hit-testing).
export const xToCD = (x: number, g: PlotGeometry = DEFAULT_GEOMETRY) =>
	CD_MIN + ((x - g.pad.left) / plotWidth(g)) * (CD_MAX - CD_MIN);
export const yToCR = (y: number, g: PlotGeometry = DEFAULT_GEOMETRY) =>
	CR_MIN + (1 - (y - g.pad.top) / plotHeight(g)) * (CR_MAX - CR_MIN);
