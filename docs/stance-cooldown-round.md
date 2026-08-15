# Stance-cooldown round — handoff

**Status:** scoped, not started. Written 2026-08-15, after `4b5f1df`.
**Origin:** ⚓ Nate reported Xilonen's E recast landing "WAY farther than it should." Chasing it produced three findings; two are fixed and merged, this is the third.

---

## What is already fixed (do not redo)

- **`e0a4868`…`bb2ab62`** (merged `1c52b96`) — unrelated; off-field summon-tick hits.
- **`4fa17a7`** (merged `4b5f1df`) — the E/Q pill's ghost CD tail now ends at `readyAt` instead of `start + cooldown`. Xilonen's bar reads `uptime 0→9` then `ghost 9→16 label=7s`, which is self-explanatory and matches where the parser places the recast. **The chart is no longer lying.** What remains is whether the number it now honestly reports is itself right.

## The remaining problem

`readyAt` is computed once, at cast:

```ts
readyAt: castStart + (active.cooldownStartDelay ?? 0) / 60 + cd;
```

Two abilities abuse `cooldownStartDelay` to encode **"the cooldown starts when the STANCE ends"** rather than its intended meaning (an animation-frames offset). You can spot them because **the delay equals the duration**:

| ability         | delay         | duration | cooldown | in gcsim?                    |
| --------------- | ------------- | -------- | -------- | ---------------------------- |
| `xilonen skill` | 540f = 9.00s  | 9        | 7        | yes                          |
| `ifa skill`     | 600f = 10.00s | 10       | 7.5      | **no — not in the checkout** |

Of the **124** abilities carrying `cooldownStartDelay`, the other ~122 sit at 1–35 frames (0.02–0.6s) and are genuine `SetCDWithDelay` transcriptions. Those are correct and must not be touched — see the FAQ item queued in the launch-roadmap memory.

The encoding is static, so it cannot express early exit. gcsim exits Xilonen's Nightsoul three ways:

1. **Swap off** — `onExitField()` subscribes `OnCharacterSwap`; if the outgoing char is Xilonen, `exitNightsoul()`.
2. **Re-press E** — `Skill()` opens `if HasBlessing() { exitNightsoul(); 1-frame action }`, gated by a 1s `skilRecastCD` status.
3. **Points drain** — 45 points at 5/sec, modified by C1/C6 and `nightsoulConsumptionMul()`.

`exitNightsoul()` is where `c.SetCD(action.ActionSkill, 7*60)` lives, so any of the three starts the clock.

---

## ⚠️ STEP ONE IS VERIFICATION, NOT CODE

**Xilonen's `_curatorNotes` assert the opposite of gcsim, in plain words:**

> "the schema models this as a stance with terminatesOnSwap: false (**Nightsoul persists across swap in-game until points drain or timer expires**)"

gcsim's `onExitField` hook contradicts this unambiguously. One of them is wrong and **the source of the curator's claim is unknown**. ⛔ Do not flip `terminatesOnSwap` on the strength of gcsim alone — the repo already keeps a `GDB_CD_KNOWN_WRONG` list because upstream data can be wrong, and this note may encode a real in-game observation.

Neither Nate (does not own Xilonen) nor a session with only the gcsim checkout can settle it first-hand. Options, cheapest first:

- The Fandom wiki's Xilonen page / Nightsoul's Blessing page (the MediaWiki API is the one sanctioned network path — `scripts/fetch-wiki-capabilities.mjs`; WebFetch is blocked).
- KQM's Xilonen guide.
- Ask Nate to source a first-hand report.

**If the note turns out right**, the swap half is dropped and only the re-press half survives — ⚓ and Nate has already ruled the re-press not worth modelling ("players don't really recast E to cancel the stance"), which would reduce this round to the schema cleanup below. **That is still worth doing.**

---

## The design

### 1. Replace the hack with a real flag

`cooldownStartDelay == duration` is not a statement of intent, it is a coincidence that happens to compute. Add an explicit boolean instead:

```ts
/** The cooldown clock starts when the STANCE ends, not at the cast. Natlan
 *  Nightsoul skills: gcsim sets the CD inside exitNightsoul(). Mutually
 *  exclusive with cooldownStartDelay, which means animation frames. */
cooldownStartsAtStanceEnd?: boolean;
```

Then Xilonen becomes `cooldownStartsAtStanceEnd: true` with **no** `cooldownStartDelay`, and `readyAt` derives from the resolved stance end. This is worth doing **even if the swap question resolves against gcsim**, because it makes the intent greppable and stops the next person reading 540f as an animation offset.

⚠️ A characterLint rule should reject both fields on one ability.

### 2. Wire `readyAt` to the actual stance end

**The mechanism already exists and there is precedent for the exact operation.** `notationParser.ts` ~3636 (burst `cdReset` targeting `'skill'`) already reaches back into `eChargeQueues` mid-parse and rewrites a charge's ready time:

```ts
q[0] = Math.min(q[0], localCursor);
q.sort((a, b) => a - b);
```

The stance-termination site (~4184, `if (i < segments.length - 1 && cs.stance)`) runs **inside the segment loop**, and `eChargeQueues` is function-scope, so it is in scope at exactly the right moment. The stance record also retains `castRef`/`barRef` by design (there is a P4 note saying so).

So the write is: on early termination at time `T`, for a stance whose ability has `cooldownStartsAtStanceEnd`, set that skill's queue entry to `T + cd` (**not** `Math.min` — this moves the clock _earlier_ than the 9s assumption but _later_ than a reset; take the value, do not min/max against the stale one), and patch `castRef.readyAt` to match so the ghost tail follows.

⚠️ The queue is keyed by **ability id** (`{charId}__…`), with a bare-`charId` fallback for uncurated characters. Match the existing key discipline at 3636 — a rotation-wide write would erase teammates' cooldowns.

### 3. Scope boundaries — ⛔ what this round is NOT

- ⛔ **Not gauge modelling.** The tool constitution is windows-not-gauges, and Xilonen's `_curatorNotes` already invoke it for the 45-point drain. Exit-by-drain stays unmodelled; C1's +45% timer stays unmodelled for the same reason the note gives (a draining gauge does not map to a fixed window).
- ⛔ **Not the E-re-press cancel.** ⚓ Nate's call, 2026-08-15: players do not use it. Modelling it means teaching the parser that a token can _terminate_ a stance rather than open one — real semantic surgery for a rotation nobody writes.
- ⛔ **Do not touch the ~122 small-delay abilities.**

---

## Corrections to earlier reasoning in the originating session

Both were stated to Nate and are wrong; do not re-derive them:

1. **Her RES shred does NOT ride the stance window.** It is five per-element `onCast` effects on a separate **15s** window (A1 Netotiliztli's Echoes; gcsim `asc.go:75` sets a 15\*60f sampler activation). So no shred uptime is overstated by the current model, and fixing the stance does not fix the shred. (There _is_ a separate documented understatement — the Geo sampler persists for the whole Nightsoul and permanently at C2, while the timeline shows only the 15s window. Out of scope, already in `_curatorNotes`.)
2. **Flipping `terminatesOnSwap` alone changes almost nothing visible.** There is an explicit design note at the swap site: _"a swap-terminated stance keeps its full owner-bar width while `end` clamps to the swap-out time."_ It clamps the state windows (`nightsoulBlessing`, `inStance`) and nothing else — the pill keeps its 9s width and `readyAt` is never recomputed. The flag is only meaningful **together with** step 2.

## Test plan

- `barPhases` is already covered (`barPhases.test.ts`, the delayed-cooldown describe) — no new geometry work.
- The discriminating parser assertions:
  - `Xilonen E E` with no swap → second E still at **16.000** (the full-stance case must not regress).
  - `Xilonen E > Bennett E > Xilonen E` → the swap terminates the stance, so the second Xilonen E is gated by `swapTime + 7`, not 16.
  - A small-delay ability (Nahida, 11f) → `readyAt` unchanged at **5.183**.
  - Bennett (no delay) → **4.000**, byte-identical.
- Corpus guard: the parser-invariant roster test (`notationParser.roster.test.ts`) already drives every character's tokens; it should stay green untouched.
