# Summon ticks → the stack machinery — spec

> **Status: SPECCED, NOT STARTED.** Written 2026-08-31 during Alyosha's Stage 2,
> at ⚓ Nate's request: queue the engine-touching half so it does not get mixed
> into a curation pass. ⛔ Nothing here is built.

## 1. The gap, stated exactly

A summon's damage tick reaches **two** of the four streams a hit can reach:

| stream                                                   | reached? | how                                                                                                                                 |
| -------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| the gauge (elemental application)                        | ✅       | `offerApplication`, live on the clock (`sim/aura.ts`, L5e)                                                                          |
| damage procs (`ctx.procs`)                               | ✅       | `notifyDamage` from inside the tick chain (`aura.ts:846`)                                                                           |
| artifact 4pc `onHit` windows                             | ✅       | synthesized hits at finalize (step 6c, 2026-08-15)                                                                                  |
| **character `onHit` buff / resShred bars**               | ⛔       | `hitsForTrack` (`buffWindows.ts:284`) selects `normal \| charged \| plunge` only, and a synthesized tick is tagged `skill \| burst` |
| **the stack machinery** (`gainStacks` / `consumeStacks`) | ⛔       | the tick chain calls `notifyDamage`, never `dispatchHit`                                                                            |

CLAUDE.md already names the second half — _"a summon tick feeding a STACK
effect stays unmodelled"_ — under the step-6c note.

## 2. ⚠️⚠️ The stated reason is now partly stale

The reason on record is:

> "These feed `deriveBuffWindows` ONLY and are deliberately NOT put through
> `dispatchHit` — that machinery mutates live state in PARSE order and a
> finalize-time hit cannot be interleaved without a two-pass parse."

That was true when summon-tick hits existed **only** as a finalize-time
synthesis. ⚓ **Since gauge round L5e the tick chain fires live on the clock** —
one tick at a time, each scheduling the next, each at a known monotonic instant
(`scheduleSummonTicks` in `sim/aura.ts`). A tick therefore already has a real
parse-order position, and `notifyDamage` already exploits it. The two-pass
objection does not apply to the live chain.

⚠️ It still applies to the **finalize** synthesis, which is a different thing
and must not be confused with it. Any change here belongs on the live chain.

## 3. The change

Roughly: the live tick chain calls into the stack dispatchers the way
`dispatchHit` does, at the tick's own instant, after the application and before
`notifyDamage` (so a proc can never observe half-applied stacks — the ordering
`dispatchHit` already documents). Then decide, separately and deliberately,
whether `hitsForTrack` should stop filtering to N/CA/P.

⚠️⚠️ **The blast radius is corpus-wide, and that is the whole risk.** Every
`onHit` `gainStacks` / `consumeStacks` effect in the corpus would start firing
off summon ticks, and every character `onHit` buff bar would too if the second
half lands. This is the same shape as step 6c and wants the same treatment: a
before/after measurement over all 123 characters, not a spot check.

⚠️ `teamHasOnHitStackEffects` currently gates the whole onHit settle path. It
would have to account for summon-hosted sources, or the gate silently keeps the
new dispatch off for most teams.

## 4. The first customer

**Alyosha's Tugarin.** His burst summons a companion that mauls every 2s, and
in game each maul **activates** an existing Hunter's Mark:

> "If an opponent affected by the Hunter's Mark effect is hit, the Hunter's Mark
> will also be activated." — Hunter's Advance

Hunter's Mark is authored as a stack resource (`huntersMark`,
`lifetime: 15`, `max: 2`) and the E / N4 half of the mechanic works today —
verified: `Alyosha N4 E` draws one 15s +21.2% ATK bar on the active character,
and it follows a swap to the incoming teammate. What does **not** work is
Tugarin, which is the activator that matters in play. It is caveated on the
burst.

⚠️ Note the C0 / C2 asymmetry, which an implementer will need:

- **C0** — the burst applies no mark. Tugarin's _first_ maul consumes the one
  mark that exists; the remaining six do nothing. Hunter's Precision runs 15s
  from that first tick.
- **C2** — "each time Tugarin attacks the opponent, he will also apply the
  Hunter's Mark to a target. **This effect does not activate existing Hunter's
  Marks.**" So every maul applies while the base activation still fires:
  Precision is effectively continuous, and ends 15s after the _final_ tick.

⚠️⚠️ That non-activation clause is load-bearing. A naive "a tick applies AND
activates" model would double-fire at C2.

## 5. What else is waiting on it

Not exhaustive — worth a census before starting, because the value of the round
is the length of this list:

- Alyosha C2's per-tick Hunter's Mark application (§4).
- Any future kit whose summon feeds a resource the player watches accumulate.

⚠️ And the reverse: the census must also find every effect that would begin
firing **unintentionally**. That set is the cost side of the measurement.

## 6. Sources

- `src/lib/sim/aura.ts` — `scheduleSummonTicks`, `notifyDamage`.
- `src/lib/sim/run.ts` — `dispatchHit` (gains → snapshot → consumes).
- `src/lib/utils/buffWindows.ts:284` — `hitsForTrack`.
- `docs/curation/engine-capability-rubric.md` § TRAPS — "Summon damage ticks are
  in THREE different streams with three different answers".
- `src/lib/data/characters/alyosha.json` — the burst's caveat and notes.
