# Worksheet — Enemy DEF & RES

> ✅ **CLOSED + APPLIED 2026-10-06** (the DEF & RES pass, `docs/defres-pass-2026-10-06.md`).
> ⛔ SUPERSEDED — the rulings a translator needs now live in
> `docs/text/ledger/notes/vz_defres.md`, keyed to the generated inventory. Kept for history;
> ⚠️ the instrument is renamed **Enemy RES & DEF** (id `defres`), its two views are STACKED
> charts (the RES/DEF toggle and both panel headings are gone), "Hidden multiplier" and the
> VV note were dropped, the two explanations became one caption per chart, and every
> readout line was rewritten — shred now works at "half / full strength", not in points.

⚠️ **Read `visualizers-instruments-00-conventions.md` first** — §A casing, §C colons,
§F caps-for-emphasis, §I formulas.

**Strings:** 34 · `DefResInstrument.svelte`

---

## Controls

| key                    | Where           | Now                           | New               |
| ---------------------- | --------------- | ----------------------------- | ----------------- |
| `vz.dr.view`           | Section heading | Hidden Multiplier             | Hidden multiplier |
| `vz.dr.view.res`       | Tab             | Enemy RES                     | 🔒                |
| `vz.dr.view.def`       | Tab             | Enemy DEF                     | 🔒                |
| `vz.dr.res`            | Slider label    | Enemy RES                     | 🔒                |
| `vz.dr.res.aria`       | Its field       | Enemy base resistance percent |                   |
| `vz.dr.shred`          | Slider label    | RES Shred                     | RES shred         |
| `vz.dr.shred.aria`     | Its field       | Resistance shred percent      |                   |
| `vz.dr.level`          | Slider label    | Your Level                    | Your level        |
| `vz.dr.level.aria`     | Its field       | Character level               |                   |
| `vz.dr.enemy`          | Slider label    | Enemy Level                   | Enemy level       |
| `vz.dr.enemy.aria`     | Its field       | Enemy level                   |                   |
| `vz.dr.defshred`       | Slider label    | DEF Shred                     | DEF shred         |
| `vz.dr.defshred.aria`  | Its field       | Defense shred percent         |                   |
| `vz.dr.defignore`      | Slider label    | DEF Ignore                    | DEF ignore        |
| `vz.dr.defignore.aria` | Its field       | Defense ignore percent        |                   |

✅ **§A applied** — which also settles the 🐛 below: `RES shred`, `DEF shred`, `DEF ignore`
(the frozen `RES`/`DEF` keep their capitals; `Enemy RES` / `Enemy DEF` stay whole).
🐛 **`RES Shred` here vs `RES shred` in the Team Builder's facets** (`team-builder.md`
§1) — capital S against lowercase, same term. The glossary rules **RES shred**.
⚠️ **The screen-reader names expand the abbreviations** ("Resistance shred percent",
"Defense shred percent") while the labels keep them. ⚓ That is the right split and it is
consistent here — worth noting as the pattern other instruments should follow.
✅ **"Defense" is correct and stays** — ↻ the house style is **US English**
(glossary §4), ruled 2026-09-22, so this row needed no change and the earlier
"Oxford says nothing about this" reasoning is moot.

## The two explanations

| key              | Now                                                                                                                                                                           | New                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vz.dr.res.desc` | Every hit is cut by the enemy's elemental resistance — most enemies resist 10%. Shred subtracts from it, and pushing BELOW zero still helps: each negative point counts half. | Every hit is cut by the enemy's elemental resistance — most enemies resist 10%. Shred subtracts from it, and pushing <strong>below</strong> zero still helps: each negative point counts half. |
| `vz.dr.def.desc` | Your level against the enemy's sets a baseline cut — equal levels already cost you half. DEF shred and DEF ignore claw it back, and they multiply together.                   |                                                                                                                                                                                                |

⚓ **"equal levels already cost you half" is the fact that surprises people**, and leading
with it is right. ⛔ Keep it early in the sentence.
⚠️ **"BELOW" in caps** — §F. ✅ Pre-filled with `<strong>` (a floor, not a rewrite). ⚠️⚠️ Capitals cannot carry emphasis in CJK, so the stress is
simply lost; `<strong>` survives.
⚠️ **"claw it back" is idiom** and will not translate literally.
⚠️ Both are two-clause sentences hung on an em dash (§3.4) — fine, one each.

## Formulas — 🔒 frozen

| key                 | Now                                                            |
| ------------------- | -------------------------------------------------------------- |
| `vz.dr.res.formula` | res < 0: 1−res/2 · 0–75%: 1−res · ≥75%: 1/(4·res+1)            |
| `vz.dr.def.formula` | (100+yours) / ((100+yours) + (100+enemy)·(1−shred)·(1−ignore)) |

⚠️⚠️ **Both embed English words** — `res`, `yours`, `enemy`, `shred`, `ignore` — inside
what is otherwise mathematics. ⛔ A translator must not localize them (the surrounding
prose defines them), so they need an explicit 🔒 marker, not just a "looks like code"
assumption. This is §I's exact case.

## Chart and readout

| key                     | Now                                                                                   | New                  |
| ----------------------- | ------------------------------------------------------------------------------------- | -------------------- |
| `vz.dr.chart.kept`      | damage kept                                                                           |                      |
| `vz.dr.chart.neg`       | negative counts half                                                                  |                      |
| `vz.dr.chart.dim`       | diminishing                                                                           |                      |
| `vz.dr.readout`         | Readout                                                                               | ✅ §E                |
| `vz.dr.readout.through` | of your damage gets through                                                           |                      |
| `vz.dr.readout.final`   | Final RES:                                                                            | Final RES            |
| `vz.dr.readout.worth`   | Your shred is worth                                                                   |                      |
| `vz.dr.readout.here`    | damage here                                                                           |                      |
| `vz.dr.readout.base`    | Without shred/ignore:                                                                 | Without shred/ignore |
| `vz.dr.readout.mods`    | Your modifiers are worth                                                              |                      |
| `vz.dr.caveat`          | Both views are pure multipliers — combine them with everything else your hit carries. |                      |
| `vz.dr.vv`              | The classic 4pc Viridescent Venerer swirl is a 40% shred.                             |                      |

⚠️⚠️ **The readout is built almost entirely from stems** — `×{n}` + "of your damage gets
through", "Your shred is worth" + `+{n}%` + "damage here". ⚓ Four fragments per line, and
the number sits in the middle. This is the hardest-to-translate block in the tool and the
strongest §3.1 case outside Settings' import confirmation.
⚠️ **"4pc Viridescent Venerer" is 🔒 frozen**; "The classic" is a judgment word — mild,
but the constitution is verdict-averse and this is the only place a set is called
_classic_.

---

## Added 2026-09-27 — missed by the first extraction

☐ **Not yet read.** ⚠️ Until this box is ticked, a blank `New:` in this section is **not**
an approval. These rows come from a parser-based re-run; the first pass skipped strings
inside script expressions and some attributes. Keys are left to the extraction pass.

| Where                         | Context                          | Now                                                 | New |
| ----------------------------- | -------------------------------- | --------------------------------------------------- | --- |
| `DefResInstrument.svelte:275` | Panel heading, RES view          | Enemy & Shred                                       |     |
| `DefResInstrument.svelte:275` | Panel heading, DEF view          | Levels & Shred                                      |     |
| `DefResInstrument.svelte:141` | X-axis label, RES view           | Enemy RES after shred                               |     |
| `DefResInstrument.svelte:117` | Chart aria, DEF view             | Enemy DEF multiplier versus enemy level             |     |
| `DefResInstrument.svelte:118` | Chart aria, RES view             | Damage multiplier versus enemy elemental RES        |     |
| `DefResInstrument.svelte:102` | Readout regime line, RES below 0 | below 0% — each negative point only counts half     |     |
| `DefResInstrument.svelte:104` | Readout regime line, RES ≥ 75%   | above 75% — deep diminishing returns                |     |
| `DefResInstrument.svelte:105` | Readout regime line, otherwise   | linear regime — each point of shred is a full point |     |

⚠️ **The two panel headings are Title Case and use `&`** — §A says sentence case; and `&`
is a symbol a locale may not use as a conjunction. "Levels" (plural) on the DEF view
means the character's and the enemy's.
⚠️ **The three regime lines start lowercase** — they read as the second half of a line
whose first half is the number. ASSEMBLED in effect; worth checking the readout they sit in.
⚠️ **"each negative point only counts half"** repeats `vz.dr.res.desc` ("each negative
point counts half") almost word for word.
⚠️ "linear regime" is engineering register — the same objection as "element-agnostic".
