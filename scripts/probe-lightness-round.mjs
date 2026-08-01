/**
 * probe-lightness-round.mjs — browser verification of the lightness-structure
 * round (2026-08-01): mid-rung control faces (--control-face), dark ink on
 * bright fills (--ink), the bar-fill lightness contract (barMix knobs + the
 * hydro re-cut), and the beige selected-state pilot (--sel-surface/--sel-ink).
 *
 * Parity is asserted against the SAME TS sources the app uses (Node ≥22
 * native type stripping), so the probe can't drift from the implementation.
 *
 * Usage: build + serve on :4998 first (see .claude/skills/verify), then
 *   node scripts/probe-lightness-round.mjs
 */
import { chromium } from 'playwright';
import { desaturate, elementColors } from '../src/lib/utils/elementColors.ts';
import { GHOST_FILL_MIX, GHOST_CHROMA_KEEP } from '../src/lib/timeline/barMix.ts';
import { hexToOklch } from './oklch.mjs';

const INK = 'rgb(8, 18, 37)'; // --ink
const CONTROL_FACE = 'rgb(88, 96, 113)'; // --control-face #586071
const SEL_SURFACE = 'rgb(237, 232, 222)'; // --sel-surface = --gilt-soft #ede8de
const CALM_FILL = 'rgb(43, 85, 144)'; // --calm-fill #2b5590
const CHART_BG = '#121b2f';

const failures = [];
const check = (label, ok, detail = '') => {
	console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? `  ${detail}` : ''}`);
	if (!ok) failures.push(label);
};

// ── Node-side: grayscale separation of the two most common elements ────────
{
	const dPyro = hexToOklch(elementColors.pyro.main).L;
	const dHydro = hexToOklch(elementColors.hydro.main).L;
	check(
		'pyro vs hydro ΔL ≥ 0.04 (grayscale-distinguishable)',
		Math.abs(dPyro - dHydro) >= 0.04,
		`pyro L ${dPyro.toFixed(3)} hydro L ${dHydro.toFixed(3)}`
	);
}

// Expected ghost fill, computed with the app's own helpers + knobs
function mixHex(a, b, pctA) {
	const c = (h) => {
		const n = parseInt(h.slice(1), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	};
	const [ar, ag, ab] = c(a);
	const [br, bg, bb] = c(b);
	const t = pctA / 100;
	return [
		Math.round(ar * t + br * (1 - t)),
		Math.round(ag * t + bg * (1 - t)),
		Math.round(ab * t + bb * (1 - t))
	];
}
// Handles both rgb(r, g, b) 0-255 ints and Chrome's color(srgb r g b) 0-1 floats
const parseRgb = (s) => {
	const v = (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
	return s.startsWith('color(') ? v.map((x) => Math.round(x * 255)) : v;
};
const near = (a, b, tol = 2) => a.length === 3 && a.every((v, i) => Math.abs(v - b[i]) <= tol);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

// ── Rotation planner ────────────────────────────────────────────────────────
await page.goto('http://localhost:4998/rotation-planner', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('.cm-content');
await page.keyboard.type('Furina E Q > Bennett E Q', { delay: 25 });
await page.waitForTimeout(1800);

const rp = await page.evaluate(() => {
	const gs = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
	const badge = document.querySelector('.rp-bar-uptime:not(.rp-bar-uptime--dim) .rp-bar-row-badge');
	const ghost = document.querySelector('.rp-bar-cd--ghost');
	const summon = document.querySelector('.rp-summon-label');
	const buffBar = document.querySelector('.rp-team-buff-bar:not(.rp-team-debuff-bar)');
	const composer = document.querySelector('.rp-composer-btn');
	const activeTab = document.querySelector('.rp-tab-bar .tab.active');
	return {
		badgeColor: gs(badge, 'color'),
		badgeShadow: gs(badge, 'textShadow'),
		ghostBg: gs(ghost, 'backgroundColor'),
		summonColor: gs(summon, 'color'),
		buffBg: gs(buffBar, 'backgroundColor'),
		composerBg: gs(composer, 'backgroundColor'),
		activeTabBg: gs(activeTab, 'backgroundColor'),
		activeTabColor: gs(activeTab, 'color'),
		controlFaceVar: getComputedStyle(document.documentElement)
			.getPropertyValue('--control-face')
			.trim()
	};
});

check('uptime badge is --ink', rp.badgeColor === INK, rp.badgeColor);
check('uptime badge has no halo', rp.badgeShadow === 'none', rp.badgeShadow);
check('summon label is --ink', rp.summonColor === INK, rp.summonColor ?? 'no summon row');
check(
	'ghost track = desaturate+mix parity (hydro)',
	near(
		parseRgb(rp.ghostBg ?? ''),
		mixHex(desaturate(elementColors.hydro.main, GHOST_CHROMA_KEEP), CHART_BG, GHOST_FILL_MIX)
	) ||
		near(
			parseRgb(rp.ghostBg ?? ''),
			mixHex(desaturate(elementColors.pyro.main, GHOST_CHROMA_KEEP), CHART_BG, GHOST_FILL_MIX)
		),
	rp.ghostBg
);
check('team-buff strip = lifted --calm-fill', rp.buffBg === CALM_FILL, rp.buffBg);
check('composer button face = --control-face', rp.composerBg === CONTROL_FACE, rp.composerBg);
check('planner active tab is beige', rp.activeTabBg === SEL_SURFACE, rp.activeTabBg);
check('planner active tab ink', rp.activeTabColor === INK, rp.activeTabColor);
check('--control-face token present', rp.controlFaceVar === '#586071', rp.controlFaceVar);

// ── Team builder tabs ───────────────────────────────────────────────────────
await page.goto('http://localhost:4998/team-builder', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const tb = await page.evaluate(() => {
	const t = document.querySelector('.tb-tabs .tab.active');
	return t ? { bg: getComputedStyle(t).backgroundColor, color: getComputedStyle(t).color } : null;
});
check('TB active tab is beige', tb?.bg === SEL_SURFACE, tb?.bg ?? 'no active tab');
check('TB active tab ink', tb?.color === INK, tb?.color ?? '');

// ── Help chapter nav ────────────────────────────────────────────────────────
await page.goto('http://localhost:4998/help', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const help = await page.evaluate(() => {
	const c = document.querySelector('.area-chapter.is-current');
	return c ? { bg: getComputedStyle(c).backgroundColor, color: getComputedStyle(c).color } : null;
});
check('Help current chapter is beige', help?.bg === SEL_SURFACE, help?.bg ?? 'not found');
check('Help current chapter ink', help?.color === INK, help?.color ?? '');

await browser.close();

if (errs.length) {
	console.log('\npage errors:', errs);
	failures.push('page errors');
}
console.log(failures.length ? `\nFAIL: ${failures.length} check(s)` : '\nAll checks passed.');
process.exit(failures.length ? 1 : 0);
