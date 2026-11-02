# The stage, round 1: Wish odds (2026-11-02)

**Status:** 🔨 built on `feat/viz-wish-stage`, for Nate to look at in the local build. Not merged.
⏭ The copy in §5 is written in for the demo and is proposed, not approved; the visual calls in
§4 are Nate's; real Safari and iPhone.

## 1. Why

The first instrument on the stage (design `docs/design/visualizers-design.md` §6–§8, agreed
the same day). Wish odds went first because it is the lightest instrument that uses every
shared piece: view tabs on the chart bar, a short setup line, a live value that is the x axis,
a headline, the chance-curve family's crossings, and a companion strip. Artifact odds, the
same family, comes next and inherits all of it.

**The headline** (⚓ Nate: the most important answer for the chart): the chance of your goal
within the pulls you've saved, as before. The runner-up, "pulls until it's likely", is now
the 50% crossing mark on the chart.

## 2. What changed (`WishInstrument.svelte`)

- **The layout.** One stage column (chart bar, setup line, chart head, chart, handle) and the
  paper card. Narrow: stacked at natural heights. Mid, from 1024px: the stage takes 🎛️
  `--wi-stage-mid` (0.82) of the tile, so the card's top shows beneath. Wide: the card beside
  the stage; the stage is the tile's height and sticky, capped at
  `--instrument-main-aspect` × the tile's height as the rail's chart was. The CSS is local
  until a second instrument wears it.
- **The setup line.** Pity (a chip that opens the pity slider), the guarantee (a toggle: a lit
  plate when held), Goal and the Radiance counter (chips that open the popovers they had as
  summary lines). "5★ and weapon" shows two groups, each led by its banner's name. Dropping a
  Paimon.moe export on the character banner's chips still reads it.
- **The chart head.** The headline left the paper card for the top of the stage, in the
  Readout head's type. It follows the handle and a drag on the chart.
- **The handle.** Pulls saved is the axis's own: its track spans the plot's x range plus half
  a thumb each side, so the thumb sits under the marker line at every value (measured: exact at
  0, 90 and 170 once Chrome's 2px range-input margin is zeroed). The label and the typed value
  sit under the track. Typing past the axis (to 2,000) still works; the marker waits at the
  end.
- **The answer as geometry.** The goal curve's 50% and 90% crossings are drawn: a dot, a
  dotted drop line to the axis, and "Half by 79" / "Unlucky tenth 155" beside it (below-right
  of the dot, or above-left near the plot's right edge, the two corners a rising curve leaves
  empty). The old "63%" label at the marker went, since the head says it.
- **The companion strip.** The chance the goal lands on each pull (the goal curve's slope),
  scaled to its own peak, on the main chart's x axis, with the soft-pity line running through
  it. It shows why the main curve jumps: the soft-pity spike, and for C0 a second hump where
  the 50/50 was lost. For a pair or a high constellation it shows each copy's hump.
- **The paper card** keeps the table of levels, the average, the Half by and Unlucky tenth
  definitions, and the banner notes that used to sit under the controls (the 55%, 4★ and
  weapon explainers). They change length with the settings, so they now sit where they move
  nothing you touch.

## 3. Considered and not taken

- **A hover preview in the head** (Apple Stocks shows the hovered point and returns on
  release). Here a drag sets Pulls saved, so a hover preview would give the chart a second
  meaning. Easy to add if Nate wants it.
- **A knob drawn in the SVG** with an ARIA slider on it. `InstrumentSlider` under the axis gives
  the same handle with a typeable value and a native, accessible track, and no new control
  code.
- **Small (`btn--sm`) chips.** Tried first; at 11px they read smaller than the axis labels.
  The chips are full-size glass plates.

## 4. For Nate's eye

1. The chips' size and grouping, and the guarantee as a lit toggle.
2. The chart head at the Readout head's size (`--fs-5xl`).
3. The companion: 🎛️ `COMP_H` 72px, `COMP_GAP` 24px, fill at 0.45.
4. The crossing marks' weight and their labels' placement.
5. The handle's label and value under the track.
6. 🎛️ `--wi-stage-mid` (0.82) two up.
7. The card now opens on its table, with the empty column under it at the wide tier.

## 5. Copy for Nate (written in for the demo, not final)

1. Chip names: "Pity", "Guarantee" ("Fate point" on the weapon banner), "Goal", "Radiance
   counter". The guarantee chip's tooltip and accessible name are the old checkbox's label
   ("Guarantee held (lost the last 50/50)").
2. Chart labels: "Half by 79", "Unlucky tenth 155" (the table's column names with the figure).
3. The companion's label: "chance on each pull".
4. The pair view's group names reuse the old kickers: "Character Event", "Weapon Event".
5. Removed: "Or drag across the chart." (the handle is the chart's own axis now).

## 6. Gates

Vitest 2733, svelte-check, lint and build clean; Chrome e2e 72 passed. Driven on the production
build: a drag on the chart, typing past the axis, pity, the guarantee, a reload (the state
persists) and Defaults, with no page errors. Looked at headless at 3000, 1600, 1440 two up,
1280, 900 and 390 wide.
