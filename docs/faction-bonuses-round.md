# Faction-bonuses round — scoped, not started

**Status:** SCOPED 2026-08-15, approved by ⚓ Nate. Not begun.
**Origin:** Nate asked whether Sucrose was displaying all the buffs she should be. Three of her defects were data and shipped separately (`9959b5b`, `2c21f9e`); the fourth is this — **her two Hexerei Secret Rite buffs have never drawn a bar, and neither has anyone else's.**

---

## The finding

`factionBonuses` is **not consumed by the planner at all.** `effectCollection.ts` builds its candidate pool from `[...abilities, ...passives, ...constellations]` in **six** places, and the array is not in any of them. Every Secret Rite effect in the corpus is inert on the timeline.

⚠️ This is a **documented decision, not a regression** — `docs/library/game/snapshotting.md` records it as ⚓ Nate's ruling of 2026-07-14 (keep + document now, wire later), and Venti's curator notes state it outright at the site. What changed is that a real reader hit it.

The capability layer (`deriveCapabilities.ts:505`) **does** walk `factionBonuses`, so the Team Builder has always read these correctly. The gap is planner-only.

---

## Why the collector change is the easy half

One shared `effectSourcesOf(char)` helper, appending faction effects as pseudo-sources, replacing the six inline `sources` arrays.

Low risk, and the reason is worth stating because it is the thing that would otherwise need re-deriving: **every faction effect in the corpus declares its trigger explicitly** (`onCast ability:`, `onHit abilityType:`, `onReaction reaction:`). So the collectors' "passive with no explicit ability → fire on BOTH casts" fall-through — the one real hazard in feeding non-ability sources through an ability-shaped pool — never bites. Checked across all 11 characters.

The gates the effects carry already evaluate for free: `baseCtx` carries `teamFactionCounts` for the `teamFaction ≥2` condition, and `holderStatesAt` resolves the `duringSummon` state gate Venti and Durin use.

---

## The rule this round establishes

⚓ **A faction bonus that CHANGES AN EXISTING NUMBER re-authors it under a gate. A faction bonus that ADDS A NEW EFFECT gets its own entry.**

Both halves already exist in the corpus, authored on the assumption that only one of them would ever render. Turning the collector on without applying this rule double-counts the first kind.

- **Changes a number:** Durin's A1 shred, Venti C2 Breeze of Reminiscence.
- **Adds an effect:** Sucrose, Fischl, Albedo, Lohen, Venti's rite proper, Venti C4.

---

## Per-character audit

11 characters carry `factionBonuses`; 8 have live effects; ~15 windows would newly render.

### Clean — no base overlap, renders correctly as-is (4 characters)

| character   | what appears                                                                            |
| ----------- | --------------------------------------------------------------------------------------- |
| **Sucrose** | E → team +5.71% DMG / 15s · Q → team +7.14% DMG / 20s (both ability `effects` are `[]`) |
| **Fischl**  | overloaded → +22.5% ATK / 10s · electroCharged\|lunarCharged → +90 EM / 10s             |
| **Albedo**  | onCast-E and onHit-E, both DEF-scaling party DMG / 20s (caps 12% / 30%)                 |
| **Lohen**   | Q → self +40% Normal and +40% Charged DMG / 6s                                          |

### Needs work first (4 characters)

**Venti — the genuine double-count, and it is load-bearing.** His C2 curator note says it outright:

> No mutual-exclusion condition was added to the base effects because factionBonuses effects are not consumed by the planner, so gating the base off would erase the shred window entirely in a Hexerei team.

Wiring the collector without touching that authoring puts **both** the base −12% Anemo/Physical shred and the Secret Rite −24% on the chart at once. Same shape on C4: the base manual-trigger buff was deliberately left in place as the <2-Hexerei kit and would duplicate the two new `onCast` bars. Fix is `not(teamFaction hexerei ≥2)` on the base effects — which is only **safe** because the faction side now renders. ⛔ Do not gate the base before the collector lands.

**Durin — re-author, do not sum in the projection.** Base is 5 × −20% gated on `duringSummon` alone; the rite is 5 × −15% gated on `all[teamFaction hexerei ≥2, duringSummon]`, deliberately additive to reach the in-game −35%. Collected as-is the chart draws **ten** debuff bars where a reader expects five.

Re-authoring adds `not(teamFaction hexerei ≥2)` to the base and moves the rite values −15 → **−35**. One bar per element in both worlds: −20% solo, −35% in a Hexerei team. (`not` is already in service — it is how Silken Moon's Nascent rung is gated.)

⚠️ **The summing-projection alternative was investigated and rejected on evidence.** Eight characters have co-located same-element shreds, but they are overwhelmingly **alternatives, not addends**:

- **Faruzan** has two −30% Anemo `onCast` entries — one shred, two condition branches. A summing projection shows **−60%**, flatly wrong. Same shape on Citlali, Emilie, Sigewinne, Linnea, Mavuika.
- **Venti** has base Breeze −12% Anemo _and_ Storm of Defiance −20% Anemo, which genuinely do stack (two different constellations) — and the reader wants those **separate**, because provenance is the point of the tool. Summing destroys information.
- **Durin is the only true addend pair**, and only because his −15% is a _modifier on his own shred_ rather than a second shred.

A summing projection would have to distinguish replaces / stacks-from-a-different-source / same-source-composition-modifier — three relationships the data encodes only through conditions — and would double Faruzan and Citlali unless it also understood mutual exclusion. Strictly more machinery for strictly less clarity.

**Prune — row-key collision.** Both rite buffs are `atk%` on `onReaction`, and the onReaction row key is `${characterId}::char::onReaction::${stat}`, so a +60% self buff and a +30% active buff pool into one row despite different triggers and targets. The faction source arm below only half-solves it (they share a `bonusName`); the key likely needs stat or target too.

**Albedo — same class of collision to verify**, `onCast`-E and `onHit`-E both keying under `albedo::char::E`.

### No action (4 characters)

Klee, Nicole, Varka are description-only. **Razor**'s single entry is a `manual`-trigger `energy` effect — not a buff window, so nothing new appears on the buff surface.

---

## Labelling: a fourth source arm, ⛔ NOT `attribution`

A Secret Rite bar would otherwise label as plain "Sucrose E", hiding the very thing that makes it conditional.

⛔ **The first proposal — teach the row branches to read `EffectBase.attribution` — was measured and rejected.** 24 effects across 6 characters already carry `attribution` (Shenhe's two Icy Quill rows, Prune's entire constellation set, Nicole, Durin C6, Traveler Electro C2), and it is read **only** in the `afterDuration` branch today. Making the general branches read it would relabel and re-key all 24, splitting or merging bars on six characters with nothing to do with Hexerei. That is its own round, with its own visual review.

⚓ **Do it structurally instead.** `BuffWindowSource` (`rotationEvents.ts:190`) is a discriminated union of `character | artifact | weapon`, and `teamBuffRows` already branches per arm — artifacts get their own label (`set?.name ?? src.setId`). Add a fourth:

```ts
| { type: 'faction'; faction: string; bonusName: string; trigger: … }
```

Faction rows then read **"Sucrose Secret Rite"** by construction, and **not one existing row changes**, because nothing else emits that arm.

📌 For whenever the attribution round does happen: Prune's two rite effects already carry `attribution: "Witch's Eve Rite: Witchseeker's Vow"`, so the convention is partly seeded.

---

## Order of work

1. `effectSourcesOf(char)` helper + the fourth `BuffWindowSource` arm — collector and label together, so no bar ever ships unlabelled.
2. **Venti** base gating (C2 shred, C4 manual buff) — must follow step 1, never precede it.
3. **Durin** re-author to a single gated −35%.
4. **Prune** and **Albedo** row-key checks.
5. Corpus invariant in `notationParser.ir.test.ts` shape; gates; `test:e2e` before merge.

---

## Open

- Whether the faction row belongs on the team-buff surface or wants its own visual register — it is a **conditional** buff in a way no other row is, and the chart currently has no vocabulary for "this only exists in a certain team". Deferred until the bars are on screen and Nate can look at them.
- The general `attribution`-as-row-label round (24 effects, 6 characters) remains unscheduled.
