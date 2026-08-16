# Gauge round — L6: surface and honesty

**Status:** built, gates green, awaiting Nate's eyes. Branch `feat/gauge-round-l6`.
Follows [L5e](gauge-round-L5e.md); the round's contract is [gauge-round.md](gauge-round.md).

L6 is the landing where the gauge becomes something a player can look at. Everything
from L1 to L5e was correctness with no picture: the gauge decides which reactions
happen, the reactions drive buff windows, and what the reader saw was a buff bar
moving. The **target-aura lane** is the cause, drawn.

> _"Here is your aura across your rotation, and here is where you lost it."_

---

## 1. What shipped

| piece                       | where                                                      |
| --------------------------- | ---------------------------------------------------------- |
| `ParsedRotation.auraSeries` | `sim/aura.ts` (`collectAuraSeries`) → `sim/finalize.ts`    |
| the lane's projection       | `src/lib/timeline/auraRows.ts` (+ 12 tests)                |
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
           ·Bloom        ·Hyperbloom                          ← reaction markers
TARGET AURA  ¦ ¦    ¦  ¦     ¦        ¦         ¦             ← application ticks
 ELECTRO        ▂▅███▇▆▅▄▃▂▁▁▁▁▁▁                             ← one row per aura mod
 DENDRO   ████▆▄▂
```

**Three bands, top to bottom, each annotating the one below it.** Reaction labels, then
the applications that caused them, then the auras those left behind.

- **A row is a mod's whole life; a SPAN is one continuous lifetime of it.** Two spans in
  one row with a gap between them is the lane's whole answer to "where you lost it" —
  never one bar bridging the gap.
- **Fill height is the gauge**, against one `uMax` shared by every row (floored at 2U, so
  a rotation of 0.8U auras is not drawn full-height implying a saturated target). A
  per-row scale would make 0.2U and 2U the same height.
- **Nine mods, and four of them are not elements.** Frozen, Quicken, Burning and its Fuel
  are reaction STATES with different decay curves, so they get `--rx-*` hues rather than
  borrowing the element that caused them — a Frozen bar drawn in cryo would say "the cryo
  aura is still there", and it is not.
- **Row order groups a derived state under its parent** (Burning under Pyro, Frozen under
  Cryo, Quicken under Dendro), not alphabetically and not by arrival.

### ⚓ It is the only lane that is not made of buff bars, and it says so in its materials

Every other lane down there draws a granted effect: a filled register bar with a 2px lit
edge, a stat icon, a source name. This one draws the TARGET'S state — not something
anyone gave anyone — so it takes none of that grammar. No register edge, no icon, no
label inside the bar; an area whose height is a quantity, on the bare night. ⛔ And no
border-radius: rounding an area chart rounds off the moment the aura landed and the moment
it ran out, which are the two instants the lane exists to show.

### ⚠️ Fill only, no stroke

The bar is positioned and sized by the timeline's existing frames→px seam, and the SVG
stretches to whatever width that produces (`preserveAspectRatio="none"` over a normalized
`0 0 100 100` viewBox). **A stretched stroke gets non-uniform thickness** — the same trap
`objectBoundingBox` set for the bench tail — so the area's own top edge is the line.
Nothing re-runs on zoom. `auraSpanPath` is shared with the canvas export, which walks the
same string with `lineTo`, so the exported curve cannot differ from the drawn one.

`minFrac` lifts a live-but-tiny aura off the floor: a 0.05U reading in a 14px row is half
a pixel, and not drawing it reads as "the aura ended" a second before it did.

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

### The row names win over the bars

Every other lane paints its name UNDER the bars (the tall-bench rule: a bar says what it
is better than the name does). Here the name is IDENTIFICATION rather than decoration —
nine mods can stack and three pairs are close in hue by construction — so it sits ABOVE
with a dark halo, costing the row's first ~40px of shape. ⚠️ The PNG export has no such
trade: it kept its label column when the live chart gave one up, so the mod names sit
outside the plot there.

---

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
not have one is before it exists.

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

- `npx vitest run` — 1528 pass (12 new in `auraRows.test.ts`, 1 new mirror assertion)
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
- ⏳ **`npm run test:e2e`** — pre-merge gate, run below.
- ⏳ **Nate's eyes**, and Safari is unverified until he looks. This landing is entirely
  visual, so the backlog re-opens at one.

---

## 8. Residue

- ⏭ **The `applications` feed order** (L5e §3.5) is still open and is now unblocked —
  L6 was the reason it was queued, because the lane is the first surface where application
  TIMING is visible rather than inferred. ⚠️ Re-run the inversion census before starting:
  4 in 464, zero cross-element as of L5e.
- ⏭ Reaction direction on the IR (§6 above).
- ⏭ The lane draws only what the gauge was fed, so L5e's own residue shows through it: the
  30 applications of curation (a damage tick on 24 existing summons), the 30 other gaps
  (Fischl's A4, Nahida's Tri-Karma — neither a summon), and the 13 `OTHER` ICD series.
- 🎛️ `AURA_ROW_H` (14) is a named knob for Nate. Every other lane bar is 12 and that is a
  law; this is the only lane whose bar height carries a QUANTITY, and at 12px a 0.8U aura
  against a 2U ceiling is 4.8px of fill. The tick strip's 2px provisional foot in a 6px
  tick is the other number worth a second look.
