# Amber's Fiery Rain is gcsim's three arrow loops (2026-11-08)

Branch `fix/amber-fiery-rain-waves`, stacked on `fix/navia-cannon-cycle`. From the
drift list in `audit-tick-instants-2026-11-08.md` §2 (+36f from tick 3, count 9→18).

## 1. The cadence

gcsim `amber/burst.go` queues three loops from burstStart (72f), each `i <= 120`:
every 24f (5 arrows), every 36f (3) and every 12f (10). 18 arrows on 10 distinct
frames, all one `ICDGroupAmber` counter (60f, every 3rd); gcsim applies 7.

Ours was one 0.2s series of 9: the stacked arrows and the one on the 2s end
(192f) were missing, so the drift was a pairing of 9 against 18 rather than a
timing error.

## 2. The data

Three series, in gcsim's queue order, on one named counter
(`icdCounter: 'amberBurst'`, the Alyosha mechanism) and one `icdGate`. The 12f and
24f loops carry `tickCap` 10 and 5 so the end arrow lands; the 36f loop's three
derive from the window (lint refuses a cap that restates the count). No schema
change.

The 2026-08-18 note rejected a cap because ten evenly spaced markers would hide
the stacks. Three series draw the stacks as the game has them, so that objection
no longer applies.

## 3. Checks

- Tests: `summonTicks.test.ts` "Amber's Fiery Rain is gcsim's three arrow loops
  on one counter" (the lane's 10 instants; the gauge's 7 applications at 84, 108,
  120, 144, 156, 180 and 192), written failing first.
- §5a goes from 6 to 5. §5b now reads "pair by eye (3 authored / 1 observed)":
  the audit compares instants only one-to-one, and the gcsim stream is one
  label. By eye: 10 + 5 + 3 = 18 and 7/18, both matching.
- On screen: the Fiery Rain lane draws one more marker, at the 2s end.
