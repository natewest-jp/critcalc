// Probe: the GL scene world + ascend-pan probe (branch experiment/ascend-pan).
// Headless FUNCTIONAL check only — headless rendering can't judge frame
// pacing (the dire-border lesson); real smoothness verdicts are Nate's eyes
// on headed Firefox/Chrome/Safari against `npm run preview`.
//
// Asserts, against http://localhost:4998:
//   1. the landing scene renders via the GL canvas (pixel samples match the
//      old DOM plate rendering within grain tolerance) and the veil lifts
//   2. the twinkle field renders INSIDE the scene canvas (the DOM .twinkle
//      element is retired by the starfield merge)
//   3. the ASCEND CHOREOGRAPHY: a real hero click drives the camera to the
//      crest with the tool shell suppressed mid-climb, reveals it near settle,
//      then occludes the scene (twinkle stopped); a brand-mark return descends
//      to rest and brings the composition + twinkle back; a side-tool hero
//      click cranes the world toward its card (the bare-`g` probe toggle was
//      stripped at merge prep — the choreography IS the pan now)
//   4. a cold load on a tool route still initializes the scene — the shell is
//      transparent (tools-over-scene, 2026-08-05) and the world stays live
//      beneath every tool
//   5. no console/page errors throughout
//
// Run: node scripts/probe-ascend-pan.mjs   (preview server on 4998 first)

import { chromium } from 'playwright';

const ORIGIN = 'http://localhost:4998';

const browser = await chromium.launch({ channel: 'chrome', headless: true });

let failures = 0;
const check = (name, ok, detail = '') => {
	console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
	if (!ok) failures++;
};

// --- Landing: GL scene + probe -----------------------------------------------

const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('console', (m) => {
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

// Scene-render regression pins. Guards the geometry + color pipeline: a plate
// mis-crop, wrong tier, or broken shader shifts these far beyond grain dither.
// ±14 tolerates the dither.
// ↻ RE-SAMPLED 2026-08-06 against the RELIT master (83079da7 — same
// composition and horizon, adjusted lighting/white balance/saturation;
// measured 0px vertical lag vs the previous plate, so nothing structural
// moved). Sampled from `npm run preview` at 1600×1000, as always: a new plate
// re-pins these, and they are the ONLY checks here that a relight is expected
// to move — every geometry assertion below must keep passing untouched.
const REF = [
	[100, 550, [180, 149, 173]],
	[800, 100, [58, 78, 159]],
	[400, 820, [37, 44, 89]],
	[1300, 300, [85, 86, 150]]
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
	'DOM twinkle element retired',
	await page.evaluate(() => document.querySelector('.twinkle') === null)
);
// Stars render in-canvas: an upper-sky patch must contain bright star pixels
// well above the plate's own luminance range (stars peak near-white; the sky
// plate tops out far darker). Counted on the live screenshot, so any twinkle
// phase passes — the field has hundreds of stars in this patch.
{
	let starPx = 0;
	for (let y = 40; y < 400; y += 2) {
		for (let x = 200; x < 1400; x += 2) {
			const i = (y * png.info.width + x) * png.info.channels;
			if (png.data[i] > 190 && png.data[i + 1] > 190 && png.data[i + 2] > 190) starPx++;
		}
	}
	check('stars render in the scene canvas', starPx > 40, `bright px: ${starPx}`);
}

check(
	'twinkle loop live on the landing',
	await page.evaluate(() => globalThis.__scene?.twinkling?.() === true)
);

// --- Ascend choreography: hero click → crest → reveal → occlusion ------------
// Timing map (transition.ts): pan 2400ms; tool reveal fade starts at
// settle − 600 + 300 = 1900…2100ms and ends ~2700ms; `covered` +80ms; the
// occlusion report two rAFs later. So mid-climb is < 1900ms and the settled
// tool state is safely in place by ~3400ms.
const camY = () => page.evaluate(() => globalThis.__scene?.camera?.().y ?? null);
await page.click('a[href="/rotation-planner"].hero');
await page.waitForTimeout(1000);
const midY = await camY();
check(
	'hero click: camera climbing mid-pan',
	midY !== null && midY > 20 && midY < 740,
	`camY=${midY}`
);
check(
	'hero click: tool shell suppressed mid-pan',
	await page.evaluate(() => {
		const shell = document.querySelector('.tool-shell');
		return shell !== null && !shell.classList.contains('revealed');
	})
);
await page.waitForTimeout(2400);
// Crest = the mirror pose: (master − 2·bleed − viewport) src rows ≈ 76.28dvh
// of the 1000px viewport (PAN_DVH is derived in sceneGL.ts — keep in step).
const crestY = await camY();
check(
	'ascend settled: camera at crest',
	crestY !== null && Math.abs(crestY - 762.76) < 2,
	`camY=${crestY}`
);
check(
	'ascend settled: tool shell revealed',
	await page.evaluate(
		() => document.querySelector('.tool-shell')?.classList.contains('revealed') === true
	)
);
// Tools-over-scene (dire-retirement round, 2026-08-05): the shell is
// transparent and the scene stays LIVE beneath the tools — the occlusion
// handshake retired with the shell's opacity.
check(
	'ascend settled: scene stays live (tools-over-scene)',
	await page.evaluate(
		() => document.querySelector('.scene')?.classList.contains('occluded') !== true
	)
);
check(
	'ascend settled: twinkle loop keeps running',
	await page.evaluate(() => globalThis.__scene?.twinkling?.() === true)
);

// Brand-mark return: plain link → beforeNavigate starts the descend.
await page.click('.chrome-brand');
await page.waitForTimeout(3400);
const restY = await camY();
check('descend settled: camera at rest', restY !== null && Math.abs(restY) < 2, `camY=${restY}`);
check(
	'descend settled: composition back',
	await page.evaluate(() => {
		const c = document.querySelector('.composition');
		return c !== null && getComputedStyle(c).opacity === '1';
	})
);
check(
	'descend settled: twinkle loop live',
	await page.evaluate(() => globalThis.__scene?.twinkling?.() === true)
);

// Side-tool crane through the real choreography: Team Builder is the LEFT
// hero, so its ascend cranes the camera toward it — the world shifts RIGHT
// (camX > 0; tan 16° × pan ≈ 219px at this viewport) while climbing to the
// same crest height. The return descends back to a centered rest.
const cam = () => page.evaluate(() => globalThis.__scene?.camera?.() ?? null);
await page.click('a[href="/team-builder"].hero');
await page.waitForTimeout(3400);
const crane = await cam();
check(
	'TB ascend: crane shifts the world right at the crest',
	crane !== null && crane.x > 20 && Math.abs(crane.y - 762.76) < 2,
	`cam=${crane && `${crane.x.toFixed(1)},${crane.y.toFixed(1)}`}`
);
await page.click('.chrome-brand');
await page.waitForTimeout(3400);
const rest2 = await cam();
check(
	'TB descend: camera back to centered rest',
	rest2 !== null && Math.abs(rest2.x) < 2 && Math.abs(rest2.y) < 2,
	`cam=${rest2 && `${rest2.x.toFixed(1)},${rest2.y.toFixed(1)}`}`
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
// Tools-over-scene (2026-08-05): the shell is transparent, so a cold tool
// load MUST paint the live scene beneath it — plates fetch and the renderer
// initializes (the old full-deferral contract retired with the opaque shell).
check('tool cold load: plates fetch (scene lives under the tools)', plateFetches.length > 0);
check(
	'tool cold load: renderer initialized',
	await tool.evaluate(() => typeof globalThis.__scene?.retune === 'function')
);
// Return to the landing (SPA navigation home) → renderer must init.
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
// SPA-nav BACK to a tool: tools-over-scene keeps the scene animating beneath
// the transparent shell — the twinkle loop must KEEP running (the old
// occlusion stop retired with the dire-retirement round, 2026-08-05).
await tool.evaluate(() => {
	const a = document.createElement('a');
	a.href = '/rotation-planner';
	document.body.appendChild(a);
	a.click();
});
await tool.waitForTimeout(3600);
check(
	'SPA nav to tool: twinkle loop keeps running',
	await tool.evaluate(() => globalThis.__scene?.twinkling?.() === true)
);
check('no page errors (tool leg)', toolErrors.length === 0, toolErrors.slice(0, 2).join(' | '));

await browser.close();
console.log(failures === 0 ? '\nPROBE PASS' : `\nPROBE FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
