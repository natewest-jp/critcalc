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
	await page.click('.ws-reset');
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
