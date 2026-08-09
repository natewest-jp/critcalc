import { test, expect } from './fixtures/critcalc';

/**
 * CROSS-ENGINE: does the tool→tool orchestration ever leave a page layer
 * mis-set?
 *
 * ⚓ Nate 2026-08-07: reproducible in Chrome within seconds; NOT reproducible in
 * real Safari or Firefox under the most extensive click gymnastics he could
 * manage. This keeps that observation on the record automatically, because the
 * same report was once dismissed as impossible ("the transition math is the
 * same everywhere, so every engine should show it") — which had the evidence
 * exactly backwards. **A defect three engines disagree about IS an engine
 * defect**, and the cross-engine SPLIT is the finding worth preserving.
 *
 * Bug 2 is OPEN in Chrome. So this does NOT fail Chrome — a permanently-red
 * gate teaches everyone to ignore it. Instead it records the hit count as an
 * annotation, and HOLDS THE LINE on the engines that are supposed to be clean:
 * a regression in WebKit or Firefox fails loudly, and that is new information.
 * When Bug 2 closes, delete the `isChrome` branch so Chrome asserts zero too.
 *
 * Tagged @storm: a nav storm takes minutes, so it is opt-in
 * (`npm run test:e2e:storm`) rather than part of the default gate.
 *
 * ⚠ MEASURED 2026-08-09, 6 cycles × 3 engines: watchdog hits = 0 EVERYWHERE,
 * Chrome included. Nate reproduces Bug 2 in real, headed Chrome within seconds,
 * so headless Chrome evidently does not exercise whatever triggers it. Until
 * that changes, a green run here means "no engine is dirty right now" — it is
 * NOT evidence that Bug 2 is fixed, and this file does not yet deliver the
 * automatic cross-engine record it was written for. Judge the bug in a real
 * browser.
 */

declare global {
	interface Window {
		__toolWatchdog?: { hits: number; last: string | null };
	}
}

const CYCLES = Number(process.env.E2E_STORM_CYCLES ?? 6);

test(
	'a tool→tool nav storm leaves no page layer mis-set',
	{ tag: '@storm' },
	async ({ page, seed }, testInfo) => {
		// A cycle is ~16s of real-time settles. Run this with `--workers=1`
		// (`npm run test:e2e:storm` does): three headless browsers each driving the
		// GL scene at once starve each other's rAF, and the transitions this test
		// measures then take far longer than their nominal durations — which looks
		// exactly like the bug it hunts.
		test.setTimeout(CYCLES * 30_000 + 90_000);

		await seed({
			team: {
				slots: null as never, // exercise the derived-slot path, not manual slots
				notation: 'Furina E Q > Bennett E Q > Xingqiu E Q > Kazuha E Q',
				label: 'Seed'
			}
		});
		await page.goto('/rotation-planner', { waitUntil: 'networkidle' });
		await page.waitForTimeout(1000);

		const click = (tool: string) => page.click(`.chrome-nav a[href*="${tool}"]`);

		for (let i = 0; i < CYCLES; i++) {
			// A dockless leg (the ribbon joins the tool surface), settled between —
			// then the storm: navigate away and interrupt back mid-flight.
			await click('crit-visualizer');
			await page.waitForTimeout(4600);
			await click('rotation-planner');
			await page.waitForTimeout(3400);
			await click('team-builder');
			await page.waitForTimeout(3600);
			await click('rotation-planner');
			await page.waitForTimeout(1100); // interrupt mid-transition
			await click('team-builder');
			await page.waitForTimeout(3600);
		}

		const result = await page.evaluate(() => ({
			hits: window.__toolWatchdog?.hits ?? null,
			last: window.__toolWatchdog?.last ?? null,
			layers: [...document.querySelectorAll('.tool-main > .tool-page')].map(
				(p) => `${(p as HTMLElement).dataset.page}@${getComputedStyle(p).opacity}`
			)
		}));

		expect(result.hits, 'the stale-layer watchdog is installed').not.toBeNull();

		// The cross-engine SPLIT is the finding, so print it in the default
		// reporter rather than burying it in the HTML report — this line is the
		// record.
		const record = `[${testInfo.project.name}] watchdog hits = ${result.hits}${
			result.last ? ` — ${result.last}` : ''
		} | at rest: ${result.layers.join(' ')}`;
		console.log(`    ${record}`);
		testInfo.annotations.push({ type: 'watchdog', description: record });

		// Exactly one layer is visible once everything settles — true in every
		// engine, Bug 2 or not.
		const visible = result.layers.filter((l) => !l.endsWith('@0'));
		expect(visible, `layers at rest: ${result.layers.join(' ')}`).toHaveLength(1);

		if (testInfo.project.name === 'chrome') {
			// Known-open Chrome-only defect — recorded above, deliberately not failed.
			test.info().annotations.push({
				type: 'known-issue',
				description: 'Bug 2 (Chrome-only mis-set layer) is open; hits are recorded, not asserted'
			});
		} else {
			expect(result.hits, `${testInfo.project.name} must stay clean`).toBe(0);
		}
	}
);
