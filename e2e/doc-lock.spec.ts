import { test, expect, openTool } from './fixtures/critcalc';

/**
 * THE DOCUMENT LOCK ACROSS A RELOAD (`storage/docLock.ts`). A document open
 * in one tab is read-only in another; a reload must not count as another
 * tab.
 *
 * WebKit only, because the failure was WebKit's: a reload rejects the dying
 * page's lock as if it were stolen, and a lock request made through
 * `globalThis` while that page dies lands in the NEW page, which then holds
 * its own document and opens it read-only. Every Safari reload did, while
 * Chrome never sent the request across. The trap is documented at
 * `browserLocks`.
 *
 * ⚠ An absent banner proves nothing alone: the session decides read-only a
 * moment after the page paints. So each reload waits for the SEEDED notation,
 * which only the session's restore puts in the editor and which it restores
 * after taking the lock. The edit at the end is the real check: a read-only
 * tab refuses it, so it would not survive the last reload.
 */

test.skip(({ browserName }) => browserName !== 'webkit', 'the reload failure was WebKit’s');

const NOTATION = 'Xiangling E Q > Bennett E Q';

test('a reload keeps its own rotation editable', async ({ page, seed }) => {
	await seed({ team: { slots: ['xiangling', 'bennett'], notation: NOTATION } });
	await openTool(page, '/planner');
	const editor = page.locator('.cm-content').first();
	const locked = page.locator('.rp-held');
	await expect(editor, 'the seeded rotation').toHaveText(NOTATION);

	for (const n of [1, 2]) {
		await page.reload();
		await expect(editor, `reload ${n} restores the rotation`).toHaveText(NOTATION);
		await expect(locked, `reload ${n} does not lock it`).toHaveCount(0);
	}

	await editor.click();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type(' N1');
	await page.keyboard.press('Escape');
	await expect(editor, 'the edit is taken').toHaveText(`${NOTATION} N1`);
	await expect(locked, 'and nothing calls the lock back').toHaveCount(0);

	await page.reload();
	await expect(editor, 'the edit was saved').toHaveText(`${NOTATION} N1`);
});
