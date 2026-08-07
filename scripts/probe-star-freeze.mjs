// THE CREST IS ONE REST (⚓ Nate 2026-08-07): the twinkle field freezes on a
// single frame when a tool leg settles and stays on THAT frame for as long as
// you're in the crest tool space — through every tool→tool crane — thawing
// only on the way back down to the landing.
//
// Why a probe and not an eyeball: the field's every star phase is
// fract((starClock + offset)/duration), so "frozen on one frame" is exactly
// "window.__scene.starTime() does not move". That makes the invariant a
// numeric equality rather than a screenshot diff of a starfield, which is
// neither stable nor readable.
//
// The bug it pins: stopping the twinkle LOOP is not enough. The camera's own
// animation loop draws every frame of a tool→tool crane, so with an absolute
// clock those draws jump the field to the phase it "should" be at seconds
// later — Nate: "the stars flash into a different stage of animation".
//
// Needs the PREVIEW build on :4998 (npm run build && npm run preview), not dev.
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

const scene = () =>
	page.evaluate(() => {
		const s = window.__scene;
		return s ? { t: s.starTime(), twinkling: s.twinkling(), cam: s.camera() } : null;
	});

/** Sample the star clock every frame across a navigation, then settle. */
async function sampleNav(linkText, holdMs = 3600) {
	await page.evaluate(() => {
		window.__starSamples = [];
		const rec = () => {
			window.__starSamples.push({
				t: window.__scene.starTime(),
				cx: window.__scene.camera().x,
				path: location.pathname
			});
			if (window.__starSamples.length < 400) requestAnimationFrame(rec);
		};
		requestAnimationFrame(rec);
	});
	await page.locator('.chrome-nav a', { hasText: linkText }).click();
	await page.waitForTimeout(holdMs);
	return page.evaluate(() => window.__starSamples);
}

const spread = (xs) => Math.max(...xs) - Math.min(...xs);

// ── Cold load on a tool: the field settles frozen ──────────────────────────
await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500); // settle + REST_AFTER_SETTLE_MS margin

const rest0 = await scene();
check('the scene renderer mounted and exposes the star clock', !!rest0);
check('at tool rest the twinkle loop is stopped', rest0 && !rest0.twinkling);

await page.waitForTimeout(900);
const rest1 = await scene();
check(
	'at rest the star clock holds (the frozen frame survives idle time)',
	rest1 && rest1.t === rest0.t,
	rest1 && `${rest0.t.toFixed(1)} → ${rest1.t.toFixed(1)}`
);

// ── The tool→tool crane: the world sweeps, the field does not ──────────────
const toTb = await sampleNav('Teams');
const tbSpread = spread(toTb.map((s) => s.t));
const camSpread = spread(toTb.map((s) => s.cx));
check(
	'the camera actually craned during the leg (the probe exercised the real thing)',
	camSpread > 100,
	`camera x moved ${camSpread.toFixed(0)}px over ${toTb.length} frames`
);
check(
	'RP→TB: the star clock never moves across the whole leg',
	tbSpread === 0,
	`spread ${tbSpread.toFixed(1)}ms over ${toTb.length} frames`
);
const afterTb = await scene();
check(
	'RP→TB: the field settles on the SAME frame it was frozen on',
	afterTb && afterTb.t === rest0.t,
	afterTb && `${rest0.t.toFixed(1)} → ${afterTb.t.toFixed(1)}`
);
check('after the leg the twinkle loop is stopped again', afterTb && !afterTb.twinkling);

// ── A second leg, and a Visualizers leg (different pose sign) ──────────────
const toViz = await sampleNav('Visualizers');
check(
	'TB→Visualizers: the star clock never moves across the leg',
	spread(toViz.map((s) => s.t)) === 0,
	`spread ${spread(toViz.map((s) => s.t)).toFixed(1)}ms`
);
const afterViz = await scene();
check(
	'three tools deep, still the same frozen frame',
	afterViz && afterViz.t === rest0.t,
	afterViz && `${rest0.t.toFixed(1)} → ${afterViz.t.toFixed(1)}`
);

// ── The descend thaws it — and resumes where it froze, not where it "would
//    have been" (pop-free: the paused span is banked, never played back) ────
const beforeDescend = await scene();
const pausedFor = await page.evaluate(() => performance.now());
await page.locator('.chrome-brand, a[href="/"]').first().click();
await page.waitForTimeout(3200);
const landed = await scene();
check(
	'back on the landing the twinkle loop runs again',
	landed && landed.twinkling,
	landed && `path ${await page.evaluate(() => location.pathname)}`
);
const advanced = landed.t - beforeDescend.t;
check(
	'the descend thaws the clock (the field is alive again)',
	advanced > 500,
	`advanced ${advanced.toFixed(0)}ms`
);
check(
	'the thaw RESUMES rather than jumps (banked pause, not absolute time)',
	advanced < pausedFor - beforeDescend.t,
	`advanced ${advanced.toFixed(0)}ms vs ${(pausedFor - beforeDescend.t).toFixed(0)}ms of wall clock frozen`
);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
