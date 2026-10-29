# The Builder toolbar round, 2026-10-25

Hands-on with Nate, under the switch (`?next`), picking up the toolbar refinement's open items (`docs/rounds/toolbar-refine-round.md` § Open). Gated the same way: CSS through `:where(:root[data-next])` / `:where(:root:not([data-next]))`, markup through `$nextLayout`. ⚠ The sentence-case TEXT changes are NOT gated (⚓ Nate: acceptable); everything visual is.

## Rulings (⚓ Nate)

- **Chosen is a fill too** (open item 1). A segment's chosen side and an active chip wear the toolbar's "on": accent 20% over `--btn-face`, no ring. An element wears its OWN hue (`--el` / `--chip-color`, 24% for the strip and element chips, 28% for icon chips). Hover is a ring only inside `@media (hover: hover)`. A ring still means "you are here" (the top bar's current tool, focus). Global in `app.css` (`.segment`, `.chip`), local in `RosterFilterStrip`.
- **Sentence case stays** (open item 2). `.chip--control` drops `capitalize` under the switch; `.chip` keeps it, since its text is raw ids. The Visualizers' picker drops its uppercase (`InstrumentPicker`).
- **Names follow the sentence.** Tool and instrument names are descriptions, not proper names: "the rotation planner" mid-sentence, "Rotation planner" at a start. Ephemeris and the other landing card names stay capitalized. The instruments are renamed in `workspace.ts` (Crit heatmap, Gauge explorer, ICD timeline, …); the prose pass touched about 18 files. Rule in `docs/text/style-guide.md` §2 and `docs/text/glossary.md`. The feedback form's tool options were renamed to match (Nate, in the Google Form), and `FEEDBACK_TOOL` follows.
- **About names the visualizers**: "the wish odds visualizer", "the artifact odds visualizer" (lowercased, the bare names read as the concepts).
- **The lineup's rail has no ground**, as the Planner's centre lost its own.
- **The character side, simplified:**
  - **Owned / Wishlist are a ✓ ☆ pair in band B, after Search**, each a toggle that turns off on a second click. The All / Owned / Wishlist segment retires under the switch. First tried as the filter strip's first group: at a 1456px window the column is ~715px and the strip was already full, so it wrapped to two rows. Below `compact` they stay in More.
  - **Clear stands in the band, always**, disabled until a filter is on, and ends the cell at the pane's edge, lined up with the strip's end. At the strip's end it came and went and took a row when it came.
  - **Theorycraft** (no roster): no ✓ ☆, the lens offers C0–C6 and starts at C0, no empty-roster hint, and the no-match tip suggests C6 only. Leaving Theorycraft restores the roster's own lens and Owned/Wishlist reading, whatever was chosen in between.
- **Hair over the frame** (open item 5): checked with Amber and Tighnari, accepted.

## Left open

- The rail↔frame sliver (open item 4) is a caution only: the ribbon's 5px edge (`RIBBON_EDGE`) is the frame path's floor.
- The "Open in another tab" notice wraps into a narrow column at phone width: its own session (to-do Queue).

## Verification

vitest 2606 · check · lint · build · the full e2e run, Chrome + WebKit. Theorycraft was checked by switching the profile kind in a read-only tab's memory (Search · More · C0 · Clear, then back to My constellations).
