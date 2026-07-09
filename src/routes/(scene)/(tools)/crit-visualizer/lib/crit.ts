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

export const RISK_STOPS: ReadonlyArray<{ readonly max: number; readonly color: string }> = [
	{ max: 0.05, color: '#4ecca3' },
	{ max: 0.2, color: '#f6d365' },
	{ max: 0.5, color: '#f4a261' },
	{ max: Infinity, color: '#e63946' }
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
// PAD reserves room for tick labels (left/bottom) and isoline value labels (right)
export const PAD = { top: 24, right: 60, bottom: 64, left: 72 };

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
