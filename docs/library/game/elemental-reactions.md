# Elemental Reactions

**Sources:** KQM Theorycrafting Library — Elemental Effects compilation (§1–2 index +
§3–5 fetched 2026-05-10). Cross-checked against the **official HoYoLAB wiki**
([entry 5206](https://wiki.hoyolab.com/pc/genshin/entry/5206), fetched 2026-07-14 via its
JSON API) — corroborates KQM's numbers 1:1. gcsim `pkg/reactable/` for implementation
reconciliation (esp. §8 priority order).
**Game version reflected:** 6.x. **Classic reactions only** — the _Lunar_ variants
(Lunar-Charged / Lunar-Bloom / Lunar-Crystallize) live in [`lunar-reactions.md`](lunar-reactions.md).
**See also:** [`icd.md`](icd.md) (how often a source applies its element + reaction-damage
ICD), [`snapshotting.md`](snapshotting.md) (what freezes at cast), [`elevation.md`](elevation.md).

> KQM is the strongest **player-side** authority (rigorous testing + documentation), but it
> is **not ground truth** — only the game engine has the exact rules (see the library
> [README](../README.md)). gcsim is a second source with a different method (implementation).
> Where they diverge, evaluate together rather than assuming either is wrong. `⚠️ NEEDS-CONFIRM`
> marks anything unsettled.

## How to read this

Every reaction is built on **Elemental Gauge Theory** (§1) — the framework for how auras are
applied, decay, and are consumed. KQM then sorts reactions into three **damage families**:

- **Amplifying** (§2) — Melt, Vaporize. _Multiply_ the triggering hit.
- **Transformative** (§3) — Overload, Superconduct, Electro-Charged, Freeze, Shatter, Swirl,
  Crystallize, Burning, Bloom / Hyperbloom / Burgeon. _Independent_ damage (or utility),
  scaling off EM + character level only.
- **Additive** (§4) — Spread, Aggravate. _Flat bonus_ added to the triggering hit.

**Taxonomy note (official vs KQM):** the HoYoLAB wiki uses a **four-category** scheme — it
splits out a **"Non-Damage Reactions"** bucket (**Frozen, Crystallize, Quicken**) that KQM
keeps inside Transformative (Frozen/Crystallize) and Additive/Catalyze (Quicken). Same
mechanics, different shelving; every numeric value below is identical between the two sources.

The reaction-specific **ICDs** noted throughout (Overload 0.5 s; Superconduct / Swirl / Bloom
/ Shatter "2 instances per 0.5 s"; Crystallize 1 s) are the reaction-**damage** ICD groups
catalogued in [`icd.md`](icd.md).

## Contents

1. [Elemental Gauge Theory](#1-elemental-gauge-theory) — auras, units, tax, decay, consumption
2. [Amplifying Reactions](#2-amplifying-reactions) — Melt, Vaporize
3. [Transformative Reactions](#3-transformative-reactions) — Overload … the Bloom line
4. [Additive Reactions](#4-additive-reactions) — Quicken, Spread, Aggravate
5. [Elemental Absorption](#5-elemental-absorption)
6. [Elemental Resonance](#6-elemental-resonance) — _stub_
7. [Weapon Infusion](#7-weapon-infusion) — _stub_
8. [Simultaneous Reaction Priorities](#8-simultaneous-reaction-priorities)
9. [→ How our tools use this](#-how-our-tools-use-this)
10. [Reference sourcing](#reference-sourcing) · [Glossary](#glossary--reaction-terms)

---

## 1. Elemental Gauge Theory

Elemental Gauge Theory is KQM's framework for explaining any Element-related concept in
Genshin: how much aura a source applies, how it decays, and how a reaction consumes it.
(Testing lives in KQM's Evidence Vault under "Gauge Unit Theory".)

### 1.1 Units & aura tax

When an Elemental source applies an Element, it applies a number of **Gauge Units (U)** of
aura. The per-source unit count is in KQM's **Elemental Gauge Database** (per character), but
the applied amount also depends on a **unit modifier** for the situation. Auras are not simple
addition — extending or consuming an aura does not just add/subtract the raw unit.

**Aura Tax:** application carries a **0.8× modifier** — a fresh aura keeps 80% of the source's
gauge.

| Source gauge | After 0.8× tax |
| ------------ | -------------- |
| 1U           | 0.8U           |
| 1.5U         | 1.2U           |
| 2U           | 1.6U           |
| 4U           | 3.2U           |
| 8U           | 6.4U           |

Example: Kaeya's E applies 2U × 0.8 = **1.6U** Cryo aura (decay 7.5 s/unit). **Anemo and Geo
can never exist as an aura.** _All aura values below already include tax._

> Retired notation: the TCL's old decay-letter system (1U = A, 2U = B, 4U = C) is no longer
> used — too inflexible.

### 1.2 Decay

The **decay rate is set by the first aura applied** and holds until the aura is fully
consumed/decayed:

```
D(U) = 875 / (4 × Durability) + 25/8        (each Unit = 25 Durability)
```

Standard decay rates:

| Gauge | Decay          |
| ----- | -------------- |
| 1U    | 11.875 s/unit  |
| 1.5U  | 8.9583 s/unit  |
| 2U    | 7.5 s/unit     |
| 4U    | 5.3125 s/unit  |
| 8U    | 4.21875 s/unit |

(The only source of 8U Cryo/Hydro/Pyro was the Supersense Skill in Fayz Trials Day 5.)

Additional applications of the same Element apply their own gauge but **follow the original
aura's decay rate** — so a 2U or 4U gauge can decay at D(1). Apply 1U first, then 2U/4U of the
same Element → 1.6U/3.2U auras that decay at 11.875 s/unit. _Example:_ Fischl's Charged Shot
applies 0.8U Electro; Beidou's Q changes it to 3.2U Electro → a 3.2U aura persisting **38 s**
from Beidou Q (instead of 17 s).

Rule of thumb: without extension, total aura duration ≈ **2.5 × source gauge (GU) + 7 seconds**.

**Pyro exception (since 3.0):** each Pyro application either keeps the decay rate (if it didn't
change the aura amount) or updates to the trigger's decay rate (if it did).

### 1.3 Trigger unit modifiers (how much aura a trigger consumes)

A trigger **subtracts** units from the existing aura. Gauges cannot go below zero, and triggers
only ever _remove_ — never add — so excess trigger gauge is wasted and leaves no aura behind.

| Trigger type                                           | Unit modifier | Example                                                  |
| ------------------------------------------------------ | ------------- | -------------------------------------------------------- |
| **Overload / Superconduct**                            | **1×**        | Kaeya 1.6U Cryo → Fischl 1U Electro ⇒ SC, 0.6U Cryo left |
| **Weak Amplifying** (Reverse: Cryo-Melt, Pyro-Vape)    | **0.5×**      | 1U → 0.5U; 2U → 1U                                       |
| **Strong Amplifying** (Forward: Pyro-Melt, Hydro-Vape) | **2×**        | 1U → 2U; 2U → 4U                                         |
| **Crystallize / Swirl** (Geo / Anemo triggers only)    | **0.5×**      | 1U → 0.5U; 2U → 1U; 4U → 2U                              |

- Weak Melt example: 1.6U Pyro (Amber Charged Shot, D(2)) → Kaeya E (2U Cryo) removes only 1U.
- Strong Melt example: 1.6U Cryo (Kaeya E, D(2)) → Diluc E (1U) removes 2U worth ⇒ 0U Cryo.
- Crystallize example: 1U Geo on 0.8U Electro aura ⇒ Crystallize, subtract 0.5U, 0.3U Electro left.

Transformative-reaction **AoEs have zero gauge** — **except Swirl** (see §1.5).

### 1.4 Frozen aura

Once Frozen triggers, the enemy carries a **Frozen aura**. Reactions with Frozen behave like
Cryo, though the Frozen gauge is often much higher. Cryo **and** Hydro can coexist alongside
the Frozen aura; removing Frozen (via Melt or Shatter) exposes the coexisting Cryo/Hydro aura
for further reactions. The hidden Cryo/Hydro continues to decay normally. Freeze is _extended_
when Cryo or Hydro is applied to a Freeze with a coexisting Hydro or Cryo aura respectively.
(Full duration/coexistence detail: KQM Evidence Vault; damage-side formulas in §3 Frozen.)

### 1.5 Swirl application (Swirl spreading an aura)

Swirl application happens when Swirl spreads an Element to an enemy — it can trigger further
reactions or apply an aura, following the same rules as any source. **Tax applies** to any
swirled application that becomes an aura. The swirled aura's gauge and decay depend on both the
aura Swirl triggered on and the Anemo trigger's gauge:

| Aura gauge | Anemo gauge | Swirl gauge | After tax | Decay           |
| ---------- | ----------- | ----------- | --------- | --------------- |
| 0.8U       | 1U          | 2.2U        | 1.76U     | ~7.10227 s/unit |
| 0.8U       | 2U          | 1.95U       | 1.56U     | ~7.61218 s/unit |
| 1.6U       | 2U          | 3.45U       | 2.76U     | ~5.66123 s/unit |

Like any aura, a swirled aura can be extended by a pre-existing same-Element aura. _Example:_
Barbara (1U) applies 0.8U Hydro; Venti's E (2U Anemo) Swirls a Hydro Abyss Mage (2U Hydro),
spreading 3.45U Hydro → after tax the enemy has 2.76U Hydro, lasting up to 32.775 s.

### 1.6 Electro-Charged (gauge behavior)

In Electro-Charged (EC), Hydro and Electro **coexist** as both aura and trigger. EC ticks once
per second while enough Electro **and** Hydro gauge remain, with one exception: when either
gauge fully decays, the next EC tick fires early at that moment — **unless** a gauge empties
within 0.5 s of the last tick, in which case there is no further tick. Each tick consumes
**0.4U from both** gauges. When one empties, that Element leaves the status but the other
remains available. **AoE EC ticks have zero gauge.** (Damage-side EC detail in §3.)

### 1.7 Self aura

Self Auras are Elements applied to the _character_ — from leylines, taking Elemental damage,
or an ability that imbues the character. When a Self Aura application triggers a reaction, if
the Self Aura's U value exceeds the existing aura's, the aura transitions directly to the Self
Aura. Enemy shields and innate auras count as Self Auras.

---

## 2. Amplifying Reactions

```
AmplifyingReaction = ReactionMultiplier × (1 + (2.78 × EM) / (1400 + EM) + ReactionBonus)

ReactionMultiplier = 2.0   triggering Vaporize with Hydro, or Melt with Pyro   (Forward)
                     1.5   triggering Vaporize with Pyro, or Melt with Cryo     (Reverse)
```

Amplifying Reactions scale off **EM, Reaction DMG Bonuses, and the damage of the triggering
hit** — so they benefit from CRIT, ATK, EM, and character level. Reaction DMG Bonuses currently
exist only as 4-pc Crimson Witch and Mona C1. (Full damage math → `damage-formula.md`, planned.)

- **Melt** — Pyro onto Cryo (Forward, 2.0×) or Cryo onto Pyro (**Reverse Melt**, 1.5×).
- **Vaporize** — Hydro onto Pyro (Forward, 2.0×) or Pyro onto Hydro (**Reverse Vape**, 1.5×).

---

## 3. Transformative Reactions

```
Transformative = ReactionMultiplier × LevelMultiplier
                 × (1 + (16 × EM) / (2000 + EM) + ReactionBonus)
                 × EnemyResistanceMultiplier

ReactionMultiplier = 3        Burgeon, Hyperbloom, Shattered
                     2.75     Overloaded
                     2 × ECTriggers   Electro-Charged
                     2        Bloom
                     1.5      Superconduct
                     0.6      Swirl
                     0.25     Burning
                     0        otherwise
```

**Level Multiplier:** character Lv. 90 = **1446.85** (other levels are a drop-down on the TCL
page). Enemy/environment-triggered level multiplier = **1202.81** ⚠️ NEEDS-CONFIRM (the source
copy dropped the level this figure is for).

Transformative Reactions **cannot crit** (except some via Nahida C2) but count as hits from
your character — they stack Royal weapons and trigger Favonius. They scale **only** off EM +
character level and are affected by the target's Elemental RES to the reaction's damage type.
Swirls, Swirl AoEs, Superconduct, Overload, and Shatter **snapshot reaction DMG bonuses** when
generated (see [`snapshotting.md`](snapshotting.md)).

### 3.1 Poise damage & impulse types

| Reaction           | Type            | Poise Damage | Impulse Type    |
| ------------------ | --------------- | ------------ | --------------- |
| Bloom              | To Enemies      | 25           | 2               |
| Bloom              | To Characters   | 5            | 0               |
| Burgeon/Hyperbloom | To Enemies      | 50           | 2               |
| Burgeon/Hyperbloom | To Characters   | 10           | 0               |
| Burning            | AoE (1m radius) | 30           | 0               |
| Electro-Charged    | Direct Damage   | 130          | 2               |
| Frozen             | When Unfrozen   | 30           | 2               |
| Overloaded         | AoE (5m radius) | 90           | 5               |
| Superconduct       | AoE (5m radius) | 30           | Heavy, 240, 300 |
| Shattered          | Direct Damage   | 30           | 3               |
| Swirl              | Direct Damage   | 130          | 1               |
| Swirl              | AoE (6m radius) | 30           | 1               |

### 3.2 Overloaded

Pyro on Electro (or vice-versa) → an explosion of **Pyro** DMG that destroys Geo shields
quickly. An AoE Overload causes only one instance of Overload DMG.

- Can trigger on Electrified bodies of water.
- Reaction-specific **ICD of 0.5 s**: after one character Overloads an enemy (or hits it with
  the AoE), that enemy is immune to _that character's_ Overload DMG for 0.5 s — but still
  suffers gauge reduction and stagger.

### 3.3 Superconduct

Electro on Cryo (or vice-versa), dealing **Cryo** DMG. **Reduces the enemy's Physical RES by
40% for 12 s.**

- AoE Superconduct → two instances of SC DMG per enemy; **ICD** limits an enemy to ≤2 SC
  instances per 0.5 s.
- SC does **not** lower Cryo or Electro DMG taken (despite the myth).

### 3.4 Electro-Charged

Hydro on Electro (or vice-versa), dealing **Electro** DMG. (Gauge behavior in §1.6.)

- **Coexisting auras:** with EC active, Hydro and Electro both lie under the EC status — a
  third Element (e.g. Pyro) can trigger **both** Vaporize and Overload with one damage instance.
- EC ticks every second until ≤0.5 s worth of Electro and Hydro remain.
- **Duration / spreading:** EC duration can be extended by hitlag (extending aura duration).
  With heavy Hydro application + lots of hitlag, 4 EC procs are possible from one Electro
  application. EC ticks on _secondary_ targets are unaffected by hitlag and land exactly every
  60 frames. EC can spread to nearby Hydro-aura targets — the chain lightning deals EC DMG
  **without** applying an aura.
- **Damage / cooldown:** EC **snapshots the EM** of whoever last applied an Element for the
  reaction. An enemy takes at most one EC instance every ~0.5 s. EC ticks don't count as
  hitting an enemy or triggering a reaction. Ticks only consume gauge when both Hydro and
  Electro are present, and only when they deal damage (gauges still decay over time). 0-gauge
  Electro attacks don't change EC ownership. **Patch-2.5 bug:** using Electro as the trigger,
  the Electro aura won't persist after EC ticks even when Electro gauge > Hydro gauge. Applying
  EC to an already-EC'd enemy still fires on-reaction effects.

### 3.5 Frozen

Cryo on Hydro (or vice-versa). If the Frozen aura expires or is Shattered, any underlying
Hydro/Cryo persists. (Aura coexistence in §1.4.)

- **Gauge interaction:** 2U Hydro → 1U Cryo ⇒ Frozen **and** Hydro; but 1U Cryo → 2U Hydro ⇒
  Frozen only.
- **One reaction at a time:** non-heavy Pyro onto a Frozen-with-underlying-Hydro triggers only
  Melt.

**Underlying-aura interactions:**

| Reaction     | Freeze Aura | Underlying Cryo | Underlying Hydro |
| ------------ | ----------- | --------------- | ---------------- |
| Melt         | ✔️          | ✔️              | ❌               |
| Superconduct | ✔️          | ✔️              | ❌               |
| Shatter      | ✔️          | ❌              | ❌               |
| Swirl        | ✔️          | ✔️              | ✔️               |
| Crystallize  | ✔️          | ✔️              | ✔️               |

**Freeze duration formulas:**

```
Origin Aura Gauge when Frozen = (0.8 × Origin Element Gauge)
    × (1 − Time between Origin and Trigger Application / (2.5 × Origin Element Gauge + 7))
Frozen Aura Gauge = 2 × min(Origin Aura Gauge when Frozen, Trigger Element Gauge)
Freeze Duration   = 2 × √(5 × Frozen Aura Gauge + 4) − 4
```

Consecutive-Freeze decay: freeze-aura decay starts at 0.4 GU/s, accelerates at 0.1 GU/s²;
when unfrozen, it accelerates at −0.2 GU/s² back down to the 0.4 GU/s minimum.

```
Decay Time Modifier = Σ max(0, Time Spent Frozen − 2 × Time Spent Unfrozen)
    (over consecutive Frozen→Unfrozen periods)
Freeze Duration = √(20 × Frozen aura gauge + (Decay Time Modifier + 4)²) − Decay Time Modifier − 4

— with Freeze Resistance —
Gauge_Freeze Aura = 2 × min(Gauge_Origin Aura, Gauge_Trigger Element)
Freeze Duration   = 2√(5 × Gauge_Freeze Aura × (1 − Freeze Resistance_Target) + 4) − 4
```

Some enemies have Freeze RES (reduces duration only; it does **not** affect the Freeze reaction
gauge itself).

### 3.6 Shattered

A second-stage reaction from **Blunt Attacks** on a Frozen enemy, dealing **Physical** DMG.
**ICD: 2 damage instances per 0.5 s** on the same enemy.

- Blunt Attacks (Claymores, Geo, Klee's bombs, etc.) Shatter before any Elemental DMG — which
  prevents Melting/Vaporizing that hit.
- Shatter attacks have their own GU values.
- Sometimes Shattering removes less than the normal 8 GU, allowing multiple Shatters on one
  Frozen or Shatter + Melt together (appears to be a bug).
- Shatter triggers no weapon/artifact/character passives **except Nahida's Tri-Karma
  Purification** (Skill).

### 3.7 Swirl

Anemo onto Hydro/Pyro/Cryo/Electro → AoE Elemental DMG of the aura's type, spreading that
Element to affected targets (which can trigger further reactions).

- **AoE & ICD:** AoE Swirl can cause up to two Swirl-DMG instances per Element per enemy (not
  counting the Anemo hit or downstream reactions). **ICD: 2 instances per 0.5 s** per target.
- **Special cases:** for Hydro, only the originally-Hydro'd target takes damage (Hydro
  dispersion doesn't harm others). All reactions from Swirled auras use the Swirl trigger
  character's stats. If an Amplifying Reaction is triggered this way, damage snapshots EM and
  the Base Hit is the Swirl damage number. Environmental sources (campfires, burning grass) can
  be Swirled. Swirl is separate from Elemental Absorption (§5).
- **Reaction chaining:** when a Swirl AoE reaches another aura'd enemy, the Swirled Element
  reacts with that aura, using the Anemo character's level and EM.
- **Double Swirl:** one Anemo hit can Swirl two applicable auras on one target (an EC enemy, or
  a Frozen enemy with underlying Hydro) — but only if the Anemo hit's gauge reduction exceeds
  the Electro gauge (EC) or Hydro gauge (Frozen/Hydro); otherwise it Swirls only Electro (EC)
  or Hydro (Freeze/Hydro).
- **Aggravated Swirl:** an Electro Swirl contacting a Quicken aura triggers an Aggravated Swirl
  (a Transformative Reaction). Only possible multi-target (can't be on the Swirl-hit enemy).
  Although Aggravate is Additive, an Aggravated Swirl's damage is calculated as Transformative.

### 3.8 Crystallize

Geo onto Pyro/Hydro/Cryo/Electro → an Elemental shard; picking it up grants an Elemental
shield. **Deals no damage** — the shield's base absorption scales off the Crystallize
trigger's EM and level.

- Crystallize on an EC target generates an **Electro** shard.
- Picking up multiple shards refreshes shield duration and Element.
- Shards spawn in front of the enemy when possible.
- **Global ICD of exactly 1 s:** an enemy Crystallized by any character is immune to
  Crystallize (by anyone) for 1 s — no further shards or gauge consumption in that window.

### 3.9 Burning

Dendro onto Pyro (or vice-versa) → **Pyro** DMG that does not stagger. Ticks every 0.25 s and
applies 1U Pyro between 0.25 s and 0.42 s after the "Burning" text first appears, then once
every 2 s (given enough Dendro and Pyro).

- **Aura:** looks like Pyro with animated fire; acts as a Pyro aura when reacted with, and can
  be extinguished — leaving the underlying Dendro (rarely Pyro) aura. The extinguishing attack
  can react "through" Burning, hitting both the Burning and the underlying aura(s) in one hit.
- **Ownership:** whoever last refreshes Burning with Dendro or Pyro owns the aura; Burning
  damage uses the owner's stats.

### 3.10 Bloom (and the second-stage reactions)

Hydro onto Dendro/Quicken (or vice-versa) → a **Dendro Core** (non-damaging), which then
explodes or feeds a second-stage reaction.

- A Dendro Core explodes after **6 s**, or immediately if 5 Cores exist and a 6th Bloom fires
  (as the 6th is made, the 1st explodes).
- Applying **Electro** → Hyperbloom; **Pyro** → Burgeon.
- Suction skills/bursts (Venti Q, Kazuha E) can group Cores; enemies can also trigger
  Hyperbloom/Burgeon on player-made Cores.
- **ICD & gauge:** all damaging Bloom reactions (Bloom Explosion, Hyperbloom, Burgeon) share an
  **ICD of 2 instances per 0.5 s** per enemy; all deal Dendro DMG but **apply no Dendro**. The
  ICD can be bypassed with different Dendro/Hydro/Electro/Pyro sources. Bloom (Core generation)
  consumes gauge at a **2:1 Hydro:Dendro** ratio, so Hydro is the "weak" Element.
- **On-reaction effects:** fire only on enemies/animals that can hold auras; can fire via
  Hyperbloom/Burgeon on Cores even with no other target nearby; count as Dendro-related
  reactions.
- **Cores:** block projectiles/attacks that don't react with Dendro (Cryo, Anemo, Geo,
  Physical, Dendro). Bloom-line DMG under DMG-ICD can still trigger some on-CRIT effects
  (Xinyan C1).

**Bloom Explosion** — Dendro DMG, no stagger. AoE 5m, damages the player (reduced 95% vs
enemies), and can hit Ley Line Monoliths.

**Hyperbloom** — Electro onto a Core → Dendro DMG, no stagger; creates a **Sprawling Shot**
targeting the nearest enemy at trigger time (1m-radius AoE, can self-damage). Scales off the
**Electro applier's** stats (Electro character _or_ an Anemo character Swirling Electro).
Electro Crystals can trigger it (targeting is inconsistent). **Does not snapshot EM** on
trigger, and can benefit from the same 4-pc FoPL/Gilded proc it triggers.

**Burgeon** — Pyro onto a Core → Dendro DMG, no stagger. Scales off the **Pyro applier's**
stats (Pyro character, Anemo Swirling Pyro, or any melee under Bennett C6). AoE 5m, 95% reduced
self-damage, can hit Monoliths. Self-damage is affected only by the player's Dendro RES
(reducing enemy Dendro RES does nothing to it). Can benefit from the 4-pc FoPL/Gilded proc it
triggers, though Gilded shows inconsistency.

---

## 4. Additive Reactions

Catalyze covers all Dendro-Electro reactions: **Quicken** (the non-damaging aura), **Spread**,
and **Aggravate**.

**Quicken** — Dendro onto Electro (or vice-versa), non-damaging. The aura persists for:

```
Duration = (Smaller gauge value × 5) + 6 seconds
```

Quicken coexists with Electro, Dendro, or Cryo, and reacts as a **Dendro source** against Pyro
or Hydro.

**Damage** — both Spread and Aggravate use:

```
ReactionDamage = Multiplier × LevelMultiplier × (1 + (5 × EM) / (1200 + EM) + Bonus)
```

| Reaction  | Multiplier |
| --------- | ---------- |
| Spread    | 1.25       |
| Aggravate | 1.15       |

**EM does not snapshot** for either reaction.

- **Spread** — Dendro onto a Quicken aura → Dendro DMG. Adds flat damage to the triggering
  attack; **no inherent ICD** — frequency follows the Dendro source's ICD.
- **Aggravate** — Electro onto a Quicken aura → Electro DMG. Same mechanics as Spread, lower
  1.15 multiplier.

---

## 5. Elemental Absorption

Certain Anemo abilities can be infused with Hydro, Pyro, Cryo, or Electro.

**Characters:** Anemo Traveler (Skill & Burst), Venti (Burst), Sucrose (Burst), Kazuha (Burst &
Skill), Sayu (Skill).

**Priority orders** (two distinct systems):

| Type | Priority                      | Characters                             |
| ---- | ----------------------------- | -------------------------------------- |
| 1    | Cryo > Pyro > Hydro > Electro | Anemo Traveler abilities               |
| 2    | Pyro > Hydro > Electro > Cryo | Venti, Sucrose, Kazuha, Sayu abilities |

**Triggering:** absorption needs direct contact with an Elemental aura on enemies, objects, or
players — attacking the Anemo ability with an Elemental Skill/infused weapon is _not_ enough;
either the character touches the ability while infused, or an enemy carries the Element. Each
ability can absorb **only one Element per use**.

> ⚠️ KQM flags absorption as "not yet fully understood" — triggering mechanics and
> inconsistencies are under investigation.

---

## 6. Elemental Resonance

🚧 **Stub.** Resonance is the team-comp passive granting stat bonuses based on element
pairs/triples on the team. Not load-bearing for the parser's cast-only reaction emission;
deferred. Source when needed:
<https://library.keqingmains.com/combat-mechanics/elemental-effects/elemental-resonance>.

## 7. Weapon Infusion

🚧 **Stub.** Covers bow Charged Shots, Catalyst attacks, and stance infusions. Relevant to
per-hit reaction emission in a future parser expansion; not load-bearing for cast-only
emission. Source when needed:
<https://library.keqingmains.com/combat-mechanics/elemental-effects/weapon-infusion>.

## 8. Simultaneous Reaction Priorities

The KQM TCL page for this is a stub pointing at an external Google Doc (not accessible at fetch
time). The implementable source-of-truth meanwhile is gcsim's `React()` in
`pkg/reactable/reactable.go`, whose per-trigger-element priority order is:

```
Electro:  Aggravate → Overload → AddEC → FrozenSuperconduct → Superconduct → Quicken
Pyro:     Overload → Vaporize → Melt → Burning
Cryo:     Superconduct → Melt → Freeze
Hydro:    Vaporize → Freeze → Bloom → AddEC
Anemo:    SwirlElectro → SwirlPyro → SwirlHydro → SwirlCryo → SwirlFrozen
Geo:      CrystallizeElectro → CrystallizeHydro → CrystallizeCryo → CrystallizePyro → CrystallizeFrozen
Dendro:   Spread → Quicken → Burning → Bloom
```

- Each `Try*` reaction consumes durability proportionally and may set `a.Reacted = true`;
  later reactions on the same hit fire only if remaining durability allows.
- Anemo through EC double-swirls (Electro and Hydro) — see §3.7 Double Swirl for the
  gauge-reduction condition.
- Pyro through EC triggers **both** Vape (consuming Hydro) and Overload (consuming Electro) —
  sequential, but observed as simultaneous.
- Geo on EC: only one Crystallize fires (Electro takes priority); Crystallize's 1 s ICD gates
  the second.

For the parser's cast-only emission model this order isn't strictly load-bearing (we emit the
full plausible reaction set per cast and let the consumer's trigger filter narrow), but it
informs the aura-update rules — which aura is consumed when several match.

---

## → How our tools use this

The library is _what's true_; this section is the bridge to _how we consume it_.

- **Reaction-curves instrument** (`visualizers/lib/reactionCurves.ts`) — uses the three EM
  bonus formulas (§2 `2.78·EM/(1400+EM)`, §3 `16·EM/(2000+EM)`, §4 `5·EM/(1200+EM)`), the
  reaction multipliers, and the per-level multiplier table.
- **Gauge explorer** (`visualizers/lib/gauge.ts`) — uses §1 gauge theory: aura tax (0.8×),
  decay `D(U)`, and reaction consumption.
- **Rotation planner** (`notationParser.ts`, v1.5) — emits the plausible reaction set at each
  cast site ("windows not gauges" — no aura/ICD simulation); the §8 priority informs aura-update
  logic. Reaction-gated buffs (artifact 4-pc `onReaction`) are driven from that event stream.
- **Reaction-damage ICDs** (Overload/Swirl/Superconduct/Bloom/Shatter/Crystallize timings above)
  are the reaction-damage ICD groups in [`icd.md`](icd.md).
- **Snapshotting** of reaction DMG bonuses, EC's last-applier EM, and the "transformative EM is
  dynamic" rule → [`snapshotting.md`](snapshotting.md).
- **Lunar** reaction variants → [`lunar-reactions.md`](lunar-reactions.md); the elevation DMG
  bucket → [`elevation.md`](elevation.md).

## Reference sourcing

- §1–2 (index + intros) — copied by Nate from the KQM TCL Elemental Effects index.
- §3 (per-reaction detail) and §4 — fetched 2026-05-10 from the KQM TCL.
- §5 — fetched 2026-05-10 (KQM flags absorption "not yet fully understood").
- §6–7 — deferred stubs; not load-bearing for cast-only reaction emission.
- §8 — KQM page is a stub; gcsim `React()` priority used as canonical source.
- Whole-doc cross-check (2026-07-14) — official HoYoLAB wiki (entry 5206) via JSON API;
  corroborates every KQM number; its only structural difference is the "Non-Damage Reactions"
  taxonomy bucket (see [How to read this](#how-to-read-this)).

## Glossary — reaction terms

- **Amplified (Amped)** — the reaction category Melt and Vaporize fall into; multiplies the
  trigger by a set multiplier.
- **Aura** — the Element(s) present on an entity in a neutral state; the next source applies an
  aura if none is present.
- **Aura Tax** — the 0.8× reduction on gauge from Elemental sources becoming an aura.
- **Coexisting / Underlying Aura** — multiple different-Element auras on one entity (e.g. EC,
  Frozen + Hydro/Cryo).
- **Elemental Decay** — an aura persists as a decaying gauge, reduced two ways: over **time**
  (the decay rates in §1.2) and via **reactions** (a trigger consumes GU). When the gauge
  empties, the aura disappears.
- **Elemental Gauge / Gauge Units (GU)** — the strength of a source; how much aura a reaction
  consumes. Per-source values: KQM Gauge Unit Database.
- **Elemental Source** — an Element-imbued attack/Skill that applies an Element; should be cited
  with its decay + GU.
- **Internal Cooldown (ICD)** — the hidden timer gating how often a source applies an aura/
  trigger; during ICD the source still deals Elemental damage but applies no aura. Full model:
  [`icd.md`](icd.md).
- **Reverse [Melt/Vaporize]** — a Melt/Vape where the trigger gets the 1.5× modifier (a.k.a.
  Cryo-Melt, Pyro-Vape, Weak Melt/Vape).
- **Swirled Aura** — an aura applied by Swirl spreading one enemy's aura to another.
- **Transformative** — the category for Overload, Electro-Charged, Superconduct, Freeze,
  Shatter, Swirl, Crystallize (+ Burning and the Bloom line); damage from trigger level + EM.
- **Trigger** — when an entity already has an aura, the next source acts as the reaction trigger.
- **Unit Modifier** — the multiplier system that scales how much aura a source consumes in
  reactions (§1.3).
