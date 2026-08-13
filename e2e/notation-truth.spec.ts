import { expect } from '@playwright/test';
import { test } from './fixtures/critcalc';

/**
 * The notation is the single source of truth for the team (2026-08-13).
 *
 * These two assertions are the round's two BUGS, written down. Both were live
 * in `main` until that round and neither could be caught below the browser: the
 * first needs a real bench card, a real CodeMirror instance and the sync
 * between them, and the second is a state machine that only misbehaves on the
 * second interaction.
 *
 * ⚠ The seed's `slots` is a CONVENIENCE, not a second source of truth — the
 * fixture folds it into the notation before writing the tab, because that is
 * what the store now does with it.
 */

/** The CodeMirror host. Its text is the notation, verbatim. */
const BOX = 'div.rp-notation';
/** ✕ on a bench card. `:not([disabled])` is what makes this count the FILLED
 *  slots: an empty card renders its actions disabled to hold their box. */
const REMOVE = 'button.bb-act--remove:not([disabled])';

test('the bench ✕ deletes the segments, and undo restores the text and the slot', async ({
	page,
	seed
}) => {
	await seed({ team: { slots: ['bennett', 'xingqiu'], notation: 'Bennett E Q > Xingqiu E Q' } });
	await page.goto('/rotation-planner');
	await expect(page.locator(BOX)).toContainText('Bennett E Q');
	await expect(page.locator(REMOVE)).toHaveCount(2);

	// ✕ on the second card takes Xingqiu's segment WITH its separator — before
	// the round it emptied a slot and left the segment in the text, so the tool
	// and the notation disagreed from that click onward.
	await page.locator(REMOVE).nth(1).click();
	await expect(page.locator(BOX)).toHaveText('Bennett E Q');
	await expect(page.locator(REMOVE)).toHaveCount(1);

	// Undo is the half that makes ✕ safe, and it reaches a mouse action two
	// panels from the box only because the store's write replays as a CodeMirror
	// transaction. The slot comes back on its own: it is derived from the text.
	await page.locator('.rp-history button').first().click();
	await expect(page.locator(BOX)).toContainText('Xingqiu E Q');
	await expect(page.locator(REMOVE)).toHaveCount(2);
});

test('a ✕ does not stop the notation from slotting somebody typed afterwards', async ({
	page,
	seed
}) => {
	// 🐛 THE STICKY-MANUAL-MODE BUG, and why it needs the SECOND interaction to
	// show: ✕ used to materialize an explicit slot override, which then won over
	// notation inference for the whole tab. So the removal looked right and the
	// tab was silently broken — a character who had never been involved would not
	// slot either, and only "Reset this rotation" cleared it.
	await seed({ team: { slots: ['bennett'], notation: 'Bennett E Q' } });
	await page.goto('/rotation-planner');
	await expect(page.locator(REMOVE)).toHaveCount(1);

	await page.locator(REMOVE).first().click();
	await expect(page.locator(REMOVE)).toHaveCount(0);

	await page.locator('.cm-content').click();
	await page.keyboard.type('Nahida E Q');
	await expect(page.locator(REMOVE)).toHaveCount(1);
});
