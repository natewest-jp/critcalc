/**
 * THE STAR VEIL (2026-10-18, ⚓ Nate) — how strongly the stars show behind a
 * tool, as a function of where they sit relative to the tool's CONTENT.
 *
 *   inside the content (less STAR_VEIL_INSET) → STAR_VEIL_FLOOR (almost gone, but there)
 *   out across each side's MARGIN              → a smootherstep ramp
 *   at the edge of the screen (or the PNG)     → STAR_VEIL_CEILING (a little brighter than before)
 *
 * ↻ 2026-10-18, the same day (⚓ Nate, "shape C"): the feather was a fixed
 * 320px and NO side of the Planner has that much room (measured at 1728×997:
 * top 149, left 258, right 32, bottom 24), so every star in the margins sat at
 * 0.12–0.3 and the stars vanished. The ramp is now NORMALISED per side: it
 * runs from the floor's edge to the screen's edge, however wide that margin
 * is, so the slope always fills the chrome, the bands, the bench and the foot.
 * The INSET starts it a little inside the content so the thin right and
 * bottom margins still get a slope.
 *
 * The floor protects ONLY the content: the feather is meant to run under the
 * site chrome, the bands, the sides and the foot of the page. With several
 * boxes the strength is the NEAREST content's (the minimum distance), so two
 * boxes side by side read as one region with one soft edge around it.
 *
 * ONE formula, TWO readers (sceneDim.ts's precedent):
 *   - the PNG export (`exportScene.ts`) calls `starVeil()` once per star, with
 *     its keep-out rects as the boxes;
 *   - the live star pass (`starPass.ts`) runs `STAR_VEIL_GLSL` in its vertex
 *     shader, per star centre, with the tool surface's boxes in viewport px
 *     (published by the tools layout through `sceneGL.setStarVeil`).
 * Both multiply the star's ALPHA, before the dim — the stars stay locked to the
 * plate (sceneDim.ts: dimming them separately reads as dirt). ⛔ Never move the
 * veil after the dim, and ⛔ never change the TS without the GLSL (the mirror
 * test, `starVeil.test.ts`, holds the two to the same constants).
 *
 * Strengths are RELATIVE to each reader's own star alpha before the veil: on
 * screen, the alpha a tool route drew every star at until today (1×); in the
 * PNG, `STAR_STATIC_ALPHA × base` — the export's old edge strength. So a
 * CEILING of 1.2 is "a little higher than either used to be at its brightest".
 * ⚠ Above 1 the shader's output clamps per pixel: a star's saturated core
 * cannot get brighter, so the gain shows in its halo and its fainter members.
 *
 * Runtime-import-free on purpose: vitest evaluates it directly.
 */

/** A content box, in CSS px of the reader's own space (viewport px live,
 *  export px in the PNG). */
export type VeilBox = { x: number; y: number; w: number; h: number };

/** 🎛️ Star strength INSIDE the content — Nate's to tune. ⚠ The dim SQUARES
 *  the scene (sceneDim.ts), so what you SEE goes as the strength squared:
 *  0.12 showed a star at ~1.4% and read as none at all; 0.3 is ~9%. ↻ 0.12 →
 *  0.3 (⚓ Nate, 2026-10-18: "I can't see any stars with the current floor"),
 *  ↻ 0.3 → 0.33 the same day ("bump up the floor a tiny bit").
 *  ↻ tune(nate) 2026-10-18: 0.5, set by eye with __scene.veil(). */
export const STAR_VEIL_FLOOR = 0.5;

/** 🎛️ Star strength beyond the feather — Nate's to tune (start 1.2: "a little
 *  higher than the export's current edge strength").
 *  ↻ tune(nate) 2026-10-18: 0.9, set by eye with __scene.veil(). */
export const STAR_VEIL_CEILING = 0.9;

/** 🎛️ How much of each side's margin the ramp spans before it reaches the
 *  ceiling, as a fraction — Nate's to tune. 1 = the ceiling lands exactly at
 *  the screen's edge (the longest slope the margin allows); below 1 it arrives
 *  earlier and holds. */
export const STAR_VEIL_FEATHER = 1;

/** 🎛️ How far INSIDE each box's edge the floor stops and the ramp begins,
 *  CSS px — Nate's to tune (⚓ "the small inset", start 40). It is what gives
 *  the Planner's 24–32px right and bottom margins a slope at all. ↻ 40 → 80
 *  (⚓ Nate, 2026-10-18: "lengthen the inset further").
 *  ↻ tune(nate) 2026-10-18: 90, set by eye with __scene.veil(). */
export const STAR_VEIL_INSET = 90;

/**
 * 🎛️ THE PHONE RULE — Nate's to tune. Below this breakpoint (a key of
 * $lib/breakpoints.ts BP) the feather runs only TOP and BOTTOM: horizontal
 * distance is ignored, so the sides stay at the floor.
 * ⚓ `toolMin`, not `compact`: toolMin is where a tool stops having side room
 * at all — the bench ribbon turns into a row and the aside into a drawer, so
 * the surface spans the screen edge to edge and its only margins are the
 * tool's 16px pads. `compact` only folds band WORDS; between the two the
 * surface is already full-width, so sides would feather over 16px of gutter.
 */
export const STAR_VEIL_SIDES_BELOW = 'toolMin' as const;

/**
 * The knobs as READ — by `starVeil()` below and by the shader's `u_veilK`
 * uniform — seeded from the named constants above, which stay the source of
 * truth for what ships. ⚓ Mutable so Nate can tune live from the console:
 * `window.__scene.veil({ floor: 0.35, inset: 100 })` sets any of them and
 * redraws; `window.__scene.veil()` prints the current set. A value he picks
 * lands back in the constants above (as `tune(nate)`) — nothing persists it.
 */
export const veilKnobs = {
	floor: STAR_VEIL_FLOOR,
	ceiling: STAR_VEIL_CEILING,
	feather: STAR_VEIL_FEATHER,
	inset: STAR_VEIL_INSET
};

export type StarVeilOpts = {
	/** Does horizontal distance count? false = the phone rule (top/bottom only). */
	sides: boolean;
	/** The space the margins run to, in the same px as the boxes — the
	 *  viewport live, the canvas in the PNG. */
	view: { w: number; h: number };
};

/** How far out across ONE side's margin a coordinate sits, 0 at the floor's
 *  edge to 1 at the view's edge (scaled by STAR_VEIL_FEATHER). */
function across(p: number, lo: number, hi: number, extent: number): number {
	if (p < lo) return (lo - p) / (Math.max(lo, 1) * veilKnobs.feather);
	if (p > hi) return (p - hi) / (Math.max(extent - hi, 1) * veilKnobs.feather);
	return 0;
}

/** Smootherstep — the site's eased roll-off shape (6t⁵ − 15t⁴ + 10t³). */
export function smootherstep(t: number): number {
	const u = t < 0 ? 0 : t > 1 ? 1 : t;
	return u * u * u * (u * (u * 6 - 15) + 10);
}

/**
 * How much of a star survives at (x, y): STAR_VEIL_FLOOR inside the nearest
 * box (less the inset), rising across each side's margin to STAR_VEIL_CEILING
 * at the view's edge. A corner combines its two sides as a vector length, so
 * it rounds rather than mitres. No boxes = no veil (1, the star exactly as it
 * was — the landing's case).
 * ⛔ The shader twin is STAR_VEIL_GLSL below; change both or neither.
 */
export function starVeil(
	x: number,
	y: number,
	boxes: readonly VeilBox[],
	opts: StarVeilOpts
): number {
	if (boxes.length === 0) return 1;
	const ax = opts.sides ? 1 : 0;
	let d = Infinity;
	for (const b of boxes) {
		const tx = across(x, b.x + veilKnobs.inset, b.x + b.w - veilKnobs.inset, opts.view.w) * ax;
		const ty = across(y, b.y + veilKnobs.inset, b.y + b.h - veilKnobs.inset, opts.view.h);
		d = Math.min(d, Math.hypot(tx, ty));
	}
	const t = smootherstep(d);
	return veilKnobs.floor + (veilKnobs.ceiling - veilKnobs.floor) * t;
}

/** How many boxes one veil set carries into the shader (a uniform array). The
 *  planner publishes two (main + aside), every other tool one. */
export const STAR_VEIL_MAX_BOXES = 4;

/** A number as a GLSL float literal (`320` → `320.0`). */
export function glslFloat(n: number): string {
	return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

/**
 * The shader half: `starVeil()` in GLSL ES 1.0, for the star pass's vertex
 * shader. `starVeilSet(boxes, n, axes, p)` takes one set of up to
 * STAR_VEIL_MAX_BOXES boxes (`vec4(x, y, w, h)`), how many are live,
 * `axes` = vec2(sides ? 1 : 0, 1) and `view` = the viewport's CSS size. Same
 * constants, interpolated from above.
 */
export const STAR_VEIL_GLSL = `
uniform vec4 u_veilK; // veilKnobs: floor, ceiling, feather, inset
#define STAR_VEIL_FLOOR u_veilK.x
#define STAR_VEIL_CEILING u_veilK.y
#define STAR_VEIL_FEATHER u_veilK.z
#define STAR_VEIL_INSET u_veilK.w

float starVeilSmoother(float t) {
	float u = clamp(t, 0.0, 1.0);
	return u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
}

float starVeilSet(vec4 boxes[${STAR_VEIL_MAX_BOXES}], float n, vec2 axes, vec2 view, vec2 p) {
	if (n < 0.5) return 1.0;
	float d = 1e9;
	for (int i = 0; i < ${STAR_VEIL_MAX_BOXES}; i++) {
		if (float(i) < n) {
			vec4 b = boxes[i];
			vec2 lo = b.xy + STAR_VEIL_INSET;
			vec2 hi = b.xy + b.zw - STAR_VEIL_INSET;
			vec2 below = max(lo - p, 0.0) / (max(lo, 1.0) * STAR_VEIL_FEATHER);
			vec2 above = max(p - hi, 0.0) / (max(view - hi, 1.0) * STAR_VEIL_FEATHER);
			d = min(d, length((below + above) * axes));
		}
	}
	float t = starVeilSmoother(d);
	return STAR_VEIL_FLOOR + (STAR_VEIL_CEILING - STAR_VEIL_FLOOR) * t;
}
`;
