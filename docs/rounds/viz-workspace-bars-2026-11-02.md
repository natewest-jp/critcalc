# Visualizers overhaul, round 1: the workspace and the bars (2026-11-02)

**Status:** ✅ merged to `main` 2026-11-02 (`feat/viz-workspace-bars`, merged in order with the overhaul's other rounds; pushed 2026-11-04). Nate: "All of these changes are solid"; refinement continues in a fresh session. The copy in §5 approved by Nate on 2026-11-03 (`docs/rounds/viz-stage-tidy-2026-11-03.md`). Real Safari checked by Nate on 2026-11-04; the phone pass is on the to-do.

## 1. Why

From Nate's brief: the Visualizers rode through the redesign nearly unchanged. Two of his
questions are this round's: should side by side be the default, and should Defaults be on the
bar rather than in the ⋯.

Measured before the change, at 1440×900 two up (the production build):

| pair                         | tile height | content height |
| ---------------------------- | ----------- | -------------- |
| Wish odds · Reaction curves  | 812 · 812   | 813 · 812      |
| Enemy RES & DEF · Breakdown  | 812 · 812   | 1154 · 1846    |
| Artifact odds · ICD timeline | 812 · 812   | 894 · 938      |
| Crit · Gauge (1600×1000)     | 912 · 912   | 1205 · 912     |

Four of six scrolled inside their tile, and the control you drag sat below the fold in Artifact
odds (days of resin) and Damage breakdown (most of its sliders). Few pairings mean anything
together: ICD and Gauge (the hand-off), RES & DEF and Breakdown, Crit and Breakdown.

## 2. What changed

- **One up by default** (`DEFAULT_SLOTS` in `workspace.ts`). Layout's options read 1, 2, 3,
  Auto. The stored workspace is v2: a v1 `'auto'` (or a v1 with no `slots`) was saved whether
  or not anyone chose it, so it takes the new default, while a count a reader picked is kept
  (`parseWorkspace`, tested). Reset layout returns to one up.
- **Tabs.** One up, the cell shows the eight instruments as tabs (`InstrumentTabs.svelte`):
  glass plates, the current one lit with the dim gold fill, ARIA tabs with arrow keys and
  automatic activation. Where the row doesn't fit, the dropdown shows instead. The switch is a
  container query on the cell at **73rem** 🎛️, measured at the default interface size: tabs
  850px plus action plates 300px is 1154px of cell, so tabs show from a window of about
  1232px. Checked at 1200 (dropdown), 1280 (tabs), 1600 two up (two dropdowns) and 390
  (dropdown, actions as marks), with no overflow.
- **Defaults on the bar**, before Copy link. Dimmed while the instrument is at its defaults.
  Detection is generic: a handle binds through a function binding (`register`), which
  snapshots its share state before anything is applied. That snapshot is the defaults, and the
  bar compares JSON. All eight start dimmed on a fresh load (checked). Its toast has Undo,
  which hands the old state back through `applyShareState`. Wish odds' import report isn't in
  its share state, so Undo restores the counter and pity it set, not the report.
- **The ⋯** keeps Report a problem and gains **How it works**: Help's Visualizers chapter,
  opened at the instrument's own section. `INSTRUMENTS` carries each section id (`help`);
  `menu.show(section, anchor)` takes the anchor and the menu state jumps to it once the
  chapter has loaded.
- A lit glass plate keeps its gold under the pointer (`app.css`, the ON rule).
- The hand-off from ICD to the Gauge: one up, the Gauge takes the tile. Side by side it still
  opens beside the source.

## 3. Considered and not taken

- A second tier that folds the action words before giving up the tabs (tabs would last down to
  about 1100px). The Layout plate's word can't fold without reaching into `BandMenu`, and
  below 1232px the dropdown is the shape that shipped before.
- Opening side by side for the hand-off even when one up was chosen. It would override a
  choice the reader made, and the tabs make the way back one click.

## 4. Gates

Vitest 2712 passed (workspace +7: `parseWorkspace`, the default). svelte-check, lint and build
clean. Chrome e2e 72 passed. `viz-workspace.spec.ts` was rewritten for one up (tabs, Layout
for side by side, Defaults and Undo on the bar); `marks.spec.ts` sweeps the tabs and reaches
the dropdown through Layout.

## 5. Copy for Nate (not final until approved)

New strings, written in for now:

1. The ⋯ item: "How it works"
2. The Defaults toast: "Wish odds is back to its defaults" (with Undo)
3. The Defaults button's title: "Put this instrument’s controls back to their defaults"

Stale and to rewrite: Help's "The workspace" section still says the workspace shows as many
instruments as fit and that Defaults is in the ⋯. The proposal is in the hand-off.
