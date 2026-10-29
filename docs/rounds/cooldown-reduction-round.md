# The cooldown-reduction round — queued, scoped 2026-09-16

_Bookmark, not a plan to execute in the session that wrote it. Scoped while
Varka's two-claymores round was loaded, because that is where the need surfaced
and where the facts were already in hand._

## 0. Why it is queued rather than ridden along

Varka's Four Winds' Ascension wants **`charges: 2` + "starts on cooldown"**, and
⛔ **that half cannot ship alone — it would make the tool worse.** The kit says
"Starts on cooldown and has 2 maximum uses", but the loop only closes because
each in-stance Normal that HITS cuts the 11s cooldown by 0.5s (1.0s with 2+
Hexerei, max 15 per stance). Today the planner says Four Winds is ready at
t = 0, which is too generous; with `startsOnCooldown` and no reduction it would
say 11s into a 12s stance, which is further from a real rotation than the
status quo. The two are one round.

## 1. Three pieces, and only one of them is about Varka

### A. Wire `cooldownReduce`

⚠️⚠️ It is declared in the schema and has **no consumer anywhere in `src`** —
its only occurrences are its own type declaration and one doc cross-reference.
Raiden and Beidou author it and both are inert. ⛔ `orphanedSchema.test.ts`
cannot see the class, because it matches property ACCESS and this is a `type`
VALUE; that blind spot is worth a note of its own when this lands.

The work is a dispatcher on the hit stream that shifts a queued charge earlier
in `ctx.eChargeQueues`.

⚓ **The ordering is less delicate than it looks, and the reason is worth
writing down before someone re-derives it nervously.** The charge-queue forward
scan (`run.ts`, the `scanGuard` loop) is PURE and reads the queue; a reduction
mutates it. They cannot race, because a reduction fires on a HIT and a scan runs
when an E token is reached — and you cannot swing during a cooldown wait, so
every reduction a wait should see has already dispatched in parse order before
the scan reads the queue. ⚠️ Verify that rather than trust it: the sweep
2026-07-05 #5 lessons are all about this loop.

### B. A proc cap — ⚓ THE PIECE THAT IS NOT VARKA'S

"Up to 15 times per stance" is one instance of a shape **21 characters are
waiting on** (27 curator notes, censused 2026-09-16): arataki_itto, charlotte,
chasca, collei, cyno, dori, escoffier, faruzan, lauma, mika, mualani, nahida,
ororon, raiden_shogun and seven more. Cyno's C4 ("5 times per burst"),
Escoffier's C6 (6 per Mek), Mika's burst (5 per Q) and Collei's A4 (a capped
duration extension) are each a different scoping of the same idea.

⚓⚓ **So the cap must be designed against that census, not against Varka.** The
axes the census already shows: per CAST, per STANCE/window, per SUMMON
instance, and whether the cap resets on recast. ⛔ Shipping a Varka-shaped
`maxProcs` and generalising later is how the corpus gets a field that means
four things.

### C. `startsOnCooldown`

The charge queue initialises every charge READY
(`new Array(n).fill(0)`). One flag, and ⚓ it has a second holder waiting in any
"charges begin recharging on entry" kit.

## 2. What it unblocks

- Varka: Four Winds' real charge model, and with it **Azure Devour's cost** —
  `sC` draws the attack today without spending the use, which is the one thing
  that token cannot say.
- The 21 characters above, to the extent each one's cap fits the shape B lands.
- Raiden's and Beidou's inert `cooldownReduce` effects start meaning something.

## 3. Why a fresh context

Not because it is hard — because two of the three pieces want a corpus census
and a design pass, and both are cheaper and less biased read cold than read
through Varka. ⚓ The project's own hand-off convention agrees: `Opus 5 per tier
for §3, **Fable for the engine rounds**` (essential-characters, Nate 2026-09-15),
and this is an engine round with no character tranche attached.

⏭ Start here, then `docs/curation/varka-two-elements-scope.md` §7 for the
Varka half.

---

## 4. The record (2026-09-18, branch `engine/cooldown-reduction`)

_Built in a fresh context as §3 asked. Everything below is measured with a
scratch `parseNotation` probe (`scratch/probe/cd.test.ts`, gitignored) unless
it says otherwise; the corpus digest against the round-4 baseline
(`out/r4-exact.json`) moved **0 of 252** — expected, it is a buff-window digest
over one E, and cooldowns are not in it._

### 4.1 What shipped, in the order the commits landed

**Charges recharge ONE AT A TIME.** ⚓ Not in the plan, and load-bearing for it.
The charge queue ran every charge's clock in PARALLEL: `Klee E E E` returned
both charges at 20s and placed the third E at 1233f, where in game it waits
until 2433f (the second charge starts recharging when the first finishes —
gcsim's `cdQueue` is a sequential worker). Under that model Varka's second Four
Winds would have been ready 11s into the stance and the tool would have claimed
two uses per stance. The cast site now appends the spent charge's clock to the
END of the chain (`run.ts`, the CD write), and the ghost tail follows so the bar
still ends where a recast can be placed (the barPhases ruling). Measured:

| rotation                           | before          | after           |
| ---------------------------------- | --------------- | --------------- |
| `Klee E E E` — 2nd charge ready    | 1301            | 2433            |
| `Xiao E E E` — 2nd charge ready    | 624             | 1200            |
| `Yae Miko E E E E` — charges ready | 256 / 293 / 330 | 256 / 496 / 736 |
| `Navia E E E` — 2nd charge ready   | 591             | 1091            |

Fourteen multi-charge abilities in the corpus (Klee, Navia, Nefer, Varesa ×2,
Xiao, Yae Miko at 2–3; seven more gain one at a constellation). ⚠️ The digest
is blind to all of them — one E per rotation.

**`cooldownReduce` has a reader** (`src/lib/sim/cooldownReduce.ts`). One mover,
`reduceCooldown`, moves a running cooldown in BOTH its homes at once — the
charge queue / `qReadyAt` that places the next cast, and the cast event's
`readyAt` that draws the ghost tail — because the stance-end site already knew
that moving one leaves the chart and the parser disagreeing. Every charge chained
behind the earliest moves by the same amount; a reduction larger than what
remains is a reset; a cooldown that is not running is left alone (gcsim's early
return). Three dispatchers, all free when nobody on the team authors one
(`TeamContext.cooldownReduces`, the `stackThresholds` precompute pattern):

- `onHit`, from `dispatchHit` — every character-delivered hit. ⚠️ NOT the
  summon-tick stream; a tick-triggered reduction (Alhaitham C1's mirrors) has no
  author yet.
- `onCast`, from `handleCast` AFTER the CD write, so it sees the clock it
  shortens.
- `onReaction`, from `emitReaction`, beside the stack dispatcher with the same
  `source` scoping.

⚓ **The skill it moves is the one ACTIVE at the fire** (`resolveActiveAbility`
with the receiver's own states and team scope) — for an effect hosted on a
passive, a constellation or a burst. ⚠️ **An effect hosted ON a skill reduces
that skill and nothing else** (`hostSkillId`): measured before that rule,
`Lauma E > Varka E N5 N5 N5` took 6s off Windbound Execution, because in a
party with no Pyro/Hydro/Electro/Cryo member Four Winds never resolves and "the
active skill" was the base one. gcsim reduces `ActionSpecialSkill` there — a
queue nobody reads — and leaves the base skill alone; so do we now.

🐛 **The Kazuha-C1 refund had the same defect the round was built to avoid.**
`cdReset` moved the queue and not the tail: `Kazuha E Q E` at C1 placed the
second E at 169f under a first-E tail that still ran to 332f. The refund goes
through the mover now (an infinite reduction is a reset), and the IR invariant
that used to say `readyAt ≥ time + cooldown` reads the new
`CastEvent.cdReduced` — a tail that moved without saying so is what that line
catches. Arlecchino's and Freminet's burst resets were the two corpus rows it
flagged the moment the tail started moving.

**`procCap`** on `EffectBase` — `{ count, per: 'stance' }`. Designed against the
census in §1.B and then narrowed to the one scope with a consumer: the count
lives on the holder's live stance record (`StanceRecord.procCounts`, the
`extCounts` precedent) and is fresh by construction when a stance opens. ⛔ `per`
admits a member only with its consumer — the census's other three scopes (per
summon instance: Escoffier C6, Lauma C6, Mika C4; per cast: Rosaria C4, Itto C4;
a rolling window: Charlotte A1/C4) are named in the field's doc and nowhere
else. Lint B.17 keeps a `per: 'stance'` under an `inStance` condition (so there
is always a window to count in) and refuses the field on any other effect type
(a `damage` carrying one would fire uncapped in silence).

**`startsOnCooldown`** on `SkillAbility`. Written at the STANCE OPENING for
every sibling skill that carries it: one chain from the base skill's cooldown
clock (`start + cooldownStartDelay`, which is where gcsim's stance-entry block
runs — the status is added at the hitmark), `start + cd`, `start + 2cd`, …, and
re-written on every re-entry (gcsim discards the in-progress queue,
`skill.go:105-118`). Lint D.44 requires the `inStance` gate and refuses it on a
stance opener.

**Data** — three characters, Itto retracted (§4.3):

| character                    | effect                                                                                                                                        | measured                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Varka, Four Winds' Ascension | `charges: 2`, C1 `+1`, `startsOnCooldown`, two `cooldownReduce` under mutually exclusive Hexerei gates (0.5s / 1.0s), `procCap 15 per stance` | `Xiangling E > Varka E N2 sE`: Four Winds lands at **685f** = clock start 85 + 11s − 2 × 0.5s. Previously ready at t = 0. `Lauma E > Varka E …`: Windbound untouched. |
| Raiden C6                    | `onHit normal\|charged`, `inStance`, `teamExcludingSelf`, `reduces: burst`, `procCooldown 1`, `procCap 5 per stance`                          | `Xingqiu E Q > Raiden Q N1…C` at C6: Xingqiu's burst **−240f** (four fires inside her 7s stance); C5: 0. Caveat retired.                                              |
| Kujou Sara C1                | `onHit skill\|burst`, `reduces: skill`, `procCooldown 3`                                                                                      | `E N1 N2 Q N1 E` at C1: E tail 607 → **547**, the Q's hit 1.7s later refused by the 3s window; C0 unchanged.                                                          |

### 4.2 Why two Varka effects and not one with a scaled amount

The amount is 0.5s, or 1.0s with 2+ Hexerei. That is a faction TIER, and a
faction tier is a condition on the effect (the Silken Moon rule): two effects
under `teamFaction hexerei ≥ 2` and its `not`. Each carries its own
`procCap: 15`, and that is exact rather than a 30-cap loophole, because a team
fact is static for a parse — only one of the pair ever fires.

### 4.3 What was tried and put back

- **Itto C2** was authored as a three-rung `onCast` ladder (1.5s per Geo member)
  and measured: his burst cooldown went 16.5s → 15s solo. ⚠️ It was ALREADY a
  `cooldownModifier` on the burst (the T-round left it there, and the cast site's
  team-scope comment names it). ⚓ A reduction that is a static team fact at the
  cast is a MODIFIER, not a `cooldownReduce` — the modifier changes the label
  and the tail together and needs no event. Retracted; nothing to author.
- **Ayaka C1** (50% chance per Cryo hit) — a chance modelled as certain is a
  fake. Not authored; the type doc says so.
- **Dori A1, Freminet A1, Yoimiya C4** — each waits on a window the corpus does
  not have (the Jinni link, the Pers timer, Aurous Blaze). The shapes fit; the
  gates do not exist.
- **Alhaitham C1** — a hit from the mirrors, which is the tick stream the onHit
  dispatcher deliberately does not hear yet.
- **Navia C1, Beidou A4** — a per-stack amount. No shape; Beidou's note already
  says so.
- **Charlotte A1** (a defeat), **Noelle A4 / Sucrose C4** ("every Nth hit"),
  **Xianyun C6** ("will not enter CD") — outside the vocabulary.

### 4.4 The pixel

A reduction draws NOTHING of its own: the ghost tail is shorter and the next
cast lands earlier, which is the whole of what the kit promises a player. The
event records the amount (`CastEvent.cdReduced`) for a tooltip that does not
exist yet — ⏭ Nate's call whether the bar should say "−2.5s (Secret Rite)".

### 4.5 Gates

vitest 1898/1898 (the new `sim/cooldownReduce.test.ts` is 15, three seeded
negatives), check, lint, build. e2e: see the merge commit.

### 4.6 Still open after this round

- ↻ **SHIPPED the same day** — Azure Devour's cost
  (`NormalAbility.specialChargeSpends`, `docs/rounds/varka-azure-devour-round.md`).
  🐛 That round also overturned this one's C1 authoring: `chargeModifiers +1`
  on a `startsOnCooldown` sibling wrote a third charge 33s out, unreachable in
  any stance; gcsim's C1 is `ResetActionCooldown` at entry, now a `cdReset`
  naming one ability (`resetsAbility`).
- The 21-character cap census minus the three shipped here: every remaining
  row needs a `per` member that has no consumer yet, and the first consumer
  should be the one whose census row is measured (Escoffier C6's six per Mek
  is a `damage` proc on the summon registry — a different dispatcher).
- The onHit dispatcher on the summon-tick stream, when a tick-triggered
  reduction is authored.

### 4.7 Addendum, same day — Anemo Resonance, and Nate's calls

⚓ **Nate's three calls (2026-09-18):** sequential recharge STAYS (confirmed
against gcsim's `cdQueue`, which pops one entry and starts the next only when
the previous ends — Klee, Sucrose C6 and every multi-charge skill run that way
there too) · the token blocks are the reduction's whole surface, ⛔ no bar, no
printed amount · Ayaka C1's 50% stays unmodelled, and the rule generalises:
⛔ a low-probability proc is never drawn at 100% uptime.

**Anemo Resonance (Impetuous Winds) reaches the planner.** It lived in
`resonance.ts` as a Team Builder fact only; the parser ran every skill at full
cooldown in a double-Anemo party. It is a static ROSTER fact, so by this
round's own rule it is a MODIFIER at the cast, never a `cooldownReduce`:
`TeamContext.skillCooldownModifiers` (one `percent −5` entry when the roster
holds two Anemo characters), prepended to each SKILL's own modifiers in
`resolveAbilityTiming`. ↻ ⚓ **WITHOUT the game's full-party rule** (Nate,
same day, on seeing it): the planner's roster is whoever the notation NAMES,
not the party the player fields — a rotation that writes only Kazuha and
Venti is a party of four with two seats unwritten. The Team Builder keeps the
rule for its own display, where the slots ARE the party. ⚠️ Percent FIRST, then the authored flats — Qiqi's
Seven Sacred Treasures is "−15s off the remaining cooldown", so the game reaches
30 × 0.95 − 15 = **13.5s**; the other order gives 14.25s, the divergence her
curator note used to accept and now closes. Measured over all 123 characters as
the fourth slot of a Kazuha + Venti + Xiangling party: every skill at 95%, and
the four exceptions each right (Bennett's own −20% stacks to 3.8s; Qiqi 13.5s;
the Geo Traveler's flat −2s subtracts after, 3.7s; `blank` is the stub and
takes the uncurated fallback). Corpus digest against the round-4 baseline:
0 moved — its team is three characters, which is exactly the full-party rule
holding. Guarded by three cases in `sim/cooldownReduce.test.ts`.

**Chongyun C2 is a WISHLIST item (⚓ Nate).** Skills and bursts cast inside the
Frost Field get −15% cooldown. The field already exists as a summon window, but
the reduced ability belongs to WHOEVER CASTS inside it and the amount is a
percentage of that caster's own cooldown — neither a modifier on the ability
(it is not the caster's own) nor a `cooldownReduce` (that moves a running clock
by seconds). It wants a third shape, a team-wide "a cast inside window X pays
85%" applied at the CD write, gated on the field being live, with the same
"anyone on field is inside the circle" assumption Bennett's field makes. One
holder today; a half day when it is wanted.

## Notes carried over from Claude's working memory (2026-10-29)

- Merged as `9a5b2125`, with Anemo Resonance as `ee324ae9` and its full-party fix as `acc964d6`; all pushed 2026-09-18 (e2e 73 + 73 on `02512887`).
- A probe rotation must name characters by their display names (`Raiden`, `Itto`, `Kazuha`), not by the words in their ids.
