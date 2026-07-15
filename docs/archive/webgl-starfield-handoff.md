# Handoff — WebGL starfield (TwinkleStars conversion)

> **📦 ARCHIVAL (2026-07-15).** This conversion SHIPPED (`53fbb0e`). Kept for the
> span→point-sprite recipe + the premultiplied-alpha gotcha (straight alpha into a
> transparent canvas double-attenuates → dim stars vanish). Not a live handoff;
> outcome in memory `project_perf_audit_2026-07-10.md`.

**STATUS: SHIPPED 2026-07-10** (implementation in `src/lib/landing/starfield.ts` +
`TwinkleStars.svelte`). Measured at 1600×1000 headless: layers on `/`
1,415 → 16 · `getAnimations()` 1,400 → 0 · prerendered `/` HTML 275,814 → 9,427
bytes · rAF provably 0 on tool routes / hidden tabs / reduced motion, resumes
pop-free · star-position parity 226/228 blobs within 2.5px of the span baseline
(WebKit) · 2D static fallback verified with WebGL disabled. One deviation from
the sketch below: the blend is PREMULTIPLIED, not straight — straight alpha
into a transparent canvas double-attenuates (stores α², dim stars vanish;
caught in verification). Still pending Nate: shimmer eyeball on real Safari +
Firefox (incl. cosine-vs-bezier call on gentle), and confirming the accepted
no-SSR beat on slow cold loads.

**Decision:** Nate green-lit this 2026-07-10 after the L2 perf audit
(`perf-audit-2026-07-10.md`, finding F7) and the follow-up options
discussion (N grouped SVG layers rejected: any group's bounding box ≈ the whole
sky region ⇒ ~24.5MB of promoted texture per group at dsf 2 — swaps a count
problem for a memory problem, and synchronizes twinkle within groups).

**Goal:** replace the 1,400 star `<span>`s in
`src/lib/components/landing/TwinkleStars.svelte` with **one WebGL canvas**
drawing point sprites, preserving the current field's look (Nate's words: stars
can be simple dots with a bit of hue variation — near-parity is the target, not
pixel-exactness).

## Why (measured, 2026-07-10 baseline)

| Cost                                              | Today (spans)                                                                  | After (canvas)                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| Compositor layers on `/`                          | **1,415** (one per animated-opacity span, Chrome)                              | ~15                                     |
| Live CSS animations (Safari per-gesture sync set) | **1,400**                                                                      | 0 (one rAF loop)                        |
| Landing TBT @6×/slow-3G                           | 1.78s, dominated by parse/style/hydrate of the spans (`(program)`, not app JS) | expect well under 1s                    |
| Prerendered HTML per (scene) route                | ~250KB of star spans (275KB total `/`)                                         | ~25KB                                   |
| GPU texture                                       | trivial (spans are 2–3px each)                                                 | one canvas backing store (~6.4MB at 1×) |

The star _data_ is already solved: `src/lib/stars.ts` decodes the packed
base-36 field (shipped `889e685`) — its `stars` array feeds vertex attributes
directly.

## Design

### Integration point (keep the scene contract)

- The `.twinkle` element stays exactly where it is — same CSS sizing
  (`--scene-w` × `--sky-h`, bottom-anchored at `--horizon-y`), same
  `use:sceneLayer={'twinkle'}` registration, same SSR inline transform. The
  canvas replaces the `{#each}` spans _inside_ it. The WAAPI pan and cursor
  parallax translate the parent — the canvas texture rides along for free,
  unchanged.
- **`--twinkle-play` becomes obsolete**: `transition.ts` (~line 480,
  `setTwinkleFreeze`-adjacent code) sets it on the twinkle layer to freeze
  per-star animations during pans so the layer rasters once. A canvas is
  already a single texture — remove the knob's consumer, and either remove the
  writer in transition.ts or leave it writing a dead property (prefer removing;
  also drop the pointerdown pre-arm path if it has no other consumer).
- The route suspension (`twinkle--suspended` → `animation-name: none`) becomes:
  **stop the rAF loop** when `!isLandingPath(page.url.pathname)` (same derived
  the component already has) or `document.hidden`. Leave the last frame in the
  canvas — resume just restarts the loop (time-based phases, so no pop; see
  Animation below). This satisfies the standing scene-occlusion constraint
  (memory `scene-occlusion-perf`): zero live animations AND zero rAF work
  behind tools.

### Canvas / GL setup

- **Backing store capped at DPR 1** (revisit 1.5 only if Nate finds dots too
  soft on retina — they're glowy points, 1× is likely fine and it's the memory
  lever: ~2434×661×4 ≈ 6.4MB at a 1000px-tall viewport). CSS-size the canvas to
  100% of `.twinkle`; resize backing on element resize (ResizeObserver,
  debounced; re-render one frame after resize even when suspended).
- One `drawArrays(gl.POINTS, …)` call, 1,400 points, static VBO built once from
  `stars`. Alpha blending (non-premultiplied `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`
  is fine on black; switch to premultiplied if halos look dirty over the sky
  image). Canvas context `{ alpha: true, antialias: false, depth: false }`.
- Point size = star size × (halo ? ~3.4 : 1) × backingDPR — the halo pseudo
  today is `inset: -120%` ⇒ ~3.4× the core box. Max ≈ 3px × 3.4 ≈ 11px devpx —
  far under every GPU's `ALIASED_POINT_SIZE_RANGE`. Bake `halo` into per-star
  attributes.

### Per-star attributes (all from the decoded `Star`)

`x, y` (% of sky region → clip space) · `size` (px) · `baseAlpha` (`base`) ·
`rgb` (resolve the five `color-mix` tints to literal RGB at build time — they
are constants: white / warm `92% white + #ffd8a8` / cool `92% + #c0d8ff` /
yellow `85% + #ffd070` / amber `82% + #ffaa50`; compute the srgb mixes once in
JS) · `duration`, `delay` (phase = `(time + delay) / duration mod 1` —
negative-delay semantics preserved) · `animType` (0/1/2) · `jitterVariant`
(0/1/2) · `halo` (0/1).

### Animation curves (vertex shader, uniform `u_time`)

Replicate the three CSS keyframe families:

- **gentle:** opacity `0.2·base → 1 → 0.2·base`, CSS `ease-in-out` per segment.
  A raised cosine `(1 − cos(2π·phase))/2` is a close visual stand-in for the
  bezier(0.42,0,0.58,1) segments — ship the cosine, flag for Nate's eyeball; if
  he can tell, evaluate the actual cubic bezier (a few Newton iterations in the
  shader is nothing at 1,400 verts).
- **dramatic:** opacity `0.15·base → 1`, plus `scale(1.15)` at peak — scale the
  point size by `1 + 0.15·pulse`.
- **jitter:** three 13-stop **linear** piecewise curves (variants a/b/c) with
  `--flicker = 0.4`, each stop `base·(1 − 0.4·k)`. Encode the 3×13 stop tables
  as a uniform float array (or const arrays in GLSL); piecewise-linear interp
  by phase. Stop values are in `TwinkleStars.svelte`'s current keyframes — copy
  them verbatim before deleting.

### Fragment shader (core + halo in one sprite)

Crisp core disc (smoothstep edge over ~1px) at full star alpha; around it, when
`halo`, the eased glow: today's mask approximates `alpha = (1−t)²` from core
edge to sprite edge at overall opacity 0.5, riding the star's animated opacity.
Reproduce `(1−t)²·0.5` radially — that's the whole halo. No textures needed.

### Fallbacks

- **Reduced motion:** render exactly one static frame (today's spans freeze at
  opacity 0.8 — match that: draw all stars at 0.8 alpha), no loop.
- **No WebGL / `webglcontextlost`:** draw one static frame via 2D canvas (same
  data, `arc()` + radial-gradient halos — a one-time paint is fine); listen for
  `webglcontextrestored` to resume. Do NOT keep the span path as a fallback —
  two implementations of the twinkle is how parity rots.
- **SSR / first paint (decide with Nate, flagged in the audit):** spans
  currently SSR so stars paint with the HTML; a canvas is blank until JS. The
  sky image's baked anchor stars cover the gap visually. Recommendation:
  accept the beat of no-live-twinkle on slow cold loads. If Nate objects,
  SSR ~100 of the brightest stars as static spans and remove them when the
  canvas draws its first frame — but try acceptance first.

## Constraints

- Pixel-neutral-ish: same field, same tints, same rhythm — Nate eyeballs the
  final shimmer on real Safari + Firefox (headless can't judge feel; headless
  FF is software-rendered).
- `stars.ts` and its generator/tests stay untouched (the packed data is the
  single source; the test pins composition).
- Keep the component's public surface: same `initialTransform` prop, same
  placement in `(scene)/+layout.svelte`.
- `npm run check` 0/0 · lint clean · 771+ tests. Screenshot parity shots
  before/after (same viewport) for the commit message.

## Verification recipe (harness patterns from the audit)

1. Layer census on `/`: expect ~1,415 → ~15 layers (`layerid.mjs` pattern —
   CDP LayerTree + DOM attribution; see perf-audit doc §Reproduction).
2. `document.getAnimations().length` on `/`: 1,400 → ~0 (meteors excluded).
3. Cold load `/` @6×/slow-3G (CDP throttle): TBT 1.78s baseline → expect <1s;
   HTML 275KB → ~25KB (`curl -s localhost:4998/ | wc -c`).
4. rAF-gap probe during landing wheel + on tool routes (loop must be dead
   there: assert no canvas rAF while on `/rotation-planner`).
5. Visual: screenshots at 2–3 time offsets; Nate confirms shimmer character
   on-device.

## Done when

Landing renders the same starfield from one canvas; layers/animations/HTML
collapse per the table; the loop provably stops on tool routes and under
`document.hidden`; reduced-motion and context-loss render static fields;
Nate signs off on the shimmer feel on real Safari.
