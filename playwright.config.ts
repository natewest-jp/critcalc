import { defineConfig, devices } from '@playwright/test';

/**
 * The browser-surface harness (2026-08-09).
 *
 * Replaces the hand-run `scripts/probe-*.mjs` era: the checks that earned
 * promotion under CLAUDE.md § Verification Policy live in `e2e/` and run as one
 * command. Anything NOT promoted does not belong here — see that policy before
 * adding a spec.
 *
 * Two things are deliberate and load-bearing:
 *
 * 1. `reuseExistingServer: false`. A preview server that survives an in-place
 *    rebuild keeps serving mixed old/new files: pages return 200 but hashed
 *    chunks 404, hydration dies silently, and every assertion then measures an
 *    unhydrated page. That produced convincingly-wrong numbers for a whole
 *    detour on 2026-07-10. A build is ~7s; correctness is worth it. If port
 *    4998 is already taken, this FAILS rather than quietly trusting it — that
 *    is the point. (`E2E_REUSE=1` opts out while iterating on a spec.)
 *
 * 2. The production build is the gate, never dev. `npm run dev` skips the
 *    prebuild generators and serves unbundled modules, so code-splitting and
 *    prerender bugs — the class that has actually bitten this project — cannot
 *    appear there.
 */

const PORT = 4998;
const reuse = process.env.E2E_REUSE === '1';
/** The desk width the tools are designed against — two Visualizer slots fit. */
const VIEWPORT = { width: 1600, height: 1000 };

export default defineConfig({
	testDir: 'e2e',
	// Specs are independent by construction: each seeds its own localStorage and
	// navigates fresh, so a failure is debuggable on its own.
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// One retry keeps the known intermittent transition flake from reading as a
	// regression, while still reporting it as "flaky" rather than hiding it.
	retries: 1,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
	timeout: 60_000,
	expect: { timeout: 10_000 },

	use: {
		baseURL: `http://localhost:${PORT}`,
		viewport: VIEWPORT,
		trace: 'retain-on-failure',
		video: 'off',
		screenshot: 'off'
	},

	/**
	 * ⚠ `devices[...]` carries its OWN viewport (1280×720), and a project's `use`
	 * beats the global one — so spreading a device last silently shrinks every
	 * test. That cost a debugging round: the Visualizers show ONE slot at 1280px,
	 * so the lineup specs failed against a layout that was never wrong. VIEWPORT
	 * GOES AFTER THE SPREAD, always.
	 *
	 * `npm run test:e2e` chains chrome then webkit as SEPARATE invocations, joined
	 * by `;` and NOT `&&` — the teardown flake below makes a fully-green Chrome
	 * run exit 1, and `&&` would then skip WebKit entirely. Both engines must
	 * always report.
	 *
	 * 🐛 UPSTREAM, NOT OURS — intermittent worker-teardown hang. Every test
	 * passes, then some workers fail to exit; Playwright waits out its full
	 * 5-minute force-kill timeout and the process exits 1. Clean run ~2.5 min,
	 * hung one ~5.6.
	 *
	 * Root cause: Chrome occasionally does not exit after Playwright sends
	 * `Browser.close` over CDP, so the worker's connection stays open. That is a
	 * Chrome shutdown bug surfacing through the runner —
	 * https://github.com/microsoft/playwright/issues/39753 — and as of 1.62.1
	 * NO released version contains a fix (we are on 1.61.1; upgrading does not
	 * help). It is per-browser-close probability, which is why it only showed up
	 * once the suite passed ~60 tests, and why it lands on Chrome far more than
	 * WebKit.
	 *
	 * ⚠ DO NOT BISECT OUR SPECS FOR THIS. It is random, so a single clean run
	 * "confirms" whatever you just changed — that produced three false fixes
	 * (chrome-only, the `request` fixture, tracing) before the cause was found by
	 * simply reading the upstream issue. The tests are trustworthy; the EXIT CODE
	 * is not, so read the "N passed" line rather than `$?`.
	 */
	projects: [
		{
			// System Chrome, not bundled Chromium — no per-machine binary download,
			// and it is the engine Nate develops against.
			name: 'chrome',
			use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: VIEWPORT }
		},
		{
			// Catches Safari-class THROWN errors only. It does NOT stand in for a
			// real-Safari pass on rendering or performance — see the policy.
			name: 'webkit',
			use: { ...devices['Desktop Safari'], viewport: VIEWPORT }
		},
		{
			// Opt-in third engine for cross-engine questions. Headless Firefox
			// renders in software here, so it is functional-only: never judge
			// smoothness or timing from it.
			name: 'firefox',
			use: { ...devices['Desktop Firefox'], viewport: VIEWPORT }
		}
	],

	webServer: {
		command: reuse
			? `npm run preview -- --port ${PORT} --strictPort`
			: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
		port: PORT,
		reuseExistingServer: reuse,
		timeout: 180_000,
		stdout: 'ignore',
		stderr: 'pipe'
	}
});
