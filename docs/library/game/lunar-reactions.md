# Lunar Reactions

**Sources:** KQM — <https://keqingmains.com/misc/lunar-reactions/> (fetched 2026-07-14);
cross-checked against the official HoYoLAB wiki
([entry 10450](https://wiki.hoyolab.com/pc/genshin/entry/10450), via its JSON API) and gcsim
`pkg/core/combat/reaction.go` + `pkg/reactable/lunar*.go` (2026-07-14) — which **corrected the
EM formula** and **resolved the Columbina bucket question** (both below).
**Game version reflected:** 6.x (Nod-Krai / Moonsign generation).
**See also:** [`elevation.md`](elevation.md) (the elevation bucket), [`factions.md`](factions.md)
(Moonsign level + benedictions), [`elemental-reactions.md`](elemental-reactions.md)
(classic reactions), [`icd.md`](icd.md) (application cadence).

> KQM is the strongest player-side authority but not ground truth (see the
> library [README](../README.md)). gcsim is a second source. Reconcile divergences
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

Both flavors share one structure — gcsim's `CalcLunarReactionDmg`
(`pkg/core/combat/reaction.go:28`), corroborated term-for-term by the official wiki:

```
Lunar DMG = ( M × BaseDmg(Level) × (1 + EM Bonus + Reaction Bonus) × (1 + Base DMG Bonus)
              + Direct Base DMG )
            × (1 + Elevation) × Enemy Elemental RES × (1 + CRIT DMG)

M        = 3 (Lunar-Charged) · 1.6 (Lunar-Crystallize)     [gcsim reactionMultiplier]
EM Bonus = (6 × EM) / (2000 + EM)
```

- **Reaction type** (LC, LCrys) uses `M × BaseDmg(Level)` and scales on character
  **Level** (`BaseDmg(Level)` = the Level Multiplier table below; = 1446.85 at Lv 90).
  LC and LCrys differ **only** in `M` (3 vs 1.6) and the RES element — not the EM term.
  **LB deals no reaction damage** of its own (below).
- **Direct type** (all three) drops the level term and adds the ability's own **Direct
  Base DMG**; it does **not** scale on level.

> ⚠️ **EM formula corrected (2026-07-14 cross-check):** this doc previously stated the EM
> Bonus as `EM/(EM+1200)` — **wrong**. Both gcsim (`reaction.go:28`) and the official wiki
> give **`6·EM/(2000+EM)`**, shared by LC and LCrys. (Classic reactions differ: transformative
> `16·EM/(2000+EM)`, additive `5·EM/(1200+EM)`.)

**Elevation applies to Direct Lunar damage too** — Nate confirmed 2026-07-14, and gcsim
**corroborates**: `reaction.go` multiplies the _entire_ expression (including the Direct/
`FlatDmg` term) by `(1 + Elevation)`. (KQM's printed Direct formula omits the term; we and
gcsim include it. See [`elevation.md`](elevation.md).)

### The buckets

Five contribution points — confirmed by gcsim's `AttackInfo` (separate `BaseDmgBonus`,
`Elevation`, and `ReactBonus` fields) and the wiki formula:

1. **Base / Level** — `M × BaseDmg(Level)` for Reaction type (`M` = 3 LC / 1.6 LCrys); the
   ability's own Base DMG for Direct type.
2. **EM Bonus** — `6·EM/(2000+EM)`, additive **inside the EM bracket**.
3. **Lunar Reaction Base DMG Bonus** — its own `(1 + Base DMG Bonus)` multiplicative
   bracket. **Only** from Moonsign Benediction passives + a few rare additive sources
   (below); **not** goblet/common DMG Bonus. → gcsim `atk.BaseDmgBonus`; our `lunar*DmgBonus`
   stats.
4. **Elevation** — a separate **outermost** `(1 + Elevation)` multiplier. Only from 5-star
   Constellations. → gcsim `atk.Elevation`; our `elevate` Effect. See [`elevation.md`](elevation.md).
5. **Reaction Bonus** — additive **inside the EM bracket** alongside EM (`… + Reaction
Bonus`); distinct from bucket 3. → gcsim `char.ReactBonus()` / `AddReactBonusMod`.
   **✅ CLOSED 2026-07-29 (Nate's ruling, Stellar round):** the `*ReactionBonus` Stat
   family (`lunarChargedReactionBonus` / `lunarBloomReactionBonus` /
   `lunarCrystallizeReactionBonus`, plus superConduct/cryoSwirl/stellarConduct
   siblings) models it — its own stat family precisely so provenance cards never
   conflate it with bucket 3. Columbina's burst is authored on it (40% @TL10, all
   three lunar reactions, gcsim `burstBuff[9]`).

(**Crit** is a further whole-hit `(1 + CRIT DMG)` multiplier; for Reaction LC/LCrys the
whole hit's crit is decided by the **highest** contributor. We model element-specific crit
via `*CritDmg` stats.)

**Crux for our schema:** buckets 3, 4, 5 are three _different_ things. `lunar*DmgBonus` =
bucket 3 (own bracket). `elevate` = bucket 4 (outermost multiplier). `lunar*ReactionBonus` =
bucket 5 (additive-with-EM) — since 2026-07-29; see → Schema mapping.

> **Columbina bucket question — resolved (2026-07-14, gcsim + wiki).** Her kit spans three
> different buckets, which is what caused the confusion:
>
> - **Benediction (Moonsign passive)** → **bucket 3** (Base DMG Bonus), scaling with her Max
>   HP (wiki: 0.2% per 1000 HP, ≤7%). → author as `lunar*DmgBonus`.
> - **C2 = `+40% Max HP`** (gcsim `c2Buff[HPP]=0.4`) → a **stat buff**, not a reaction bonus;
>   it amplifies her HP-scaled bucket-3 bonus. _This is the "+40%" the earlier note referred
>   to._
> - **Burst (Lunar Domain)** → **bucket 5** (Reaction Bonus), via gcsim `AddReactBonusMod`
>   (`burstBuff` ≈ 13–31% by talent, Lunar-tagged, whole party). Authored on `lunar*ReactionBonus` since 2026-07-29.
>
> So gcsim's `AddReactBonusMod` is her **Burst** (bucket 5), and the **+40%** is her **C2 HP**
> (a stat feeding bucket 3) — two separate effects, not one +40% reaction bonus.

### Multi-contributor stacking (Reaction type)

LC (and LCrys similarly) computes each contributor's Lunar value independently — each with
its own EM, Base DMG Bonus, Elevation, and crit — then sums them weighted by rank (high→low):

```
Total = 0.6·(Highest) + 0.3·(2nd) + 0.05·(3rd) + 0.05·(4th)
```

gcsim `lunarcharged.go`: `lcContributorMult = [0.6, 0.3, 0.05, 0.05]` — equal to the wiki's
"**180%** top-line × **[1, ½, 1/12, 1/12]**" (the 0.6 folds into `M`=3: 3 × 0.6 = 1.8).
⚠️ Our prior version had only three terms and **omitted the 4th** contributor. Whether the
final hit **crits** is decided by the **highest** contributor.

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

#### ⏭ Modelling note — the Moondrifts are GEO CONSTRUCTS, and that has a tail (2026-08-18)

⚠️ **What we model today:** the `lunarCrystallize` reaction is emitted (the sim's
`reactionBridge` applies it ALONGSIDE a crystallize, since LCrys has no global ICD) and the
`lunarCrystallize*` stat family exists. ⛔ **Moondrifts and Moondrift Harmony are NOT
modelled at all** — no construct entity, no three-triggers counter, no damage.

⚓ **The reason to record this now, before anyone needs it:** in gcsim a Moondrift is a
first-class `GeoConstructLunarCrystallize`, and geo constructs are read by mechanics that
have nothing to do with this reaction. `zhongli/stele.go`'s `resonance()` queues an extra
stele hit **per non-stele construct within radius 8**, and `simulation/setup.go` turns Geo
Resonance on for any Moondrift within 16. ⚓ So a Moondrift silently buffs a Zhongli in the
same team, and modelling one without the other is a half-truth.

⚓⚓ **And the positional objection that blocks Xingqiu's Orbital does NOT apply here.**
`gauge-round-L5e.md` refuses proximity-gated applications at radius ≈ 1 (hugging the
enemy); these checks are **8 / 16 / 20**, which ordinary combat satisfies. ⚠️ Better still,
the usual cross-character objection — "the construct has to actually be alive" — dissolves
for LCrys specifically: `TryAddLCr` **spawns up to three Moondrifts itself** whenever fewer
than three are nearby, 9 s each. The reaction creates its own preconditions, so assuming
they hold is not a fake.

⏭ **Not urgent, and here is the honest reason:** the premier LCrys carry is **Zibai**, who
is a frameless stub in our corpus (no frames, no effects on any of her three abilities), so
there is nothing for the mechanic to hang off yet. ⚠️ The prerequisite is Zibai's curation
(`ingest-character` skill), not this mechanic. When she lands, the order is: her kit first,
then Moondrifts as an entity, then whether a construct-presence condition is worth minting
for Zhongli's resonance — ⛔ never the resonance first, which is 6 oracle rows in one
fixture and has no other consumer.

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
  Columbina benediction (HP-scaled; her C2 `+40% Max HP` amplifies it), Lauma Pale Hymn
  stacks (LB), Illuga Nightingale Song stacks (Direct LCrys), Zibai A1 (self), Linnea C1
  (reaction + Direct LCrys).

## Level Multiplier table (Reaction type)

| Level      | 10    | 20    | 30     | 40     | 50     | 60     | 70     | 80      | 90      | 95      | 100     |
| ---------- | ----- | ----- | ------ | ------ | ------ | ------ | ------ | ------- | ------- | ------- | ------- |
| Multiplier | 34.14 | 80.58 | 136.29 | 207.38 | 323.60 | 492.88 | 765.64 | 1077.44 | 1446.85 | 1561.47 | 1674.81 |

Direct Lunar damage does not scale with level.

## → Schema mapping

critcalc **visualizes**, it doesn't compute damage — so we don't implement the
formula, we make sure each bucket is _authorable and visible_.

| Mechanic                               | Bucket             | Our primitive                                                                                         | Status                                                                                                                                                                                                                                             |
| -------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lunar Reaction Base DMG Bonus          | 3 (additive)       | `Stat` keys `lunarChargedDmgBonus` / `lunarBloomDmgBonus` / `lunarCrystallizeDmgBonus` (buff effects) | ✅ exists; ✅ single-reaction renders                                                                                                                                                                                                              |
| Elevation                              | 4 (multiplicative) | `elevate` Effect (`reactions[]`, `value`)                                                             | ⚠️ exists but renderer only handles single-**lunar** reaction; label should say "elevated" — see [`elevation.md`](elevation.md)                                                                                                                    |
| Reaction Bonus (additive w/ EM)        | 5                  | `lunar*ReactionBonus` Stat family (buff effects)                                                      | ✅ CLOSED 2026-07-29 (Nate's ruling): own stat family so it never conflates with bucket 3. **Columbina's Burst** authored on it (40% @TL10 = gcsim `burstBuff[9]`, all three lunar reactions; her +40% C2 is Max HP, a bucket-3 feeder, unrelated) |
| LC/LCrys not affected by DEF/DEF-shred | —                  | curator note; our `defIgnore`/`resShred:def` should NOT be shown as helping Lunar reaction dmg        | 📝 authoring rule                                                                                                                                                                                                                                  |
| Lunar reaction as a _trigger_          | —                  | `Reaction` union has `lunarCharged` / `lunarBloom` / `lunarCrystallize` (for `onReaction` triggers)   | ✅ exists                                                                                                                                                                                                                                          |
| Verdant Dew resource (LB)              | —                  | none (externally-generated resource)                                                                  | ❌ gap; document as unmodelable                                                                                                                                                                                                                    |
| Moonsign enablement / level            | —                  | `factions` + `factionContributions` + `teamFaction`                                                   | see [`factions.md`](factions.md)                                                                                                                                                                                                                   |
