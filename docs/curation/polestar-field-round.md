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

| gadget              | engine status before                                     | now                                              |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| **Dendro Core**     | fully modelled in `gauge.ts`, events discarded           | ✅ drawn                                         |
| **Starlight Prism** | `stellarConduct` already an IR reaction event            | ✅ drawn                                         |
| **Thundercloud**    | gcsim: a flat status, `LcKey`, `5.5*60` frames           | ✅ shipped, §8 — ⛔ and it needed NO gauge state |
| **Moondrift**       | gcsim: 3 Geo constructs, `lcrDur = 9*60`, position-gated | ✅ shipped, §8                                   |

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

### 6.7 Still open — ⚠️ as of §6 only; see §8–§10 for what has since closed

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

---

## 7. Follow-ups, 2026-09-01 (same day)

### 7.1 The aura lane is ON by default

⚓ Nate: "our aura track has become so much of a feature, I think it's time to
make it on as the default". `TIMELINE_LAYER_DEFAULTS.showAuraLane` → `true`.
⚠️ The argument that retires is the original one — "a reader should have to opt
into the most technical surface" — made the day the lane shipped, when it was one
plot. It has since taken the reposition above the axis, the shared marker
grammar, the event log, the crosshair and the gadget strip: **a lane nobody finds
the toggle for is a lane nobody has**, and the reason it read as technical was
that it was unfinished. ⚓ The other half of that note still stands and is why
this pair has only ever moved one way: hiding the BUFF rows by default would
change what the planner is.

### 7.2 The field's tooltip carries its ledger, and the row wears stellar

🆕 **`TimelineWindow.fieldStacks`** — the recorded-hit count that set a window's
value, printed under the stats. ⚠️⚠️ **It is the PREVIOUS 4s's count, and the
tooltip says so**: the number that paid for this bar was finished before the bar
began, while the in-game counter is meanwhile filling toward the next grant. Two
clocks; this is the one the bar's value can be checked against.

- ⛔ **Not in `effects`**, so it stays out of the refresh-merge key — but
  `mergeRefreshedBars` gets an equality gate instead (`a.stacks === b.stacks`),
  because at the 40% cap twelve recorded hits and fifteen both pay 40 and a
  merged bar must not have two answers to how many were recorded.
- 🆕 **`TeamBuffSubrow.icon`** overrides `BUFF_STAT_ICON`, which is keyed by
  STAT — right for a character's buff, wrong for a row whose identity is not its
  stat. The field's Cryo bonus was wearing a Cryo pip and reading as somebody's
  elemental buff; it wears `stellar.png` now.
- ⚠️ **The shred carries NO count**: −40% Physical RES is flat, so a count on its
  tooltip invites the wrong inference — and leaving it off lets four abutting
  identical tiles merge into ONE 14s bar, which is the true shape of a debuff
  that does not change while the field stands. Measured: 8 field bars → 5.

### 7.3 ↻ A gadget row is a count profile — ⛔ SUPERSEDED SAME DAY by §7.4

> ⚠️ **This is the SECOND of three cuts and it did not survive contact.** The
> measurement below is what still stands and is why the strip needed designing
> against overlap at all; the count profile is what that measurement was used to
> justify, and ⚓ Nate read it live: "elegant, but it isn't quite working in
> practice." §7.4 is what shipped. Kept because the reasoning is what §7.4
> inherits — ⛔ don't re-derive the overlap numbers.

#### The measurement, and the profile it argued for — ↻⚓⚓ A gadget row is a COUNT PROFILE, and the measurement reversed the first cut

⚓ Nate: overlapping core bars made it "really difficult to see where one core
begins and another ends". Measured before designing, over 122 corpus rotations
with a bloom-capable pair:

| peak concurrent cores | rotations |
| --------------------- | --------- |
| 1                     | 26        |
| 2                     | 79        |
| 3                     | 9         |
| 4–5                   | 7         |

and **66% of the time any core is live, at least two are** (purpose-built bloom
teams: 59–75%). So the strip's first cut had it backwards — overlap is the
resting state, not the exception — and the translucent-span rendering was making
a claim it cannot keep: at 52% alpha five stacked spans composite to **97%
opaque**, so "darker means more" saturates by the third core.

⚠️⚠️ **THIS IS THE OPPOSITE FINDING TO THE AURA LANE'S, from the same
instrument.** L6 collapsed the aura ROWS into one plot because ⚓ Nate measured
that auras barely coexist; the strip goes the other way because gadgets almost
always do. ⛔ Neither result may be assumed for the other — count the case.

⚓ **Identity is nearly worthless here, which is what makes the profile a win
rather than a trade.** Cores are consumed OLDEST-FIRST, so "which core did my
Hyperbloom eat" is a question nobody asks; the real ones are _is one up_, _how
many_, _when does the next one drop_ — and a step down answers the third exactly
where overlapping spans answered none of them. The individual lives survive in
`GadgetRow.bars` for the tooltip ("Oldest leaves in 1.90s").

**Shape:** `runsOf` sweeps the bar BOUNDARIES (⛔ never a fixed-interval sample,
which would alias a one-frame gap into a phantom or a miss) into runs of constant
count; the row draws them as a square staircase — ⚓ square because the count
changes at an instant, so a sloped join would draw a transition the game does not
have — filled with the plot's own fade-to-baseline so the LINE carries the shape.

⚠️ **CAPACITY IS A PROPERTY OF THE KIND, NEVER OF THE ROTATION.** A Prism can
never exceed one (presences merge before emission), so it draws at capacity 1 —
a full-height fill, i.e. the plain bar it always was, and the degenerate case of
one grammar; cores draw against a FIXED ceiling of 5. ⛔ Never scale the axis to
a rotation's own peak: two charts of the same team would then disagree about what
half-height means. Row height follows capacity (7px binary / 16px counted), so it
is stable across rotations too.

**Hover isolation** (⚓ Nate): one `<rect>` per run does three jobs — hit area,
dimming mask and lit state. The run is the only unambiguous thing to isolate when
the spans beneath it overlap. It rides `onAuraMarkEnter`, so the log and the
plot's crosshair stay on the same focused instant.

**Measured:** `Nilou E Q > Nahida E Q > Xingqiu E Q > Kokomi E Q` draws one 16px
row of 13 runs stepping to 5 cores, tooltip "5 cores · oldest leaves in 1.90s",
12 of 13 runs dimmed on hover. A Prism+bloom rotation draws a 27px strip: 7px
Prism row, 16px core row. No console errors; PNG export mirrors the profile.

### 7.4 ⚓ WHAT SHIPPED: a life is a dot, a thin line and an end mark

⚓ Nate, having read the profile live: _"what about using a dot for when a bloom
core is spawned, just like the Visualizers instrument, but also give it a thin
line extending to the right of it, with a small tick at the end of the line to
show where it expires?"_

⚓⚓ **THE PROFILE ANSWERED THE WRONG HALF.** §7.3's argument — that identity is
worthless because cores are consumed oldest-first — is true about the ENGINE and
false about the READER. A staircase says how many are up and structurally cannot
say WHICH, and somebody looking at the strip is looking at a particular core:
where it came from, how long it has left. ⚠️ The oldest-first consumption rule
makes identity irrelevant to the SIMULATION, and that is not the same claim.

The mark is the Gauge Explorer's own core dot (`GaugeInstrument.svelte` draws
`<circle r=4 fill=var(--rx-dendro-core)>`) given a duration — ⚓ one grammar
across the two tools, the same convergence the application marker made.

⚠️⚠️ **THE OVERLAP MEASUREMENT IN §7.3 STILL BINDS, which is why a life gets a
SLOT.** 66% of the time any core is live at least two are, so on one baseline two
leader lines would run through each other and the reader would be counting dots
to recover what the chart should be showing. `assignSlots` is greedy interval
colouring — lowest slot whose previous occupant has left — into a band of
`capacity` lines, filled from the BOTTOM so a busier moment is a taller stack
(the one thing the profile did well, kept).

⚓ **This is NOT the sub-row pattern rejected in the options.** That one sized the
lane to whatever the rotation peaked at, so two charts of the same team could
disagree about their own height. The band is always `capacity` slots — a game
fact (`MAX_CORES` = 5), not a measurement — so an empty slot is just empty.
Row height is `2r + (capacity − 1) × pitch`: **4px** for a Prism, **16px** for
cores, no worse than the profile it replaced.

⚓ **The end mark says HOW it ended, not just when**: a core that ran out
terminates in its own colour, one a Hyperbloom ATE terminates in `--chrome`. That
second fact is the one only the gauge can tell you, and it is the whole reason
the round taught `gauge.ts` to emit `coreEnd` at all.

🐛 **A defect the browser check caught and reasoning would not have.** The hit
areas were full-row-height rects, which overlap COMPLETELY — so the last life
drawn swallowed the pointer from every one that began before it, and a
mid-rotation core could not be hovered at all. They cover their own SLOT now
(5px, a hair wider than the 3px pitch because 3px is not a pointer target); two
lives in one slot never overlap in time by construction, so per-slot rects cannot
collide. ⚠️ Playwright reported it as a hover timeout naming the intercepting
`<rect>`, not as a wrong picture — ⛔ a screenshot would have looked perfect.

**Measured.** `Nilou E Q > Nahida E Q > Xingqiu E Q > Kokomi E Q` → 11 lives
across all five slots (cy 14/11/8/5/2), hover isolates one and dims ten.
`Sandrone E Q > Fischl E Q > Nahida E Q > Xingqiu E Q` → a 24px strip: a 4px
Prism row (one life, 7.00s) over a 16px core row whose two lives both end in
chrome, tooltip reading "Ended · consumed by a reaction". No console errors; the
PNG export mirrors dot, leader and end mark.

### 7.5 ⚓ The dot fills its row; the leader keeps its lane

⚓ Nate, refining §7.4: _"the dots are very visually useful for seeing when a core
was spawned, but they don't need to be kept smaller to allow for stacking if the
lines can carry that purpose."_

⚓⚓ **THE TWO MARKS CARRY DIFFERENT JOBS, SO THEY GET DIFFERENT GEOMETRY.** The
spawn disc answers "when did a core appear" — the question asked most, and from
furthest away — so it takes the row's whole height. Only the LEADER has to avoid
its neighbours, and the leader is the part that can afford to be 1px. §7.4 had
both marks paying the stacking tax; only one of them owes it.

Two consequences, both accepted deliberately (⚓ Nate asked to test them): a
leader **crosses the discs** of cores spawned after it, and every lane but the
centre leaves its own disc **off-centre**.

⚠️ **SLOTS RUN CENTRE-OUT NOW, and the dot's geometry forces it.** A full-row disc
is centred on the row, so lane 0 has to be the centre line or the commonest case
in the strip — one core, alone — draws a leader leaving the side of its own disc.
Later lanes alternate above and below. ↻ Bottom-up was right while the row was a
count profile, where "busier is taller" was the entire reading; the discs carry
that now.

⚓ **THE END MARK IS KEPT, AND AS A DOT.** Nate offered dropping it. It earns its
place precisely because of the first accepted consequence: now that leaders cross
other cores' discs, _a line that has stopped and a line passing under a disc look
identical_ without a positive terminator. A dot rather than a tick because a tick
read as chart furniture at this size, where a small dot reads as the same object
the life started with. A consumed life still ends in `--chrome`.

⚠️ **A faint RIM on the disc, not just a fill** — two blooms close together
overlap, and without an edge the pair reads as one wide smear, which is the exact
confusion the strip exists to remove.

⚠️⚠️ **FIVE PAINTING PASSES, NOT ONE GROUP PER LIFE, AND THE ORDER IS THE DESIGN.**
Painting a whole life at a time would put an early core's leader over a later
core's disc or under it depending only on spawn order. Passes give one rule:
every disc under every leader, every terminator over both. The hit areas are the
last two passes — leaders by LANE (the §7.4 defect: full-height rects overlap
completely and the last life drawn swallows every earlier one), then discs, so a
disc wins the pointer within its own width even though a stranger's leader
crosses it. ⚓ The disc is what a reader is aiming at.

⚠️ The Prism row grew 4px → 8px: its disc is as tall as its row like every other,
and a capacity-1 row without a floor on the radius is 4px of hairline.

**Measured.** Bloom-heavy: one 16px row, 11 lives, discs r=7.5 all centred at
cy=8, lanes at 2/5/8/11/14. Prism+bloom: a 28px strip — an 8px Prism row (disc
r=3.5, single lane) over a 16px core row whose two lives both terminate in
chrome. Disc and leader hover both resolve to the same life; no console errors;
the PNG export mirrors all three marks in the same three passes.

### 7.6 ⚓⚓ WHAT SHIPPED: marks for events, an area for state

⚓ Nate, after reading the third cut live: the leaders are "just too busy to read
easily — _is it four or five bloom cores_". ⚓ And the priority he set: **simplify
it visually.**

⚓⚓ **THE INSIGHT THAT ENDED THE THRASHING: A DENDRO CORE'S DURATION IS A
CONSTANT.** Every core lives exactly `CORE_LIFETIME` (6s) unless something eats
it, and the spawn delay is a constant 30 frames. So eleven individual 6s leaders
were spending the whole row's ink on the one quantity that never varies — the
only facts a life carries are **when it spawned** and **whether it ended early**.
That is why every per-life cut read as clutter rather than as data, and it is the
thing none of the three earlier attempts noticed. ⛔ Never reintroduce a per-life
duration mark.

**The row is now the plot above it, in miniature**: a solid disc per spawn
(`AURA_PILL_R` — ⚓ Nate: the same size as an application pill, so one mark size
means "a thing happened at this instant" across the whole header), over a stepped
area for how many are standing. Points for what happened, a continuum for what is
true — one vocabulary, top to bottom.

**The four cuts, and what each got wrong:**

| cut   | shape                                       | defect                                                                                      |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1     | translucent stacked spans                   | five at 52% alpha composite to 97% opaque — "darker means more" saturates by the third core |
| 2     | bare count profile (§7.3)                   | says how many, structurally cannot say WHICH                                                |
| 3     | per-life dot + lane + terminator (§7.4–7.5) | says which, at 33 marks in a 16px row; the count became unreadable                          |
| **4** | **discs + area (this)**                     | **the area answers 2's question, the discs answer 3's — one path plus one dot per bloom**   |

⚠️ **The exact count lives in the RUN's tooltip** ("4 cores"), because ~3px a step
is not something a reader can count off — which is precisely the question Nate
was left with. The disc's tooltip answers the other one: this bloom's life, and
how many it joined.

⚓ **The end mark is GONE, and nothing was lost**: a step down IS the end, and a
consumed core's step is reported in the run tooltip ("1 consumed by a reaction").
The `--chrome` terminator was carrying that fact when there was no area to carry
it.

⚠️ Everything upstream is untouched: `assignSlots` and the per-life lanes are
deleted, `runsOf` is restored, and `gauge.ts`'s `coreEnd` events are still what
make an early step-down possible at all.

**Measured.** Bloom-heavy: one 16px row, **11 discs and 2 paths — 13 visible
marks, down from 33** — 13 runs behind them for the count tooltip. Prism+bloom: a
28px strip, an 8px Prism row (one disc, one run) over the core row, whose run
tooltip reads "1 core · Just now 1 consumed by a reaction". No console errors;
the PNG export mirrors both passes.

### 7.7 The stair hangs from the top, and hover is a ring

⚓ Nate, three refinements to §7.6, all accepted as stated:

**1. The steps stack DOWNWARD.** The row's baseline is its TOP edge — where the
spawn discs already sit — and each live core steps the boundary down. ⚓ The
discs read as the surface and the state as what is suspended beneath them, which
is a shape you can take in without first locating a floor. ⚠️ It also puts the
mark and the state it caused on the same edge: a disc and the step under it are
one gesture.

**2. One line, and a bottom-to-top fade — ⛔ not an outline.** The previous cut
stroked the CLOSED fill path, so it drew the baseline and both end walls as well:
three edges that are not data, which is what read as a box. ⚓ Two paths from one
walk now, exactly as the aura plot does it (`auraPathD` with and without a
baseline): the closed one fills, the OPEN one strokes. The gradient runs
bottom-to-top because the shape does — the boundary line is the low edge here, so
the fill is strongest where the line is and thins toward the surface. Same
argument as the plot's own fade: the LINE carries the colour.

**3. Hover is a RING on the dot, and all dimming is gone.** ⚓ Dimming was
answering "which life is this" — a question the row stopped asking when the
per-life leaders went. What is left is "which spawn am I pointing at", and that
wants a mark ON the thing rather than a wash over everything else. The ring is the
aura tick's own lit state (`box-shadow: 0 0 0 2px var(--chrome)`) in the form SVG
can carry it, so the two marks light the same way in the two bands.

**Measured.** Fill path starts `M 178 0 L 178 3.2` (closed, baseline at the top)
and the stroke path `M 178 3.2` (open); gradient stops 0.14 → 0.5 top to bottom;
hovering the third disc rings exactly one and leaves every fill untouched. No
console errors; the PNG export mirrors all three.

### 7.8 One material for both rows: a solid dot and a translucent shape

⚓ Nate, on seeing the Prism row share the core row's gradient-and-outline: the
two rows should be the same object. **⛔ No gradient and ⛔ no outline** — the
state is one flat translucent fill, the dots stay fully opaque.

⚓⚓ **THE OUTLINE WAS MAKING THEM TWO IDIOMS.** With a stroked boundary the core
row read as a CHART and the Prism row as a bar with a line on it — two grammars
in a 28px strip. Fill-only, both rows say the same sentence the same way: a solid
dot for the event, a translucent shape for the state, and the Prism's shape is
simply the degenerate one-step case of the core row's staircase. ⚠️ It also
retires a defect rather than only a taste: the stroke traced the CLOSED path, so
it drew the baseline and both end walls along with the data.

🎛️ `GADGET_FILL_ALPHA` (0.35) is the knob if a single core reads too faint — a
lone core is only a fifth of the row deep, and the line used to be what carried
it.

🐛 **And the hover ring was being clipped** (⚓ Nate): an SVG root clips to its
viewport, and a spawn disc is exactly as tall as its row — a dot at `cy = r`
touches both edges — so the 2px ring lost its top on the core row and BOTH edges
on the Prism's, whose row is one dot tall. Fixed with `overflow: visible` on the
row's svg; the overhang is 1px into a 2px row gap and collides with nothing.
⛔ Not fixed by shrinking the disc (it is deliberately the application pill's
size) and ⛔ not by padding the row (that spends strip height on a state only
visible under the cursor).

⚠️⚠️ **A MEASUREMENT TRAP worth remembering**: Chrome's `getBoundingClientRect`
on an SVG shape reports the FILL box and not the stroke, so the first check after
the fix read "0px outside the row" and looked like the clip had survived. The
decisive probe is `elementFromPoint` just outside the edge — a painted stroke
hit-tests there. ⛔ Don't conclude from a rect that a stroke is missing.

**Measured.** Both rows: one path at `fill-opacity: 0.35`, zero gradients, zero
stroked paths; hovering a disc rings exactly one and the ring hit-tests 0.5px
above and below its row. Gates green; the PNG export mirrors the flat fill.

---

## 8. Thunderclouds and Moondrifts, 2026-09-01

The strip's other two occupants, from `docs/curation/polestar-field-round.md`
§6.2's own table. ⚓ **NEITHER NEEDED A LINE OF GAUGE WORK** — `lunarCharged` and
`lunarCrystallize` have been IR reaction events since the 7.0 reaction-conversion
round, so both are a walk over a stream that already existed, exactly as the
Prism is. ⛔ Don't reach for new gauge state for a gadget whose spawn condition is
a reaction. (Verified before building: `Ineffa E Q > Fischl E Q > Xingqiu E Q N3`
emits 10 `lunarCharged`; `Zibai E Q > Xingqiu E Q > Noelle E Q N3` emits
`lunarCrystallize`.)

### 8.1 The Thundercloud — one cloud, 5.5s, refreshed

gcsim `pkg/reactable/lunarcharged.go`: `Status.Add(LcKey, 5.5*60)`, with its own
comment — "the LC cloud lasts 5.5s, or lifetime is extended to last another
5.5s". ⚠️ It is a STATUS, not a count, so a second Lunar-Charged **restarts the
clock** rather than adding a second cloud: capacity 1, and the same
replace-refresh rule the Prism uses. `mergePresences` is now shared between them
(⚓ one rule for "an entity refreshed by repeat triggers"; `fields.ts` keeps only
the ledger's need for the trigger list).

### 8.2 Moondrifts — ⚓⚓ a top-up to three, and a refresh on a full field

gcsim `lunarcrystallize.go`. Two rules that read as oddities until you see the
source, and both are the reason this file has a guard test:

- ⚓⚓ **A Lunar-Crystallize TOPS THE FIELD UP to three, it does not add one**
  (`for i := range 3 - moondriftsNearby`). The first reaction on an empty field
  drops **three at once**, each `lcrDur` = 9s.
- ⚓⚓ **On a full field it REFRESHES instead**, via Moondrift Harmony:
  `extendNearbyLunarCrystallizeConstructDur` sets every drift's expiry to
  `now + lcrDur`. ⚠️ Without that branch a stocked field would quietly expire
  under a player who is still reacting.
- ⚠️⚠️ **TWO SEPARATE THREES, and conflating them is the trap.** Harmony needs
  three drifts STANDING _and_ `lcrCountKey >= 3` — a counter incremented by every
  Lunar-Crystallize (cap 6) and spent three at a time. So the second reaction on
  a full field does **nothing at all**, and the third fires. ⚠️ Both of the
  guard's first-draft expectations were wrong on exactly this, and the CODE was
  right — the tests were corrected, not the model.
- Harmony's own ICD is `lcrHitmarks[last]` = **37 frames**. ⚠️⚠️ The counter alone
  blocks most bursts, so a fixture only exercises the ICD if it rebuilds the
  counter to 3 _inside_ those 37 frames — the first ICD test passed under a
  seeded mutation that deleted the ICD entirely, and had to be rebuilt around
  frames 0/12/24/26/28/30.

⚠️ Position is dropped, as everywhere: gcsim gates both on `distance < 20` from
the player, and the house rule since 2026-08-31 is that a field is assumed
entered.

⛔ **NOT MODELLED, deliberately**: the Thundercloud's lightning ticks and the
Moondrift Harmony ATTACK. Both deal damage that would have to reach the gauge,
neither is authored anywhere in the corpus, and inventing a cadence is
`⛔ never fake timing` twice over. Several kits read these entities as a
CONDITION ("if there are thunderclouds nearby" — Ineffa A1, Flins's burst) and
that stays unmodelled too; the entity's LIFE is what the strip draws, and it is
stated exactly.

### 8.3 One disc per spawn INSTANT, not per life

⚠️ A Moondrift top-up spawns three at one instant, which drew three identical
discs at one x — redundant ink for a count the area already carries.
`GadgetRow.spawns` groups lives by start; the tooltip says "3 at once" instead.
⚠️ A group's lives can END apart (one eaten, the rest expiring), so the duration
is printed only when they agree.

### 8.4 Colours

Measured on the same discipline as the Prism's: `--rx-thundercloud: #5f9ec4`
(nearest neighbour `--el-hydro-main`, ΔE .109) and `--rx-moondrift: #cfc7ae`
(nearest `--rx-frozen`, ΔE .107), against a grid whose own closest pair is .037.
They clear each other at .196 and the Prism at .174 / .136. ⚠️ Storm blue and
moonlit sand rather than a second violet, because the Prism already holds that
end of the wheel.

## 9. The guards (2026-09-01)

⚓ Approved by Nate as a promotion. Two files, both **seeded-negative verified** —
every mutation listed goes red on the test aimed at it, and nothing else.

- **`src/lib/sim/fields.test.ts`** (14): `polestarDmgBonus`'s discontinuity and
  cap; the Prism's 7s and replace-refresh; the 4s tiling and its clip; the ledger
  reading the PREVIOUS window; Cryo/Electro only; the creating-hit exclusion, and
  that it strikes off ONE application per trigger rather than every one sharing a
  frame. Seeds: value → `20 + n`; ledger → own window; exclusion removed; refresh
  → extend; grants unclipped.
- **`src/lib/sim/gadgets.test.ts`** (11): the cloud's 5.5s and single instance;
  the Moondrift top-up, the Harmony refresh, the counter gate and the ICD. Seeds:
  top-up → add-one; Harmony refresh removed; ICD removed; counter gate removed.

⚠️ These test the PRODUCERS, not the corpus. Every rule in them is a game fact,
so the inputs are hand-built reaction/application streams — ⛔ a corpus fixture
would couple the assertions to whichever characters happen to react today.

## 10. Two corrections and two colour calls, 2026-09-01

### 10.1 ⚠️⚠️ THE LEDGER WAS EXCLUDING TOO MUCH — only the INITIAL hit is exempt

⚓ Nate counted the buff bars against the lane's own application dots and found
the ledger low by about one per window. He was right, and the cause is a reading
of one sentence.

§6.3 struck off **every** Stellar-Conduct's triggering application, on the
argument that each is "a hit that created the Prism". The literal reading is the
correct one: _"The **initial** hit that created the Prism is not included"_ — a
rule excluding every conduct would have been written as "hits that trigger
Stellar-Conduct are not included". `creatingHitIndices` → `creatingHitIndex`,
resolving **one** application per PRESENCE rather than one per trigger.

Measured on `Odette E E > Alyosha E Q` at Alyosha C2, whose Prism runs
1.60–27.33s: counts per 4s window went **0/3/2/2/1/1/0 → 0/5/4/4/3/2/0**, i.e.
+2 in most windows, which is exactly the refresh triggers that were being struck
off.

⚠️ **A text-reading call with NO oracle** — gcsim has no Stellar-Conduct at all —
so the evidence that decided it is a reader counting dots against a bar. ⛔ Don't
re-flip it on a re-reading alone.

⚓ **And the dots ARE the right thing to count against**: `applications` is the
stream the gauge was fed, i.e. post-ICD by construction, so "hits that apply an
element (as limited by Internal Cooldown)" is its definition rather than an
approximation of it. ⚠️ Two applications CAN share a frame from one character —
a cast and a summon tick keep separate ICD counters (⚓ "counters are NOT shared
across casts") — and that is why the exclusion resolves an index rather than
comparing times.

### 10.2 ⚓ A LEDGER BAR NEVER MERGES — the cadence is the mechanic

⚓ Nate: "I did Odette EE > Alyosha EQ and saw it do 4s windows twice and then
randomly the third window is 8s… it's always either 8s or 12s."

Not random: `mergeRefreshedBars` was fusing consecutive grant cycles that paid
the same number, so two identical 4s tiles drew as one 8s bar and three as 12s.

⚓ **The merge law still holds; this row is outside it.** "A buff re-applied
before it expires is ONE covered span" is about a refresh landing at an arbitrary
moment, where a seam would re-encode a cast marker one row up. The Polestar
Field's 4s reset is not that — **the CADENCE IS THE MECHANIC**: the count resets
and the buff is re-granted on a clock, so fusing two cycles that happened to pay
the same number hides the thing the row exists to show, and leaves an 8s bar with
two answers to "how many were recorded".

⚠️ Only bars carrying a count are held out, so the field's SHRED still merges
into one span across the presence: −40% is flat, and its tiles are one debuff
stated four times.

### 10.3 An entity that HAS an element wears it

⚓ Nate: the Prism is Cryo in game and a Moondrift is Geo. Both minted `--rx-*`
hues are **retired** — they were primitives standing in for ones we already had —
and the two rows take `--el-cryo-main` / `--el-geo-main`. ⛔ The other two keep
their own: a dendro core and a thundercloud are their own objects, not auras of
an element. (For the record, the swap widens the strip's own separations: Prism ↔
Thundercloud goes ΔE .174 → **.232**; Moondrift ↔ Core .142, unchanged in spirit.
⚓ Nate's call that Moondrift-vs-Core conflation is not a concern.)

### 10.4 ⚠️⚠️ The Moondrift row is ONE HIGH, though there are always three

⚓ Nate: "even though there are three Moondrifts, there are always three — they
appear and disappear together." Confirmed by the model rather than assumed: a
Lunar-Crystallize tops the field up to three and Harmony refreshes all three at
once, so a **partial field is unreachable** — which the guard's own fixtures
demonstrate. A three-deep axis was therefore drawing one number forever and
spending 8px of strip on a count that never varies. Capacity 1; the three lives
stay in `bars`, so the disc's tooltip still reads "3 at once".

## 11. What is still open when the round ends (2026-09-01)

Ordered by what a next session would actually pick up.

1. ⏱️ **`npm run test:e2e` has NOT been run** across the whole round — it is the
   pre-merge gate and this branch has not merged. Last green: `00103c9`. The
   round touched the planner's header geometry, `headerH`, the bench's published
   `trackTop` and the PNG export, so it is exactly the kind of change the browser
   suite exists for. ⚓ Run it before merging `feat/polestar-field`.
2. 👁️ **Safari is unverified.** Real visual work landed (a new strip, two new
   element-coloured rows, an `overflow: visible` SVG, a `color-mix`-free flat
   fill) and the policy is unchanged: Playwright WebKit catches throws, not
   rendering. The backlog is one item — this round.
3. ⚠️ **Radiance is still a STANDING condition** while the Prism is a window, so
   a reader can watch the field lapse with a Radiance-gated buff still drawing.
   ⚓ Recommendation on record (Nate asked, 2026-09-01): **don't wire it**, on an
   asymmetry rather than on cost — our conduct emission is a FLOOR, not a truth
   (40 oracle misses remain, applications default to 1U, off-field gaps are
   documented), so every emission gap that today costs a MARKER would instead
   silently delete a buff the player really has. Under-drawing a marker is a
   visible omission; under-drawing a buff is an invisible wrong answer. ⚓ **The
   revisit trigger is concrete**: when `gcsim-frames-diff.md` shows no missing
   Cryo/Electro applications for a Stellar team, the argument flips. ⚠️ Note the
   field's OWN buffs are already Prism-gated — this is only the character-side
   Radiance riders.
4. The **aura LOG** has no gadget rows (its grammar is WHEN · WHAT LANDED · WHAT
   IT DID, and a gadget is neither an application nor a reaction).
5. ⛔ **Entity-as-CONDITION stays unmodelled** and is the biggest remaining gap
   the strip makes visible: "if there are thunderclouds nearby" (Ineffa A1,
   Flins's burst), Moondrift Harmony triggers (Linnea C1/C2/C4/C6, Albedo C4,
   Columbina C6, Goldenfrost Bound Oath, Nighttime Whispers). ⚓ The entities now
   EXIST in the IR as windows, so a condition that asks "is one standing at this
   instant" is newly answerable — but it is the same time-varying-condition work
   item as Radiance in item 3, and ⛔ should be taken with it or not at all.
6. ⛔ The Thundercloud's lightning ticks and the Moondrift Harmony ATTACK are
   deliberately unmodelled — both deal damage that would have to reach the gauge
   and neither is authored anywhere in the corpus.
