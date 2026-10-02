# Instrument pass — Gauge Explorer (2026-10-02)

**Status:** branch `polish/viz-cleanups-gauge`. The fourth hands-on instrument pass (shape:
`docs/instrument-passes-2026-10-01.md` §0). Worksheet 03 is CLOSED; its notes moved to
`docs/text/ledger/notes/vz_gauge.md`. Riders on the same branch: §6.

## 1. The chart is the editor (⚓ Nate: "the Applications … can be simplified")

The Applications panel sat ~270px below the chart it edited — every edit was a scroll
down and a scroll back. It is GONE.

- **A glass toolbar over the chart**, four groups: playback + time · the selected
  application's element · its size · its time step, remove, Add. ⚓ **Even gaps** (Nate):
  one row when they fit, else playback on its own line and the three marker groups on the
  next, spaced evenly there. The switch is a measured 55rem on the TOOLBAR's own width
  (`container: gx-toolbar`) — ⚠️ not the tile's, which it shares with the Readout column,
  and ⛔ not free wrapping, which pulled the elements up onto the playback line.
- **A new application is a COPY of the selected one** (`brush()`): bare band and Add both
  used to make Pyro 1U every time.
- **The band shows a GHOST** marker where a click would add, with "Click to add" — the
  instruction paragraph retired (⚓ Nate: "a big help").
- **Add** keeps its mark and drops its word below 40rem (`compact`).
- The time stepper's field is exactly as wide as "15.0s" (measured in place: 2.6em).
  🐛 The first cut never applied — a later `.gx-value` rule at the same specificity won
  (Nate found it in the inspector); the class is gone.

## 2. Point to read

Hovering the plot reads that moment into the Readout (a dashed cursor); leaving hands it
back to the playhead, then the summary. A touch taps or drags the playhead as before.

## 3. Layout

- **Wide (tile ≥ 60rem)**: chart over a full-width scenarios panel, the Readout a
  full-height column on the right (⚓ Nate's option 1 — the Crit Heatmap's side column).
  🎛️ 25rem: the widest application line, "Pyro (3.2U after tax, refreshed, new rate)",
  257px, never wraps. The log scrolls inside the column, packed at the top.
- `.instrument`'s auto column fixed locally (`minmax(0, 1fr)`); 0 overflow at 320/768.

## 4. The aura log — one left edge (⚓ Nate)

`EventLog` (shared with the planner) is ONE grid and every row a `subgrid` of it:
time · pip · text. Text after a pip, a wrapped line and the fainter rows start on one
line; the pip column is as wide as the widest pip present, so the gap after a pip matches
the gap after the time. ⛔ The 0.9rem indent on reaction/bookkeeping rows is retired.
Checked in the planner (Chrome + WebKit): one text x for every row.
Element and Readout names: `ELEMENT_LABEL` in `auraDisplay.ts` (Anemo and Geo printed
their raw ids — no other surface did); the Readout's names are ink, the icon carries the
colour (Frozen was invisible on parchment).

## 5. Scenarios — 14, in concept order

Aura rules (Single aura, Top-up, **Pyro refresh**) · amplifying (Vaporize, Reverse
Melt) · coexisting (Electro-Charged, Quicken, Overvape) · the rest (Frozen, **Melt on
Frozen**, Swirl, Crystallize, Bloom, Burning). Both new ones checked against gcsim
(`attachOverlapRefreshDuration`; `TryMelt` + `TryVaporize`'s Frozen refusal). Every note
re-checked: ⚠️ **Burning was wrong** — it said Pyro re-applies every 0.25s; that is the
damage cadence, the application rides the Burning ICD (~2s, KQM §3.9 + gcsim).
Not added: Superconduct / Spread (gauge-identical to Overloaded / Aggravate), Shatter and
Lunar-Charged (unmodelled).

## 6. Riders

- **Worksheet 03 applied in full**: sentence-case chips, the log grammar in parentheses
  carrying both numbers, Aura log, Play / Pause, the marker's aria name, "0.4U per
  second", no "vape", Nate's unbolding. **Frozen / Overloaded** reached the planner's
  lane too (`auraDisplay.ts`; `auraPlot.test.ts` follows) — glossary §2's code pass is
  done.
- **The picker's order** (⚓ Nate): Crit Heatmap, Gauge Explorer, ICD Timeline, Reaction
  Curves, Damage Breakdown, Enemy DEF & RES, Artifact Rolls, Wish Odds — Help follows.
- **Damage Breakdown's bars** are 55% of their row (floor 0.9rem), a little taller than
  the gap at every row height.
- **The Crit Heatmap starts with the others**: `PAD.top` 24 → 9 (the marker's dot still
  whole at CRIT Rate 100%) and the drawn box anchored top.
