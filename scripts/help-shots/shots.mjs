/**
 * THE SHOT LIST: every screenshot in Help, as data. `capture.mjs` renders
 * each one from the production build, so a shot is re-made by rerunning the
 * script (`npm run help-shots`), never by hand.
 *
 * A shot names:
 * - `id`: the image's name, and what a chapter passes to `<HelpFigure shot>`.
 * - `help`: the chapter and section it illustrates (`planner#notation`).
 * - `device`: 'desk' (1600×1000, the e2e desk) or 'phone' (an iPhone 13).
 * - `route` and `seed`: where to go and what to put in storage first. The seed
 *   uses the old-layout localStorage keys, which the first load migrates into
 *   a profile (the same path the e2e fixture takes).
 * - `prepare(page)`: anything to do before the capture (open, tap, hover).
 * - `clip(page)`: the crop, a rect in CSS pixels.
 * - `callouts`: the points a figure names, in prose order. Each is a
 *   selector, the point on its box (`at`, on the edge that faces its pin),
 *   an optional nudge in CSS pixels (`dx`, `dy`), and the `side` of the
 *   point its pin stands on (default: above it, like a map pin). Nothing is
 *   drawn into the image: the points go into the manifest and
 *   `HelpFigure.svelte` draws a numbered pin at each, its tip on the point,
 *   so their look is a CSS setting. The prose says what each number is.
 * - `scale`: the display size against the capture's CSS size (default 1).
 *
 * ⚠ Stage content that doesn't date. A shot showing this month's Theater or
 * Stygian season goes stale with the season; prefer a Custom lineup and a
 * fixed rotation.
 */

/** The team most players know, for the planner's shots. */
const NATIONAL = ['raiden', 'bennett', 'xiangling', 'xingqiu'];
/** The third bench card (Xingqiu's in the planner shots). */
const CARD = '.bench-band-mount .sp-card >> nth=2';
const owned = (ids) => Object.fromEntries(ids.map((id) => [id, 'owned']));
/** Every shot shows the newer outfits where a character has one: their
 *  portraits are the sharper art (⚓ Nate 2026-11-14). */
const SETTINGS = { useNewOutfits: true };

/** The union of the boxes of everything a selector matches, padded. */
export async function boxOf(page, selector, { pad = 0, nth } = {}) {
	const loc = page.locator(selector);
	const boxes =
		nth === undefined
			? await loc.evaluateAll((els) =>
					els.map((e) => {
						const r = e.getBoundingClientRect();
						return { x: r.x, y: r.y, width: r.width, height: r.height };
					})
				)
			: [await loc.nth(nth).boundingBox()];
	const live = boxes.filter((b) => b && b.width > 0 && b.height > 0);
	if (!live.length) throw new Error(`help-shots: nothing visible matches ${selector}`);
	const x0 = Math.min(...live.map((b) => b.x)) - pad;
	const y0 = Math.min(...live.map((b) => b.y)) - pad;
	const x1 = Math.max(...live.map((b) => b.x + b.width)) + pad;
	const y1 = Math.max(...live.map((b) => b.y + b.height)) + pad;
	return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export const SHOTS = [
	{
		id: 'planner-composer',
		help: 'planner#notation',
		device: 'desk',
		route: '/planner',
		seed: {
			// One orange flag (a name that matches no one) and one yellow one
			// (Xiangling has no held skill, so `hE` is timed as a tap).
			notation: 'Bennett Q E > Xiangling Q hE > Kazuah E > Raiden E N3',
			label: 'Raiden National',
			ownership: owned(NATIONAL),
			settings: SETTINGS
		},
		// The composer's left end, out to just past the last token: the full
		// box is ~1100px wide and would shrink the text to nothing in the margin.
		clip: async (page) => {
			const box = await boxOf(page, '.rp-composer .cm-editor');
			const text = await boxOf(page, '.rp-composer .cm-line');
			const words = await page.evaluate(() => {
				const line = document.querySelector('.rp-composer .cm-line');
				const range = document.createRange();
				range.selectNodeContents(line);
				const r = range.getBoundingClientRect();
				return r.x + r.width;
			});
			const right = Math.min(text.x + text.width, words) + 20;
			return { x: box.x - 8, y: box.y - 8, width: right - box.x + 16, height: box.height + 16 };
		}
	},
	{
		id: 'planner-bench-card',
		help: 'planner#team',
		device: 'desk',
		route: '/planner',
		seed: {
			notation: 'Bennett Q E > Xiangling Q E > Xingqiu E Q > Raiden E N3',
			label: 'Raiden National',
			ownership: owned(NATIONAL),
			settings: SETTINGS
		},
		// The card's contents, not the card: a bench card is as tall as its
		// character's rows on the timeline, mostly empty. Sideways it stops
		// inside the bench's own edges, so the image is all card and the pins
		// at the buttons stand beside it.
		clip: async (page) => {
			const c = await boxOf(page, `${CARD} >> :is(.sp-rail, .sp-avatar-chip, .sp-col)`);
			return { x: c.x - 4, y: c.y - 10, width: c.width + 10, height: c.height + 18 };
		},
		scale: 1.5,
		callouts: [
			{ selector: `${CARD} >> .sp-avatar-chip`, at: 'top', side: 'top' },
			{ selector: `${CARD} >> .sp-rail button >> nth=0`, at: 'left', side: 'left' },
			{ selector: `${CARD} >> .sp-rail button >> nth=1`, at: 'left', side: 'left' },
			{ selector: `${CARD} >> .sp-disc-con`, at: 'bottom', side: 'bottom' },
			{ selector: `${CARD} >> .sp-loadout`, at: 'right', side: 'right' }
		]
	},
	{
		id: 'planner-phone-dock',
		help: 'planner#phone',
		device: 'phone',
		route: '/planner',
		seed: {
			notation: 'Bennett Q E > Xiangling Q E > Xingqiu E Q > Raiden E N3',
			label: 'Raiden National',
			ownership: owned(NATIONAL),
			settings: SETTINGS
		},
		// Open the dock, as a tap does. The phone's own keyboard can't be
		// captured, so the key row sits at the foot of the screen.
		prepare: async (page) => {
			await page.locator('.rp-dock-strip').tap();
			await page.locator('.cm-content').waitFor();
			await page.evaluate(() => {
				const c = document.querySelector('.cm-content');
				// The caret at the end, where the key row offers the next inputs.
				const sel = window.getSelection();
				sel.selectAllChildren(c);
				sel.collapseToEnd();
			});
		},
		clip: async (page) => {
			const v = page.viewportSize();
			return { x: 0, y: 0, width: v.width, height: v.height };
		},
		scale: 0.7,
		// Each pin stands in the gutter at the left, pointing in.
		callouts: [
			{ selector: '.rp-composer .cm-editor', at: 'left', dy: -14, side: 'left' },
			{ selector: '.rp-dock-keys', at: 'left', dx: 3, side: 'left' },
			{ selector: '.bench-band-mount', at: 'left', side: 'left' }
		]
	}
];
