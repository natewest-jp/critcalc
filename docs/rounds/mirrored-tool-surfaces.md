# Mirrored Tool Surfaces (planned by Fable + Nate, built by Opus 5, 2026-07-30)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

> **↻ PARTLY SUPERSEDED by `docs/rounds/bench-band-round.md` (2026-08-05, `9516685`):** the MIRRORED arrangement is retired — the TB now uses the planner's grammar (bench zone LEFT, filter rail RIGHT via `railSide='right'`), the benches' cards live in the layout-level RIBBON docked at ONE shared screen spot, and the tool-slide seam this round designed for is gone (tool→tool is a world-locked fade now). Still current: one `.frame` per tool with zones, the frame-top alignment knob (`--tb-tabrow-gap`), CharacterGrid as the shared roster surface and all its scroll/gutter rules, `--frame-line`, CloseMark, the shared facet vocabulary.

**✅ Status: COMPLETE — Nate-approved ("done very cleanly… a major step forward"), MERGED to `main` by fast-forward and PUSHED 2026-07-30 (`c68f396`). LIVE on the noindexed critcalc.app.** `docs/rounds/tb-final-layout.md` rode in on the same push (it had been merged to `main` first). The plan (now spent) was a Claude plan file outside the repo.

Commits: `b4ebd80` shell · `b015238` CharacterGrid adoption · `bec1e40` RP picker · `6fa02e4` alignment + probe/styleguide · `9462bed` follow-up round · `c68f396` scroll-clipping fix. Branch `feat/mirrored-tool-surfaces` is fully merged and can be deleted.

## Follow-up round (`9462bed`, Nate-directed same day)

- **`--frame-line` is now a `:root` token** beside `.frame` (`#1c2a4a`). A frame's ground is darker than `--surface`, so `--border` reads too hot on it — that's what earns it a member. `--rp-line` survives as a LOCAL ALIAS (`var(--frame-line)`) because the planner's markup reads it inside `color-mix`es; `--tb-line` is gone. Resolves the Open item below.
- **`CloseMark.svelte`** — Nate's `close.svg` disc (X as an evenodd HOLE, one path on `currentColor`) was inlined in `ChromeOverlay` alone. Now shared by the overlay, the planner's picker (`.cs-close-btn`) and the TB Detail modal (`.dc-close`), all three of which are **bare hit targets, NOT `.btn--icon`** — the mark is already a disc, so a bordered box around it reads as two shapes. Hover is `fill-opacity` on the glyph, owned by the component.
- **The planner picker's rail == the TB's**: `railFlat`, 250px, plus **Factions/Buffs AND Can provide**. **Excluded by Nate: Role** (soft editorial, a browsing aid) **and the roster ledger** (roster management) — neither is a question you ask while filling four rotation slots.
- **`$lib/capabilities/facets.ts`** now holds the shared facet vocabulary (FACETS, ConMode, conCapFor, matchesFacets, facetBadges, isCapabilityUnknown) — the capability counterpart to `$lib/characterFilters`. `team-builder/lib/facets.ts` **re-exports all of it**, so no existing import changed; what stays there is genuinely the TB's (`OwnershipView`, `splitRoster`, `RosterSplit`).
- ⚠️ **The planner judges facets at the user's SAVED roster constellations** (`PICKER_CON_MODE: ConMode = 'mine'`, Layer 1) — it has no C0–C6 stepper, and "who can do this for ME" is the question you have before any per-tab override exists. The rail states it in a note rather than leaving it implicit. **Verified at the gate boundary, not by inspection**: the only Hexerei healer is Fischl at C4, so Heals+Hexerei yields none at C3 and exactly Fischl at C4 — a good regression check if the cap wiring is ever touched.
- A **capability-unknown kit is never dropped** by a facet filter (no derived data ≠ "can't do it"). TB buckets them under "not yet curated"; the picker just lets them through.

## The shape (now a § Laws entry in /styleguide, Structure)

**One `.frame` per tool, below the tab strip, holding ZONES — not nested islands.** Bench on one edge (planner LEFT / TB RIGHT, so they meet at the tool-slide seam), filter column on the opposite OUTER edge, work in the middle. Zones separate with a 1px interior hairline over the frame's own fill — never a gap, never a second box. **Nothing inside a frame wears `.panel`.** The frame is viewport-fit; its zones scroll, the page doesn't.

- **`.tb` is a flex column at the viewport budget; `.tb-frame` is `flex: 1`** — so the frame top self-measures off the real tab-row height instead of a hardcoded allowance.
- **`--tb-tabrow-gap: 0.5rem` is THE frame-top alignment knob** (retires `--bn-drop`, which faked alignment by pushing an unframed bench down a page). TB tab row is 29px (`.tab--lg`) vs the planner's 27px, so it needs a SMALLER gap than the planner's 0.65rem. Both frame tops land at y=109 @1600. **`probe-bench-align.mjs` now ASSERTS this** (5 checks) instead of just printing numbers.
- Bench widths stay per-tool behind tokens: `--rp-bench-w` (set on `.rp-root` FROM the `LABEL_W` JS constant, which stays the single source — the PNG export reads it too) and `--tb-bench-w`. **↻ SUPERSEDED by `docs/rounds/unified-bench-card.md` (`d827e96`): now 160 / 185, and they stay DIFFERENT on purpose** — `LABEL_W` is the shared CARD width (the planner's column _is_ the card) while the TB adds 12px per side + a 1px border for a zone that also holds the team facts and footer. Don't converge them.
- **Benches are side-locked at EVERY width, both tools.** The TB's ≤900px flip-to-top and single-column collapse are deleted. Narrow viewports crunch; the real mobile treatment is the mobile usability pass's, not a breakpoint's.

## ⚠️ The absolute-inset trap (cost a real bug)

`.rp-source-overlay` moved from child-of-`.rp-timeline-area` to child-of-`.rp-frame`. **Absolute insets resolve against the PADDING box**, so `left: var(--rp-bench-w)` clipped the portraits' right edge by the frame's own 14px pad. Correct value is `calc(var(--rp-bench-w) + var(--rp-frame-pad-x))`. Any future inset against `.rp-frame` has the same tax.

Also: the `--picking` min-height moved from the timeline area to `.rp-frame--picking` (26rem, a knob) now that the overlay bounds to the frame. `.rp-frame` is `position: relative`; `.tb-frame` is `overflow: hidden` (safe — SlotPortrait popovers are `position: fixed`, which a plain overflow clip does not catch).

## CharacterGrid is now the shared roster surface (both tools)

New props, all with a real second call site — nothing speculative: `railSide` (`'left'|'right'`, flipped with `order` so DOM stays grid-first), `railFlat` (drop `.panel`), `railStart`/`railEnd` (rail sections around the identity groups), `aboveGrid`/`belowGrid` (inside the scroll container), `extraFiltersActive`/`onClearExtras` (so ONE Clear press clears the whole column), `searchPlaceholder`. Sizing via `--cg-rail-w` / `--cg-tile-min` / `--cg-gap` / `--cg-stack-gap`, which is how the TB keeps its wider rail and roomier wide-screen tiles without touching the planner's picker.

**⚠️⚠️ A SCROLL CONTAINER CLIPS EVERYTHING THAT PAINTS OUTSIDE ITS CONTENT BOX — and `overflow-y: auto` forces `overflow-x` to `auto` too, so a vertical scroller clips on all FOUR edges.** Bit us twice at once (Nate spotted both, `c68f396`): the zero-padding `.cg-rail` ate the left and right sides of the shared focus ring (2px outline at 2px offset = **4px** past a `.field`/`.chip`, so it read as two horizontal bars), and `.cg-scroll` ate the top row's border on the cards' 1px hover rise. **`--cg-gutter: 6px`** is the clearance both now reserve. The rail's `width` stays the CONTENT column (gutter added on top) so chip rows don't reflow, and `.cg`'s `gap` is **0** because the two gutters ARE the old 12px separation. **Any future scroller holding a focusable control or a lifting card needs this gutter.** `railFlat` was retired in the same commit — the rail is flat, full stop (both tools put it on a `.frame` ground, and nothing inside a frame wears `.panel`).

**⚠️ `.cg-grid` needs BOTH `grid-auto-rows: max-content` AND `flex: none`.** The scroller is a flex column now, and as a flex item the grid would shrink to fit the bounded box and squish the aspect-ratio portraits — the same documented failure from the other direction. `min-height: 0` still required at every flex level above it.

TB side: identity filters collapsed into one `GridFilters` object (`factionBuffs` rides along so `matchesIdentity` sees one state); `splitRoster` keeps its tested logic and FEEDS the grid from its outputs (double identity-filtering is a harmless no-op at 122 chars); TB's own `createProgressiveReveal` deduped into the grid's.

**`split.uncurated` is dead across the whole current corpus** — only `blank` is capability-unknown and the roster filters it out, so nothing live exercises `belowGrid`. Verified that slot with a temporary forced render under `vite dev`; if you touch it, do the same.

## Stale probes repaired en route (pre-existing, not this round's)

- `probe-frame-rework` check 4 keyed on retired `.tab-bar-actions .tb-btn` (→ `.rp-tab-bar-actions .btn`) and **had been silently failing**.
- `probe-overlay-check` + `probe-scroll-under` hardcoded a **4999** preview and one old session's scratchpad path, so neither could run. Both take `BASE`/`SHOTS_DIR` from the environment now, like every other probe. **The preview port everything else uses is 4998.**
- Probe selectors repointed: `.tb-grid`→`.cg-grid`, `.tb-rail`→`.cg-rail` (probe-team-builder, probe-traveler-avatars, probe-tb-bench-right).

## ✅ DONE: the shared bench card redesign → `docs/rounds/unified-bench-card.md`

**SHIPPED + MERGED + PUSHED 2026-07-30 (`d827e96`).** ⚠️ The "converged bench width" this section defers turned out to be the wrong unit: **the converged thing is the CARD (160px)**, and the two benches stay different widths on purpose (RP 160 = the card, TB 185 = card + its zone chrome). The rest of this section is the handoff as written at the time, kept for the reasoning:

**Deferred to a FRESH session by agreement (Nate 2026-07-30).** It is a design-iteration round with him in the loop, and it's the thing that finally sets the **converged bench width** that `--rp-bench-w: 145px` / `--tb-bench-w: 210px` are currently deferring. Starting cold also keeps his review of the frame rework separate from the bench redesign.

What the next session needs to know:

- **Nate has the updated portrait-area design** — ask him for it before touching anything.
- The target is ONE card for both the RP portrait column and the TB bench, evolving `SlotPortrait.svelte` (shared by both already). Earlier agreed build notes are in `docs/rounds/simplification-round-2026-07-24.md` § 2: portrait-dominant "atomic" card, con badge + weapon/artifact chips orbiting, always-on loadout labels removed, **plus** a refinement R-number on the weapon chip (parser-behavioral — Sacrificial, R-scaled buffs — must not vanish with the labels), an unset state that still reads "click to choose", and a reserved spot for the ◷ frames-not-curated marker.
- ⚠️ `SlotPortrait` popovers are `position: fixed` with a right-edge flip (`.sp-popover--flip`) — the TB bench holds the right viewport edge. Keep the flip working.
- Layer discipline is load-bearing: the **TB bench writes Layer 1** (roster constellations/loadout, and setting a con implies ownership) while the **planner column writes Layer 2** (tab overrides, never touching the roster). See `docs/rounds/tb-loadout-constellation-port.md`. `probe-loadout-con-layers.mjs` guards this.
- Set both bench-width tokens together when the design lands, and re-run `probe-bench-align.mjs` (its frame-top assertion is independent of width, but `probe-frame-rework`'s `box.left == portraits.right` pixel-parity check reads `LABEL_W`).

## Open / deferred

- Real mobile treatment (the mobile usability pass) — this round only made narrow widths side-locked-consistent, not good.
- Extracting the RP label column into a shared bench component — revisit only after the bench-card redesign lands, if ever.
- The planner picker's tiles carry no capability badges, so you can filter by "Heals" without seeing which capability matched. Deliberate (badges are a TB browsing affordance and would change tile density) — revisit only if it reads as a gap.

Related: `docs/rounds/tb-final-layout.md` · `docs/rounds/style-reference.md` · `docs/rounds/simplification-round-2026-07-24.md` · `docs/rounds/design-principle-nonmodal-tools.md`
