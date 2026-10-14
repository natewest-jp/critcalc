import { test, expect, openTool, KEYS } from './fixtures/critcalc';
import type { Locator, Page } from '@playwright/test';

/**
 * THE TWO-LAYER MODEL — constellations and loadouts.
 *
 * Layer 1 = the roster (global `constellations` + `loadout` stores), edited in
 * the Team Builder's ROSTER surfaces (detail card, edit-roster grid); setting a
 * constellation there implies OWNERSHIP. Layer 2 = the active tab (`tabCon` +
 * `tabLoadout`), which shadows Layer 1 field-by-field, never touches the roster
 * and never marks ownership. A tab's effective value is `tabX[id] ?? layer1[id]`.
 *
 * Saving a rotation DENSIFIES (freezes) the resolved values for every slot so a
 * saved artifact stays faithful when the roster changes later; an OPEN tab keeps
 * live-falling-back to the roster.
 *
 * The BENCH BAND ALWAYS writes Layer 2: it is the plan's team editor. Since
 * 2026-10-08 it is the Planner's alone (the Team Builder has no bench), and the
 * roster surfaces — the Detail card, the edit-roster grid — alone own Layer 1.
 * That routing is what these tests pin.
 */

const conChip = (page: Page, i: number) => page.locator('.sp-disc-con').nth(i);
const readStore = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

/**
 * ⚠ THE CHIP HAS NO TEXT. Since 2026-08-12 its value is a VECTOR GLYPH
 * (ConMark — C0–C6 cut from IBM Plex Sans, so centring a value in a round chip
 * stopped needing optical nudges), which means `toHaveText('C2')` matches an
 * empty string and every assertion here passed vacuously or failed outright.
 * Nine failures across three engines caught it, deterministically.
 *
 * The accessible NAME still carries the level — it is what a screen reader
 * announces, and the only machine-readable statement of the value left in the
 * DOM. Asserting on it pins the same fact the eye checks, and would catch the
 * value silently disappearing from assistive tech too.
 */
const expectCon = (chip: Locator, level: number, why: string) =>
	expect(chip, why).toHaveAttribute('aria-label', new RegExp(`currently C${level}$`));

/** Set a slot's constellation from its bench card chip. */
async function setBenchCon(page: Page, slot: number, pip: number) {
	await page.locator('.bench-band-mount .sp-disc-con').nth(slot).click();
	await page.locator('.sp-popover .sp-pip').nth(pip).click();
}

test('the planner con chip writes the plan, never the roster', async ({ page }) => {
	await openTool(page, '/planner');
	await page.locator('.cm-content').first().click();
	await page.keyboard.type('Furina E Q > Bennett E Q');
	await expectCon(conChip(page, 0), 0, 'a fresh tab starts at C0');

	await conChip(page, 0).click();
	await page.locator('.sp-popover .sp-pip').nth(2).click();
	await expectCon(conChip(page, 0), 2, 'the chip reflects the tab override');

	const tabs = JSON.parse((await readStore(page, KEYS.tabs)) ?? '{}');
	expect(tabs?.tabs?.[0]?.tabCon?.furina, 'written to tabCon, keyed by character').toBe(2);
	expect(await readStore(page, KEYS.constellations), 'Layer 1 untouched').toBeNull();
	expect(await readStore(page, KEYS.ownership), 'theorycraft is not ownership').toBeNull();
});

test('an open tab falls back live; saving freezes the resolved values', async ({ page, seed }) => {
	// Bennett owned at C1 on the roster, Furina explicitly overridden to C2 in the
	// plan — the two layers in their two states.
	await seed({
		team: { slots: ['furina', 'bennett'], notation: 'Furina E Q > Bennett E Q' },
		constellations: { bennett: 1 }
	});
	await openTool(page, '/planner');
	await conChip(page, 0).click();
	await page.locator('.sp-popover .sp-pip').nth(2).click();

	await expectCon(conChip(page, 1), 1, 'an un-overridden slot falls back to the roster');

	// Save → the bank copy freezes BOTH slots' effective values.
	// ⚠ Unanchored on purpose: `hasText` matches textContent, and the button
	// leads with a <Mark> SVG, so `/^Save/` never matches. (The rendered "SAVE"
	// is CSS text-transform — a second, separate trap for anyone matching case.)
	await page.locator('.doc-actions button').filter({ hasText: /Save/ }).first().click();
	await expect
		.poll(
			async () => {
				const bank = JSON.parse((await readStore(page, KEYS.saved)) ?? '[]');
				return bank[0]?.tabCon;
			},
			{ message: 'save densifies every slot' }
		)
		.toMatchObject({ furina: 2, bennett: 1 });

	// The roster changes underneath. The OPEN tab keeps its sparse tabCon for
	// Bennett, so he live-falls-back to the NEW value; Furina's override holds.
	await page.evaluate(
		(k) => localStorage.setItem(k, JSON.stringify({ bennett: 6 })),
		KEYS.constellations
	);
	await page.reload({ waitUntil: 'networkidle' });
	await expectCon(conChip(page, 1), 6, 'the open tab tracks the roster change');
	await expectCon(conChip(page, 0), 2, 'the explicit override survives it');
});

/**
 * ↻ 2026-10-08 (lineups design §2.1): the Team Builder has no bench, so the
 * roster's LOADOUT moved into the Detail card beside its constellation. The
 * bench is the Planner's alone, and still writes Layer 2.
 */
test('the detail card edits the roster loadout (Layer 1)', async ({ page, seed }) => {
	await seed({ team: { slots: ['nahida', 'furina'] } });
	await openTool(page, '/builder');
	await page.locator('.cc', { hasText: 'Nahida' }).first().locator('.cc-mag').click();
	await page.locator('.dc-panel').waitFor();
	// Tile 0 is the "None" tile — pick the first real set.
	await page.locator('.dc-panel .lp-tile').nth(1).click();

	const roster = JSON.parse((await readStore(page, 'critcalc:loadout')) ?? '{}');
	expect(roster.nahida?.artifactSetId, 'the card writes the roster loadout').toBeTruthy();
	const tabs = JSON.parse((await readStore(page, KEYS.tabs)) ?? '{}');
	const active = tabs?.tabs?.find((t: { id: string }) => t.id === tabs.activeTabId);
	expect(active?.tabLoadout?.nahida, 'the plan is untouched').toBeUndefined();
});

test('the Roster tab owns Layer 1, and the plan keeps shadowing it', async ({ page, seed }) => {
	await seed({ team: { slots: ['nahida', 'furina'] } });
	// The plan's own level first, from the Planner's bench (Layer 2).
	await openTool(page, '/planner');
	await setBenchCon(page, 0, 4);

	// The roster's level (Layer 1). ↻ 2026-10-11: the Detail card only READS it;
	// its link opens the Library's Roster tab on the character, the one editor.
	await page.locator('.chrome-nav a[href*="builder"]').click();
	await page.waitForURL(/builder/, { timeout: 10_000 });
	await page.locator('.cc', { hasText: 'Nahida' }).first().locator('.cc-mag').click();
	await page.locator('.dc-panel').waitFor();
	await page.getByRole('button', { name: 'Edit in Roster' }).click();
	await page.locator('.til-card[data-id="nahida"]').getByRole('button', { name: 'C2' }).click();

	const roster = JSON.parse((await readStore(page, KEYS.constellations)) ?? '{}');
	expect(roster.nahida, 'the Roster tab writes the roster').toBe(2);
	const own = JSON.parse((await readStore(page, KEYS.ownership)) ?? '{}');
	expect(own.nahida, 'a roster constellation implies ownership').toBe('owned');

	await page.keyboard.press('Escape');
	await page.locator('.chrome-nav a[href*="planner"]').click();
	await page.waitForURL(/planner/, { timeout: 10_000 });
	await page.waitForTimeout(1400); // the pan + band travel
	await expectCon(
		page.locator('.bench-band-mount .sp-disc-con').first(),
		4,
		'the plan keeps shadowing the new roster value'
	);
});
