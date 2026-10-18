/**
 * THE STAR VEIL (2026-10-18, ⚓ Nate) — how strongly the stars show behind a
 * tool, as a function of where they sit relative to the tool's CONTENT.
 *
 *   inside the content            → STAR_VEIL_FLOOR   (almost gone, but there)
 *   out from its edge, over        → a smootherstep ramp, STAR_VEIL_FEATHER px long
 *   beyond the feather             → STAR_VEIL_CEILING (a little brighter than before)
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

/** 🎛️ Star strength INSIDE the content — Nate's to tune (start 0.12; his
 *  brief: ~0.10–0.15, "almost invisible, but present"). */
export const STAR_VEIL_FLOOR = 0.12;

/** 🎛️ Star strength beyond the feather — Nate's to tune (start 1.2: "a little
 *  higher than the export's current edge strength"). */
export const STAR_VEIL_CEILING = 1.2;

/** 🎛️ The feather's length, CSS px from the content's (inset) edge to the
 *  ceiling — Nate's to tune (brief: long and gradual, ~280–360). */
export const STAR_VEIL_FEATHER = 320;

/** 🎛️ How far INSIDE each box's edge the floor stops and the feather begins,
 *  CSS px — Nate's to tune. 0 = the floor is exactly the content. (The PNG's
 *  old keep-out used 56, so its clear box sat under the content's edges; the
 *  veil starts at the edge, per the brief, and leaves this for his eye.) */
export const STAR_VEIL_INSET = 0;

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

export type StarVeilOpts = {
	/** Does horizontal distance count? false = the phone rule (top/bottom only). */
	sides: boolean;
};

/** Smootherstep — the site's eased roll-off shape (6t⁵ − 15t⁴ + 10t³). */
export function smootherstep(t: number): number {
	const u = t < 0 ? 0 : t > 1 ? 1 : t;
	return u * u * u * (u * (u * 6 - 15) + 10);
}

/**
 * How much of a star survives at (x, y): STAR_VEIL_FLOOR inside the nearest
 * box, rising over STAR_VEIL_FEATHER to STAR_VEIL_CEILING. No boxes = no veil
 * (1, the star exactly as it was — the landing's case).
 * ⛔ The shader twin is STAR_VEIL_GLSL below; change both or neither.
 */
export function starVeil(
	x: number,
	y: number,
	boxes: readonly VeilBox[],
	opts: StarVeilOpts = { sides: true }
): number {
	if (boxes.length === 0) return 1;
	const ax = opts.sides ? 1 : 0;
	let d = Infinity;
	for (const b of boxes) {
		const x0 = b.x + STAR_VEIL_INSET;
		const y0 = b.y + STAR_VEIL_INSET;
		const x1 = b.x + b.w - STAR_VEIL_INSET;
		const y1 = b.y + b.h - STAR_VEIL_INSET;
		const dx = Math.max(x0 - x, x - x1, 0) * ax;
		const dy = Math.max(y0 - y, y - y1, 0);
		d = Math.min(d, Math.hypot(dx, dy));
	}
	const t = smootherstep(d / STAR_VEIL_FEATHER);
	return STAR_VEIL_FLOOR + (STAR_VEIL_CEILING - STAR_VEIL_FLOOR) * t;
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
 * STAR_VEIL_MAX_BOXES boxes (`vec4(x, y, w, h)`), how many are live, and
 * `axes` = vec2(sides ? 1 : 0, 1). Same constants, interpolated from above.
 */
export const STAR_VEIL_GLSL = `
const float STAR_VEIL_FLOOR = ${glslFloat(STAR_VEIL_FLOOR)};
const float STAR_VEIL_CEILING = ${glslFloat(STAR_VEIL_CEILING)};
const float STAR_VEIL_FEATHER = ${glslFloat(STAR_VEIL_FEATHER)};
const float STAR_VEIL_INSET = ${glslFloat(STAR_VEIL_INSET)};

float starVeilSmoother(float t) {
	float u = clamp(t, 0.0, 1.0);
	return u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
}

float starVeilSet(vec4 boxes[${STAR_VEIL_MAX_BOXES}], float n, vec2 axes, vec2 p) {
	if (n < 0.5) return 1.0;
	float d = 1e9;
	for (int i = 0; i < ${STAR_VEIL_MAX_BOXES}; i++) {
		if (float(i) < n) {
			vec4 b = boxes[i];
			vec2 lo = b.xy + STAR_VEIL_INSET;
			vec2 hi = b.xy + b.zw - STAR_VEIL_INSET;
			vec2 q = max(max(lo - p, p - hi), 0.0) * axes;
			d = min(d, length(q));
		}
	}
	float t = starVeilSmoother(d / STAR_VEIL_FEATHER);
	return STAR_VEIL_FLOOR + (STAR_VEIL_CEILING - STAR_VEIL_FLOOR) * t;
}
`;
