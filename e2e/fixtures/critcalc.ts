import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared fixtures for the browser-surface suite.
 *
 * Every spec seeds its own state and navigates fresh — no spec may depend on
 * another having run first. That is what makes a failure debuggable in
 * isolation and what the old one-long-script probes could not offer.
 */

/** localStorage keys the app restores from on mount (see src/lib/stores.ts). */
export const KEYS = {
	tabs: 'critcalc:rotationTabs',
	constellations: 'critcalc:constellations',
	ownership: 'critcalc:ownership',
	saved: 'critcalc:savedNotations',
	settings: 'critcalc:siteSettings',
	boards: 'critcalc:boards'
} as const;

/**
 * charId → the name you TYPE for it, read straight out of the committed eager
 * index (one JSON object per line — the generator writes it that way for
 * readable diffs, which makes it readable here too).
 *
 * ⚠ WHY A FILE SCRAPE RATHER THAN AN IMPORT. Since single truth (2026-08-13)
 * the team IS the notation, so seeding a team means writing NAMES into a
 * notation string — and the fixture cannot `import { characterIndex }` because
 * that module resolves `$lib`, an alias only Vite knows about and Playwright's
 * loader does not. Two lines of regex beat teaching the test runner the app's
 * module graph.
 */
const DISPLAY_NAME: Record<string, string> = Object.fromEntries(
	readFileSync(
		fileURLToPath(new URL('../../src/lib/data/characterIndex.generated.ts', import.meta.url)),
		'utf8'
	)
		.split('\n')
		.flatMap((line) => {
			const m = line.match(/^\t(\{.*?\}),?$/);
			if (!m) return [];
			const e = JSON.parse(m[1]) as { id: string; displayName: string };
			return [[e.id, e.displayName]] as [string, string][];
		})
);

/** Characters a player can see — the index minus the planner's `blank` slot.
 *  DERIVED from the same index the fixture already reads, so a new character
 *  cannot leave a spec that uses it one short (the hand-kept ROSTER_SIZE in
 *  team-builder.spec.ts is the class this avoids). */
export const CHARACTER_COUNT = Object.keys(DISPLAY_NAME).filter((id) => id !== 'blank').length;

/** The notation a seeded team resolves to: whatever the spec wrote, with any
 *  slot it does not already name appended as a bare-name segment — the same
 *  fold the app applies (notationEdit.foldTeamIntoNotation). */
function seedNotation(team: NonNullable<SeedState['team']>): string {
	let out = (team.notation ?? '').trim();
	for (const id of team.slots) {
		const name = DISPLAY_NAME[id];
		if (!name || out.includes(name)) continue;
		out = out ? `${out} > ${name}` : name;
	}
	return out;
}

export type SeedState = {
	/** The working team + notation, as one active rotation tab. ⚠ `slots` is a
	 *  CONVENIENCE now, not a second source of truth: it is folded into the
	 *  notation before the tab is written, because the notation is the team. */
	team?: { slots: string[]; notation?: string; label?: string };
	constellations?: Record<string, number>;
	ownership?: Record<string, 'owned' | 'wishlist'>;
	settings?: Record<string, unknown>;
	saved?: unknown[];
	/** One Team Builder board (lineups design §2.2), made the active one. */
	board?: { label?: string; teams: (string | null)[][] };
};

/**
 * Console noise that is BY DESIGN and must not fail a test:
 * missing `-newfit` avatars 404 and then fall back via handleAvatarError.
 * Anything else is a real error — see the `consoleErrors` fixture.
 */
const EXPECTED_NOISE = /404|Failed to load resource/;

type Fixtures = {
	/** Seed localStorage BEFORE the first navigation. Call, then goto. */
	seed: (state: SeedState) => Promise<void>;
	/** Collected page/console errors. Asserted empty at teardown. */
	consoleErrors: string[];
	/** Set true in a test that intentionally provokes an error. */
	allowConsoleErrors: boolean;
};

export const test = base.extend<Fixtures>({
	allowConsoleErrors: [false, { option: true }],

	seed: async ({ page }, use) => {
		await use(async (state: SeedState) => {
			// Resolve the team to its notation HERE, in Node: addInitScript's body is
			// serialized into the page and cannot reach the index.
			const notation = state.team ? seedNotation(state.team) : '';
			await page.addInitScript(
				([keys, s, seededNotation]: [typeof KEYS, SeedState, string]) => {
					/**
					 * ⚠ SEED ONCE, NEVER OVERWRITE. `addInitScript` re-runs on EVERY
					 * navigation in the page — including `page.reload()`. Writing
					 * unconditionally would silently restore the seed on top of whatever
					 * the test had just done, so a reload-then-assert test would measure
					 * the seed instead of the app and quietly "prove" the wrong thing.
					 * (It cost a real debugging detour on 2026-08-09.) Only fill a key
					 * that is not already there.
					 */
					const put = (key: string, value: unknown) => {
						if (localStorage.getItem(key) === null)
							localStorage.setItem(key, JSON.stringify(value));
					};

					if (s.team) {
						put(keys.tabs, {
							tabs: [
								{
									id: 'e2e-tab',
									label: s.team.label ?? 'E2E',
									notation: seededNotation,
									tabLoadout: {},
									tabCon: {},
									savedId: null
								}
							],
							activeTabId: 'e2e-tab'
						});
					}
					if (s.constellations) put(keys.constellations, s.constellations);
					if (s.ownership) put(keys.ownership, s.ownership);
					if (s.settings) put(keys.settings, s.settings);
					if (s.saved) put(keys.saved, s.saved);
					if (s.board) {
						put(keys.boards, {
							boards: [
								{
									id: 'e2e-board',
									label: s.board.label ?? 'E2E board',
									preset: 'custom',
									noRepeats: true,
									teams: s.board.teams.map((slots, i) => ({
										id: `e2e-team-${i}`,
										slots: [0, 1, 2, 3].map((k) => slots[k] ?? null)
									}))
								}
							],
							activeBoardId: 'e2e-board'
						});
					}
				},
				[KEYS, state, notation] as [typeof KEYS, SeedState, string]
			);
		});
	},

	/**
	 * ⚠ `auto: true` is load-bearing. Without it this fixture only runs for tests
	 * that name `consoleErrors` in their arguments — which is none of them — so
	 * the guard silently never fired. A guard nobody requests is not a guard.
	 */
	consoleErrors: [
		async ({ page, allowConsoleErrors }, use, testInfo) => {
			const errors: string[] = [];
			page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
			page.on('console', (m) => {
				if (m.type() === 'error' && !EXPECTED_NOISE.test(m.text()))
					errors.push(`console: ${m.text()}`);
			});

			await use(errors);

			// A silent console error is exactly the class of regression that goes
			// unnoticed for rounds, so it fails the test that provoked it.
			if (!allowConsoleErrors && testInfo.status === testInfo.expectedStatus) {
				expect(errors, 'unexpected console/page errors').toEqual([]);
			}

			/**
			 * Park the page so its live WebGL scene and rAF loop stop before
			 * Playwright closes the context. This was tried as a fix for the
			 * teardown hang documented in `playwright.config.ts` and did NOT fix
			 * it — it is kept only because dropping the GL context before teardown
			 * is tidy and costs nothing. Do not read it as the cure.
			 */
			await page.goto('about:blank').catch(() => {});
		},
		{ auto: true }
	]
});

export { expect };

// ── Navigation helpers ──────────────────────────────────────────────────────

/**
 * Open a tool and wait for the scene + tool surface to settle. Tools SSR a
 * default shell and restore real state after hydration, so an assertion made
 * too early reads the placeholder, not the app.
 */
export async function openTool(page: Page, path: string) {
	await page.goto(path, { waitUntil: 'networkidle' });
	await page.locator('.tool-main').waitFor({ state: 'visible' });
}

/** Put the Team Builder's split control on Roster and wait for the grid.
 *  ⚠ By ROLE with `exact`: "Roster + board" also contains "Roster". */
export async function openRoster(page: Page) {
	// ↻ §11.2: beside the docked board the roster is always showing; below the
	// dock it is the Characters tab.
	const toChars = page.locator('.tb-pane-switch', { hasText: 'Characters' });
	if (await toChars.count()) await toChars.click();
	await page.locator('.cg-grid').first().waitFor();
}

/** The names on the Team Builder's active board, slot order, empties skipped.
 *  The board draws no names, so they come from each slot's `data-name`. */
export async function boardNames(page: Page) {
	// ⚠ evaluateAll does not wait: hold for the board to exist first.
	const slots = page.locator('.tb-pane--board .bv-slot');
	await slots.first().waitFor();
	const all = await slots.evaluateAll((els) => els.map((e) => e.getAttribute('data-name') ?? ''));
	return all.filter(Boolean);
}

/** The names currently rendered in the character grid. */
export function gridNames(page: Page) {
	return page.locator('.cg-grid').first().locator('.cc-name').allInnerTexts();
}

/** Toggle a chip in the filter bar's More popover (a faction, a weapon…),
 *  closing the popover again so the grid is reachable. */
export async function moreChip(page: Page, label: string) {
	await page.locator('.tb-band .band-menu-trigger[aria-label="More filters"]').click();
	await page.locator('.mf .chip', { hasText: label }).first().click();
	await page.keyboard.press('Escape');
}

/** Toggle a "Can provide" glyph in the filter strip (step 4: the
 *  fingerprint's glyphs are the capability filter), by its facet label. */
export async function provideGlyph(page: Page, label: string) {
	await page.locator(`.rfs-glyph[aria-label="Can provide: ${label}"]`).click();
}

/** The names in the bench band's four team slots (empties excluded). */
export async function benchNames(page: Page) {
	const all = await page.locator('.bench-band-mount .sp-char-name').allInnerTexts();
	return all.map((t) => t.trim()).filter(Boolean);
}

/**
 * The constellation lens lives in a band-B menu portalled to <body>, so the
 * item selector is deliberately not scoped to the band.
 */
export async function setConMode(page: Page, label: string) {
	await page.locator('.band-b .band-menu-trigger[aria-label="Read capabilities at"]').click();
	await page
		.locator('.band-menu-item', {
			has: page.locator('.tb-conmode-label', { hasText: new RegExp(`^${label}$`) })
		})
		.click();
}
