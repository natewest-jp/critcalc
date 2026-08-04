// Probe: the GL scene world + ascend-pan probe (branch experiment/ascend-pan).
// Headless FUNCTIONAL check only — headless rendering can't judge frame
// pacing (the dire-border lesson); real smoothness verdicts are Nate's eyes
// on headed Firefox/Chrome/Safari against `npm run preview`.
//
// Asserts, against http://localhost:4998:
//   1. the landing scene renders via the GL canvas (pixel samples match the
//      old DOM plate rendering within grain tolerance) and the veil lifts
//   2. the starfield canvas still paints above it
//   3. bare `g` pans the camera up/back (crest pose, DOM overlays hidden and
//      restored, crane variant on the second up-leg)
//   4. a cold load on a tool route defers the scene entirely (no plate
//      fetches, no renderer) until navigation back to a scene route
//   5. no console/page errors throughout
//
// Run: node scripts/probe-ascend-pan.mjs   (preview server on 4998 first)

import { chromium } from 'playwright';

const ORIGIN = 'http://localhost:4998';
const PAN_MS = 2400;

const browser = await chromium.launch({ channel: 'chrome', headless: true });

let failures = 0;
const check = (name, ok, detail = '') => {
	console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
	if (!ok) failures++;
};

// --- Landing: GL scene + probe -----------------------------------------------

const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const logs = [];
const errors = [];
page.on('console', (m) => {
	if (m.text().includes('[ascend-pan probe')) logs.push(m.text());
	if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500); // veil lift + renderer first frame

check('veil lifted', await page.evaluate(() => document.getElementById('loading-veil') === null));
check(
	'renderer mounted',
	await page.evaluate(() => typeof globalThis.__scene?.retune === 'function')
);

// Scene-render regression pins (re-sampled 2026-08-04 from the first verified
// build of the v4 ascend master — horizon 3026 — with AVIF-first plates + σ1
// additive dither, at 1600×1000; the DOM-parity role of the original refs
// ended when the art changed). Guards the geometry + color pipeline: a plate
// mis-crop, wrong tier, or broken shader shifts these far beyond grain
// dither. ±14 tolerates the dither.
const REF = [
	[100, 550, [145, 125, 165]],
	[800, 100, [42, 64, 139]],
	[400, 820, [50, 50, 107]],
	[1300, 300, [69, 76, 146]]
];
const shot = await page.screenshot();
const png = await import('sharp').then((m) =>
	m.default(shot).raw().toBuffer({ resolveWithObject: true })
);
for (const [x, y, [r, g, b]] of REF) {
	const i = (y * png.info.width + x) * png.info.channels;
	const got = [png.data[i], png.data[i + 1], png.data[i + 2]];
	const ok = Math.abs(got[0] - r) <= 14 && Math.abs(got[1] - g) <= 14 && Math.abs(got[2] - b) <= 14;
	check(`scene pixel (${x},${y})`, ok, `got ${got.join(',')} want ~${r},${g},${b}`);
}

check(
	'starfield canvas above the scene',
	await page.evaluate(() => {
		const t = document.querySelector('.twinkle');
		const c = document.querySelector('.scene-canvas');
		return !!t && !!c && !!(c.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
	})
);

// g: up (straight) → down → up (left crane) → down
const glState = () => page.evaluate(() => globalThis.__ascendGL ?? null);
await page.keyboard.press('g');
await page.waitForTimeout(PAN_MS + 400);
const up = await glState();
// Crest = the mirror pose: (master − 2·bleed − viewport) src rows ≈ 76.28dvh
// of the 1000px viewport (PAN_DVH is derived in sceneGL.ts — keep in step).
check('g up: camera at crest', up?.settled && Math.abs(up.cam.y - 762.76) < 2, `camY=${up?.cam.y}`);
check(
	'g up: DOM overlays hidden',
	await page.evaluate(() => document.querySelector('.twinkle')?.style.visibility === 'hidden')
);
await page.keyboard.press('g');
await page.waitForTimeout(PAN_MS + 400);
const down = await glState();
check('g down: camera at rest', down?.settled && Math.abs(down.cam.y) < 2, `camY=${down?.cam.y}`);
check(
	'g down: DOM overlays restored',
	await page.evaluate(() => document.querySelector('.twinkle')?.style.visibility === '')
);
await page.keyboard.press('g');
await page.waitForTimeout(PAN_MS + 400);
const crane = await glState();
check('g crane: world shifted right', crane?.settled && crane.cam.x > 20, `camX=${crane?.cam.x}`);
await page.keyboard.press('g');
await page.waitForTimeout(PAN_MS + 400);

check(
	'probe logs present',
	logs.some((l) => l.includes('straight tilt-up'))
);
check('no console/page errors (landing)', errors.length === 0, errors.slice(0, 3).join(' | '));
await page.close();

// --- Tool cold load: scene fully deferred ------------------------------------

const tool = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const plateFetches = [];
const toolErrors = [];
tool.on('request', (r) => {
	if (/assets\/landing\/(sky|floor)-/.test(r.url())) plateFetches.push(r.url());
});
tool.on('pageerror', (e) => toolErrors.push(String(e)));
await tool.goto(`${ORIGIN}/rotation-planner`, { waitUntil: 'networkidle' });
await tool.waitForTimeout(2500);
check('tool cold load: no plate fetches', plateFetches.length === 0, plateFetches[0] ?? '');
check(
	'tool cold load: renderer deferred',
	await tool.evaluate(() => globalThis.__scene === undefined)
);
// Return to the landing (brand mark, reverse portal) → renderer must init.
await tool.click('.tool-brand, a[aria-label*="critcalc"], .brand-return').catch(() => {});
await tool.evaluate(() => history.pushState({}, '', '/')).catch(() => {});
// Fallback: drive an SPA nav via the SvelteKit router regardless of chrome markup.
await tool.evaluate(() => {
	const a = document.createElement('a');
	a.href = '/';
	document.body.appendChild(a);
	a.click();
});
await tool.waitForTimeout(3000);
check(
	'return to landing: renderer initialized',
	await tool.evaluate(() => typeof globalThis.__scene?.retune === 'function'),
	'after SPA navigation home'
);
check('no page errors (tool leg)', toolErrors.length === 0, toolErrors.slice(0, 2).join(' | '));

await browser.close();
console.log(failures === 0 ? '\nPROBE PASS' : `\nPROBE FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
