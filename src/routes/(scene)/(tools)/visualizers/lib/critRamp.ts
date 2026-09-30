// The crit heatmap's colour ramp — the curve BETWEEN its stops (2026-09-30).
//
// ⚓ WHY A CURVE, AND WHY OKLAB. The ramp used to blend stop to stop in a
// straight line through sRGB. With eight close stops the colour SPACE barely
// mattered — every segment's sRGB midpoint lands within .01 of OKLab's in both
// lightness and chroma — but a straight line per segment changes slope at each
// stop, and the eye reads each slope change as a crease (a Mach band); worst at
// 2.71x, where lightness peaks and turns back down. A cubic B-spline over the
// stops in OKLab is continuous in slope AND curvature, so the creases go
// (largest lightness-slope jump 1.59e-3 → 0.02e-3 per 1/1000 of the ramp), and
// OKLab is what makes an even step in the curve an even step to the eye.
// ⚠ A B-spline APPROXIMATES its stops rather than passing through them, so each
// vivid stop is pulled toward its neighbours (mean chroma .145 → .136) — which
// RAMP_CHROMA_GAIN hands back (→ .146). The end stops are kept: each end gets a
// REFLECTED phantom point (2·P0 − P1), which keeps the ramp moving at its ends —
// tripling the end stop instead flattens them into a long band of one colour.
// ⚓ Nate picked this on the live chart over four rivals, 2026-09-30. ⛔ Tried
// and rejected: a monotone cubic (flat spots where a channel peaks — emerald and
// yellow bands); Catmull-Rom and a B-spline solved to pass THROUGH the stops
// (both keep the green stop's chroma spike, which a smooth curve can only show
// as an emerald band); splining in OKLCH (runs into the sRGB gamut edge and
// clips into new bands, and turns the teal cyan).

export type RGB = readonly [number, number, number];
type Lab = [number, number, number];

const toLinear = (c: number) => {
	const x = c / 255;
	return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const toByte = (x: number) => {
	const c = Math.min(1, Math.max(0, x));
	return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
};

/** sRGB bytes → OKLab (Björn Ottosson's matrices). */
export function toOklab([r8, g8, b8]: RGB): Lab {
	const r = toLinear(r8);
	const g = toLinear(g8);
	const b = toLinear(b8);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
	];
}

/** OKLab → sRGB bytes, clamped into gamut per channel. */
export function fromOklab([L, a, b]: Lab): [number, number, number] {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		toByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		toByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		toByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
	];
}

/** Chroma handed back after the spline's averaging (a and b scaled; L untouched).
 *  🎛️ Nate's pick. It grazes the gamut edge at the yellows (worst channel .006
 *  over), which fromOklab's clamp absorbs. */
export const RAMP_CHROMA_GAIN = 1.08;

/** The ramp at `t` ∈ [0, 1]: a uniform cubic B-spline over the stops in OKLab,
 *  its chroma scaled by RAMP_CHROMA_GAIN. */
export function rampAt(stops: readonly RGB[], t: number): [number, number, number] {
	const [L, a, b] = bsplineLab(stops.map(toOklab), t);
	return fromOklab([L, a * RAMP_CHROMA_GAIN, b * RAMP_CHROMA_GAIN]);
}

function bsplineLab(lab: readonly Lab[], t: number): Lab {
	const n = lab.length;
	const reflect = (p: Lab, q: Lab): Lab => [2 * p[0] - q[0], 2 * p[1] - q[1], 2 * p[2] - q[2]];
	const ctrl = [reflect(lab[0], lab[1]), ...lab, reflect(lab[n - 1], lab[n - 2])];
	const segs = ctrl.length - 3;
	const x = Math.min(1, Math.max(0, t)) * segs;
	const i = Math.min(Math.floor(x), segs - 1);
	const f = x - i;
	const w = [
		(1 - f) ** 3 / 6,
		(3 * f ** 3 - 6 * f ** 2 + 4) / 6,
		(-3 * f ** 3 + 3 * f ** 2 + 3 * f + 1) / 6,
		f ** 3 / 6
	];
	const out: Lab = [0, 0, 0];
	for (let k = 0; k < 3; k++) {
		for (let j = 0; j < 4; j++) out[k] += w[j] * ctrl[i + j][k];
	}
	return out;
}

/** Resolution of the lookup table — well past 8-bit steps across the ramp. */
export const RAMP_LUT_SIZE = 1024;

/** Precompute the ramp once: RGB triplets, `RAMP_LUT_SIZE` entries. The canvas
 *  asks per PIXEL, so the spline is never evaluated in the draw loop. */
export function buildRampLut(stops: readonly RGB[]): Uint8ClampedArray {
	const lut = new Uint8ClampedArray(RAMP_LUT_SIZE * 3);
	for (let i = 0; i < RAMP_LUT_SIZE; i++) {
		lut.set(rampAt(stops, i / (RAMP_LUT_SIZE - 1)), i * 3);
	}
	return lut;
}
