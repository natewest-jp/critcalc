# Character Data Schema Reference (2026-04-25)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

This is the canonical schema for character JSONs as of 2026-04-25. Use alongside the JSDoc in `src/lib/types/ability.ts` and `src/lib/types/character.ts` — those types are the source of truth; this memory gives you the high-level shape for orientation.

---

## Top-level character shape

```jsonc
{
	"id": "bennett",
	"name": "Bennett",
	"displayName": "Bennett",
	"element": "pyro",
	"weapon": "sword",
	"rarity": 4,
	"factions": ["hexerei"], // optional, gameplay-mechanic memberships
	"gender": "Male", // metadata; reserved for team-builder tool
	"affiliation": "Adventurers' Guild",
	"region": "Mondstadt",

	"abilities": [
		/* NormalAbility | SkillAbility | BurstAbility */
	],
	"passives": [
		/* PassiveAbility */
	],
	"constellations": [
		/* ConstellationAbility */
	],
	"factionBonuses": [
		/* FactionBonus, optional */
	],

	"meta": { "source": "genshin-db", "generatedAt": "...", "curatedAt": "..." }
}
```

---

## Ability discriminator

Every ability has `abilityType: "normal" | "skill" | "burst" | "passive" | "constellation"`. Skill and burst additionally carry `behavior: "instant" | "persistent" | "stance"`.

### NormalAbility

```jsonc
{
  "id": "char__normal__name",
  "name": "Display Name",
  "abilityType": "normal",
  "input": ["N1", "N2", "N3", "N4", "N5", "C", "P"],   // always Input[]
  "hits": [ /* NormalHit per combo step */ ],          // required
  "chargeFrames": { "anim": X, "hit": X, ...overrides },  // sword/claymore/polearm
  "chargeHits": [ /* NormalHit[], bow only — index 0 = C1, 1 = C2 */ ],
  "plungeFrames": { "anim": X, ... },   // optional; the HIGH plunge (P/hP)
  "lowPlungeFrames": { "anim": X, ... },// optional; `lP` only, falls back to the above
  "plungeVariants": [                                  // optional, e.g. Kazuha hE→P
    { "label": "After Hold E", "input": ["hE"], "frames": { ... } }
  ],
  "infusion": "electro",                               // for stance normals (Cyno, Raiden)
  "tags": ["heal" | "shield" | "summon" | "taunt" | "coordinatedAttack"],
  "noICD": true,
  "sections": [ ... ],                                 // game description sections
  "description": "In-game text only — no implementation notes.",
  "caveat": "User-facing limitation note (renders in caveats panel).",
  "_curatorNotes": ["Internal scratch — never rendered."]
}
```

`chargeFrames` and `chargeHits` are mutually exclusive (sword/claymore/polearm vs bow). Catalysts have neither (their N is already elemental).

### SkillAbility / BurstAbility

```jsonc
{
  "id": "char__skill__name",
  "name": "Display Name",
  "abilityType": "skill",                              // or "burst"
  "behavior": "persistent",                            // "instant" | "persistent" | "stance"
  "input": ["E", "tE", "pE"],                          // burst is just ["Q"]
  "frames": { "anim": X, ...overrides },   // required; ⛔ `hit` is a lint error on E/Q
  "application": [{ "frame": X, "element": "pyro" }],  // when the cast's hits LAND; [] = applies nothing
  "cooldown": 12,                                      // required (skill + burst)
  "cooldownStartDelay": 34,                            // optional, frames at 60fps
  "cooldownModifiers": [ /* ModifierBase[] */ ],
  "energyCost": 60,                                    // required on burst only
  "charges": 1,                                        // skill only
  "chargeModifiers": [ /* ModifierBase[] */ ],         // skill only

  // Required when behavior === "persistent" or "stance":
  "duration": 12,
  "durationModifiers": [ /* ModifierBase[] */ ],

  // persistent-only:
  "persistentBehavior": "stationary",                  // or "follows"
  "summonActivatesAt": 34,                             // frames at 60fps; absent = 0

  // stance-only:
  "stanceExtension": { "frames": 240, "maxExtensions": 2 },
  "terminatesOnSwap": true,

  "snapshots": true,
  "noICD": true,
  "tags": [...],
  "variants": [ /* AbilityVariant[] — see below */ ],
  "effects": [ /* Effect[] */ ],
  "description": "...",
  "caveat": "...",
  "_curatorNotes": [...]
}
```

`AbilityVariant` is a partial override on top of base. Can change `behavior` (Zhongli hE: instant → persistent). Modifier arrays REPLACE base arrays — they don't compose.

### PassiveAbility / ConstellationAbility

```jsonc
{
  "id": "char__passive__name",
  "name": "...",
  "abilityType": "passive",                            // or "constellation" + constellationLevel: 1-6
  "description": "...",
  "caveat": "...",
  "_curatorNotes": [...],
  "effects": [ /* Effect[] — lives on its source */ ]
}
```

---

## Effect anatomy

Every effect has `type`, `trigger`, `target`, optional `conditions`, optional `duration`/`durationType`/`procCooldown`, and effect-type-specific payload.

```jsonc
{
  "type": "buff",                                      // "buff" | "damage" | "heal" | "shield" | "resShred" | "energy" | "cdReset" | "infuse"
  "trigger": { "type": "onCast", "ability": "burst" }, // see Trigger union
  "target": "active",                                  // EffectTarget | EffectTarget[]
  "duration": 12,
  "durationType": "fixed",                             // or "refresh"
  "procCooldown": 30,                                  // or { refinementValues: [30, 26, 22, 19, 16] } for weapon scaling
  "conditions": { "type": "constellation", "level": 1 },

  // buff-specific:
  "source": "character",                               // "character" | "weapon" | "artifact"
  "stat": "atk",
  "value": 22.5,                                       // number | ScaledValue | scaling | ramping | unknown
  "snapshottable": true,
  "stacks": { "maxStacks": 3, "durationModel": "shared" },
  "constellationScaling": { "conditions": {...}, "value": {...} }

  // damage/heal/shield:
  // "scaling": 135, "stat": "atk", "element": "pyro"

  // infuse:
  // "element": "pyro"

  // cdReset: source: "weapon" only; ability target via trigger.ability
}
```

### Trigger types

`onCast` (with optional `ability: "skill" | "burst"`), `onHit` (with optional `abilityType` and `filter: TriggerFilter` — see G primitive below), `onReaction` (with `reaction: Reaction | Reaction[] | "any"`), `onEnergy`, `onHPChange`/`onHPDecrease`/`onHPIncrease`, `onHeal`, `onState`, `manual`, `onSwapOut`, `onSwapIn`, `onStack`, `passive`, `afterDuration` (with optional `ability` for constellation-relocated effects), `onStanceEnd`, `summonTick` (with `interval` + optional `firstTickDelay`).

### ⚓ Active windows on INSTANT casts — `activeDuration` (2026-08-14)

- **`activeDuration?: number`** on the `instant` variants of SkillAbility/BurstAbility **and** on `AbilityVariant`. How long an instant cast's active window runs, i.e. the span the E/Q bar draws. Absent = a pure instant pill.
- ⚠️⚠️ **NOT `duration`.** Twelve instant abilities already carry a stray, undeclared `duration` that no accessor reads (Kachina/Kaveh/Zhongli bursts, Charlotte, Chongyun, Emilie, Prune, Yun Jin's burst…). Teaching `getActiveDuration` to read it would have grown twelve bars nobody authored. **Sweep before reusing a field name.**
- ⚓ **`summons[]` now means only a thing left in the WORLD.** It used to double as the only way to give an instant cast an active window, which is why nine shields were authored as zero-effect summons. They're retired. Full rules: `docs/rounds/shield-summon-split.md`.
- ⚠️ A variant's `effects` **REPLACE** the base ability's (same as `summons`), and an empty `summons: []` on a variant means **NONE**, not "inherit the base".

### Effect type quick reference (post-2026-05-09)

- **`damage`** — `scaling: number | ScaledValue, stat: ScalingStat, element?: Element, flat?: number`. The optional `flat` adds a literal addend (`scaling% × stat + flat`) — gcsim AttackInfo.FlatDmg shape.
- **`heal`** — `scaling: number | ScaledValue, stat: ScalingStat, flat?: number`. Same `flat` pattern as damage (Jahoda Robot heal).
- **`shield`** — `scaling: number | ScaledValue, stat: ScalingStat, flat?: number, label?: string`. ↻ 2026-08-14: this line said _"No `flat` (no current case)"_ and had been wrong since 2026-07-12 — `flat` exists and is used (Diona +1524, Thoma +1525, Yun Jin +2542, Noelle +1694, Zhongli +2712). ⚓ `label` is the shield's in-game NAME, rendered as the shield lane's row label; ⛔ never invent one — kits that don't name their shield keep the generic fallback. See `docs/rounds/shield-summon-split.md`.
- **`cdReset`** — `source: "weapon" | "character"`, `resets?: "skill" | "burst"`. `resets` defaults to `trigger.ability` when omitted (Sacrificial weapons); set explicitly for cases where firing ≠ reset target (Kazuha C1: trigger:onCast burst, resets:skill). Parser handles both weapon procs (with `procCooldown`) and character resets (no procCooldown).
- **`cooldownReduce`** — `source: "character"`, `amount: number` (seconds). Fires unconditionally on each matching trigger; subtracts `amount` from the target ability's CD. v1 schema-only — parser implementation deferred until the surrounding event-trigger primitives land (onAbsorbDirective for Arlecchino C4, team-Geo-onHit for Gorou C2, etc.).

### `onHit` TriggerFilter (G primitive — 2026-05-09)

The `onHit` trigger gains an optional `filter` field for sub-ability gating. All specified fields must match (intersection).

```jsonc
"trigger": {
  "type": "onHit",
  "abilityType": "skill",      // coarse class (also: "burst" | "normal" | "charged" | "plunge")
  "filter": {                  // optional — fine-grained
    "damageTag": "skillHold",  // exact tag match (Hold-only, Saichi-only, etc.)
    "element": "pyro",         // hit's element
    "abilityName": "Wreath Arrow", // substring match against ability.name (+ variant.label)
    "hitIndex": 3,             // 0-based, for normal-attack hit gating
    "isCrit": true             // optimistic-fire on crit (planner doesn't simulate crits)
  }
}
```

Filter resolution at render time uses `evalTriggerFilter(filter, ctx)` with a context built by `resolveCastContext(char, kind, bar)` — derives `damageTag` via `getDefaultDamageTag(ability, variant)` (Hold-variant heuristic auto-infers `skillHold`), `element` from character.element, `abilityName` from `${ability.name} ${variant?.label}`.

**Renderer scope (v1):** skill/burst class onHit triggers render in team-buff/active-target/self-target loops. N/CA/P onHit rendering is a v2 follow-up that requires iterating per-input-block hit moments.

### DamageTag enum (G primitive)

```ts
type DamageTag = 'normal' | 'charged' | 'plunge' | 'skill' | 'skillHold' | 'burst';
```

Per-hit and per-variant overrides:

- `NormalHit.damageTag?` — rare; defaults to `"normal"` for `hits[]`, `"charged"` for `chargeHits[]`
- `AbilityVariant.damageTag?` — used for non-Hold variants whose damage tag diverges from the inferred default. Hold variants are auto-detected via input/label heuristics.

Stance-converted N attacks (Hu Tao Paramita, Itto Saichi, Cyno Pactsworn) RETAIN their `"normal"` tag — only the element infusion changes, never the tag.

### EffectTarget

`"self" | "team" | "teamExcludingSelf" | "active" | "next" | "enemy"`. Array form supported (e.g. `["self", "active"]`).

---

## Where effects live

Effects live on their **source** node — the cleanest way to know what a constellation/passive does is to read its `effects[]`. The timeline walks `[...abilities, ...passives, ...constellations, ...factionBonuses]` to gather effects per cast trigger.

| Effect originates from                             | Lives on                                                      | Trigger expectation                                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The skill/burst itself (e.g. Bennett Q's ATK buff) | The skill/burst ability                                       | `trigger.ability` may be omitted (implicit from host)                                                                                                                        |
| An ascension passive (A1/A4)                       | The corresponding `passives[]` entry                          | `trigger.ability` optional but recommended for clarity                                                                                                                       |
| A constellation effect (C1/C2/C4/C6)               | The corresponding `constellations[]` entry                    | `trigger.ability` REQUIRED for `onCast` / `afterDuration` (no host to infer from); when omitted on `onCast`, the timeline fires for both skill AND burst (Kazuha C6 pattern) |
| A team-conditional faction effect                  | `factionBonuses[]` array                                      | Trigger as authored (`onReaction`, etc.)                                                                                                                                     |
| Always-on permanent bonus                          | A passive with effects that have `trigger.type === "passive"` | The TeamBonusesBlock derives chips from these                                                                                                                                |

The legacy `attribution` field on effects is **deprecated** — the source IS the location now. It still exists in the type for display purposes and is kept on Fischl's faction effects (which had no other home before factionBonuses existed) but new effects should not author it.

---

## Three text fields with three audiences

**Audience determines the field.** Do not mix.

| Field           | Audience        | When rendered                                                                                        |
| --------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| `description`   | End user        | Always shown in ability panel (in-game text only — no implementation notes)                          |
| `caveat`        | End user        | Shown in caveats panel when present (limitations, unmodeled mechanics)                               |
| `_curatorNotes` | Curator / agent | Never rendered. Internal scratch: skipped effects with reasons, design questions, frame-source notes |

The `_` prefix on `_curatorNotes` is intentional: a "not for display" signal that any reader (human or AI) recognizes. `_curatorNotes` is always an array.

---

## Value forms

```jsonc
"value": 22.5                                            // simple number
"value": { "refinementValues": [22.5, 26, 30, 33, 37] } // ScaledValue (weapons)
"value": { "type": "scaling", "stat": "baseAtk", "ratio": 0.952, "cap": 800 }
"value": { "type": "unknown", "description": "0.4% per 1% ER above 100%" }
"value": { "type": "ramping", "startValue": 1, "stepValue": 3.5, "stepInterval": 1, "cap": 50 }
"value": { "type": "decaying", "startValue": 40 }                                                     // Mavuika A4 — decays to 0 over duration
"value": { "type": "perStack", "key": "declension", "per": 4, "maxStacks": 4 }   // Heizou C6 +CR/stack
"value": { "type": "perStack", "key": "huntersExperience", "per": { "stat": "atk", "ratio": 320 }, "maxStacks": 2 } // Kinich A4 — scaling-per-stack form
```

`ScalingStat` is `"atk" | "baseAtk" | "em" | "hp" | "def"`. For percentage stats (`atk%`, `cryoDmgBonus`, etc.) store **whole numbers** matching in-game display (`22.5` not `0.225`) — the stat key carries the unit.

---

## Pruned / removed (do not author)

- `permanentBonuses[]` array → replaced by `passives[]` with `trigger: passive` effects
- `abilityType: "charged" | "plunge" | "movement"` → folded into NormalAbility (`chargeFrames`/`chargeHits`/`plungeFrames`); `movement` was unused
- `type: "instant" | "persistent" | "stance" | "movement"` on abilities → renamed to `behavior` on skill/burst; dropped on normal/passive/constellation
- `note` field → renamed to `description`
- `_todo` (string) → renamed to `_curatorNotes` (string array)
- `attribution` on effects → deprecated for new authoring (the location is the source)

---

## Element union (2026-05-09)

`Element` includes 7 character-elemental keys plus `"physical"` for damage instances and RES debuffs:

```ts
type Element = 'anemo' | 'cryo' | 'dendro' | 'electro' | 'geo' | 'hydro' | 'pyro' | 'physical';
```

**An element field may name an `ElementRef`, not just a literal** (2026-09-16, Varka): `{ type: 'teamElementPriority', order: [...], fallback? }` resolves at parse time off the same `teamElementCounts` map the Conditions read — live at `NormalAbility.infusion`, `ElementalApplication.element` and `coInfusion`. ⚠️ No context resolves it to NOTHING, which is deliberately **not** the Conditions' optimistic `null`: an unnamed element is a hit that applies nothing, exactly what an absent field already means. Beside it: **`NormalAbility.coInfusion`** (a SECOND element per swing on its own `:co` ICD counter — ⚠️⚠️ offered AFTER `infusion`, and the order is the mechanic) and **`NormalAbility.specialChargeFrames`** (KQM's `sC`). See `docs/curation/varka-two-elements-scope.md`.

**`"physical"` is valid only for damage and resShred Effect element fields.** It is invalid for character `element`, `NormalAbility.infusion`, and the `infuse` Effect — the lint enforces this via separate vocabulary sets (`CHARACTER_ELEMENTS` vs `DAMAGE_ELEMENTS`).
