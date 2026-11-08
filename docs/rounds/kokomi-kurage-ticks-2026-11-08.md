# Kokomi's Bake-Kurage ticks on gcsim's instants (2026-11-08)

Branch `fix/kokomi-kurage-ticks`. Found in `kokomi-a1-refresh-2026-11-06.md` §4.

## 1. The cadence

gcsim `kokomi/skill.go`: one tick at the hitmark (24f), and the repeating task is
queued at `skillHitmark + 126`, then every 120f. From the cast: 24, 150, 270, …,
750, seven ticks (the status is `12*60+30+1`, so 750 still fires). With the burst's
A1 refresh (E, then Q at 263f): nine, the last two at 870 and 990.

Ours was `firstTickDelay: 0, interval: 2`: 24, 144, 264, …, 744, so every tick
after the first was 6f early.

## 2. The field

`summonTick.secondTickDelay` (seconds, first tick → second; defaults to
`interval`). Kokomi's three Bake-Kurage series carry `2.1`.

- `nextTickAt` (`sim/summons.ts`) is the one step every tick chain takes: the
  drawing walk (`collectSummonTicks`), `aura.ts`'s live damage/heal chain
  (including its two skip paths) and its stack-moving chain, which now groups
  series by first delay, second gap and interval.
- Lint: `summon-tick-second-delay-invalid` (positive seconds).

**Rejected:** two series (one tick, then a capped series from 2.1s). A cap and a
duration extension don't compose, and the burst's refresh is exactly that.

**The audit can't see it.** `audit-gcsim-frames.mjs` §5 reports the first tick
and the interval on both sides ("24f / 120f × 7"), so a second gap is invisible
to it, in gcsim's capture and in ours. The instants come from reading the Go.

Tests: `summonTicks.test.ts` "Kokomi A1 Tamakushi Casket", whose instants were
updated to gcsim's first (failing), and whose "markers and gauge read one answer"
case holds both readers to them.
