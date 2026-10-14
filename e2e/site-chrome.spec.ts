import { test, expect, openTool } from './fixtures/critcalc';
import type { Page } from '@playwright/test';

/**
 * ONE site chrome on every surface, and meta overlays that never move the URL.
 *
 * The no-URL-change assertions are the load-bearing ones: the tools layout keys
 * its page layer on `page.url.pathname`, so an overlay that moved the URL would
 * remount the whole tool underneath it (see chromeModal.svelte.ts). "The
 * planner is still mounted after the round trip" is the payoff being protected.
 *
 * Deliberately NOT here: the footer rule's sub-pixel geometry and the
 * responsive sidebar/tabs split. The first is visual (Nate's eyes, per the
 * policy); the second would pin breakpoint behavior that the upcoming mobile
 * round is meant to redraw.
 */

/**
 * ⚠ ADDRESSED BY aria-label, NOT BY INDEX (2026-09-04). These were `.chrome-btn`
 * nth(0..2) until the compass landed as a fourth button — hidden above 47.5rem,
 * but still first in the DOM, so every index here silently shifted by one and
 * pointed at the wrong overlay. A label is what the assertion actually means
 * and it cannot be reordered out from under the test.
 */
const META = [
	{ label: 'About', title: 'About' },
	{ label: 'Help', title: 'Help' },
	{ label: 'Settings', title: 'Settings' }
];

/** The meta glyphs a reader can actually press at this viewport. */
const metaBtn = (page: Page, label: string) => page.locator(`.chrome-btn[aria-label="${label}"]`);

test.describe('one chrome, every surface', () => {
	test('the brand, meta glyphs and tool switcher are consistent', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });
		const landingBrand = await page.locator('.chrome-brand').first().boundingBox();
		const landingBtns = await page.locator('.chrome-btn:visible').count();
		await expect(page.locator('.chrome-nav'), 'no tool switcher on the landing').toHaveCount(0);

		await openTool(page, '/planner');
		const toolBrand = await page.locator('.chrome-brand').first().boundingBox();
		const toolBtns = await page.locator('.chrome-btn:visible').count();
		await expect(page.locator('.chrome-nav'), 'the switcher appears inside a tool').toHaveCount(1);

		// ⚠ :visible, not a raw count. The compass is in the DOM on every surface
		// and display:none above 47.5rem, so a plain count reads 4 at the 1600px
		// test viewport and says nothing about what a reader can press.
		expect(landingBtns, 'three meta glyphs on the landing').toBe(3);
		// ↻ 2026-10-11: plus ROSTER inside a tool — it opens the Library, which is
		// the tools layout's overlay, so it exists exactly where that can open.
		expect(toolBtns, 'the same three plus Roster inside a tool').toBe(4);
		await expect(metaBtn(page, 'Roster'), 'Roster sits in the tool chrome').toBeVisible();
		await expect(
			page.locator('.chrome-btn--nav'),
			'the compass is the narrow form and stays hidden at desk width'
		).toBeHidden();
		// The brand is one object that does not jump between surfaces.
		expect(landingBrand).toBeTruthy();
		expect(toolBrand).toBeTruthy();
		for (const side of ['x', 'y', 'width', 'height'] as const) {
			expect(Math.abs(landingBrand![side] - toolBrand![side]), `brand ${side}`).toBeLessThan(1);
		}
	});
});

test.describe('meta overlays never navigate', () => {
	for (const surface of ['/', '/builder']) {
		for (const { label, title } of META) {
			test(`${surface} — "${title}" opens and closes without moving the URL`, async ({ page }) => {
				await page.goto(surface, { waitUntil: 'networkidle' });
				const before = page.url();

				await metaBtn(page, label).click();
				const dialog = page.locator('[role="dialog"]');
				await expect(dialog).toHaveAttribute('aria-label', title);
				expect(page.url(), 'the overlay left the URL alone').toBe(before);

				await page.keyboard.press('Escape');
				await expect(dialog).toHaveCount(0);
				expect(page.url()).toBe(before);
			});
		}
	}
});

test.describe('help is contextual and non-destructive', () => {
	test('the "?" opens the current tool\'s chapter and never remounts it', async ({ page }) => {
		await openTool(page, '/planner');
		await metaBtn(page, 'Help').click();
		await page.locator('.area-chapter.is-current').waitFor();

		await expect(page.locator('.area-chapter.is-current')).toHaveText('Rotation Planner');
		await expect(page.locator('.area-body h1'), 'the chapter body rendered').toHaveText(
			'Rotation Planner'
		);

		// Switching chapters inside the overlay must not navigate either.
		const before = page.url();
		await page.locator('.area-chapter', { hasText: 'Team Builder' }).click();
		await expect(page.locator('.area-body h1')).toHaveText('Team Builder');
		expect(page.url(), 'switching chapters does not navigate').toBe(before);

		await page.keyboard.press('Escape');
		// The payoff of never moving the URL: the tool survived the round trip.
		await expect(page.locator('.tool-page')).toHaveCount(1);
		await expect(page.locator('.chrome-nav-link.is-current')).toHaveText('Planner');
	});
});

test.describe('overlay containing blocks', () => {
	/**
	 * The NEGATIVE space is what is load-bearing: neither the panel nor the
	 * backdrop may carry a transform, because a transformed ancestor becomes a
	 * containing block and traps the `position: fixed` panel. (Cursor parallax
	 * itself retired with the ascend rebuild.)
	 */
	const untransformed = (t: string) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';

	async function overlayTransforms(page: Page, url: string) {
		await page.goto(url, { waitUntil: 'networkidle' });
		await metaBtn(page, 'Help').click();
		await page.locator('.overlay-panel').waitFor();
		await page.mouse.move(200, 200);
		await page.mouse.move(1400, 800);
		return page.evaluate(() => ({
			panel: getComputedStyle(document.querySelector('.overlay-panel')!).transform,
			backdrop: getComputedStyle(document.querySelector('.overlay-backdrop')!).transform
		}));
	}

	for (const [label, url] of [
		['landing', '/'],
		['tool', '/planner']
	]) {
		test(`${label}: panel and backdrop carry no transform`, async ({ page }) => {
			const t = await overlayTransforms(page, url);
			expect(untransformed(t.panel), `panel=${t.panel}`).toBe(true);
			expect(untransformed(t.backdrop), `backdrop=${t.backdrop}`).toBe(true);
		});
	}
});

test.describe('every chapter is also a real route', () => {
	const ROUTES: [string, string][] = [
		['/help', 'Help & FAQ'],
		['/help/builder', 'Team Builder'],
		['/help/planner', 'Rotation Planner'],
		['/help/visualizers', 'Visualizers'],
		['/about', 'About critcalc'],
		['/contribute', 'Contribute'],
		['/privacy', 'Privacy']
	];

	for (const [route, heading] of ROUTES) {
		test(`${route} stands alone`, async ({ page }) => {
			await page.goto(route, { waitUntil: 'networkidle' });
			await expect(page.locator('.area-body h1').first()).toHaveText(heading);
		});
	}

	test('/faq redirects to /help', async ({ page }) => {
		await page.goto('/faq', { waitUntil: 'networkidle' });
		expect(new URL(page.url()).pathname).toBe('/help');
	});
});
