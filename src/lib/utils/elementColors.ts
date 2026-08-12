// Static mirror of the element palette declared in src/app.css (`--el-*-*`).
// Use the CSS variables in stylesheets; reach for this mirror only when styles
// are constructed at runtime. Values must stay in lockstep with app.css.

export type ElementSlot = 'main' | 'bar' | 'border' | 'hi';

export type ElementPalette = {
	main: string;
	/** The FILL rung — a bar with white written on it. Derived from `main`;
	 *  see the --el-* block in app.css for the anchor and the two knobs. */
	bar: string;
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

// `none` and `physical` only have `main` — their `bar` / `border` / `hi` slots
// are intentionally absent. Physical uses the muted gray palette of `none`
// because no character is canonically Physical-aligned (it's used for damage
// instances and RES debuffs, not character UI), and the bar needs a
// recognizable but understated tone.
// ⚠ AND `bar` IS ABSENT FOR A SECOND, STRONGER REASON on those two: they are
// near-neutrals. The rung's derivation spends freed gamut on CHROMA, which on a
// gray means inventing a hue it does not have — and both already sit BELOW the
// balanced luminance the rung walks toward, so the lightness half would be a
// no-op anyway. elementPalette() falls their `bar` back to their own `main`,
// not to none's, so a physical bar stays physical gray.
// ⚠ TWO OF THESE SLOTS ARE TRANSCRIBED AND TWO ARE DERIVED. `main` is Genshin's
// icon palette (measured off the flat-colour source art) and `hi` is their
// in-text `<color=#rrggbbff>` palette — copied tables, NOT to be re-tuned as a
// set. `bar` (a fill with white on it) and `border` are functions of `main`.
// The full argument, including why there is no light-context rung and why the
// bar rung is not the rejected divergence, lives at --el-* in app.css. Change
// one file and the mirror test fails; that is the point.
export const elementColors = {
	pyro: { main: '#ff6640', bar: '#ff653e', border: 'rgba(255, 102, 64, 0.5)', hi: '#ff9999' },
	hydro: { main: '#00c0ff', bar: '#00b7f4', border: 'rgba(0, 192, 255, 0.5)', hi: '#80c0ff' },
	anemo: { main: '#33d7a0', bar: '#1ecb95', border: 'rgba(51, 215, 160, 0.5)', hi: '#80ffd7' },
	electro: { main: '#cc80ff', bar: '#ca7aff', border: 'rgba(204, 128, 255, 0.5)', hi: '#ffacff' },
	cryo: { main: '#7af2f2', bar: '#50e1e2', border: 'rgba(122, 242, 242, 0.5)', hi: '#99ffff' },
	geo: { main: '#ffb00d', bar: '#f1a501', border: 'rgba(255, 176, 13, 0.5)', hi: '#ffe699' },
	dendro: { main: '#9be53d', bar: '#8cd525', border: 'rgba(155, 229, 61, 0.5)', hi: '#99ff88' },
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
	// the four-slot shape (RotationTimeline) keep working when an element key
	// isn't recognized — visually indistinguishable from the prior local palette.
	// ⚠ `bar` falls back to THIS ENTRY'S OWN main, not none's. It is the only
	// slot that does, and it has to: physical and `none` have no bar rung by
	// design (see above), and sending physical's bar to none's gray would silently
	// merge two tones the chart draws side by side.
	return {
		main: entry.main,
		bar: 'bar' in entry ? entry.bar : entry.main,
		border: 'border' in entry ? entry.border : elementColors.none.main,
		hi: 'hi' in entry ? entry.hi : elementColors.none.main
	};
}

// The cast-pill / summon fill. Shared by the planner's E/Q pills and the Team
// Builder's Compare bars so both finishes match exactly.
//
// ↻ ⚓ NATE 2026-08-12 — IT TAKES THE `bar` RUNG NOW, not `main`. Every caller
// moved with it, which is the point of the parameter having a name: this
// function is where "a fill carrying white ink" is defined, so it is where the
// rung that exists for that job belongs. A caller still passing `main` is a
// caller that has not been told about the fourth rung.
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
export function castFill(bar: string): string {
	return bar;
}
