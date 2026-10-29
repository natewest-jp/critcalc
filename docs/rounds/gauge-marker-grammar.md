# The gauge charts converge — 2026-08-17

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **SHIPPED**, six merges, ending `2ebf9e7`. Gates green throughout (vitest 1570 ·
check · lint · build). ⏳ **Real Safari is unverified for all of it** — the whole
round is visual. Follows `docs/rounds/gauge-round-L6.md`.

## ⚓ ONE APPLICATION MARKER, BOTH TOOLS

Read top to bottom: **what it CAUSED** (reaction) → **what LANDED** (an
element-coloured pill) → a **HAIRLINE** down into the gauge it changed.

- The Explorer's pill carries the unit NUMBER. ⛔ No "U": the axis and the panel
  below both say it, and "1.5U" bled out of the disc. Condensed face — ⚠️ that
  face is STATIC 400/600, so 700 folds to 600.
- ↻⚓ **WHITE ON A HALO, NOT DARK INK (2026-08-17)** — ⚓ Nate: "I simply don't
  like dark ink on elemental colors." The disc takes the palette's `bar` rung
  (the one derived for "a fill with white written on it") with the halo at the
  timeline's own `shiftHue(_, 0, −30)`; the HAIRLINE keeps `main`, because it
  runs into the plot and must be the ink of the curve it points at. ⚠ FULL
  opacity #fff — alpha-reduced white lets the shadow bleed through the glyphs.
  ⚠ On the SVG pill the halo is `text-shadow`; `paint-order: stroke fill` draws
  a HARD outline and would not match. The planner's LOG pip is the same object
  and moved with it — see `docs/rounds/event-log-round.md`.
- Its reaction stack anchors to the pill and grows UPWARD (one reaction sat 38px
  clear of its mark when anchored to the top).
- ⛔ The pill no longer carries the application INDEX — the applications editor
  does not number its rows, so it referred to nothing a reader could see.
- Reaction labels **auto-stagger**: greedy left-to-right, lowest tier that clears
  the last occupant. ⛔ Never "alternate every other one" — that lifts labels
  which had nothing to avoid.

⚠️⚠️ **THE PILLS ARE DIFFERENT SIZES ON PURPOSE.** The Explorer draws at most
`MAX_GAUGE_APPS` (8) and can afford 18px discs carrying text; a heavy rotation
makes ~230 applications. Measured on a four-character rotation: 28 applications,
median gap 38px, two gaps under 8px. ⛔ **Don't put text in the lane's pill
without measuring a real rotation first.**

## ⚓ ONE CEILING — and the floor is 1U now

`auraUMax` lives in `$lib/utils/auraDisplay.ts` (re-exported from `auraPlot`).
It was **two byte-identical copies**, and ⚠️ that duplication had already produced
a WRONG BELIEF about how the two charts behave — the Explorer looked like it
scaled and the lane looked fixed, when the only difference was that one labelled
its axis.

**`AURA_UMAX_FLOOR` 2U → 1U.** The 2U floor existed so 0.8U auras could not imply
saturation; ⚓ the NAMED datum answers that better (a label states the scale, a
floor only hints at it by leaving room), and 1U is the measured common case
(corpus 1U ×327, 2U ×58, 4U ×2). ⚠️ Still a floor, not fit-to-content.

🐛 **`auraUnitLines` had to change with it** — it ruled strictly BELOW the
ceiling, which returns NOTHING at a 1U floor, so exactly the shallow rotations
the lower floor serves would have lost their only scale. Tested both halves.

## ⚓ Plot headroom, and where the labels live

`AURA_PLOT_HEAD` (6px) above the ceiling: a line sitting AT the ceiling
(Burning's fixed 2U aura) was being clipped in half, and the top label could not
centre. One geometry change fixed both.

⚠️⚠️ **The unit labels are OUTSIDE the plot, in `.rp-frame`'s left padding, as a
↻ 2026-10-27: the header (ruler + aura lane) is INSIDE `.rp-track-scroll` now; the follower strip, mirror and `onHeaderWheel` are gone (`docs/rounds/preflip-cleanups-round.md`). The passage below is history.
SIBLING of `.rp-ruler-scroll`.** Hanging them off the plot's left edge
(`right: 100%`) gave a perfect `getBoundingClientRect` **and painted nothing** —
the scroller is `overflow: hidden`, which is what makes it a follower. ⛔ Don't
move them back inside. ⚓ Outside it they are a real legend: they hold still while
the chart scrolls under them.

## ⚓ `--ui-provisional` means "could someone MEASURE this?"

- ✅ a cast with no `application[]`, or an entry with no `units` — the corpus
  could carry the number and does not.
- ⛔ a swing or a summon tick — no per-swing/per-tick units exist anywhere, in
  our data or gcsim's, and gcsim's hits are overwhelmingly 25 durability. 1U is
  the RULE there. ⚓ Nate: an exception would be recorded in the wikis and gcsim.

It used to fire on ~75% of a rotation's applications, so the strip read as
entirely uncertain while pointing at no work anyone could do. It draws as a
1px RING on the pill now (the foot moved with its host).

## ⚓ A run of one TICKING reaction is ONE marker

`REACTION_SUSTAINED_BY` (electroCharged / lunarCharged / burning) +
`collapseReactionRuns`. The count rides the NAME ("Electro-Charged ×4").
**Two break conditions, neither a threshold:** a different reaction between two
ticks, or the sustaining auras lapsing (asked of the gauge). ⚠️ A reaction absent
from that map NEVER merges — two Vaporizes stay two events.

↻ **A drawn BRACKET was built and reversed by measurement**: at resting zoom the
label is 82px and the run it names is 72px, so any extent from the pip renders as
an underline of the text. ⚓ **A chart cannot draw a duration narrower than the
duration's own name.**

Marker labels are **DROPPED, never clipped, measured against their own width**
(`auraMarkerLabels` takes a `measure` fn — pure module, each renderer supplies
its own metrics; the export runs 9px where the screen runs 10). An element names
itself ONCE, a compound state EVERY time (`AuraModMeta.compound`).

## 🐛 Bookkeeping series paint LAST

`AURA_MOD_ORDER` groups a mod under the aura it derives from — right for stacking
rows, wrong for PAINT: `burningFuel` (2) before `dendro` (7), and during a burn
the two curves nearly coincide, so the solid stroke covered the dashed one and
the pair read as one badly-aliased line. ⚠️ **A dashed path must also be
BUTT-capped** or every dash grows half its stroke-width at each end and the gaps
close. Sorted at the projection so the row grammar is untouched.

## The demo scenarios are 1U

⚠️⚠️ **THE TRAP THAT BIT TWICE:** a same-element re-application **TOPS UP** to the
new value, it does not STACK. Two 1U hits leave exactly the 0.8U aura one does,
so every "build it up with small hits" idea is silently a no-op. ⛔ Don't reach
for repeated 1U applications to make a bigger aura.

Exceptions are all one exception — a larger first application ONLY where the
mechanic is invisible without a size difference: Top-Up, Reverse Melt (2U),
Vaporize (2U), Freeze (2U), Electro-Charged (2U Hydro), Quicken (1.5U — ⚓ Nate,
and exactly what Nahida applies). "Pyro on EC" is **Overvape** now.

## Other rulings from the same day

- ⛔ **Prose does not SHOUT.** `Emphasis.svelte` renders `**bold**`; ⛔ not
  `{@html}`, and ⛔ never grow it into a markdown renderer. ⚠️ The sweep found the
  habit was already absent site-wide except in six words of Explorer copy.
- ⛔ **Tooltip headers are not uppercased** — `text-transform` turned "4.2s" into
  "4.2S", which reads as a 5 and is a different unit (siemens). ⚠️ That changed
  every tooltip on the site.
