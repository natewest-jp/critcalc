---
paths:
  - 'src/lib/landing/**'
  - 'src/lib/utils/exportScene.ts'
  - 'src/routes/(scene)/+layout.svelte'
  - 'src/routes/(scene)/+page.svelte'
---

# The scene (the WebGL night sky)

Budget: about 4,000 characters. Visual verdicts here are Nate's. Read `docs/rounds/scene-dim-shader.md` before touching the dim, and `docs/rounds/transition-hardening-queue.md` before touching transitions.

- The tool dim is the scene renderer's final pass: `out = tint × .965 + 0.1 × desaturate(scene², .5)`. The square crushes the galaxy dust while the stars stay put.
- The tint is an exact float HSL, 222°/26%/9% (`SCENE_DIM_TINT`). Never route it through a hex: 8 bits can't take a 2° step at 9% lightness.
- One formula, three readers, which must stay in step: `FS_DIM` in `sceneGL.ts`, `dimPixel` in `sceneDim.ts` (the `/styleguide` census judges every star through it), and `dimImageData` (the PNG export's backdrop).
- The stars are locked to the plate and are not dimmed separately. Nate: dimming them separately reads as dirt.
- ⚠️ The dither runs after the dim, so the crest lives on about 6–13 levels per channel.
- When judging a star figure, composite the ground properly, never as a black wash.
- Saturation is never done in CSS. The scene plates belong to `npm run optimize-bg`, content-hashed under the immutable `/assets` and imported from `sceneAssets.generated.ts`. A colour change is a re-export from Blender (8-bit master, Dither on), never a CSS, wash or shader knob (Nate).
- `will-change` goes on `.hero`, never on `.hero__plate`.
- The scene's clocks (`TOOL_NAV_MS` in `transition.ts`, the camera, the star clock, the veil) are tuned by Nate and never use the motion tokens.
- The tool surfaces have no mask or shaped scrim over the scene.
