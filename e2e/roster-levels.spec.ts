import { test, expect, openSection, openTool, type SeedState } from './fixtures/critcalc';
import type { Locator, Page } from '@playwright/test';

/**
 * WHOSE LEVEL A ROTATION READS (design §2.4, ↻ the flip 2026-10-27; was the
 * two-layer roster/tab model of loadout-layers.spec.ts).
 *
 * `rotationTabs.levelOf` is the one resolver: an OWNED character reads the
 * profile's roster, live; an unowned one keeps the rotation's own level. So
 * the bench's chip routes by ownership: for an owned character a different
 * level never edits the rotation, it opens a Theorycraft what-if copy paired
 * with it (§4.6); for anyone else it writes the rotation. The Roster section
 * alone edits the roster. These pin that routing where the reader sees it.
 *
 * Not here: team loadouts and the bench pill's override. Their rules are pure
 * and covered by `teamLoadout.test.ts` and `session.test.ts`.
 */

/** A real profile (the seed migrates into one) with Furina owned at C1. */
const SEED: SeedState = {
	team: { slots: ['furina', 'bennett'], notation: 'Furina E Q > Bennett E Q' },
	ownership: { furina: 'owned' },
	constellations: { furina: 1 }
};

const chip = (page: Page, name: string) =>
	page.locator(`.bench-band-mount .sp-disc-con[aria-label^="Set constellation for ${name},"]`);

/**
 * ⚠ THE CHIP HAS NO TEXT: its value is a vector glyph (ConMark), so the
 * accessible NAME is the only machine-readable statement of the level, and
 * what a screen reader announces.
 */
const expectCon = (c: Locator, level: number, why: string) =>
	expect(c, why).toHaveAttribute('aria-label', new RegExp(`currently C${level}$`));

async function setBenchCon(page: Page, name: string, level: number) {
	await chip(page, name).click();
	await page.locator('.sp-popover .sp-pip').nth(level).click();
}

test("an unowned character's chip writes the rotation, never the roster", async ({
	page,
	seed
}) => {
	await seed(SEED);
	await openTool(page, '/planner');
	await expectCon(chip(page, 'Bennett'), 0, 'unowned, nothing set: C0');

	await setBenchCon(page, 'Bennett', 2);
	await expectCon(chip(page, 'Bennett'), 2, 'the rotation took it');
	await expect(page.locator('.cmp-pair'), 'no what-if for an unowned character').toHaveCount(0);

	await page.reload();
	await expectCon(chip(page, 'Bennett'), 2, 'saved with the rotation');

	await openSection(page, '/roster');
	await expect(
		page.locator('.til-face[aria-label="Bennett: not owned"]'),
		'the roster is untouched'
	).toHaveCount(1);
});

test("an owned character's chip opens a what-if, and the original keeps the roster's level", async ({
	page,
	seed
}) => {
	await seed(SEED);
	await openTool(page, '/planner');
	await expectCon(chip(page, 'Furina'), 1, 'owned: the roster’s level');

	await setBenchCon(page, 'Furina', 3);
	const pair = page.locator('.cmp-pair:visible').first();
	await expect(pair, 'a what-if pair opened').toBeVisible();
	await expectCon(chip(page, 'Furina'), 3, 'the what-if plays C3');

	// The home side: the segment's own button (the away side is a pick + ✕
	// pair). Its label follows the width ("Original" narrow, the profile's
	// name at desk width), so it is found by place, not by word.
	await pair.locator('.cmp-seg > button').click();
	await expectCon(chip(page, 'Furina'), 1, 'the original still reads the roster');
});

test('a roster edit reaches the open rotation live', async ({ page, seed }) => {
	await seed(SEED);
	await openTool(page, '/planner');
	await page.locator('.tool-main').evaluate((el) => el.setAttribute('data-e2e-mark', '1'));
	await expectCon(chip(page, 'Furina'), 1, 'before');

	// Into the Roster over the Planner, by the menu state's sidebar.
	await page.locator('.tb-glyph[aria-label="Settings"]').click();
	await page.locator('div.menu .side-item', { hasText: 'Roster' }).click();
	await page.locator('.ros-lock').click();
	const furina = page.locator('.til-card', {
		has: page.locator('.til-face[aria-label="Furina: owned"]')
	});
	await furina.locator('.til-pip[aria-label="C4"]').click();

	await page.keyboard.press('Escape');
	await expect(page.locator('div.menu')).toBeHidden();
	await expect(page.locator('.tool-main[data-e2e-mark="1"]'), 'the same Planner').toHaveCount(1);
	await expectCon(chip(page, 'Furina'), 4, 'the rotation follows the roster, no reload');
});
