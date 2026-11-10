# Sandrone's held Charged Attack (2026-11-10)

Nate wanted a bare `C` to run to its longest length before overheating, with `~Xs` to set a different hold. gcsim already models Fagio's Decoding Power in full, so this round ports it.

## What landed

- `ChargeHold` (data) and `sim/chargeHold.ts` (logic), with heat tracked across the whole rotation: gain per tick and per beam, cooling on and off field, the E's vent, the 19-frame delay into Power Overdrive, and C1.
- A bare `C` holds to the last beam that fits under the cap, read from the heat at the press. gcsim's default errors when the gauge is too hot; here it fires what fits, or gives the shortest press if nothing does.
- `C ~Xs` is gcsim's `frames` param, as Sayu's hold takes it. The time counts from the first tick, so the block is longer by the windup and end lag. Past the cap it draws Overdrive's slower fire.
- Fagio's sweeping fire, beams, and Overdrive shots now reach the aura lane, each on gcsim's ICD.

## How it was checked

Each expected number in `chargeHold.test.ts` was read from gcsim's debug log at v2.50.0: cold, C1, a set hold, past the cap, the E, off-field cooling, and a warm gauge.

## Worth knowing

- gcsim's bare hold ends with no end lag, because it zeroes the hold length on exit. A set hold keeps its end lag. Both follow gcsim.
- No heat readout, by Nate's ruling.
- In Radiance gcsim's beams carry no gauge. They are drawn nominal here, like the E's second shot and the Q's Ray.
- A1's Refined Tactics stay unmodelled.
- C4's extra cannon and C6's Condensed Cluster Beam are not drawn. gcsim marks both hitmarks as TODO.
