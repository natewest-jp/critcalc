// CROSS-ENGINE: does the tool→tool orchestration ever leave a layer mis-set?
//
// ⚓ Nate 2026-08-07: reproducible in Chrome within seconds; NOT reproducible in
// real Safari or Firefox under the most extensive click gymnastics he could
// manage. This probe puts that observation on the record automatically, because
// the same report was once dismissed as impossible ("the transition math is the
// same everywhere, so every engine should show it") — which had the evidence
// exactly backwards. A defect three engines disagree about IS an engine defect.
//
// Drives the same nav storm in Chromium (real Chrome), Firefox and WebKit and
// reads the layout's own stale-layer watchdog. Needs the PREVIEW build on :4998.
//
// Run: node scripts/probe-tool-layer-engines.mjs   (ENGINES=chrome,firefox,webkit)
import { chromium, firefox, webkit } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4998';
const CYCLES = Number(process.env.CYCLES ?? 6);
const WANT = (process.env.ENGINES ?? 'chrome,firefox,webkit').split(',');

const ENGINES = {
	chrome: { type: chromium, opts: { channel: 'chrome' } },
	firefox: { type: firefox, opts: {} },
	webkit: { type: webkit, opts: {} }
};

const SEED = () => {
	localStorage.setItem(
		'critcalc:rotationTabs',
		JSON.stringify({
			tabs: [
				{
					id: 'seedtab01',
					label: 'Seed',
					notation: 'Furina E Q > Bennett E Q > Xingqiu E Q > Kazuha E Q',
					manualSlots: null
				}
			],
			activeTabId: 'seedtab01'
		})
	);
};

async function runEngine(name) {
	const { type, opts } = ENGINES[name];
	const browser = await type.launch({ headless: true, ...opts });
	const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.addInitScript(SEED);
	await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1000);

	const click = (t) => page.click(`.chrome-nav a[href*="${t}"]`);
	for (let i = 0; i < CYCLES; i++) {
		// A dockless leg (the ribbon joins the tool surface), settles between,
		// then the storm: navigate away and interrupt back mid-flight.
		await click('crit-visualizer');
		await page.waitForTimeout(4600);
		await click('rotation-planner');
		await page.waitForTimeout(3400);
		await click('team-builder');
		await page.waitForTimeout(3600);
		await click('rotation-planner');
		await page.waitForTimeout(1100);
		await click('team-builder');
		await page.waitForTimeout(3600);
	}
	const out = await page.evaluate(() => ({
		hits: window.__toolWatchdog ? window.__toolWatchdog.hits : 'no watchdog',
		last: window.__toolWatchdog ? window.__toolWatchdog.last : null,
		roster: [...document.querySelectorAll('.tool-main > .tool-page')].map(
			(p) => `${p.dataset.page}@${getComputedStyle(p).opacity}`
		)
	}));
	await browser.close();
	return { name, ...out, errors };
}

const results = [];
for (const name of WANT) {
	if (!ENGINES[name]) continue;
	process.stdout.write(`  ${name}: running ${CYCLES} storm cycles… `);
	try {
		const r = await runEngine(name);
		results.push(r);
		console.log(
			`watchdog hits = ${r.hits}${r.last ? ` — ${r.last}` : ''} | rest: ${r.roster.join(' ')}`
		);
		for (const e of r.errors) console.log(`     pageerror: ${e.slice(0, 160)}`);
	} catch (err) {
		console.log(`SKIPPED (${err.message.split('\n')[0]})`);
	}
}

const bad = results.filter((r) => typeof r.hits === 'number' && r.hits > 0).map((r) => r.name);
console.log(
	bad.length
		? `\nMis-set layers seen ONLY in: ${bad.join(', ')} — clean in ${results
				.filter((r) => !bad.includes(r.name))
				.map((r) => r.name)
				.join(', ')}`
		: '\nNo engine left a layer mis-set this run.'
);
