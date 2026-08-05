/**
 * Probe: rotation-planner frame grammar (2026-07-19, round 3 — the flip)
 *  - ruler + view cluster (Total/zoom/NOTES) on the TOP edge (DAW convention)
 *  - notation COMPOSER on the BOTTOM edge (chat-app register): inset box with
 *    a permanent --rp-line border, darker well, KQM/PNG "send" column on its
 *    right, heights matched (54px single-line)
 *  - PNG menu opens UPWARD from the composer
 *  - tab strip = document chrome only (no PNG/KQM/Notes)
 *
 * Run: start `npm run preview -- --port 4998 --strictPort`, then
 *      `node scripts/probe-frame-rework.mjs`
 */
import { chromium } from 'playwright';

const SHOT_DIR = process.env.PROBE_SHOT_DIR ?? '.';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], {
	origin: 'http://localhost:4998'
});
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
	if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`);
});

await page.goto('http://localhost:4998/rotation-planner', { waitUntil: 'networkidle' });

const results = [];
const check = (name, ok, extra = '') =>
	results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);

// 0. Border three-state machine (before typing: resting → hover → focused)
const borderOf = () =>
	page.evaluate(
		() => getComputedStyle(document.querySelector('.rp-notation .cm-editor')).borderTopColor
	);
// The exact line color belongs to the color rounds (the old #1c2a4a pin went
// stale when the dire retirement re-derived --frame-line) — assert the
// three-state MACHINE instead: resting and focused share the line color,
// hover departs to a half-alpha accent.
const restingBorder = await borderOf();
await page.hover('.rp-notation .cm-editor');
await page.waitForTimeout(300); // let the 150ms border-color transition settle
const hoverBorder = await borderOf();
check(
	'border hover departs at half alpha',
	(hoverBorder ?? '').includes('/ 0.5') && hoverBorder !== restingBorder,
	hoverBorder
);
await page.click('.cm-content'); // focus (mouse still over the box)
await page.waitForTimeout(300); // transition settle
const focusBorder = await borderOf();
check(
	'border focused returns to the resting line color',
	focusBorder === restingBorder && focusBorder !== hoverBorder,
	`resting=${restingBorder} focused=${focusBorder}`
);

// Type a rotation that exercises lanes + caveats
await page.keyboard.type('Furina E Q > Bennett E Q N2 > Xingqiu E Q', { delay: 25 });
await page.waitForTimeout(2500); // lazy char payloads + reparse

// 1. Vertical grammar: ruler top → tracks → scrub → composer bottom
const geo = await page.evaluate(() => {
	const r = (s) => document.querySelector(s)?.getBoundingClientRect() ?? null;
	return {
		ruler: r('.rp-ruler'),
		charBlock: r('.rp-char-block'),
		ext: r('.rp-ext-scroll-wrap'),
		composer: r('.rp-composer'),
		cluster: r('.rp-view-cluster'),
		tickLabel: r('.rp-tick-label'),
		gridline: r('.rp-gridline')
	};
});
check(
	'ruler on the TOP edge (above char blocks)',
	geo.ruler && geo.charBlock && geo.ruler.bottom <= geo.charBlock.top + 1,
	`ruler.bottom=${geo.ruler?.bottom?.toFixed(0)} charBlock.top=${geo.charBlock?.top?.toFixed(0)}`
);
check(
	'composer on the BOTTOM edge (below scrub strip)',
	geo.composer && geo.ext && geo.composer.top >= geo.ext.bottom - 1,
	`composer.top=${geo.composer?.top?.toFixed(0)} ext.bottom=${geo.ext?.bottom?.toFixed(0)}`
);
check(
	'view cluster rides the top ruler',
	geo.cluster && geo.ruler && Math.abs(geo.cluster.top - geo.ruler.top) <= 1.5
);
check(
	'tick labels inside top ruler band',
	geo.tickLabel && geo.ruler && geo.tickLabel.bottom <= geo.ruler.bottom
);
check(
	'gridlines start at the ruler seam',
	geo.gridline && geo.ruler && Math.abs(geo.gridline.top - geo.ruler.bottom) <= 1.5,
	`grid.top=${geo.gridline?.top?.toFixed(0)} ruler.bottom=${geo.ruler?.bottom?.toFixed(0)}`
);

// 2. Composer box: single-line, darker well, portrait-aligned, chips beside
const composer = await page.evaluate(() => {
	const cm = document.querySelector('.rp-notation .cm-editor');
	const frame = document.querySelector('.rp-frame');
	const labelCol = document.querySelector('.rp-label-col');
	const btns = [...document.querySelectorAll('.rp-composer-actions .rp-composer-btn')];
	const cs = cm ? getComputedStyle(cm) : null;
	return {
		borderW: cs?.borderTopWidth,
		bg: cs?.backgroundColor,
		frameBg: frame ? getComputedStyle(frame).backgroundColor : null,
		boxH: cm?.getBoundingClientRect().height,
		boxL: cm?.getBoundingClientRect().left,
		labelR: labelCol?.getBoundingClientRect().right,
		btnRects: btns.map((b) => b.getBoundingClientRect()),
		btnLabels: btns.map((b) => b.textContent.trim())
	};
});
check('notation box border is 1px', composer.borderW === '1px', composer.borderW);
check('well darker than chart bg', composer.bg !== null && composer.bg !== composer.frameBg);
check(
	'box is single-line height',
	composer.boxH != null && composer.boxH >= 38 && composer.boxH <= 46,
	`box=${composer.boxH?.toFixed(0)}`
);
check(
	'box starts at portrait-column right edge',
	composer.boxL != null &&
		composer.labelR != null &&
		Math.abs(composer.boxL - composer.labelR) <= 2,
	`box.left=${composer.boxL?.toFixed(0)} portraits.right=${composer.labelR?.toFixed(0)}`
);
check(
	'KQM + PNG side-by-side beside the box',
	composer.btnLabels.join('/') === '⎘ KQM/⧉ PNG' &&
		composer.btnRects.length === 2 &&
		composer.btnRects[1].left >= composer.btnRects[0].right,
	composer.btnLabels.join('/')
);

// 3. Cluster contents + no PNG there
const cluster = await page.evaluate(() => ({
	total: document.querySelector('.rp-ruler-total')?.textContent.trim() ?? null,
	notes: !!document.querySelector('.rp-notes-btn'),
	pngInCluster: !!document.querySelector('.rp-view-cluster .rp-png-wrap')
}));
check('total chip shows key+value', /^Total[\d.]+s$/.test(cluster.total ?? ''), cluster.total);
check('NOTES in cluster, PNG not', cluster.notes && !cluster.pngInCluster);

// 4. Tab strip = document chrome only
// (.tab-bar-actions/.tb-btn were retired by the design-system migration —
// the strip is .rp-tab-bar-actions with global .btn children now.)
const strip = await page.evaluate(() =>
	[...document.querySelectorAll('.rp-tab-bar-actions .btn')].map((b) => b.textContent.trim())
);
check(
	'tab strip = Save/Load/Share only',
	strip.join('|').includes('Share') && !/PNG|KQM|Notes/i.test(strip.join('|')),
	strip.join(' · ')
);

// 5. Notes panel: pushes only the tracks — never the ruler strip, never the
//    frame height; long caveats scroll in place.
const beforeNotes = await page.evaluate(() => ({
	frameH: document.querySelector('.rp-frame').getBoundingClientRect().height,
	rulerW: document.querySelector('.rp-ruler-scroll').getBoundingClientRect().width,
	clusterR: document.querySelector('.rp-view-cluster').getBoundingClientRect().right,
	trackW: document.querySelector('.rp-track-scroll').getBoundingClientRect().width
}));
await page.click('.rp-notes-btn');
await page.waitForTimeout(300);
const afterNotes = await page.evaluate(() => ({
	panel: !!document.querySelector('.rp-caveat-panel'),
	frameH: document.querySelector('.rp-frame').getBoundingClientRect().height,
	rulerW: document.querySelector('.rp-ruler-scroll').getBoundingClientRect().width,
	clusterR: document.querySelector('.rp-view-cluster').getBoundingClientRect().right,
	trackW: document.querySelector('.rp-track-scroll').getBoundingClientRect().width,
	panelScrolls: (() => {
		const p = document.querySelector('.rp-caveat-panel');
		return p ? { sh: p.scrollHeight, ch: p.clientHeight } : null;
	})()
}));
check('Notes opens caveat panel', afterNotes.panel);
check(
	'notes push tracks only (~240px)',
	beforeNotes.trackW - afterNotes.trackW >= 230,
	`trackW ${beforeNotes.trackW.toFixed(0)} → ${afterNotes.trackW.toFixed(0)}`
);
check(
	'ruler strip NOT pushed by notes',
	beforeNotes.rulerW === afterNotes.rulerW && beforeNotes.clusterR === afterNotes.clusterR,
	`rulerW ${beforeNotes.rulerW.toFixed(0)} → ${afterNotes.rulerW.toFixed(0)}`
);
check(
	'frame height unchanged by notes (scroll-in-place)',
	Math.abs(beforeNotes.frameH - afterNotes.frameH) <= 1,
	`frameH ${beforeNotes.frameH.toFixed(0)} → ${afterNotes.frameH.toFixed(0)}`
);
check(
	'panel height locked to track area',
	afterNotes.panelScrolls !== null && afterNotes.panelScrolls.ch > 0,
	JSON.stringify(afterNotes.panelScrolls)
);
await page.click('.rp-notes-btn');

// 5b. Ruler follows track scroll (follower viewport, zoomed in far enough
//     to guarantee overflow)
await page.click('.rp-zoom-btn[aria-label="Zoom in"]', { clickCount: 6 });
await page.waitForTimeout(200);
await page.evaluate(() => {
	document.querySelector('.rp-track-scroll').scrollLeft = 300;
	document.querySelector('.rp-track-scroll').dispatchEvent(new Event('scroll'));
});
await page.waitForTimeout(300);
const rulerSync = await page.evaluate(() => ({
	track: document.querySelector('.rp-track-scroll').scrollLeft,
	ruler: document.querySelector('.rp-ruler-scroll').scrollLeft
}));
check(
	'ruler viewport follows track scroll',
	rulerSync.track > 0 && Math.abs(rulerSync.track - rulerSync.ruler) <= 1,
	JSON.stringify(rulerSync)
);
await page.evaluate(() => {
	document.querySelector('.rp-track-scroll').scrollLeft = 0;
	document.querySelector('.rp-track-scroll').dispatchEvent(new Event('scroll'));
});
await page.click('.rp-zoom-btn[aria-label="Zoom out"]', { clickCount: 6 });
await page.waitForTimeout(300);

// 6. PNG menu opens UPWARD from the composer
await page.click('.rp-composer-actions .rp-png-wrap .rp-composer-btn');
await page.waitForTimeout(200);
const menuGeo = await page.evaluate(() => {
	const m = document.querySelector('.rp-png-menu')?.getBoundingClientRect();
	const b = document
		.querySelector('.rp-composer-actions .rp-png-wrap .rp-composer-btn')
		?.getBoundingClientRect();
	return { m, b };
});
check(
	'PNG menu opens upward',
	menuGeo.m && menuGeo.b && menuGeo.m.bottom <= menuGeo.b.top,
	`menu.bottom=${menuGeo.m?.bottom?.toFixed(0)} btn.top=${menuGeo.b?.top?.toFixed(0)}`
);
await page.mouse.click(10, 10); // dismiss via backdrop
await page.waitForTimeout(200);

// 7. KQM copy → transient feedback + clipboard content
const kqmSel = '.rp-composer-actions > .rp-composer-btn';
await page.click(kqmSel);
await page.waitForTimeout(300);
check(
	'KQM feedback flips',
	(await page.evaluate((s) => document.querySelector(s)?.textContent.trim(), kqmSel)) === '✓ Copied'
);
const clipText = await page.evaluate(() => navigator.clipboard.readText().catch(() => null));
check('clipboard holds KQM text', (clipText ?? '').includes('Furina'), JSON.stringify(clipText));
await page.waitForTimeout(1700);
check(
	'KQM label reverts',
	(await page.evaluate((s) => document.querySelector(s)?.textContent.trim(), kqmSel)) === '⎘ KQM'
);

// Screenshots
await page.locator('.rp-frame').screenshot({ path: `${SHOT_DIR}/frame-rework-full.png` });
await page.screenshot({ path: `${SHOT_DIR}/frame-rework-page.png`, fullPage: false });

console.log(results.join('\n'));
console.log(errors.length ? `\nERRORS:\n${errors.join('\n')}` : '\nNo console/page errors.');
await browser.close();
