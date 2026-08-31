# The Polestar Field round — spec

> **Status: SPECCED, NOT STARTED.** Written 2026-08-31 during Odette's Stage 2,
> at ⚓ Nate's request, after he asked whether it is time to stop modelling the
> field as a per-enabler copy of four effects and track the thing itself.
> ⛔ Nothing here is built. The corpus currently does the mirror described in
> §1; this document is what would replace it.

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
