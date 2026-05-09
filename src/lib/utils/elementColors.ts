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
	| 'pyro' | 'hydro' | 'anemo' | 'electro'
	| 'cryo' | 'geo'  | 'dendro'
	| 'physical' | 'none';

// `none` and `physical` only have `main` — their `border` / `hi` slots are
// intentionally absent. Physical uses the muted grey palette of `none` because
// no character is canonically Physical-aligned (it's used for damage instances
// and RES debuffs, not character UI), and the bar needs a recognisable but
// understated tone.
export const elementColors = {
	pyro:     { main: '#e05a4a', border: 'rgba(224, 90, 74, 0.5)',   hi: '#f0ada5' },
	hydro:    { main: '#1472f0', border: 'rgba(20, 114, 240, 0.5)',  hi: '#8ab9f8' },
	anemo:    { main: '#4ecbb4', border: 'rgba(78, 203, 180, 0.5)',  hi: '#a7e5da' },
	electro:  { main: '#c070f0', border: 'rgba(192, 112, 240, 0.5)', hi: '#e0b8f8' },
	cryo:     { main: '#88c8f0', border: 'rgba(136, 200, 240, 0.5)', hi: '#c4e4f8' },
	geo:      { main: '#d4a040', border: 'rgba(212, 160, 64, 0.5)',  hi: '#ead0a0' },
	dendro:   { main: '#80c840', border: 'rgba(128, 200, 64, 0.5)',  hi: '#c0e4a0' },
	physical: { main: '#9ea4b3' },
	none:     { main: '#6a7080' }
} as const;

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
