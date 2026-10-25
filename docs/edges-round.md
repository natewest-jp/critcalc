# Edges round (2026-10-25)

Branch `polish/edges-and-fades`. A pass over gaps, padding, scroll fades and
the site's side margins before the full-screen surface's refinement.

## Rulings

- **The fade ends at the neighbour** (⚓ Nate). A scroller reaches into the
  bare scene around it (negative margin) and pads back by the same amount: at
  rest nothing moves, and once scrolled its fade is transparent AT the
  neighbour — band B, the bench, an aside, the screen's edge — rather than
  inside its own column. Law: `app.css` § THE FADE ENDS AT THE NEIGHBOUR.
- **The gap is published, never guessed.** `ToolStack`'s `.tool-surface` sets
  `--room-top/-bottom/-left/-right`; `ToolColumns` narrows the side facing an
  inline aside. Consumers add their own inset and read.
- **Fade lengths are unchanged.** Where the gap is shorter than the fade (the
  banner's 8px, band gaps) the fade still ends at the neighbour and begins a
  little inside.
- **One alignment on the Builder** (⚓ Nate): the cards sit on the banner's and
  toolbar's line. The grid's 6px gutter (hover rise, focus ring) lives in the
  gap now, as part of the reach.
- **One site gutter**: `--site-pad-x` (rounded `clamp(16px, 2vw, 32px)`), read
  by the tools and both bars. The phone TopBar moved 12 → 16 so the logo starts
  on the tools' line; at 320 the document button gives up the 8px.

## Consumers

- Planner: both x scrollers reach at every width (the phone rule of
  2026-10-15 generalised); `trackPad` is per side.
- Builder: `.tb-source` and the grid reach by the same amounts (nested
  scrollers each clip); the board pane reaches up and down, `availH` subtracts
  its padding; below toolMin the dock clips x only.
- Visualizers: `.ws-body` reaches up and down. The Crit Heatmap's stacked form
  (tile < 60rem, from 1024px) caps its stage at `100cqh` and lets its root grow
  — the fixed-height root made the readout OVERFLOW, and a scroller's end
  padding follows in-flow content only.

## Open

- Wish Odds in a 2-up tile scrolls ~1.5px (870.5 content in 869); not this
  round's, and invisible.
- The Library / Roster / Teams surfaces were left for the full-screen round.

Gates: vitest 2606, check, lint, build; full e2e chrome + webkit 160 passed.
