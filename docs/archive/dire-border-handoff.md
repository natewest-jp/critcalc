# Dire border — archived 2026-08-05 (dire-retirement round)

Retired by the dire-retirement round, downstream of Nate's 2026-08-02 direction
call (the ascend revival): every UI in Genshin — and nature — is light-warm /
cool-dark, and the tools belong on a cool-dark ground inside the landing
scene's world. The dire _scene_ was a destination that existed to rationalize
the portal, and the portal itself retired 2026-08-05 (`795ab22`,
`docs/archive/portal-handoff.md`). With no portal there is no "past the
portal" for the border to mark. Archived rather than lost — this note is the
recovery map and the design history's terminal entry.

## What it was

The themed tool-interior edge treatment (Stygian Onslaught "Dire mode"
reference): slow magenta waves traveling along the top and bottom viewport
edges over static twilight gradient glows, plus a procedural ember dot field
at the bottom — a fixed frame that marked "you are in a tool" and gave content
something to scroll under.

Final architecture (as removed):

- **`DireBorder.svelte`** — two fixed strata sandwiching the tool content
  (z1): `.dire-under` (z0, static gradient glows + bottom waves + ember
  canvas, content draws over them) and `.dire-over` (z2, the top wave canvas +
  fade overlay — the occluding edge that backed the fixed chrome; the
  scroll-under design of 2026-07-24). Mounted only in the tools layout.
- **`direBorderGL.ts`** (~1060 lines) — the animated layers as three WebGL2
  band canvases (`gl-top` / `gl-noise` / `gl-bottom`), one draw call each,
  infinite scroll as `fract(u + t)` over REPEAT-wrapped tiles. Replaced 7 live
  CSS animations whose oversized compositor textures caused Safari eviction
  flashes. The conversion's full design + verification record:
  `docs/archive/webgl-dire-border-handoff.md` (kept for the shader technique).
  Dev hooks as removed: `window.__dire.retune()` re-read the knobs after a
  devtools edit; `?dire-freeze=T` rendered one phase-matched frame.

## The final color model — the twilight ramp (2026-08-01)

Explicit color stations on `.tool-shell`, replacing the earlier one-tint ×
nine-lightness-scalars algebra. Measured basis: Genshin's Arlecchino Aug-2026
wallpaper (hue rotates 248→265→311→353→10→31 down its sky) + the Stygian
waves' equiluminant hue drift. Hue travels navy→violet→magenta→dire from
content toward the viewport edge; chroma peaks only in small bright accents.
Same day's line-layer redesign: two body waves carrying horizontal
screen-space hue gradients that ride the motion, plus a stroke-only LINE wave
between them whose opacity breathes along its length.

**Nate's final tuned knobs, verbatim from the tools layout at removal**
(every value ⚓ hand-tuned — if any of this is ever revived, these are the
look):

```css
--dire-base: #131518; /* the shell ground ⚓ NATE — near-neutral off-black  L.17 C.013 */
--dire-sky: #1d171e; /* gradient far end ⚓ NATE — dusk plum       L.19 C.028 H333 */
--dire-horizon: #341d27; /* gradient edge end ⚓ NATE — quiet magenta  L.21 C.064 H344 */
--dire-wave-far-l: #633156; /* far body, pole A  ⚓ NATE  L.47 C.208 H299 */
--dire-wave-far-r: #6c314e; /* far body, pole B  ⚓ NATE  L.51 C.182 H22 */
--dire-wave-near-l: #e23c8f; /* near body, pole A ⚓ NATE  L.53 C.185 H305 */
--dire-wave-near-r: #f13352; /* near body, pole B ⚓ NATE  L.58 C.174 H13 */
--dire-crest: #e57d7d; /* line color ⚓ NATE  L.72 C.134 H359 */
--dire-crest-w: 2px;
--dire-crest-a: 0.3;
--dire-crest-fade-n: 1;
--dire-crest-fade-dur: 8s;
--dire-crest-fade-min: 0;
--dire-crest-fade-bias: 6;
--dire-crest2-off: 40px;
--dire-near-drop: 10px;
--dire-wave-base-a: 0;
--dire-ember: #e14660; /* ember dot glow — the chroma peak  L.62 C.190 H15 */
--dire-top-h: 100px;
--dire-top-grad-h: 100px;
--dire-bottom-h: 150px;
--dire-bottom-grad-h: 170px;
--dire-halftone-h: 200px;
--dire-wave-cover: 0.6;
--dire-tile-w: 200vw;
--dire-speed: 0.5;
--dire-noise-dur: 10s;
```

## What survives elsewhere (do not re-derive)

- **The opaque tool-shell ground** — the ascend occlusion handshake
  (`covered` → `sceneOccluded`) depends on the shell being fully opaque; the
  shell keeps an opaque background, only the value changes (Nate's
  cool-dark pick).
- **The 72px content top** — `--tool-pad-top: 0.5rem` was tuned so content
  cleared the top fade's 70px terminator. The pad stays (breathing room below
  the chrome); its dire rationale is gone, so it's free to retune.
- **The shader technique** — `fract(u + t)` over REPEAT tiles, absolute-time
  phases, the no-GL static-frame fallback: `webgl-dire-border-handoff.md` and
  live in `$lib/landing/starfield.ts` / `sceneGL.ts`.
- **The P3 alpha-compositing law** — semi-transparent CSS over dark grounds
  renders display-dependently; every ramp station was opaque for that reason.
  The law is site-wide now (styleguide § Laws).
- **The eviction lesson** — no compositor texture wider than ~viewport;
  cited in the tools layout's will-change comments (the "~25MB retina layer"
  caution).

## Recovery

Last commit carrying the border: the parent of the removal commit on
`chore/dire-retirement` (see `git log --diff-filter=D -- 'src/routes/(scene)/(tools)/lib/DireBorder.svelte'`).
Removed with it: `src/routes/(scene)/(tools)/lib/DireBorder.svelte`,
`src/routes/(scene)/(tools)/lib/direBorderGL.ts`, the `--dire-*` knob block in
`src/routes/(scene)/(tools)/+layout.svelte`, the shipped noise tiles
`static/assets/tools/dire-noise.{avif,webp}` + their `scripts/optimize-dire.js`
generator, and `scripts/probe-plate-analyze.mjs` (a measurement recipe for the
halftone plate that had already retired 2026-07-25). KEPT: the authored
sources in `assets-src/tools/` (`waves.svg`, `noise-alpha-repeating-1200x600.png`,
`halftone-repeating-10x200.png`) — source-asset precedent, they're the design's
raw material.

Design-history trail (`docs/archive/dire-border-handoff.md` holds the narrative):
CSS original `30b2c77` → WebGL conversion `f0c183d` (2026-07-11) →
scroll-under split 2026-07-24 → twilight-ramp rebuild `a9103bc` + line-layer
redesign `44b8fbc`/`b793c3e` (2026-08-01, the lightness round) → retired here.
Nate's last verdict on the look itself: "basically exactly where I'd like it"
— it retired for zoning reasons, not aesthetic ones.

## Notes carried over from Claude's working memory (2026-10-29)

From `docs/archive/dire-border-handoff.md` (details this handoff and `webgl-dire-border-handoff.md` don't carry):

- The 2026-08-01 five-ask round: the two body waves counter-flow and both crest at the `--dire-*-h` marks (far exact, near `--dire-near-drop` 15px shallower). Body fade: the crest is fully opaque and eases toward the base (`--dire-wave-base-a`); the first cut faded the crest and Nate flipped it. The line's breathe is biased narrow (`--dire-crest-fade-bias`), with a twin line (`--dire-crest2-off`, which Nate ran 50px deep, its fade drifting the opposite way).
- An outer-haze experiment was built and removed the same day (Nate: without was better). Don't reintroduce it without asking. The pre-blurred-silhouette technique (one sample per frame, no `ctx.filter`) is recorded in `f2e60ce`.
- Vite HMR causes dev-only flashes on save; judge perf on `npm run preview` or the deployed site, never dev.
- The 2026-08-01 twilight-ramp rebuild was never soaked in real Safari. That soak became moot when the border was deleted; if the border is ever revived, the soak is owed again.
- The graph-frame radial glow was heatmap-only (`.cv-map-frame` in `CritHeatmap.svelte`: a blue radial top-left and a magenta one bottom-right over `#081225`); every other instrument frame was flat `#081225`.
