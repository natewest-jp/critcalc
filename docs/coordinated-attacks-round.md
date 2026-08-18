# Coordinated attacks — the round

**Status:** ✅ COMPLETE, 2026-08-18. Supersedes the survey
(`docs/coordinated-attacks-survey.md`), which stays as the BEFORE.

⚓ **Nate settled the round's one open design question** (2026-08-18): Raiden's Eye of
Stormy Judgment procs on **any damage the opponent takes**, summon damage included. Its
real condition is "the opponent took DMG", so a fully-shielded enemy does not proc it —
and we do not model a shielded enemy, so the rule reduces to _any damage-dealing hit_.

---

## 1. The two mechanisms, and what each becomes

|         | A — the wave                                                           | B — the damage proc                                                   |
| ------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| who     | Xingqiu Q · Yelan Q · Thoma Q · Fischl C6                              | Albedo E · Beidou Q · Dehya E · Raiden E · Nicole Q                   |
| gcsim   | `internal/template/minazuki` — a watcher on `action.NormalAttackState` | `event.OnEnemyDamage` subscribers                                     |
| trigger | 🆕 `whileNormalAttacking`                                              | `onHit` — **the one Nicole already authors**                          |
| shape   | a `damage` effect carrying `application[]`, hosted on a summon         | a `damage` effect carrying `application[]`, `procCooldown` as the ICD |

⚓ **Both land as the SAME authored shape the mark-triggered round shipped** — a `damage`
effect whose own `application[]` says when its hits land and what they apply, on a trigger
that listens to somebody else's output. `reactionProcs.ts` is the template for B almost
verbatim; A reuses its arming and adds a chain.

## 2. ⚓ What the survey got wrong, measured

- **Yelan's ICD group is `(120 f, every 3rd)`, not `18 f / every 4`.** The survey read
  `ICDGroupYelanBreakthrough` (her charged attack) instead of `ICDGroupYelanBurst`.
  `pkg/core/attacks/icd_groups.dm.go:127,188`.

## 3. The engine decisions

1. **One proc registry, one module.** `reactionProcs.ts` → `src/lib/sim/procs.ts`. The
   arming key (`holder::host::index`), the entity-not-object rule, the carried `lastFire`
   and the cooldown floor are IDENTICAL for all three trigger kinds; only the selection
   predicate differs. ⛔ A second copy of that bookkeeping is how the two ends drift.
2. **Mechanism A is a SPAN notification, not a chain of tasks.** The active character's
   normal-attack animation state is our normal-attack block; each swing hands the armed
   wave listeners its `[start, end)` span and the listener fires every `interval` from
   `lastFire`. ⚓ That reproduces gcsim's watcher exactly — its state-entry trigger is
   ICD-gated and its ticker is not, and with `interval == ICD` the two collapse into one
   rule.
3. **Mechanism B listens to a DAMAGE STREAM, not to `hitRecords`.** Same records
   (`HitEvent`), but notified from five sites in true clock order: cast hits, N/C/P swings,
   summon damage ticks, reaction procs, and other damage procs. ⛔ It does NOT go through
   `dispatchHit` — that mutates live stack state in parse order (the L5e rule), and a
   summon tick cannot be interleaved there.
4. **A listener never fires off its OWN output.** Raiden's Eye states it
   (`raiden/skill.go` excludes her own `ElementalArt`+`Slash`), and it is also what
   bounds the chain. ⚠️ gcsim lets Albedo's and Dehya's fields self-sustain — see §5.
5. **The sim PUBLISHES the fire times; the projection does not derive them.** A
   state-gated series cannot be walked by `collectSummonTicks`, so the summon window
   carries `ticks[]` the parse measured. ⚓ Same law as `tickCap`: both readers agree
   because there is only one producer.

## 4. Landings

- **a** — schema + `procs.ts` + the wave chain + window `ticks[]`
- **b** — data for A (4 abilities)
- **c** — the damage stream + the `onHit` damage-proc reader
- **d** — data for B (5 abilities)
- **e** — measurement, fixtures, docs

## 5. Known divergences, each on purpose

⚠️ Every line here is a thing gcsim does that we do not, or the reverse. None is a
bug list; each is a choice with a stated reason.

**A listener never fires off its own output.** Raiden's Eye states the exclusion
(`raiden/skill.go` skips an `ElementalArt`+`Slash` hit from her own index, which is
precisely the Eye's own strike), and it is what bounds the feedback loop at one fire per
cooldown. ⚠️ gcsim does NOT apply it to Albedo or Dehya: only the skill's INITIAL hit is
excluded there, so a Transient Blossom hears itself and gcsim's Solar Isotoma ticks every
2 s with **no player input at all**. Ours needs an external damage source. ⚓ Measured, the
difference does not reach a real rotation — in the oracle's `Albedo E > Dehya E > Kaeya N5
N5 N5` we make 4 blossoms to gcsim's 3, i.e. we are OVER, not under, because the swings
saturate the 2 s cooldown either way. A rotation with a long silent stretch is where it
would show.

**A wave fires at `lastFire + interval` inside a string; gcsim's does not.**
`minazuki`'s state-ENTRY trigger is ICD-gated and returns WITHOUT starting the ticker when
it is on cooldown — so in gcsim a normal string begun 0.5 s after the last wave produces
no waves for its whole length. Ours is the cadence Xingqiu's own source comment states:
"approximately 1 second interval between summoned Hydro Sword waves". It shows only under
rapid state re-entry (dash-cancel spam).

**No `AnimationStartDelay`.** gcsim delays the first wave of a string by a per-attacker
constant (Thoma 11 f, and every character declares one for the `XingqiuN0`/`YelanN0` keys).
⚓ Measured on the Xingqiu fixture, that is the whole of our timing error: our waves sit at
a flat 1.00 s cadence, gcsim's at 1.00/1.00/1.05 — the extra 3 frames every third wave is
Kaeya's N5→N1 restart. Cumulative drift over 12 waves ≈ 0.3 s.

**Fischl's C6 wave and Oz's ticks are two ICD counters, not one.** gcsim gives both
`ICDTagElementalArt` + `ICDGroupFischl` from one function and its counter spans them; ours
is keyed per listener/series. C6 therefore applies slightly more often than gcsim's. Same
class as the counter-sharing fault `docs/icd-group-round.md` §4 holds for Oz's recast.

**Raiden's Eye opens at the spawn; gcsim's opens 66 frames later.** gcsim gates the proc on
`skillKey`, the same status as the burst-DMG-bonus attack mod, which it adds at `6+60`.
⚓ Measured, this is the ENTIRETY of our disagreement on that fixture: one extra strike at
the head (ours 0.92 s), after which both run the identical 2.95 s cadence. Modelling it
would mean moving the Eye's bar 1.1 s later, and in game the Eye is there at the cast.

**Albedo's own E cast procs his blossom; gcsim excludes it by ability name.** One extra
blossom per cast. ⛔ We have no way to say "not this hit" and should not grow one for it.

**Positional gates are not modelled at all.** gcsim requires the target inside a radius-10
area around Albedo's construct and Dehya's field. That is the same positional claim
`docs/gauge-round-L5e.md` refused to grow a vocabulary for, and for the same reason.

**A cast that deals no damage still enters the damage stream.** `notifyDamage` rides
`dispatchHit`, which fires for every E/Q cast — including a stance opener that hits
nothing. Nothing in the corpus says a cast is damageless (`application: []` says it APPLIES
nothing, a different claim), and this is the approximation every `onHit` buff already
makes. ⛔ Don't fix it with a `scaling: 0` sentinel.

**For an E/Q cast the damage instant is the CAST START.** The `HitEvent` convention, up to
a second early on a slow burst. Splitting it would give the corpus two answers to "when did
this cast hit".

**⚠️ Nicole is deliberately not authored, and the survey's reading of her is wrong.** Her
Arcane Projection carries no `Durability` in gcsim, so it applies nothing; its element is
the ACTIVE character's rather than hers; and it is capped at four per burst. Her existing
`damage` + `onHit` effect being inert for the gauge is CORRECT. ⚓ "Authored but unread" is
not automatically a defect — check what the thing does before wiring it.

↻ ⚓⚓ **CONFIRMED IN GAME 2026-08-18 (⚓ Nate), so this is settled and ⛔ not to be
re-opened from the gcsim source alone:** an Arcane Projection deals Elemental DMG matching
the active character's element, applies **no** elemental gauge, and causes **no** reactions.
The tell that pointed at it was internal to gcsim's own file — every other hit Nicole makes
carries `Durability: 25`, and the only two without it are the two projections, i.e. exactly
the two whose element is BORROWED. ⚓ So the aura lane staying silent under her burst is the
tool being RIGHT, and it gets no caveat for the same reason.

## 6. What is still out

- ⛔ **A proc does not enter the finalize hit stream**, so it triggers no artifact `onHit`
  set — the same boundary the mark-triggered round drew, and moving it moves buff rows.
- ⛔ **Xingqiu's Orbital and Barbara's Melody Loop** stay closed by decision: an
  application-only tick, and a best-case-position number (`gauge_round_l5e`).
- ⛔ **Beidou's Targe has no lane**, because it is a status and not a summon. Her bounces
  appear on the aura lane and in the aura log only.

## 7. Files

|                                     |                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `src/lib/sim/procs.ts`              | was `reactionProcs.ts`; three trigger kinds, one registry                   |
| `src/lib/sim/aura.ts`               | `fireProc` (the one dispatch), `notifyDamage`, `notifyNormalAttack`         |
| `src/lib/sim/run.ts`                | notifies the damage stream from `dispatchHit`, the span from the swing loop |
| `src/lib/sim/finalize.ts`           | stamps `TimelineWindow.ticks` from what the parse measured                  |
| `src/lib/timeline/summonSubrows.ts` | merges measured ticks with the walked ones                                  |
| `src/lib/utils/characterLint.ts`    | B.13b/B.13c, D.27e, and `lintIcdGate` shared with D.27b                     |
| 8 character JSONs                   | + Nahida and Fischl stating the gate they already had                       |

## 8. ⚠️⚠️ The oracle proved nothing, exactly as the survey said it would

Run on the twelve existing fixtures, the whole round is **byte-identical**: ours 176
applications before and after, and the one-row move in gcsim's total (215 → 216) is their
side's documented ±1 flicker. A green run there is not evidence.

⚓ Five fixtures were added, all built so that the coordinated attack is the ONLY thing
applying — Kaeya's normals are physical, so every application in a wave fixture is the
wave's own.

## 9. The measurement

Same 17 fixtures both sides; the BEFORE is `c55483e` in a worktree running the same audit
script, so only the round's own code and data differ.

| metric                             | before    | after         |
| ---------------------------------- | --------- | ------------- |
| applications — ours                | 185       | **224**       |
| gcsim applies, we do not           | 85        | **49**        |
| we apply, gcsim does not           | 1         | 3             |
| element mismatch                   | 0         | **0**         |
| tier-2 samples agreeing            | 155 / 326 | **176 / 327** |
| 🔴 aura gcsim has and we do not    | 48        | **29**        |
| 🟠 aura we have and gcsim does not | 57        | 58            |

Per fixture, and ⚠️⚠️ **read the ability LABELS, not the ordinals** — the report pairs by
ordinal, so one unpaired insertion shifts every row after it:

- **Thoma** 5 / 5, exact, Δ 1–16 frames. Nothing missing, nothing extra.
- **Yelan** 13 / 14, Δ 1 frame on every paired row.
- **Xingqiu** reads as 12 / 19 with 7 missing — and ⚓ **all seven are `Xingqiu Orbital`**.
  Filtering gcsim's list to `Guhua Sword: Raincutter` gives **12 waves against our 12**,
  i.e. the mechanic is EXACT and the residue is entirely the application-only tick that is
  closed by decision. ⛔ A reader who trusted the Δ column here would have concluded our
  waves were up to 227 frames early.
- **Raiden** 9 / 8, 0 missing, 1 extra — the 66-frame arming delay, §5.
- **Albedo + Dehya** 9 / 8, 0 missing, 1 extra — Albedo's own cast, §5.

Corpus-wide (123 characters × C0 and C6, `<name> E Q N5 N5 > Kaeya N5 N5 N5`): **exactly
the eight authored characters move and nothing else does.** Nahida does not appear in the
diff and Fischl appears only at C6, which is the proof that authoring `icdGate: 'none'` on
the two shipped reaction procs preserved them exactly.
