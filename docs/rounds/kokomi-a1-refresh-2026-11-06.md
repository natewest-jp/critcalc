# Kokomi A1: the burst refreshes her Bake-Kurage (2026-11-06)

**Status:** on `feat/kokomi-a1-refresh`, stacked on `data/revelation-gcsim`, not merged. Second of three rounds in one unattended run. From a player report (2026-10-27) that Nate put in Next on 2026-10-28.

## 1. The mechanic

Tamakushi Casket: "If Sangonomiya Kokomi's own Bake-Kurage is on the field when she uses Nereid's Ascension, the Bake-Kurage's duration will be refreshed." gcsim `kokomi/burst.go` queues `a1` 46 frames after the burst. `asc.go` a1 then checks `Status.Duration("kokomiskill") > 0` and, if so, overwrites the status with `12*60+1` frames. The tick task re-checks the status before every tick and keeps its own 120f phase.

Measured in gcsim (E at f1, Q at f264): the jellyfish ticks at 25, 151, 271, 391, 511, 631, 751, 871, 991, which is 9 ticks. Without the burst it stops after 751, which is 7 ticks.

## 2. The primitive

`durationExtensions` only ever added a delta, and on a summon it was dispatched only for `onReaction` (Collei's A4). A refresh SETS the remaining life, and Kokomi's is triggered by her own burst cast.

**Built:** `DurationExtension` is now a union: either `delta` as before, or `refreshTo` (seconds left after the fire) with an optional `refreshDelay` (frames after the trigger, at which the window must still be live). `dispatchOnCastExtensions` (`sim/extensions.ts`) gained a summon branch. It skips the cast that spawned the record, checks liveness at `cast + refreshDelay`, and applies the refresh as a signed change to the record's `ownerUptime`. That is the one number the live tick chain (`sim/aura.ts` `ownEndNow`), finalize's uptime stamp and the marker walk already read, so the three agree by construction, and the tick phase is untouched. `SummonExtRecord` gained `spawnAt`, because the live end is `spawnAt + ownerUptime` and the record's `endTime` is cast-anchored. Lint D.33b: exactly one of `delta` and `refreshTo`; `refreshTo` positive; `refreshDelay` a non-negative integer; `refreshTo` only on a summon's `onCast` entry, the one path that reads it.

**Data:** the Bake-Kurage gets `durationExtensions: [{ trigger: { type: 'onCast', ability: 'burst' }, refreshTo: 12, refreshDelay: 46 }]`, and the passive gets `modeledBy` pointing at the skill. gcsim's +1 frame (a same-frame guard against its tick task) is not carried.

**Considered and not built**, for Nate to overrule:

1. A `Summon.refreshedBy` field of its own. It would be clearer to read in the data, but it's a second extension mechanism with its own dispatch, counts and liveness. The union keeps one.
2. Treating the burst as a re-spawn. That would reset the tick phase, which gcsim says doesn't happen.
3. Refreshing at the cast instead of at +46f. Simpler, but 46f early, and wrong exactly when the jellyfish dies inside those 46 frames.

## 3. Tests

`src/lib/sim/summonTicks.test.ts`, "Kokomi A1 Tamakushi Casket":

- E alone: ends at 774f with 7 ticks.
- Q at 263f: ends at 1029f (309 + 720) with 9 ticks, gcsim's count, and the 120f phase holds.
- The lane's markers equal the gauge's ticks with and without the refresh.
- A burst after the jellyfish is gone, or whose +46f lands past its end, changes nothing.

Gates: Vitest 2808 passed · svelte-check 0 errors · lint clean · build · Chrome e2e 73 passed.

## 4. Found on the way, not touched

- **Every Bake-Kurage tick after the first is 6 frames early.** gcsim queues the tick task at `skillHitmark + 126`, then every 120f: 24, 150, 270, … from the cast. Ours is `firstTickDelay: 0, interval: 2`: 24, 144, 264. It's a separate cadence fix: a 6f `firstTickDelay`-style offset after the first tick. The frames audit's summon-tick section is the place to read it before changing it.
- The same report's C4 ATK SPD stays unmodelled (attack speed is On hold).

## 5. For Nate

No copy and no visual change beyond what the mechanic implies: with E then Q while the jellyfish is out, the Bake-Kurage bar now runs to 12s past the burst, with tick marks to match.
