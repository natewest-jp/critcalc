# Bench-band unification → the ribbon → the world-locked fade — ✅ SHIPPED, MERGED + PUSHED 2026-08-05 (`9516685`)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Live on the noindexed critcalc.app; fast-forward 824f92f→9516685; branch `feat/bench-band` fully merged and deletable.** Nate browser-reviewed ("meaningfully better"), hand-tuned the clocks, and called the merge. **✅ The card-interior round ran 2026-08-06 (`b07b16d`) — Nate: the mockup was "just an image to convey the idea", NOT ground truth; the cards were already near-final and got a POLISH pass instead** (base row space-between to the card edges; ⇄/✕ on every slot — disabled empty, LIVE on the generic Blank card since a typed Blank is a swap-me placeholder; glyph sizes split ⇄ --fs-xl / ✕ --fs-md; unset C/R values in dimmed white on the unset-icon opacity ladder 40%/65% via `--sp-unset-ink`(-hover), not --muted; pill dark-end 55→45% frame-bg; Nate's RIBBON_EDGE 5 + R_WIDE 30). Don't ask for the mockup re-share. **Safari follow-up `3fa9595`:** ⇄/✕ became inline stroke SVGs (`.bb-glyph--*` — the unicode points aren't in Plex; engines drew different-sized fallbacks), and the loadout-icon dim moved to a WASH pseudo (`.sp-lo-zone::after`) — the icons hover-danced in real Safari via the chrome-ⓘ transparency-layer mechanism (ribbon transform-placed at fractional coords). **`3635f8f` (Nate re-tested: a wash pseudo carrying element `opacity` STILL dances — the trigger is element opacity wherever it sits):** the alpha lives in the PAINT now — flat translucent `--frame-bg` `background-color` per state (15/0/60/35% ≡ old icon 0.85/1/0.4/0.65), transitioned as background-color. ⚠ LAW for ribbon-card content: NO element opacity, alpha only as paint (the static 0.35 disabled dims are the accepted remnant). Same commit (Nate's review): ⇄/✕ vectors approved but re-inked onto the dimmed-white ladder (rest `--sp-unset-ink` 40% / hover 65%, danger hover mixes into white), C/R text --fs-2xs→--fs-xs incl. the loadout popout's refinement pips. Probe lesson: the base wash rule's `:not()` out-specified `.sp-lo-zone--unset` — doubled class fixes; unset washes had silently never applied. Paint-alpha wash **real-Safari CONFIRMED by Nate ("dancing fully gone")**. **`57afe77` (Nate's zoom catches):** the flat wash punched lighter DISCS in the pill gradient → the wash is now the pill's own gradient with alpha IN THE COLOR STOPS (cancels over the bare ground; `--sp-pill-dark` shares the recipe), hover eased via registered `@property --sp-wash-a` (interpolation verified live in Chrome AND WebKit; unsupported = snap, states still correct). And a first attempt at the C value's centering that was WRONG in direction (see next).

**`66c1026` + `b0940fe` — the C-value centering, and the measurement lesson.** Nate kept seeing the constellation value off-center after two "fixes". Pixel-measured (8×, both engines, ink vs the ring's own center): the ink sat **RIGHT** of center — +1.19px Chrome / +1.63px WebKit in the state he screenshotted — so the earlier `text-indent: var(--ls-wide)` had pushed it FURTHER out. Shipped: **letter-spacing removed** (tracking lands after the last glyph too, widening the advance box the grid centers) **+ `text-indent: -0.07em`** optical nudge for the bearings residual (open C carries less mass than the digit; constant for C0–C6 = C + one tabular digit). Worst offset 1.02→0.39px; engines now straddle center. ⚠️ **Three measurements were confidently wrong first — the method matters, and now lives in `scripts/probe-ink-centering.mjs`:** font metrics CANNOT see this (modelled +0.81px as +0.06px — rasterization is the effect), and an element screenshot is NOT a reference (clip rects round to whole device pixels; the ribbon sits at fractional ones). Use two references that cross-check — analytic (device-aligned clip) + the control's own stroke; the stroke ref is INVALID when the shape overflows the clip (a zone inside the pill read a fake 1.56px). Judge by ink BBOX, not mass: "R1" is bbox-centered while its centroid sits 0.7px left (the R outweighs the 1) — don't chase that.

**⛔ The residual ~0.5px VERTICAL is not fixable in CSS — don't try again. → The full laws, the measurement method and Nate's dock-rounding to-do now live in `docs/design/subpixel-rendering-laws.md`; in-repo they're in /styleguide § Laws + CLAUDE.md + the probe header (`22195a5`).** Summary: `text-box-trim`/`text-box-edge` are a dead end: both engines support them and they DO shrink a text box (10px→6.98 at our size), but Plex Sans already seats cap-height ink on center under ordinary centering (ascent−cap ≈ descent), so the trim moves the box, not the ink — measured ON vs OFF byte-identical in both engines, and it can't reach a grid/flex control's anonymous text item anyway (non-inherited property). The real mechanism: **WebKit SNAPS text to whole pixels on both axes while boxes sit at sub-pixel precision; Chrome positions glyphs sub-pixel.** Sweeping a control 0→0.875px sub-pixel: Chrome constant (dx −0.313 / dy −0.484), WebKit marched linearly (dx +0.063→+0.813, dy −0.234→+0.641). So **tune nudges against CHROME** (font-property, stable); a WebKit number is only true at the position measured — and the shipped −0.07em is partly tuned to WebKit at Nate's current dock x, so don't "correct" it to Chrome's constant (~−0.025em) without asking: it would visibly worsen his Safari. ⏭ The durable fix, UNBUILT and Nate's call: **round the ribbon dock's transform to whole pixels** (it's placed from a measured fractional rect) — makes Safari deterministic, but it lands inside the tool-transition machinery whose probes assert sub-pixel dock equalities (would need re-pinning).

**Final timing values (Nate's browser pass, `b336038`):** `TOOL_NAV_MS = 2000` (transition.ts — the tool↔tool clock, driving BOTH the camera crane and the tools' drift/underline/height-relaxation; the landing ascend keeps `TRANSITION_MS` = PAN_MS 2400) · **fades are RATIO-DERIVED from their clocks (⚓ Nate's model): ascend fades = TRANSITION_MS/4 (600), tool-leg fades = TOOL_NAV_MS/3 (≈667)** — up to ~100ms cross-leg disparity accepted; drop TOOL_NAV_MS to 1800 for parity if it grates · `TOOL_FADE_IN_DELAY_MS = fade-out + 150` (a beat of pure world between the fades). Measured envelope: out ends ~720ms, in 878→1537ms, drift settles at ±219px.

**The evolution below is kept as the record — read § THE WORLD-LOCKED FADE for the CURRENT model; earlier sections describe superseded intermediate states (the traveling band, the rigid-sheet pan).**

**Build status at the time:** all chunks probe-verified; gates green (1302 vitest / check 0 / lint clean). Gates green (1302 vitest / check 0 / lint clean); every repo probe passes. Commits: `59a6434` tab-model hoist · `fb9435b` one working team · `8c81030` the band · `70b81cb` scroll mirror + clip (↻ retired again by the ribbon) · `8aa43bf` probe re-pins · `b288e22` docs · `916cd62` **the ribbon + rigid-sheet pan**. Nate confirmed at round start: **bench → Layer 2 everywhere** (the plan's team editor), TB roster grid/Detail card stay the Layer-1 editors.

## ↻ The RIBBON round (Nate's mockup, structure half — `916cd62`)

Nate's design destination: the bench is a **self-contained box/ribbon** — a LOOSE SIBLING of the timeline/atlas, not a frame zone. Structure + math built this session; **the card-interior restyle (bigger ringed portrait, circular con chip, base row of four circular chips ⇄ · artifact · weapon+R · ✕) is the NEXT round** — Nate's mockup was shared in that session.

- **The box:** BenchBand paints its own surface — ALWAYS ctx-dark (per-tool ctx flip retired), `--frame-bg` ground + `--frame-line` border + 9px radius, geometry from the **`RIBBON_*` knobs in `src/lib/benchBand.svelte.ts`** (PAD 12 · BORDER 1 · W 186 · OVERHANG 12 · TOP_OFFSET 25 · LANES_CLEAR 14). Uniform actions: **✕ removes everywhere; ⇄ auditions on TB / opens the Source on RP** (Nate's calls).
- **Tuck-under both sides:** each frame extends 174px beneath the ribbon (RP: pad 14 + label column 160; TB: `--tb-bench-w` **185→174**), ribbon overhangs each frame's outer edge by 12. RP dock right-aligns to the old label column's right edge = the tracks' left edge; the TB dock hangs off `.tb-frame`'s right (`.tb-ribbon-dock` / `.rp-ribbon-dock`, both `[data-bench-anchor]`, invisible, measured-only).
- **Zero vertical travel:** both docks sit at the shared `RIBBON_TOP_OFFSET` below their (probe-aligned) frame tops — sub-pixel equal y across tools; the ribbon only GROWS downward with the planner's slot metrics. `RIBBON_LANES_CLEAR` gap inserted between slot tracks and the below-timeline lanes (label column + tracks + PNG snapshot together) so lane labels clear the ribbon's bottom chrome. The TB zone (`.bn`) starts its scroll viewport BELOW the ribbon via padding-top from the constants — facts never scroll under the opaque box; **the scroll-mirror/clip machinery is fully retired**.
- **The rigid-sheet pan:** RP↔TB legs translate by the **measured dock-to-dock distance** (≈1372px @1600), not 100vw. The ribbon sits at the seam of the virtual sheet **[atlas | ribbon | timeline]** — ribbon and both tools move as ONE body (probe asserts glued-to-incoming to 0.03px; Nate's counter-drift diagnosis fixed). Consequences handled in the layout: the layers deliberately OVERLAP by their dock strips mid-pan (incoming rides above via z-index), and the settle pass parks outgoing layers the rest of the way offscreen. Visualizers legs keep the full-viewport distance.
- Probe re-pins: probe-bench-band (ribbon geometry, y-equality, rigid-sheet, facts clearance, 720p no-clip), probe-bench-align (card fits the RIBBON's content box), probe-tool-slide (sheet-distance entries), probe-frame-rework (border three-state contract replaces the retired #1c2a4a hex — the dire-retirement round's owed re-pin, done).
- **For Nate's eye:** the ribbon's one dark identity over the TB's paper frame (striking, matches the mockup); the 26px strip of frame above the ribbon on both tools (consequence of aligning cards to the tracks line — moving the ribbon to the frame-top line would need the planner's ruler rearranged; RIBBON_TOP_OFFSET is the knob but it's coupled to the ruler); at pan start the incoming page's opacity jump can flash its ~30px frame-edge sliver next to the ribbon (parked partially on-screen now — watch for it on real hardware); TB-side arrangement chosen: mirrored tuck-under (gap variant not built).

## ↻ Scene-clock sync + rigid interrupts (`6f3193b`, Nate-directed same day)

Nate: the scene's camera pan and the tools' pan ran different clocks (a visible tear with the world live beneath), and interrupted returns "flew in" unglued. **SLIDE_MS/SLIDE_EASE now import from `$lib/landing/transition` (TRANSITION_MS = sceneGL's PAN_MS 2400 · TILT_EASING_CSS = the camera's bezier 0.58,0,0.42,1) — ONE clock for camera, tool slide, underline, ribbon travel; retune PAN_MS to move all of it.** HOLD_MAX_MS 2500→4000. Two non-obvious mechanisms, hard-won:

- **Revival kills transitions:** Svelte's A→B→A revival REINSERTS the layer element, which cancels its CSS transition — `getComputedStyle().transform` then reports the stale inline TARGET, not the mid-flight position. Never trust a revived layer's computed transform. The incoming now parks by the **glue formula** (ribbon current x − destination dock x), re-applied at the true start instant in startFade — one rule for fresh mounts, parked revivals, and mid-flight revivals.
- **CSS reversing-shortening:** retargeting an in-flight transition back toward its origin runs on a proportionally SHORTENED clock (spec behavior) — the ribbon and outgoing layer reversed in ~1200ms while the revived layer ran a fresh 2400ms: three movers, two clocks. Fix: **freeze-then-go** (transition:none + bake current matrix + flush reflow + fresh transition) on the ribbon and outgoing layers — every mover gets a full fresh clock, which also matches the GL camera's WAAPI retarget. probe-bench-band's interrupted-nav section asserts parked-revival entry = sheet distance, mid-flight glue ≤1px, exact re-dock.

**⚠️ NEXT (Nate, end of session): a pan-behavior REWORK is coming** — ↻ it came, same session; see the next section.

## ↻↻ THE WORLD-LOCKED FADE (`ff405c2`, Nate's design — SUPERSEDES the rigid-sheet pan)

Nate's realization: the tools slid a full viewport while the scene beneath panned only the camera's crane (~219px @1600×1000) — the world doesn't hold three tool-widths of terrain. **The transition model is now TWO layers:**

- **World-locked: the tool pages.** On tool→tool nav each page DRIFTS by exactly the camera's screen-space pose delta (`toolPoseShift(from,to)` in transition.ts = poseForPath deltas; sign: screen = cam.x − anchor pose.x) while CROSS-FADING. Transforms are **WAAPI with startTime pinned to `sceneTransitionStart()`** (the camera kicked off at the scene layout's beforeNavigate) — glued to the terrain regardless of when each animation is created, and interrupts just cancel-bake-reanimate (WAAPI retarget = fresh full clock, same as the camera; the whole reversing-shortening/glue apparatus retired with the slide). Outgoing fades immediately; incoming is paint-gated and sequenced (`TOOL_FADE_OUT_MS`/`TOOL_FADE_IN_MS`/`TOOL_FADE_IN_DELAY_MS` knobs in the tools layout, defaults = the sitewide fade law 600ms; fades linear).
- **Screen-locked HUD: the RIBBON.** The TB layout FLIPPED to the planner's grammar — **bench zone LEFT, filter rail RIGHT** (CharacterGrid railSide='right'; `.bn` border-right; dock overhang left) — so both tools dock the ribbon at the SAME screen spot (21,135 @1600), and across RP↔TB it simply PERSISTS: opaque, motionless, same team, while the world sweeps behind it. That persistence IS the continuity. Heights still relax between tool rhythms on the world clock (`benchTraveling`); Viz legs fade it in place. `benchNavTransition` replaced `travelBench`.

Retired by this: the dock-to-dock pan distance, layer overlap/z choreography, glue formula, freeze-then-go, settle park-out, the mirrored-benches-meet-at-the-seam rationale (the old TB bench-right arrangement existed FOR the slide seam). The probe-verified trace: outgoing clears by ~600ms having drifted only ~18px (the ease's gentle first leg — the fade law working as designed), incoming fades in from ~−200px drifting to rest, ribbon x constant every frame, both docks equal, interrupts stable. probe-tool-slide/bench-band/tb-bench-right/bench-align re-pinned (bench-LEFT grammar). Fleet + gates green at `ff405c2`.

**Nate review points for THIS model:** overall transition time (his stated next step — retune `PAN_MS` in sceneGL.ts and everything follows: camera, drift, underline, fades derive), the fade sequencing knobs (out 600 / in 600 / delay 600), the TB rail-right usability check, and real-hardware feel of the drift-under-ribbon moment.

## The architecture (what a future session must know)

- **`src/lib/rotationTabs.svelte.ts`** — the planner's whole tab model, hoisted to a shared runes module. THE working team = the active tab's `slots` (manualSlots ?? notation-derived autoSlots; `'blank'` = empty — the TB adapts to its `null` convention at the boundary). Restore/persist/save-bank-label-sync live in the **(tools) layout** (must run for every tool — the TB edits while the planner page is unmounted). Same localStorage key/shape (`critcalc:rotationTabs`) — no migration.
- **`src/lib/benchBand.svelte.ts`** — host registry + slot metrics + card constants. `registerHost()` is last-writer-wins with self-only unregister (pan retention safe); `claimMetrics()` is ownership-guarded the same way. **`BENCH_SLOT_H = 158` = the planner's BASELINE slotBlockH**, so the "even default rhythm" on the TB equals a no-extra-rows planner slot — the RP↔TB height relaxation is a no-op for typical rotations and only moves in the extreme many-aux-rows cases (exactly Nate's spec).
- **`src/lib/components/BenchBand.svelte`** — the four SlotPortrait cards, rendered ONCE by the (tools) layout OUTSIDE the keyed `.tool-page` layers. Index entries (not payloads) feed the cards — instant, no loading state. Con/loadout display resolves L2⇒L1; writes go to `rt.setTabCon`/`rt.setTabLoadout`. Context: **ctx-dark + `--surface-raised` ground on RP, ctx-light + `--frame-bg` on TB** — the band paints its docked frame's own ground, so at rest it's invisible against the zone and mid-flight it carries its surface. TB mode adds ⇄/✕ actions (`.bb-act`); portrait click routes through the host registry (RP → open Source; TB → Detail card, filled slots only).
- **Docking**: each benched page reserves a `[data-bench-anchor]` gutter — RP: the label column's now-EMPTY `.char-label` cells at their `slotBlockH(i)` heights (wrapped in `.rp-bench-anchor`); TB: a `BENCH_COLUMN_H` spacer at the top of `.bn` (facts/coverage/clear flow beneath it, page-owned as before). The layout measures the anchor and places `.bench-band-mount` by transform in `.tool-main` coordinates, **compensating the page layer's own pan translateX**. The band lives inside the scrolled subtree → RP page scroll alignment is free.
- **Travel** (`travelBench`, called from `startFade` — the exact pan clock, SLIDE_MS/SLIDE_EASE): RP↔TB = dock-to-dock glide; into/out of Visualizers = enter/exit glued to the page motion (`± dir * innerWidth`), hidden after exit. Reduced-motion / enter / lone-layer paths snap via `snapBench()` (also onMount pre-paint, fonts.ready, window resize).
- **TB zone scroll** (short viewports): `.bn` carries `data-bench-scroll`; its scroll just re-runs snapBench (the anchor rect already carries the offset) and the band gets a `clip-path: inset(...)` to the zone's viewport. Travel clears the clip; arrival restores it.

## ↻ The ABUTTING round (2026-08-07, Nate-directed) — the tools no longer tuck under the strip

**Nate's report:** "when they're fading in/out you can see the tool beneath the
bar — it shows two layers." **Diagnosed by measurement, and it is NOT a
transparency bug** (`--frame-bg` is opaque `#242c40`): on a **Visualizers leg**
the ribbon is part of the TOOL SURFACE and fades in _exact lockstep_ with the
frame (same clock — measured `band=0.42 / tool=0.42` every frame, 70–79 frames
≈1.2s). Across the ~189px where the frame's ground lay UNDER the strip, the
composite was `0.42·ribbon + 0.24·frame + 0.34·scene` instead of
`0.42·ribbon + 0.58·scene`. RP↔TB legs never showed it (0 such frames — the
ribbon stays opaque HUD there). **LAW: two surfaces that fade together must not
overlap.**

**Shipped:** each tool now BEGINS at the ribbon's right edge. `TOOL_INSET`
(= `RIBBON_W + RIBBON_GAP`) and `RIBBON_DOCK_LEFT` replace `RIBBON_UNDER` /
`RIBBON_OVERHANG`; ⚓ **`RIBBON_GAP` (default 0) is the knob** for bare scene
between the two. Both docks hang entirely outside their frames. Retired: the
planner's `GUTTER_W` / `--rp-bench-w` / label column / ruler + ext-scroll
spacers / composer inset / source-overlay inset, and the TB's `.bn` zone +
`--tb-bench-w`. Verified: overlap **0px at every frame** of a Viz leg;
ribbon.right == frame.left == tabs.left == 224 @1600 on both tools.

- **Structural bug-fix en route:** `--tb-bench-w` was pinned at 189 while
  `RIBBON_CHROME` had gone 15→16, so the TeamStrip sat 2px UNDER the strip
  (a standing `probe-bench-band` failure). Deleting the zone closed it.
- ⚠️ **`probe-bench-band`'s interrupt check is INTERMITTENT** —
  "after the interrupt the page settles opaque at rest" reads `opacity 0`
  roughly 1 run in 3. **Confirmed pre-existing** (fails identically on a stashed
  baseline build, 1/3). Not reproducible in isolation — 4/4 clean when the storm
  is run alone, so it needs the probe's full preceding sequence. If real, it is
  a tool settling INVISIBLE after a nav storm — same family as the ghost-layer
  bug, and a candidate for `docs/rounds/transition-hardening-queue.md`.
- ⚠️ **Probes expect the PREVIEW build on :4998, not `npm run dev`.**
  `probe-team-builder`'s chunk-request check fails on a dev server (no
  code-split chunk requests) and passes on preview. Rebuild + restart preview
  between A/B runs — a stale `build/` behind a running preview serves broken
  hashed assets and every geometry check goes wild.
- ⏭ **For Nate's eye:** at rest the dark strip used to sit ON the TB's paper
  frame; it now stands on the live scene beside it. Different object, same
  geometry.

## 🐛 The GHOST-LAYER bug (found + fixed 2026-08-06, `47dfe8b`)

Nate: "on Chrome, sometimes a tool pops into existence over the other one, hangs a second or two, then disappears" — no pattern he could find, and only ever RP/TB.

**Cause, in the world-locked-fade orchestration:** `afterNavigate` bakes every layer's MID-FLIGHT values inline (`cancelToolNavAnims(p, true)`) and then re-animates only the incoming + the layer whose `dataset.page === fromPath`. A THIRD layer — its own fade-out interrupted by this nav before finishing — was skipped as _"already invisible"_, which is only true if it had time to finish. It kept the baked opacity until Svelte's `HOLD_MAX_MS` retention removed it. **Measured: 0.24 opacity for 139 frames (~1.2s).**

- **It needs THREE navigations faster than the ~667ms fade-out**, so three layers are alive at once — hence "no pattern", and hence a _randomized_ nav walk mostly misses it. The reproducing shape is: a leg allowed to SETTLE, then two fast ones.
- **Fix:** every non-incoming layer gets the fade (one-keyframe `animate([{opacity:0}])` so the implicit start is its baked value). Drift stays exclusive to the `fromPath` layer — a stale layer's baked transform belongs to an older leg and re-targeting it jumps it sideways. `zIndex='1'` now goes on ALL outgoing layers: a stale one could still carry the `'2'` it had as an incoming and paint OVER its replacement (the "over the other tool" half of the report).
- **Why only RP/TB were noticed:** any layer can ghost; those two fill the viewport with opaque frames, so a 24% remnant is obvious where the Visualizers' smaller panels aren't.
- ⚠️ **`probe-tool-slide`'s three new checks are only as good as their SEQUENCE** — trimming the tail made them pass against the unfixed layout. Verified in both directions before landing (fails unfixed with 138 ghost frames, passes fixed). Do that both-directions check for any timing regression test here.

## ↻ Viz-leg rework + the pop-in fix (2026-08-06, Nate-directed — ✅ `f3ea1b9`, browser-confirmed + PUSHED)

Nate's refinement of the world-locked fade: the ribbon is screen-locked HUD **only between the two docked tools**. On a Visualizers leg it is part of the TOOL SURFACE — it drifts by the camera's pose delta while fading (the page layers' exact recipe: WAAPI, `startTime` pinned to the scene clock, TILT easing), glued to the departing/arriving frame. `benchNavTransition` rides WAAPI throughout now (id `tool-nav`, canceled/baked via `cancelToolNavAnims` on interrupts like the layers); the entrance fade fires from `startFadeIn` with the incoming PAGE fade's exact `startTime` (`benchGatedFadeIn`), so band and tool clear the paint gate together. Docked→docked legs now carry two one-keyframe current→target animations — no-ops normally (x constant, probe-pinned), interrupt recovery when a cut-short Viz leg left the ribbon baked mid-drift/mid-fade.

**The pop-in bug this fixed:** entering from Visualizers, the band appeared INSTANTLY instead of fading. Cause: `observeBenchAnchor` on a FRESH anchor fires the ResizeObserver's initial callback (per spec, on `observe()`), whose `snapBench()` set `transition:'none'` + `opacity:''` — stomping the CSS entrance fade to full opacity. WAAPI is the fix (a running animation outranks inline style; a 0-duration fill-forwards animation floors opacity at 0 through the paint-gate window). ⚠️ **The bug only bites on fresh mounts** — a REVIVED layer keeps its anchor element so the RO never re-fires; probe waits that re-enter within HOLD_MAX_MS (4000) test the revived path and MISS it. probe-bench-band's Viz sections now wait 4600ms before re-entering and record per-frame {x, opacity}: fade-out + drift on exit, gated fade-in + glued drift on entry (verified both directions: 3 checks fail unfixed, all pass fixed).

## What retired / changed

- `?team=`/`?replace=` **cross-injection retired**: the TB's slots→URL mirror deleted; the bench "Send to Rotation Planner →" link deleted; RP's "← Explore alternatives" is now `?team-builder?alts=1` (view request only — the team is already shared). `?team=` survives **inbound-only** on both tools (imports into a tab via `rt.importTeam`, pristine-tab reuse rules, param stripped).
- The TB bench card's **Layer-1 writes flipped to Layer 2** (con no longer implies ownership from the bench). `probe-loadout-con-layers` (22 checks) proves the full new contract incl. the Detail card still writing L1 + the band's L2 override shadowing a roster change.
- RotationTimeline no longer renders SlotPortrait; props `onOpenSelector`/`onTabConChange`/`onTabLoadoutChange` removed (tabCon/tabLoadout stay — parser + PNG export). It publishes slot metrics (`slotBlockH` per slot + blank-used flags) via `benchBand.claimMetrics()`.
- TB coverage judges at **effective (L2⇒L1) constellations** now, not the browse conMode.

## Probes

`scripts/probe-bench-band.mjs` (NEW, 22 checks) — dock geometry both tools, mid-flight travel, shared-team write-through, Viz exit/re-entry, 720p scroll-mirror+clip. Re-pinned: probe-bench-align (7), probe-tb-bench-right (17), probe-team-builder (all — shared-team trip replaces the URL round-trip), probe-loadout-con-layers (22). Repaired pre-existing staleness found en route: probe-buff-windows (retired weapon shortNames), probe-planner-empty (`.tab-add`, dead screenshot dir), **probe-ascend-pan re-pinned to tools-over-scene** (scene stays live under tools; cold tool load initializes the renderer — the dire-retirement round's owed re-pin).

## For Nate's browser review (the check-in list)

1. **The travel feel** — RP↔TB glide reads beautifully in headless shots (band carries its light/dark surface across the seam); judge the real-trackpad feel + the context SWAP at pan start (cards flip palette when the destination flips — could crossfade instead if it pops).
2. **The empty socket** — mid-flight the outgoing tool shows its empty gutter (RP: bare cells + separators; TB: blank spacer). Deliberate ("the bench lifted off"). Veto point.
3. **Pan distance** — layers still translate 100vw; the "content narrows → shorter pan" motivation is NOT cashed in (the gutters live inside the pages). If wanted, the translate distance is a knob in the layout (`dir * 100vw` in three places).
4. TB per-slot height went 154 → **158** (the shared resting rhythm = planner baseline). ~16px taller bench column.
5. In-chart track identity for the tall/misaligned case: only ever misaligned MID-TRAVEL now — deliberately not built.
6. ✅ Real-Safari pass CLEARED by Nate 2026-08-12, along with the general tools-over-scene soak.

## Open

- PNG export label column still draws its own card art (pre-existing TODO from `docs/rounds/unified-bench-card.md`).
- RP tab-bar wrap (many tabs, narrow width) shifts the frame top without a resize event — the band would sit 1 row high until any resize/nav. Rare; fix = ResizeObserver on the anchor if it ever bites.
- Do RP tabs generalize to site-wide "plans" the TB can switch between? Explicitly out of scope this round.

Related: `docs/rounds/unified-bench-card.md` (its card-not-bench ruling is SUPERSEDED — one band now; the CARD width 160 remains the converged unit) · `docs/rounds/mirrored-tool-surfaces.md` (the seam design this replaces) · `docs/rounds/tb-loadout-constellation-port.md` (two-layer model — write-routing re-drawn here) · `docs/rounds/dire-retirement-round.md`
