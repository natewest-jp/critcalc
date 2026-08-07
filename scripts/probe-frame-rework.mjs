/**
 * Probe: rotation-planner frame grammar (2026-07-19, round 3 — the flip)
 *  - ruler on the TOP edge (DAW convention)
 *  - notation COMPOSER on the BOTTOM edge (chat-app register): inset box with
 *    a permanent --rp-line border, darker well
 *
 * ↻ TOOLBAR ROUND 2026-08-07 — three of this probe's subjects moved OUT of the
 * frame, which is the point of that round rather than a regression:
 *  - the view cluster (Total · zoom · Notes) is BAND B. It is view state, and
 *    view state lives in the bands in every tool now.
 *  - KQM and PNG left the composer's right-hand "send" column for band A's
 *    single Share menu — they are exports, one family with the share link, and
 *    they had been split across the top and bottom corners of one tool.
 *  - the tab strip is band A.
 * What this probe still owns is the FRAME's own grammar: ruler above tracks,
 * composer on the bottom edge, the notes panel pushing only the tracks, and the
 * ruler viewport following the track scroll.
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
		bands: r('.bands'),
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
	'view controls sit ABOVE the frame, in band B (not on the ruler)',
	geo.bands && geo.ruler && geo.bands.bottom <= geo.ruler.top,
	`bands.bottom=${geo.bands?.bottom?.toFixed(0)} ruler.top=${geo.ruler?.top?.toFixed(0)}`
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

// 2. Composer box: single-line, darker well, frame-aligned, chips beside
const composer = await page.evaluate(() => {
	const cm = document.querySelector('.rp-notation .cm-editor');
	const frame = document.querySelector('.rp-frame');
	// Abutting round: the portrait column is gone (the ribbon holds the cards
	// OUTSIDE the frame), so the composer starts at the frame's padding box.
	const frameEl = document.querySelector('.rp-frame');
	const cs = cm ? getComputedStyle(cm) : null;
	return {
		borderW: cs?.borderTopWidth,
		bg: cs?.backgroundColor,
		frameBg: frame ? getComputedStyle(frame).backgroundColor : null,
		boxH: cm?.getBoundingClientRect().height,
		boxL: cm?.getBoundingClientRect().left,
		boxW: cm?.getBoundingClientRect().width,
		framePadL: frameEl
			? frameEl.getBoundingClientRect().left +
				parseFloat(getComputedStyle(frameEl).borderLeftWidth) +
				parseFloat(getComputedStyle(frameEl).paddingLeft)
			: null,
		composerW: document.querySelector('.rp-composer')?.getBoundingClientRect().width ?? null
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
	'box starts at the frame’s left content edge',
	composer.boxL != null &&
		composer.framePadL != null &&
		Math.abs(composer.boxL - composer.framePadL) <= 2,
	`box.left=${composer.boxL?.toFixed(0)} frame.padL=${composer.framePadL?.toFixed(0)}`
);
// The export column is gone from the composer (toolbar round) — the notation
// box now takes the composer's whole width.
check(
	'notation box fills the composer (no export column beside it)',
	composer.boxH != null &&
		composer.composerW != null &&
		Math.abs(composer.composerW - (composer.boxW ?? 0)) <= 2,
	`composer=${composer.composerW?.toFixed(0)} box=${composer.boxW?.toFixed(0)}`
);

// 3. Band B = this tool's VIEW controls; band A = the DOCUMENT.
const bandB = await page.evaluate(() => ({
	total: document.querySelector('.rp-total')?.textContent.replace(/\s+/g, '') ?? null,
	notes: !!document.querySelector('.band-b .rp-notes-btn'),
	zoom: !!document.querySelector('.band-b .rp-zoom-slider')
}));
check('total readout shows key+value', /^Total[\d.]+s$/.test(bandB.total ?? ''), bandB.total);
check('band B holds the zoom + Notes pair', bandB.zoom && bandB.notes);

// 4. Band A = document chrome only. The exports are behind ONE Share menu, so
// no KQM/PNG/Notes control is loose in the band.
const strip = await page.evaluate(() =>
	[...document.querySelectorAll('.band-a .btn')].map((b) => b.textContent.trim())
);
check(
	'band A = Save/Load/Share only',
	strip.join('|').includes('Share') && !/PNG|KQM|Notes/i.test(strip.join('|')),
	strip.join(' · ')
);

// 5. Notes panel: pushes only the tracks — never the ruler strip, never the
//    frame height; long caveats scroll in place.
const beforeNotes = await page.evaluate(() => ({
	frameH: document.querySelector('.rp-frame').getBoundingClientRect().height,
	rulerW: document.querySelector('.rp-ruler-scroll').getBoundingClientRect().width,
	trackW: document.querySelector('.rp-track-scroll').getBoundingClientRect().width
}));
await page.click('.band-b .rp-notes-btn');
await page.waitForTimeout(300);
const afterNotes = await page.evaluate(() => ({
	panel: !!document.querySelector('.rp-caveat-panel'),
	frameH: document.querySelector('.rp-frame').getBoundingClientRect().height,
	rulerW: document.querySelector('.rp-ruler-scroll').getBoundingClientRect().width,
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
	beforeNotes.rulerW === afterNotes.rulerW,
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
await page.click('.band-b .rp-notes-btn');

// 5b. Ruler follows track scroll (follower viewport, zoomed in far enough
//     to guarantee overflow)
await page.click('.rp-zoom .btn[aria-label="Zoom in"]', { clickCount: 6 });
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
await page.click('.rp-zoom .btn[aria-label="Zoom out"]', { clickCount: 6 });
await page.waitForTimeout(300);

// 6/7. The exports: ONE Share menu in band A, offering the link plus the two
// chart-bound exports the timeline registers. (The PNG pop-out that used to
// open UPWARD from the composer is gone with the composer's action column.)
await page.click('.band-a .band-menu-trigger');
await page.waitForTimeout(200);
const menu = await page.evaluate(() =>
	[...document.querySelectorAll('.band-menu-item')].map((b) => b.textContent.trim())
);
check(
	'Share menu offers the link and both chart exports',
	menu.some((t) => /link/i.test(t)) &&
		menu.some((t) => /KQM/i.test(t)) &&
		menu.filter((t) => /image/i.test(t)).length === 2,
	menu.join(' · ')
);
const kqmIdx = menu.findIndex((t) => /KQM/i.test(t));
await page.locator('.band-menu-item').nth(kqmIdx).click();
await page.waitForTimeout(400);
check(
	'KQM copy reports through the band notice',
	(await page.evaluate(() => document.querySelector('.doc-notice')?.textContent.trim())) ===
		'KQM copied'
);
const clipText = await page.evaluate(() => navigator.clipboard.readText().catch(() => null));
check('clipboard holds KQM text', (clipText ?? '').includes('Furina'), JSON.stringify(clipText));

// Screenshots
await page.locator('.rp-frame').screenshot({ path: `${SHOT_DIR}/frame-rework-full.png` });
await page.screenshot({ path: `${SHOT_DIR}/frame-rework-page.png`, fullPage: false });

console.log(results.join('\n'));
console.log(errors.length ? `\nERRORS:\n${errors.join('\n')}` : '\nNo console/page errors.');
await browser.close();
