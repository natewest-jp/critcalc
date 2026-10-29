# Archive: completed Rotation Planner features (April to May 2026)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

This file collapses six former per-feature memory docs into one. Each section is just the residual knowledge — the _design choices_ worth keeping after the code itself became the source of truth. When the live answer is in code or in another memory, that's noted inline.

---

## Frames Overhaul (shipped 2026-04-15)

Replaced the single `castTime: number` (seconds) model with per-next-action frame maps sourced from gcsim and KQM at 60fps. Unlocks correct buff-window modeling for stance DPS characters (Cyno etc.).

**Where the live knowledge now lives:** [reference_framemap_conventions.md](reference_framemap_conventions.md) for canonical key sets per ability type and gcsim/KQM source priority. [reference_data_schema.md](reference_data_schema.md) for the current `FrameMap` / `NormalHit` shape.

**Settled conventions worth retaining:**

- All `frames` values are integers at 60fps; rendering divides by 60.
- `frames.swap` = gcsim's `ActionSwap` (the swap cancel time, not `AnimationLength`).
- Absent keys fall back to `frames.swap` in the parser.
- Dash duration: global 21 frames. Per-character dash timings deferred indefinitely (negligible accuracy gain vs curation cost).
- Bow `N→N` values in gcsim are unreliable — `InitNormalCancelSlice` leaves bow ActionAttack at the full animation fallback. Always cross-check bow N→N against KQM. Bow D/J ARE reliable (they equal hitmark).
- KQM is authoritative for unusual animation variants (e.g. Bennett h2E J cancel) where gcsim has recording errors. D and J should be within a few frames of each other; >10f gap is a red flag.
- Charged attacks: `chargeFrames` (single FrameMap) for sword/claymore/polearm; `chargeHits[]` (NormalHit array) for bow — index 0 = C1 partial charge, index 1 = C2 full charge. Parser: `C` → last entry (full-charge default), `C1` → index 0, `C2` → index 1.
- **Multi-hit cancel convention:** for attacks with multiple sub-hitmarks (e.g. a double-hit N4), all FrameMap keys must use the _final_ hitmark as cancel point. Cancelling before the last hit lands loses damage and isn't a valid rotation decision.
- Attack speed and hitlag: deferred.

**Accuracy improvements that landed in this overhaul (2026-04-15):**

- `cooldownStartDelay?: number` (frames) — additive to `qReadyAt` and E queue positions. Used on Ganyu E (10), Bennett Q (34), Xingqiu E (10), Fischl E (18, gcsim modeled this as `CD + 18f`).
- Xingqiu Q duration `15` → `15.55` (= 933f / 60); Q is `follows` so this is purely visual.

**Out of scope (post-overhaul):** stance-specific combined input tokens (sQ, EQ for Flins-shape mini-bursts), `CA`/`CS` aliases for `C` (KQM convention inconsistency), attack-speed modifiers, hitlag simulation, character-specific dash counts, multi-hit normal hitmark tracking (only final hitmark matters for cursor), per-character plunge frames (schema stub exists via `plungeFrames?`).

---

## Activity-Row Building Block Redesign (shipped 2026-04-15)

Replaced the activity row's continuous colored bar with discrete per-input building blocks, each sized to its frame-accurate duration. E/Q labels moved from the effect bars into the activity row alongside N/C/D/J. Frame-accurate widths make timing choices immediately readable.

**Where the live knowledge now lives:** the InputBlock model is in [project_parser_architecture.md](parser-architecture.md) and the schema reference. RotationTimeline.svelte's activity-row rendering is the canonical implementation.

**Design call worth retaining:**

- "elemental-normal" InputBlock kind exists for catalysts and bow CA — extends elemental-color tinting to non-stance N hits (e.g. Yoimiya in Niwabi, infused N attacks).
- `InputBlock` replaces the older `LabelSegment` shape; the rename was the seam between the old continuous-bar model and the per-input rendering.

---

## Tabs + Save Bank (shipped 2026-04-05)

Multi-tab notation editor (max 6 tabs, persisted to `critcalc:rotationTabs`) plus a separate persistent save bank for named rotations. Tabs and saves are linked by an optional `savedId` field.

**Where the live knowledge now lives:** [project_stores.md](../design/profiles-and-surfaces-design.md) for store shapes (`savedNotations`, etc.). `+page.svelte` and `SavedNotationsOverlay.svelte` for the implementation.

**Design call worth retaining:**

- Active tab's `notation` + `manualSlots` are held in detached `$state` (not derived from the `tabs` array) so CodeMirror can bind directly. `flush()` syncs live state back into `tabs` before any tab switch/add/close. A single `$effect` auto-persists all four reactive values to localStorage on every change (no circular reactivity — only state → localStorage).
- Inline tab rename: double-click label, `focusInput` action selects all.
- CSS trick: active tab's `border-bottom-color` matches content bg + `margin-bottom: -1px` to merge with the content border.

---

## Weapon & Artifact Loadout UI (Pass 1) (shipped 2026-04-18)

Two-layer loadout architecture: per-character defaults in the `loadout` store + per-tab overrides applied via `effectiveLoadout`. Label-column UI: avatar + constellation pip popover (top-right, clear of the avatar click area) + artifact dropdown row + weapon dropdown + refinement (R1–R5) row when a weapon is selected. Polearm characters get the weapon dropdown disabled with a "No polearm-type weapons available" tooltip.

**Where the live knowledge now lives:** [project_stores.md](../design/profiles-and-surfaces-design.md) for `loadout` shape. `LoadoutDropdown.svelte` for the picker. [project_weapon_artifact_type_plan.md](weapon-artifact-type-plan.md) for what's wired in Pass 2 (current).

**Design call worth retaining:**

- Two-layer: `effectiveLoadout = $loadout[charId] ⊕ tabLoadout[charId]` per-character merge. Tab overrides only the keys present; everything else falls through to defaults. This pattern is reused for any future per-tab overrides.
- `LABEL_W = 126px`, `CHAR_BLOCK_H = 156px` (later 160 once char buff row landed). Constellation badge uses absolute positioning (`top: -5px; right: -22px`) to sit clear of the avatar click target.

---

## Summon Migration (shipped 2026-05-01)

Schema/parser/renderer refactor separating summon lifetime from ability cast window. The old `Ability.duration` was overloaded across "caster state window" (Hu Tao Paramita, Cyno burst stance), "summon lifetime" (Fischl Oz, Mona Bubble), and "field effect" (Bennett Q). The new shape: `summons[]` on skill/burst for entity lifetimes, decoupled from `behavior` and `duration` (which now mean caster-side state).

**Where the live knowledge now lives:** [reference_data_schema.md](reference_data_schema.md) for the canonical Summon shape. [project_parser_architecture.md](parser-architecture.md) for parser handling. [project_tier_c_architecture_plan.md](tier-c-architecture-plan.md) for the P3 `Summon.effects[]` + `summonTick` extension that landed during Tier C.

**Design calls worth retaining:**

- `summons[]` lives on skill/burst common fields AND on `AbilityVariant`. Variant summons[] override base.
- Behavior-aware accessors at the bottom of `ability.ts`: `getActiveDuration`, `findCastSummon`, etc. Always use these, not direct `ability.duration` reads.
- Summon lane is shared aux-row real estate with received-buff sub-rows under one `DEFAULT_RESERVED_AUX_ROWS=4` budget. Adding a summon costs exactly one buff stride (14px); the shared budget gives back exactly one row. Net per-slot height delta: zero per added summon.
- Summon-lane gap is **3px** (not 4px) above and below — chosen so the math above works.
- Below-timeline lanes (team buffs / Nightsoul / Moonsign) standardized on the same 12px bar + 2px padding as the per-character aux rows.

**Open follow-ups (still relevant):**

- Mona `terminatesOn: { type: "trigger", ... }` for Bubble's hit-with-impulse pop. Currently no schema for this; Mona Bubble caveats in JSON.
- Schema deprecation pass: once all curated chars use `summons[]`, remove the legacy `persistent` discriminated-union variants from `SkillAbility` / `BurstAbility` / `AbilityVariant`. Not urgent — accessors handle the legacy shape.
- Zhongli stele still uses legacy persistent shape (not yet migrated).
