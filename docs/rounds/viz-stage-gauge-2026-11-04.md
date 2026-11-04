# The stage, round 8: Gauge explorer (2026-11-04)

**Status:** built on `feat/viz-stage-gauge`, not merged. Waiting on Nate's look in the local
build. Copy is written in as a proposal (§5); Help is proposed and not yet in (§6). Real Safari is
Nate's to check. This is the last instrument on the rail, so every Visualizer now uses the stage.

## 1. The rulings

⚓ Nate picked both at the start of the round:

- **The headline is the aura at a moment.** Point at or pin a moment and it reads what is on the
  target then ("0.90U Hydro · 0.30U Electro" / "at 2.2s"). At rest it says when the target goes
  bare ("No aura" / "from 9.5s"), and where no aura ever forms (an empty chart, Anemo alone), "No
  aura" / "on the target". Two other options were set aside: aura uptime (one number per sequence)
  and what's left after the last reaction (fits most scenario lessons but says little about a
  sequence with no reaction). The logic is in `gaugeStage.ts` `gaugeHead`.
- **The scenarios are chips under the chart,** out in the open as the old ruling has it
  (loading one is how a player learns the reactions), with the chosen one's note as the last
  line. Also offered: a setup bar segment (folds them into a popover, against that ruling) and
  view tabs on the top edge (14 of them wrap to two or three rows).

## 2. What changed

The rail (the toolbar panel over the chart, the Example scenarios panel, the paper Readout with
its aura log) is now one stage box:

- **The chart head:** the headline, with Unpin beside its sentence while a moment is pinned.
- **The toolbar on the chart's top edge:** the add buttons on a glass plate ("+ Add" and the
  seven elements), and Clear at the far end. A plate, not a segment: a segment's recessed track
  means "one of these is chosen", and these are actions.
- **The chart** is unchanged in its grammar (design §8: the overlaid areas stay). It now fills
  the stage's height. Added: a dot where the reading meets each curve; beside each drop a
  reaction makes, what it took off ("−0.5U", in the aura's colour); and over a pill, what it did
  to its own aura where that is the lesson ("Topped up", "Refreshed", "Too weak"). Together with
  the reaction names already there, these replace the aura log (design §8: the log's reactions
  become marks on the timeline).
- **Under the chart:** one line of hint, then the scenarios (a segment, its name over it, as on
  the ICD timeline's rule row), then the note.
- **Gone:** the Readout card, its at-a-moment list and its summary of aura intervals, and the
  aura log. The log was the only place for a reaction's trigger cost ("−1U Hydro trigger"),
  "after tax" figures, Dendro Core and Burning-ends lines, and the Electro-Charged tick runs. The
  chart shows all of these as shapes (the drop, the curve's start, the core dot, the curve's end,
  the steps) but not as numbers.

### Stability (design §4)

- **The headline keeps the room of the longest reading this sequence can show**
  (`widestHead`, a hidden copy in the same grid cell), and wraps between auras into that room.
  A pinned Burning moment names three auras ("0.79U Pyro · 2.00U Burning · 0.66U Dendro"), which
  runs to three lines on a phone, where "No aura" takes one. Measured: the
  chart's top doesn't move while pinning across Burning at 390, 700 and 1400px.
- **Every note sits in one cell,** so the cell is always the longest. A pill's first edit turns
  a scenario's three-line note into the custom one-liner, which would otherwise have resized the
  chart while you drag. Measured: the chart's height holds through a scenario change and an add
  (643px at 2000×1045, 431px at 1400×860). ⚠ This is the reserve that `gauge-edit-flow` §4.3
  tried and reverted on the rail, where it took ~90px from a two-up chart. On the stage the chart
  is the flex child that gives up the height, so it costs the plot instead of the rail.
- `STRIP_RESERVE_ROWS` (3) still holds, so a fourth aura kind is the only thing that moves the
  plot.

Driven on the production build at 2000×1045, 1400×860, 700×860 and 390×844 (touch): the
headline at rest and pointed, a pin and Unpin, Electro-Charged, Reverse Melt, Pyro refresh,
Top-up with its editor open, Burning; no sideways scroll, no page errors.

## 3. For Nate's eye

1. "No aura" at rest, in the largest type on the screen.
2. On a phone, the room kept for Burning's three-aura reading leaves a gap under "No aura"
   (about 100px).
3. Unpin beside the sentence.
4. The add plate at the left and Clear at the far end.
5. The hint line under the aura strips, with the reserved strip rows' night above it.
6. The scenarios on one row at 2000px, two at 1400px, six on a phone; the note's room is the
   longest note's.
7. The drop labels ("−0.5U") in the aura's colour, and the dots at the reading.

Found, not changed: **Reverse Melt's note** says each 1U Cryo hit chips 0.5U off a 2U aura, but
the Pyro runs out at about 4.5s, so the third hit (at 6s) lands on a bare target and starts a Cryo
aura. The new drop labels make that visible: two "−0.5U" and a fresh Cryo curve. Moving the hits
earlier doesn't really fix it, because two chips leave only about 0.07U. So the fix is the note
(two hits chip it, and the third lands on a bare target) or a third hit removed; Nate's call.

## 4. Tests

- `gaugeStage.test.ts` (new): when the target goes bare (9.5s for 1U; at the hit for Vaporize;
  never for Anemo alone); the reading at a moment, two auras in order, Burning's fuel left out;
  the drops (Reverse Melt's two 0.5U, Vaporize leaving nothing, Aggravate drawing none); the
  headline's room is never shorter than any reading.
- `e2e/viz-workspace.spec.ts`: the handoff test finds the custom note by `.gx-note--on` (the
  scenarios panel's `.note` is gone).

Gates: Vitest 2794, svelte-check, lint, build; Chrome e2e 72 passed.

## 5. Copy (written in, proposed)

1. The headline: "{u}U {aura}" joined by " · " / "at {t}s"; at rest "No aura" / "from {t}s";
   with no aura ever, "No aura" / "on the target". Units at two places so the figure keeps its
   width as you scrub.
2. Over a pill: "Topped up", "Refreshed", "Too weak".
3. Beside a drop: "−0.5U".
4. The hint: "Point at the chart to read the aura at that moment, or press it to pin the moment.
   Tap a pill to edit it, or drag it to move it."
5. "Example scenarios" as the row's name (was the panel's kicker).

Gone: "Readout", the prompt ("Point at the chart to read the enemy’s aura state…"), "No aura — the
next element applies fresh.", "Aura log" and every log line, "Nothing lands on the target."

## 6. Help (proposed, not landed)

`src/lib/help/chapters/Visualizers.svelte` § Gauge explorer:

1. First paragraph, the last sentence: "…**Clear** empties the chart, and **Example scenarios**,
   under the chart, loads fourteen examples that each demonstrate an interesting aspect of
   Genshin’s elemental gauge system." (It said "the menu", which was already wrong on the rail.)
2. Second paragraph, replaced: "The chart draws each aura’s gauge over time. Over each
   application are the reactions it triggered, and what it did to its own aura where that
   matters (topped up, refreshed, or too weak to attach). Beside each drop in a curve is what
   the reaction took off it. Point at the chart and the headline reads the aura on the target at
   that moment; press to pin the moment, which is how to read one on touch. With nothing pointed
   at, the headline says when the target is left bare."

## 7. Next

The rail's CSS (`app.css` § THE INSTRUMENT LAYOUT and § THE RAIL, the `--instrument-*` knobs on
`/styleguide`, `ui.md`'s paper rule and the rail sections of `visualizers.md` and the design's
§6a) has no users left. Retiring it is a tidy round of its own.
