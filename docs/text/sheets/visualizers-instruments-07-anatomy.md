# Worksheet — Damage Anatomy

⚠️ **Read `visualizers-instruments-00-conventions.md` first** — §A casing, §B crit stat
names, §C colons, §F caps-for-emphasis, §I the reaction multiplier table.

**Strings:** 59 · `AnatomyInstrument.svelte` · `anatomy.ts`

---

## The three damage families

| key                          | Where         | Now                                        | New        |
| ---------------------------- | ------------- | ------------------------------------------ | ---------- |
| `vz.an.direct`               | Tab           | Direct Hit                                 | Direct hit |
| `vz.an.additive`             | Tab           | Additive (on Quicken)                      |            |
| `vz.an.transformative`       | Tab           | Transformative                             |            |
| `vz.an.direct.unit`          | Under the bar | vs a bare hit                              |            |
| `vz.an.additive.flat`        | Under the bar | flat, added to the hit                     |            |
| `vz.an.additive.rides`       | Under the bar | the chunk then rides the rest of the hit — |            |
| `vz.an.additive.eff`         | Under the bar | effective, on average                      |            |
| `vz.an.transformative.exact` | Under the bar | damage, exactly                            |            |

✅ **§A applied** (`Direct hit`). `Additive (on Quicken)` and `Transformative` already comply.
⚠️ **"Quicken", "Spread", "Aggravate" are 🔒 frozen** game terms.
⚠️⚠️ **`the chunk then rides the rest of the hit —` ends on a dangling em dash**, because
the next fragment continues it. ⚠️ ASSEMBLED, and the dash is inside the message. ⛔ A
translator cannot know what completes it.
⚠️ **"vs a bare hit" / "damage, exactly" / "effective, on average"** are all suffixes to
a number. Four stems, four ordering assumptions.

## The two explanations

| key                         | Now                                                                                                                                                                         | New |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `vz.an.additive.desc`       | Spread/Aggravate add an exact flat chunk (level + EM only — no talent, no ATK), which then crits and scales like the rest of the hit. These numbers are complete and exact. |     |
| `vz.an.transformative.desc` | Transformative damage is complete from level, EM and enemy RES alone — crit, ATK and DMG% do nothing to it. This is the one family where the exact number is knowable.      |     |

⚓ **Both end by saying how much to trust the number**, which is precisely the right move
for a tool that refuses to print a damage total elsewhere. ⛔ Keep the final sentence of
each.
⚠️ **"Spread/Aggravate" uses a bare slash** — fourth slash convention (see
`team-builder.md` §3, `crit` §Controls).

## Your sheet

| key               | Where           | Now                        | New        |
| ----------------- | --------------- | -------------------------- | ---------- |
| `vz.an.sheet`     | Section heading | Your Sheet                 | Your sheet |
| `vz.an.base`      | Field label     | Base stat                  |            |
| `vz.an.base.hint` | Beside it       | ATK for most characters    |            |
| `vz.an.basescale` | Field label     | Base scaling stat          |            |
| `vz.an.flat`      | Field label     | Flat bonus                 |            |
| `vz.an.flat.aria` | Its field       | Flat stat bonus            |            |
| `vz.an.pct`       | Field label     | Stat%                      |            |
| `vz.an.pct.aria`  | Its field       | Scaling stat percent bonus |            |
| `vz.an.dmg`       | Field label     | DMG Bonus                  | 🔒         |
| `vz.an.dmg.aria`  | Its field       | Damage bonus percent       |            |
| `vz.an.cr`        | Field label     | CRIT Rate                  | ✅ §B      |
| `vz.an.cr.aria`   | Its field       | Crit rate percent          |            |
| `vz.an.cd`        | Field label     | CRIT DMG                   | ✅ §B      |
| `vz.an.cd.aria`   | Its field       | Crit damage percent        |            |
| `vz.an.em`        | Field label     | Elemental Mastery          | 🔒         |
| `vz.an.em.aria`   | Its field       | Elemental mastery          | 🔒         |

✅ **§A / §B applied.** `CRIT Rate` / `CRIT DMG` already match §B; `DMG Bonus`,
`Elemental Mastery` and `Enemy RES` are 🔒 and keep the game's casing.
🐛 **`Elemental Mastery` (label) vs `Elemental mastery` (its own screen-reader name)** —
the same stat, capitalized two ways, two lines apart. The game writes **Elemental
Mastery**.
⚠️ **"Base stat" / "Base scaling stat" / "Stat%"** are ours and are abstract by necessity
(the field takes ATK, HP or DEF depending on the character). ⚓ The hint "ATK for most
characters" is what rescues them. ⛔ Don't drop it.

## Levels and enemy

| key                     | Where                | Now                                                                                        | New            |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------ | -------------- |
| `vz.an.levels`          | Section heading      | Levels & Enemy                                                                             | Levels & enemy |
| `vz.an.yourlevel`       | Field label          | Your Level                                                                                 | Your level     |
| `vz.an.yourlevel.aria`  | Its field            | Character level                                                                            |                |
| `vz.an.enemylevel`      | Field label          | Enemy Level                                                                                | Enemy level    |
| `vz.an.enemylevel.aria` | Its field            | Enemy level                                                                                |                |
| `vz.an.enemyres`        | Field label          | Enemy RES                                                                                  | 🔒             |
| `vz.an.enemyres.aria`   | Its field            | Enemy resistance percent                                                                   |                |
| `vz.an.pointer`         | Note under the block | Deeper enemy anatomy (shred, ignore, RES regimes) lives in the Enemy DEF & RES instrument. |                |

⚠️ **"Levels & Enemy"** — ✅ casing applied; the `&` waits on `team-builder.md` §3. Third ampersand on the site (`settings.md` §3,
`visualizers-workspace.md` §3). Worth one rule.
⚠️ **The pointer names another instrument** (style guide §3.3) — it must move when the
instrument names translate.
⚠️ **"RES regimes"** is engineering register; "regime" here means a range of the curve.

## What the next roll buys

| key                | Now                                                                                                                                                          | New                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vz.an.roll.title` | What The Next Roll Buys                                                                                                                                      | What the next roll buys                                                                                                                                                       |
| `vz.an.roll.gain`  | +{n}%                                                                                                                                                        |                                                                                                                                                                               |
| `vz.an.roll.desc`  | Average 5★ substat rolls, applied to YOUR current sheet — watch a bar deflate as you feed its stat. Fixed order, no verdicts: the bars speak for themselves. | Average 5★ substat rolls, applied to <strong>your</strong> current sheet — watch a bar deflate as you feed its stat. Fixed order, no verdicts: the bars speak for themselves. |

🐛 **"What The Next Roll Buys" capitalizes the article** — nothing else on the site does
(§A).
🐛 **`YOUR` in caps** — ✅ ruled: caps are never emphasis (§2.1). One of three live sites.
✅ **§A and §F applied** to the title and the description. ⚠️ The description fill only
swaps the caps; the reversal below still asks you to cut "no verdicts: the bars speak for
themselves".
↻🐛 **REVERSED.** This used to read: _"'Fixed order, no verdicts: the bars speak for
themselves' is the constitution again. ⛔ Keep it."_ ⛔ **Withdrawn — the clause fails
twice over.** "no verdicts" is the creed (§1.3), and "the bars speak for themselves"
explains to the reader that a chart can be read (§1.3c).
⚓ **"Fixed order" is the part worth keeping** — it is a real, non-obvious fact about the
display. ⚓ And the row's own better sentence is right beside it: _"watch a bar deflate as
you feed its stat"_ tells the reader something they could not have guessed.
⚠️ **`5★`** — §H. ✅ Already compliant.

## The reaction multiplier table — 🔒 frozen

**No Reaction · Vaporize ×2 · Vaporize ×1.5 · Melt ×2 · Melt ×1.5 · Spread ×1.25 ·
Aggravate ×1.15 · Hyperbloom ×3 · Burgeon ×3 · Shatter ×3 · Overload ×2.75 ·
Electro-Charged ×2 · Bloom ×2 · Superconduct ×1.5 · Swirl ×0.6 · Burning ×0.25**
— `anatomy.ts:52–71`

⚠️ **Sixteen entries, each a frozen reaction name plus a frozen multiplier** — but
**"No Reaction"** is ours and translates. ✅ §A makes it **`No reaction`**
(`anatomy.ts:52`), the only row in the table that changes. ⚓ It is the only row in the list that is not a
game term, and it will be the one a bulk translation pass gets wrong in both directions.
⚠️ The stat labels beside them (`Stat%`, `Flat stat`, `CRIT Rate`, `CRIT DMG`, `EM`,
`DMG Bonus` — `anatomy.ts:152–175`) are the bar names. ⚠️ **They disagree with the field
labels above** (`Stat%` matches, but the fields say `Elemental Mastery` where the bar says
`EM`). ⚓ Two names for one stat inside one instrument — defensible for space, worth a
deliberate look.
