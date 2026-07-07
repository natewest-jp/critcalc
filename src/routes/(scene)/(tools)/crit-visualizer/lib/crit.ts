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
export const PLOT_WIDTH = SIZE - PAD.left - PAD.right;
export const PLOT_HEIGHT = SIZE - PAD.top - PAD.bottom;

// Stat value → canvas pixel
export const cdToX = (critDamage: number) =>
	PAD.left + ((critDamage - CD_MIN) / (CD_MAX - CD_MIN)) * PLOT_WIDTH;
export const crToY = (critRate: number) =>
	PAD.top + (1 - (critRate - CR_MIN) / (CR_MAX - CR_MIN)) * PLOT_HEIGHT;

// Canvas pixel → stat value (used for pointer hit-testing)
export const xToCD = (x: number) => CD_MIN + ((x - PAD.left) / PLOT_WIDTH) * (CD_MAX - CD_MIN);
export const yToCR = (y: number) => CR_MIN + (1 - (y - PAD.top) / PLOT_HEIGHT) * (CR_MAX - CR_MIN);
