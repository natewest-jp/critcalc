# 2026-11-18: Help screenshots, the Visualizers chapter

The to-do's Help screenshots item, third and last chapter (the pipeline: `help-screenshots-planner-2026-11-15.md`; the builder: `help-screenshots-builder-2026-11-17.md`). Branch `feat/help-shots-visualizers`. Nate looked twice and approved the shots; this chapter completes the item.

## What was decided

- **The shot list (Claude proposed, Nate agreed):** ten shots, one per instrument plus the workspace, with Artifact odds getting two (Your piece and Reshape).
- **Examples:** a 50% / 200% build on the crit heatmap with a pinned 70% / 140%; the Overvape preset on the gauge explorer; evenly spaced hits under Standard ICD with the interval chart (⚓ Nate: replaced an Oz example that had no pins); All families at 600 EM on reaction curves; the default breakdown; Viridescent Venerer and Mavuika's DEF shred on Enemy RES & DEF; one +20 flower for both Artifact odds views; C1 from 30 pity with the Radiance counter at 2 on wish odds.
- **After Nate's first look (⚓ Nate):** the crit heatmap at its wide layout (bars beside the map), the gauge explorer cropped tall and shown 1.3× with its pins redone, the ICD example above, reaction curves' pin 2 on the strip, Artifact odds' pin 2 on the dots, wish odds' pin 1 at the Pulls saved slider.
- **Figure drift (Nate asked, Claude recommended, Nate approved):** a figure taller than its text stood beside the next section. A figure anchors as early as needed within its own section, never across a heading; the Reshape shot starts at its own toolbar; and each Help section is a flow root (`MenuState.svelte`), so a figure that still overruns pushes the next heading down. That rule also opens a gap of about 280px above the planner chapter's "Saving", because the Inspector shot overruns there; shortening that shot is the fix, not removing the rule.

## How it works

- Visualizer state comes from deep links built in `shots.mjs` (`vz()`), the same `?i=` format as the app's Copy link, encoded with Node's zlib because the app's encoder can't be imported from a plain Node script.
- Shots render at a 720px desk (`VZ_DESK`) unless an instrument needs another width for the layout the prose describes: the crit heatmap at 680 (its graph width crosses `STRIP_SIDE_MIN`), the breakdown at 940 (upright columns), the workspace at 1360.
- A callout can compute its point (`point(page)` in `capture.mjs`) when no selector lands on the mark: the tallest crit bar, and the top dot on Artifact odds.
- `headTo()` crops from an instrument's readout head down to a named element.

## Traps met

- Instrument class names differ by layout: the crit strip and the breakdown foot exist only at the wider layouts.
- A `--only` run that fails keeps the old manifest minus the failed shot; rerun it.
- `has-text` matches substrings: "yours" matched the dots' caption, and the first crit bar match was the "below the base 5%" marker.
- A Vite "failed to load virtual css module" in dev left the top bar unstyled (a giant logo); clearing `node_modules/.vite` and restarting fixed it.

## Copy

The ten alt texts landed as drafts with the merge (Nate: merge now) and are proposed to him for a ruling; any change follows as its own commit.

## Found on the way

- The gauge explorer draws its two drop labels (−0.32U, −0.23U) over each other at the 720 layout. That is the instrument's own rendering, not the shot.

## Left open

- The planner Inspector shot overruns its section (see above).
- Translation (to-do, Now).
