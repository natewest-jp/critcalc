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

/**
 * ⛔ THE PLANNER'S SOURCE OVERLAY WAS RETIRED 2026-08-13, and the two specs that
 * drove it went with it: one edited the team through the in-frame grid, one
 * followed the picker's "← Explore alternatives" chip. Both described a picker
 * that could only fill the LOWEST EMPTY SLOT. What replaced them is one errand:
 * ⇄ on a bench card hands the SLOT to the Team Builder's audition (?swap=N),
 * and a commit there returns to the planner.
 */

test("the planner's ⇄ hands its slot to the Team Builder's audition", async ({ page, seed }) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/rotation-planner');

	// ↻ 2026-08-12: the portrait does not change the slot — it opens the
	// character's Detail card, the same as on the Team Builder. ⇄ is what
	// changes who fills a slot, and since 2026-08-13 it leaves the tool.
	await page.locator('.sp-avatar-chip').first().click();
	await expect(page.locator('.dc-backdrop'), 'the portrait reads the character').toHaveCount(1);
	await page.keyboard.press('Escape');
	await expect(page.locator('.dc-backdrop')).toHaveCount(0);

	await page.locator('.bb-act[aria-label="Change who fills this slot"]').first().click();
	await page.locator('.tb-source').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(1400); // the pan + band travel

	// The audition opened on the slot that was clicked, with its occupant pinned.
	await expect(
		page.locator('.cmp[aria-label="Audition replacements"]'),
		'⇄ lands on the audition, not the Atlas'
	).toHaveCount(1);
	await expect(page.locator('.cmp-chip-current'), 'the incumbent is pinned').toHaveCount(1);

	// ?swap= is consumed on arrival like every other inbound param.
	expect(page.url(), 'the param is stripped after reading').not.toContain('swap=');
	expect(await benchNames(page), 'the same working team came along by itself').toHaveLength(4);
});

test('committing an audition returns to the planner; cancelling stays with a way back', async ({
	page,
	seed
}) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/rotation-planner');
	await page.locator('.bb-act[aria-label="Change who fills this slot"]').first().click();
	await page.locator('.cmp[aria-label="Audition replacements"]').waitFor({ timeout: 10_000 });

	// CANCEL: the errand's auto-return is discharged, the way back is not.
	const back = page.locator('button[title="Return to the rotation planner"]');
	await expect(back, 'arriving on an errand plants the return plate').toHaveCount(1);
	await page.locator('.cmp-headact').click();
	await expect(page.locator('.cmp[aria-label="Audition replacements"]')).toHaveCount(0);
	await expect(back, 'cancelling leaves you here, and leaves the plate').toHaveCount(1);
	expect(page.url(), 'cancelling does not navigate').toContain('team-builder');

	// ⚠ THE RETURN TRIP IS PART OF THE SETUP, not decoration. The auto-return is
	// scoped to the audition the ERRAND opened — the Team Builder's own ⇄ opens
	// an audition that commits in place, which is the whole point of the scoping
	// (a commit two auditions later must not yank you out of a tool you decided
	// to stay in). So a second errand has to start where errands start.
	await back.click();
	await page.waitForURL(/rotation-planner/, { timeout: 10_000 });
	await page.waitForTimeout(1400); // the pan + band travel

	// COMMIT: open the errand again, add a candidate, use it.
	// ⚠ THIS SECOND ⇄ IS THE REGRESSION GUARD, not setup noise. It is an A→B→A
	// trip, and Svelte REVIVES the planner rather than re-mounting it — so the
	// page never re-registers its bench affordances, and a single-slot host
	// register left the bench hostless the moment the Team Builder finally tore
	// down. ⇄ went dead on a tool that looked perfectly fine. Measured on
	// 847acdb, so the hole predates the Source retirement; keyed registration
	// (BenchBandState#hosts) is the fix, and this click is what proves it.
	await page.locator('.bb-act[aria-label="Change who fills this slot"]').first().click();
	await page.locator('.cmp[aria-label="Audition replacements"]').waitFor({ timeout: 10_000 });
	await page.locator('.tb-cand').first().click();
	await page.locator('.cmp-chip-commit').first().click();

	await page.waitForURL(/rotation-planner/, { timeout: 10_000 });
	expect(
		await benchNames(page),
		'the slot was written before the trip back — the team is shared state, not a payload'
	).toHaveLength(4);
});
