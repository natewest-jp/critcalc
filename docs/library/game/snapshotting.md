# Snapshot vs Dynamic

**Sources:** KQM — <https://library.keqingmains.com/combat-mechanics/snapshot-and-dynamic>
(fetched 2026-07-14).
**Game version reflected:** 6.x (rule set stable since ~1.4; the per-talent list grows).
**See also:** [`energy-and-particles.md`](energy-and-particles.md), [`icd.md`](icd.md),
[`elemental-reactions.md`](elemental-reactions.md) (transformative reactions stay dynamic).

> KQM is the strongest player-side authority but not ground truth (see the library
> [README](../README.md)). gcsim is a second source and models snapshotting explicitly
> (an attack captures a stat snapshot at initialisation). Reconcile divergences
> deliberately; `⚠️ NEEDS-CONFIRM` marks anything unsettled.

## What snapshotting is

> "Talents that snapshot use the character's stats when cast, and will continue to use
> those stats regardless of buffs gained or lost in that timeframe after it is cast." — KQM

- **Snapshot** — the ability captures the character's stats/buffs **at cast** (a specific
  frame) and uses those frozen values for its whole duration, ignoring later changes.
- **Dynamic** — the ability recalculates from **current** stats on every hit/tick.

The distinction matters most for **DoTs and summons** (Pyronado, Oz, Venti's burst), whose
damage plays out over a window during which buffs come and go.

## What snapshots (frozen at cast)

- Core stats: **ATK, DEF, HP, EM, CRIT Rate/DMG, Elemental DMG Bonus**.
- Most stat-scaling buffs: **Bennett** Burst ATK, **Kazuha** A4 EM→DMG, **Shenhe** A4.
- **Elemental infusion** snapshots.
- Rule of thumb: _"stats that are not in a character's 'Details' page do not snapshot."_
  "Increases All DMG" effects snapshot — **except** Alley Hunter, Fading Twilight, and Geo
  Resonance.

## What never snapshots (always dynamic)

- **Enemy DEF and RES**, and **DEF/RES shred** — always recomputed.
- **Amplifying reaction multipliers** (Vaporize / Melt).
- **Transformative reaction damage** (Overload, Swirl, Superconduct, Crystallize…) — and
  their **EM** does not snapshot (since patch 1.4): _"Even if a Skill snapshots, their EM
  will update real time."_
- **"Direct" buffs** bypass snapshotting and apply post-cast to already-snapshotted
  abilities: **Raiden** Skill's Burst-DMG bonus, **Shenhe** Skill's Cryo bonus, 4-pc
  **Blizzard Strayer** CRIT Rate.

## Ability categories (examples)

| Category                 | Examples                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Snapshotting talents** | Xiangling **Pyronado**, Fischl **Oz**, Ganyu ice shards, Venti Burst DoT, Mona Skill DoT                           |
| **Dynamic talents**      | Xingqiu **Rain Swords**, Fischl Burst (Falling Thunder), Hu Tao Blood Blossom, Raiden Burst, Eula Lightfall stacks |
| **Static buffs**         | Bennett Burst ATK, Kazuha A4, Shenhe A4 (snapshot at cast)                                                         |
| **Dynamic buffs**        | Shenhe Skill Cryo bonus, Yun Jin Burst Normal-atk bonus (update live)                                              |
| **Direct buffs**         | Raiden Skill, Shenhe Skill, 4-pc Blizzard Strayer (bypass snapshot, apply after)                                   |

## The canonical example

> Fischl summons **Oz outside** Bennett's Burst — Oz deals 920 Electro, 1870 on Overload.
> Sucrose shares EM with Fischl, and Fischl steps **into** Bennett's Burst. Oz **still deals
> 920** (its ATK snapshotted, frozen), but **Overload rises to ~1900** — transformative
> reaction damage is dynamic and takes the live EM. — KQM

One picture holds both rules: **Oz's own hit snapshots; the reaction it triggers does not.**

## → Schema mapping & current state

Unlike energy, snapshotting **is represented in our data** — because it's about _buffs and
windows_, which is exactly what the planner draws.

- **`snapshottable: boolean`** — **required** on `buff` and `elevate` effects (`ability.ts`),
  **lint-enforced** (`characterLint.ts` flags `elevate-snapshottable-missing`) and
  normalised through `effectCollection.ts`. It records KQM's static-vs-dynamic classification
  per buff: `true` = freezes at cast (static, e.g. Bennett Q), `false` = updates live
  (dynamic, e.g. Shenhe Skill). **~102 characters author it.**
  - ⚠️ **UI-latent:** the field is populated and enforced across the roster, but **no
    renderer currently branches on it** — the planner doesn't yet visually distinguish a
    static buff bar from a dynamic one. It's a data-complete, ready-to-surface primitive (a
    future "this buff snapshots" indicator), not an orphan.
- **`snapshots?: boolean`** on Skill / Burst (`ability.ts`) — marks whether the _ability's
  own damage_ snapshots (KQM's "snapshotting talents" category). ⚠️ **Near-orphan:**
  authored on only **2 characters** and read by **no code** — because the tools model buff
  windows, not damage, so an ability-damage snapshot flag has nothing to consume it. Same
  pattern as [`noICD`](../gotchas/README.md) / `factionBonuses`. **Decision (2026-07-14,
  Nate): keep + document now, and wire it later** when a damage-aware feature can consume
  it — a tracked forward-looking annotation, not a silent orphan (JSDoc'd on the field).
- **Inherently out of scope:** enemy DEF/RES, shred, and reaction multipliers are always
  dynamic — but since we don't compute damage, their dynamic-ness needs no modeling here.

(The `TriggerFilterContext.isCrit` "fire optimistically" note in `ability.ts` mentions
"skill/burst snapshots" only as the heuristic for defaulting crit filters — unrelated to
the stat-snapshot model above.)

## Curator signal

- Team buff that **freezes at cast** (Bennett Q, Kazuha A4, Shenhe A4) → `snapshottable: true`.
- Team buff that **updates live** (Shenhe Skill Cryo, Yun Jin) → `snapshottable: false`.
- Unsure → check KQM's snapshot list or gcsim's per-attack snapshot behaviour; don't guess.
