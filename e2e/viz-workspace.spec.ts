import { test, expect, openTool } from './fixtures/critcalc';
import type { Page } from '@playwright/test';

/**
 * The Visualizers WORKSPACE layer: which instrument sits in which slot, how
 * that survives a reload, how `?i=` deep links land, and the ICD→Gauge handoff.
 *
 * Scope note: the old probe also re-asserted each instrument's arithmetic
 * (×0.900 res multipliers, equation term counts, pity math). That belongs to
 * the Vitest lib tests beside those modules — `defres.test.ts`, `wish.test.ts`,
 * `breakdown.test.ts`, `crit.test.ts`, `gauge.test.ts` and friends already own it,
 * and a browser is a slow, flaky place to recheck a pure function. What only a
 * browser can prove is the workspace behavior below.
 */

const WORKSPACE_KEY = 'critcalc:vizWorkspace';

/**
 * The instrument pickers, in slot order. They live in BAND B, whose cells are
 * laid out on the tile grid's own columns in slot order — so the band IS the
 * left-to-right reading. A picker at every width (the eight tabs retired).
 */
const triggers = (page: Page) => page.locator('.ws-band-cell .ip-trigger');

/** One up: the first picker names the instrument on screen. */
const currentTab = (page: Page) => page.locator('.ws-band-cell .ip-name-current').first();

/**
 * Assert the whole side-by-side lineup. `toHaveText` with an ARRAY checks the
 * count and the text together and retries until both settle — a one-shot read
 * races the second tile's lazy mount and sees a one-instrument lineup. (It did
 * exactly that on the first run of this spec.) Regexes, because each trigger's
 * text ends in whitespace around its mark.
 */
const expectLineup = (page: Page, names: string[]) =>
	expect(triggers(page)).toHaveText(names.map((n) => new RegExp(n)));

/** Side by side, from the Layout plate — the reader's choice since one up became the default. */
async function showTwo(page: Page) {
	await page.locator('.band-menu-trigger', { hasText: 'Layout' }).click();
	await page.locator('.ws-slots .btn', { hasText: '2' }).click();
	await page.keyboard.press('Escape');
}

const defaultsButton = (page: Page) =>
	page.locator('.ws-band-actions button', { hasText: 'Defaults' });

test.describe('lineup and slots', () => {
	test('first load shows one instrument, named on its picker', async ({ page }) => {
		await openTool(page, '/visualizers');
		await expect(triggers(page), 'one picker').toHaveCount(1);
		await expect(currentTab(page)).toHaveText('Crit heatmap');
		await expect(page.locator('.ws-tile:not(.ws-hidden)'), 'one tile').toHaveCount(1);

		const actions = page.locator('.ws-band-actions .btn');
		await expect(actions.filter({ hasText: 'Copy link' })).toHaveCount(1);
		await expect(defaultsButton(page), 'nothing to put back yet').toBeDisabled();
	});

	test('the picker switches the instrument, and the choice survives a reload', async ({ page }) => {
		await openTool(page, '/visualizers');
		await triggers(page).first().click();
		await page.locator('.ip-menu .ip-option', { hasText: 'Wish odds' }).click();
		await expect(currentTab(page)).toHaveText('Wish odds');

		await page.reload({ waitUntil: 'networkidle' });
		await expect(currentTab(page)).toHaveText('Wish odds');
	});

	test('picking an already-visible instrument swaps the two tiles', async ({ page }) => {
		await openTool(page, '/visualizers');
		await showTwo(page);
		await expectLineup(page, ['Crit heatmap', 'Gauge explorer']);
		await page.locator('.ws-band-cell').first().locator('.ip-trigger').click();

		await expect(page.locator('.ip-menu .ip-option'), 'all eight instruments').toHaveCount(8);
		await expect(
			page.locator('.ip-menu .ip-option', { hasText: 'Tile 2' }),
			'the other tile’s instrument carries a swap badge'
		).toContainText('Gauge');

		await page.locator('.ip-menu .ip-option', { hasText: 'Gauge explorer' }).click();
		await expectLineup(page, ['Gauge explorer', 'Crit heatmap']);
		await expect(page.locator('.ip-menu')).toHaveCount(0);
	});

	test('the layout survives a reload and resets on demand', async ({ page }) => {
		await openTool(page, '/visualizers');
		await showTwo(page);
		await page.locator('.ws-band-cell').first().locator('.ip-trigger').click();
		await page.locator('.ip-menu .ip-option', { hasText: 'Gauge explorer' }).click();

		await page.reload({ waitUntil: 'networkidle' });
		await expectLineup(page, ['Gauge explorer', 'Crit heatmap']); // the swap persisted

		// Reset layout sits in the toolbar's Layout plate (design §5.3).
		await page.locator('.band-menu-trigger', { hasText: 'Layout' }).click();
		await page.locator('.ws-reset').click();
		await expect(currentTab(page), 'back to one up, on the first instrument').toHaveText(
			'Crit heatmap'
		);
		const stored = await page.evaluate(
			(k) => JSON.parse(localStorage.getItem(k) ?? 'null'),
			WORKSPACE_KEY
		);
		expect(stored?.v).toBe(2);
		expect(stored?.slots, 'the reset persisted too').toBe(1);
		expect(stored?.assignment?.[0]).toBe('crit');
	});
});

test.describe('deep links', () => {
	test('a bare ?i= slots its instrument first and strips the param', async ({ page }) => {
		await openTool(page, '/visualizers?i=artifact');
		await expect(currentTab(page)).toHaveText('Artifact odds');
		expect(page.url(), 'the param is consumed, not left in the URL').not.toContain('i=');
	});

	test('a stateful ?i= applies the shared control values', async ({ page }) => {
		// Build the param with the page's own CompressionStream rather than
		// re-implementing the codec in Node — the encoding IS a browser API, and
		// `instrumentUrl.test.ts` owns the codec's round-trip separately.
		await openTool(page, '/visualizers');
		const param = await page.evaluate(async () => {
			const state = { v: 1, cr: 0.9, cd: 2.5, cvLine: true, variance: false, hits: 8, pin: null };
			const stream = new CompressionStream('deflate-raw');
			const writer = stream.writable.getWriter();
			void writer.write(new TextEncoder().encode(JSON.stringify(state))).then(() => writer.close());
			const buf = new Uint8Array(await new Response(stream.readable).arrayBuffer());
			const b64 = btoa(String.fromCharCode(...buf))
				.replace(/\+/g, '-')
				.replace(/\//g, '_')
				.replace(/=+$/, '');
			return `crit.1~${b64}`;
		});

		await openTool(page, `/visualizers?i=${encodeURIComponent(param)}`);
		await expect(currentTab(page)).toHaveText('Crit heatmap');
		await expect(
			page.locator('.ws-tile:not(.ws-hidden) .is-field').first(),
			'shared CR applied'
		).toHaveValue('90');

		// The bar's Defaults restores the tile's own controls, and its toast can undo it.
		await defaultsButton(page).click();
		await expect(
			page.locator('.ws-tile:not(.ws-hidden) .is-field').first(),
			'CR back to its default'
		).toHaveValue('70');
		await expect(defaultsButton(page)).toBeDisabled();
		await page.getByRole('button', { name: 'Undo' }).click();
		await expect(
			page.locator('.ws-tile:not(.ws-hidden) .is-field').first(),
			'Undo puts it back'
		).toHaveValue('90');
	});
});

test('the ICD timeline hands its hits off to the Gauge explorer', async ({ page }) => {
	await openTool(page, '/visualizers?i=icd');
	await expect(currentTab(page)).toHaveText('ICD timeline');

	const applying = parseInt(
		await page.locator('.ws-tile:not(.ws-hidden) .readout-head').first().innerText(),
		10
	);
	await page.locator('.icd-send').click();

	// One up, the gauge takes the tile (side by side, it opens beside the source).
	await expect(currentTab(page)).toHaveText('Gauge explorer');
	// The handoff caps at eight applications.
	// ↻ 2026-08-17: counted on the CHART, not in the panel. `.gx-app` was one
	// editor block per application and the panel is a single inspector now — so
	// this counts the markers instead, which is the better assertion anyway: it
	// checks the applications ARRIVED rather than that a list was rendered.
	await expect(page.locator('.gx-marker')).toHaveCount(Math.min(applying, 8));
	// The gauge tile carries several `.note` paragraphs (the per-instrument copies
	// folded into the global `.note` in the styleguide migration), and the
	// scenario one is what reports an unrecognised sequence.
	// ↻ 2026-08-17: matched by CONTENT rather than by `.first()`. The Applications
	// panel moved to the head of the flow (see its note — CSS multicolumn was
	// moving it between columns mid-edit), so a positional selector here would
	// have been pinning panel ORDER from a test about a handoff.
	await expect(
		page.locator('.gx-scenarios .note').filter({ hasText: 'Your own sequence' })
	).toBeVisible();
});
