# Team Builder loadout and constellation port (2026-07-21)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Status: ✅ SHIPPED — MERGED + PUSHED to `main` 2026-07-21 (`--no-ff` merge `1985630`, off `0a16790`; feature commit `7494566`; branch `feat/tb-loadout-con-port` retained). Nate browser-reviewed + approved.** The #4 "loadout on the TB" feature from `docs/rounds/team-builder-redesign-2026-07-20.md`, with the constellation cross-tool behavior codified alongside it.

**Post-review fix (Nate 2026-07-21, in the same merge):** the SlotPortrait constellation/refinement popover displayed BEHIND the Source panel in the TB Bench — the Bench's `position: sticky` creates a stacking context that trapped the viewport-fixed popover. Fix: a `use:portal` action moves the popover + backdrop to `<body>` (root stacking context; the compiled scope class rides along so scoped styles still apply), z-index `949/950` (clears the tool panels, below the 1000 modal layer). Verified: popover's parent is `<body>`, hit-tests as the top element. All gates green: `npx vitest run` 1218 ✓, `npm run check` 0 errors, `npm run lint` clean; `probe-frame-rework` 26/26 (planner pixel-parity intact — `box.left=192 portraits.right=192`), `probe-team-builder` ALL PASSED (2 selector updates: `.bn-slot-audition`→`.bn-act--audition`, `.bn-slot-name`→`.bn-slot--filled .sp-char-name`, planner `.rp-char-name`/`.rp-avatar-chip`→`.sp-*`), **new `scripts/probe-loadout-con-layers.mjs` (15 checks) ALL PASSED** — the durable regression guard for the whole two-layer model.

**What shipped (3 phases):**

1. **Data model.** `tabCon` added throughout the planner page (Tab type, flush/switch/add/close/reset, save/load, share/import) + `SavedNotation.tabCon` (stores.ts). RotationTimeline gained a `tabCon` prop + `onTabConChange` callback + an `effectiveCon` derived (`{...$constellations, ...tabCon}`) and `effectiveConLevel(id) = tabCon[id] ?? $constellations[id] ?? 0`, fed to parser/summon/PNG-export/chip/popover. `setConstellation` now calls `onTabConChange` (Layer 2) — **the planner no longer writes global `constellations` at all** (verified: chip→tabCon, roster stays `null`). **Densify-on-save** (`densifiedSnapshot()` in +page.svelte) freezes resolved con+loadout for all 4 slots into the bank; open tabs keep sparse tabCon (live-fallback). `importShared` writes incoming con to `tabCon` (non-stomping, was global); `handleShare` reads effective con.
2. **Shared component `src/lib/components/SlotPortrait.svelte`** — extracted the whole planner portrait card (id-row + portrait + loadout rows + con/refinement popovers + backdrop) with `sp-*` classes. **DEVIATION from the plan's "layer prop": it's PURELY presentational + callback-driven** (`conLevel`/`loadoutEntry` in, `onSetCon`/`onSetArtifact`/`onSetWeapon`/`onSetRefinement`/`onPortraitClick` out) — the host wires which layer the write lands in, so the component never knows about layers or touches a store. The planner's inline markup + popovers + dead styles were deleted; `.rp-popover-backdrop` KEPT (still used by the PNG export menu).
3. **TB Bench hosts SlotPortrait** (Nate's call: "same layout as the planner, as close as possible, incl. the blank portrait + Empty display"). Bench.svelte rewritten: 4 stacked SlotPortrait cards (empty slots render honestly), con→`constellations.setLevel` + implies owned (roster rule, mirrors DetailCard), loadout→`loadout.setWeapon/setArtifact` (Layer-1 loadout editing is net-new). Bench-only extras: `⇄ Audition`/`✕ Remove` footer per filled slot (`.bn-act`/`.bn-act--audition`/`.bn-act--remove`); `.bn-slot--empty`/`--filled` hooks kept for the probe. NOT on Source tiles (unchanged).

Original phase-sizing note (kept for context): planner-touching (extracts the portrait area from the 3000-line RotationTimeline; touches save/load semantics). Was recommended as its own branch, ideally a focused session — which is how it was built.

## The settled two-layer model (constellation AND loadout, identical shape)

**Principle (Nate 2026-07-21): the Roster supersedes the RP's legacy ability to write Layer 1.** The RP could write global constellation/loadout only because it was once the only tool; now the Roster is the clean canonical place for character defaults.

- **Layer 1 = the Roster (global, per-character default).** Stores: `constellations` (`critcalc:constellations`) + `loadout` (`critcalc:loadout`). **Edited ONLY in the TB** (Detail card + the ported Bench portrait). Setting a **constellation in the TB implies owned** (existing Phase-3 behavior). This is what "My roster" filtering trusts.
- **Layer 2 = the planner tab (per-tab override).** `tabLoadout` already exists; **add `tabCon` beside it** (parallel `Record<characterId, number>`). The planner's portrait chips write Layer 2 ONLY and **never mark owned** (theorycraft ≠ ownership).
- **Effective value in a tab = `tabX[id] ?? layer1[id]`** — field-by-field fallback (exactly how `effectiveLoadoutEntry` already resolves loadout).
- **Fresh/blank rotation sources Layer 1 as its defaults**; every change after that is a Layer-2 per-tab change. The RP's current `constellations.setLevel` write (RotationTimeline.svelte ~L889) is RETIRED → writes `tabCon` instead.

### Two implementation details that make it airtight

1. **Densify-on-SAVE.** Today `tabLoadout` is persisted SPARSE (only explicit overrides) into `SavedNotation.tabLoadout`, so an un-overridden field re-resolves to the CURRENT roster on load and DRIFTS. To make saved rotations faithful (Nate: "isn't migrated back to Layer 1"), **snapshot the resolved effective con+loadout for all four slots at save time** (dense). Add `tabCon` to `SavedNotation`. This also closes an existing loadout-save gap.
2. **Open tabs live-fallback, saved rotations frozen** (Nate-confirmed lean). An open/unsaved tab's un-overridden fields track later Roster changes (live-fallback — matches current `tabLoadout`); saving freezes them via #1. Net: _scratch work stays current, saved artifacts stay faithful._

### Ownership stays clean

RP (Layer 2) never marks owned; only the Roster (Layer 1) does. Fixes today's asymmetry where the planner con-chip writes global con WITHOUT marking owned (while the TB does).

## Grounded facts (verified 2026-07-21)

- `SavedNotation` already carries `tabLoadout?: Record<string, LoadoutEntry>` (stores.ts:26); planner save/load already round-trips it (rotation-planner/+page.svelte ~L128/154/189/197). So `tabCon` just joins the same plumbing.
- Planner con-chip currently writes the GLOBAL `constellations` store (`openConstellation`→`setLevel`, RotationTimeline ~L875-889) — the write to retire.
- Loadout Layer 1 (`loadout` store) is currently written by NOTHING (the TB never reads/writes it — the redesign's known gap); the planner chips write `tabLoadout` (Layer 2). So Layer-1 editing is net-new in the TB.
- Planner portrait area (portrait + `rp-cons-chip` + `.rp-loadout-rows` chips): RotationTimeline.svelte ~L1099-1200. `effectiveLoadoutEntry(id)` resolves L2⇒L1.

## Port plan sketch (portrait-area import)

- **Extract** the planner's portrait card (portrait + con chip + loadout chips + their inline popovers) into a shared component taking a **layer prop**: `layer: 'roster' | 'tab'`. `'roster'` (TB) → writes Layer 1, con implies owned; `'tab'` (planner) → writes `tabCon`/`tabLoadout`, resolves via fallback, no ownership.
- **TB Bench** consumes the shared portrait for its slots (gains Layer-1 con+loadout editing; the Detail card also edits Layer 1). **Never on Source tiles** (Nate's earlier call — clutter).
- **Planner** swaps its inline portrait markup for the shared component (`layer='tab'`); the con-chip now writes `tabCon`.
- Gates: vitest + check + lint; probe-team-builder + a planner probe; **verify a save/load round-trip freezes con+loadout against a subsequent roster change** (the densify-on-save guarantee).

## Resolved at implement time

- **Bench slot cards: REPLACED (not augmented)** — Nate 2026-07-21: "the same layout as the Rotation Planner, as close as possible, along with the Blank portrait and Empty display when no character is loaded." So the Bench renders the full SlotPortrait card per slot (filled + empty), not a lighter variant.
- **Override-indicator UI: stayed SILENT** (no visual mark of a tab overriding the roster) — matches the existing loadout decision.

## Deferred / possible follow-ups (post-review)

- **DetailCard loadout editing.** The plan mentioned L1 loadout editing in "the TB (Bench + Detail)". The Bench now hosts it; the DetailCard still edits Layer-1 con (+owned) via its own stepper but has NO loadout controls. Adding loadout to the DetailCard would be consistent but wasn't needed for the ask — left as an optional follow-up.
- **Bench column width.** Left at the existing 210px; the wider planner-style card fits but Nate may want to widen it (would touch the `.tb` grid `grid-template-columns`).
- SlotPortrait's filled-slot portrait click in the Bench opens the Detail card (`onOpen`); empty-slot portraits are non-interactive (no planner-style selector in the TB — the Source panel is always visible). Revisit if Nate wants empty-slot click to focus the roster.
