# The TALL BENCH round — 2026-08-06, gates green, ✅ MERGED + PUSHED (`c869861`)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Nate's brief: _"the bench as a vertical strip that is always slightly taller on
both ends than the tool surfaces next to it… about 12px on each end"_ + the
double border from his mockup. Follows `docs/rounds/bench-band-round.md` (which built the
ribbon) and closes the "coverage block is housed by neither" item from
`docs/rounds/archetype-consistency-pass.md`.

**One commit, `c869861`, in `main` and pushed. The `feat/tall-bench` branch ref was deleted 2026-08-08 once confirmed fully merged.** Files touched: `app.css`,
`SlotPortrait.svelte`, `TeamBonusesBlock.svelte`, `benchBand.svelte.ts`,
`BenchBand.svelte`, `(tools)/+layout.svelte`, `RotationTimeline.svelte`,
`team-builder/+page.svelte`, **new** `team-builder/lib/TeamStrip.svelte`,
**deleted** `team-builder/lib/Bench.svelte`, styleguide, 3 probes re-pinned.

## The height contract (the round's core)

- **Each dock STRETCHES with its frame** — `top`/`bottom` insets, never a
  `height`. Both are `-(1 + RIBBON_OVERHANG_Y)` because absolute insets resolve
  against the **padding** box, which is inset from the border box by the
  frame's 1px border ONLY (not by its padding — the first attempt added
  `.rp-frame`'s 10/4 padding and put the strip 10px too high).
- **`RIBBON_OVERHANG_Y = 12`** ⚓ Nate's knob. Measured result: strip y=97 on
  both tools, bottom = frame bottom + 12 on both.
- **HORIZONTALLY it is FLUSH, not proud** (⚓ Nate, same day): the strip's left
  edge sits on the **content margin** — x=32, the same line as the logo, the tab
  row and both frames. It stands proud vertically and nowhere else. That made
  `RIBBON_UNDER = RIBBON_W − FRAME_BORDER` (189) and `RIBBON_OVERHANG` exactly
  1px, and each tool spends the reclaimed 15px on its gutter:
  **the planner's `GUTTER_W` decoupled from `LABEL_W`** (gutter 175 = 189 − pad
  14; the CARD stays 160, which is what the PNG export still reads), and
  `--tb-bench-w` 174 → 189. `FRAME_PAD_X` moved into JS so the gutter can derive
  from it instead of duplicating a CSS literal. ⚠ Anything that aligns to the
  tracks' left edge must derive from these: `TeamBonusesBlock`'s caption rail
  was a hand-kept literal (165) and silently fell 25px short — it now computes
  `FRAME_BORDER + RIBBON_UNDER − KEY_INSET`.
- **The layout MEASURES the height** (`measureBenchAnchor` returns `h`;
  `benchHeight` → BenchBand's `height` prop). It is no longer summed from the
  cards. It relaxes on the world clock during a tool fade (`benchTraveling`),
  and **snaps** when arriving from a dockless tool (`wasDocked` — growing it
  mid-fade reads as the box inflating).
- **A ResizeObserver on the anchor** is new and load-bearing: the planner's
  frame changes height on every notation edit / zoom / notes toggle / tab-bar
  wrap, with no resize event. (Guarded by `!benchTraveling`; can't loop — the
  strip is out of the page's flow.) This also closes the tab-bar-wrap item
  `docs/rounds/bench-band-round.md` left open.
- **`RIBBON_HEAD = 36`** = `(1+10+RULER_H 28) + 12 − CHROME 15`: dead space
  above the first card so the cards still land on the planner's track rows.
  BOTH tools carry it, or the cards would jump vertically across the fade.
- **Content floor**: `boxH = max(measured, chrome+head+cards)`. At 720p the TB
  frame is SHORTER than four cards; clamping to it sliced the 4th card off
  inside the frame. (The strip still runs past a 720p viewport bottom — as it
  did before this round; mobile pass's problem.)

## The double frame — measured off Nate's 2× mockup, not guessed

`sharp` raw-pixel scans of the image (the eye read it wrong twice):

- Strip **190px** wide = card 160 + **15 chrome per side** = `RIBBON_EDGE 4`
  (bare ground, **no stroke**) + `RIBBON_FRAME_BORDER 2` + `RIBBON_PAD 9`.
- The "two borders" are **two strokes on ONE box at ONE inset** — identical
  size and color, differing only in corner radius, so the straight runs
  coincide exactly and only the CORNERS differ: the wide arc cuts across the
  tight one. That is the "extra rounded corner inside". Implemented as two
  absolutely-positioned `.bb-frame` pseudo-spans (not wrappers — they must not
  touch the card column's box).
- The mockup's outer "border" is **the ground's own edge** against the page —
  there is no outer stroke. The old 1px `--frame-line` border is gone.
- **The radii, settled by Nate at the browser:** `RIBBON_RADIUS 3 /
R_TIGHT 3 / R_WIDE 27`. 9 was far too small to read as a second corner (I
  rendered 9/13/16 side by side; the mockup measured ≈13 and he went further).
  **Asked whether 27 should become a variable — the answer given and recorded in
  the constant's doc comment: it already IS a named constant, and it should NOT
  join app.css's `--r-*` scale.** That scale is the BOX vocabulary ("what shape
  is this container's corner"), which 3/6/9 answers site-wide; 27 is an
  ornamental arc meaningful only inside this two-stroke technique, and putting
  it on the scale would invite it onto a card. If the double frame is reused,
  promote the TECHNIQUE as a unit (inset + two strokes + the radius pair +
  `--frame-line-quiet`), never the number alone.
- **`RIBBON_DIVIDER_H = 1.5`** (⚓ Nate, was 1) — and it lives in
  `benchBand.svelte.ts` with the rest of the strip's geometry precisely because
  he couldn't find it inside BenchBand's style block. Every number that shapes
  the strip belongs in that one file.
- **Color → the new `--frame-line-quiet` token** (app.css, beside
  `--frame-line`): `mix(--border 22%, --frame-bg)` ≈ Nate's sampled `#383943`.
  `--frame-line` is the WARM lit rule (`--border` 90%) and read as an edge at
  2px. The quiet line is "same job, one register down — for strokes 1.5–2px wide
  or repeated several times in one object", derives per context like its
  sibling, and now carries **the strip's double frame, the card dividers, AND
  the slot card's control borders** (⚓ Nate: constellation chip + loadout pill +
  ⇄/✕ all one family with the box around them — they all descend from
  SlotPortrait's single `--sp-pill-border`, so it was one declaration). Hover
  mixes re-based onto it too. The popovers were LEFT in their modal register
  (`--surface` + `--border`) — extend there if he meant those as well.
- The card dividers became pseudo-elements so they can run the full width inside
  the frame (the mockup's shelf line) while taking **no height** — card tops must
  stay on the cumulative sum the track groups use.

## What the tall strip displaced (Nate's two "new homes")

1. **Planner lane labels** (TEAM BUFFS / NIGHTSOUL BURSTS / ASCENDANT GLEAM) →
   **into their own lanes** as `.rp-lane-name`: `position: sticky; left: 0`
   inside the lane, so horizontal scroll never takes them away, painted UNDER
   the bars at `--chart-dim`. Bars are free to cover them (Nate's call). The
   label column is now pure reservation — 4 cells and nothing else.
   `RIBBON_LANES_CLEAR` retired entirely (−14px; the lanes reopen directly
   under the 4th track group, restoring the pre-ribbon rhythm).
2. **TB team facts + 15 coverage chips** → **`TeamStrip.svelte`**, a horizontal
   readout across the top of the work zone (Nate picked this over the ribbon
   tail and a bottom status bar). Rationale that decided it: coverage gaps are
   **filter drivers**, so they belong above the roster they filter — and the
   width turns 214px of wrapped column into one row. `.bn` survives as an empty
   174px spacer (`RIBBON_UNDER`) with its hairline dropped (a line no one can
   ever see under an opaque strip). `Bench.svelte` deleted.
3. **`← Explore alternatives`** → the Source picker's own bottom edge (it used
   to dock in the label column). It lives inside `.rp-source-overlay`, which
   stays MOUNTED-but-`[hidden]` — probe-team-builder's check had to become a
   visibility check, not a count.
4. **The tail below the 4th card is deliberately empty** — Nate chose "one team
   readout in one place; the ribbon stays purely the four cards, as the mockup
   draws it."

## Measured (1600×1000, Furina/Bennett/Xingqiu/Kazuha)

|                     | RP                       | TB                    |
| ------------------- | ------------------------ | --------------------- |
| frame               | x 32, y 109, h 793       | x 32, y 109, h 843    |
| strip               | x 32→222, y 97, h 817    | x 32→222, y 97, h 867 |
| card column         | 47→207                   | 47→207                |
| first card top      | 148 (= `.rp-char-block`) | 148                   |
| tail below 4th card | ~134px                   | ~184px                |

Logo left = frame left = strip left = **32**. Tracks / work zone open at **222**
= the strip's right edge.

## Gates

`npx vitest run` 1312 ✓ · `npm run check` 0 · `npm run lint` clean.
probe-bench-band (re-pinned: width 190, chrome+head 51, both overhang checks,
lane names, bench-zone-empty, team-strip-right-of-ribbon, the 720p content
floor) · bench-align 7 · tb-bench-right 17 · tool-slide 14 · buff-windows
(lane-label selector → `.rp-lane-name`) · team-builder (chips `.bn-*`→`.ts-*`;
**1 pre-existing failure** — "detail card lazy-loads the character chunk",
verified on a stashed baseline) · frame-rework, loadout-con-layers, png-dl,
align, sq/durin/planner-slice, scroll-under, site-chrome all pass.

## For Nate's eye

1. The empty tail, especially on the TB where it's ~184px.
2. Lane names under the bars: a buff starting at 0s covers TEAM BUFFS
   immediately. Deliberate; the fallback is dropping them entirely.
3. The TeamStrip's 15 chips wrap to 2 rows at 1280 — fine, but it's the first
   thing to compact if the strip feels heavy.
4. Real-Safari pass (as with the whole frame family).

Related: `docs/rounds/bench-band-round.md` · `docs/rounds/unified-bench-card.md` ·
`docs/rounds/archetype-consistency-pass.md` · `docs/rounds/style-reference.md` ·
[[expose-tuning-knobs]]
