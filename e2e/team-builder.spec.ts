import {
	test,
	expect,
	openTool,
	openRoster,
	gridNames,
	moreChip,
	provideGlyph,
	benchNames,
	boardNames,
	setConMode,
	KEYS
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

const matchCount = async (page: Page) => parseInt(await page.locator('.rfs-count').innerText(), 10);

test.describe('roster and facets', () => {
	test("the filter bar's role icons narrow and section the roster", async ({ page }) => {
		// ↻ §11.2/§11.6: the Atlas role cards retired into the strip over the
		// grid; band B is cut at the dock, one cell per pane.
		await openTool(page, '/team-builder');
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
		expect(await page.locator('.cg-section').count()).toBeGreaterThan(1);
		expect(await matchCount(page)).toBeLessThan(ROSTER_SIZE);

		// Choosing it again clears it.
		await page.locator('.rfs-role.is-active').click();
		await expect(page.locator('.cg-section')).toHaveCount(0);
	});

	test('the heal facet narrows the grid to healers', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		await provideGlyph(page, 'Heals');

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
		await openTool(page, '/team-builder');
		await openRoster(page);
		await provideGlyph(page, 'Heals');
		const healers = await matchCount(page);

		await provideGlyph(page, 'ATK buff');
		const both = await matchCount(page);
		expect(both, 'heal ∩ ATK-buff is strictly smaller').toBeLessThan(healers);
		expect(await gridNames(page), 'Bennett does both').toContain('Bennett');
	});

	// ⚠️ The C-gated healer was Gorou (C4) until 2026-09-15: that heal is `trigger:
	// 'manual'`, which the Team Builder no longer derives (the channel is being
	// retired — a claim the planner never draws is not a TB claim either). Fischl's
	// C4 self-heal is `onCast` and her ONLY heal, so she is absent at C0 and present
	// from C4 — the same shape. The e2e gate is what caught the swap; vitest could not.
	test('the constellation lens widens capability gates', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		await provideGlyph(page, 'Heals');

		await setConMode(page, 'C0');
		const atC0 = await matchCount(page);
		expect(await gridNames(page), 'Fischl heals only from C4').not.toContain('Fischl');

		await setConMode(page, 'C6');
		const atC6 = await matchCount(page);
		expect(atC6, `C6 unlocks more healers than C0 (C0=${atC0} C6=${atC6})`).toBeGreaterThan(atC0);
		expect(await gridNames(page), 'Fischl appears at C6').toContain('Fischl');
	});

	test('"My roster" mode gates on your own constellations', async ({ page, seed }) => {
		await seed({ constellations: { fischl: 4 } });
		await openTool(page, '/team-builder');
		await openRoster(page);
		await provideGlyph(page, 'Heals');
		await setConMode(page, 'My roster');

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
		await openTool(page, '/team-builder');
		await openRoster(page);

		const chunks: string[] = [];
		page.on('request', (r) => {
			if (r.url().includes('/chunks/') && r.url().endsWith('.js')) chunks.push(r.url());
		});

		await page.locator('.cc', { hasText: 'Fischl' }).first().locator('.cc-mag').click();
		await page.locator('.dc-panel').waitFor();
		await page.locator('.dc-caps .dc-cap').first().waitFor();

		expect(chunks.length, 'the card lazy-loads the character chunk').toBeGreaterThan(0);

		// A modal at every width — a fixed scrim, and the grid never reflows under it.
		await expect(page.locator('.dc-backdrop')).toHaveCSS('position', 'fixed');

		const caps = await page.locator('.dc-caps').innerText();
		expect(caps, 'Fischl shows C4 heal provenance').toMatch(/Heal/);
		expect(caps).toMatch(/C4/);
		expect(await page.locator('.dc-timing').innerText(), 'timing shows E cooldown').toMatch(
			/cooldown/
		);
	});

	test('the Roster tab sets a constellation that survives reload', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		await page.locator('.cc', { hasText: 'Fischl' }).first().locator('.cc-mag').click();
		await page.locator('.dc-panel').waitFor();
		await expect(page.locator('.dc-roster-state'), 'details read the roster').toHaveText(
			'Not owned'
		);

		// ⚓ Details only READ the roster; their link opens the Library's Roster
		// tab on this character, unlocked (lineups design §11.6 items 2, 17).
		await page.getByRole('button', { name: 'Edit in Roster' }).click();
		const tile = page.locator('.til-card[data-id="fischl"]');
		await expect(tile, 'the Roster tab arrives on the character').toBeFocused();
		await tile.getByRole('button', { name: 'C4' }).click();
		const stored = await page.evaluate(
			(k) => JSON.parse(localStorage.getItem(k) ?? '{}'),
			KEYS.constellations
		);
		expect(stored.fischl, 'the astroid writes the constellations store').toBe(4);
		await expect(tile, 'a constellation marks the character owned').toHaveClass(/is-owned/);

		await page.keyboard.press('Escape');
		await expect(page.locator('.lib'), 'Escape closes the Library').toHaveCount(0);

		await page.reload({ waitUntil: 'networkidle' });
		await openRoster(page);
		await provideGlyph(page, 'Heals');
		await setConMode(page, 'My roster');
		expect(await gridNames(page), 'the constellation survived reload').toContain('Fischl');
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
		await page.locator('.dc-panel').waitFor();
	};

	test('the cold start is the current Stygian lineup, and a pick lands on it', async ({ page }) => {
		// ⚓ §11.2: a first visit shows the tool at its most useful — the season's
		// Stygian Onslaught, docked beside the roster.
		await openTool(page, '/team-builder');
		await expect(page.locator('.bv-team'), 'three battlefields').toHaveCount(3);
		await expect(page.locator('.bv-head-title').first()).toHaveText(/^Battlefield 1: /);
		await expect(page.locator('.bench-band-mount'), 'the Builder has no bench').toBeHidden();

		await openDetail(page, 'Bennett');
		await page.locator('.dc-team').click();
		await page.keyboard.press('Escape');

		expect(await boardNames(page)).toEqual(['Bennett']);
		expect(page.url(), 'the board never rides the URL').not.toContain('team=');
	});

	test('a board member reads as in the team, and leaves it from the card', async ({
		page,
		seed
	}) => {
		await seed({ board: { teams: [['bennett', 'jean']] } });
		await openTool(page, '/team-builder');
		await openRoster(page);
		await openDetail(page, 'Bennett');
		await expect(page.locator('.dc-team')).toHaveText(/In team/);
		await page.locator('.dc-team').click();
		await page.keyboard.press('Escape');
		expect(await boardNames(page)).toEqual(['Jean']);
	});

	test('a selected TEAM fills in click order, and a second pick frees the slot', async ({
		page,
		seed
	}) => {
		await seed({ board: { teams: [['bennett'], [null]] } });
		await openTool(page, '/team-builder');
		// ⚓ The game's model: select a ROW (any slot selects it), picks land in
		// its earliest empty slot, the same pick again takes it out.
		await page.locator('.bv-team').nth(1).locator('.bv-slot').nth(2).click();
		const pick = async (name: string) => {
			await openDetail(page, name);
			await page.locator('.dc-team').click();
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
		expect(await team2()).toEqual(['Furina', 'Xingqiu', '', '']);
		await pick('Furina');
		expect(await team2(), 'the others keep their places').toEqual(['', 'Xingqiu', '', '']);
	});

	test('a preset board opens with its teams', async ({ page }) => {
		await openTool(page, '/team-builder');
		await page.locator('.band-a .band-menu-trigger[aria-label="New board"]').click();
		await page.getByRole('menuitem', { name: /Stygian Onslaught/ }).click();
		// ⚠ Not the strip's hidden MEASURING copy, which carries the same classes.
		await expect(page.locator('.band-a .doc-tabs:not(.doc-tabs--measure) .doc-tab')).toHaveCount(2);
		await expect(page.locator('.bv-team'), 'Stygian is three teams').toHaveCount(3);
	});

	test('a ?team= deep link lands on the active board and strips the param', async ({ page }) => {
		await openTool(page, '/team-builder?team=bennett,jean,diona,gorou');
		expect(await boardNames(page)).toEqual(['Bennett', 'Jean', 'Diona', 'Gorou']);
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
		await openTool(page, `/team-builder?b=${param}`);
		await expect(page.locator('.bv-team')).toHaveCount(2);
		expect(await boardNames(page)).toEqual(['Furina', 'Nahida', 'Bennett']);
		await expect(page.locator('.band-a .doc-tab.active')).toHaveText(/Shared lineup/);
		const stored = JSON.parse(
			(await page.evaluate((k) => localStorage.getItem(k), KEYS.boards)) ?? '{}'
		);
		const active = stored.boards.find((b: { id: string }) => b.id === stored.activeBoardId);
		expect(active.teams[0].con, 'the sender’s C0 arrives as C0').toEqual({ furina: 2, nahida: 0 });
	});

	test('a board survives a reload', async ({ page }) => {
		await openTool(page, '/team-builder?team=bennett,jean');
		await page.reload({ waitUntil: 'networkidle' });
		await expect.poll(() => boardNames(page)).toEqual(['Bennett', 'Jean']);
	});
});

test.describe('audition', () => {
	test('pins the incumbent, offers candidates, and commits a slot swap', async ({ page, seed }) => {
		await seed({ team: { slots: ['bennett', 'jean', 'diona', 'gorou'] } });
		// Bennett holds slot 0 — the Planner bench's ⇄ arrives as ?swap=0.
		await openTool(page, '/team-builder?swap=0');
		await page.locator('.cmp-ref').first().waitFor();

		// ⚓ The incumbent is the REFERENCE, not a peer with a badge: it has its
		// own row above the candidates and is not one of the chips at all.
		await expect(page.locator('.cmp-ref')).toHaveCount(1);
		await expect(page.locator('.cmp-ref-role')).toHaveText(/slot 1/);
		await expect(page.locator('.cmp-col'), 'no candidates picked yet').toHaveCount(1);

		// The lens seeds with the jobs this slot does — ONE chip row now, on the
		// glass plate, grouping the chart AND narrowing the candidates.
		await expect(page.locator('.tb-aud')).toHaveCount(1);
		expect(await page.locator('.cmp-lenses .chip.active').count()).toBeGreaterThan(0);

		// Relaxing every chip is the AND escape hatch, and broadens candidates to
		// the whole roster minus the team — the deterministic bound.
		while ((await page.locator('.cmp-lenses .chip.active').count()) > 0) {
			await page.locator('.cmp-lenses .chip.active').first().click();
		}
		await expect(page.locator('.tb-cand')).toHaveCount(ROSTER_SIZE - 4);

		await page.locator('.tb-cand', { hasText: 'Furina' }).first().click();
		await page.locator('.cmp-take').first().waitFor();
		await expect(page.locator('.cmp-col:not(.cmp-ref)')).toHaveCount(1);

		// The errand commits into the Planner's tab and returns there.
		await page.locator('.cmp-take').first().click();
		await page.waitForURL(/rotation-planner/, { timeout: 10_000 });

		const names = await benchNames(page);
		expect(names, 'Furina replaces Bennett in slot 0').toContain('Furina');
		expect(names).not.toContain('Bennett');
		expect(page.url(), 'the swap never touches the URL').not.toContain('team=');
	});

	test('a slot with no capability to match on falls back to element', async ({ page, seed }) => {
		// ⚓ 17 of 123 characters have no ally-facing capability, and they are not a
		// curation gap — they are MAIN DPS as a role (Diluc here). Auditioning your
		// carry is normal, and it is exactly where "who covers what they cover" has
		// nothing to say, because a DPS's job is damage and this site does not
		// compute damage. Without the fallback this is a wall of ~118 chips.
		await seed({ team: { slots: ['diluc', 'jean', 'diona', 'gorou'] } });
		await openTool(page, '/team-builder?swap=0');
		await page.locator('.cmp-ref').first().waitFor();

		// ⛔ ONE vocabulary, never both: element chips REPLACE the capability chips.
		const chips = page.locator('.cmp-lenses .chip');
		await expect(chips).toHaveCount(7);
		await expect(page.locator('.cmp-lenses .chip--element')).toHaveCount(7);
		await expect(page.locator('.cmp-ctrl-label', { hasText: 'Element' })).toHaveCount(1);

		// Seeded to the incumbent's own element — the opening question is "who else
		// is Pyro", not a blank one.
		await expect(page.locator('.cmp-lenses .chip.active')).toHaveCount(1);
		await expect(page.locator('.cmp-lenses .chip.active')).toHaveText(/pyro/i);

		// …and that is what makes the list usable rather than the whole roster.
		const pyro = await page.locator('.tb-cand').count();
		expect(pyro).toBeGreaterThan(0);
		expect(pyro, 'a slice, not a wall').toBeLessThan(30);

		// Turning it off is still the escape hatch to everyone outside the team.
		await page.locator('.cmp-lenses .chip.active').click();
		await expect(page.locator('.tb-cand')).toHaveCount(ROSTER_SIZE - 4);
	});

	test('the audition reads the swap in your real rotation', async ({ page, seed }) => {
		// ⚓ 2026-10-07 (approved by Nate): the one comparison only this site can
		// make. The working rotation is parsed as written and with the candidate
		// renamed into the incumbent's segments; the parser loads on demand.
		await seed({
			team: {
				slots: ['bennett', 'xiangling', 'xingqiu', 'sucrose'],
				notation:
					'Bennett E Q > Xiangling E Q > Xingqiu E Q > Sucrose E Q > Xiangling N3 > Bennett E'
			}
		});
		await openTool(page, '/team-builder?swap=0');
		await page.locator('.cmp-ref').first().waitFor();

		// No candidate yet → nothing to read against.
		await expect(page.locator('.cmp-rot')).toHaveCount(0);

		await page.locator('.cmp-add .band-menu-trigger').click();
		await page.locator('.cmp-add-input').fill('Furina');
		await page.locator('.cmp-add-pick').first().click();

		const rot = page.locator('.cmp-rot');
		await expect(rot).toHaveCount(1);
		// Bennett's ATK buff is read off the rotation as written — a real share
		// of it, not the chart's cast-on-cooldown claim — and Furina's DMG bonus
		// off the swapped one.
		const atk = rot.locator('.cmp-rot-row', { hasText: 'ATK buff' });
		await expect(atk.locator('.cmp-rot-val').first()).toHaveText(/^[1-9]\d?%$/);
		const dmg = rot.locator('.cmp-rot-row', { hasText: 'DMG% buff' });
		await expect(dmg.locator('.cmp-rot-val').nth(1)).toHaveText(/^[1-9]\d*%$/);
	});
});

test.describe('ownership ledger', () => {
	test('wishlisting persists and narrows the roster view', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);

		await page.locator('.cc', { hasText: 'Bennett' }).first().locator('.cc-mag').click();
		await page.locator('.dc-panel').waitFor();
		// The roster is edited in the Library's Roster tab; W wishlists the tile
		// the details link arrives on.
		await page.getByRole('button', { name: 'Edit in Roster' }).click();
		await expect(page.locator('.til-card[data-id="bennett"]')).toBeFocused();
		await page.keyboard.press('w');
		expect(
			await page.evaluate(
				(k) => JSON.parse(localStorage.getItem(k) ?? '{}').bennett,
				KEYS.ownership
			)
		).toBe('wishlist');
		await page.keyboard.press('Escape');

		await page.locator('.tb-show .btn', { hasText: 'Wishlist' }).click();
		const names = await gridNames(page);
		expect(names).toContain('Bennett');
		expect(names).not.toContain('Jean');
		expect(names.length, 'the view is narrowed, not the full roster').toBeLessThan(5);
	});
});

test.describe('factions and buffs filter', () => {
	test('the Stellar facet finds enablers and gated-buff carriers', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);

		await page.locator('.tb-band .band-menu-trigger[aria-label="More filters"]').click();
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
