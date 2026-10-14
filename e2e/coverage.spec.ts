import { test, expect, CHARACTER_COUNT } from './fixtures/critcalc';

/**
 * The coverage page at the browser surface (docs/coverage-round.md §8; the
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
			await page.goto('/coverage');
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
			await page.goto('/coverage?c=bennett,xiangling,nobody');
			const rows = page.locator('.cov-row');
			await expect(rows).toHaveCount(2);
			await expect(page.locator('.row-details')).toHaveCount(2);

			await page.getByRole('button', { name: 'Show all characters' }).click();
			await expect(rows).toHaveCount(CHARACTER_COUNT);
		});
	});
}

test('a coverage link opens over the tool, and closing it stays on the tool', async ({
	page,
	seed
}) => {
	await seed({ team: { slots: ['baizhu', 'bennett'], notation: 'Baizhu E Q > Bennett E Q' } });
	await page.goto('/planner');
	await page.getByRole('button', { name: 'Toggle notes panel' }).click();
	await page.getByRole('link', { name: 'Coverage for this team' }).click();

	await expect(page.locator('.overlay-panel .cov-row')).toHaveCount(2);
	await expect(page).toHaveURL(/\/planner$/);

	await page.keyboard.press('Escape');
	await expect(page.locator('.overlay-panel')).toHaveCount(0);
	await expect(page).toHaveURL(/\/planner$/);
});
