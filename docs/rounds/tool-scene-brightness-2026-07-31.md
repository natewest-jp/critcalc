# Tool-scene brightness + palette re-cut — 2026-07-31 (branch `feat/tool-scene-brightness`)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

One long session with Nate: the tools were unusable outside a dim room. **MERGED + PUSHED to `main` 2026-07-31 (`19947ad`, Nate-approved); branch deleted.** Full color reference: `/styleguide` + the app.css token comments (they carry the laws inline).

## ⚠ THE ALPHA-COMPOSITING LAW (the round's hardest-won lesson)

**Semi-transparent CSS over a background renders DISPLAY-DEPENDENTLY on P3 Macs** — Nate proved it: `tint@33% alpha over black` and the mathematically identical opaque color diverge on a P3 display (hue-shifted, saturation capped _outside the sRGB gamut_ — unreachable by any alpha tuning), while headless Chrome renders them identical. Consequences, now structural:

- **The dire border's gradients are OPAQUE** — pinned-lightness relative colors fading to solid `#000`, never `to transparent`. Knobs: `--dire-edge` (bright identity tint: ember, wave hue/sat, fade seam — falls back to `--dire`), `--dire-grad-top-l`/`--dire-grad-bottom-l` (opaque gradient starting lightnesses), `--dire-edge-boost` (GL wave-stop lightness multiplier). All on `.tool-shell` in the tools layout. `fade-top` is the ONE remaining alpha layer (it overlays content; unavoidable).
- **Never try to color-match a WebGL canvas with CSS alpha.** GL buffers are pinned `drawingBufferColorSpace='srgb'` (spec default, asserted for compositors that treat untagged buffers as device-P3).
- Anywhere a line/fill sits on a KNOWN ground, mix OPAQUELY against that ground (`color-mix(... , var(--frame-bg))`), not against `transparent`.
- Also learned en route: an HSL lightness boost past l50 trades chroma for whiteness (washed pink ≠ hue drift); the GL waves lost their old ±3–5° per-layer hue rotation at the WebGL conversion (comment corrected).

## The surface system (Nate's anchors; derivation `scripts/oklch.mjs`)

Anchors hand-picked by Nate, everything else derived: **hue constant ≈ H265 (±2°)** — compensation arcs at 12°/23°/34° in both directions all read as two families; **chroma RISES with lightness** (.032 ground → .041 frame → .054 panels → .060 lines) — quiet working ground, richer panels lifting off it. Values (oklch annotations live in app.css): `--bg #050b19` · `--frame-bg #121b2f` ⚓ · `--surface`/`--surface-raised` `#1c2844` ⚓ (one value, TWO ROLES) · `--border #2f3d5d` · `--frame-line = mix(border 90%, frame-bg)` · `--rp-grid = mix(border 55%, frame-bg)` — the last two DERIVE from `--border`, one line-source site-wide. `--muted #a3b1c3` (Nate). `--rp-active #757f93` — its own value now, NOT the `--neutral` alias: sampled by Nate from the happy accident where movement blocks' leftover translucent `#717898` composited over the strip. **Movement/non-infused input blocks paint NO fill over the active strip; only the elemental-normal infusion mix may overlay it.**

## Surface ROLES (Nate's split — both tokens kept even while values match)

- **`--surface` = MODALS** (anything overlaying content): pages panel, chrome overlay pane, TB detail modal, loadout/con popovers, load-rotations modal, bar tooltips, instrument-picker + value-wheel menus, PNG-export popout. All wear `border: 1px solid var(--border)` — the load modal's dire border is RETIRED (dire border grammar = tool frames only). **Exception: the TB detail modal keeps its element-tinted border** (the one modal that earns an identity edge).
- **`--surface-raised` = IN-PAGE panels** (not a frame ground): shared `.panel`, Atlas cards, character cards — same border, except character cards keep the element-mixed border (brightened 22%→42%).
- **The top-light hairline highlight (`inset 0 1px 0 rgba(255,255,255,…)`) is PERMANENTLY RETIRED on panels** — 8 sites removed; the border carries separation. Don't reintroduce.
- ⚠ The crit heatmap is the ONE instrument whose `.frame` sits inside a `.panel` wrapper (grid behavior only) — `.cv-heatmap-panel` must neutralize every new `.panel` trait or the heatmap double-borders (bit us twice: hairline, then border). Its canvas ground READS `--frame-bg` from the cascade per draw (was a detached literal — the one frame Nate's devtools tuning couldn't reach).

## Fills are TINTED, not white

White alpha desaturates what it lifts. `--fill-rest/-hover` = calm at 13%/20% at `:root`; the dire-maroon grounds (`.site-chrome`, `.rp-tab-bar`, `.tb-tabs`, `.ws-toolbar`, `.ws-bar`) **re-declare** both with dire. ⚠ Re-declared, NOT routed through a tint variable — custom properties substitute their `var()`s at the declaring element (the same law that forces `--sel-fill`'s re-declaration in the tool zone; documented at the accent zoning in app.css). **Blend modes rejected**: `mix-blend-mode` per control = stacking context + compositor cost on hundreds of elements (WebKit scar tissue).

## ⚠ The mirror-sweep list (any surface-token change must touch)

`timelineExport.ts` literals (CHART*BG / GRID / LANE_LINE / ACTIVE / PORTRAIT_BG — and GRID/LANE_LINE are \_resolved* color-mixes: recompute, don't copy the expression) · the viz instruments' frame-ground cutout strokes (Wish/DefRes/ReactionCurves `stroke=`) · `notationEditorExtension.ts` fallback. The heatmap canvas no longer needs the sweep (reads the cascade). GaugeInstrument's two `#081225` are dark INK on bright badges — deliberately NOT ground, leave them.

## Also in the round

- Brightness calibration: `--frame-bg` lightness sampled from Nate's +30% Affinity reference; frame/line/grid L-rungs re-anchored through his picks.
- Planner view cluster (TOTAL / − + / NOTES) shares one height knob `--rp-cluster-h` (20px); `.rp-ruler-total` rides `--fill-rest`.
- SlotPortrait pill wells: gradient dark end = `mix(55% frame-bg into --bg)` (raw `--bg` read too deep).

## Follow-up queue (Nate, at wrap-up)

1. **Opus 5 survey session**: sweep the whole site for stragglers of the old scheme — leftover literals, one-off alphas, anything not speaking the new tokens/roles — "codify as one style even further."
2. **Fable styling session**: small design choices — buttons, borders, control details.
3. ✅ Real-Safari soak on this round CLEARED by Nate 2026-08-12 ("everything is green"). ⚠ The border architecture it names is moot — the dire border was deleted.
4. Landing hero-card resting contrast (pre-existing, Nate's plate) — the brightened tools may make the landing's faintness more noticeable.

Related: `docs/rounds/color-families.md` (updated with pointers; its laws still hold — accent zoning, gilt ceiling, domain/UI-state split) · `docs/archive/dire-border-handoff.md` (architecture still accurate; colors/knobs superseded by this round) · `docs/rounds/style-reference.md`
