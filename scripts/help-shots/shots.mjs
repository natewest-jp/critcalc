/**
 * THE SHOT LIST: every screenshot in Help, as data. `capture.mjs` renders
 * each one from the production build, so a shot is re-made by rerunning the
 * script (`npm run help-shots`), never by hand.
 *
 * A shot names:
 * - `id`: the image's name, and what a chapter passes to `<HelpFigure shot>`.
 * - `help`: the chapter and section it illustrates (`planner#notation`).
 * - `device`: 'desk' (1600×1000, the e2e desk) or 'phone' (an iPhone 13).
 * - `width`: an optional narrower desk, in CSS pixels. A wide pane shot shrinks
 *   to unreadable text in the margin, so a pane is shot where it is narrow.
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

/**
 * THE TEAM BUILDER'S CAST (⚓ Nate 2026-11-17): a Custom lineup of two teams
 * people play, Mavuika Vaporize (Mavuika, Mona C2, Iansan C6, Sucrose C6) and
 * Zibai Lunar-Crystallize (Zibai, Columbina, Linnea, Illuga C6). Everyone is
 * owned but Illuga, whose chip on the team portrait is then the hollow one the
 * roster section names. The lineup carries the app's own minted label, which
 * it shows as "Custom lineup", so the shots introduce no name of their own.
 */
const BUILDER_OWNED = ['mavuika', 'mona', 'iansan', 'sucrose', 'zibai', 'columbina', 'linnea'];
const builderSeed = () => ({
	boards: {
		boards: [
			{
				id: 'shot',
				label: 'Lineup 1',
				preset: 'custom',
				noRepeats: false,
				teams: [
					{ id: 'vaporize', slots: ['mavuika', 'mona', 'iansan', 'sucrose'] },
					{
						id: 'crystallize',
						slots: ['zibai', 'columbina', 'linnea', 'illuga'],
						con: { illuga: 6 }
					}
				]
			}
		],
		activeBoardId: 'shot'
	},
	ownership: owned(BUILDER_OWNED),
	constellations: { mona: 2, iansan: 6, sucrose: 6 },
	settings: SETTINGS
});
/** 🎛️ The desk width the grid shots use: the roster pane is ~580px there,
 *  with the whole toolbar, so the shot reads at margin size. */
const PANE_DESK = 1100;
/** Owned on: the grid shows only the cast, so a new release can't reorder it. */
const ownedOnly = (page) => page.locator('.tb-band button[aria-label="Owned"]').click();
/** A team on the lineup, in order. */
const TEAM = (i) => `.bv-team >> nth=${i}`;
/** A character's card in the grid. */
const CARD_OF = (name) => `.cg-grid .cc:has(.cc-name:text-is("${name}"))`;

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
	},
	{
		id: 'builder-new-lineup',
		help: 'builder#lineups',
		device: 'desk',
		route: '/builder',
		seed: builderSeed(),
		// The menu alone: the Library's This cycle cards behind it name the
		// live seasons, which date.
		prepare: async (page) => {
			// The Builder's door in the top bar opens the Library's Lineups.
			await page.locator('.nav-btn:has-text("Builder")').click();
			await page.getByRole('button', { name: /New lineup/ }).click();
			await page.locator('[role=menu][aria-label="New lineup"]').waitFor();
			await page.mouse.move(1, 999);
		},
		// Tight on the menu's right and bottom: past them is the first card.
		clip: async (page) => {
			const b = await boxOf(
				page,
				':is(button:has-text("New lineup"), [role=menu][aria-label="New lineup"])'
			);
			return { x: b.x - 8, y: b.y - 8, width: b.width + 8, height: b.height + 9 };
		}
	},
	{
		id: 'builder-adding',
		help: 'builder#building',
		device: 'desk',
		width: PANE_DESK,
		route: '/builder',
		seed: builderSeed(),
		// Team 2 selected with Linnea taken out, so the banner reads "Adding to
		// Team 2 · 3/4"; the pointer rests on Zibai's card, which shows its
		// magnifier under the banner's empty middle (the pin stands there).
		prepare: async (page) => {
			await ownedOnly(page);
			await page.locator(`${TEAM(1)} >> .bv-slot >> nth=0`).click();
			await page.locator(`${CARD_OF('Linnea')} >> .cc-main`).click();
			// Linnea's card keeps focus after the click, and a focused card
			// shows its magnifier too.
			await page.evaluate(() => document.activeElement?.blur());
			await page.locator(CARD_OF('Zibai')).hover();
		},
		clip: async (page) => {
			const banner = await boxOf(page, '.tb-dest');
			const cards = await boxOf(page, '.cg-grid .cc');
			return {
				x: banner.x - 8,
				y: banner.y - 8,
				width: banner.width + 16,
				height: cards.y + cards.height - banner.y + 16
			};
		},
		callouts: [
			{ selector: '.tb-dest', at: 'top-left', dx: 70, side: 'top' },
			{ selector: `${CARD_OF('Zibai')} >> .cc-mag`, at: 'top', side: 'top' }
		]
	},
	{
		id: 'builder-characters',
		help: 'builder#characters',
		device: 'desk',
		width: PANE_DESK,
		route: '/builder',
		seed: builderSeed(),
		prepare: ownedOnly,
		// The roster pane's toolbar, the filter strip, and the first row of
		// cards.
		clip: async (page) => {
			const bar = await boxOf(page, '.tb-band-cell >> nth=0');
			const row = await boxOf(page, '.cg-grid .cc >> nth=0');
			const strip = await boxOf(page, '.rfs');
			return {
				x: strip.x - 8,
				// Not higher: the top bar's Builder door ends just above.
				y: bar.y - 4,
				width: strip.width + 16,
				height: row.y + row.height - bar.y + 6
			};
		},
		callouts: [
			// The strip's pins stand in the gutter at the left, and the card's at
			// the right (Mavuika's, the last card), so none covers the grid.
			{ selector: '.rfs-bar[aria-label="Role"]', at: 'left', side: 'left' },
			{ selector: '.rfs-glyphs .rfs-bar >> nth=0', at: 'left', side: 'left' },
			// Her last lit icon, pinned from below, so its pin clears the dim one's.
			{
				selector: `${CARD_OF('Mavuika')} >> .cc-g:not(.cc-g--dim) >> nth=-1`,
				at: 'bottom',
				side: 'bottom'
			},
			{ selector: `${CARD_OF('Mavuika')} >> .cc-g--dim >> nth=0`, at: 'right', side: 'right' },
			{ selector: 'button[aria-label="Read capabilities at"]', at: 'top', side: 'top' }
		]
	},
	{
		id: 'builder-capabilities',
		help: 'builder#capabilities',
		device: 'desk',
		route: '/builder',
		seed: builderSeed(),
		// Mavuika Vaporize's fifteen capabilities: EM buff lit by two
		// providers, Shield faint with none, CRIT buff faint with Mona's dot (a
		// higher constellation).
		clip: async (page) => boxOf(page, `${TEAM(0)} >> .fp`, { pad: 10 }),
		scale: 1.5,
		callouts: [
			{ selector: `${TEAM(0)} >> .fp-slot[aria-label^="EM buff"]`, at: 'top', side: 'top' },
			{ selector: `${TEAM(0)} >> .fp-slot[aria-label^="Shield"]`, at: 'top', side: 'top' },
			{ selector: `${TEAM(0)} >> .fp-slot[aria-label^="CRIT buff"]`, at: 'bottom', side: 'bottom' }
		]
	},
	{
		id: 'builder-swap',
		help: 'builder#swapping',
		device: 'desk',
		width: PANE_DESK,
		route: '/builder',
		seed: builderSeed(),
		// Replacing Mona, with Owned on: Columbina trades away Taunt, and
		// Linnea changes the reactions and adds a Shield (green).
		prepare: async (page) => {
			await ownedOnly(page);
			await page.getByRole('button', { name: 'Replace Mona, Team 1 slot 2' }).click();
			await page.mouse.move(1, 999);
		},
		clip: async (page) => {
			const banner = await boxOf(page, '.tb-dest');
			const sections = await boxOf(page, '.cg-section');
			return {
				x: banner.x - 8,
				y: banner.y - 8,
				width: banner.width + 16,
				height: sections.y + sections.height - banner.y + 16
			};
		},
		callouts: [
			{ selector: '.tb-dest', at: 'top-left', dx: 70, side: 'top' },
			{ selector: '.tb-swap-head >> nth=0', at: 'left', dx: 90, side: 'right' },
			{ selector: '.cc-g--gain >> nth=0', at: 'right', side: 'right' }
		]
	},
	{
		id: 'builder-team-chips',
		help: 'builder#roster',
		device: 'desk',
		route: '/builder',
		seed: builderSeed(),
		// Zibai Lunar-Crystallize's portraits: Illuga, not owned, at the
		// team's C6 on a hollow chip.
		clip: async (page) => {
			// Not above the row: the team header ends just over it.
			const b = await boxOf(page, `${TEAM(1)} >> .bv-slots`);
			return { x: b.x - 6, y: b.y, width: b.width + 12, height: b.height + 6 };
		},
		scale: 1.5,
		callouts: [{ selector: `${TEAM(1)} >> .spt-chip--short`, at: 'right', side: 'right' }]
	},
	{
		id: 'builder-phone',
		help: 'builder#phone',
		device: 'phone',
		route: '/builder',
		seed: builderSeed(),
		// The Lineup pane, which a filled lineup opens on.
		clip: async (page) => {
			const v = page.viewportSize();
			return { x: 0, y: 0, width: v.width, height: v.height };
		},
		scale: 0.7,
		callouts: [{ selector: '.tb-pane-switch', at: 'right', side: 'right' }]
	}
];
