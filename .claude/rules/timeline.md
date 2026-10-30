---
paths:
  - 'src/lib/timeline/**'
  - 'src/lib/components/RotationTimeline.svelte'
  - 'src/lib/components/EventLog.svelte'
  - 'src/lib/utils/timelineExport.ts'
  - 'src/lib/utils/exportScene.ts'
  - 'src/lib/utils/auraDisplay.ts'
  - 'src/lib/sim/gadgets.ts'
---

# Timeline projections and the aura lane

Budget: about 10,000 characters. `src/lib/timeline/` holds pure projection modules over the parser's IR, each with tests. Records: `docs/rounds/gauge-round-L6.md`, `docs/curation/polestar-field-round.md` §6–§12.

## Bars

- Shields ride the summon lane (`shieldRows.ts` projects into `SummonSubrow`), so lane heights, block layout and the PNG export pick them up unchanged. Rows sort skill before burst, so each sits beside the cast that raised it; shields join that sort rather than being appended.
- A drawn stack count (`stacks` window, `stackRows.ts`) rides the summon lane the same way, as one stepped bar mixed toward the chart ground so it stays opaque (`stackStepMix`).
- There is one summon resolver, `findSummonsForBar` (`summonSubrows` re-exports it as `findCastSummons`).
- Bars refresh-merge per row at the projection (`mergeRefreshedBars.ts`): a buff re-applied before it expires is one covered span with one label. No interior seams (Nate). The 2px lit edge stays and means "the buff changed", because only same-shape overlaps merge. Eligibility is "windows that mean the same buff re-applied", never "bars that touch". NB is excluded: its bar width is its cooldown, so its bars only abut.
- Bar layering: E/Q, summon and buff bars at z 2, swap connectors at z 1, cooldown ghosts at z 0.
- Never show a raw `Stat` key to a player: extend `BUFF_STAT_LABEL`, and `SCALING_STAT_LABEL` for scaling stats (`buffStatMaps.ts`). A projection's dedup key and its `{#each}` key change together (`.claude/rules/svelte.md`).
- `barPhases.ts` holds the E/Q pill's three-case geometry, shared by the live chart and the PNG. ⚠️ The ghost cooldown tail ends at `readyAt`, not `start + cooldown`: the tail's end answers "when can I recast". The `cooldown` field survives as the tail's label, which names its length.

## Gadgets

- A `TimelineWindow` of kind `gadget` has no `characterId`. The layers rule splits a field: its span rides the Auras layer, its grants ride Buffs. A gadget spawned by a reaction needs no gauge work: walk the IR stream.
- A gadget row draws marks for events and an area for state, never a per-life duration mark. Its ceiling is a property of the kind, never the rotation's own peak.
- A ledger bar never merges: the cadence is the mechanic. The Stellar Conduct ledger exempts only the initial hit, resolved by index.
- ⚠️ Never make the ledger skip same-frame duplicates. A pill can hide another; that is a display problem, disclosed by `AuraTick.sameFrame`.
- Hit areas cover their own lane, never the whole row.

## The aura lane (`auraPlot.ts`)

- One overlaid plot, a line per aura with the fill fading out beneath it, plus application ticks and reaction markers above. It draws the target's state, not a granted effect, so it has no register edge, icon or in-bar label.
- ⚠️ It draws `ParsedRotation.auraSeries`, sampled from the live gauge. Never re-run `simulateGauge` over `applications`: a replay is a second copy of the truth and cannot see the gauge's internal chain (Burning fuel, Electro-Charged ticks, core spawns). `collectAuraSeries` settles the gauge first (`AURA_SETTLE_F`), because the decay tail is half the story.
- It is drawn 1:1 in real pixels, never as a stretched SVG (a stretched stroke gets uneven thickness). `auraSpanPoints` is shared with the canvas export.
- It rides inside the track scroller as the first row above the tracks. Its height (`auraPlotH`) rides the PNG snapshot, so never make it viewport-derived: two readers would export different charts of one rotation.
- A crosshair reads every aura at one instant through `gaugesAt`. A label collision is checked on both axes.
- One faint rule per whole unit is the lane's only chart furniture. The unit labels live outside the plot, in `.rp-timeline-area`'s left padding, as a sibling of the scroller (the scroller clips).
- `--ui-provisional` is a foot under the tick, not a replacement for its element colour, and it means "could someone measure this?": yes for a cast with no `application[]` or `units`, no for a swing or a summon tick.
- The lane's limits (`AURA_NOTES`) head the aura log and the Help chapter. No line goes in without a source.

## The application-marker grammar

Shared with the Visualizers' Gauge Explorer:

- One marker, read top to bottom: what it caused (reaction), then what landed (an element-coloured pill), then a hairline down into the gauge it changed. The Explorer's pill carries the unit number (no "U"); the lane's pill is smaller and carries no text, which is density, not drift.
- One ceiling for both charts, `auraUMax` (`$lib/utils/auraDisplay.ts`). `AURA_UMAX_FLOOR` is 1U, and `auraUnitLines` includes the ceiling. `AURA_PLOT_HEAD` reserves 6px above the ceiling so a line sitting on it isn't clipped.
- A run of one ticking reaction is one marker carrying its count (`collapseReactionRuns`). Marker labels are dropped, never clipped, measured against their own width (`auraMarkerLabels` takes a `measure` function so the module stays pure).
- An element names itself once; a compound state names itself every time. Bookkeeping series paint last, and a dashed path is butt-capped.

## The aura log (`EventLog.svelte`, `auraLog.ts`)

- One grammar, two feeds: `EventLog` owns how a row looks and nothing else. Don't push either tool's vocabulary into it.
- A row is the application marker in prose: when, what landed (an element pip carrying its gauge), what it did. The planner's rows are the lane's own projection (`buildAuraLog`), so a row and its mark cannot disagree.
- One focused instant, whichever surface drives it (`auraFocus`): the plot, a pip, a marker or a log row sets it, and all of them read it. Ink brightens on the chart; a ground fills in the log. Clicking a row seeks the timeline (`plannerView.scrollToSeconds`, which is deliberately not `$state`; the reason is at its declaration).

## The PNG export

- `timelineExport.ts` mirrors the screen, and the export's backdrop is the dimmed scene (`exportScene.ts`). The chart ground is `CHART_BG`.
- ⚠️ `timelineExport.mirror.test.ts` checks colour only. Any other divergence between the screen and the PNG (ink choice, weight, size, position) is found by eye or not at all, so compare a live view with its PNG after timeline polish.
