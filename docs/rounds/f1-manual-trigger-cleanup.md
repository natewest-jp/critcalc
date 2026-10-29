# F1 manual-trigger cleanup status and G design requirements (2026-05-09)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

F1 is the cohort-wide cleanup of `trigger: "manual"` generator stubs across the 88 characters that inherited them. The retrospective bucketed F1 into two phases:

- **F1 Phase 1**: trigger maps to existing schema (`onCast`, `onHit`, `onCast` + `afterDuration`, `passive`, `onSwapOut`, etc.) — migrate now
- **F1 Phase 2**: trigger needs G (sub-ability/tag filter, element filter on hit, isCrit, target HP, enemy aura) or other deferred primitives — defer with documented flags

This memory captures: what F1 Phase 1 completed (3 commits), what's left and why, and the G design requirements that emerge from the residual set.

---

## F1 Phase 1 — completed (2026-05-09)

Three commits across 25 characters, 40 manual triggers cleaned up. From 259 → 219 remaining.

**Batch 1 (b76cae5, 11 effects):** diluc, amber, lynette, yun_jin, shikanoin_heizou, zhongli, faruzan, arataki_itto, yoimiya, diona — straightforward `onCast skill/burst`, `afterDuration burst`, `onHit ability:X` migrations.

**Batch 2 (ad37156, 14 effects):** chongyun, baizhu, jean, kaeya, charlotte, mona, mualani, beidou, rosaria — passive triggers, on-skill resShreds, more onCast/afterDuration. Cleaned up the erroneous duplicate self-target effect on Rosaria A4 along the way.

**Batch 3 (7e6877d, 9 effects):** razor, venti, keqing, sucrose, qiqi, yanfei, xianyun — onHit + procCooldown patterns, afterDuration energy regen, onCast variants with constellation gating.

Audit script: `scripts/audit-manual-triggers.mjs` (commits in batch 1). Re-runnable for any future cleanup pass.

## What got resolved as a side effect

A few characters had value/target/element corrections that the curator notes had flagged but no one had applied:

- Itto C4 — companion `+20% def%` effect added (was missing from skeleton)
- Heizou A4 — target corrected from `team` → `teamExcludingSelf`
- Faruzan C6 — target corrected from `self` → `team`
- Yoimiya A4 — target corrected from `team` → `teamExcludingSelf`
- Rosaria A4 — duplicate erroneous self-target entry removed
- Venti A4 — duplicate energy entry removed
- Several characters got proper `constellation: N` conditions added to constellation effects

## Side-quest schema gap surfaced

**Physical RES is not in the Element union.** Rosaria C6 (-20% Physical RES) and Venti C2 (-12% Physical RES) both flagged this. Authoring `element: "physical"` fails lint. Two options:

- Extend the `Element` union to include `"physical"`, with a renderer pass for the new value
- Add a separate `physicalResShred` stat key (or sibling effect type)

The first is more elegant; the second avoids touching every consumer of `Element`. Defer until a Physical-RES-bearing character actually needs to render.

---

## F1 Phase 2 — what's left and why (219 effects)

The remaining manual triggers cluster into the following blocked categories. Counts are approximate (some effects fall into multiple categories).

### Sub-ability / tag filter on triggers (G — primary motivator)

The core G primitive: filter onHit by what _kind_ of hit it is, beyond `abilityType`. This is the single largest residual category.

**Examples blocking ~30 effects across ~15 chars:**

- **Aloy A4 / Strong Strike** — ramping cryoDmgBonus only on Coil hits ("Pressurized Floe: Shattering Pressure")
- **Itto A4** — DEF→FlatDmg only on Kesagiri (Left/Right/Final slashes), Saichi excluded
- **Diluc C2** — onHit ability:skill, **Hold variant only**
- **Lyney C4** — onHit ability:charged + **Pyro element filter**
- **Faruzan A4** — onHit + **element=anemo filter** + active-char-conditional
- **Yoimiya A1 / C2** — onHit ability:normal + **Pyro-infusion-only filter** (A1 also wants in-stance state)
- **Sethos** — onHit + Shadowpiercing-Shot-named-attack filter (4 effects)
- **Tighnari A1 / A4 / C1 / C6** — onHit Wreath Arrow specifically (sub-ability name)
- **Freminet A1** — onHit + named-attack-prefix filter (Pressurized Floe: Shattering Pressure)
- **Kazuha-style sub-element-tag** — Wanderer A1 absorbed-element gate (Pyro/Hydro/Cryo/Electro), Sucrose C6 absorbed element
- **Chongyun C1** — onHit ability:normal + **N4-only filter** (NormalCounter==3, last hit of combo)

The pattern: `onHit` is the right trigger, but the schema can't filter to _which N hit_ / _which CA shape_ / _which element tag_ / _which named sub-ability_ — all of which gcsim filters on `AttackTag` + ability name + element tag + hit-index in the AttackInfo.

This is why **G's design (per the prior conversation) folds in the `damageTag` field**: the per-damage-instance tag plus a `triggerFilter: { abilityType?, damageTag?, element?, hitTag? }` extension on triggers covers all of the above. Many of these residuals will also need the `damageTag` field on `hits[]` and `Summon.effects[]` once G ships.

### Aura / target-state condition (~10 effects)

Triggers gated on enemy aura state (Cryo aura, Frozen state, etc.) or target HP threshold.

- **Kaeya A4** — onHit + Cryo-aura + ability:normal/charged
- **Chongyun C4** — onHit + Cryo-aura + active-char-condition
- **Keqing C2** — onHit + Electro-aura
- **Razor C2** — passive + enemy HP < 30% conditional CR
- **Yanfei A1 / A4 (C2 effect)** — onHit + chargeAttack + enemy HP < 50%
- **Eula A4** — Lightfall Sword + enemy HP < 50% conditional DMG bonus
- **Kamisato Ayato C1** — onHit + enemy HP < 50%

The schema's `Condition` union has `hpBelow50`/`hpBelow70`/etc. but they're caster-side states, not enemy-side. Adding a `targetHpBelow: N` condition primitive (separate from the existing self-HP states) would unlock this cluster.

### Custom event triggers (~25 effects)

These need new entries in the `Trigger` union. Each has a small surface area but together they're a real cluster.

- **`onTargetDied`** — Hu Tao A4, Yoimiya C1
- **`onParticleReceived`** — Venti C4, Jean C2
- **`onAbsorbDirective`** — Arlecchino C2/C4 (BoL-related anyway)
- **`onConstructSpawned`** — Chiori A4
- **`onMirrorOverflow` / `onMirrorGenerated`** — Alhaitham C6 + skill (could subsume into stack-event triggers)
- **`onShieldExpire` / `onShieldDestroyed`** — Noelle A4, Kachina C6
- **`onAbsorption`** (elemental absorption event) — Sucrose C6, Xinyan-style
- **`onSwapOut` for character effects** (currently weapon-only) — Klee C6
- **`onPickup`** (Puffer, Orb pickups) — Mualani C4 energy, Faruzan, Diona
- **`onHeal` / `onOverheal`** — Sigewinne C6, Wriothesley A4 ATK SPD overheal
- **`onPlayerHit` / `onTakeDamage`** — Beidou C4, Wriothesley-style HP-drain
- **`onTeamNightsoulBurst`** — Mavuika A1, Varesa A4, Xilonen A2, Chasca A2, Ifa, Iansan A2 (already on the architecture-plan deferred list)

The `onTeamNightsoulBurst` trigger is already noted in the architecture plan as a deferred primitive. The other event types are specific to single-char patterns and could be added incrementally.

### Periodic / runtime-state poll (~15 effects)

gcsim runs per-frame or per-N-frame ticks evaluating runtime state and applying mods. Hard to express as discrete triggers.

- **Shenhe A1 / C2** — periodic field-presence check (every 18f)
- **Diona C6** — periodic HP check during burst field
- **Tighnari A4 / C1 / C2** — permanent stat mods recalculated every 30f
- **Nahida A4** — permanent stat mod recalculated every 30f via a4Tick
- **Chevreuse C6** — per-heal-tick (every 2s during skill heal)

These are "always-active conditional buffs" that the `passive` trigger can capture if we accept some imprecision (the buff renders unconditionally, the condition is documented). Several of these could move to F1 Phase 1 with that posture — but the imprecision is meaningful enough that the user might prefer to wait for a proper periodic-evaluation primitive.

### Per-stack / per-source value scaling (~12 effects)

The buff value scales with a stack count or runtime input the planner doesn't snapshot.

- **Alhaitham C4** — team EM = 30 × mirrorsConsumed; self Dendro DMG = 10% × mirrorsGenerated
- **Lyney C2** — Crisp Focus stacks (1 every 2s, max 3)
- **Mualani A4** — flat-DMG scales on team-NS-Burst stacks
- **Navia A4 / C6** — snapshot-time CR/CD per Crystal Shrapnel stack
- **Sayu C6** — Daruma DMG scaling on EM (already flagged scaling-buff)
- **Wriothesley everything** — snapshot-time stat additions on Rebuke, NOT persistent buffs
- **Xiao C1** — burst-active 5-stack ramp (5% → 25% over 12s)

These need either the `scaling`/`perStack` BuffValue forms (already shipped for some shapes) extended, or a `value: { type: "snapshot" }` placeholder. Some are already authored at max-stack; others are just unauthored.

### BoL (Bond of Life) — out of scope (~10 effects)

Per the curation plan, BoL is settled out-of-scope. Effects gated on BoL state or scaling on CurrentHPDebt remain unauthored:

- Clorinde A1/A4/C1/C2/C4/C6 (most of Clorinde's 8 manual triggers)
- Arlecchino A1/skill burst FlatDmg (BoL-runtime scaling)

These should stay as-is until BoL is reconsidered (probably never per the curation plan).

### Schema model mismatch (~15 effects)

The generator typed effects incorrectly — the right correction is type-change, not just trigger:

- **Layla A4** — `damage` should be a `buff` adding FlatDmg to summon ticks
- **Layla C4** — `damage` should be a `buff` (team self-buff adding FlatDmg to N/CA hits)
- **Clorinde A1** — `damage` and `hp%` skeletons are BoL-grant artifacts, both should be deleted
- **Eula A4** — stat: 'hp%' value: 50 is the HP threshold, NOT a buff value
- **Yanfei A4** — second effect (`hp%` 50) is a misread of the HP threshold
- **Sangonomiya A4 / C2 / C6** — multiple skeletons mistype HP thresholds as `hp%` buffs
- **Kamisato Ayato C1** — `hp%` 50 is the HP threshold misread
- **Wriothesley A4 burst skeleton** — `damage` should be `heal`
- **Noelle A4** — `damage` should be `shield`
- **Kaeya C4** — `damage` should be `shield`
- **Dehya** — generator stubs misclassified
- **Sigewinne C2** — `damage` should be `shield`
- **Nahida A4 / C2** — most effects are mis-modeled scaling/cap shapes
- **Mona C6** — first effect's `atk%` stat is wrong; should be allDmgBonus (per cons.go uses DmgP)
- **Rosaria A4** — duplicate erroneous self-target entry (already cleaned up in F1 batch 2)

Many of these are higher-value than the trigger migration itself — the generator didn't just leave the trigger wrong, it left the wrong shape. Worth a dedicated cleanup pass that's editorially distinct from F1.

### Pre-release stubs (~20 effects)

Pre-release / partial chars where gcsim has no source: durin, manekin, manekina, varka, columbina, illuga, ifa, kachina (some), zibai. These have generator-stub manual triggers but no curator notes documenting the right shape — sourcing requires gcsim updates.

Skip until upstream lands.

---

## G design requirements (synthesized from the residuals)

Based on the residual set, the minimum G primitive needs to express:

```ts
type DamageTag =
	| 'normal'
	| 'charged'
	| 'plunge'
	| 'skill'
	| 'skillHold'
	| 'burst'
	// Specialized; add as needed:
	| 'extra' // Some chars CA / Lyney Hat / Tighnari Wreath
	| 'elementalArt' // Generic (alias for "skill")
	| 'elementalBurst'; // Generic (alias for "burst")

type TriggerFilter = {
	abilityType?: 'normal' | 'charged' | 'plunge' | 'skill' | 'burst';
	damageTag?: DamageTag;
	element?: Element; // Pyro-only / Anemo-only / etc.
	abilityName?: string; // Sub-ability filter (Wreath Arrow, Saichi, Coil)
	hitIndex?: number; // N4-only (Chongyun C1), N3 (Kokomi A4)
	isCrit?: boolean; // Yoimiya C2, Rosaria C1, etc.
};
```

**Two extension points needed:**

1. **`damageTag?` on `NormalHit`, `Effect` (damage type), `Summon.effects[]` damage entries** — defaults inferred via `getDefaultDamageTag(ability, hit?)` per the prior plan. ~20 chars need it for proper sub-ability filtering.

2. **`triggerFilter?` on the existing `onHit` trigger variant** (or a new `onHitFiltered` variant). Renderer + lint vocabulary.

**What's covered by G:**

- All sub-ability filters in the residual set
- Element filters on hits
- N-th-hit-only gating (via hitIndex)
- isCrit gating

**What's NOT covered by G (keep as separate primitives):**

- Aura conditions (`enemyAffectedByCryo`, `enemyFrozen`)
- Target HP conditions (`targetHpBelow: N`)
- Custom event triggers (onTargetDied, onParticleReceived, etc.)
- Periodic poll mechanics
- Per-stack value scaling

**Decision settled in conversation (2026-05-09):**

- Damage instances are single-tagged (gcsim's AttackInfo.AttackTag is single-valued)
- "Multi-tag" cases are inherently separate damage entries (Furina N + salon water ball, Albedo cast + blossom)
- Use single `damageTag` field per damage instance, NOT array form
- Defer the bulk extractor (gcsim source → JSON `damageTag` overrides) until at least one buff-filter consumer is wired
- Default-inference layer (`getDefaultDamageTag`) handles ~80% of cases without authoring; explicit `damageTag` only on divergent cases

---

## F2 plan (after G ships)

When G lands:

1. Run the audit script again to enumerate residuals
2. Migrate Phase-2A: sub-ability/tag filter cases (the largest cluster)
3. Add the `damageTag` overrides on the divergent abilities surfaced during F2A
4. Phase-2B: schema-model-mismatch cleanup (separate from F2A — different editorial work)
5. Aura conditions, target HP, custom event triggers — separate primitives, separate sessions

Don't try to bundle all of F2 into one pass. Each cluster has its own primitive cost.

---

## Why pause here

After three F1 batches the obvious migrations are mostly done. The remaining 219 cluster heavily on G dependencies — pushing into them now would either (a) author imprecise `onHit` triggers that need re-migration after G or (b) require designing G against imagined cases. Better to:

1. Land G's design and a first-cut implementation (consumes the requirements above)
2. Run F2 with G in hand

The F1 schema-fidelity wins so far: 40 effects now render correctly in the team-buff / active-target rows that previously showed nothing. Several value/target/element corrections that were flagged but unapplied also got cleaned up.
