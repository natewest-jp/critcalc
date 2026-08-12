import { test, expect, openTool, benchNames } from './fixtures/critcalc';

/**
 * ONE WORKING TEAM: the planner and the Team Builder edit the same active
 * rotation tab, so the team travels between them by itself. The old `?team=`
 * cross-injection is retired — this is the behavior that replaced it, and the
 * assertion that matters is that NO URL hand-off is involved.
 */

const TEAM = ['bennett', 'jean', 'diona', 'gorou'];
const NAMES = ['Bennett', 'Jean', 'Diona', 'Gorou'];

test('the working team survives a tool→tool crane with no URL hand-off', async ({ page, seed }) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/team-builder');
	expect(await benchNames(page)).toHaveLength(4);

	await page.locator('.chrome-nav a[href*="rotation-planner"]').click();
	await page.waitForTimeout(1400); // the pan + band travel

	const planner = await benchNames(page);
	expect(planner, 'the planner finds the SAME team already slotted').toEqual(
		expect.arrayContaining(NAMES)
	);
	expect(page.url(), 'no ?team= anywhere in the trip').not.toContain('team=');
});

test('the planner Source overlay edits the shared team live', async ({ page, seed }) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/rotation-planner');

	// ↻ 2026-08-12: the portrait no longer opens the Source — it opens the
	// character's Detail card, the same as on the Team Builder. ⇄ is what
	// changes who fills a slot, in both tools.
	await page.locator('.sp-avatar-chip').first().click();
	await expect(page.locator('.dc-backdrop'), 'the portrait reads the character').toHaveCount(1);
	await page.keyboard.press('Escape');
	await expect(page.locator('.dc-backdrop')).toHaveCount(0);

	await page.locator('.bb-act[aria-label="Change who fills this slot"]').first().click();
	await page.locator('.cs-panel').waitFor();

	// In-frame and non-modal — it lives inside the tool frame, not over it.
	await expect(page.locator('.rp-source-overlay .cs-panel')).toHaveCount(1);
	// ⚠ POLLED, not a snapshot. The roster mounts through createProgressiveReveal
	// — ~123 tiles appended in rAF batches — so `await …count()` reads whatever
	// happened to exist in that one frame and the number depends on how loaded
	// the machine is. It was measured failing at 72/100 on WebKit under load, on
	// main, with no product change involved. The assertion's INTENT is "the
	// overlay renders the grid", which becomes true a beat later; expect.poll
	// says that, a bare count says "…within one frame", which was never meant.
	await expect
		.poll(() => page.locator('.cc').count(), { message: 'the overlay renders the grid' })
		.toBeGreaterThan(100);
	await expect(page.locator('.cc-slot'), 'the current team shows as four badges').toHaveCount(4);

	// Live edit: deselecting frees a slot immediately, with no Confirm step.
	await page.locator('.cc-main[aria-pressed="true"]').first().click();
	await expect(page.locator('.cc-slot')).toHaveCount(3);
	await page.locator('.cc', { hasText: 'Bennett' }).first().click();
	await expect(page.locator('.cc-slot'), 're-adding refills the slot').toHaveCount(4);

	await page.locator('.cs-close-btn').click();
	// The Source stays MOUNTED after first open (Safari-26 remount-stall fix), so
	// "closed" means hidden, not removed — a visibility check, not a count.
	await expect(page.locator('.cs-panel')).toBeHidden();
});

test('"Explore alternatives" hands off to the per-slot view, team already shared', async ({
	page,
	seed
}) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/rotation-planner');

	// The hand-off rides the picker's own bottom edge — it is tied to choosing
	// team members and is unreachable from the main surface.
	await expect(page.locator('.rp-explore-link')).toBeHidden();
	// ⇄, not the portrait — the portrait reads the character now (2026-08-12).
	await page.locator('.bb-act[aria-label="Change who fills this slot"]').first().click();
	await page.locator('.rp-explore-link').waitFor();

	// The team no longer rides the URL; `?alts=1` only requests the view.
	expect(await page.locator('.rp-explore-link').getAttribute('href')).toBe('/team-builder?alts=1');

	await page.locator('.rp-explore-link').click();
	await page.locator('.tb-source').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(1400); // the pan + band travel

	expect(await benchNames(page), 'the same working team arrived').toHaveLength(4);
	expect(
		await page.locator('.tb-slotrow').count(),
		'arrival opens the per-slot alternatives view'
	).toBeGreaterThan(0);
});
