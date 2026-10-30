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

- ✅ ⚓ Nate 2026-10-30: follow gcsim's 233f over the kit text's 4.0s, for now.
- ✅ The burst's hit count, C1, C2 and C4 shipped the same day (§6).
- ⚓ Nate 2026-10-30: the C6 overflow trigger (its Charged/Plunging path and the refill's own overflow) waits until a player asks for it.
- ✅ The C2 and C4 caveats landed as proposed (⚓ Nate 2026-10-30): C2 rewritten, C4 deleted.
- ⏭ A Mirror count on the timeline. The stack ledger and `whileStacks` rows cover rotation-scoped keys only. Today the pool is visible as Dendro-tinted swings and Projection pips on the aura lane. Whether it deserves its own row is a visual call (Nate).
- A typed `{mirrors:N}` still writes the pool and has no instances behind it, so it holds until the swap. That falls under the to-do's typed-count re-examination.

## 6. Follow-ups, same day (⚓ Nate: "can we knock those out, too?")

**Engine.**

1. **`ElementalApplication.minStacksAtCast {key, min}`**: a cast's own entry that lands only when the caster held `min` of `key` at the press. It is read in the cast pipeline against the cast's snapshot (post-gain, pre-consume) before anything reads `castApps` (lint D.56). The frames audit's empty-core replay drops every gated entry, the `whileStance` precedent.
2. **A proc's landing reaches the `onHit` cooldown reducer** (`fireProc` in `sim/aura.ts`), once per fire at its first landing. Before, only `dispatchHit`'s hits did. The other reducer authors (Arlecchino, Kujou Sara, Raiden, Varka) cannot hear a proc: none of them listens to the class a proc lands as, or owns one. The summon-tick stream still does not reach the reducer.
3. **`BuffEffect.opensAfter`**: a cast-anchored window that opens that many seconds after its `onCast` trigger, and only if its holder is on field then (`partitionCastPool` in `buffWindows.ts`, the one anchor of every cast pool; lint B.14b). ⚠️ The Mirror refill's grant checks the turn and this checks who is on field, so a swap out and back inside the 184f drops the grant and keeps the bar. That case is too narrow to unify for.
4. **An `onHit` buff's `procCooldown` holds on the swing surfaces.** All four block loops in `buffWindows.ts` now keep it, as the hit pass and the cast pools already did. One Charged Attack's two landings drew Alhaitham's A1-gated C2 stack twice. Arlecchino's C2 RES drew again off a second Charged Attack 311f after the first, inside gcsim's 10s ICD; it no longer does (`buffWindows.test.ts`). ⏭ Her Q's copy and the Charged copy still keep separate clocks, one per surface.

**Data.**

- **Burst:** instances five to ten (178 … 283), gated 1, 1, 2, 2, 3, 3. Units on 220 and 262, where the standard window applies.
- **C1:** `cooldownReduce` 1.2s off the skill on a hit attributed to the Projection Attack, `procCooldown 1` (gcsim's 60f).
- **C2:** the E draws +100 from an empty pool or +50, opening 15f after a tap and 23f after a hold. A1 draws +50 at its hit. The refill draws 50 × (3 − consumed) at 184f, on field only, and +150 at C6.
- **C4:** the party's EM is `perStack` 30 per Mirror on the burst's pre-consume snapshot, gated min 1. His Dendro DMG Bonus is 10% per refilled Mirror in three tiers, opening at 184f, on field only, and 30% at C6.

**Measured.** `mirrors.test.ts` grows to 14 tests:

- burst instances for 0, 2 and 3 Mirrors (94/157; 122/185/248; 231/294/357/399);
- C1, four fires taking 288f off the next E;
- C2 at 15/+100, then 184/+150, 222/+50 and 270/+50 with no bar at 278, and nothing after a swap;
- C4's party EM reading 2 Mirrors, the Dendro bonus at 212/10% (30% at C6), and no party EM with none consumed.

Corpus, the previous commit against this one: 11 of 1,152 rotations differ, 9 of them Alhaitham's and 2 Arlecchino's (item 4).

**Caveat wording, approved by Nate and landed:**

1. C2: "Each bar is one trigger's Mirrors. In game only four stacks run at once, so where bars overlap their total can read higher than in game."
2. C4: delete. Every value and start now matches, so no pixel is wrong.

## 7. Rulings and what stays open (2026-10-30)

- ⚓ Nate approved the wording and the rest of §6, and ruled the 233f interval and the C6 deferral (§5).
- **A Mirror count on the timeline**: recommended as Odette's stepped bar; waiting on Nate.
- **Arlecchino's two C2 clocks**: not a quick fix, recommended deferred; waiting on Nate. Her Q copy (cast pool) and Charged copy (swing surface) are two effects judged in two separate passes, and the passes do not run in time order. A shared clock therefore needs both triggers' instants merged per holder in time order first, plus a data field saying two effects are one ICD. She is the only author of the shape.
- The Electro Traveler's Falling Thunder is two damage effects with one ICD, authored before arrays existed in `onHit.abilityType`. Neither carries an `application[]`, so neither reaches a sim, and merging them would change nothing on screen.
