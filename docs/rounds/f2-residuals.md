# F2 residuals: G-driven migrations, the N/CA/P renderer and custom events (2026-05-09)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

## What shipped 2026-05-09 (F2C-D — onTeamNightsoulBurst)

Session D shipped only the highest-leverage F2C primitive end-to-end:

- **Schema**: new `Trigger` variant `{ type: "onTeamNightsoulBurst" }` in `src/lib/types/ability.ts`. Global team event — fires from `nbBars` (the rolling-CD NB event timeline already computed by `computeNBBars`). Not gated on the trigger-owner being on-field (in-game OnNightsoulBurst is team-scoped).
- **Renderer**: new `getCharacterEffectsForTeamNightsoulBurst(char)` helper in `RotationTimeline.svelte`. New passes in (a) `computeTeamBuffRows` (team-buff row, after the N/CA/P loop) and (b) `charReceivedBuffRows` self-target loop (after the N/CA/P self-target loop). `nbBars` threaded through `computeTeamBuffRows` as a new arg. **Active-target NB rendering deliberately not wired** — no in-scope migration needed it. Only Iansan A2 has `target: "active"` and that's still deferred for other reasons (heal-on-NS-tick gap); add the active-target NB pass when Iansan finally lands.
- **Migrations** (4 chars): Mavuika A1 (+30% atk%, 10s self), Varesa A4 (+35% atk%, 12s self — single-stack only; 2-stack independent durations deferred), Xilonen A2 (+20% def%, 15s self), Ifa A1 (+80 EM, 10s self — also fixed `target: "team"` → `"self"` per description).
- **Curator-note updates** (deferred chars): Chasca A2 (gap is element-by-team-comp resolution, not trigger anymore), Iansan A2 (gap is heal-on-NS-tick + active-target NB renderer pass).
- **Lint**: type-driven (TS discriminated union); no allowlist updates needed. Existing rules don't false-flag the new trigger.
- **Tests**: 198 tests still passing (corpus lint exercises the migrations). No new synthetic tests added — TS handles the validity check.

Manual-trigger count: 210 → 208 (Xilonen A2 + Ifa A1 cleaned; Mavuika A1 / Varesa A4 added fresh effects).

## What shipped 2026-05-09 (F2A + F2B)

- **F2B renderer extension** (`13a98e2`) — generalized `getCharacterEffectsForOnHit` to all 5 ability classes (skill/burst/normal/charged/plunge); added `getBlockDamageTag(block)` + `resolveBlockContext(char, block)` helpers (analogues of `resolveCastContext` for input blocks). Wired a parallel input-block iteration into all 3 loops (team-buff, active-target, self-target). chargeHit-name folding (Wreath Arrow / Shadowpiercing Shot) so `filter.abilityName` substring filters Just Work.
- **F2A migrations** (`f80a34b`) — Yoimiya C2 (onHit + element pyro + isCrit, self pyroDmgBonus) and Tighnari A1 (onHit charged + abilityName Wreath Arrow, self EM). durationType:"refresh" on both for natural per-hit retriggering. Pass remained small per the original caveat.

## Deferred from F2A (each needs a different primitive, not just F2B)

- **Tighnari C1, Sethos C2** — permanent +CR/CD bonus on a _named attack_. Schema needs per-class CR/CD modifiers (`chargeCritRate`, `chargeCritDmg`); none today.
- **Sethos C4** — 80 EM team buff gated on hitting _2+ enemies_. Multi-target gating primitive missing.
- **Lyney C4** — resShred onHit charged + element pyro. Renderer doesn't visualize resShred yet (separate render pass).
- **Aloy A4** — ramping cryoDmgBonus while in Rushing Ice state. State-conditioned + ramping; not onHit-driven.
- **Itto A4** — Saichi-exclusion DEF→FlatDmg. Needs negative-match `abilityNameExclude` filter (G v2 follow-up).
- **Yoimiya A1** — cleaner as state-conditioned passive than per-N-hit accumulation.
- **Faruzan A4** — active-char-not-self conditional buff routing.

## What follows

After F1 + G shipped (2026-05-09), this captures the path from here to the manual-trigger backlog being substantially closed. **F2C remains** — see below.

## Current state

- F1 audit: 259 manual triggers across 88 characters
- F1 phase-1 (3 batches): **40 triggers cleaned** across 25 chars
- G primitive shipped: TriggerFilter (damageTag/element/abilityName/hitIndex/isCrit), damageTag fields, getDefaultDamageTag inference, onHit renderer expansion (skill/burst class)
- **Remaining: ~219 manual triggers**

## F2A — G-driven sub-ability migrations (~30 effects)

What G unlocks now that the renderer's onHit pass works for skill/burst class. These can ship today.

### Skill/burst-class onHit with sub-ability filter

Already authorable via G; rendering already wired:

| Char / Effect                              | Filter                                                                                                   | Notes                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Diluc C2 Searing Onslaught**             | `damageTag: "skillHold"` (Hold-only DMG bonus) — wait, Diluc C2 is on-player-hit; not a skill-hit filter | Re-check before migrating            |
| **Wriothesley Icefang Rush**               | n/a                                                                                                      | Stance behavior, not an onHit filter |
| **Lynette C6** (already migrated in F1 b1) | could refine to filter both press/Hold variants, but no need                                             | Already shipping                     |

Hmm — most of the cleanly skill-class-with-Hold-only effects are concentrated in characters whose Hold variants the planner already resolves through `variants[]`. The sub-ability filter primarily benefits characters whose Hold OR press fires a _different_ effect, which is rare for skill-onHit.

Realistically: **Chevreuse C2** is the canonical case (already migrated as the G proof point). Other immediate skill/burst-class wins are limited.

### Burst-class onHit migrations

Audit residuals don't have many burst-class onHit + filter cases. Most burst onHit triggers are coarse (Venti C6, Itto burst resShred — already migrated in F1).

**F2A is therefore a small pass.** The bigger payoff is in F2B.

## F2B — N/CA/P onHit rendering + migrations (~20+ effects)

The single biggest unblock for the residual backlog. Today the renderer's onHit pass only iterates eBars/qBars. Extending to N/CA/P inputBlocks would render onHit-triggered buffs from normal-attack hits.

### Renderer architecture for N/CA/P onHit

Sketch:

1. For each character segment, iterate `track.inputBlocks` for `kind ∈ {"normal", "elemental-normal", ...}`.
2. For each block, derive a TriggerFilterContext (resolveBlockContext) — same shape as resolveCastContext, with hitIndex from the block index.
3. Iterate onHit effects with `abilityType ∈ {"normal", "charged", "plunge"}` (extend getCharacterEffectsForOnHit).
4. Apply trigger filter eval per block; emit buff bars from block start.

Tricky bits:

- Buffs typically last X seconds; refreshing is expressed via `durationType: "refresh"`. For a buff that fires on every N hit and refreshes, the rendered window is "from first N hit + refresh chain". The existing `durationType: "refresh"` semantics handle this.
- Stack-based buffs (Yoimiya A1) need to render the cumulative stack count at peak. Schema already has `perStack` BuffValue and the renderer evaluates it.
- **State-conditioned buffs as an alternative**: Yoimiya A1 (max 10 stacks while in stance) is more cleanly modeled as `passive + state: "inStance"` rather than per-N-hit firing. Recommend authoring at the state level when the buff is uniformly up during a state window.

### Migrations that unlock with F2B

| Char / Effect                                                             | Filter shape                                                                                                        | Notes                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Aloy A4 Strong Strike**                                                 | `abilityType: charged + abilityName: "Pressurized Floe"`                                                            | Coil-build CA bonus                                                        |
| **Itto A4 Bloodline of the Crimson Oni**                                  | `abilityType: charged + abilityName != "Saichi"` (need negative match — flag as G v2 follow-up)                     | DEF→FlatDmg on Kesagiri only                                               |
| **Yoimiya A1 Tricks of the Trouble-Maker**                                | Better authored as state-conditioned passive (`state: inStance + element: pyro`)                                    | The per-hit accumulation is the in-game model but the buff is uniformly up |
| **Yoimiya C2 A Procession of Bonfires**                                   | `element: pyro + isCrit: true`                                                                                      | Generic onHit catches on any of Yoimiya's casts                            |
| **Faruzan A4 Lost Wisdom of the Seven Caverns**                           | `element: anemo + active-char-conditional`                                                                          | Active-char-not-self is a separate gap (teammate-hit primitive)            |
| **Lyney C4 Well-Versed, Well-Rehearsed**                                  | `abilityType: charged + element: pyro`                                                                              | -20% pyro RES on Pyro CA hits                                              |
| **Tighnari A1 / A4 / C1 / C6**                                            | `abilityType: charged + abilityName: "Wreath Arrow"`                                                                | Wreath-Arrow-only sub-filter pattern                                       |
| **Sethos The Sand King's Boon / Spiritsong / Beneficent Plumage**         | `abilityType: charged + abilityName: "Shadowpiercing Shot"`                                                         | Sub-name filter                                                            |
| **Kuki A4 To Sever Sealing**                                              | `abilityType: normal/charged/plunge` (multi-class) — needs filter to allow array of abilityType OR multiple effects | Expanding filter shape                                                     |
| **Razor C2 Suppression**                                                  | `enemy HP < 30%` — separate condition primitive (not G)                                                             | Skip in F2B; flagged elsewhere                                             |
| **Sucrose A4 Mollis Favonius** (already F1-migrated to onHit:skill)       | Could refine to render now with skill class onHit pass                                                              | Verify renders correctly                                                   |
| **Yun Jin A4 Breaking Conventions** (already F1-migrated to onHit:normal) | Renders once F2B ships                                                                                              | Verify                                                                     |
| **Heizou A4 Penetrative Reasoning** (already F1-migrated to onHit:skill)  | Renders today                                                                                                       | Verify                                                                     |

### F2B negative-match filter (sub-task)

Itto A4 Saichi-exclusion needs `NOT abilityName: "Saichi"`. Two paths:

1. Extend `TriggerFilter.abilityName` to support a pattern like `{ exclude: "Saichi" }` or accept `!Saichi` syntax
2. Add a parallel `TriggerFilter.abilityNameExclude?: string` field

Either is small. Defer until Itto A4 actually gets touched.

## F2C — Custom-event trigger primitives (~25 effects)

New entries in the `Trigger` union. Each is a small extension; authored against gcsim's event subscriptions. Cluster them into one session.

| New trigger variant                                       | Effects unlocked                                             | Notes                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `onTargetDied`                                            | Hu Tao A4 Garden of Eternal Rest, Yoimiya C1                 | Fires on enemy death, optionally filtered to enemies in a debuffed state                      |
| `onParticleReceived`                                      | Venti C4 Hurricane of Freedom, Jean C2 People's Aegis        | Fires when the character picks up an Elemental Orb/Particle while active                      |
| `onAbsorbDirective`                                       | Arlecchino C2 / C4                                           | Specific to Arlecchino's BoL-economy; out of scope per BoL settled call                       |
| `onConstructSpawned`                                      | Chiori A4 The Finishing Touch                                | Fires when any Geo construct is created (own or teammate's)                                   |
| `onMirrorOverflow` / `onMirrorGenerated`                  | Alhaitham C6 Structuration, skill EM buff                    | Mirror-economy events                                                                         |
| `onShieldExpire` / `onShieldDestroyed`                    | Noelle A4 Devotion, Kachina C6                               | Could be a single primitive `onShieldEnd` (combining expire + destroy)                        |
| `onAbsorption` (elemental)                                | Sucrose C6 Chaotic Entropy, Xinyan-style                     | Fires when the burst absorbs a team element                                                   |
| `onSwapOut` for character effects (currently weapon-only) | Klee C6 Sparkly Explosion                                    | Renderer plumbing change too — currently `processWeaponEffects` only iterates weapon passives |
| `onPickup` (Puffer, etc.)                                 | Mualani C4 energy, Faruzan, Diona orb                        | Pickup-event-shaped                                                                           |
| `onHeal` / `onOverheal`                                   | Sigewinne C6, Wriothesley A4 ATK SPD overheal                | Two primitives — onHeal for any heal event, onOverheal for surplus-heal                       |
| `onPlayerHit` / `onTakeDamage`                            | Beidou C4, Wriothesley HP-drain effects                      | Fires when the character takes damage                                                         |
| `onTeamNightsoulBurst`                                    | Mavuika A1, Varesa A4, Xilonen A2, Chasca A2, Ifa, Iansan A2 | Already noted in tier-c-architecture-plan as deferred — high cohort impact                    |

### F2C session shape

For each primitive, the work is:

1. Add the trigger variant to `Trigger` union in ability.ts
2. Update `evalCondition` if any conditions reference it (typically not — these are triggers, not conditions)
3. Update lint vocabulary
4. Decide rendering treatment per primitive (most need to fire from a specific timeline event the parser produces; for events the parser doesn't track, the trigger is schema-correct but doesn't render)
5. Migrate the affected characters

The renderer treatment varies: `onTargetDied` doesn't render (we don't model deaths). `onParticleReceived` doesn't render (we don't model orb pickups). `onShieldExpire` could render if the parser tracks shield lifecycles. `onTeamNightsoulBurst` shipped 2026-05-09 (turned out NOT to be the trickiest — `nbBars` was already computed for the NB lane, so the new trigger threaded through cleanly).

Recommendation: **prioritize primitives with rendering value over primitives that are purely schema-fidelity.** `onTeamNightsoulBurst` ✅ shipped. `onShieldEnd` and `onConstructSpawned` are next-most-renderable but each only affects 1-2 characters (Noelle A4 + Kachina C6 for shield, Chiori A4 for construct) — bundle them with the relevant char's next touch rather than as a focused session. `onTargetDied`, `onPickup`, etc. are schema-correctness-only — same: author when the char gets touched.

## What's NOT in F2

- **BoL-related effects (Clorinde, Arlecchino)** — settled out-of-scope
- **Pre-release stub characters** — wait for upstream gcsim
- **Schema model mismatch** — separate session (see `docs/rounds/schema-model-mismatch.md`)
- **Periodic / runtime-state poll effects** — these need a periodic-evaluation primitive, separate design work
- **Per-stack value scaling for damage events** — Wriothesley snapshot mods, Navia stacks, etc. — a different scaling-form extension

## Sequencing recommendation

1. **Schema model mismatch** (separate session) — independent of G, can ship anytime
2. **F2B (N/CA/P renderer + G migrations)** — largest residual unblock; depends on G
3. **F2A (skill/burst onHit migrations)** — small pass, ship anytime post-G
4. **F2C (custom event triggers)** — cluster session; do after F2B clears the residual list down

After all three, the manual-trigger residual count drops from 219 → ~30, with the remainder being BoL + pre-release + truly-deferred-mechanic gaps.

## Caveats from G v1 implementation (read before F2A)

These are honest qualifications surfaced after writing G; future-me should know them before starting F2A.

- **G's day-one rendering value is small.** Most G-blocked residuals are N/CA/P-class (Aloy, Yoimiya A1, Faruzan A4, Tighnari Wreath, Sethos, Lyney C4). Those don't render until F2B's renderer expansion ships. Only Chevreuse C2 lands as an immediate skill-class win. G's schema is correct and ready, but visible-buff progress is mostly waiting on F2B. Reorder F2A → F2B if you want user-visible progress quickly.

- **The `isCrit` filter is somewhat aspirational in v1.** The renderer currently sets `ctx.isCrit = true` on all skill/burst contexts (optimistic-fire). So `isCrit: true` filters always pass and `isCrit: false` filters never match. Useful for migration fidelity (Yoimiya C2 etc. can be authored with the filter — schema and lint correctly accept it) but the filter doesn't actually gate anything yet. To make `isCrit` meaningful, the renderer needs a per-cast crit-mode (toggleable, or per-character-class default). Defer.

- **Schema model mismatch list is a starting point, not exhaustive.** The mismatch entries in `docs/rounds/schema-model-mismatch.md` came from grepping for "generator error/misclassification/misread" curator-note phrasings. Some mistypes have curator notes that don't match those phrasings — Citlali EM-scaling damage entries, Wanderer C1 stub damage that's actually a status, etc. When starting that session, do a fresh manual scan rather than trusting the list as complete.

- **F2A is a smaller pass than the architecture suggested.** The retrospective at session-start expected G to unlock ~30 effects. After implementation, the realistic skill/burst-class onHit migrations are closer to 5-10 (Chevreuse C2 + a handful of skill-onHit-with-element-filter cases). The bulk genuinely needs F2B.

- **Negative-match abilityName filter not yet shipped.** Itto A4 needs `NOT abilityName: "Saichi"` (Kesagiri-only DEF→FlatDmg). Two paths sketched in the F2B section above (object form `{ exclude: ... }` or parallel `abilityNameExclude` field) but neither is implemented. Decide and add when Itto A4 actually gets touched.

- **The `damageTag` bulk extractor stays deferred.** I planned to defer the gcsim-source → JSON-overrides migration script until at least one buff-filter consumer was wired. With G shipped, one consumer exists (Chevreuse C2). But the inference layer (`getDefaultDamageTag`) covers ~95% of cases without authoring, so the bulk migration remains low-priority. Spin up only when several explicit-override cases pile up.
