# L2 — Integer frames

**Status:** ✅ SHIPPED 2026-08-16
**Landing:** [`gauge-round.md`](gauge-round.md) §L2, against contract **C1**.
**Shape:** no behaviour change. The timeline must render identically.

> Flip the IR **and the parser's internal clock** to integer frames in one pass.
> ⛔ Not a shim at the emission boundary — see §7.

---

## 1. What the survey found

The migration is **much smaller than its blast radius suggests**, for one reason:

⚓ **Almost all of the parser's time arithmetic is unit-agnostic.** It is addition,
comparison, `Math.max`/`Math.min`, and sorting. None of that cares what a `1` means.
Only the places where time **enters** and **leaves** carry a unit — so converting the
boundaries converts the whole machine.

Measured on `main`:

| surface                                               | count                           |
| ----------------------------------------------------- | ------------------------------- |
| `/60` · `*60` sites in production code                | **17** (13 parser, 4 consumers) |
| bare seconds constants inside the parser's arithmetic | **1** (`MIN_ACTIVE_S = 0.5`)    |
| `parseNotation` production call sites                 | **1** (`RotationTimeline:362`)  |
| time-bearing test files                               | 15 (~758 `expect`s)             |
| …of which lines carrying a decimal literal            | **~163**                        |

⚠️ The one bare constant is the important number here. A parser full of seconds
literals would be a migration full of judgement calls; a parser with **one** is a
mechanical edit with a checkable perimeter.

---

## 2. The contract, restated as a rule

> **Inside the parser and on the IR, a number that means time is an integer count
> of 60fps frames. Seconds exist at exactly two places: the JSON we read, and the
> screen we draw.**

⚓ **ONE conversion function**, and it is the only rounding in the system:

```ts
/** Authored seconds → integer frames. THE rounding site (gauge-round C1). */
export const framesOf = (seconds: number): number => Math.round(seconds * 60);
```

⛔ **No `secondsOf` helper going the other way.** The reverse conversion is
presentation, it is always `/ 60`, and giving it a name would invite it to be
called somewhere that is not presentation. Two named directions is how a
"frames-native" system quietly becomes bilingual again.

---

## 3. The four boundaries

Everything in this landing is one of these four.

### B1 — IN: authored **seconds** → frames (`framesOf`)

The long list, and the one that must be exhaustive. A missed field is a bar
**60× too short** — loud, but only if a test covers it.

| field                                                | read at                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `cooldown` (ability + variant)                       | `resolveAbilityTiming`                                        |
| `duration` / `activeDuration` / `summons[].duration` | `resolveActiveDuration`, `registerShieldOnCast`, `summonSpan` |
| `CooldownModifier.value` **when `type === 'flat'`**  | `applyModifiers` — ⚠️ see §4                                  |
| `chainStage.window`                                  | `advanceChain`                                                |
| `DurationExtension.delta` / `.procCooldown`          | both extension dispatchers                                    |
| `gainStacks.lifetime` / `.sourceLifetime`            | 4 dispatch + 3 sync sites                                     |
| `gainStacks.drain.ratePerSecond`                     | `applyDrain` — ⚠️ **a RATE**, see §4                          |
| `Effect.procCooldown`                                | onHit + onShieldEnd dispatch, weapon cdReset                  |
| `summonTick.interval` / `.firstTickDelay`            | `collectSummonTicks`                                          |
| `shield` / `infuse` `Effect.duration`                | `registerShieldOnCast`, `registerInfusionsOnCast`             |
| `TransientStateSpec.duration`                        | `openTransientState`                                          |
| every `effect.duration` in `buffWindows.ts`          | **~25 sites**, all `buffStart + duration`                     |
| `rampParams.stepInterval`, `decayParams.duration`    | `buffWindows.ts` window authoring                             |
| `GLEAM_WINDOW_S = 20`                                | `moonsignRows.ts:14`                                          |

Literal constants that are seconds today and become frame counts:

- `MIN_ACTIVE_S = 0.5` → `MIN_ACTIVE_F = 30`
- `MAX_TIME_ADVANCE_S = 3600` → `MAX_TIME_ADVANCE_F = 216_000` (⚠️ the value C6 already
  derives the frame-loop cap from — keep them one expression, not two numbers)
- the no-ability fallbacks: Q `cooldown: 15` → `900`, E `cooldown: 12` → `720`
- the NB cooldown ladder `18 / 12 / 9` → `1080 / 720 / 540`

### B2 — IN: authored **frames** → frames (delete the `/ 60`)

These fields were **always** frames; the parser was converting them _down_ into a
seconds clock. Every one of these edits makes the code shorter.

`FrameMap` values (4 resolvers + the plunge site) · `summonActivatesAt` (3 sites) ·
`Summon.spawnsAt` (2 sites) · `cooldownStartDelay` · `DASH_FRAMES` (2) ·
`GENERIC_SKILL.castSwap` / `GENERIC_BURST.castSwap` · `swapFrames`.

### B3 — IN: user text `~Xs`

The one place a human's seconds enter the clock. `Math.round(delta * 60)`, capped in
frames. ⚠️ `~0.017s` is legal input and rounds to 1 frame — that is correct and is
what the cap comment should say.

### B4 — OUT: presentation

Where seconds come back. Enumerated in §5, because the shared modules make this the
only genuinely interesting part of the landing.

---

## 3b. ⚠️ "No behaviour change" has fine print, and it is the honest half

⚓ **Authored seconds that are not whole frames get SNAPPED, and that moves times by
up to half a frame (0.0083 s).** 47 authored values are affected. This is not a defect
of the landing — it is the landing: a value that was never expressible on the game's
clock stops pretending it was.

Two consequences to hold:

- **Repeated-addition sites shift more than half a frame.** `collectSummonTicks` walks
  `t += interval` — Furina's `1.626 s` becomes `98 f` (`1.6333 s`), so tick _n_ moves by
  `n × 0.0073 s`. Over a 20 s summon that is ~0.09 s on the last tick. ⚓ It is also the
  fix: the float accumulator drifted, and an integer one cannot.
- ⛔ **Therefore the L0 oracle diff is NOT expected byte-identical.** Divergence
  **counts** must not move — a half-frame cannot reorder a reaction or change whether a
  window covers an instant — but individual timestamps may. ⚠️ Check the counts, not
  the bytes; claiming the stronger thing and then explaining it away is how a real
  regression gets waved through.

✅ Spot-checked: Varesa's `apexDrive` is authored `2.33` for gcsim's `140 f`, and
`Math.round(2.33 × 60) = 140` recovers it exactly. That is the recovery C1 predicted,
on the corpus's most obviously frames-derived value.

---

## 4. The three traps

These are the sites where a mechanical `framesOf(...)` is **wrong**, and each would
survive a careless pass silently.

🐛 **`drain.ratePerSecond × elapsed` is a RATE against a duration.** Converting the
field is wrong — the field is fine. `elapsed` is now frames, so the product must
become `ratePerSecond * elapsed / 60`. Two sites in `applyDrain`. ⚠️ Skirk's Serpent's
Subtlety drains 7/sec; get this wrong and she drains 420/sec.

🐛 **`applyModifiers` is polymorphic in unit.** `type: 'percent'` multiplies — unit-free,
leave it. `type: 'flat'` **adds authored seconds** to a value that is now frames. Only
the flat arm converts. ⚠️ It is shared by cooldown, duration **and** charge-count
resolution, and charges are not a time at all — so the conversion cannot go inside
`applyModifiers`; it belongs at the two time-valued call sites.

🐛 **`icd.ts` is unit-agnostic but its constant is not.** `icdApplies` only ever computes
`time - timerStart >= timer`, so it is correct in any unit the caller is consistent in
— but `STANDARD_ICD.timer = 2.5` is seconds, and the instrument shares it.
⚓ **Make frames primary and derive seconds for the instrument**: gcsim's ICD _is_ 150
frames, so this is the truer statement anyway, and it keeps the module's own
"one model, two shapes" law rather than minting a second constant that can drift.

---

## 5. The shared-module rulings

Four modules are consumed by **both** the frames-native planner and something that has
no frames at all. Each needed a decision rather than a conversion.

### `barGeometry.ts` — **stays seconds.** ⛔ Do not convert.

It is the Team Builder's Compare geometry too (`CompareBar.svelte`, `CompareView.svelte`),
and that chart's data path is derived capabilities — seconds, with no frame anywhere.
`scale` is px-per-second on both sides.

⚓ **The planner's two local wrappers absorb the whole conversion**, because
`RotationTimeline` already funnels every geometry call through them:

```ts
function xForTime(f: number) {
	return projectX(f / 60, scale);
}
function barGeom(startF: number, spanF: number) {
	return projectBar(startF / 60, spanF / 60, scale);
}
```

⚡ **Consequence: the renderer's ~20 `barGeom(...)` template call sites change by
nothing at all.** They keep passing whatever the IR gave them; the unit changed
underneath and the wrappers hold the seam. That is the single largest reason this
landing is small.

### `barPhases.ts` — **becomes unit-agnostic**, by deleting its one `/ 60`.

⚓ Its only unit-specific line is `(bar.summonActivatesAt ?? 0) / 60` — which is
precisely the **mixed-unit** expression C1 exists to kill: a frames field being
divided into a bar whose other fields are seconds. The Team Builder path
(`barCycles.laneSegments`) never sets `summonActivatesAt`, so that term is `0` there.

Delete the `/ 60` and the module is correct in **whatever unit its caller uses**,
provided the caller is self-consistent — frames for the planner, seconds for Compare.
⚠️ Say so in the header, or someone will "fix" it back.

### `icd.ts` — frames primary, seconds derived. See §4.

### `gauge.ts` — ⛔ **UNTOUCHED this landing.**

It is not wired to the parser until **L5**, and it is already frame-native internally
(`S.frame`, `FPS`) with a seconds boundary for the instrument. Converting its boundary
now would be churn against an interface L5 replaces.

---

## 6. What C1 cashes in

Not incidental — these are the reason the contract chose frames, and they should all
be **gone** when this lands:

- 🐛 `notationParser.ts:4544` — `queue.findIndex(t => Math.abs(t - staleReadyAt) < 1e-9)`,
  a charge-queue lookup **using a float as an identity key**. → `queue.indexOf(staleReadyAt)`.
- 🐛 `notationParser.ts:2995` — matching a summon to a shield by float-comparing
  durations. → `===`.
- 🐛 `summonSubrows.ts:186` — the summon lane's walk index keyed on a **float**
  `spawnAt` that must reproduce `summonSpan()`'s arithmetic bit-for-bit in a second
  module or every lane silently falls back to sort index 0. → an integer key.
- 🐛 `RotationTimeline.svelte:1052` — `trackConnections`, a `Map` keyed on
  `track.activeStart`, a float. → an integer key.
- Three inconsistent epsilon conventions (`icd.ts` `1e-9`, `gauge.ts` `1e-6`,
  `.toFixed(6)` window keys in `notationParser.ir.test.ts`).

⚓ **The two float-keyed maps are the ones to call out in the commit.** They are live
latent bugs, not tidiness — each is a silent wrong-answer waiting on a rounding
coincidence, and neither has a test that would catch it.

---

## 7. Why not a shim at the emission boundary

⛔ Rounding only on the way out — keeping a seconds clock and converting at
`events.push` — is the tempting cheap version, and it is **wrong for a specific
reason**, not on principle:

It would bake **seconds-derived rounding** into the L2 baseline. L3's genuinely
frame-exact arithmetic would then differ by ±1 frame at accumulation sites, and the
L3b corpus differ — the gate that makes the strangler safe — would flag those
**improvements as regressions**. The differ is only worth having if its baseline is
already exact.

Convert the arithmetic, not the output.

---

## 8. Order of work

Each step ends green on `npx vitest run`; nothing is left half-converted across a step
boundary.

1. **`framesOf` + the frames-primary `icd.ts` constant.** No behaviour change.
2. **The parser: B2 first (delete `/ 60`), then B1 (add `framesOf`), then B3.**
   ⚓ B2 before B1 deliberately — the `/ 60` deletions are the sites where the code
   was already fighting the unit, and doing them first means the remaining seconds
   reads are the only unconverted things left, which makes B1's perimeter _visible_.
3. **`buffWindows.ts`** — the ~25 `effect.duration` reads + ramp/decay params.
4. **The IR type doc-comments** in `rotationEvents.ts` — every `(seconds)` becomes
   `(frames)`. ⚠️ Not cosmetic: these comments are the contract every future consumer
   reads, and a stale one is worse than none.
5. **The consumers** — `barPhases`, `summonSubrows`, `moonsignRows`, `shieldRows`.
6. **The renderer** — the two wrappers, `totalWidth`, `rulerTicks`, the display labels,
   the PNG exporter's `x()` helper, `pv.totalDuration` (⚓ **stays seconds** — it is a
   view-model field read only by the planner page's `{…}s` readout).
7. **`scripts/audit-gcsim-reactions.mjs`** — the oracle reads IR times to build its
   application stream. ⚠️ It compares against gcsim, which is **frames-native**, so
   this step _removes_ a conversion rather than adding one.
8. **The tests** — ~163 decimal-carrying lines, mechanical.

---

## 9. Done when

- `npx vitest run` green (1474 tests), with **exact integer assertions** replacing
  epsilon comparisons in the IR test.
- `npm run check` / `npm run lint` / `npm run build` green.
- ✅ The 47 non-whole-frame authored values are enumerated — ⚓ **already resolved**:
  Furina's six are means of a genuinely randomised tick and simply round
  (gauge-round.md §C1). The rest are 2-dp roundings that `Math.round(s*60)` recovers.
- **Grep proves the perimeter**: no `/ 60` or `* 60` left in `notationParser.ts` or
  `buffWindows.ts`; no raw `.duration`/`.cooldown`/`.interval` read into time
  arithmetic without `framesOf`.
- The timeline **renders identically** — ⚓ Nate's eyes, since this landing's whole
  claim is that nothing moved.

⚠️ A useful mid-flight check that costs nothing: **re-run the L0 oracle and compare
its DIVERGENCE COUNTS to the baseline** (63 ours / 200 gcsim / 138 missing). They must
not move. ⛔ Not the bytes — see §3b.

### Sites the consumer survey added, easy to miss

- `RotationTimeline:758` — the axis floor `Math.max(max + 2, viewportSeconds, 25)`
  carries a **+2 s tail pad** and a **25 s minimum**; both are frame counts now, and
  `viewportSeconds` (px ÷ px-per-second) must be re-expressed.
- `RotationTimeline:312` — the ramp-gradient fallback `rampDur … : 10`. The rest of
  that math is a ratio of two frame quantities and survives untouched.
- ⛔ `plannerView.svelte.ts:25-29` — `ZOOM_*` are **px per second** and stay that way.
  The wrappers (§5) are why they need no edit.
- ⛔ `buffWindows.ts:980-981, 1025` — `${effect.duration}` inside dedup/partition **keys**.
  Those are shape identities over authored data, not times in arithmetic. Leave them;
  convert the sibling read at `:1033` that _is_ arithmetic.

### More of what C1 cashes in (found by the consumer survey)

- `charReceivedBuffRows.ts:122` — `a.duration === b.duration && a.procCooldown === b.procCooldown`,
  **exact float equality as a merge gate**. Becomes exact integer equality.
- `BuffTooltip.svelte:43` — `fmtSecs` exists to hide `12.000000000000002` from
  `end − start`, and its comment says so. The noise is gone; the rounding stays only
  because a frame count in seconds genuinely has decimals.
- `mergeRefreshedBars.ts:80` and three siblings in `buffWindows.ts` — `start <= end`
  exact boundary tests deciding merge-vs-emit on a float coincidence.

---

## 10. Outcome

✅ **Landed 2026-08-16.** All four gates green: **1474 tests**, `npm run check`,
`npm run lint`, `npm run build`. The plan above held — every ruling in §5 survived
contact, and no contract in `gauge-round.md` needed amending.

### ⚓⚓ The oracle says it exactly

Re-running L0 against the L2 parser reproduces the baseline **number for number**:

| metric                                   | L0 baseline | after L2   |
| ---------------------------------------- | ----------- | ---------- |
| applications — ours                      | 63          | **63** ✅  |
| applications — gcsim                     | 200         | **200** ✅ |
| we apply, gcsim does not                 | 1           | **1** ✅   |
| gcsim applies, we do not                 | 138         | **138** ✅ |
| element mismatch on a paired application | 0           | **0** ✅   |

⚓ Stronger than §3b predicted — it did not merely hold the counts, it held every one
of the twelve per-fixture rows. The half-frame snapping is real but landed nowhere
that a reaction could notice.

### 🐛 …and it earned its keep on the way there

The first re-run reported gcsim at **215**, not 200. That is a ~7.5% move, and it had
a ready-made explanation sitting right there: L0 documented that gcsim is
non-deterministic and that its counts flicker. ⚠️ **It was not flicker.** A second and
third run gave 216 and 215 — a systematic offset wearing noise as a costume.

The cause was in the harness: `audit-gcsim-reactions.mjs` sized gcsim's run with
`Math.ceil(parsed.totalDuration + 10)`, and **gcsim's `duration` option is SECONDS**
while `totalDuration` had just become frames. Every fixture was asking gcsim to
simulate ~30× longer than the rotation, and the extra summon ticks it dutifully
produced looked exactly like plausible RNG.

⚓ **The lesson is the check, not the bug.** Nothing else in the round would have
caught this: it is in a script, so no test covers it; it produced a plausible number,
not a crash; and the explanation for waving it through was already written down and
true in general. What caught it was comparing against a **recorded** baseline instead
of trusting the reasoning — which is the entire argument for building L0 first.

⚠️ Second-order note worth keeping: the fix's first cut added a `$lib` import at the
top of that script, ahead of `./lib/alias-hook.mjs` — whose header says in capitals
that it must be first, because it is what makes `$lib` resolvable at all. It belongs
in the dynamic-import block with the parser.

### What the plan under-called

⚠️ **Rebasing "the failing assertions" is not the whole job.** A bound like
`expect(bar.start).toBeGreaterThan(10)` does not FAIL when the value becomes 610 — it
passes, trivially and forever, and stops testing anything. Roughly a dozen of these
sat beside the assertions that did fail, usually as the other half of a
`toBeGreaterThan` / `toBeLessThan` pair. ⛔ Iterating until green would have left every
one of them dead. They only surface from a deliberate sweep for time-valued
assertions carrying a bare number.

⚓ The same sweep is what turned ~40 `toBeCloseTo(x, 6)` into exact `toBe(x)`. Frame
times are integers, so a tolerance no longer expresses caution — it hides the ±1-frame
disagreements L3's differ will exist to catch.

### Two small things that came free

- `applyModifiers` gained an explicit `flatScale` parameter rather than a conversion
  inside it, because it serves cooldowns, durations **and** charge counts, and a
  charge count is not a time. The signature now says so.
- `GENERIC_SKILL.cooldown` / `GENERIC_BURST.cooldown` are read for the first time.
  The no-ability fallbacks had duplicated their values as bare `12` / `15` literals;
  the constants existed for exactly this and were authored-but-unread.
