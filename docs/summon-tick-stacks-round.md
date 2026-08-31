# Summon ticks → the stack machinery — spec

> **Status: ✅ BOTH HALVES SHIPPED 2026-08-31. §10 is Half A's record.**
> ⚠️ §9 is the record of what landed; §1–§5 are the BEFORE and §3's central
> claim was measured false.
>
> **(previous status: CENSUS DONE 2026-08-31, NOT BUILT.)** Written during Alyosha's Stage 2
> at ⚓ Nate's request; the census in §7 ran immediately after and **overturns
> this document's central assumption**. ⚠️⚠️ **Read §7 before §3 and §5** — the
> blast radius §3 warns about is measured at ZERO, and the round's real value is
> a correction this repo currently describes as already made.

## 1. The gap, stated exactly

A summon's damage tick reaches **two** of the four streams a hit can reach:

| stream                                                   | reached? | how                                                                                                                                 |
| -------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| the gauge (elemental application)                        | ✅       | `offerApplication`, live on the clock (`sim/aura.ts`, L5e)                                                                          |
| damage procs (`ctx.procs`)                               | ✅       | `notifyDamage` from inside the tick chain (`aura.ts:846`)                                                                           |
| artifact 4pc `onHit` windows                             | ✅       | synthesized hits at finalize (step 6c, 2026-08-15)                                                                                  |
| **character `onHit` buff / resShred bars**               | ⛔       | `hitsForTrack` (`buffWindows.ts:284`) selects `normal \| charged \| plunge` only, and a synthesized tick is tagged `skill \| burst` |
| **the stack machinery** (`gainStacks` / `consumeStacks`) | ⛔       | the tick chain calls `notifyDamage`, never `dispatchHit`                                                                            |

CLAUDE.md already names the second half — _"a summon tick feeding a STACK
effect stays unmodelled"_ — under the step-6c note.

## 2. ⚠️⚠️ The stated reason is now partly stale

The reason on record is:

> "These feed `deriveBuffWindows` ONLY and are deliberately NOT put through
> `dispatchHit` — that machinery mutates live state in PARSE order and a
> finalize-time hit cannot be interleaved without a two-pass parse."

That was true when summon-tick hits existed **only** as a finalize-time
synthesis. ⚓ **Since gauge round L5e the tick chain fires live on the clock** —
one tick at a time, each scheduling the next, each at a known monotonic instant
(`scheduleSummonTicks` in `sim/aura.ts`). A tick therefore already has a real
parse-order position, and `notifyDamage` already exploits it. The two-pass
objection does not apply to the live chain.

⚠️ It still applies to the **finalize** synthesis, which is a different thing
and must not be confused with it. Any change here belongs on the live chain.

## 3. The change

Roughly: the live tick chain calls into the stack dispatchers the way
`dispatchHit` does, at the tick's own instant, after the application and before
`notifyDamage` (so a proc can never observe half-applied stacks — the ordering
`dispatchHit` already documents). Then decide, separately and deliberately,
whether `hitsForTrack` should stop filtering to N/CA/P.

⚠️⚠️ **The blast radius is corpus-wide, and that is the whole risk.** Every
`onHit` `gainStacks` / `consumeStacks` effect in the corpus would start firing
off summon ticks, and every character `onHit` buff bar would too if the second
half lands. This is the same shape as step 6c and wants the same treatment: a
before/after measurement over all 123 characters, not a spot check.

⚠️ `teamHasOnHitStackEffects` currently gates the whole onHit settle path. It
would have to account for summon-hosted sources, or the gate silently keeps the
new dispatch off for most teams.

## 4. The first customer

**Alyosha's Tugarin.** His burst summons a companion that mauls every 2s, and
in game each maul **activates** an existing Hunter's Mark:

> "If an opponent affected by the Hunter's Mark effect is hit, the Hunter's Mark
> will also be activated." — Hunter's Advance

Hunter's Mark is authored as a stack resource (`huntersMark`,
`lifetime: 15`, `max: 2`) and the E / N4 half of the mechanic works today —
verified: `Alyosha N4 E` draws one 15s +21.2% ATK bar on the active character,
and it follows a swap to the incoming teammate. What does **not** work is
Tugarin, which is the activator that matters in play. It is caveated on the
burst.

⚠️ Note the C0 / C2 asymmetry, which an implementer will need:

- **C0** — the burst applies no mark. Tugarin's _first_ maul consumes the one
  mark that exists; the remaining six do nothing. Hunter's Precision runs 15s
  from that first tick.
- **C2** — "each time Tugarin attacks the opponent, he will also apply the
  Hunter's Mark to a target. **This effect does not activate existing Hunter's
  Marks.**" So every maul applies while the base activation still fires:
  Precision is effectively continuous, and ends 15s after the _final_ tick.

⚠️⚠️ That non-activation clause is load-bearing. A naive "a tick applies AND
activates" model would double-fire at C2.

## 5. What else is waiting on it

Not exhaustive — worth a census before starting, because the value of the round
is the length of this list:

- Alyosha C2's per-tick Hunter's Mark application (§4).
- Any future kit whose summon feeds a resource the player watches accumulate.

⚠️ And the reverse: the census must also find every effect that would begin
firing **unintentionally**. That set is the cost side of the measurement.

## 6. Sources

- `src/lib/sim/aura.ts` — `scheduleSummonTicks`, `notifyDamage`.
- `src/lib/sim/run.ts` — `dispatchHit` (gains → snapshot → consumes).
- `src/lib/utils/buffWindows.ts:284` — `hitsForTrack`.
- `docs/curation/engine-capability-rubric.md` § TRAPS — "Summon damage ticks are
  in THREE different streams with three different answers".
- `src/lib/data/characters/alyosha.json` — the burst's caveat and notes.

## 7. ⚓⚓ THE CENSUS (2026-08-31) — what it actually measured

Run over all 123 character JSONs plus the weapon and artifact sets, matching
each `onHit` trigger against a synthesized tick hit's real shape
(`finalize.ts` step 6c: `abilityType`/`damageTag` = the spawning cast's class,
`abilityName` = the summon's label, `hitIndex` absent).

### 7a. ⚓⚓ The stack half's blast radius is ZERO

**The corpus holds FIVE `onHit` stack effects in total, and all five are
excluded from summon ticks by their own triggers:**

| holder  | effect        | key         | excluded by                                    |
| ------- | ------------- | ----------- | ---------------------------------------------- |
| alyosha | gainStacks    | huntersMark | `abilityType: 'normal'` + `filter.hitIndex: 3` |
| alyosha | consumeStacks | huntersMark | `abilityType: 'normal'` + `filter.hitIndex: 3` |
| yanfei  | gainStacks ×2 | seal        | `abilityType: 'normal'`                        |
| yanfei  | consumeStacks | seal        | `abilityType: 'charged'`                       |

No weapon in the corpus carries an `onHit` trigger at all. Three artifact sets
do (Deepwood, Tenacity, Silken Moon) and **none carries stacks**.

⛔ **So §3's "the blast radius is corpus-wide" is FALSE, and the step-6c-shaped
before/after it calls for is not needed for this half.** Dispatching ticks into
the stack machinery changes the behaviour of exactly nothing that exists today.
It is pure capability, and its only customer is Alyosha's Tugarin.

⚠️ That cuts both ways: with one customer, the stack half is cheap and safe but
carries almost no value on its own. **The value is all in 7b.**

### 7b. ⚠️⚠️ THE BUFF/SHRED HALF IS THE ROUND, AND THIS REPO SAYS IT IS DONE

`finalize.ts`'s step-6c comment claims the four characters it names got an
uptime correction:

> "FOUR characters leave a damaging summon AND hold an `onHit` effect that
> summon can fire — Emilie (C2), Escoffier (A-passive), Anemo Traveler (C6),
> Xiangling (C1) … For those the effect already fired at the CAST instant, so
> this is an uptime correction rather than a from-nothing gain."

**It is not.** Measured — `Xiangling E` at C1 draws ONE pyro shred window,
`0.22 → 6.22s`, while Guoba ticks at `2.10 / 3.77 / 5.43 / 7.10`. Tick-anchored
with its 6s refresh it would run to `13.10s`. The window opens at the cast and
never refreshes.

⚓ The cause is the split the capability rubric names and the 6c comment does
not: the **artifact** branch reads the raw list
(`hits.filter(h => h.characterId === track.characterId)`, `buffWindows.ts`
~:1014), while the **character** branch reads `hitsForTrack` (:284), which
selects `normal | charged | plunge`. Synthesized ticks are `skill | burst`, so
they reach the artifact sets and nothing else.

⚠️⚠️ **Two in-repo claims were in direct conflict and one had to be measured to
settle it.** The rubric (2026-08-18, probe-derived) is right; the 6c comment
(2026-08-15) is wrong, and wrong in the direction that makes this round look
already-done. ⛔ Fix that comment whenever this is picked up, whether or not the
round ships.

### 7c. What the correction is worth — 11 characters, measured

Each effect's window today ends at `cast + duration`; tick-anchored it would end
at `last tick + duration`. Both computed from the authored cadence and cap:

| holder         | effect                   | summon                    | ticks | last tick | today ends | would end | gain        |
| -------------- | ------------------------ | ------------------------- | ----- | --------- | ---------- | --------- | ----------- |
| emilie         | Dendro RES −30 (C2)      | Lumidouce Case (E)        | 14    | 21.00s    | 10.00s     | 31.00s    | **+21.00s** |
| escoffier      | Cryo/Hydro RES −55 (A)   | Cooking Mek (E)           | 18    | 19.04s    | 12.00s     | 31.04s    | **+19.04s** |
| lauma          | Dendro/Hydro RES −25 (E) | Frostgrove Sanctuary      | 8     | 14.68s    | 10.00s     | 24.68s    | **+14.68s** |
| navia          | Geo RES −20 (C4)         | Cannon Fire Support (Q)   | 17    | 11.35s    | 8.00s      | 19.35s    | **+11.35s** |
| rosaria        | Physical RES −20 (C6)    | Ice Lance (Q)             | 4     | 8.00s     | 10.00s     | 18.00s    | **+8.00s**  |
| venti          | Anemo RES −20 (C6)       | Stormeye (Q)              | 20    | 7.80s     | 10.00s     | 17.80s    | **+7.80s**  |
| sigewinne      | Hydro RES −35 (C2)       | Bolstering Bubblebalm (E) | 5     | 7.13s     | 8.00s      | 15.13s    | **+7.13s**  |
| xiangling      | Pyro RES −15 (C1)        | Guoba (E)                 | 4     | 6.88s     | 6.00s      | 12.88s    | **+6.88s**  |
| traveler_anemo | Anemo RES −20 (C6)       | Gust Surge (Q)            | 9     | 4.00s     | 10.00s     | 14.00s    | **+4.00s**  |
| emilie         | Dendro RES −30 (C2)      | Lumidouce Case Lv3 (Q)    | 3     | 2.30s     | 10.00s     | 12.30s    | **+2.30s**  |
| sucrose        | team EM +20% (A4)        | Q Wind Spirit             | —     | —         | —          | —         | see note    |

⚓ **Every one of these is right to make tick-anchored, and the kit text says so
by NAME** — checked one at a time, not assumed: Sigewinne's C2 reads "after
Rebound Hydrotherapy's **Bolstering Bubblebalm** … hits an opponent"; Venti's
and Anemo Traveler's read "Targets who take DMG from **Wind's Grand Ode** /
**Gust Surge**"; Navia's names the burst whose Cannon Fire Support ticks are the
hits; Xiangling's curator note already records that her C1 fires on Guoba's hit
callbacks in gcsim. ⛔ None of these is a guess about intent.

### 7d. ⚠️⚠️ THE ONE REAL RISK, AND IT IS NOT THE ONE §3 PREDICTED

**Nicole's A4 Philokalia.** `source: 'team'`, no `abilityType`, no filter — the
only corpus effect that would newly fire off **every other character's** summon
ticks (43 of them leave a damaging summon). Her kit text:

> "When Elemental DMG from nearby **ACTIVE** party members hits an opponent,
> Nicole's own Grace of Kenosis effect is upgraded to Guidance of Theosis."

⚓⚓ **A summon tick is delivered by an ENTITY whose owner may be off field**, so
firing this off Oz while Fischl is benched contradicts the word "active". This
is exactly the distinction the mark-triggered round already built for
`onReaction.source` — `viaEntity`, and a `'active'` source that refuses an
entity-delivered offer — and **`onHit.source` has no `'active'` member**.

⛔ So the round needs that member before it can dispatch ticks into character
buff pools, or Nicole silently gains permanent uptime she should not have.
⚠️ She is the ONLY holder affected; every other Half-B effect is `source:
'self'` and scoped to its own summon.

## 8. ⏭ Revised shape

Two halves, and the census says they are **independently shippable and should
ship in this order**:

1. **Half B — tick hits reach character `onHit` buff/shred pools.** ✅ SHIPPED, §9. All the
   measured value (11 characters, +2.3s to +21s), a local change beside a branch
   that already does it for artifacts, and one prerequisite:
   `onHit.source: 'active'` for Nicole. ⚠️ Also fix the step-6c comment.
2. **Half A — tick hits reach the stack dispatchers.** ✅ SHIPPED, §10. Zero corpus effects
   change; one customer (Alyosha's Tugarin, which needs BOTH halves — Half B
   anchors the buff at the tick, Half A consumes the mark so it fires once at
   C0 rather than on every tick).

## 9. ✅ HALF B — SHIPPED 2026-08-31

`viaEntity` on `HitEvent` · `onHit.source: 'active'` · the summon-tick onHit pass
in `deriveBuffWindows` · Nicole re-authored · the step-6c comment corrected.

### What changed

1. **`HitEvent.viaEntity`** — set by finalize's step-6c synthesis, absent on
   every hit a character landed itself. ⚓ Same word and same meaning as
   `offerApplication`'s flag: one vocabulary for "the summon delivered this, and
   its owner may be off field".
2. **`Trigger.onHit.source` gained `'active'`**, and `onHitTriggerMatches`
   refuses a `viaEntity` hit for it. ⚠️ Every cast/normal/charged/plunge hit is
   the active character's by construction, so this ONE clause is the whole of
   the distinction.
3. **The summon-tick onHit pass** — rotation-wide per character
   (`firstTrackOfChar`, the artifact branch's guard and its reason: a summon
   ticks while its owner is off field, so track-scoping would cut the window at
   every swap). One window per tick with the block pass's refresh-merge.
   ⚓ It stamps the SAME `source` the cast pool does, so the tick windows land in
   the cast's row and `mergeRefreshedBars` fuses them at the projection.
   ⛔ Not by extending the cast window in place — that pool can also hold
   `onCast` effects, which a tick must not refresh.
4. **Nicole's A4** → `source: 'active'`. ⚓ Byte-identical today and authored
   anyway: she is the only corpus effect with `source: 'team'` and no
   ability-class filter, i.e. the only one a tick could reach indiscriminately.
5. **The step-6c comment** — see §7b. Corrected in place, with the lesson kept:
   a hit reaching `hitRecords` is not a hit reaching a CONSUMER, and that file
   cannot see which consumers select it.

### Measured

Corpus differential, `<name> E Q N1 C P E Q` at C0 and C6 over all 123
characters, before vs after:

- **19 windows added, 0 lost, 0 changed.** Purely additive.
- **10 characters affected** — emilie, escoffier, lauma, navia, rosaria,
  sigewinne, sucrose, traveler_anemo, venti, xiangling. Every other character is
  **byte-identical**. ⚓ That is 10 of the census's 11: the eleventh is Nicole,
  whose effect is self-target and therefore untouched by a team-surface pass —
  which is also why her `'active'` source is a forward guard rather than
  today's fix.
- **No new ROWS.** Row-level check: Xiangling C1 goes from one bar `0.22 →
6.22s` to one bar **`0.22 → 13.10s`**; Venti C6 `1.57 → 11.57s` → `1.57 →
19.37s`; Emilie C2 `0.27 → 10.27s` → `0.27 → 31.27s`.
- 🔒 **Seeded negative**: neutering the pass's tick selection returns the corpus
  dump to byte-identical with the baseline — so the 19 windows are this pass's
  doing and the other three changes are inert on their own.

⚠️ The measured ends run slightly LONGER than §7c's analytic table (Venti 19.37s
vs a predicted 17.80s) because that table walked the authored cadence against
the authored duration, and the parse applies spawn offsets and truncation.
⚓ The parse is the authority; the table was for pricing, not for asserting.

### ⏭ Still open — ✅ CLOSED 2026-08-31 BY §10. Everything below is the BEFORE.

**Half A** — zero corpus effects, one customer (Alyosha's Tugarin), and it
belongs on the LIVE tick chain in `sim/aura.ts`, not on the finalize synthesis.
⚠️ Alyosha needs both halves — B anchors the buff at the tick, A consumes the
mark so it fires once at C0 rather than on every maul.

⚠️⚠️ **AND IT IS NOT A WIRING JOB — IT NEEDS A CONTAINER DECISION FIRST**, found
while closing Half B and measured rather than reasoned. `stackState` and
`stackInstances` are declared INSIDE the per-segment loop (`sim/run.ts` ~:263,
inside the `for (… segments …)` at ~:152) and reset at every segment start. A
summon tick fires while its owner may be off field — that is the whole point of
Tugarin — i.e. during ANOTHER character's segment, where the owner has no live
stack map at all. There is nowhere for the tick's mutation to land.

⚓ The same defect is already visible in what Half B could not fix: Alyosha's
Hunter's Mark is a state on the ENEMY that lasts 15 s, but its container is
per-segment, so `Alyosha N4 > Fischl E > Alyosha E` draws no ATK bar where the
game gives one — and so does `Alyosha N4 > Alyosha E`, two segments of the same
character. Caveated on his skill; ⛔ not fixable by authoring.

So Half A's real first question is **where an enemy-side, rotation-wide resource
lives**. The one rotation-wide pool that exists — `CharState.sourceLifetime`,
`Map<key, Map<sourceCharId, expiry>>` — is shaped for a different mechanic
(per-SOURCE slots, refresh-on-same-source) and has **zero corpus authors**.
⛔ Don't wire the tick chain into the per-segment dispatchers and call it done:
that would fire a tick into a map that is either absent or belongs to whoever
happens to be on field.

⚠️ **The two surfaces this pass does NOT cover** are a measured omission, not a
partial job: the census found no active-target and no self-target onHit buff on
a character who leaves a ticking summon. ⛔ Re-run the census before adding
them; ⚓ and if one is ever added, Nicole's `'active'` source is what stops her
A4 riding every teammate's summon.

## 10. ✅ HALF A — SHIPPED 2026-08-31

`gainStacks.scope` · the live tick chain dispatches stacks · the tick's stack
snapshot · the active-target tick surface · Alyosha's Tugarin authored.

### 10a. ⚓⚓ The container decision (⚓ Nate)

**A stack key names a RESOURCE, and a resource either survives a swap or it does
not.** That is a property of the key, so it is DECLARED:
`gainStacks.scope: 'segment' | 'rotation'`, default `'segment'`, which is every
corpus key but one. A rotation-scoped key lives in `CharState.rotationStacks` /
`rotationStackInstances` and is MIRRORED into the live segment pool at every
settle point, so ⛔ not one existing reader changed — `cast.stackContext`,
`hit.stacks` and every `stacks` Condition keep reading the segment map. The scope
decides the container, never the reader.

⚠️⚠️ **It is a different axis from `trigger.source`, and conflating them is the
trap.** `source` says who may FIRE the effect — `'team'`/`'others'` grants
already accrue rotation-wide on `CharState.onHitStacks`, because the HOLDER may
be off field. `scope` says where the stacks THEMSELVES live. Hunter's Mark is
`source: 'self'` **and** rotation-scoped: it is a state on the OPPONENT. The two
containers are kept apart so neither field's name lies about its contents (an
`onCast` grant lives in the new one, which `onHitStacks` could not say), and lint
`gainstacks-scope-redundant` refuses `scope: 'rotation'` on a team/others grant
rather than letting one key have two homes.

⚓⚓ **And it is what makes the tick dispatch structural rather than remembered.**
The tick chain is handed a **NULL** segment pool, so a segment-scoped grant is
skipped BY CONSTRUCTION — there is nowhere for it to land, and `poolsFor`
returning `null` is the round's decision written down at the site. ⛔ Never hand
those dispatchers the on-field character's pool "so they work": that pool belongs
to whoever happens to be on field, which is exactly the bug §9 warned about.

⚠️ **Declare the scope on EVERY grant of the key** — ⛔ NOT the `drain`
convention of declaring once on the first. `drain` is a spec with values that
could drift; `scope` is one enum whose disagreement lint D.39
(`gainstacks-scope-disagreement`) catches outright, while its **omission** is
invisible and would silently revert the key to `'segment'` the day the declaring
effect is edited away.

### 10b. What else had to land, and why neither was optional

1. **The active-target tick surface** (`buffWindows.ts`). Half B covered the
   TEAM surface and said to re-run the census before adding the other two.
   Re-run: Hunter's Precision is `target: 'active'` ("all nearby party members …
   when they are on the field"), so without this pass a tick would CONSUME the
   mark and draw nothing — ⛔ strictly worse than not dispatching at all. The
   `target: 'self'` surface still has no author and still stays out.
   ⚓⚓ **The last track runs to Infinity here**, and this pass is the first that
   needed saying so: every other active-target site anchors at a CAST or a SWING,
   which is inside a track by construction, while a tick can land after the
   notation's last action — `Alyosha E Q` is 2.32 s long and Tugarin mauls until
   14.73 s. Clamping to the last track's `activeEnd` drew nothing at all. It is
   the same claim the existing `isLast ? buffEnd` clamp already makes.
2. **The tick's stack SNAPSHOT** (`ctx.tickStacks`, stamped by finalize's 6c).
   ⚠️⚠️ **A `stacks` Condition with no map is UNRESOLVABLE, not false**, and
   `deriveBuffWindows` drops only a definitive false — so an un-stamped tick hit
   hands out a permanent bar. Measured on the way: `Alyosha Q` at C0 drew
   Hunter's Precision off **every** maul with no mark to activate.
   ⚓ **An empty map and `undefined` are not the same answer.**
   `rotationStackSnapshot` returns an empty map for a holder who declares the key
   and holds none of it (`0 < min` ⇒ false, no bar) and `undefined` for a holder
   with no such key — which is what leaves every other summon in the corpus with
   the `stackContext` it already had. The join is
   `characterId::label::time`, the one `stateGatedTicks` already uses.

### 10c. The authoring — ⚓ the C0/C2 asymmetry is MODELLED, not approximated

- **`min: 1` below C2, `min: 2` at C2**, as two mutually-exclusive pairs (the
  Odette idiom). Both dispatch pipelines run **gains → snapshot → consumes**, so
  C2's own per-maul application is already counted when the buff reads the
  snapshot: at C2 "a mark existed before this maul" IS "the count reached 2",
  exactly as it is for the skill and N4 (§4's warning, answered).
- **The consume is `amount: 1`, not `'all'`** — the opposite of the skill's.
  Activation removes the one mark it activated; at C2 the same maul has just
  applied a fresh one, and `'all'` would wipe that too and halve the cadence.
- ⚠️ **The two-effect mutually-exclusive pattern is normally FORBIDDEN for a
  pair sharing a `stat`** (the active-target pass dedupes by stat and keeps
  whichever was authored first — the `activeCharFaction` trap). It is safe here
  only because the discriminator is a `constellation` condition, which resolves
  DEFINITIVELY in the pre-filter that runs _before_ the stat dedupe. ⛔ Don't
  copy the pattern with a discriminator that cannot resolve there.
- `filter.abilityName: 'Tugarin'` is load-bearing twice: it keeps the burst's own
  cast hit from activating (its abilityName is "Hunter's Advance"), and it names
  the summon the kit text names. ⚠️ The Fulgurite Hunting Field is deliberately
  not an activator (the clause sits inside Tugarin's bullet list) — and **no
  pixel turns on it**, because both summons tick on the same 2 s cadence from the
  same spawn.

### 10d. Measured

Corpus differential, `<name> E Q N1 C P E Q` **and**
`<name> E Q > Kaeya E N1 ~4s > <name> N1 N2 N3 N4 E Q`, at C0 and C6 over all
123 characters, before vs after:

- **45 windows added, 1 moved, and exactly ONE character touched.** The other
  122 are **byte-identical** at both levels and in both rotations.
- **Applications and IR events: 0 delta, everywhere.** Same finding as the
  constellation-gating round — this is a BARS-ONLY change, so no gauge-round
  measurement is contaminated.
- The engine change measured **byte-identical on its own**, before any authoring:
  all five corpus `onHit` stack effects are `normal`/`charged`-gated, exactly as
  §7a predicted.
- ⚠️ The one **moved** window is a real consequence and not a loss: at C0 an
  N4-anchored activation at 12.70 s becomes two maul-anchored ones at 10.73 s and
  12.73 s. Tugarin now consumes each mark as it lands, so the activation is
  attributed to the maul that actually caused it.
- Behaviour, checked case by case against the kit text: `Alyosha E Q` at C0 →
  ONE activation, at the first maul, 15 s. At C2 → every maul, continuous, ending
  15 s after the last. `Alyosha Q` at C0 → **nothing** (no mark to activate). At
  C2 → nothing on the first maul, every maul after. `Alyosha N4 > Fischl E >
Alyosha E` and `Alyosha N4 > Alyosha E` → the bar the skill's caveat said was
  missing. The projection fuses the per-tick windows into **one row, one bar**.

🔒 **`src/lib/sim/summonTickStacks.test.ts`**, seeded-negative verified — four
mutations, each going red where it should: the tick dispatch disabled (3), the
scope ignored so rotation keys write the segment pool (6), the active-target tick
pass neutered (3), the snapshot forced to `undefined` (3). ⚠️ Its stub pair
asserts the container decision at the DISPATCHER, with no notation involved: a
segment-scoped grant reached by a tick lands in **none** of the three pools.

⚠️ **Half B's sweep (`utils/summonTickBuffs.test.ts`) was NARROWED, not
relaxed.** It asserts a window whose SPAN exceeds its effect's duration, which is
the team surface's shape (one window extended in place). An active-target
activation is a per-RECEIVER slice — several windows of exactly the effect's
duration, fused at the projection — so Alyosha would have failed a true assertion
about the wrong shape. ⛔ Don't relax that span check to accommodate him; his
guard asserts the projected BAR instead.

### 10e. Two caveats retired, none added

The skill's ("the Hunter's Mark is dropped when you swap away") and the burst's
("Tugarin's attacks don't activate the Hunter's Mark here") both named pixels
that are now correct. ⚓ Nothing replaced them: on the NAME THE PIXEL test there
is no bar, marker or printed value left that is wrong here. C6's second-stack
caveat and C2's summon-length caveat are untouched.

### 10f. ⏭ What this unblocks and did NOT do

**Skirk's Serpent's Subtlety.** It is a meter on Skirk that survives a swap in
game, and the E3 v2 hand-off records the operational limit "structure E and Q in
a single segment — a cross-segment Q after E loses the SS carry".
`scope: 'rotation'` on its three `gainStacks` effects would retire that. ⛔ Kept
out of this round deliberately and flagged in Skirk's own curator notes: SS is
the corpus's one **drain**-bearing key, and `drainAnchors` is ALREADY
rotation-level while its pool is per-segment, so `applyDrain`'s
settle-after-state-ends regime has never had a resource to act on across a swap.
That interaction is unmeasured and wants its own before/after, not a ride-along.
⚠️ Re-check the burst's `consumeStacks: 'all'` and its fails-open `min: 51` gate
under the new scope before flipping it.
