# Durin's dragons tick on gcsim's fractional cadence (2026-11-08)

Branch `fix/durin-dragon-cycles`, stacked on `fix/amber-fiery-rain-waves`. From the
drift list in `audit-tick-instants-2026-11-08.md` §2 (+4f and +6f, "probably
rounding").

## 1. The cadence

gcsim `durin/burst.go` queues tick i at `ceil(first + 58.8·i)` (White, first 155.2)
and `ceil(first + 73.6·i)` (Dark, first 175.4, then 9f travel). The gaps alternate
58/59 and 73/74. Ours rounded the interval once (59f, 74f) and walked it, so the
error grew to 4f and 6f.

## 2. The data

Five intervals are whole frames (294f, 368f), so the ceil'd gaps repeat every five
ticks: `intervalCycle` [58, 59, 59, 59, 59]f for White and [73, 74, 74, 73, 74]f for
Dark, the field from `navia-cannon-cycle-2026-11-08.md`. No engine change.

**Rejected:** fractional frames in the walk (accumulate `interval·60` exactly,
ceil each instant). The corpus has a dozen series whose seconds are rounded
whole frames (Baizhu 2.43 for 146f, Furina 3.369), and a ceil would push them
a frame late. Telling the two apart would need a new flag, and the cycle is
exact here.

## 3. Checks

- Tests: `summonTicks.test.ts` "Durin's dragons tick on gcsim's fractional
  cadence", both forms, written failing first. `notationParser.test.ts` "C1's
  Dark half" ends 3f earlier (690 → 687): its tenth Burst hit is a Dark tick.
- Applied counts unchanged (10/20, 8/16). §5a goes from 5 to 3. What remains is
  known: Fischl's burst Oz (its geometry, `.claude/rules/scripts.md`) and the
  Cryo Traveler's paired Frostpierce shots (the count check's 4→8).
