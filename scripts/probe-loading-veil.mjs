/**
 * Probe: abyssal loading veil, site-wide.
 *
 * Asserts the veil's full lifecycle contract (see LoadingVeil.svelte):
 *  1. Present in the served SSR HTML of EVERY surface — landing, content
 *     pages, tools (it moved from the landing page to the scene layout
 *     2026-07-26 so a tool's restored state stops blinking in).
 *  2. On a hard load it paints, then fades out shortly after hydration
 *     (starfield first frame) and is REMOVED from the DOM.
 *  3. On SPA navs — including the hero-card portal into a tool — it never
 *     re-appears.
 *  4. On a tool it holds until the restored content is really on screen, and
 *     clears on the shorter tool floor rather than the scene's ceremony.
 *  5. The horizontal rules hold their pixel math: a 2px line on whole pixels,
 *     sharing one centreline with the caps, overlapping each by exactly 1px,
 *     and faded as a GROUP rather than by translucent parts.
 *  6. With JS blocked, the CSS bail animation clears it on its own.
 *  7. Under prefers-reduced-motion it still dismisses.
 *
 * Usage: node scripts/probe-loading-veil.mjs   (preview server on :4998)
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4998';
const results = [];
const check = (name, ok, detail = '') => {
	results.push({ name, ok, detail });
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
// Dismissal timings, compared across surfaces at the end of section 4.
let sceneGoneAt = Infinity;
let toolGoneAt = Infinity;

// --- 1. SSR HTML scoping ---------------------------------------------------
{
	const landing = await (await fetch(`${BASE}/`)).text();
	check('veil in SSR HTML of /', landing.includes('id="loading-veil"'));
	check('7 glyph paths in SSR HTML', (landing.match(/<path d=/g) ?? []).length >= 7);
	// It now covers every server-rendered surface, not just the landing.
	for (const route of [
		'/rotation-planner',
		'/team-builder',
		'/crit-visualizer',
		'/help',
		'/privacy'
	]) {
		const html = await (await fetch(`${BASE}${route}`)).text();
		check(`veil in SSR HTML of ${route}`, html.includes('id="loading-veil"'));
	}
}

// --- 2. Hard-load lifecycle ------------------------------------------------
{
	const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
	await page.goto(`${BASE}/`, { waitUntil: 'commit' });
	// Sample the veil every 40ms from first commit until it leaves the DOM.
	const timeline = await page.evaluate(
		() =>
			new Promise((resolve) => {
				const t0 = performance.now();
				const samples = [];
				const tick = () => {
					const el = document.getElementById('loading-veil');
					samples.push({
						t: Math.round(performance.now() - t0),
						present: !!el,
						opacity: el ? getComputedStyle(el).opacity : null
					});
					if (!el && samples.length > 1) return resolve(samples);
					if (performance.now() - t0 > 6000) return resolve(samples);
					setTimeout(tick, 40);
				};
				tick();
			})
	);
	const first = timeline[0];
	const gone = timeline.find((s) => !s.present);
	const fading = timeline.some((s) => s.present && s.opacity !== null && +s.opacity < 0.99);
	check('veil present at first sample', first.present, `opacity ${first.opacity}`);
	check('veil fades (intermediate opacity seen)', fading);
	check(
		'veil removed from DOM after fade',
		!!gone,
		gone ? `at ~${gone.t}ms` : 'still present at 6s'
	);
	sceneGoneAt = gone?.t ?? Infinity;

	// --- 3. SPA nav: no veil ------------------------------------------------
	await page.click('a.hero[href="/rotation-planner"]');
	await page.waitForURL('**/rotation-planner');
	await page.waitForTimeout(2500); // let the portal transition land
	// The portal into a tool is an SPA nav — the veil must not gatecrash it.
	check(
		'no veil after the hero-card portal into a tool',
		!(await page.evaluate(() => !!document.getElementById('loading-veil')))
	);
	await page.goBack();
	await page.waitForURL(`${BASE}/`);
	await page.waitForTimeout(1200);
	const veilAfterSpaNav = await page.evaluate(() => !!document.getElementById('loading-veil'));
	check('no veil after SPA nav back to /', !veilAfterSpaNav);

	// Starfield sanity: the canvas is actually animating after all this.
	const starfieldRunning = await page.evaluate(() => {
		const c = document.querySelector('.twinkle canvas');
		return !!c && c.width > 0;
	});
	check('starfield canvas sized after veil flow', starfieldRunning);
	await page.close();
}

// --- 4. Tool hard load: holds until the restored rotation is drawn ----------
{
	const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
	// Seed a saved rotation so there is real restored state to wait for — the
	// blink this whole handshake exists to cover. A fresh profile would restore
	// an empty default and prove nothing.
	await page.addInitScript(() => {
		localStorage.setItem(
			'critcalc:rotationTabs',
			JSON.stringify({
				activeTabId: 'probe',
				tabs: [
					{
						id: 'probe',
						name: 'Probe',
						notation: 'Bennett E Q > Xiangling E Q > Xingqiu E Q',
						manualSlots: null
					}
				]
			})
		);
	});
	await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'commit' });

	// Sample the veil AND whether the saved notation is on screen, so we can
	// prove ordering rather than just timing.
	const timeline = await page.evaluate(
		() =>
			new Promise((resolve) => {
				const t0 = performance.now();
				const samples = [];
				const tick = () => {
					const el = document.getElementById('loading-veil');
					const editor = document.querySelector('.cm-content, textarea');
					samples.push({
						t: Math.round(performance.now() - t0),
						present: !!el,
						restored: !!editor && (editor.textContent ?? editor.value ?? '').includes('Bennett')
					});
					if (!el && samples.length > 1) return resolve(samples);
					if (performance.now() - t0 > 8000) return resolve(samples);
					setTimeout(tick, 40);
				};
				tick();
			})
	);
	const gone = timeline.find((s) => !s.present);
	const lastCovered = [...timeline].reverse().find((s) => s.present);
	check('tool: veil present at first sample', timeline[0].present);
	check('tool: veil removed from DOM', !!gone, gone ? `at ~${gone.t}ms` : 'still present at 8s');
	check(
		'tool: the saved rotation was already on screen before the veil lifted',
		!!lastCovered?.restored,
		`restored=${lastCovered?.restored} at t=${lastCovered?.t}ms`
	);
	toolGoneAt = gone?.t ?? Infinity;
	await page.close();
}

check(
	'tool floor is shorter than the scene ceremony',
	toolGoneAt < sceneGoneAt,
	`tool ~${toolGoneAt}ms vs scene ~${sceneGoneAt}ms`
);

// --- 5. Horizontal rules: the pixel math the look depends on ---------------
{
	const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
	// Scripts blocked so the veil sits still to be measured.
	await page.route('**/_app/immutable/**/*.js', (r) => r.abort());
	await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(500);

	const geo = await page.evaluate(() => {
		const rule = document.querySelector('.rule-top');
		if (!rule) return null;
		const r = (el) => el.getBoundingClientRect();
		const caps = [...rule.querySelectorAll('.rule-cap')].map(r);
		const line = r(rule.querySelector('.rule-line'));
		const word = r(document.querySelector('.word'));
		const bottom = r(document.querySelector('.rule-bottom'));
		return {
			caps: caps.map((c) => ({ x: c.x, y: c.y, w: c.width, h: c.height })),
			line: { x: line.x, y: line.y, w: line.width, h: line.height },
			word: { x: word.x, w: word.width, top: word.top, bottom: word.bottom },
			rule: { x: r(rule).x, w: r(rule).width, bottom: r(rule).bottom },
			gapTop: word.top - r(rule).bottom,
			gapBottom: bottom.top - word.bottom,
			rules: document.querySelectorAll('.rule').length,
			// Group opacity, not per-part alpha: the 1px overlap must composite
			// as one shape or it shows a brighter notch at both joins.
			ruleOpacity: getComputedStyle(rule).opacity,
			capFill: getComputedStyle(rule.querySelector('.rule-cap')).fill
		};
	});

	check('two rules on the veil', geo?.rules === 2, `${geo?.rules}`);
	check('line is exactly 2px tall', geo?.line.h === 2, `${geo?.line.h}px`);
	// The frame belongs to the WORD, not the viewport — same width, same left
	// edge, and evenly spaced above and below it.
	check(
		'rules are exactly as wide as the glyph artwork',
		geo?.rule.w === geo?.word.w && geo?.rule.x === geo?.word.x,
		`rule ${geo?.rule.x}+${geo?.rule.w} vs word ${geo?.word.x}+${geo?.word.w}`
	);
	check(
		'rules sit symmetrically outside the word, clear of the glow',
		geo?.gapTop === geo?.gapBottom && geo?.gapTop >= 24,
		`top ${geo?.gapTop}px / bottom ${geo?.gapBottom}px (glow reaches background at ~24px)`
	);
	// Cap box is 10px with its strand at y 4–6; the 2px line must land there.
	// NOT an integer-y assertion: the mark is centred as a column, so its
	// absolute Y follows the word's fractional height. What must hold is that
	// the parts keep their shared centreline — they shift together or not at
	// all.
	check(
		'caps and line share one centreline',
		geo?.caps.every((c) => c.y + 4 === geo.line.y && c.h === 10),
		`caps=${JSON.stringify(geo?.caps)} line.y=${geo?.line.y}`
	);
	check(
		'line overlaps each cap by exactly 1px (onto the solid strand rect)',
		geo?.line.x === geo?.caps[0].x + geo?.caps[0].w - 1 &&
			geo?.line.x + geo?.line.w === geo?.caps[1].x + 1,
		`line ${geo?.line.x}..${geo?.line.x + geo?.line.w}, caps ${geo?.caps[0].x}+${geo?.caps[0].w} / ${geo?.caps[1].x}`
	);
	check(
		'faintness is a group opacity, parts stay opaque',
		+geo?.ruleOpacity < 1 && !geo?.capFill.includes('rgba'),
		`opacity=${geo?.ruleOpacity} fill=${geo?.capFill}`
	);
	await page.close();
}

// --- 6. JS blocked: CSS bail self-destruct ----------------------------------
{
	const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
	// Abort scripts only — a real failed-chunk scenario still has the (render-
	// blocking) stylesheet, and the bail animation lives there.
	await page.route('**/_app/immutable/**/*.js', (r) => r.abort());
	await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(400);
	const early = await page.evaluate(() => {
		const el = document.getElementById('loading-veil');
		return el ? getComputedStyle(el).visibility : 'missing';
	});
	check('JS-blocked: veil visible before bail', early === 'visible', `visibility=${early}`);
	await page.waitForTimeout(8600); // bail starts at 8s + 600ms fade
	const late = await page.evaluate(
		() => getComputedStyle(document.getElementById('loading-veil')).visibility
	);
	check('JS-blocked: CSS bail hides veil after 8.6s', late === 'hidden', `visibility=${late}`);
	await page.close();
}

// --- 7. Reduced motion: still dismisses -------------------------------------
{
	const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(`${BASE}/`, { waitUntil: 'commit' });
	await page.waitForFunction(() => !document.getElementById('loading-veil'), null, {
		timeout: 6000
	});
	check('reduced motion: veil dismisses', true);
	await page.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
