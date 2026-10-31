import { test, expect, openSection, openTool, openRoster } from './fixtures/critcalc';

/**
 * Traveler portraits: Aether by default, Lumine on the stored setting, and the
 * profile's twin control persists what both read.
 *
 * Why this is promoted and not a one-off: a missing avatar SSRs a 404 `<img>`,
 * and prerender FAILS on those — so an avatar regression breaks the build, not
 * just a picture. Portraits are background-image divs since the Safari-26
 * img-regression fix, so the URL lives in the inline style, not a `src`.
 */

/**
 * How many Traveler element variants the roster carries — 7 since Cryo landed
 * 2026-08-31. ⚓ Every `traveler_*` id resolves to the SAME `aether`/`lumine`
 * portrait slug, so a new variant needs no new asset but does add a card here.
 * ⚠️ `ROSTER_SIZE` in team-builder.spec.ts does not cover this — a new Traveler
 * moves two e2e counts, and nothing else in the gate suite notices either.
 */
const TRAVELER_VARIANTS = 7;

/** The traveler cards' portrait URLs — one per element variant. */
async function travelerPortraits(page: import('@playwright/test').Page) {
	await openRoster(page);
	await page.locator('.tb-search-field').fill('traveler');
	const imgs = page.locator('.cg-grid .cc-img');
	await imgs.first().waitFor();
	return imgs.evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src));
}

test('defaults to Aether across every traveler card', async ({ page }) => {
	await openTool(page, '/builder');
	const srcs = await travelerPortraits(page);
	expect(srcs).toHaveLength(TRAVELER_VARIANTS);
	expect(
		srcs.every((s) => s.includes('aether')),
		`got ${srcs[0]}`
	).toBe(true);
});

test('the stored variant flips every portrait to Lumine', async ({ page, seed }) => {
	await seed({ settings: { travelerVariant: 'lumine' } });
	await openTool(page, '/builder');
	const srcs = await travelerPortraits(page);
	expect(srcs).toHaveLength(TRAVELER_VARIANTS);
	expect(
		srcs.every((s) => s.includes('lumine')),
		`got ${srcs[0]}`
	).toBe(true);
});

/**
 * ⚓ The twin is an ACCOUNT fact (profiles design §13.5): it lives on the
 * active profile, set on its Profile page, and a stored `travelerVariant`
 * migrates onto it. Persisted in IndexedDB, so a reload is the proof.
 */
test("the profile's Traveler control reflects and persists the twin", async ({ page, seed }) => {
	await seed({ settings: { travelerVariant: 'lumine' } });
	await openSection(page, '/profile');

	const seg = page.locator('.segment[role="radiogroup"][aria-label="Traveler"]');
	await expect(seg.locator('.btn.is-active'), 'reflects the migrated setting').toHaveText(
		/lumine/i
	);

	await seg.locator('.btn', { hasText: 'Aether' }).click();
	await expect(seg.locator('.btn.is-active')).toHaveText(/aether/i);

	await page.reload();
	await expect(seg.locator('.btn.is-active'), 'the click persisted').toHaveText(/aether/i);
});
