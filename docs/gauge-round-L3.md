# L3 — The clock-driven core

**Status:** planned 2026-08-16 · not started
**Landing:** [`gauge-round.md`](gauge-round.md) §L3, against contracts **C2**, **C5**, **C6**.
**Shape:** no behaviour change. The IR must come out byte-identical, ids included.

> Move the rotation parser from a token-driven interpreter to a clock-driven state
> machine, so that L5's gauge has somewhere honest to live. ⛔ Not a rewrite —
> `parseNotation`'s door stays fixed and the room behind it is rebuilt in verified
> steps. ⛔ Not fanned out (`gauge-round.md` §7): one head, small steps.

---

## 1. What the read found

Re-reading `notationParser.ts` (5,051 lines) and `buffWindows.ts` (1,796) end to end,
against the census in the contract doc:

⚓ **The loop shape barely changes. What changes is what the parse can DEFER.**
Today's parse is already a single forward pass in time order — `cursor` is monotonic
across segments, `localCursor` monotonic within one — so there is no "reorder the
tokens" problem to solve. Every retroactive patch the contract lists (§2's table) has
the same shape: _something later changes something already done_, because there is
nowhere for a consequence to WAIT. That is the hole the clock fills.

⚓ **The real bulk of the work is lifting closures, not writing a scheduler.**
`parseNotation` is one 2,675-line function body holding **17 parse-scope closures**,
**6 segment-scope closures** (one of them `handleCast`, ~500 lines), and **~20 mutable
state containers** that all of them close over. Nothing can be moved onto a clock
until it can be CALLED from outside that body. So L3's mass is a mechanical
extraction against an explicit context object — and that is the part the existing
1,474 tests already guard.

Inventory, parse scope: `closeStateWindows` · `openTransientState` · `castKinds` ·
`getCharState` · `holderStatesAt` · `getChainIndexMap` · `advanceChain` ·
`dispatchOnCastExtensions` · `dispatchOnReactionExtensions` · `registerShieldOnCast` ·
`dispatchShieldEnds` · `applyDrain` · `applyLifetimeExpiry` · `registerInfusionsOnCast` ·
`infusionAt` · `emitReactionsForApplication` (+ `AtCast` / `AtSwing`).
Segment scope: `emitAction` · `computeCurrentStates` · `nextOwnWindowEnd` ·
`settleStacksAt` · `dispatchHit` · `handleCast`.

⚠️⚠️ **Six of the state containers are ALIASED, and the aliasing is load-bearing.**
This is the single most dangerous thing about a mechanical extraction, because a
refactor that copies where the original aliased breaks silently and passes typecheck:

| alias                                                | who mutates it later                                    |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `stanceWindowRecs.push(cs.stance)` — the SAME object | `st.end += delta`, the swap clamp, the finalize stamp   |
| `summonExtRecs.push(cs.summonExt)`                   | extension deltas, the finalize `castRef.uptime` stamp   |
| `StanceRecord.castRef` / `SummonExtRecord.castRef`   | finalize writes `uptime` back onto the live `CastEvent` |
| `castIdByBar` — keyed by BAR OBJECT identity         | the summon-window pass                                  |
| `summonByWindow` — keyed by WINDOW OBJECT identity   | step 6c's off-field hit synthesis                       |
| `reactionEventIndex` (buffWindows) — EVENT identity  | the per-application reaction pooler's merge key         |

⚠️ `hit.stacks` is likewise a live `Map` handed to `dispatchHit` and read again by
`deriveBuffWindows`; `sameStacks` compares by value but `sameEffects` compares by
**reference**. Cloning an effect array anywhere in the chain silently splits a merged
buff bar into two.

---

## 2. ⚓⚓ The clock JUMPS. It does not walk frames.

**Measured on `main`, before any change** (parse cost, mean of 10 after warmup):

| fixture                                                    |    now | shape                              |
| ---------------------------------------------------------- | -----: | ---------------------------------- |
| short 4-char rotation                                      | 0.6 ms | 25 events, 12 windows              |
| realistic 20-cycle (80 segments)                           | 3.7 ms | 500 events, 240 windows, 418 s     |
| summon-heavy 20-cycle                                      | 3.3 ms | 219 events, 160 windows, 492 s     |
| `99[N5C]` bracket bomb                                     | 0.4 ms | 596 events                         |
| 400× `Q E` cast spam                                       | 4.4 ms | 800 events, 6,213 s                |
| ⚠️ **14 KB of `~3600s` waits** — legal input, 2,000 tokens | 4.3 ms | **432,000,000 frames** (2,000 hrs) |

That last row is the design constraint, and it **overturns C6's reasoning**. C6 says
the frame loop's cap "derives from `MAX_TIME_ADVANCE_S` → 216k frames — not a fresh
magic number". It does not: 216k bounds ONE token, and a document full of waits sums.
14 KB of legal, non-pathological notation reaches 432 million frames, which a
`for (f = 0; f <= end; f++)` loop would walk. At an optimistic 10 ns/iteration that is
4+ seconds of frozen tab — the exact failure class
`docs/parser-hardening-2026-08-14.md` closed, reintroduced by the architecture.

⚓ **Therefore: the clock advances to `min(next task, actor free at)`, always. There is
no frame loop and so there is no frame-loop cap.** The existing token caps
(`MAX_NOTATION_CHARS`, `MAX_EXPANDED_TOKENS`, `MAX_TIME_ADVANCE_F`) continue to bound
the work, because the work is proportional to **scheduled instants**, not to time.

⚠️ This survives L5. The gauge's continuous decay is bounded by **aura lifetime**
(`2.5·U + 7` s), not by rotation length: `gauge.ts` already breaks its own frame loop
the moment every mod is empty. So a 2,000-hour idle advances the clock once and runs
the gauge's catch-up over the ~30 s it can still be alive. ⛔ Do not hand the gauge a
span and let it step to the end of it.

**Perf budget for this landing:** no fixture above regresses past **1.5×**, and the
wait-bomb stays **O(tokens)**. Re-measure at L3a and at L3e and record both here.

---

## 3. The design

### 3.1 `$lib/sim/` — the module map

`notationParser.ts` shrinks to a **façade**: the doc header, `parseNotation`
(tokenize → segments → run → author), and the re-exports every consumer already
imports. Target ~150 lines. ⛔ No consumer's import statement changes in this
landing — 22 files import from `$lib/utils/notationParser` and all 22 keep working.

| module          | holds                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `clock.ts`      | the frame clock + task queue: priority bands, skip-ahead, deterministic same-frame order                                               |
| `context.ts`    | `SimContext` — the parse-scope state the 17 closures share, plus `nextId`/`emit` accessors                                             |
| `charState.ts`  | `CharState`, `StanceRecord`, `SummonExtRecord` + factory                                                                               |
| `conditions.ts` | `evalCondition`, `findChainStage`, `applyModifiers`, `matchVariant`, `resolveEffectiveCharges`                                         |
| `resolve.ts`    | `resolveActiveAbility` / `…AbilityTiming` / `…ActiveDuration` / `…StanceFields` / cast-time trio                                       |
| `tokens.ts`     | `expandBrackets` + its two caps + `peekActionKey`                                                                                      |
| `states.ts`     | `inferredStates`, `computeCurrentStates`, `holderStatesAt`, `openTransientState`, `closeStateWindows`, `nextOwnWindowEnd`, `castKinds` |
| `cooldowns.ts`  | charge queues, `qReadyAt`, sac-proc, `getCharacterCdResetTargets`, chain index/advance                                                 |
| `stacks.ts`     | the six gain/consume dispatchers, three syncs, `applyDrain`, `applyLifetimeExpiry`                                                     |
| `hits.ts`       | `HitEvent`, `onHitTriggerMatches`, `dispatchHit`                                                                                       |
| `aura.ts`       | ⚓ **the L5 seam** — `AuraState`, reaction computation, `emitReactionsFor{Application,Cast,Swing}`, the ICD clocks                     |
| `shields.ts`    | `registerShieldOnCast`, `dispatchShieldEnds`                                                                                           |
| `infusions.ts`  | `registerInfusionsOnCast`, `infusionAt`                                                                                                |
| `extensions.ts` | the two `durationExtensions` dispatchers                                                                                               |
| `summons.ts`    | `findSummonsForBar`, `summonSpan`, `collectSummonTicks`, `computeSummonTicks`, `computeSummonDamageTicks`                              |
| `cast.ts`       | `handleCast` — the frozen E/Q pipeline                                                                                                 |
| `actions.ts`    | the N / C·A / P / D·J / `~Xs` / `~?s` / `{k:N}` branches                                                                               |
| `finalize.ts`   | uptime stamps, bar + block projection, window authoring, NB, off-field hits, the buff-derivation call                                  |
| `run.ts`        | the driver: segments → turns → the clock loop                                                                                          |

⚓ **`conditions.ts` deletes the documented benign cycle for free.** `buffWindows.ts`
imports `evalCondition`/`onHitTriggerMatches` from the parser, which imports
`buffWindows`; both sides carry a comment excusing it. With those two in a leaf
module the cycle is simply gone. Zero risk, and it stops being something a future
reader has to be told is fine.

⛔ **`buffWindows.ts` does NOT move and does NOT get clocked** — see §4.1.

### 3.2 The clock

```ts
type Band = 0 /* EXPIRE */ | 10 /* TICK */ | 20 /* LAND */ | 30 /* ACT */;
schedule(frame: number, band: Band, run: () => void): void;
```

- **Skip-ahead** (§2): `now = min(queue.peekFrame(), actor.freeAt)`. Never `now++`.
- **Same-frame order = (band, insertion)**, and insertion order must itself be
  deterministic. ⚠️ Where a task is created while iterating a `Map` keyed by
  character id, sort by a total order first — `dispatchShieldEnds` already does
  (`endTime, holderId`) and that precedent is the rule, not a local fix.

**The bands, and why they are in this order:**

| band       | holds                                                                 | why it must precede the next                                         |
| ---------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **EXPIRE** | window/state/shield expiries, ICD + procCooldown resets               | a thing that ends at F must have ended before anything at F reads it |
| **TICK**   | summon ticks, DoT ticks, gauge decay (L5)                             | consequences of things already running, before anything new starts   |
| **LAND**   | scheduled hits/applications from earlier casts (L4's `application[]`) | a hit in flight lands before the next input is taken                 |
| **ACT**    | the actor pops a token and runs the frozen pipeline below             | —                                                                    |

⚠️ At L3 only EXPIRE and ACT carry anything. TICK and LAND exist as declared, empty
bands because they are the contract L4/L5 build against — ⛔ but the band list is
tested (`clock.test.ts` pins the ordering) rather than merely written down, or it is
a speculative abstraction with a comment on it.

### 3.3 The frozen within-ACT pipeline

Lifted verbatim from `handleCast`'s own comment — _"Order-of-operations is this
parser's top bug class — do NOT reorder shared steps"_ — and made explicit so the
clock can't be blamed for a reorder nobody intended:

1. **gate** — burst CD / `bypassesCooldown`; the skill charge-wait forward scan
   (⚠️ `scanGuard < 8` is behaviour-defining; carry the 8 verbatim)
2. **expire** — `dispatchShieldEnds(now)`
3. **settle** — states → drain → lifetime → sourceLifetime → onReaction → onHit sync
4. **resolve** — active ability, then variant, then timing
5. **gain** — `dispatchGainStacks`, then the stack snapshot
6. **emit** — the `cast` event (the id every window below cites)
7. **consume** — `dispatchConsumeStacks`
8. **open** — stance / transient state / summonExt / shield / infusion windows
9. **apply** — reactions, then the cast's own hit
10. **extend** — `dispatchOnCastExtensions`

### 3.4 The turn

A segment becomes a **turn**: `{ actor, track, stackState, stackInstances,
normalCounter, lastEText, freeAt }`. The driver walks turns; a turn ends with the
min-active clamp, the `terminatesOnSwap` clamps (states, then stance, in that order —
the stance clamp also moves `readyAt` and the charge queue), and `now += swapF`.

⚠️ Modelling the swap as an explicit turn boundary rather than an event is deliberate
for L3: making it an event changes nothing today and would need its own differ
argument. L5 can promote it when off-field ticks need to interleave across it.

---

## 4. The rulings

### 4.1 ⛔ Buff derivation stays a finalize projection

C2's warning — _"buff-window emission order is a VISIBLE undeclared invariant … the
single most dangerous hidden coupling in the refactor"_ — is answered by **not
touching it**. `deriveBuffWindows` consumes `tracks` + `hits` + the sorted event and
window streams and assigns its own ids in its own iteration order. Feed it identical
inputs and it produces identical output _by construction_.

⚓ So the hazard closes rather than being watched: at L3 there is no clock-driven
buff emission to emit in a different order. C5's "`buffWindows.ts` moves with the
refactor" is satisfied by it moving **module-wise if at all** — and the ruling here is
that it does not move at all, because relocating a 1,796-line file whose algorithm is
unchanged is churn that the differ would have to justify.

### 4.2 ⛔ Nothing migrates onto a task in L3 that is order-VISIBLE

Four of today's retroactive patches are candidates. Their verdicts:

| patch                                                | L3 verdict | why                                                                                                                                                              |
| ---------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| stance / summonExt **uptime stamps** at finalize     | ✅ migrate | values only, no emission — and it deletes `inferredStates`' documented LATENT TRAP, which the differ proves inert over the corpus                                |
| **stance/state expiry** (polled via `end > cursor`)  | ⏸️ keep    | emits nothing; polling is cheaper than scheduling. A task buys nothing until something must FIRE at the expiry                                                   |
| **shieldEnd** drain at cast sites                    | ⏸️ keep    | `shieldEnd` is a public IR event: scheduling it moves its id and its tie position. No visual consequence, no gain yet — ⛔ don't spend the differ's budget on it |
| **NB derivation** + **summon-tick hits** at finalize | ⏸️ keep    | these are L5's payoff and need the gauge. Moving them now changes `hits` order for nothing                                                                       |

⚓ **The discipline: L3 changes the machine, L5 changes the answers.** A strangler
that alters structure and behaviour in one step has no gate left.

### 4.3 ✅ `findCastSummons` is deleted; `findSummonsForBar` is the one resolver

The two are character-for-character identical and carry a mutual "MUST STAY
IDENTICAL" warning — coupling #1 on the contract's risk list. `summonSubrows.ts`
already imports `computeSummonTicks` back from the parser, so it imports this the
same way and the fork ends.

⚠️ That weakens `notationParser.ir.test.ts`'s claim to an _independent_ oracle
(coupling #2), and the trade is worth stating rather than papering over: the test's
value is that it reconstructs summon **geometry** independently — spawn offset,
swap/recast truncation — from `result.tracks`. Sharing the **resolution** primitive is
honest; keeping two copies that must agree is how they drift.

### 4.4 Contract amendments

Both are recorded in `gauge-round.md` §3 in the same commit as L3a.

- **C6** — ⛔ strike "the frame loop's own cap derives from that last one". There is no
  frame loop; the clock skips to the next scheduled instant. Measured basis in §2.
- **C6** — the band list is now written down (§3.2) and pinned by `clock.test.ts`.

---

## 5. The differ

⚓ **Two engines, one shared tail.** At L3d the driver swaps; until then the gate is a
frozen copy. `src/lib/utils/notationParser.legacy.ts` is `main`'s parser, unmodified,
deleted whole in L3e. It imports the LIVE `deriveBuffWindows` on purpose: both
engines derive buff windows from their own inputs, so a difference there **proves a
difference in the inputs** rather than adding a second thing to keep in sync.

⛔ Not a committed golden snapshot. A snapshot only covers what was snapshotted; a
live second engine diffs any notation, which is what makes bisecting an extraction
cheap.

The comparator asserts **three surfaces**, in this order:

1. **STRICT** — `tracks` / `events` / `windows` deep-equal INCLUDING `id` values and
   array order. The default gate; every extraction commit must pass it.
2. **CANONICAL** — id-stripped, per-kind, sorted. A **diagnostic**, not a weaker gate:
   when STRICT fails, this is what says _"the content is identical, only the order
   moved"_, which is the difference between a five-minute fix and an afternoon.
3. **PROJECTIONS** — run `teamBuffRows`, `charReceivedBuffRows`, `summonSubrows`,
   `shieldRows`, `nbRows`, `moonsignRows`, `weaponProcRows` on both IRs and deep-compare.
   ⚓ This is the surface that answers "did anything move on screen", and it is the
   thing C2 actually cares about. It is also what L5 will be measured on when it
   deliberately reorders.

**Corpus:** the 123-character roster notation (reused from
`notationParser.ir.test.ts`) + the multi-character fixtures + the 12 L0 oracle
fixtures + the six perf fixtures in §2. Constellation sweep at C0 and C6; one pass
with a populated `loadoutMap` (weapon procs + artifact sets are otherwise unreached).

⚠️ Run the **L0 oracle** at L3e as well and check its five baseline numbers
(63 / 200 / 1 / 138 / 0). It is a second, independent witness, and L2's history says
it earns its keep: it caught a harness bug wearing gcsim's documented RNG as a
costume. ⛔ Check the counts against the RECORDED baseline, never against "that looks
like the known flicker".

---

## 6. Order of work

Each step ends green on `npx vitest run` (baseline **51 files / 1,474 tests / 1.8 s**),
`npm run check`, `npm run lint`, `npm run build`. Nothing is left half-extracted
across a step boundary.

### L3a — the machine ✅ (2026-08-16)

`clock.ts` alone, with `clock.test.ts` pinning: band order including the two empty
bands, FIFO within a band, `(frame, band, insertion)` as a total order under heap
churn, re-entrancy (a task scheduling a task at the same instant), the past-schedule
clamp, and ⚓ **skip-ahead — a task 432,000,000 frames out costs one hop**. Nothing
consumes it. The `gauge-round.md` C6 amendment lands here.

⚠️ `context.ts` and `charState.ts` were planned for this step and **moved to L3c**.
They are EXTRACTION, and this landing's own discipline is that extraction waits for
the differ: the 1,474-test suite does not pin ids or array order, which is precisely
what an extraction can perturb. A step that stands up new code consumed by nothing is
the only one that is safe to take ungated.

**Done when:** the clock is tested and unused, and the amendment is recorded.

### L3b — the differ, against an unchanged parser ✅ (2026-08-16)

`notationParser.legacy.ts` frozen verbatim (header comment only);
`src/lib/sim/parserDiffer.ts` holds the three-surface comparator and
`parserDiffer.test.ts` the corpus: **123 characters × C0 and C6** on the roster
notation, plus **33 multi-character scenarios** (the twelve L0 oracle fixtures
verbatim, then shields / stances / transients / multi-summon / charge queues /
drain / seals / infusions / faction / NB / brackets / waits / a 20-cycle / unknown
tokens / a fifth character), each run again at C6 with a populated loadout. Green on
day one, as it must be. **10 tests, 0.2 s** — cheap enough to run on every edit,
which is what makes a strangler this size sane.

⚓ **The differ was itself verified against a REAL perturbation, not just seeded
ones.** `DASH_FRAMES 21 → 22` in the live parser — and it came back GREEN, because
neither the roster notation nor any scenario used `D` or `J`. That is the failure
mode a differ has: green because both engines agree, or green because neither ran
the branch. Three floors now guard it, and each caught something:

- corpus size (`≥120` characters, `≥30` scenarios) — a resolved-to-nothing glob
  makes `runAll([])` return `[]`, which reads exactly like agreement;
- every id in the fixture loadout **resolves** — ⚠️ two of the first eight did not
  (`emblem_of_severed_fate`, `the_catch` are not in the curated set), and an
  unresolvable `artifactSetId` skips the whole artifact branch in silence;
- every buff-window **source family** is reached — `artifact`, `character`,
  `faction`, `weapon`, asserted as an exact set.

With `D`/`J` added, the same perturbation fails loudly on 12 characters with the
three-line report the design called for (STRICT line, CANONICAL verdict,
PROJECTIONS line naming the row that moved).

**Done when:** ✅ the differ passes over the full corpus with both engines being the
same code; its failure output is legible; and it is proven to SEE a real change.

### L3c — extraction, one family per commit

Lift closures into the §3.1 modules against an explicit `SimContext`. The old driver
still drives; the differ is green after every commit. Order is least-entangled first,
so the hard ones land against a smaller body:

`charState` + `context` → `conditions` → `resolve` → `tokens` → `summons` → `stacks` →
`hits` → `extensions` → `infusions` → `shields` → `cooldowns` → `states` → `aura` →
`cast` → `actions` → `finalize`.

⚓ `charState` + `context` go first because every later family needs somewhere to reach
its state from — and `SimContext` is defined by its first real consumer rather than
guessed at in advance.

⚠️⚠️ Preserve the six aliases in §1 exactly. When a container moves onto `SimContext`,
the record pushed into the collector must remain the SAME OBJECT.

**Done when:** `parseNotation` is the façade + `run.ts`, and the differ is green.

### L3d — the swap

`run.ts` drives from the clock: `now` advances only through `clock.advance()`, the
turn's `freeAt` replaces `localCursor`, the charge-wait scan and `~Xs` become clock
advances, and the finalize passes run off the clock's terminal state. The uptime
stamps migrate (§4.2).

**Done when:** STRICT is green over the whole corpus with the two drivers differing.

### L3e — delete

Remove `notationParser.legacy.ts` and the two-engine differ (keep the projection
comparator as an ordinary test — it is worth having permanently). Re-measure §2.
Run the L0 oracle. Run `npm run test:e2e` — this is a pre-merge gate and L3 is a
merge.

**Done when:** the legacy copy is gone, the five oracle numbers hold, both e2e
engines report their "N passed" line, and Nate has looked at the timeline.

---

## 7. The traps

🐛 **Aliasing** (§1). The extraction's one silent-failure mode. Six known sites.

🐛 **`applyModifiers` is polymorphic in unit** and takes `flatScale` — the L2 landing's
trap, still live. Moving it to `conditions.ts` must carry the parameter and its
comment, or a cooldown modifier becomes 60× too small.

🐛 **`inferredStates`' newest-first scan and `castKindsByChar` are PERF, not style.**
The 2026-08-14 sweep measured 396 ms → 94 ms. An extraction that "tidies" the
backwards loop into a `.some()` or drops the high-water mark restores a quadratic
that only shows up on a cast-heavy rotation. ⛔ Carry both verbatim, comments included.

⚠️ **`scanGuard < 8`** and **`MIN_ACTIVE_F`'s "if it didn't advance, advance it"** clamp
are behaviour, not defensiveness. So is `MAX_EXPANDED_TOKENS` truncating silently.

⚠️ **Scope creep.** An extraction of this size will surface real bugs — the corpus has
form (nine authored-but-unread findings in one day, per `orphanedSchema.test.ts`).
⛔ Record them in §9 below; do not fix them inside the strangler. The exception is a
finding the differ proves INERT over the corpus, which can land with its proof.

⚠️ **`orphanedSchema.test.ts` is blinded while the frozen copy exists.** It matches
property ACCESS across the code roots, and the legacy copy accesses everything the
live parser used to. So a field that goes dead in the live parser mid-extraction
keeps a consumer and the guard stays green. ⏭ Re-run it as a deliberate check at
L3e, once the copy is deleted — that is the only run in this landing that means
anything.

⚠️ **A differ can be green because nothing ran.** Three floors now guard that
(L3b) and each of them caught a real hole on the first pass. ⛔ When adding a
scenario, do not assume it reaches the branch it is named after — perturb the branch
and watch the differ go red.

⚠️ **`parseNotation` is called from a synchronous `$derived` on every keystroke**
(`RotationTimeline.svelte:362`, the only production call site). A throw there unwinds
through the timeline — which is why `expandBrackets` uses a loop instead of a spread.
The clock must not introduce an unbounded loop or a recursion.

---

## 8. Done when

- The differ is green over the corpus at STRICT, with the two drivers differing.
- `npx vitest run` (≥1,474 tests), `npm run check`, `npm run lint`, `npm run build`.
- `npm run test:e2e` — both engines' "N passed" lines read, not the exit code
  ([playwright#39753](https://github.com/microsoft/playwright/issues/39753)).
- The L0 oracle reproduces **63 / 200 / 1 / 138 / 0** and all twelve per-fixture rows.
- §2's perf table re-measured, no fixture past 1.5×, the wait-bomb still O(tokens).
- `notationParser.legacy.ts` deleted; no `$lib/sim` module imports it.
- ⚓ **Nate's eyes on the timeline** — this landing's whole claim is that nothing moved,
  and that is the one part the machines cannot close (L2's outcome says so in the
  same words).

---

## 9. Findings parked during the extraction

_(filled as they surface — see §7's scope-creep rule)_

---

## 10. Outcome

_(filled at L3e)_
