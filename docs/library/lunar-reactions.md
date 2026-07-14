# Lunar Reactions

**Source:** KQM — <https://keqingmains.com/misc/lunar-reactions/> (fetched 2026-07-14).
**Game version reflected:** 6.x (Nod-Krai / Moonsign generation).
**See also:** [`elevation.md`](elevation.md) (the elevation bucket), [`factions.md`](factions.md)
(Moonsign level + benedictions), [`../elemental-reactions.md`](../elemental-reactions.md)
(classic reactions).

> KQM is the strongest player-side authority but not ground truth (see the
> library [README](README.md)). gcsim is a second source. Reconcile divergences
> deliberately; `⚠️ NEEDS-CONFIRM` marks anything unsettled.

## What they are

Lunar Reactions are a set of reactions **enabled when a party contains characters
with a Moonsign Benediction passive**. They **convert pre-existing reactions into
their Lunar variants**. Only limited 5-star characters (Nod-Krai) carry the
enabling passives. See [`factions.md`](factions.md) for the Moonsign system.

Three exist today:

| Lunar reaction                | Converts / trigger                                              | Enabled by (as of 6.x)   | Element for RES |
| ----------------------------- | --------------------------------------------------------------- | ------------------------ | --------------- |
| **Lunar-Charged (LC)**        | Electro applied to Hydro aura (or vice-versa) — the EC analogue | Ineffa, Flins, Columbina | Electro RES     |
| **Lunar-Bloom (LB)**          | Hydro applied to Dendro (or vice-versa) — the Bloom analogue    | Lauma, Nefer, Columbina  | Dendro RES      |
| **Lunar-Crystallize (LCrys)** | Geo applied to Hydro aura — the Crystallize analogue            | Zibai, Columbina, Linnea | Geo RES         |

## The damage formula & its buckets

Two damage flavors exist per reaction: **Reaction** damage (the reaction's own
autonomous hit, scales on character **Level**) and **Direct** damage (damage a
character ability deals that is _tagged_ with the reaction; does **not** scale on
level).

**Reaction-type** (LC, LCrys — LB deals no reaction damage itself, see below):

```
Reaction DMG (per contributor) =
  [Level Multiplier] × [EM Bonus] × [Lunar Reaction Base DMG Bonus]
                     × [Lunar Reaction Elevation] × [Reaction Bonus]   (× 1.6 for LCrys)
```

**Direct-type** (all three):

```
Direct DMG =
  [Base DMG] × [Crit Modifier] × [EM Bonus] × [Lunar Reaction Base DMG Bonus]   (× 1.6 for LCrys)
```

Note Direct damage does **not** get the Elevation term in the KQM formula strings
(elevation appears in the Reaction-type formula). `⚠️ NEEDS-CONFIRM` whether
elevation applies to Direct damage for some characters — several elevation
sources are worded per-reaction; see [`elevation.md`](elevation.md).

### The buckets, in order

1. **Base / Level Multiplier** — Reaction type uses a **Level Multiplier** (table
   below); Direct type uses the ability's own Base DMG.
2. **EM Bonus** — multiplicative, identical to classic reactions:
   `EM Bonus = (EM / (EM + 1200)) × 100%`.
3. **Lunar Reaction Base DMG Bonus** — **ADDITIVE** bucket. "Not to be confused
   with ordinary Reaction Bonus." **Only** from Moonsign Benediction passives +
   a few rare additive sources (below). **Not** affected by goblet Elemental DMG
   Bonus or Common DMG Bonus.
4. **Lunar Reaction Elevation** — **separate MULTIPLICATIVE** escalation, distinct
   from the additive bucket. Only from **5-star Constellations**. Full detail in
   [`elevation.md`](elevation.md).
5. **Reaction Bonus / Crit Modifier** — multiplicative (the classic reaction-bonus
   bucket; Crit for Direct).

**This is the crux for our schema:** buckets 3, 4, 5 are three _different_ things.
Our `lunar*DmgBonus` stats are bucket 3 (additive). Our `elevate` effect is bucket
4 (multiplicative). Bucket 5 (Reaction Bonus) is the one we don't cleanly model —
see [`elevation.md`](elevation.md) → Schema mapping.

### Multi-contributor stacking (Reaction type)

LC and LCrys tally **every** Hydro applicator and every triggering character, then
combine ranked high→low:

```
Total = Highest + (2nd Highest / 2) + (3rd Highest / 12)    (each × 1.6 for LCrys)
```

Whether the final hit **crits** is determined by whether the **highest** individual
contribution crit.

## Per-reaction detail

### Lunar-Charged (LC)

- Spawns a thundercloud lasting ~6s, dealing LC damage **every ~2s** (2.1–2.3s with
  hitlag). Ticks deplete 0.4U aura like EC but at ~2s vs EC's ~1s, so aura lasts
  longer.
- **Does NOT snapshot** character stats (EM, CRIT) — unlike Electro-Charged.
- Affected by **Electro RES**. **Not** affected by enemy DEF or DEF Shred.

### Lunar-Bloom (LB)

- Spawns a Dendro/Bountiful Core; after 2.5s grants the party **1 Verdant Dew (VD)**.
  The cores behave like regular Bloom cores; **the reaction itself deals no damage** —
  damage comes only through character abilities (Direct LB).
- VD: carries across Abyss chambers; slightly worse generation at high FPS (60fps =
  1 VD/trigger, 120fps ≈ 0.97); one trigger hitting multiple enemies = 1 VD; triggers
  <2.5s apart stack with delay.
- Affected by **Dendro RES**. Gauge mechanics mirror regular Bloom.

### Lunar-Crystallize (LCrys)

- Three **Moondrifts** spawn; after triggering LCrys three times, each Moondrift deals
  LCrys damage once. Carries a **× 1.6** factor in every formula above.
- **Does NOT have a global ICD** (unlike Crystallize) — enables _double_ Crystallize on
  an EC/LC aura (Geo consuming Electro+Hydro, or triggering LCrys while regular
  Crystallize is on its 1s CD).
- Moondrifts count as a single Geo Construct but resonate individually. Mechanics
  keyed to regular Crystallize (Navia Shrapnel, elemental shields) still proc.
- Affected by **Geo RES**. **Not** affected by enemy DEF or DEF Shred.

## Cross-cutting rules

- **CRIT:** element-specific CRIT bonuses (e.g. `*CritDmg` stats) apply to the matching
  Lunar reaction. For Reaction LC/LCrys, the whole hit's crit is decided by the highest
  contributor's crit.
- **RES:** each reaction is affected by its element's RES (Electro/Dendro/Geo). **None**
  are affected by enemy **DEF** or **DEF Shred** — relevant when pairing Lunar teams
  with DEF-shred units.
- **Regular DMG Bonus does NOT apply** — not goblet Elemental DMG Bonus, not Common DMG
  Bonus. Only the Lunar Base DMG Bonus bucket (3) does.
- **Rare additive Base-DMG-Bonus sources** (bucket 3, beyond Moonsign Team Bonus):
  Columbina C4 (all types, self), Lauma Pale Hymn stacks (LB), Illuga Nightingale Song
  stacks (Direct LCrys), Zibai A1 (self), Linnea C1 (reaction + Direct LCrys).

## Level Multiplier table (Reaction type)

| Level      | 10    | 20    | 30     | 40     | 50     | 60     | 70     | 80      | 90      | 95      | 100     |
| ---------- | ----- | ----- | ------ | ------ | ------ | ------ | ------ | ------- | ------- | ------- | ------- |
| Multiplier | 34.14 | 80.58 | 136.29 | 207.38 | 323.60 | 492.88 | 765.64 | 1077.44 | 1446.85 | 1561.47 | 1674.81 |

Direct Lunar damage does not scale with level.

## → Schema mapping

critcalc **visualizes**, it doesn't compute damage — so we don't implement the
formula, we make sure each bucket is _authorable and visible_.

| Mechanic                               | Bucket             | Our primitive                                                                                         | Status                                                                                                                                             |
| -------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lunar Reaction Base DMG Bonus          | 3 (additive)       | `Stat` keys `lunarChargedDmgBonus` / `lunarBloomDmgBonus` / `lunarCrystallizeDmgBonus` (buff effects) | ✅ exists; ✅ single-reaction renders                                                                                                              |
| Elevation                              | 4 (multiplicative) | `elevate` Effect (`reactions[]`, `value`)                                                             | ⚠️ exists but renderer only handles single-**lunar** reaction; label should say "elevated" — see [`elevation.md`](elevation.md)                    |
| Reaction Bonus                         | 5 (multiplicative) | — none —                                                                                              | ❌ gap; Columbina's Moonsign Team Bonus / benediction may live here vs bucket 3 (`⚠️ NEEDS-CONFIRM` — gcsim treats her +40% as `AddReactBonusMod`) |
| LC/LCrys not affected by DEF/DEF-shred | —                  | curator note; our `defIgnore`/`resShred:def` should NOT be shown as helping Lunar reaction dmg        | 📝 authoring rule                                                                                                                                  |
| Lunar reaction as a _trigger_          | —                  | `Reaction` union has `lunarCharged` / `lunarBloom` / `lunarCrystallize` (for `onReaction` triggers)   | ✅ exists                                                                                                                                          |
| Verdant Dew resource (LB)              | —                  | none (externally-generated resource)                                                                  | ❌ gap; document as unmodelable                                                                                                                    |
| Moonsign enablement / level            | —                  | `factions` + `factionContributions` + `teamFaction`                                                   | see [`factions.md`](factions.md)                                                                                                                   |
