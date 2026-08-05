// Unified site chrome + Help/About areas: assert that ONE chrome renders on
// every surface (identical brand, same three meta glyphs, tool switcher only
// inside a tool), that each glyph opens its overlay the same way on the
// landing and in a tool WITHOUT moving the URL, and that every chapter is also
// a real standalone route.
//
// The no-URL-change assertions are the load-bearing ones: the tools layout
// keys its page layer on page.url.pathname, so a modal that moved the URL
// would remount the whole tool (see chromeModal.svelte.ts).
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4998';
let pass = 0,
	fail = 0;
const check = (name, ok, detail = '') => {
	console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
	if (ok) pass++;
	else fail++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('  pageerror:', e.message));

const box = async (sel) => await page.locator(sel).first().boundingBox();
const settle = () => page.waitForTimeout(350);

// ── 1: the chrome is the same object on both surfaces ─────────────────────
console.log('\n1. One chrome, two surfaces');

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await settle();
const landingBrand = await box('.chrome-brand');
const landingBtns = await page.locator('.chrome-btn').count();
const landingNav = await page.locator('.chrome-nav').count();

await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await settle();
const toolBrand = await box('.chrome-brand');
const toolBtns = await page.locator('.chrome-btn').count();
const toolNav = await page.locator('.chrome-nav').count();

check(
	'brand occupies the identical box on the landing and in a tool',
	landingBrand &&
		toolBrand &&
		Math.abs(landingBrand.x - toolBrand.x) < 1 &&
		Math.abs(landingBrand.y - toolBrand.y) < 1 &&
		Math.abs(landingBrand.width - toolBrand.width) < 1 &&
		Math.abs(landingBrand.height - toolBrand.height) < 1,
	`landing=${JSON.stringify(landingBrand)} tool=${JSON.stringify(toolBrand)}`
);
check(
	'three meta glyphs on both surfaces',
	landingBtns === 3 && toolBtns === 3,
	`landing=${landingBtns} tool=${toolBtns}`
);
check(
	'tool switcher shows in a tool and not on the landing',
	landingNav === 0 && toolNav === 1,
	`landing=${landingNav} tool=${toolNav}`
);

// The bar height is the shared token, and tool content still starts at 72px —
// clear of the dire border's 70px top-fade terminator.
const chromeH = await page.evaluate(() =>
	getComputedStyle(document.documentElement).getPropertyValue('--chrome-h').trim()
);
const contentTop = await page.evaluate(() => {
	const main = document.querySelector('.tool-main');
	return main ? parseFloat(getComputedStyle(main).paddingTop) : null;
});
check('--chrome-h is the unified 64px', chromeH === '64px', chromeH);
check('tool content top is still 72px', contentTop === 72, `${contentTop}px`);

// ── 2: every glyph opens its overlay, on both surfaces, without a nav ──────
console.log('\n2. Overlays open the same way everywhere, URL unmoved');

async function openAndCheck(surface, url, index, expectTitle) {
	await page.goto(url, { waitUntil: 'networkidle' });
	await settle();
	const before = page.url();
	await page.locator('.chrome-btn').nth(index).click();
	await settle();
	const title = await page.locator('[role="dialog"]').getAttribute('aria-label');
	check(
		`${surface}: glyph ${index} opens "${expectTitle}"`,
		title === expectTitle,
		`got "${title}"`
	);
	check(`${surface}: "${expectTitle}" left the URL alone`, page.url() === before, page.url());
	await page.keyboard.press('Escape');
	await settle();
	check(
		`${surface}: Escape closes "${expectTitle}"`,
		(await page.locator('[role="dialog"]').count()) === 0
	);
}

for (const [surface, url] of [
	['landing', `${BASE}/`],
	['tool', `${BASE}/team-builder`]
]) {
	await openAndCheck(surface, url, 0, 'About');
	await openAndCheck(surface, url, 1, 'Help');
	await openAndCheck(surface, url, 2, 'Settings');
}

// ── 3: help is contextual inside a tool ───────────────────────────────────
console.log('\n3. The "?" is contextual');

await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await settle();
await page.locator('.chrome-btn').nth(1).click();
await page.waitForSelector('.area-chapter.is-current');
check(
	'? inside the planner opens the Rotation Planner chapter',
	(await page.locator('.area-chapter.is-current').innerText()) === 'Rotation Planner',
	await page.locator('.area-chapter.is-current').innerText()
);
check(
	'the chapter body actually rendered its heading',
	(await page.locator('.area-body h1').innerText()) === 'Rotation Planner'
);

// Switching chapters inside the overlay must not navigate either.
const beforeSwitch = page.url();
await page.locator('.area-chapter', { hasText: 'Team Builder' }).click();
await settle();
check(
	'switching chapters in the overlay does not navigate',
	page.url() === beforeSwitch,
	page.url()
);
check(
	'the switched chapter rendered',
	(await page.locator('.area-body h1').innerText()) === 'Team Builder'
);
await page.keyboard.press('Escape');
await settle();

// The planner has to have survived the whole round trip — that is the payoff
// of never moving the URL.
check(
	'the planner is still mounted after the overlay round-trip',
	(await page.locator('.tool-page').count()) === 1 &&
		(await page.locator('.chrome-nav-link.is-current').innerText()) === 'Planner'
);

// ── 4: overlays carry no stray transforms ──────────────────────────────────
// (Was "parallax follows the scene": cursor parallax retired with the ascend
// rebuild — docs/archive/parallax-handoff.md. What remains load-bearing is
// the NEGATIVE space: neither the panel nor the backdrop may carry a
// transform, because a transformed ancestor becomes a containing block and
// traps the position:fixed panel.)
console.log('\n4. Overlay transforms');

async function overlayTransforms(url) {
	await page.goto(url, { waitUntil: 'networkidle' });
	await page.waitForTimeout(900);
	await page.locator('.chrome-btn').nth(1).click();
	await page.waitForSelector('.overlay-panel');
	await page.mouse.move(200, 200);
	await page.mouse.move(1400, 800);
	await page.waitForTimeout(700);
	return await page.evaluate(() => ({
		panel: getComputedStyle(document.querySelector('.overlay-panel')).transform,
		backdrop: getComputedStyle(document.querySelector('.overlay-backdrop')).transform
	}));
}

const onLanding = await overlayTransforms(`${BASE}/`);
const inTool = await overlayTransforms(`${BASE}/rotation-planner`);
const untransformed = (t) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
check(
	'landing: panel + backdrop untransformed (cursor moves must not drift them)',
	untransformed(onLanding.panel) && untransformed(onLanding.backdrop),
	`panel=${onLanding.panel} backdrop=${onLanding.backdrop}`
);
check(
	'tool: panel + backdrop untransformed',
	untransformed(inTool.panel) && untransformed(inTool.backdrop),
	`panel=${inTool.panel} backdrop=${inTool.backdrop}`
);
await page.keyboard.press('Escape');

// ── 5: the sidebar/tabs responsive split ──────────────────────────────────
console.log('\n5. Sidebar on wide, tabs on narrow');

await page.locator('.chrome-btn').nth(1).click();
await page.waitForSelector('.area-chapter.is-current');
const wideNav = await box('.area-nav');
const wideBody = await box('.area-body');
check(
	'wide: chapter list sits beside the body, not above it',
	wideNav && wideBody && wideNav.x + wideNav.width <= wideBody.x + 1,
	`nav right=${wideNav && wideNav.x + wideNav.width} body left=${wideBody?.x}`
);
check(
	'wide: the current chapter shows its table of contents',
	(await page.locator('.area-toc').count()) === 1
);

await page.setViewportSize({ width: 640, height: 900 });
await settle();
const narrowNav = await box('.area-nav');
const narrowBody = await box('.area-body');
check(
	'narrow: chapters stack above the body as tabs',
	narrowNav && narrowBody && narrowNav.y + narrowNav.height <= narrowBody.y + 1,
	`nav bottom=${narrowNav && narrowNav.y + narrowNav.height} body top=${narrowBody?.y}`
);
check(
	'narrow: the table of contents is dropped',
	(await page.locator('.area-toc:visible').count()) === 0
);
check(
	'narrow: the wordmark gives way to the logo alone',
	!(await page.locator('.chrome-wordmark').isVisible())
);
await page.setViewportSize({ width: 1600, height: 1000 });

// ── 6: every chapter is a real route ──────────────────────────────────────
console.log('\n6. Chapters stand alone as routes');

const ROUTES = [
	['/help', 'Help & FAQ'],
	['/help/team-builder', 'Team Builder'],
	['/help/rotation-planner', 'Rotation Planner'],
	['/help/crit-visualizer', 'Visualizers'],
	['/about', 'About critcalc'],
	['/contribute', 'Contribute'],
	['/privacy', 'Privacy']
];

for (const [route, heading] of ROUTES) {
	await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
	const h1 = await page.locator('.area-body h1').first().innerText();
	check(`${route} renders "${heading}"`, h1 === heading, `got "${h1}"`);
}

await page.goto(`${BASE}/faq`, { waitUntil: 'networkidle' });
await settle();
check('/faq redirects to /help', new URL(page.url()).pathname === '/help', page.url());

// ── 7: the center-marked rule above the footer ────────────────────────────
console.log('\n7. Footer rule (HRule variant="center")');

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200); // let the loading veil clear
const hr = await page.evaluate(() => {
	const r = (el) => (el ? el.getBoundingClientRect() : null);
	const wrap = document.querySelector('.ftr__rule');
	if (!wrap) return null;
	const mark = r(wrap.querySelector('.hrule-mark'));
	const lines = [...wrap.querySelectorAll('.hrule-line')].map(r);
	const legal = r(document.querySelector('.ftr__legal'));
	const box = r(wrap);
	return {
		caps: wrap.querySelectorAll('.hrule-cap').length,
		lineCount: lines.length,
		width: +box.width.toFixed(1),
		x: +box.x.toFixed(1),
		legalWidth: +legal.width.toFixed(1),
		legalX: +legal.x.toFixed(1),
		lineH: lines[0]?.height,
		// Lines must run INTO the mark's points — it tapers to a knife edge on
		// both sides, so a butt join would pinch.
		overlapLeft: +(lines[0].x + lines[0].width - mark.x).toFixed(2),
		overlapRight: +(mark.x + mark.width - lines[1].x).toFixed(2)
	};
});

check(
	'center variant has a mark and no endcaps',
	hr?.caps === 0 && hr?.lineCount === 2,
	`caps=${hr?.caps} lines=${hr?.lineCount}`
);
check(
	'footer rule shares the disclaimer’s measure',
	hr?.width === hr?.legalWidth && hr?.x === hr?.legalX,
	`rule ${hr?.x}+${hr?.width} vs text ${hr?.legalX}+${hr?.legalWidth}`
);
check('footer rule line is 2px', hr?.lineH === 2, `${hr?.lineH}px`);
check(
	'both lines overlap the mark’s points by 2px',
	hr?.overlapLeft === 2 && hr?.overlapRight === 2,
	`left ${hr?.overlapLeft}px / right ${hr?.overlapRight}px`
);

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
