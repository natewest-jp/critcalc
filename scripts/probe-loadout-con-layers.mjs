/**
 * Probe: the two-layer constellation + loadout model (2026-07-21; write-routing
 * re-drawn by the bench-band round 2026-08-05).
 *
 * Layer 1 = the roster (global `constellations` + `loadout` stores), edited in
 * the Team Builder's ROSTER surfaces (Detail card; edit-roster grid); setting a
 * constellation there implies ownership. Layer 2 = the active tab (`tabCon` +
 * `tabLoadout` in the shared rotationTabs module), which shadows Layer 1
 * field-by-field, never touches the roster, and never marks ownership. A tab's
 * effective value is `tabX[id] ?? layer1[id]`. Saving a rotation DENSIFIES
 * (freezes) the resolved con + loadout for all slots so a saved artifact stays
 * faithful even if the roster changes later; an OPEN tab keeps
 * live-falling-back to the roster.
 *
 * THE BENCH BAND — the one slot-card column both tools dock — ALWAYS writes
 * Layer 2: it is the plan's team editor everywhere. (Pre-band, the TB bench
 * wrote Layer 1; one shared control routing differently per tool would be
 * incoherent, so the roster surfaces alone own Layer 1 now.)
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

// ── 3. The bench band on the TB writes Layer 2 (the tab), same as on the RP ──
await page.goto(`${BASE}/team-builder?team=nahida,furina`, { waitUntil: 'networkidle' });
await wait(1000);
check(
	'the bench band renders the shared SlotPortrait cards on the TB',
	(await page.locator('.bench-band-mount .sp-card').count()) === 4,
	String(await page.locator('.bench-band-mount .sp-card').count())
);
const rosterConsBefore = (await ls('critcalc:constellations')) || '{}';

// Set Nahida (slot 0) to C4 from the band's con chip.
await page.locator('.bench-band-mount .sp-cons-chip').first().click();
await wait(250);
await page.locator('.sp-popover .sp-pip').nth(4).click();
await wait(300);
const tabsAfterBandCon = JSON.parse((await ls('critcalc:rotationTabs')) || '{}');
const activeTabAfter = tabsAfterBandCon?.tabs?.find((t) => t.id === tabsAfterBandCon.activeTabId);
check(
	'band con chip writes tabCon (Layer 2) — the plan, not the roster',
	activeTabAfter?.tabCon?.nahida === 4,
	JSON.stringify(activeTabAfter?.tabCon)
);
check(
	'band con does NOT touch the roster constellations',
	((await ls('critcalc:constellations')) || '{}') === rosterConsBefore,
	String(await ls('critcalc:constellations'))
);
const bandOwn = JSON.parse((await ls('critcalc:ownership')) || '{}');
check(
	'band con does NOT mark ownership (plan ≠ ownership)',
	bandOwn.nahida === undefined,
	JSON.stringify(bandOwn)
);

// Set an artifact from the band → tabLoadout (Layer 2), never the roster loadout.
await page.locator('.bench-band-mount .sp-card').first().locator('.sp-lo-zone').first().click();
await wait(250);
// .lp-tile index 0 is the "None" tile — pick the first real artifact set.
await page.locator('.sp-popover--panel .lp-tile').nth(1).click();
await wait(300);
const tabsAfterBandLo = JSON.parse((await ls('critcalc:rotationTabs')) || '{}');
const activeTabLo = tabsAfterBandLo?.tabs?.find((t) => t.id === tabsAfterBandLo.activeTabId);
check(
	'band loadout writes tabLoadout (Layer 2)',
	!!activeTabLo?.tabLoadout?.nahida?.artifactSetId,
	JSON.stringify(activeTabLo?.tabLoadout?.nahida)
);
check(
	'band loadout does NOT touch the roster loadout',
	(await ls('critcalc:loadout')) === null,
	String(await ls('critcalc:loadout'))
);

// ── 4. Layer 1 still has its editor: the Detail card's con stepper ──────────
// The loadout panel stays open after a pick (re-leading is a feature) — close
// it before driving the Detail card.
await page.locator('.sp-popover-backdrop').click();
await wait(200);
await page.locator('.bench-band-mount .sp-avatar-clickable').first().dispatchEvent('click');
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
await page.locator('.dc-constepper .dc-con-btn', { hasText: 'C2' }).click();
await wait(300);
const rosterConsDetail = JSON.parse((await ls('critcalc:constellations')) || '{}');
check(
	'Detail card con stepper writes the roster (Layer 1)',
	rosterConsDetail.nahida === 2,
	JSON.stringify(rosterConsDetail)
);
const detailOwn = JSON.parse((await ls('critcalc:ownership')) || '{}');
check(
	'Detail card con implies ownership (roster rule)',
	detailOwn.nahida === 'owned',
	JSON.stringify(detailOwn)
);
await page.keyboard.press('Escape');
// The band still shows Nahida at its own Layer-2 override (C4), not the roster C2.
check(
	'band keeps showing the Layer-2 override over the new roster value',
	(await page.locator('.bench-band-mount .sp-cons-chip').first().innerText()) === 'C4',
	await page.locator('.bench-band-mount .sp-cons-chip').first().innerText()
);

check('no unexpected console/page errors', errors.length === 0, errors.join(' | '));

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
