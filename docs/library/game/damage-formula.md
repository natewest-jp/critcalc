# Damage Formula

**Sources:** official HoYoLAB wiki
([entry 5654](https://wiki.hoyolab.com/pc/genshin/entry/5654), via its JSON API,
2026-07-14); gcsim `pkg/enemy/damage.go` (DEF/RES multipliers) + `pkg/core/combat`
(reactions); KQM TCL damage-formula canon.
**Game version reflected:** 6.x.
**See also:** [`elemental-reactions.md`](elemental-reactions.md) (reaction damage),
[`lunar-reactions.md`](lunar-reactions.md), [`elevation.md`](elevation.md),
[`icd.md`](icd.md).

> **Status: REFERENCE.** critcalc **visualizes mechanics, it does not compute damage
> numbers** (tool constitution). This doc exists for two reasons: so curators can answer
> the #1 authoring question — **which bucket does this effect belong in?** (a DMG Bonus? an
> Additive Base DMG? a DEF shred?) — and so our DEF / RES / shred / ignore / crit primitives
> have a written spec. See → Schema mapping.

> KQM is the strongest player-side authority but not ground truth (see the library
> [README](../README.md)). Here the official wiki and gcsim **both** confirm the DEF and RES
> formulas exactly, so the foundation is solid. `⚠️ NEEDS-CONFIRM` marks anything unsettled.

## Contents

1. [The general formula](#the-general-formula)
2. [The bracket — base damage](#the-bracket--base-damage)
3. [DMG Bonus Multiplier](#dmg-bonus-multiplier) · [CRIT](#crit-multiplier) ·
   [DEF](#enemy-def-multiplier) · [RES](#enemy-res-multiplier) · [Reactions](#reaction-multipliers)
4. [Which bucket? — the curator's lookup](#which-bucket--the-curators-lookup)
5. [→ Schema mapping & current state](#-schema-mapping--current-state)

## The general formula

```
Damage = ( Base DMG × Base DMG Multiplier  +  Additive Base DMG )
       × DMG Bonus Multiplier
       × CRIT Multiplier
       × Amplifying Reaction Multiplier          (Vaporize / Melt only)
       × Enemy DEF Multiplier
       × Enemy RES Multiplier
```

The `×` terms are all multiplicative, so their **order among themselves doesn't change the
product**. What matters structurally:

- **Additive Base DMG is added _inside the bracket_**, before every multiplier — so it is
  diluted by nothing and benefits from all of them. This is why "flat/base DMG add" effects
  behave very differently from "DMG Bonus %".
- **Amplifying reactions multiply the whole bracket** (Vape/Melt); transformative, additive,
  and Lunar reactions are **separate damage instances** with their own formulas (below).

## The bracket — base damage

- **Base DMG** = `Talent Scaling % × scaling stat` (ATK, DEF, HP, or EM).
- **Base DMG Multiplier** = a multiplicative bump applied to Base DMG (e.g. Yoimiya Skill,
  Mona C6). Distinct from the DMG Bonus Multiplier.
- **Additive Base DMG** = flat amounts added _before_ the multipliers. Sources: Yun Jin Burst,
  Shenhe Skill, Zhongli, DEF/HP/EM-scaling adds (Gorou A4 = `TotalDEF × 1.56`; Redhorn "80% of
  DEF"), and the **additive-reaction** term (Spread/Aggravate — see [Reactions](#reaction-multipliers)).

## DMG Bonus Multiplier

```
DMG Bonus Multiplier = 1 + Σ( Elemental DMG% + Physical DMG% + attack-class DMG% + … )
```

**All DMG% bonuses are additive _with each other_** inside this single multiplier — Goblet
Elemental DMG%, `allDmgBonus`, per-element, and per-attack-class (Normal/Charged/Plunge/Skill/
Burst) bonuses all pool here. (This is why e.g. Skirk's tiered `+10/+20/+70% normalDmgBonus`
is mathematically `talent × (1 + ΣDmgBonus%)`.)

## CRIT Multiplier

- **On a crit:** `1 + CRIT DMG`.
- **Average (expected):** `1 + CRIT Rate × CRIT DMG`.

critcalc's crit heatmap (`crit-visualizer/lib/crit.ts`) visualises the CR/CD trade-off; it
does **not** fold crit into a damage number.

## Enemy DEF Multiplier

Confirmed identically by the wiki and gcsim (`pkg/enemy/damage.go:78`):

```
DEF Mult = (Char Lvl + 100)
         ────────────────────────────────────────────────────────────────
         (Char Lvl + 100) + (Enemy Lvl + 100) × (1 − DEF Reduction) × (1 − DEF Ignore)
```

- **DEF Reduction** (shred) and **DEF Ignore** are **distinct** and stack **multiplicatively**:
  `(1 − Reduction) × (1 − Ignore)`. E.g. 15% shred + 60% ignore ⇒ `0.85 × 0.40 = 0.34` of the
  enemy's DEF term remains.
- **DEF shred** is an **enemy-side** debuff (any attacker benefits); **DEF ignore** is
  **attacker-side** (only the character with it benefits).
- gcsim writes this as `(1 + defAdj)` with `defAdj` signed (negative = shred) and **capped at
  +0.9** (enemy DEF can't be buffed above +90%) — equivalent to `(1 − Reduction)`.

## Enemy RES Multiplier

Confirmed identically by the wiki and gcsim (`pkg/enemy/damage.go:86-90`):

| Enemy RES      | Multiplier          |
| -------------- | ------------------- |
| RES < 0%       | `1 − RES / 2`       |
| 0% ≤ RES < 75% | `1 − RES`           |
| RES ≥ 75%      | `1 / (1 + 4 × RES)` |

**RES shred** lowers the enemy's RES _before_ this lookup — and can push it **negative**, at
which point only **half** the negative RES converts to bonus damage (the `1 − RES/2` case).

## Reaction multipliers

Reaction damage is **not** one bucket — each family plugs in differently. Full detail lives in
the reaction docs; here is only where each attaches:

- **Amplifying** (Vaporize, Melt) → a **multiplier on the whole bracket** (`1.5` / `2.0` ×,
  scaling `2.78·EM/(1400+EM)`). → [`elemental-reactions.md` §2](elemental-reactions.md).
- **Additive** (Spread, Aggravate) → an **Additive Base DMG** term:
  `Char Lvl × ReactionMult × (1 + 5·EM/(1200+EM) + Reaction Bonus)`, `Spread 1.25` /
  `Aggravate 1.15` (wiki-confirmed here). → [`elemental-reactions.md` §4](elemental-reactions.md).
- **Transformative** (Overload, Swirl, …) → a **separate damage instance** scaling on EM +
  level, unaffected by DEF/ATK. → [`elemental-reactions.md` §3](elemental-reactions.md).
- **Lunar** (LC/LB/LCrys) → their own formula + buckets (incl. elevation). →
  [`lunar-reactions.md`](lunar-reactions.md).

## Which bucket? — the curator's lookup

The practical payoff. Given an effect's game text, this is the bucket and the primitive:

| Game text                                            | Bucket                     | Our primitive                                                        |
| ---------------------------------------------------- | -------------------------- | -------------------------------------------------------------------- |
| "increases \<element/attack-class\> DMG by X%"       | DMG Bonus Multiplier       | `allDmgBonus` / `{element}DmgBonus` / `{class}DmgBonus` stats        |
| "increases Base DMG by X% of ATK/DEF/HP", flat add   | Additive Base DMG          | damage-effect `flat` / a DEF/HP/EM-scaling `buff`                    |
| "DMG is increased" as a **multiplier** on one talent | Base DMG Multiplier        | ⚠️ no dedicated primitive — see schema map                           |
| "ignores X% of enemy DEF"                            | DEF Ignore (attacker-side) | `defIgnore` **Stat**                                                 |
| "decreases enemy DEF by X%"                          | DEF Reduction (enemy-side) | `resShred` effect, `shredStat: 'def'`                                |
| "decreases enemy \<element\> RES by X%"              | RES shred (enemy-side)     | `resShred` effect, `shredStat: 'res'`                                |
| CRIT Rate / CRIT DMG (incl. per-element)             | CRIT Multiplier            | `critRate` / `critDmg` / `{element}CritDmg` stats                    |
| "\<reaction\> DMG is increased/elevated"             | reaction bucket            | see reaction docs (`lunar*DmgBonus`, `elevate`, or an unmodeled gap) |

## → Schema mapping & current state

We **do not compute** the formula (verified: no code computes a DEF/RES/CRIT multiplier — we
visualize, not calculate). The formula's value to us is **bucket identification at authoring
time** and **defining the semantics** our DEF/RES/shred/ignore/crit primitives stand for.

| Bucket                    | Our primitive                                                | State                                                                              |
| ------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| DMG Bonus Multiplier      | `allDmgBonus` / `{element}` / `{attack-class}DmgBonus` stats | ✅ modelled (buff effects)                                                         |
| CRIT                      | `critRate` / `critDmg` / `{element}CritDmg` stats            | ✅ modelled; visualised by the crit heatmap                                        |
| DEF Ignore                | `defIgnore` **Stat** (attacker-side)                         | ✅ modelled                                                                        |
| DEF Reduction             | `resShred` effect `shredStat: 'def'` (enemy-side)            | ✅ modelled                                                                        |
| RES shred                 | `resShred` effect `shredStat: 'res'`                         | ✅ modelled                                                                        |
| Additive Base DMG         | damage-effect `flat`; DEF/HP/EM-scaling `buff`               | ◑ partial — flat adds and scaling buffs exist; not a first-class "base-add" bucket |
| Base DMG Multiplier       | (none dedicated — usually authored as a `*DmgBonus`)         | ⚠️ gap/ambiguity — distinguishing it from the DMG Bonus bucket isn't represented   |
| Amplifying / additive rxn | `reactionCurves.ts` (visualised); additive via reaction docs | ✅ visualised, not computed                                                        |

**Curator rule:** DMG% bonuses (additive together) vs. a Base DMG add (added before the
multipliers) vs. a per-talent Base DMG multiplier are **three different buckets** that read
alike in casual wording — check whether the text says "increases DMG by X%" (bonus), "increases
Base DMG" / a flat/stat-scaled add (additive base), or multiplies one talent (base multiplier).

## Cross-check note

Official wiki (entry 5654) and gcsim agree on every formula here — DEF multiplier, the three
RES cases, and DEF-reduction-vs-ignore multiplicativity. The wiki also carries **large
character / weapon / artifact tables** (per-character Additive Base DMG and Base DMG Multiplier
sources, enemy DEF-shred characters, numerical demos) — **not reproduced here**; look a specific
character's bucket up in the wiki or in gcsim `internal/characters/{id}/`.
