# Stacked buffs that STEP — plan (2026-09-18)

_Status: ✅ SHIPPED 2026-09-19 on `feat/stack-count-display` — **§5 is the RECORD.**
⚓ **DECIDED 2026-09-19 (Nate): ROUTE A (§1), and the
stepped value shows in the TOOLTIP, ⛔ not the label** — §3's option (b), my
recommendation, was overruled: the bar's label stays its source name, the step
reads as the lit edge, and the hover says the value. Queued after §1.G._

\_⚓ Nate 2026-09-18: Columbina's Lunacy's Lure is
+5% CRIT Rate per Gravity Interference, up to three stacks, 10 s; today its
three fires refresh-merge into ONE +5% bar, and the step to 10% and 15% is the
thing worth seeing.

## 0. What the chart says today, and why

Each Gravity fire anchors one 10 s window carrying the A1 effect with value 5.
Three fires inside 10 s are three windows that print the same text, and
`mergeRefreshedBars` fuses same-text overlaps into one bar with one label — so
the row shows a single +5% span. Two facts make the step nearly free:

- **The merge compares the FORMATTED value** and keeps different values as
  separate bars on purpose: "a stack-scaled buff that ramped between the two
  triggers formats differently and therefore stays two bars, which is the
  intent" (`mergeRefreshedBars.ts`). A later bar draws over the earlier one
  (DOM order), so 5% → 10% → 15% would render as three bars starting at the
  three fires, each with its lit leading edge — the edge that already means
  "the buff CHANGED here".
- **`perStack` is a BuffValue**: `{ type: 'perStack', key, per, maxStacks }`
  renders `per × min(stacks, maxStacks)` off the window's `stackContext`
  (`formatBuffDisplayValue`). A window that knows the stack count at its fire
  prints the right number without any new display code.

What is missing is (1) a stack COUNT on a fire-anchored window and (2) the
count's lifetime model, plus one design question (§3).

## 1. Route A — the honest one (recommended)

Author A1 as the machinery already says it:

```jsonc
// Eternal Tides (skill) — a stack per fire, rotation-scoped (a fire lands off field)
{ "type": "gainStacks", "target": "self", "trigger": { "type": "onStack", "keys": [...gravity], "count": 60 },
  "key": "lunacysLure", "amount": 1, "max": 3, "scope": "rotation",
  "lifetime": 10, "lifetimeRefresh": true }
// Lunacy's Lure (A1)
{ "type": "buff", "stat": "critRate",
  "value": { "type": "perStack", "key": "lunacysLure", "per": 5, "maxStacks": 3 },
  "trigger": { "type": "onStack", ... }, "duration": 10 }
```

Engine, four small pieces:

1. **`gainStacks` on an `onStack` trigger.** `checkStackThresholds` dispatches
   a fire's grants after the spend, rotation-scoped only (lint: a fire has no
   segment pool in hand at the reaction and tick sites — `scope: 'rotation'`
   required, the summon-tick rule).
2. **`lifetimeRefresh: true`** — the SHARED duration model. Today `lifetime`
   is per instance (Linnea: each stack dies 10 s after ITS grant). gcsim's A1
   (`a1OGravityTick`) is `CR = 0.05 × min(stacks, 3)` on a 10 s window
   refreshed by every Interference: one grant resets EVERY live instance's
   expiry to `now + lifetime`. One line in the instance write, at every
   lifetime site (`applyLifetimeExpiry` / `applyRotationLifetimeExpiry` read
   unchanged).
3. **The fire event carries a stack snapshot** — `StackThresholdEvent
.stackContext`, taken post-grant (`rotationStackSnapshot`), the cast
   convention. The three `buffWindows` fire sites pass it as the window's
   `stackContext`. Nothing else in the projection moves.
4. **Lint**: `perStack.key` must have a `gainStacks` author (probably already
   D-something — check); `lifetimeRefresh` only beside `lifetime`.

Then the shape on screen is three overlapping bars, +5% / +10% / +15% in the
tooltip, each fire a lit edge — and the LAST bar's end is the true end (the
10 s from the last fire), because a later fire's window covers the earlier
one's tail. ⚠️ The IR still records the first window as ending at `f1 + 10 s`,
which under the shared model is a claim superseded rather than wrong: "+5%
from f1 for 10 s" holds until the +10% window takes over. State it in the
record rather than clipping the window.

Cost: engine ~120 lines + lint + 3 test cases beside `thresholds.test.ts`;
data: Columbina only; docs. A half-day round.

**Bonus it unlocks:** `BuffEffect.stacks { maxStacks, durationModel }` has
sat on the INERT list since audit finding #4 ("decision pending") with ten
authors (Alhaitham, Columbina, Cyno, Escoffier, Kinich, Skirk, Heizou, Yanfei,
Varka, Cryo Traveler). Route A is the answer that field was waiting for:
`maxStacks` → `perStack.maxStacks`, `durationModel` → `lifetime` vs
`lifetimeRefresh`. ⚠️ A separate authoring pass, one holder at a time — most of
those ten already carry a `gainStacks` key, and some `stacks` blocks are stale
descriptions of a mechanic the key models. ⛔ Not this round's scope; list it.

## 2. Route B — projection-only (cheaper, narrower)

Give `BuffEffect.stacks` its first consumer AT the three fire sites: for fire
`i`, count the fires that are still live under `durationModel` (`shared`:
every prior fire in an unbroken chain of < duration gaps; `separate`: fires
within the last `duration`), and emit the window with a CLONED effect whose
numeric `value` is `value × min(n, maxStacks)`.

Honest about what it is: no engine change, ~40 lines, but the window then
carries an effect object that is not the authored one (the tooltip would print
a value the JSON does not contain), it works only for fire-anchored buffs, and
it leaves the other nine `stacks` authors exactly where they are. ⛔ Not
recommended; listed because it is the cheapest thing that draws the step.

## 3. The design question — where does "+10%" show?

A received-buff bar's LABEL is its source ("Columbina Gravity Interference");
the VALUE is in the tooltip. Under either route the step is visible as an
edge, and readable only on hover. Options, for Nate:

- **(a) Edge only.** The lit leading edge already means "changed"; three edges
  in one row over 10 s say "it stacked". Zero new drawing. Weakest.
- **(b) Value suffix on a CHANGED bar.** When a bar in a row starts a value
  different from the bar under it (the merge knows — it is the same test that
  kept them apart), its label appends the value: "Columbina Gravity
  Interference · +10% CR". First bar unchanged, so a non-stacking row looks as
  it does today. My recommendation: it names the pixel Nate asked for and
  costs one branch in `labelCapPx`'s neighbourhood.
- **(c) Always show the value on stack-scaled bars.** Every `perStack` bar
  carries its value in the label. Louder, and it would re-label rows that are
  fine today (Skirk's, Linnea's).

## 4. Order

After the cooldown-reduction round unless Nate wants it first — it is small
and self-contained, and it does not touch the cooldown machinery. Measure:
`Columbina E Q > Zhongli E > Aino E …` at C0 with enough Lunar reactions for
three fires inside 10 s (the C6 probe showed two ~4.5 s apart), plus the
corpus digest (0 expected — no other `perStack` window gains a
`stackContext` from this).

## 5. RECORD (2026-09-19)

Route A shipped as §1 scoped it, four pieces, with two things the plan did not
say:

- **The grant is dispatched from `stacks.ts`** (`dispatchGainStacksOnStackFire`),
  not inline in `thresholds.ts` — `poolsFor` / `mirrorKey` are that module's
  private container decision, and a second copy of it is the thing the
  rotation-scope round refused. It runs after the spend and BEFORE the event is
  built; conditions demand a definitive `true` under the closed world §1.G
  gave the live dispatchers (`liveNegatedStates`).
- **`lifetimeRefresh` went into ONE helper, `grantInstances`, used at all five
  lifetime sites** (onCast, onReaction, onHit self, onHit team, the fire) rather
  than "one line at every site" — the four existing writes were the same five
  lines. Byte-identical where the flag is absent (corpus: 0 of 630 / 0 of 252).
  ⚠️ LIVE instances only: a fire has no settle point in front of it, so the
  dispatcher sweeps (`applyRotationLifetimeExpiry`) and the helper also refuses
  an expired instance. Either layer alone holds the "never resurrects" test —
  the seeded negative had to remove BOTH.
- `StackThresholdEvent.stackContext` = `rotationStackSnapshot` post-grant; the
  three buff fire sites pass it as the window's `stackContext` AND into their
  condition pass (a `stacks` gate on a fire buff resolves now).
- Lint: B.16 admits `gainStacks` (`onstack-gainstacks-scope`,
  `onstack-gainstacks-own-key`); B.13f2 `gainstacks-lifetime-refresh-invalid`;
  the gainStacks trigger rule admits `onStack`.

**Data — Columbina only.** The grant sits on the A1 PASSIVE, not on the skill
as §1 sketched: it is A1's resource, and the passive is what carries the
ascension gate. Authored FIRST so the snapshot is post-gain. The inert `stacks`
block and the one-stack caveat are retired.

**Measured** (`Columbina E Q > Fischl E N3 > Barbara E N3 > Fischl N3 Q N3 > …`):
C2 fires at 488 / 758 / 1055f carry 1 / 2 / 3; three bars in one row,
488–1088 · 758–1358 · 1055–1655, tooltips +5% / +10% / +15% (⚓ Nate: tooltip,
⛔ not the label). C0 reaches two fires in the same rotation.

**⏭ For Nate to judge on screen:** the three bars OVERLAP (each window keeps
its own 10 s, §1's "superseded rather than wrong"), and the bar register is
translucent glass, so the overlap is denser than a single bar. That look
already exists on `main` — a seamed bar never refresh-merges, so her C2's three
fires were already three overlapping bars — but this makes it the C0 default
for her. If it reads badly the fix is a PROJECTION clip (a bar superseded by a
later, different-valued bar of the same row ends where that one starts), ⛔ not
a change to the windows.

**Not this round (§1's bonus, still listed):** the other nine authors of
`BuffEffect.stacks` — one holder at a time, most already carry a key.
