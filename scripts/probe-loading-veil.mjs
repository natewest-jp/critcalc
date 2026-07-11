/**
 * Probe: abyssal loading veil on hard loads of `/`.
 *
 * Asserts the veil's full lifecycle contract (see LoadingVeil.svelte):
 *  1. Present in the served SSR HTML of `/`; absent from tool documents.
 *  2. On a hard load it paints, then fades out shortly after hydration
 *     (starfield first frame) and is REMOVED from the DOM.
 *  3. On SPA navs back to `/` it never re-appears.
 *  4. With JS blocked, the CSS bail animation clears it on its own.
 *  5. Under prefers-reduced-motion it still dismisses.
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

// --- 1. SSR HTML scoping ---------------------------------------------------
{
	const landing = await (await fetch(`${BASE}/`)).text();
	const tool = await (await fetch(`${BASE}/rotation-planner`)).text();
	check('veil in SSR HTML of /', landing.includes('id="loading-veil"'));
	check('7 glyph paths in SSR HTML', (landing.match(/<path d=/g) ?? []).length >= 7);
	check('veil absent from tool SSR HTML', !tool.includes('loading-veil'));
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

	// --- 3. SPA nav: no veil ------------------------------------------------
	await page.click('a.hero[href="/rotation-planner"]');
	await page.waitForURL('**/rotation-planner');
	await page.waitForTimeout(2500); // let the portal transition land
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

// --- 4. JS blocked: CSS bail self-destruct ----------------------------------
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

// --- 5. Reduced motion: still dismisses -------------------------------------
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
