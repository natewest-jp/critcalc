# Sub-pixel rendering laws (Chrome vs WebKit)

> Moved from Claude's working memory on 2026-10-29, where it was kept as a living reference. Check the code before relying on a detail.

Learned the hard way over the bench-card polish round, 2026-08-06 (see
`docs/rounds/bench-band-round.md` for that round's narrative). **In-repo homes, all
pushed:** `/styleguide` § Laws → **Safari / WebKit** and **Type** blocks (the
authority, full prose) · `CLAUDE.md` § Coding Conventions (three-clause
summary, loaded every session) · `scripts/probe-ink-centering.mjs` header (the
method + the numbers).

## The three laws

1. **Alpha lives in the PAINT, never in element `opacity`** — on anything
   transform-placed at measured (fractional) coordinates. WebKit rasterizes an
   opacity<1 subtree at ROUNDED device coordinates, so it visibly _dances_ on
   hover. ⚠️ The trigger is element opacity **wherever it sits**: dimming the
   bench icons with their own opacity danced, and so did moving the dim onto an
   overlay pseudo that carried `opacity`. What worked: a translucent
   `background-color` / gradient with alpha in the color stops, transitioned as
   a color (`fill-opacity` is the SVG equivalent — the chrome round's fix).
   Same family as the chrome ⓘ jitter in `docs/rounds/unified-chrome-areas.md`.
2. **Symbol marks are inline geometry, never unicode characters.** ⇄/✕ aren't
   in IBM Plex, so each engine drew its own fallback face at its own size —
   Safari's ✕ came out visibly smaller than the Chrome-tuned size. No
   `font-size` can fix that. (Extends the chrome round's marks-must-be-geometry
   rule from SVG `<text>` to unicode glyphs in buttons.)
3. **Centering a label centers its BOX; what you see is its INK.** They differ
   by the glyphs' side bearings — and by `letter-spacing`, which lands after
   the LAST glyph too and shifts a short label off-center. Rules of thumb:
   no tracking on a value inside a round control; a **lone digit is already
   perfect** (tabular figures are drawn centered in a uniform advance — which
   is exactly why picker pips never needed a nudge and `C0` did); a letter
   beside a digit needs a measured optical nudge.

   ↻ **2026-08-12 — the C-chip's `text-indent: -0.07em` IS GONE, and the way it
   went is the better fix**: ⚓ Nate cut C0–C6 as VECTOR GLYPHS from IBM Plex
   Sans, so the value stopped being text. A path has no advance box, no side
   bearings and no tracking residual, and nothing for WebKit's snapping to move —
   `place-items: center` is simply correct in both engines. ⚠ **The LAW survives
   the case that produced it**: this one control stopped centring ink by centring
   a box; every other typeset value still does. And the swap has its own price —
   it removes the value from the DOM as a STRING, which broke nine e2e assertions
   across three engines and would have hidden it from assistive tech had the
   aria-label not carried it. See `docs/rounds/bench-card-round.md`.

## ⚠️ Tune against CHROME — the engines don't measure the same thing

**WebKit snaps glyphs to whole pixels on both axes while boxes keep sub-pixel
positions. Chrome positions glyphs sub-pixel.** Swept a control 0→0.875px:
Chrome held dx −0.313 / dy −0.484 at _every_ offset; WebKit's marched linearly
with it (dx +0.063→+0.813, dy −0.234→+0.641 — a full pixel of range).

- A Chrome reading is a property of the font + CSS. **A WebKit reading is only
  true at the position it was taken at.**
- ⚠️ The shipped −0.07em is partly tuned to WebKit at Nate's dock position.
  **Don't "correct" it to Chrome's constant (~−0.025em) without asking** — it
  would visibly worsen his Safari.

## ⛔ Not fixable in CSS — don't re-litigate

- **`text-box-trim` / `text-box-edge` are a dead end here** (checked, reverted).
  Both engines support them and they DO shrink a text box (10px→6.98 at our
  size), but Plex Sans already seats cap-height ink on center under ordinary
  centering (ascent−cap ≈ descent), so the trim moves the box and not the ink —
  ON vs OFF measured byte-identical. It also can't reach a grid/flex control's
  text at all: non-inherited property, anonymous text item.
- The residual ~0.5px **vertical** is the WebKit snapping above, not leading.
- ✅ **The dock rounding is BUILT (2026-08-07)** — and NOT the way this memory
  used to describe it. Two corrections for anyone reading the old plan:
  - **Round the LAYOUT, not the transform.** The fractional dock came from
    `--tool-pad-x: clamp(1rem, 2vw, 2rem)` in `(tools)/+layout.svelte` — 2vw is
    fractional below 1600px (measured 27.313 @1366 · 28.797 @1440 · 30.234
    @1512; exactly 32 at the clamp). It is now `round(2vw, 1px)` with a plain
    `clamp()` fallback declaration above it. Rounding the ribbon's _transform_
    instead would have been actively worse: the dock is exactly co-located with
    the frame it measures (verified identical to 3dp at 7 widths), so rounding
    only the strip would have pushed it up to 0.5px off the frame's laid-out
    edge — a seam that varies with window width.
  - **The stated blocker was stale.** Nothing in `probe-bench-align`,
    `probe-bench-band` or `probe-tool-slide` asserts sub-pixel dock equality —
    every tolerance is `<= 1`px. The ≤0.03px glue check belonged to the
    rigid-sheet pan, which the world-locked fade retired. No re-pinning needed.
  - **Y is rounded at the transform**, in `measureBenchAnchor` (x/y/h) — its
    fraction comes from the text line boxes above the frame and can't be
    rounded at the source. That also closed a real cross-tool gap: the RP dock
    measured 97.109 against the TB's 97.375, a quarter pixel that WebKit's
    glyph snapping could turn into a whole-pixel label jump on arrival. Both
    now land on 97. Round at the ONE measurement boundary so the WAAPI drift
    target and the rest position are the same number.

## How to measure (three ways to be confidently wrong)

`scripts/probe-ink-centering.mjs` — `SEL=` / `SWEEP=` / `SHOTS_DIR=` (annotated
renders draw the true center and the ink center).

1. **Font metrics can't see it.** canvas `measureText` modelled a +0.81px
   offset as +0.06px. Rasterization IS the effect — measure rendered pixels.
2. **An element screenshot is not a reference.** Playwright rounds clip rects
   to whole device pixels and the ribbon sits at fractional ones (±0.5px, and
   differently per engine). Use a device-ALIGNED clip (exact analytic center)
   **and** the control's own stroke as a second reference; they cross-check.
   The stroke ref is INVALID when the shape overflows the clip — a zone inside
   the wider pill read a fake 1.56px that way.
3. **Judge by ink BBOX, not mass.** `R1` is bbox-centered while its centroid
   sits 0.7px left (the R outweighs the 1). The probe flags that split instead
   of inviting a chase.

Related: `docs/rounds/bench-band-round.md` · `docs/rounds/unified-chrome-areas.md` (the
no-filters/no-element-opacity origin) · `docs/rounds/style-reference.md` (/styleguide is the
authority these laws now live in) · `docs/rounds/scene-occlusion-perf.md` (real-WebKit
probing setup)
