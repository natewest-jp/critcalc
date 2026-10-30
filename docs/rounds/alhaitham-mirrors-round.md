# Alhaitham's Mirrors round (2026-10-30)

Branch `feat/alhaitham-mirrors`. The to-do's Next item (⚓ Nate 2026-10-30, "before Kokomi"), planned in `docs/rounds/memory-triage-round.md` §6. Before it, Alhaitham's Chisel-Light Mirrors were not modelled at all: every Normal, Charged and Plunging Attack drew physical, no Projection Attack existed, and his Dendro reached the aura lane only from the E's rush and the burst.

## 1. What the game does (gcsim `internal/characters/alhaitham/`)

- **E** (`skill.go`): `skillMirrorGain` runs 15f after a tap and 23f after a hold. It generates 1 Mirror, or 2 when there are none.
- **The pool** (`mirrorGain`, `mirrorLoss`): at most 3. Filling from empty stamps `lastInfusionSrc` and queues a loss 233f later. Each loss takes one and re-queues while any remain, so the Mirrors leave one at a time. A grant past 3 clamps to 3 and stamps a new source, which orphans the old chain: the clock restarts. Swapping out clears the pool (`alhaitham-exit`).
- **A1** (`asc.go`): a Charged or Plunging hit generates 1, once per 720f. Its callback runs before the Projection's, so that hit's Projection counts the new Mirror ("A1 adds a stack before the mirror count for the Projection Attack is determined").
- **Burst** (`burst.go`): consumes every Mirror at the cast. 184f later, unless he has left the field, it generates `3 − consumed` (3 at C6).
- **Infusion** (`alhaitham.go` `Snapshot`): while `mirrorCount > 0`, Normal, Charged and Plunging attacks are Dendro, and nothing overrides it.
- **Projection Attack** (`projectionAttack`): a callback on every Normal, Charged and Plunging hit. It is refused on its 96f ICD, while he is off field, or at 0 Mirrors. Otherwise it deals one attack per Mirror: ICDTagElementalArt on `ICDGroupAlhaithamProjectionAttack` (a 720f timer, applying on every other hit for 24 entries), Durability 25. The landing frames depend on the count: one Mirror at 39 or 40, two at 28/37 or 26/35 (each a 50% left/right roll), three at 32/41/51.

## 2. What shipped

**Engine.** Each new shape is general, and each has one author today.

1. **`gainStacks.lifetimeChain`**, a third lifetime model in `grantInstances` (`sim/stacks.ts`) beside the per-instance and shared (`lifetimeRefresh`) ones. The instances form a queue `lifetime` apart. A grant into a live pool joins the back of it, a grant into an empty pool starts the clock at `now`, and a grant past `max` replaces the queue with a full one from `now`. All six instance write sites now pass the effect to `grantInstances`, which owns the expiry arithmetic. Lint B.13f3: it needs `lifetime` and `max`, and never sits beside `lifetimeRefresh`.
2. **`gainStacks.grantDelay`**, for `onCast` grants only (lint B.13f4). The conditions and the amount are judged at the cast. The grant then lands as a `Band.TICK` task, so a swing starting on that frame sees it. It goes into the turn's pool if `liveSegment === turn`, and is dropped otherwise, because a segment key dies with the swap. `dispatchGainStacks` takes a `defer` callback; the run loop owns the clock. `applyCastGrant` is the cast grant's body, lifted out so the immediate and the delayed path share it.
3. **`NormalAbility.infusionWhileStacks`**. The character's own infusion holds only while they have a stack of the key. It is asked per swing, at the swing's start, against the turn's pool settled to that instant (`ownInfusion` in `sim/run.ts`, now the one reader of an own infusion at all five swing sites). It stays an own infusion, so it still wins over a granted one, which is the kit's "cannot be overridden". Lint C.19c.
4. **`onHit.armedWhileStacks`** and **`ElementalApplication.atStacks`**. A damage proc whose window is a stack is armed once for the rotation (`armStackProcs`, `sim/procs.ts`). A hit fires it only while the holder's own hit carries the key (`heldCountFor`, which reads `HitEvent.stacks`, the post-gain snapshot). The check comes before the cooldown, so a hit with none held spends nothing. `fireProc` lands only the entries whose `atStacks` matches the count. Lint B.13b: source `self`, ability-hosted, never beside `armedFor`; `atStacks` only on such a proc.
5. **A fresh turn starts its own keys at 0** (`segmentStackKeysOf`; run loop). This is the segment-side twin of `rotationStackSnapshot`'s empty-map rule. With no key in the pool, a cast's `stackContext` was `undefined`, a `stacks` gate on it was unresolvable, and the buff passes drew it. C6's crit was drawn on every E, including a fresh one, whose 2 Mirrors overflow nothing. Two `notationParser.test.ts` assertions that a stub's snapshot is `undefined` now assert a count of 0.

**Data (`alhaitham.json`).**

- Skill: four grants (tap and hold, each with "+1 more if empty at the cast"), `max 3`, `lifetime 3.883` (233f), `lifetimeChain`, `grantDelay` 0.25 / 0.383. Plus the Projection Attack: `onHit` on N/C/P, `armedWhileStacks: mirrors`, `procCooldown 1.6`, `icdGate {720, every 2, cap 12}`, 121.0% ATK + 241.9% EM per instance (level 10), and six landings by count.
- Normal: `infusion: dendro`, `infusionWhileStacks: mirrors`.
- A1: an `onHit` grant on Charged and Plunging hits, `procCooldown 12`.
- Burst: `consumeStacks all`, then three `grantDelay 3.067` (184f) refills gated on the count at the cast (0/1/2 consumed → 3/2/1), each raised to 3 at C6 through `constellationScaling`. C6 hosts the fourth refill (3 consumed → 3).
- C6: the Charged/Plunging crit pair is retired (§4). The skill-cast pair now reads the simulated count, so `{mirrors:3}` is no longer needed for anything.

## 3. Measured

- `src/lib/sim/mirrors.test.ts`, 10 tests, every frame derived from gcsim: the 233f decay, the first swing physical before the E, the Projection pips (66, 201, 310 for `E N5 N5 N5`; 165 and 184 for `hE lP`, the three-Mirror case A1 made), joining the back of the queue (the last Mirror at 714), the refill (212 after `E Q`; none after three consumed; three at C6), the overflow restart (the last Mirror moves from 883 to 925), the swap clear and a refill dropped after a swap, and C6's crit drawn only on an E at three Mirrors.
- Corpus, `main` against the branch: 128 characters × C0/C2/C6 × three rotations (solo, through a partner swap, after a partner's opener), comparing every window, event and aura application. 9 of 1,152 rotations differ, all of them Alhaitham's. The seeding change measured alone moved only Alhaitham's C6 crit windows.
- Gates: Vitest 2679 passed, check, lint, build; `test:e2e:chrome` 71 passed.

## 4. Decisions and what was rejected

- **A queue of instances, not a new clock.** A decay task per Mirror would have been a second liveness mechanism. Expressed as instance expiries, the chain rides `applyLifetimeExpiry`, `TurnCarry` and the swap-clear unchanged, and stays lazy (no task per loss).
- **Two grants for "2 from none", not a conditional amount.** The kit says exactly this ("1 Mirror … if there are no Mirrors, 1 additional"). Judging conditions at the cast makes the pair order-independent. `constellationScaling` with a `stacks` condition would have worked mechanically, but its name would lie. Edge: a Mirror leaving inside the 15f between the press and the grant gives 1 where gcsim gives 2.
- **Per-entry `atStacks`, not one proc per count.** Three effects would be three listeners with three cooldowns, where the game has one 1.6s ICD.
- **The left landing lists, never a coin flip.** For one and two Mirrors gcsim rolls left or right; the left frames are authored (a 1–2f difference).
- **C6's Charged/Plunging pair retired.** A hit's snapshot is taken after A1's grant, so `min 3` also passed at 2 Mirrors, where nothing overflows. That is an over-claim on the commonest A1 hit. The skill-cast pair is exact: the E's Mirror lands after the cast's snapshot, so `min 3` at the cast is precisely the overflow.
- **Kit text vs gcsim.** The talent table gives the Removal Interval as 4.0s; gcsim's `mirrorInterval` is 233f (3.88s) with no comment. gcsim's figure is authored, and the gap is flagged to Nate (⏭ below).
- **Infusion per swing, not per hit.** gcsim decides the element at the hit's snapshot; we decide it at the swing's start, so a Mirror leaving mid-swing differs by that swing. This is the same rule every granted infusion follows.

## 5. Open (⏭)

- ⏭ Nate: the 4.0s kit text against gcsim's 233f. Keep gcsim's?
- ⏭ The burst's own hit count, 4 + 2 × Mirrors consumed: the application list is still the 0-Mirror one, so a 3-Mirror burst feeds the aura 4 hits rather than 10.
- ⏭ C1: a Projection hit takes 1.2s off the skill. A proc's landing feeds `notifyDamage`, not `dispatchHit`, where `cooldownReduce` listens.
- ⏭ An overflow trigger would restore C6's Charged/Plunging path and the refill's own overflow. C2's stacks per Mirror and C4's per-count values could read the simulated count now (C4's EM is `30 × consumed`, the burst cast's own pre-consume snapshot), but their caveats are copy, so they wait for Nate's wording.
- ⏭ A Mirror count on the timeline. The stack ledger and `whileStacks` rows cover rotation-scoped keys only. Today the pool is visible as Dendro-tinted swings and Projection pips on the aura lane. Whether it deserves its own row is a visual call (Nate).
- A typed `{mirrors:N}` still writes the pool and has no instances behind it, so it holds until the swap. That falls under the to-do's typed-count re-examination.
