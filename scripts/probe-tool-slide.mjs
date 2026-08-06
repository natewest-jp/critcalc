// Tool→tool WORLD-LOCKED FADE (2026-08-05, replacing the slide): a
// tool-switcher navigation drifts each page layer by the GL camera's pose
// delta (~±219px @1600×1000 — toolPoseShift) while cross-fading — outgoing
// clears during the ease's gentle first leg, incoming fades in sequenced
// after it — and the pair settles clean (no transform residue, no horizontal
// scroll). The nav underline still glides on the same world clock.
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4998';
const SHOTS = process.env.SHOTS_DIR ?? '.';
const VW = 1600;
let pass = 0,
	fail = 0;
const check = (name, ok, detail = '') => {
	console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
	if (ok) pass++;
	else fail++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: VW, height: 1000 } });
page.on('pageerror', (e) => console.log('  pageerror:', e.message));

const txOf = (matrix) => {
	if (!matrix || matrix === 'none') return 0;
	const m = matrix.match(/matrix\(([^)]+)\)/);
	return m ? parseFloat(m[1].split(',')[4]) : 0;
};

async function sampleNav(linkText, midShot) {
	await page.evaluate(() => {
		window.__samples = [];
		const rec = () => {
			const pages = [...document.querySelectorAll('.tool-main > .tool-page')].map((p) => ({
				page: p.dataset.page,
				t: getComputedStyle(p).transform,
				o: parseFloat(getComputedStyle(p).opacity)
			}));
			window.__samples.push(pages);
			if (window.__samples.length < 300) requestAnimationFrame(rec);
		};
		requestAnimationFrame(rec);
	});
	await page.locator('.chrome-nav a', { hasText: linkText }).click();
	if (midShot) {
		// Catch the transition mid-FADE: some layer at intermediate opacity.
		// (At rest every layer is at opacity 0 or 1.)
		await page.waitForFunction(
			() =>
				[...document.querySelectorAll('.tool-main > .tool-page')].some((el) => {
					const o = parseFloat(getComputedStyle(el).opacity);
					return o > 0.2 && o < 0.8;
				}),
			null,
			{ timeout: 3000, polling: 'raf' }
		);
		await page.screenshot({ path: `${SHOTS}/${midShot}` });
	}
	// Settle hold (≤450ms) + the world clock (2400) + fade tail + settle pass.
	await page.waitForTimeout(3600);
	return page.evaluate(() => window.__samples);
}

function analyze(samples, fromPath, toPath) {
	const track = (path) =>
		samples
			.map((s) => s.find((p) => p.page === path))
			.filter(Boolean)
			.map((p) => ({ tx: txOf(p.t), o: p.o }));
	return { out: track(fromPath), inc: track(toPath) };
}

// ── TB → RP: world-locked fade (camera crane TB pose → RP pose) ─────────────
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
let s = await sampleNav('Planner', 'slide-tb-to-rp-mid.png');
let { out, inc } = analyze(s, '/team-builder', '/rotation-planner');
// The camera's pose delta at 1600×1000 is ~219px; world-locked layers drift by
// exactly that (never a viewport-scale slide).
const DRIFT_MIN = 100;
const DRIFT_MAX = 500;
const outDrift = Math.max(...out.map((p) => Math.abs(p.tx)));
check(
	'TB→RP: outgoing drifts with the world (pose delta, not a slide)',
	outDrift > DRIFT_MIN && outDrift < DRIFT_MAX,
	`max |tx|=${outDrift}`
);
check(
	'TB→RP: outgoing fades OUT (world-locked fade, not the old opaque pan)',
	Math.min(...out.map((p) => p.o)) < 0.05,
	`min o=${Math.min(...out.map((p) => p.o))}`
);
const incStart = inc.find((p) => p.o > 0.05);
check(
	'TB→RP: incoming fades in while world-locked (drift < pose delta ceiling)',
	inc.some((p) => p.o > 0.2 && p.o < 0.8) &&
		Math.max(...inc.map((p) => Math.abs(p.tx))) < DRIFT_MAX,
	`first visible tx=${incStart ? incStart.tx : 'n/a'}`
);
const rpFinal = inc[inc.length - 1];
check(
	'TB→RP: incoming settles at rest, fully opaque',
	Math.abs(rpFinal.tx) < 1 && rpFinal.o === 1,
	`tx=${rpFinal.tx} o=${rpFinal.o}`
);

// ── RP → TB: mirrored ───────────────────────────────────────────────────────
s = await sampleNav('Teams', 'slide-rp-to-tb-mid.png');
({ out, inc } = analyze(s, '/rotation-planner', '/team-builder'));
const outDrift2 = Math.max(...out.map((p) => Math.abs(p.tx)));
check(
	'RP→TB: outgoing drifts with the world and fades',
	outDrift2 > DRIFT_MIN && outDrift2 < DRIFT_MAX && Math.min(...out.map((p) => p.o)) < 0.05,
	`max |tx|=${outDrift2} min o=${Math.min(...out.map((p) => p.o))}`
);
check(
	'RP→TB: incoming fades in world-locked',
	inc.some((p) => p.o > 0.2 && p.o < 0.8) &&
		Math.max(...inc.map((p) => Math.abs(p.tx))) < DRIFT_MAX,
	''
);

// ── stale third layer stays invisible (the old streak repro, fade edition) ──
// After RP→TB, the RP layer sits baked invisible inside its retention window.
// Navigating TB→Viz before it tears down must never let it reappear.
await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await page.locator('.chrome-nav a', { hasText: 'Teams' }).click();
await page.waitForTimeout(3300); // transition done, RP layer still retained (HOLD 4000)
s = await sampleNav('Visualizers');
const staleRp = analyze(s, '/rotation-planner', '/crit-visualizer').out;
check(
	'stale RP layer stays invisible during TB→Viz',
	staleRp.length > 0 && staleRp.every((p) => p.o < 0.05),
	`max o=${staleRp.length ? Math.max(...staleRp.map((p) => p.o)) : 'n/a'}`
);
({ out, inc } = analyze(s, '/team-builder', '/crit-visualizer'));
check(
	'TB→Viz: the real outgoing fades out',
	Math.min(...out.map((p) => p.o)) < 0.05,
	`min o=${Math.min(...out.map((p) => p.o))}`
);

// ── nav underline glides between links with the pan ─────────────────────────
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
const barBefore = await page.locator('.chrome-nav-underline').boundingBox();
const curLink = await page.locator('.chrome-nav-link.is-current').boundingBox();
check(
	'underline bar sits under the current link',
	barBefore &&
		curLink &&
		Math.abs(barBefore.x - curLink.x) < 2 &&
		Math.abs(barBefore.width - curLink.width) < 2,
	`bar x=${barBefore?.x} w=${barBefore?.width} link x=${curLink?.x} w=${curLink?.width}`
);
const navBox = await page.locator('.chrome-nav').boundingBox();
check(
	'underline rides 1px above the nav bottom',
	barBefore &&
		navBox &&
		Math.abs(navBox.y + navBox.height - (barBefore.y + barBefore.height) - 1) < 0.5,
	`gap=${barBefore && navBox ? navBox.y + navBox.height - (barBefore.y + barBefore.height) : '?'}`
);
const destLink = await page.locator('.chrome-nav-link', { hasText: 'Planner' }).boundingBox();
// Record the bar every frame across the whole navigation rather than probing
// one wall-clock instant: the invariant is that it GLIDES (passes through the
// space between the links), which holds at any SLIDE_MS. A single fixed sample
// drifts toward the destination as the duration shrinks — at 800ms the old
// 500ms sample already landed ~80% of the way along.
await page.evaluate(() => {
	window.__bar = [];
	const rec = () => {
		window.__bar.push(document.querySelector('.chrome-nav-underline').getBoundingClientRect().x);
		if (window.__bar.length < 300) requestAnimationFrame(rec);
	};
	requestAnimationFrame(rec);
});
await page.locator('.chrome-nav a', { hasText: 'Planner' }).click();
await page.waitForTimeout(3300);
const barSamples = await page.evaluate(() => window.__bar);
const between = barSamples.filter((x) => x > barBefore.x + 2 && x < destLink.x - 2);
check(
	'underline glides through the gap between the links (not a jump)',
	between.length >= 3,
	`${between.length} intermediate samples of ${barSamples.length} (from ${barBefore?.x} toward ${destLink?.x})`
);
const barAfter = await page.locator('.chrome-nav-underline').boundingBox();
check(
	'underline settles under the destination link',
	barAfter &&
		Math.abs(barAfter.x - destLink.x) < 2 &&
		Math.abs(barAfter.width - destLink.width) < 2,
	`bar x=${barAfter?.x} w=${barAfter?.width} link x=${destLink?.x} w=${destLink?.width}`
);

// ── settle hygiene ──────────────────────────────────────────────────────────
const residue = await page.evaluate(() => {
	// The CURRENT page's layer — the retained outgoing (HOLD 4000) is parked
	// with an inline transform by design.
	const p = [...document.querySelectorAll('.tool-main > .tool-page')].find(
		(el) => el.dataset.page === location.pathname
	);
	return { transform: p.style.transform, willChange: p.style.willChange };
});
check(
	'settled layer carries no inline transform/will-change',
	residue.transform === '' && residue.willChange === '',
	JSON.stringify(residue)
);
const hScroll = await page.evaluate(() => {
	const shell = document.querySelector('.tool-shell');
	return { sw: shell.scrollWidth, cw: shell.clientWidth };
});
check('no horizontal scroll after slides', hScroll.sw <= hScroll.cw, JSON.stringify(hScroll));

// ── Interrupted legs leave no GHOST layer ───────────────────────────────────
// Regression, 2026-08-06. Three navigations faster than the fade-out (~667ms)
// put THREE layers on screen at once. The bake-then-re-animate pass used to
// re-animate only the layer we came from, so the one before it kept the
// MID-FLIGHT opacity the bake had written into its inline style — a ghost tool
// hanging over the new one until Svelte's HOLD_MAX_MS retention removed it,
// ~1-2s later. Measured at 0.24 opacity for 139 consecutive frames. It needs
// three fast legs in a row, which is why it reads as random in use; a
// randomized walk mostly misses it, so this sequence is deliberate and fixed.
await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => {
	window.__ghostCensus = [];
	const t0 = performance.now();
	const tick = () => {
		window.__ghostCensus.push({
			t: Math.round(performance.now() - t0),
			path: location.pathname,
			rows: [...document.querySelectorAll('.tool-main > .tool-page')].map((p) => ({
				page: p.dataset.page,
				op: +(+getComputedStyle(p).opacity).toFixed(3)
			}))
		});
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
});
// ⚠ The tail matters: a leg allowed to SETTLE (3500) followed by two fast ones
// is what produced the measured ghost. Trimming this sequence makes the check
// pass against the unfixed layout — verified.
for (const [route, wait] of [
	['team-builder', 300],
	['rotation-planner', 350],
	['team-builder', 250],
	['crit-visualizer', 400],
	['rotation-planner', 300],
	['team-builder', 3500],
	['rotation-planner', 450],
	['crit-visualizer', 5000]
]) {
	await page.click(`.chrome-nav a[href*="${route}"]`);
	await page.waitForTimeout(wait);
}
await page.waitForTimeout(4000);
const census = await page.evaluate(() => window.__ghostCensus);
let cur = null,
	since = 0;
const ghosts = [];
const missing = [];
for (const f of census) {
	if (f.path !== cur) {
		cur = f.path;
		since = f.t;
	}
	const age = f.t - since;
	// Every clock that should have hidden a departed layer is long done by
	// 2.3s (fade-out 667 + settle ≈ 2100).
	if (age <= 2300) continue;
	for (const r of f.rows)
		if (r.page !== cur && r.op > 0.02) ghosts.push({ t: f.t, ghost: r.page, op: r.op });
	const own = f.rows.filter((r) => r.page === cur);
	if (own.length && own.every((r) => r.op < 0.9)) missing.push({ t: f.t, current: cur });
}
check(
	'interrupted legs leave no ghost layer painting',
	ghosts.length === 0,
	ghosts.length ? `${ghosts.length} frames, e.g. ${JSON.stringify(ghosts[0])}` : ''
);
check(
	'the destination never goes invisible after settling',
	missing.length === 0,
	missing.length ? `${missing.length} frames, e.g. ${JSON.stringify(missing[0])}` : ''
);
const finalLayers = census[census.length - 1];
check(
	'one layer left at rest, and it is the current route',
	finalLayers.rows.length === 1 && finalLayers.rows[0].page === finalLayers.path,
	JSON.stringify(finalLayers)
);

// ── Tool-rest pause (2026-08-06): the twinkle loop stops once a tool leg ────
// settles (zero rAF behind tools — the scene-occlusion property, restored),
// runs during any leg (the world must be alive while it sweeps), and runs on
// the landing. Probed via the renderer's own __scene.twinkling() surface.
// We are settled on a tool after the storm above.
const restAtTool = await page.evaluate(() => window.__scene?.twinkling());
check('twinkle loop RESTS on a settled tool route', restAtTool === false, String(restAtTool));
await page.click('.chrome-nav a[href*="rotation-planner"]');
await page.waitForTimeout(800); // mid-leg (world clock 2000)
const midLeg = await page.evaluate(() => window.__scene?.twinkling());
check('twinkle loop LIVE mid tool→tool leg', midLeg === true, String(midLeg));
await page.waitForTimeout(3000); // settle + rest margin
const restAgain = await page.evaluate(() => window.__scene?.twinkling());
check('twinkle loop rests again after the leg settles', restAgain === false, String(restAgain));
await page.click('a.chrome-brand');
await page.waitForTimeout(3400); // descend (2400) + margin
const atLanding = await page.evaluate(() => ({
	twinkling: window.__scene?.twinkling(),
	path: location.pathname
}));
check(
	'twinkle loop LIVE on the landing',
	atLanding.path === '/' && atLanding.twinkling === true,
	JSON.stringify(atLanding)
);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
