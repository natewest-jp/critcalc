/**
 * probe-viz-slots — the Visualizers lineup control (slot-count round).
 *
 * Asserts the reader's slot preference caps the viewport's capacity, that
 * over-capacity options disable rather than silently no-op, that the tile owns
 * the `instrument` query container (so instruments RE-LAY-OUT at 1-up instead
 * of stretching), and that the preference survives a reload without a
 * default-lineup flash. Also re-checks the keep-alive contract the workspace
 * depends on: instruments stay mounted across slot-count changes.
 *
 * Usage: node scripts/probe-viz-slots.mjs   (preview must be on :4998)
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4998';
let pass = 0;
const fail = [];

function check(label, cond, detail = '') {
	if (cond) {
		pass++;
		console.log(`  ✓ ${label}`);
	} else {
		fail.push(label);
		console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
	}
}

const slotButtons = (page) => page.locator('.ws-slots button');
const visibleTiles = (page) => page.locator('.ws-tile:not(.ws-hidden)');

/** Columns the workspace grid actually paints (the real proof, not --ws-slots). */
async function columnCount(page) {
	return page.evaluate(() => {
		const ws = document.querySelector('.ws');
		return getComputedStyle(ws).gridTemplateColumns.split(' ').filter(Boolean).length;
	});
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
	// ── Wide viewport: capacity 3 ──────────────────────────────────────────
	const page = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
	await page.goto(`${BASE}/crit-visualizer`, { waitUntil: 'networkidle' });

	console.log('\nWide viewport (2400px — capacity 3)');
	check('Auto renders 3 columns', (await columnCount(page)) === 3);
	check('3 tiles visible', (await visibleTiles(page).count()) === 3);
	check('lineup control present', (await slotButtons(page).count()) === 4);
	check(
		'Auto is the resting selection',
		await slotButtons(page)
			.nth(0)
			.evaluate((b) => b.classList.contains('is-active'))
	);
	check(
		'no option is disabled at full capacity',
		(await page.locator('.ws-slots button:disabled').count()) === 0
	);

	// ── The cap ────────────────────────────────────────────────────────────
	console.log('\nCapping the lineup');
	await page.click('.ws-slots button:nth-child(2)'); // "1"
	await page.waitForTimeout(120);
	check('picking 1 renders a single column', (await columnCount(page)) === 1);
	check('exactly one tile visible', (await visibleTiles(page).count()) === 1);

	// The point of the round: at 1-up the instrument must ADAPT, not stretch.
	// CritInstrument's @container (min-width: 48rem/60rem) rules only fire if
	// the TILE is the query container.
	const wideLayout = await page.evaluate(() => {
		const el = document.querySelector('.cv-layout');
		if (!el) return null;
		return getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
	});
	check(
		'crit instrument takes its two-column layout at 1-up (tile owns the container)',
		wideLayout === 2,
		`.cv-layout columns = ${wideLayout}`
	);

	check(
		'the tile is the query container',
		await page.evaluate(() => {
			const t = document.querySelector('.ws-tile');
			const cs = getComputedStyle(t);
			return cs.containerType === 'inline-size' && cs.containerName === 'instrument';
		})
	);
	check(
		'no instrument root declares a container any more',
		await page.evaluate(() =>
			[...document.querySelectorAll('.instrument, .cv-instrument')].every(
				(el) => getComputedStyle(el).containerType === 'normal'
			)
		)
	);

	await page.click('.ws-slots button:nth-child(3)'); // "2"
	await page.waitForTimeout(120);
	check('picking 2 renders two columns', (await columnCount(page)) === 2);

	// ── Shrinking back ─────────────────────────────────────────────────────
	// Regression: the heatmap sets its drawn box's width inline in px, so any
	// grid item between that box and the tile that keeps `min-width: auto`
	// takes the stale WIDE box as its min-content and refuses to shrink when
	// the lineup narrows — the chart then spills over the next instrument.
	// Cycle the lineup both ways and assert nothing ever leaves its tile.
	console.log('\nShrinking back');
	const geom = () =>
		page.evaluate(() => {
			const tiles = [...document.querySelectorAll('.ws-tile:not(.ws-hidden)')].sort(
				(a, b) => Number(a.style.order) - Number(b.style.order)
			);
			const f = tiles[0].querySelector('.cv-map-frame');
			const t0 = tiles[0].getBoundingClientRect();
			return {
				spill: f ? Math.round(f.getBoundingClientRect().right - t0.right) : 0,
				overlap:
					f && tiles[1]
						? Math.round(f.getBoundingClientRect().right - tiles[1].getBoundingClientRect().left)
						: -1,
				hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
			};
		});

	let worstSpill = -Infinity;
	let overlapped = false;
	let hScroll = false;
	for (const nth of [2, 4, 3, 2, 1, 3, 2, 4]) {
		await page.click(`.ws-slots button:nth-child(${nth})`);
		await page.waitForTimeout(400);
		const g = await geom();
		worstSpill = Math.max(worstSpill, g.spill);
		if (g.overlap > 0) overlapped = true;
		if (g.hScroll) hScroll = true;
	}
	check('the chart never spills past its own tile', worstSpill <= 1, `worst +${worstSpill}px`);
	check('the chart never overlaps the next instrument', !overlapped);
	check('no horizontal page scroll at any lineup size', !hScroll);

	// Same failure reachable by resizing the window rather than the control.
	for (const w of [2400, 1300, 2400, 1366, 1200]) {
		await page.setViewportSize({ width: w, height: 1200 });
		await page.waitForTimeout(400);
		const g = await geom();
		if (g.spill > 1) overlapped = true;
	}
	check('window resize shrinks the chart back too', !overlapped);
	await page.setViewportSize({ width: 2400, height: 1200 });
	await page.waitForTimeout(300);

	// The real invariant behind both bugs: the chart's geometry must depend on
	// the lineup size ALONE, never on the route taken to it. The width axis
	// failed loudly (spill); the height axis failed SILENTLY — a stale inline
	// px height outvoted `aspect-ratio: 1`, and 765²/765×875 are both
	// self-consistent, so the chart just kept the wide aspect forever.
	const frameBox = (pg) =>
		pg.evaluate(() => {
			const f = document.querySelector('.cv-map-frame').getBoundingClientRect();
			return [Math.round(f.width), Math.round(f.height)];
		});
	await page.click('.ws-slots button:nth-child(4)'); // 3-up, arrived at via cycling
	await page.waitForTimeout(600);
	const cycled = await frameBox(page);

	const fresh = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
	await fresh.goto(`${BASE}/crit-visualizer`, { waitUntil: 'networkidle' });
	await fresh.waitForTimeout(700); // restores the stored 3-up straight from cold
	const freshBox = await frameBox(fresh);
	await fresh.close();

	check(
		'chart geometry is path-independent (same lineup ⇒ same box)',
		cycled[0] === freshBox[0] && cycled[1] === freshBox[1],
		`cycled ${cycled} vs fresh ${freshBox}`
	);
	check('the narrow-lineup chart stays square', cycled[0] === cycled[1], `${cycled}`);

	await page.click('.ws-slots button:nth-child(3)'); // back to "2" for the reload check
	await page.waitForTimeout(200);

	// ── Keep-alive across slot-count changes ───────────────────────────────
	console.log('\nKeep-alive');
	check(
		'unslotted instruments stay in the DOM (hidden, not destroyed)',
		(await page.locator('.ws-tile.ws-hidden').count()) > 0
	);

	// ── Persistence ────────────────────────────────────────────────────────
	console.log('\nPersistence');
	await page.reload({ waitUntil: 'networkidle' });
	check('preference survives a reload', (await columnCount(page)) === 2);
	check(
		'the restored option is the active one',
		await slotButtons(page)
			.nth(2)
			.evaluate((b) => b.classList.contains('is-active'))
	);

	// ── Honest states at a narrow viewport ─────────────────────────────────
	console.log('\nNarrow viewport (1200px — capacity 1)');
	await page.setViewportSize({ width: 1200, height: 1000 });
	await page.waitForTimeout(150);
	check(
		'renders a single column regardless of the stored preference',
		(await columnCount(page)) === 1
	);
	check(
		'over-capacity options are disabled, not inert',
		(await page.locator('.ws-slots button:disabled').count()) === 2
	);
	check(
		'Auto and 1 stay pickable',
		(await slotButtons(page).nth(0).isEnabled()) && (await slotButtons(page).nth(1).isEnabled())
	);
	check(
		'a disabled option explains itself',
		/too narrow/i.test(await slotButtons(page).nth(3).getAttribute('title'))
	);

	// ── Reset ──────────────────────────────────────────────────────────────
	console.log('\nReset workspace');
	await page.setViewportSize({ width: 2400, height: 1200 });
	await page.waitForTimeout(150);
	await page.click('.ws-reset'); // 'Reset layout'
	await page.waitForTimeout(120);
	check('reset returns the lineup to Auto', (await columnCount(page)) === 3);

	// ── The Visualizers still have no bench dock ───────────────────────────
	console.log('\nBench ribbon');
	check(
		'no bench anchor on this tool (by design)',
		(await page.locator('[data-bench-anchor]').count()) === 0
	);

	// ── Deep link still lands in slot 0 ────────────────────────────────────
	console.log('\nDeep link');
	await page.goto(`${BASE}/crit-visualizer?i=gauge`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(200);
	check(
		'?i= puts its instrument in slot 0',
		await page.evaluate(() => {
			const first = [...document.querySelectorAll('.ws-tile')].find(
				(t) => !t.classList.contains('ws-hidden') && getComputedStyle(t).order === '0'
			);
			return !!first?.querySelector('.gx-frame');
		})
	);

	await page.close();
} finally {
	await browser.close();
}

console.log(`\n${pass} passed, ${fail.length} failed`);
if (fail.length) {
	for (const f of fail) console.log(`  ✗ ${f}`);
	process.exit(1);
}
