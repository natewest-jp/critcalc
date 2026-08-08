/**
 * probe-png-dl.mjs — connector/active-strip alignment at an odd zoom, then
 * the PNG export menu → Download flow, on a seeded 4-character share URL.
 *
 * ↻ Repaired 2026-08-01 (lightness-structure round): the zoom slider
 * (.rp-zoom-inline) became − / + buttons in the frame-grammar rework, the
 * menu items are .rp-png-item (not .tb-png-item), and downloads land in
 * os.tmpdir() instead of a dead session path.
 *
 * Usage: build + serve on :4998 first (see .claude/skills/verify), then
 *   node scripts/probe-png-dl.mjs
 */
import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SHARE =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1720, height: 1050 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:4998/rotation-planner?r=${SHARE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

// 1. Alignment check at a non-default zoom (three + steps)
for (let i = 0; i < 3; i++) {
	// ⚠ Was `.rp-zoom-btn:has-text("+")`, which had been dead since the mark
	// sweep (2026-08-07) made every control glyph inline geometry — there is no
	// typeset "+" left to match, so this probe threw a TimeoutError before it
	// asserted anything. Match the accessible name instead: it survives a glyph
	// becoming an SVG, which is exactly the change that broke the old one.
	await page.click('[aria-label="Zoom in"]');
	await page.waitForTimeout(120);
}
await page.waitForTimeout(400);
const misalign = await page.evaluate(() => {
	const paths = [...document.querySelectorAll('.rp-svg--connectors path')].map((p) =>
		p.getBoundingClientRect()
	);
	const bgs = [...document.querySelectorAll('.rp-active-bg')].map((b) => b.getBoundingClientRect());
	// each connector edge must touch SOME bg edge exactly
	let worst = 0;
	for (const p of paths) {
		const dl = Math.min(...bgs.map((b) => Math.abs(p.left - b.right)));
		const dr = Math.min(...bgs.map((b) => Math.abs(p.right - b.left)));
		worst = Math.max(worst, dl, dr);
	}
	return worst;
});
console.log('worst connector↔active gap at zoomed scale:', misalign, 'px');

// 2. Share menu → Download flow
// ⚠ Both selectors were stale from the TOOLBAR ROUND (2026-08-07), which
// folded the frame's own ⧉ PNG button into band A's single Share menu — one
// family (link · KQM · image) in one place, instead of split across the top and
// bottom corners of the same tool. The probe has been throwing on the first
// click ever since, so nothing below it was running.
await page.click('button:has-text("Share")');
await page.waitForTimeout(300);
const dl = page.waitForEvent('download', { timeout: 15000 });
await page.click('.band-menu-item:has-text("Download timeline image")');
const download = await dl;
const out = join(tmpdir(), 'critcalc-probe-export.png');
await download.saveAs(out);
console.log('downloaded:', download.suggestedFilename(), '→', out);
console.log('errors:', errs.length ? errs : 'none');
await browser.close();
process.exit(errs.length ? 1 : 0);
