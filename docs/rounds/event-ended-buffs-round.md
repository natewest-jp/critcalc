# The event-ended buffs round (2026-09-21)

**A buff whose end is an EVENT, not a duration.** Queued by the cross-character
`onHit` round (`docs/rounds/cross-character-onhit-round.md` §1.5, §2.3), which left
Skirk's A4 un-authored because its honest bar was "a status ∩ a stance", and
noted that Illuga's "the effect ends when the stacks run out" was the same
problem from another side. ⚓ Nate, same day: make it a round. Branch
`engine/event-ended-buffs`.

Two primitives, four holders.

## 1. `whileState` — the buff exists only while its holder is in a state

```jsonc
{ "type": "buff", "trigger": { … }, "duration": 20, "whileState": "inStance", … }
```

The drawn window is the **INTERSECTION** of the window the trigger and
`duration` produce with the holder's `state` windows of that name. It can lose
its end (a stance cut by a swap), its start (a status gained before the stance
opened), both, or all of itself; one window can come back as several pieces.

⚓ **A different claim from a `state` CONDITION, which is an ENTRY TEST** (the
state-gates round's own words): that asks "was the state up when the trigger
fired" and then lets `duration` run. Nothing in that vocabulary can end a bar
early, and nothing in it can START a bar late.

### How it is built

`clipToHolderStates`, ONE pass at the end of `deriveBuffWindows`.

- ⛔ **Not at `emit`.** Several sites refresh a window in place after emitting
  it (`lastWin.end = buffEnd`), so a clip there would cut a span that is about
  to grow.
- ⚓ **Every surface gets it for free.** Intersection does not care whether the
  other side is a whole window or a per-receiver SLICE, so team, active-target
  and self windows are one rule. Illuga's C4 is an active-target buff and
  needed nothing extra.
- A window whose effects DISAGREE (one bound, one not) is split first; the
  unbound part keeps its span.
- `duration` is left alone — it is the effect's LENGTH, the tooltip's number. A
  received-surface piece is stamped `buffStart`, so the projection's
  `naturalEnd = buffStart + duration` lands past the clipped end and no seam is
  drawn there (the "a seam only at a NATURAL end" rule).
- Ids are renumbered only when something was clipped — they are emission order
  and nothing else — so a rotation with no bound effect returns the array it
  was handed, byte for byte.
- The spans are read straight off the IR's `state` windows, ⛔ not through
  `stateIndex` — that index is keyed on states some CONDITION gates, and a bound
  effect need not carry one (Skirk's no longer does).
- `normalizeBuffLikeEffect` carries the field across, since an `elevate` is
  CLONED on its way to the buff pass.

⚠️ The HOLDER's state, never the receiver's. ⚠️ `state` windows only:
`duringSummon`, `onField`/`offField` and the `after*` states have no such window,
and lint D.45 refuses them rather than let `whileState` delete a bar in silence.
(Gorou was offered a summon-bound end on 2026-09-21 and did not want it; that
door stays shut until a holder does.)

## 2. `consumeStacks.closesStateWhenEmpty` — a spent pool closes a state

The `onHit` spend that leaves its key at zero clamps a named state of the
holder's at the hit's instant, through the one off edge every other close uses
(`closeStateWindows`). `stacks.ts` does not import the sim context, so the two
call sites (`run.ts`'s `dispatchHit`, `aura.ts`'s tick dispatch) hand it a
callback.

With a buff bound to the same state, "the effect ends when the stacks run out"
is two fields and no new machinery — which is also how gcsim says it: a status,
deleted when a counter hits zero, that other code tests for.

⚠️ `onHit` consumes only (lint D.46). The cast-side dispatcher has no holder
asking, and ⛔ a field admits a reader only with its consumer.

## 3. The four holders

| holder                  | before                                                                                                           | after                                                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Varka A1 multiplier** | `onCast skill`, fixed 12s: 0–12s over a 1.22s swap-cut stance, and over a 14.3s extended one                     | bound; `duration` 14.3 (the stance's LONGEST length, 12 + the burst's 2.3). 0–1.22s · 0–14.30s · 0–12s                                                                                                                |
| **Skirk A4 (normals)**  | `onCast skill` + `inStance`, 12.57s: drawn from 0s with nobody having hit; 12.57s over a 0.55s early-exit stance | `onHit`, `source: 'others'`, `filter.element: [hydro, cryo]`, 20s refreshing, bound. Canonical rotation UNCHANGED (5.35–17.92s); Skirk-first draws nothing until a teammate hits; the early exit ends with the stance |
| **Skirk C2**            | `onCast burst` + `inStance`, 12.5s: 0.55–13.05s over a stance a swap ended at 1.40s                              | bound: 0.55–1.40s. gcsim's mod returns nil unless `skillKey` is active                                                                                                                                                |
| **Illuga C4**           | `onCast burst`, 20s, drawn to 20s over a long-empty pool                                                         | the burst opens `orioleSong` (20s, at the press); the spend is gated on it and closes it when empty; C4 is bound to it. `Illuga Q > Ningguang N1 N2 N3 N1 N2 N3 E`: state and DEF bar end at 11.68s                   |

Also, on the way:

- **Skirk's three Burst tiers gained `not inStance`.** `a4MultBurst` multiplies
  Havoc: RUIN only; hosted on a passive, the `onCast burst` tiers were also
  firing on the in-stance Havoc: Extinction (measured, +15% drawn at 12.67s
  inside the stance). ⚠️ Out of stance the tier is STILL not drawn — the burst's
  own Serpent's Subtlety `burstDmgBonus` wins the one-bar-per-stat dedupe — which
  is what her caveat's last sentence already says.
- ⚠️⚠️ **A curator note was wrong and is corrected at its site.** Illuga's
  2026-09-16 note said her A1 crit/EM bars should end with the pool. They should
  not: Lightkeeper's Oath is a flat 20s from the skill OR the burst in the kit
  text and in gcsim (`asc.go` `a1()`, called from both casts), and never reads
  the burst status. Only C4 does. ⚓ The third time in a week a queued item's
  premise did not survive reading the source; the first step of a data item is
  the kit text and the gcsim function, not the note that queued it.

### What is still a stand-in

- **Skirk's TIER is party composition** (`teamElementCount`), not a count of who
  has actually hit. A per-teammate count read at a teammate's hit needs a
  holder-side stack snapshot the buff pass does not have
  (`docs/rounds/cross-character-onhit-round.md` §1.3). Her caveat says so.
- gcsim requires the HITTER's own element to match the hit's; ours reads the
  hit's element only, so a Cryo-infused Hydro character's swing counts here.
- ⛔ **Zibai's C2** is the census's one other member (an `onCast` buff gated
  `inStance` at the stance's length) and stays as it is: he is absent from
  gcsim, and a stub with no source stays a stub.

## 4. Measured

- Site probe (`scratch/probe/ended.test.ts`), the table above.
- Buff digest: **4 of 252** moved — Skirk C0/C6 (she opens the digest's rotation,
  so her teammates hit after the stance has closed and the bar is honestly
  absent; the in-stance burst tier is gone) and Illuga C0/C6 (one new `state`
  window, no bar change — the digest has no Geo partner to empty the pool).
  Summon-aware digest: **10 of 630**, the same two.
- ⚠️ **Varka is invisible to both digests**: their party never meets A1's
  composition gate. The site probe is his measurement.
- The character index is unchanged.

## 5. Guards

- `buffWindows.test.ts` — "whileState" (four: the end lost to a swap-cut stance
  beside its unbound twin, the state's own end, the START lost to a status that
  predates the stance, a split window with unique ordered ids) and
  "closesStateWhenEmpty" (two: the last stack ends state and bar; an unspent
  pool leaves both whole). Five fail without the change.
- `characterLint.test.ts` — D.45/D.46, four cases.
- Gates per commit: vitest 1984, check, lint, build.

## Notes carried over from Claude's working memory (2026-10-29)

From `docs/rounds/event-ended-buffs-round.md`: merged as `59d27895` (e2e 73 + 73 green on `8c6e4e47`) and pushed 2026-09-21.
