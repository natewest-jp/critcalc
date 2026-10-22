# The toolbar (phase 2e), 2026-10-22

Under the switch (`?next`), every tool's view row is THE toolbar (design §5.3): band A is gone from all three tools, and the toolbar's controls are the interface size's. With the switch off, nothing changes.

The bands were already most of the way there: the Planner's band B was zoned left (transport, speed, Laps, Zoom) · middle (Total) · right (layers, Log, Notes), and the Builder's was cut over its two panes. So this round is the four calls below, plus the Visualizers' band A.

## Rulings landed (⚓ Nate, 2026-10-22)

- **Human timing leaves the toolbar** (§12 Q20): Settings turns it on and off (a new row at the top of its section), and while it is ON the Planner shows a quiet "Human timing" tag beside the Total, which it lengthens; the tag opens Settings. Off, nothing.
- **The Planner's Clear sits beside the composer's Undo/Redo**, so a mistaken clear is one click back. It empties the notation, the team, the rotation's own levels and loadouts, and ⚓ KEEPS the name (`rotationTabs.clearDocument`; the old Reset renamed the tab to "Tab N", which under documents would erase the player's name). It is an editor transaction, so Undo restores text and seats.
- **One control size for both bars** (§12 Q21): band B's row and controls take `--ui-ctl-h` / `--ui-ctl-fs` (Small 28 · Medium 32 · Large 36). ToolStack sets `--band-b-h` / `--band-ctrl-h` from it under the switch, and every CSS reader follows; the bench ribbon's head, which counts the stack in JS, now reads the band's MEASURED height (`benchBand.bandBH`, published by ToolStack) instead of `BAND_B_H`.
- **The Builder's Season, Add team and No repeats stay** in the toolbar cell over the board (already "zoned over what it acts on"); moving them into a board header waits for the inspector round.

## Also

- **The Visualizers** lose band A under the switch: the layout (how many instruments + Reset layout) is ONE "Layout" plate at the toolbar's right end; each tile's Defaults moves into its ⋯; the tile's Share is renamed "Copy link" so "Share" means the top bar's one menu site-wide. The workspace's height budget reads ToolStack's `--band-a-reserve` (0 without band A) rather than recomputing band A's height.
- ⏭ **The tile ⋯'s "changed" dot** (§5.3) is not built: no instrument can say whether its controls differ from their defaults yet. It needs an `isChanged` on `InstrumentHandle`, in all eight instruments.

## Strings (working copy, for Nate)

1. Settings → Human timing → the new row: "Human timing" / "Time rotations the way a person plays them." The section lede drops "in its view bar" under the switch (a stale reference).
2. The Planner's tag: "Human timing", title "The Total includes Human timing. Change it in Settings."
3. The composer's Clear: title "Clear this rotation (Undo brings it back)".
4. The Visualizers: "Layout", "Copy link" / "Copied" / "Copy failed", "Defaults".

## Verification

vitest 2557 · check · lint · build. Headless Chrome against the production build: the toolbar is 32px at Medium with 12px type, 28px on a phone at 390 (no overflow), and the bench cards still sit on their track groups; Clear empties the composer and Undo restores the notation and the team; the tag sits beside the Total and opens `/settings`, where the on/off row is; the Visualizers show no band A and a Layout plate. No page errors.
