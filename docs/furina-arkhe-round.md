# The Arkhe round — Furina's two lineups

**Status:** 📋 SPEC, 2026-09-04. Nothing built. ⛔ This file is the BEFORE until a §
below says otherwise.

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
- **c** — the mid-window swap (§4c) + lane identity (§4d).
- **d** — caveat retirement. The E's caveat and the two `_curatorNotes` paragraphs that
  say "Arkhe-state primitive still absent" all go. ⚓ Check them against NAME THE PIXEL
  rather than deleting on sight — the HP-drain multiplier and the A4 interval reduction
  are still unmodelled and still name real pixels.

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
⚠️ A char-JSON edit of this shape needs `npm run generate-character-index`.

## 7. Open

- ⛔ **The stale-`application[]` class (§2a) is NOT this round.** Ten other candidate
  sites, none measured.
- **Furina's C6 splits on alignment** (`cons.go:78` — an Ousia team heal vs a Pneuma
  drain+bonus). With the alignment tracked it becomes expressible for the first time, but
  the values are HP-scaling flat damage, which is still unmodelable — so it stays a
  zero-value placeholder with a note. ⛔ Don't reach for it because the gate finally exists.
- **Window length stays 30s.** gcsim runs `skillMaxDuration` 1736f ≈ 28.9s; the kit table
  says 30.0s and the existing curator note chose the kit. ⛔ Not reopened here.
