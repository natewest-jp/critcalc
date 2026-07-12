/**
 * scripts/probe-team-builder.mjs
 *
 * Headless verification of the Team Builder Layer 1 surface against a served
 * build (default http://localhost:4998). Drives: roster grid render, capability
 * facet filtering (AND semantics), the uncurated bucket, constellation modes
 * (C0 / My roster / C6), detail-card lazy load + provenance + constellation
 * stepper persistence.
 *
 *   npm run preview -- --port 4998 --strictPort &
 *   node scripts/probe-team-builder.mjs [--headed]
 */

import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://localhost:4998';
const headless = !process.argv.includes('--headed');

const browser = await chromium.launch({ channel: 'chrome', headless });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const failures = [];
const pass = (name) => console.log(`  ✓ ${name}`);
const fail = (name, detail) => {
	failures.push(name);
	console.log(`  ✗ ${name} — ${detail}`);
};
const check = (name, cond, detail = '') => (cond ? pass(name) : fail(name, detail));

const consoleErrors = [];
page.on('console', (msg) => {
	// Avatar 404 fallbacks are by design (verify skill notes); everything else counts.
	if (msg.type() === 'error' && !msg.text().includes('404')) consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

const tileCount = () => page.locator('.tb-grid').first().locator('.tb-tile').count();
const matchCount = async () => {
	const text = await page.locator('.tb-count').innerText();
	return parseInt(text, 10);
};
const facetChip = (label) => page.locator('.tb-chip', { hasText: label }).first();

console.log('team-builder probe @', BASE);

// ── 1. Cold load: full roster grid ─────────────────────────────────────────
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
const total = await tileCount();
check('roster grid renders the full roster (120)', total === 120, `got ${total}`);
check(
	'no uncurated bucket without capability facets',
	(await page.locator('.tb-stubs').count()) === 0
);

// ── 2. Heal facet: filtering + honest stub bucket ──────────────────────────
await facetChip('Heals').click();
const healers = await matchCount();
check('heal facet narrows the grid', healers > 15 && healers < 45, `got ${healers}`);
const bucket = page.locator('.tb-stubs');
check('uncurated bucket appears under capability facets', (await bucket.count()) === 1);
const stubTiles = await bucket.locator('.tb-tile').count();
check(
	'bucket holds the uncurated stubs (~11)',
	stubTiles >= 8 && stubTiles <= 14,
	`got ${stubTiles}`
);
const names = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
check('Bennett matches heal', names.includes('Bennett'), names.slice(0, 8).join(','));
check('Jean matches heal (passive-derived)', names.includes('Jean'));

// ── 3. AND semantics: heal + ATK buff ──────────────────────────────────────
await facetChip('ATK buff').click();
const both = await matchCount();
const bothNames = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
check(
	'heal+ATK-buff intersects (Bennett present, far fewer matches)',
	both < healers && bothNames.includes('Bennett'),
	`${both} matches: ${bothNames.join(',')}`
);
await facetChip('ATK buff').click(); // off

// ── 4. Constellation modes: C0 vs C6 widen gates ───────────────────────────
await page.locator('.tb-conmode-btn', { hasText: 'C0' }).click();
const atC0 = await matchCount();
await page.locator('.tb-conmode-btn', { hasText: 'C6' }).click();
const atC6 = await matchCount();
check(
	'C6 unlocks more healers than C0 (Gorou C4, Xianyun C4…)',
	atC6 > atC0,
	`C0=${atC0} C6=${atC6}`
);
const c6Names = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
check('Gorou appears at C6 (C4-gated heal)', c6Names.includes('Gorou'), '');
check(
	'Gorou absent at C0',
	!(await (async () => {
		await page.locator('.tb-conmode-btn', { hasText: 'C0' }).click();
		const n = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
		return n.includes('Gorou');
	})())
);

// ── 5. Detail card: lazy load, provenance, con stepper persistence ─────────
await facetChip('Heals').click(); // clear facet
const chunkRequests = [];
page.on('request', (req) => {
	if (req.url().includes('/chunks/') && req.url().endsWith('.js')) chunkRequests.push(req.url());
});
await page.locator('.tb-tile', { hasText: 'Gorou' }).first().click();
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
await page.locator('.dc-caps .dc-cap').first().waitFor({ timeout: 5000 });
check(
	'detail card lazy-loads the character chunk',
	chunkRequests.length > 0,
	'no chunk request seen'
);
const capsText = await page.locator('.dc-caps').innerText();
check(
	'Gorou card shows C4 heal provenance',
	/Heal/.test(capsText) && /C4/.test(capsText),
	capsText.slice(0, 200)
);
// NOTE: no data-completeness assertions here — what SHOULD derive is the
// audit's job (scripts/audit-capabilities.mjs); this probe checks UI behavior.
const timing = await page.locator('.dc-timing').innerText();
check('timing reference shows E cooldown', /CD/.test(timing), timing);

// Constellation stepper → localStorage → "My roster" filtering
await page.locator('.dc-con-btn', { hasText: 'C4' }).click();
const stored = await page.evaluate(() =>
	JSON.parse(localStorage.getItem('critcalc:constellations') ?? '{}')
);
check('stepper persists to the constellations store', stored.gorou === 4, JSON.stringify(stored));
await page.keyboard.press('Escape');
check('Escape closes the card', (await page.locator('.dc-panel').count()) === 0);

await facetChip('Heals').click();
await page.locator('.tb-conmode-btn', { hasText: 'My roster' }).click();
const mineNames = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
check('My roster mode: Gorou (your C4) now matches heal', mineNames.includes('Gorou'), '');
check('My roster mode: C6-gated healers still absent (Dori)', !mineNames.includes('Dori'), '');

// Persistence across reload
await page.reload({ waitUntil: 'networkidle' });
await facetChip('Heals').click();
await page.locator('.tb-conmode-btn', { hasText: 'My roster' }).click();
const reloadNames = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
check('constellation survives reload (Gorou still matches)', reloadNames.includes('Gorou'), '');

// ── 6. Screenshots + console health ────────────────────────────────────────
await page.screenshot({ path: 'probe-team-builder-grid.png', fullPage: false });
await page.locator('.tb-tile', { hasText: 'Bennett' }).first().click();
await page.locator('.dc-caps .dc-cap').first().waitFor({ timeout: 5000 });
await page.screenshot({ path: 'probe-team-builder-card.png', fullPage: false });
check('no unexpected console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();
console.log(
	failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} FAILED: ${failures.join('; ')}`
);
process.exit(failures.length === 0 ? 0 : 1);
