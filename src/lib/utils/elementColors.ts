// Static mirror of the element palette declared in src/app.css (`--el-*-*`).
// Use the CSS variables in stylesheets; reach for this mirror only when styles
// are constructed at runtime. Values must stay in lockstep with app.css.

export type ElementSlot = 'main' | 'border' | 'hi';

export type ElementPalette = {
	main: string;
	border: string;
	hi: string;
};

export type ElementKey =
	| 'pyro'
	| 'hydro'
	| 'anemo'
	| 'electro'
	| 'cryo'
	| 'geo'
	| 'dendro'
	| 'physical'
	| 'none';

// `none` and `physical` only have `main` — their `border` / `hi` slots are
// intentionally absent. Physical uses the muted gray palette of `none` because
// no character is canonically Physical-aligned (it's used for damage instances
// and RES debuffs, not character UI), and the bar needs a recognizable but
// understated tone.
// ⚠ GENSHIN'S OWN TWO TABLES, TRANSCRIBED — not tuned values, and not to be
// re-tuned as a set. `main` is their icon palette (measured off the flat-colour
// source art); `hi` is their in-text `<color=#rrggbbff>` palette, which is that
// same set carried up to a lightness floor. The full argument, including why
// there is no third light-context rung, lives at --el-* in app.css. Change one
// file and the mirror test fails; that is the point.
export const elementColors = {
	pyro: { main: '#ff6640', border: 'rgba(255, 102, 64, 0.5)', hi: '#ff9999' },
	hydro: { main: '#00c0ff', border: 'rgba(0, 192, 255, 0.5)', hi: '#80c0ff' },
	anemo: { main: '#33d7a0', border: 'rgba(51, 215, 160, 0.5)', hi: '#80ffd7' },
	electro: { main: '#cc80ff', border: 'rgba(204, 128, 255, 0.5)', hi: '#ffacff' },
	cryo: { main: '#7af2f2', border: 'rgba(122, 242, 242, 0.5)', hi: '#99ffff' },
	geo: { main: '#ffb00d', border: 'rgba(255, 176, 13, 0.5)', hi: '#ffe699' },
	dendro: { main: '#9be53d', border: 'rgba(155, 229, 61, 0.5)', hi: '#99ff88' },
	physical: { main: '#9ea4b3' },
	none: { main: '#6a7080' }
} as const;

/** Hue-rotate a #rrggbb color by `deg`, nudge lightness by `dl` points, and
 *  return it at `alpha` — as comma-syntax hsla() (canvas-safe). Powers the
 *  cast-pill wave layers: hue-direction variation that color-mix can't do. */
export function shiftHue(hex: string, deg: number, dl: number, alpha: number): string {
	const n = parseInt(hex.slice(1), 16);
	const r = ((n >> 16) & 255) / 255;
	const g = ((n >> 8) & 255) / 255;
	const b = (n & 255) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	let h = 0;
	let s = 0;
	if (d !== 0) {
		s = d / (1 - Math.abs(2 * l - 1));
		if (max === r) h = 60 * (((g - b) / d + 6) % 6);
		else if (max === g) h = 60 * ((b - r) / d + 2);
		else h = 60 * ((r - g) / d + 4);
	}
	const hh = Math.round((h + deg + 360) % 360);
	const ss = Math.round(s * 100);
	const ll = Math.max(0, Math.min(100, Math.round(l * 100) + dl));
	return `hsla(${hh}, ${ss}%, ${ll}%, ${alpha})`;
}

/** Scale a #rrggbb color's saturation to `keepPct` % of itself, returned as
 *  #rrggbb (hex in, hex out — consumable by CSS color-mix AND the exporter's
 *  own hex-only mix()). The ghost CD tracks' chroma drop
 *  (barMix.GHOST_CHROMA_KEEP) — same HSL derivation as shiftHue so the two
 *  stay consistent. */
export function desaturate(hex: string, keepPct: number): string {
	const n = parseInt(hex.slice(1), 16);
	const r = ((n >> 16) & 255) / 255;
	const g = ((n >> 8) & 255) / 255;
	const b = (n & 255) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	let h = 0;
	let s = 0;
	if (d !== 0) {
		s = d / (1 - Math.abs(2 * l - 1));
		if (max === r) h = 60 * (((g - b) / d + 6) % 6);
		else if (max === g) h = 60 * ((b - r) / d + 2);
		else h = 60 * ((r - g) / d + 4);
	}
	const ss = s * (keepPct / 100);
	// HSL → RGB (standard formulation)
	const c = (1 - Math.abs(2 * l - 1)) * ss;
	const hp = h / 60;
	const xx = c * (1 - Math.abs((hp % 2) - 1));
	const m = l - c / 2;
	let rgb: [number, number, number];
	if (hp < 1) rgb = [c, xx, 0];
	else if (hp < 2) rgb = [xx, c, 0];
	else if (hp < 3) rgb = [0, c, xx];
	else if (hp < 4) rgb = [0, xx, c];
	else if (hp < 5) rgb = [xx, 0, c];
	else rgb = [c, 0, xx];
	const to = (v: number) =>
		Math.round((v + m) * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`;
}

export function elementPalette(element: string | undefined): ElementPalette {
	const key = (element ?? 'none') as ElementKey;
	const entry = elementColors[key] ?? elementColors.none;
	// Fall back to `none.main` for the missing slots so callers built around
	// the three-slot shape (RotationTimeline) keep working when an element key
	// isn't recognized — visually indistinguishable from the prior local palette.
	return {
		main: entry.main,
		border: 'border' in entry ? entry.border : elementColors.none.main,
		hi: 'hi' in entry ? entry.hi : elementColors.none.main
	};
}

// The cast-pill / summon fill. Shared by the planner's E/Q pills and the Team
// Builder's Compare bars so both finishes match exactly.
//
// ↻ ⚓ NATE 2026-08-11 — IT IS FLAT NOW. It used to carry a whisper of top-light
// (`linear-gradient(180deg, main+10% white 0%, main 58%)`) so the bar had depth
// without a hard highlight. Depth was the right instinct against a raised frame
// on an opaque chart ground; the planner's timeline renders straight onto the
// night scene since 2026-08-11, and there a lit bar reads as a leftover from a
// surface that is no longer under it. Nate's word for the direction was
// "flattening colors (taking away highlight gradients)".
//
// ⚠ THIS FUNCTION IS A TEAM BUILDER DEPENDENCY TOO (CompareBar). The flattening
// deliberately takes both — the whole point of the shared helper is that the
// two finishes cannot drift, and a lit Compare bar beside a flat planner bar is
// exactly the drift it exists to prevent.
//
// ⚠ HISTORY (2026-07-18): a hue-wave version (tiling ±18° hue-rotated wave
// layers) was reverted — real Safari rendered a zoom-dependent 1px bottom gap
// on the tiled multi-layer fills that survived every structural fix and never
// reproduced in headless WebKit. Consistent cross-browser display won over the
// subtle wave. Don't reintroduce tiled background layers on these bars without
// a real-Safari pass. Flat has no such hazard: it is one colour.
export function castFill(main: string): string {
	return main;
}
