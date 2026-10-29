import { test, expect, openTool } from './fixtures/critcalc';

/**
 * CROSS-ENGINE: does the tool→tool orchestration ever leave a page layer
 * mis-set?
 *
 * ⚓ Nate 2026-08-07 (SUPERSEDED — see the dormancy note below, but the
 * cross-engine lesson stands): reproducible in Chrome within seconds; NOT reproducible in
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
 * ⚠ BUG 2 IS DORMANT, NOT FIXED. Both Nate and Claude could provoke it on
 * demand early on; partway through debugging it stopped appearing for either of
 * them, with no change that explains why, and it has not been seen since.
 * Nothing was identified as the fix.
 *
 * Measured 2026-08-09, 6 cycles × 3 engines: watchdog hits = 0 everywhere. That
 * is consistent with dormancy and is NOT evidence of a fix — which is exactly
 * why this file exists. It is a SENTINEL: if the defect resurfaces, this prints
 * the watchdog record automatically, in whichever engines show it, without
 * anyone having to be at a console at the right moment. A green run here means
 * "nothing dirty today", nothing more.
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
		// A cycle is ~2.5s of real-time settles. Run this with `--workers=1`
		// (`npm run test:e2e:storm` does): three headless browsers each driving the
		// GL scene at once starve each other's rAF, and the transitions this test
		// measures then take far longer than their nominal durations — which looks
		// exactly like the bug it hunts.
		test.setTimeout(CYCLES * 10_000 + 60_000);

		await seed({
			team: {
				// The notation IS the team (single truth, 2026-08-13); the seed's
				// `slots` only folds extra names in, so it names none. (It was
				// `null` from the manual-slots era, which the fold can't iterate.)
				slots: [],
				notation: 'Furina E Q > Bennett E Q > Xingqiu E Q > Kazuha E Q',
				label: 'Seed'
			}
		});
		await openTool(page, '/planner');
		await page.waitForTimeout(1000);

		const click = (tool: string) => page.click(`.nav-btn[href*="${tool}"]`);

		// ↻ 2026-10-29 (the flip): tools change IN PLACE, a 150ms crossfade
		// (title-bar round), so the settles shrank from the crane's ~3.5s to
		// 600ms and the interrupt lands 60ms in, inside the fade.
		for (let i = 0; i < CYCLES; i++) {
			// A settled leg each way, then the storm: navigate away and
			// interrupt back mid-flight.
			await click('visualizers');
			await page.waitForTimeout(600);
			await click('planner');
			await page.waitForTimeout(600);
			await click('builder');
			await page.waitForTimeout(600);
			await click('planner');
			await page.waitForTimeout(60); // interrupt mid-transition
			await click('builder');
			await page.waitForTimeout(600);
		}

		// The last switch's fade-out (150ms), mount and fade-in (200ms) can run
		// past the 600ms settle straight after a storm; at 600ms Chrome was
		// measured mid-fade (two layers part-visible), fully at rest 500ms on.
		await page.waitForTimeout(1500);
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
