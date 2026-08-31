# The Polestar Field round

> **✅ SHIPPED 2026-09-01** (branch `feat/polestar-field`). ⚓ **§6 IS THE
> RECORD — read it first.** §0–§5 are the SPEC, written 2026-08-31 during
> Odette's Stage 2, and they are the BEFORE: §2's cost estimate was measurably
> too high in two places and §4's "together or not at all" was overtaken, both
> flagged at their heads. §0's correction (7s, two clocks) held and is what the
> build was written against.

## 0. The number to correct first

⚠️⚠️ **The field's entity lasts 7s, not 6s**, and it is not called a Polestar
Field. Fandom's Stellar-Conduct page, § Starlight Prism:

> "After Stellar-Conduct is triggered, the resulting **Starlight Prism** lasts
> for **7s** and will continuously sustain a Polestar Field around it."

⚓ **There are TWO clocks and they are not the same clock.** The Prism runs 7s.
Inside it, "**Every 4s, the count is reset, and buffs lasting 4s are granted**".
What the corpus draws today is the 4s grant cycle, and it draws it correctly —
a Prism bar would be a THIRD span beside two that already exist.

## 1. What the corpus does today, and why it is a stand-in

Three effects on each enabler's "Stellar Jubilee: …" passive, triggered by
`onReaction stellarConduct, source: 'team'`, 4s / refresh:

| effect                     | value | source                                                            |
| -------------------------- | ----- | ----------------------------------------------------------------- |
| `cryoDmgBonus` team        | +20   | Provided Buffs table, 0 recorded hits                             |
| `electroDmgBonus` team     | +20   | same                                                              |
| `resShred` physical, enemy | −40   | "All enemies in the field have their Physical RES reduced by 40%" |

⚠️ These are properties of the FIELD, not of the character who enabled it — any
party member's Stellar-Conduct creates one. But the corpus has **no home for
reaction-level data** (`reactionBridge.ts` is code, not data), so each enabler
carries a copy. Sandrone had it from 2026-07-29; Odette got the mirror
2026-08-31; **Cryo Traveler will be the third.**

⚠️ The cost is a party fielding two enablers drawing two identical bars, one per
source character. No values are summed on screen, so it reads as redundant
rather than wrong — which is why it was allowed to stand for one more round.

## 2. What building it needs

> ⚠️ **TWO OF THESE WERE OVERSTATED, measured in the build.** §2a is a walk over
> reaction events, not new plumbing — a Stellar-Conduct is already an IR
> `reaction` event, so the producer reads a stream that was there all along. And
> §2b's "a Prism lane costs bench geometry and pixels" assumed a lane in the
> TRACK area; the strip went into the aura lane's own header at a **conditional**
> height, so a rotation with no gadget pays zero. §2c, §2d and §2e stood exactly
> as written.

Each row is a real piece of work, and the first three are the ones that make
this a round rather than an afternoon.

### 2a. A producer that is not a cast

Every `summon` window in the IR is emitted in `finalize`'s per-track walk over
`eBars`/`qBars` (`sim/finalize.ts`, `emitSummon`) and carries a `sourceCastId`.
A Prism has **no cast and no owner**: any member's Stellar-Conduct spawns one,
including a Stellar-Conduct caused by a summon tick. So it needs a new emission
site, and either a new `TimelineWindow` kind or a summon window whose
`characterId` and `source: 'skill' | 'burst'` are optional — both of which are
currently required.

### 2b. A lane it can live in

`computeSummonSubrows` groups summon rows under the CASTER's tracks. A
team-wide Prism belongs to nobody. The only team-scoped chart furniture is the
aura lane, which lives in the ruler strip — and ⚓⚓ **anything above the first
track row moves the bench** (`headerH` is published through
`benchBand.trackTop`; see memory `project_gauge_round_l6`). So a Prism lane
costs bench geometry, the PNG export's `oy` arithmetic, and pixels from a
viewport budget `--tool-pad-bottom` has already spent once.

### 2c. Refresh semantics

⛔ `durationExtensions` cannot express this. They **add** a delta (Collei's
+1s), they reach only the reacting character's own `summons[0]`
(`sim/extensions.ts`, `dispatchOnReactionExtensions`), and they cap at
`maxExtensions`. A Prism **replaces**: a new Stellar-Conduct resets it to 7s.

### 2d. A provenance arm for the buffs

For the three effects to read as the FIELD's rather than a character's,
`BuffWindowSource` needs a new arm — exactly the way `faction` got one when
Secret Rites would otherwise have labelled as "Sucrose E". Without it, nothing
visible changes except one extra bar, and the duplicate-source problem survives.

### 2e. A schema home for reaction-level data

The numbers have to move off the two (soon three) enabler passives and into
something that says "this is what Stellar-Conduct does". Nothing like it exists.

## 3. The half that makes it worth building — and the reason to do both at once

⚠️⚠️ **A Prism bar showing a flat +20% would look more explanatory than it is.**
The field's interesting term is the ledger:

> "Inside the field, hits from Cryo and Electro attacks on enemies **that apply
> an element (as limited by Internal Cooldown)** are recorded by the Prism. The
> initial hit that created the Prism is not included."

Per 4s window, that count drives **both**:

- Cryo/Electro DMG Bonus: 20% at zero hits → **28% + 1%/hit, up to 40%** at 12.
- Base Reaction Coefficient: 1 at zero hits → **1.45 at one, +0.05/hit, 2.0** at 12.

⚓ **This is closer to reachable than when Nate ruled it out on 2026-07-29.**
That ruling predates the gauge: the planner then had "no per-hit Cryo/Electro
ledger", and today `sim/aura.ts` knows exactly which hits applied and which the
ICD suppressed — "hits that apply an element as limited by Internal Cooldown"
is now a question the sim can answer.

⚠️ What is still missing is a **per-window recomputed value**. `BuffValue` has
`ramping`, `decaying`, `perStack`, `perTeamCount` — nothing that says "this
number is a function of what happened in the preceding 4s". That is its own
design step, and `perStack` over a synthetic resource is the obvious first
thing to try and the obvious first thing to check for lying.

## 4. Recommendation as written

> ↻ **OVERTAKEN, and the reason matters.** The objection below is aimed at a
> LANE whose only content is a flat number. Under the shipped split the strip
> carries the ENTITY and the buff row carries the number, so the strip is honest
> on its own — and the ledger was built anyway, because it turned out to be the
> cheap half rather than the blocking one (§6.3).

Do §2 and §3 **together or not at all**. A Prism lane that prints the 0-hit
baseline while the real number swings 20 → 40% would add a span, add a lane,
move the bench, and still not tell the player the thing the field is about.

## 5. Sources

- Fandom **Stellar-Conduct** page, § Starlight Prism + Provided Buffs table
  (fetched via the MediaWiki API 2026-08-31; the coefficient table is
  transcribed in `docs/library/game/stellar-reactions.md`).
- `docs/library/game/stellar-reactions.md` — the enabler model, the Radiance
  idiom, the five formula buckets.
- `src/lib/data/characters/sandrone.json` and `odette.json` — the two current
  copies, each with a `_curatorNotes` line pointing here.

---

## 6. The record — what shipped, 2026-09-01

Branch `feat/polestar-field`. ⚓ Nate's design call, made before any code: the
field splits in two — **the Prism's own span goes in the aura area, its buffs go
in the team-buffs lane** — and the strip generalises to gadgets so cores (and
later Moondrifts and Thunderclouds) can live there too.

### 6.1 ⚓⚓ The split is the Layers law, applied

The cut is the one CLAUDE.md already draws for the planner's layers: **a bar
that says when a thing IS stays; a bar that says what it GRANTS goes**.

- The **Prism strip** says the entity exists → aura-lane furniture, rides the
  **Auras** toggle.
- The **+20/+20/−40 bars** say what it grants → team-buffs lane, ride the
  **Buffs** toggle.

⚓ It also extends the marker grammar's sentence rather than starting one. The
aura lane reads top to bottom: what it CAUSED (reaction label) → what LANDED
(application pill) → a HAIRLINE into the gauge it changed. Under the plot's
baseline is what it **LEFT BEHIND**. That is why the strip sits below the 0U
datum and not inside the plot: a core and a Prism have lifetimes but no units,
and hanging them on the gauge axis would put them on a scale that does not
measure them.

### 6.2 ⚓ It is a GADGET strip, not a Prism lane — and cores paid for it

The strongest argument for the strip was not the Prism. **The gauge has spawned
and expired dendro cores since L5b and the parse threw every one away** —
`offerApplication` drained the gauge's event queue looking for reactions and
dropped the rest (`if (e.kind !== 'reaction') continue`). Four entities belong
to this class, all team-scoped, all previously homeless:

| gadget              | engine status before                                     | now                        |
| ------------------- | -------------------------------------------------------- | -------------------------- |
| **Dendro Core**     | fully modelled in `gauge.ts`, events discarded           | ✅ drawn                   |
| **Starlight Prism** | `stellarConduct` already an IR reaction event            | ✅ drawn                   |
| **Thundercloud**    | gcsim: a flat status, `LcKey`, `5.5*60` frames           | ⏭ next, needs gauge state |
| **Moondrift**       | gcsim: 3 Geo constructs, `lcrDur = 9*60`, position-gated | ⏭ next, needs a ruling    |

⚠️⚠️ **HALF A CORE'S LIFE IS DERIVABLE AND THAT IS THE TRAP.** Spawn is
`Bloom + CORE_SPAWN_DELAY` and the nominal end is `+ CORE_LIFETIME` — but a core
EATEN by a Hyperbloom at 2s is not derivable from anything, and that instant is
exactly what the reader is looking at. So `gauge.ts` grew core identity
(`{id, expiry}`, `nextCoreId`) and two events: `coreSpawn` (carrying the nominal
expiry, so a consumer needs none of the gauge's constants) and `coreEnd`
(`consumed` | `popped`). ⛔ Expiry needs no event — the queue is pruned lazily on
read, so nothing fires and the end is the nominal one by construction.

⚓ **The settle takes gadget events where it still drops reactions, and the
difference is DISPATCH.** `collectAuraSeries` refuses the settle's reactions
because a reaction has consequences that would fire after the parse believed
itself finished. A core spawn has none — it is drawn and nothing else reads it —
and a Bloom on the last frame really does leave a core 30 frames later.

### 6.3 ⚓⚓ The ledger needed no new `BuffValue` form

§3 called out the missing piece as "a number that is a function of the preceding
4s" and expected a `BuffValue` design step. There was none to do: **the field is
its own producer**, so `deriveFieldWindows` resolves the count at window
construction and stamps a literal `value`, which `BuffValue`'s `number` arm has
always accepted. ⛔ Don't mint a form for this — a form has to be read by the
general effect pipeline, which never sees these effects.

The count itself is a filter over `ParsedRotation.applications`, which is not an
approximation of "hits that apply an element as limited by Internal Cooldown" —
it is its definition. Value: `n === 0 ? 20 : min(28 + n, 40)`. ⚠️ Zero is its own
case, not the bottom of the ramp (one hit is 29%, not 21%) — exactly parallel to
the Base Reaction Coefficient's own `1` / `1.4 + 0.05n` shape.

⛔ **The Base Reaction Coefficient stays out.** Same ledger, but it is a
damage-formula term and the constitution forbids computing damage.

⚠️⚠️ **The creating-hit exclusion resolves INDICES, not times.** Fandom: "The
initial hit that created the Prism is not included", and every conduct trigger is
excluded, not just the first. Measured (`Sandrone E Q > Fischl E Q > Ganyu E Q
N3 C`) all six conducts land on the exact frame of a recorded application with no
rounding drift — but a cast applying two elements on one frame would have BOTH
struck off by a time test, undercounting a ledger whose whole job is to count.
Consuming one match per trigger cannot.

### 6.4 Rulings the text did not settle

- **Refresh REPLACES.** A new Stellar-Conduct resets the Prism to a full 7s;
  overlapping presences collapse into one span ending at the last trigger + 7s.
- **Grants are CLIPPED to the field's end.** A cycle opening at 4s into a 7s
  presence would run to 8s on its own duration. Everything the field provides is
  stated as an in-field effect ("Inside the field…", "All enemies in the
  field…"), so the honest span is the field's. ⚠️ The other reading is not
  refuted by the text; it is refused because the text does not support it either.
- **The count driving a window is the PREVIOUS window's** — "every 4s the count
  is reset, and buffs lasting 4s are granted" means the buffs granted at a reset
  are paid for by the hits recorded before it. The first cycle of a presence
  therefore draws the 20% baseline, which the creating-hit exclusion implies
  anyway.

### 6.5 Measured

- **Two enablers, ONE row.** `Sandrone E Q > Odette E Q > Fischl E Q > Ganyu E Q`
  → 5 conducts, **1** Prism, 8 field windows, and the buff-row labels read
  `Polestar Field` ×5 with no `Sandrone …` twin. That is the round's original
  defect, gone.
- **The ledger moves on screen.** `Sandrone E Q > Fischl E Q > Ganyu E Q N3 C` →
  tiles at 20 → 33 → 31 → 30, against a mirror that printed 20 forever.
- **Cores: 247 windows across 122 of 123 characters** (each with Nahida + Xingqiu
  partners), of which **19 consumed, 0 popped** — so the early-end case is real
  and is ~8% of cores in a bloom team.
- **Strip height is conditional**: 9px for one row, 0px for a rotation with no
  gadget, which is nearly all of them. ⛔ Don't give it a resting height — that
  is 20px taken from every reader to spare two.
- Browser surface (headless Chrome, production build): strip present, 1 row,
  1 bar, no console errors.
- Gates green: vitest 1791, `npm run check` 0 errors, `npm run lint`, `npm run
build`. `test:e2e` NOT run — pre-merge gate.

### 6.6 Data

The three mirror effects are **removed** from `sandrone.json` and `odette.json`,
each with a `_curatorNotes` line saying why and that it is not a gap. ⚓ **Cryo
Traveler will need no mirror at all** — an enabler needs `enablesReactions` and
nothing else for the field to appear.

### 6.7 Still open

- ⚠️ **Radiance is still authored as a STANDING condition** under the
  assume-entered house rule, while the Prism bar is now a window. A reader can
  see the field lapse while a Radiance-gated buff keeps drawing. Re-gating
  Radiance on the Prism would fix it and would silently turn standing buffs into
  windowed ones across three enablers — ⚓ Nate's call, deliberately not taken
  here. The aura notes carry the one line that keeps the bar honest meanwhile
  ("says when the field is up, not where").
- The **aura LOG** has no gadget rows. Its grammar is WHEN · WHAT LANDED · WHAT
  IT DID, and a gadget is neither an application nor a reaction.
- **Thundercloud and Moondrift** — the strip's next two occupants, each needing
  new gauge state, and Moondrift a position ruling (gcsim gates on distance < 20).
- **No guard test was added** — the verification policy makes a new spec file a
  promotion that needs approval. `deriveFieldWindows` and `polestarDmgBonus` are
  pure and the obvious unit targets; the honest seeded negative would be
  neutering the creating-hit exclusion and the previous-window count.
