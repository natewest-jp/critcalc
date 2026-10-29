# The e2e rewrite (step 5a), 2026-10-29

Branch `test/e2e-new-layout`. The first part of step 5 of the redesign (to-do list, Now 1): the browser suite moves from the old layout, which the fixture had pinned with `critcalc:nextLayout = '0'` since the flip, to the layout everyone sees. Nate also asked whether it could run faster and stop hanging.

## The hang: found and fixed

The five-minute stalls were not random on this machine. System Chrome on macOS starts `chrome_crashpad_handler` even under `--disable-breakpad`. The handler detaches from Chrome's process tree (its parent becomes launchd), inherits Chrome's stderr, and outlives Chrome by up to a couple of minutes. Playwright decides a browser has closed when its stdio pipes CLOSE, not when the process exits, so a worker whose Chrome was already gone waited until the runner's watchdog force-killed it after five minutes and failed a green run. The evidence: with `DEBUG=pw:browser`, Playwright's own force-kill of the "stuck" Chrome returned `ESRCH`, because the process no longer existed.

- **Fix:** the `chrome` project runs Playwright's chromium headless shell, which starts no crash handler and closes in ~20 ms (system Chrome: ~1.4 s). The project keeps its name, so the commands are unchanged. Trade-off: Chromium 149 rather than Nate's Chrome 156; real-Chrome checks stay manual, as Safari's always were.
- **Tried and dropped:** the upstream issue's workaround (microsoft/playwright#39753: close with a deadline, then kill the worker's process tree). It cannot reach a handler that has detached, and the run still hung. Eight workers were measured slower than the default five (the machine is CPU-bound).
- **Backstop:** `PWTEST_CHILD_PROCESS_TIMEOUT` is 30 s (was five minutes), set in `playwright.config.ts`.

## Faster runs

|              | Before                             | After                              |
| ------------ | ---------------------------------- | ---------------------------------- |
| Chrome alone | 6.1 min (5 of them hung)           | ~1 min                             |
| Both engines | ~6 min, two builds, two exit codes | ~3.3 min, one build, one exit code |

- `test:e2e` is ONE invocation over both projects (it chained two with `;`, which built twice and left the exit code WebKit's alone). A green run is now ONE "N passed" line.
- `actionTimeout` 10 s and `navigationTimeout` 20 s: a missing element fails in seconds, not at the 60 s test timeout. The first run of the old specs on the new layout spent most of its 7.6 minutes waiting out clicks on selectors that no longer exist.
- Fixed pauses sized for the retired crane are gone (1.4 s per tool pan in four specs, 2.2 s and 0.6 s in the veil's, 3.6 s holds in the star clock's, a 16 s cycle in the storm). The tools now change in place with a 150 ms crossfade, and the specs wait for the address or poll the state instead.
- `openTool` no longer waits for network idle (≥500 ms per load). Every one-shot `expect(await read())` became `expect.poll(...)`: the idle wait had been hiding races, and two surfaced once it went.
- ⚓ **Cadence (Nate 2026-10-29): Chrome after every round, both engines before a merge.** WebKit costs ~1.5 s per cold page load against Chrome's ~0.5 s, measured on the load-only route tests. That ratio is the engine's own and is most of the remaining gap; WebKit at 3 workers vs 5 made no difference.

## The specs, one by one

- **fixture:** the old-layout pin is gone. A seeded browser is a returning visitor (the old keys `seed` writes are what the first load migrates into IndexedDB), so it always gets the returning-visitor dialog. `openTool` and the new `openSection` answer it on arrival, by its buttons. Two cuts failed first: a locator handler (it runs only when an action is blocked, and the dialog's close then moved focus out from under a tap in WebKit), and that handler kept beside the answer (handlers also run inside `waitFor`, so it closed the dialog while the answer waited for it). `openSection` waits for the menu state itself: a section's address SSRs as the old static page and hydration swaps it, so typing into the first paint typed into a box about to be replaced.
- **site-chrome:** rewritten for the top bar and the menu state. It guards §13.4: a section over a tool takes its own address without remounting the tool (the tool is the same element after the round trip), one Escape returns, Back steps between sections, and every section's address also loads cold. Retired with the old chrome: the compass and meta-glyph counts, About's `aria-current`, the `/library` page's tabs, and the overlay-transform check (its ChromeOverlay is unreachable now).
- **loadout-layers → roster-levels:** the two-layer model retired. It now pins `levelOf`'s routing where the reader sees it: an unowned character's bench chip writes the rotation and never the roster; an owned character's opens a Theorycraft what-if paired with it, and the original keeps the roster's level; a roster edit reaches the open rotation live, with no reload. Team loadouts stay in vitest (`teamLoadout.test.ts`, `session.test.ts`).
- **team-builder:** details open the inspector modal (`.im`); New lineup lives in the Library's Lineups section; a `?b=` link opens in Theorycraft named by the sender, and levels are read off the slots' chips; the roster's tests seed a REAL profile (Theorycraft has no roster). Storage reads (localStorage) became reload checks, since the data lives in IndexedDB now.
- **traveler:** the twin is the profile's, set on its Profile page; persistence is proved by a reload.
- **cross-tool, coverage, marks, loading-veil, star-freeze, viz-workspace:** selectors moved to the new surfaces (the inspector pane, the menu state, `.nav-btn`, the tile ⋯ and the Layout plate). Star freeze keeps its invariant (frozen through tool switches, thawed on the descend) but proves a leg by the address now that there is no crane to measure.
- **tool-layers (`@storm`):** retimed for the crossfade (600 ms settles, the interrupt 60 ms in), plus a 1.5 s settle before the final read. At 600 ms Chrome was caught mid-fade with two layers part-visible, fully at rest 500 ms later: a slow settle after a storm, not a stuck layer. Watchdog hits 0 on both engines.

## Found along the way

1. 🐛 ✅ **Escape on the returning-visitor dialog also closed the full-screen section under it** (fixed on `fix/flip-notice-escape`: the dialog's keys moved to the CAPTURE phase and a handled key stops there; both listeners were on the window and the menu state's, mounted first, heard Escape before the dialog could claim it). Seen on `/profile`: one Escape dismissed the dialog AND left the section for `/`. The dialog calls `preventDefault`; the menu state's Escape handler apparently does not check it. A returning visitor whose first load is a section (`/profile`, `/roster`, a shared Library address) loses it.
2. **`ResizeObserver loop completed with undelivered notifications`** surfaced as a WebKit page error arriving in the Builder from the Library's New lineup. It is the browser deferring notifications a frame (Chrome stays quiet), so the fixture lets exactly that message through; any other page error still fails.
3. **Not a bug:** "a board survives a reload" failed once the idle wait went. A reload immediately after an imported team appears keeps it on both engines (the unload journal works); the test was reloading before the import landed.

## Verification

vitest 2626 · check · lint · build. e2e on the final tree: both engines 142 passed in 3.3 min, twice in a row, no flaky test and no hang; Chrome alone (`test:e2e:chrome`, build included) 71 passed in 56 s.
