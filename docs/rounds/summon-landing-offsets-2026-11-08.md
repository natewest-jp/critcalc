# Five summon tick streams land on gcsim's instants (2026-11-08)

Branch `fix/summon-landing-offsets`. The first round off the drift list in
`audit-tick-instants-2026-11-08.md` §2. Each stream was read from the Go; all five
are data, with no engine change.

## 1. A tick is its hit, not its task

gcsim's tick tasks call `QueueAttack(ai, pattern, delay, …)`, and the hit lands
`delay` frames after the task. Our `firstTickDelay` sat on the task frame.

- **Gorou**, Crystal Collapse: delay 1 → `firstTickDelay` 1.517 (91f). The C4 heal
  stays on the task frame (`Player.Heal` is immediate).
- **Kuki**, Grass Ring of Sanctification: delay 2 → 1.533 (92f) on the damage
  series; the heal in the same `bellTick` stays at 1.5. The tick cap still widens
  the window by one interval, so 8 (10 at C2) land.
- **Yae**, Sesshou Sakura: delay 1 → 1.45 (87f).

## 2. Two that were not landing delays

- **Mizuki**, Munen Shockwave: a snack spawns every 90f from the hitmark, and
  `snack.go` refuses a pickup for 0.3s. The shockwave (or heal) is the pickup, so
  both series move to 1.8 (108f), the earliest pickup. An unpicked snack explodes
  4s later; the series draws the earliest case.
- **Ineffa**, Birgitta (skill and burst): `birgittaDischarge` re-queues every
  119f, not 120f → `interval` 1.983. The Kokomi second-gap shape the drift list
  guessed at was not it.

## 3. Checks

- Tests: `summonTicks.test.ts` "summon ticks land on the frame gcsim deals their
  damage", one case per stream, written failing first.
- The audit's applied counts are unchanged (Gorou 3/5, Kuki 4/8, Yae 8/8, Mizuki
  4/8, Ineffa 10/10), and §5a goes from 13 streams to 7.
