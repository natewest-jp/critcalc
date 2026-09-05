# The Arkhe round — Furina's two lineups

**Status:** ✅ **COMPLETE, 2026-09-04.** All four landings shipped — §6a–§6d are the
record. ⛔ §1–§5 are the SPEC as written before any code; where a landing record
contradicts them, the record wins.

⚓ **Nate's three rulings, 2026-09-04**, taken before any code:

1. **The mid-window swap is REAL.** gcsim and the kit text both say the Charged Attack
   spawns the other lineup, inheriting the shared window. Nate's initial in-game report
   said otherwise; he traced it to a web search rather than his own play and withdrew it.
   ⚓ **The kit text and the oracle agreeing is the shape.**
2. ⛔ **No Arkhe row on the timeline.** The summon bar already draws its own name
   (`RotationTimeline.svelte:2544`), so the alignment is legible from the lanes and a
   dedicated state register would be a second way of saying the same thing.
3. **The stale-`application[]` fix lands in THIS round**, not a follow-up — it is the same
   file, the same measurement, and the Arkhe split forces half of it anyway.

---

## 1. The mechanic, from the oracle

`~/Code/gcsim/internal/characters/furina/`:

| fact                                             | source                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Ousia is the default alignment                   | `furina.go:61` — `c.arkhe = ousia` at init                                           |
| the Charged Attack toggles it                    | `charge.go:59-75`, at `chargeHitmark − windup + 1`                                   |
| the cast picks its lineup from the alignment     | `skill.go:85-92` — `skillOusia` XOR `skillPneuma`                                    |
| one shared window and one shared 20s cooldown    | `skillKey`, `SetCDWithDelay(…, 1200, …)` on both                                     |
| a flip KILLS the running chain                   | every tick opens `if c.arkhe != ousia { return }` — returns **without rescheduling** |
| …and SPAWNS the other one, mid-window            | `charge.go:61,68` — `if c.StatusIsActive(skillKey) { c.summonSinger(0) }`            |
| the new chain restarts its cadence from the flip | `summonSinger(0)` / `summonSalonMembers(0)` re-schedule the INITIAL ticks            |
| the burst is alignment-independent               | `burst.go` — zero `arkhe` references                                                 |

⚠️ **The two lineups are not cosmetic variants of one cast.** They differ in frames
(anim 54 vs 57), in cooldown-start delay (0f vs 10f), in spawn offset (18f vs 10f) and —
the one that reaches the gauge — in whether the cast hits at all: `skillOusia` queues a
1U Hydro bubble at frame 18, **`skillPneuma` queues no attack whatsoever**.

⛔ **The Arkhe bonus attacks (Spiritbreath Thorn / Surging Blade) stay unmodelled and that
is CORRECT** — `attack.go:67` gives them `Durability: 0`, so they apply no element. Once
the alignment is tracked they become _authorable_ for the first time; there is still
nothing for them to say, because we do not print damage.

## 2. What we ship today, and the two defects in it

Furina's E authors **both** summons unconditionally, and the ability caveat says so:
_"Only one lineup is real per cast … The timeline shows both because it can't track Arkhe
alignment."_ That is the visible defect. Two invisible ones sit under it.

### 2a. 🐛 The E DOUBLE-FEEDS the gauge

`application[]` on the skill carries **17 entries out to frame 891**. They are not the
cast's own hits: they are the _salon member ticks_, captured by an L4c dump that could not
tell a summon's damage from its caster's. Since L5e those ticks apply on their own.

Measured by differential on `Furina E` (⚓ a real parse, not a reading):

| variant                     | applications                   |
| --------------------------- | ------------------------------ |
| today                       | **31**                         |
| `application[]` stripped    | 25 — the ticks alone           |
| salon tick effects stripped | 7 — the array alone, after ICD |

⚓ The correct array is **one entry**: the Ousia bubble at frame 18, 1U (`Durability: 25`,
`ICDTagNone`). Pneuma's is `[]` — the positive claim, and here it is literally true.

### 2b. 🐛 The three tick series are on the DEFAULT ICD gate and none of them belongs there

`skill.go` gives each member its own tag, and two of them a non-default group
(`pkg/core/attacks/icd_groups.dm.go:101,162`):

| member      | gcsim                                                      | ours today | should be                   |
| ----------- | ---------------------------------------------------------- | ---------- | --------------------------- |
| Chevalmarin | `ICDTagFurinaChevalmarin` + `ICDGroupFurinaSalonSolitaire` | default    | `{ timer: 1800, every: 2 }` |
| Usher       | `ICDTagFurinaUsher` + `ICDGroupFurinaSalonSolitaire`       | default    | `{ timer: 1800, every: 2 }` |
| Crabaletta  | `ICDTagNone` + `ICDGroupDefault`                           | default    | `'none'`                    |

⚠️ The group's sequence is `{1.0, 0.0, 1.0, 0.0, …}` over a 1800f timer — **every other
hit applies**, and the timer is longer than the summon, so the counter never resets
in-window. Our ICD clocks are already per-series (`aura.ts:875`), so the three do not
share and no engine change is needed for this.

Both fixes together, measured: **`Furina E` goes 31 → 21 applications.** A Pneuma E goes
to **0**.

⚠️⚠️ **2a is a candidate CLASS, and this round does not close it.** A coarse census
(abilities carrying both a `summonTick` damage series and an `application[]` with entries
at or after the first tick) names 11 sites: durin ×2, furina, escoffier, qiqi, yaoyao,
charlotte, kinich, emilie, jean, xiangling. ⛔ Only **Furina** has been measured; the rest
is a heuristic that cannot tell a stale capture from a genuine multi-hit cast that outlasts
its own summon's first tick. It wants its own measured pass.

## 3. The authoring shape

⚓ **Name the non-default half.** The state is `pneuma`; its absence IS Ousia, so the
default costs nothing and no rotation has to declare it.

- **Ousia stays the BASE ability** — frames 54, `application: [{ frame: 18, element:
"hydro", units: 1 }]`, `summons: [Salon Solitaire]`.
- **ONE variant, `label: "Pneuma"`** — `input: ["E"]`,
  `conditions: { type: "state", state: "pneuma" }`, gcsim's 57-frame set,
  `application: []`, `summons: [Singer of Many Waters]`.

`matchVariant` (`sim/conditions.ts:359`) already prefers a conditioned variant whose
condition is definitively true, so the **cast** side resolves correctly with no code
change at all.

⛔ **NOT sibling abilities.** The Durin / Odette-Coda pattern is tempting because
`abilityId` already discriminates and `findSummonsForBar` would need nothing — but
E-charge queues are keyed by ABILITY id (`charState.ts:11-13`), so two siblings give
Furina two independent 20s cooldowns and let her double-cast. ⚓ **Odette's Coda chose the
sibling BECAUSE it needed to escape the shared charge queue; Furina needs to stay in it.**
Same fork, opposite answer, and the reason is the same field.

⛔ **NOT `conditions` on `Summon`.** It would filter the list at emission with no variant
at all, and it is genuinely the smaller change — but the two lineups differ in frames, in
`application[]` and in cooldown delay, none of which a summon can carry. The variant is
needed anyway, and then it owns the summons for free.

## 4. The engine work

### 4a. 🆕 The toggle primitive

`actionOpensState` (`NormalAbility`) gains a **`charged`** key beside `normal` and
`plunge`, and `TransientStateSpec` gains toggle semantics: open if closed, close if open,
no duration.

- `cs.states` is a `Map<string, number>` of END times, so "until toggled" is `Infinity`.
- ⚓ **It must NOT clamp on swap.** gcsim's `c.arkhe` is a plain char field that survives
  swap-out, and our clamp is opt-in (`statesTerminatingOnSwap`, `run.ts:1424`), so this is
  had by omission — ⚠️ but state it in the authoring, because the opposite is one keyword
  away.
- The opener fires at the charged action's **END**, which is the existing law for
  `actionOpensState` and is close enough to gcsim's hitmark to be unobservable: E→CA is 53f
  and CA→E is 47f, so no E can ever land inside the discrepancy.

### 4b. ⚠️ The one real blocker — `findSummonsForBar` resolves the variant by INPUT TOKEN

`sim/summons.ts:63`:

```ts
const variant = ability.variants?.find((v) => v.input?.includes(label));
```

Both Furina variants are `input: ["E"]`, so this picks Pneuma unconditionally, whatever
the parse resolved. It runs at finalize and has no state to consult and no way to get one.

**Fix:** carry the resolved variant's `label` on `CastEvent` / `TimelineBar` (variants
have no `id`; `label` is required) and let `findSummonsForBar` prefer an exact label match,
falling back to the input match. Four call sites, every one already holding a bar or a
cast: `finalize.ts:251`, `aura.ts:797`, `states.ts:262`, `summonSubrows.ts:117`.

### 4c. The mid-window swap — ⚓ ONE MODEL, TWO SHAPES

The `icd.ts` law applies: a shared predicate `arkheAt(ctx, charId, t)` over the `pneuma`
state windows, asked by both paths, ⛔ never two walks that must agree.

- **The live path mirrors gcsim almost literally.** The tick chain already re-asks
  liveness at each fire and the clock is MONOTONIC (a tick at T fires with everything
  before T parsed), so a tick can ask the predicate at its own instant exactly the way
  gcsim asks `c.arkhe != ousia`. The flip site in the charged branch (`run.ts:1180-1280`)
  checks whether the skill window is live and starts the other lineup's chain there —
  `summonSinger(0)`, in our words.
- **The finalize path cuts SPANS**: the lineup segments are the intersection of the skill
  window with the Arkhe timeline. Each segment is its own summon window with its own
  `firstTickDelay` restart, because gcsim's respawn re-schedules the initial ticks rather
  than resuming a phase.

⚠️ **A segment's window is still the E's window.** Attribute `sourceCastId` to the
originating cast even when a segment starts at a CA — the guests are that E's guests, and
the lane belongs under that bar.

### 4d. ⚠️ Lane identity has to come from the WINDOWS

`computeSummonSubrows` registers lanes in pass 1 from `findCastSummons(bar)` and projects
windows onto them in pass 2 (`summonSubrows.ts:112-171`). Under §4c a mid-window CA spawns
the Singer off a cast that was **Ousia**, so pass 1 never registers that lane and pass 2
drops the window on `if (!row) continue` — **silently**.

⚓ Same law that already took the tick markers off that pass in the coordinated-attack
round: **the parse publishes, the projection does not derive.** Register the lane from the
emitted window; keep `walkIndex` for bar-order fidelity.

## 5. What the reader sees

The summon bar draws its own name (`rp-summon-label`, `RotationTimeline.svelte:2544`), so
a CA mid-window shows "Salon Solitaire" ending and "Singer of Many Waters" beginning on the
same frame, each captioned. ⚓ That is why §0 ruling 2 holds — an Arkhe register would
re-encode what the lanes already say.

⚠️ **One span is too narrow for its own label.** `Furina E C` leaves a ~1.4s Ousia span,
and `.rp-summon-label` is `white-space: nowrap` inside the bar. The span that follows names
itself, so the rotation stays readable — ⛔ don't pre-emptively fix it; look at it on
screen first.

## 6. Landings

- **a** — ✅ **SHIPPED 2026-09-04.** See §6a.
- **b** — ✅ **SHIPPED 2026-09-04.** See §6b.
- **c** — ✅ **SHIPPED 2026-09-04.** See §6c.
- **d** — ✅ **SHIPPED 2026-09-04.** See §6d.

### 6a. Landing a — the record

**Measured: the corpus is BYTE-IDENTICAL at C0 and C6, all 123 characters**, on the
`constellationGating.test.ts` rotation (declared skill tokens + `N1 N2 N3 C P Q` + a recast

- two reacting partners) over windows, applications, events, bars and aura series.

⚠️⚠️ **And byte-identical proves only that nothing broke — the new path is UNREACHED
until landing b.** The primitive was proven separately by staging landing b's Furina data
in memory:

| notation       | alignment at the E   | lineup drawn          | applications |
| -------------- | -------------------- | --------------------- | ------------ |
| `Furina E`     | Ousia (default)      | Salon Solitaire       | 25           |
| `Furina C E`   | Pneuma               | Singer of Many Waters | **0**        |
| `Furina C C E` | Ousia (flipped back) | Salon Solitaire       | 25           |
| `Furina E C E` | Ousia → Pneuma       | Salon, then Singer    | 25           |

⚓ The **0** is the round's whole claim in one number: `skillPneuma` queues no attack and
the Singer only heals, so a Pneuma cast applies nothing at all.

🔒 **Seeded negative:** the same data with `duration: 5` in place of `toggle: true` leaves
`C C E` in Pneuma with two overlapping 5s windows — it never flips back, and draws the
Singer. The toggle arm is load-bearing, not decoration.

🔒 **Swap persistence** verified directly: `Furina C > Kaeya E > Furina E` keeps the
alignment across the swap and summons the Singer on return.

#### Two findings the differential produced that reasoning had not

1. 🐛 **The finalize clamp must be `isFinite`, ⛔ NEVER `Math.min(end, totalDuration)`.**
   The first cut used the min and moved **four characters** — Varesa's `nightsoulBlessing`
   1484→2384 against a 2112-frame rotation, plus Durin, Ifa and Pyro Traveler. ⚓ **A state
   window is ALLOWED to outlive the rotation**: the rotation ends when its last action
   does, not when the last thing it started finishes. Only the toggle's `Infinity` is
   clamped.
2. ⚠️⚠️ **`variantLabel` had to become a THREE-STATE.** As `string | undefined` it conflated
   "the parse resolved NO variant" with "the caller has no cast in hand", and the second
   meaning falls through to the input match — which is the exact defect the round exists to
   fix. Measured on the staged data before the `null` arm existed, **every Ousia cast drew
   the Singer**: `E`, `C C E`, and the Ousia half of `C E C E`. The arm is
   `string` = that variant · `null` = the base · `undefined` = match by input.

⚓ **The `null` arm is provably unreachable in today's corpus**, which is why the
differential stayed byte-identical through it: **no variant anywhere carries both
`conditions` and `summons`.** ⚠️ Two abilities DO already have variants sharing an input
token — Freminet's `E` (Shattering Pressure Lv 0–3 / Lv 4) and Yun Jin's `hE` (Hold Lv.1 /
Lv.2) — so Furina is not inventing the shape, only the first case where the choice is made
by STATE rather than by charge level.

⚓ It also puts summons on the rule the parser already applied to TIMING: `matchVariant`
needs input **and** conditions, and an unsatisfied variant already fell back to the base
ability's frames and cooldown. Its summons did not follow until now.

#### ⏭ Left for later, deliberately

`RotationTimeline.svelte` calls `findCastSummons` at three sites (1424, 2450, 2566) with
neither `abilityId` nor `variantLabel` — they are presence tests (`hasSummon`, which picks
the pill geometry), and both of Furina's lineups have exactly one summon, so the answer
cannot differ for her. ⚠️ It is a **pre-existing** divergence from the parser's resolution
(it predates this round and would want `abilityId` too, which could move Durin), so it is
⛔ not widened into landing a. Re-check it if a character ever has a lineup with a summon
and one without.

### 6b. Landing b — the record

**Measured: exactly ONE character moves, at C0 and C6.** The other 122 are byte-identical
on the same differential landing a used.

| notation        | lineup drawn                         | applications |
| --------------- | ------------------------------------ | ------------ |
| `Furina E`      | Salon Solitaire (33 ticks)           | **31 → 21**  |
| `Furina C E`    | Singer of Many Waters (15 ticks)     | **31 → 0**   |
| `Furina C C E`  | Salon Solitaire — flipped back       | 21           |
| `Furina E C E`  | Salon, then Singer                   | 21           |
| `Furina N1 C E` | Singer (the CA's windup is honoured) | 0            |

⚓ **The 0 is the round's claim in one number.** `skillPneuma` queues no attack and the
Singer only heals, so a Pneuma cast applies nothing at all — which is what
`application: []` on the variant says out loud.

On the differential's own rotation (`Furina E N1 N2 N3 C P Q E > …`) the two casts split
cleanly: the first E is Ousia and keeps `Salon Solitaire@18`, the second is Pneuma and
keeps `Singer of Many Waters@1210`, while `Salon@1218` and `Singer@10` — the halves that
were never real — are gone. Applications **64 → 28**.

⚠️ **Two knock-on movements, both correct and both worth expecting.** The Pneuma variant's
frames are gcsim's (anim 57 vs Ousia's 54), so a Pneuma E is 3 frames longer and everything
downstream — Xingqiu's summons, his resShred windows — shifts by exactly 3. And at C6 the
placeholder buff moves with its cast. ⛔ Neither is drift to be "corrected" back.

#### Authoring

- **`State` gains `pneuma`** — ⛔ and no `ousia` beside it. Two states for one bit is a pair
  that can disagree, and the default would then have to be asserted at the top of every
  rotation. Absence IS Ousia.
- **The toggle is on the NORMAL ability** (`actionOpensState.charged`), not the skill —
  the Charged Attack is what flips the alignment; the skill only reads it.
- **The Pneuma variant** carries its own frames, `application: []`, and the Singer.
  ⛔ Not authored: gcsim's `pneumaCDDelay` of 10f (Ousia's is 0) — `AbilityVariant` has no
  `cooldownStartDelay`, and 10 frames on a 20s cooldown is below what the ghost tail can
  show. Not worth a schema field.
- **Three `icdGate`s, and they are not the same gate** — Usher and Chevalmarin carry
  `ICDGroupFurinaSalonSolitaire` (`{ timer: 1800, every: 2 }`), Crabaletta is `ICDTagNone`
  (`'none'`). ⚓ Authored per SERIES, never once on the summon, precisely because the third
  member is not on the group the other two share.

#### 🐛 A pre-existing hole in the lint, found on the way

`codaWindow` went into the `State` union in the Odette Stage-2 round and **never into
`characterLint`'s `STATES` set** — and nothing noticed, because that vocabulary check runs
only over `isCurated` characters and Odette is in `FRAMELESS_EXEMPT`. Her
`opensTransientState.state` has never reached it. ⚠️⚠️ **Adding a `State` member is TWO
edits, and the suite cannot tell you so when the character that needs it is frameless.**
Both `codaWindow` and `pneuma` are in the set now.

The lint also learned the round's two new shapes, each verified by seeded negative:
`actionOpensState.charged` as a legal action class, and **exactly one of `duration` /
`toggle`** — ⚠️ TypeScript already refuses the pair through the union's `never`s, but the
character JSONs are cast to `CharacterData` rather than checked against it, so the lint is
the only gate that runs on authored data.

#### The Team Builder moved, and correctly

Furina's `heal/active/C0` capability went **`conditional: false` → `conditional: true`** and
now carries `variant: "Pneuma"` provenance. That is the one index change in the whole
landing, and it is a truer statement: her healing is conditional on being in Pneuma.
✅ **Verified on the roster surface by Nate, 2026-09-04.**
⚠️ A char-JSON edit of this shape needs `npm run generate-character-index`.

### 6c. Landing c — the record

**Measured: exactly ONE character moves, at C0 and C6.** The other 122 are byte-identical.

| notation          | occupants of the one window                                   |
| ----------------- | ------------------------------------------------------------- |
| `Furina E`        | `Salon[18–1818]` 33 ticks — no flip, unchanged                |
| `Furina E C`      | `Salon[18–86]` → `Singer[86–1818]` 14 ticks                   |
| `Furina E C C`    | `Salon[18–100]` → `Singer[100–133]` → `Salon[133–1818]`       |
| `Furina C E C`    | `Singer[57–136]` → `Salon[136–1857]`                          |
| `Furina E ~25s C` | `Salon[18–1586]` 29 ticks → `Singer[1586–1818]` 2 ticks       |
| `Furina E ~35s C` | `Salon[18–1818]` — the flip lands AFTER the window; no change |

⚓ The replacement's cadence restarts from the flip: the Singer's first heal mark in
`Furina E C` is at 351 = 86 + 63, which is gcsim's `singerInitialTick` scheduled afresh by
`summonSinger(0)`. ⚠️ Every occupant ends at the SHARED end — a later lineup inherits the
remaining duration, it does not start a lifetime of its own.

On the differential's own rotation the Salon window goes `[18–1818]` with 22 ticks to
`[18–288]` with 4, and a `Singer[288–1818]` appears with 13. Applications **28 → 11**.

⚠️ The only other movement is REACTIONS, and it is the gauge answering correctly: with
Furina no longer over-applying Hydro, Kaeya's Cryo survives as its own aura series and two
Xingqiu reactions appear that the Hydro flood used to swallow. ⛔ Not drift.

#### The design

⚓⚓ **The parse records where the lineup changed; finalize cuts the window on it**
(`ctx.lineupChanges`, keyed by cast id). The same law as `TimelineWindow.ticks` and the
coordinated-attack round's fire times: the choice needs the character's state at an instant
INSIDE the window, and finalize has no state left to ask.

⚓ **Retiring the outgoing chain reuses the RECAST machinery** — a `summonChainGen` bump on
its key, whose `isCurrent()` check every scheduled tick and every armed summon proc already
consults. ⛔ Nothing cancels a queued task and no new liveness predicate enters the chain.

⛔ **`summonsFollowState` is opt-in, and the general rule would be WRONG.** "Re-resolve a
cast's summons whenever a gating state changes" sounds like the honest default and is not:
a burst variant gated on `inStance` whose stance ends mid-window must keep the summon it
spawned. A cast spawning a thing is the norm; a cast holding a slot something else can move
into is the exception, and only a kit that says so may claim it.

⚠️⚠️ **It re-resolves at state edges the parse can SEE — not at a timed window's silent
expiry**, which fires no event. Sound only because the gating state is a TOGGLE, and
**lint enforces exactly that**: a `summonsFollowState` ability's variants must gate on a
state some `toggle: true` spec on the same character opens. Both halves seeded-negative
verified (turn the toggle into a 6s window → red; drop the variant's gate → red).

#### 🔒 Two tests changed, and both changes are the point

- **`notationParser.ir.test.ts`'s independent oracle stops naming the occupants of a
  followState window and asserts they TILE it instead** — first occupant at the spawn, last
  at the shared end, each beginning exactly where the previous ended. ⚓ That is not a
  weaker assertion than the tuple equality it replaces: it is the one that catches a gap,
  an overlap, or a window running past the cast's own end, which is every way the cut can
  go wrong. **Seeded-negative verified twice**: making a later occupant start a fresh
  lifetime, and forgetting to cut the outgoing one, each turn it red.
- **`summonSubrows.test.ts` no longer asserts that a stray window is dropped.** Lane
  identity now comes from the WINDOW (§4d), because pass 1 cannot enumerate a lane the cast
  never resolved. ⚠️ The old contract was not a safety net being removed — pass 1 and pass 2
  resolved through the same function with the same arguments, so a stray window was
  unreachable in a real parse. The drop still guards the case it was written for, and the
  test now asserts that half explicitly: a window for a character with **no slot** has
  nowhere to go.

#### The caveat moved rather than went

The lineup caveat is retired — it described exactly what landing c fixed. Applying NAME THE
PIXEL to what is left, the strongest remaining claim is the Singer's **heal cadence**:
Unheard Confession shortens its 2s interval by up to 16% at high Max HP, a cap essentially
every built Furina reaches, so we draw ~15 marks where the game gives ~18. ⚠️ The Salon
members' ±7-frame gcsim jitter stays in `_curatorNotes` — at ~2px it names no pixel.

### 6d. Landing d — the record

**Measured: Furina only, and the window COUNT is unchanged** (8 → 8 at C0, 12 → 12 at C6).
Only value payloads moved; no geometry, no ticks, no applications. The other 122 characters
are byte-identical.

#### 🐛 The audit found a wrong pixel that had nothing to do with this round

Furina's **signature mechanic drew two team bars reading `+0%` for 18 seconds.** Her burst's
Fanfare buffs are authored `value: 0` as a placeholder for a number that needs HP-change
simulation — and `formatBuffDisplayValue` prints a numeric value verbatim
(`typeof value === 'number'` → `` `+${value}%` ``), so the placeholder reached the bar. Her
C6 window did the same thing a third time.

⚓ **The fix is `BuffValue` `{ type: 'unknown', description }`, which exists for exactly
this** and renders the description in place of a number. ⛔ **The bars themselves are
CORRECT and stay** — the 18s Fanfare window and the 10s C6 window are both real; only the
number was unknowable. That is the difference between a bar that should not be drawn and a
bar drawn with a lie in it.

⚠️⚠️ **It was NOT a class.** A corpus sweep for a literal `value: 0` on a buff effect
returns **0 across 0 characters** now that Furina's three are fixed — she was the only
holder. ⛔ So this is not a queued round, and a future author reaching for `value: 0` as a
placeholder should be pointed at `unknown` instead.

#### Caveats and notes

- The lineup caveat is retired; the E now carries the **Singer's heal cadence** instead
  (A4 shortens the 2s interval by up to 16% at high Max HP — a cap essentially every built
  Furina reaches — so we draw ~15 marks where the game gives ~18). It is the one surviving
  claim that NAMES A PIXEL.
- **Two `_curatorNotes` retired for saying the opposite of what is now true**: "ticks pause
  in Pneuma … planner can't track arkhe, so ticks render for the whole window" (both halves
  false since landing c) and the Singer's "Arkhe-state primitive still absent" paragraph.
- **Kept, and deliberately**: the Salon members' ±7-frame gcsim jitter (~2px — names no
  pixel) and the HP-drain multiplier (a damage multiplier, and we print no damage). ⚓ Both
  are true statements about unmodelled mechanics, which is what `_curatorNotes` is for.

## 7. Open

- ⛔ **The stale-`application[]` class (§2a) is NOT this round** — but it is CENSUSED now.
  See §8.
- **Furina's C6 splits on alignment** (`cons.go:78` — an Ousia team heal vs a Pneuma
  drain+bonus). With the alignment tracked it becomes expressible for the first time, but
  the values are HP-scaling flat damage, which is still unmodelable — so it stays ONE
  window with an `unknown` value (↻ §6d: it was a zero-value placeholder, which drew a
  `+0%` bar). ⛔ Don't reach for the split because the gate finally exists.
- **Fanfare is still unsimulated**, and that is upstream of the gauge, not of this round:
  it counts party HP CHANGES, which needs a health model the planner does not have. The
  bars say `≈0.26% per Fanfare, up to ~78%` rather than a number.
- **Window length stays 30s.** gcsim runs `skillMaxDuration` 1736f ≈ 28.9s; the kit table
  says 30.0s and the existing curator note chose the kit. ⛔ Not reopened here.

---

## 8. The stale-`application[]` class — the census (2026-09-04)

> ⛔⛔ **SUPERSEDED BY §9 IN FOUR OF ITS SIX VERDICTS.** This section was derived from data
> SHAPE alone — which entries land on which predicted tick instants. Reading gcsim per
> character overturned charlotte, qiqi and durin outright and rewrote the reason for yaoyao.
> ⚓ **The thing shape could not see: `summonTick` is a FIXED INTERVAL, and half these
> summons do not have one** — so an `application[]` carrying summon damage is sometimes the
> only place that data CAN live, and is correct. Read §9; keep this only as the record of
> how far a structural census gets before it needs the oracle.

§2a flagged ~11 candidate sites off a coarse test ("an `application[]` entry at or after the
summon's first tick"). ⚓ **That test is mostly noise, and a cadence test replaces it**: an
entry is suspect only if it lands ON the summon's predicted tick instants, not merely after
the first one. On that test **escoffier, emilie and jean drop out entirely** — their late
entries are genuine cast hits that outlast a summon's first tick, which is the false-positive
class the coarse sweep could not see.

⚠️⚠️ **And it is not ONE defect — it is three, with different fixes.** Sorting the survivors
by what the array's cadence agrees with:

| kind                            | characters                                                                          | what is actually wrong                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — a real double-count**     | **kinich** (5 of 6 entries track Ajaw at 253/403/553/703/848 against a 147f series) | the summon HAS the damage series, so both fire. Furina was this. **Fix: trim the array to the cast's own hits.**                                                                                                                                                                                                                                                                                                                                             |
| **B — a MISSING damage series** | **yaoyao**, **charlotte**, **qiqi**                                                 | the summon is authored **heal-only**, and its damage applications were smuggled into the cast's array. ⚓ No double-count — a heal tick never reaches the gauge — but the aura is UNDER-fed once the array runs out (Yaoyao stops at frame 325 while Yuegui lives on) and the summon lane draws **no damage tick markers at all**. **Fix: author the damage `summonTick` series, then trim** — more work, and it needs the oracle for cadence AND ICD group. |
| **C — a cadence disagreement**  | **durin** (both bursts)                                                             | the array is a uniform **~59f** cadence; the authored series says **74f**. One of the two is wrong and the data cannot say which. **Fix: re-measure against gcsim.**                                                                                                                                                                                                                                                                                         |
| **false positive**              | **xiangling**                                                                       | one entry at 57 against a first tick at 56. Pyronado's three spins are 18/33/57 — the match is a COINCIDENCE.                                                                                                                                                                                                                                                                                                                                                |

⚠️⚠️ **Subtraction cannot measure any of this, and that is the round's instrument lesson.**
Parsing with `application[]` stripped and with the summon effects stripped does NOT
decompose — ICD gating makes the two sources non-additive, so removing one can _raise_ the
total (Durin measured 11 base against **12** with the array removed, because suppressed
later hits stop being suppressed). ⛔ Never scope this class by differential arithmetic; the
instrument is `scripts/audit-gcsim-reactions.mjs`, per character, against the oracle.

✅ All six survivors ARE oracled (`~/Code/gcsim/internal/characters/`), so every one is
adjudicable — unlike the 7.0 characters. ⚓ **Do B first**: it is the only kind that leaves a
summon lane visibly empty, and it is the one whose fix adds data rather than removing it.

---

## 9. The class against the ORACLE (2026-09-04) — and tier 1

⚓⚓ **THE FINDING THAT REFRAMES EVERYTHING: `summonTick` IS A FIXED INTERVAL, AND HALF THESE
SUMMONS DO NOT HAVE ONE.** §8 assumed that a summon's damage in a cast's `application[]` is
always misplaced. It is not. Where the real cadence is irregular, the array is the ONLY
place the data can live, and authoring it there is correct.

| character               | §8 said              | the oracle says                                                       |
| ----------------------- | -------------------- | --------------------------------------------------------------------- |
| **yaoyao** (burst)      | missing series       | ✅ **confirmed** — and the SKILL already carries the identical series |
| **charlotte** (burst)   | missing series       | ❌ **not a defect** — gcsim has no gadget at all                      |
| **qiqi** (skill)        | missing series       | ❌ **not a defect** — the cadence is unexpressible                    |
| **kinich** (burst)      | double-count         | ✅ **confirmed**                                                      |
| **durin** (both bursts) | cadence disagreement | ⚠️ **worse, and different** — see §9.3                                |
| **xiangling**           | coincidence          | ✅ confirmed                                                          |

### 9.1 ✅ Tier 1 — shipped

**Kinich.** `application[]` trimmed from `[161, 253, 403, 553, 703, 848]` to the burst's own
hit alone (161 = gcsim `burstHitMark`). The rest were Ajaw's Dragon Breath lasers, and the
`summonTick` series beside them has fired the same lasers into the gauge since L5e. ⚓ The
series is CORRECT and untouched: gcsim schedules the first laser at `ajawFirstHitmark` 253
and each queues the next at a RANDOM `ajawHitmarks{145,150}`, so our fixed 2.45s (147f) is
the mean of a stochastic cadence — the Furina salon-member pattern — and `step == 7` stops
the chain at 6 lasers against our window's 6 ticks.

⚠️ **Not exact afterwards, and the residue is an ENGINE limit.** gcsim gives the burst's own
hit and every laser the same `ICDTagElementalBurst`, so they walk ONE counter; we run the
cast on its own clock and the series on `kinich:summon:Ajaw:0`. Measured, `Kinich Q` applies
at 161/253/547/841 where gcsim suppresses the 253. ⛔ Not fixable in data — "counters are
NOT shared across casts" is the standing rule.

**Yaoyao.** The burst's radish DAMAGE series authored — the burst half of what the SKILL has
carried since the L5e residue pass. Cadence is a genuine fixed interval (`ThinkInterval` 29
then 60, plus `travelDelay` 13 → `firstTickDelay` 0.7s, `interval` 1s, identical to the
skill's). Scaling 129.888% at TL10, two-source verified (gcsim `burstRadishDMG[9]` = 1.29888
against the sidecar's "129.9%"). Gate `{timer: 90}` — ⚠️ the skill's is 150; **the two
lineups are on different ICD groups**, which is why the gate is authored per SERIES.
`application[]` trimmed to the cast's own hit at frame 16.

⚓ **`tickCap: 4`, on BOTH series.** gcsim removes every Yuegui at `burstDur` = 360f **from
the cast**, while our window is `spawnsAt` 104 + 6s = 464f. **A COUNT, never a time bound** —
nudging the stated 6s duration would fix the ticks by making the ABILITY's bar wrong, since
`summons[0].duration` is what resolves the bar's uptime. Exactly Mona's shape. ⚠️⚠️ And the
sibling HEAL series needed the same cap: one gcsim task emits the radish's damage and its
heal together, and the oracle cannot see the heal because it leaves no damage event.

⚓⚓ **ONE Yuegui is modelled though the burst spawns THREE (104/162/221), and that is
MEASURED.** All three radishes carry `ICDTagElementalBurst`, so they share one counter:
gcsim's nine nominal throws gate down to applications at **145 and 262**, and one Yuegui on
this cadence gates to **146 and 266** — the same two, within four frames. The extra two add
DAMAGE and HEALING, which we do not print, and the ability caveat already states the healing
frequency. ⛔ Don't author three summons for the gauge's sake: they share a label so they
collapse into one lane as overlapping bars, each duration would have to encode "ends at cast

- 360", and their ICD correctness would rest on a key collision. (⚓ Nate asked whether the
  three are on-field-only — they are: `onExitField` kills them on any swap, which
  `terminatesOn: 'swap'` already models.)

**Measured: TWO characters move, 124 byte-identical at C0 and C6.** `Yaoyao Q` applies at
16/146/266 (was ten array entries feeding the gauge); `Kinich Q` at 161/253/547/841, with the
corpus rotation's applications 14 → 11. ⚠️ Kinich's Dendro Core window shifts 1115 → 1253 —
a Bloom landing later off the corrected stream, not drift.

🐛 **One artifact, pre-existing and now on one more summon.** Yaoyao's burst draws its tick
markers DOUBLED (146,146,206,206…) because heal and damage share a cadence — the open
8-summon issue in `gauge_round_l5e`. ⚠️ Her SKILL already did this, so the burst is now
CONSISTENT with it rather than newly broken; ⛔ still don't dedupe without the corpus
measurement that note asks for.

### 9.2 ⛔ Charlotte and Qiqi — leave them alone

**Charlotte's burst has no gadget in gcsim.** It is a cast scheduling 8 hits at hardcoded,
IRREGULAR frames — `burstTickFrames = {95, 119, 143, 166, 179, 203, 226, 249}`, note the +13
at 179 among otherwise ~24f steps. Her `application[]` is those frames plus the cast hit,
which is correct authoring. The only real flaw is that our HEAL series approximates that
irregular list at a fixed 0.4s, drawing 9 marks against gcsim's 8 and running to 293 where
the last real tick is 249.

**Qiqi's Herald damage is PAIRED swipes**, and gcsim's own comment says it is guessing:
"Damage procs occur (in sec 0 = skill cast): 1.5, 3.75, 4.75, 7, 8, 10.25, 11.25, 13.5,
14.5". Our array matches all nine exactly. A fixed interval cannot express a pair structure.
Her heal series (4.5s × 4) matches gcsim's four heals.

⚠️ **The cost of leaving them, stated rather than fixed**: their summon damage reaches the
gauge as a CAST application, not `viaEntity`. Correct for the gauge, but an `onReaction`
proc with `source: 'active'` would fire off a Herald swipe when it should not. No corpus
consumer reaches it today.

### 9.3 ✅ Durin — tier 2, shipped

⚠️⚠️ **HALF OF THIS SECTION'S FIRST DRAFT WAS WRONG, AND READING THE SOURCE IS WHAT FIXED
IT.** The identical `[97, 121, 154]` head on both arrays is NOT a mis-capture: gcsim's
`burstInitHitmark = {97, 97+24, 154}` is ONE slice shared by both forms, so White and Dark
genuinely land their three opening hits on the same frames and only the multipliers differ.
⛔ Two arrays agreeing is not evidence of duplication when the kit says they should.

**What IS wrong is the TAIL.** The Dark array continues past 154 at a uniform 58.8f starting
at 156 = `ceil(burstFirstTickDelayWhite)` — the WHITE dragon's tick stream, on the DARK
ability, whose own series correctly runs at 73.6f. So the Dark burst applied Pyro twice AND
at the wrong cadence. ⚓ The White array was already right (its three hits, no tail) and is
the shape copied across.

Three fixes, all derived from `burst.go` because the dumper cannot reach this form:

1. **Dark's array trimmed to `[97, 121, 154]`.**
2. **`icdGate: {timer: 120}` on the Dark series.** `ICDGroupDurinBurstBlack` is a 2s window,
   sequence `{1,0}`; absent meant the standard 2.5s/every-third, a different rule.
   ⚠️⚠️ **The ICD-group round authored WHITE's gate and missed this one**, for the same reason
   the white stream got into the array: `drivers.json` gives durin `darkForm: []` and it
   "gets no row". ⚓ **A form the oracle cannot reach is where to look when a per-series field
   is missing on one half of a pair.**
3. **`firstTickDelay` on both** — ⚠️ and the honest accounting is that only one of them moves.
   Absent does NOT mean zero: `summonTickSeries` defaults `firstDelay` to the INTERVAL
   (`summons.ts:296`). White's default put the first tick at 155.8 against gcsim's 156, so
   authoring 0.983 is a numeric no-op kept for exactness and symmetry. Dark's default put it
   at 170.8 against gcsim's 176 — **five frames early, inherited by all 16 ticks** — so that
   one is a real correction. The interval was also sharpened 1.23 → 1.227 (73.8f → 73.6f).

⛔ **NO `tickCap`, and that was checked rather than assumed** — my own §9.3 draft claimed it
was missing. gcsim fires `burstTicksWhite` 20 and `burstTicksBlack` 16, and our window
(`spawnsAt` 97 + 20s) with these delays and intervals yields **exactly 20 and 16**. The
tick-cap round's rule is that absent is right unless the count diverges from
duration ÷ interval, and here it does not.

**Measured: ONE character moves, 125 byte-identical at C0 and C6.** Applications 18 → 15 on
the corpus rotation; verified per form, `Durin Q` draws 20 White ticks from 156 and
`Durin E N1 Q` draws 16 Dark ticks from 237, both matching gcsim's counts exactly. At C6
three buff windows shift start — they ride the tick times, which are now right.
