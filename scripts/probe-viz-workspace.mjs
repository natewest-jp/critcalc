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

// Tiles keep registry DOM order and place visually via CSS `order` — sort by
// the slot order so names[] reads left→right as the user sees it.
const visibleTriggers = (page) =>
	page.$$eval('.ws-tile:not(.ws-hidden)', (tiles) =>
		tiles
			.map((t) => ({
				order: Number(t.style.order ?? 0),
				name: t.querySelector('.ip-trigger').textContent.trim().replace(/\s*▾$/, '')
			}))
			.sort((a, b) => a.order - b.order)
			.map((t) => t.name)
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
	const share = await page.$$('.ws-share');
	check('share buttons render on handle-capable tiles', share.length === 2);
}

// ── 2. Picker: open, swap semantics ────────────────────────────────────────
{
	await page.click('.ws-tile:not(.ws-hidden) .ip-trigger'); // slot 0 picker
	const optCount = await page.$$eval('.ip-menu .ip-option', (els) => els.length);
	check('picker lists all five instruments', optCount === 5, String(optCount));
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
	await page.click('.ws-reset');
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
	const note = await page.$eval('.gx-note', (el) => el.textContent);
	check('gauge shows the custom-sequence note', note.includes('Custom sequence'), note.trim());
}

// ── Phase C features ───────────────────────────────────────────────────────
await page.evaluate(() => localStorage.removeItem('critcalc:vizWorkspace'));
await page.goto(`${BASE}/crit-visualizer`, { waitUntil: 'networkidle' });
{
	// Crit: color legend + roll-it
	const legend = await page.$eval('.cv-heatmap-shell svg', (el) => el.textContent);
	check('heatmap color legend labeled 1.0x–4.0x', legend.includes('4.0x average damage'));
	check('isoline labels read as averages', legend.includes('x avg'));
	await page.click('.cv-variance-toggle:nth-of-type(2) input'); // unlucky-rotation shading
	await page.click('.cv-roll button');
	const dots = await page.$$eval('.cv-roll-dot', (els) => els.length);
	check('roll-it samples one dot per hit', dots === 8, String(dots));

	// Gauge (slot 2): area fills + playback
	const fills = await page.$$eval('.gx-graph path[fill^="url(#gx-fill"]', (els) => els.length);
	check('gauge aura fills render', fills >= 1, String(fills));
	await page.click('.gx-play');
	await page.waitForTimeout(700);
	const t1 = await page.$eval('.gx-transport-time', (el) => parseFloat(el.textContent));
	check('playback advances the playhead', t1 > 0 && t1 < 1, String(t1));
	await page.click('.gx-play');
	const speeds = await page.$$eval('.gx-transport .vz-chip', (els) =>
		els.map((e) => e.textContent.trim())
	);
	check('speed chips 0.25/0.5/1', JSON.stringify(speeds) === '["0.25×","0.5×","1×"]');
}

// ICD: anchors + no-ICD ghost
await page.goto(`${BASE}/crit-visualizer?i=icd`, { waitUntil: 'networkidle' });
{
	const anchors = await page.$$eval('.icd-anchors .vz-chip', (els) => els.length);
	check('ICD interval anchor chips render', anchors === 3, String(anchors));
	await page.click('.icd-ghost-toggle input');
	const svg = await page.$eval('.icd-graph svg', (el) => el.textContent);
	check('ghost lane labeled', svg.includes('if no ICD'));
	const readout = await page.$eval('.icd-panels', (el) => el.textContent);
	check('ghost delta in readout', readout.includes('No ICD would add'));
}

// Rolls: Sanctifying Elixir
await page.goto(`${BASE}/crit-visualizer?i=rolls`, { waitUntil: 'networkidle' });
{
	const sources = await page.$$eval('.ar-panels .vz-chip', (els) =>
		els.map((e) => e.textContent.trim())
	);
	check(
		'Sanctifying Elixir listed as a source',
		sources.some((t) => t.includes('Elixir'))
	);
	await page.click('.ar-views .vz-chip:nth-child(2)'); // Upgrade Rolls
	const chips = await page.$$('.ar-panels .vz-chip');
	let crafted = null;
	for (const c of chips) {
		if ((await c.textContent()).includes('Elixir-crafted')) crafted = c;
	}
	check('Elixir-crafted mode chip in Upgrade view', Boolean(crafted));
	await crafted?.click();
	const note = await page.$eval('.ar-frame .ar-note', (el) => el.textContent);
	check('crafted caption states the ≥2 guarantee', note.includes('≥2 guaranteed into the pair'));
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
