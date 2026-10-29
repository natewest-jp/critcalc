# Mobile Conversion Plan (shaped 2026-07-31, Fable + Nate)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Ordering — DECIDED (Nate ratified 2026-07-31): the site-wide legibility tail runs FIRST, mobile conversion second.** Rationale: the dependency runs one direction (legibility resizes/simplifies controls that mobile layouts must then accommodate — doing mobile first means redoing it); the legibility remainder is small and launch-gating while mobile is a full multi-session round; the desktop-first rule in `docs/rounds/design-decisions.md` already ordered these ("mobile is designed _after_ the desktop landing and tools are settled").

## Shape: survey first, not conversion first

Open the round as the **"workable" survey** from `docs/rounds/launch-roadmap.md`: sweep every surface at phone/tablet widths, classify **workable / fixable / genuinely-needs-space**. Expectation on record: everything but the planner is workable; planner-on-mobile is a stretch. The survey converts an open-ended round into a scoped work list — and it is the input to the _pre- vs post-launch-flip_ decision (mobile is pre-launch-desired per Nate 07-13 but NOT on the launch-roadblocking checklist per the 07-22 revision; don't let it block the flip if the window is closing).

## What's already cleared (don't redo)

- **Unified bench card (`d827e96`)** was explicitly the foundation for the mobile bench-narrowing goal — the atomic 160px card is the unit a narrow layout stacks. See `docs/rounds/unified-bench-card.md`.
- Legibility-pass touch-target fixes are half the mobile problem statement ("touch points too small") — they land for free before this round starts.

## Current narrow-width state (deliberate, not a bug)

↻⚓ **STALE BELOW THIS LINE — the narrow round SHIPPED 2026-09-05 (`fd4113c`), Nate-verified on a live phone 2026-09-08.** The "deliberate crunch" is gone: the bench is a ROW below 54rem, bands fold below 40rem, the aside is a DRAWER, and the breakpoints are a NAMED TABLE (`$lib/breakpoints.ts`) — so "TB breakpoints deleted" and "don't reintroduce ad-hoc breakpoints" both resolved into that table. Read `docs/rounds/responsive-survey-2026-09-01.md` Part IV instead of the rest of this section; this file survives for the ordering rationale and the standing constraints.

The mirrored-surfaces round (`c68f396`) **deleted** the TB's ≤900px flip-to-top and single-column collapse; benches are side-locked at EVERY width in both tools, so narrow viewports just crunch. That was explicit: "the real mobile treatment is the mobile usability pass's, not a breakpoint's." **Don't reintroduce ad-hoc breakpoints piecemeal** — the mobile round designs the narrow arrangements deliberately, per surface, inside the one-`.frame`-per-tool grammar of `docs/rounds/mirrored-tool-surfaces.md`.

## Standing constraints

- **Mobile landing is a different COMPOSITION, not a reflow** of the desktop cosmic scene (`docs/rounds/design-decisions.md` § Mobile strategy — portrait-tuned variant, different hero treatment). Budget it as design work.
- **Never compromise desktop to force-fit the planner** (memory `project_design_constitution`: "mobile is aspirational, not aspirational-to-cut"). If the Gantt genuinely needs space, an honest "best on a larger screen" state beats a broken squeeze.
- Nate admits some things must stay very small (narrow-bar labels, loadout chips on the portrait card) — small-by-design elements need a mobile _alternative_ (tap-to-reveal, popover), not inflation.
- Safari/WebKit constraints carry over: no per-item `<img>` on roster-scale surfaces (`docs/rounds/portrait-loading-diagnosis.md`), the WebKit no-filters rule (`docs/rounds/unified-chrome-areas.md`), scene-occlusion perf on tool routes (`docs/rounds/scene-occlusion-perf.md`). Touch adds: `position: fixed` popovers (`docs/rounds/unified-bench-card.md` flip behavior) and hover-only affordances need touch equivalents.

Related: `docs/rounds/launch-roadmap.md` · `docs/rounds/mirrored-tool-surfaces.md` · memory `project_design_constitution`
