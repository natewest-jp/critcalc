import { test, expect, openTool } from './fixtures/critcalc';
import type { Page } from '@playwright/test';

/**
 * ONE site chrome on every surface, and meta overlays that never move the URL.
 *
 * The no-URL-change assertions are the load-bearing ones: the tools layout keys
 * its page layer on `page.url.pathname`, so an overlay that moved the URL would
 * remount the whole tool underneath it (see chromeModal.svelte.ts). "The
 * planner is still mounted after the round trip" is the payoff being protected.
 *
 * Deliberately NOT here: the footer rule's sub-pixel geometry and the
 * responsive sidebar/tabs split. The first is visual (Nate's eyes, per the
 * policy); the second would pin breakpoint behavior that the upcoming mobile
 * round is meant to redraw.
 */

/**
 * ⚠ ADDRESSED BY aria-label, NOT BY INDEX (2026-09-04). These were `.chrome-btn`
 * nth(0..2) until the compass landed as a fourth button — hidden above 47.5rem,
 * but still first in the DOM, so every index here silently shifted by one and
 * pointed at the wrong overlay. A label is what the assertion actually means
 * and it cannot be reordered out from under the test.
 */
const META = [
	{ label: 'About', title: 'About' },
	{ label: 'Help', title: 'Help' },
	{ label: 'Settings', title: 'Settings' }
];

/** The meta glyphs a reader can actually press at this viewport. */
const metaBtn = (page: Page, label: string) => page.locator(`.chrome-btn[aria-label="${label}"]`);

test.describe('one chrome, every surface', () => {
	test('the brand, meta glyphs and tool switcher are consistent', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });
		const landingBrand = await page.locator('.chrome-brand').first().boundingBox();
		const landingBtns = await page.locator('.chrome-btn:visible').count();
		await expect(page.locator('.chrome-nav'), 'no tool switcher on the landing').toHaveCount(0);

		await openTool(page, '/planner');
		const toolBrand = await page.locator('.chrome-brand').first().boundingBox();
		const toolBtns = await page.locator('.chrome-btn:visible').count();
		await expect(page.locator('.chrome-nav'), 'the switcher appears inside a tool').toHaveCount(1);

		// ⚠ :visible, not a raw count. The compass is in the DOM on every surface
		// and display:none above 47.5rem, so a plain count reads 4 at the 1600px
		// test viewport and says nothing about what a reader can press.
		// ↻ 2026-10-18 (⚓ Nate): ROSTER is on every surface. Inside a tool it
		// opens the Library overlay; on the landing it is a link to /library.
		expect(landingBtns, 'three meta glyphs plus Roster on the landing').toBe(4);
		expect(toolBtns, 'the same four inside a tool').toBe(4);
		await expect(
			page.locator('button.chrome-btn[aria-label="Roster"]'),
			'inside a tool Roster is a BUTTON (the overlay), never a link'
		).toHaveCount(1);
		await expect(metaBtn(page, 'Roster'), 'Roster sits in the tool chrome').toBeVisible();
		await expect(
			page.locator('.chrome-btn--nav'),
			'the compass is the narrow form and stays hidden at desk width'
		).toBeHidden();
		// The brand is one object that does not jump between surfaces.
		expect(landingBrand).toBeTruthy();
		expect(toolBrand).toBeTruthy();
		for (const side of ['x', 'y', 'width', 'height'] as const) {
			expect(Math.abs(landingBrand![side] - toolBrand![side]), `brand ${side}`).toBeLessThan(1);
		}
	});
});

/**
 * ⚠ ROSTER IS DELIBERATELY NOT IN `META` (2026-10-18). Inside a tool it is an
 * overlay like the three and keeps their contract (the tool must survive —
 * covered by team-builder.spec's Library tests); on the landing and the static
 * pages it NAVIGATES to /library, which is new, intended behaviour: there is no
 * tool underneath to remount, and no overlay host for the Library. It has its
 * own block below rather than an exception inside this loop.
 */
/**
 * ↻ 2026-10-18 (⚓ Nate): OFF A TOOL, ABOUT AND HELP ARE PAGES. On the landing
 * and the static pages there is no tool underneath to remount, and About/Help
 * are things you go and read, so their glyphs are links (About → /about, Help
 * → /help, its index). So the loop below keeps every META case on a TOOL and
 * only Settings on the landing — Settings stays a modal everywhere (a control
 * you reach for mid-task). The landing's About/Help have their own block.
 */
test.describe('meta overlays never navigate', () => {
	const CASES: [string, typeof META][] = [
		['/', META.filter((m) => m.label === 'Settings')],
		['/builder', META]
	];
	for (const [surface, metas] of CASES) {
		for (const { label, title } of metas) {
			test(`${surface} — "${title}" opens and closes without moving the URL`, async ({ page }) => {
				await page.goto(surface, { waitUntil: 'networkidle' });
				const before = page.url();

				await metaBtn(page, label).click();
				const dialog = page.locator('[role="dialog"]');
				await expect(dialog).toHaveAttribute('aria-label', title);
				expect(page.url(), 'the overlay left the URL alone').toBe(before);

				await page.keyboard.press('Escape');
				await expect(dialog).toHaveCount(0);
				expect(page.url()).toBe(before);
			});
		}
	}
});

test.describe('off a tool, About and Help are pages', () => {
	test('landing → Help goes to /help by the pages, not an overlay', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });
		await metaBtn(page, 'Help').click();
		await page.waitForURL('**/help');
		await expect(page.locator('.area-body h1').first()).toHaveText('Help & FAQ');
		await expect(page.locator('[role="dialog"]'), 'no overlay opened').toHaveCount(0);
		await expect(metaBtn(page, 'Help')).toHaveAttribute('aria-current', 'page');
	});

	test('on /about, About is the page already showing and does nothing', async ({ page }) => {
		await page.goto('/about', { waitUntil: 'networkidle' });
		const about = metaBtn(page, 'About');
		await expect(about).toHaveAttribute('aria-current', 'page');
		// A navigation would remount the {#key pathname} page body; mark it.
		await page.locator('.area-body').evaluate((el) => el.setAttribute('data-e2e-mark', '1'));
		await about.click();
		await page.waitForTimeout(500);
		expect(new URL(page.url()).pathname).toBe('/about');
		await expect(page.locator('.area-body[data-e2e-mark="1"]'), 'not re-rendered').toHaveCount(1);
		await expect(page.locator('[role="dialog"]')).toHaveCount(0);
	});
});

test.describe('the /library page', () => {
	test('the landing’s Roster goes to /library on its Roster tab', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });
		await metaBtn(page, 'Roster').click();
		await page.waitForURL('**/library?tab=roster');
		await expect(page.locator('.lib-tabs [role="tab"][aria-selected="true"]')).toHaveText('Roster');
		await expect(page.locator('.lib--page'), 'the page, not the overlay').toHaveCount(1);
		await expect(page.locator('.tool-shell'), 'no tool was entered').toHaveCount(0);
	});

	test('opening a rotation from the page arrives on the Planner with it', async ({
		page,
		seed
	}) => {
		await seed({
			saved: [
				{
					id: 's1',
					name: 'Library page e2e',
					notation: 'Hu Tao E N3 Q > Xingqiu E Q > Zhongli E',
					tabLoadout: {},
					tabCon: {},
					savedAt: 1754500000000
				}
			]
		});
		await page.goto('/library', { waitUntil: 'networkidle' });
		await expect(page.locator('.lib-tabs [role="tab"][aria-selected="true"]')).toHaveText('Teams');
		await page.locator('.lib-rot', { hasText: 'Library page e2e' }).click();
		await page.waitForURL('**/planner');
		await page.locator('.tool-main').waitFor({ state: 'visible' });
		await expect(page.locator('.cm-content').first()).toHaveText(
			'Hu Tao E N3 Q > Xingqiu E Q > Zhongli E'
		);
		// The tab survived the tools layout's own restore on arrival.
		const stored = await page.evaluate(() => localStorage.getItem('critcalc:rotationTabs'));
		const { tabs, activeTabId } = JSON.parse(stored ?? '{}');
		expect(tabs.find((t: { id: string }) => t.id === activeTabId)?.savedId).toBe('s1');
	});
});

test.describe('help is contextual and non-destructive', () => {
	test('the "?" opens the current tool\'s chapter and never remounts it', async ({ page }) => {
		await openTool(page, '/planner');
		await metaBtn(page, 'Help').click();
		await page.locator('.area-chapter.is-current').waitFor();

		await expect(page.locator('.area-chapter.is-current')).toHaveText('Rotation Planner');
		await expect(page.locator('.area-body h1'), 'the chapter body rendered').toHaveText(
			'Rotation Planner'
		);

		// Switching chapters inside the overlay must not navigate either.
		const before = page.url();
		await page.locator('.area-chapter', { hasText: 'Team Builder' }).click();
		await expect(page.locator('.area-body h1')).toHaveText('Team Builder');
		expect(page.url(), 'switching chapters does not navigate').toBe(before);

		await page.keyboard.press('Escape');
		// The payoff of never moving the URL: the tool survived the round trip.
		await expect(page.locator('.tool-page')).toHaveCount(1);
		await expect(page.locator('.chrome-nav-link.is-current')).toHaveText('Planner');
	});
});

test.describe('overlay containing blocks', () => {
	/**
	 * The NEGATIVE space is what is load-bearing: neither the panel nor the
	 * backdrop may carry a transform, because a transformed ancestor becomes a
	 * containing block and traps the `position: fixed` panel. (Cursor parallax
	 * itself retired with the ascend rebuild.)
	 */
	const untransformed = (t: string) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';

	async function overlayTransforms(page: Page, url: string) {
		await page.goto(url, { waitUntil: 'networkidle' });
		// ↻ 2026-10-18: Settings, not Help — off a tool Help is a link to /help
		// now, and Settings is the overlay every surface still has (same
		// ChromeOverlay panel and backdrop).
		await metaBtn(page, 'Settings').click();
		await page.locator('.overlay-panel').waitFor();
		await page.mouse.move(200, 200);
		await page.mouse.move(1400, 800);
		return page.evaluate(() => ({
			panel: getComputedStyle(document.querySelector('.overlay-panel')!).transform,
			backdrop: getComputedStyle(document.querySelector('.overlay-backdrop')!).transform
		}));
	}

	for (const [label, url] of [
		['landing', '/'],
		['tool', '/planner']
	]) {
		test(`${label}: panel and backdrop carry no transform`, async ({ page }) => {
			const t = await overlayTransforms(page, url);
			expect(untransformed(t.panel), `panel=${t.panel}`).toBe(true);
			expect(untransformed(t.backdrop), `backdrop=${t.backdrop}`).toBe(true);
		});
	}
});

test.describe('every chapter is also a real route', () => {
	const ROUTES: [string, string][] = [
		['/help', 'Help & FAQ'],
		['/help/builder', 'Team Builder'],
		['/help/planner', 'Rotation Planner'],
		['/help/visualizers', 'Visualizers'],
		['/about', 'About critcalc'],
		['/changelog', 'What’s new'],
		['/contribute', 'Contribute'],
		['/privacy', 'Privacy']
	];

	for (const [route, heading] of ROUTES) {
		test(`${route} stands alone`, async ({ page }) => {
			await page.goto(route, { waitUntil: 'networkidle' });
			await expect(page.locator('.area-body h1').first()).toHaveText(heading);
		});
	}

	test('/faq redirects to /help', async ({ page }) => {
		await page.goto('/faq', { waitUntil: 'networkidle' });
		expect(new URL(page.url()).pathname).toBe('/help');
	});
});
