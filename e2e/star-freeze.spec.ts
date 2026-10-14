import { test, expect } from './fixtures/critcalc';
import type { Page } from '@playwright/test';

/**
 * THE CREST IS ONE REST (⚓ Nate 2026-08-07): the twinkle field freezes on a
 * single frame when a tool leg settles, and stays on THAT frame for as long as
 * you are in the crest tool space — through every tool→tool crane — thawing
 * only on the way back down to the landing.
 *
 * Why a script and not an eyeball, in a suite that otherwise leaves looking to
 * Nate: every star's phase is `fract((starClock + offset) / duration)`, so
 * "frozen on one frame" is exactly "starTime() does not move". That is a
 * numeric equality, not a screenshot diff of a starfield — which would be
 * neither stable nor readable.
 *
 * The bug it pins: stopping the twinkle LOOP is not enough. The camera's own
 * animation loop draws every frame of a crane, so with an absolute clock those
 * draws jump the field to the phase it "should" be at seconds later — Nate:
 * "the stars flash into a different stage of animation".
 */

declare global {
	interface Window {
		__scene?: { starTime(): number; twinkling(): boolean; camera(): { x: number } };
		__starSamples?: { t: number; cx: number; path: string }[];
	}
}

const scene = (page: Page) =>
	page.evaluate(() => {
		const s = window.__scene;
		return s ? { t: s.starTime(), twinkling: s.twinkling(), cam: s.camera() } : null;
	});

/** Sample the star clock every frame across a tool→tool navigation, then settle. */
async function sampleLeg(page: Page, linkText: string, holdMs = 3600) {
	await page.evaluate(() => {
		window.__starSamples = [];
		const rec = () => {
			const s = window.__scene!;
			window.__starSamples!.push({ t: s.starTime(), cx: s.camera().x, path: location.pathname });
			if (window.__starSamples!.length < 400) requestAnimationFrame(rec);
		};
		requestAnimationFrame(rec);
	});
	await page.locator('.chrome-nav a', { hasText: linkText }).click();
	await page.waitForTimeout(holdMs);
	return page.evaluate(() => window.__starSamples!);
}

const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

// One continuous journey — rest, two legs, then the descend — because the
// invariant IS the continuity across them. Splitting it would assert nothing.
test('the star clock holds one frame across every tool leg, and thaws on descend', async ({
	page
}) => {
	test.slow(); // three settle holds plus a descend

	await page.goto('/planner', { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500); // settle + REST_AFTER_SETTLE_MS margin

	const rest0 = await scene(page);
	expect(rest0, 'the scene renderer mounted and exposes the star clock').not.toBeNull();
	expect(rest0!.twinkling, 'at tool rest the twinkle loop is stopped').toBe(false);

	await page.waitForTimeout(900);
	expect((await scene(page))!.t, 'the frozen frame survives idle time').toBe(rest0!.t);

	// ── The crane: the world sweeps, the field does not ──────────────────────
	const toTb = await sampleLeg(page, 'Builder');
	expect(
		spread(toTb.map((s) => s.cx)),
		'the camera actually craned (the test exercised the real thing)'
	).toBeGreaterThan(100);
	expect(spread(toTb.map((s) => s.t)), 'RP→TB: the clock never moves across the leg').toBe(0);

	const afterTb = await scene(page);
	expect(afterTb!.t, 'RP→TB settles on the SAME frame').toBe(rest0!.t);
	expect(afterTb!.twinkling, 'the loop is stopped again after the leg').toBe(false);

	// A second leg, with the opposite pose sign.
	const toViz = await sampleLeg(page, 'Visualizers');
	expect(spread(toViz.map((s) => s.t)), 'TB→Viz: the clock never moves').toBe(0);
	expect((await scene(page))!.t, 'three tools deep, still the same frame').toBe(rest0!.t);

	// ── The descend thaws it — resuming, not jumping ─────────────────────────
	const beforeDescend = await scene(page);
	const wallClockAtPause = await page.evaluate(() => performance.now());
	await page.locator('.chrome-brand, a[href="/"]').first().click();
	await page.waitForTimeout(3200);

	const landed = await scene(page);
	expect(landed!.twinkling, 'back on the landing the twinkle loop runs again').toBe(true);

	const advanced = landed!.t - beforeDescend!.t;
	expect(advanced, 'the descend thaws the clock').toBeGreaterThan(500);
	// The paused span is BANKED, never played back — a pop-free thaw resumes
	// where it froze rather than snapping to where absolute time would put it.
	expect(advanced, 'the thaw resumes rather than jumps').toBeLessThan(
		wallClockAtPause - beforeDescend!.t
	);
});
