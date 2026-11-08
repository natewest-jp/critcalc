# The frames audit compares every tick instant (2026-11-08)

Branch `chore/audit-tick-instants`. Prompted by Kokomi's Bake-Kurage
(`kokomi-kurage-ticks-2026-11-08.md`): its 6f second gap was invisible to §5, which
compared only the first tick and the modal interval, and flagged a stream as
irregular only at three or more distinct gaps.

## 1. The change

- `authoredTicks` walks each damage series through the planner's own
  `collectSummonTicks` (imported, not restated) for every instant.
- On a one-to-one pairing, §5 compares ours against every tick gcsim fired, over
  the ticks both sides have, and prints `⚠️ drift up to ±Nf, from tick k`.
  Negative is ours early.
- New §5a lists the drifting streams, and the coverage line counts them.

## 2. The first reading: 13 streams

Not yet read against the Go, so these are candidates, sorted by what the numbers
alone suggest:

- **Look first:** Navia's Cannon Fire Support (−30f; gcsim fires a 42/42/48
  pattern), Amber's Fiery Rain (+36f from tick 3), Mizuki's Munen Shockwave
  (−18f), Ineffa's Birgitta (+9f from tick 2, both forms; the Kokomi shape?).
- **Probably rounding:** Durin's two dragons (+4f, +6f; gcsim alternates 58/59 and
  73/74, ours steps a rounded whole frame), Gorou (−1f), Kuki (−2f), Yae (−1f).
- **Known, and drifting by construction:** the Cryo Traveler's Frostpierce Star
  (paired shots 13f apart; the count check already says 4→8) and Fischl's Oz from
  her burst (−118f; Oz's burst geometry, named in `.claude/rules/scripts.md`).

The regenerated report also carries yesterday's Lan Yan rows (a new uncovered map
and an unobserved schedule), which no audit run had picked up.
