# Aside-Column Round — 2026-08-08 (✅ `a5ea9bc` + `f1433fc`, MERGED + PUSHED)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Nate's idea, approved with two answers: **two boxes with a gap** (not one frame
with zones), and **the bands span both columns**. Plus: **both filter columns
switch to `ctx-dark`**.

## What it is

`ToolColumns` (`src/lib/components/ToolColumns.svelte`, knobs in
`src/lib/toolColumns.ts` — `ASIDE_W` 262, `COLUMN_GAP` 8) splits a tool SURFACE
into a main box and an optional aside box with bare scene between. The bands
(`ToolStack`) span both.

- **The aside is always the DARK column**, structurally — every occupant is a
  secondary reading beside the work. It wears `--surface-raised`, NOT `.frame`'s
  `--frame-bg`: in the planner that token is the CHART WELL's color, so an aside
  painted in it reads as a second well floating beside the frame instead of a
  peer of it. `.rp-frame` makes the same override for the same reason.
- **ONE occupant at a time**, each tool deciding in one expression. Planner:
  `selectorOpen ? 'filters' : (showNotes && hasCaveats ? 'notes' : null)` — the
  Source's filters COVER the notes, exactly as its cards cover the timeline.
  TB: filters on the Roster tab only (Atlas/Compare take the full width).

## The shape already existed three times; this named it

Notes were an absolute panel inside the track area with `margin-right: 240px`
on the sibling faking the push; the picker and the TB roster were both
CharacterGrid's packed grid-plus-rail. ⚠️ **The honest accounting: this is a
RELOCATION, not a line-count deletion.** The absolute-inside-a-relative-wrapper
trick does not go away — it moved up a level into `.tc-aside` — because a
stretched flex/grid child still contributes its content height to the row, so a
long notes column would grow a content-height surface. What the round buys is
one width literal instead of two, a nameable model, and ONE seam for the mobile
round to collapse instead of three ad-hoc breakpoints.

## Fixed for free

The ruler strip sat ABOVE the pushed row, so with notes open it kept its full
width and drew ticks for time the narrowed track viewport could not reach. The
whole instrument narrows together now. ⚠️ `probe-frame-rework.mjs` had that
wart written down as a requirement ("ruler strip NOT pushed by notes") —
rewritten to assert ruler and tracks yield the SAME width.

## New/changed files

- `ToolColumns.svelte` + `toolColumns.ts` — the shell and its knobs
- `CharacterFilterRail.svelte` — the rail extracted out of `CharacterGrid`,
  keeping the `.cg-rail` class name so the probes stay green
- `CharacterSelector.svelte` (grid half) + `CharacterSelectorFilters.svelte`
  (aside half) + `pickerFilters.svelte.ts` — the picker split across the two
  columns, state brokered in a rune module (the halves cannot own it, and this
  is also what makes chips survive the aside swapping back to notes)
- `RotationNotes.svelte` + `timeline/slotCaveats.ts` — the notes left
  RotationTimeline; the page computes the caveats because band B's Notes button
  must know whether any exist before the column is on screen
- `GridFilters` moved to `characterFilters.ts` (it belongs to neither sibling)
- `cg-rail--left` / `railSide` deleted — already dead, nothing passed `'left'`

## The follow-on round — TB viewport-fit (`f1433fc`)

Found while checking this round for regressions; **Nate asked for it in the
same session** (he wants the TB screen-fixed, scrolling inside), so it shipped
as its own commit.

⚠️ **`ToolStack --fill` was `height: 100%`, which SILENTLY never resolved.** A
percentage height needs a DEFINITE parent height, and the chain is
`.tool-shell` (definite) → `.tool-main` (`min-height: 100%` — deliberately not
definite, so page-scrolling tools can grow) → `.tool-page` (grid item, auto
row). `fill` fell back to `auto`, so the one tool it exists for was never
fitted: the Roster laid out ~122 cards at ~5.8k px, the grid's bounded scroller
never engaged, and `.tool-shell` scrolled instead.

**Why it survived so long — two lessons:**

1. It _looks_ nearly right. The only tell is the filter column sliding away
   with the tiles.
2. ⚠️ **Its probe passed either way.** `probe-bench-align`'s "TB frame is
   viewport-fit (page does not scroll)" checks `documentElement` — and the page
   genuinely does not scroll, the SHELL does. A probe that can't fail is worse
   than no probe.

Fix: the viewport calc the Visualizers already used —
`calc(100svh − --chrome-h − --tool-pad-top − --tool-pad-bottom)` — on
`.tool-stack--fill`, minus the band terms (the stack includes the bands, and
`.tool-surface`'s `flex:1` takes them off). ⚠️ **The Visualizers keeps its own
copy on purpose**: it fits only above 1024px (`@media`), which the shared rule
must not carry. At 720p the shell still scrolls a little — the bench ribbon's
content floor, by design.

## The stale-probe sweep

### ⚠️ Both stale probes turned out to be DIFFERENT problems — check which you have

- `probe-traveler-avatars.mjs` was a LIVE GUARD behind one dead selector
  (`.tb-tabs`, gone since the toolbar round). Renamed to `.band-b .tab` and all
  three checks passed unchanged (`9054823`) — nothing had regressed, we just
  could not see it for weeks.
- `probe-overlays.mjs` had nothing to repair: no assertions, no exit code, just
  screenshots written to a long-gone session temp dir. DELETED (`4b2a4bf`); its
  subject matter is covered by probe-team-builder's Source-overlay checks.

**The lesson to carry:** a probe that no longer runs and a probe that cannot
fail both read as green. Two showed up in one session — this pair, and
`probe-bench-align`'s viewport-fit check that passed either way. When a probe
goes stale, ask which of the two it is before repairing OR deleting it.

## Probe repairs made along the way

- `probe-frame-rework.mjs` raced the lazily-loaded notation editor after
  `networkidle`; added a `waitForSelector`.
- `probe-tb-bench-right.mjs` asserted the Explore label starts with `←` —
  stale since the marks sweep (`b552ede`) made it inline geometry. Checking for
  the character would demand the sweep be undone; it asserts the mark leads now.

## Gates

`npx vitest run` (1326), `npm run check`, `npm run lint`, `npm run build` all
green. Probes: `probe-frame-rework` (25), `probe-team-builder` (all),
`probe-bench-align` (13), `probe-bench-band` (all), `probe-tb-bench-right` (17).

Related: `docs/rounds/toolbar-round-2026-08-07.md` · `docs/rounds/bench-band-round.md` ·
`docs/rounds/panel-system-audit.md` · `docs/rounds/mobile-conversion-plan.md` ·
`docs/rounds/style-reference.md`
