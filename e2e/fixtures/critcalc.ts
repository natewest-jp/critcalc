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
	settings: 'critcalc:siteSettings'
} as const;

export type SeedState = {
	/** The working team + notation, as one active rotation tab. */
	team?: { slots: string[]; notation?: string; label?: string };
	constellations?: Record<string, number>;
	ownership?: Record<string, 'owned' | 'wishlist'>;
	settings?: Record<string, unknown>;
	saved?: unknown[];
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
			await page.addInitScript(
				([keys, s]: [typeof KEYS, SeedState]) => {
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
									notation: s.team.notation ?? '',
									manualSlots: s.team.slots,
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
				},
				[KEYS, state] as [typeof KEYS, SeedState]
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

/** Switch the Team Builder to its Roster tab and wait for the grid. */
export async function openRoster(page: Page) {
	await page.locator('.band-b .tb-nav-item', { hasText: 'Roster' }).click();
	await page.locator('.cg-grid').first().waitFor();
}

/** The names currently rendered in the character grid. */
export function gridNames(page: Page) {
	return page.locator('.cg-grid').first().locator('.cc-name').allInnerTexts();
}

/** A capability facet chip in the filter rail. */
export function facetChip(page: Page, label: string) {
	return page.locator('.tb-chips .chip', { hasText: label }).first();
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
	await page.locator('.band-b .band-menu-trigger').click();
	await page
		.locator('.band-menu-item', {
			has: page.locator('.tb-conmode-label', { hasText: new RegExp(`^${label}$`) })
		})
		.click();
}
