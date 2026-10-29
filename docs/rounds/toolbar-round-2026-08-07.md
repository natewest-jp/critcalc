# The Toolbar Round — ✅ 2026-08-07, committed `bf964ad` (not yet pushed)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Every tool's controls used to be a bare row of chips floating on the scene 8px
above its frame. Measured @1600: three competing top edges within 38px (toolbar
72 · ribbon 98 · frame 109), none aligned to another, and the row jumped **192px
sideways** between the benched tools (x=224) and the Visualizers (x=32) on every
tool→tool fade. That is the "awkward next to the bench" ⚓ Nate reported.

## The shape (⚓ NATE's diagram)

Two ABUTTING bands, free of the tool frame, with the ribbon proud of the whole
stack. `src/lib/toolBands.ts` holds the knobs and the diagram.

```
▓▓▓▓▓▓▓▓                     ← ribbon, RIBBON_OVERHANG_Y (12) proud
▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    ← band A  ctx-dark   BAND_A_H 36
▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░    ← band B  ctx-light  BAND_B_H 32
▓▓▓▓▓▓▓▓                     ← BAND_STACK_GAP 8, bare scene
▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░    ← the tool surface
▓▓▓▓▓▓▓▓
```

**THE TAXONOMY IS THE POINT** — which band a control goes in is a rule, not a
preference:

- **Band A = the DOCUMENT.** Which working team am I editing, and what can I do
  to it whole. _Identical in the planner and the Team Builder_, because since
  the bench-band round they edit ONE document (`rotationTabs`).
- **Band B = the VIEW.** What am I looking at inside this tool, and how.

## Decisions worth not re-deriving

- ⚠️ **The bands TRAVEL WITH THEIR TOOL.** Band A was going to be screen-locked
  HUD beside the ribbon (P2 in the survey — it is document-scoped, and the
  ribbon is the persistent document HUD). The moment A and B **abut** they are
  one object, and a screen-locked A over a world-locked B tears at their shared
  seam on every leg. Continuity across the fade is still the ribbon; band A just
  cross-dissolves into an identical band A.
- ❌ **REVERSED 2026-08-07 (⚓ Nate, the retirement round): band B's ground is the
  light context's `--surface` (paper), NOT `--ribbon`.** It shipped as the beige
  on the reasoning that a header stripe reads better than paper-on-paper over the
  Team Builder's light frame. Nate's correction: `--ribbon` is meant to be a
  _slightly darker band laid ON a ctx-light fill_ — a section header inside a
  surface. A whole toolbar painted in it made the beige the band's identity
  rather than an accent within it. `--ribbon`/`--ribbon-ink` have no consumer
  again.
- **Band B re-points `--text` at `--muted`.** Still true, but the reason changed
  with the ground: it was a contrast floor (`--ribbon-ink` measured 4.28:1 on the
  beige). On paper `--text` clears at 5.32:1, so the rule now stands on VOICE —
  band B is a CONTROL band, prose belongs in the surface below.
- **The beige selected-plate pilot moved to `.band-a .tab.active`.** Band B's
  ground already IS the beige, so it selects with the ordinary ring. The pilot is
  now exactly Genshin's idiom: the bright plate marks the selected row on the
  DARK strip.
- **`ToolStack` owns the bench dock**, one definition instead of two per-tool
  copies (which is how the TB's zone silently drifted 2px out of step in the
  abutting round). `RIBBON_DOCK_LEFT` is vestigial — the stack's padding box
  already starts at the content margin, so the anchor is `left: 0`.
- **`RIBBON_HEAD` gained `BAND_STACK_TO_SURFACE`.** The strip opens above the
  bands now. Card-to-track-row alignment is unchanged; there is just more ribbon
  above it — ⚓ **that new emptiness is where Nate's decorative motif goes.**

## What shipped besides the shape

- **The Team Builder can save.** `$lib/documentBar.svelte.ts` hoists
  save/load/share out of the planner PAGE. The bank always stored the team +
  loadout + constellations (`SavedNotation`); only the buttons were missing.
  Both tools now show the same tabs and the same Save/Load/Share.
- **ONE Share menu** (link · KQM · timeline image ×2). KQM/PNG left the
  composer's bottom-right corner; the timeline REGISTERS them
  (`documentBar.registerExporters`, the `benchBand.registerHost` idiom) so the
  menu offers only what the current tool can produce — on the TB, just the link.
- **`$lib/plannerView.svelte.ts`** brokers zoom/notes between band B and
  RotationTimeline. Direction of flow is documented in its header.
- **`<Mark>`** — inline geometry for the 15 band symbols. Every band control
  used to carry a literal `↑ ↓ ⤴ ↺ ⎘ ⧉ ✓ × − +`, which breaks
  `docs/design/subpixel-rendering-laws.md`. ⚓ Nate then chose **Lucide**, adopted
  as a devDependency + generator (NOT `@lucide/svelte`) — the whole decision and
  the how-to live in `docs/design/icon-set.md`. Marks elsewhere in the app are NOT
  yet converted.
- Destructive actions → a `⋯` overflow; "Reset workspace"/"Reset" → "Reset
  layout"/"Defaults"; the 356px C0–C6 rail → a band-B menu stating its reading.
- `BandMenu` is **portalled, not optionally**: `.bands` clips to its own radius.

## Open

- The Visualizers has no whole-workspace share (only per-tile). Deliberately not
  invented — it needs a new URL encoding.
- No undo anywhere; the two-step confirm is still the only guard.
- Vertical cost: the surface starts 38px lower than before (two bands vs one
  row). All three heights are knobs in `toolBands.ts`.
- `probe-panels` and `probe-overlays` were ALREADY dead before this round (they
  query `.rcp-key--cons` / `.rp-avatar-chip`, absent from HEAD). Not regressions.
  `probe-controls` was dead the same way and was deleted.

## ↻ Changed by the retirement round, 2026-08-07 (`b937263`)

Beyond the band-B ground above: **`BAND_RADIUS` 6 → 1** (`--r-xs`, the new
dulled-box radius, on trial on the bands specifically) and the band controls
went opaque with every other `.btn`. The bands now have their own section on
`/styleguide` — see `docs/rounds/style-reference.md`.

Gates: vitest 1312, `check` 0, `lint` clean, and probes bench-align 13 ·
bench-band ALL · tool-slide 23 · team-builder ALL · tb-bench-right 17 ·
viz-slots 27 · viz-workspace 48 · frame-rework 24 · site-chrome 47 ·
star-freeze 12. Watchdog 0 hits through a five-leg nav storm.

Read with `docs/rounds/bench-band-round.md` (the ribbon), `docs/rounds/transition-hardening-queue.md`
(the layer choreography the bands ride), and `docs/rounds/archetype-consistency-pass.md`
(the contexts).
