# Team Builder final layout (designed + built 2026-07-30)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**✅ FOLLOW-ON BUILT 2026-07-30: `docs/rounds/mirrored-tool-surfaces.md`** — one `.frame` per tool, TB filter rail LEFT via CharacterGrid, TB viewport-fit/internal-scroll, RP picker covers everything right of the portrait column, benches side-locked. **It SUPERSEDES this memory's layout details**: `--bn-drop` and bench stickiness are RETIRED, the ≤900px bench-on-top is REMOVED, and the bench no longer wears `frame` (it's a zone of the page's frame). Everything about _behavior_ below — Compare-as-accumulator, the center Compare view, the Detail modal, audition — is unchanged and still current.

**✅ Status: Nate APPROVED ("this is what I envisioned") — `0d58526` (the layout) + `e6c9b74` (refinement round 1), MERGED to `main` and PUSHED 2026-07-30 alongside the Mirrored Surfaces round (`c68f396`). LIVE on the noindexed site.** All gates green (1297 vitest, check 0, lint clean); probes rewritten + passing (probe-team-builder ALL, probe-tb-bench-right 15/15, probe-loadout-con-layers ALL, probe-frame-rework planner-parity intact).

**Refinement round 1 (`e6c9b74`, Nate-requested):** (1) **`.tab--lg`** — NEW app.css tab-size variant (promoted scale for a primary surface switcher; document tabs stay base; styleguide specimen updated) — the TB Source row wears it. (2) Tab stack switched to **side avatars** (site-wide circular side crop, 24px circles / 16px offset). (3) **ConMode = full stepper `c0`…`c6` + `mine`** (`'max'` RETIRED — check facets.ts before assuming the old three-mode shape). Verified: heals 38@C0 → 39@C2 → 41@C6; full row fits one line down to 760px.

## The settled shape — "selections fly to their destinations; work happens center"

- **`.tb` is ONE static grid at every width: `Source(1fr) | Bench(210px)`.** No `.tb--inspect`/`.tb--compare` modifiers, no dock breakpoints, no `stageMode` — the Stage column is RETIRED. Nothing ever reflows the grid.
- **The Compare tab IS the accumulator (NATE'S design — he pitched it over my rail-shelf proposal).** `→ Compare` on a card silently adds the pick; feedback = overlapping mini side-avatars INSIDE the tab label (Saved-Rotations stack grammar, 18px circles / 12px offset, element-tinted borders). No tray (`CompareTray.svelte` DELETED), no navigation on add; click the tab when ready. Removal via card toggle or legend-chip ✕ — tab avatars are NOT interactive. Empty state at 0 picks teaches the flow. ≥1 pick renders (no min-2 rule).
- **Compare = first-class center view** (Source's third tab): works at EVERY viewport (its modal fallback + the 1400px dock are gone). Inside, the two goals Nate flagged get separate panels: **§ Timing on one ruler** (E/Q CD lanes + capability uptime bars; track width MEASURED and clamped 280–720px — `trackW` in CompareView; only real bars, no "no timing" placeholder lanes) then **§ Side by side** (transposed facts table, one column per character: E/Q CD incl. charges, Q energy, gate chips +🔒, targets, `~`, `also`; caveats via hover title).
- **DetailCard = modal-only (Nate's call mid-review; the tool's ONE deliberate modal — documented exception to `docs/rounds/design-principle-nonmodal-tools.md`).** `docked` prop deleted. Rationale: Detail was the Stage's only tenant post-compare-move, docking reflowed the Source on every open/close, and a focused single-character read suits a modal. Gained a `→ Compare` action (`.dc-compare`, distinct class so probes can target each action — two same-class buttons broke Playwright strict mode).
- **Audition is self-contained in the Compare view**: ⇄ NAVIGATES to the tab (explicit action, unlike a card's silent add) with the incumbent pinned + an in-view candidates strip — seed facets from `facetsProvidedBy` as TOGGLEABLE chips (fixes the AND-to-near-empty over-narrowing), candidates recompute live, `Use →` commits, commit/cancel RETURNS to the tab the audition started from (`auditionReturnTab`). The old flip-to-Roster + facet pre-seed choreography is retired. Audition state survives manual tab switches (you can still add candidates from the Roster grid).

## Bug found + fixed en route

**SlotPortrait popovers overflowed the right viewport edge in the TB Bench** (latent since bench-right, chunk 2 07-25): `anchorTo` always opened at `rect.right + 8`; at 1600px the con popover (210px) landed at x1553→1763. Fix: flip to `rect.left − 8` + `.sp-popover--flip` (`translate(-100%,-50%)`) when `rect.right + 8 + 220 > innerWidth`. Planner (left column) unaffected — probe-frame-rework still green.

## Stale probes repaired (design-migration fallout, pre-existing)

`probe-loadout-con-layers.mjs` used retired `.tb-btn`/`.action-btn--primary` (→ `.rp-tab-bar-actions .btn` / `.btn--primary`); `probe-bench-align.mjs` used `.tab-bar` (→ `.rp-tab-bar`). Both green now.

## Also updated

Help chapter §compare copy (tab-as-accumulator flow); styleguide bespoke-buttons prose (`.tray-pick`→`.tb-cand`). Bench/RP frame alignment still holds (both y=109 @1600).

## Verified at the browser surface

1600/1280/1040/760: compare in-flow everywhere, detail modal fixed at all widths, no Source reflow on detail open, tab stack live-syncs add/remove/clear, bench flattens <900 (bench-on-top), audition full round trip incl. relax-chips→118 candidates→commit→return-to-atlas.
