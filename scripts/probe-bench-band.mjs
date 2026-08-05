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
		anchorCellHeights: [...document.querySelectorAll('.rp-label-col .char-label')].map(
			(el) => el.getBoundingClientRect().height
		),
		tracksTop: document.querySelector('.rp-char-block')?.getBoundingClientRect().top ?? null
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
	'ribbon width = RIBBON_W (186)',
	rp.bandRect && Math.abs(rp.bandRect.w - 186) <= 1,
	String(rp.bandRect?.w)
);
// The ribbon's card column must land exactly on the track rows (the RIBBON
// geometry contract: dock top + chrome = tracks top).
check(
	'card column top = track rows top (ribbon chrome accounted)',
	rp.bandRect && rp.tracksTop != null && Math.abs(rp.bandRect.y + 13 - rp.tracksTop) <= 1,
	JSON.stringify({ bandY: rp.bandRect?.y, tracksTop: rp.tracksTop })
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
const rpDockX = rp.bandRect?.x ?? 0;
// Record the ribbon's x every frame across the navigation: screen-locked HUD —
// it must NEVER move between two docked tools (world-locked fade round).
await page.evaluate(() => {
	window.__bandXs = [];
	const rec = () => {
		window.__bandXs.push(document.querySelector('.bench-band-mount').getBoundingClientRect().x);
		if (!window.__bandStop) requestAnimationFrame(rec);
	};
	requestAnimationFrame(rec);
});
await page.click('.chrome-nav a[href*="team-builder"]');
await page.waitForTimeout(1200); // mid-transition (world clock: 2400ms)
const mid = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	const b = band.getBoundingClientRect();
	return { x: b.x, visible: getComputedStyle(band).visibility === 'visible' };
});
await page.screenshot({ path: `${SHOTS}/band-midflight.png` });
await page.waitForTimeout(2600); // settle (world clock 2400 + fade tail + settle pass)

const tb = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	const anchor = document.querySelector('.tb-frame [data-bench-anchor]');
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
		ctx: band?.querySelector('.bb')?.className,
		factsTop: document.querySelector('.bn-factrow')?.getBoundingClientRect().top ?? null
	};
});
const bandXs = await page.evaluate(() => {
	window.__bandStop = true;
	return window.__bandXs;
});
console.log('TB (after the fade):');
check('band visible on TB', !!tb.visible);
check(
	'ribbon NEVER moves across RP↔TB (screen-locked HUD)',
	mid.visible && bandXs.length > 0 && bandXs.every((x) => Math.abs(x - rpDockX) <= 1),
	`x range ${Math.min(...bandXs)}..${Math.max(...bandXs)} vs dock ${rpDockX}`
);
check(
	'both tools dock the ribbon at the SAME screen spot',
	tb.bandRect &&
		Math.abs(tb.bandRect.x - rpDockX) <= 1 &&
		rp.bandRect &&
		Math.abs(rp.bandRect.y - tb.bandRect.y) <= 1,
	JSON.stringify({
		rp: { x: rpDockX, y: rp.bandRect?.y },
		tb: { x: tb.bandRect?.x, y: tb.bandRect?.y }
	})
);
check(
	'band docks on TB anchor',
	tb.bandRect &&
		tb.anchorRect &&
		Math.abs(tb.bandRect.x - tb.anchorRect.x) <= 1 &&
		Math.abs(tb.bandRect.y - tb.anchorRect.y) <= 1,
	JSON.stringify({ band: tb.bandRect, anchor: tb.anchorRect })
);
check(
	'band on the LEFT on TB (bench-left grammar)',
	tb.bandRect && tb.bandRect.x < 400,
	String(tb.bandRect?.x)
);
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
// ONE identity in both tools now (the ribbon is self-contained, always dark).
check('ribbon keeps its own dark context on TB', (tb.ctx ?? '').includes('ctx-dark'), tb.ctx);
check(
	'TB facts strip clears the ribbon bottom',
	tb.factsTop != null && tb.bandRect && tb.factsTop >= tb.bandRect.y + tb.bandRect.h - 1,
	JSON.stringify({
		factsTop: tb.factsTop,
		ribbonBottom: tb.bandRect ? tb.bandRect.y + tb.bandRect.h : null
	})
);
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
await page.waitForTimeout(3400);
const rp2 = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	const anchor = document.querySelector('.rp-ribbon-dock');
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
check('ribbon keeps its own dark context on RP', (rp2.ctx ?? '').includes('ctx-dark'), rp2.ctx);

// ── Travel RP → Visualizers (band exits) ──────────────────────────────────
await page.click('.chrome-nav a[href*="crit-visualizer"]');
await page.waitForTimeout(3400);
const viz = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	return { visibility: getComputedStyle(band).visibility };
});
console.log('Visualizers:');
check('band hidden on Visualizers', viz.visibility === 'hidden', viz.visibility);

// ── Back from Visualizers (band re-enters) ────────────────────────────────
await page.click('.chrome-nav a[href*="rotation-planner"]');
await page.waitForTimeout(3400);
const rp3 = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	const anchor = document.querySelector('.rp-ribbon-dock');
	const b = band?.getBoundingClientRect();
	const a = anchor?.getBoundingClientRect();
	return { visible: getComputedStyle(band).visibility === 'visible', b, a };
});
check(
	'band re-enters from Visualizers and docks',
	rp3.visible && rp3.b && rp3.a && Math.abs(rp3.b.x - rp3.a.x) <= 1,
	JSON.stringify({ b: rp3.b, a: rp3.a })
);

// ── Interrupted navigation: the ribbon holds its spot; layers re-settle ─────
await page.click('.chrome-nav a[href*="team-builder"]');
await page.waitForTimeout(3600); // settled
await page.evaluate(() => {
	window.__bandXs2 = [];
	window.__bandStop2 = false;
	const rec = () => {
		window.__bandXs2.push(document.querySelector('.bench-band-mount').getBoundingClientRect().x);
		if (!window.__bandStop2) requestAnimationFrame(rec);
	};
	requestAnimationFrame(rec);
});
await page.click('.chrome-nav a[href*="rotation-planner"]');
await page.waitForTimeout(1100); // mid-transition
await page.click('.chrome-nav a[href*="team-builder"]'); // interrupt: back
await page.waitForTimeout(3600);
const intXs = await page.evaluate(() => {
	window.__bandStop2 = true;
	return window.__bandXs2;
});
console.log('Interrupted navigation:');
check(
	'ribbon holds its spot through the interrupt storm',
	intXs.length > 0 && intXs.every((x) => Math.abs(x - rpDockX) <= 1),
	`x range ${Math.min(...intXs)}..${Math.max(...intXs)}`
);
const afterInt = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	const anchor = document.querySelector('.tb-frame [data-bench-anchor]');
	const cur = [...document.querySelectorAll('.tool-page')].find(
		(p) => p.dataset.page === '/team-builder'
	);
	const cs = cur ? getComputedStyle(cur) : null;
	return {
		bx: band?.getBoundingClientRect().x,
		ax: anchor?.getBoundingClientRect().x,
		o: cs ? parseFloat(cs.opacity) : null,
		t: cs?.transform
	};
});
check(
	'after the interrupt the page settles opaque at rest under the docked ribbon',
	afterInt.bx != null &&
		Math.abs(afterInt.bx - afterInt.ax) <= 1 &&
		afterInt.o === 1 &&
		(afterInt.t === 'none' || Math.abs(parseFloat(afterInt.t.split(',')[4]) || 0) < 1),
	JSON.stringify(afterInt)
);

// ── Short viewport: ribbon is fixed; the TB facts scroll BELOW it ──────────
const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page2.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
await page2.waitForTimeout(600);
const short = await page2.evaluate(() => {
	const zone = document.querySelector('.bn');
	const band = document.querySelector('.bench-band-mount');
	const b = band?.getBoundingClientRect();
	const anchor = document.querySelector('.tb-frame [data-bench-anchor]');
	const a = anchor?.getBoundingClientRect();
	return {
		bandY: b?.y,
		anchorY: a?.y,
		clip: band?.style.clipPath ?? '',
		zonePadTop: zone ? parseFloat(getComputedStyle(zone).paddingTop) : 0
	};
});
console.log('Short viewport (720p) TB:');
check(
	'ribbon stays docked (no scroll coupling)',
	Math.abs((short.bandY ?? 0) - (short.anchorY ?? 1)) <= 1,
	JSON.stringify(short)
);
check('no clip-path on the ribbon (machinery retired)', short.clip === '', short.clip);
check(
	'TB zone scroll viewport starts below the ribbon',
	short.zonePadTop >= 680,
	String(short.zonePadTop)
);

await browser.close();
console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
