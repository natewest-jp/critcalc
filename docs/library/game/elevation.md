# Elevation ("elevated" damage)

**Sources:** KQM lunar-reactions (fetched 2026-07-14) + Nate (playtest/patch
knowledge, 2026-07-14) + our own `elevate` Effect JSDoc.
**Game version reflected:** 6.x, forward-looking to 7.x (Stellar).
**See also:** [`lunar-reactions.md`](lunar-reactions.md), [`stellar-reactions.md`](stellar-reactions.md).

## What elevation is

Elevation is a **separate multiplicative bucket** in the reaction damage formula —
applied **after** the additive DMG-bonus bucket. That placement is the whole point:
a multiplicative bucket does **not dilute** as other (additive) bonuses grow, so
theorycrafters call it out specifically as a _strictly more potent_ tier than an
ordinary DMG bonus of the same %.

In game text it is **always worded "elevated by X%"** — never "DMG Bonus." That
wording is the reliable curator signal: if a talent says _elevated_, it's this
bucket; if it says _DMG Bonus_, it's the additive bucket.

Formula position (see [`lunar-reactions.md`](lunar-reactions.md) for the full chain):

```
… (1 + EM Bonus + Reaction Bonus) × (1 + Base DMG Bonus) × (1 + Elevation) …
```

Elevation is the **outermost** of these multipliers; the Reaction Bonus sits _additively
with EM_ (not a separate multiplier). See [`lunar-reactions.md`](lunar-reactions.md) for the
full, gcsim-verified chain.

gcsim models it as `atk.Info.Elevation += value/100`, applied as
`damage *= (1 + elevation)`.

## Where elevation appears (scope)

- Introduced with the **Nod-Krai / Moonsign** generation, tied to **Lunar reactions**.
- Only **select talents of some limited (5-star) Moonsign characters** have it — in
  practice, **higher-constellation** effects (C1/C2/C6) that empower Lunar-reaction damage.
- As of 6.x there is **no elevation for regular (non-Lunar) damage types.**
- **7.x expectation** (Nate): the new **Stellar** reaction generation (Stellar-Conduct
  first, Stellar Swirl and others to follow) will work like Lunar — some limited 5-stars
  will carry elevation at higher constellations. So elevation appears to be a lever the
  devs use to make **new-reaction-generation** units stronger.
- **⚠️ Could change:** the devs _could_ extend elevation to a regular damage type later.
  Nate will flag it if so; until then, treat elevation as **reaction-scoped** (Lunar,
  soon Stellar).

## The three reaction-DMG mechanics — don't conflate them

This is the distinction that kept biting curation. For a reaction, three separate
things can raise its damage, in three different buckets. The bucket numbers are the
five of [`lunar-reactions.md`](lunar-reactions.md) § The buckets (1 is Base / Level, 2 the
EM Bonus), which the Stellar doc and the corpus's curator notes cite too:

| Bucket | Mechanic                    | Kind                                       | Game wording                                                    | Our primitive                                             |
| ------ | --------------------------- | ------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------- |
| 3      | **Reaction Base DMG Bonus** | its own `(1 + Base DMG Bonus)` multiplier  | "…Lunar Reaction DMG **Bonus**…" / "…DMG increased by…"         | `lunar*DmgBonus` **Stat** (a `buff` effect)               |
| 4      | **Elevation**               | multiplicative, outermost                  | "…**elevated** by X%…"                                          | `elevate` **Effect**                                      |
| 5      | **Reaction Bonus**          | additive, inside the EM bracket (bucket 2) | "…Lunar Reaction DMG will **increase**…" (e.g. Columbina Burst) | `lunar*ReactionBonus` **Stat** (gcsim `AddReactBonusMod`) |

gcsim's order, in `CalcSpecialReactionDmg` (`pkg/core/combat/reaction.go`):
`(M × (1 + 6·EM/(2000+EM) + reactBonus) × BaseDmg(lvl) × (1 + BaseDmgBonus) + FlatDmg) × (1 + Elevation)`.

Rules of thumb for curators:

- Talent says **"elevated"** → author an **`elevate`** effect (`reactions: […]`, `value`).
- Talent says the reaction's **"DMG Bonus"** / **"DMG is increased"** → author a **buff** on
  the matching `lunar*DmgBonus` **Stat**.
- A character granting a **Reaction Bonus** (bucket 5) → author a **buff** on the matching
  `lunar*ReactionBonus` **Stat** (its own family since Nate's 2026-07-29 ruling).
  **Columbina resolved (2026-07-14, gcsim + wiki):** her **benediction** is a
  **Base DMG Bonus** (bucket 3, HP-scaled); her **C2** is **`+40% Max HP`** (a stat that
  feeds bucket 3); her **Burst** is the **Reaction Bonus** (bucket 5, gcsim `AddReactBonusMod`,
  ~13–31% by talent). Three effects, three buckets — full callout in
  [`lunar-reactions.md`](lunar-reactions.md).

## → Schema mapping & current state

**Primitive:** `elevate` Effect —
`{ type: 'elevate', source, reactions: Reaction[], value: BuffValue, snapshottable, … }`.
This is the **correct** shape and the schema was right to keep it distinct from the
`lunar*DmgBonus` stats (different bucket). What's incomplete is everything _around_ it:

| Area                                    | Current state                                                                                                                                                     | Needed                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Render (single lunar reaction)          | ✅ converted to synthetic `lunar*DmgBonus` buff (`effectCollection.normalizeBuffLikeEffect`)                                                                      | Relabel so it reads **"elevated"**, not the additive-bonus label (the `docs/rounds/elevate-visualization.md` memory's point) |
| Render (multi-reaction)                 | ✅ a whole family maps to its umbrella stat (`familyElevationStat`: all three Lunar → `lunarDmgBonus`, both Stellar → `stellarGlimmerDmgBonus`), since 2026-08-31 | A partial set (two of three Lunar) still returns `null`; no character authors one                                            |
| Render (non-lunar reaction)             | ✅ `elevateReactionToDisplayStat` maps the Stellar pair too (`stellarConduct`, `stellarSwirl`)                                                                    | none                                                                                                                         |
| Capabilities (Team Builder)             | ❌ `elevate` skipped as "kit mechanic"                                                                                                                            | Consider surfacing "elevates \<reaction\> DMG" as a capability facet                                                         |
| Per-cast elevation (Zibai Spirit Steed) | ❌ flagged as "may not fit `reactions[]`"                                                                                                                         | Model per-cast/event-driven elevation — may need a trigger-based variant                                                     |
| `Reaction` union                        | has lunar variants; **missing `stellarConduct`**                                                                                                                  | Add Stellar reactions when they ship                                                                                         |

**Authoring caveat wording:** because elevation is multiplicative and reaction-scoped,
its `caveat` should say something like _"elevates \<reaction\> DMG by X% (a multiplier,
stronger than a flat DMG bonus)"_ so players understand the distinction — matching the
in-game "elevated" language.

## Open decisions (for the reaction/elevation work, once Nate is ready)

1. ~~**Columbina bucket** — is her benediction's "+40%" bucket 3 or bucket 5?~~
   ✅ **RESOLVED (2026-07-14, gcsim + wiki):** benediction = **bucket 3** (Base DMG Bonus,
   HP-scaled); C2 = **`+40% Max HP`** (a stat feeding bucket 3); Burst = **bucket 5** (Reaction
   Bonus, `AddReactBonusMod`). See [`lunar-reactions.md`](lunar-reactions.md).
2. **Elevate render** — relabel "elevated" + handle multi-reaction; is a distinct visual
   treatment wanted, or label-only? (`docs/rounds/elevate-visualization.md` says label is enough)
3. **Non-lunar / Stellar** — extend `Reaction` + the display mapping when Stellar-Conduct ships.
4. ~~**Direct vs Reaction elevation** — does elevation apply to Direct damage too?~~
   ✅ **RESOLVED (Nate, 2026-07-14): YES** — elevation of Lunar damage applies to
   Direct Lunar damage of all types. (KQM's printed Direct formula omits the term;
   we include it — a KQM-vs-us reconciliation, see [`lunar-reactions.md`](lunar-reactions.md).)
