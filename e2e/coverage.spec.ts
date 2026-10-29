import { test, expect, openSection, openTool, CHARACTER_COUNT } from './fixtures/critcalc';

/**
 * The coverage page at the browser surface (docs/rounds/coverage-round.md §8; the
 * 390px run is the narrow-width smoke the responsive survey proposed, ⚓ Nate
 * approved 2026-09-22). It guards what no unit test can see: the list renders
 * every character, search and the deep link narrow it, a row's details open in
 * place, the phone layout does not scroll sideways, and a link from a tool opens
 * the list OVER the tool instead of navigating away from it.
 */

for (const [label, viewport] of [
	['wide', { width: 1600, height: 1000 }],
	['narrow', { width: 390, height: 844 }]
] as const) {
	test.describe(`coverage — ${label}`, () => {
		test.use({ viewport });

		test('lists every character, search narrows it, a row opens in place', async ({ page }) => {
			await openSection(page, '/coverage');
			const rows = page.locator('.cov-row');
			await expect(rows).toHaveCount(CHARACTER_COUNT);

			await page.getByRole('searchbox', { name: 'Search characters' }).fill('bennett');
			await expect(rows).toHaveCount(1);

			await rows.first().locator('.row-button').click();
			await expect(rows.first().locator('.row-details .detail').first()).toBeVisible();

			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - window.innerWidth
			);
			expect(overflow).toBe(0);
		});

		test('a ?c= link shows exactly its characters, and Show all returns', async ({ page }) => {
			await openSection(page, '/coverage?c=bennett,xiangling,nobody');
			const rows = page.locator('.cov-row');
			await expect(rows).toHaveCount(2);
			await expect(page.locator('.row-details')).toHaveCount(2);

			await page.getByRole('button', { name: 'Show all characters' }).click();
			await expect(rows).toHaveCount(CHARACTER_COUNT);
		});
	});
}

/**
 * ↻ 2026-10-29 (the flip): the link lives on the Planner's INSPECTOR (what
 * Notes became), and Coverage opens as a menu-state section over the tool:
 * its own address, the tool kept mounted, one Escape back.
 */
test('a coverage link opens over the tool, and closing it stays on the tool', async ({
	page,
	seed
}) => {
	await seed({ team: { slots: ['baizhu', 'bennett'], notation: 'Baizhu E Q > Bennett E Q' } });
	await openTool(page, '/planner');
	await page.locator('.tool-main').evaluate((el) => el.setAttribute('data-e2e-mark', '1'));
	await page.locator('.rp-notes-btn', { hasText: 'Inspector' }).click();
	await page.getByRole('link', { name: 'Coverage for this team' }).click();

	await expect(page.locator('div.menu .cov-row')).toHaveCount(2);
	await page.keyboard.press('Escape');
	await expect(page.locator('div.menu')).toBeHidden();
	await expect(page).toHaveURL(/\/planner$/);
	await expect(page.locator('.tool-main[data-e2e-mark="1"]'), 'never remounted').toHaveCount(1);
});
