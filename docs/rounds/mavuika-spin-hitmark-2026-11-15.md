# Mavuika's spin hits one frame sooner (2026-11-15)

Branch `data/mavuika-spin-hitmark`, picked from the 2026-11-15 check-in.

## 1. What moved upstream

gcsim #3253 ("Mav bike frame fixes", `a72469a18`) changed two values in
`internal/characters/mavuika/`:

- `bikeChargeAttackStartupHitmark` 35 → 34 (`charge.go`). The first spin hit of
  a bike Charged Attack lands a frame sooner. A press out of a dash, a Normal
  Attack or her burst still skips 15 frames of windup, so that hit moves from +20
  to +19.
- The dash's `travel` minimum 6 → 2 (`dash.go`). The default stays 6, which is
  what `cancelDashTravel` models, so nothing here changes.

The frames audit stayed byte-stable apart from its hash, because `chargeSpin`
lives outside the frame maps it compares.

## 2. Re-measured with gcsim's CLI

Built from `a72469a18` into the session scratchpad, with one target 2.5m in front
(the setup of `docs/rounds/mavuika-nightsoul-round-2026-10-16.md` §7). The
frames are gcsim's (frame 1 = our 0).

| String                             | gcsim `b107b5dc5`                 | gcsim `a72469a18`                 |
| ---------------------------------- | --------------------------------- | --------------------------------- |
| `E Q CDCDCCF`: C, D, C, D, C, C, F | 135, 155, 161, 181, 187, 207, 249 | 135, 154, 160, 179, 185, 204, 246 |
| `hE`, wait 60, `C C` (fresh)       | (+35 in the October round)        | press 95, hits 129 (+34), 171     |
| `E Q`, wait 60, `C C` (fresh)      |                                   | press 195, hits 229 (+34), 271    |

Each further hit in a spin is still +42, and the finisher still hits +45 after
its release. `GetCAFDelay`'s window (spin frames 10–35) is a fixed range inside
a revolution and doesn't read the changed constant.

## 3. Built

- `mavuika.json`: `chargeSpin.firstHit` 35 → 34, with a ↻ line in her notes.
- `sim/nightsoul.test.ts`: the four bike Charged Attack tests that pin the first
  spin hit now expect +19 after a burst or a dash, and Prydwen's combo expects
  gcsim's new trace.

## 4. Found, not built

- ⚠️ **A spin straight after a Hold E skips its windup in gcsim.** `hE C` hits at
  +19 there (+20 before the change); the planner treats it as a fresh +34.
  `GetSkippedWindupFrames` skips 15 frames out of a skill recast state, or 13 if
  more than 45 frames of the recast cooldown are left, and 13 after a plunge.
  The planner's `startSpin` (`run.ts`) skips only after `D`, `Q` or a Normal
  Attack. This predates the upstream change, so it is a candidate for the to-do
  list.

## 5. Gates

Vitest 2955 passed · svelte-check 0 errors · lint clean · build · Chrome e2e 72
passed, 1 flaky: `site-chrome.spec.ts` "the brand holds still" logged the scene's
"GL mount failed EncodingError" again (first seen in
`docs/rounds/mitya-valeriy-ingest-2026-11-06.md`), which this data doesn't touch.
