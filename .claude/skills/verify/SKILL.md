---
name: verify
description: Build, serve, and drive critcalc in headless Chrome to verify changes at the browser surface. Use when a change needs runtime verification (tools are client-rendered; curl can't exercise them).
---

# Verifying critcalc changes

> ⚠️ **Read CLAUDE.md § Gates and verification first.** Driving a browser is the
> LAST resort, not the first: run `npm run test` / `check` / `lint` / `build`,
> and answer from source or docs where you can. Visual/rendering judgments are
> Nate's eyes, not a script's, and nothing Safari-facing counts as verified
> until he has looked at it in real Safari.

## The suite comes first

Browser-surface checks live in **`e2e/`** and run as `npm run test:e2e`
(Chrome + WebKit). It builds and serves its own preview each run, so it cannot
measure a stale server. Start here — if a behavior you care about is already
covered, run the suite instead of writing anything.

```bash
npm run test:e2e                     # the gate: chrome + webkit, ~2 min
npm run test:e2e:chrome              # faster inner loop
npx playwright test e2e/marks.spec.ts --project=chrome   # one spec
npm run test:e2e:ui                  # pick and step through tests interactively
npm run test:e2e:storm               # the slow cross-engine nav storm (opt-in)
```

**Adding a spec needs Nate's approval** (it is a promotion — see the policy).
When approved, extend `e2e/` using `e2e/fixtures/critcalc.ts`; the three traps
that have cost real time are documented at their site in that file.
`scripts/probe-*.mjs` is a **retired pattern** — 28 of them were deleted on
2026-08-09. Do not recreate it. The one survivor, `probe-ink-centering.mjs`, is
a measuring instrument (it reports numbers), not a pass/fail check.

## One-off investigation

For a question the suite doesn't answer and that doesn't warrant a spec, drive
Playwright inline — `node -e "..."` against a running preview — then report and
move on. Nothing to commit, nothing to clean up.

```bash
npm run build                      # prebuild regenerates newfit + character index
npm run preview -- --port 4998 --strictPort   # serve production build (background)
```

Verify against the **production** build when the change touches bundling or
code-splitting; `npm run dev` is fine for pure behavior changes.

## Headless Chrome handle

```js
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true }); // system Chrome, no download
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:4998/planner', { waitUntil: 'networkidle' });
```

## Headless WebKit (Safari-class bugs)

Safari-only behavior reproduces in Playwright's real WebKit build — this is
how the 2026-07-06 momentum-jerk was root-caused (see `docs/rounds/scene-occlusion-perf.md`):

```bash
npx playwright install webkit   # one-time per machine (shared cache in ~/Library/Caches/ms-playwright)
```

```js
import { webkit } from 'playwright';
const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({
	viewport: { width: 1600, height: 1000 },
	deviceScaleFactor: 2 // retina — paint/raster costs scale 4×; use it for perf work
});
```

Perf probes that worked:

- **Main-thread stall detector:** rAF loop logging gaps >45ms — WebKit stalls
  show up as one gap per scroll-gesture start.
- **Animation-load bisect:** `document.getAnimations().length`, then
  `document.getAnimations().forEach(a => a.cancel())` and re-measure — if
  stalls vanish, live animations are the cause (paused/display:none animations
  still count; only cancel/`animation-name: none` removes them).
- **Who-writes-scrollLeft:** shadow `scrollLeft` with an instance
  `Object.defineProperty` accessor to count programmatic writes onto an
  actively-scrolled element (user/CDP scrolling bypasses the JS setter).
- True trackpad momentum phases can NOT be synthesized headlessly — the stall
  _trigger_ reproduces with plain `mouse.wheel` streams, but final judgment on
  momentum feel needs a real trackpad.
- **Fade-integrity probe** (2026-07-10, tool→tool cross-fade work): rAF loop
  sampling `getComputedStyle(page).opacity` per frame after a nav click, plus
  timestamped >20ms gap logging. A clean paint-gated fade = first painted
  frame at opacity ~0, then a monotonic full-range ramp; truncation shows as a
  first-nonzero sample already mid-ramp, and stutter as gaps INSIDE the fade
  window. Key diagnostic move: if blocks move WHEN the fade start moves, the
  fade itself is causing them (WebKit layerization/raster at transition start
  — fixed by `will-change` pre-promotion + freezing at opacity 0.001, not 0).
- **Seed planner state before perf probes:** `page.addInitScript` writing
  `critcalc:rotationTabs` into a FRESH context, which the first load migrates
  into IndexedDB once (the e2e `seed` fixture does this) — an empty planner misses whole block classes
  (probes on the 2026-07-10 fade work only reproduced the user-visible
  stutter with a saved 4-character rotation).
- **CPU attribution (Chrome only):** CDP `Profiler.start/stop` around the nav
  click (samplingInterval 100µs), then aggregate self/total time per node —
  or bucket samples by 100ms wall-clock windows via `timeDeltas` to attribute
  post-mount blocks. WebKit has no CDP; infer from Chrome + gap timelines.
- **Headless Firefox is functional-only.** Playwright's headless FF renders in
  software (no WebRender compositor): every fade/animation shows 130-260ms rAF
  gaps even on trivial pages. Use it for behavior/DOM assertions; judge FF
  smoothness on real, headed Firefox only.

## Driving the rotation planner

- **Type notation:** `await page.click('.cm-content')` then `page.keyboard.type('Furina E Q > Bennett E Q', { delay: 30 })` — CodeMirror, not a textarea.
- **Slotted names:** `document.querySelectorAll('.rp-char-name')` → the timeline label column's character names (the old `.rcp-name` character panels were pruned 2026-07-19).
- **Autocomplete popup:** `.cm-tooltip-autocomplete li`.
- **Network watch:** `page.on('request', ...)` — character payloads fetch as `/_app/immutable/chunks/*.js` on first reference (lazy loading, 2026-07-06).
- **Persistence probe:** reload the page — the notation comes back from IndexedDB (the storage session autosaves; `critcalc:rotationTabs` is only the migration's input).
- Screenshot the timeline to confirm bars/summon rows/team-buffs render; panel names alone don't prove the Gantt built.

## Gotchas

- Avatar images intentionally 404 on missing `-newfit` assets then fall back
  (`handleAvatarError`) — a single image 404 in the console is by design, not
  a break.
- `npm run lint` passes clean on `main` (as of 2026-07-06) — treat any lint
  failure as caused by the change under test.
- Kill the preview server by port: `lsof -ti:4998 | xargs kill`. **Always
  restart preview after a rebuild** — a server that survives an in-place
  rebuild can keep serving mixed old/new files: pages load (HTML 200) but
  hashed chunks 404, hydration dies silently, and every probe measures an
  unhydrated page. This produced convincingly-wrong numbers (0 animations,
  broken layout) for a whole detour on 2026-07-10 before the chunk 404s were
  spotted. Symptom to watch: `pageerror: Importing a module script failed`.
