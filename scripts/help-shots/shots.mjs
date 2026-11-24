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
 *   point its pin stands on (default: above it, like a map pin). Where no
 *   element marks the point (a mark drawn inside a larger SVG), `point(page)`
 *   returns it in page CSS pixels instead of `selector` and `at`. Nothing is
 *   drawn into the image: the points go into the manifest and
 *   `HelpFigure.svelte` draws a numbered pin at each, its tip on the point,
 *   so their look is a CSS setting. The prose says what each number is.
 * - `scale`: the display size against the capture's CSS size (default 1).
 *
 * ⚠ Stage content that doesn't date. A shot showing this month's Theater or
 * Stygian season goes stale with the season; prefer a Custom lineup and a
 * fixed rotation.
 */

import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { PLANNER_SAMPLES } from '../../src/lib/data/plannerSamples.ts';
import { characterIndex } from '../../src/lib/data/characterIndex.generated.ts';
import { GAME_NAMES } from '../../src/lib/data/gameNames.generated.ts';

/**
 * THE LANGUAGE BEING SHOT. `capture.mjs` sets it before each shot, and a
 * selector that names the page's words reads them through `t`, so one list
 * serves every language. A callout's `selector` may be a function for this.
 */
let lang = 'en';
const catalogs = {};
export const setShotLang = (l) => {
	lang = l;
};
/** A message's text in the language being shot, with `{name}` filled. */
export function t(key, vars = {}) {
	catalogs[lang] ??= JSON.parse(
		readFileSync(new URL(`../../messages/${lang}.json`, import.meta.url), 'utf8')
	);
	const text = catalogs[lang][key];
	if (typeof text !== 'string') throw new Error(`help-shots: no plain message ${key} in ${lang}`);
	return text.replace(/\{(\w+)\}/g, (all, v) => (v in vars ? String(vars[v]) : all));
}
/** A message as a pattern for `:text-matches()`, each placeholder open
 *  ("{applies} of these {total}" → "^.+? of these .+?$"). */
const pattern = (key) =>
	'^' +
	t(key)
		.split(/\{[^}]*\}/)
		// Doubled: the selector's own string reads one backslash away.
		.map((s) => s.replace(/[.*+?^$()[\]\\|]/g, '\\\\$&'))
		.join('.+?') +
	'$';
/** A character's name as the page being shot shows it. */
const nameOf = (id) =>
	GAME_NAMES[lang]?.character[id] ?? characterIndex.find((c) => c.id === id).displayName;

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
const ownedOnly = (page) =>
	page.locator(`.tb-band button[aria-label="${t('tb_owned_b62f')}"]`).click();
/** A team on the lineup, in order. */
const TEAM = (i) => `.bv-team >> nth=${i}`;
/** A character's card in the grid. */
const CARD_OF = (id) => `.cg-grid .cc:has(.cc-name:text-is("${nameOf(id)}"))`;

/**
 * THE VISUALIZERS' STAGING (Claude proposed, ⚓ Nate 2026-11-18): each shot
 * opens its instrument from a `?i=` link carrying the state to show, the way a
 * reader's Copy link would. The thread is one build, 70% CRIT Rate and 140%
 * CRIT DMG (Damage breakdown's defaults), and the Builder's Mavuika Vaporize
 * where a team is needed (Sucrose's Viridescent Venerer and Mavuika's DEF
 * shred). Nothing names a banner or a season.
 *
 * `vz` writes the link as `$lib/utils/instrumentUrl.ts` does (deflate-raw,
 * base64url), since that module's extensionless imports don't load in Node.
 */
const vz = (id, state) =>
	`/visualizers?i=${id}.1~${deflateRawSync(JSON.stringify(state)).toString('base64url')}`;
/** 🎛️ The desk width the instrument shots use: a 1600 desk spreads one
 *  instrument so wide it shrinks to unreadable text in the margin. */
const VZ_DESK = 720;
/** A visible instrument's tile. */
const TILE = (id) => `#ws-tile-${id}`;
/** A crop from an instrument's headline down to the bottom of `to`. */
const headTo = async (page, id, to, { pad = 8, extra = 0 } = {}) => {
	const head = await boxOf(page, `${TILE(id)} .readout-head`);
	const end = await boxOf(page, `${TILE(id)} ${to}`);
	const x0 = Math.min(head.x, end.x) - pad;
	const x1 = Math.max(head.x + head.width, end.x + end.width) + pad;
	return {
		x: x0,
		y: head.y - pad,
		width: x1 - x0,
		height: end.y + end.height - head.y + 2 * pad + extra
	};
};
/** The crit heatmap's bars beside the map have no element of their own:
 *  the top of the highest bar at least a third as long as the longest, so
 *  its pin stands in the gap above it, clear of the count labels. */
const critBar = (page) =>
	page.locator(`${TILE('crit')} .cv-chart rect`).evaluateAll((els) => {
		const bars = els
			.map((e) => e.getBoundingClientRect())
			.filter((r) => r.height > 10 && r.height < 40 && r.width > 0 && r.width < 120);
		const longest = Math.max(...bars.map((r) => r.width));
		const bar = bars.filter((r) => r.width >= longest / 3).sort((a, b) => a.y - b.y)[0];
		return { x: bar.x + bar.width / 2, y: bar.y };
	});
/** Artifact odds' dots: the top of the tallest column clear of the dots'
 *  caption, so the pin standing over it covers no words. */
const topDot = async (page) => {
	const caption = await boxOf(
		page,
		`${TILE('artifact')} text:text-matches("${pattern('vz_artifact_100_20_slotplural_like_yours_one_dot')}")`
	);
	return page.locator(`${TILE('artifact')} .stage-graph circle[r="3.9"]`).evaluateAll(
		(els, clear) => {
			const r = els
				.map((e) => e.getBoundingClientRect())
				.filter((b) => b.x > clear)
				.sort((a, b) => a.y - b.y)[0];
			return { x: r.x + r.width / 2, y: r.y };
		},
		caption.x + caption.width + 16
	);
};
/** One crit piece, used by both Artifact odds shots: a +20 flower with nine
 *  rolls, three each into CRIT Rate and CRIT DMG. */
const PIECE = {
	v: 1,
	slot: 'flower',
	mains: ['hp'],
	level: 20,
	lines: [
		['cr', '10.5'],
		['cd', '21.0'],
		['atkPct', '9.9'],
		['er', '6.5']
	]
};

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
			// The run's label: a shorter language can fit an earlier one too.
			{ selector: '.rp-aura-marker-label >> nth=-1', at: 'right', side: 'right' },
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
			await page.getByRole('button', { name: t('planner_inspector'), exact: true }).click();
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
			await page.locator(`.nav-btn:has-text("${t('chrome_builder')}")`).click();
			await page.getByRole('button', { name: t('library_new_lineup'), exact: true }).click();
			await page.locator(`[role=menu][aria-label="${t('library_new_lineup')}"]`).waitFor();
			await page.mouse.move(1, 999);
		},
		// Tight on the menu's right and bottom: past them is the first card.
		clip: async (page) => {
			const b = await boxOf(
				page,
				`:is(button:has-text("${t('library_new_lineup')}"), [role=menu][aria-label="${t('library_new_lineup')}"])`
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
			await page.locator(`${CARD_OF('linnea')} >> .cc-main`).click();
			// Linnea's card keeps focus after the click, and a focused card
			// shows its magnifier too.
			await page.evaluate(() => document.activeElement?.blur());
			await page.locator(CARD_OF('zibai')).hover();
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
			{ selector: () => `${CARD_OF('zibai')} >> .cc-mag`, at: 'top', side: 'top' }
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
			{ selector: () => `.rfs-bar[aria-label="${t('tb_role')}"]`, at: 'left', side: 'left' },
			{ selector: '.rfs-glyphs .rfs-bar >> nth=0', at: 'left', side: 'left' },
			// Her last lit icon, pinned from below, so its pin clears the dim one's.
			{
				selector: () => `${CARD_OF('mavuika')} >> .cc-g:not(.cc-g--dim) >> nth=-1`,
				at: 'bottom',
				side: 'bottom'
			},
			{
				selector: () => `${CARD_OF('mavuika')} >> .cc-g--dim >> nth=0`,
				at: 'right',
				side: 'right'
			},
			{
				selector: () => `button[aria-label="${t('tb_read_capabilities_at')}"]`,
				at: 'top',
				side: 'top'
			}
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
			{
				selector: () => `${TEAM(0)} >> .fp-slot[aria-label^="${t('tb_em_buff')}"]`,
				at: 'top',
				side: 'top'
			},
			{
				selector: () => `${TEAM(0)} >> .fp-slot[aria-label^="${t('tb_shield')}"]`,
				at: 'top',
				side: 'top'
			},
			{
				selector: () => `${TEAM(0)} >> .fp-slot[aria-label^="${t('tb_crit_buff')}"]`,
				at: 'bottom',
				side: 'bottom'
			}
		]
	},
	{
		id: 'builder-swap',
		help: 'builder#swapping',
		device: 'desk',
		width: PANE_DESK,
		route: '/builder',
		seed: builderSeed(),
		// Replacing Columbina in Zibai's team, over the whole roster (⚓ Nate:
		// with Owned on, only two candidates showed). The crop runs through
		// Keeps everything and Trades, which loses DMG% buff; Candace, the
		// first row's last card, adds a Shield (green). Unlike the other grid
		// shots this one follows the roster, so a release can change it.
		prepare: async (page) => {
			// The first click selects Zibai's team; the second opens the swap.
			await page.locator(`${TEAM(1)} >> .bv-slot >> nth=1`).click();
			await page
				.getByRole('button', {
					name: t('tb_replace_displayname_name_slot_x', {
						name: nameOf('columbina'),
						team: t('tb_team_x', { n: 2 }),
						n: 2
					})
				})
				.click();
			await page.mouse.move(1, 999);
		},
		clip: async (page) => {
			const banner = await boxOf(page, '.tb-dest');
			const trades = await boxOf(page, '.cg-section >> nth=1');
			return {
				x: banner.x - 8,
				y: banner.y - 8,
				width: banner.width + 16,
				height: trades.y + trades.height - banner.y + 12
			};
		},
		callouts: [
			{ selector: '.tb-dest', at: 'top-left', dx: 70, side: 'top' },
			{ selector: '.cg-section >> nth=1 >> .tb-swap-head', at: 'left', dx: 110, side: 'right' },
			{
				selector: () => `${CARD_OF('candace')} >> .cc-g--gain >> nth=0`,
				at: 'right',
				side: 'right'
			}
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
		prepare: async (page) => {
			await page
				.locator(`${TEAM(1)} >> :is(.bv-chips, .bv-fp)`)
				.evaluateAll((els) => els.forEach((e) => (e.style.visibility = 'hidden')));
		},
		clip: async (page) => {
			// Centered on the portrait circles, not the slot row (⚓ Nate): the row
			// keeps headroom over the circles for overhanging hair, so the same
			// space goes below them too. That space is where the team's chips
			// and capabilities sit, so prepare hides them.
			const row = await boxOf(page, `${TEAM(1)} >> .bv-slots`);
			const discs = await boxOf(page, `${TEAM(1)} >> .spt-disc`);
			const m = discs.y - row.y;
			return { x: row.x - 6, y: row.y, width: row.width + 12, height: discs.height + 2 * m };
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
	},
	{
		id: 'vz-workspace',
		help: 'visualizers#workspace',
		device: 'desk',
		// The narrowest desk that holds two tiles.
		width: 1360,
		route: vz('crit', { v: 1 }),
		// Two instruments side by side, through the Layout plate.
		prepare: async (page) => {
			await page.locator(`role=button[name="${t('vz_layout')}"]`).click();
			await page.locator('role=radio[name="2"]').click();
			await page.keyboard.press('Escape');
			await page.mouse.move(1, 999);
		},
		// The second tile's bar over its headline: every control the prose
		// names is on it, Layout included, and the first tile's edge shows
		// there are two. The whole band is too wide to read in the margin.
		clip: async (page) => {
			const cell = await boxOf(page, '.ws-band-cell >> nth=1');
			const head = await boxOf(page, '#ws-tile-gauge .readout-head');
			const x = cell.x - 40;
			return {
				x,
				// Not higher: the top bar's Visualizers door ends just above.
				y: cell.y - 4,
				width: cell.x + cell.width + 8 - x,
				height: head.y + head.height - cell.y + 12
			};
		},
		callouts: [
			{ selector: '.ws-band-cell >> nth=1 >> .ws-picker', at: 'bottom', side: 'bottom' },
			{ selector: () => `role=button[name="${t('vz_layout')}"]`, at: 'bottom', side: 'bottom' },
			{
				selector: () => `.ws-band-cell >> nth=1 >> button:has-text("${t('vz_defaults')}")`,
				at: 'bottom',
				side: 'bottom'
			},
			{
				selector: () => `.ws-band-cell >> nth=1 >> button:has-text("${t('vz_copy_link')}")`,
				at: 'bottom',
				side: 'bottom'
			},
			{
				selector: () =>
					`.ws-band-cell >> nth=1 >> role=button[name="${t('vz_more_instrument_actions')}"]`,
				at: 'bottom',
				side: 'bottom'
			}
		]
	},
	{
		id: 'vz-crit',
		help: 'visualizers#crit-heatmap',
		device: 'desk',
		// 🎛️ The roomier layout, with the bars beside the map as the prose
		// says: below 1040 the heatmap condenses to ~300px with the bars under
		// it, and above it the chart is ~690px and shrinks in the margin.
		width: 680,
		// A 300 CV build off the 1:2 ratio, with the shared 70/140 pinned.
		route: vz('crit', { v: 1, cr: 0.5, cd: 2.0, variance: true, hits: 8, pin: [0.7, 1.4] }),
		clip: (page) => boxOf(page, `${TILE('crit')} .cv-chart-col`, { pad: 8 }),
		callouts: [
			{ selector: `${TILE('crit')} circle[r="8"]`, at: 'right', dx: 1, side: 'right' },
			// The ring's hit circle is larger than the ring it draws.
			{ selector: `${TILE('crit')} .cv-ring-hit`, at: 'center', dy: -8, side: 'top' },
			{ selector: `${TILE('crit')} circle[r="5.5"]`, at: 'left', side: 'left' },
			{ point: (page) => critBar(page), side: 'top' }
		]
	},
	{
		id: 'vz-gauge',
		help: 'visualizers#gauge-explorer',
		device: 'desk',
		width: VZ_DESK,
		// Overvape: Hydro, then Electro (Electro-Charged), then Pyro, which
		// reacts with both.
		route: vz('gauge', {
			v: 1,
			preset: 'pyroec',
			apps: [
				[0, 'hydro', 1],
				[1, 'electro', 1],
				[2, 'pyro', 1]
			]
		}),
		// Tall (⚓ Nate): from the headline to the element lanes, and across to
		// just past the element buttons, which is past every mark. The rest of
		// the axis is empty, and Clear is the only control it cuts.
		clip: async (page) => {
			const box = await headTo(page, 'gauge', '.stage-graph');
			const adds = await boxOf(page, `${TILE('gauge')} .gx-adds`);
			return { ...box, width: adds.x + adds.width + 44 - box.x };
		},
		scale: 1.3,
		callouts: [
			{ selector: `${TILE('gauge')} .gx-adds`, at: 'right', side: 'right' },
			// The pill's disc, not its hit box.
			{
				selector: `${TILE('gauge')} .gx-marker >> nth=0 >> circle[r="9"]`,
				at: 'left',
				side: 'left'
			},
			{
				selector: () => `${TILE('gauge')} text:has-text("${t('vz_gauge_vaporize')}")`,
				at: 'right',
				dx: 1,
				side: 'right'
			},
			// Two drop labels, Electro's and Hydro's, stacked at the drop.
			{ selector: `${TILE('gauge')} .gx-drop >> nth=0`, at: 'right', dx: 1, dy: 4, side: 'right' }
		]
	},
	{
		id: 'vz-icd',
		help: 'visualizers#icd-timeline',
		device: 'desk',
		width: VZ_DESK,
		// Evenly spaced hits under Standard ICD (⚓ Nate): the pattern, the
		// counter's rings, and the interval chart under it.
		route: vz('icd', { v: 1, source: 'even', interval: 0.5, rule: 'standard' }),
		clip: (page) => headTo(page, 'icd', '.icd-anchors'),
		callouts: [
			{
				selector: () =>
					`${TILE('icd')} text:text-matches("${pattern('vz_icd_applies_of_these_of')}")`,
				at: 'left',
				dx: -1,
				side: 'left'
			},
			{ selector: `${TILE('icd')} circle[fill="none"] >> nth=0`, at: 'bottom', side: 'bottom' },
			{ selector: `${TILE('icd')} circle[style*="frame-bg"]`, at: 'left', side: 'left' }
		]
	},
	{
		id: 'vz-curves',
		help: 'visualizers#reaction-curves',
		device: 'desk',
		width: VZ_DESK,
		route: vz('curves', { v: 1, family: 'all', em: 600, level: 90, rb: 0, pick: 0 }),
		clip: (page) => headTo(page, 'curves', '.stage-handle'),
		callouts: [
			{
				selector: () =>
					`${TILE('curves')} text:has-text("${t('vz_rc_next_gain_step_em', { step: 100 })}") >> nth=0`,
				at: 'right',
				side: 'right'
			},
			// The strip's fill, near its foot at the left end: the shape's box
			// starts above the fill, level with the strip's label.
			{
				selector: `${TILE('curves')} path[fill-opacity="0.45"]`,
				at: 'bottom-left',
				dy: -18,
				side: 'left'
			}
		]
	},
	{
		id: 'vz-breakdown',
		help: 'visualizers#damage-breakdown',
		device: 'desk',
		// The narrowest desk that keeps the columns (UPRIGHT_MIN, 900px of
		// stage): narrower, they become rows, which have no grips.
		width: 940,
		// The defaults are the shared build: a direct hit at 70/140.
		route: vz('breakdown', { v: 2 }),
		clip: (page) => headTo(page, 'breakdown', '.bd-foot'),
		callouts: [
			{ selector: `${TILE('breakdown')} .readout-sentence`, at: 'bottom', side: 'bottom' },
			{
				selector: `${TILE('breakdown')} g[stroke-opacity="0.7"] >> nth=1`,
				at: 'right',
				side: 'right'
			},
			{
				selector: () =>
					`${TILE('breakdown')} .stage-graph text:has-text("${t('vz_artifact_cd')}") >> nth=0`,
				at: 'top',
				side: 'top'
			}
		]
	},
	{
		id: 'vz-defres',
		help: 'visualizers#enemy-res-def',
		device: 'desk',
		width: VZ_DESK,
		// Pyro, with Viridescent Venerer (on Sucrose) and Mavuika's DEF shred.
		route: vz('defres', {
			v: 1,
			element: 'pyro',
			charLevel: 90,
			ignoresDef: false,
			enemyLevel: 100,
			baseRes: 10,
			picks: {
				'viridescent_venerer|res||viridescent_venerer': 40,
				'mavuika|def||searingRadiance': 20
			},
			other: [0, 0, 0]
		}),
		clip: (page) => headTo(page, 'defres', '.dr-handle'),
		callouts: [
			{
				selector: () =>
					`${TILE('defres')} text:has-text("${GAME_NAMES[lang]?.artifact.viridescent_venerer ?? 'Viridescent Venerer'} 40%")`,
				at: 'bottom',
				side: 'bottom'
			},
			{ selector: `${TILE('defres')} text:has-text("×1.150")`, at: 'top', side: 'top' }
		]
	},
	{
		id: 'vz-artifact-piece',
		help: 'visualizers#artifact-odds',
		device: 'desk',
		width: VZ_DESK,
		route: vz('artifact', { ...PIECE, view: 'piece' }),
		clip: (page) => headTo(page, 'artifact', '.stage-handle'),
		callouts: [
			{ selector: `${TILE('artifact')} .ao-glance`, at: 'bottom', side: 'bottom' },
			{ point: (page) => topDot(page), side: 'top' }
		]
	},
	{
		id: 'vz-artifact-reshape',
		help: 'visualizers#artifact-odds',
		device: 'desk',
		width: VZ_DESK,
		route: vz('artifact', { ...PIECE, view: 'reshape', selected: ['cr', 'cd'] }),
		// The slider under the dots is cut by the crop; hidden, so no sliver of
		// its thumb shows under the axis caption.
		prepare: (page) =>
			page
				.locator(`${TILE('artifact')} .stage-handle`)
				.evaluateAll((els) => els.forEach((e) => (e.style.visibility = 'hidden'))),
		// From the view's own toolbar down to the dots: the headline's view
		// tabs repeat the shot above, and the shorter shot stays in its section.
		clip: async (page) => {
			const bar = await boxOf(page, `${TILE('artifact')} .setup-bar`);
			const graph = await boxOf(page, `${TILE('artifact')} .stage-graph`);
			return {
				x: bar.x - 8,
				y: bar.y - 8,
				width: bar.width + 16,
				height: graph.y + graph.height - bar.y + 10
			};
		}
	},
	{
		id: 'vz-wish',
		help: 'visualizers#wish-odds',
		device: 'desk',
		width: VZ_DESK,
		// C1 of a featured 5★ from 30 pity, no guarantee, the counter at 2.
		route: vz('wish', {
			v: 3,
			target: 'character',
			pulls: 120,
			banners: { character: { pity: 30, guaranteed: false, have: 0, goal: 2, counter: 2 } }
		}),
		clip: (page) => headTo(page, 'wish', '.stage-handle'),
		callouts: [
			{ selector: `${TILE('wish')} input[type=range]`, at: 'left', side: 'left' },
			{
				selector: () => `${TILE('wish')} button:has-text("${t('vz_wish_radiance_counter')}")`,
				at: 'bottom',
				side: 'bottom'
			}
		]
	}
];
