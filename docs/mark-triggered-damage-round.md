# Mark- and reaction-triggered off-field damage

**Status:** 🔄 in progress · branch `feat/mark-triggered-damage`
**Reads:** [`gauge-round-L5.md`](gauge-round-L5.md) (the gauge, and the no-wake-up ruling) ·
[`gauge-round-L5e.md`](gauge-round-L5e.md) (summon ticks — the third application source, and
the pattern this one copies) · memory `mark_triggered_damage`

> The gauge is fed from exactly three places: a cast's own `application[]`, an N/C/P swing,
> and a summon tick series. This round adds the FOURTH — a hit emitted by an off-field
> character because somebody else caused a reaction.

---

## 1. The two cases, and what they actually cost

**Nahida — Tri-Karma Purification.** Her E marks the enemy with a Seed of Skandha for 25 s.
Any elemental reaction on a marked enemy (and Bloom/Burgeon/Hyperbloom damage) fires
Tri-Karma: Dendro, 185.8% ATK + 371.5% EM at talent 10, on a 2.5 s trigger interval.

⚓ **It applies 1.5U, and it is the corpus's first.** `Durability: 25` in
`nahida/skill.go`, but `ICDGroupNahidaSkill`'s sequence is `{1.5, 0, 0, …}` on a 1 s timer
(`pkg/core/attacks/icd_groups.dm.go:170`) and `enemy/attack.go` multiplies the incoming
durability by that entry — so the first hit of each 1 s window lands at 37.5 durability.
With a 2.5 s trigger interval the ICD group never binds, so every proc is 1.5U.

**Fischl — A4, Undone Be Thy Sinful Hex.** "If your current active character triggers an
Electro-related Elemental Reaction when Oz is on the field" → Thundering Retribution, 80%
of Fischl's ATK, Electro, 1U, 4 frames after the reaction, 0.5 s ICD.

### ⚠️⚠️ Every one of gcsim's A4 applications is a proc the game does not make

Counted in `gcsim-reaction-diff.md`, the quicken fixture (`Nahida E Q > Fischl E Q >
Fischl N3`) — gcsim's column, in order:

```
Oz (Summon) 3.17 · A4 3.23 · Midnight Phantasmagoria 3.55 · Oz (Skill) 4.07 · A4 4.13
Oz (Burst) 8.42 · A4 8.48 · Oz (Burst) 9.40 · A4 9.47 · Oz (Burst) 13.33 · A4 13.40
```

**Every Thundering Retribution is exactly 4 frames after an OZ application.** gcsim gates
A4 on `ae.Info.ActorIndex != c.Core.Player.Active()` — and Oz's attacks carry Fischl's
actor index, so with Fischl on field Oz's own reactions pass the check. In game they do
not: Oz is not the active character. ⚓ **Our own curator note has said so since the A7
pass** ("A4 does not proc when Oz himself causes the reaction").

⛔ So the 5 A4 rows in the round's brief are **not 5 applications to win**. Authoring A4
to match the oracle would encode a known-wrong behaviour. It is authored here the way the
game works, and the oracle is expected to keep reporting most of those rows as missing —
which is the right outcome, recorded rather than chased.

---

## 2. The opening decision: CLOCK-SCHEDULED, and L5's ruling is untouched

The round's brief named this first: is a reaction-triggered application scheduled on the
clock, or emitted inside the gauge's own step? ⚓ **Clock, deliberately** — and the reason
is sharper than "cheaper".

L5 ruled that the gauge needs no wake-up task _because_ its only internal applicator is
the Burning chain, whose Pyro provably cannot react — and warned that an internal
applicator which CAN react makes the wake-up REQUIRED. That warning does not fire here,
because a Tri-Karma proc is **not internal to the gauge**. Every `kind: 'reaction'` event
the gauge emits comes out of `applyElement`, which is reached either from `apply()` — an
EXTERNAL application, at `offer.time` — or from `burningTick`, whose `appIndex` is `null`
and is skipped. EC ticks emit `ecTick`, not `reaction`. So:

⚓ **A dispatched reaction's time is always the offering task's own instant.** Scheduling
the proc at `reactionTime + delay` is therefore an ordinary future task on a clock that is
standing exactly at `reactionTime` — no clamp, no latecomer, no wake-up, and the gauge
stays lazily caught up exactly as before.

⚠️ The feedback the brief worried about is real but bounded: a proc's application can
cause a reaction, which can re-fire the proc. `procCooldown` is the brake (2.5 s / 0.5 s),
and a one-frame-per-listener floor is the backstop for an author who writes `0`.

---

## 3. The design

### 3.1 The schema — three fields, no new effect kind

A `damage` effect is already the right home: it IS damage, it is what the Team Builder
derives `offFieldDamage` from, and `onReaction` is already a `Trigger` member with
`procCooldown` beside it. What was missing is (a) a way for it to reach the aura and
(b) a way to say WHEN the trigger is listening.

```ts
// Effect, damage branch
/** When this effect's hits LAND relative to the TRIGGER, and what they apply. */
application?: ElementalApplication[];

// Trigger, onReaction branch
source?: 'self' | 'team' | 'active';   // 'active' is new
armedFor?: number;                     // seconds after the host cast
```

⚓ **`application` reuses the ability-level vocabulary on purpose.** One word for "what
lands and when", one type, one lint. ⚠️ Its ABSENT case differs and the declaration says
so: on an ability, absent means UNMEASURED (falls back to 1U at the cast); on an effect,
absent means this effect does not reach the aura — which is the status quo for every other
damage effect in the corpus. ⚠️ It also means `orphanedSchema.test.ts` cannot see this
field independently (the key name is not unique — the L5e-a¾ lesson), so the wiring is
pinned by its own tests instead.

**Two arming shapes, both already expressible:**

| host                                   | armed while                      | case          |
| -------------------------------------- | -------------------------------- | ------------- |
| `summons[].effects[]`                  | the summon is alive              | Fischl's Oz   |
| the ability's `effects[]` + `armedFor` | `armedFor` seconds from the cast | Nahida's Seed |

⚓ **The Seed of Skandha is NOT authored as a summon.** It is a state on the ENEMY, which
Nahida's curator note has said since ingest, and `summons[]` means a thing left in the
world (memory `shield_summon_split`). `armedFor` says what the mark actually is: the
trigger listens for 25 s and then stops. ⛔ And it is not `activeDuration` either — that
would grow Nahida's E bar to 25 s, which claims the ABILITY is active when what persists
is a debuff on the target.

The summon host needs no `armedFor`: the summon's own liveness IS the window, and
`Summon.effects[]` has reserved non-`summonTick` triggers for exactly this since P3.

### 3.2 The engine — an armed-listener registry with a LIVE end

`ctx.reactionProcs` holds one record per armed effect. Each carries `endNow()` — a
closure, ⛔ never a cached number — and the dispatch context captured where the listener
was armed (states / constellation / chain index / stacks, one moment, per L5c).

⚓ **The summon host hands its listener the tick chain's OWN `endNow` and generation
stamp.** That is what keeps this from being the parallel-live-registry trap L5e §2 refused:
there is still exactly one summon geometry (`summonEndAt`), with a second reader.

Dispatch happens in `emitReaction`, beside the two dispatches already there:

```
for each armed listener
  still the current generation?          (summon recast stops it, no cancellation)
  time inside [start, endNow())?
  reaction matches trigger.reaction?
  source filter passes?
  procCooldown elapsed?
     → schedule each application[] entry at time + frame, Band.LAND
```

### 3.3 `source: 'active'` needs the offer to say WHO SWUNG

`source: 'self' | 'team'` already exist and mean "the reaction's causing character".
`'active'` means the reaction was caused by **the character the player is controlling**,
which needs two facts we did not have:

- `ctx.activeCharId` — the current segment's character, written where the segment opens.
- `Offer.viaEntity` — true for an application delivered by something the character LEFT
  or TRIGGERED (a summon tick, a reaction proc) rather than by their own cast or swing.

⚓ **`viaEntity` is what makes us right where gcsim is wrong.** Oz's ticks carry Fischl's
`characterId`, so without it "the active character triggered this" cannot tell Fischl's
own N3 from Oz's tick — which is precisely gcsim's defect (§1).

### 3.4 What is deliberately NOT in scope

- ⛔ **A proc does not enter the hit stream.** `finalize` step 6c synthesizes off-field
  hits from summon damage ticks so `deriveBuffWindows` sees them; a Tri-Karma proc does
  not join it. It would be right in game — Deepwood is Nahida's canonical set and
  Tri-Karma does trigger it — but it moves buff rows, which is its own landing with its
  own gate. Recorded in the curator notes, not silently skipped.
- ⛔ **No timeline lane.** The proc's surface is the aura lane and the aura log, which is
  where an application belongs. It grants nothing, so under the layers rule ("a bar that
  says when an ability IS stays; a bar that says what it GRANTS goes") it has no bar.
- ⛔ **Nahida's burst Tri-Karma interval reduction** (−0.45 s per Electro teammate at
  talent 10, inside Shrine of Maya) is not modelled: `procCooldown` has no conditional
  form, and measured on the fixtures the interval is never the binding constraint (the
  observed gaps are 4.9–5.6 s against a 2.5 s floor).
- ⛔ **Nahida C6 Karmic Oblivion** — a second, differently-gated Tri-Karma (200% ATK +
  400% EM, 0.2 s ICD, six per burst, and gated on an on-field state we do not track).

---

## 4. The landings

Each is one commit; `vitest` · `check` · `lint` · `build` green before the next.

- **A — the engine.** Schema, registry, dispatch, lint, tests. Behaviour-zero until
  something is authored (nothing in the corpus carries an `onReaction` damage effect with
  an `application[]`).
- **B — Nahida.** Tri-Karma. Measure.
- **C — Fischl.** A4 on Oz, authored to the GAME. Measure, and expect the oracle not to
  move much (§1).

## 5. The measurement

⚓ Quote the recorded baseline, never recompute it.

| metric                       | before     | after A | after B | after C |
| ---------------------------- | ---------- | ------- | ------- | ------- |
| applications — ours          | 169        |         |         |         |
| applications — gcsim         | 216        |         |         |         |
| **gcsim applies, we do not** | **50**     |         |         |         |
| we apply, gcsim does not     | 3          |         |         |         |
| element mismatch             | 0          |         |         |         |
| tier-2 agreeing              | 134 of 277 |         |         |         |
| mean \|Δ\|                   | 0.174U     |         |         |         |

⚠️ Closing 8 applications will not move the missing count by 8 — a new application creates
reactions, which move the trajectory and can consume auras gcsim's run still has. ⚓ Read
which bucket moved, never the raw count.
