# Site-wide performance audit — 2026-07-10 (L2)

> **📦 ARCHIVAL (2026-07-15).** The L2 audit is COMPLETE — all green-light fixes shipped
> (WebGL starfield `53fbb0e`, planner SSR fix `33634d5`, WebGL Dire border `f0c183d`,
> scene visibility-hidden `6e36381`, abyssal loading veil `aa9347f`). This dated report is
> kept for its findings + reproduction recipes. Summary: `docs/archive/perf-audit-2026-07-10.md`.

Scope: whole site under throttled CPU/network, both engines, launch-gate framing
("performs well on modest hardware, not just a strong machine"). Method: production
build served locally; headless Chrome (CDP CPU throttle 4×/6×, fast-3G/slow-3G
network emulation, sampling profiler, LayerTree census) + headless WebKit
(deviceScaleFactor 2). Harness scripts preserved in the session scratchpad and
recipes noted at the bottom; all numbers reproduce with `.claude/skills/verify/SKILL.md`
patterns.

**Caveats:** headless WebKit approximates Safari (no real-GPU raster, no CDP —
layer/throttle numbers are Chrome-only; WebKit shares the architecture so deltas
carry, absolute MB won't). Layer memory is estimated as w×h×4B×dsf² — an upper
bound (engines tile + cull); treat the _deltas_ as the signal. Anything marked
⚠️ needs on-device Safari confirmation.

---

## Baseline numbers

### Cold load per route (Chrome; LCP/TBT in ms)

| Route                  | 1×/no-throttle LCP | 4×/fast-3G LCP                      | 4× TBT | 6×/slow-3G LCP  | 6× TBT | worst task |
| ---------------------- | ------------------ | ----------------------------------- | ------ | --------------- | ------ | ---------- |
| `/` (landing)          | 348                | 2,156                               | 657    | 6,556           | 1,780  | 542ms      |
| `/crit-visualizer`     | 260                | 2,340                               | 471    | 8,312           | 897    | 562ms      |
| `/rotation-planner`    | 408                | **2,996 (first paint of ANYTHING)** | 557    | **8,404 blank** | —      | 575ms      |
| `/team-builder` (stub) | 220                | 2,236                               | 146    | 8,084           | 346    | 283ms      |
| `/about`, `/settings`  | 60                 | ~670                                | ~40    | ~1,810          | ~95    | 140ms      |

### Bundle (client JS, minified; gz in parens where measured)

| Chunk                  | Size                    | What's inside                                                                                                                                                                        |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| planner `nodes/7`      | **432.6KB** (~150KB gz) | **CodeMirror 287KB (67%)**: view 155 + state 45 + autocomplete 26 + commands 22 + lezer 25 + language 14. App code ~145KB (RotationTimeline 30.5, parser 24, timeline pipelines ~25) |
| scene layout `nodes/2` | **148.5KB**             | **`stars.ts` = 140KB (95%)** — 1,400 star literals; parsed on EVERY route cold load                                                                                                  |
| crit-viz `nodes/6`     | 92KB                    | all five instruments, one chunk                                                                                                                                                      |
| entry+shared           | ~100KB                  | framework, router                                                                                                                                                                    |
| total JS               | 2.16MB / 162 files      | ~1.4MB is lazy character chunks (already code-split ✅)                                                                                                                              |

### Prerendered HTML (uncompressed / gz)

`/` 275KB / 31.6KB · `/crit-visualizer` 358KB / 49.6KB · `/team-builder` 285KB /
32.8KB · `/rotation-planner` **1.5KB** (ssr=false) · utility ~7KB. The 1,400
SSR'd star `<span>`s are ~250KB of every (scene) route's HTML; wire cost is fine
(gz), but parse/style/hydrate of ~1,400 extra nodes is the real cost (profiler:
throttled cold-load long tasks are dominated by `(program)` = HTML parse +
style/layout + JS parse, not app JS execution).

### Compositor layers (Chrome, 1600×1000 @dsf 2; est. upper bound)

| Route               | layers    | est. total | notable                                                                             |
| ------------------- | --------- | ---------- | ----------------------------------------------------------------------------------- |
| `/`                 | **1,415** | ~320MB     | one layer per twinkle star (animated opacity ⇒ promoted); 1,400 live CSS animations |
| `/crit-visualizer`  | 36        | ~522MB     | `.tool-main` 32MB layer with **paints=272 in ~2.5s** (continuous repaint, see F6)   |
| `/rotation-planner` | 37        | ~516MB     | scene + Dire + two `rp-track-scroll` (14.4+13.1MB)                                  |

Occlusion experiment on `/rotation-planner` (styles injected, then re-census):
baseline **511MB** → scene hidden **348MB (−163MB)** → Dire border hidden
**388MB (−123MB)**. Painted scene textures behind every tool: sky-bg 25.9 +
sky 24.6 + twinkle 24.5 + floor 14.8 ≈ **90MB real**, plus container layers.
Dire border: 6 wave strips (8.8×3 + 7.7×3 = 49.5MB) + noise-scroll 19.5 +
halftone 7.3 + container 24.4 ≈ **100MB**, 7 always-running animations.

### Navigation (rAF max gap during tool→tool)

|               | Chrome 1× | Chrome 4× | WebKit 1×        |
| ------------- | --------- | --------- | ---------------- |
| viz → planner | 115ms     | **486ms** | **306ms** (+112) |
| planner → viz | 94ms      | 345ms     | 104ms            |
| viz → teams   | 28ms      | 72ms      | 23ms             |

(Blocks are visually masked by the shipped paint-gated fade — the old page holds —
but the machine is pinned for that long; on 4× hardware the "hold" is a half-second.)

### Scroll & session

Tool-route scroll: **0 gaps** both engines (the twinkle suspension works; live
animations on tool routes = 7–9, all Dire/vz). Landing scroll-gesture: WebKit max
gap 62ms with 1,400 live animations (landing doesn't scroll, so low stakes).
Session memory: JS heap 6.5 → 20.8MB over 8 navigations (character-chunk caching,
no DOM/animation leak; node/animation counts return to baseline). Not a concern.

---

## Ranked findings

### F1 — Planner cold load is a black screen (worst number in the audit)

- **Evidence:** first contentful paint of _anything_ at 3.0s on 4×/fast-3G, **8.4s
  on 6×/slow-3G** (interactive at 8.8s). Every other route paints the scene at
  ~0.8–2.5s under the same throttle. Cause: `ssr = false` prerenders an empty
  shell; scene, chrome, and Dire border are all client-JS-gated.
- **Fix:** the already-planned SSR fix (gate localStorage behind `browser`,
  audit CodeMirror/ResizeObserver) so the scene shell + chrome SSR like every
  other route.
- **Impact:** first paint ~8.4s → ~2.5s on the worst case; planner cold-share links
  stop looking broken. **Cost:** half-to-full session (already scoped).
  **Risk:** low-medium (hydration-mismatch class).
- **Disposition:** folded into L1 redesign per roadmap — but it's independent and
  the single biggest UX cliff; worth pulling forward if L1 slips. F2 (below)
  shrinks what the planner needs before interactive, which compounds with this.

### F2 — CodeMirror is 67% of the planner chunk ✅ IMPLEMENTED (green-light)

- **Evidence:** 287KB of the 432KB `nodes/7` is @codemirror/@lezer. Profile
  attribution: the nav-to-planner block is chunk parse/compile (`(program)`),
  ~20ms Svelte flush. Nav block 486ms @Chrome-4×, 306ms @WebKit-1×.
- **Fix:** dynamic-import the editor module post-mount; the notation area renders
  the same box with the raw notation text (same font/metrics) until the editor
  lands, then swaps in place. CodeMirror becomes its own lazy chunk, off the
  navigation critical path; survives the redesign (build-level).
- **Impact (measured):** route-critical JS −69%; planner cold-load first paint
  −26% on slow-3G. The _nav_ block turned out NOT to shrink — see "Honest
  negatives" in the results section (parse was already off-main-thread; the
  block is instantiation + style/layout). **Risk:** low (editor interactive a
  beat later behind an identical-metrics placeholder; prewarm + settle-gate
  already tolerate late work).

### F3 — `stars.ts` ships 140KB of JS on every route ✅ IMPLEMENTED (green-light)

- **Evidence:** 95% of the scene-layout chunk (`nodes/2`, 148.5KB) is 1,400
  verbose object literals; the scene layout is on the critical path of `/` and
  all three tools. All values are fixed 2-decimal — losslessly packable.
- **Fix:** pack to fixed-width base-36 string (16 chars/star ≈ 23KB) + ~1KB
  decoder; update `scripts/generate-stars.js` to emit the same format. Decode is
  O(1400) int parses ≈ 1ms. Byte-identical star values ⇒ pixel-identical.
- **Impact:** −~117KB minified (−~80% of the scene chunk) parse/compile on every
  cold load. **Risk:** very low (decoder is trivially testable against old data).

### F4 — The scene stays fully rasterized behind every tool (the architectural question)

- **Evidence:** ~90MB of painted scene textures (plus containers; est. −163MB when
  hidden) alive under an opaque tool shell on every tool route, both engines'
  architecture. Animations are already suspended (scroll probes clean) — this is
  _memory + raster residency_, and on low-RAM/integrated-GPU machines it's the
  difference between staying resident and texture-eviction churn (the Safari
  eviction-flash class from the Dire-border work).
- **Options considered:**
  1. **Route-derived `visibility: hidden` on `.scene` + `.dim` while a tool route
     is settled** (recommended). Unpainted subtrees release their layer textures;
     DOM, WAAPI state, and SSR persistence all stay. Restore under the portal's
     black cover (return-to-landing) — the same windows the twinkle suspension
     already derives. One-time re-raster on return happens while covered.
     Pixel-neutral while occluded (tool shell is opaque). ⚠️ verify texture
     release + seamless return on real Safari.
  2. `content-visibility: hidden` — same effect + skips style/layout of the
     subtree; newer (Safari 18+). Option 1 is sufficient and older-Safari-safe.
  3. Truly unmount the scene on tool routes — also frees DOM/heap, but fights the
     SSR-persistence architecture (cold-load rest-state snapshot, layer
     registration, mid-transition mounts) for maybe 10–20MB more. Not worth it.
  4. Snapshot-to-poster — strictly worse than 1 (adds a capture step, same result).
- **Impact:** −90–160MB GPU residency on every tool route. **Cost:** small
  (a derived class + careful transition windows). **Risk:** transition-window
  edge cases (mid-portal navigation, browser back/forward).
- **Disposition:** needs-Nate-decision (architectural) — recommend option 1;
  happy to implement + fadeprobe/portal-matrix verify next session.

### F5 — Dire border: ~100MB of wave/noise textures + 7 always-on animations per tool route

- **Evidence:** layer census above; ~half the est. tool-route layer memory. Already
  tuned once (tile-w 220→130vw). It IS the theme — this is a knobs conversation,
  not a bug.
- **Options (all visual, Nate's call):** drop to 2 waves/edge (−~16MB, −2 anims);
  shrink `--dire-tile-w` further (memory ∝ tile-w²); pause wave animations during
  active scroll (twinkle-suspend pattern; kills the residual Safari judder risk
  with zero visual cost _while scrolling_); halve the noise tile (600px → 300px
  loop, −~10MB).
- **Disposition:** needs-Nate-decision. Numbers provided; no change shipped.

### F6 — `.vz-anim-frame` conic border repaints a 32MB layer continuously on crit-viz

- **Evidence:** `.tool-main` on `/crit-visualizer` shows paints=272 in ~2.5s
  (~100+/s) at rest — the animated `--vz-angle` conic invalidates paint every
  frame, forever, and the dirtied tiles live in the full-page 32MB layer. Main
  thread stays clean (earlier WebKit probe), but it's continuous raster burn —
  battery + low-end GPU cost, invisible on strong hardware.
- **Fix options:** (a) `steps()`/coarser keyframes to update the angle at ~8–12Hz
  instead of every frame — cuts raster ticks ~5–8×; on a 12s blurred gradient
  sweep this is likely imperceptible, but it is technically a visual change;
  (b) accept (it's one dirty rect per frame per visible frame).
- **Disposition:** needs-Nate-decision (a) — recommend trying 10Hz on-device.
  Also a **redesign guardrail:** the planner redesign adopts this language —
  don't multiply per-frame-painting borders across a busier page.

### F7 — Landing: 1,400 star spans = 1,400 layers, 1,400 animations, 250KB HTML/route

- **Evidence:** layer count 1,415 on `/`; TBT 1.78s @6× (worst task 542ms —
  `(program)`: parse/style/hydrate of the field); every (scene) route carries the
  spans in HTML. On weak GPUs, 1,400 tiny animated layers are per-frame compositor
  overhead (Chrome promotes each animated-opacity element).
- **Options (visual/structural, staged only):** SSR only the ~400 brightest stars
  and client-fill the rest post-hydration (progressive twinkle-in); animate a
  subset (e.g. 50%) and leave dim stars static; longer-term, a single-canvas
  starfield (rewrite; loses the CSS/compositor design deliberately chosen).
- **Disposition:** F3 (shipped) removes the JS-parse half. The DOM/animation
  count is a Nate conversation — the landing is shipped and verified good on his
  hardware; this is purely a modest-hardware hedge. defer/needs-Nate.

### F8 — Crit-viz SSRs + hydrates all five instruments ✅ IMPLEMENTED (green-light)

- **Evidence:** 358KB HTML; TBT 897ms @6× vs 346ms for the scene-only stub
  (delta ≈ instrument hydration + 92KB chunk); LCP 8.3s @6×/slow-3G. SSR renders
  slotCount=1 (vw=0), so benched instruments are `display:none` in the initial
  paint anyway.
- **Fix:** mount instruments on first slot-in (keep-alive after — the existing
  "state survives swaps" model is unchanged; pre-first-mount there is no state to
  lose). SSR then emits only the crit instrument; benched ones hydrate nothing.
  Pixel-identical first paint.
- **Impact:** −4 instrument instantiations + ~68KB HTML on cold load; first
  swap-in of a benched instrument mounts it (imperceptible — they mount in <10ms
  unthrottled). **Risk:** low.

### F9 — Fonts are discovered late (no preload) ✅ IMPLEMENTED (green-light)

- **Evidence:** ~127KB woff2 (Bitter latin + Commit Mono 400/600) referenced only
  from bundled CSS ⇒ download starts after CSS parses; `font-display: swap`
  means visible font-swap flash late in a 3G load.
- **Fix:** `<link rel="preload" as="font">` for the three latin woff2 files via
  `?url` imports in the root layout head. **Impact:** fonts start with the HTML;
  several hundred ms earlier settle on 3G, smaller FOUT window. **Risk:** ~zero
  (preloading exactly the files the CSS will request).

### F10 — Shooting stars keep firing behind tools ✅ IMPLEMENTED (green-light)

- **Evidence:** scheduler pauses only on `document.hidden`; on tool routes it
  appends a node + runs a WAAPI animation every 5–30s, fully occluded (invisible
  work + one more live animation in Safari's gesture-start sync set).
- **Fix:** same route-derived suspension as TwinkleStars. **Risk:** ~zero.

### F11 — Notes, no action

- Session JS heap 6.5→20.8MB over 8 navs = character-chunk/module caching, by
  design; DOM and animation counts return to baseline. Fine.
- `/about`+`/settings` are healthy (LCP 1.8s @6×/slow-3G).
- Scroll-gesture suspension (2026-07-06 fix) verified still clean on both engines.
- Cross-fade architecture (paint-gate + will-change pre-promote + 0.001 epsilon +
  settle-gate) re-confirmed sound; the two transient ~25MB fade layers are
  time-bounded and cleared post-fade — leave as-is. A single-layer fade variant
  was considered and rejected: pages are transparent over the Dire border, so a
  true dissolve needs both layers.
- Landing image pipeline is good (avif/webp tiers, fetchpriority=high, correct
  srcset picks). slow-3G LCP is bandwidth-bound, not a defect.

---

## Results — before → after (same harness, same configs)

Green-light set shipped in this pass: F2 (CodeMirror lazy), F3 (stars packing),
F8 (lazy instruments), F9 (font preload), F10 (meteor suspension). Staged for
Nate: F4 (scene visibility — recommend yes), F5 knobs, F6 steps(), F7 star-count,
F1 sequencing (pull SSR fix forward vs. ride L1).

### Bundle

- Scene layout chunk: **148.5KB → 30.7KB (−79%)** — parsed on every route.
- Planner route-critical JS: **432.6KB → ~134KB (−69%)**; CodeMirror is now a
  296KB dynamic-only chunk fetched after the planner paints.
- `src/lib/stars.ts` source: 178KB → 26KB; regeneration verified byte-identical
  (same seed → identical packed output; decoded values string-identical to the
  old literals).

### Cold load (Chrome)

| Route @config            | LCP before           | LCP after                   | notes                                                                                                                                                            |
| ------------------------ | -------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| planner @6×/slow-3G      | first paint **8.4s** | first paint **6.2s (−26%)** | editor (CM chunk) now enhances in later — `.cm-content` at ~13.9s vs 8.8s; the page is visible + timeline usable much sooner, editor swap is placeholder-covered |
| planner @4×/fast-3G      | FCP 3.06s            | FCP 2.57s                   |                                                                                                                                                                  |
| crit-viz @6×/slow-3G     | 8.31s / TBT 897      | **6.96s** / TBT 777         | lazy instruments: only 2 of 5 hydrate                                                                                                                            |
| team-builder @6×/slow-3G | 8.08s                | **6.34s**                   | pure scene-chunk win                                                                                                                                             |
| landing @6×/slow-3G      | 6.56s                | 6.26s                       |                                                                                                                                                                  |
| landing @4×/fast-3G      | 2.16s                | ~1.97s                      |                                                                                                                                                                  |

### Honest negatives / non-results

- **Nav-to-planner block did NOT shrink** (Chrome 4× maxGap 486→486ms; WebKit
  306→312ms; planner→viz improved 345→265 / 104→78ms). Conclusion: the mount
  block is dominated by component instantiation + style/layout, _not_ chunk
  parse/compile (Chrome compiles modules off-main-thread) — this revises the
  2026-07-10 handoff's attribution. The block remains fully masked by the
  paint-gated fade (re-verified below); shrinking it for real means less
  DOM/derived work at mount, which is planner-redesign territory (Track A
  levers, documented in `docs/rounds/planner-perf.md`).
- **Landing TBT under throttle is noisy run-to-run** (657→~750±80 @4×); an A/B
  with preloads stripped from the built HTML showed the font preloads have no
  measurable TBT cost (~700–830 both arms). Landing TBT is dominated by
  parse/style/hydrate of the 1,400 star spans (F7, staged) — the packing removed
  the JS-parse slice, not the DOM slice.
- Crit-viz HTML 358KB → 322KB only (the benched instruments were ~37KB;
  the stars are the bulk — F7).

### Fade integrity re-verified (lazy editor changes post-mount timing)

WebKit + Chrome, viz→planner with seeded 4-char rotation: first painted frame at
opacity 0.001, monotonic full-range ramp (466–482ms), **zero >20ms gaps inside
the fade window** (one 39ms gap on WebKit planner→viz, consistent with the
pre-change "single ≤25ms" residual class). Placeholder→editor swap is not
visible in the fade (identical box metrics).

### Functional verification

Both engines: 1,400 stars decoded + rendered; planner editor mounts, seeded
rotation parses (3 panels, full timeline), typing works; crit-viz shows 2 slots
at 1600px with only 2 instruments mounted, picking a benched instrument mounts

- shows it; zero console/page errors. `npm run check` 0/0, lint clean,
  771 tests pass (3 new decoder tests).

## Reproduction recipes

- Harness: `scratchpad/harness.mjs` (coldload/layers/navgap/scroll/mem subcommands),
  `profile.mjs` (CDP sampling profiler by script URL), `occlusion.mjs` (layer census
  with style overrides), `layerid.mjs` (layer→DOM attribution), `blankprobe.mjs`
  (true first-paint under throttle). All follow `.claude/skills/verify/SKILL.md`;
  planner probes seed `critcalc:rotationTabs` first.
- Chunk attribution: `npx vite build --sourcemap` + `mapattr.mjs` (bytes per npm
  package / src dir per chunk via source-map).

## Notes carried over from Claude's working memory (2026-10-29)

From `docs/archive/perf-audit-2026-07-10.md`, the decisions Nate made the same day (2026-07-10):

- **F6 resolved (`6d2925d`):** the animated conic frame border was retired for a static 1px border at its brightest stop (a 40% Dire-tint mix). Repaints 272 per 2.5s → 4. Doctrine: any future pulse is the opacity of a stacked static ring, never a paint property.
- **F7 shipped as WebGL (`53fbb0e`):** TwinkleStars became one point-sprite canvas (`src/lib/landing/starfield.ts`). Layers on `/` 1,415 → 16, `getAnimations` 1,400 → 0, `/` HTML 275.8 → 9.4KB, rAF provably dead on tool routes, in hidden tabs and under reduced motion; 226/228 star positions matched the spans. GL lesson: the blend must be PREMULTIPLIED into a transparent canvas; a straight `(SRC_ALPHA, …)` blend stores α² and erases dim stars. Verification lesson: restart the preview after every rebuild, because a stale server serves mixed chunks, hydration dies silently, and the probes read garbage.
- **F1 sequenced:** the planner SSR fix came right after the WebGL starfield (`33634d5`).
- **F4 shipped (`6e36381`):** a `sceneOccluded` handshake in `transition.ts`, not derived from the route or a timer. The tools layout sets it true two rAFs after `revealed` paints; the scene layout clears it in `beforeNavigate` to the landing (always under cover) and seeds it on the cold-load path, so a tool cold load never rasters the scene. `visibility: hidden` on `.scene` + `.dim`. Measured −53MB of layer bytes at 1× dpr (dpr²-scaled on retina); pixel diff 0 across the 7-state nav matrix; the scene never hides before the shell paints. Nate verified it in real Safari.
- **F5 decided:** the Dire border was converted to WebGL (`docs/archive/webgl-dire-border-handoff.md`, `61c41ef`; shipped `f0c183d`) after eviction flashes survived the tile-width fix on real hardware. Two band-sized canvases, 7 animations → 0, ~100MB → ~4MB. It superseded the line-waves bbox-crop option; animated AVIF stayed rejected.
- Layer-memory estimate = w × h × 4 × dsf² (an upper bound; use deltas). Landing TBT under throttle is noisy (±80ms); an A/B on the built HTML (edit `build/index.html` directly) beats rebuild loops.
