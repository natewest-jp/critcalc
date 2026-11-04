# The stage: retiring the rail (2026-11-04)

**Status:** ✅ merged into `main` on 2026-11-04 (`polish/viz-rail-retire`), approved by Nate. The
tidy that `viz-stage-gauge-2026-11-04.md` §7 left: with the Gauge explorer on the stage, the
rail's CSS had no users. No visual change, so there was nothing for Nate's eye.

## 1. What went

From `app.css`, § THE INSTRUMENT LAYOUT and § THE RAIL:

- `.instrument` and its three container-query tiers, the four slots (`.instrument-chart`,
  `-live`, `-settings`, `-controls`, `-readout`), `.instrument--settings-first`, and the
  chart's tile-height rules (sticky at the wide tier, `--instrument-chart-mid` at mid).
- The slider cap (`.instrument-live .slider-control` and its siblings), which only reached
  sliders inside the slots.
- `.panels`, `.inst-sections` and `.inst-section`: no markup used them.
- The knobs `--instrument-side`, `--instrument-slider-max` and `--instrument-chart-mid`.

## 2. What stayed, and where it lives now

- **The spacing ladder** (`--inst-gap-in`, `-control`, `-section`) and `.inst-hint`: the
  stage's popovers and every instrument's own rows use them. Their own section now,
  § THE SPACING LADDER, just before § THE STAGE.
- **`.instrument-graph` became `.stage-graph`'s base rule** (`contain: size`, the
  `--graph-min` floor), in § THE STAGE's chart part. Every chart carried both classes, so
  the eight instruments drop `instrument-graph` from their markup.
- **`container-name: instrument`** on `.ws-tile`: the stage's own queries and the ICD and Crit
  instruments' read it.
- **`.readout-head` and `.readout-sentence`** keep their names, though the Readout card is
  gone: they set every headline, and a rename across eight instruments buys nothing a
  comment can't say. The comment now says it.
- **`.panel.panel--paper`**: the Team Builder's boss card (`BossDetail.svelte`) still uses
  it. The materials rule now says "one paper card per surface at most" instead of "one per
  instrument".

## 3. Docs

- `.claude/rules/visualizers.md`: § The rail is gone; the stage bullet, the kit's spacing
  line and the materials line are in the present tense.
- `.claude/rules/ui.md`: the paper rule names its one user and says the Visualizers have none.
- `docs/design/visualizers-design.md`: §6a is gone, and §6 says what the stage replaced and
  links the rail's record.
- `/styleguide`: Layout knobs shows the four `--stage-*` knobs and the spacing ladder (all
  seven had been unclaimed) in place of the two retired knobs; the slot entry, the workspace
  law and the materials law describe the stage.
- Stale comments: the Gauge's `STRIP_RESERVE_ROWS` note (the scenario note's cell under the
  chart, not the settings slot), the workspace's `TILE_GAP` note, Artifact odds' capped svg.

## 4. Checks

Measured on the production build at 1400×860, every instrument's chart box still has
`contain: size` and its height; the Gauge's is 431px, as its round measured. A computed-style
diff of every element against `main`'s build (all eight instruments at 1400×860 and 390×844
with touch, and the no-JavaScript paint) found no difference in 9,264 elements, and no page
errors on either.

Gates: Vitest 2796, svelte-check, lint, build; e2e both engines 144 passed.
