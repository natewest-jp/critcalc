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

/** 122 = 123 character JSONs minus the `blank` placeholder the grid filters out. */
const ROSTER_SIZE = 122;

const matchCount = async (page: Page) => parseInt(await page.locator('.tb-count').innerText(), 10);

test.describe('roster and facets', () => {
	test('atlas is the front door; the roster grid lives under its tab', async ({ page }) => {
		await openTool(page, '/team-builder');
		await expect(page.locator('.tb-atlas .rolecard'), '2×2 role cards').toHaveCount(4);
		await expect(page.locator('.cg-grid'), 'grid hidden on the atlas tab').toHaveCount(0);

		await openRoster(page);
		await expect(page.locator('.cg-grid').first().locator('.cc')).toHaveCount(ROSTER_SIZE);
		await expect(
			page.locator('.tb-stubs'),
			'no uncurated bucket without capability facets'
		).toHaveCount(0);
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

		// The bucket collects only capability-UNKNOWN characters. Since the
		// 2026-07-23 two-tool split gave the frameless stubs complete Stage 1–3
		// capabilities, none are unknown — the stubs filter into the main grid
		// flagged by the frame chip, and the bucket does not render.
		await expect(page.locator('.tb-stubs')).toHaveCount(0);
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

	test('the constellation lens widens capability gates', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		await facetChip(page, 'Heals').click();

		await setConMode(page, 'C0');
		const atC0 = await matchCount(page);
		expect(await gridNames(page), 'Gorou heals only from C4').not.toContain('Gorou');

		await setConMode(page, 'C6');
		const atC6 = await matchCount(page);
		expect(atC6, `C6 unlocks more healers than C0 (C0=${atC0} C6=${atC6})`).toBeGreaterThan(atC0);
		expect(await gridNames(page), 'Gorou appears at C6').toContain('Gorou');
	});

	test('"My roster" mode gates on your own constellations', async ({ page, seed }) => {
		await seed({ constellations: { gorou: 4 } });
		await openTool(page, '/team-builder');
		await openRoster(page);
		await facetChip(page, 'Heals').click();
		await setConMode(page, 'My roster');

		const names = await gridNames(page);
		expect(names, 'your C4 Gorou now matches heal').toContain('Gorou');
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

		await page.locator('.cc', { hasText: 'Gorou' }).first().locator('.cc-main').click();
		await page.locator('.dc-panel').waitFor();
		await page.locator('.dc-caps .dc-cap').first().waitFor();

		expect(chunks.length, 'the card lazy-loads the character chunk').toBeGreaterThan(0);

		// A modal at every width — a fixed scrim, and the grid never reflows under it.
		await expect(page.locator('.dc-backdrop')).toHaveCSS('position', 'fixed');

		const caps = await page.locator('.dc-caps').innerText();
		expect(caps, 'Gorou shows C4 heal provenance').toMatch(/Heal/);
		expect(caps).toMatch(/C4/);
		expect(await page.locator('.dc-timing').innerText(), 'timing shows E cooldown').toMatch(/CD/);
	});

	test('the constellation stepper persists and survives reload', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		await page.locator('.cc', { hasText: 'Gorou' }).first().locator('.cc-main').click();
		await page.locator('.dc-panel').waitFor();

		await page.locator('.dc-con-btn', { hasText: 'C4' }).click();
		const stored = await page.evaluate(
			(k) => JSON.parse(localStorage.getItem(k) ?? '{}'),
			KEYS.constellations
		);
		expect(stored.gorou, 'stepper writes the constellations store').toBe(4);

		await page.keyboard.press('Escape');
		await expect(page.locator('.dc-panel'), 'Escape closes the card').toHaveCount(0);

		await page.reload({ waitUntil: 'networkidle' });
		await openRoster(page);
		await facetChip(page, 'Heals').click();
		await setConMode(page, 'My roster');
		expect(await gridNames(page), 'the constellation survived reload').toContain('Gorou');
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

	test('the compare view aligns timing lanes and a facts table', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		for (const n of ['Bennett', 'Jean', 'Diona']) await addToCompare(page, n);

		await page.locator('.band-b .tb-nav-item', { hasText: 'Compare' }).click();
		await page.locator('.cmp-dim-label').first().waitFor();

		// A center Source view in normal flow — no scrim, no dock rules.
		await expect(page.locator('.cmp')).toHaveCSS('position', 'static');
		await expect(page.locator('.cmp-chip')).toHaveCount(3);

		const lanes = await page.locator('.cmp-dim-label').allInnerTexts();
		expect(lanes, 'timing ruler lanes').toEqual(
			expect.arrayContaining(['E cooldown', 'Q cooldown', 'Heal'])
		);
		expect(await page.locator('.cmp-ruler .cmp-rtick').count()).toBeGreaterThan(0);

		const factLabels = await page.locator('.cmp-table .cmp-td-label').allInnerTexts();
		expect(factLabels, 'Q energy is a facts row now').toContain('Q energy');
		await expect(page.locator('.cmp-table thead th'), 'label column + 3').toHaveCount(4);
		expect(await page.locator('.cmp-cell .cmp-gate').count()).toBeGreaterThanOrEqual(3);

		// Stacked bars share one scale: every character gets a cooldown ghost, and
		// being different cooldowns they must differ in width.
		const widths = await page
			.locator('.cb-ghost')
			.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
		expect(widths.length).toBeGreaterThanOrEqual(3);
		expect(
			widths.every((w) => w > 0),
			`widths ${widths.join(',')}`
		).toBe(true);
		expect(new Set(widths.map(Math.round)).size, 'non-uniform widths').toBeGreaterThan(1);
		expect(await page.locator('.cb-uptime').count()).toBeGreaterThanOrEqual(1);
	});

	test('removing and clearing sync the tab stack', async ({ page }) => {
		await openTool(page, '/team-builder');
		await openRoster(page);
		for (const n of ['Bennett', 'Jean', 'Diona']) await addToCompare(page, n);
		await page.locator('.band-b .tb-nav-item', { hasText: 'Compare' }).click();
		await page.locator('.cmp-dim-label').first().waitFor();

		await page.locator('.cmp-chip-remove').first().click();
		await expect(page.locator('.cmp-chip')).toHaveCount(2);
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
		await page.locator('.cmp-chip--anchor').first().waitFor();

		await expect(page.locator('.cmp-chip--anchor')).toHaveCount(1);
		await expect(page.locator('.cmp-chip-current')).toHaveCount(1);
		await expect(
			page.locator('.cmp-chip--anchor .cmp-chip-remove'),
			'the anchor stays pinned'
		).toHaveCount(0);

		// The candidates strip seeds with the incumbent's own facets as toggles.
		await expect(page.locator('.tb-aud')).toHaveCount(1);
		expect(await page.locator('.tb-aud-facets .chip.active').count()).toBeGreaterThan(0);

		// Relaxing every facet is the AND escape hatch, and broadens candidates to
		// the whole roster minus the team — the deterministic bound.
		while ((await page.locator('.tb-aud-facets .chip.active').count()) > 0) {
			await page.locator('.tb-aud-facets .chip.active').first().click();
		}
		await expect(page.locator('.tb-cand')).toHaveCount(122 - 4);

		await page.locator('.tb-cand', { hasText: 'Furina' }).first().click();
		await page.locator('.cmp-chip-commit').first().waitFor();
		await expect(page.locator('.cmp-chip')).toHaveCount(2);

		await page.locator('.cmp-chip-commit').first().click();
		await page.locator('.cmp').waitFor({ state: 'detached' });

		const names = await benchNames(page);
		expect(names, 'Furina replaces Bennett in slot 0').toContain('Furina');
		expect(names).not.toContain('Bennett');
		expect(page.url(), 'the swap never touches the URL').not.toContain('team=');
		await expect(page.locator('.tb-tabstack'), 'audition picks are cleared').toHaveCount(0);
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
