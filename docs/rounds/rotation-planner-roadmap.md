# Rotation Planner feature roadmap (April 2026)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Decided across brainstorm sessions 2026-04-02 and 2026-04-03. Organized by priority tier.

---

## Immediate Next Steps (ordered, agreed 2026-04-03)

### ~~1. Team composition derived state~~ ✓ Done 2026-04-03

`deriveTeamComposition` in `teamComposition.ts`. `TeamBonusesBlock.svelte` renders faction badges + permanentBonuses grid between timeline and panels.

### ~~1. NB (Nightsoul Burst) lane~~ ✓ Done 2026-04-05

Visible when ≥1 Natlan unit in team (`region === 'Natlan'`). Trigger events: all E/Q cast starts + `labelSegments[].start` for catalyst character tracks (activeStart explicitly excluded — only fires when the user has typed actions, not just on swap). Cooldown: 18s (1 Natlan), 12s (2), 9s (3–4). NB is instant (no duration); rendered as `rp-bar-cd rp-bar-instant` bars in amber (#f0a030). Label column shows "NIGHT-/SOUL". Lane sits below character blocks, above AG lane.

### ~~3. Moonsign lane~~ ✓ Done 2026-04-06

Visible when `hasAscendantGleam` (≥2 Moonsign units). 1–2 sub-rows, one per non-Moonsign character (`nonMoonsignSlots`). Each row: rolling 20s window triggered by that character's E/Q casts. Windows refresh (don't stack); two characters' windows can overlap independently. `computeMoonsignRows()` in `RotationTimeline.svelte`.

### ~~4. Permanent bonuses block~~ ✓ Done 2026-04-03

(See previous session note — `TeamBonusesBlock.svelte` implemented between timeline and panels.)

### ~~5. Skill charges~~ ✓ Done 2026-04-09

`eReadyAt` replaced with `eChargeQueues: Map<string, number[]>` in `notationParser.ts` — a sorted array of per-charge expiry timestamps. Casting picks `queue[0]` (earliest-ready), advances cursor if depleted, then re-sorts. Charge count resolved via `resolveEffectiveCharges()` using `chargeModifiers` + constellation level. `evalCondition` now resolves `constellation` conditions definitively when `constellationLevel` is provided; previously always returned `null`. `parseNotation` accepts `constellationLevels?: Record<string, number>`; `RotationTimeline.svelte` passes `$constellations`. Test case: Ganyu C2 (C2 chargeModifier gives her 2 charges on Trail of the Qilin).

### ~~5b. Timeline bar styling~~ ✓ Done 2026-04-10

Three-phase E/Q bar system finalized (Phase 1: solid + hi border, Phase 2: dim continuation for CD < duration cases, Phase 3: opaque color-mix ghost CD bar). Z-index hierarchy: Phase 1/2 (z:2) > swap connectors (z:1) > Phase 3 (z:0). Hydro color settled at `#1472f0`. See `docs/rounds/ui-design.md` for full details.

### ~~5c. Frame-accurate timing overhaul~~ ✓ Done 2026-04-14

Batches 1–3 + Batch 2.5 complete on branch `rotation-planner-frames-overhaul`. `castTime` fully replaced by per-action `FrameMap` data from gcsim/KQM. Parser now: lookahead-based frame resolution for E/Q/N/C/D/J; N5 = 5-hit chain; bracket expansion; stance mechanics (Cyno). All 4 original characters + Cyno curated. See `project_frames_overhaul.md` for full record.

### ~~5d. Building block activity row redesign~~ ✓ Done 2026-04-15

Branch `rp-renderer-building-block-redesign`. `LabelSegment` → `InputBlock` (`start`, `duration`, `parts`, `kind`). Parser emits blocks directly per token — no more flush/segment accumulation. Active row replaced: continuous bar + cast overlays → `rp-active-bg` dim strip + per-block `rp-input-block` divs. `InputBlockKind`: `normal | elemental-normal | skill | burst | movement | unset`. Elemental tint (`p.border`) applied to `skill`, `burst`, catalyst N (`elemental-normal`), and bow C/C2 (`elemental-normal`; C1 stays `normal`). E/Q uptime bars now show a small left-edge "E"/"Q" badge instead of the label. Block gaps use `border-right: 1px solid #1a2540`; last block in each track has no right border (no gap vs swap connector). Stance-based infusion (Hu Tao, Xiao, Raiden, etc.) deferred to a future pass.

### ~~6. Team buffs row (character buffs)~~ ✓ Done 2026-04-17

`computeTeamBuffRows()` in `RotationTimeline.svelte`. One sub-row per (characterId, stat) pair. Buff bars start at `summonActivatesAt` offset. Neutral blue style, stat icon + label. Icons: `/assets/effects/` for stats, `/assets/elements/flat-white/` for elemental DMG bonus (omni/lunar/element PNGs). Also fixed NB bug (catalyst NB trigger now filters movement/unset blocks).

### ~~6b. Weapon & artifact loadouts — UI (Pass 1)~~ ✓ Done 2026-04-18

Two-layer loadout design (character defaults + tab overrides). `LoadoutEntry` store, `LoadoutDropdown.svelte`, artifact/weapon sub-rows in timeline label column and CharacterSelector slots, `RotationCharacterPanel` updated. `artifactLookup.ts` + `weaponLookup.ts` stubs. Full details in `project_weapon_artifact_ui_plan.md`.

### ~~6c. Tooltip + buff merge~~ ✓ Done 2026-04-20

Hover tooltips on all buff bars (team buffs + received weapon buffs). `position: fixed` portal escapes scroll-container clipping. Widsith 3-theme ICD dedup → one bar, `isMutuallyExclusive: true`, "one of:" prefix in tooltip. Source-grouping in `computeTeamBuffRows`: keyed by `(characterId, abilityLabel)` instead of `(characterId, stat)` — Bennett C6 Q collapses from 2 rows to 1. `formatBuffDisplayValue` resolves flat, refinement-scaled, and `scaling`-type values. Buff bar labels now show source name; tooltip shows stat+value+duration+procCooldown.

### ~~6d. Individual buff rows — active-target segmentation + ramping~~ ✓ Done 2026-04-21

Active-target (`target: "active"`) buff effects skip the team buff row and appear segmented per on-field window in each character's individual buff row. Each swap cuts the bar; only the last active segment extends to `buffEnd` showing full remaining duration. `ramping` BuffValue type added (`startValue`, `stepValue`, `stepInterval`, `cap`); rendered as a gradient (dim at ramp start → full at cap), per-segment gradient offset accounts for time already elapsed. Weapon proc ICD rows now participate in vertical stacking. (Layout: superseded by the shared aux-row budget shipped 2026-05-01 — see roadmap entry 6g-bis.)
Self-target (`target: "self"`) buff effects also wired into the individual buff row (same session, 2026-04-21): shown as a full-duration bar on the source character's row only, no segmentation needed.

### ~~6e. Parser-bugfix branch (PRs 1-3 + Decision A)~~ ✓ Done 2026-04-22

Bug #1 (sac proc charge queue corruption), Bug #2 (tabLoadout persistence), Bug #3 (variant modifiers replaced base, not composed), Bug #4 (`(e as any).ability` cast removed via trigger narrowing), Bug #7 (evalCondition exhaustiveness guard), Decision A (cdReset.ability collapsed into trigger.ability across all 4 sac weapons). Vitest + 4 regression tests added. Variant modifier arrays now **replace** base arrays semantically.

### ~~6f. Schema refactor — discriminated union + effect relocation + factionBonuses~~ ✓ Done 2026-04-25

Major type-system refactor (parser-bugfix branch closeout):

- `Ability` is now a discriminated union over `abilityType` (NormalAbility / SkillAbility / BurstAbility / PassiveAbility / ConstellationAbility). Skill/burst additionally discriminated over `behavior` (instant/persistent/stance), with `duration` required on persistent/stance and `cooldown`/`frames`/`energyCost` required on the appropriate variants.
- Behavior-aware accessors added: `getDuration`, `getSummonActivatesAt`, `getPersistentBehavior`, `getStanceExtension`, `getTerminatesOnSwap`. (Renamed to `getActiveDuration` etc. in the 2026-05-01 summon migration; the legacy persistent-shape fields they read are still supported on uncurated character stubs.)
- `permanentBonuses[]` removed from `CharacterData`. TeamBonusesBlock derives chips from passives whose effects have `trigger.type === "passive"`.
- New top-level `factionBonuses[]` on `CharacterData` for team-conditional faction effects (Fischl Hexerei migrated; 4 duplicated effects → 2 in dedicated array).
- Effects relocated from host abilities to their source nodes (passives, constellations, factionBonuses); `attribution` field deprecated. `getCharacterEffectsForCast` / `getCharacterEffectsForAfterDuration` helpers in `RotationTimeline.svelte` walk all sources.
- Pruned legacy: `abilityType: "charged" | "plunge" | "movement"` removed; `type: "movement"` on abilities removed; `type` field renamed to `behavior` on skill/burst, dropped on normal/passive/constellation.
- Renamed `note` → `description` and `_todo` → `_curatorNotes: string[]` everywhere; jsdoc contracts on each field document the audience boundary.
- `NormalAbility.plungeVariants[]` added to preserve Kazuha's hE→P frame variant after folding the standalone plunge ability into normal.
- `Trigger.afterDuration` gained optional `ability` field for constellation-relocated effects.
- All 117 character JSONs migrated (10 fully restructured by hand; 107 mechanically transformed via `scripts/migrate_character_jsons.mjs`).

### 6g. Remaining Nightsoul mechanics

Additional Natlan-specific mechanics TBD.

### ~~6g-bis. Summon Migration — Phases 1 + 2 + character migration~~ ✓ Done 2026-05-01

Schema-level split between caster-state `duration` and entity-lifetime `summons[]`, dedicated summon lane between E and Q rows, all 11 curated characters migrated. Notable layout outcomes from the same pass: per-slot `slotBlockH` (no static `CHAR_BLOCK_H`); shared aux-row budget where summon sub-rows + buff sub-rows count toward one `DEFAULT_RESERVED_AUX_ROWS=4` reservation; `LOADOUT_ROWS_H` removed from the slot height (loadout panel sits inside the label cell's existing real estate); below-timeline lanes (team buffs / Nightsoul / Moonsign) standardized on a 12px-bar + 2px-pad convention. Full state in `project_summon_migration.md`.

### 6h. Reaction-triggered effect rendering — NEXT

Today the timeline only renders `onCast` and `afterDuration` triggers. Reaction-triggered effects (Fischl Hexerei `factionBonuses`, Kazuha A4 swirl-buff, Viridescent Venerer artifact) live in JSON correctly but don't render anywhere. Wiring this requires modeling reaction events in the rotation; deferred until the data shape settles further.

---

### 7. Controls row / slider relocation

Two open questions to resolve together:

- **Ping slider** → move to a site settings page (alongside `useNewOutfits`, `swapFrames` already in `siteSettings` store)
- **Zoom slider** → two options under consideration:
  - **Option A:** Move inline with the ruler (right end of `.rp-scroll-wrapper`, absolutely positioned) — spatially logical, DAW/Gantt convention
  - **Option B:** Keep controls row but fill the left side with current rotation total duration (already computed in parser) — justifies the row's existence, useful info for players
- Not scheduled yet; decide at start of next session touching the timeline controls

---

## Planned Implementation (Definite Yes)

### Renderer: SVG overlay for connectors + gridlines (decided 2026-05-07)

Hybrid renderer direction. DOM keeps everything text-bearing or hover-target: E/Q three-phase bars, active-row input blocks, team-buff/weapon-proc bars, summon bars + ticks, ruler labels, NB/Moonsign bars, avatars, controls, popovers, tooltips. A single absolutely-positioned `<svg>` inside `.rp-tracks` owns two `<g>` layers:

- **Connectors** — replaces the `.rp-connector` div + `connectorStyle()` (`RotationTimeline.svelte` ~1082, ~1916). The current TR+BL / TL+BR `border-radius` flip becomes a `<path>` with `q`-curve bends.
- **Gridlines** — replaces the four `{#each majorTicks}` loops sprinkled across char-blocks and the three lanes (NB/Moonsign/team-buffs). One pass across the full track height instead of per-container redundancy.

**Prereq:** extract a single `xForTime(t)` helper used by both DOM bars and SVG layers. Today `barGeom` (~1070) and `connectorStyle` (~1085) each multiply by `scale` independently — small refactor to converge.

**Strategic value (the actual reason to do this):** connectors and gridlines aren't broken in DOM — the case is that the SVG layer becomes the substrate for two downstream items that genuinely don't fit in DOM:

- Entry 6h (reaction-triggered effects) needs curves from a reaction event on the active row to the buff bar it produces, possibly across rows. SVG paths.
- "Export as image" is dramatically cleaner via an alternate "data → single SVG" render → canvas → PNG, vs `html2canvas` on live DOM (which struggles with `color-mix`, the inset-`box-shadow` Phase-1 borders, and custom fonts).

**Z-stacking** maps cleanly: Phase-3 ghost bars (z:0) → SVG overlay (z:1) → Phase-1/2 bars (z:2). Same hierarchy as today, expressed via layer order rather than per-element z-index.

### Constellation-aware ability display

Use the existing `constellations` localStorage store (already wired up) to adjust ability panel text, durations, and effects in `RotationCharacterPanel.svelte`. Data is already in the JSONs.

### Buff active windows on timeline

Auto-derive buff windows from E/Q timing using ability data already in the character JSONs. The buff lane currently shows a placeholder — this replaces it with real data.

### URL-encoded state

Encode current rotation (notation string + team) in the URL hash. Enables bookmarking and sharing. Also enables cross-tool injection (e.g. team builder → planner). Replaces the sharing gap left by localStorage-only named slots.

### ~~Named rotation slots (localStorage)~~ ✓ Done 2026-04-05

Implemented as two interleaved features: **tabs** (up to 6, localStorage-persisted, inline rename, close) and a **save bank** (`SavedNotation` store + `SavedNotationsOverlay` modal). Tabs live at `+page.svelte` level. Save/Load buttons sit in the tab bar. Saved entries are linked to tabs via `savedId`; renaming a linked tab also renames the bank entry.

### Sample team rotations on load-in

On fresh load (no prior state), populate the tool with a random example from a small curated set (4–6 famous team comps). Gives new users something to immediately learn from. Could also include a "load example" button to cycle through them.

### Paste normalization

Silently fix common paste-in issues on input: extra newlines, Windows line endings, curly quotes, etc. Ongoing refinement as edge cases are discovered.

### Export as image

"Copy timeline as PNG" — for sharing in Discord or KQM documents. Key for community shareability.

### Export rotation as KQM-formatted text

Normalize internal representation back out to clean KQM notation with proper concatenation. Useful for contributing rotations back to the community.

---

## ~~Planned Implementation — CodeMirror Editor~~ ✓ Done 2026-04-03

CodeMirror replaced the `<textarea>`. Implemented: syntax highlighting, concatenated token support, visual token spacing, proper undo history, character name autocomplete, paste normalization with ~?s injection, slash or-alt notation, bracket repeat groups with numeric/range prefixes. Tokenizer (`tokenizer.ts`) is the shared contract between parser and editor.

---

## To Explore (Nice-to-Have, Not Scheduled)

- **Rotation loop mode** — show N cycles side by side to visually verify the loop closes
- **Buff uptime percentages** — surface uptime% per buff once the buff lane is real; deferred to avoid crowding the timeline and overstating precision

---

## Low Priority / Monitor

- Keybindings for notation input
- Downtime / gap detection on the timeline
- Click-to-inspect Gantt bars (tooltip with ability details)

---

## Explicitly Out of Scope

- **Particle generation tracking** — too RNG-dependent and finicky to simulate reliably
- **Reaction window / elemental aura overlay** — same reason; elemental gauge theory is too complex to model accurately
- **Server-side storage / accounts** — not planned; URL sharing + localStorage covers the real need for this tool
