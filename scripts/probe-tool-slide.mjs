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
			if (window.__samples.length < 200) requestAnimationFrame(rec);
		};
		requestAnimationFrame(rec);
	});
	await page.locator('.chrome-nav a', { hasText: linkText }).click();
	if (midShot) {
		await page.waitForTimeout(300);
		await page.screenshot({ path: `${SHOTS}/${midShot}` });
	}
	await page.waitForTimeout(1500);
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
check(
	'no horizontal scroll after slides',
	hScroll.sw <= hScroll.cw,
	JSON.stringify(hScroll)
);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
