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
… × [Lunar Reaction Base DMG Bonus (ADDITIVE)] × [Elevation (MULTIPLICATIVE)] × [Reaction Bonus] …
```

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
things can raise its damage, in three different buckets:

| #   | Mechanic                    | Bucket                                         | Game wording                                            | Our primitive                               |
| --- | --------------------------- | ---------------------------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| 1   | **Reaction Base DMG Bonus** | additive                                       | "…Lunar Reaction DMG **Bonus**…" / "…DMG increased by…" | `lunar*DmgBonus` **Stat** (a `buff` effect) |
| 2   | **Elevation**               | multiplicative                                 | "…**elevated** by X%…"                                  | `elevate` **Effect**                        |
| 3   | **Reaction Bonus**          | multiplicative (classic reaction-bonus bucket) | (usually from EM/artifacts, not char text)              | — **gap** —                                 |

Rules of thumb for curators:

- Talent says **"elevated"** → author an **`elevate`** effect (`reactions: […]`, `value`).
- Talent says the reaction's **"DMG Bonus"** / **"DMG is increased"** → author a **buff** on
  the matching `lunar*DmgBonus` **Stat**.
- A character granting a **general reaction-multiplier** (bucket 3) has **no clean
  primitive** yet — flag it. gcsim treats Columbina's "+40% Lunar Reaction DMG Bonus"
  as `AddReactBonusMod` (bucket 3), while KQM's "Lunar Reaction Base DMG Bonus" is
  bucket 1 — **⚠️ NEEDS-CONFIRM which bucket Columbina's benediction actually is.** This
  is the specific open question to settle before re-authoring Columbina.

## → Schema mapping & current state

**Primitive:** `elevate` Effect —
`{ type: 'elevate', source, reactions: Reaction[], value: BuffValue, snapshottable, … }`.
This is the **correct** shape and the schema was right to keep it distinct from the
`lunar*DmgBonus` stats (different bucket). What's incomplete is everything _around_ it:

| Area                                    | Current state                                                                                | Needed                                                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Render (single lunar reaction)          | ✅ converted to synthetic `lunar*DmgBonus` buff (`effectCollection.normalizeBuffLikeEffect`) | Relabel so it reads **"elevated"**, not the additive-bonus label (the `project_elevate_visualization` memory's point) |
| Render (multi-reaction)                 | ❌ returns `null`, unrendered (Columbina "all lunar")                                        | Decide: one row labelled by the reaction set, or one row per reaction                                                 |
| Render (non-lunar reaction)             | ❌ `elevateReactionToDisplayStat` only maps the 3 lunar reactions                            | Extend when Stellar lands (Stellar-Conduct, …)                                                                        |
| Capabilities (Team Builder)             | ❌ `elevate` skipped as "kit mechanic"                                                       | Consider surfacing "elevates \<reaction\> DMG" as a capability facet                                                  |
| Per-cast elevation (Zibai Spirit Steed) | ❌ flagged as "may not fit `reactions[]`"                                                    | Model per-cast/event-driven elevation — may need a trigger-based variant                                              |
| `Reaction` union                        | has lunar variants; **missing `stellarConduct`**                                             | Add Stellar reactions when they ship                                                                                  |

**Authoring caveat wording:** because elevation is multiplicative and reaction-scoped,
its `caveat` should say something like _"elevates \<reaction\> DMG by X% (a multiplier,
stronger than a flat DMG bonus)"_ so players understand the distinction — matching the
in-game "elevated" language.

## Open decisions (for the reaction/elevation work, once Nate is ready)

1. **Columbina bucket** — is her benediction's "+40%" bucket 1 (additive stat) or bucket 3
   (reaction-multiplier)? Settle vs gcsim `AddReactBonusMod`. (`⚠️ NEEDS-CONFIRM`)
2. **Elevate render** — relabel "elevated" + handle multi-reaction; is a distinct visual
   treatment wanted, or label-only? (memory `project_elevate_visualization` says label is enough)
3. **Non-lunar / Stellar** — extend `Reaction` + the display mapping when Stellar-Conduct ships.
4. **Direct vs Reaction elevation** — does elevation apply to Direct damage too? (`⚠️ NEEDS-CONFIRM`)
