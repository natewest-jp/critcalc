# The Visualizers on the scene (2026-08-13)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**✅ MERGED to `main` 2026-08-13 as `847acdb`** (`--no-ff`, branch
`polish/vz-on-the-scene`, six commits `56b9069`…`3b39ab6`) and **PUSHED**
(`9ddb83d..847acdb`). Gates on merged main: vitest 1329 · check 0/0 · lint ·
build. ⏱️ e2e SKIPPED at ⚓ Nate's call — last green `56b9069` (68 chrome + 68
webkit); everything after it was colour values, one glyph swap and prose.
✅ **Real Safari cleared by Nate**, including the first glass at PANEL scale.

The last tool built out of framed slabs went onto the scene. Detail lives in the CODE — this is
the map and the ⚠ list.

## The rule, in Nate's sentence

> **NIGHT LOOKS · GLASS TOUCHES · PAPER ANSWERS.**

- the **chart** draws on the night, no ground at all
- the **apparatus** (sliders, chips, toggles) is `.panel`, which is now
  `.ctx-glass` — the same material as the bands above it
- the **answer** is `.panel.panel--paper`, and there is **ONE per instrument**

⚠ **The split was DESCRIBED, not imposed.** Five of the eight instruments already
had a panel whose kicker read "Readout"; the other three had its equivalent
(Current Build · What The Next Roll Buys · Enemy Status). Everything else in
every instrument is input. When a rule lands on a label the authors chose before
anyone was looking for it, it is describing the thing.

## Where the reasoning is written

- **`.frame`'s retirement note in `app.css`** — the whole argument, with the
  number that settles it. Read first.
- **the `.panel` / `.panel--paper` block below it** — the material assignment and
  why the modifier carries no declaration of its own.
- **`.band--full` in `ToolStack.svelte`** — the three ways a band can lose its
  ground, in order, and what a tool owes in return.

## Laws this round produced

- ⛔ **`.frame` IS RETIRED, and the reason is a measurement, not a preference.**
  It painted `--frame-bg` = slate-800 `#2e3543`; the dimmed world composites to
  ~`#12151c–#1e222a`. So a "chart interior" — a WELL in the idiom that named it —
  had become the LIGHTEST thing in its tile after the paper. **The lightness step
  that drew it had reversed sign** on the day the world got darker. Same fix the
  planner and TB already made; this was the last caller.
- ✅ **`--frame-bg` SURVIVES AS A NOTIONAL GROUND** everywhere it was painted.
  `--chart-*` mixes against it, the heatmap canvas reads it, a PNG export paints
  it for real. Unpainted reference, painted export — `--rp-chart-bg`'s
  arrangement, generalised.
- ⚠ **ONE PAPER CARD PER INSTRUMENT is a RULE, not a tendency.** Paper is the
  brightest material on a dark world, so a second card does not read as a second
  answer — it reads as the first one having failed to be the answer. The Gauge
  proved it (Enemy Status + Event Log were one thing at two speeds; merged, with
  the transcript under a quiet **non-gold** label — a second `.kicker` would have
  said "second panel" exactly where the merge was trying to stop saying it).
- **A band can lose its ground THREE ways now**, and the reason is always that a
  rail is only honest when it holds ONE run of controls: band A (08-09, spans the
  screen, paints nothing) · the 3-up split (08-10, control · RAIL · control) ·
  **`bandBFull` (08-13, N runs cut by the tile gap)**. ⚓ Nate: _"band A spans the
  whole screen, while band B responds to how many instrument surfaces there are."_
- ⚠ **A BAND'S PADDING LEAVES WITH ITS GROUND, and so does its consumer's.**
  `--band-pad-x` exists to hold controls off a rail's ends; with no rail it is
  just the first plate failing to line up with the surface below. The Visualizers'
  workspace grid had taken that same padding to stay aligned — **the two were
  always a pair and they still are, at zero.** Move one, move both.
- **What a tool OWES when its band stops painting: its controls must become
  PLATES.** A control that kept `--btn-face` there would be an opaque button
  standing on nothing. ⚓ Nate: glass buttons and glass ribbons **next to** each
  other, never stacked.
- **The tile gap DOUBLES to `TOOL_GUTTER × 2`.** With the frames gone the gap is
  the only boundary left, and 20px against a 16px interior rhythm cannot carry
  that — at three-up the arguments read as one field of panels. The planner's law
  one axis over (the gap encodes GROUPING), and the ratio the planner already
  uses where a tool meets a caption about itself.

## 🐛 The bug I caught before shipping — the THIRD instance of one lesson

**`.panel--paper` and `.panel` TIE on specificity, so SOURCE ORDER decides.**
`.panel` joins the `.ctx-glass` selector list _below_ the `.ctx-light` block, so a
lone modifier would have lost and painted the answer translucent slate. Written
**`.panel.panel--paper`** — exactly as `.btn.btn--glass` already is, for exactly
the same reason, and the same shape as the motion round's `@starting-style`
finding. ⚠ **Every context tie in this system is decided this way.** If a modifier
is meant to beat a base class that lives in another block, compound it.

## ⚓ Nate's follow-ups, same day

- **`TOOL_DIM` 0.75 → 0.875, `--scene-dim` #101013 → #121216** (`488d3e1`, his
  values, landed verbatim). ⚠ **The two axes moved in OPPOSITE directions** and
  that is the pair being used as a pair: density decides how much world survives,
  colour decides the floor of the composite.
- ⚓ **THE SHEER THRESHOLD WAS NEVER A PERCENTAGE** (`6a302a1`). The dim bump put
  glass at 5.25% transmission — inside the band three rounds of prose had called
  "sheer again" — and it reads fine. ⚓ _"The sheer problem was due to different
  wash colour and glass colours; we don't need to be so strict about it anymore."_
  Sheer failed because a pane read as **a duller version of its own colour**;
  that is a fact about the composite, not about a number. ⛔ Don't defend a
  percentage — the test is "can you tell, looking at it, that this is
  translucent?". /styleguide's figure is COMPUTED from the imported `TOOL_DIM` (↻ 2026-09-26: `TOOL_DIM` is retired; the census now composites through `dimPixel` in `sceneDim.ts` — `docs/rounds/scene-dim-shader.md`.)
  now, because a hand-written percentage beside a live one is a lie waiting for
  the next tuning pass.
- **Band A's `.segment` track joined the glass-plate list.** It grounded in
  `--fill-rest` → `--glass-parch` (parchment frost @ .10) beside plates at .58 —
  ⚓ "grayer". ⚠ Not an exception to _a control on glass keeps `--btn-face`_: that
  rule is about a control on a RAIL, and band A has none. ⛔ Scoped to band A;
  in opaque contexts `--fill-rest` is the right track.
- **The Gauge's ▶/⏸ → filled `<Mark>`s** and **the heatmap's readout → dark
  glass** (`1516b98`). Two findings worth keeping:
  - ⛔ **LUCIDE IS STROKE-ONLY** — no filled variants of anything. `Mark` grew a
    `filled` prop (fills the same geometry in currentColor). ⚠ **Not a general
    switch**: on an OPEN path it fills whatever the curve encloses and blobs. Use
    it where the solid form IS the idiom.
- ⚓ **THE CHART LINES CAME DOWN, AND HAD TO GO ALPHA TO GET THERE** (`3b39ab6`).
  ⚠⚠ **An opaque mix has a FLOOR, and the floor is the ground it mixes against.**
  `--chart-grid`/`--chart-rule` mixed against `--frame-bg` = slate-800
  rgb(46,53,67) while the night is ~rgb(19,19,23), so at N → 0 they did not fade
  out, they settled onto a distinctly LIGHT hairline. **The grids read heavier
  AFTER the frames came off, not before** — the bill for removing the ground.
  Fix is the mix TARGET, not the percentage: toward `transparent`.
  🎛️ grid `.17` → rgb(37,37,41) · rule `.38` → rgb(60,60,64). ⚓ .17 is Nate's own
  `--rp-grid-faint` value, reused so there is one answer to one question.
  ⚠⚠ **The planner's "majors stay OPAQUE" ruling does NOT transfer** — its majors
  were cut against slate-900 (a near neighbour of its night), ours against
  slate-800 (not). _Same law, different ground, opposite answer — check the
  ground before copying the conclusion._
  ⛔ Nothing struck or faded: the planner needed a fade because its grid is one
  line per second; these charts carry 4–10 labelled ticks per axis.
  ⚠ `--chart-ink`/`--chart-dim` stay opaque — they are TEXT, and the floor that
  hurts a hairline flatters a glyph.
  ⛔ **These tokens have NEVER "inverted for free" per context** (a comment
  claimed they did): a custom property containing `var()` is substituted where it
  is DECLARED, so :root's resolved string is what inherits.
  - ⚠ **"Darkest glass" means darkest RESULT, not darkest hue.** `--glass-well`
    is the darkest colour but the thinnest alpha, so over a saturated field it
    just takes on what it lies over (white text ~2.6:1 over the plot's bright
    band). `--glass-bar` @ .8 is the darkest-rendering stop and carries it at
    ~8.6:1. ⚠ And a glass object over an unknown ground must **claim
    `.ctx-glass`** — `:root` and `.ctx-dark` both declare the line stops OPAQUE.

## ⚠ Watch items

- ✅ **REAL SAFARI CLEARED 2026-08-13** (⚓ Nate: "all safe") — including the
  first glass at PANEL SCALE on the site, which was this round's open risk.
- ✅ **`CritHeatmap`'s white `ink()` is BLESSED** (⚓ Nate 2026-08-13, after a
  look) — it is the instrument's own register and it draws mostly over a painted
  image. ⏸ Two `var(--text)` uses (the CV budget line + its label) are the
  outliers in that vocabulary and were left alone: `--text` is the more
  system-aligned token of the two, so unifying toward `ink()` would move
  backwards. If the heatmap ever gets a proper ink pass, move `ink()` → `--chart-*`,
  not the other way.
- ⏸ The marker dot keeps its `rgba(0,0,0,.35)` halo. That idiom was retired for
  the slider knob, which rides a track of KNOWN colour; this dot rides a rainbow
  and white-on-pale-yellow is where it would vanish.
- ✅ `ArtifactInstrument`'s four `#f7fafc` literals folded to `--text` (⚓ Nate:
  "that's an outdated hex value, isn't it?" — it is, a cool near-white predating
  the parchment palette). **The system's word for the brightest ANNOTATION on a
  chart is `--text`**; `ink()` is the heatmap's local register because it draws
  over a painted image.
- ⏸ Three instruments keep `style="stroke: var(--frame-bg)"` as a 1.5px rim around
  a marker dot. On night that reads as a slightly LIGHT rim rather than a cut-out.
  Kept: at hairline scale it still separates the marker from its curve, and the
  "opaque or obviously translucent" rule is about surfaces, not 1.5px. A knob if
  Nate dislikes it.

## Swept alongside, because each only mattered once the ground moved

Every SVG element `opacity` → `fill-opacity`/`stroke-opacity` (alpha in the
PAINT) · three surviving `rgba(255,255,255,α)` gridlines → `--chart-rule` /
`--chart-grid`, finishing a migration that had left them behind · the 🎲 in the
crit sampler became a `dice` `<Mark>` (new mark, `Dices`) and the 🌱 in the gauge
log simply went. See `docs/design/icon-set.md`, `docs/design/subpixel-rendering-laws.md`.

## Gates

vitest 1329 · check 0/0 · lint clean · build clean · **e2e 68 chrome + 68 webkit**
(Chrome's worker-teardown errors are playwright#39753, documented in
`playwright.config.ts` — read the "N passed" line).

↻ **2026-08-17 — THE TILE IS THE VIEWPORT** (`docs/rounds/event-log-round.md`). The
Visualizers was the one tool that page-scrolled; `.ws-body` scrolls under a
roll-off mask now and every instrument root lost the `overflow-y: auto` that had
never once engaged. ⚠️ Its `.panels { columns: 22rem }` ruling is still untouched
in principle — but note that multicolumn BALANCES on height, so a panel that
shrinks can start jumping columns mid-edit; the fix is DOM order (column one
always starts with the first thing in the flow), not a layout change.

Related: `docs/rounds/rp-scene-round.md` · `docs/rounds/band-plates-round.md` ·
`docs/rounds/palette-definition-round.md` · `docs/rounds/style-reference.md` ·
`docs/rounds/panel-system-audit.md` (its `.panels { columns: 22rem }` ruling is
untouched — this round changed materials, never layout).
