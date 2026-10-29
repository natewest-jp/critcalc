# Legibility point fixes — SHIPPED 2026-07-31 (`098c5fe` · `ce8496c` · `9f116a5`)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Born from the site-wide legibility audit (verdict: no systemic problems post-migration; point defects only). **Read before touching planner bar labels, TB capability text, or constellation UI.**

## The bar-label fade system (planner) — how it works, where the knob is

Truncating bar text DISSOLVES instead of slicing mid-glyph. Two cooperating parts in `RotationTimeline.svelte`:

1. **Mask + padding**: labels are shrinkable flex items (`min-width: 0; overflow: hidden`) under a right-edge `mask-image` gradient whose transparent tail lines up with matching `padding-right` — so a label that FITS shows no fade; only clipped text runs under the mask. Applied to `.rp-buff-label`, the shared `.rp-bar-cd-label` (symmetric padding preserves its flex-centering), and NB's absolutely-positioned cast glyph.
2. **`labelCapPx()`** (beside `barGeom`): when the NEXT bar in the same subrow overlaps this one, caps this label's `max-width` at the neighbour's left edge (minus icon/pad inset + 2px seam). ⚠️ **Without the cap the mask never engages in the overlap case** — the neighbour paints OVER the un-shrunk label (this is the case users actually hit — C6 Sucrose EE — and what the first, mask-only implementation missed).

**🎛 Knob: `--buff-label-fade: 12px` on `.rp-tracks`** — one value drives every lane's fade.

- **Moonsign lane**: each window carries its OWN lunar-glyph + "Name · Ascendant Gleam" label in the buff-bar grammar (flex-start, gap 4, pad 0 5px), capped at the next window. The old floating first-window row label is RETIRED (it read as one label bleeding across seams — Nate). Per-window durations dropped (tooltip keeps them); label is full-white + shared halo via `.rp-moonsign-bar .rp-buff-label` overrides. **NB keeps its on-bar duration** — NB bar length varies with Natlan count (18/12/9s), so the readout earns its place (Nate's call).
- **PNG export** (`timelineExport.ts`) mirrors the per-window moonsign labels but HARD-clips to the visible span (canvas has no mask fade) — accepted parity gap, consistent with drawLaneBar.
- Gate arithmetic: the fade padding adds 24px min-content to cd-labels — a `width > 40` gate lets 41–55px slivers render only a faded fragment; use ~56 where that matters.

## noConstellations — the constellation-locked precedent (Aloy)

`CharacterData.noConstellations?: true` (aloy.json; carried through the index — INDEX_FIELDS in `scripts/generate-character-index.mjs` AND the drift test's own list in `characterIndex.test.ts` must both list new index fields). Three surfaces respect it: DetailCard swaps the C0–C6 stepper for a note, SlotPortrait's con chip renders inert with a title, CharacterCard drops its C-badge. Use this flag for any future constellation-locked character.

## Capability detail text (TB)

`capDetailText(kind, detail)` in `team-builder/lib/capabilityText.ts` — buff stats via the planner's `BUFF_STAT_LABEL` (`src/lib/timeline/buffStatMaps.ts`, THE shared stat-name map; grown 2026-07-31 by healingBonus/interruptionRes/5×\*FlatDmg), shred/infuse elements capitalized (`def`→DEF, `all`→"all elements"). Used by DetailCard rows AND CompareView Facts cells. **Never render a raw Stat key to users — extend BUFF_STAT_LABEL instead.**

## Weapon/artifact shortName retired from display (Nate 2026-07-31)

Bars + tooltips show FULL names ("Sacrificial Bow", "Viridescent Venerer") — the loadout system made abbreviations pointless, and the fade handles long names in crowded bars. The three former consumers (weaponProcRows/charReceivedBuffRows/teamBuffRows) now use `.name`; **`shortName` stays in the JSONs for future use — don't strip it**. Characters KEEP short display names. `Ability.shortName` exists in the schema + 2 char JSONs but is consumed nowhere.

## Also fixed en route

- Viz axis captions ("damage kept"/"chance by then") painted off-canvas since the viz round — right-anchored at x=PADL−7 with text wider than the padding. Left-anchored now; the caption row is above the plot, nothing collides.
- Aloy's duplicate capability row: her two start/cap skeleton effects consolidated into one `ramping` BuffValue per their own curator note.

Related: `docs/rounds/launch-roadmap.md` (usability-sweep item) · `docs/rounds/planner-cleanup-2026-07-18.md` (bar styling laws) · `docs/rounds/unified-bench-card.md` (SlotPortrait rules)
