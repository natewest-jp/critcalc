import { test, expect, openTool, openRoster } from './fixtures/critcalc';
import type { Page } from '@playwright/test';

/**
 * The mark-sweep guard, at the browser surface.
 *
 * `src/lib/marks.test.ts` proves the mark SET is coherent (no drift from
 * Lucide, no orphans). It cannot prove the site stopped TYPESETTING its control
 * glyphs — a `✓` in a button is valid Svelte and valid TypeScript, and a static
 * grep can't tell a control glyph from the arrows in the help chapters' prose.
 * Only the rendered DOM can. This keeps the 2026-08-07 sweep swept.
 *
 * ⚠ Exempt on purpose: rarity stars (`5★` is Genshin's own notation, closer to
 * prose than to a control) and the maybe-chip `?` (a hedge, and a real glyph in
 * the body face). The law is about code points the text font doesn't cover.
 */

/** Code points that must be geometry, never type, when they act as a mark. */
const BANNED = '←→↑↓⇄⇆↺↻✓✔✗✕✖✘●○☆🔒▾▴⌄⌃∅⧉⤴';

type Sweep = { marks: number; hits: string[] };

/** Walk the rendered text of the current surface for typeset control glyphs. */
async function sweep(page: Page): Promise<Sweep> {
	return page.evaluate((banned) => {
		const bad = new RegExp('[' + banned + ']', 'u');
		const hits: string[] = [];
		const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
		let n: Node | null;
		while ((n = walk.nextNode())) {
			if (!n.nodeValue || !bad.test(n.nodeValue)) continue;
			const el = n.parentElement;
			// Only what a reader can actually see: hidden keep-alive tiles and the
			// help chapters' prose aren't controls.
			if (!el || !el.offsetParent) continue;
			if (el.closest('.area-body, .help-body, .sg-page')) continue;
			hits.push(
				`${el.tagName.toLowerCase()}.${el.className} :: ${n.nodeValue.trim().slice(0, 60)}`
			);
		}
		return { marks: document.querySelectorAll('svg.mark').length, hits: [...new Set(hits)] };
	}, BANNED);
}

/**
 * A surface that never opened proves nothing, so every check asserts the
 * surface is REALLY there before sweeping it — a silent miss used to read as a
 * pass in the old probe.
 */
async function expectSwept(page: Page, present: string) {
	await page.locator(present).first().waitFor();
	const { marks, hits } = await sweep(page);
	expect(marks, 'surface renders inline mark geometry').toBeGreaterThan(0);
	expect(hits, 'typeset control glyphs still rendering').toEqual([]);
}

test.describe('control glyphs are geometry, not type', () => {
	test('team builder — atlas', async ({ page }) => {
		await openTool(page, '/team-builder');
		await expectSwept(page, '.tb-atlas');
	});

	test('team builder — roster', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		await expectSwept(page, '.cg-grid');
	});

	test('team builder — detail card', async ({ page, seed }) => {
		await seed({ ownership: { bennett: 'owned' }, constellations: { bennett: 2 } });
		await openTool(page, '/team-builder');
		await openRoster(page);
		await page.locator('.cc', { hasText: 'Bennett' }).first().locator('.cc-main').click();
		await expectSwept(page, '.dc-panel');
	});

	test('rotation planner — bench and bands', async ({ page, seed }) => {
		await seed({
			team: { slots: ['hu_tao', 'xingqiu', 'zhongli', 'albedo'], notation: 'Hu Tao E N3 Q' },
			constellations: { hu_tao: 1, xingqiu: 6 }
		});
		await openTool(page, '/rotation-planner');
		await expectSwept(page, '.bench-band-mount');
	});

	test('rotation planner — saved bank', async ({ page, seed }) => {
		// Several swept glyphs only render once there is a saved entry to render.
		await seed({
			saved: [
				{
					id: 's1',
					name: 'Vape Hu Tao',
					notation: 'Hu Tao E N3 Q > Xingqiu E Q',
					// ⚠ A PRE-SINGLE-TRUTH entry, kept deliberately: `manualSlots` is
					// retired but still READ, and this is the one place the legacy fold
					// (documentBar.load → foldTeamIntoNotation) runs at the browser
					// surface. Zhongli and Albedo are not in the notation, so opening
					// this entry is what proves they still arrive.
					manualSlots: ['hu_tao', 'xingqiu', 'zhongli', 'albedo'],
					tabLoadout: {},
					tabCon: {},
					savedAt: 1754500000000
				}
			]
		});
		await openTool(page, '/rotation-planner');
		await page.locator('.doc-actions button', { hasText: /Load/ }).first().click();
		await expectSwept(page, '.sn-panel');
	});

	test('visualizers — workspace and instrument picker', async ({ page }) => {
		await openTool(page, '/visualizers');
		await expectSwept(page, '.ip-trigger');
		await page.locator('.ip-trigger').first().click();
		await expectSwept(page, '.ip-menu');
	});
});
