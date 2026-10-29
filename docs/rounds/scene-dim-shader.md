# The scene dim shader (2026-09-26)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**The tool-route dim is `sceneGL.ts` `FS_DIM`, a final pass over the finished scene** (2026-09-26; MERGED into `chore/cleanup-2026-09-24` as `c9cd8e81`, full e2e 78+78 green; the worktree is removed). Formula + Nate's values live in `src/lib/landing/sceneDim.ts` (`SCENE_DIM`), with `dimPixel` as the CPU mirror the `/styleguide` census uses:

`out = SCENE_DIM_TINT (HSL 222°/26%/9%, exact float) × .965 + 0.1 × desaturate(scene^2, 0.5)`

**Why:** the old dim (`#121216` at `TOOL_DIM` .875) added one grey to every pixel and kept 1/8 of the scene's variation, so the galaxy dust's highlights came out barely lighter and GREYER than the surrounding sky — read as haze in front, and crowded the stars. Nate judged it in a side-by-side mockup of the crest view (plate + the rendered starfield PNG from `assets-src/landing/starfield-*-static.png`).

**How to apply / what was learned (Nate's findings):**

- Stars and plate are LOCKED — composited before the dim. Dimming stars harder than the dust "reads as specks of dirt". ⛔ No separate star gain.
- A pure multiply goes too dark before stars stop fighting text; the wash stays a straight alpha.
- With stars locked, "exposure + grey wash" pinned to today's sky and star levels solves back to EXACTLY the old dim (it's affine) — the only real levers are nonlinear/per-channel: the tone curve, scene saturation, wash tint.
- ⚠️ I predicted γ < 1 would help highlights; Nate found γ = 2 (crush the dust away from the stars) is the win. The metric that matters is star ÷ dust separation, not highlight ÷ sky.
- Cut scene saturation, reintroduce it via the tinted wash — final sky sat ≈ old (.47 vs .46), dust no longer greyer than its surroundings.
- Gain was taken DOWN (0.105 → 0.100) by eye: "really crush that galaxy dust". No setting matches both the old sky and old star at γ 2 — the chosen point has both slightly darker; --text over a star 11.19 → 11.67:1.

**Traps:**

- ⚠️ Dither must run AFTER the dim (it does, in `FS_DIM`): the dimmed crest spans only R 16–21 / G 19–26 / B 30–42. σ = `SCENE_DIM_DITHER` 0.29 levels (the mockup's uniform ±½ that Nate judged: no visible banding).
- The dim LEVEL (0 open world → 1 tool) animates on the camera's clock via `animateDim(to, duration, startTime)` from `startSceneTransition`; `setDim` on snaps (cold load via `syncSceneCamera`, reduced motion, occluded legs). The DOM `.dim` only paints until GL is live (`.gl-owned` → display:none) — without WebGL there is no scene, so it's a plain wash.
- The landing (level 0) never touches the offscreen target — zero extra cost there.
- Shooting stars are DOM and would escape the GL dim, but they're suspended on tool routes, so it doesn't matter — ⚠️ re-check if that ever changes.
- ✅ Nate judged the live build 2026-09-26 (Chrome + Safari): "gorgeous… a definite improvement" — no banding, twinkle fine (dim stars nearly dip out, accepted), ascend smooth. Commits `a5df9b5a` … `abafa6c4`, merged `c9cd8e81` (into the cleanup branch, not main).
- ⚠️ The tint is FLOAT HSL in `sceneDim.ts`, ⛔ never a hex: at 9% lightness 226° and 224° both round to `#11141d` (true hue 225°). The shader gets `SCENE_DIM_TINT_RGB`; `--scene-dim` is only the nearest hex for the DOM fallback. Hue asks from Nate land here.
- The veil's ground is DERIVED from this: the dimmed crest measures top `#111520`, bottom `#121623` (final tint); Nate had the contrast exaggerated in OKLCH → `#06080f` → `#111422` (top L −0.05 for contrast, both ends L −0.01, the foot to OKLCH h 274° / C 0.029 by eye; committed `274c79ec`). ⚠️ Re-measure if the plate or SCENE_DIM changes.

Related: `docs/rounds/ascend-revival-2026-08-02.md` · `docs/rounds/palette-definition-round.md` · `docs/rounds/cleanup-branch-2026-09-24.md`
