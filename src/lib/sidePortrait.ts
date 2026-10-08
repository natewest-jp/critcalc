/**
 * THE SIDE PORTRAIT's geometry — the Stygian Onslaught presentation (lineups
 * design §9.5a): a plain ring on a dark disc, the side icon standing IN FRONT
 * of it, hair and ornaments rising over the ring's top.
 *
 * The side icons (`static/assets/characters/side/`, 128×128, alpha) are
 * left-facing profiles whose bottom reaches the image's bottom edge. Read off
 * the in-game screen against Xingqiu's icon (whose hair stays inside the ring,
 * so the head's extent pins the scale), the ring is ~95 of the art's 128px,
 * centred at (70, 81), and its bottom is tangent to the art's bottom.
 *
 * 🎛️ A first read for Nate to tune on /lab. ⛔ Never re-derive them by fitting
 * the icons' alpha: the bottoms are a mix of soft fades and flat cuts, and a
 * fit across the roster scatters by ±7px (tried 2026-10-08).
 */

/** Art box width ÷ disc diameter. */
export const SIDE_ART_PER_DISC = 128 / 95;
/** The disc's centre in the art's own coordinates, as fractions of its width. */
export const SIDE_DISC_CX = 70 / 128;
export const SIDE_DISC_CY = 81 / 128;
/** Clip the art to the disc below its centre line (the top always rises free). */
export const SIDE_CLIP_BELOW = true;

export type SideGeometry = {
	artPerDisc: number;
	cx: number;
	cy: number;
	clipBelow: boolean;
};

export const SIDE_GEOMETRY: SideGeometry = {
	artPerDisc: SIDE_ART_PER_DISC,
	cx: SIDE_DISC_CX,
	cy: SIDE_DISC_CY,
	clipBelow: SIDE_CLIP_BELOW
};

/** Where the art sits for a disc of diameter `d`, in px relative to the disc's
 *  top-left, and how far it rises above the disc (what a host must reserve). */
export function sideLayout(d: number, g: SideGeometry = SIDE_GEOMETRY) {
	const art = d * g.artPerDisc;
	const left = d / 2 - g.cx * art;
	const top = d / 2 - g.cy * art;
	return { art, left, top, overhang: Math.max(0, -top) };
}
