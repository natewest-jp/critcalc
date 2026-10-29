# Team Builder / Atlas round — 2026-08-11

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **MERGED `30660c1` + PUSHED** (branch `polish/tb-atlas-round`, 5 commits).
Gates: 1329 vitest / check 0 / lint / build · **e2e 68 CHROME + 68 WEBKIT green
on the tip.** ✅ **REAL SAFARI CLEARED — ⚓ Nate 2026-08-12: "everything is green."** It moved a ramp rung, every band
plate's compositing, and two shared scrollers onto masks.

**A Team Builder round that kept turning into a palette round**, because each
card decision ran into a value that was not ready for it. That is the shape to
remember: the Atlas work is downstream of four palette changes.

---

## 🎨 THE RAMP MERGED — slate-900 and slate-950 are ONE rung

`#262c38` / `#1c212b` → **`#1f2635`**. ⛔ **`--slate-950` no longer exists.**

⚓ Nate: "900 is a little less saturated than its sibling tokens." The curve
agreed from both ends: absolute chroma sits on a **.028 plateau** across
600/700/800 then falls off a cliff (.0236, .0205); saturation (C/L) climbs
monotonically **.053 → .081** for seven rungs and **900 is the only rung that
breaks it**.

⚠ **At this depth the chroma decision is nearly moot and the lightness one is
not** — "hold the plateau" (#1f2635) and "continue the taper" (#202633) are two
blue units apart. What the eye gets is DEPTH: **ΔL from slate-800 .0358 →
.0595**.

- Followers that carry its rgb as a literal: **`--glass-well`** (rgb 31 38 53)
  and **`CHART_BG`** in `timelineExport.ts`. ⚠ The export mirror caught the
  second — that is the _second distinct way_ a resolved literal goes stale (last
  time `--border` moved; this time the other input did).
- ✅ It settled an open question it wasn't aimed at: the flat bench controls had
  shipped at one rung with a note that it might be too soft for a borderless
  well.

## ⛔ `--glass-blur` IS RETIRED

⚓ Nate: perf lag on Atlas hover-lifts and cross-tool pans; confirmed after:
**"Safari is back to buttery smooth."**

⚠ **STRUCK, NOT ZEROED — that distinction IS the fix.** `backdrop-filter` at ANY
value keeps the composited layer, the per-frame backdrop read-back, the stacking
context and the containing block. `blur(0px)` pays the whole bill for none of the
effect.

- ⚠ The old comment "perf was never the objection — the star freeze holds one
  frame at rest so the blur rasterizes once" is **the thing that was wrong**:
  right about the resting case, irrelevant to the moving one. A cache argument
  only covers the state where nothing is happening.
- ✅ **Not one glass stop moved**, because the alphas were always measured
  unblurred (a probationary property may never carry legibility). That rule is
  what made it a one-line decision.
- ✅ **A constraint left with it:** glass no longer mints a containing block, so
  "anything absolutely-positioned inside a band must portal" is retired. BandMenu
  still portals for its original reason (clearing the band's bounds).
- 📌 The **banding finding survives its token** — a bigger blur manufactures a
  gradient over near-black and bands. It decides the answer if anyone proposes
  bringing it back BIGGER.

## 🌫️ `scrollFade` — a soft roll-off at a scroller's live edges

`src/lib/actions/scrollFade.ts` + `.scroll-fade` in app.css. Consumers:
`CharacterGrid` (36px), `CharacterFilterRail` (24px), `.tb-source` (default).
⚓ Nate: **"we'll be reusing it for the left and right edges of the rotation
planner's timeline."**

- ⚠ **It MUST be a mask, not a gradient scrim** — both consumers sit on the bare
  dimmed scene, so there is no ground to fade FROM and any colour would be a
  smear over the live world. ⛔ Do not "simplify" it into a `::before` gradient.
- Two behaviours that are the design: a fade appears **only at an edge with
  content beyond it**, and it **grows over the first `--scroll-fade` px** rather
  than snapping on. A scroller with nothing to scroll gets no edges — which is
  what makes it safe to attach unconditionally.
- 🎛️ `--scroll-fade` is per-consumer and **the action reads the same property**,
  so the clamp and the gradient cannot disagree.
- ⚠ Safari watch: a mask makes a composited layer inside the WAAPI-drifting
  `.tool-page`. If it jitters, drop the mask for the drift — don't retune.

## 🃏 THE ATLAS CARD — four across, portrait, split

**Was** 656 × 210 (3.12:1) in a 2×2. **Now** ~311 × 500 max, one row of four.

⚠ **THE SHAPE WAS CHOSEN BY ARITHMETIC.** Two rows must divide the leftover
height, so a 2×2 card's ratio is `1020 ÷ (H − gap)` and **doubles as the window
shortens**; one row divides nothing:

| grid height H   | 2×2 @ 1040 | 4×1 full width |
| --------------- | ---------- | -------------- |
| 564 (1600×1000) | 1.88:1     | **0.55:1**     |
| 464 (1600×900)  | 2.30:1     | 0.67:1         |
| 364 (1600×800)  | 2.97:1     | 0.85:1         |
| 284 (1600×720)  | **3.86:1** | 1.10:1         |

The 2×2 becomes a banner again below ~900px of viewport; the row never leaves
portrait. **One degrades gracefully, the other degrades into the thing the round
set out to fix.**

- ⚠ **The seam is HORIZONTAL, reversing /lab's prototype.** That one splits
  left/right and was right for a 480×132 banner; on a block the same split
  starves the identity half.
- ⚠ **Nate's watermark art crossed to the parchment half** once he redrew it in
  the paper's own ramp (parchment-100/200) — which retired the old "clip it to
  dark or it inverts" constraint. **Alpha is baked into the SVG**, and that is
  the general move: _alpha inside an SVG used as a `background-image` is
  rasterized into the image and never becomes a CSS transparency layer_, so the
  sub-pixel hazard cannot arise. ⛔ Don't reintroduce a CSS `opacity` to tune it.
- ⚠ **`background-size: contain` on square art means WIDTH is the only knob** —
  raising `height` alone is a silent no-op.
- **Content:** a `--fs-5xl` readout (gold on `owned`, the only PERSONAL fact), a
  hairline rule, then seven **1fr** rows that own the remaining height. The
  earlier `margin-top: auto` left ~30% of the card dead in the middle.
- ⚠ **The element NAME is load-bearing**, not decoration — icon-left +
  number-right across a full row leaves a ~150px hole unless something fills it.
- ⚠ **Flush numbers are only safe because the set is CLOSED**: `byElement`
  filters `ATLAS_ELEMENT_ORDER`, so `'none'` → "Physical" (the one label that
  would ellipsize at 5em) is unreachable.
- ⚠ **`1fr` rows are NOT infinitely compressible** — a grid track cannot go below
  min-content (here the 22px icon at 24px), which is what sets
  `--atlas-card-min-h: 425`.
- ⏸ **Element pips on parchment are all under 3:1** (cryo 1.14, geo 1.36, anemo
  1.38 … hydro 2.92) against 3.36–8.59:1 on slate. ⚓ **Nate: that is the
  `--el-*` round's job and NOT a reason to move them** — "only go for the optimal
  layout logically." The pips ARE the provides figure decomposed
  (9+7+8+6+5+7+6 = 48); splitting a number from its own breakdown across the
  card's one seam would halve a fact.

## Smaller, still current

- **`--inset-line-mid`** = gold-600 @ .42 — for an inset that crosses a SEAM and
  can take neither context's zoned rung. ⚠ gold-600 is the balance point **and
  not by coincidence**: it is the rung between the two zoned accents, so a value
  serving both grounds lands halfway between the two that each serve one
  (3.43:1 glass / 3.31:1 paper at full strength). .42 is `--line-edge`'s alpha —
  the top of the two stops left declared-but-unclaimed for a future ornament.
- **`.night-ribbon`** in app.css — ⏸ **DECLARED BUT UNCLAIMED.** It nearly took
  the Atlas drill's row headers; ⚓ Nate sent it back ("interesting, may get a use
  somewhere, but this one doesn't quite cut it"). ⚠ **The difference that decided
  it: a night paint conditions the WORLD and carries no ink ladder; glass is a
  MATERIAL and does.** Measured en route and it inverts the obvious answer — a
  scrim DARKENS the worst pixel (a star goes rgb(76,76,78) → rgb(45,46,51)), so
  `--muted` reads **6.17:1 on a night ribbon** against 3.92:1 on bare night.
  "No rungs" is a decision about what the night IS, not a contrast floor.
- **`.btn.btn--glass`** — a band plate for a button outside a band. ⚠ Written
  with BOTH classes: the band selectors are two-deep and beat plain `.btn` for
  free, but a lone modifier loses on source order. Measured — it rendered opaque
  at REST while hover worked, which is the signature of exactly that. Needs
  `.ctx-glass` on itself.
- Bench strip **stays slate-800**: composited, `--glass-panel` .58 over the
  washed scene lands ~#262b36–#293040, i.e. _on_ slate-900 — so the strip stands
  one rung ABOVE its neighbours, which is what makes it the solid object among
  panes.
- Coverage: "This team covers"; `--cover-measure` 1000 → **1040** (the run needs
  826px for two rows at 12px chips and was getting 807.4 — the type size-up
  tipped it from nowhere near it). `--tb-measure` on `.tb-stack` is the surface's
  centred measure, one consumer.
- Disabled Compare tab takes `cursor: help` — works **only because
  `.tb-nav-item` is not a `.btn`** (the global `.btn:disabled` sets
  `pointer-events: none` and would kill the title with it).

## ⏭ Open / next

- ⚓ **Next sessions, agreed: the CHARACTER CARDS, and the COMPARE TAB.**
- ⏸ The **`--el-*` round** — light-context element colours and icons. Now has a
  concrete target (the Atlas pip table above).
- ⚠ **Role SVGs are edited IN PLACE at unhashed `/assets/*` paths**, which
  `static/_headers` serves `immutable, max-age=31536000` with an explicit
  add-only rule. Nate: **fine for now (sole viewer), revisit post-launch.** The
  fix mirrors `generate-element-icons.mjs` (content-hashed filenames).
- 🐛 **Rebuild between asset exports** — a stale `build/` behind a running
  preview served the previous SVG and made a measurement pass look like a bug in
  the file.

Related: `docs/rounds/palette-definition-round.md` · `docs/rounds/bench-band-round.md` ·
`docs/design/subpixel-rendering-laws.md` · `docs/rounds/team-builder-atlas-roles-facets.md`
