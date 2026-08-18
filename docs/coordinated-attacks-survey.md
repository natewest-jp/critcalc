# Coordinated attacks — what is missing, and what it would take

**Status:** 🔎 **SURVEY ONLY, nothing built.** Written 2026-08-18 at Nate's request, after
the gauge round's residue was closed down to named gaps.

> ⚓ **The headline: it is TWO mechanisms, not one, and the larger one is not
> hit-triggered at all.** Anyone who opens this expecting "an `onHit` damage effect" will
> build the wrong thing for four of the eight characters.

---

## 1. What we have today

`coordinatedAttack` is an `AbilityTag` on **8 abilities** — albedo `abiogenesis_solar_isotoma`
· beidou `stormbreaker` · dehya `indomitable_flame` · nahida `all_schemes_to_know` ·
nicole `revelation_ladder_of_divine_ascent` · raiden_shogun `transcendence_baleful_omen` ·
xingqiu `guhua_sword_raincutter` · yelan `depthclarion_dice`.

⛔ **Not one of them carries a summon tick, so together they contribute ZERO elemental
applications.** Xingqiu and Yelan — two of the most-played off-field Hydro appliers in the
game — put nothing on the gauge from their bursts.

⚠️ **The tag is also INCOMPLETE**: Fischl (C6) and Thoma (burst) use the identical
mechanism and are not tagged. ⛔ Do not treat the tag as the worklist.

⚠️ Two of the eight are already handled or partly handled: **Nahida** is the
mark-triggered round's `onReaction` proc (done), and **Nicole** already authors a
`damage` + `onHit` + `procCooldown: 3` effect which is **INERT** — `onHit` is consumed by
`buffWindows.ts` for BUFF effects only, so a damage effect on that trigger reaches
nothing. ⚠️⚠️ `orphanedSchema.test.ts` cannot see this: `trigger.type === 'onHit'` is
accessed by the buff path, so the key looks wired. It is the guard's documented blind
spot — partially-wired data.

## 2. ⚓ TWO mechanisms, read off gcsim

### A. Normal-attack-STATE ticker — `internal/template/minazuki`

**Xingqiu Q · Yelan Q · Thoma Q · Fischl C6.** All four register a `minazuki.Watcher` with
`state: action.NormalAttackState` and `tickerFreq: 60`.

⚓⚓ **This is NOT per-hit.** The watcher hooks the ANIMATION STATE: while the active
character is in the normal-attack state it fires every **60 f**, gated by a 60 f ICD key.
Swing count is irrelevant — a slow 2-hit string and a fast 5-hit string produce the same
one wave per second. ⛔ An `onHit`-per-swing model would be wrong in both directions.

| character | ability             | wave                               | ICD group                                                      |
| --------- | ------------------- | ---------------------------------- | -------------------------------------------------------------- |
| xingqiu   | Q Rainbow Bladework | 2 / 3 swords alternating (5 at C6) | `ElementalBurst` / `Default` — standard                        |
| yelan     | Q Exquisite Throw   | —                                  | `ICDTagYelanBurst` / `ICDGroupYelanBurst` = **18 f / every 4** |
| thoma     | Q Fiery Collapse    | —                                  | —                                                              |
| fischl    | C6 wave             | —                                  | —                                                              |

⚓ **Yelan's bespoke group is now expressible** — `summonTick.icdGate` takes an
`IcdWindow`, shipped in the ICD-group round. That was not true a day ago.

### B. Per-hit proc on `OnEnemyDamage`

**Albedo** (Transient Blossom, 2 s ICD) · **Beidou** (Stormbreaker lightning, 1 s) ·
**Dehya** (Fiery Sanctum) · **Raiden** (Eye of Stormy Judgment, `eyeICD` = 54 f / 0.9 s).
Each subscribes to `event.OnEnemyDamage` and fires its own attack behind an ICD.

⚓ **This one IS the mark-triggered round's shape** — a `damage` effect with its own
`application[]`, gated by `procCooldown`, on a trigger that listens to somebody else's
output. `reactionProcs.ts` is the template; only the stream changes.

## 3. What it would take

### Mechanism A — the bigger prize and the cheaper build

⚓ **Our IR already knows when the active character is normal-attacking.** Post-P4 #2 emits
one `action` event per SWING with a `blockId` anchor, so a normal-attack BLOCK is
derivable, and a 1 s chain gated on "inside a block" is the same clock-scheduled shape
L5e's summon-tick chain already runs. No new hit plumbing.

- **Engine:** a state-gated tick series — one new trigger shape, one chain in `aura.ts`
  beside the summon chain, reusing `icdGate` / `tickCap` verbatim.
- **Data:** 4 abilities.
- ⚠️ **The judgement call to make first:** our swing events are at swing END while the
  animation state spans the whole string. Block start → last swing end is the honest
  approximation, and it should be decided once and written down, ⛔ not per character.

### Mechanism B — smaller, and it has a known depth limit

- **Engine:** a `hitProcs.ts` mirroring `reactionProcs.ts`, listening to the hit stream.
- **Data:** 4 abilities (+ Nicole's existing inert effect finally gets a reader).
- ⚠️⚠️ **The limit:** `dispatchHit` runs in PARSE order over the active character's swings,
  and gcsim's `OnEnemyDamage` fires for **everything** — including other summons' ticks. A
  Raiden Eye should proc off Oz. L5e's tick chain is clock-scheduled now, so a tick can
  offer at its own instant (that is exactly how Nahida's Tri-Karma fires off a summon), but
  ⛔ this must be settled before authoring, not discovered at character three.

### Shared

Both need the same measurement discipline: ⚠️ **the 12-fixture oracle barely exercises
this**, because its rotations are nearly all E/Q casts and mechanism A only fires while
someone is swinging. ⛔ **A green oracle here proves nothing** — the same trap
`chargedIcdWindow` hit. Measure with purpose-built notation (`Xingqiu Q > Someone N5 N5`)
against gcsim, and add a fixture.

## 4. ⚓ Why this is worth doing, in one line

Xingqiu and Yelan are premier off-field Hydro enablers, and today the planner's aura lane
shows their bursts applying **nothing at all** while a player normal-attacks under them.
That is the largest remaining gap a reader can actually see.
