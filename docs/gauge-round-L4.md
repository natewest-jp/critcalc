# L4 — Frame re-derivation + the application schema

**Status:** ✅ SHIPPED · merged `95e91a3` (⚠️ cite the MERGE, not the branch tip) ·
2026-08-16 · the data track of [the gauge round](gauge-round.md)
**Goal:** re-derive every frame value from gcsim in a shape that does not lie about its
fallback, and author — for the first time — **when an ability's element actually lands**.

> ⚡ **The spike changed this landing's method a second time.** L0 retired static Go
> parsing in favour of _running_ gcsim's CLI. This spike found a third route that is
> better than both for the frames half: **link gcsim as a library and read the cancel
> slice directly**. It is exact, it is complete, and it takes seconds.
> See [§2](#2-the-extractor).

---

## 1. What the spike verified

Everything in this section is observed output from a working spike, not inference.
gcsim checkout `d146b6d0`, `go1.26.6`.

### 1.1 A Go program in OUR repo can link gcsim and read the exact cancel slice

`internal/` packages are unreachable from outside the module, but everything needed is
under `pkg/`: `pkg/core`, `pkg/simulation` (whose `import.go` registers all 117
characters), `pkg/testhelper`, `pkg/avatar`, `pkg/enemy`. A shim module with
`replace github.com/genshinsim/gcsim => $GCSIM_REPO`, plus gcsim's own `go.mod` requires
and `go.sum` copied in, builds **offline** against the module cache the oracle already
populated.

Per character: build a core, add the char, `Init()`, then call `Attack` / `ChargeAttack` /
`Aimed` / `HighPlungeAttack` / `Skill` / `Burst` directly and read the returned
`action.Info`:

```go
evt, _ := ch.Skill(map[string]int{"hold": 1})
evt.Frames(action.ActionCharge)   // the exact slice entry
evt.Frames(action.InvalidAction)  // ⚓ index 0 IS the animation length
evt.AnimationLength               // same number, stated
evt.CanQueueAfter                 // earliest cancel
```

⚓ **`action.InvalidAction` is index 0 of the slice, and both constructors fill it with
`animation`.** That is how gcsim itself reads the animation length back out
(`AnimationLength: skillFrames[action.InvalidAction]`), and it is what makes the fallback
observable rather than inferred.

Verified against source constants, e.g. Xiangling:

| ability | dumped                          | source                                                             |
| ------- | ------------------------------- | ------------------------------------------------------------------ |
| N1      | hit 12 / anim 20                | `InitNormalCancelSlice(attackHitmarks[0][0]=12, 20)` ✅            |
| N3      | hit 18 / anim 28 / **C 24**     | `attackFrames[2][action.ActionCharge] = 24` ✅                     |
| N5      | hit 21 / anim 70 / **C 500**    | the `// TODO: this action is illegal` override, carried through ✅ |
| E       | anim 39 / swap 38 / D 14 / J 14 | `InitAbilSlice(39)` + three overrides ✅                           |

**117 characters dumped, zero crashes.** The only failures are honest absences, and they
are all expected:

| failure                              | count | meaning                                                           |
| ------------------------------------ | ----- | ----------------------------------------------------------------- |
| `action aimed not implemented`       | 98    | not a bow                                                         |
| `action high_plunge not implemented` | 66    | gcsim models no plunge for that character                         |
| `action charge not implemented`      | 33    | **14 claymores + 19 bows** — bows charge via `aim`, claymores n/a |
| stance/airborne preconditions        | 7     | needs a prerequisite action first (§7)                            |

⚠️ Plunges need `Player.SetAirborne(AirborneXianyun)` first — for most characters that is
gcsim's _only_ plunge path, and its frames are the Xianyun-launched ones.

### 1.2 The same harness yields the application schedule, per ability, unambiguously

Execute ONE ability in an otherwise-empty core, advance the clock, dump `c.Log`:

```
=== xiangling skill (cast frame 0) ===
  +126  damage   Guoba   ele=pyro tag=4      +126  element  Guoba  ele=pyro dur=25
  +226  damage   Guoba   ele=pyro tag=4      +226  element  Guoba  ele=pyro dur=25
  +326  …  +426  …
=== kaeya skill (cast frame 0) ===
  +28   damage   Frostgnaw  ele=cryo tag=4   +28   element  Frostgnaw  ele=cryo dur=50
=== bennett burst (cast frame 0) ===
  +37   damage   Fantastic Voyage  ele=pyro  +37   element  …  dur=50
```

⚓⚓ **This dissolves L0's attribution problem completely.** L0 had to pair an `element`
event with "the most recent action by the same character" and carry the raw `abil` string
through for a human to adjudicate. Here **only one ability ever ran**, so every event after
the cast frame belongs to it by construction. Xiangling's E applies nothing at the cast and
her Guoba ticks at +126 then every 100f — the §1 finding of the contract document, now a
direct read rather than an argument.

⚓ **`damage` events carry `ele`, and they are emitted even when ICD suppresses the
application.** That is the answer to C4's hazard from the other side: the `damage` stream is
the **nominal** hit schedule (what C3 wants to author), and the `element` stream is the
post-ICD subset (what the gauge must be fed). We author from the first and let `icd.ts`
keep deciding the second.

### 1.3 How wrong the current corpus is — measured

1,042 FrameMaps in the corpus: **565** normal hits, **254** base E/Q, **39** E/Q variants,
**136** charged, **48** plunge.

Final numbers, after the driver table of §7 was filled (the raw spike, before any
prerequisite was modelled, read 702 / 120 / 55 — the difference is entirely a measure of
what the driver table buys):

| finding                                          | number                                       |
| ------------------------------------------------ | -------------------------------------------- |
| maps matching gcsim **exactly** on authored keys | **883 / 1042** — the corpus is in good shape |
| maps disagreeing                                 | **82**                                       |
| maps with no gcsim reading at all                | **77** (38 of them the no-source twelve)     |

⚠️ **A driver gap and a data error are not the same finding**, and the whole design of
L4a is about not confusing them: an ability read off the wrong mode is UNCOVERED, never
"mismatched". §7 is how that line is drawn.

### 1.4 ⚓ The fallback bug is real, and it is NOT where C4b said it was

C4b framed it as "65% of E/Q maps carry a key above `swap`". True, but the E/Q **median
gap is 3 frames** — half a tenth of a second. The damage is on the other side:

| fallback that fires today         | how often  | median understatement |
| --------------------------------- | ---------- | --------------------- |
| **normal → plunge** (`P` absent)  | 533 / 565  | **19 frames**         |
| **normal → charged** (`C` absent) | 266 / 297  | **22 frames**         |
| normal → normal (`N` absent)      | 77 / 103   | 22 frames             |
| E/Q → plunge (`P` absent)         | 343 / 397  | 9 frames              |
| E/Q → charged (`C` absent)        | 327 / 382  | 8 frames              |
| E/Q → jump (`J` absent)           | 64 / 75    | 14 frames             |
| E/Q → skill / burst / normal      | ~370 total | 3 frames              |

⚓ **And the normals' cancel keys are already RIGHT.** `E`/`Q`/`D`/`J` are absent from ~550
of 565 normal maps and resolve to `swap` — which for a normal genuinely _is_ the hitmark,
because `InitNormalCancelSlice` sets all six to the same number. The bug was never "absent
keys are wrong"; it is **"`swap` is the wrong default for the three keys that should read
`anim`"** — `N`, `C` and `P`. A charged attack after a normal is timed a third of a second
early in half the corpus.

---

## 2. The extractor

**One Go program, two outputs.** The frames half and the application half come out of the
same core in the same call, which is the whole reason C4b insisted on one re-extraction
pass rather than two.

| file                               | role                                                                  | contract                        |
| ---------------------------------- | --------------------------------------------------------------------- | ------------------------------- |
| `scripts/gcsim-dump/main.go`       | links gcsim, walks `core.NewCharFuncMap`, emits slices + applications | checked in; built on demand     |
| `scripts/gcsim-dump/drivers.json`  | the per-character prerequisite table (§7)                             | checked in; **hand-maintained** |
| `scripts/lib/gcsim-dump.mjs`       | materialises the shim module into `scratch/`, builds, runs, parses    | plumbing                        |
| `scripts/audit-gcsim-frames.mjs`   | our corpus vs the dump → `docs/curation/gcsim-frames-diff.md`         | ⛔ **never an auto-fixer**      |
| `scripts/migrate-frames-shape.mjs` | the one-shot rewrite of 1,042 maps + application lists                | a MIGRATION, run once, reviewed |

⚓ **The audit and the migration are deliberately two programs with two contracts.** The
project's rule is that an `audit-*` script is a review-candidate generator against an
external source and never writes data (`audit-genshin-db-diff.mjs` sets the precedent), and
that rule is what keeps a wrong upstream value from silently landing. But 1,042 maps cannot
be rewritten by hand, so the mechanical rewrite gets its own name, `migrate-*` — the family
`migrate-curator-notes.mjs` already established — and its output is reviewed as a diff.

⛔ **The build shim is generated, never committed.** `scratch/gcsim-dump/` gets `main.go`
copied in, plus a `go.mod` derived from gcsim's own (module line rewritten, `tool` and
`ignore` blocks dropped, one `replace` appended) and gcsim's `go.sum` copied verbatim. That
regenerates on every run, so a gcsim upgrade cannot leave us building against a stale
dependency set. Every report records the gcsim commit, exactly as L0's does.

### 2.1 ⛔ Why not the two routes we already tried

- **Static Go parsing** (the original §L4 plan) — 924 call sites, ~9% needing a human.
  Superseded by L0 and stays superseded.
- **The gcsim CLI + element log** (L0's route) — perfect for _reactions over a rotation_,
  which is what L0 needed. For per-ability data it is the wrong instrument twice over: the
  cancel slice is not in the log at all (it would take ~60 paired runs per character to
  measure by frame-delta, ≈7,400 runs), and every application has to be attributed back to
  a cast by heuristic. The library route has neither problem. ⚓ **L0's harness is not
  replaced** — it stays exactly as it is, as the end-to-end oracle this landing is graded
  against.

---

## 3. C4b settled — the FrameMap shape

```ts
/** gcsim's two slice constructors, transcribed. */
export type FrameMap = {
	/** `InitAbilSlice(animation)` / the `animation` argument of
	 *  `InitNormalCancelSlice`. The fallback for every key not otherwise set. */
	anim: number;
	/** `InitNormalCancelSlice`'s `hitmark`. Fills the CANCEL keys
	 *  (E, Q, D, J, swap). Normals and charged attacks only — an E/Q slice has
	 *  no such tier, and authoring one there is a lint error. */
	hit?: number;
} & Partial<Record<ActionKey, number>>;
```

Resolution — `frameAt(fm, key)`, one function, replacing every `fm[k] ?? fm.swap`:

```
explicit key  →  hit (if key ∈ {E,Q,D,J,swap})  →  anim
```

- ⚓ **`swap` stops being required and stops being the fallback.** It survives as an
  ordinary override for the E/Q slices where it genuinely differs from `anim`
  (Xiangling E: `anim 39, swap 38`).
- ⚓ **A normal swing becomes two numbers and its hitmark becomes explicit** —
  `{ "swap": 24, "N": 35 }` → `{ "anim": 35, "hit": 24 }` — which is what C3 needs and is
  the reason this is one landing and not two.
- ⚠️ `P` joins the `anim` tier, not the `hit` tier. `InitNormalCancelSlice` does not
  override `ActionHighPlunge`, and the spike confirms it (Xiangling N1 `P = 20 = anim`).
- ⚠️ We keep our own `ActionKey` vocabulary. gcsim's `Aim`, `LowPlunge`, `Walk`, `Wait`
  and `Delay` slots are read by nothing here; `A` in our notation is a bow's charged
  attack and already resolves through `chargeHits`.

### 3.1 The migration rule, and where it must NOT run

For every map with a **matched, driver-verified** gcsim slice: `anim`, `hit` and every
differing key are written from the dump. ⚓ **C4b's ruling is that gcsim is the source for
all frame data**, so a disagreement is resolved in gcsim's favour — and every value that
moves is enumerated in the audit report for a human to read before the commit lands.

⛔ **It must not run on a map whose slice was captured in the wrong mode.** That is the
120-disagreement set, and until the driver table (§7) reaches the right mode for each, those
maps are excluded from the rewrite and get `anim = swap` — preserving today's behaviour
exactly — plus an entry in the provisional register.

⛔ **It must not run on the 12 characters with no gcsim source** (blank, iansan, ifa,
illuga, jahoda, kachina, linnea, lohen, nefer, prune, sandrone, zibai). Their maps get
`anim = swap` and a `_curatorNotes` line. That is a deliberate no-op, not a derivation.
✅ The six Travelers are **not** in this set — they map by name (`traveler_anemo` →
`aetheranemo`) and dump fine.

---

## 4. C3 settled — where the application list lives

```ts
export type ElementalApplication = {
	/** Frames from cast start to the hitmark. */
	frame: number;
	/** ⛔ ABSENT MEANS PHYSICAL, i.e. applies nothing. Never a default element. */
	element?: Element;
	/** Gauge units. ⚠️ L5 — not authored by this landing. */
	units?: number;
};
```

On `SkillAbility` / `BurstAbility` / `AbilityVariant` as `application?: ElementalApplication[]`.

- ⛔ **Normals get no list.** Their hitmark is `frames.hit` and their element is already
  resolved by `resolveActionElement` (physical unless catalyst or infused). Adding a
  parallel list would be a second copy of a rule that already has one owner. That is 565
  maps we do not touch.
- ⛔ **Summons get no list.** `interval` / `firstTickDelay` already say when a summon
  applies, and C3 says not to re-model good data. ⚓ The dump gives us their real cadence
  for free (Guoba: `firstTickDelay 126`, `interval 100`), so the audit **cross-checks**
  authored summon timing as a side effect — a bonus finding, not a schema change.
- ⚓ **An empty array is the positive statement that a cast applies nothing** — Xiangling's
  E, Hu Tao's E, Xiao's Q. That is the single most valuable thing this landing authors,
  because it is the class the corpus could not previously express at all (§1 of the contract
  doc: "the corpus records when a cast can be CANCELLED, never when it LANDS").
- ⚠️ **Absent ≠ empty.** Absent is "we never drove this" and lands in the provisional
  register; it applies nothing _and says so_. An `orphanedSchema` `INERT` entry is not
  needed — the consumer lands in the same landing (L4d).

### 4.1 What the extractor writes, and what it does not

The application list is built from the **`damage` stream**, filtered to events whose `abil`
is not a known summon of that ability, within a horizon after the cast. `frame` is
`event.frame − castFrame`; `element` is `logs.ele`, omitted when `physical`.

⚠️ `units` is deliberately left unwritten even though `element` events hand us
`dur / 25` for free. Authoring it now would put a number in front of the engine that reads
it, which is exactly the split C3 drew and exactly what `orphanedSchema.test.ts` exists to
catch. The extractor **reports** durability in the audit so L5 starts with it measured.

---

## 5. Rulings

### 5.1 ⚓ L4d is the task queue's first real customer

L3 installed a clock with an empty task queue on purpose. Applying an element at
`cast + frame` instead of at `cast` is precisely a `LAND` task, and the priority band
(`EXPIRE < TICK < LAND < ACT`) is already written down and pinned. So the consumer change
is small: `emitReactionsAtCast` stops calling `emitReactionsForApplication` inline and
schedules one task per application entry.

⚠️⚠️ **This moves reaction event times, and therefore may move buff-window emission order
— C2's named hazard.** It cannot be gated by IR equality, because the IR is _supposed_ to
change. It is gated by the L0 oracle, by the row projections from the L3b differ read as a
**report rather than a pass/fail**, and by Nate's eyes on the timeline and the PNG.

### 5.2 ⛔ No behaviour change rides along with the shape change

L4b (shape) and L4d (application timing) are separate commits with separate verification.
L4b's rewrite is mechanical and its expected diff is "some cursor advances get longer";
L4d's is "reactions move to their hitmark and some casts stop reacting at all". Landing them
together would make either one impossible to attribute.

### 5.3 ⚓ The provisional register is a file, not a feeling

`docs/curation/gcsim-frames-diff.md` carries three enumerated sets, by name, every run:

1. maps the driver never reached (no gcsim source, or no driver entry),
2. maps whose dumped slice disagrees with the authored one and has not been adjudicated,
3. abilities with no application list.

⛔ A count is not enough. L0's own acceptance criterion — "coverage is stated numerically,
a believed-total partial oracle is worse than an acknowledged partial one" — applies here
with more force, because this landing writes into the corpus.

### 5.4 ⚓ Update the `ingest-character` skill in this landing

Non-negotiable, and it is in the contract already: a recipe that does not produce `anim`,
`hit` and an application list means every future character ships without them and silently
regresses the sim. The skill gains a stage that runs the dumper for one character.

---

## 6. Order of work

Five commits on one branch, `refactor/gauge-l4`. Gates (`vitest` / `check` / `lint` /
`build`) after each; `test:e2e` and the L0 oracle before the merge.

### L4a — the extractor

`scripts/gcsim-dump/` + `scripts/lib/gcsim-dump.mjs` + `scripts/audit-gcsim-frames.mjs`,
producing `docs/curation/gcsim-frames-diff.md`. ⛔ **No production code, no character
JSON.** Ends with the driver table (§7) filled until set (1) is only the 12 no-source
characters and set (2) is a hand-adjudicated list with a reason per row.

### L4b — the FrameMap shape

`FrameMap` gains `anim`/`hit`; `frameAt()` replaces every `?? swap`; `characterLint` swaps
`missing-swap` for `missing-anim` and forbids `hit` on an E/Q slice;
`scripts/migrate-frames-shape.mjs` rewrites 1,042 maps. **Behaviour changes here** — cursor
advances get longer where a fallback was firing.

### L4c — the application schema

`ElementalApplication`, the `application` field on skill/burst/variant, the lint rule, and
the extractor's authoring pass. Data only; nothing reads it yet, so the landing is inert and
`orphanedSchema.test.ts` is expected to **fail** at this commit — ⚓ that failure is the
guard working, and L4d is what answers it. (Kept as one commit rather than folded into L4d
so the authored data is reviewable on its own.)

### L4d — the consumer

`sim/aura.ts` + `sim/run.ts`: applications are scheduled as `LAND` tasks at
`cast + frame`; an empty list applies nothing; an absent list applies nothing and is
counted. Re-run the L0 oracle and record the new numbers against the 63 / 200 / 138
baseline.

### L4e — the recipe

`ingest-character` skill, `docs/curation/data-quality-plan.md`, and this file's outcome
section.

---

## 7. Coverage is the risk, and the driver table is the answer

L0 §3 called it: running sees one path where static reading sees all branches. Here the
paths are enumerable, because **our own corpus says which ones exist** — 39 variant
FrameMaps across 34 characters, with inputs `hE` ×29, `h1E` ×2, `h2E` ×2, `sQ` ×2, `E` ×4,
plus the ~20 characters carrying a condition-gated in-stance normal ability.

⚓⚓ **And the table came out far smaller than planned, because the corpus already says
what gates each ability.** The audit reads every ability's own `conditions` and DERIVES
the prerequisite:

| condition                       | derived prerequisite         | who                                                      |
| ------------------------------- | ---------------------------- | -------------------------------------------------------- |
| `chainStage {ability, index:N}` | N repeats of that action     | Diluc E2/E3, Keqing's recast, Xianyun's Skyladder, Dehya |
| `state {state: S}`              | one lookup in `drivers.json` | the ~20 stance characters                                |

So `drivers.json` answers exactly one question per row — _what puts this character into
that state_ — and nothing else:

```jsonc
{
	"cyno": { "states": { "inStance": [{ "action": "burst" }] } },
	"mavuika": {
		"states": { "nightsoulBlessing": [{ "action": "skill", "params": { "hold": 1 } }] }
	},
	"xiao": { "states": { "inStance": [] } }
}
```

⚓ **An EMPTY step list is a row, not an absence**, and it states something: _this state
does not change the frames — read them off the base capture_. Hu Tao, Wriothesley, Xiao,
Yoimiya and Durin's dark form are all like that, and Arataki Itto scores strictly WORSE
with a prerequisite than without one. ⛔ Leaving them out instead would file them as
UNCOVERED, which is a different and untrue claim.

⚓ **Every row was measured, not guessed.** Each candidate (`skill`, hold-`skill`,
`burst`, and pairs) was run and SCORED against the FrameMaps the corpus already authors
for that character's gated abilities; a row exists only where the prerequisite beats no
prerequisite, and `_scored` records both numbers. That is what turned Skirk from
"unresolvable" (the burst reading was a near-miss at 0/6) into `skill` at 6/6, and
Mualani's 215-frame Sharky's Bite from "a mis-authored full sequence" into a value gcsim
reproduces exactly.

Four remain unresolved and are named in the file with a reason: **chasca**, **kinich**,
**lan_yan**, **varesa**.

⛔ **Fan-out is the wrong tool here.** The contract document says L4 is "embarrassingly
parallel — 123 characters, each independently verifiable", and that was written for the
static-reading route where each character was a human read of Go source. It is not:
extraction is now one script that finishes in seconds, and the residue is ~40 table rows
plus one adjudication list. Splitting a 40-row table across agents buys nothing and costs
consistency.

---

## 8. Traps

- 🐛 **`swap` is load-bearing in more places than the parser.** `characterLint` requires
  it in four places, `resolve.ts` has a `Math.max(...Object.values(frameMap))` guard for
  the two maps that lack it (qiqi skill, Mika hE), and `genericProfile.ts` is derived from
  the corpus. All four move together or the fallback silently disagrees with itself.
- 🐛 **A claymore has no charged-attack frames on either side.** 14 claymores have no
  gcsim `charge` and no `chargeFrames` in our data — so nothing to migrate, and ⛔ nothing
  to "fix". A bow's charged attack is gcsim's `aim` and maps to `chargeHits`.
- ⚠️ **Plunge frames are the Xianyun-launch frames** for the 51 characters where that is
  gcsim's only plunge path. Record it; do not present them as generic plunge timing.
- ⚠️ **The dumper calls ability functions directly, bypassing `Player.Exec`.** Cooldowns,
  energy and stamina are not checked, which is what makes it exhaustive — but it also means
  a character whose ability legitimately varies with resource state will dump its
  resource-free branch. `Flags.IgnoreBurstEnergy` is set for the same reason.
- ⚠️ **`Attack()` advances `NormalCounter` via `defer`**, so calling it N times walks the
  combo correctly and `Frames` is captured before the advance. This is relied upon; a gcsim
  refactor of that idiom would silently shift every normal by one index. The audit's
  match rate against the authored corpus is the canary.
- ⚠️ **gcsim's own TODOs come through verbatim** — Xiangling N5 `C = 500` is a real slice
  entry marked "this action is illegal" upstream. Migrating it is correct (it is what gcsim
  models) but it should be flagged, not silently absorbed.

---

## 9. Done when

- Every curated skill/burst ability and variant has an `application` list, or an entry in
  the provisional register with a reason.
- Every FrameMap has `anim`; `frameAt()` is the only resolver; `characterLint` enforces both.
- `docs/curation/gcsim-frames-diff.md` states coverage numerically and names all three
  provisional sets.
- The L0 oracle is re-run and its numbers recorded against the 63 / 200 / 1 / 138 / 0
  baseline. ⚓ **L4 does not need to beat it** — the missing 138 are overwhelmingly summon
  ticks, which are L5's. What L4 must not do is make it worse without an explanation.
- `ingest-character` produces the new fields.
- Nate has looked at the timeline and the PNG. ⚠️ Timings **will** have moved; the question
  is whether they moved the way §1.4 predicts.

---

## 10. Open

1. **The 120 disagreements** — how many survive the driver table is unknown until L4a runs.
   If a residue of genuine gcsim-vs-us conflicts remains, C4b says gcsim wins, but each one
   should be eyeballed rather than swept.
2. **Constellation-gated application.** The spike runs at C0. 47 of the corpus's 104
   `damage` effects are constellation-gated, and gcsim's `cons.go` really does add hits. A
   C0/C6 double dump is cheap; whether the schema should carry a per-constellation
   application list is a question for L5, not this landing.
3. **`travel`.** Still a gcsim policy, not game data (76 sites, default 10). Aimed-shot
   applications inherit it. ⛔ Do not ingest a bow's aimed timing as measured.

---

## 11. L4a outcome — the extractor (2026-08-16)

✅ Shipped. `scripts/gcsim-dump/{main.go,drivers.json}` + `scripts/lib/gcsim-dump.mjs` +
`scripts/audit-gcsim-frames.mjs` → `docs/curation/gcsim-frames-diff.md`. No production
code, no character JSON. **The whole roster dumps and diffs in ~2 s.**

|                       |                                                                           |
| --------------------- | ------------------------------------------------------------------------- |
| characters            | 123 authored · 111 with a gcsim source · 12 without                       |
| FrameMaps             | 1,042 authored · **883 match gcsim exactly** · 82 disagree · 77 uncovered |
| application schedules | **276 observed** · 12 not                                                 |
| summon tick streams   | 73 cross-checked, side by side                                            |

### The five findings worth reading before L4b

1. ⚓⚓ **19 casts apply nothing at all**, positively — Itto's Q, Cyno's Q, Xiao's Q,
   Skirk's E and Q, Yoimiya's E, Kinich's E, Mualani's E, Clorinde's E, Wriothesley's E,
   Barbara's Q, Mika's Q, Nahida's Q, Sethos's Q, Lauma's Q, Kujou Sara's E, Gaming's E,
   Durin's E. Every one of them applies its element at the cast today. **This is the class
   the corpus could not previously express**, and it is the single largest correction in
   the landing.
2. ⚓ **Our `plungeFrames` are gcsim's LOW plunge, corpus-wide** — 36 maps match `lP`, 1
   matches `P`. Not a bug in either direction until someone rules on what our `P` token
   means, but it must be ruled on before the migration writes anything to a plunge map.
3. ⚓ **A bow has ONE aimed shot in gcsim.** `aim` is the fully-charged one (Amber 96f),
   and `aim[hold=1]` returns the identical slice for 18 of 19 bows. Our `chargeHits[0]`
   partial draw therefore has no oracle at all — 14 maps, now reported as uncovered rather
   than diffed against the wrong thing. Ganyu is the lone exception.
4. ⚠️ **22 abilities emit a regular damage stream with no authored summon.** Some are
   multi-hit bursts that belong in the application list (Keqing's eight consecutive slashes,
   Ayaka's nineteen Soumetsu cuts, Wanderer's Kyougen); some look like genuinely unmodelled
   things left in the world (Barbara's Melody Loop, Charlotte's marks, Mavuika's Rings,
   Dori's connector, Baizhu's Universal Diagnosis, Mizuki's Dreamdrifter). ⛔ Each needs a
   human verdict — the two get authored in different places.
5. ⚠️ **The summon cross-check found real drift**: Ineffa's Birgitta ticks at 119f against
   an authored 120f (twice), Aino's Ducky first-ticks at 133f against 123f, Fischl's Oz and
   Emilie's Case both start later than authored, Zhongli's Stele at 24f against 0f.

### What the plan got wrong

- **§7 assumed a ~40-row hand table.** It is 18 rows, because the corpus's own
  `conditions` derive the rest. The general lesson is the one the round keeps re-learning:
  ⚓ ask the data what it already knows before writing a table.
- **§1.3's "120 disagreements across 37 characters" was a driver gap, not data drift.**
  With prerequisites modelled it fell to 82, and most of the remainder are real.
- **The tick cross-check was first written as a NAME join and that was wrong** — gcsim's
  ability strings are its own (our `Itzpapa` is its `Obsidian Tzitzimitl DMG`, our
  `General's Glory` is its `Juuga: Forward Unto Victory`, and it spells Tamoto "Tamato").
  It reported twenty healthy summons as missing. Both sides are now printed side by side
  and paired by eye.
- ⛔ **Cadence does not make a summon.** Classifying any evenly-spaced stream as a tick put
  four multi-hit bursts in the wrong column and made them read as applying nothing — the
  exact false positive finding #1 is supposed to be trusted for. A stream is a tick only
  when the ability DECLARES a summon.

### Traps found while building it

- 🐛 **A Go `defer`+`recover` with a BARE return silently returns the zero value.** Three
  characters' panicking abilities came back with no key and no error, and the audit filed
  them as "not captured" rather than as the gcsim panics they were. Named returns
  throughout `main.go` now; ⚠️ do not "simplify" them back.
- 🐛 **Prerequisites must advance the clock.** A no-advance version looked right (a mode
  flag is set at execution) and panicked: Ayato's second Skill inside one frame drives his
  charge count below zero.
- ⚠️ **gcsim panics on Varka's N3–N5** (`index out of range [1] with length 1`) — an
  upstream gap on a very new character, reported rather than worked around.
- ⚠️ **`travel=0` is pinned on every aimed shot.** gcsim's default of 10 is a simulation
  policy that lands inside the observed hitmark; zero measures "frames until the arrow
  leaves the bow", which is the distance-independent number.

---

## 12. L4b outcome — the FrameMap shape (2026-08-16)

✅ Shipped. `FrameMap` is gcsim's slice shape: `anim` is required and is the fallback,
`hit` carries a normal's hitmark, `swap` is an ordinary optional override.
`frameAt()` in `$lib/utils/frames.ts` is the only resolver. **The corpus shrank by
~8,400 lines** — the reshape is a compression as well as a correction.

|                           |                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------- |
| FrameMaps rewritten       | **941 migrated** · 72 preserved (no gcsim reading) · **69 held back**              |
| `lowPlungeFrames` created | **40**                                                                             |
| audit after               | **960 of 1,082 match gcsim exactly**, 35 disagree, 87 uncovered                    |
| L0 oracle                 | **unchanged at 63 / 200 / 1 / 138 / 0** — L4b moves timings, not application logic |

⚓ **The plunge split, per Nate's ruling: the HIGH plunge is the default.** `plungeFrames`
now means the high plunge and serves `P`/`hP`; the new `lowPlungeFrames` serves `lP` and
falls back to the high map. ⚠️⚠️ **The meaning of `plungeFrames` CHANGED** — 36 of its 41
authors were carrying low-plunge numbers, so any note or value that predates this round is
describing a different thing.

### ⚓ The curator already knew — the schema couldn't say it

Kaeya's `_curatorNotes`, written long before this round:

> "N5: ActionCharge=500 is explicitly set but gcsim source comment says 'this action is
> illegal' — omitted. ActionAttack (N) defaults to AnimationLength=64 … not explicitly
> overridden — omitted."
> "plungeFrames: gcsim has separate lowPlungeFrames (hitmark=45, swap=64) and
> highPlungeFrames (hitmark=47, swap=67); using lowPlunge values here. High plunge frames:
> swap=67, N=56, E=57, Q=56, D=47 — **not represented**."

Every one of L4b's findings is in there, in prose, with the numbers. **The corpus was not
wrong; it was inexpressible.** 325 such frame-shape notes exist, and mining them is what
found Albedo (below). ⚓ Read the curator notes before overruling the corpus.

### The four guards, each of which caught a real regression

The plan had exactly one rule — "gcsim wins" — and it was not enough. Each of these was
added because the migration broke something the test suite or the corpus caught:

1. **The 500 sentinel.** gcsim writes `ActionCharge = 500` thirty times with the comment
   "this action is illegal; need better way to handle it". Migrating it verbatim gave 48
   maps an 8.3-second `N5 C`. ⚓ Dropping it is the game-accurate reading, not a
   workaround: the combo resets when the animation ends and a charge after that IS legal,
   which is exactly what falling back to `anim` says.
2. **No distinct hold.** gcsim models a separate `skill[hold=1]` for only 47 of 109
   characters; for the rest it returns the tap's slice verbatim. ⛔ That is gcsim declining
   to model the hold, not evidence the hold equals the tap — and taking it as data
   overwrote the geo Traveler's genuine hold with her tap. Caught by the roster gate's
   hold-distinctness invariant, which is precisely what that gate is for.
3. ⚓⚓ **THE MIGRATION MUST NOT COLLAPSE A DISTINCTION THE CORPUS DRAWS.** If two authored
   maps in the same group differ today and would be identical after, the capture describes
   ONE of them and is being written to both. Three regressions the magnitude rule sailed
   past: Keqing's blink recast, **Flins' `sQ`** (gcsim models the SHORT burst as the base,
   so the migration overwrote our long one with it and made both short) and Hu Tao's
   Paramita frames. ⛔ The whole GROUP reverts, not the loser — which of the pair the
   capture describes is exactly what we do not know.
4. **A variant whose input is the plain `E`** is selected by STATE, not by token — Varka's
   Four Winds' Ascension only exists with a Pyro/Hydro/Electro/Cryo unit in the party,
   which a single-character dump can never produce. Comparing it to the base capture
   reports a mismatch between two different abilities.

### The short list — 69 maps held back, and why

⚓ Nate: _"apply the C4b rule, flag the odd ones."_ These are the odd ones. Each keeps
today's values (`anim = swap`, behaviour unchanged) and each needs a human.

| character                                                            | maps | why                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **albedo**                                                           | 1    | ⚓ **OUR DATA IS RIGHT.** The curator note says gcsim passes `attackHitmarks[3]` into N5's slice — 17f, which cancels BEFORE the hit lands — and calls it a likely upstream typo. Our 27 is the real hitmark. |
| **tartaglia**                                                        | 2    | ⚠️ **TRANSPOSED.** Our ranged burst reads 54/53 against gcsim's 102/101, and our melee burst reads exactly the reverse. A corpus fix, not a migration.                                                        |
| varesa · lan_yan · chasca · kinich                                   | 40   | the four unresolved drivers (§7)                                                                                                                                                                              |
| hu_tao · nilou · yun_jin · keqing · flins                            | 19   | would collapse a distinction gcsim does not model                                                                                                                                                             |
| traveler_hydro · furina · sigewinne · bennett · arataki_itto · yelan | 7    | a key moves ≥ 60 frames — a second or more is a different action, not drift                                                                                                                                   |

### Traps

- 🐛 **`preserveFrameMap` writes `swap` redundantly beside `anim`, on purpose.** Dropping
  it made Itto's charge map hold back on pass one and migrate on pass two, because the
  delta was suddenly computed over two keys instead of three. `anim === swap` also reads
  as "the animation length was not measured, it stood in" — which is true.
- ⚠️ **The holdback delta is measured over the keys the corpus ASSERTS, not over the
  resolved reading.** An absent key is not a claim, and gcsim disagreeing with the old
  `swap` fallback about it IS the bug being fixed — measuring that as a conflict held back
  452 maps, which is the migration refusing to run.
- ⚠️ **`genericProfile.ts` was regenerated** and its numbers moved (frameless skill 37f →
  44f, burst 93f → 95f) because the medians are now over `anim`. `castSwap` was renamed
  `castAnim` for the same reason. Cooldown and energy modes are unchanged.
- ⚠️ **The migration formats through prettier's own API.** A bare
  `JSON.stringify(…, '\t')` re-expands every `"input": ["N"]` and doubles the diff.

---

## 13. L4d outcome — the sim reads it (2026-08-16)

✅ Shipped. `emitReactionsAtCast` no longer applies `char.element` at frame zero; it
schedules one `Band.LAND` task per `application[]` entry at `cast + frame`. ⚓ **The
first real customer of L3's task queue**, which was installed empty and pinned by
`clock.test.ts` against exactly this.

### The measurement

⚠️ **Read the Δ column, not the counts.** The oracle pairs applications ORDINALLY — the
nth by a character — so a cast that applied at frame 0 when the game applies at frame
126 still counted as "matched". The count of matches is therefore almost insensitive to
the thing L4d fixes, and the timing error is where it shows:

| paired applications                                 | before L4d | after L4d    |
| --------------------------------------------------- | ---------- | ------------ |
| median \|Δ\|                                        | 35 frames  | **1 frame**  |
| within 6 frames                                     | 11 (18%)   | **35 (61%)** |
| within 30 frames                                    | 28 (45%)   | **45 (79%)** |
| **phantom** applications (we apply, gcsim does not) | 1          | **0**        |

Barbara's Melody Loop is the clean case: ours now reads
`0.05 · 1.55 · 3.05 · 6.05 · 9.05 · 12.05` against gcsim's
`0.07 · 1.57 · 3.07 · 6.07 · 9.07 · 12.07` — six for six, within a frame.

⚠️ Total applications fell 63 → 57 and "gcsim applies, we do not" rose 138 → 144. That
is precision improving, not coverage regressing: the missing rows are still
overwhelmingly summon ticks, which are L5's, and the removed rows were phantoms or
ICD-suppressed duplicates. ⛔ Do not read the headline count as the score.

### ⚓ C3 amended: EMPTY and ABSENT are different

C3 ruled that an absent list applies nothing, reasoning from gcsim, "where `Durability`
is not defaulted anywhere". ⚠️ That conflates two things the corpus can now tell apart:
in gcsim an omitted durability means the AUTHOR intended no application; in our corpus
an absent list means **we did not measure it**.

|        |                                                                      |
| ------ | -------------------------------------------------------------------- |
| `[]`   | MEASURED to apply nothing — 39 abilities, and the point of the field |
| absent | UNMEASURED — falls back to the old model, counted as provisional     |

Taking absent as nothing deletes the element from the 12 characters with no gcsim
source and 6 with partial coverage: Linnea's Geo would simply never crystallize. Of the
two errors a cast-instant stand-in is much the smaller — the reaction happens, timed a
few frames early — and C3's real target is fully served, because `[]` now says it.

### ⚓⚓ A cast's OWN hits are ICD-gated; across casts they still are not

This one went back and forth twice and the census settled it, so the reasoning matters
more than the answer.

The standing rule from the ICD round is **"⛔ E/Q casts stay ungated — ICD counts HITS
and a cast is an ABILITY"**, justified by _we model a multi-hit skill as one
application_. `application[]` retires that premise, and leaving casts wholly ungated
measurably over-applies: Barbara landed **twelve** hydro applications against gcsim's
six.

But gating across casts is wrong, and gcsim says so out loud:

- **112 of 166 skills are `ICDTagNone`** upstream (and 70 of 132 bursts) — they apply on
  every hit, and our schema has no way to record which.
- Of the tagged remainder the GROUP varies wildly. Xiao's Lemniscatic Wind Cycling is
  `ICDTagElementalArt` but sits in a group whose reset timer is **5 frames** — verified
  in the log, gcsim applies both of his back-to-back E casts. A standard 2.5 s counter
  would have deleted the second, and the corpus test that pins that ⛔ would have been
  right to fail.

⚓ So the counter is scoped to **one cast**: a multi-hit ability's hits genuinely share a
tag, while across casts our data cannot say whether they do. That reproduces gcsim on
both measured cases. ⚠️ Because the counter never spans casts, the gate is a PURE
function of the list — which is why `resolveCastApplications` can be shared with the
oracle instead of re-implemented.

⚠️ **Per-ability ICD tag + group is now the top schema gap**, and it is L5's: `noICD` is
binary and the truth is a tag and a group with its own reset timer.

### 🐛 The oracle described a model we no longer had

For one commit, L4d changed the engine and `audit-gcsim-reactions.mjs` reported the
baseline **unchanged** — because its `ourApplications` had the old rule written out
longhand: "every E/Q cast applies the caster's element at `cast.time`". An oracle that
silently measures a model you have replaced is worse than no oracle, and this one had a
header promising it reused `icd.ts` "so this cannot drift from the model it is meant to
describe". It drifted anyway, in the one place the promise had not been kept.

⛔ Both rules are now imported: ICD from `$lib/utils/icd.ts`, the cast schedule from
`resolveCastApplications` in `$lib/sim/aura.ts`. Never inline either again.

### Known hazards this landing introduces

- ⚠️ **A long application stream is not truncated on swap.** A cast's hits are scheduled
  unconditionally, so an ability whose thing-in-the-world we have not modelled as a
  summon — Barbara's Melody Loop, Charlotte's marks, Dori's connector, Mizuki's
  Dreamdrifter, 22 in all — keeps applying after the character leaves the field. ⚓ The
  fix is DATA, not engine: model them as summons, which the audit already flags as
  "⚠️ regular, no authored summon".
- ⚠️ **The dispatch context is captured at the cast while the aura is read at the land.**
  Deliberate: the aura is the thing whose timing was wrong, and re-resolving a state set
  inside a scheduled closure is L5's problem, when reactions stop being synthesized.
- ⚠️ **The corpus's one surviving `plungeVariant`** (Kazuha's "After Hold E") has no
  gcsim analogue, so it was preserved — which leaves it holding low-plunge-shaped numbers
  while `plungeFrames` beside it now holds the high plunge. One row, named here rather
  than left to be rediscovered.
- ⚠️ **The queue is drained at the end but the reported duration is the pre-drain frame.**
  Klee's mines land 240 frames after her E and must fire; they are not more rotation,
  and letting the drain move `clock.now` would stretch the timeline ruler.

### Gates

`vitest 1493` · `check` · `lint` · `build` · the L0 oracle re-measured · **`test:e2e`
73 + 73** (both engine lines read separately, per the ⚠️ in the verification policy —
Chrome's run also hit the documented upstream teardown hang,
[playwright#39753](https://github.com/microsoft/playwright/issues/39753), which is why it
took 5.7 min against WebKit's 1.3; ⛔ not ours to bisect).

✅ **Visually verified (⚓ Nate 2026-08-16), live tool and PNG export both.** The verdict
is the one this landing wanted: _"different, but not suspiciously different."_ Two
specifics worth keeping, because they are the predicted shapes showing up by name:

- **Bennett's E nudged a touch longer** — the `swap` fallback was understating a cursor
  advance, exactly §1.4's class.
- ⚓ **Kazuha's buffs fire LATER in his attack string** — the buff no longer starts at
  cast-start because the element now lands on its hitmark. That is L4d visible on screen,
  and it is the single clearest confirmation that the round did what it said.

### Tests that changed, and why

- **Mizuki's A1 extension** expected +2.5 s (one swirl) and now reads +5 s (the
  two-extension cap). Her Dreamdrifter is a continuous attack — eight anemo applications
  at 45-frame intervals — so she reaches the cap from one cast. The old number was an
  artefact of one-application-per-cast.
- **The stance-death guard** ("a matching reaction long after the stance died no longer
  extends the bar") was written against Mizuki and L4d took its ability to fail: with the
  cap reached inside the stance, a late swirl cannot change the number either way. ⛔ A
  test that cannot fail is worse than no test, so the invariant moved to a purpose-built
  stub with a high cap and one application per cast.
