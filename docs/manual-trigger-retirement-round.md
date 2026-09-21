# The `manual` retirement — steps 2 and 3 (2026-09-21)

_The plan is `docs/manual-trigger-retirement.md`; step 1 shipped 2026-09-15. This
file is the RECORD of steps 2–3 and wins over the plan wherever they differ._

## 1. The census, re-taken

The plan's headline was 167 effects / 69 characters, and its 2026-09-18 footnote
said 130 / 63. Both were stale: the T0–T1.5 tranches, the stack-threshold round,
the cast-binding round and the state-gates round each re-triggered effects out of
the pile without updating the count.

Measured on `main` at `2c7190ad`: **127 effects across 62 characters.**

| effect type | count | what it reaches today |
| ----------- | ----: | --------------------- |
| `buff`      |    58 | nothing               |
| `damage`    |    45 | nothing               |
| `heal`      |    15 | nothing               |
| `energy`    |     8 | nothing               |
| `shield`    |     1 | nothing               |

Hosts: 91 constellation, 35 passive, 1 factionBonus.

⚠️ The first census I wrote missed one — `factionBonuses[]` is a fourth effect
host beside abilities/passives/constellations, and Razor's Secret Rite lives
there. A walker that only knows the three is wrong by one and says nothing.

## 2. What a verdict actually costs — the surface table

Every decision below rests on this. It was measured, not assumed.

| effect type                      | planner                           | Team Builder                                                                                            |
| -------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `buff` on a dispatched trigger   | a BAR                             | capability; family chip only when `target` ≠ `self`; the stat name shows in the detail card and Compare |
| `buff` on `passive`              | the always-on CHIP, value printed | same                                                                                                    |
| `shield`                         | a BAR on the summon lane          | capability                                                                                              |
| `heal`                           | **nothing**                       | a full facet: chip, tile badge, coverage row, atlas card                                                |
| `energy`                         | **nothing**                       | detail card + Compare row (`capMatchesFacet` drops `target: 'self'`, and all 8 authors are self)        |
| `damage` without `application[]` | **nothing**                       | **nothing**                                                                                             |

⚓ So a `damage` effect on `manual` is the one class where retirement is free in
both directions — it reaches nothing now and would reach nothing re-triggered,
because what it carries is a damage MAGNITUDE and the tool never shows one.

⛔ **`onHeal`, `onEnergy`, `onHPChange`, `onHPDecrease` and `onHPIncrease` have no
reader either** — they are as dead as `manual`, and re-triggering into one only
moves the problem. (Corpus: 1 `onHPDecrease`, 0 of the rest. Not this round's
problem, but ⛔ never reach for one.)

✔ HP and aura conditions (`selfHpBelow`, `selfHpAbove`, `recipientHpBelow`,
`enemyHpBelow`, `enemyAffectedBy`) evaluate to `null`, so a gated effect renders
OPTIMISTICALLY with its caveat. That is the house behaviour, which means an
HP-gated effect **is** authorable — several curator notes claim otherwise.

## 3. The rules this round ran on

**⚓⚓ One effect PER IN-GAME SOURCE.** The tempting shape was one approximate
trigger plus a caveat apologising for the rest. It is almost always unnecessary:
when a kit clause names several sources, our vocabulary usually reaches each one
separately. Alhaitham's C2 mirror gain is `onCast skill` + `onCast burst` + the
A1 path, not an `onCast skill` with an apology. ⚠️ `onCast` on a passive or
constellation host must state `ability` (lint B.8), so "on E or Q" is two effects
by construction — measured on Kirara's C6, that draws two 15s team windows, one
per cast, correctly absent at C0.

**⚓ A flat-DMG add-on is a BUFF, not a `damage` effect** (⚓ Nate, 2026-09-21).
"DMG dealt by <ability> is increased by N% of <stat>" is `{buff, passive,
<class>FlatDmg, scaling}` — the house form with 39 authors, including Zhongli's
Dominance of Earth, Cyno A2, Dehya A4, Mavuika A1 and Chiori A1. The plan said
retire these (it named Gorou A4); the house form wins, because retiring Gorou's
while Zhongli keeps his would leave two spellings of one sentence in the corpus
and only one of them saying anything. ⚠️ Only when the bonus covers a whole
attack CLASS — a bonus scoped to one named ability inside a class over-claims
through the stat and retires instead.

**⚓ A retire needs no new caveat.** The effects drew nothing before and do not
exist after, so no blank appears that was not already there — and the ruthless
caveat pass (261 → 107) removed most of these caveats on exactly that reasoning.
Caveats in this round are attached to RE-TRIGGERS that are narrower than the
game, where a new bar carries a real qualification.

**⚓ Deferrals are retired, not allowlisted** (⚓ Nate's call: whichever is
easiest, provided nothing is lost). The two named primitives — elemental
absorption and a summon-tick BUFF collector — get the Kirara-C2 house form:
description kept, effects gone, `_curatorNotes` carrying the full restore spec.
§6 is the backlog, and it is mirrored into the two queued rounds' own records.

## 4. Step 2 — the lint refusal

`characterLint` B.18 (`7f8e49a2`). `MANUAL_PENDING` exempts the characters that
still carry one; it only shrinks, and `characterLint.test.ts` fails on a stale
entry, so it cannot outlive the round. Two synthetic cases keep both halves
honest. When it empties, it goes, B.18's guard clause goes, and `'manual'` leaves
the `Trigger` union.

## 5. Measurement

- **Buff digest** — `scratch/probe/digest.test.ts`, 252 digests (126 characters ×
  C0/C6). Baseline `manual-before` on `2c7190ad`.
- **TB capability census** — `scratch/probe/caps.test.ts`, 786 capabilities across
  126 characters. Baseline `caps-before`.
- ⚓ The invariant: **a retire moves NOTHING in either census** (both surfaces
  already ignore `manual`), and **a re-trigger moves both** — or at minimum the
  capability census, for a `heal`/`energy` that has no planner lane. A retire that
  moves a digest is a bug in the edit, not a finding.
- ⚠️ The digest casts one E and one Q, so it is blind to anything gated on a
  stance, a variant, a reaction or a second cast. Every re-trigger was also
  measured at its own site.

## 6. ⏭ The re-authoring backlog

Four effects were DELETED with a full restore spec in their `_curatorNotes`,
because the primitive they need is named and queued. ⛔ None of them is lost;
each is a copy-paste from the note when its round lands.

| what                                                                   | where the spec lives                   | the round that restores it                                                                            |
| ---------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Sucrose C6** — +20% team DMG Bonus for the absorbed element          | `sucrose.json`, "Chaotic Entropy"      | elemental absorption (memory `elemental_absorption_round`; ⚓ Nate wants its own round, survey first) |
| **Wanderer A1** — the Cryo branch's +20% CRIT Rate                     | `wanderer.json`, "Jade-Claimed Flower" | same                                                                                                  |
| **Yae Miko C4** — +20% team Electro DMG for 5s per Sesshou Sakura tick | `yae_miko.json`, "Sakura Channeling"   | the summon-tick BUFF collector                                                                        |
| **Yae Miko C4** — +8 Energy per tick, 5s cooldown                      | same                                   | same                                                                                                  |

⚠️ **Yae's pair carries a trap the round must not walk into.** A `summonTick`
trigger is legal only inside `summons[].effects[]` (lint `summon-tick-misplaced`),
and the Sesshou Sakura is hosted on her SKILL — so the restored effects go on
`yae_miko__skill__yakan_evocation_sesshou_sakura`.summons[0], carrying their own
`{constellation: 4}` condition. Authoring them on the C4 entry, which is where
they read naturally, fails lint; this round tried it and the lint caught it.

⏭ **Held back deliberately, and each wants a look rather than a round:**

- **Baizhu C6's second clause** — a Seamless Shield off the Gossamer Sprite,
  authorable today, spec in its curator note. It draws a NEW short shield bar
  beside the burst's 14s one during Pulsing Clarity. Correct per the game;
  net-new, so it was not smuggled in under a retirement.
- **Clorinde C2** — her A1 upgrade (30% ATK / 2,700 cap) still sits on the C2
  entry as a `damage` effect reaching no surface. Same defect in the same kit,
  but never a `manual` trigger, so out of this round's scope.
- **Sethos A4 / Itto A4 / Citlali A4** — retired as scope-narrow (§3). If the
  house form's tolerance is later judged wider than this round read it, these
  three are the ones that flip, and their notes say exactly what to write.

## 7. RECORD

Four commits on `curation/manual-trigger-retirement`:

| commit     | what                                                           |    effects |
| ---------- | -------------------------------------------------------------- | ---------: |
| `7f8e49a2` | step 2 — lint B.18 behind a shrinking allowlist                |          — |
| `201ee607` | 52 retired — no trigger, no pixel, or a schema artifact        |   127 → 75 |
| `4a6f0b8c` | 6 converted to the flat-DMG house form                         |    75 → 68 |
| `401dfefc` | 50 re-triggered, one effect per in-game source                 |    68 → 14 |
| `a4556588` | 14 — coordinated attacks re-homed onto the cast that arms them | 14 → **0** |

**`manual` is gone**: 0 effects in the corpus, the member struck from the
`Trigger` union, `MANUAL_PENDING` deleted, B.18 unconditional. Step 1's filter
in `deriveCapabilities` went with it — ⚓ the guarantee moved UPSTREAM to the
lint, which is the stronger place for it, because a filter there would still
have let the data exist.

### 7.1 What it bought, measured

- **28 of 252 buff digests moved, +123 buff windows**, none removed.
- **Team Builder capabilities 786 → 865**, +79 and 0 lost.
- **12 of the 24** manual-carrying characters that drew NO buff window of their
  own now draw one: Alhaitham, Barbara, Chevreuse, Collei, Diona, Kaveh, Kirara,
  Ningguang, Sethos, Wanderer, Xiao, Yaoyao.
- **Applications rise on 9 characters at C6 and on NONE at C0** — Candace 19→21,
  Clorinde 15→18, Collei 16→18, Kaveh 11→14, Kirara 15→19, Kuki 25→29, Kokomi
  28→30, Yaoyao 20→24, Charlotte +2 at its own site — with reactions following
  on Kirara (+1) and Kuki (+3).

### 7.2 The rulings, restated because they were each earned

⚓⚓ **One effect PER IN-GAME SOURCE** (⚓ Nate). The framing that nearly shipped
was "author the partial trigger and caveat the rest"; it was wrong, because the
other sources are almost always reachable as separate effects. Keqing's C6 is
four (N, CA, E, Q), Sethos's C2 is three, Alhaitham's C2 and Kirara's C6 and
Yaoyao's C4 are two each. ⚠️ `onCast` on a passive or constellation must state
`ability` (lint B.8), so "on E or Q" is two effects by construction.

⚓ **A proc is armed by the CAST that hosts it.** `armCastProcs` is handed
`variant?.effects ?? active.effects`, so a proc authored on a constellation entry
is armed by nothing. The constellation gate travels in the effect's own
`conditions` instead. ⛔ This is why eleven coordinated attacks could not simply
be re-triggered in place.

⚓ **A flat-DMG add-on is a BUFF** (⚓ Nate) — but only when it covers a whole
attack CLASS. ⛔ Itto's A4 is the case that proves the limit: it buffs Arataki
Kesagiri and not Saichimonji, and `arataki_itto.json`'s `chargeFrames` IS the
Saichi cold-open, so the chip would have claimed the bonus for precisely the one
charged attack that does not receive it.

⚓ **A retire needs no new caveat** — the effects drew nothing before and do not
exist after, so no blank appears that was not already there. Caveats in this
round attach to RE-TRIGGERS that are narrower than the game.

✔ **HP-gated effects ARE authorable** and several curator notes said otherwise.
`selfHpBelow` / `recipientHpBelow` resolve to `null`, so the effect renders
optimistically with its caveat — which is how Diona's C6 finally draws both HP
branches, including the `incomingHealingBonus` half nobody had authored.

### 7.3 Defects the work turned up on its own

- 🐛 **`characterLint.test.ts`'s `shields.test.ts` INERT list carried a stale
  reason**: Columbina C1 was listed as "`manual` trigger, dispatched nowhere",
  which stopped being true when the stack-threshold round re-triggered her to
  `onStack` in 2026-09-18. It still passes — `Columbina E Q` accrues nothing like
  60 Gravity — so ⛔ a future author must not read the assertion as "this trigger
  has no reader". Corrected in place. Sigewinne C2 left the list with a real
  assertion: two shield bars, 41f and 245f, each its own cast's `frames.anim`.
- 🐛 **Kuki's A4 was a DOUBLE STATEMENT** — the same +25% EM was authored on the
  passive AND folded into the ring's damage tick as `flatScaling`. Removed at the
  tick, so the claim lives in the one place with a pixel. ⛔ The HEAL half's
  `flatScaling {em, 75}` stays folded: there is no heal-side stat for a flat
  add-on.
- 🐛 **`procCooldown` is meaningless on a `passive` trigger** (lint B.9) — Dehya's
  A4 20s ICD is stated in prose rather than parked on a dead key.
- ⚠️ **A census that knows three effect hosts is wrong by one.** `factionBonuses[]`
  is the fourth, and Razor's Secret Rite lives there.
- ⚠️ **Removing `effects[0]` shifts `effects[1]`** — a host with two edits must
  take the later index first. And a two-effect verdict silently leaves its
  sibling behind: Sigewinne's C6 kept a stale `manual` twin at `effects[2]`
  until the allowlist's stale-entry guard caught it.

### 7.4 ⚠️ What the measurement could NOT see

- The corpus digest casts **one E and one Q**, so it is blind to a held skill
  (Charlotte's C6), a stance (Yoimiya's A4, Clorinde's shades), a second cast, and
  every `heal`/`energy` effect — heals and energy reach no planner lane at all.
  Each of those was measured at its own site instead.
- ⛔ **No oracle ran on this round.** The eleven coordinated attacks' `application[]`
  frames and units are read from gcsim source (file:line in every curator note),
  not from the dumper. ⏭ They are the natural next thing for
  `audit-gcsim-frames.mjs` to adjudicate, and a disagreement there is expected
  to be a frame or two, not a mechanic.
- The gcsim checkout was **6 commits behind `origin/main`** and deliberately not
  pulled: the pending commits are UI, two weapons and one Odette fix, none of
  which touches a trigger this round read.
