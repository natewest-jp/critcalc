# Handoff — WebGL Dire border (DireBorder animated-layer conversion)

**Decision:** Nate green-lit planning this 2026-07-10, after confirming the
Safari eviction flashes SURVIVE the `--dire-tile-w` shrink (two flashes in
quick succession on real hardware, same day). The look as shipped (`30b2c77` +
tuning) is FINAL — this is a mechanism swap, not a redesign. The line-waves
bbox-crop option from the L2 audit (F5) is superseded: it only shrinks the
oversized textures; a canvas eliminates the class.

**Goal:** replace DireBorder's ANIMATED layers — 6 wave strips + the scrolling
noise veil (7 live animations) — with **two WebGL canvases** (one per edge
band) that render the identical composite. Static layers (gradient glows, tint
base, halftone dot screen) stay CSS: they never re-raster and the halftone must
stay pixel-crisp at its native tile size.

## Why

- The seamless CSS loop structurally requires each wave strip to be a
  compositor texture `2 × --dire-tile-w` wide (≈ 2.6× viewport width even
  after the 220vw → 130vw shrink). On retina that brushes the 4096 device-px
  layer limit; Safari tiles/evicts and re-rasterizes → the 2-frame wave
  disappearance Nate keeps seeing. In a fragment shader, an infinite scroll is
  `fract(u + t)` over a small REPEAT-wrapped tile — no oversized texture
  exists, so there is nothing to evict.
- GPU memory: ~100MB of wave/noise strip textures → two band-sized canvas
  backings (≈ 1600×~300 each ≈ 2MB/edge at 1×).
- All 7 animations leave WebKit's scroll-gesture-start sync set — the same
  cost class the starfield conversion removed from the landing, except these
  run on tool routes where users actually scroll.

## Design

### Split: what moves to canvas, what stays CSS

| Layer (back→front)         | Today                               | After                                                                                                     |
| -------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `grad-top` / `grad-bottom` | static CSS gradient                 | unchanged CSS                                                                                             |
| `tint-base` (bottom)       | static solid                        | unchanged CSS                                                                                             |
| `noise-scroll` (bottom)    | 600px-tile translateY loop (1 anim) | sampled in the bottom canvas shader                                                                       |
| `halftone` (bottom)        | static PNG dot screen               | unchanged CSS, ABOVE the canvas (dots stay native-crisp, noise moves under them — same stacking as today) |
| 6 × `wave-slot`/`flow`     | 2-tile SVG strips, translateX loops | 3 layers per edge, one draw call per canvas                                                               |

DOM: keep `DireBorder.svelte` and its z-order; the wave slots and noise-scroll
are replaced by `<canvas class="dire-gl dire-gl--top/bottom">` fixed to their
edge bands. Component stays mounted only in `(tools)/+layout.svelte` — unmount
on leaving tools is the natural teardown.

### Wave tile texture

Rasterize the authored silhouette ONCE at init: draw `WAVE_PATH` (2400×200
viewBox) via `Path2D` into an offscreen 2D canvas (~1200×100 is plenty — the
waves render soft), filled with the 4-stop vertical alpha ramp (0.3 / 0.18 @0.2
/ 0.06 @0.42 / 0 @1, ×3 authored boost) as WHITE-on-transparent. Upload as an
alpha texture, `REPEAT` wrap on x. Color is applied per layer in the shader, so
one tile serves all six layers and every hue.

### Per-layer params (copy VERBATIM from the shipped CSS — the tuned look)

Per edge, three layers `{ flowDur, waveHDiv, hueShift, alphaMul, marginPx, delayS, reverse }`:

- bottom: `30s / 15 / −1° / 1.0 / 0 / 0 / false` · `38s / 15 / −2° / 0.8 / −64 / −7s / false` · `46s / 15 / +5° / 0.65 / −36 / −13s / true`
- top (v-flipped): `34s / 17 / −5° / 1.0 / 0 / 0 / true` · `42s / 17 / +7° / 0.8 / −42 / −5s / true` · `50s / 17 / −8° / 0.65 / −21 / −17s / false`

(`waveHDiv`: `--wave-h = --tile-w / N`. Top layers 1&2 are `.rev` today;
reverse = `animation-direction: reverse`, i.e. phase runs backwards.)
`--dire-tile-w`, `--dire-speed`, `--dire-wave-alpha`, `--dire-noise-dur`,
`--dire-top-h`/`--dire-bottom-h` and the `min(0px, mark − wave-h)` crest
clamp all keep their exact meaning — read once at init from `.tool-shell`
computed style and folded into uniforms/geometry. (Live devtools re-tuning
needs a re-read hook — acceptable; the knobs are set, not being explored.)

### Shaders

One program, one full-band quad per canvas, all three wave layers + (bottom)
the noise veil composited IN the fragment shader — single draw call, no GL
blending between layers (premultiplied source-over folded in shader):

- per layer: `a = tile(vec2(x / tileW ± t / flowDur, yLayer)).a × waveAlpha × alphaMul`
  with `yLayer` from the layer's wave-h squash + margin + crest clamp;
  `color = layerTint` (HSL-rotated from `--dire-tint` in JS, one vec3 uniform
  per layer — no shader HSL math needed).
- bottom adds `noise(vec2(x, y + t / noiseDur))` sampled from the
  `dire-noise` tile (REPEAT wrap on y) over the tint base — but ONLY the
  scrolling veil; base + halftone remain CSS.
- Phases derive from absolute time (`t / dur mod 1`, negative delays folded
  in) — suspend/resume is pop-free, same contract as the starfield.

### Gating / lifecycle (mirror `starfield.ts` — the patterns are proven)

- rAF loop runs only while mounted (tools only) AND `!document.hidden` AND
  not reduced-motion. Reduced motion = one static frame (today's
  `animation: none` freeze equivalent).
- No WebGL → one static 2D-canvas frame of the same composite. No CSS-strip
  fallback — two implementations is how parity rots.
- `webglcontextlost`/`restored`: stop, rebuild pipeline, resume.
- Backing store: start at DPR 1 (waves are soft gradients; the crisp elements
  — halftone, gradients — stay CSS). Revisit 1.5 only if crests look soft on
  retina. ResizeObserver + debounced backing resize, repaint-once-if-stopped.
- Extract shared GL helpers from `starfield.ts` ONLY where they fall out
  naturally (context boilerplate, loss handling); don't force a framework.

## Constraints

- **Pixel-visual parity is the requirement.** Nate is satisfied with the
  current look; he eyeballs the final result on real Safari + Firefox.
  Parity is gestalt (organic drift), not machine-checkable — verify by
  same-frame screenshot overlays at matched phase offsets plus his eye.
- Assets unchanged (`dire-noise.{avif,webp}`, `dire-halftone.png`,
  `WAVE_PATH`); `scripts/optimize-dire.js` untouched.
- Perf doctrine holds: nothing here may add a live CSS animation or a
  main-thread per-frame style write.

## Verification recipe

1. Chrome CDP layer census + `getAnimations()` on `/rotation-planner`:
   7 border animations → 0; wave/noise strip layers gone.
2. rAF probes: loop alive on tool routes, dead on `/` (border unmounts),
   dead under `document.hidden`, static frame under reduced motion.
3. GPU memory delta (layer-size census, before/after).
4. Real-Safari soak by Nate — the eviction flash NEVER reproduces headless
   (software raster); his hardware is the only oracle that counts.
5. Scroll-gesture rAF-gap probe in headed WebKit while the planner scrolls.

## Sequencing

Default slot: after the planner SSR fix (Nate's queue of 2026-07-10). The
flashes are user-visible on his daily driver, so he may promote it — his call.
Related: F4 (scene `visibility: hidden` behind tools) releases ~90MB+ of
resident scene textures and plausibly REDUCES eviction pressure on the border
strips in the meantime; it remains recommended and is independent of this work.

## Done when

Tool routes render the identical border from two canvases; the 7 animations
and the oversized strip textures are gone; the loop provably stops when hidden
or off-tools; reduced-motion and no-GL render static bands; and Nate confirms
two things on real Safari: the look is the look, and the flashes are gone.
