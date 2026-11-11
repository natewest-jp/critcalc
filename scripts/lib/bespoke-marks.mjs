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
	 * state shows in the SHAPE as well as the color (⚓ Nate, 2026-10-24).
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
	],
	/**
	 * Imaginarium Theater's symbol, the butterfly (⚓ Nate, 2026-11-11). From
	 * Lucide LAB (`@lucide/lab` 0.1.2, `butterfly`, ISC), which is not a
	 * dependency: Lab ships no core package, so its geometry is copied here
	 * verbatim.
	 */
	theater: [
		['path', { d: 'M15.8 2C12 3.8 12 9 12 9s0-5.2-3.8-7' }],
		['path', { d: 'M12 9v11' }],
		[
			'path',
			{
				d: 'M20 5c-3.5 0-6.5 3.9-8 6.3C10.5 8.9 7.5 5 4 5a2 2 0 0 0-2 2c0 2.3.6 4.4 1.5 5.6C4 13.5 4.9 14 6 14h2c-.9.4-2.1.9-2.6 1.5-1.6 1.6-.9 3.4.7 4.9 1.6 1.6 3.4 2.3 4.9.7.3-.3 1-1.1 1-1.1s.6.8 1 1.1c1.6 1.6 3.4.9 4.9-.7 1.6-1.6 2.3-3.4.7-4.9-.5-.5-1.7-1.1-2.6-1.5h2c1.1 0 2-.5 2.5-1.4.9-1.2 1.5-3.3 1.5-5.6a2 2 0 0 0-2-2'
			}
		]
	],
	/**
	 * The butterfly struck through: "can't enter Theater", the roster's mark
	 * for a character not leveled (⚓ Nate, 2026-11-11, drawn by him).
	 * Source: assets-src/tools/theater-off.svg (viewBox 22×23, cropped to its
	 * ink), translated by (+1, +1), the offset that puts its stem on
	 * `theater`'s own `M12 9v11`. Values otherwise verbatim.
	 */
	theaterOff: [
		[
			'path',
			{
				d: 'M15.8,2C13.678,3.005 12.741,5.07 12.327,6.698L11.383,5.753C10.869,4.338 9.927,2.818 8.2,2'
			}
		],
		['path', { d: 'M12,12.003L12,20' }],
		[
			'path',
			{
				d: 'M5.13,5.133C4.76,5.047 4.383,5 4,5C2.903,5 2,5.903 2,7C2,9.3 2.6,11.4 3.5,12.6C4,13.5 4.9,14 6,14L8,14C7.1,14.4 5.9,14.9 5.4,15.5C3.8,17.1 4.5,18.9 6.1,20.4C7.7,22 9.5,22.7 11,21.1C11.3,20.8 12,20 12,20C12,20 12.6,20.8 13,21.1C14.6,22.7 16.4,22 17.9,20.4C18.351,19.949 18.731,19.482 19.007,19.01'
			}
		],
		[
			'path',
			{
				d: 'M19.338,13.709C19.825,13.473 20.224,13.097 20.5,12.6C21.4,11.4 22,9.3 22,7C22,5.903 21.097,5 20,5C17.726,5 15.664,6.646 14.086,8.457'
			}
		],
		['path', { d: 'M22,22.003L2,2.003' }]
	]
};
