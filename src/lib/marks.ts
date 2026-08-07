/**
 * TOOLBAR MARKS — the geometry behind <Mark>, in a plain module so the name
 * union is importable from anywhere (a type exported from a .svelte instance
 * script is not) and so the paths are inspectable without mounting anything.
 *
 * WHY GEOMETRY AT ALL: the sub-pixel rendering law (/styleguide § Laws) —
 * "symbol marks are GEOMETRY, never unicode characters." Every band control
 * used to carry a literal ↑ ↓ ⤴ ↺ ⎘ ⧉ ✓ ✗ × − + in its label, and engines
 * resolve those from whichever fallback face happens to cover the codepoint:
 * a different face at a different optical size in every browser, with no
 * relation to the metrics of the label beside it. They sat at different
 * heights, weights and baselines across Chrome and WebKit.
 *
 * One 16-unit grid for all of them, with the ink inside a 12-unit square
 * (2 units of margin) so marks in a row match optically. Stroked, not filled:
 * at 14px a filled silhouette outweighs the semibold uppercase label it sits
 * with.
 */

export type MarkName =
	| 'save'
	| 'load'
	| 'share'
	| 'reset'
	| 'plus'
	| 'close'
	| 'check'
	| 'chevron'
	| 'more'
	| 'link'
	| 'copy'
	| 'image'
	| 'minus'
	| 'note';

export const MARK_PATHS: Record<MarkName, string> = {
	// Arrow rising out of a tray — "put this in the bank".
	save: 'M8 10.5V2.5M8 2.5 4.75 5.75M8 2.5l3.25 3.25M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2',
	// The same tray, arrow falling in.
	load: 'M8 2.5v8M8 10.5 4.75 7.25M8 10.5l3.25-3.25M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2',
	// Arrow leaving an open-topped box.
	share:
		'M11 4.5 8 1.5 5 4.5M8 1.5v8.5M3 7.5H2.5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H13',
	// Circular arrow, opening at the top right with its head on the arc.
	reset: 'M13.5 8a5.5 5.5 0 1 1-1.9-4.16M13.5 2v3.2h-3.2',
	plus: 'M8 3v10M3 8h10',
	minus: 'M3 8h10',
	close: 'M4 4l8 8M12 4l-8 8',
	check: 'M3 8.5 6.5 12 13 4.5',
	// Down chevron — a menu opens below its trigger.
	chevron: 'M4 6.5 8 10.5 12 6.5',
	// Three dots, drawn as zero-length round-capped strokes so they are the same
	// geometry as every other mark rather than three <circle>s that rasterize on
	// a different rounding path.
	more: 'M4 8h.01M8 8h.01M12 8h.01',
	// Two links of a chain at 45°.
	link: 'M6.75 9.25a2.5 2.5 0 0 0 3.54 0l2.12-2.12a2.5 2.5 0 0 0-3.54-3.54l-.7.7M9.25 6.75a2.5 2.5 0 0 0-3.54 0L3.6 8.87a2.5 2.5 0 0 0 3.54 3.54l.7-.7',
	// Two offset sheets.
	copy: 'M5.5 5.5V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2.5M2.5 7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1z',
	// Frame with a horizon and a sun — the picture idiom.
	image:
		'M2 3.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zM2 10.5l3.5-3 3 2.5 2-1.75L14 11M5.5 6.25h.01',
	// A page with two rules — the caveat notes panel.
	note: 'M3.5 2.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM5.5 6h5M5.5 9h3'
};
