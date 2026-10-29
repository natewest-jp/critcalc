# Scene occlusion and Safari scroll performance (2026-07-06)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**⚠ ↻ 2026-08-05 THE PREMISE INVERTED — tools-over-scene experiment (`docs/rounds/dire-retirement-round.md`, merged `824f92f`): the tool shell is TRANSPARENT now and the scene stays PAINTED + LIVE behind every tool (Nate's call; precedent = the retired dire border ran 3 live GL canvases under tools). The constraint below still holds for CSS animations — but the scene is GL now (one canvas, rAF-driven, not 1400 CSS animations), which is a different cost class. The occlusion machinery (`sceneOccluded`) stays wired but unasserted; if Safari scroll-jerk returns on tool routes, re-assert it (revert path in the tools layout comment). ✅ **Real-Safari soak CLEARED by Nate 2026-08-12** — the inverted premise held. ⚠ The CONSTRAINT below is not cleared with it: it is a law about live animations behind an occluding shell, and a clean soak of the current arrangement is not permission to add hundreds more.**

**↻↻ 2026-08-06 THE ZERO-rAF PROPERTY IS RESTORED — the TOOL-REST PAUSE (`fb8c7a9`, Nate-directed): once a tool leg settles (settle + FADE_OVERLAP_MS + 100), the scene layout's `sceneResting` state calls `sceneHandle.stop()` — the twinkle loop stops, zero rAF/draw work behind tools, scene stays PAINTED on its last frame (deliberately NARROWER than `sceneOccluded`, which also unpaints and would blank the world behind the transparent shell — never assert occlusion for this). Any `beforeNavigate` un-rests immediately, so every leg (cranes twinkle en route — `animateCamera` draws its own loop with real timestamps) and the landing stay fully live; resume is pop-free (absolute-time star phases). Probe-pinned: `__scene.twinkling()` false at tool rest / true mid-leg / true on landing (probe-tool-slide + probe-ascend-pan re-pins). This substantially de-risked the Safari soak, which ✅ CLEARED 2026-08-12.**

Discovered 2026-07-06 while chasing Nate's Safari-only timeline-scroll "jump to destination" jerk (fixed at `08daf1e`). The full forensic chain is in that commit message; this memory records the _constraint_ because future scene work will trip it again.

## The constraint

**WebKit synchronizes every live animation on the main thread at each scroll-gesture start.** With the ~1,400 twinkle-star CSS animations running behind the (fully occluding) tool shell, that sync cost ~60ms in headless WebKit @2x and ~90–120ms on retina hardware — per gesture. Safari coalesces the wheel events queued during the stall into single mega-deltas (the trace: dx=803, dx=−1059), which render as the momentum "jumping straight to the destination." Chrome/Firefox schedule this work off the input path — the tax is Safari-only, but the waste is universal.

**What does NOT work (measured, not assumed):**

- `display: none` on the scene — hidden elements' animations stay live in the timeline.
- `animation-play-state: paused` (the existing `--twinkle-play` knob) — paused animations stay live too; stalls unchanged.

**What works:** destroying the animation objects — `animation-name: none` (CSS) or `Animation.cancel()` (WAAPI). Zero live animations → zero gesture-start stalls.

## The shipped pattern

`TwinkleStars.svelte` derives `suspended = !isLandingPath(page.url.pathname)` and toggles `.twinkle--suspended` (→ `.star { animation-name: none }`). Resume on returning to the landing is seamless: the negative `animation-delay`s re-phase every star identically, so there's no visible pop. The route flip happens under the portal transition's cover in both directions.

## How to apply going forward

- **F4 shipped 2026-07-10 (`6e36381`):** beyond animation suspension, the whole scene now _unpaints_ (`visibility: hidden` on `.scene`+`.dim`) while a tool shell covers it, via the `sceneOccluded` handshake store in `transition.ts` — releasing ~53MB@1×dpr of layer textures on top of the animation wins. New persistent scene layers inside `.scene` inherit this for free; layers OUTSIDE `.scene` (like the dim used to be) must bind `class:occluded={$sceneOccluded}` themselves. The handshake contract (hide only after the shell's painted-opaque double-rAF; restore in beforeNavigate-to-landing under cover) is documented at the store in `transition.ts` — don't add route/timer-derived hiding, it flashes during the portal spin.
- **Any new persistent scene layer with animations** (planned: cyan counter-spiral, tool-interior starfield, Stygian "Dire" border, ambient breathing) must either live only on the routes where it's visible, or carry the same route-derived suspension. If a tool-interior layer _animates while a tool is up_, budget it: every live animation contributes to the per-gesture sync in Safari — keep the count low (tens, not hundreds) and prefer a few container-level animations over per-element ones.
- **ShootingStars is currently exempt** (one WAAPI animation at a time — negligible), but its scheduler still runs occluded; suspend it the same way if it ever grows.
- Diagnostic recipe if this class of jank recurs: rAF-gap logger + `document.getAnimations().length`; bisect with `getAnimations().forEach(a => a.cancel())` — if gaps vanish, it's this. Playwright's real WebKit (`webkit.launch()`) reproduces the stall headlessly at `deviceScaleFactor: 2`.

Related: `docs/rounds/landing-status.md` (scene architecture) · the 2026-07-06 scroll-fix series on `main`: `7bab87a` (echo guards) → `0c9d98d` (pointer guard) → `7c16a26` (gesture latching) → `08daf1e` (this).
