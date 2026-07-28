/**
 * probe-buff-windows.mjs — browser verification of the post-P4 #5 flip:
 * buff rows are projections of parser-side `buff` windows. Drives four
 * scenarios through the real planner and checks the rendered row labels:
 *
 *   1. Yanfei A1 — the arc's headline delta: her onHit-charged perStack
 *      buff renders as a received "Yanfei CA" row (auto-tracked seals).
 *   2. Flins C2 — per-swing Electro shred debuff row on stance normals
 *      (constellation + Moonsign-team gated; seeded via localStorage).
 *   3. TTDS / Widsith — weapon swap-proc received rows survive the flip.
 *   4. Natlan team — the NIGHTSOUL lane renders off parser NB events.
 *
 * Usage: build + serve on :4998 first (see .claude/skills/verify), then
 *   node scripts/probe-buff-windows.mjs
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });

// Seed constellations (Flins C2) + loadout (TTDS on Bennett, Widsith on
// Xiangling) before the app boots.
await page.addInitScript(() => {
	localStorage.setItem('critcalc:constellations', JSON.stringify({ flins: 2 }));
	localStorage.setItem(
		'critcalc:loadout',
		JSON.stringify({
			bennett: { weaponId: 'thrilling_tales_of_dragon_slayers', weaponRefinement: 5 },
			xiangling: { weaponId: 'the_widsith', weaponRefinement: 1 }
		})
	);
});

const errors = [];
page.on('console', (msg) => {
	if (msg.type() === 'error' && !msg.text().includes('404')) errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

await page.goto('http://localhost:4998/rotation-planner', { waitUntil: 'networkidle' });

const CASES = [
	{
		notation: 'Yanfei N1 N2 N3 C',
		why: 'Yanfei A1 renders on the CA hit (auto-tracked seals)',
		check: (s) => s.buffLabels.includes('Yanfei CA')
	},
	{
		notation: 'Flins E N1 N2 N3 > Linnea E',
		why: 'Flins C2 per-swing Electro shred (debuff bars present, N row)',
		check: (s) => s.buffLabels.includes('Flins N') && s.debuffBars > 0
	},
	{
		notation: 'Bennett E Q > Xiangling E Q > Bennett E > Xiangling E',
		why: 'TTDS swap-out + Widsith swap-in received rows',
		check: (s) => s.buffLabels.includes('TTDS') && s.buffLabels.includes('Widsith')
	},
	{
		notation: 'Mavuika E Q > Xilonen E Q',
		why: 'NIGHTSOUL lane renders off parser NB events',
		// The lane's rendered label is 'NIGHTSOUL BURSTS'; this asserted the bare
		// word and so had been failing on an exact-match includes() since the
		// label was lengthened.
		check: (s) => s.laneLabels.includes('NIGHTSOUL BURSTS')
	}
];

let failures = 0;
for (const c of CASES) {
	await page.click('.cm-content');
	await page.keyboard.press('Meta+a');
	await page.keyboard.press('Backspace');
	await page.keyboard.type(c.notation, { delay: 30 });
	await page.waitForTimeout(2500); // lazy character payloads + re-render

	const state = await page.evaluate(() => ({
		buffLabels: [...document.querySelectorAll('.rp-buff-label')].map((el) =>
			el.textContent?.trim()
		),
		debuffBars: document.querySelectorAll('.rp-team-debuff-bar').length,
		laneLabels: [...document.querySelectorAll('.rp-label-text')].map((el) => el.textContent?.trim())
	}));
	const ok = c.check(state);
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.notation.padEnd(45)} (${c.why})`);
	if (!ok) console.log('   state:', JSON.stringify(state));
}

if (errors.length) {
	console.log('console errors:', JSON.stringify(errors, null, 2));
	failures++;
}
await browser.close();
process.exit(failures === 0 ? 0 : 1);
