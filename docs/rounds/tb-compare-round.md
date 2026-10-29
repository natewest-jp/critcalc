# Compare / Audition round (2026-08-13) — ✅ MERGED

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Four merges, in order: **`803ed86`** the round · **`8f47a17`** the refinement
pass off Nate's browser+Safari review · **`02d6d96`** the Back-to-planner
placement · **`4ca5356`** the element fallback.
Gates at the end: vitest 1389 · check 0 · lint clean · build ✓ · **e2e 73 passed
on BOTH engines**. ✅ **PUSHED, and Safari cleared by Nate on every part** —
including the element fallback, which he checked last. The real-Safari backlog is
empty as of this round.

This was the last unfinished tool surface. Its own source had parked it
(⚓ Nate, "until after the Rotation Planner round"), so it was still standing on
`.frame` after `.frame` was retired.

## ⚓ The spine — read this before touching the chart

> **A LANE is an ABILITY. The GROUPING is an EFFECT. A lens picks what you see.**

Aligning E-with-E is a **category error** — Bennett heals on Q, Kokomi on E,
Jean on both, so which BUTTON carries a thing is kit-design accident. But
aligning purely by effect (what the model did for a year) throws away the
**COST**, and the cost is the real currency: 80 energy or a 5s cooldown is the
actual trade. So the lane is the cast, dragging its cooldown and energy along,
and the heading is the effect.

Consequences that are load-bearing, not incidental:

- Jean gets **two lanes** under Heal (E and Q) where she gets one cell.
- A lane carries `alsoCarries` — "also: ATK buff" — because **one cast buying
  two things is a fact the per-effect model could not show at all**.
- ⛔ **The `E cooldown` / `Q cooldown` chart groups are DELETED.** Every lane's
  ghost segment _is_ its cooldown, so those groups printed the same fact twice
  in two geometries. They are facts-table rows only. Pinned by an e2e assertion.
- ~32 lanes collapsed to ~12, and the 96px name gutter became a 26px avatar disc.

**Two geometries because two questions: time STACKS, facts COLUMN.** Trying to
make one serve both is what left the surface reading as two half things sharing
a scroll.

## The cycle tiles (`src/lib/timeline/barCycles.ts`)

Compare has no rotation, so one cast leaves a stub in the left fifth of the
track. Tiling pays three ways at once: **duty cycle becomes TEXTURE** (the eye
is far better at that than at comparing two lengths), duration stays honest
(absolute shared seconds), and **permanent uptime draws itself** as a bar that
never breaks.

- ⚓ **`uptime >= cooldown` is intercepted BEFORE `barPhases`** — its case B is a
  ONE-CAST reading (window, then overflow) and tiling it would collide each
  cycle's overflow with the next cycle's window. _Same math, different question_
  — the planner asks "what did this cast do", Compare asks "what does this
  ability hold". ⚠ It returned one unbroken segment at first; see the seam
  reversal below for why it tiles instead.
- ⚠ A repeat is still a **CLAIM** (cast-on-cooldown, energy unmodelled), but the
  caveat lives in the **footnote** — see the reversal below.
- ⛔ Charges are **not** modelled as banking — `×2` in the fact column instead.
- 🎛️ `COMPARE_LOCKED_MIX` 45 · `SEAM_PX` 2 · `COMPARE_AXIS_CHOICES` [20,30,60]
  default 30 · `LANE_GUTTER` 26 / `LANE_FACT_W` 172 / track 280–1100.

## ↻ Refinement pass (`8f47a17`) — Nate's browser + Safari review

Three of these REVERSE decisions from the round above. The round's reasoning is
left in place where it still holds; where it was wrong, here is why.

**⛔ THE REPEAT FADE IS RETIRED, and the failure is the reusable lesson.**
Projected cycles rendered at 40% so the drawing would carry its own caveat. It
did not read: **a faded uptime block landed at almost exactly the value of the
previous cycle's COOLDOWN GHOST**, and the width difference did not separate
them. So the fade was not marking a repeat — it was blurring uptime against
cooldown, _the one distinction the chart exists to draw._ ⚓ **A legible bar that
needs a sentence beats an illegible one that tried to be self-documenting.**
⚠ Before encoding a caveat as reduced strength, check what else on the surface
already lives at that strength.

**⛔ NO GROUND UNDER THE LANE.** A `--chart-grid` field read as a faint halo
along the cooldown ghost's top and bottom edges — the ghost is inset vertically,
so the field showed above and below it. Bars sit straight on the night.

**⚓ PERMANENT UPTIME TILES, WITH A SEAM.** It returned ONE unbroken segment, and
that lost real information: on a 30s axis a 30s window and a 15s window on a 15s
cooldown drew the **identical** bar — but the second needs you back on that
character at 15s or it lapses. **Permanent uptime is a RESULT, not a property,
and the seams are what it costs.** Abutting `uptimeFlush` blocks one cooldown
long, cut by **2px of night**. ⚠ Deliberately not a hairline: the fade failed by
being subtle enough to confuse with a neighbour, and a marker whose whole job is
_"these two are not the same thing"_ has to win at a glance. The seam sits on the
cooldown boundary; when the window outlasts it there is slack, and the fact
column carries both numbers rather than inventing a deadline inside the slack.

**⚓ NO COVERAGE PANEL ON COMPARE.** "What does my team have" and "how do these
kits differ" are different questions competing for one column of vertical space,
and **Compare has already left the team** — it is reached from the Roster's
compare buttons as often as from the bench, and its characters need not be on
the team at all. Stays on Atlas + Roster.

**⚓ "BACK TO PLANNER" SITS WITH "CANCEL AUDITION", AND NOWHERE ELSE.** ⚠ I first
kept a band-B copy, arguing `fromPlanner` outlives the audition so cancelling
would STRAND you. **That was wrong** — `.chrome-nav` renders a link to every
tool on every tool page, so the way back is always one click away and the plate
was never load-bearing. ⚓ Nate: the button is only meaningful on the surface
that visibly offers to swap your slot; elsewhere people reach for the nav. It is
a **hand-guiding shortcut**, not the exit. `fromPlanner` still separates an
errand's audition (gets it) from one opened inside the TB (doesn't). ⚠ Its own
class (`.cmp-headback`) — two same-class buttons in one header is the Playwright
strict-mode trap this repo has already paid for.

## ⚓ The element fallback (`4ca5356`) — a carry slot asks a different question

**MEASURE BEFORE FIXING; the measurement reframed this one.** An audition on a
character with no filterable capability showed ~118 chips. **17 of 123** are like
that — and they are Diluc, Keqing, Neuvillette, Tartaglia, Mualani, Chasca,
Skirk, Ningguang. **MAIN DPS AS A ROLE, not a curation gap.**

So it was never "the filter is too broad" — **"who covers what they cover" is the
WRONG QUESTION for a carry slot**, because a DPS's job is damage and this site
shows damage rather than computing it. Paginating the wall would have treated a
wrong-question problem as a pagination problem.

When the slot offers no facet, the chip row offers **ELEMENTS**, seeded to the
incumbent's own (reactions and resonance are why team composition exists).
⛔ **Never both vocabularies at once** — one question per chip row, chosen by
what the slot offers. Turning the chip off is still the escape hatch to everyone.
Reuses `chip--element` + `--chip-color`, the Roster rail's exact grammar.

⚠ **Structural fix underneath, worth knowing:** the lens was derived from the
CHART, which is wrong for an audition twice over — the row would grow a "Heal"
chip the moment you added a healer (changing the question mid-answer), and
facets the chart cannot DRAW (an instant cleanse has no window, so no lane) were
being swept out of the _candidate_ filter, which is the job that matters there.
**In an audition the chips are the SLOT's**, handed in by the host with the facet
system's own labels; plain compare still reads the chart. The stale-key sweep is
restricted to plain compare.

## 🐛 Three traps this round hit

**⚠⚠ 1. A CONTEXT FLIP INVERTS THE INK LADDER — and making the table PAPER is
what exposed it.** On paper `--muted` (ink-900, 8.00:1) is the **ANCHORING**
rung and `--text` (ink-700, 6.18:1) the **RECEDING** one — the exact opposite of
dark. The table had carried the dark ladder correctly for as long as it sat on a
dark frame: **the tokens did not move, the ground did.** Labels take `--muted`,
prose takes `--text`, quieter goes down from `--text`. ⛔ Do not "fix" it back by
symmetry with the chart twenty lines above. (Same law as
`docs/rounds/breathing-room-round.md`; this is its second confirmed instance.)

**⛔ 2. Weakening a fill by nesting a `color-mix` in a `color-mix` CRASHES
WEBKIT** — and it is the obvious way to write "the same bar, quieter". Every
weakened fill in `CompareBar` composes its two weakenings (repeat × locked) as
**arithmetic in JS** and mixes ONCE. The summon tick is plain white at alpha for
the same reason: tinting toward the element first and weakening second is two
mixes for a 1px stub.

**⚠ 3. The obvious summon-tick import drags the PARSER into the Team Builder.**
`computeSummonTicks` (`$lib/timeline/summonSubrows`) calls the parser's
`evalCondition`. The fix is to emit the cadence at **derivation** instead —
`DerivedCapability.summon = { label, tickInterval, firstTickDelay }`, set in
`pushSummonCapabilities`, which already had the trigger in hand. ⚓
**`deriveCapabilities.ts` imports TYPES ONLY and must stay that way.** Verified
against the built client chunks: no `parseNotation` in either TB node.

## Audition = Compare with a REFERENCE

They differ in exactly one thing, so `anchorId` is not a mode flag — it is the
reference, and the rest follows.

- The incumbent leaves the chip flow for **its own row** (`.cmp-ref`). It is not
  a peer with a badge; it is what the others are measured against.
- ⚓ **The commit lives on the COMPARED column** (`.cmp-take`, gold, names the
  slot) — _you commit what you have looked at_. Putting it on a `.tb-cand` browse
  pill would leave an irreversible act one click from a browsing gesture.
- **ONE chip row.** The audition's "covers" chips left `+page.svelte` and became
  CompareView's **lens** on the glass plate: it groups the chart AND narrows the
  candidates, because it was always the same question asked twice.
  ⚠ `FacetKey` and `CapRowKey` are near-identical and **not** the same —
  `lensFacet()` maps them; don't cast.
  ⚠ Knock-on: a facet the chart can't DRAW (an instant heal has no window) is no
  longer offered and so stops narrowing candidates. That loosens the search, in
  the same direction as the fix that made these chips toggleable.
- 🐛 **An audition no longer destroys the comparison it interrupted.**
  `openAudition` cleared the set outright — three picks, one bench ⇄, gone with
  no undo. Stashed on open, restored on commit _and_ cancel. Pinned by e2e.

## Retired

`CapCell.glyph` · `CapGlyph` · `glyphScaleSeconds` (the axis is a control now) ·
`CompareCharacter.curated` (required by the model, never read — the unknown/—
distinction is drawn at the render site) · CompareBar's 3-edge ghost outline (it
marked the moment an ability came back up, worth a hairline when there was ONE,
three hairlines per cycle once tiled) · the `.tb-aud-facets` chip row.

CompareBar now imports `barMix`'s constants and the planner's 1px radii, so
**`barMix.ts`'s "drift impossible by construction" is finally true for all three
renderers**, not just planner↔export.

## ⏭ Queued (designed, not built)

1. **Reference column + deltas** in plain Compare — cells read `+3s`, lanes ghost
   the reference behind their own. ⚠ **A delta is a FACT, not a verdict**:
   neutral ink, never good/bad colour.
2. **Audition team backdrop** — the other three slots as `--glass-bar` lanes
   under each effect group. The material rule already encodes it (_content gets
   chroma, annotation doesn't_), so subject-vs-context needs no new vocabulary.
3. **Nested effect-inside-ability spans** — the buff window inside its host's bar.
4. **Provenance off `title=`** — sources/caveats/`also` are tooltip-only, so
   unreachable by keyboard and touch.

Related: `docs/rounds/vz-on-the-scene.md` (the materials law) · `docs/rounds/tb-card-round.md` (the
element-token and 1.5px-border rulings this cleared) · `docs/rounds/element-palette-round.md`
(the `bar` rung) · `docs/rounds/rp-scene-round.md` · `docs/design/subpixel-rendering-laws.md`.
