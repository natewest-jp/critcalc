# Stepped stacks round (2026-09-27)

Branch `data/gcsim-sync-2026-09-27`. Started as the gcsim sync's Odette item
(#3020 — a Q onto a standing Dance Double must not refill Marvelous Splendor)
and grew once gcsim's `a1Ticker` showed the mechanic we did not have at all.

## 1. What the game does (gcsim `odette/asc.go`, `cons.go`)

- A fresh summon (E, or a Q with no Double up) sets Odette's count to max
  (4, 6 at C1) and the party's to 0. A Q onto a standing Double changes
  neither (#3020).
- Every 59.25f from the summon, while the Double lives, a tick with Odette
  **off field** moves 1 stack (2 at C1) from her to the other party members'
  shared count, capped at max. At C6 she keeps hers (`c6a1ReduceMod`).
- A1: `count × 15%` Stellar Glimmer DMG — hers for her, the party's for them.
  C2: `count × 7%` ATK, both sides. C6: Odette elevated 45% while she holds
  stacks, everyone else 25% while they hold theirs. All gated on the Double.

## 2. What shipped

**Engine — four general shapes, each usable beyond Odette:**

1. **`Summon.opensState`** — a named state that lives exactly as long as that
   summon (opened at the spawn, closed and reopened by a recast). Named states
   are closed-world in the live dispatchers; `duringSummon` never is (§4).
   Lint D.22c refuses it beside an end the spawn cannot know.
2. **Stack effects on a summon's tick** — `gainStacks` / `consumeStacks` may
   take a `summonTick` trigger. Rotation-scoped keys only (lint B.13m), gains
   before consumes so a MOVE gates both halves on the source's pre-tick count,
   `onField`/`offField` answered live from `ctx.activeCharId`. ⚓ No markers:
   the lane marks hits and heals only (`isMarkedTickEffect`).
3. **The stack ledger** — every change to a rotation-scoped count, stamped by
   the sim clock (`SimContext.stackHistory`). Written by a `Map` subclass that
   IS `rotationStacks`, so no write site has to remember to report.
   ⚠️ Lifetime drops are swept late, which is why (4) refuses lifetime keys.
4. **`whileStacks: key`** — a buff that IS its count: its window is each span
   the holder held the key above zero, anchored on no cast, so an E, a
   refreshing Q and the ticks between them are ONE bar. A `perStack` value on
   the same key carries `stackSteps`. Named after its `attribution`, else its
   hosting entry. Lint B.20.

**Display — the stepped bar (⚓ Nate's pick of three, 2026-09-27).** One bar
per buff; hard density steps in the ramp envelope's grammar (thinner glass =
fewer stacks, floor 0.5 of the material); the tooltip follows the pointer and
reads the step under it (`Odette Marvelous Splendor ×3 · +45%`). Rejected: the
Columbina overlap (cannot show a count that FALLS) and seamed segments (a comb
of unlabelled 1s pieces). The PNG export paints the same steps — the step's
fill is `CHART_BG` moved toward `BAR_FILL` by its density, exact because the
composite is linear in alpha. `$lib/timeline/barSteps.ts` owns the density
rule for both.

**Riders:**

- `clipToHolderStates` merges touching/overlapping state spans before
  clipping. Needed so a refreshing Q does not break the bar; it also removed
  a duplicated Illuga C4 DEF window (two identical 1023–1286 pieces from
  overlapping Oriole-Song records) — the only other digest that moved.
- `stackScopesOf` and lint D.39 walk summon effects (a key granted only by a
  tick was filed as `'segment'` and silently dropped).
- `isPctStat` covers `*ReactionBonus` — the bucket-5 family printed `+50`
  for "increased by 50%" since it was introduced.

## 3. Measured

`Odette E > Ningguang N1×10 > Odette Q N1 > Ningguang N1×6`:

|                  | C0                                      | C2             |
| ---------------- | --------------------------------------- | -------------- |
| Odette's own bar | 23→259, 4→3→2→1                         | 23→200, 6→4→2  |
| party bar        | 82→1864, 1→2→3→4 (one bar across the Q) | 82→1864, 2→4→6 |

C6: she holds 6 for the whole Double while the party fills 2→4→6. Staying on
field transfers nothing. Corpus digest (every character + `> Kaeya E N1 N2 N3

> Xingqiu E Q N1 N2 N3 > <char> E N1 Q`, C0/C6): **3 of 252** move —
> odette@C0/C6, illuga@C6 (the duplicate above). Team Builder: the A1 and C2
> buffs now derive as TEAM buffs (they were self-only).

## 4. Why not `not duringSummon`

Tried first and it cannot work: `liveNegatedStates` never negates
`duringSummon` (the live resolver counts stationary summons only and reads a
pre-extension uptime), and Odette's Double declares no mobility, so it was not
even "up". The gate was `null` forever and a bare Q lost its grant.

## 5. Open

- A Q that refreshes the Double restarts the tick chain from its own spawn;
  gcsim keeps the old phase (under a second of drift per refresh).
- The Team Builder's Compare lanes are built from cast-anchored buffs; a
  `whileStacks` buff has no cast and no duration, so Odette's A1/C2 likely
  drop off her lanes — ⚠️ not checked on screen.
- The C6 self elevation is one 45% effect (25% + her additional 20%) so a stat
  dedupe cannot split them.
- ⏭ Nate judges the stepped bar on screen (density floor, tooltip).

## Notes carried over from Claude's working memory (2026-10-29)

From `docs/rounds/stepped-stacks-round.md`:

- 🐛 Fixed in `fc77bcb4` (found by Nate at C2): keying received rows by stat made two rows share `receiver::label`, and the chart's `{#each}`, keyed by that alone, hit `each_key_duplicate` and froze the planner. Rows now carry their map key (`recRow.key`), guarded by `src/lib/timeline/buffRowKeys.test.ts` (`a2cc8c8d`). The lesson, the third time it has bitten: any change to a projection's dedup key must move the template's render key with it.
- Merged `094b3a81` and pushed 2026-09-27 (e2e 78 + 78 green on the merged main).
