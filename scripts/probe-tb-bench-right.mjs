// Chunk 2 verification: tool order TB/RP/Viz + TB bench on the right edge.
import { chromium } from 'playwright';

const BASE = 'http://localhost:4998';
const SHOTS = process.env.SHOTS_DIR ?? '.';
let pass = 0,
	fail = 0;
const check = (name, ok, detail = '') => {
	console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
	if (ok) pass++;
	else fail++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });

// ── 1a: chrome switcher order on a tool route ────────────────────────────
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('  pageerror:', e.message));
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
// The card checks below need the full grid — the Atlas role cards are the default.
await page.locator('.tb-tabs .tab', { hasText: 'Roster' }).click();
await page.locator('.tb-grid').first().waitFor({ timeout: 5000 });
// .chrome-nav-link only: the gliding underline is an empty sibling <span> that
// mounts post-hydration (whether it's present at sample time is timing luck).
const navLabels = await page.locator('.chrome-nav .chrome-nav-link').allInnerTexts();
check(
	'chrome nav order is Teams / Planner / Visualizers',
	JSON.stringify(navLabels) === JSON.stringify(['Teams', 'Planner', 'Visualizers']),
	JSON.stringify(navLabels)
);

// ── 1a: landing hero card order ──────────────────────────────────────────
const landing = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await landing.goto(`${BASE}/`, { waitUntil: 'networkidle' });
// Assert on destination paths, not display names — the cards carry evocative
// titles (Ephemeris/Astrolabe/Observatory) that may be retuned.
const heroPaths = await landing
	.locator('a[href="/team-builder"], a[href="/rotation-planner"], a[href="/crit-visualizer"]')
	.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
check(
	'landing hero order is TB / RP / CV',
	JSON.stringify(heroPaths) ===
		JSON.stringify(['/team-builder', '/rotation-planner', '/crit-visualizer']),
	JSON.stringify(heroPaths)
);
await landing.close();

// ── 1b: bench sits on the RIGHT of the source at 1600px ──────────────────
const bx = await page.locator('.bn').boundingBox();
const sx = await page.locator('.tb-source').boundingBox();
check(
	'bench right of source @1600',
	bx && sx && bx.x > sx.x + sx.width - 1,
	`bn.x=${bx?.x} source right=${sx ? sx.x + sx.width : '?'}`
);
check(
	'bench holds the right edge @1600',
	bx && Math.abs(1600 - (bx.x + bx.width)) < 80,
	`bn right edge=${bx ? bx.x + bx.width : '?'}`
);
await page.screenshot({ path: `${SHOTS}/tb-1600.png` });

// ── 1b: detail is a MODAL — opening it never reflows the source grid ─────
const sxBefore = await page.locator('.tb-source').boundingBox();
await page.locator('.cc', { hasText: 'Bennett' }).first().locator('.cc-main').click();
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
const dcPos = await page.locator('.dc-backdrop').evaluate((el) => getComputedStyle(el).position);
const sxAfter = await page.locator('.tb-source').boundingBox();
check('detail is a modal @1600 (fixed scrim)', dcPos === 'fixed', `pos=${dcPos}`);
check(
	'opening detail does not reflow the source',
	sxBefore && sxAfter && Math.abs(sxBefore.width - sxAfter.width) < 1,
	`before=${sxBefore?.width} after=${sxAfter?.width}`
);
await page.screenshot({ path: `${SHOTS}/tb-1600-detail.png` });
await page
	.locator('.dc-close')
	.click()
	.catch(() => {});

// ── 1b: compare is a center Source VIEW — in-flow at every width ─────────
async function openCompare(p) {
	for (const name of ['Bennett', 'Jean']) {
		const card = p.locator('.cc', { hasText: name }).first();
		await card.hover();
		await card.locator('.tb-act--compare').click();
	}
	await p.locator('.tb-tabs .tab', { hasText: 'Compare' }).click();
	await p.locator('.cmp').waitFor({ timeout: 5000 });
}
await openCompare(page);
const cmpPos1600 = await page.locator('.cmp').evaluate((el) => getComputedStyle(el).position);
const cmpBox1600 = await page.locator('.cmp').boundingBox();
const bnBox1600 = await page.locator('.bn').boundingBox();
check('compare renders in-flow @1600', cmpPos1600 === 'static', `pos=${cmpPos1600}`);
check(
	'compare fills the center, left of the bench @1600',
	cmpBox1600 && bnBox1600 && cmpBox1600.x + cmpBox1600.width <= bnBox1600.x + 1,
	`cmp right=${cmpBox1600 ? cmpBox1600.x + cmpBox1600.width : '?'} bn.x=${bnBox1600?.x}`
);
await page.screenshot({ path: `${SHOTS}/tb-1600-compare.png` });

await page.setViewportSize({ width: 1280, height: 1000 });
await page.waitForTimeout(200);
const cmpPos1280 = await page.locator('.cmp').evaluate((el) => getComputedStyle(el).position);
check('compare stays in-flow @1280 (no overlay fallback)', cmpPos1280 === 'static', cmpPos1280);
await page.screenshot({ path: `${SHOTS}/tb-1280-compare.png` });
// Back to the roster; detail stays a modal at 1280 too.
await page.locator('.tb-tabs .tab', { hasText: 'Roster' }).click();
await page.locator('.cc', { hasText: 'Bennett' }).first().locator('.cc-main').click();
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
const dcPos1280 = await page
	.locator('.dc-backdrop')
	.evaluate((el) => getComputedStyle(el).position);
check('detail is a modal @1280', dcPos1280 === 'fixed', `pos=${dcPos1280}`);
await page.keyboard.press('Escape');
const bx1280 = await page.locator('.bn').boundingBox();
const sx1280 = await page.locator('.tb-source').boundingBox();
check(
	'bench still right of source @1280',
	bx1280 && sx1280 && bx1280.x > sx1280.x,
	`bn.x=${bx1280?.x} source.x=${sx1280?.x}`
);
await page.screenshot({ path: `${SHOTS}/tb-1280-detail.png` });

// ── mirrored surfaces: the bench is SIDE-LOCKED at every width ───────────
// It is a zone of the one tool frame now, the mirror of the planner's portrait
// column — so the old ≤900px flip-to-top is gone and the bench holds the right
// edge even where it crowds. (A real narrow treatment is the mobile pass's.)
for (const w of [1040, 760]) {
	await page.setViewportSize({ width: w, height: 1000 });
	await page.waitForTimeout(200);
	const bxN = await page.locator('.bn').boundingBox();
	const sxN = await page.locator('.tb-source').boundingBox();
	check(
		`bench stays right of source @${w} (no flip-to-top)`,
		bxN && sxN && bxN.x > sxN.x && Math.abs(bxN.y - sxN.y) < 2,
		`bn=(${bxN?.x},${bxN?.y}) source=(${sxN?.x},${sxN?.y})`
	);
	await page.screenshot({ path: `${SHOTS}/tb-${w}.png` });
}

// ── send affordance: arrow points right toward the planner ───────────────
await page.setViewportSize({ width: 1600, height: 1000 });
// Tiles near the viewport edges sit under the fixed chrome — dispatch the
// click directly rather than fighting hit-testing (same move as
// probe-team-builder.mjs).
await page
	.locator('.cc', { hasText: 'Bennett' })
	.first()
	.locator('.tb-act')
	.first()
	.dispatchEvent('click');
const sendText = (await page.locator('.bn-send').innerText()).trim();
check('bench send label ends with →', sendText.endsWith('→'), sendText);

// ── RP: explore link leads with ← under the left portrait column ─────────
const rp = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await rp.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
// The explore link only shows while the Source picker is open.
await rp.locator('.sp-avatar-clickable').first().dispatchEvent('click');
const explore = rp.locator('.rp-explore-link');
await explore.waitFor({ timeout: 5000 });
const exploreText = (await explore.innerText()).replace(/\s+/g, ' ').trim();
check('RP explore label leads with ←', exploreText.startsWith('←'), exploreText);
const exBox = await explore.boundingBox();
check('RP explore link docks on the left edge', exBox && exBox.x < 400, `x=${exBox?.x}`);
await rp.screenshot({ path: `${SHOTS}/rp-explore.png` });
await rp.close();

await page.close();
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
