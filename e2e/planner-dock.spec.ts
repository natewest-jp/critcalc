import { test, expect, openTool } from './fixtures/critcalc';

/**
 * THE PHONE DOCK (mobile round, 2026-10-14 — docs/planner-mobile-round-2026-10-14.md).
 * Below `compact` the composer is MOVED to <body> and pinned to the screen's
 * foot, collapsed to one line until tapped.
 *
 * ⚠️ The navigation case is the one this spec exists for. Leaving the planner
 * does not destroy its page — the tool pan keeps it alive and Svelte PAUSES its
 * effects — so the first cut left the dock pinned over the Team Builder. Only a
 * browser could see that; it is guarded here.
 */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const TEAM = ['bennett', 'jean', 'diona', 'gorou'];

/** Where the composer lives: pinned on <body>, inline in its page, or gone. */
function composerHome(page: import('@playwright/test').Page) {
	return page.evaluate(() => {
		const c = document.querySelector('.rp-composer');
		if (!c) return 'gone';
		return c.parentElement === document.body ? 'docked' : 'inline';
	});
}

test('on a phone the composer docks, opens in one tap, and its key row types', async ({
	page,
	seed
}) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/planner');

	expect(await composerHome(page)).toBe('docked');
	const strip = page.locator('.rp-dock-strip');
	await expect(strip, 'collapsed on arrival').toBeVisible();

	await strip.tap();
	await expect(page.locator('.cm-content'), 'one tap focuses the editor').toBeFocused();

	// The caret sits at the end of Gorou's segment: the row offers his keys.
	const before = await page.locator('.cm-content').textContent();
	await page.locator('.rp-dock-key', { hasText: /^>$/ }).tap();
	await expect(page.locator('.cm-content')).toHaveText(`${before} > `);
	await expect(page.locator('.cm-content'), 'a key never takes focus').toBeFocused();

	// A tap outside collapses it.
	await page.touchscreen.tap(195, 300);
	await expect(strip).toBeVisible();
});

test('leaving the planner takes the dock with it, and coming back re-docks it', async ({
	page,
	seed
}) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/planner');
	expect(await composerHome(page)).toBe('docked');

	// The tool links are folded into the compass at this width; the link is
	// still in the DOM, and clicking it is an ordinary in-app navigation.
	await page.evaluate(() =>
		document.querySelector<HTMLAnchorElement>('a[href="/builder"]')?.click()
	);
	await page.waitForURL(/\/builder$/, { timeout: 10_000 });
	expect(await composerHome(page), 'not left pinned over the Builder').not.toBe('docked');

	await page.evaluate(() =>
		document.querySelector<HTMLAnchorElement>('a[href="/planner"]')?.click()
	);
	await page.waitForURL(/\/planner$/, { timeout: 10_000 });
	await expect.poll(() => composerHome(page)).toBe('docked');
	await expect(page.locator('.rp-composer'), 'one composer, never two').toHaveCount(1);
});
