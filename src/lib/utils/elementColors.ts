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
export const elementColors = {
	pyro: { main: '#e2543e', border: 'rgba(226, 84, 62, 0.5)', hi: '#f0aa9f' },
	// ↻ 2026-08-01 lightness-structure: hydro dropped from L.632 (where it sat
	// EXACTLY on pyro's lightness — the two most common elements were identical
	// in grayscale) to L.58. Knob: Nate may prefer the deeper #0f74c8 (L.55,
	// ΔL .08 vs pyro) — that cut puts --ink below 4:1 on the main, so pair it
	// with white badge ink if chosen.
	hydro: { main: '#0b7cd7', border: 'rgba(11, 124, 215, 0.5)', hi: '#85beeb' },
	anemo: { main: '#4ecbb4', border: 'rgba(78, 203, 180, 0.5)', hi: '#a7e5da' },
	electro: { main: '#c070f0', border: 'rgba(192, 112, 240, 0.5)', hi: '#e0b8f8' },
	cryo: { main: '#97d4e6', border: 'rgba(151, 212, 230, 0.5)', hi: '#cbeaf3' },
	geo: { main: '#e7b236', border: 'rgba(231, 178, 54, 0.5)', hi: '#f3d99b' },
	dendro: { main: '#80c840', border: 'rgba(128, 200, 64, 0.5)', hi: '#c0e4a0' },
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

// The cast-pill / summon fill: a solid element tone with the whisper of a
// top-light so the bar has depth without a hard highlight. Shared by the
// planner's E/Q pills and the Team Builder's Compare bars so both finishes
// match exactly.
//
// ⚠ HISTORY (2026-07-18): a hue-wave version (tiling ±18° hue-rotated wave
// layers) was reverted — real Safari rendered a zoom-dependent 1px bottom gap
// on the tiled multi-layer fills that survived every structural fix and never
// reproduced in headless WebKit. Consistent cross-browser display won over the
// subtle wave. Don't reintroduce tiled background layers on these bars without
// a real-Safari pass.
export function castFill(main: string): string {
	return `linear-gradient(180deg, color-mix(in srgb, ${main} 90%, white) 0%, ${main} 58%)`;
}
