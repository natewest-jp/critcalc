# Orphaned-schema audit — authored data with no consumer

**Run 2026-08-15**, after a day in which seven separate bugs turned out to be the same
meta-bug: data authored correctly, and no code path reading it. `factionBonuses`,
`noICD`, `twoPiece`, the five `infuse` effects, `shield` windows, variant `effects`, and
`summons[1]` were all that shape. This sweep asks whether there are more.

**Findings only when written.** ✅ Findings 1 (Citlali + Hu Tao) and the promoted guard
landed the same day — see "Resolved" at the bottom. ✅ **Findings 2–6 were RULED
2026-09-22** (⚓ Nate) — see "Resolved 2026-09-22" at the bottom; ⚠️ two of their premises
had gone stale by then, which is the lesson: a finding here is a snapshot, re-read the
code before acting on one.

⚠️ **Passes B and C are MANUAL and were last run 2026-08-15.** Only pass A is the vitest
guard. A clean guard is not a clean corpus.

---

## Method, and its blind spot

Three passes, all mechanical:

- **A — orphaned FIELDS.** Every object key present in the shipped JSON (`characters/`,
  `artifacts/`, `weapons/`), checked for a property _access_ anywhere in `src/` +
  `scripts/`, excluding tests. ⚠️ A type declaration (`key?: X`) does not match `.key`,
  so declaring a field cannot mask the absence of a consumer — which is the point.
  **140 authored keys, 10 with no reader.**
- **B — orphaned VALUES.** For each vocabulary-shaped field, every distinct authored
  value checked for a literal match, ⚠️ **excluding `src/lib/types/`** — a union member
  declaration is not a consumer, and including it is what would let this pass miss the
  real cases.
- **C — PER-CONSUMER coverage.** Each authored `Effect.type` / `trigger.type` /
  `Effect.target` against each of the three consumers separately (parser+timeline,
  capabilities layer, Team Builder).

⚠️⚠️ **The blind spot, stated plainly: this cannot see PARTIALLY-wired data, and most of
today's bugs were partially wired.** `infuse` effects reached the capability layer, the
Team Builder's compare view, `DetailCard` and `characterLint` — they were only missing
from the _parser_. A global "is this read anywhere" test says ✓ and moves on. Pass C
exists to narrow that gap and does so imperfectly: it tells you which consumer never
mentions a value, not whether the mention does anything useful. **A clean run here is not
evidence that the class is exhausted.**

---

## Findings

### 1. ❗ Three trigger types are authored on exactly one character each and matched by nothing

Each is declared in the `Trigger` union (so it typechecks and lints clean), authored once,
and never matched. The effect simply does not exist at runtime — no bar, no dispatch, no
warning.

| character   | trigger        | effect                                         | impact                                                                  |
| ----------- | -------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| **Citlali** | `onState`      | `buff` +250 EM, `target: team`                 | ❗ a 250 EM team buff on a current-meta support draws nothing           |
| **Hu Tao**  | `onStanceEnd`  | `buff` +12% CRIT Rate, `teamExcludingSelf`, 8s | ❗ A1 Flutter By — one of the most-played characters in the game        |
| **Xingqiu** | `onHPDecrease` | `heal`, `target: active` (A1 Hydropathic)      | lower — heal effects have no lane regardless (see "not findings" below) |

The first two are the same shape as the `onReaction` self/active fix that landed at 16:45
today (`c1c86a6`): a real, popular, correctly-authored buff that lands nowhere.

### 2. `durationType` is copied but never branched on — 321 authored values

`206 × "fixed"` and `115 × "refresh"` across the corpus. The field is read in exactly one
place (`effectCollection.ts:133`), inside `normalizeBuffLikeEffect`, which only _copies_ it
onto the synthesized effect. No consumer distinguishes the two.

⚠️ Judgment required rather than a mechanical fix: the buff-bar merge round (`1c52b96`,
today) made refresh behaviour emerge _structurally_ — overlapping same-shape windows merge
into one span — so `refresh` is arguably handled without the field. The open question is
whether a `fixed` buff is now wrongly merged the same way. **Worth a decision, not a
patch.**

### 3. `mobility` — 84 authorings, and its accessor has zero callers

`58 × "stationary"`, `26 × "follows"` on summons, plus the legacy `persistentBehavior`
field. `getPersistentBehavior()` (`ability.ts:1672`) is exported and **called from
nowhere**. Whether a summon stays where it was dropped or follows the active character is
real game information we hold and never surface. Not wrong output — missing output.

### 4. `durationModel` — a required field of an optional shape, read by nothing

`stacks: { maxStacks, durationModel: 'shared' | 'separate' }`. Authored on Columbina,
Varka and Alhaitham (5 instances). ⚠️ Note it is **not optional** in the type, so every
future `stacks` author must supply a value that does nothing. Its neighbour in
`ability.ts` is the retired `canonicalAssumption`, which went the same way for the same
reason — there is precedent in this exact file for retiring rather than wiring.

### 5. `shortName` — declared in four places, displayed in none

Authored on 2 characters and 5 artifact sets; declared on `AbilityCommon`, `ArtifactSet`
and twice in `weapon.ts`. Nothing renders it. Cosmetic, but it is the same class.

### 6. `framesSource` — authored on Nicole, not declared in any type

`"framesSource": "gcsim main (merged)"`. Harmless provenance, but it is the only authored
key with no schema at all — worth folding into `_curatorNotes` or declaring.

---

## Explicitly NOT findings — don't re-audit these

- **`snapshots`** (Fischl, Ganyu) — documented in-schema as forward-looking with a stated
  reason: "the tools model buff windows, not damage."
- **`twoPiece`** (6 artifact sets) — already tracked in `CLAUDE.md`; no Stat key until a
  consumer exists.
- ~~**`noICD` on skills/bursts** — now inert _for a stated reason_~~ ⚠️ **WRONG since
  2026-09-16**: `CastAbility.noICD` IS read (`resolveCastApplications`, `7438ef50`) —
  eight characters depend on it. This entry was a live wrong rule for a month.
- **`heal` (72) and `energy` (29) effects, parser-side** — the planner models neither HP
  nor energy by constitution. The capability layer and Team Builder do consume them.
- ~~**`manual` triggers (167)** — by design~~ ↻ **OVERTURNED**: the channel reached no
  surface and was RETIRED 2026-09-21 (127 → 0, struck from the `Trigger` union —
  `docs/rounds/manual-trigger-retirement-round.md`). The ⚠️ that used to sit here was right.
- **`mobility = "follows"`, `input = "N4"/"N6"`** flagged by pass B are matched
  dynamically, not by literal — pass-B false positives.
- **Provenance keys** (`curatedAt`, `draftedBy`, `generatedAt`, …) — documentation by
  design, like `_curatorNotes`.
- **Effect-level `application[]` + `onReaction.armedFor` / `source: 'active'`**
  (mark-triggered round, 2026-08-17) — read by `sim/reactionProcs.ts` and pinned by its
  tests. ⚠️⚠️ **Pass A cannot see the first one**: it matches by KEY NAME, and
  `application` is already the ability-level field's name, so a green run proves nothing
  about the effect-level one. That is the L5e-a¾ lesson accepted deliberately here —
  one vocabulary for "what lands and when" was judged worth more than a guard-friendly
  synonym, which is how `onStanceEnd`/`afterDuration` became an orphan in the first
  place. ⛔ Don't rename it; ⚓ do keep `reactionProcs.test.ts` if the module moves.
  ⚠️ Deliberately NOT wired anywhere else: a reaction proc draws no timeline bar (it
  grants nothing) and does not enter the finalize hit stream (so it triggers no artifact
  `onHit` set, which IS a divergence from the game — recorded in Nahida's curator notes
  and in `docs/rounds/mark-triggered-damage-round.md` §3.4).

---

## Proposed, not added

~~⏭ Promote pass A to a Vitest guard.~~ ✅ **Approved and landed** — see below.

---

## ✅ Resolved 2026-08-15

### Finding 1 — both team buffs now draw

**Hu Tao A1** was re-authored from `onStanceEnd` to `afterDuration` + `ability: 'skill'`,
and ⛔ **`onStanceEnd` was RETIRED from the `Trigger` union.** The two described the same
instant: a stance's window _is_ the host ability's duration, and `afterDurationStart`
already reads the window's final end, so the early-close case the old doc-comment called
out ("naturally or via Q cast") was covered. ⚓ **Two trigger names for one instant is how
the orphan happened** — the author picked the one nothing implemented.

**Citlali C2** required real work: `onState` is now a consumer in `buffWindows`, spanning
the state's own window. ⚓ An `onState` buff has **no duration of its own** — every other
trigger measures a duration from an instant, this one is co-extensive with a window the
parser already computes. ⚠️ `shielded` is a `State` in the union that nothing ever puts
into `resolvedStates`; it resolves to **shield windows**, so matching only `kind: 'state'`
would have left the bar exactly as invisible as before.

### 🐛 …and a second bug, found only because the first was fixed

Hu Tao's re-authored buff fired at **14.87s instead of 9s**. The stance swap-close assigned
`cs.stance.end = localCursor` unconditionally, so a holder staying on field _past_ the
stance duration **extended a window that had already closed**. A swap can only ever end a
stance early, so the close is a **clamp** — the neighbouring `cs.states` loop had always
clamped, and the comment three lines below already said "`end` clamps to the swap-out
time". `terminatesOnSwap` is on **27 characters**, and every `afterDuration` author read
the stretched span: **Raiden C4, Diona, Chongyun, Venti and Itto have all been firing
late** whenever their holder outstayed the stance. `readyAt` for the stance-end cooldown
clock takes the clamped value for the same reason.

⚓ **The lesson worth keeping: a fix to an invisible bar is how you find a wrong one.** The
orphan hid the timing error, because a bar that never draws can never draw at the wrong
time.

### The guard

`src/lib/data/orphanedSchema.test.ts` — every authored key must have a property _access_ in
`src/` or `scripts/`, against an `INERT` allow-list where **every entry states its reason**
(a bare entry would be the same silence the test exists to break). A second case fails on
_stale_ allow-list entries: a key no longer authored, or one that has since gained a
consumer. Verified by seeded negative — an injected field fails the run and names it.

---

## ✅ Resolved 2026-09-22 — findings 2–6 ruled (⚓ Nate)

Ruled as a launch-triage item, and two of the five turned out to rest on premises that
had gone stale in the five weeks since the run:

- **#2 `durationType`** — cannot be `INERT`-listed (it IS accessed — copied through
  `effectCollection`, authored by `sim/fields.ts` — and the guard's stale-entry test
  refuses a listed key with a reader). Documented at its declaration instead: the engine
  has ONE behaviour (refresh-merge at the projection) and a `fixed` reader is a future
  round; the 394 authorings stand as game truth.
- **#3 `mobility`** — ⚠️ **STALE**: `getPersistentBehavior` gained a caller after the
  run — `sim/states.ts`'s `duringSummon` inference reads `'stationary'` at two sites. Not
  retired; it has a live consumer.
- **#4 `durationModel`** — retires WITH `BuffEffect.stacks` (a shape with no consumer at
  all) in the nine-author pass `docs/rounds/stack-count-display-round.md` §5 queues, ⛔ not alone.
  `INERT` reason updated.
- **#5 `shortName`** — kept; its consumer is the coverage page's row
  (`docs/rounds/coverage-round.md` §7).
- **#6 `framesSource`** — its consumer is the coverage page (§5.3), which declares it and
  reads `gcsim-pr` as provisional timing. `INERT` reason updated until it lands.
