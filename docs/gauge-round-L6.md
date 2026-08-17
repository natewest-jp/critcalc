# Gauge round — L6: surface and honesty

**Status:** ✅ built and visually verified by Nate on the live tool (⚓ _"I'm typing in
rotations and it's leaving me stunned… what we have is already almost entirely the shape
of it"_). ✅ **MERGED + PUSHED 2026-08-16 — `8893da5`** (⚠️ cite the merge, not the branch tip).
That push carried the whole gauge round: 60 commits, L0 through L6, which until then had
been entirely local.
↻ **THE REFINEMENT PASS LANDED 2026-08-17** — the lane moved to the timeline's HEADER,
above the time axis, and became an opt-in LAYER. See [§9](#9-the-reposition-2026-08-17).
⏳ **Open:** real Safari (still — and the reposition re-opens it), and the PNG's own
appearance under the new geometry.
Follows [L5e](gauge-round-L5e.md); the round's contract is [gauge-round.md](gauge-round.md).

L6 is the landing where the gauge becomes something a player can look at. Everything
from L1 to L5e was correctness with no picture: the gauge decides which reactions
happen, the reactions drive buff windows, and what the reader saw was a buff bar
moving. The **target-aura lane** is the cause, drawn.

↻⚓ **It shipped twice.** The first form was one BAR PER MOD, each bar's fill height its
gauge, chosen over the Gauge Explorer's overlaid chart on the argument that concurrent
auras on one y axis would go muddy. ⚓ Nate then read the live lane across several
reaction families and **measured the premise false — auras barely coexist** — so the rows
were spending the lane's whole height on a collision that mostly does not happen, and
each was too short to show the depth the units were bought for. §3 is the second form:
one overlaid plot, a line with the fill fading out beneath it. ⛔ Do not restore the rows
without re-measuring the overlap.

> _"Here is your aura across your rotation, and here is where you lost it."_

---

## 1. What shipped

| piece                       | where                                                      |
| --------------------------- | ---------------------------------------------------------- |
| `ParsedRotation.auraSeries` | `sim/aura.ts` (`collectAuraSeries`) → `sim/finalize.ts`    |
| the lane's projection       | `src/lib/timeline/auraPlot.ts` (+ 23 tests)                |
| the shared mod vocabulary   | `src/lib/utils/auraDisplay.ts`                             |
| the lane                    | `RotationTimeline.svelte` (`.rp-aura-lane`)                |
| the PNG mirror              | `timelineExport.ts` + four new `PALETTE_MIRROR` entries    |
| the standing modelling note | `RotationNotes.svelte`, gated by `plannerView.hasAura`     |
| the Help chapter            | `help/chapters/RotationPlanner.svelte` § The target's aura |

**Three decisions were Nate's**, asked before any code: the lane's FORM (mod rows with
gauge depth), what rides on it (reaction markers **and** application ticks, the ticks
carrying the provisional mark), and where the limits are stated (the Notes panel **and**
the Help chapter).

---

## 2. ⚓⚓ The series comes from the LIVE gauge — never a re-run

The obvious implementation is to hand `ParsedRotation.applications` to `simulateGauge`
at the projection and chart what comes back. **That would draw a model the parse did not
run**, and the reason is L5e's still-open defect: `applications` is SORTED at the
projection and the FEED ORDER IS NOT. A re-run over the sorted list is a different
sequence of `apply()` calls from the one the sim made.

So `createAuraState()` turns `sampling: true` on and finalize calls `closeSeries()`. The
lane draws the gauge's own trajectory — the same object that emitted the reaction events
one row above it.

This is the same rule that put `applications` on `ParsedRotation` in the first place
(L5c), and the round has already paid once for ignoring it: at L4d the oracle replayed
the parser's own rules and reported a baseline for an engine we no longer had.

### The tail has to be walked

The live gauge is caught up lazily — it only ever advances to the next application — so
at the last token it is parked at the last application's frame, carrying an aura with no
samples after it. That decay **is** the "where you lost it" half, so `collectAuraSeries`
settles the gauge first.

`AURA_SETTLE_F` is 60 s and over-shooting is free: `advanceTo` walks only while the gauge
is non-idle and JUMPS the moment every aura is spent. The bound is derived — the longest
an aura can outlive its last application is a top-up onto the slowest decay rate (a 1U
fresh aura decays at `0.8 / (2.5 + 7)` ≈ 0.0842 U/s and keeps that rate when topped up,
so at the 3.2U ceiling it runs 38 s). Frozen, EC and Burning all drain faster or are
bounded by their fuel.

⚠️ Settling runs the gauge's internal tasks past the end of the rotation and their events
are deliberately dropped — `takeEvents` is never called. That is sound for exactly the
reason the wake-up task is unnecessary (L5): the only internal applicator is the Burning
chain and its Pyro provably cannot react. **If that ever changes, a reaction after the
last cast becomes real and this settle has to emit it.**

### Cost, measured

| case                                          | before   | after    |
| --------------------------------------------- | -------- | -------- |
| sampling, over one 1U aura's whole lifetime   | 0.081 ms | 0.182 ms |
| heavy fixture (311 s, 230 applications)       | 4.8 ms   | 6.8 ms   |
| 300 stacked hour-waits (the pathological one) | 40 ms    | 73.6 ms  |

⚓ **The idle skip is what keeps C6 intact.** `advanceTo` tests idleness BEFORE
`stepFrame`, so no sample is taken for a frame nothing happens in — continuous work stays
bounded by aura lifetime, never by rotation length. The hour-waits figure doubles because
that document is 300 real aura lifetimes back to back, not because time is being walked.

---

## 3. The lane

```
           ·Bloom        ·Hyperbloom                       ← reaction markers
TARGET AURA  ¦ ¦    ¦  ¦     ¦        ¦         ¦          ← application ticks
            ╭──╮                                           ┐
       ╭────╯  ╰──╮  ╭──╮                                  │ ONE plot, 56px,
  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │ 1U datum dotted
 ╭╯               ╰──╯  ╰─────╮                            │ every mod overlaid
 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                      ┘ (fill fades down)
```

**Three bands, top to bottom, each annotating the one below it.** Reaction labels, then
the applications that caused them, then the aura they left behind.

- **One overlaid plot, not a row per mod.** ⚓ The reversal is §0's: auras barely coexist,
  so rows were paying the lane's whole height for a collision that mostly does not happen.
  Overlaid, all of it goes to depth — and a swirl-heavy rotation now shows the sawtooth of
  Pyronado topping the aura back up between five swirls eating it down, which the rows
  could only hint at.
- **A LINE with the fill fading out beneath it.** ⚓ The colour lives in the line, so where
  two auras do coexist — Burning on its Fuel, Frozen on Cryo — they cross legibly instead
  of turning to mud. That is the Gauge Explorer's own recipe (0.34 → 0 gradient, 2px
  stroke), and using it is what makes the two surfaces read as one model.
- **A span is one continuous lifetime**, so a mod re-applied after it decayed draws twice
  with a gap between. The gap is the lane's whole answer to "where you lost it".
- **One `uMax` for every series, floored at 2U.** ⚓ Overlaying them is what makes that
  scale mean something: a tall Pyro line and a short Hydro one are now directly
  comparable, which stacked rows could only imply. The floor keeps a rotation of 0.8U
  auras from drawing full-height and implying a saturated target.
- **Nine mods, and four of them are not elements.** Frozen, Quicken, Burning and its Fuel
  are reaction STATES with different decay curves, so they get `--rx-*` hues rather than
  borrowing the element that caused them. The Fuel draws as a bare dashed line with NO
  area — it is bookkeeping, not an aura on the target.

### ⚓ It is the only lane that is not made of bars at all

Every other lane down there draws a granted effect: a filled register bar with a 2px lit
edge, a stat icon, a source name. This one draws the TARGET'S state — not something anyone
gave anyone — so it takes none of that grammar. It is a chart, on the bare night like the
timeline above it.

### ⚓ 1:1 is what makes the line possible

The row form's SVG was NORMALIZED (`0 0 100 100` + `preserveAspectRatio="none"`) because
each bar was sized by the timeline's frames→px seam and had to stretch into it — which
forbade a stroke, since a stretched stroke gets non-uniform thickness (the
`objectBoundingBox` trap the bench tail already paid for). **One plot spanning the whole
track draws in real pixels**, so the constraint is simply gone. `auraSpanPoints` maps a
span into the caller's own pixel space and is shared: the screen joins the points into an
SVG `d`, the canvas export walks the identical list with `lineTo`.

`AURA_MIN_PX` (1.5) lifts a live-but-tiny aura off the baseline — a 0.02U tail is a
fraction of a pixel, and not drawing it reads as "the aura ended" a second before it did.
⛔ A gauge of exactly **zero** is not lifted: that sample is the instant the aura ran out.

### The crosshair readout

⚓ **Overlaid series cannot be hovered individually, and the answer is better than the
per-span tooltips the rows had:** a vertical cursor reads out EVERY aura on the target at
one instant, which is the question a gauge chart is actually asked. A per-series hit
target would also have had to pick a winner wherever two lines cross — exactly where a
reader is most likely to be pointing. `gaugesAt` is `gauge.ts`'s own interpolation over
its own series; ⛔ not a second reading of the trajectory.

⚠️ `showTooltip` grew an `anchorToCursor` flag for it, and that is not a preference: the
plot element spans the entire track, so its centre is halfway along the rotation and the
readout would appear nowhere near the time it reports.

⚠️ An empty aura is a REAL answer and the one the lane exists to show — the readout says
"No aura" rather than showing an empty card.

### Naming, and the one piece of furniture

Each aura **names itself where it appears**, which is the one moment the word is news; an
overlaid plot has nowhere to put a permanent legend that is not on top of the data. Two
suppressions: a span too narrow to hold its name, and a label that would collide with one
already placed.

⚠️⚠️ **A collision is BOTH AXES.** An x-only test threw away exactly the pair a reader most
needs — Burning opens on the same frame as the Pyro that lit it — and they were never
going to overlap, because Burning opens at 2U and Pyro at 0.8U, 30-odd pixels apart.

**One faint rule at each whole unit below the ceiling** is the lane's entire chart
furniture, and it earns its place: the y axis is otherwise unreadable without hovering, so
a shape filling 40% of its box says nothing until you know what the box is worth. ⛔ Never
a line ON the ceiling — the plot's own top edge is that line. ⛔ And not a full axis; the
timeline sheds furniture on purpose and one line is the budget.

### The two point streams

**Application ticks** are element-coloured (that is their identity) with a 2px
`--ui-provisional` FOOT when the gauge strength is our 1U default rather than measured.
⚓ The mark sits under the tick rather than replacing its colour: the tick still reads as
its element, and what is uncertain is the ground it stands on. Hovering one says so in
words — _"Gauge strength · not measured — 1U assumed"_ — because a provenance mark the
reader cannot resolve is just a blemish.

⚠️ **Measured, the defaulted share ranges 0% to 89% by rotation** (freeze and bloom
fixtures are fully measured; the swirl-heavy one is 89%). It varies, which is what makes
the mark informative rather than decoration.

⚠️ The tick's PAINT is 2px and its HIT AREA is grown around it with a `::after` — a 2px
hover target is not a target, and widening the paint would crowd the strip at any real
application density.

**Reaction markers** are grouped by frame, because one hit can trigger several (Pyro onto
Electro-Charged is Overload AND Vaporize) and two markers at one x overdraw. The label is
the reaction FAMILY, deduped — two swirls on one frame read "Swirl", and the tooltip
lists both with their elements and who caused them. ⚠️ Below 26px of clearance the label
is **DROPPED, not truncated**: a cap alone left two-character stubs ("Bl", "Hy") that name
nothing and still cost the pip its clearance. Screen and export share the threshold.

⚓ **The pip is neutral chart ink, never an element** — a reaction is what happened
BETWEEN two elements.

### ⚓ The export is a DOCUMENT, and here it is plainly better

The PNG kept its label column when the live chart gave one up (abutting round), and with
no hover and no per-aura naming to fall back on, a shared image needs both. So the export
alone carries a **legend** — the y ceiling as `{uMax}U`, then every mod in the plot, in
colour. That divergence is licensed by this file's own header: colour tracks between the
two surfaces, chrome does not have to.

## 4. Honesty, re-derived rather than copied

⚠️⚠️ **§5 of the round's plan was STALE and following it would have shipped a wrong
claim.** It listed _"no hyperbloom/burgeon core modelling"_, written at L3 — which stopped
being true at L5b, when dendro cores landed in `gauge.ts` with a real spawn delay and
lifetime. A stale honesty note is worse than none: it under-claims in public while the
code has moved on, and a reader who checks once and finds it wrong stops believing the
rest of it.

The limits that shipped, each with a source in the code:

| stated                                      | source                                            |
| ------------------------------------------- | ------------------------------------------------- |
| one enemy                                   | `gauge.ts` carries a single `ModState`            |
| the enemy applies nothing back              | no path applies an aura the enemy owns            |
| Shatter is not modelled                     | `sim/reactionBridge.ts` leaves it unemitted       |
| hits land on their nominal schedule         | `application[]`'s contract C4                     |
| a multi-hit swing counts as one application | the hit stream's documented approximation         |
| an unmeasured gauge strength defaults to 1U | `DEFAULT_UNITS` in `sim/aura.ts`; the yellow feet |

⛔ **Do not add a line to `AURA_NOTES` without a source in the code.**

**Two surfaces**, per Nate: a standing block at the top of the Notes panel (the aside
column, above the per-character caveats, separated by a rule and painted in neutral ink
because it belongs to no one), and a full § in the Help chapter.

⚠️ **The Notes panel gained a SECOND reason to open.** It was gated on slot caveats
alone, which would have made the modelling limits unreachable for exactly the rotations
most likely to want them: a fully-curated team has no caveats and still gets a gauge.
`plannerView.hasAura` is the second gate.

---

## 5. Two things found on the way

🐛 **The palette-mirror guard could be shadowed by a COMMENT.** `cssToken`'s value
pattern was `([^;]+)`, and `[^;]` matches newlines — so `--rx-quicken: when an element
closes on a UI colour, spend LIGHTNESS. Hue`, prose in the block comment above the token,
matched, ran on across lines to the next `;` anywhere in the file, and handed back a
paragraph. The old note claimed comments were safe because they lack a `:`; true of most
of them, false of every one written as `--token: explanation`, which is how `app.css`
explains its tokens. Fixed to `([^;\n]+)`, and the fix was verified by breaking it
(`RX_QUICKEN` nudged one digit → red; restored → green).

⚓ **The mirror needed a SECOND assertion.** The literals matching `app.css` is only half
of it — the screen reads its `--rx-*` through `auraDisplay.ts` as `var()` references, so a
mod pointing at the wrong token would keep both the CSS and the literal honest while
drawing the wrong hue in one of the two surfaces. There is now a test pinning the
mod→token mapping.

⛔ **`provisionalCount` was authored and deleted before it shipped.** It was on `AuraLane`
and read nowhere — the ticks say it on the chart and the notes say it in words. This
project's most productive bug class is data with no consumer, and the cheapest moment to
not have one is before it exists. (`auraH` on the export snapshot went the same way.)

⚓ **A design argument can be right in the abstract and wrong about this corpus.** The
rows were chosen against a real failure mode — four concurrent auras on one y axis DO go
muddy — and the reasoning was sound. It was just answering a question the data does not
ask: measured across reaction families, auras barely coexist. ⚠️ The tell was available
before the build and was not taken: the lane's own projection could have counted
concurrent spans in ten lines. **Count the case before designing for it.**

---

## 6. What L6 deliberately did NOT do

⛔ **Feeding the real rotation into the Gauge Explorer.** The round's §10 left it open
("aura lane, and/or feeding the real rotation into the gauge instrument"). It is not a
scope call, it is a wall: `MAX_GAUGE_APPS` is **8** and a heavy rotation makes **230**.
The instrument is a teaching surface with a hand-edited application list; handing it a
rotation would break the affordance it exists for. The lane is the answer.

⛔ **Carrying the reaction's DIRECTION.** `reactionBridge.ts` collapses `reverseVaporize`
into `vaporize` on the way to the IR, because a curator authors "vaporize" and never "the
1.5× one" and nothing downstream dispatches on the multiplier. So the lane says
**Vaporize**, not "Vaporize ×2" — a real gap rather than a wording choice, since we know
the direction at the gauge and drop it at the bridge. ⛔ The fix is NOT to leak the gauge's
key into the IR (the bridge exists to stop that); it is a multiplier field on
`ReactionEvent`, which is a schema question. Queued, not done.

---

## 7. Verification

- `npx vitest run` — 1539 pass (23 new in `auraPlot.test.ts`, 2 new mirror assertions)
- `npm run check` · `npm run lint` · `npm run build` — clean
- **The L0 oracle is UNCHANGED**, which is the point: applications **145**, extra **0**,
  element mismatch **0**, tier-2 agree **122 of 264**, mean |Δ| **0.173U**. L5e recorded
  145 / 0 / 0 / 121 of 263 / 0.174U — the ±1 is gcsim's known flicker. **L6 changed no
  engine behaviour.**
- Browser surface (headless Chrome, production build): the lane renders across vape,
  freeze, burning, aggravate, swirl, bloom/hyperbloom; all three tooltips resolve; the
  notes panel opens with the standing block above the caveats; the PNG export paints the
  lane with its label column. Edge cases clean — empty notation, a physical-only rotation
  (no lane, correctly), a rotation with no reactions, four characters.
- `npm run test:e2e` — **73 + 73 on both engines**, run against each of the two commits.
- ✅ **Nate's eyes**, on the live tool, typing rotations. ⏳ Real **Safari** is still
  unverified — this landing is entirely visual, so the backlog re-opens at one.

---

## 8. Residue

- ✅ **The `applications` feed order** — CLOSED 2026-08-17 (`ad48627`, recorded in the
  L5e doc). L6 was the reason it was queued, and L6 is where it showed: in 19 corpus cases
  the lane drew its application pip at the true frame while the LINE stepped later, with
  identical applications and identical events. ⚓ The pip and the line it points into agree
  now. ⚠️ The narrow `<name> E Q` census reproduced its 4-in-464 exactly and was
  MEASURING THE WRONG THING — over the multi-character corpus it is 130 inversions, 37 of
  them cross-element.
- ⏭ Reaction direction on the IR (§6 above).
- ⏭ The lane draws only what the gauge was fed, so L5e's own residue shows through it: the
  30 applications of curation (a damage tick on 24 existing summons), the 30 other gaps
  (Fischl's A4, Nahida's Tri-Karma — neither a summon), and the 13 `OTHER` ICD series.
- 🎛️ `AURA_PLOT_H` (56) is the knob. ⚓ FIXED rather than per-series-count on purpose: a
  chart whose y axis changes height with its content produces shapes that cannot be
  compared between two rotations, and a lane that grows as a new aura appears makes the
  whole timeline jump mid-read. The tick strip's 2px provisional foot in a 6px tick is the
  other number worth a second look.
- ⏭ The 2U `uMax` floor costs headroom on a rotation that never exceeds 0.8U (the
  swirl-heavy case uses 40% of the plot). ⚓ Kept deliberately — that emptiness is the
  finding, and lowering the floor to 1U would make a shallow aura read as maxed, which is
  the exact problem the floor exists for. The unit rule is what turns the headroom from
  blank space into a scale.

---

## 9. The reposition (2026-08-17)

⚓ **Nate, after living with the lane:** _"the aura-reaction track being right above the
timeline, above its timing scale ticks and beneath band B."_ Plus a layer toggle for it,
a second one for the buffs, and the bench's top edge brought level with band A's.

### What moved, and why it reads better

The lane shipped at the BOTTOM of the track area — roughly 600px from the ruler it is read
against, which is the one relationship a gauge plot needs most. Above the axis, the ruler
becomes a **shared axis with a chart on either side of it**: the same DAW convention that
put it on the top edge in the first place, now doing twice the work.

⚠️ **It lives in the RULER'S STRIP, not the track scroller.** That strip exists so the
notes panel can never push the axis, and it is a scroll FOLLOWER — `overflow: hidden`,
`scrollLeft` mirrored from the tracks. The lane inherits the mirror and the edge fade for
free, and the two share ONE width-sized box (`.rp-header-inner`), because they are two
readings of one x axis and the rotation's length must be stated once.

🐛 **The follower cost the wheel**, and `onHeaderWheel` gives it back. Invisible while the
strip held only the ruler — nobody scrolls a chart by its axis — and immediately visible
when a third of the header is a chart. ⚠️ **Horizontal only**: over the tracks a vertical
wheel scrolls the PAGE, so forwarding `deltaY` would give the header a behaviour the
surface it mirrors does not have.

### ⚓⚓ Anything above the first track row moves the BENCH

This is the part worth carrying forward. The bench's cards each label a track group, and
their column was positioned from `RIBBON_FRAME_TOP_INSET` — a constant **hand-copied from
`RULER_H`**, with a comment admitting it. Sound while the header held exactly one thing.

So the header's height is **published** now (`benchBand.trackTop`, through the same
ownership-guarded channel as the slot heights) and `ribbonHead()` reads it. Landed as a
separate behaviour-zero commit first, publishing `RULER_H`, so the lane's own diff is about
the lane.

⛔ **Never make the head per-tool.** The Team Builder has no ruler and no header, but its
cards must land on the same screen y as the planner's or the four cards you are looking at
slide on every RP↔TB crossing — and ⚓ the ribbon's whole job across that seam is to be the
thing that does not change (the tail round). The TB reads the same head and carries the
surplus as empty ribbon, in the region already earmarked for the decorative motif.

### The layers

`(Auras)(Buffs)` in band B, which is the VIEW band. ⚓ The cut is **a bar that says when an
ability IS stays; a bar that says what an ability GRANTS goes** — ⚓ Nate ruled SHIELDS a
mechanic rather than a buff, so they stay with the summons whose lane they share.

⚠️ **Gated at the projection, never the markup.** Every height, the shared aux reserve, the
bench's published metrics and the PNG snapshot are computed FROM those arrays, so an empty
array collapses everything with no second code path. ⛔ An `{#if}` around the rows is the
version where the layout keeps paying for what it no longer draws.

Defaults are **buffs on, auras off** — the view exactly as L6 merged. ⛔ Not in the `?r=`
codec: a shared link carries a rotation, not the recipient's reading preferences.

⛔ **A "Layers ∨" menu was considered and rejected.** Two toggles are not an abstraction's
worth, and the point of a stripped chart is that it ANNOUNCES itself.

### Two defects the browser pass caught that no gate could

🐛 **The four slot blocks were up to 2px apart** with an identical row budget — the aux
reserve's own "slots come out uniform" claim, false by a trailing-gap term that each of the
summon lane and the buff stack drops when empty. Invisible while buff rows were always on;
the toggle makes it the common case, and the bench mirrors slot heights exactly, so it
landed on the one coupling the ribbon exists to guarantee. ⚓ Fixed by taking the MAX of the
four natural heights — the property wanted is "the blocks are the same height", and a max
says that directly.

🐛 **"Reset view" was inert after a layer toggle**: its disabled test was
`scale === default && !showNotes`, which is exactly the state you are in when you have only
hidden a layer.

⚠️ Both were green on every unit gate. The instrument that found them was a production
preview with a real rotation in it.

### Still not verified

- **Safari.** Re-opened by this pass, which is entirely visual.
- **The PNG's own appearance.** The export path runs clean and throws nothing, and its two
  changed expressions were reviewed, but a canvas is Nate's eyes.
- **A real-hardware wheel over the header.** The synthetic wheel reaches the handler and
  moves the tracks by exactly `deltaX`; the harness's trusted scroll targets the page.

### 🎛️ Knobs this pass leaves on the table

- `AURA_PLOT_H` (56) is unchanged, and the lane is 79px in the header (13 marker + 6 ticks
  - 56 plot + 2×2 pad). Every pixel of it is now above the fold on a 16:10 screen, which
    is the argument for and against making it taller.
- ⚠️ The lane lost the vertical GRIDLINES it had inside `.rp-tracks` — it is a sibling of
  that layer now. Judged an improvement (the ticks sit directly beneath the plot, a closer
  x reference than a gridline crossing it), but it is a look, so it is Nate's call.
