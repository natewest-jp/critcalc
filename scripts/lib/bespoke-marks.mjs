// BESPOKE MARKS — the glyphs Lucide has no word for, drawn for this site in
// Lucide's own idiom (stroked paths on its 24 grid, no fill) so Mark.svelte
// renders them exactly like the rest. Merged into marks.generated.ts by
// scripts/generate-marks.mjs; src/lib/marks.test.ts reads this same record,
// so there is ONE copy of every bespoke geometry in the repo.
//
// ⚠ A mark drawn in an editor usually exports cropped to its ink (a viewBox
// smaller than 24). Translate it back onto the grid by matching a shape it
// shares with its Lucide parent, rather than by centring it — centring moves
// a deliberately off-centre glyph.

/** @type {Record<string, [string, Record<string, string>][]>} */
export const BESPOKE_MARKS = {
	/**
	 * Lucide's `Hand` with a strike through it — Human timing OFF, so the
	 * state shows in the SHAPE as well as the colour (⚓ Nate, 2026-10-24).
	 * Source: assets-src/tools/hand-off.svg (viewBox 23×22, cropped to its
	 * ink), translated by (+0.894, +1) — the offset that puts its finger path
	 * on Hand's own `M18 11V6…`. Values otherwise verbatim.
	 */
	handOff: [
		['path', { d: 'M1.947,2L21.947,22' }],
		['path', { d: 'M18,11L18,6C18,4.903 17.097,4 16,4C14.902,4 14,4.903 14,6' }],
		['path', { d: 'M14,8.398L14,4C14,2.903 13.097,2 12,2C10.902,2 10,2.903 10,4L10,4.398' }],
		['path', { d: 'M6,6.053L6,14' }],
		[
			'path',
			{
				d: 'M18,8C18,6.903 18.902,6 20,6C21.097,6 22,6.903 22,8L22,14C22,14.73 21.9,15.438 21.713,16.112'
			}
		],
		[
			'path',
			{
				d: 'M19.619,19.672C18.17,21.108 16.181,22 14,22L12,22C9.2,22 7.5,21.14 6.01,19.66L2.41,16.06C2.078,15.693 1.894,15.215 1.894,14.72C1.894,13.623 2.797,12.72 3.894,12.72C4.391,12.72 4.872,12.905 5.24,13.24L7,15'
			}
		]
	]
};
