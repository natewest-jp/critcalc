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

import { PLANNER_SAMPLES } from '../../src/lib/data/plannerSamples.ts';

/**
 * THE PLANNER'S CAST (⚓ Nate 2026-11-15): Flins Lunar-Charged, one of the
 * planner's first-visit samples, with its own constellations (Flins C1, which
 * the rotation needs, and Sucrose C6) and loadouts. Every planner shot stages
 * it, so a reader meets the same team from section to section.
 */
const FLINS = PLANNER_SAMPLES.find((s) => s.id === 'flins-lunar-charged');
const owned = (ids) => Object.fromEntries(ids.map((id) => [id, 'owned']));
/** Every shot shows the newer outfits where a character has one: their
 *  portraits are the sharper art (⚓ Nate 2026-11-14). */
const SETTINGS = { useNewOutfits: true };
/** The planner seeded with the cast, all four owned, at the sample's
 *  constellations and loadouts; `notation` replaces the rotation. */
const flinsSeed = (notation = FLINS.notation) => ({
	notation,
	label: FLINS.name,
	ownership: owned(['columbina', 'ineffa', 'sucrose', 'flins']),
	constellations: FLINS.cons,
	tabLoadout: FLINS.loadout,
	settings: SETTINGS
});

/** Flins's bench card: the fourth. */
const CARD = '.bench-band-mount .sp-card >> nth=3';
/** A character's group of rows on the timeline, in team order. */
const BLOCK = (i) => `.rp-char-block >> nth=${i}`;

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
		// One orange flag (a name that matches no one) and one yellow one
		// (Sucrose has no held skill, so `hE` is timed as a tap).
		seed: flinsSeed('Columbina E Q > Ineffa E > Sucrose hE > Flinz E E sQ N4D'),
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
		seed: flinsSeed(),
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
		id: 'planner-timeline',
		help: 'planner#timeline',
		device: 'desk',
		route: '/planner',
		seed: flinsSeed(),
		// Columbina's rows over the rotation's first five seconds: skill,
		// summons, burst, the active row, and the connector down to Ineffa.
		// Her received buff arrives later than this, so the prose names it
		// without a pin.
		clip: async (page) => {
			const b = await boxOf(page, BLOCK(0));
			return { x: b.x - 4, y: b.y + 2, width: 292, height: 122 };
		},
		scale: 1.5,
		callouts: [
			{ selector: `${BLOCK(0)} >> .rp-bar-uptime >> nth=0`, at: 'left', side: 'left' },
			{ selector: `${BLOCK(0)} >> .rp-summon-bar >> nth=0`, at: 'left', side: 'left' },
			{ selector: `${BLOCK(0)} >> .rp-bar-uptime >> nth=1`, at: 'left', side: 'left' },
			{ selector: `${BLOCK(0)} >> .rp-active-bg >> nth=0`, at: 'left', side: 'left' },
			{ selector: '.rp-connector >> nth=0', at: 'top-right', dy: 24, side: 'right' },
			{ selector: `${BLOCK(0)} >> .rp-bar-cd >> nth=0`, at: 'left', dx: 160, side: 'top' }
		]
	},
	{
		id: 'planner-padding',
		help: 'planner#human-timing',
		device: 'desk',
		route: '/planner',
		seed: flinsSeed(),
		// Flins's active row from his swap in: the hatched slivers are the
		// reaction time Human timing adds.
		clip: async (page) => {
			const row = await boxOf(page, `${BLOCK(3)} >> .rp-active-bg >> nth=0`);
			return { x: row.x - 14, y: row.y - 3, width: 290, height: row.height + 6 };
		},
		scale: 1.5,
		callouts: [
			{ selector: `${BLOCK(3)} >> .rp-input-block--pad >> nth=2`, at: 'bottom', side: 'bottom' }
		]
	},
	{
		id: 'planner-playback',
		help: 'planner#playback',
		device: 'desk',
		route: '/planner',
		seed: flinsSeed(),
		// Laps on, zoomed all the way out so the first lap mark is in view,
		// and the cursor set partway through the first lap.
		prepare: async (page) => {
			await page.locator('.rp-laps').click();
			await page.locator('.rp-zoom-menu button').click();
			await page.locator('input[type=range]').first().fill('20');
			await page.keyboard.press('Escape');
			await page.mouse.move(1, 999);
			const ruler = await page.locator('.rp-ruler').boundingBox();
			await page.mouse.click(ruler.x + 13 * 20, ruler.y + ruler.height / 2);
			await page.mouse.move(1, 999);
		},
		clip: async (page) => {
			const bar = await boxOf(page, '.rp-transport');
			const ruler = await boxOf(page, '.rp-ruler');
			return {
				x: bar.x - 6,
				y: bar.y - 6,
				width: 440,
				height: ruler.y + ruler.height - bar.y + 12
			};
		},
		callouts: [
			{ selector: '.rp-play', at: 'top', side: 'top' },
			{ selector: '.rp-playhead >> nth=0', at: 'top', side: 'top' },
			{ selector: '.rp-speed', at: 'top', side: 'top' },
			{ selector: '.rp-laps', at: 'top', side: 'top' },
			{ selector: '.rp-lap-mark >> nth=0', at: 'top', side: 'top' }
		]
	},
	{
		id: 'planner-aura',
		help: 'planner#aura',
		device: 'desk',
		route: '/planner',
		seed: flinsSeed(),
		// The lane over the first seven seconds: Hydro, then Electro under
		// it, their pills, the Lunar-Charged marker, and the Thundercloud
		// in the reaction spawns.
		clip: async (page) => {
			const lane = await boxOf(page, '.rp-aura-lane');
			return { x: lane.x - 2, y: lane.y - 2, width: 440, height: lane.height + 6 };
		},
		callouts: [
			{ selector: '.rp-aura-series-name >> nth=0', at: 'bottom', side: 'bottom' },
			{ selector: '.rp-aura-tick >> nth=1', at: 'top', side: 'top' },
			{ selector: '.rp-aura-marker-label', at: 'right', side: 'right' },
			{ selector: '.rp-gadget-row circle >> nth=0', at: 'bottom', side: 'bottom' }
		]
	},
	{
		id: 'planner-inspector',
		help: 'planner#inspector',
		device: 'desk',
		route: '/planner',
		seed: flinsSeed(),
		// The panel as it opens: the team, each character with the caveats
		// on their kit.
		prepare: async (page) => {
			await page.getByRole('button', { name: 'Inspector' }).click();
			await page.mouse.move(1, 999);
		},
		clip: async (page) => {
			// Down to the end of the last caveat that fits in 560px, so the
			// crop never cuts a paragraph.
			const panel = await boxOf(page, '.tc-aside-box');
			const bottom = await page.evaluate((limit) => {
				const ends = [...document.querySelectorAll('.tc-aside-box .pi-note-text')]
					.map((e) => e.getBoundingClientRect().bottom)
					.filter((b) => b <= limit);
				return Math.max(...ends);
			}, panel.y + 560);
			return { x: panel.x, y: panel.y, width: panel.width, height: bottom - panel.y + 4 };
		}
	},
	{
		id: 'planner-phone-dock',
		help: 'planner#phone',
		device: 'phone',
		route: '/planner',
		seed: flinsSeed(),
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
