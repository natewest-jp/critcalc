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
 * The instrument pickers, in slot order. Since the toolbar round they live in
 * BAND B, whose cells are laid out on the tile grid's own columns in slot order
 * — so the band IS the left-to-right reading.
 */
const triggers = (page: Page) => page.locator('.ws-band-cell .ip-trigger');

/**
 * Assert the whole lineup. `toHaveText` with an ARRAY checks the count and the
 * text together and retries until both settle — a one-shot read races the
 * second tile's lazy mount and sees a one-instrument lineup. (It did exactly
 * that on the first run of this spec.) Regexes, because each trigger's text
 * ends in whitespace around its mark.
 */
const expectLineup = (page: Page, names: string[]) =>
	expect(triggers(page)).toHaveText(names.map((n) => new RegExp(n)));

test.describe('lineup and slots', () => {
	test('first load shows the default two-slot lineup', async ({ page }) => {
		await openTool(page, '/visualizers');
		await expectLineup(page, ['Crit Heatmap', 'Gauge Explorer']);

		const actions = page.locator('.ws-band-actions .btn');
		await expect(actions.filter({ hasText: 'Share' }), 'share on both cells').toHaveCount(2);
		// "Reset" became "Defaults" in the toolbar round — it sat one word away
		// from the workspace-level "Reset workspace" with no way to tell them apart.
		await expect(actions.filter({ hasText: 'Defaults' })).toHaveCount(2);
	});

	test('picking an already-visible instrument swaps the two tiles', async ({ page }) => {
		await openTool(page, '/visualizers');
		await page.locator('.ws-band-cell').first().locator('.ip-trigger').click();

		await expect(page.locator('.ip-menu .ip-option'), 'all eight instruments').toHaveCount(8);
		await expect(
			page.locator('.ip-menu .ip-option', { hasText: 'Slot 2' }),
			'the other slot’s instrument carries a swap badge'
		).toContainText('Gauge');

		await page.locator('.ip-menu .ip-option', { hasText: 'Gauge Explorer' }).click();
		await expectLineup(page, ['Gauge Explorer', 'Crit Heatmap']);
		await expect(page.locator('.ip-menu')).toHaveCount(0);
	});

	test('the layout survives a reload and resets on demand', async ({ page }) => {
		await openTool(page, '/visualizers');
		await page.locator('.ws-band-cell').first().locator('.ip-trigger').click();
		await page.locator('.ip-menu .ip-option', { hasText: 'Gauge Explorer' }).click();

		await page.reload({ waitUntil: 'networkidle' });
		await expectLineup(page, ['Gauge Explorer', 'Crit Heatmap']); // the swap persisted

		await page.locator('.ws-reset').click();
		await expectLineup(page, ['Crit Heatmap', 'Gauge Explorer']);
		const stored = await page.evaluate(
			(k) => JSON.parse(localStorage.getItem(k) ?? 'null'),
			WORKSPACE_KEY
		);
		expect(stored?.v).toBe(1);
		expect(stored?.assignment?.[0], 'the reset persisted too').toBe('crit');
	});
});

test.describe('deep links', () => {
	test('a bare ?i= slots its instrument first and strips the param', async ({ page }) => {
		await openTool(page, '/visualizers?i=rolls');
		await expect(triggers(page).first()).toHaveText(/Artifact Rolls/);
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
		await expect(triggers(page).first()).toHaveText(/Crit Heatmap/);
		await expect(page.locator('.cv-value-input').first(), 'shared CR applied').toHaveValue('90');

		// Per-instrument "Defaults" restores that tile's own controls.
		await page
			.locator('.ws-band-cell')
			.first()
			.locator('.ws-band-actions .btn', { hasText: 'Defaults' })
			.click();
		await expect(page.locator('.cv-value-input').first(), 'CR back to its default').toHaveValue(
			'70'
		);
	});
});

test('the ICD timeline hands its hits off to a Gauge tile beside it', async ({ page }) => {
	await openTool(page, '/visualizers?i=icd');
	await expect(triggers(page).first()).toHaveText(/ICD Timeline/);

	const applying = parseInt(await page.locator('.icd-big').first().innerText(), 10);
	await page.locator('.icd-send').click();

	// The gauge opens BESIDE the source, not over it.
	await expectLineup(page, ['ICD Timeline', 'Gauge Explorer']);
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
		page.locator('.gx-panels .note').filter({ hasText: 'Custom sequence' })
	).toBeVisible();
});
