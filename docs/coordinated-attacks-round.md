# Coordinated attacks — the round

**Status:** 🔄 IN PROGRESS, opened 2026-08-18. Supersedes the survey
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

Filled in as they are measured — see §9.
