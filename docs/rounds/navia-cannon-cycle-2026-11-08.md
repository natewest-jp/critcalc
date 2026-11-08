# Navia's Cannon Fire Support runs gcsim's gap cycle (2026-11-08)

Branch `fix/navia-cannon-cycle`, stacked on `fix/summon-landing-offsets`. From the
drift list in `audit-tick-instants-2026-11-08.md` §2 (−30f by the 17th shell).

## 1. The cadence

gcsim `navia/burst.go`: the support opens 154f after the cast and each shell lands
9f after its task. The loop sets the gap after each queued tick: 48f after the 2nd,
5th, 8th … (`tick%3 == 2`), 42f otherwise. From the cast: 163, 205, 253, 295, 337,
385, … 865, 17 shells. Ours was one 0.7s interval, so every third gap was 6f short.

## 2. The field

`summonTick.intervalCycle` (seconds): the gaps between ticks, the first entry after
tick 1, repeating. Navia carries `[0.7, 0.8, 0.7]`; `interval` stays 0.7, the modal
gap the cap's widening and the audit read.

- `nextTickAt(series, first, at)` became `tickAt(series, first, k)`, the instant of
  tick `k`. A cycle needs the tick's ordinal, which `at === first` could not give.
  The drawing walk and `aura.ts`'s three chains count every step of the cadence,
  skipped ticks included. `secondTickDelay` still wins for the first gap.
- The stack-moving chain's cadence key carries the cycle too.
- Lint: `summon-tick-interval-cycle-invalid` (two or more positive gaps).

**Rejected:** three series 132f apart, phased 0, 42 and 90f. It draws the same
instants, but splits one stream into three for the ICD counter, the stack
dispatch, and anyone reading the data.

## 3. Checks

- Tests: `summonTicks.test.ts` "Navia's Cannon Fire Support runs gcsim's 42/48/42
  gap cycle" (the lane's markers, and the gauge's applications on the same
  instants), written failing first; `characterLint.test.ts` for the lint.
- The audit's applied count is unchanged (6/17), and §5a goes from 7 to 6.
