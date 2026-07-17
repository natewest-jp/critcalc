# Tier C Curation Guide

**Read this before starting any Tier C character.**

This is the active reference for hand-curating Tier C characters one at a time. The autonomous-run recipes (`recipe.md`, `recipe-tier-b.md`) are archival; Tier C characters are too bespoke for batch automation. The mode is "open the gcsim source, work the schema, flag what doesn't fit."

The canonical schema lives in `src/lib/types/ability.ts` (read the JSDoc) and `src/lib/types/character.ts`. The lint test in `src/lib/utils/characterLint.test.ts` is the trip-wire — run it after every change.

---

## Before you start

1. **Read `project_tier_c_architecture_plan.md` memory.** It carries the live status of the schema proposals (P1–P5). What you can use today depends on which proposals have shipped.
2. **Run `npm test`** to confirm the baseline is green. Aggressive-migration posture means _the lint must pass on main before you touch anything_. If it's red, fix the existing failure first; don't add new work on a broken baseline.
3. **Look up the character's tier classification** in `docs/curation/queue.md`. Confirm it's Tier C and read the one-line "reason" — that's your headline mechanic to plan around.
4. **Check `docs/curation/queue.md` for re-tiering.** If the character has been re-tiered to A or B since this guide was written, follow the simpler path.

---

## Tier C character → pattern map

The grouping below is editorial. Use it to anticipate which schema features you'll need; don't treat it as a recipe. Each character's gcsim source is still the source of truth.

### Constructs with on-hit emission

**`albedo`, `chiori`, `citlali`, `zhongli` (already curated)**

A summon with its own lifetime that emits damage on enemy contact or on a tick. Today the planner shows the lifetime window but not the emissions; that's the P3 proposal (`Summon.effects[]`).

- Author lifetime, spawnsAt, mobility on `summons[]` as usual.
- For now, flag the on-hit emission in `_curatorNotes` (e.g. "Solar Isotoma flower fires on enemy hit; not yet rendered").
- When P3 lands, migrate the `_curatorNotes` flag to a `Summon.effects[]` entry.

### Field-redirect characters

**`dehya`, `xianyun`**

Skill places a field; subsequent abilities of the holder route through the field, gaining different behavior (Dehya's redirect, Xianyun's plunge enabler). The redirect itself is mechanical, not visualizable as a window.

- Author the field as a `summons[]` entry on the placing skill.
- Flag the redirect mechanic in `_curatorNotes` — schema doesn't model "this hits route through that field" and probably won't (constitution: don't multiply numbers; the redirect is a damage-math concept, not a window).

### Multi-element absorption

**`chasca`** (and `wanderer`/`kazuha` already curated)

Skill absorbs a team element to determine ability damage type. For Chasca specifically: Soulsniper bullets are colored by party composition.

- Author the base ability without infusion.
- Flag absorption logic in `_curatorNotes`. The recipe.md "Elemental Absorption" section is still useful here even though the recipe is archival.
- Out of scope: enumerating all element combinations.

### Hydro/cryo dual-mode + charge stacks

**`escoffier`**

Skill has two modes that consume charge stacks. The mode toggle is closer to a `state` (similar to Clorinde) than a stance — different N behavior is what gates whether to author it as `behavior: "stance"` or as a `state`-conditioned variant.

- Author both modes as separate ability entries with `state` conditions if N behavior changes; otherwise as variants.
- Charge-stack consumption is the **stacks** problem (currently deferred — see `project_tier_c_architecture_plan.md` for handoff).

### Nightsoul resource pools

**`mavuika`, `kinich`, `varesa`, `ororon`, `yumemizuki_mizuki`**

Nightsoul Blessing is a state with a draining gauge underneath. Per the constitution and the settled call, **render the state as a window** (open / closed) and don't track points. This is the P1 proposal (state-window generalization).

- Until P1 lands: author the Nightsoul-active mode as a `state: "nightsoulBlessing"`-gated variant where applicable. The state is already in the `State` union.
- Flag the resource-drain dynamics in `_curatorNotes` — they're not modelled and probably never will be.
- For action-restriction states (Mizuki Dream Drifter mode disables N/CA): flag as a caveat. Don't try to express invalid actions in the schema.

### Multi-mode plunge + skateboard / sustained run

**`varesa`, `xianyun`, `xilonen`**

Sustained-mode characters where the third mode (Xilonen skateboard, Xianyun Driftcloud, Varesa plunge state) replaces N and travel. Flag the action set carefully — the schema's `behavior: "stance"` semantic is "N replacement," not "N disabled."

- Use `behavior: "stance"` only when there's a real N replacement.
- For sustained-traversal modes that disable N entirely (or replace dash/jump only), flag in `_curatorNotes`.
- Source Samples / Yohualtecuhtli team buffs (Xilonen) author normally as buff effects.

### Sourcewater Droplet / pickup-driven CA

**`neuvillette`**

Charged-attack empowerment that depends on collected droplets. Currently no schema for "collectibles on the field that the user picks up to enter a state." This is a deferred call — neuvillette can be authored with a `_curatorNotes` flag explaining the empowered CA gate.

- Author both base CA and empowered CA (Equitable Judgment) as separate ability entries when frames differ.
- Flag the droplet pickup mechanic.

### Bond of Life characters

**`arlecchino` (already curated), future Fatui**

Per the curation plan, BoL is out of scope. Flag and move on. No `inStance` variant, no BoL-conditional buffs.

### Newer / unstable characters

**`flins`, `ineffa`, `skirk`**

These are flagged in the queue as "mechanics not yet stable." If gcsim has a directory and the character isn't broken upstream, attempt the draft. If gcsim is missing or partial, **defer until upstream stabilizes**. Don't fabricate.

---

## Schema features available today

Use these freely — they exist and are tested:

- **`abilityType`** discriminator: `normal` | `skill` | `burst` | `passive` | `constellation`.
- **`behavior`** on skill/burst: `instant` | `persistent` | `stance`. Use `stance + terminatesOnSwap` only for true N-replacement.
- **`summons[]`** for entity-bearing abilities (lifetime, spawnsAt, mobility, terminatesOn).
- **`variants[]`** for press/hold/post-state variants. Variants override base modifier arrays (replace, not compose).
- **`conditions`** with `state`, `constellation`, `ascension`, `chainStage`, `stacks`, `not`/`all`/`any`. **`teamFaction`/`weaponType`/`custom` always evaluate to `null`** (unresolvable runtime state) — author them but expect they may not gate at parse time.
- **`chainStage`** for sequential E or Q stages (Diluc-shape). All stages get explicit `chainStage(n, window?)`. Terminal stage omits `window`. See Diluc as the canonical reference.
- **`stacks`** for resource-pool-gated abilities and effects (Heizou Declension, Yanfei Scarlet Seals, Mualani Wave Momentum). User-asserted via the `{key:N}` notation token (e.g. `Heizou {declension:4} E` resolves to the loaded variant). Stacks reset on swap; assertions persist within a segment until the next assertion of the same key. **Per-cast filtering works**: the parser stamps `stackContext` onto each TimelineBar at cast time, and the timeline evaluates effect conditions against that snapshot — so stack-gated buffs in the team buffs row render only on the casts that asserted them. See Heizou C6 / Yanfei A1 for canonical examples.
- **`Summon.effects[]`** with `summonTick` trigger (P3). Lets summons emit periodic damage/effects rendered as tick markers on the summon bar. See Fischl Oz, Zhongli Stele, Chiori Tamoto. Trigger shape: `{ type: "summonTick", interval: N, firstTickDelay?: N }`. The onHit-from-summon variant (Albedo Transient Blossoms) is a separate future extension.
- **Effects on source**: passive effects on the passive node, constellation effects on the constellation node, faction effects in `factionBonuses[]`. Don't collapse onto host abilities with `attribution`.
- **`infusion`** on normals for stance-elemental conversion (Cyno, Raiden, Yoimiya).
- **`stanceExtension`** on stance-extending in-stance E/Q (Cyno Mortuary Rite-shape).
- **`opensState`** on stance skill/burst — opens a named state alongside the default `inStance` for the stance window. Used for Natlan Nightsoul characters (Mizuki, Xilonen, Varesa, Kinich, Mavuika).
- **Variant-aware stance fields** — `AbilityVariant` can override `behavior`, `duration`, `terminatesOnSwap`, AND `opensState` (added 2026-05-08). The parser resolves these per-token, so Tap/Hold pairs that open different states (e.g. Mavuika Tap-E ring vs Hold-E bike-NS) author cleanly as one base ability with one variant — no need to split into two skill abilities.
- **Three text fields**: `description` (game text), `caveat` (user-facing planner limitation), `_curatorNotes` (internal scratch, always array).

## Schema features deferred

These don't exist yet — flag in `_curatorNotes` and move on. Don't fabricate:

| Feature                           | What's missing                                                                                                 | Affects                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **onHit-from-summon trigger**     | Summons can fire periodic ticks but not on-hit emissions from player damage                                    | Albedo Solar Isotoma blossoms                    |
| **Multi-state windows (full P1)** | One stance can't open multiple named states                                                                    | Mavuika ring-vs-bike state distinction inside NS |
| **Decaying-buff primitive**       | BuffValue's `ramping` ramps up; no ramp-down                                                                   | Mavuika A4 Kiongozi                              |
| **Multi-element absorption**      | No "element resolved from team context" form                                                                   | Chasca                                           |
| **Pickup-driven empowerment**     | No "collected items grant state"                                                                               | Neuvillette droplets                             |
| **Bond of Life**                  | Settled out-of-scope                                                                                           | Arlecchino, future Fatui                         |
| **Teammate-hit / onHit dispatch** | Action events exist (post-P4 #2) but emit no hits; onHit gainStacks/effects still dispatch from E/Q casts only | Escoffier C6, Yanfei A1 render, Flins C2 eff. 2  |

Landed since this table was written (rows removed above): **per-stack
buff-value scaling** (perStack BuffValue, 2026-05); **Team-Nightsoul-Burst
trigger** (`onTeamNightsoulBurst`, F2C 2026-05-09); **post-action transient
state** (sQ primitive 2026-07-17, generalized to `actionOpensState`
{normal?, plunge?} + `consumes` by post-P4 #2 — Varesa Kablam, Flins
Symphony, Durin dual-form all modeled).

When any of these lands, migrate the affected characters in the same PR (aggressive-migration posture).

---

## Process for a single Tier C character

1. **Open the gcsim source**: `/Users/producer/Code/gcsim/internal/characters/<id>/`. Read `attack.go`, `skill.go`, `burst.go`, optionally `charge.go` / `plunge.go`.
2. **Match a pattern from the map above.** If multiple apply (e.g. Mavuika is Nightsoul + multi-mode + skill-toggle), pick the dominant one and flag the rest.
3. **Find a reference character.** For each pattern, the closest already-curated char is the structural template:
   - Stance: hu_tao, cyno, furina, raiden_shogun
   - Multi-skill stance: cyno (Mortuary Rite as in-stance E)
   - Multi-stage chain: diluc (canonical chainStage example)
   - Construct: zhongli, fischl
   - Flat shield-summon: yelan, kirara
   - Hybrid normal/skill chain: nilou, lanyan
4. **Read the reference char's JSON in full** before authoring. Mirror the shape; deviate only with a `_curatorNotes` flag explaining why.
5. **Frame extraction:** the `gcsim-frames` skill is available for one-off lookups. For full extraction, follow the InitAbilSlice / InitNormalCancelSlice rules from the (now-archival) `recipe.md` § 2.
6. **Author iteratively:** add ability, run `npm test`, fix lint, repeat. Don't try to ship a complete file in one pass.
7. **Flag every gap:** if the schema can't express a mechanic, `_curatorNotes` it with the gcsim source pointer (file + line). Future schema work uses these as discovery.
8. **`caveat` for user-visible limitations.** If the planner can't render some part of the kit (Sacramental Shower lifetime, BoL infusion), the user should see it in the caveats panel.

## Stop conditions — when to BLOCK

Pause the draft and surface a question if:

- A mechanic is _not_ covered by any pattern in this guide AND the schema has no plausible expression. (Don't invent.)
- The character requires a deferred schema feature (stacks, summon-effects, state-windows) AND the gameplay is dominated by that mechanic. Flag it; ask whether to wait for the proposal or author a partial draft.
- gcsim source is missing, partial, or has open TODOs the curator can't resolve.
- KQM data and gcsim disagree by more than a few frames on a load-bearing value.

When BLOCKING, leave the in-progress work, run `npm test` to confirm baseline is still green, and write a clear summary of what's unresolved.

## When the curation lands

- `npm test` passes (lint + parser tests).
- `npm run check` passes (TypeScript).
- `_curatorNotes` documents every flagged gap with enough detail that the next reader can pick up cold.
- If a `caveat` is added, verify it shows up in the planner's caveats panel for that character.

---

## Updating this guide

This is a living doc. Update it when:

- A schema proposal lands (move from "deferred" to "available"; add the canonical reference char).
- A new pattern emerges that doesn't map to anything here.
- A reference character's shape changes meaningfully.
- A blocked Tier C character resolves and reveals a pattern worth documenting.
