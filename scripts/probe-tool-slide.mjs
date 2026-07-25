// Directional tool→tool slide (simplification chunk 3): assert that a
// tool-switcher navigation PANS the page layers sideways per the TOOLS order —
// outgoing exits toward its own side at full opacity, incoming sweeps in from
// the other — and that the pair settles clean (no transform residue, no
// horizontal scroll).
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
		await page.waitForTimeout(700);
		await page.screenshot({ path: `${SHOTS}/${midShot}` });
	}
	// Settle hold (≤450ms) + the slide + margin past the retention window.
	await page.waitForTimeout(2600);
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

// ── TB → RP: dir=+1, content sweeps LEFT (TB exits leftward, RP from right) ──
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
let s = await sampleNav('Planner', 'slide-tb-to-rp-mid.png');
let { out, inc } = analyze(s, '/team-builder', '/rotation-planner');
check(
	'TB→RP: outgoing TB exits LEFT a full layer width',
	Math.min(...out.map((p) => p.tx)) < -(VW - 100),
	`min tx=${Math.min(...out.map((p) => p.tx))}`
);
check(
	'TB→RP: outgoing stays opaque while moving (pan, not fade)',
	out.filter((p) => p.tx < -50).every((p) => p.o > 0.99),
	''
);
check(
	'TB→RP: incoming RP entered from the RIGHT',
	Math.max(...inc.map((p) => p.tx)) > VW - 100,
	`max tx=${Math.max(...inc.map((p) => p.tx))}`
);
const rpFinal = inc[inc.length - 1];
check(
	'TB→RP: incoming settles at rest, transform cleared',
	Math.abs(rpFinal.tx) < 1 && rpFinal.o === 1,
	`tx=${rpFinal.tx} o=${rpFinal.o}`
);

// ── RP → TB: mirrored (RP exits rightward revealing TB from the left) ───────
s = await sampleNav('Teams', 'slide-rp-to-tb-mid.png');
({ out, inc } = analyze(s, '/rotation-planner', '/team-builder'));
check(
	'RP→TB: outgoing RP exits RIGHT',
	Math.max(...out.map((p) => p.tx)) > VW - 100,
	`max tx=${Math.max(...out.map((p) => p.tx))}`
);
check(
	'RP→TB: incoming TB entered from the LEFT',
	Math.min(...inc.map((p) => p.tx)) < -(VW - 100),
	`min tx=${Math.min(...inc.map((p) => p.tx))}`
);

// ── stale third layer must not streak (Nate's RP→TB→Viz repro) ──────────────
// After RP→TB, the RP layer sits parked off-screen inside its retention
// window. Navigating TB→Viz before it tears down must NOT animate it across
// the viewport — it gets re-parked instantly on its order-relative side.
await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await page.locator('.chrome-nav a', { hasText: 'Teams' }).click();
await page.waitForTimeout(1600); // slide done, RP layer still retained
s = await sampleNav('Visualizers');
const staleRp = analyze(s, '/rotation-planner', '/crit-visualizer').out;
check(
	'stale RP layer stays off-screen during TB→Viz',
	staleRp.length > 0 && staleRp.every((p) => Math.abs(p.tx) >= VW - 1),
	`min |tx|=${staleRp.length ? Math.min(...staleRp.map((p) => Math.abs(p.tx))) : 'n/a'}`
);
({ out, inc } = analyze(s, '/team-builder', '/crit-visualizer'));
check(
	'TB→Viz: the real outgoing still animates out LEFT',
	Math.min(...out.map((p) => p.tx)) < -(VW - 100),
	`min tx=${Math.min(...out.map((p) => p.tx))}`
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
await page.locator('.chrome-nav a', { hasText: 'Planner' }).click();
await page.waitForTimeout(500);
const barMid = await page.locator('.chrome-nav-underline').boundingBox();
check(
	'underline is mid-glide toward the destination during the pan',
	barMid && barMid.x > barBefore.x + 2 && barMid.x < destLink.x - 2,
	`mid x=${barMid?.x} (from ${barBefore?.x} toward ${destLink?.x})`
);
await page.waitForTimeout(2200);
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
	const p = document.querySelector('.tool-main > .tool-page');
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
