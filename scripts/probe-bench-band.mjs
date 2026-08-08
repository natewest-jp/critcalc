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

// The dock lives on the shared <ToolStack> now, so BOTH page layers carry one
// during a navigation (the outgoing layer is retained, mid-drift, for a few
// seconds). Every anchor lookup below mirrors the layout's own rule — the
// LATEST layer stamped with the current path is the real one — instead of
// relying on the old per-tool selectors to disambiguate by accident.

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
	const anchor = (() => {
		const layers = [...document.querySelectorAll('.tool-main > .tool-page')].filter(
			(p) => p.dataset.page === location.pathname
		);
		const layer = layers[layers.length - 1] ?? document;
		return layer.querySelector('[data-bench-anchor]');
	})();
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
		// The band's cards mirror the TRACK GROUPS. They used to be compared
		// against a shadow label column inside the frame; the abutting round
		// deleted it, so this now checks the thing the contract was always
		// about — the published slot metrics land the cards on the real rows.
		anchorCellHeights: [...document.querySelectorAll('.rp-tracks .rp-char-block')].map(
			(el) => el.getBoundingClientRect().height
		),
		tracksTop: document.querySelector('.rp-char-block')?.getBoundingClientRect().top ?? null,
		firstCardTop:
			document.querySelector('.bench-band-mount .sp-card')?.getBoundingClientRect().top ?? null,
		bandsRect: (() => {
			const r = document.querySelector('.bands')?.getBoundingClientRect();
			return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
		})(),
		// ↻ Breathing-room round 2026-08-08: `.tool-surface`, not `.rp-frame`.
		// The ribbon stands proud of the whole TOOL STACK, and the planner's
		// surface is two panels now (timeline, then composer) — so the frame
		// stopped being the object's bottom edge. Same invariant, the element
		// that actually carries it. (Both tools measure the surface now; see
		// probe-bench-align, which re-anchored the same way.)
		frameRect: (() => {
			const r = document.querySelector('.tool-surface')?.getBoundingClientRect();
			return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
		})(),
		laneNames: [...document.querySelectorAll('.rp-lane-name')].map((el) => ({
			text: el.textContent.trim(),
			x: Math.round(el.getBoundingClientRect().x)
		}))
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
	// RIBBON_W = BENCH_CARD_W 160 + 2 × RIBBON_CHROME (edge 5 + frame 2 + pad 9
	// = 16). Move with those knobs in $lib/benchBand.svelte.ts.
	'ribbon width = RIBBON_W (192: card 160 + 16 chrome per side)',
	rp.bandRect && Math.abs(rp.bandRect.w - 192) <= 1,
	String(rp.bandRect?.w)
);
// The ribbon's card column must land exactly on the track rows. Measured card
// against measured row, rather than the old `bandY + 51` hand-sum: RIBBON_HEAD
// gained BAND_STACK_TO_SURFACE in the toolbar round (the strip now opens above
// the BANDS), and a probe that re-derives the sum only re-states the code.
check(
	'card column top = track rows top',
	rp.firstCardTop != null && rp.tracksTop != null && Math.abs(rp.firstCardTop - rp.tracksTop) <= 1,
	JSON.stringify({ firstCardTop: rp.firstCardTop, tracksTop: rp.tracksTop })
);
// The tall-bench contract, ↻ toolbar round: the strip stands 12px proud of the
// whole TOOL STACK — bands at the top, frame at the bottom — not of the frame
// alone. That is the round's headline: the toolbar is inside the object the
// ribbon flanks, instead of floating unattached beside its shoulder.
check(
	'ribbon overhangs the RP band stack (top) and frame (bottom)',
	rp.frameRect &&
		rp.bandsRect &&
		rp.bandRect &&
		Math.abs(rp.bandsRect.y - rp.bandRect.y - 12) <= 1 &&
		Math.abs(rp.bandRect.y + rp.bandRect.h - (rp.frameRect.y + rp.frameRect.h) - 12) <= 1,
	JSON.stringify({ frame: rp.frameRect, bands: rp.bandsRect, band: rp.bandRect })
);
// The lane names moved INTO their lanes (the label column is under the strip
// at every height now).
check(
	'lane names ride their lanes, right of the ribbon',
	rp.laneNames.length > 0 && rp.laneNames.every((n) => n.x >= rp.bandRect.x + rp.bandRect.w - 1),
	JSON.stringify(rp.laneNames)
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
	const anchor = (() => {
		const layers = [...document.querySelectorAll('.tool-main > .tool-page')].filter(
			(p) => p.dataset.page === location.pathname
		);
		const layer = layers[layers.length - 1] ?? document;
		return layer.querySelector('[data-bench-anchor]');
	})();
	const b = band?.getBoundingClientRect();
	const a = anchor?.getBoundingClientRect();
	const names = [...document.querySelectorAll('.bench-band-mount .sp-char-name')].map(
		(n) => n.textContent
	);
	return {
		visible: band && getComputedStyle(band).visibility === 'visible',
		bandRect: b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null,
		anchorRect: a ? { x: a.x, y: a.y, w: a.width, h: a.height } : null,
		// `.tool-surface`, not `.tb-frame` — same re-anchor as the RP block
		// above, and the Atlas is what forces it: the browse frame ends at its
		// CONTENT on that view (breathing-room round), so it is no longer the
		// bottom of the tool object. The ribbon's dock spans the whole
		// ToolStack, which is what the overhang is measured against.
		frameRect: (() => {
			const r = document.querySelector('.tool-surface')?.getBoundingClientRect();
			return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
		})(),
		bandsRect: (() => {
			const r = document.querySelector('.bands')?.getBoundingClientRect();
			return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
		})(),
		names,
		slotHeights: [...document.querySelectorAll('.bench-band-mount .bb-slot')].map(
			(el) => el.getBoundingClientRect().height
		),
		hasAuditionAct: !!document.querySelector('.bench-band-mount .bb-act'),
		ctx: band?.querySelector('.bb')?.className,
		// Tall-bench round: the team readout left the bench column for a strip
		// above the work zone (the ribbon spans the whole frame now).
		// ↻ Breathing-room round 2026-08-08: that strip is `.tb-head`, a ROW OF
		// TWO PANELS (what the team is · what it covers) sitting above the
		// browse frame rather than inside it. Same invariant, same place on
		// screen — only the box that carries it changed.
		stripRect: (() => {
			const r = document.querySelector('.tb-head')?.getBoundingClientRect();
			return r ? { x: r.x, y: r.y, w: r.width } : null;
		})(),
		// Abutting round: the tuck-under zone is GONE, not merely empty.
		benchZoneExists: !!document.querySelector('.bn')
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
// The strip stands proud of its frame at BOTH ends — the tall-bench contract.
check(
	'ribbon overhangs the TB band stack (top) and frame (bottom)',
	tb.frameRect &&
		tb.bandsRect &&
		tb.bandRect &&
		Math.abs(tb.bandsRect.y - tb.bandRect.y - 12) <= 1 &&
		Math.abs(tb.bandRect.y + tb.bandRect.h - (tb.frameRect.y + tb.frameRect.h) - 12) <= 1,
	JSON.stringify({ frame: tb.frameRect, bands: tb.bandsRect, band: tb.bandRect })
);
// The tuck-under zone is gone entirely (abutting round) — the frame starts at
// the ribbon's right edge, so there is no column left inside it to reserve.
check('TB bench zone is gone (no .bn)', tb.benchZoneExists === false, String(tb.benchZoneExists));
check(
	'TB frame begins at the ribbon’s right edge',
	tb.frameRect && tb.bandRect && Math.abs(tb.frameRect.x - (tb.bandRect.x + tb.bandRect.w)) <= 1,
	JSON.stringify({ frameX: tb.frameRect?.x, ribbonRight: tb.bandRect?.x + tb.bandRect?.w })
);
// The readout now picks up the frame's own left edge — the 2px it used to sit
// UNDER the strip by (the .bn zone was pinned at 189 while RIBBON_CHROME went
// 15 → 16) closes structurally rather than by re-tuning a literal.
check(
	'TB team strip sits right of the ribbon',
	tb.stripRect && tb.bandRect && tb.stripRect.x >= tb.bandRect.x + tb.bandRect.w - 1,
	JSON.stringify({
		strip: tb.stripRect,
		ribbonRight: tb.bandRect ? tb.bandRect.x + tb.bandRect.w : null
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
	const anchor = (() => {
		const layers = [...document.querySelectorAll('.tool-main > .tool-page')].filter(
			(p) => p.dataset.page === location.pathname
		);
		const layer = layers[layers.length - 1] ?? document;
		return layer.querySelector('[data-bench-anchor]');
	})();
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

// ── Travel RP → Visualizers (the ribbon rides the world out) ──────────────
// Viz-leg rework (2026-08-06): on a leg where one side has no dock, the
// ribbon is part of the TOOL SURFACE, not screen-locked HUD — it drifts by
// the camera's pose delta while fading, glued to the departing frame,
// instead of fading in place.
await page.evaluate(() => {
	window.__exitFrames = [];
	window.__exitStop = false;
	const rec = () => {
		const band = document.querySelector('.bench-band-mount');
		const cs = getComputedStyle(band);
		window.__exitFrames.push({
			x: band.getBoundingClientRect().x,
			o: parseFloat(cs.opacity),
			v: cs.visibility
		});
		if (!window.__exitStop) requestAnimationFrame(rec);
	};
	requestAnimationFrame(rec);
});
await page.click('.chrome-nav a[href*="crit-visualizer"]');
// Outlive the outgoing layer's retention (HOLD_MAX_MS 4000) so the return
// below mounts a FRESH planner layer. A revived layer keeps its anchor
// element, so the ResizeObserver never re-fires — the pop-in bug only bites
// on fresh mounts, which is the human-timescale case.
await page.waitForTimeout(4600);
const exitFrames = await page.evaluate(() => {
	window.__exitStop = true;
	return window.__exitFrames;
});
const viz = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	return { visibility: getComputedStyle(band).visibility };
});
console.log('Visualizers:');
check('band hidden on Visualizers', viz.visibility === 'hidden', viz.visibility);
const exitVisible = exitFrames.filter((f) => f.v === 'visible');
const exitFading = exitVisible.filter((f) => f.o > 0.05 && f.o < 0.95);
check(
	'ribbon fades out across the exit leg (intermediate opacity frames)',
	exitFading.length >= 3,
	`${exitFading.length} fading frames of ${exitVisible.length} visible`
);
const exitDrift = Math.max(...exitVisible.map((f) => Math.abs(f.x - rpDockX)));
check(
	'ribbon drifts with the world on the way out (world-locked, not in place)',
	exitDrift > 8,
	`max displacement ${exitDrift.toFixed(1)}px`
);

// ── Back from Visualizers (the ribbon rides the world in, FADING with the
// incoming page — the pop-in bug's regression guard: the ResizeObserver's
// snapBench used to stomp the entrance fade to full opacity) ──────────────
await page.evaluate(() => {
	window.__enterFrames = [];
	window.__enterStop = false;
	const rec = () => {
		const band = document.querySelector('.bench-band-mount');
		const cs = getComputedStyle(band);
		window.__enterFrames.push({
			x: band.getBoundingClientRect().x,
			o: parseFloat(cs.opacity),
			v: cs.visibility
		});
		if (!window.__enterStop) requestAnimationFrame(rec);
	};
	requestAnimationFrame(rec);
});
await page.click('.chrome-nav a[href*="rotation-planner"]');
await page.waitForTimeout(3400);
const enterFrames = await page.evaluate(() => {
	window.__enterStop = true;
	return window.__enterFrames;
});
const rp3 = await page.evaluate(() => {
	const band = document.querySelector('.bench-band-mount');
	const anchor = (() => {
		const layers = [...document.querySelectorAll('.tool-main > .tool-page')].filter(
			(p) => p.dataset.page === location.pathname
		);
		const layer = layers[layers.length - 1] ?? document;
		return layer.querySelector('[data-bench-anchor]');
	})();
	const b = band?.getBoundingClientRect();
	const a = anchor?.getBoundingClientRect();
	return { visible: getComputedStyle(band).visibility === 'visible', b, a };
});
check(
	'band re-enters from Visualizers and docks',
	rp3.visible && rp3.b && rp3.a && Math.abs(rp3.b.x - rp3.a.x) <= 1,
	JSON.stringify({ b: rp3.b, a: rp3.a })
);
const enterVisible = enterFrames.filter((f) => f.v === 'visible');
const enterFading = enterVisible.filter((f) => f.o > 0.05 && f.o < 0.95);
check(
	'ribbon FADES in from Visualizers (never pops in)',
	enterFading.length >= 3,
	`${enterFading.length} fading frames of ${enterVisible.length} visible`
);
const enterDrift = Math.max(
	0,
	...enterVisible.filter((f) => f.o < 0.95).map((f) => Math.abs(f.x - (rp3.a?.x ?? 0)))
);
check(
	'ribbon drifts in glued to the incoming frame (offset from dock while fading)',
	enterDrift > 8,
	`max offset while fading ${enterDrift.toFixed(1)}px`
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
	const anchor = (() => {
		const layers = [...document.querySelectorAll('.tool-main > .tool-page')].filter(
			(p) => p.dataset.page === location.pathname
		);
		const layer = layers[layers.length - 1] ?? document;
		return layer.querySelector('[data-bench-anchor]');
	})();
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

// The watchdog must have stayed silent. This is asserted INSTEAD OF trusting
// the geometry check above on its own: the watchdog CORRECTS a mis-set layer,
// so a run where the orchestration went wrong can still settle looking right.
// ⚠️ KNOWN INTERMITTENT (~1 run in 6, 2026-08-07): the tool→tool orchestration
// can leave a layer's computed opacity pinned — invisible current tool, or a
// departed layer painting at full strength — in a state where normal inline
// declarations and new WAAPI animations are both ignored. Screenshot-confirmed
// user-visible. The watchdog heals it within its period; the root cause is
// open. If this check is red, that is the bug, not a flaky probe.
const wd = await page.evaluate(() => ({ ...window.__toolWatchdog }));
check(
	'the stale-layer watchdog never fired (no layer was left mis-set)',
	wd.hits === 0,
	`${wd.hits} hit(s): ${wd.last ?? ''}`
);

// ── Short viewport: the strip still spans its frame, and the work zone (not
// the bench column) carries the team readout ─────────────────────────────
const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page2.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
await page2.waitForTimeout(600);
const short = await page2.evaluate(() => {
	// .bn retired with the abutting round; nothing in the frame scrolls under
	// the strip because nothing is under the strip.
	const zone = document.querySelector('.bn');
	const band = document.querySelector('.bench-band-mount');
	const b = band?.getBoundingClientRect();
	const anchor = (() => {
		const layers = [...document.querySelectorAll('.tool-main > .tool-page')].filter(
			(p) => p.dataset.page === location.pathname
		);
		const layer = layers[layers.length - 1] ?? document;
		return layer.querySelector('[data-bench-anchor]');
	})();
	const a = anchor?.getBoundingClientRect();
	const f = document.querySelector('.tb-frame')?.getBoundingClientRect();
	const bands = document.querySelector('.bands')?.getBoundingClientRect();
	return {
		bandY: b?.y,
		bandH: b?.height,
		anchorY: a?.y,
		frameY: f?.y,
		frameH: f?.height,
		bandsY: bands?.y,
		clip: band?.style.clipPath ?? '',
		lastCardBottom: [...document.querySelectorAll('.bench-band-mount .bb-slot')]
			.pop()
			?.getBoundingClientRect().bottom,
		zoneScrolls: zone ? getComputedStyle(zone).overflowY : ''
	};
});
console.log('Short viewport (720p) TB:');
check(
	'ribbon stays docked (no scroll coupling)',
	Math.abs((short.bandY ?? 0) - (short.anchorY ?? 1)) <= 1,
	JSON.stringify(short)
);
check('no clip-path on the ribbon (machinery retired)', short.clip === '', short.clip);
// Short viewport: the TB frame is viewport-fit and can be SHORTER than four
// cards. The strip opens on the same line (band stack top − 12) but floors at
// its own content rather than clipping the fourth card inside the frame.
check(
	'ribbon opens 12px above the BAND STACK even when the frame is shorter than the cards',
	short.bandsY != null && Math.abs(short.bandsY - short.bandY - 12) <= 1,
	JSON.stringify(short)
);
check(
	'ribbon never clips a card on a short viewport (content floor)',
	short.lastCardBottom != null && short.lastCardBottom <= short.bandY + short.bandH,
	JSON.stringify({ lastCardBottom: short.lastCardBottom, stripBottom: short.bandY + short.bandH })
);
check(
	'bench zone is gone at 720p too (nothing under the strip to scroll)',
	short.zoneScrolls === '',
	`expected no .bn at all, got overflowY=${short.zoneScrolls}`
);

await browser.close();
console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
