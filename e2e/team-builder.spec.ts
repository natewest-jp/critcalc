import {
	test,
	expect,
	openSection,
	openTool,
	openRoster,
	gridNames,
	moreChip,
	provideGlyph,
	boardNames,
	setConMode,
	type SeedState
} from './fixtures/critcalc';
import type { Page } from '@playwright/test';
import { encodeBoard } from '../src/lib/utils/boardUrl';

/**
 * Team Builder behavior at the browser surface.
 *
 * Converted from `scripts/probe-team-builder.mjs` (one 606-line sequential
 * script) into independent tests: each seeds its own state and navigates fresh,
 * so a failure names one behavior instead of stopping a chain. The screenshot
 * calls the probe made are gone — visual verdicts are Nate's, per the policy.
 *
 * What this does NOT check: whether the derived capabilities are CORRECT. That
 * is the audit's job (`scripts/audit-capabilities.mjs`). This is UI behavior.
 */

/** 124 = 125 character JSONs minus the `blank` placeholder the grid filters out.
 *  ⚠️ HARDCODED ON PURPOSE — deriving it from the corpus would make the test
 *  agree with whatever the app renders, which is the one thing it exists to
 *  check. ⛔ So it must be bumped by hand on every character ingest; the
 *  ingest-character recipe's Stage 3 says so. Last bumped 2026-09-22 (+Vesna,
 *  +Vodyanitsa). */
const ROSTER_SIZE = 127;

/** A real profile for the roster's tests: Theorycraft has every character at
 *  every level and no roster, so the old storage must hold one owned
 *  character for the migration to make a profile (storage/boot.ts). */
const REAL_PROFILE: SeedState = { ownership: { jean: 'owned' } };

// The count lives in the destination banner while a team is selected, in the
// filter strip otherwise.
const matchCount = async (page: Page) =>
	parseInt(await page.locator('.rfs-count, .tb-dest-count').first().innerText(), 10);

test.describe('roster and facets', () => {
	test("the filter bar's role icons narrow and section the roster", async ({ page }) => {
		// ↻ §11.2/§11.6: the Atlas role cards retired into the strip over the
		// grid; band B is cut at the dock, one cell per pane.
		await openTool(page, '/builder');
		await expect(page.locator('.tb-pane-switch'), 'no pane switch beside the dock').toHaveCount(0);
		await expect(page.locator('.tb-band-cell'), 'a band cell over each pane').toHaveCount(2);
		await expect(page.locator('.rfs-role'), 'four role icons').toHaveCount(4);
		await expect(page.locator('.cg-grid').first().locator('.cc')).toHaveCount(ROSTER_SIZE);
		await expect(
			page.locator('.tb-stubs'),
			'no uncurated bucket without capability facets'
		).toHaveCount(0);

		// A role IS the filter: the grid narrows and SECTIONS (the old drill-down).
		await page.locator('.rfs-role[aria-label="Support"]').click();
		await expect.poll(() => page.locator('.cg-section').count()).toBeGreaterThan(1);
		await expect.poll(() => matchCount(page)).toBeLessThan(ROSTER_SIZE);

		// Choosing it again clears it.
		await page.locator('.rfs-role.is-active').click();
		await expect(page.locator('.cg-section')).toHaveCount(0);
	});

	test('the heal facet narrows the grid to healers', async ({ page }) => {
		await openTool(page, '/builder');
		await openRoster(page);
		await provideGlyph(page, 'Healing');

		const healers = await matchCount(page);
		expect(healers, 'heal facet narrows the grid').toBeGreaterThan(15);
		expect(healers).toBeLessThan(45);

		const names = await gridNames(page);
		expect(names).toContain('Bennett');
		expect(names, 'Jean matches on a passive-derived heal').toContain('Jean');

		// The bucket collects only capability-UNKNOWN characters, and it has now
		// gone empty → 1 → empty again inside nine days. That round trip is the
		// honesty machinery working, and the arc is worth keeping:
		//   · until 2026-08-30 every frameless stub had complete Stage 1–3
		//     capabilities, so nothing was unknown and the bucket stayed empty;
		//   · 2026-08-31 Odette and Alyosha were ingested at Stage 0 with no
		//     effects authored, so they were genuinely unknown and this
		//     assertion was flipped to 1 (b8816df) with a note saying it would
		//     "return to 0 on its own once their Stage 2 effects land";
		//   · later that day it did. Both now derive real capabilities, so
		//     neither is unknown and the bucket is empty again.
		// ⛔ Don't read a 0 here as "the bucket is dead code" — flip it back the
		// day a character is ingested at Stage 0, which is the only state that
		// fills it. ⚠️ And it is Stage 2, not frames, that empties it: both
		// characters are still frameless and still read as "not yet curated" in
		// the roster.
		//   · 2026-09-22 — that day: 7.1's Vesna and Vodyanitsa ingested at
		//     Stage 0 (`fc215035`). Vesna carries her Stellar-Jubilee enabler
		//     passive and derives a capability; Vodyanitsa carries nothing yet, so
		//     she is genuinely unknown and the bucket is back to 1. ⏭ Returns to
		//     0 when her Stage 2 effects land (post-launch, per the 09-22 triage).
		await expect(
			page.locator('.tb-stubs'),
			'the uncurated bucket holds exactly the Stage-0 stubs (Vodyanitsa)'
		).toHaveCount(1);
	});

	test('stacked facets intersect (AND, not OR)', async ({ page }) => {
		await openTool(page, '/builder');
		await openRoster(page);
		await provideGlyph(page, 'Healing');
		const healers = await matchCount(page);

		await provideGlyph(page, 'ATK buff');
		const both = await matchCount(page);
		expect(both, 'heal ∩ ATK-buff is strictly smaller').toBeLessThan(healers);
		await expect.poll(() => gridNames(page), { message: 'Bennett does both' }).toContain('Bennett');
	});

	// ⚠️ The C-gated healer was Gorou (C4) until 2026-09-15: that heal is `trigger:
	// 'manual'`, which the Team Builder no longer derives (the channel is being
	// retired — a claim the planner never draws is not a TB claim either). Fischl's
	// C4 self-heal is `onCast` and her ONLY heal, so she is absent at C0 and present
	// from C4 — the same shape. The e2e gate is what caught the swap; vitest could not.
	test('the constellation lens widens capability gates', async ({ page }) => {
		await openTool(page, '/builder');
		await openRoster(page);
		await provideGlyph(page, 'Healing');

		await setConMode(page, 'C0');
		const atC0 = await matchCount(page);
		await expect
			.poll(() => gridNames(page), { message: 'Fischl heals only from C4' })
			.not.toContain('Fischl');

		await setConMode(page, 'C6');
		const atC6 = await matchCount(page);
		expect(atC6, `C6 unlocks more healers than C0 (C0=${atC0} C6=${atC6})`).toBeGreaterThan(atC0);
		await expect
			.poll(() => gridNames(page), { message: 'Fischl appears at C6' })
			.toContain('Fischl');
	});

	test('"My constellations" mode gates on your own constellations', async ({ page, seed }) => {
		await seed({ constellations: { fischl: 4 } });
		await openTool(page, '/builder');
		await openRoster(page);
		await provideGlyph(page, 'Healing');
		await setConMode(page, 'My constellations');

		const names = await gridNames(page);
		expect(names, 'your C4 Fischl now matches heal').toContain('Fischl');
		// Lauma's heal is C1-gated and she is owned at C0 by default, so she stays
		// locked — the con-gated negative case. (Dori and Gaming graduated to C0
		// healers when their base heals were authored.)
		expect(names, 'C-gated healers stay absent').not.toContain('Lauma');
	});
});

test.describe('detail card', () => {
	test('lazy-loads the character payload and shows gated provenance', async ({ page }) => {
		await openTool(page, '/builder');
		await openRoster(page);

		const chunks: string[] = [];
		page.on('request', (r) => {
			if (r.url().includes('/chunks/') && r.url().endsWith('.js')) chunks.push(r.url());
		});

		await page.locator('.cc', { hasText: 'Fischl' }).first().locator('.cc-mag').click();
		// ↻ The flip: the details door opens the inspector MODAL (inspector
		// round, docs/inspector-round.md), which hosts the details card.
		await page.locator('.im').waitFor();
		await page.locator('.im .dc-caps .dc-cap').first().waitFor();

		expect(chunks.length, 'the card lazy-loads the character chunk').toBeGreaterThan(0);

		const caps = await page.locator('.dc-caps').innerText();
		expect(caps, 'Fischl shows C4 heal provenance').toMatch(/Heal/);
		expect(caps).toMatch(/C4/);
		await expect
			.poll(() => page.locator('.dc-timing').innerText(), { message: 'timing shows E cooldown' })
			.toMatch(/cooldown/);
	});

	test('the Roster sets a constellation that survives reload', async ({ page, seed }) => {
		// A REAL profile: Theorycraft has no roster. One owned character in the
		// old storage migrates into one.
		await seed(REAL_PROFILE);
		await openTool(page, '/builder');
		await openRoster(page);
		await page.locator('.cc', { hasText: 'Fischl' }).first().locator('.cc-mag').click();
		await page.locator('.im').waitFor();
		await expect(page.locator('.dc-roster-state'), 'details read the roster').toHaveText(
			'Not owned'
		);

		// ⚓ Details only READ the roster; their link opens the Roster section
		// on this character, unlocked (lineups design §11.6 items 2, 17).
		await page.getByRole('button', { name: 'Edit in Roster' }).click();
		const tile = page.locator('.til-card[data-id="fischl"]');
		await expect(tile, 'the Roster arrives on the character').toBeFocused();
		await tile.getByRole('button', { name: 'C4' }).click();
		await expect(tile, 'a constellation marks the character owned').toHaveClass(/is-owned/);

		await page.keyboard.press('Escape');
		await expect(page.locator('div.menu'), 'Escape closes the Roster').toBeHidden();

		await page.reload({ waitUntil: 'networkidle' });
		await openRoster(page);
		await provideGlyph(page, 'Healing');
		await setConMode(page, 'My constellations');
		await expect
			.poll(() => gridNames(page), { message: 'the constellation survived reload' })
			.toContain('Fischl');
	});
});

/**
 * ⚓ THE BOARD (lineups design §2.2–§2.4, §10, 2026-10-08). The Builder holds
 * a board of several teams beside the roster, with no bench; the Compare tab
 * and the shared working team are retired. ⚓ A board team is a set of
 * characters — the Builder never rewrites a rotation.
 */
test.describe('the board', () => {
	const openDetail = async (page: Page, name: string) => {
		await page.locator('.cc', { hasText: name }).first().locator('.cc-mag').click();
		await page.locator('.im').waitFor();
	};
	/** The details' team button: "Add to team", or the in-team form. */
	const teamButton = (page: Page) =>
		page.locator('.im').getByRole('button', { name: /team/i }).first();

	test('the cold start is the current Stygian lineup, and a pick lands on it', async ({ page }) => {
		// ⚓ §11.2: a first visit shows the tool at its most useful — the season's
		// Stygian Onslaught, docked beside the roster.
		await openTool(page, '/builder');
		await expect(page.locator('.bv-team'), 'three battlefields').toHaveCount(3);
		await expect(page.locator('.bv-head-title').first()).toHaveText(/^Battlefield 1: /);
		await expect(page.locator('.bench-band-mount'), 'the Builder has no bench').toBeHidden();

		await openDetail(page, 'Bennett');
		await teamButton(page).click();
		await page.keyboard.press('Escape');

		await expect.poll(() => boardNames(page)).toEqual(['Bennett']);
		expect(page.url(), 'the board never rides the URL').not.toContain('team=');
	});

	test('a board member reads as in the team, and leaves it from the card', async ({
		page,
		seed
	}) => {
		await seed({ board: { teams: [['bennett', 'jean']] } });
		await openTool(page, '/builder');
		await openRoster(page);
		await openDetail(page, 'Bennett');
		await expect(teamButton(page)).toHaveText(/In team/);
		await teamButton(page).click();
		await page.keyboard.press('Escape');
		await expect.poll(() => boardNames(page)).toEqual(['Jean']);
	});

	test('a selected TEAM fills in click order, and a second pick frees the slot', async ({
		page,
		seed
	}) => {
		await seed({ board: { teams: [['bennett'], [null]] } });
		await openTool(page, '/builder');
		// ⚓ The game's model: select a ROW (any slot selects it), picks land in
		// its earliest empty slot, the same pick again takes it out.
		await page.locator('.bv-team').nth(1).locator('.bv-slot').nth(2).click();
		const pick = async (name: string) => {
			await openDetail(page, name);
			await teamButton(page).click();
			await page.keyboard.press('Escape');
		};
		const team2 = () =>
			page
				.locator('.bv-team')
				.nth(1)
				.locator('.bv-slot')
				.evaluateAll((els) => els.map((e) => e.getAttribute('data-name')));
		await pick('Furina');
		await pick('Xingqiu');
		await expect.poll(() => team2()).toEqual(['Furina', 'Xingqiu', '', '']);
		await pick('Furina');
		await expect
			.poll(() => team2(), { message: 'the others keep their places' })
			.toEqual(['', 'Xingqiu', '', '']);
	});

	test('under No repeats, a pick of another team’s member takes two clicks', async ({
		page,
		seed
	}) => {
		// ⚓ Nate 2026-10-18, the game's model (↻ §11.6's "a pick MOVES"): the
		// first click takes Bennett off Team 1, the second adds him here.
		await seed({ board: { teams: [['bennett'], [null], ['jean', 'diona', 'gorou', 'xingqiu']] } });
		await openTool(page, '/builder');
		const team = (n: number) =>
			page
				.locator('.bv-team')
				.nth(n)
				.locator('.bv-slot')
				.evaluateAll((els) => els.map((e) => e.getAttribute('data-name')));
		const card = (name: string) =>
			page.locator('.cc', { hasText: name }).first().locator('.cc-main');
		await page.locator('.bv-team').nth(1).locator('.bv-slot').nth(0).click();

		await expect(card('Bennett')).toHaveAccessibleName('Remove Bennett from Team 1');
		await card('Bennett').click();
		await expect
			.poll(() => team(0), { message: 'click 1 takes him off Team 1' })
			.toEqual(['', '', '', '']);
		await expect.poll(() => team(1), { message: '…and adds nothing' }).toEqual(['', '', '', '']);
		// ↻ 2026-10-26 (the notices round): a toast in the one toast home, with
		// Undo (it stood in the grid's destination banner from 2026-10-20).
		const toast = page.locator('.nt', { hasText: 'Bennett left Team 1' });
		await expect(toast).toBeVisible();
		await toast.getByRole('button', { name: 'Undo' }).click();
		await expect
			.poll(() => team(0), { message: 'Undo puts him back' })
			.toEqual(['Bennett', '', '', '']);

		await card('Bennett').click();
		await card('Bennett').click();
		await expect.poll(() => team(0)).toEqual(['', '', '', '']);
		await expect
			.poll(() => team(1), { message: 'click 2 adds him' })
			.toEqual(['Bennett', '', '', '']);

		// A FULL selected team still only nudges: he stays where he is.
		await page.locator('.bv-team').nth(2).locator('.bv-slot').nth(0).click();
		await card('Bennett').click();
		await expect.poll(() => team(1)).toEqual(['Bennett', '', '', '']);
		await expect.poll(() => team(2)).toEqual(['Jean', 'Diona', 'Gorou', 'Xingqiu']);
	});

	test('a preset lineup opens in the Builder with its teams', async ({ page }) => {
		// ↻ The flip: lineups are documents, and New lineup lives in the
		// Library's Lineups section (a three-shape menu).
		await openSection(page, '/library/lineups');
		await page.locator('div.menu .band-menu-trigger', { hasText: 'New lineup' }).click();
		await page.locator('.band-menu-item', { hasText: 'Spiral Abyss' }).click();
		await page.waitForURL('**/builder');
		await expect(page.locator('.bv-team'), 'the Abyss is two teams').toHaveCount(2);
	});

	test('a ?team= deep link lands on the active board and strips the param', async ({ page }) => {
		await openTool(page, '/builder?team=bennett,jean,diona,gorou');
		await expect.poll(() => boardNames(page)).toEqual(['Bennett', 'Jean', 'Diona', 'Gorou']);
		expect(page.url(), '?team= is stripped after import').not.toContain('team=');
	});

	test('a ?b= link opens the shared lineup, levels included', async ({ page }) => {
		const param = await encodeBoard({
			label: 'Shared lineup',
			noRepeats: true,
			teams: [
				{ slots: ['furina', 'nahida', null, null], constellations: { furina: 2, nahida: 0 } },
				{ slots: ['bennett', null, null, null], constellations: { bennett: 6 } }
			]
		});
		await openTool(page, `/builder?b=${param}`);
		await expect(page.locator('.bv-team')).toHaveCount(2);
		await expect.poll(() => boardNames(page)).toEqual(['Furina', 'Nahida', 'Bennett']);
		// ⚓ A shared link opens in Theorycraft, named as the sender named it.
		await expect(page.locator('.tb-profile')).toHaveAttribute('aria-label', /Theorycraft/);
		await expect(page.locator('.nav-btn.is-current')).toHaveText(/Shared lineup/);
		const slots = page.locator('.bv-team').first().locator('.bv-slot');
		await expect(slots.nth(0).locator('.spt-chip'), 'the sender’s C2 arrives').toHaveAttribute(
			'title',
			'C2'
		);
		await expect(slots.nth(1).locator('.spt-chip'), 'the sender’s C0 arrives as C0').toHaveCount(0);
	});

	test('a board survives a reload', async ({ page }) => {
		await openTool(page, '/builder?team=bennett,jean');
		// The import lands after the tool mounts; reloading before it has is a
		// race in the test, not a lost edit (an immediate reload once the team
		// shows keeps it, by the unload journal).
		await expect.poll(() => boardNames(page)).toEqual(['Bennett', 'Jean']);
		await page.reload();
		await expect.poll(() => boardNames(page)).toEqual(['Bennett', 'Jean']);
	});
});

/**
 * ⚓ SWAP MODE (lineups design §11.6 item 20, 2026-10-13) — Compare and
 * Audition retired into it. A FILLED portrait in the SELECTED row swaps its
 * slot: the grid regroups by what the swap does to the TEAM, a pick swaps
 * and leaves, and band A offers Undo.
 */
test.describe('swap mode', () => {
	const enterSwap = async (page: Page, slot: number) => {
		// A one-team board shows its row selected already, so the portrait swaps
		// at once (§11.6 item 8: a swap takes a click on a row SHOWN selected).
		const row = page.locator('.bv-team').first();
		await expect(row.locator('.bv-slots--sel')).toHaveCount(1);
		await row.locator('.bv-slot').nth(slot).click();
		await expect(page.locator('.tb-dest')).toHaveText(/Replacing/);
	};

	test('regroups the grid, swaps on a pick, and undoes', async ({ page, seed }) => {
		await seed({ board: { teams: [['bennett', 'xiangling', 'xingqiu', 'sucrose']] } });
		await openTool(page, '/builder');
		await enterSwap(page, 0);
		await expect(page.locator('.tb-dest')).toHaveText(/Replacing Bennett/);

		// Every section says what its swap does; the team is never offered.
		await expect(page.locator('.tb-swap-head').first()).toBeVisible();
		// ⚓ Bennett is an off-fielder, so off-fielders are offered; the
		// on-fielders wait behind one button at the foot of the grid.
		const offered = await page.locator('.cg-section .cc').count();
		expect(offered, 'one position at a time').toBeLessThan(ROSTER_SIZE - 4);
		await page.locator('.tb-swap-foot button').click();
		await expect(page.locator('.cg-section .cc'), 'everyone but the team').toHaveCount(
			ROSTER_SIZE - 4
		);

		await page.locator('.cc', { hasText: 'Furina' }).first().locator('.cc-main').click();
		await expect
			.poll(() => boardNames(page))
			.toEqual(['Furina', 'Xiangling', 'Xingqiu', 'Sucrose']);
		await expect(page.locator('.tb-dest'), 'a pick leaves swap mode').not.toHaveText(/Replacing/);

		await page.getByRole('button', { name: 'Undo' }).click();
		await expect
			.poll(() => boardNames(page))
			.toEqual(['Bennett', 'Xiangling', 'Xingqiu', 'Sucrose']);
	});

	test('Escape, or the portrait again, leaves without a swap', async ({ page, seed }) => {
		await seed({ board: { teams: [['bennett', 'jean', 'diona', 'gorou']] } });
		await openTool(page, '/builder');
		await enterSwap(page, 1);
		await page.keyboard.press('Escape');
		await expect(page.locator('.tb-swap-head')).toHaveCount(0);

		await page.locator('.bv-team').first().locator('.bv-slot').nth(1).click();
		await expect(page.locator('.tb-swap-head').first()).toBeVisible();
		await page.locator('.bv-team').first().locator('.bv-slot').nth(1).click();
		await expect(page.locator('.tb-swap-head')).toHaveCount(0);
		await expect.poll(() => boardNames(page)).toEqual(['Bennett', 'Jean', 'Diona', 'Gorou']);
	});
});

test.describe('ownership ledger', () => {
	test('wishlisting persists and narrows the roster view', async ({ page, seed }) => {
		await seed(REAL_PROFILE);
		await openTool(page, '/builder');
		await openRoster(page);

		await page.locator('.cc', { hasText: 'Bennett' }).first().locator('.cc-mag').click();
		await page.locator('.im').waitFor();
		// The roster is edited in the Roster section; W wishlists the tile the
		// details link arrives on.
		await page.getByRole('button', { name: 'Edit in Roster' }).click();
		const tile = page.locator('.til-card[data-id="bennett"]');
		await expect(tile).toBeFocused();
		await page.keyboard.press('w');
		await expect(tile, 'W wishlists the tile').toHaveClass(/is-wish/);
		await page.keyboard.press('Escape');
		await expect(page.locator('div.menu')).toBeHidden();
		await page.reload();
		await openRoster(page);

		await page.locator('.tool-main .btn--icon[aria-label="Wishlist"]').click();
		const names = await gridNames(page);
		expect(names).toContain('Bennett');
		expect(names).not.toContain('Jean');
		expect(names.length, 'the view is narrowed, not the full roster').toBeLessThan(5);
	});
});

test.describe('factions and buffs filter', () => {
	test('the Stellar facet finds enablers and gated-buff carriers', async ({ page }) => {
		await openTool(page, '/builder');
		await openRoster(page);

		await page.locator('.tb-band .band-menu-trigger[aria-label^="More filters"]').click();
		const chips = page.locator('.mf .chip', { hasText: /^(Moonsign|Hexerei|Stellar)$/ });
		await expect(chips, 'three faction/buff chips').toHaveCount(3);
		await page.keyboard.press('Escape');

		await moreChip(page, 'Stellar');
		const names = await gridNames(page);
		// Sandrone enables the reaction; Diona carries a stellar-gated C6 buff;
		// Bennett is neither.
		expect(names).toContain('Sandrone');
		expect(names).toContain('Diona');
		expect(names).not.toContain('Bennett');
		expect(names.length).toBeLessThan(15);
	});
});
