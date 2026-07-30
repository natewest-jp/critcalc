/**
 * scripts/probe-traveler-avatars.mjs
 * Regression probe: traveler portraits render (Aether default), flip to
 * Lumine via siteSettings.travelerVariant, settings-page control persists.
 * Serve a build on :4998 first (npm run preview -- --port 4998 --strictPort).
 */

import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const fails = [];
await page.goto('http://localhost:4998/team-builder', { waitUntil: 'networkidle' });
// The Atlas front door is the default view (2026-07-22 redesign); the roster
// grid + search live under the Roster tab.
await page.locator('.tb-tabs .tab', { hasText: 'Roster' }).click();
await page.locator('.cg-rail .field').fill('traveler');
// Portrait class only (each card also renders weapon + element glyphs).
// Portraits are background-image divs since the Safari-26 img-regression fix —
// the URL lives in the inline style, not a src attribute.
const imgs = await page.locator('.cg-grid .cc-img').count();
const srcs = await page
	.locator('.cg-grid .cc-img')
	.evaluateAll((els) => els.map((e) => e.style.backgroundImage));
if (!(imgs === 6 && srcs.every((s) => s.includes('aether'))))
	fails.push(`default aether portraits: ${imgs} imgs, srcs ${srcs[0]}`);
// flip setting via localStorage + reload (settings page control writes the same key)
await page.evaluate(() =>
	localStorage.setItem('critcalc:siteSettings', JSON.stringify({ travelerVariant: 'lumine' }))
);
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tb-tabs .tab', { hasText: 'Roster' }).click();
await page.locator('.cg-rail .field').fill('traveler');
const srcs2 = await page
	.locator('.cg-grid .cc-img')
	.evaluateAll((els) => els.map((e) => e.style.backgroundImage));
if (!(srcs2.length === 6 && srcs2.every((s) => s.includes('lumine'))))
	fails.push(`lumine after setting: ${srcs2[0]}`);
// Settings-page control exists — scoped to the Traveler segment (the consolidated
// SettingsPanel has several `.sp-segment` radiogroups; class was `.segment__option`
// before the af0a372 settings/help consolidation).
await page.goto('http://localhost:4998/settings', { waitUntil: 'networkidle' });
const travSeg = page.locator('.sp-segment[aria-label="Traveler variant"]');
// .segment buttons render UPPERCASE (control voice); compare case-insensitively.
const seg = (await travSeg.locator('.btn').allInnerTexts()).map((t) => t.toLowerCase());
if (!(seg.includes('aether') && seg.includes('lumine'))) fails.push(`settings control: ${seg}`);
const active = (await travSeg.locator('.btn.is-active').innerText()).toLowerCase();
if (active !== 'lumine') fails.push(`active option should reflect stored setting, got ${active}`);
await travSeg.locator('.btn', { hasText: 'Aether' }).click();
const stored = await page.evaluate(
	() => JSON.parse(localStorage.getItem('critcalc:siteSettings')).travelerVariant
);
if (stored !== 'aether') fails.push(`click didn't persist: ${stored}`);
await browser.close();
console.log(
	fails.length === 0
		? 'TRAVELER CHECKS PASSED (6 portraits aether→lumine, settings control wired)'
		: 'FAILED: ' + fails.join(' | ')
);
process.exit(fails.length ? 1 : 0);
