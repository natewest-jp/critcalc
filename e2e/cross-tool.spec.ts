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
	await expect.poll(() => benchNames(page)).toHaveLength(4);

	await page.locator('.nav-btn', { hasText: 'Builder' }).click();
	await page.waitForURL(/builder/);
	await expect(page.locator('.bench-band-mount'), 'the Builder has no bench').toBeHidden();

	await page.locator('.nav-btn', { hasText: 'Planner' }).click();
	await page.waitForURL(/planner/);
	await expect
		.poll(() => benchNames(page), { message: 'the planner’s team is untouched by the trip' })
		.toEqual(expect.arrayContaining(NAMES));
	expect(page.url(), 'no ?team= anywhere in the trip').not.toContain('team=');
});

/**
 * ⛔ THE PLANNER'S SOURCE OVERLAY WAS RETIRED 2026-08-13: ⇄ on a bench card
 * hands the SLOT to the Team Builder (?swap=N). ↻ 2026-10-13 it lands in SWAP
 * MODE — the Planner's team as a temporary row on top of the lineup, already
 * swapping the slot (lineups design §10.3, §11.6 item 20).
 */

const ERRAND = '.bv-team--errand';
/** ⇄ in a FILLED card's rail (↻ bench-buttons round 2026-10-22: the rail is
 *  back and the portrait reads). */
const SWAP = '.bench-band-mount .bb-act[aria-label^="Swap "]';

test("the planner's ⇄ opens swap mode on its own team", async ({ page, seed }) => {
	await seed({ team: { slots: TEAM } });
	await openTool(page, '/planner');

	// ↻ 2026-10-22: the portrait reads the character, and ⇄ in the rail swaps.
	// ↻ The flip: it reads it in the Planner's inspector pane.
	await page.locator('.bench-band-mount .sp-side-hit').first().click();
	await expect(page.locator('.pi-title'), 'the portrait reads the character').toHaveText('Bennett');

	await page.locator(SWAP).first().click();
	await page.locator(ERRAND).waitFor();
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
	await page.locator(ERRAND).waitFor();

	await page.locator(ERRAND).getByRole('button', { name: 'Cancel' }).click();
	await page.waitForURL(/planner/);
	await expect.poll(() => benchNames(page), { message: 'Cancel changes nothing' }).toEqual(NAMES);

	// ⚠ THIS SECOND ⇄ IS THE REGRESSION GUARD, not setup noise. It is an A→B→A
	// trip, and Svelte REVIVES the planner rather than re-mounting it — so the
	// page never re-registers its bench affordances, and a single-slot host
	// register left the bench hostless the moment the Team Builder finally tore
	// down. Keyed registration (BenchBandState#hosts) is the fix, and this click
	// is what proves it.
	await page.locator(SWAP).first().click();
	await page.locator(ERRAND).waitFor();
	await page.locator('.cc', { hasText: 'Furina' }).first().locator('.cc-main').click();

	await page.waitForURL(/planner/);
	await expect
		.poll(() => benchNames(page), { message: 'Furina replaces Bennett in slot 1' })
		.toEqual(['Furina', 'Jean', 'Diona', 'Gorou']);
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
		await page.locator(ERRAND).waitFor();
		await expect(page.locator('.tb-dest')).toHaveText(/Replacing Bennett/);
		await leave();
		await page.waitForURL(/planner/);
		await expect.poll(() => benchNames(page), { message: `${how} changes nothing` }).toEqual(NAMES);
	}
});
