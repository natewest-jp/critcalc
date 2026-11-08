# A teammate's onHit grant lands in a rotation-scoped key's home (2026-11-08)

Branch `fix/gainstacks-onhit-scope`. The bug from
`mitya-valeriy-ingest-2026-11-06.md` §3.1, which blocked Valeriy's A1.

## 1. The bug

`dispatchGainStacksOnHit` (`sim/stacks.ts`) wrote every `source: 'team' | 'others'`
grant to `CharState.onHitStacks`, whatever the key's scope. Valeriy's skill grants
the same key, Impact Momentum, into `rotationStacks`. At the next settle point
`syncRotationStacksToStackState` and `syncOnHitToStackState` each wrote the turn's
copy, the second with the onHit pool's count, so the two pools never added up.

Measured before, with a fixture carrying the A1 shape (+5 per Electro hit from
someone else): `Valeriy E > Raiden Shogun E > Valeriy E` read 80 at the second E,
where 40 + 5 + 40 is 85.

## 2. The fix

- The team/others arm writes a rotation-scoped key to `rotationStacks`, and
  anything else to `onHitStacks` as before. The consume arm already asked `homeOf`.
- `syncOnHitToStackState` skips rotation-scoped keys, which have their own sync.
- Lint: `gainstacks-scope-redundant` is retired. It refused `scope: 'rotation'` on
  a team/others grant because the count would split between two pools, which was
  this bug; with one home its reason is gone, and it forbade the shape D.39 now
  requires (every grant of a key declares its scope).
- Lint: `gainstacks-onhit-unbounded` accepts a rotation-scoped key with a `max`,
  a resource the holder spends. Without a `max` it still refuses.

No corpus character carries a team/others grant of a rotation-scoped key yet, so
nothing on the site moves until Valeriy's A1 is authored.

Tests: `notationParser.test.ts` "a teammate's onHit grant lands in a
rotation-scoped key's home" (written failing first: 80, 80), and two
`characterLint.test.ts` cases.

## 3. Left for Valeriy's A1

The A1 itself is a data round: the grant needs gating to "while the Thunderburst
Shells are falling" and to its 80-per-burst cap, which is a separate count from
the key's `max`. Read the kit and the Extra Effect text first.
