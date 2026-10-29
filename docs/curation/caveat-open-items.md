# Caveat Rounds — Open Items

> Everything the 2026-08-18/19 caveat rounds left open, in one place so it survives the session.
> Round records: `caveat-refresh-2026-08-18.md`, `caveat-ruthless-pass-2026-08-19.md`.
> Rubric (⚠️ a SNAPSHOT — re-derive before using): `engine-capability-rubric.md`.

---

## 1. 29 caveats marked `trim` with no replacement text

The ruthless pass judged these as **keeping a real pixel but carrying trivia alongside it**, and
proposed no replacement wording — so nothing was applied. ⛔ They were NOT applied blind; each still
carries its current, longer text. Full records (category, pixel, reasoning) are in
`caveat-ruthless-verdicts.json` — match on the `before` string, which is unique corpus-wide.

⚓ The work is small and mechanical: keep the clause that names the pixel, drop the rest.

| character        | kind                                    | category                 | the pixel to preserve                                                                                                                                  |
| ---------------- | --------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Columbina        | ability                                 | visible-divergence       | THREE team buff bars draw for what is one +40% bonus in game (lunarCharged / lunarBloom / lunarCrystallize Reaction Bonus rows), and each runs the ful |
| Mavuika          | ability                                 | visible-divergence       | Two drawn-bar lies, both large. (1) The Hold-E stance bar is 9s wide for every reader; a C1 owner's real Flamestrider window is ~13s, so the bar under |
| Durin            | constellation entry                     | visible-divergence       | Two, both printed values. Sentence 1: the C6 self buff bar prints defIgnore +30% for 20s; in Dark form the game gives 70%, so the number on the bar is |
| Nicole           | C4                                      | visible-divergence       | The Pathfinder's Blessing bar's LENGTH — drawn as a flat 20s window when in game it is consumed after 8 instances (faster still against several oppone |
| Mona             | Burst                                   | visible-divergence       | The +60% team DMG bonus bar, on two counts: it claims a blanket team DMG bonus where the game gives it only against the bubbled enemy, and it starts a |
| Qiqi             | ability                                 | approximation-disclosure | Both halves land on screen. (1) The E pill's ghost-CD tail and the placement of the next E: `cooldownModifiers` authors an UNCONDITIONAL flat -15, whi |
| Qiqi             | passive                                 | approximation-disclosure | Two team buff bars (superConductReactionBonus +50%, stellarConductReactionBonus +50%) genuinely DRAW — onCast skill, 15s, gated on `teamEnablesReactio |
| Sandrone         | passive:A4-slot (Light of Rationalisme) | visible-divergence       | THREE bars actually draw on any team Stellar-Conduct: +20% Cryo DMG, +20% Electro DMG and a -40% Physical RES debuff bar. They draw unconditionally —  |
| Prune            | Passive                                 | visible-divergence       | The Secret Rite ATK bars (+60% self, +30% active) in the team/received buff lanes. Both fire on `onReaction any/team` with only the teamFaction count  |
| Yae Miko         | C2                                      | approximation-disclosure | The number PRINTED ON THE BUFF BAR: '+200 EM'. We render the level-4 tier as a canonical assumption and there is no per-summon-count BuffValue, so a o |
| Diona            | C6                                      | approximation-disclosure | THREE 12.5s BUFF BARS (Stellar-Conduct / Superconduct / Cryo Swirl Reaction Bonus, +40% each). They are gated only on `teamEnablesReaction`, which res |
| Lohen            | constellation (C2)                      | visible-divergence       | The +200 EM team bar is anchored at the E cast AND again at the Q cast (the passive-hosted onHit with no trigger.abilityType is excluded from the N/CA |
| Nahida           | passive                                 | approximation-disclosure | The received-buff bar prints a literal '+250 EM' for 15s. That number is an assumed cap, not a computed value — peer-stat routing ('25% of the highest |
| Nahida           | passive                                 | approximation-disclosure | Two printed values, both wrong for a non-canonical build: the always-on permanent-bonus chips read '+80% Skill DMG' and '+24% CRIT Rate' at their caps |
| Sucrose          | constellation caveat (C6)               | expected-but-absent      | The C6 effect is trigger:'manual' — 167 such effects reach no planner surface (rubric N1/D3), so at C6 the burst draws NO team DMG-bonus bar at all. T |
| Traveler (Anemo) | ability caveat (burst)                  | visible-divergence       | The Gust Surge summon row draws 8 tick marks at 0.5s and every one applies Anemo; in game an absorbing tornado adds a second, different-element hit pe |
| Baizhu           | passive caveat (A4)                     | expected-but-absent      | This is the reason Baizhu is in a bloom team, and the timeline draws NO buff bar for it at any point in his burst window — the trigger is 'healed by a |
| Escoffier        | Passive                                 | approximation-disclosure | Two debuff bars printing "−55% Cryo RES" / "−55% Hydro RES" for 12s in EVERY team — the value is authored flat at the 4-member rung with no teamElemen |
| Escoffier        | C2                                      | approximation-disclosure | The C2 buff bar's existence and its printed number. No gainStacks/consumeStacks pair is authored for `coldDish`, and the effect's `stacks min 1` condi |
| Iansan           | Normal                                  | visible-divergence       | The N block right after E. Only `chargeFrames` swap on the in-Nightsoul variant; the hits[] frames and the (absent) infusion do not — so an N inside t |
| Linnea           | ability (burst)                         | visible-divergence       | Two overlapping summon-lane bars where the game has one entity: the E's 25s Lumi bar keeps running its authored length while the burst's own 12s summo |
| Sigewinne        | passive A1 — Requires Appropriate Rest  | visible-divergence       | The team buff bar's LENGTH. The effect is `buff / onCast skill / teamExcludingSelf`, which the team pass emits, so a flat Skill-DMG bar draws across i |
| Kachina          | ability                                 | approximation-disclosure | The Turbo Twirly summon bar's LENGTH (12s) and the count of its 2s tick markers. The number is a stand-in for a resource the tool does not simulate, a |
| Kujou Sara       | ability                                 | approximation-disclosure | The single 9.2s ATK bar on the received-buff surface. It is a derived envelope (last re-grant at ~3.2s + 6s), not a real continuous window, and the re |
| Nefer            | ability                                 | visible-divergence       | Every `C` block drawn inside a Shadow Dance window: the timeline renders the basic catalyst charged attack (28f, one Dendro application) where the gam |
| Nilou            | ability                                 | visible-divergence       | Two pixels, both drawn. (1) The Tranquility Aura row on the summon lane, spawned at a fixed +161f from the first E — so an "E swap" rotation draws a 1 |
| Barbara          | ability:skill                           | expected-but-absent      | The blank where the Loop should be. Melody Loop is deliberately not on `summons[]` (curator note) and has no `activeDuration`, so her E draws as an in |
| Dehya            | ability                                 | visible-divergence       | An N or E typed inside the 4.1s burst stance draws the base ability's geometry: the N swing uses the standard normal FrameMap, and E draws a full Molt |
| Xianyun          | ability caveat (burst)                  | visible-divergence       | The A4 team `plungeFlatDmg` bar (Consider, the Adeptus in Her Realm — 16s, gated `state: duringSummon`). It draws its full 16s in every rotation; in g |

---

## 2. Positional schema validation — the general form of lint E.28

**Why:** E.28 catches a caveat below ability level. It is the cheap, precise instance of a general
problem — **a key that is legal somewhere in the tree and illegal where it was authored.**
⚠️⚠️ No key-name check can catch that class: `orphanedSchema.test.ts` asks "is this key read
anywhere", and `caveat` IS read (on abilities), so it stayed green over all 20 dead strings.

**Shape:** generate a JSON Schema from the TS types with `additionalProperties: false`, validate all
123 character JSONs with ajv. Model it on the existing `scripts/generate-marks.mjs` generator.

⛔ **Compile-time is NOT an option** — `characterData.ts` loads via `import.meta.glob` with an
`as Record<...>` cast, and TS excess-property checks do not fire on JSON imports regardless.

⚓ **Cost is low, payoff is future-proofing:** the corpus measures otherwise CLEAN — 152 distinct
authored keys, zero genuine strays (the 13 a name-based proxy flags are FrameMap dynamic keys
`N/Q/E/D/J/C/P/swap` plus the provenance metadata already listed in `INERT`).

---

## 3. Engine + data flags surfaced by the pass (NOT caveat work)

- **Xianyun C2** — `constellationScaling` on the plunge buff (200%→400%, cap 9000→18000) is read by
  neither buff emission nor display, so a C2 reader is shown the BASE value. Caveated nowhere.
- **Skirk burst** — the Serpent's Subtlety bar fails **OPEN** across a swap (measured:
  `Skirk hE > Fischl E > Skirk Q` draws it with no stack context), and the C2 cap prints 12, not 22,
  because `constellationScaling` is inert on the value. Same root cause as Xianyun.
- **Qiqi C4 + Traveler Hydro C6** — both author `target: 'team'` on INERT heal effects, so
  `deriveCapabilities` hands the Team Builder a **party-wide heal claim** that no caveat can ever
  reach. ⚓ Identical in shape to the Nicole C2 / Kirara C2 shield ruling (`53db108`): the fix is a
  data edit at the entry, not prose. ⚠️ Needs `npm run generate-character-index` after.

---

## 4. The `manual`-trigger cluster — ✅ CLOSED 2026-09-21

✅ **THE CHANNEL IS RETIRED.** 0 effects in the corpus, `'manual'` struck from the
`Trigger` union, characterLint B.18 refuses it. Record:
`docs/rounds/manual-trigger-retirement-round.md`; the plan it closes is
`docs/rounds/manual-trigger-retirement.md`.

⚓ **The prediction in this section came true, and is worth keeping for the
pattern.** It said "a large share of the surviving caveats exist only because of
this one hole" and "if `manual` ever gets a surface, re-audit that cluster — it
collapses at once". It did: Columbina's half went in the stack-threshold round
(2026-09-18), and the remaining 127 resolved into 52 retires, 6 flat-DMG
conversions, 50 re-triggers and 11 coordinated attacks re-homed onto the cast
that arms them — +123 buff windows, +79 Team Builder capabilities, applications
up on nine characters.

⚠️ **The live version of this finding is its SIBLINGS.** `onHeal`, `onEnergy`,
`onHPChange`, `onHPDecrease` and `onHPIncrease` have no reader either and are in
exactly the state `manual` was in. The corpus is nearly clean of them (1
`onHPDecrease`, 0 of the rest), so this is a hazard for the next AUTHOR rather
than a backlog: ⛔ never re-trigger an effect into one of them — it moves the
problem and hides it better.

## 5. Implement candidates from round 1 (17)

Catalogued in `caveat-refresh-2026-08-18.md` — gaps whose caveats are correct today but which the
engine now has the primitives to CLOSE (Qiqi's Herald coordinated attack, Barbara/Mika
`activeDuration`, Klee/Escoffier stack pairs, Yaoyao's `summons[]` array, …).
⛔ Authoring is a separate round: char-JSON edits want a fresh context, and a fan-out that writes data
needs its own independent re-derivation pass.
