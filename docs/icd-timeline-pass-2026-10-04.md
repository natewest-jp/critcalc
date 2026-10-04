# Instrument pass — ICD Timeline (2026-10-04)

**Status:** branch `polish/viz-icd`. The fifth hands-on instrument pass (shape:
`docs/instrument-passes-2026-10-01.md` §0). Worksheet 02 is CLOSED; its notes moved to
`docs/text/ledger/notes/vz_icd.md`.

## 1. The mechanic: ICD lists are finite (`icd.ts`)

Asked "why would it stop after 24 hits?", the answer turned out bigger than the
question. The game does not store "every 3rd hit": each ICD group is a reset timer plus a
**finite list** of which hits apply (gcsim's `icd_groups.dm.go`, generated from game
data), and gcsim reads past the end as the list's last entry — `0`. Tabulating all 64
groups, every one is **timer · every Nth hit · at most N per window**, so
`IcdParams` gained `cap`.

- **Standard is `cap: 8`** (24 entries, applying on 1, 4 … 22). Unreachable in play — 25
  hits inside 2.5 s on one counter — and what the GAME does past the end is unconfirmed.
  ⚠️ The planner reads `STANDARD_ICD_FRAMES` too: measured, no cast in the corpus comes
  near (Klee's Burst, the longest list, spreads 25 entries over ~9 s). vitest unchanged.
- **For several groups the stop is the design** — Chevreuse's eight shells apply on 1
  and 4 only. ⏭ No `IcdWindow` carries a cap yet: Chevreuse's mines and Arlecchino's
  Skill could now be authored exactly (a data round). `icd.md` § "The list is finite".
- `IcdHit.capped` marks a hit past its window's last application.

## 2. Examples — a preset is a HIT LIST plus a RULE (`icdExamples.ts`)

An even string cannot draw Layla (volleys of four with a gap after; an even 0.45 s string
reaches the 8th hit her group applies on, which no volley does), so a preset carries
explicit times. Every number is gcsim's, in frames, with its source file in a comment;
`icdExamples.test.ts` pins the patterns, worked by hand:

| Example                  | Own group           | Applies (own) | Under Standard |
| ------------------------ | ------------------- | ------------- | -------------- |
| Fischl's Oz              | 5 s · every 4th · 8 | 1, 5, 7       | 1, 4, 7, 10    |
| Hu Tao's charged attacks | 0.5 s · first only  | all 9         | 1, 4, 7        |
| Chevreuse's Burst        | 3 s · every 3rd · 2 | 1, 4          | 1, 4, 7        |
| Layla's Shooting Stars   | 3 s · every 7th · 2 | 1, 5          | 1, 4, 5, 8     |

- ⚓ **Real cadences** (Nate). ⚓ **Layla in, Furina's Salon out** (Nate: players use
  Furina for buffs, while Layla's Cryo matters to a current Stygian Onslaught boss).
- ↻ **Chevreuse replaced Arlecchino** — at her real cadence Arlecchino's Skill lands 3
  hits in its 10 s window and never reaches her list's stop; Chevreuse's does.
- ⏸ **PARKED: a character's own string** — a notation field + ability picker feeding the
  planner's ICD decisions, one lane per counter. Needs a sim tap recording blocked hits
  too (~4 gating sites), and ⚠️ FIRST a frames-diff measurement of how many skill/burst
  applications still disagree with gcsim — the weak spot it would teach from.

## 3. The instrument

- **Rule chips**: Standard · No ICD · **Its own** (only while an example is loaded) ·
  Custom, which opens as an edit of the rule on screen and gained a counter `Off` stop
  and a **Limit per window** slider.
- **Why each hit applies**: a ringed counter digit = applied by the counter (the timer's
  windows already mark the other kind); a dash = past the window's limit. **Point to
  read** — hovering (or tapping) a hit explains it in the Readout.
- **Readout per WINDOW** (⚓ Nate): "2 applications in each 2.5s window" replaced the
  averaged rate, which moved with the Hits slider. An even string's last, cut-off window
  is left out of the count.
- **Blocked hits wear the element** at half strength (⚓ Nate: they ARE elemental hits;
  `BLOCKED_ALPHA` 0.5, paint alpha).
- **The key is HTML** (wraps; the SVG legend needed ~470 px) and ends in the element
  swatches — the Element panel and its note are gone.
- **Axis** labels at a step that keeps them ≥ 44 px apart (a 90 s string printed one
  every second). An example's axis ends just after its last hit; a longer window runs
  off the edge. Same-frame hits fan out 12 px.
- **Wide (tile ≥ 60rem)**: the Readout is a full-height right column, as in the Crit
  Heatmap and Gauge Explorer. `.instrument`'s auto column fixed locally; 0 overflow at 390.
- ⏭ Hits are not keyboard-reachable (pointer only).

## 4. Copy

Worksheet 02 applied: sentence case, "some hits … their element", Nate's hand-off
tooltip, no `/s`. Anchor chips: **~0.5s normal attacks · ~1s summon ticks · ~2s slow
summon ticks** (0.5 s = the corpus median and the default, so the first is lit on load).
Help's ICD section gained the examples and lost "watch the application rate".
