# Schema model mismatch cleanup (2026-05-09)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

This is the cluster surfaced during the F1 retrospective (2026-05-09): the genshin-db generator emitted skeletons that aren't just "missing a trigger" but actually **wrong-shape** for what the effect is supposed to be in-game. Often `type: "damage"` was written for what should be a heal or a shield, or `stat: "hp%" value: 50` was a misread of the in-game text's "<50% HP" enemy condition as a buff magnitude.

Curator notes already document the right shape per effect; this work is purely applying those corrections. No primitives need to ship first — it can run any time, in parallel with F2A or G work.

## What shipped 2026-05-09

Three commits (`bb8dd0b`, `fa057ab`, `16718ed`), all type/shape rewrites — triggers left as `manual` per editorial scope.

**Batch 1 — deletions (5 effects, 4 chars):**

- Yanfei C2 effect 2 (hp% 50 — HP-threshold misread)
- Sangonomiya Kokomi C6 effect 2 (hp% 80 — HP-threshold misread)
- Yaoyao C4 effects 2 + 3 (hp% 0.3 scaling-coefficient artifact, em 120 cap-as-flat-buff)
- Clorinde Hunter's Vigil — both effects (BoL-grant artifacts; no stance-active self-buff exists)

**Batch 2 — damage→shield/heal (5 chars):**

- Kaeya C4 (damage hp 30 enemy → shield self hp 30 dur:20)
- Sigewinne C2 (damage hp 30 hydro enemy → shield self hp 30)
- Wriothesley A4 (damage hp 30 enemy → heal self hp 30)
- Noelle A4 Devotion (damage def 400 enemy → shield active def 400 dur:20)
- Kaveh A1 (damage em 300 enemy → heal self em 300)

**Batch 3 — buff value/stat corrections (2 chars, 3 effects):**

- Mona C6 (effect 1 atk% → allDmgBonus; deleted effect 2 cap-as-flat-buff)
- Layla A4 (damage hp 1.5 enemy → buff self burstFlatDmg scaling hp 1.5)
- Layla C4 (damage hp 5 enemy → two team buffs: normalFlatDmg + chargeFlatDmg, scaling hp 5, dur 3s)

## Deferred (skip-in-this-pass per doc — primitive missing)

These needed primitives that don't exist yet, so curator notes were left as-is to be picked up when the matching primitive lands:

- **`targetHpBelow: N` condition primitive** — Eula A4, Kamisato Ayato C1, Sangonomiya C2 (each maps the in-game `<N% HP` enemy condition the generator misread)
- **DEF→ATK conversion stat primitive** — Noelle C6 Must Be Spotless, Xinyan C6 Rockin' in a Flaming World
- **Capped-scaling BuffValue form** — Sigewinne C6 (4 effects: CR scaling-on-HP, CD scaling-on-HP, plus their cap effects), Nahida Awakening Elucidated (per-EM-above-200 DmgP/CR scaling with caps), Nahida Compassion Illuminated (capped-scaling EM with target-active routing)
- **BoL-aware buff** — Clorinde Lawful Remuneration (sign error -10 → +10 plus BoL gating; defer per BoL-out-of-scope curation rule)
- **Periodic-heal HoT primitive** — Dehya Stalwart and True (20% MaxHP burst already-shaped; the per-2s 6% HoT for 10s isn't expressible)
- **Per-burst-hit periodic primitive** — Dehya An Oath Abiding (per-burst-hit 2.5% heal + 1.5 energy on 0.2s ICD; only single-shot was authored)

## Why it's its own pass

These corrections were skipped during F1 because F1 was scoped to trigger migrations only, and shipping a wrong-typed effect with a correct trigger doesn't help the user (it would render incorrectly). Lumping these into F2A would mix two editorial concerns (filter additions vs. shape rewrites). Doing them in a focused session gives each effect proper attention.

## The list (read curator notes for full context)

| Char / Effect                                        | Wrong shape                                               | Correct shape                                                                                                     | Notes                                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **clorinde Hunter's Vigil**                          | `buff hp% 100` + `damage hp 100`                          | Both deletable — BoL-grant artifacts                                                                              | Keep stance frames; drop the BoL-conditional skeletons per recipe                                                              |
| **clorinde Lawful Remuneration**                     | `buff critRate -10`                                       | `buff critRate +10` (sign flip), but BoL-gated → leave deferred                                                   | Sign error from generator; the larger BoL gate is out of scope per curation plan                                               |
| **eula Obstinacy of One's Inferiors**                | `buff hp% 50`                                             | `buff allDmgBonus 25` w/ enemy-HP-below-50 condition                                                              | Generator misread the 50% HP threshold as the buff value                                                                       |
| **kaeya Frozen Kiss (C4)**                           | `damage hp 30`                                            | `shield self hp 30`                                                                                               | C4 is a 30% MaxHP self shield, not damage; HP-below-20 gating remains a separate gap                                           |
| **kamisato_ayato Kyouka Fuushi (C1)**                | `buff hp% 50`                                             | `buff normalDmgBonus 40` w/ target-HP-≤50 condition                                                               | Misread of HP threshold as buff value; correct value is 40, correct stat is "+40% Shunsuiken DMG against ≤50% HP enemies"      |
| **kaveh A1 Architect's Undertaking**                 | `damage em 300`                                           | `heal self em 300` w/ onPlayerHit + Bloom/Hyper/Burgeon AttackTag                                                 | Generator typed it as enemy damage; in-game it's a self heal on reaction-take                                                  |
| **layla A4 Sweet Slumber Undisturbed**               | `damage hp 1.5`                                           | `buff` adding FlatDmg to summon ticks                                                                             | The 1.5% MaxHP is a Shooting-Star-DMG add-on, not a separate damage event                                                      |
| **layla C4 Starry Illumination**                     | `damage hp 5` target:enemy                                | `buff` granting team self N/CA FlatDmg                                                                            | Generator misclassified the team-N/CA-FlatDmg-add as enemy damage                                                              |
| **mona C6 Rhetorics of Calamitas**                   | first effect `atk% 60`                                    | `allDmgBonus 60` (gcsim uses DmgP)                                                                                | First effect's stat is wrong; second effect (allDmgBonus 180) is the cap which should be authored as a cap, not parallel value |
| **nahida Awakening Elucidated**                      | `buff critRate 0.03` + `buff em 200` + `buff critRate 24` | Single capped scaling-from-EM                                                                                     | Generator emitted three effects to model what should be one capped-scaling buff                                                |
| **nahida Compassion Illuminated**                    | `buff em` target:team + `buff em 250` self cap            | Single scaling buff target:active w/ cap                                                                          | Generator's target was wrong AND it materialized the cap as a separate effect                                                  |
| **noelle Devotion (A4)**                             | `damage def 400`                                          | `shield active def 400` w/ HP<30% trigger                                                                         | C2 mistype + Noelle-off-field condition                                                                                        |
| **noelle To Be Cleaned (skill)**                     | `damage atk 400 geo`                                      | Damage type stays, but trigger is `onShieldExpire` / `onShieldDestroyed` (custom event, deferred to F2 follow-up) | The damage shape is right; the trigger is the gap                                                                              |
| **noelle Must Be Spotless (C6)**                     | `buff def%`                                               | Need a "DEF→ATK conversion" form (stat: ATK, scaling: DEF×0.5)                                                    | Generator stat field 'def%' is wrong — the effect grants ATK from DEF, not a DEF% buff                                         |
| **sangonomiya The Clouds Like Waves Rippling (C2)**  | `buff hp% 50`                                             | Healing Bonus buff conditional on HP ≤50%                                                                         | The 50 is the HP threshold; correct effect is +Healing Bonus                                                                   |
| **sangonomiya Sango Isshin (C6) effect 2**           | `buff hp% 80`                                             | Delete (or model as condition) — 80 is HP threshold                                                               | First effect (`hydroDmgBonus 40`) is correct; second is a misread of "characters at ≥80% HP"                                   |
| **sigewinne C2 Bubbly Shield**                       | `damage hp 30`                                            | `shield self hp 30` w/ 250% Hydro absorption                                                                      | Generator typed shield as damage                                                                                               |
| **sigewinne C6**                                     | 4 effects mixing scaling + cap as parallel entries        | Single capped-scaling buff per stat (CR, CD)                                                                      | Generator encoded the cap as a separate effect with no duration                                                                |
| **wriothesley There Shall Be a Plea for Justice**    | `damage hp 30`                                            | `heal self hp 30` w/ onHit chargeAttack + HP<60 gate                                                              | Misclassified heal as enemy damage                                                                                             |
| **xinyan Rockin' in a Flaming World (C6)**           | `buff def%`                                               | DEF→ATK conversion (same shape as Noelle C6)                                                                      | Same generator pattern as Noelle                                                                                               |
| **yanfei Right of Final Interpretation effect 2**    | `buff hp% 50`                                             | Delete                                                                                                            | Misread of "<50% HP enemy" condition as a self HP buff                                                                         |
| **yaoyao Winsome effect 2**                          | `buff hp% 0.3`                                            | Delete (it's the scaling coefficient, not a buff)                                                                 | Generator emitted three effects for what should be one scaling EM buff                                                         |
| **dehya Stalwart and True / Oath Abiding**           | `heal hp 20` / `heal hp 2.5`                              | The shapes are roughly right; per-tick HoT cadence and HP-trigger conditions are the actual gaps                  | These are partial — the gaps are mechanism-deep, not just shape                                                                |
| **rosaria A4 Shadow Samaritan duplicate self entry** | _already cleaned up in F1 batch 2 (ad37156)_              | n/a                                                                                                               | Done                                                                                                                           |

## Editorial conventions during cleanup

For each entry:

1. Read the curator note in full — sometimes the right fix is "delete the entire effect" (Yanfei R2, Yaoyao Winsome R2), not "rewrite to a new type."
2. If the rewrite needs a primitive that doesn't exist (e.g., DEF→ATK conversion stat for Noelle/Xinyan), document it as a flagged Phase-2 entry and skip in this pass.
3. Update curator notes to reflect the change ("Migrated 2026-MM-DD (model-mismatch cleanup)..." pattern).
4. Run lint + check after each batch.
5. Commit per ~5-7 chars with a message like `fix(curation): correct generator-stub effect types (5 chars)`.

## What's NOT in this cleanup

- Trigger migrations from `manual` to canonical types — that's F1/F2.
- Adding `damageTag` overrides — that's part of G migrations.
- Adding new primitives (DEF→ATK conversion, custom event triggers) — separate from this pass.
- Filling in `value` fields for scaling buffs that lost them per recipe — that's a separate "scaling-buff completion" pass that depends on the schema settling on caster-relative caps and scaling expressions.

## Estimated scope

~15-20 effects across ~12 characters. One focused session, single commit per ~5 chars. Lint will catch any shape errors as we go (e.g., wrong stat key for a buff effect, wrong target for a shield).
