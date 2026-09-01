import { test, expect, openTool, openRoster, KEYS } from './fixtures/critcalc';

/**
 * Traveler portraits: Aether by default, Lumine on the stored setting, and the
 * settings control writes the same key both read.
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

/** The traveler cards' background-image URLs — one per element variant. */
async function travelerPortraits(page: import('@playwright/test').Page) {
	await openRoster(page);
	await page.locator('.cg-rail .field').fill('traveler');
	const imgs = page.locator('.cg-grid .cc-img');
	await imgs.first().waitFor();
	return imgs.evaluateAll((els) => els.map((e) => (e as HTMLElement).style.backgroundImage));
}

test('defaults to Aether across every traveler card', async ({ page }) => {
	await openTool(page, '/team-builder');
	const srcs = await travelerPortraits(page);
	expect(srcs).toHaveLength(TRAVELER_VARIANTS);
	expect(
		srcs.every((s) => s.includes('aether')),
		`got ${srcs[0]}`
	).toBe(true);
});

test('the stored variant flips every portrait to Lumine', async ({ page, seed }) => {
	await seed({ settings: { travelerVariant: 'lumine' } });
	await openTool(page, '/team-builder');
	const srcs = await travelerPortraits(page);
	expect(srcs).toHaveLength(TRAVELER_VARIANTS);
	expect(
		srcs.every((s) => s.includes('lumine')),
		`got ${srcs[0]}`
	).toBe(true);
});

test('the settings control reflects and persists the variant', async ({ page, seed }) => {
	await seed({ settings: { travelerVariant: 'lumine' } });
	await page.goto('/settings', { waitUntil: 'networkidle' });

	// Scoped to the Traveler segment — the consolidated SettingsPanel renders
	// several `.sp-segment` radiogroups.
	const seg = page.locator('.sp-segment[aria-label="Traveler variant"]');
	// Segment buttons render UPPERCASE (control voice) — compare case-insensitively.
	const options = (await seg.locator('.btn').allInnerTexts()).map((t) => t.toLowerCase());
	expect(options).toEqual(expect.arrayContaining(['aether', 'lumine']));

	const active = await seg.locator('.btn.is-active').innerText();
	expect(active.toLowerCase(), 'active option reflects the stored setting').toBe('lumine');

	await seg.locator('.btn', { hasText: 'Aether' }).click();
	const stored = await page.evaluate(
		(k) => JSON.parse(localStorage.getItem(k) ?? '{}').travelerVariant,
		KEYS.settings
	);
	expect(stored, 'the click persisted').toBe('aether');
});
