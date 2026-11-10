# Neuvillette's short beam and Fagio's beams in Radiance (2026-11-10)

Two follow-ups to Sandrone's hold (`sandrone-hold-2026-11-10.md`), both picked by Nate.

## Neuvillette

- `C ~Xs` now ends Equitable Judgment early, at the last hit by that time and never before the first. A bare `C` still runs in full, and a time past the full beam leaves the rest as a wait.
- The time counts from the beam's start, after the windup and charge-up. It follows gcsim's `ticks` param, which ends only on a hit; `chargeForms.test.ts` holds gcsim's frames.
- gcsim refuses a Charged Attack straight after a shortened one. The planner draws it, with the usual end lag.
- A `C ~Xs` in an older rotation used to mean the full beam and then a wait, and it now means a shorter beam.

## Fagio's beams

- In Radiance, gcsim gives a condensed beam no gauge, so it applies nothing and takes no ICD count. `stellarRadianceAt` answers that from the Polestar Field or the 8s after a Stellar Swirl. The sim now records Stellar Swirl instants for it.
- Her Skill's second Prism Shot and her Burst's Ray still draw a nominal application in Radiance. Nate picked the beams only.

`typedTimeAfter` is now the one reader of a `~Xs` written right after an action, shared by Sayu, Sandrone, and Neuvillette.
