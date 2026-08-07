/**
 * scripts/probe-marks.mjs
 *
 * The mark-sweep guard, at the browser surface.
 *
 * `src/lib/marks.test.ts` proves the SET is coherent (no drift from Lucide, no
 * orphans, no node carrying its own fill/stroke). It cannot prove the site
 * stopped typesetting its control glyphs — a `✓` in a button is valid Svelte
 * and valid TypeScript, and a static grep can't tell a control glyph from the
 * arrows in the help chapters' prose.
 *
 * So this walks the RENDERED text of every tool surface and fails on any of
 * the symbol code points that a mark should be carrying. It's the check that
 * the 2026-08-07 sweep stays swept.
 *
 * ⚠ Rarity stars (5★) are deliberately EXEMPT: "5★" is Genshin's own notation,
 * closer to prose than to a control, and it sits inline with a numeral. So is
 * the "?" on the Team Builder's maybe-coverage chip — a hedge, and "?" is a
 * real glyph in the body face. The law is about code points the text font
 * doesn't cover, not about punctuation.
 *
 *   npm run build && npm run preview -- --port 4998 --strictPort &
 *   node scripts/probe-marks.mjs [--headed]
 */

import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://localhost:4998';
const headless = !process.argv.includes('--headed');

/** Code points that must be geometry, never type, when they act as a mark. */
const BANNED = '←→↑↓⇄⇆↺↻✓✔✗✕✖✘●○☆🔒▾▴⌄⌃∅⧉⤴';

const browser = await chromium.launch({ channel: 'chrome', headless });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

// A working team, a saved entry and some ownership marks — several of the
// swept glyphs only render once there is content to render them for.
await page.addInitScript(() => {
	localStorage.setItem(
		'critcalc:rotationTabs',
		JSON.stringify({
			tabs: [
				{
					id: 't1',
					label: 'Vape Hu Tao',
					notation: 'Hu Tao E N3 Q > Xingqiu E Q',
					manualSlots: ['hu-tao', 'xingqiu', 'zhongli', 'albedo'],
					tabLoadout: {},
					tabCon: {},
					savedId: null
				}
			],
			activeTabId: 't1'
		})
	);
	localStorage.setItem('critcalc:constellations', JSON.stringify({ 'hu-tao': 1, xingqiu: 6 }));
	localStorage.setItem(
		'critcalc:ownership',
		JSON.stringify({ 'hu-tao': 'owned', xingqiu: 'wishlist' })
	);
	localStorage.setItem(
		'critcalc:savedNotations',
		JSON.stringify([
			{
				id: 's1',
				name: 'Vape Hu Tao',
				notation: 'Hu Tao E N3 Q > Xingqiu E Q',
				manualSlots: ['hu-tao', 'xingqiu', 'zhongli', 'albedo'],
				tabLoadout: {},
				tabCon: {},
				savedAt: 1754500000000
			}
		])
	);
});

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
	// Missing -newfit avatars 404 then fall back on purpose (see the verify skill).
	if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) {
		errors.push('console: ' + m.text());
	}
});

let failures = 0;

/** A surface that silently failed to open proves nothing — count it as a miss. */
function missing(what) {
	failures += 1;
	console.log(`❌ ${what.padEnd(38)} never opened — probe proved nothing here`);
}

async function audit(label) {
	const r = await page.evaluate((banned) => {
		const bad = new RegExp('[' + banned + ']', 'u');
		const hits = [];
		const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
		let n;
		while ((n = walk.nextNode())) {
			if (!bad.test(n.nodeValue)) continue;
			const el = n.parentElement;
			// Only what a user can actually see: hidden keep-alive tiles and the
			// help chapters' prose aren't controls.
			if (!el || !el.offsetParent) continue;
			if (el.closest('.area-body, .help-body, .sg-page')) continue;
			hits.push(
				`${el.tagName.toLowerCase()}.${el.className} :: ${n.nodeValue.trim().slice(0, 60)}`
			);
		}
		return { marks: document.querySelectorAll('svg.mark').length, hits: [...new Set(hits)] };
	}, BANNED);

	const ok = r.hits.length === 0;
	if (!ok) failures += r.hits.length;
	console.log(`${ok ? '✅' : '❌'} ${label.padEnd(38)} ${String(r.marks).padStart(3)} marks`);
	for (const h of r.hits) console.log(`      typeset glyph: ${h}`);
	return r;
}

async function open(path, settle = 1800) {
	await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(settle);
}

// ── Team Builder ───────────────────────────────────────────────────────────
await open('/team-builder');
await audit('team-builder · atlas');

for (const tab of ['Roster', 'Compare']) {
	const t = page.locator('.tb-tabgroup button', { hasText: new RegExp(`^${tab}`) });
	if (await t.count()) {
		await t.first().click();
		await page.waitForTimeout(1200);
		await audit(`team-builder · ${tab.toLowerCase()}`);
	}
}

// Detail card (the modal): lock chips, ownership row, team/compare actions.
const rosterTab = page.locator('.tb-tabgroup button', { hasText: /^Roster/ });
if (await rosterTab.count()) {
	await rosterTab.first().click();
	await page.waitForTimeout(1000);
	const tile = page.locator('.cg-grid .cc-card, .cg-grid button').first();
	if (await tile.count()) {
		await tile.click({ force: true }).catch(() => {});
		await page.waitForTimeout(1200);
		if (await page.locator('.dc-panel').count()) await audit('team-builder · detail card');
		else missing('team-builder · detail card');
		await page.keyboard.press('Escape');
	} else missing('team-builder · detail card');
} else missing('team-builder · roster tab');

// ── Rotation planner ───────────────────────────────────────────────────────
await open('/rotation-planner', 2200);
await audit('rotation-planner · bench + bands');

const load = page.locator('.doc-actions button', { hasText: /Load/ }).first();
if (await load.count()) {
	await load.click();
	await page.waitForTimeout(900);
	if (await page.locator('.sn-panel').count()) await audit('rotation-planner · saved bank');
	else missing('rotation-planner · saved bank');
	await page.keyboard.press('Escape');
} else missing('rotation-planner · saved bank');

// ── Visualizers ────────────────────────────────────────────────────────────
await open('/crit-visualizer', 2000);
await audit('crit-visualizer · workspace');

const trigger = page.locator('.ip-trigger').first();
if (await trigger.count()) {
	await trigger.click();
	await page.waitForTimeout(600);
	if (await page.locator('.ip-menu').count()) await audit('crit-visualizer · instrument picker');
	else missing('crit-visualizer · instrument picker');
} else missing('crit-visualizer · instrument picker');

// ── Settings (backup pair + the armed danger rungs) ────────────────────────
await open('/', 1500);
const cog = page.locator('button[aria-label*="Settings" i]').first();
if (await cog.count()) {
	await cog.click();
	await page.waitForTimeout(900);
	await audit('settings');
} else missing('settings');

console.log('\n--- page errors ---');
console.log(errors.length ? errors.join('\n') : 'none');

await browser.close();

if (failures > 0) {
	console.log(`\n❌ ${failures} typeset control glyph(s) still rendering.`);
	process.exit(1);
}
console.log('\n✅ every control glyph on the swept surfaces is geometry.');
