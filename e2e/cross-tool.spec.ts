import { test, expect, openTool, benchNames } from './fixtures/critcalc';

/**
 * ↻ 2026-10-08 (lineups design §2.1): the Team Builder no longer edits the
 * Planner's working team — it builds BOARDS of several teams, and has no
 * bench. What still crosses between the tools is the ⇄ errand (?swap=N),
 * which edits the Planner's own tab.
 */

const TEAM = ['bennett', 'jean', 'diona', 'gorou'];
const NAMES = ['Bennett', 'Jean', 'Diona', 'Gorou'];

test('the bench leaves on the way to the Builder and comes back with the team', async ({
	page,
	seed
}) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/planner');
	expect(await benchNames(page)).toHaveLength(4);

	await page.locator('.chrome-nav a[href*="builder"]').click();
	await page.waitForURL(/builder/, { timeout: 10_000 });
	await page.waitForTimeout(1400); // the pan + band travel
	await expect(page.locator('.bench-band-mount'), 'the Builder has no bench').toBeHidden();

	await page.locator('.chrome-nav a[href*="planner"]').click();
	await page.waitForURL(/planner/, { timeout: 10_000 });
	await page.waitForTimeout(1400);
	const planner = await benchNames(page);
	expect(planner, 'the planner’s team is untouched by the trip').toEqual(
		expect.arrayContaining(NAMES)
	);
	expect(page.url(), 'no ?team= anywhere in the trip').not.toContain('team=');
});

/**
 * ⛔ THE PLANNER'S SOURCE OVERLAY WAS RETIRED 2026-08-13: ⇄ on a bench card
 * hands the SLOT to the Team Builder (?swap=N). ↻ 2026-10-13 it lands in SWAP
 * MODE — the Planner's team as a temporary row on top of the lineup, already
 * swapping the slot (lineups design §10.3, §11.6 item 20).
 */

const ERRAND = '.bv-team--errand';
/** The portrait of a FILLED card — on the desk it IS Swap (2026-10-13, the
 *  Builder card's grammar: the portrait acts, the magnifier reads). */
const SWAP = '.bench-band-mount .sp-side-hit[aria-label^="Swap "]';

test("the planner's ⇄ opens swap mode on its own team", async ({ page, seed }) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/planner');

	// ↻ 2026-10-13: the MAGNIFIER reads the character (shown on hover), and
	// the portrait itself is Swap.
	await page.locator('.bench-band-mount .sp-avatar-chip').first().hover();
	await page.locator('.bench-band-mount .sp-mag').first().click();
	await expect(page.locator('.dc-backdrop'), 'the magnifier reads the character').toHaveCount(1);
	await page.keyboard.press('Escape');
	await expect(page.locator('.dc-backdrop')).toHaveCount(0);

	await page.locator(SWAP).first().click();
	await page.locator(ERRAND).waitFor({ timeout: 10_000 });
	await expect(page.locator('.tb-dest')).toHaveText(/Replacing Bennett/);
	await expect(page.locator(`${ERRAND} .bv-slot--swap`), 'the slot that was clicked').toHaveCount(
		1
	);

	// ?swap= is consumed on arrival like every other inbound param.
	expect(page.url(), 'the param is stripped after reading').not.toContain('swap=');
});

test('Cancel returns unchanged; a pick renames in the planner and returns', async ({
	page,
	seed
}) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/planner');
	await page.locator(SWAP).first().click();
	await page.locator(ERRAND).waitFor({ timeout: 10_000 });

	await page.locator(ERRAND).getByRole('button', { name: 'Cancel' }).click();
	await page.waitForURL(/planner/, { timeout: 10_000 });
	await page.waitForTimeout(1400); // the pan + band travel
	expect(await benchNames(page), 'Cancel changes nothing').toEqual(NAMES);

	// ⚠ THIS SECOND ⇄ IS THE REGRESSION GUARD, not setup noise. It is an A→B→A
	// trip, and Svelte REVIVES the planner rather than re-mounting it — so the
	// page never re-registers its bench affordances, and a single-slot host
	// register left the bench hostless the moment the Team Builder finally tore
	// down. Keyed registration (BenchBandState#hosts) is the fix, and this click
	// is what proves it.
	await page.locator(SWAP).first().click();
	await page.locator(ERRAND).waitFor({ timeout: 10_000 });
	await page.locator('.cc', { hasText: 'Furina' }).first().locator('.cc-main').click();

	await page.waitForURL(/planner/, { timeout: 10_000 });
	const names = await benchNames(page);
	expect(names, 'Furina replaces Bennett in slot 1').toContain('Furina');
	expect(names).not.toContain('Bennett');
});

// ⚓ Escape means cancel (Nate 2026-10-15, pre-launch sweep item 7): every way
// out of the Planner's swap that is not a pick ends the whole errand, as its
// Cancel does. Leaving only the SLOT stranded a row nothing could be picked
// into, under a strip that read "the Planner’s team is full".
test('Escape, the ✕ or the portrait again ends the swap and returns unchanged', async ({
	page,
	seed
}) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/planner');

	const exits: [string, () => Promise<void>][] = [
		['Escape', () => page.keyboard.press('Escape')],
		['the ✕', () => page.locator('.tb-dest-close').click()],
		['the portrait again', () => page.locator(`${ERRAND} .bv-slot--swap`).click()]
	];
	for (const [how, leave] of exits) {
		await page.locator(SWAP).first().click();
		await page.locator(ERRAND).waitFor({ timeout: 10_000 });
		await expect(page.locator('.tb-dest')).toHaveText(/Replacing Bennett/);
		await leave();
		await page.waitForURL(/planner/, { timeout: 10_000 });
		await page.waitForTimeout(1400); // the pan + band travel
		expect(await benchNames(page), `${how} changes nothing`).toEqual(NAMES);
	}
});
