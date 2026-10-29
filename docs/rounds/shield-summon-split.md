# 🛡️ Shields left `summons[]` — 2026-08-14

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Four rounds that started as one stray ("Ineffa's Birgitta is missing tick marks") and ended with `summons[]` meaning only what its name says. Commits `c430c19` · `7d5aabc` · `82d4882` · `5e0c840` · `54cc90b` · `3e8d26c` on `main`.

## ⚓ The rule that came out of it

**`summons[]` = a thing left in the WORLD.** Oz, Guoba, Bennett's field, Birgitta. A shield is a state on the CHARACTER and is authored as `Effect.type: 'shield'`.

Nine abilities used to author a shield as a zero-effect summon, and ⚓ Nate asked the right question about it: _"is it true that they were authored before we came up with the ultimate shape?"_ No — **`summons[]` was doing two unrelated jobs**, and the shields were only in it for the second:

1. naming/drawing a thing on the field, and
2. being the ONLY way to give an instant cast an active window, because `getActiveDuration` returns 0 for `behavior: 'instant'` unless `summons[0]` exists.

## ⚠️ THE TRAP: `activeDuration`, never `duration`

The obvious fix — teach `getActiveDuration` to read `duration` on instant abilities — is **wrong and would have shipped silently.** ⚠️ **Twelve instant abilities already carry a stray, undeclared `duration` that no accessor reads** (Kachina's burst, Kaveh's, Zhongli's Planet Befall, Charlotte, Chongyun, Emilie, Prune, Yun Jin's burst…). Reading it would have grown twelve active bars nobody authored. **Sweep before reusing a field name.**

- `activeDuration?: number` on the `instant` variants of SkillAbility/BurstAbility **and** on `AbilityVariant`.
- ⚠️ In `resolveActiveDuration` the variant rung sits **ABOVE the base ability's `summons[0]`** — Zhongli's hold-E is a 20s shield off a base whose Stone Stele runs 30s, and without that order the hold draws 30s.

## ⚓ `ShieldEffect.label` — and ⛔ don't invent one

The shield's in-game name, rendered as the lane row label. Before it, the name lived on the stand-in summon, so nine shields were named and six read "Shield".

⛔ **Never invent a name.** Xinyan, Diona, Candace and Lan Yan keep the generic fallback because their kit text says only "a shield". ⚠️ **gcsim's `"Icy Paws (Shield)"` strings are its own internal convention, NOT in-game names** — Baizhu's _Seamless Shield_, Dahlia's _Shield of Sacred Favor_ and Nicole's _Shield of Blazing Light_ came from the abilities' own description text (genshin-db, i.e. the game's wording).

## Other durable rules from the round

- ⚠️ **A variant's `effects` REPLACE the base ability's** (like `summons` already did) — so a variant restating one effect DROPS THE REST. The parser never read them at all until `7d5aabc`; five characters' hold-E rendered as their tap (Diona 12s→4.8s, Candace, Shenhe, Eula, Zhongli).
- ⚠️ **An empty `summons: []` on a variant means NONE**, not "fall through to the base". The old `?.[0] ?? ability.summons?.[0]` chain couldn't express it.
- ⚠️ **Both summon resolvers must stay identical** — `findSummonsForBar` (parser) authors the windows `findCastSummons` (summonSubrows) assigns to lanes; a disagreement drops a window in no lane, silently.
- ⚠️ **Lane rows sort skill-before-burst**, so a row sits beside the cast that raised it. Shields ride the summon lane, so they must join that sort, not be appended after it.
- The summon-derived shield fallback is now **dormant corpus-wide** (0 windows) and guarded on "the ability authors no shield Effect at all" — Thoma's burst was inferring an 8s shield from his 15s _field_.

## 🐛 The blind spot worth remembering

**`timelineExport.mirror.test.ts` asserts COLOUR TOKENS ONLY.** It says nothing about which ink a label picks, what weight it draws at, its size or its position. Two drifts sat unnoticed for three days (dark ink under the retired bright-chip idiom; weight 700 vs the screen's 500) and were found by eye while wiring something else.

⚠️ **So every non-colour divergence between screen and PNG export is found by eye or not at all.** That is why the export needs its own pass — `docs/rounds/launch-roadmap.md` §15.

Related: `docs/rounds/p4-event-stream-plan.md` · `docs/rounds/data-schema-reference-2026-04.md` · `docs/rounds/rp-scene-round.md`
