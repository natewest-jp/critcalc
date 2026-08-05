// Bench-band smoke probe: docking geometry on RP + TB, the travel, and the
// shared working team. Run from project root: node <path>/probe-band.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:4998';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp';
let failures = 0;
const check = (name, ok, detail = '') => {
	console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
	if (!ok) failures++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('  pageerror:', e.message));

// Seed a saved rotation so the planner has real content + a team.
await page.addInitScript(() => {
	const tab = {
		id: 'seedtab01',
		label: 'Seed',
		notation: 'Furina E Q > Bennett E Q > Xingqiu E Q > Kazuha E Q',
		manualSlots: null
	};
	localStorage.setItem(
		'critcalc:rotationTabs',
		JSON.stringify({ tabs: [tab], activeTabId: 'seedtab01' })
	);
});

// ── RP dock ────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const rp = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	const anchor = document.querySelector('[data-bench-anchor]');
	const cards = document.querySelectorAll('.bench-band-mount .sp-card, .bench-band-mount .bb-slot');
	const names = [...document.querySelectorAll('.bench-band-mount .sp-char-name')].map(
		(n) => n.textContent
	);
	const b = band?.getBoundingClientRect();
	const a = anchor?.getBoundingClientRect();
	return {
		visible: band && getComputedStyle(band).visibility === 'visible',
		bandRect: b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null,
		anchorRect: a ? { x: a.x, y: a.y, w: a.width, h: a.height } : null,
		slotCount: document.querySelectorAll('.bench-band-mount .bb-slot').length,
		cardCount: cards.length,
		names,
		slotHeights: [...document.querySelectorAll('.bench-band-mount .bb-slot')].map(
			(el) => el.getBoundingClientRect().height
		),
		anchorCellHeights: [...document.querySelectorAll('.rp-bench-anchor .char-label')].map(
			(el) => el.getBoundingClientRect().height
		)
	};
});
console.log('RP:');
check('band visible on RP', !!rp.visible);
check('4 band slots', rp.slotCount === 4, String(rp.slotCount));
check(
	'band docks on anchor (x,y within 1px)',
	rp.bandRect &&
		rp.anchorRect &&
		Math.abs(rp.bandRect.x - rp.anchorRect.x) <= 1 &&
		Math.abs(rp.bandRect.y - rp.anchorRect.y) <= 1,
	JSON.stringify({ band: rp.bandRect, anchor: rp.anchorRect })
);
check(
	'band width = 160',
	rp.bandRect && Math.abs(rp.bandRect.w - 160) <= 1,
	String(rp.bandRect?.w)
);
check(
	'slot heights mirror anchor cells',
	rp.slotHeights.length === 4 &&
		rp.slotHeights.every((h, i) => Math.abs(h - rp.anchorCellHeights[i]) <= 1),
	JSON.stringify({ band: rp.slotHeights, cells: rp.anchorCellHeights })
);
check(
	'team names render',
	rp.names.join(',').includes('Furina') && rp.names.join(',').includes('Kazuha'),
	rp.names.join(',')
);
await page.screenshot({ path: `${SHOTS}/band-rp.png` });

// ── Travel RP → TB ─────────────────────────────────────────────────────────
await page.click('.chrome-nav a[href*="team-builder"]');
await page.waitForTimeout(300); // mid-flight
const mid = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	const b = band.getBoundingClientRect();
	return { x: b.x, visible: getComputedStyle(band).visibility === 'visible' };
});
await page.screenshot({ path: `${SHOTS}/band-midflight.png` });
await page.waitForTimeout(1200); // settle

const tb = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	const anchor = document.querySelector('.bn [data-bench-anchor]');
	const b = band?.getBoundingClientRect();
	const a = anchor?.getBoundingClientRect();
	const names = [...document.querySelectorAll('.bench-band-mount .sp-char-name')].map(
		(n) => n.textContent
	);
	return {
		visible: band && getComputedStyle(band).visibility === 'visible',
		bandRect: b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null,
		anchorRect: a ? { x: a.x, y: a.y, w: a.width, h: a.height } : null,
		names,
		slotHeights: [...document.querySelectorAll('.bench-band-mount .bb-slot')].map(
			(el) => el.getBoundingClientRect().height
		),
		hasAuditionAct: !!document.querySelector('.bench-band-mount .bb-act'),
		ctx: band?.querySelector('.bb')?.className
	};
});
console.log('TB (after travel):');
check('band visible on TB', !!tb.visible);
check('band traveled (mid-flight x between docks)', mid.visible && mid.x > 100, String(mid.x));
check(
	'band docks on TB anchor',
	tb.bandRect &&
		tb.anchorRect &&
		Math.abs(tb.bandRect.x - tb.anchorRect.x) <= 1 &&
		Math.abs(tb.bandRect.y - tb.anchorRect.y) <= 1,
	JSON.stringify({ band: tb.bandRect, anchor: tb.anchorRect })
);
check('band on the RIGHT half on TB', tb.bandRect && tb.bandRect.x > 800, String(tb.bandRect?.x));
check(
	'even rhythm on TB (all 158)',
	tb.slotHeights.every((h) => Math.abs(h - 158) <= 1),
	JSON.stringify(tb.slotHeights)
);
check(
	'working team traveled with the band',
	tb.names.join(',').includes('Furina'),
	tb.names.join(',')
);
check('TB actions (audition/remove) present', tb.hasAuditionAct);
check('ctx-light on TB', (tb.ctx ?? '').includes('ctx-light'), tb.ctx);
await page.screenshot({ path: `${SHOTS}/band-tb.png` });

// ── TB edits flow back to the shared team ─────────────────────────────────
await page.evaluate(() => {
	document.querySelector('.bench-band-mount .bb-act--remove')?.click();
});
await page.waitForTimeout(300);
const afterRemove = await page.evaluate(() =>
	[...document.querySelectorAll('.bench-band-mount .sp-char-name')].map((n) => n.textContent)
);
console.log('TB edit:');
check(
	'remove wrote the working team',
	!afterRemove.join(',').includes('Furina'),
	afterRemove.join(',')
);

// ── Travel TB → RP (back) ─────────────────────────────────────────────────
await page.click('.chrome-nav a[href*="rotation-planner"]');
await page.waitForTimeout(1500);
const rp2 = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	const anchor = document.querySelector('.rp-bench-anchor');
	const b = band?.getBoundingClientRect();
	const a = anchor?.getBoundingClientRect();
	const names = [...document.querySelectorAll('.bench-band-mount .sp-char-name')].map(
		(n) => n.textContent
	);
	return { b, a, names, ctx: band?.querySelector('.bb')?.className };
});
console.log('RP (return):');
check(
	'band re-docked left',
	rp2.b && rp2.a && Math.abs(rp2.b.x - rp2.a.x) <= 1 && Math.abs(rp2.b.y - rp2.a.y) <= 1,
	JSON.stringify({ band: rp2.b, anchor: rp2.a })
);
check(
	'removed char stayed removed on RP',
	!rp2.names.join(',').includes('Furina'),
	rp2.names.join(',')
);
check('ctx-dark on RP', (rp2.ctx ?? '').includes('ctx-dark'), rp2.ctx);

// ── Travel RP → Visualizers (band exits) ──────────────────────────────────
await page.click('.chrome-nav a[href*="crit-visualizer"]');
await page.waitForTimeout(1500);
const viz = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	return { visibility: getComputedStyle(band).visibility };
});
console.log('Visualizers:');
check('band hidden on Visualizers', viz.visibility === 'hidden', viz.visibility);

// ── Back from Visualizers (band re-enters) ────────────────────────────────
await page.click('.chrome-nav a[href*="rotation-planner"]');
await page.waitForTimeout(1500);
const rp3 = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	const anchor = document.querySelector('.rp-bench-anchor');
	const b = band?.getBoundingClientRect();
	const a = anchor?.getBoundingClientRect();
	return { visible: getComputedStyle(band).visibility === 'visible', b, a };
});
check(
	'band re-enters from Visualizers and docks',
	rp3.visible && rp3.b && rp3.a && Math.abs(rp3.b.x - rp3.a.x) <= 1,
	JSON.stringify({ b: rp3.b, a: rp3.a })
);

// ── Short viewport: the TB bench zone scrolls; the band mirrors + clips ────
const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page2.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
await page2.waitForTimeout(600);
// Fill the team so facts render below the dock and force zone overflow.
await page2.evaluate(() => {
	const zone = document.querySelector('[data-bench-scroll]');
	if (zone) zone.scrollTop = 60;
});
await page2.waitForTimeout(300);
const scrolled = await page2.evaluate(() => {
	const zone = document.querySelector('[data-bench-scroll]');
	const band = document.querySelector('.bench-band-mount');
	const anchor = document.querySelector('.bn [data-bench-anchor]');
	const b = band?.getBoundingClientRect();
	const a = anchor?.getBoundingClientRect();
	return {
		scrollTop: zone?.scrollTop ?? 0,
		scrollable: zone ? zone.scrollHeight > zone.clientHeight : false,
		bandY: b?.y,
		anchorY: a?.y,
		clip: band?.style.clipPath ?? ''
	};
});
console.log('Short viewport (720p) TB:');
if (scrolled.scrollable) {
	check(
		'band follows the zone scroll',
		Math.abs((scrolled.bandY ?? 0) - (scrolled.anchorY ?? 1)) <= 1,
		JSON.stringify(scrolled)
	);
	check('band clips to the zone viewport', scrolled.clip.includes('inset'), scrolled.clip);
} else {
	check('zone scrollable at 720p (precondition)', false, JSON.stringify(scrolled));
}

await browser.close();
console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
