# Orphaned-schema audit — authored data with no consumer

**Run 2026-08-15**, after a day in which seven separate bugs turned out to be the same
meta-bug: data authored correctly, and no code path reading it. `factionBonuses`,
`noICD`, `twoPiece`, the five `infuse` effects, `shield` windows, variant `effects`, and
`summons[1]` were all that shape. This sweep asks whether there are more.

**Findings only — nothing here was changed.**

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
- **`noICD` on skills/bursts** — now inert _for a stated reason_ (a cast is
  ability-granularity, not hit-granularity — see `docs/icd-round-handoff.md`).
- **`heal` (72) and `energy` (29) effects, parser-side** — the planner models neither HP
  nor energy by constitution. The capability layer and Team Builder do consume them.
- **`manual` triggers (167)** — by design: the player asserts these, the parser does not
  fire them. ⚠️ Worth confirming that is still the intent, since it is roughly a third of
  all authored triggers.
- **`mobility = "follows"`, `input = "N4"/"N6"`** flagged by pass B are matched
  dynamically, not by literal — pass-B false positives.
- **Provenance keys** (`curatedAt`, `draftedBy`, `generatedAt`, …) — documentation by
  design, like `_curatorNotes`.

---

## Proposed, not added

⏭ **Promote passes A and C to a Vitest guard** (`orphanedSchema.test.ts`): fail when a key
authored in the corpus has no property access in `src/`, against an explicit allow-list of
the documented-inert fields above. It would have caught six of today's seven bugs at
authoring time, and it survives refactors because it asserts a relationship rather than a
value. ⚠️ Needs approval per the verification policy — proposing, not adding.
