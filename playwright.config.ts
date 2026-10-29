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
/** The runner's force-kill deadline for a worker that will not stop (read
 *  from the environment at stop time; its default is five minutes). A
 *  healthy worker stops in about a second. */
process.env.PWTEST_CHILD_PROCESS_TIMEOUT ??= '30000';
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
		// A missing element fails in seconds, not at the 60s test timeout: the
		// flip's first run of the old specs spent most of its 7.6 min waiting
		// out clicks on selectors that no longer exist.
		actionTimeout: 10_000,
		navigationTimeout: 20_000,
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
	 * `npm run test:e2e` runs both engines in ONE invocation, so one build
	 * serves both and the workers share the whole queue. (It used to chain two
	 * invocations with `;`, which built twice and made the exit code webkit's
	 * alone.)
	 *
	 * 🐛 UPSTREAM, NOT OURS: the worker-teardown hang. Chrome occasionally does
	 * not exit after Playwright sends `Browser.close`, the worker waits on it
	 * forever, and the runner's watchdog force-kills the worker after FIVE
	 * MINUTES and fails the run with every test green
	 * (https://github.com/microsoft/playwright/issues/39753, closed by adding
	 * that watchdog; the hang itself is unfixed). It is per-browser-close, so it
	 * grew with the suite. The baseline on 2026-10-29 hit it: 6.1 min, 5 of
	 * them waiting.
	 *
	 * ✅ FOUND AND FIXED 2026-10-29: on this machine it was not random at all.
	 * System Chrome's crash handler held the worker's pipe open (see the
	 * chrome project below), so the suite now runs Playwright's headless
	 * shell. The watchdog is cut to 30s (`PWTEST_CHILD_PROCESS_TIMEOUT` above)
	 * as a backstop for any other way a worker could stall.
	 *
	 * ⚠ DO NOT BISECT OUR SPECS FOR THIS. It is random, so a single clean run
	 * "confirms" whatever you just changed. That produced three false fixes
	 * (chrome-only, the `request` fixture, tracing) before the cause was found
	 * by reading the upstream issue.
	 */
	projects: [
		{
			// Playwright's own headless shell, not system Chrome (2026-10-29). On
			// macOS system Chrome starts `chrome_crashpad_handler` even under
			// `--disable-breakpad`; the handler detaches from Chrome's process
			// tree, inherits its stderr, and outlives it by up to minutes.
			// Playwright waits for the pipe to CLOSE, not for the process to
			// exit, so the worker hung until the watchdog killed it: that was
			// the teardown hang. The headless shell starts no handler and closes
			// in ~20ms (system Chrome ~1.4s). The project keeps its name so the
			// commands stay the same.
			name: 'chrome',
			use: { ...devices['Desktop Chrome'], viewport: VIEWPORT }
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
