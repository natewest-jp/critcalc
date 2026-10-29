# The Rotation Planner's on-the-scene round (2026-08-11)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Branch `polish/rp-on-the-scene`, 2026-08-11.** The planner's timeline lost its frame and now renders straight onto the night scene. Detail lives in the CODE — this is the map and the ⚠ list.

## Where the reasoning is written

- **`--glass-bar` block in `app.css`** — the whole colour argument, the oklch measurements, the contrast sequence. The single most useful thing to read first.
- **`.rp-frame` in `RotationTimeline.svelte`** — what survived the ground and why (`--rp-chart-bg` is now NOTIONAL: declared, unpainted, still the mix reference and still what the PNG paints).
- **`timelineExport.ts` header** — the export is a PRINT RENDERING, not a mirror. **Colour tracks; shape/geometry/chrome do NOT.** A polish round is not obliged to drag it along.

## Laws this round produced

- **A bar register is a MATERIAL, not a colour.** `--glass-bar` (slate-ish blue @ .8) serves buff, debuff AND proc bars — ⚓ Nate: "no need to colour-split, they're both good things to the user." The `kind` is still in the data and the tooltip; it stopped being paint.
- **Elements = the game; annotation = our reading of it.** Content gets chroma, annotation doesn't. ⛔ Not gold — `--accent` already means "a gap you can click" on the TB's coverage chips.
- ⛔ **Opacity is not a brightness control.** Dimming a fill makes it _thinner_ as well as darker; on a translucent chart that reads as a different MATERIAL. ✅ **The "NB/moonsign are too bright" complaint this rule came from is CLOSED (2026-08-12) and the premise was WRONG** — measured against the shipped bar rung they are DARKER than every element bar and their labels read better. ⚓ Nate: _"they fit in pretty well with the new bars."_ The rule outlives the case that produced it. See `docs/rounds/element-palette-round.md`.
- **The gap encodes GROUPING**: 2px = same object (E/summon/Q, and buff↔buff), 3px = next to (either side of the active row).
- ⚠ **The gap between bars is `stride − row`.** A slim bar in a taller row spends the difference as whitespace — the Genshin HP-bar idiom does NOT transfer to a stacked lane, because the escape room and the gap are the same pixels.

## ⚠ Watch items

- ✅ **CLOSED 2026-08-12 by `docs/rounds/bench-card-round.md`.** The card was the binding constraint on slot height (floor 126 against a timeline asking 82–122, leaving the disc at 40px). Restructuring it into a ROW dropped the floor to 78 with a bigger portrait, so slots are rows-driven again — measured 96/94/94/94 where they were a flat 126. `BENCH_PORTRAIT_SHOWN`, the flag that measured this, is retired: its own note said it must not outlive the look it was built for.
- ⚠ **Contrast moved four times without anyone aiming at it** and is now 6.64:1 (label @ .65). Re-measure, never re-reason — the first published figure was hand arithmetic and 0.6 optimistic, the same trap the palette round's star figures fell into.
- ✅ **The element round's queue is CLEARED.** White-on-element labels went 1.33 → **1.59** worst case with the `--el-*-bar` rung (2026-08-12); NB/moonsign brightness was closed as a non-issue (above) and those two lanes instead gained **the buff register's 2px left edge**. ⏸ Still parked: the idea of giving buff bars their SOURCE character's hue.
- ⚠ 2px left edge on the glass bars is a deliberate exception to the flattening pass — glass bars overlap and alpha stacks with no seam; opaque bars draw their own boundary.

## Two bugs I caused, both worth remembering

- 🐛 **Never insert into a comma-separated CSS selector list.** A comment + rules dropped between two selectors doesn't error — it re-points every selector above at the next body it finds. Whitened the CD labels; ⚓ Nate spotted it from the chart. ⚠ **Reading the declaration is not reading the cascade** — I checked the declared value, saw `.4`, and built a plausible false story about context.
- 🐛 **`.sp-avatar-chip` was a fixed square with `flex-shrink: 0`** — a chip that cannot shrink does not shrink, it SPILLS. Invisible to every gate (layout overflow isn't an error) and my probe measured the tracks, never the cards beside them.

## ⚓ Next

**Element colours**, then bands (which decide where the bench lives), then the bench card. See [[project_rp_next_rounds]] if written; otherwise this order is the recommendation.
