# Character JSON curation plan (2026-05)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

The curation pass converts auto-generated character JSONs into planner-ready data. Tool-focused (not archival): if the planner can't model an effect reliably, skip it with a `_curatorNotes` entry rather than encoding it imprecisely.

For the canonical schema shape, see `reference_data_schema.md`. This memory captures the _editorial_ conventions — what to author and what to skip.

**Curation posture (2026-05-07):** autonomous batch runs are retired. Tier A and Tier B are complete; future characters are added one or two at a time per Genshin patch release and curated individually. The `docs/curation/recipe.md` and `docs/curation/recipe-tier-b.md` files are now **archival** (header banners updated) — preserved for pattern lookup but not authoritative for new work. Defer to `reference_data_schema.md` and this memory instead. `queue.md` remains useful for tier classification + the id→gcsim-name mapping of any backlogged or just-released characters (`queue.txt` — the autonomous-run state file — and `run-prompt.md` were pruned 2026-07-15; that batch machinery is retired, superseded by the `ingest-character` skill).

---

## Curation status (2026-05-07)

**Tier A — complete.** All 60 originally-classified Tier A characters drafted via Sonnet 4.6 automation through 2026-04-27 → 2026-05-06 in three batches (A.1 warm-up, A.2 standard, A.3 standard-with-infusion). 7 characters were re-tiered from A to B/C mid-run when the autonomous pass surfaced mechanics the recipe didn't cover.

**Tier B — complete (2026-05-07).** 18/18 characters drafted across two passes:

1. **16 characters via an unattended Opus 4.7 autonomous run** — a single `--effort high` session, merged across 4 octopus commits (mirroring the Tier A merge cadence of 3-5 branches per commit). Two characters hit transient API 529 "Overloaded" errors mid-run: kamisato_ayato auto-recovered via the queue-driven retry loop (1st attempt failed before creating the branch); tartaglia's 1st attempt created an empty branch before erroring, so the queue couldn't re-pick it within the same session — required a manual branch wipe + targeted re-run.

2. **2 characters via human-paired pass (lanyan, nilou)** — both flagged in `recipe-tier-b.md` § "Stop conditions" 5(c) as multi-step state machines that gate N-token meaning. Re-attempted with explicit user direction on shape calls; merged 2026-05-07 via a single octopus commit.

Editorial calls worth keeping in mind for future similar characters:

- **kirara** — queue had her in the stance group but she's a flat shield-summon character (Hold-E is movement utility like Yelan's, not a combat stance). Variant collapsed to base shape.
- **arlecchino** — Masque inStance variant + the inherited `manual` damage skeleton both dropped because BoL is out of scope (see "When NOT to model" below).
- **lanyan** (id renamed `lanyan`→`lan_yan` 2026-07-15 to match the `hu_tao`/`yun_jin` convention; historical "lanyan"/"lanyan-shape" refs below + gcsim source refs like `lanyan_gen.go` stay as-is) — in-stance N (Feathermoon Ring) authored as `abilityType: "skill"` with `input: ["N"]` because gcsim categorises it as `SkillState` with elemental-art ICD/scaling. The schema's `abilityType: "normal"` would inherit normal-attack ICD which is wrong. See "Skill-typed abilities with N input" below.
- **nilou** — Tranquility Aura summon authored on the **base E** (not the WS3 ability that actually spawns it in-game), because the planner's parser picks WS1 for all in-stance E presses (diluc-shape gap). Trade-off: summon over-fires for non-canonical rotations like "E swap"; but the canonical "E E E E" rotation renders correctly. See "Summons on rotation entry-points" below.

Automation infra:

- `scripts/run-tier-b.sh` — drains the Tier B section of queue.txt until empty or a usage limit fires. Limit detection greps the per-character log for the canonical Anthropic rate-limit phrasings; transient API errors (5xx) are tolerated, with the queue re-picking the same target if no branch was created.
- `scripts/schedule-tier-b-overnight.sh` — a scheduler wrapper for unattended runs. Distinct label prefix from Tier A scheduler so the two coexist.

The original `recipe-tier-b.md` lists lanyan and nilou as canonical BLOCK examples. With the schema as it stands at 2026-05-07, they are authorable with the cyno/diluc shape pattern + flagged caveats — the BLOCK posture in the recipe was conservative, intended for the autonomous run rather than for human-paired curation. The existence of these drafts does not change the BLOCK guidance for the autonomous recipe; it documents that these specific characters can be human-curated.

**Tier C — complete (2026-05-08; 17/17).** Hand-curated one or two at a time (no autonomous batches). All 17: albedo, chasca, chiori, citlali, dehya, escoffier, flins, ineffa, kinich, mavuika, neuvillette, ororon, skirk, varesa, xianyun, xilonen, yumemizuki_mizuki. Final 5 (chasca, flins, ineffa, neuvillette, skirk) drafted in a single 2026-05-08 session. Lauma retrofitted with `factions: ["moonsign"]` in the same session (originally curated without the faction tag). Per-character migration shapes documented in `docs/curation/queue.md` "Completed Tier C" table. Schema/parser primitives that landed during Tier C work: P5 lint, P2 chainStage, opensState, P3 Summon.effects[]+summonTick, stacks condition (Path B) + per-cast stamping, variant-aware stance fields, perStack BuffValue (v1+v2), decaying-buff primitive. See `docs/rounds/tier-c-architecture-plan.md` for the full status tracker including deferred follow-ups (full P1 multi-state, team-NS-Burst trigger, etc.).

Final-five curation notes (2026-05-08):

- **Neuvillette** — Charged Attack: Equitable Judgment (the empowered, droplet-gated channeled CA — his main DPS) is unmodellable today: needs a "collectibles on the field" primitive AND a multi-tick channeled-CA primitive. Caveat documents; only short CA renders. A4 HP%→Hydro DMG authored as `value: { type: "unknown", ... }` permanent-bonus passive buff. A1 Past Draconic Glories, all C2/C4/C6 effects gate on EJ — flagged in `_curatorNotes`.
- **Chasca** — Multi-element bullet absorption deferred per tier-c-guide. Dual normal authored (out-of-NS Physical 4-hit + in-NS single-hit Tap fire as varesa-shape state-conditioned variant). Multitarget Fire (Hold) NOT authored — the multi-bullet element-converted CA is the tier-c-guide canonical multi-element-absorption pattern that the schema doesn't express. All passive/constellation effects gate on the bullet system or team-Nightsoul-Burst trigger — flagged.
- **Flins** — Polearm stance + Moonsign 5★. Dual normal (out-of-Manifest-Flame Physical + in-stance Electro infusion). Two skill entries: base Arcane Light (`behavior: stance + opensState: inStance + duration: 10 + cooldown: 16`) and Northland Spearstorm (`conditions: state:inStance + cooldown: 6 + cooldownModifiers: C1→4s`). Burst variant Thunderous Symphony (after Spearstorm 6s window) NOT authored — schema lacks "afterSpecificSkill" state primitive (`afterSkill` would over-fire). All Lunar-Charged-DMG-bonus and Elevation effects (A1, C2, C6) flagged as the reaction-DMG-bonus / per-attack-elevation gap.
- **Ineffa** — Polearm shielder + Moonsign 5★. Base layla-shape: `behavior: instant + tags: [shield, summon] + summons[]` carrying both Optical Flow Shield Barrier and Birgitta. Birgitta has summonTick effect (172.8% ATK Cryo per ~2s tick, 0.7s firstTickDelay). Burst re-summons Birgitta — authored as a separate summons[] entry with a caveat about over-spawning when E and Q overlap (in-game Q resets E-spawned Birgitta). A4 Parameter Permutation authored as scaling-form BuffValue (6% ATK→EM, target: ['self','active'], 20s onCast burst).
- **Skirk** — Most complex of the five. Dual normal (5-hit Physical + 5-hit Cryo in-stance), dual burst (Havoc: Ruin out-of-stance + Havoc: Extinction with `state: inStance` condition). EnergyMax=0 in gcsim (resource is Serpent's Subtlety) — `energyCost: 50` set on both bursts to satisfy lint, with caveats explaining SS-not-Energy. Skill has variant for Hold-E (`input: ["hE"]`, behavior: instant — Hold-E does not enter Seven-Phase Flash). C2 +70% ATK on Havoc: Extinction authored with `conditions: { all: [constellation:2, state:inStance] }` so it only fires for Extinction casts not Ruin casts. Many gaps: Void Rifts (collectibles, same gap as Sourcewater Droplets), All Shall Wither (per-NA 10-proc bonus), Death's Crossing (per-team-source-character stacks), Havoc: Sever stacks (C6) — all flagged in `_curatorNotes`.

Moonsign convention (settled 2026-05-08): Nod-Krai 5★ characters declare `factions: ["moonsign"]` at top level. The `deriveTeamComposition` helper checks for `factions.includes('moonsign')` to compute `moonsignCount`/`hasAscendantGleam`. Effects gated on Ascendant Gleam (≥2 Moonsign) use `conditions: { type: "teamFaction", faction: "moonsign", min: 2 }` — but per the tier-c-guide, teamFaction conditions currently always evaluate to null at parse time. Moonsign 5★ characters (Lauma, Flins, Ineffa, Nefer, Linnea, Zibai, Columbina) ALSO promote team reactions: Electro-Charged → Lunar-Charged (Flins, Ineffa); Bloom → Lunar-Bloom (Lauma, Nefer); Hydro-Crystallize → Lunar-Crystallize (Zibai, Linnea); Columbina (Archon) promotes all three. 4★ Moonsign chars (Aino, Illuga, Jahoda) count for Gleam but DO NOT convert reactions. Skirk is NOT Moonsign (Cosmic Calamity, not Nod-Krai).

**gcsim-PR characters drafted 2026-05-08** (working trees from open upstream PRs):

- **Iansan** (PR #2374, Natlan Electro polearm 4★ — NOT Moonsign): Nightsoul stance + dual-normal (out-of-NS Physical + in-NS Swift Stormflight Electro CA). 5s post-skill 'fastSkill' window auto-converts N → CA — not separately gated, the NS state condition covers the dominant case.
- **Jahoda** (PR #2538, Moonsign 4★ Anemo bow): Shadow Pursuit stance (5.57s, drains Purr-loined Treasure Flask on exit), Robot follower-summon burst with heal-tick. Robot damage-tick gated on Moonsign Ascendant Gleam + element absorption — not authored.
- **Aino** (PR #2586, Moonsign 4★ Hydro claymore): Cool Your Jets Ducky stationary tick-summon burst (14s, ATK% Hydro per tick). gcsim PR omits charge.go — chargeFrames left unauthored with documented upstream gap. C2 stub had invalid `onState:offField` trigger; replaced with description-only.
- **Nefer** (PR #2587, Moonsign 5★ Dendro catalyst): 4-hit Dendro normal, Shadow Dance stance (9s, 2 charges), Veil-stack burst. Verdant Dew, Veil of Falsehood, Phantasm Performance, Seed of Deceit — five custom resources/gadgets stacked, mostly deferred. C4 -20% Dendro RES authored as resShred onCast skill (13.5s = 9s stance + 4.5s linger).
- **Linnea** (PR #2596, Moonsign 5★ Geo bow): Lumi multi-form summon (Super/Standard/Ultimate Power, 25s). E recast 3× → Million Ton Crush. Field Catalog stacks (auto-resource), Moondrift Harmony custom event — both deferred. A4 5% DEF→EM authored as scaling-form self buff (conditional-target routing flagged).

**Recurring schema gaps surfaced across the five PRs** (already on the architecture-plan deferred list, but now load-bearing for Moonsign comp visualization):

1. **Reaction-DMG-bonus stat** (e.g. `lunarChargedDmgBonus`, `lunarBloomDmgBonus`) — needed by Flins A1/C6, Ineffa C1/C6, Aino C6, Nefer A4 (Lunar-Bloom base DMG), Linnea moonsign-init, Jahoda C6.
2. **Per-attack Elevation primitive** — Flins C6, Nefer C6, Linnea C6 all use gcsim's `atk.Info.Elevation += X` for reaction-specific damage modifiers; not modeled.
3. **`teamFaction:moonsign` runtime resolution** — currently evaluates to null at parse time (per tier-c-guide); Moonsign Ascendant Gleam gates render but don't cleanly affect output.
4. **Conditional-target buff routing** (active-but-not-self / active-Moonsign / active-non-Moonsign) — Iansan A1/A4/C2, Linnea A4, Aino A1.
5. **Custom auto-tracked resource stacks** — distinct from user-asserted stacks (which works for Heizou/Yanfei): Verdant Dew, Veil of Falsehood, Field Catalog, Serpent's Subtlety, Iansan NS points. None expressible because the user can't assert ALL the events that increment/decrement them.

When any of these primitives lands, the affected gcsim-PR characters' `_curatorNotes` flag the specific effect to wire up.

**Traveler authoring (2026-05-08): six element-specific entries.** gcsim's `traveler/` directory has 6 element subdirs × 2 genders = 12 char shells, but mechanical logic is shared per element (Aether and Lumine play identically). Authored as 6 entries — `traveler_anemo`, `traveler_geo`, `traveler_electro`, `traveler_dendro`, `traveler_hydro`, `traveler_pyro` — using Male (Aether) frames; gender variance (small N1/N2 hitmark differences, mostly 2-4f) flagged in normal-attack `_curatorNotes`. Same normal-attack chain (5-hit Physical sword) and CA shape across all six, but each element has bespoke skill + burst mechanics:

- **Anemo**: Tap-E Palm Vortex (instant) + Hold-E variant (multi-tick channel with absorption); Burst Gust Surge (9-tick Anemo field). Multi-element absorption flagged for both E-hold and Q.
- **Geo**: Tap-E Starfell Sword (creates 30s Meteorite construct, +10s with C6) + short-Hold variant; Burst Wake of Earth (4 shockwaves + 4 walls 15s). C2 Rockcore Meltdown explosion-on-destruct flagged.
- **Electro**: Skill Lightning Blade (1-3 amulets, +20% ER on pickup); Burst Bellowing Thunder (12s Lightning Shroud — onHit:normal/charged trigger procs Falling Thunder, AUTHORED with procCooldown:0.5).
- **Dendro**: Skill Razorgrass Blade (instant Dendro hit); Burst spawns LeaLotus Lamp summon (12s, summonTick effect AUTHORED at ~1s interval).
- **Hydro**: Skill Aquacrest Saber Tap + Hold variants (Hold drains HP via Suffusion, Spiritbreath Thorn at 9s ICD); Burst Rising Waters (drifting bubble summon, 4-7s, 0.5s tick AUTHORED).
- **Pyro**: Skill Flowfire Blade Tap/Hold (enters Nightsoul Blessing — Traveler is the only non-Natlan NS-using character); Burst Plains Scorcher (instant + refills 28 NS over 4 ticks). Authored with `behavior: stance + opensState: nightsoulBlessing + duration: 12 + terminatesOnSwap: false`.

The aether.json + lumine.json stubs were empty placeholder files (no abilities, no element); deleted in the same commit. lan_yan.json duplicate (lowercase variant of lanyan.json) also deleted as a generator naming-collision artifact.

**Remaining unauthored (9 pre-release characters):** columbina, durin, ifa, illuga, kachina, manekin, manekina, varka, zibai. None have gcsim source upstream and no open PRs (verified via `gh pr list --state open` 2026-05-08, 23 open PRs total — all 5 character PRs are accounted for: iansan/jahoda/aino/nefer/linnea). These are truly pre-release; revisit when gcsim adds them.

Escoffier curation notes (2026-05-08): drafted as a follow-up to perStack v2 shipping. Skill is a P3-shape persistent summon (Cooking Mek, 20s, follows-active, Frosty Parfait tick at 0.975s × 216% ATK Cryo) — Surging Blade Arkhe extra hit (60% ATK Cryo, 10s ICD per cast) flagged in caveat as schema can't express per-cast extra hits with separate ICD pools. C2 Cold Dish authored as the canonical perStack-scaling consumer: target=active, normalFlatDmg with per: { stat: atk, ratio: 240 } maxStacks: 5; only normalFlatDmg authored from the in-game 5-stat coverage to keep the team-buff row legible. C6 skipped — schema lacks "active-character (not self) NA/CA/PL hits" trigger; gap documented for future teammate-hit-trigger primitive. A4 RES shred authored at the 4-char-count value (-55%) with caveat for partial-team scaling; Cryo+Hydro authored as 2 effects since `resShred.element` is single-element. C1 Cryo CRIT DMG authored as universal critDmg with caveat (no element-specific CRIT modifier in schema). The Hold-press "Off-the-Cuff Cookery Mode" mentioned in the in-game description has no gcsim implementation upstream — flagged in caveat; if upstream lands a substantive Hold variant, re-author.

**Second pass (planned):** 44 scaling-buff characters flagged by the generator need their `value` fields filled in once the schema settles on caster-relative caps and scaling expressions.

---

## Settled conventions

### Effects live on their source

Each effect lives on the **node that originates it** — passive effects on the corresponding `passives[]` entry, constellation effects on the constellation node, faction effects in `factionBonuses[]`. Do not collapse onto host abilities with `attribution` (that pattern is deprecated).

When an effect on a constellation/passive needs to bind to a specific cast, set `trigger.ability: "skill" | "burst"` explicitly. Effects with `onCast` and no `ability` field on a constellation/passive fire for **both** skill and burst casts (see Kazuha C6 infusion as the canonical example).

### Three text fields, three audiences

- `description` — in-game text only (verbatim from genshin-db / wiki); user-facing
- `caveat` — user-facing limitation note about how the planner represents the ability
- `_curatorNotes` — internal scratch (string array); never rendered

When drafting a new character, copy in-game description into `description`. Never put implementation notes in `description` — that's what `_curatorNotes` is for.

### Normal attacks always present

Keep the `N` ability for every character including pure off-field supports. Curation gets simpler when you can rely on its presence.

### Constellations and passives are not informational-only anymore

Old convention was "constellation entries are informational; effects collapse onto E/Q with attribution." **No longer.** Effects live on the constellation/passive that originates them. Constellation entries can have `effects: [...]`. C3/C5 typically still have no effects (talent-level boosts) but will have `description` and may have `_curatorNotes`.

### Permanent bonuses

A "permanent bonus" is a passive whose effects use `trigger.type === "passive"`. The TeamBonusesBlock derives the chip list from this. **Do not author a `permanentBonuses[]` array** — that field was removed in the 2026-04-25 refactor.

For HP/EM-scaling flat DMG passives (Cyno A4, Zhongli A4): use `{ type: "scaling", stat: "hp"|"em", ratio: N }` where ratio matches the in-game percentage display. Stats: `normalFlatDmg`, `chargeFlatDmg`, `plungeFlatDmg`, `skillFlatDmg`, `burstFlatDmg`.

### Faction effects

Author in `factionBonuses[]` (top-level on `CharacterData`):

```jsonc
"factionBonuses": [
  {
    "faction": "hexerei",
    "name": "Secret Rite",
    "description": "...",
    "effects": [ /* one effect per reaction trigger */ ]
  }
]
```

Each effect carries `conditions: { type: "teamFaction", faction: "<name>", min: 2 }` and the appropriate trigger (typically `onReaction`). The character must also declare membership: `"factions": ["hexerei"]` at the top level. Always an array, never a bare string.

Faction effects are not yet rendered by the timeline (reaction-trigger rendering is a future addition); the structure is in place for when it lands.

### Variant overrides REPLACE base

For `cooldownModifiers`, `durationModifiers`, `chargeModifiers`: if a variant carries the array, the base's array is fully ignored. If the variant omits the array, the base's applies. This matches the "variant is an opt-out" mental model.

A variant can also override `behavior` (Zhongli hE: instant skill → persistent shield) and any of the behavior-specific fields (`duration`, `persistentBehavior`, `summonActivatesAt`, `stanceExtension`, `terminatesOnSwap`).

### Plunge attacks

Plunge frames live on the `NormalAbility` as `plungeFrames` (single FrameMap). For characters with plunge-variant timing keyed by the preceding E (Kazuha hE→P uses different frames than E→P), use `plungeVariants[]` on the same NormalAbility. Variant selection is by matching the preceding E token's text against `plungeVariants[i].input`.

The legacy `abilityType: "plunge"` is **gone** — do not create separate plunge ability entries.

### Stance characters — dual normal + skill entries

Pattern: two `normal` abilities (out-of-stance + `conditions: inStance`), two `skill` abilities (same pattern). The Q has `behavior: "stance"` and usually `terminatesOnSwap: true`. Parser picks the right variant per-token via `resolveActiveAbility`. Out-of-stance ability should come first in `abilities[]` so the static `eAbility` lookup picks it for charge-queue sizing.

When stance normals are elementally infused (Cyno's Pactsworn Pathclearer, Raiden's Musou Isshin), set `infusion: "<element>"` on the in-stance normal. The renderer tints normal/charge blocks with the character's element color.

### Skill-typed abilities with N input (lanyan-shape)

When an in-stance "N" press fires what gcsim categorises as a `SkillState` action (with elemental-art ICD/scaling rather than normal-attack ICD/scaling), author it as `abilityType: "skill"` with `input: ["N"]` rather than as a normal-attack variant. Lanyan's Feathermoon Ring is the canonical example: pressing N during her 66f leap-back stance fires `reathermoonRings()` which returns `action.SkillState` with `AttackTagElementalArt`. A normal-attack-typed entry would inherit normal-attack ICD which is wrong.

If both N and E inputs trigger the same in-stance skill action (lanyan again — both press paths route to identical `ringsFrames`), author **two separate skill entries**, one with `input: ["N"]` and one with `input: ["E"]`. Same `frames`, same `cooldown: 0`, same `conditions: { state: "inStance" }`. Cyno's mortuary_rite is a single-input precedent; the multi-input case is novel but mirrors the same pattern.

This is _different_ from Nilou's Sword Dance, which is also categorised as `SkillState` in gcsim but is authored as `abilityType: "normal"` with `hits[]` because it's a 3-hit chain that the parser's normal-attack chain handler can advance through. The decision rule: if it's a single-press multi-hit attack, use skill-typed-with-N-input; if it's a chained attack the player advances through with sequential N presses, use normal-typed-with-hits[].

### Summons on rotation entry-points (nilou-shape)

When a summon is spawned by a downstream entry in a multi-stage chain (e.g. Nilou's Tranquility Aura spawns 40 frames after the Whirling Steps 3 hit, which is the 3rd in-stance E press), the schema-pure place to author the summon is on that downstream entry. **But the parser may not pick that entry** — for diluc-shape multi-stage chains where all entries share `input: ["E"]` + `conditions: { state: "inStance" }`, the parser resolves to the first matching entry every time, so the downstream entry is never selected.

If the summon is the dominant gameplay output (Nilou: ~99% of rotations end in WS3 → Tranquility Aura), author it on the **rotation entry-point** (the base E in Nilou's case) with `spawnsAt` calculated for the canonical rotation timing. Trade-offs:

- ✅ Canonical rotation renders correctly.
- ⚠️ Non-canonical rotations (e.g. "E swap" with no in-stance presses) over-fire the summon. Surface this in a `caveat` field on the entry-point ability so the user sees the limitation.
- ⚠️ The `spawnsAt` value is rotation-dependent (assumes specific chain timing). Document the assumption in `_curatorNotes`.

This is a deliberate fidelity trade-off: technical correctness (summon on the actual spawn-source ability) loses to user-experience correctness (summon renders for the actual rotation users type). Reviewable as soon as the parser learns to advance through chain-state entries.

### Reaction triggers — enumerate explicitly

`trigger: { type: "onReaction", reaction: <X> }` accepts `Reaction | Reaction[] | "any"`. **Do not** use a generic element shorthand — enumerate the specific reactions per character based on KQM data. Game text says "electro-related reactions" but spread does not trigger Fischl A4, while quicken/aggravate do.

### Compound targets

`target` accepts `EffectTarget | EffectTarget[]`. Use `["self", "active"]` when the buff applies to the off-field caster AND the on-field active character (Fischl Hexerei). Use `"team"` only when it genuinely applies to all party members. Use `"teamExcludingSelf"` when game text says "excluding [character]" (Raiden C4, Wishbearer C6).

### Percentage values are whole numbers

Store `22.5` not `0.225` for a 22.5% buff. The `stat` key (e.g. `"atk%"`, `"cryoDmgBonus"`) carries the unit. Flat stats (e.g. `em: 90`) are already whole numbers — keeps the convention consistent.

### Unknown buff values

When a buff exists but its value depends on runtime state the planner doesn't track (Raiden A4 scales off ER; Raiden E grants Burst DMG% based on each character's energy cost), use `value: { type: "unknown", description: "..." }`. The description renders verbatim in tooltips. Still emits a buff bar so users know the buff exists.

### Ramping buffs

For buffs that ramp over time (Yelan A4: 1% → 50% over ~14s at +3.5%/s):

```jsonc
"value": { "type": "ramping", "startValue": 1, "stepValue": 3.5, "stepInterval": 1, "cap": 50 }
```

Renders as a gradient bar (dim at ramp start → full at cap). Active-target segmentation picks up the gradient at the correct ramp progress.

### Charge modifiers (constellation extra charges)

```jsonc
"chargeModifiers": [
  { "source": "C2: The Auspicious", "type": "flat", "value": 1,
    "conditions": { "type": "constellation", "level": 2 } }
]
```

Enables correct multi-charge behavior in the parser (Yelan C1, Ganyu C2).

### `afterDuration` trigger

For effects that fire when an ability's duration ends (Raiden C4: +30% ATK after Musou Isshin ends): use `trigger: { type: "afterDuration", ability: "burst" }`. The `ability` field is required when the effect lives on a passive/constellation — there's no host ability to infer from. Buff start is computed as `bar.start + bar.uptime`.

### Self-target buffs

For buffs that apply only to the casting character (Furina C6 "Center of Attention"): use `target: "self"`. Renders as a full-duration bar on the source character's individual buff row (no segmentation). Does not appear in the team buff row.

### `infusion` field vs `"infuse"` Effect type

Both exist. `Ability.infusion` (on `NormalAbility`) is the always-on element infusion while a normal ability is active (Cyno in stance). The `Effect` type `"infuse"` is conditional/triggered (Bennett C6 + sword/claymore/polearm gate). Use whichever matches the in-game mechanic. When in doubt, the effect form is more flexible.

### When NOT to model an effect

If an effect's proc rate is highly variable (aura-dependent, requires precise on-field timing, depends on a specific aura state), skip it and add a `_curatorNotes` entry explaining why. Modeling it inaccurately implies reliable uptime and misleads users. Example: Fischl A4 Undone Be Thy Sinful Hex — Oz's ~1s cadence usually steals the electro reaction before the active character can trigger it; not reliably proccable in standard off-field Fischl comps.

**Bond of Life is out of scope (settled 2026-05-07).** Bond of Life is a damage-and-healing-tied resource — the planner has no model for tracking BoL accrual or consumption, and is unlikely to grow one (it's a heavy state addition for a small render benefit). Downstream effects gated on BoL (Arlecchino's Masque of the Red Death pyro infusion, the BoL-scaling FlatDmg on Masque-state N hits) are skipped at the curation layer:

- Don't author an `inStance` variant for BoL-gated stances. The schema's `inStance` is a poor fit (BoL gating is HP-percentage-driven, not skill-cast-driven), and even if encoded, the variant would never have a trigger to activate it.
- Drop genshin-db generator stubs that try to skeleton BoL-scaling damage with `manual` triggers. They never fire and the values are typically wrong (Arlecchino's stub had `scaling: 30, stat: hp` — true scaling is `(masque[talent] + c1Bonus) × (CurrentHPDebt / MaxHP) × TotalAtk`, BoL-on-ATK).
- Keep BoL mechanics flagged in `_curatorNotes` on the relevant abilities, passives, and constellations so the gap is documented for future schema extension. (Arlecchino's skill, burst, A1, A4, C1, C2, C4, C6 all have BoL flags.)
- Generalizable principle: when an unmodeled state's only realizable output is a cosmetic effect (e.g. an infusion tint on N attacks), don't add the state model just to render the visual. Per-N-count gating models — like Arlecchino's ~18 N hits per BoL mark, ICD'd by the 7.5% consumption-per-hit rule — are especially low-value vs. the schema work.

Future BoL characters (Pulcinella, future Fatui releases) get the same treatment: author the base ability frames, flag BoL mechanics, skip the inStance variant.

### Frame data

See `reference_framemap_conventions.md` for the canonical FrameMap key sets per ability type. Source priority: KQM > gcsim. Always include the `name` field on `hits[]` and `chargeHits[]` entries (mostly retroactive cleanup remaining for the older curated characters).

---

## Outstanding retroactive cleanup

- Add `name` field to `hits[]` and `chargeHits[]` entries on the older curated characters (Ganyu through Raiden) — small batch task.
- Audit Fischl's `attribution: "Hexerei: Secret Rite"` on the relocated factionBonuses effects: kept for tooltip display while no other display path exists, but the `attribution` field is officially deprecated. Decide on a replacement display path before next reaction-trigger work.
