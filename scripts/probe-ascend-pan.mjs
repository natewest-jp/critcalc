// Probe: the ascend-pan probe itself (branch experiment/ascend-pan).
// Headless FUNCTIONAL check only — headless rendering can't judge frame
// pacing (the dire-border lesson); real smoothness verdicts are Nate's eyes
// on headed Firefox/Chrome/Safari against `npm run preview`.
//
// Asserts, against http://localhost:4998/:
//   1. pressing `p` logs "[ascend-pan probe] up — straight tilt-up"
//   2. the scene world layers (.sky, .floor, .twinkle, .composition) move:
//      translateY goes from ~0 to +75dvh (bottom-anchored plate pushes DOWN
//      to reveal the upper sky — the camera tilts up)
//   3. pressing `p` again logs "return to rest" and the layers come back to ~0
//   4. a second up-leg cycles to the left-tool crane variant
//   5. no page errors / console errors throughout
//
// Run: node scripts/probe-ascend-pan.mjs   (preview server on 4998 first)

import { chromium } from 'playwright';

const URL = 'http://localhost:4998/';
const PAN_MS = 2400;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const logs = [];
const errors = [];
page.on('console', (m) => {
	if (m.text().includes('[ascend-pan probe')) logs.push(m.text());
	if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// translateY of the .sky layer in device px, from its computed matrix.
const skyY = () =>
	page.evaluate(() => {
		const el = document.querySelector('.sky');
		if (!el) return null;
		const t = getComputedStyle(el).transform;
		if (t === 'none') return 0;
		return new DOMMatrixReadOnly(t).m42;
	});

const layerYs = () =>
	page.evaluate(() =>
		Object.fromEntries(
			['.sky', '.floor', '.twinkle', '.composition', '.sky-bg'].map((sel) => {
				const el = document.querySelector(sel);
				if (!el) return [sel, null];
				const t = getComputedStyle(el).transform;
				return [sel, t === 'none' ? 0 : new DOMMatrixReadOnly(t).m42];
			})
		)
	);

let failures = 0;
const check = (name, ok, detail = '') => {
	console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
	if (!ok) failures++;
};

const restY = await skyY();
check('sky layer present at rest', restY !== null, `y=${restY}`);

// --- Leg 1: up (straight tilt-up) ---
await page.keyboard.press('p');
await page.waitForTimeout(PAN_MS / 2);
const midY = await skyY();
// The plate is bottom-anchored with its top overflowing above the viewport;
// POSITIVE translateY pushes the world down, revealing the upper sky (the
// camera tilts up). 75dvh of a 1000px viewport = +750px.
check('mid-pan: world descending', midY !== null && midY > restY + 50, `y=${midY}`);
await page.waitForTimeout(PAN_MS / 2 + 300);
const upYs = await layerYs();
const expected = 750;
for (const sel of ['.sky', '.floor', '.twinkle', '.composition', '.sky-bg']) {
	const y = upYs[sel];
	check(
		`up: ${sel} at crest`,
		y !== null && Math.abs(y - (restY + expected)) < 5,
		`y=${y?.toFixed(1)} (expected ~${(restY + expected).toFixed(1)})`
	);
}
check(
	'log: up straight',
	logs.some((l) => l.includes('straight tilt-up'))
);

// --- Leg 2: return to rest ---
await page.keyboard.press('p');
await page.waitForTimeout(PAN_MS + 300);
const downY = await skyY();
check('down: sky back at rest', downY !== null && Math.abs(downY - restY) < 5, `y=${downY}`);
check(
	'log: return to rest',
	logs.some((l) => l.includes('return to rest'))
);

// --- Leg 3: up again → left-tool crane variant, X shifts right ---
const restX = await page.evaluate(() => {
	const t = getComputedStyle(document.querySelector('.sky')).transform;
	return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41;
});
await page.keyboard.press('p');
await page.waitForTimeout(PAN_MS + 300);
const craneX = await page.evaluate(() => {
	const t = getComputedStyle(document.querySelector('.sky')).transform;
	return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41;
});
check(
	'crane: world shifted right vs rest',
	craneX > restX + 20,
	`x ${restX.toFixed(1)} → ${craneX.toFixed(1)}`
);
check(
	'log: left-tool crane',
	logs.some((l) => l.includes('left-tool crane'))
);

// --- Leg 4: back to rest for a clean end state ---
await page.keyboard.press('p');
await page.waitForTimeout(PAN_MS + 300);
const endY = await skyY();
check('end: back at rest', endY !== null && Math.abs(endY - restY) < 5, `y=${endY}`);

// --- GL legs: `g` — scene-in-WebGL pan (stage 2) ---
const glState = () => page.evaluate(() => globalThis.__ascendGL ?? null);
await page.keyboard.press('g');
// First press lazy-loads the module + decodes textures, then pans up.
await page.waitForTimeout(1500 + PAN_MS + 300);
const glUp = await glState();
const vh = 1000;
check('GL up: state exposed', glUp !== null, JSON.stringify(glUp));
check(
	'GL up: camera at crest',
	glUp !== null && glUp.settled && Math.abs(glUp.cam.y - vh * 0.75) < 2,
	`camY=${glUp?.cam.y?.toFixed(1)} (expected ~${vh * 0.75})`
);
check(
	'GL up: DOM scene hidden',
	await page.evaluate(() => document.querySelector('.scene')?.style.visibility === 'hidden')
);
await page.keyboard.press('g');
await page.waitForTimeout(PAN_MS + 300);
const glDown = await glState();
check(
	'GL down: camera at rest',
	glDown !== null && glDown.settled && Math.abs(glDown.cam.y) < 2,
	`camY=${glDown?.cam.y?.toFixed(1)}`
);
check(
	'GL down: DOM scene restored',
	await page.evaluate(() => document.querySelector('.scene')?.style.visibility === '')
);
// Second up-leg cycles to the left-tool crane: camX shifts positive (world right).
await page.keyboard.press('g');
await page.waitForTimeout(PAN_MS + 300);
const glCrane = await glState();
check(
	'GL crane: world shifted right',
	glCrane !== null && glCrane.settled && glCrane.cam.x > 20,
	`camX=${glCrane?.cam.x?.toFixed(1)}`
);
await page.keyboard.press('g'); // back to rest for a clean end state
await page.waitForTimeout(PAN_MS + 300);
check(
	'GL log lines present',
	logs.some((l) => l.includes('probe GL] renderer ready')) &&
		logs.some((l) => l.includes('probe GL] up — straight tilt-up'))
);

check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(failures === 0 ? '\nPROBE PASS' : `\nPROBE FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
