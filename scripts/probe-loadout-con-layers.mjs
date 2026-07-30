/**
 * Probe: the two-layer constellation + loadout model (2026-07-21).
 *
 * Layer 1 = the roster (global `constellations` + `loadout` stores), edited ONLY
 * in the Team Builder; setting a constellation there implies ownership. Layer 2 =
 * the planner tab (`tabCon` + `tabLoadout`), which shadows Layer 1 field-by-field,
 * never touches the roster, and never marks ownership. A tab's effective value is
 * `tabX[id] ?? layer1[id]`. Saving a rotation DENSIFIES (freezes) the resolved
 * con + loadout for all slots so a saved artifact stays faithful even if the
 * roster changes later; an OPEN tab keeps live-falling-back to the roster.
 *
 * Both tools render the SAME SlotPortrait card (.sp-*), so the constellation chip
 * and loadout chips are identical — only the layer their writes land in differs.
 *
 * Run: start `npm run preview -- --port 4998 --strictPort`, then
 *      `node scripts/probe-loadout-con-layers.mjs`
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4998';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
	if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`);
});

let fails = 0;
function check(name, cond, extra = '') {
	console.log(`${cond ? '  ✓' : '  ✗'} ${name}${extra ? ' — ' + extra : ''}`);
	if (!cond) fails++;
}
const ls = (key) => page.evaluate((k) => localStorage.getItem(k), key);
const wait = (ms) => page.waitForTimeout(ms);

// Deterministic start.
await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

// ── 1. Planner con chip writes Layer 2 (the tab), not the roster ────────────
await page.locator('.cm-content').first().click();
await page.keyboard.type('Furina E Q > Bennett E Q');
await wait(1000);

const chip = (i) => page.locator('.sp-cons-chip').nth(i).innerText();
check('fresh tab starts at C0 (no roster entry yet)', (await chip(0)) === 'C0', await chip(0));

// Open Furina's constellation popover and set C2.
await page.locator('.sp-cons-chip').first().click();
await wait(250);
await page.locator('.sp-popover .sp-pip').nth(2).click();
await wait(300);
check('planner con chip reflects the tab override (C2)', (await chip(0)) === 'C2', await chip(0));

const tabs1 = JSON.parse((await ls('critcalc:rotationTabs')) || '{}');
check(
	'planner writes tabCon (Layer 2), keyed by character',
	tabs1?.tabs?.[0]?.tabCon?.furina === 2,
	JSON.stringify(tabs1?.tabs?.[0]?.tabCon)
);
check(
	'planner does NOT write the roster (Layer 1 constellations untouched)',
	(await ls('critcalc:constellations')) === null,
	String(await ls('critcalc:constellations'))
);
check(
	'planner does NOT mark ownership (theorycraft ≠ ownership)',
	(await ls('critcalc:ownership')) === null,
	String(await ls('critcalc:ownership'))
);

// ── 2. Densify-on-save freeze + open-tab live-fallback ──────────────────────
// Seed a roster constellation for Bennett (as if set in the Team Builder), then
// reload so the store reflects it. The un-overridden Bennett falls back to C1.
await page.evaluate(() =>
	localStorage.setItem('critcalc:constellations', JSON.stringify({ bennett: 1 }))
);
await page.reload({ waitUntil: 'networkidle' });
await wait(900);
check(
	'un-overridden slot falls back to the roster con (Bennett C1)',
	(await chip(1)) === 'C1',
	await chip(1)
);

// Save → the bank copy freezes the resolved con for every slot (Furina 2, Bennett 1).
// (.tb-btn was the pre-styleguide tab-bar family — chunk 3 folded it into .btn.)
await page.locator('.rp-tab-bar-actions .btn', { hasText: 'Save' }).click();
await wait(500);
const bank = JSON.parse((await ls('critcalc:savedNotations')) || '[]');
check(
	'save densifies the effective con for all slots (furina=2, bennett=1)',
	bank[0]?.tabCon?.furina === 2 && bank[0]?.tabCon?.bennett === 1,
	JSON.stringify(bank[0]?.tabCon)
);

// Roster changes to Bennett C6; reload so the store re-reads it. The OPEN tab keeps
// its sparse tabCon for Bennett → live-fallback shows the new roster value.
await page.evaluate(() =>
	localStorage.setItem('critcalc:constellations', JSON.stringify({ bennett: 6 }))
);
await page.reload({ waitUntil: 'networkidle' });
await wait(900);
check(
	'open tab live-falls-back to the changed roster (Bennett C6)',
	(await chip(1)) === 'C6',
	await chip(1)
);
check(
	'the explicit tab override survives the roster change (Furina C2)',
	(await chip(0)) === 'C2',
	await chip(0)
);

// Load the saved rotation → its frozen tabCon pins Bennett at C1 despite roster C6.
await page.locator('.rp-tab-bar-actions .btn', { hasText: 'Load' }).click();
await page.locator('.btn--primary', { hasText: 'Load' }).first().click();
await wait(700);
check(
	'loading a saved rotation restores the frozen con (Bennett C1, not C6)',
	(await chip(1)) === 'C1',
	await chip(1)
);

// ── 3. Team Builder Bench con/loadout write Layer 1 (roster) + imply owned ──
await page.goto(`${BASE}/team-builder?team=nahida,furina`, { waitUntil: 'networkidle' });
await wait(1000);
check(
	'Bench renders the shared SlotPortrait cards',
	(await page.locator('.bn .sp-card').count()) === 4,
	String(await page.locator('.bn .sp-card').count())
);

// Set Nahida (slot 0) to C4 from the Bench con chip.
await page.locator('.bn .sp-cons-chip').first().click();
await wait(250);
await page.locator('.sp-popover .sp-pip').nth(4).click();
await wait(300);
const benchCons = JSON.parse((await ls('critcalc:constellations')) || '{}');
check(
	'Bench con chip writes the roster (Layer 1 constellations)',
	benchCons.nahida === 4,
	JSON.stringify(benchCons)
);
const benchOwn = JSON.parse((await ls('critcalc:ownership')) || '{}');
check(
	'Bench con implies ownership (roster rule)',
	benchOwn.nahida === 'owned',
	JSON.stringify(benchOwn)
);

// Set an artifact loadout from the Bench (Layer-1 loadout is net-new here).
await page.locator('.bn .sp-card').first().locator('.ld-trigger').first().click();
await wait(250);
// .ld-item index 0 is the "None" option — pick the first real artifact set.
await page.locator('.ld-dropdown .ld-item').nth(1).click();
await wait(300);
const benchLoadout = JSON.parse((await ls('critcalc:loadout')) || '{}');
check(
	'Bench loadout chip writes the roster loadout (Layer 1)',
	!!benchLoadout.nahida?.artifactSetId,
	JSON.stringify(benchLoadout.nahida)
);

check('no unexpected console/page errors', errors.length === 0, errors.join(' | '));

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
