import { test, expect, openSection, openTool } from './fixtures/critcalc';
import type { Page } from '@playwright/test';

/**
 * ONE top bar on every surface, and the menu state's addresses.
 *
 * ⚓ Every section has its own address WITHOUT remounting the tool
 * (docs/menu-state-round.md, design §13.4): over a tool a section is a
 * SHALLOW history entry, so the address bar, Back and a copied link name the
 * section while the tools layout's `{#key}` still names the tool. ONE Escape
 * returns to the tool however many sections the visit passed through; Back
 * steps through them. "The tool is the same element after the round trip" is
 * the payoff being protected: a remount would throw away its state.
 *
 * ↻ 2026-10-29 (the e2e rewrite for the flip): replaces the old site chrome's
 * spec. Retired with that chrome: the compass/meta-glyph counts, the About
 * glyph's aria-current, the `/library` page's tabs, and the overlay-transform
 * check (its ChromeOverlay is unreachable now; the menu state is one host in
 * the scene layout, outside every transformed layer).
 */

const door = (page: Page, label: string) => page.locator(`.tb-glyph[aria-label="${label}"]`);
const menuState = (page: Page) => page.locator('div.menu');
const path = (page: Page) => new URL(page.url()).pathname;

/** Tag the mounted tool so a remount (a fresh element) is detectable. */
async function markTool(page: Page) {
	await page
		.locator('.tool-main')
		.first()
		.evaluate((el) => el.setAttribute('data-e2e-mark', '1'));
}
const markedTool = (page: Page) => page.locator('.tool-main[data-e2e-mark="1"]');

test.describe('one top bar, every surface', () => {
	test('the brand holds still from the landing into a tool', async ({ page }) => {
		await page.goto('/');
		const landing = await page.locator('.tb-home').boundingBox();
		await openTool(page, '/planner');
		const tool = await page.locator('.tb-home').boundingBox();
		expect(landing).toBeTruthy();
		expect(tool).toBeTruthy();
		for (const side of ['x', 'y', 'width', 'height'] as const) {
			expect(Math.abs(landing![side] - tool![side]), `brand ${side}`).toBeLessThan(1);
		}
		await expect(page.locator('.nav-btn.is-current'), 'the current tool is marked').toHaveText(
			/Planner/
		);
	});
});

test.describe('a section over a tool', () => {
	test('Settings takes its address, and one Escape returns to the same tool', async ({ page }) => {
		await openTool(page, '/builder');
		await markTool(page);

		await door(page, 'Settings').click();
		await expect(menuState(page)).toBeVisible();
		expect(path(page), 'the section names itself in the address').toBe('/settings');

		await page.keyboard.press('Escape');
		await expect(menuState(page)).toBeHidden();
		expect(path(page)).toBe('/builder');
		await expect(markedTool(page), 'the tool was never remounted').toHaveCount(1);
	});

	test("Help opens the current tool's chapter; switching chapters stays in place", async ({
		page
	}) => {
		await openTool(page, '/planner');
		await markTool(page);

		await door(page, 'Help and About').click();
		await page.locator('.mi', { hasText: 'Help' }).click();
		await expect(menuState(page).locator('.body h1').first()).toHaveText('Rotation planner');
		expect(path(page)).toBe('/help/planner');

		await menuState(page).locator('.side-subitem', { hasText: 'Team builder' }).click();
		await expect(menuState(page).locator('.body h1').first()).toHaveText('Team builder');
		expect(path(page)).toBe('/help/builder');

		// Back steps through the sections; Escape leaves them all at once.
		await page.goBack();
		await expect(menuState(page).locator('.body h1').first()).toHaveText('Rotation planner');
		await menuState(page).locator('.side-item', { hasText: 'Settings' }).click();
		expect(path(page)).toBe('/settings');

		await page.keyboard.press('Escape');
		await expect(menuState(page)).toBeHidden();
		expect(path(page)).toBe('/planner');
		await expect(markedTool(page), 'the tool was never remounted').toHaveCount(1);
		await expect(page.locator('.nav-btn.is-current')).toHaveText(/Planner/);
	});

	test('on the landing, Settings opens over it and Escape goes home', async ({ page }) => {
		await page.goto('/');
		await door(page, 'Settings').click();
		await expect(menuState(page)).toBeVisible();
		expect(path(page)).toBe('/settings');
		await page.keyboard.press('Escape');
		await expect(menuState(page)).toBeHidden();
		expect(path(page)).toBe('/');
	});
});

test.describe('the Library', () => {
	test('opening a rotation arrives on the Planner with it', async ({ page, seed }) => {
		// A saved rotation in the old storage migrates into the profile's
		// documents on the first load (storage/boot.ts).
		await seed({
			saved: [
				{
					id: 's1',
					name: 'Library e2e',
					notation: 'Hu Tao E N3 Q > Xingqiu E Q > Zhongli E',
					tabLoadout: {},
					tabCon: {},
					savedAt: 1754500000000
				}
			]
		});
		await openSection(page, '/library/rotations');
		await menuState(page).getByText('Library e2e').first().click();
		await page.waitForURL('**/planner');
		await page.locator('.tool-main').waitFor({ state: 'visible' });
		await expect(page.locator('.cm-content').first()).toHaveText(
			'Hu Tao E N3 Q > Xingqiu E Q > Zhongli E'
		);
	});
});

test.describe('every section is also a real route', () => {
	const ROUTES: [string, string][] = [
		['/help', 'Help & FAQ'],
		['/help/builder', 'Team builder'],
		['/help/planner', 'Rotation planner'],
		['/help/visualizers', 'Visualizers'],
		['/about', 'About critcalc'],
		['/changelog', 'What’s new'],
		['/contribute', 'Contribute'],
		['/privacy', 'Privacy']
	];

	for (const [route, heading] of ROUTES) {
		test(`${route} stands alone`, async ({ page }) => {
			await openSection(page, route);
			await expect(menuState(page).locator('.body h1').first()).toHaveText(heading);
		});
	}

	test('/faq redirects to /help', async ({ page }) => {
		await page.goto('/faq');
		await expect.poll(() => path(page)).toBe('/help');
	});
});
