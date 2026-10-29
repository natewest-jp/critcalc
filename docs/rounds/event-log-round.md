# The event-log round — 2026-08-17 (afternoon)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **SHIPPED AND PUSHED**, seven merges ending `effc2fe` (41 commits,
`4f26a15..effc2fe`). ✅ **Verified in real Safari by Nate at every step.** Gates
green throughout (vitest 1570 · check 0 · lint · build · e2e 73 + 73).
Follows `docs/rounds/gauge-marker-grammar.md`.

## ⚓ THE TILE IS THE VIEWPORT (Visualizers)

The one tool surface that page-scrolled, carrying both bands off the top of the
window. **Three defects, each hiding the next:**

1. **The grid row was never pinned.** All eight instrument roots declared
   `height: 100%; overflow-y: auto` and _none of it ever ran_ — the tile's
   implicit row was `auto`, whose minimum is MIN-CONTENT, so the row grew past
   its container and no instrument was ever taller than its own box. Measured at
   2-up: `.ws` capped at 796px holding 1053px tiles. ⚠ Same silent failure as
   `.tool-stack--fill`'s old `height: 100%`. ⛔ `minmax(0, 1fr)`, never `1fr` —
   `1fr` IS `minmax(auto, 1fr)` and the `auto` is the guilty term.
2. 🐛 **Two checkboxes escaped the clip.** `.check input` is `position: absolute`
   with no positioned ancestor, so it resolved against `.tool-stack` and reported
   a 1016px bottom from inside a 740px tile. Both `.check` and `.toggle` carry
   `position: relative` now. ⚠ Latent since those labels were written.
3. **`--band-gap` was missing** from `.ws`'s height sum — the bands stopped
   abutting 2026-08-09 and the calc was never told. 4px of permanent page scroll.

⚓ The scroll lives on `.ws-body`, not the instrument: the roll-off mask needs
`use:scrollFade` on the scroller, and there is one tile against eight roots.

## ⚓ THE CHART OWNS **WHEN**, THE PANEL OWNS **WHAT** (Gauge Explorer)

⚓ Nate: adding applications pushed the editor down while the results were up.
An application's TIME is a position on the time axis, and it was being set by a
slider in a list far below it — three lines per row, ~800px at eight.

- Drag a pill along the marker band; click bare band to add; ←/→ nudge 0.1s
  (Shift 1s); Delete removes. The panel is **one fixed-height inspector** for
  whichever marker carries the gold ring.
- 🐛 **The ordering complaint was real but not where it looked.** `simulateGauge`
  always sorted — but it numbers events in TIME order while the editor listed
  INSERTION order, so the log's #1 could be the panel's third row. `appRows` is
  sorted by time with **stable ids** now (⚠ identity, not position: the list
  re-sorts under a drag).
- 🐛 **The axis FREEZES for the length of a drag** (`dragDomain`). The domain
  grows with the last application's time and x is a fraction of it, so dragging
  the rightmost pill right pushed the axis out from under it.
- 🐛 **The Applications panel moved to the HEAD of the flow.** `.panels` is CSS
  multicolumn with `column-fill: balance`; shrinking the panel put it at the
  balance point, and ONE element-chip click moved it x=32 → x=448 and back.
  Column one always starts with the first thing in the flow.
- 🐛 Chrome draws its own `outline: auto` on a focusable SVG `<g>` — the global
  reset only covers `.btn`/`.chip`/`.field`. `:focus-visible` correctly did not
  match, which is how we knew it was the UA's.

## ⚓ ONE GRAMMAR, TWO FEEDS — the log

`$lib/components/EventLog.svelte` owns how a row LOOKS and **nothing else**. The
two tools read different vocabularies: the instrument sees `crystallizeBlocked`,
reverse multipliers and per-reaction consumption; `reactionBridge` has collapsed
all three by the time the IR reaches the planner. ⛔ Never push either
vocabulary into the shared component.

**The row is the application marker in prose:** WHEN · WHAT LANDED (an
element-coloured pip carrying its GAUGE — ⛔ not a row number) · WHAT IT DID.
⚠ Time is its own **tabular** column; inline, the times ragged against the text
and the eye could not run down them. A row with NO time hangs under the one
above it, which is what makes a reaction read as a consequence.

⚓⚓ **The planner's rows are the LANE'S OWN projection** (`buildAuraLog`) — the
same ticks, the same already-collapsed runs, the same spans — so a row and the
mark above it cannot disagree. ⚠ Which means it says **WHO** (the thing the
chart has no room for) and _cannot_ say what each application did to the gauge:
the parse keeps the trajectory, not the amounts. ⛔ Don't reconstruct them by
re-running `simulateGauge` over `applications` (sorted list, unsorted feed).

🐛 **PAPER INVERTS THE INK LADDER.** Built from `--text` (lead) and `--muted`
(sub), applications came out FAINTER than the reactions under them in the
Explorer's readout card (measured: `--text` #495366, `--muted` #3b4255). The
component takes **ONE ink** and derives the rest by alpha, so it cannot invert;
the anchor is the caller's to name via `--el-ink`.
🐛 **And the default had to be a `var()` fallback at every use site**, not a
declaration on `.el-log`: a custom property set ON an element beats the same
property inherited INTO it, so the tidy version silently ate the caller's
override with no warning anywhere.

## ⚓ ONE FOCUSED INSTANT, whichever surface drives

`auraFocus` (seconds) is set by the plot, an application pip, a reaction marker
AND a log row; the crosshair, the pips, the markers and the log's rows all read
it. **The pointer wins** over the log's hover — two cursors on one axis is a
chart with two answers.

- ⚓ **Two scalars in seconds is the whole coupling.** The chart is the surface's
  `main` box and the log its `aside`; neither may reach into the other's DOM.
  ⛔ Nothing richer (a row index, an element ref, a scroll offset).
- ⚠ **The REACH travels with the hover**, because only the chart knows its zoom:
  one pixel is 1/20th of a second at `ZOOM_MIN` and 1/120th at `ZOOM_MAX`.
- ⚠ A run carries `endTime` — containment, where a discrete event is proximity.
- ⚓ **Ink brightens on the chart, a ground fills in the log.** A row has AREA; a
  marker is three pixels of ink and a fill would be bigger than the mark. The
  pip takes a white RING (its body is the ELEMENT and must stay legible as one;
  ⛔ gold means SELECTED).
- ⚠ A ROVING TABINDEX, not 300 tab stops. `focusin`/`focusout` beside the mouse
  pair — ⛔ the a11y rule asks for `focus`, which cannot do the job because it
  does not bubble.

🐛🐛 **`plannerView.scrollToSeconds` is deliberately NOT `$state`.** Writing a
`$state` class field READS the old value to compare it, that read is tracked
inside the effect doing the writing, and so the registering effect depended on
what it set: **4,004 console lines** of register → cleanup → register on one page
load, settling on a cleanup. The handler was null and clicking a row did nothing,
silently, because the call site is an optional-call. ⚠ Wrapping the CLEANUP in
`untrack` was not enough — the WRITE is the tracked read.

## ⚠⚠ A BACKGROUNDED TAB FREEZES `requestAnimationFrame`

Two confident, wrong findings came from this one cause: `behavior: 'smooth'`
looked like a silent no-op on the track scroller (I got as far as a hand-rolled
rAF tween and a note blaming the `scroll-fade` mask, "confirmed" by deleting the
mask), and then a plain rAF write looked dead too — which is what gave it away.
Verified with real clicks in a FRONT tab: the one-line native call is correct.
⛔ **Check tab focus before blaming rAF-driven code**, and treat a CDP-driven
measurement of anything animated as suspect.

## The four tweaks that closed it

- `(Buffs)(Auras)`, reversing that morning's order so Auras sits beside Log.
- A mark of its own for Log: Lucide **`Logs`**. ⛔ `ClipboardClock` — at 14px a
  clipboard with a clock in it is two objects and a dial in a stroke-only box.
- ⚓ **White on a halo, not dark ink on an element** — the log pip AND the
  Explorer's chart pill, on the palette's `bar` rung with the halo at the
  timeline's own `shiftHue(_, 0, −30)`. The hairline keeps `main`.
  ⚠ FULL-opacity #fff; alpha-reduced white lets the shadow bleed through.
- "How the aura is modelled" moved to the head of the Log (inside the scroller).
  ⛔ `plannerView.hasAura` retired with it — it existed for that one gate.

## ⚠ The vertical budget, measured

The planner's chart frame lives in **`viewport − 300px`** of fixed page (chrome +
both pads + both bands above; the bonuses strip, composer and bottom pad below).
`--tool-pad-bottom` 3rem → 1.5rem funded `AURA_PLOT_H` 56 → 80 at **zero net
cost**. ⛔ The next 24px does not exist for free — it comes out of track rows.
