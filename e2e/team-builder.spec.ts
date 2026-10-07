import {
	test,
	expect,
	openTool,
	openRoster,
	gridNames,
	facetChip,
	benchNames,
	setConMode,
	KEYS
} from './fixtures/critcalc';
import type { Page } from '@playwright/test';

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

const matchCount = async (page: Page) => parseInt(await page.locator('.tb-count').innerText(), 10);

test.describe('roster and facets', () => {
	test('the roster is the front door, opened by the role cards', async ({ page }) => {
		// ⚓ 2026-10-07: TWO surfaces. The Atlas's role cards open the Roster now
		// — full-size while nothing narrows it, the grid right beneath them.
		await openTool(page, '/team-builder');
		await expect(page.locator('.band-b .tb-nav-item'), 'Roster | Compare').toHaveCount(2);
		await expect(page.locator('.tb-atlas .rolecard'), 'four role cards').toHaveCount(4);
		await expect(page.locator('.cg-grid').first().locator('.cc')).toHaveCount(ROSTER_SIZE);
		await expect(
			page.locator('.tb-stubs'),
			'no uncurated bucket without capability facets'
		).toHaveCount(0);

		// A card IS the role filter: the grid narrows and SECTIONS (the old
		// drill-down), and the cards fold to a strip with that one chosen.
		await page.locator('.rolecard', { hasText: 'Support' }).click();
		await expect(page.locator('.tb-atlas .rolecard')).toHaveCount(0);
		await expect(page.locator('.rolechip.is-active')).toHaveText(/Support/);
		expect(await page.locator('.cg-section').count()).toBeGreaterThan(1);
		expect(await matchCount(page)).toBeLessThan(ROSTER_SIZE);

		// Choosing it again clears it, and the front door comes back.
		await page.locator('.rolechip.is-active').click();
		await expect(page.locator('.tb-atlas .rolecard')).toHaveCount(4);
		await expect(page.locator('.cg-section')).toHaveCount(0);
	});

	test('the heal facet narrows the grid to healers', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		await facetChip(page, 'Heals').click();

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
		await facetChip(page, 'Heals').click();
		const healers = await matchCount(page);

		await facetChip(page, 'ATK buff').click();
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
		await facetChip(page, 'Heals').click();

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
		await facetChip(page, 'Heals').click();
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

		await page.locator('.cc', { hasText: 'Fischl' }).first().locator('.cc-main').click();
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

	test('the constellation stepper persists and survives reload', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		await page.locator('.cc', { hasText: 'Fischl' }).first().locator('.cc-main').click();
		await page.locator('.dc-panel').waitFor();

		await page.locator('.dc-con-btn', { hasText: 'C4' }).click();
		const stored = await page.evaluate(
			(k) => JSON.parse(localStorage.getItem(k) ?? '{}'),
			KEYS.constellations
		);
		expect(stored.fischl, 'stepper writes the constellations store').toBe(4);

		await page.keyboard.press('Escape');
		await expect(page.locator('.dc-panel'), 'Escape closes the card').toHaveCount(0);

		await page.reload({ waitUntil: 'networkidle' });
		await openRoster(page);
		await facetChip(page, 'Heals').click();
		await setConMode(page, 'My roster');
		expect(await gridNames(page), 'the constellation survived reload').toContain('Fischl');
	});
});

test.describe('compare — the tab is the accumulator', () => {
	/**
	 * The action bar reveals on hover and the fixed nav overlaps tiles at the
	 * viewport edges, so dispatch the click directly to exercise the handler
	 * without fighting hit-testing. The hover reveal itself is a visual matter.
	 */
	const addToCompare = (page: Page, name: string) =>
		page
			.locator('.cc', { hasText: name })
			.first()
			.locator('.tb-act--compare')
			.dispatchEvent('click');

	test('picks accumulate silently in the tab, without navigating', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		await expect(page.locator('.tb-tabstack'), 'starts with no avatar stack').toHaveCount(0);

		await addToCompare(page, 'Bennett');
		await expect(page.locator('.tb-tabstack-circle')).toHaveCount(1);
		await expect(page.locator('.cg-grid').first(), 'the roster stays put').toBeVisible();

		await addToCompare(page, 'Jean');
		await addToCompare(page, 'Diona');
		await expect(page.locator('.tb-tabstack-circle')).toHaveCount(3);
	});

	test('the compare view is one block per effect — facts over lanes', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		for (const n of ['Bennett', 'Jean', 'Diona']) await addToCompare(page, n);

		await page.locator('.band-b .tb-nav-item', { hasText: 'Compare' }).click();
		await page.locator('.cmp-group').first().waitFor();

		// A center Source view in normal flow — no scrim, no dock rules.
		await expect(page.locator('.cmp')).toHaveCSS('position', 'static');
		await expect(page.locator('.cmp-col'), 'one header column per character').toHaveCount(3);

		// ⚓ THE GROUPING IS AN EFFECT, NEVER A BUTTON. "E cooldown" was a chart
		// group until 2026-08-13 and is now a FACTS ROW only: every lane's ghost
		// segment already is its cooldown, so a group for it printed the same
		// fact twice in two geometries.
		const groups = await page.locator('.cmp-group').allInnerTexts();
		expect(groups, 'effect groups').toEqual(expect.arrayContaining(['Heal']));
		expect(groups, 'buttons are not groups').not.toContain('E cooldown');
		expect(groups).not.toContain('Q cooldown');
		expect(await page.locator('.cmp-ruler .cmp-rtick').count()).toBeGreaterThan(0);

		// ↻ 2026-10-07: the cooldowns and the burst's cost are the HEADER's cost
		// line now — always on screen above the blocks, never a row of their own.
		const cost = await page.locator('.cmp-col-cost').allInnerTexts();
		expect(cost.join(' '), 'E, Q and energy in the header').toMatch(/E \d.*Q \d.*energy/);

		// The Heal block lines up one fact per character, then that effect's lanes.
		const heal = page.locator('.cmp-block', {
			has: page.locator('.cmp-group', { hasText: /^Heal$/ })
		});
		await expect(heal.locator('.cmp-fact'), 'a fact per column').toHaveCount(3);
		expect(await heal.locator('.cmp-lane').count()).toBeGreaterThan(0);

		// A lane carries its host's price — that is the point of host-as-lane.
		expect(await page.locator('.cmp-lane-cycle').first().innerText()).toMatch(/· [EQ]\b/);

		// The cycle TILES: a lane whose cooldown is shorter than the axis must
		// draw more than one window, and the repeats must be marked as projected
		// (cycle > 0) rather than drawn as strongly as the cast you can make now.
		const uptimes = await page
			.locator('.cmp-lane')
			.first()
			.locator('.cb-uptime')
			.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
		expect(uptimes.length, 'a tiled lane repeats its window').toBeGreaterThan(1);
		expect(
			uptimes.every((w) => w > 0),
			`widths ${uptimes.join(',')}`
		).toBe(true);

		// Stacked bars share one scale, so differing cooldowns differ in width.
		const ghosts = await page
			.locator('.cb-ghost')
			.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
		expect(ghosts.length).toBeGreaterThanOrEqual(3);
		expect(new Set(ghosts.map(Math.round)).size, 'non-uniform widths').toBeGreaterThan(1);
	});

	test('the lens picks which effect blocks are shown', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		for (const n of ['Bennett', 'Jean']) await addToCompare(page, n);
		await page.locator('.band-b .tb-nav-item', { hasText: 'Compare' }).click();
		await page.locator('.cmp-group').first().waitFor();

		const allBlocks = await page.locator('.cmp-group, .cmp-only-row').count();
		expect(allBlocks).toBeGreaterThan(1);

		// ↻ 2026-10-07: an effect's facts and its lanes are ONE block, so the
		// lens shows or hides them together. One chip on = one effect.
		await page.locator('.cmp-lenses .chip').first().click();
		await expect(page.locator('.cmp-group, .cmp-only-row')).toHaveCount(1);

		await page.locator('.cmp-lenses .chip.active').first().click();
		await expect(page.locator('.cmp-group, .cmp-only-row')).toHaveCount(allBlocks);
	});

	test('removing and clearing sync the tab stack', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		for (const n of ['Bennett', 'Jean', 'Diona']) await addToCompare(page, n);
		await page.locator('.band-b .tb-nav-item', { hasText: 'Compare' }).click();
		await page.locator('.cmp-group').first().waitFor();

		await page.locator('.cmp-chip-remove').first().click();
		await expect(page.locator('.cmp-col')).toHaveCount(2);
		await expect(page.locator('.tb-tabstack-circle'), 'the stack syncs').toHaveCount(2);

		// ↻ 2026-08-09: clearing no longer lands on a "nothing to compare" page.
		// Compare is unreachable without picks, so emptying it bounces back to the
		// Roster and the nav plate goes disabled.
		await page.locator('.cmp-headact').click();
		await expect(page.locator('.tb-tabstack')).toHaveCount(0);
		await expect(
			page.locator('.band-b .tb-nav-item', { hasText: 'Compare' }),
			'unreachable with nothing in it'
		).toBeDisabled();
		await expect(page.locator('.cg-grid').first(), 'bounced to the Roster').toBeVisible();
	});
});

test.describe('team slots', () => {
	const TEAM = ['bennett', 'jean', 'diona', 'gorou'];

	test('slots fill from the detail card and withhold resonance until full', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		expect(await benchNames(page), 'four empty slots').toHaveLength(0);

		await page.locator('.cc', { hasText: 'Bennett' }).first().locator('.cc-main').click();
		await page.locator('.dc-panel').waitFor();
		await page.locator('.dc-team').click();
		await page.keyboard.press('Escape');

		expect(await benchNames(page)).toHaveLength(1);
		expect(page.url(), 'the slots→URL mirror is retired').not.toContain('team=');
		await expect(page.locator('.ts-resnote'), 'resonance needs a full party').toHaveCount(1);
	});

	test('a full party resolves resonance and a coverage checklist', async ({ page, seed }) => {
		// pyro + anemo + cryo + geo = four distinct elements → Protective Canopy
		await seed({ team: { slots: TEAM } });
		await openTool(page, '/team-builder');

		// innerText arrives uppercased (pill text-transform, as of 2026-08-09 when
		// the resonance chips joined the coverage run) — match case-insensitively.
		const res = await page.locator('.ts-lead-pill--res').allInnerTexts();
		expect(res).toHaveLength(1);
		expect(res[0]).toMatch(/Protective Canopy/i);

		// innerText arrives uppercased (chip text-transform) — match case-insensitively.
		const covered = await page.locator('.ts-cov--yes').allInnerTexts();
		expect(
			covered.some((t) => /heal/i.test(t)),
			covered.join(',')
		).toBe(true);
		expect(
			await page.locator('.ts-cov--no').count(),
			'absent capabilities stay visible as misses'
		).toBeGreaterThan(0);
	});

	test('a slotted character reads as in-team and a fifth is refused', async ({ page, seed }) => {
		await seed({ team: { slots: TEAM } });
		await openTool(page, '/team-builder');
		await openRoster(page);

		await page.locator('.cc', { hasText: 'Bennett' }).first().locator('.cc-main').click();
		await page.locator('.dc-panel').waitFor();
		expect(await page.locator('.dc-team').innerText()).toMatch(/In team/);
		await page.keyboard.press('Escape');

		await page.locator('.cc', { hasText: 'Furina' }).first().locator('.cc-main').click();
		await page.locator('.dc-panel').waitFor();
		await expect(page.locator('.dc-team'), 'a full team refuses a fifth').toBeDisabled();
	});

	test('a ?team= deep link imports the team and strips the param', async ({ page }) => {
		// The inbound half of ?team= survives the mirror's retirement.
		await openTool(page, `/team-builder?team=${TEAM.join(',')}`);
		expect(await benchNames(page)).toHaveLength(4);
		expect(page.url(), '?team= is stripped after import').not.toContain('team=');
	});
});

test.describe('audition', () => {
	test('pins the incumbent, offers candidates, and commits a slot swap', async ({ page, seed }) => {
		await seed({ team: { slots: ['bennett', 'jean', 'diona', 'gorou'] } });
		await openTool(page, '/team-builder');

		// Bennett holds slot 0 — audition replacements for him from the bench.
		await page.locator('.bb-act[aria-label^="Audition"]').first().click();
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

		await page.locator('.cmp-take').first().click();
		await page.locator('.cmp').waitFor({ state: 'detached' });

		const names = await benchNames(page);
		expect(names, 'Furina replaces Bennett in slot 0').toContain('Furina');
		expect(names).not.toContain('Bennett');
		expect(page.url(), 'the swap never touches the URL').not.toContain('team=');
		await expect(page.locator('.tb-tabstack'), 'audition picks are cleared').toHaveCount(0);
	});

	test('a slot with no capability to match on falls back to element', async ({ page, seed }) => {
		// ⚓ 17 of 123 characters have no ally-facing capability, and they are not a
		// curation gap — they are MAIN DPS as a role (Diluc here). Auditioning your
		// carry is normal, and it is exactly where "who covers what they cover" has
		// nothing to say, because a DPS's job is damage and this site does not
		// compute damage. Without the fallback this is a wall of ~118 chips.
		await seed({ team: { slots: ['diluc', 'jean', 'diona', 'gorou'] } });
		await openTool(page, '/team-builder');

		await page.locator('.bb-act[aria-label^="Audition"]').first().click();
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
		await openTool(page, '/team-builder');
		await page.locator('.bb-act[aria-label^="Audition"]').first().click();
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

	test('an audition borrows the comparison and gives it back', async ({ page, seed }) => {
		// An audition scopes the selection to itself, which used to mean it DELETED
		// whatever comparison you had going — three picks, one bench ⇄, gone.
		await seed({ team: { slots: ['bennett', 'jean', 'diona', 'gorou'] } });
		await openTool(page, '/team-builder');
		await openRoster(page);

		for (const n of ['Furina', 'Xingqiu'] as const) {
			await page
				.locator('.cc', { hasText: n })
				.first()
				.locator('.tb-act--compare')
				.dispatchEvent('click');
		}
		await expect(page.locator('.tb-tabstack-circle')).toHaveCount(2);

		await page.locator('.bb-act[aria-label^="Audition"]').first().click();
		await page.locator('.cmp-ref').first().waitFor();
		await expect(page.locator('.tb-tabstack-circle'), 'scoped to the incumbent').toHaveCount(1);

		await page.locator('.cmp-headact').click(); // cancel
		await page.locator('.cmp-ref').waitFor({ state: 'detached' });
		await expect(page.locator('.tb-tabstack-circle'), 'the comparison came back').toHaveCount(2);
	});
});

test.describe('ownership ledger', () => {
	test('wishlisting persists and narrows the roster view', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);

		await page.locator('.cc', { hasText: 'Bennett' }).first().locator('.cc-main').click();
		await page.locator('.dc-panel').waitFor();
		await page.locator('.dc-own-btn--wish').click();
		expect(
			await page.evaluate(
				(k) => JSON.parse(localStorage.getItem(k) ?? '{}').bennett,
				KEYS.ownership
			)
		).toBe('wishlist');
		await page.keyboard.press('Escape');

		await page.locator('.tb-seg .btn', { hasText: 'Wishlist' }).click();
		const names = await gridNames(page);
		expect(names).toContain('Bennett');
		expect(names).not.toContain('Jean');
		expect(names.length, 'the view is narrowed, not the full roster').toBeLessThan(5);
	});

	test('edit mode toggles ownership by tile click', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);

		await page.locator('.tb-edit-toggle').click();
		await page.locator('.cc', { hasText: 'Diona' }).first().locator('.cc-main').click();
		expect(
			await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').diona, KEYS.ownership)
		).toBe('owned');
		expect(
			await page.locator('.cc--faded').count(),
			'not-owned characters fade while editing'
		).toBeGreaterThan(0);
	});
});

test.describe('factions and buffs filter', () => {
	test('the Stellar facet finds enablers and gated-buff carriers', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);

		const chips = page.locator('.cg-rail .chip', { hasText: /^(Moonsign|Hexerei|Stellar)$/ });
		await expect(chips, 'three faction/buff chips').toHaveCount(3);

		await page.locator('.cg-rail .chip', { hasText: 'Stellar' }).click();
		const names = await gridNames(page);
		// Sandrone enables the reaction; Diona carries a stellar-gated C6 buff;
		// Bennett is neither.
		expect(names).toContain('Sandrone');
		expect(names).toContain('Diona');
		expect(names).not.toContain('Bennett');
		expect(names.length).toBeLessThan(15);
	});
});
