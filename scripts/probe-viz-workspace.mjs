// Probe: Visualizers workspace layer (slot persistence, ?i= deep links,
// dropdown picker swap semantics, ICD→Gauge handoff, reset).
//
// Usage:  npm run build && npm run preview -- --port 4998 --strictPort &
//         node scripts/probe-viz-workspace.mjs
//
// Node ≥22.18 runs the TS codec import via native type stripping.

import { chromium } from 'playwright';

// Mirror of instrumentUrl.encodeInstrumentParam (that module's extensionless
// sibling import resolves under Vite, not plain Node) — keep in lockstep.
async function encodeInstrumentParam(id, state) {
	const stream = new CompressionStream('deflate-raw');
	const writer = stream.writable.getWriter();
	writer.write(new TextEncoder().encode(JSON.stringify(state))).then(() => writer.close());
	const buf = new Uint8Array(await new Response(stream.readable).arrayBuffer());
	const b64 = Buffer.from(buf).toString('base64url');
	return `${id}.1~${b64}`;
}

const BASE = process.env.PROBE_BASE ?? 'http://localhost:4998';
let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
	if (ok) {
		passed++;
		console.log(`  ✓ ${name}`);
	} else {
		failed++;
		console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
	}
}

// ↻ TOOLBAR ROUND: the pickers left the tiles for BAND B, whose cells are laid
// out on the tile grid's own columns in slot order — so the band IS the
// left→right reading, and the old sort-by-CSS-order dance is gone. (The tiles
// still keep registry DOM order and place visually via `order`; only the
// switcher moved.)
const visibleTriggers = (page) =>
	page.$$eval('.ws-band-cell .ip-trigger', (els) =>
		els.map((e) => e.textContent.trim().replace(/\s*▾$/, ''))
	);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`));

// ── 1. First load: default lineup, two slots at 1600px ─────────────────────
await page.goto(`${BASE}/crit-visualizer`, { waitUntil: 'networkidle' });
{
	const names = await visibleTriggers(page);
	check('two slots visible at 1600px', names.length === 2, JSON.stringify(names));
	check(
		'default lineup crit → gauge',
		names[0] === 'Crit Heatmap' && names[1] === 'Gauge Explorer',
		JSON.stringify(names)
	);
	const share = await page.$$eval(
		'.ws-band-actions .btn',
		(els) => els.filter((e) => e.textContent.includes('Share')).length
	);
	// "Reset" → "Defaults" (toolbar round): it sat one word away from the
	// workspace-level "Reset workspace", with no way to tell them apart.
	const resets = await page.$$eval(
		'.ws-band-actions .btn',
		(els) => els.filter((e) => e.textContent.includes('Defaults')).length
	);
	check('share buttons render on handle-capable tiles', share === 2, String(share));
	check('per-instrument Defaults renders on both cells', resets === 2, String(resets));
}

// ── 2. Picker: open, swap semantics ────────────────────────────────────────
{
	await page.click('.ws-band-cell:first-child .ip-trigger'); // slot 0 picker
	const optCount = await page.$$eval('.ip-menu .ip-option', (els) => els.length);
	check('picker lists all eight instruments', optCount === 8, String(optCount));
	const badge = await page.$$eval('.ip-menu .ip-option', (els) =>
		els.map((e) => e.textContent).find((t) => t.includes('Slot 2'))
	);
	check('other-slot instrument carries a swap badge', Boolean(badge?.includes('Gauge')));
	// pick Gauge Explorer from slot 0's menu → the two tiles must SWAP
	await page.click('.ip-menu .ip-option:nth-child(4)'); // gauge is 4th in registry
	const names = await visibleTriggers(page);
	check(
		'picking a visible instrument swaps tiles',
		names[0] === 'Gauge Explorer' && names[1] === 'Crit Heatmap',
		JSON.stringify(names)
	);
	check('menu closed after pick', (await page.$$('.ip-menu')).length === 0);
}

// ── 3. Persistence across reload ───────────────────────────────────────────
await page.reload({ waitUntil: 'networkidle' });
{
	const names = await visibleTriggers(page);
	check(
		'swapped layout survives reload',
		names[0] === 'Gauge Explorer' && names[1] === 'Crit Heatmap',
		JSON.stringify(names)
	);
}

// ── 4. Reset workspace ─────────────────────────────────────────────────────
{
	await page.click('.ws-reset'); // 'Reset layout'
	const names = await visibleTriggers(page);
	check(
		'reset restores the default lineup',
		names[0] === 'Crit Heatmap' && names[1] === 'Gauge Explorer',
		JSON.stringify(names)
	);
	const stored = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('critcalc:vizWorkspace') ?? 'null')
	);
	check(
		'reset persisted to localStorage',
		stored?.v === 1 && stored?.assignment?.[0] === 'crit',
		JSON.stringify(stored)
	);
}

// ── 5. Bare ?i= deep link ──────────────────────────────────────────────────
await page.goto(`${BASE}/crit-visualizer?i=rolls`, { waitUntil: 'networkidle' });
{
	const names = await visibleTriggers(page);
	check('?i=rolls slots Artifact Rolls first', names[0] === 'Artifact Rolls', names[0]);
	check('param stripped from the URL', !page.url().includes('i='), page.url());
}

// ── 6. Stateful ?i= deep link (crit CR/CD payload) ─────────────────────────
{
	const param = await encodeInstrumentParam('crit', {
		v: 1,
		cr: 0.9,
		cd: 2.5,
		cvLine: true,
		variance: false,
		hits: 8,
		pin: null
	});
	await page.goto(`${BASE}/crit-visualizer?i=${encodeURIComponent(param)}`, {
		waitUntil: 'networkidle'
	});
	const names = await visibleTriggers(page);
	check('stateful link slots Crit Heatmap first', names[0] === 'Crit Heatmap', names[0]);
	const cr = await page.$eval('.cv-value-input', (el) => el.value);
	check('shared CR applied (90%)', cr === '90', cr);
	// per-instrument Defaults restores that instrument's own controls
	await page.$$eval('.ws-band-cell:first-child .ws-band-actions .btn', (els) => {
		els.forEach((b) => {
			if (b.textContent.includes('Defaults')) b.click();
		});
	});
	const crReset = await page.$eval('.cv-value-input', (el) => el.value);
	check('tile reset restores defaults (CR back to 70%)', crReset === '70', crReset);
}

// ── 7. ICD→Gauge handoff ───────────────────────────────────────────────────
await page.evaluate(() => localStorage.removeItem('critcalc:vizWorkspace'));
await page.goto(`${BASE}/crit-visualizer?i=icd`, { waitUntil: 'networkidle' });
{
	const names = await visibleTriggers(page);
	check('?i=icd slots ICD Timeline first', names[0] === 'ICD Timeline', names[0]);
	const applying = await page.$eval('.icd-big', (el) => parseInt(el.textContent, 10));
	await page.click('.icd-send');
	await page.waitForTimeout(120);
	const after = await visibleTriggers(page);
	check(
		'handoff slots Gauge Explorer beside the source',
		after[0] === 'ICD Timeline' && after[1] === 'Gauge Explorer',
		JSON.stringify(after)
	);
	const rows = await page.$$eval('.gx-app', (els) => els.length);
	check(
		'gauge received the applying hits (≤8 cap)',
		rows === Math.min(applying, 8),
		`rows=${rows} applying=${applying}`
	);
	// `.gx-note` retired in the styleguide migration (the seven per-instrument
	// *-note copies folded into the global .note); scope to the gauge tile.
	const note = await page.$eval('.gx-panels .note', (el) => el.textContent);
	check('gauge shows the custom-sequence note', note.includes('Custom sequence'), note.trim());
}

// ── Phase C features ───────────────────────────────────────────────────────
await page.evaluate(() => localStorage.removeItem('critcalc:vizWorkspace'));
await page.goto(`${BASE}/crit-visualizer`, { waitUntil: 'networkidle' });
{
	// Crit: right-edge axis identity + roll-it (variance defaults ON now)
	const svgText = await page.$eval('.cv-heatmap-shell svg', (el) => el.textContent);
	check('right edge labeled AVERAGE DMG', svgText.includes('AVERAGE DMG'));
	check('corner max 4.00x marked', svgText.includes('4.00x'));
	check('no stray avg suffixes', !svgText.includes('x avg'));
	await page.click('.cv-roll button');
	const dots = await page.$$eval('.cv-roll-dot', (els) => els.length);
	check('roll-it samples one dot per hit', dots === 8, String(dots));

	// Gauge (slot 2): area fills + playback
	const fills = await page.$$eval('.gx-graph path[fill^="url(#gx-fill"]', (els) => els.length);
	check('gauge aura fills render', fills >= 1, String(fills));
	await page.click('.gx-play');
	await page.waitForTimeout(700);
	const t1 = await page.$eval('.gx-transport-time', (el) => parseFloat(el.textContent));
	check('playback advances at 1× default', t1 > 0.4 && t1 < 1.4, String(t1));
	const live = await page.$eval('.gx-panels', (el) => el.textContent);
	check('Enemy Status follows playback', /at \d/.test(live), '');
	await page.click('.gx-play'); // pause
	const speeds = await page.$$eval('.gx-transport .chip', (els) =>
		els.map((e) => e.textContent.trim())
	);
	check('speed chips 0.25/0.5/1', JSON.stringify(speeds) === '["0.25×","0.5×","1×"]');
	// paused drag-scrub: click mid-chart moves the playhead
	const box = await page.$eval('.gx-graph svg', (el) => {
		const r = el.getBoundingClientRect();
		return { x: r.x, y: r.y, w: r.width, h: r.height };
	});
	await page.mouse.click(box.x + box.w * 0.6, box.y + box.h * 0.4);
	const t2 = await page.$eval('.gx-transport-time', (el) => parseFloat(el.textContent));
	check('paused click/drag scrubs the playhead', Math.abs(t2 - t1) > 0.5, `${t1} → ${t2}`);
}

// ICD: anchors (ghost-compare feature removed by Nate's call)
await page.goto(`${BASE}/crit-visualizer?i=icd`, { waitUntil: 'networkidle' });
{
	const anchors = await page.$$eval('.icd-anchors .chip', (els) => els.length);
	check('ICD interval anchor chips render', anchors === 3, String(anchors));
	check('ghost-compare feature removed', (await page.$$('.icd-ghost-toggle')).length === 0);
}

// Rolls: Sanctifying Elixir
await page.goto(`${BASE}/crit-visualizer?i=rolls`, { waitUntil: 'networkidle' });
{
	const sources = await page.$$eval('.ar-panels .chip', (els) =>
		els.map((e) => e.textContent.trim())
	);
	check(
		'Sanctifying Elixir listed as a source',
		sources.some((t) => t.includes('Elixir'))
	);
	await page.click('.ar-views .chip:nth-child(2)'); // Upgrade Rolls
	const chips = await page.$$('.ar-panels .chip');
	let crafted = null;
	for (const c of chips) {
		if ((await c.textContent()).includes('Elixir-crafted')) crafted = c;
	}
	check('Elixir-crafted mode chip in Upgrade view', Boolean(crafted));
	await crafted?.click();
	// `.ar-note` retired with the other six per-instrument note copies (→ .note).
	const note = await page.$eval('.ar-frame .note', (el) => el.textContent);
	check('crafted caption states the ≥2 guarantee', note.includes('≥2 guaranteed into the pair'));
}

// DEF & RES instrument
await page.goto(`${BASE}/crit-visualizer?i=defres`, { waitUntil: 'networkidle' });
{
	const names = await visibleTriggers(page);
	check('?i=defres slots Enemy DEF & RES first', names[0] === 'Enemy DEF & RES', names[0]);
	const readout = await page.$eval('.dr-panels', (el) => el.textContent);
	check('RES view defaults to the standard 10% enemy', readout.includes('×0.900'));
	// VV anchor: 40% shred on 10% base → −30% → ×1.15
	await page.$eval('.dr-panels input[aria-label="Resistance shred percent"]', (el) => {
		el.value = '40';
		el.dispatchEvent(new Event('input', { bubbles: true }));
	});
	const after = await page.$eval('.dr-panels', (el) => el.textContent);
	check('below-zero halving: 10% − 40% → ×1.150', after.includes('×1.150'));
	await page.click('.dr-panels .chip:nth-child(2)'); // Enemy DEF view
	const def = await page.$eval('.dr-panels', (el) => el.textContent);
	check('DEF view renders (90 vs 100 baseline)', def.includes('×0.487'));
}

// Wish Odds instrument
await page.goto(`${BASE}/crit-visualizer?i=wish`, { waitUntil: 'networkidle' });
{
	const names = await visibleTriggers(page);
	check('?i=wish slots Wish Odds first', names[0] === 'Wish Odds', names[0]);
	const readout = await page.$eval('.wi-panels', (el) => el.textContent);
	check('wish readout shows chance within pulls', readout.includes('chance within your'));
	// pity 89 + guarantee → the very next pull is certain
	await page.$eval('.wi-panels input[aria-label="Pulls since your last five-star"]', (el) => {
		el.value = '89';
		el.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await page.click('.wi-panels .check .check-box');
	const certain = await page.$eval('.wi-panels', (el) => el.textContent);
	check('pity 89 + guarantee = certain next pull', certain.includes('by 1 pulls'), '');
}

// Damage Anatomy instrument
await page.goto(`${BASE}/crit-visualizer?i=anatomy`, { waitUntil: 'networkidle' });
{
	const names = await visibleTriggers(page);
	check('?i=anatomy slots Damage Anatomy first', names[0] === 'Damage Anatomy', names[0]);
	const frame = await page.$eval('.an-frame', (el) => el.textContent);
	check('direct hit stays relative', frame.includes('vs a bare hit'));
	const terms = await page.$$eval('.an-eq .an-term', (els) => els.length);
	check('direct equation has 5 terms at No Reaction', terms === 5, String(terms));
	const labRows = await page.$$eval('.an-lab-row', (els) => els.length);
	check('stat lab shows roll rows', labRows === 5, String(labRows));
	await page.click('.an-views .chip:nth-child(3)'); // Transformative
	const tFrame = await page.$eval('.an-frame', (el) => el.textContent);
	check('transformative prints exact damage', tFrame.includes('damage, exactly'));
	const tLab = await page.$$eval('.an-lab-row', (els) => els.length);
	check('transformative lab is EM-only', tLab === 1, String(tLab));
}

// Curves: marginal-gain readout
await page.goto(`${BASE}/crit-visualizer?i=curves`, { waitUntil: 'networkidle' });
{
	const gains = await page.$$eval('.rx-gain', (els) => els.map((e) => e.textContent));
	check(
		'marginal-gain lines per curve',
		gains.length >= 2 && gains.every((g) => g.includes('next +50 EM')),
		String(gains.length)
	);
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
