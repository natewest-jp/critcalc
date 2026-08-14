import { test, expect } from './fixtures/critcalc';

/**
 * The abyssal loading veil, site-wide.
 *
 * The load-bearing half is that the veil is in the SERVED SSR HTML of every
 * surface — it moved from the landing page to the scene layout on 2026-07-26 so
 * a tool's restored state stops blinking in — and that it always clears again,
 * including when JavaScript never runs at all.
 *
 * Not covered here: the HRule's sub-pixel math (visual — Nate's eyes) and the
 * scene-vs-tool dismissal FLOOR comparison, which is a timing race that headless
 * timing cannot judge honestly.
 */

const SURFACES = ['/', '/about', '/rotation-planner', '/team-builder', '/visualizers'];

test.describe('served markup', () => {
	for (const path of SURFACES) {
		test(`${path} ships the veil in its SSR HTML`, async ({ page }) => {
			// Read the SERVED body off the navigation response rather than via the
			// `request` fixture — one fewer context, and `response.text()` is the
			// pre-hydration HTML either way, which is exactly what this asserts.
			// (Swapping this was also a failed attempt at the teardown hang noted
			// in `playwright.config.ts`; it is kept for simplicity, not as a fix.)
			const response = await page.goto(path);
			const html = await response!.text();
			expect(html, 'the veil must paint before hydration, so it has to be in the HTML').toContain(
				'id="loading-veil"'
			);
		});
	}
});

test.describe('lifecycle', () => {
	test('a hard load paints the veil, then removes it after hydration', async ({ page }) => {
		await page.goto('/rotation-planner');
		// It may already be gone by the time we look on a fast machine — what must
		// hold is that it does not LINGER.
		await expect(page.locator('#loading-veil')).toHaveCount(0, { timeout: 15_000 });
	});

	test('an SPA navigation never brings it back', async ({ page }) => {
		await page.goto('/rotation-planner', { waitUntil: 'networkidle' });
		await expect(page.locator('#loading-veil')).toHaveCount(0, { timeout: 15_000 });

		let reappeared = false;
		for (const link of ['Teams', 'Visualizers']) {
			await page.locator('.chrome-nav a', { hasText: link }).click();
			await page.waitForTimeout(600);
			if (await page.locator('#loading-veil').count()) reappeared = true;
			await page.waitForTimeout(2200);
		}
		expect(reappeared, 'the veil is a first-load object, not a transition').toBe(false);
	});

	test('reduced motion still dismisses it', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		await expect(page.locator('#loading-veil')).toHaveCount(0, { timeout: 15_000 });
	});
});

/**
 * The veil is inert markup until hydration removes it — so if JS never runs,
 * only the pure-CSS bail stands between a reader and a permanently covered
 * page. That failure mode is invisible in every other test here.
 *
 * ⚠ `test.use` rather than a hand-rolled `browser.newContext()`: taking the
 * `browser` fixture pins a browser handle to the WORKER, and workers that
 * outlive their spec then hang Playwright's teardown for its full 5-minute
 * force-kill timeout — all tests green, exit code 1, six-minute runs.
 */
test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the CSS bail animation clears the veil on its own', async ({ page }) => {
		await page.goto('/');
		const veil = page.locator('#loading-veil');
		await expect(veil, 'without JS the element stays in the DOM').toHaveCount(1);
		await expect(veil, 'but the CSS animation must still uncover the page').toBeHidden({
			timeout: 15_000
		});
	});
});
