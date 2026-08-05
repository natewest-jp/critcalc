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

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
