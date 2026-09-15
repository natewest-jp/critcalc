# The Radiance-window round — scope (2026-09-15)

_Status: SPEC, not started. Scoped at Nate's request after the gcsim sync round
landed the Cryo Traveler's crystal cadence. ⚠️ §0–§6 are the plan; when the round
ships, its record wins where they disagree._

## 0. The question

Nate, 2026-09-15: _"If there is a Polestar Field present, the E is converted to a
Cryo infusion instead of the crystal attacks. Is it possible to have his E display
differently depending on whether a Polestar Field window is open?"_

The kit does two things inside a Polestar Field (the **Radiance: Stellar-Conduct**
state, which gcsim defines as exactly `StatusIsActive(PolestarFieldKey)`), and
neither replaces the other:

1. **Ever-Keen Frost (A1):** while a Frostpierce Star is on the field, his Normal,
   Charged and Plunging attacks become Cryo (an infusion no other infusion can
   override) and gain +80% ATK.
2. **Ice Fog Piercer (E):** the Star stops firing crystals on its 3s interval and
   instead fires ONE crystal per hit he lands with those attacks, once per 0.2s.
   The crystals do not stop — they change trigger — and they still build
   Frostglow.

Outside a field neither applies. So the answer to the first half is "two things,
not a conversion", and the answer to the second half is **yes**: the parse already
knows when a Prism is open (it draws one in the aura header's gadget strip, 7s
life, refresh REPLACES), and everything below is wiring that knowledge into three
consumers.

## 1. What is drawn today, and why it is wrong for him

- **The infusion** is an `infuse` effect on the skill cast, 12s (the Star's
  lifetime), gated on a STANDING condition: `teamEnablesReaction: stellarConduct`
  AND an Electro teammate. He is himself an enabler, so the Electro count does
  all the work — and with an Electro teammate his swing blocks paint Cryo for
  the whole Star whether or not a field exists. ⚠️ This is the open item the
  Polestar round left: _"Radiance is still a STANDING condition while the Prism
  is a window (⚓ Nate's call, not taken here)"_ (`docs/curation/polestar-field-round.md` §12).
- **The Star's crystals** always draw on the 3s interval (`summonTick`, two
  series at 1.25s/1.3s), inside or outside a field.
- **The per-hit crystal** is not authored. The prior blocker (no application
  frame) is gone: the draft PR's `naCaPlungeCB` queues the crystal 3f after the
  hit, and our aimed-shot policy already pins travel to 0, so `frame: 3` is the
  policy-consistent reading.

For him specifically the two branches SWAP behaviour, which is why the standing
gate misleads: a reader with a Fischl on the bench sees a fully infused Traveler
and a Star ticking every 3s, while in play the infusion and the per-hit crystals
only exist for the 7s after each Stellar-Conduct.

## 2. The one decision that is Nate's

**Radiance becomes a WINDOW in the planner and stays a STANDING condition in the
Team Builder.**

- The planner has a timeline and a gauge; it can answer "is a Prism open at this
  instant" from the reaction stream it already produced. Every Radiance holder —
  Qiqi, Diona (C6), Odette (C2/C6), Yae (A1/C1), Wriothesley, Sandrone, Cyno,
  Mizuki, Beidou — could eventually take the window form; this round changes ONLY
  the Traveler and introduces the vocabulary.
- The Team Builder has no timeline. Its derivation must keep answering with the
  standing gate (an enabler plus the element that can react), and a window
  condition reaches it as a RUNTIME CAVEAT the way `state:` and `stacks:` do
  today (`deriveCapabilities.ts` `caveatLabel`). ⛔ Never make the TB try to
  resolve a window.
- ⚠️ The chicken-and-egg is real and is the showcase: the first field needs a
  Stellar-Conduct, which needs the Star's INTERVAL crystals to apply Cryo onto an
  Electro aura (or vice-versa). Then the field opens, his swings infuse and
  crystal, those apply Cryo, the next Conduct refreshes the field. The live gauge
  already produces every link of that chain; the round only stops us drawing the
  second half of it before the first has happened.

## 3. The engine change — one condition, three consumers

### 3.1 `{ type: 'inPolestarField' }` — an instant condition

A new `Condition` leaf, resolved at an INSTANT: true iff a `stellarConduct`
reaction event fired within `PRISM_LIFETIME_F` (7s) before `time`. ⚓ Refresh
REPLACES (the field round's ruling), so "the last conduct within 7s" is the whole
rule — the same `mergePresences` walk `fields.ts` runs at finalize, asked at a
point instead of over the stream.

- Where the data is: reactions are pushed LIVE to `ctx.events` by `aura.ts`
  (`kind: 'reaction'`), so a mid-parse query is answerable; at finalize the
  same stream builds the Prism windows. ONE reader for both: a `fieldOpenAt(time)`
  helper in `fields.ts`, ⛔ never a second copy of the lifetime constant.
- `evalCondition` returns **null (unresolvable) unless the context carries a
  `fieldAt` lookup**; with it, true/false. ⚠️ `enemyAffectedBy` is the
  precedent for a gauge-state leaf and its comment ("planner cannot simulate
  aura state at action time") is STALE since L5 — this round should not "fix"
  it in passing, but the doc should say so.
- Lint: the leaf may appear only under an effect whose holder is a Stellar
  enabler or a Radiance holder (`enablesReactions` or a note naming Radiance);
  elsewhere it is a copy-paste error.
- TB: `caveatLabel` → `needsField:polestar`; derivation treats null as
  optimistic-with-caveat, as for `state:`. ⚠️ Keep the STANDING gate on the same
  effect as the field leaf (`all` of both) so the TB still narrows by enabler and
  element; the field leaf only narrows the planner further.

### 3.2 Consumer A — the interval series pauses while a field is open

Author `conditions: { type: 'not', condition: { type: 'inPolestarField' } }` on
BOTH crystal series. Today a series-level condition is evaluated ONCE per window
(`summonTickSeries` drops a definitive false); this leaf must be evaluated PER
TICK, at the tick's own instant.

- `collectSummonTicks` walks the ticks at finalize with the reaction stream
  complete → pass `fieldAt` in its `ConditionContext` and skip a tick whose
  condition is definitively false at that instant. ⚠️⚠️ **Both readers must
  honour it** (`run.ts` forbids unifying them): the live chain in `aura.ts` asks
  the same question at fire time — the clock is monotonic and a conduct at T is
  known when the tick at T fires, so the two cannot disagree. Seeded-negative
  test: gate only one reader and the tick markers stop matching the applications.
- ⚠️ gcsim keeps the TICKER running and skips only the attack
  (`skillTicker`: `if radiance != conduct { queueCrystal }` then re-queues), so
  when the field closes the next crystal lands on the ORIGINAL cadence, not 3s
  after the close. Pausing the tick, not resetting the series, is the correct
  reading and is what "skip a tick" gives for free.
- What the reader sees: the Star's bar unchanged; its pill markers absent under
  every Prism window in the header above it.

### 3.3 Consumer B — the per-hit crystal, gated on the field

Author on the Star (summon-hosted, armed by the Star's liveness): a `damage`
effect, `trigger: { type: 'onHit', abilityType: ['normal','charged','plunge'],
source: 'self' }`, `procCooldown: 0.2`, `application: [{ frame: 3, element:
'cryo', units: 1 }]`, `conditions: { type: 'inPolestarField' }`, plus the
`gainStacks` mirror so Frostglow accrues from it too (the Alyosha pattern, same
key, same scope).

- `sim/procs.ts` already dispatches summon-hosted `onHit` procs
  (`armSummonProcs`, keyed by tick); `onHitTriggerMatches` already honours
  `source: 'self'` + `abilityType`. ⚓ The only new piece is evaluating the
  proc's `conditions` with `fieldAt` at the OFFER instant. ⚠️ "A listener never
  fires off its OWN output" already bounds the loop (a crystal is `skill`, not
  `normal`).
- ICD: the per-hit crystal is `ICDTagElementalArt / Default` in the draft — the
  same standard counter as the interval crystals (`queueCrystal` is one
  function), so the proc shares the Star's counter. ⚠️ Check `procs.ts` keys
  the counter by `holder::host::index`, not by effect object (the Fischl lesson).
- The sim publishes the markers (`TimelineWindow.ticks`), the projection does
  not guess them — exactly the coordinated-attack round's shape.
- What the reader sees: crystal markers riding his swings inside a Prism window;
  none outside.

### 3.4 Consumer C — the infusion evaluates at the SWING

Add `{ type: 'inPolestarField' }` to Ever-Keen Frost's condition tree (keeping
the standing gate in the same `all`). Today `infusionAt` re-evaluates a window's
tree at the swing with exactly two facts (holder constellation, receiver weapon)
and keeps null; it gains a third fact, `fieldAt(time)`, and the leaf resolves
definitively at each swing.

- ⚠️⚠️ **Infusion resolves once per TOKEN**, and the swing block carries ONE
  element (`finalize.ts` ~line 120: _"if infusion ever resolves per swing, a
  block can no longer carry one element and this is the site that has to say
  so"_). A field opening mid-`N5` means a block whose first swings are physical
  and last are Cryo. Two options, decide in-round: (a) resolve per SWING and
  split the block at the first swing whose element differs (the Furina
  `lineupChanges` precedent — the parse records the instant, finalize cuts on
  it); (b) keep per-token resolution and accept a one-token lag, stated in the
  caveat. (a) is honest and is the recommendation; (b) is a fallback if the
  block split touches the PNG export too widely.
- The infusion draws NO bar of its own — it is the swing block's colour
  (`elemental-normal`) — so nothing in the buff rows changes.
- What the reader sees: his swing blocks Cryo only inside Prism windows.

### 3.5 Out of scope, stated so nobody reaches for them

- Radiance: Stellar SWIRL (8s after a Stellar Swirl) — it changes only his
  burst's damage TYPE; nothing on screen.
- The +80% ATK on infused swings and the burst multipliers — damage numbers.
- The other Radiance holders — the vocabulary lands; migrating their standing
  gates is a later, per-character decision (each needs its own reading of "what
  changes on screen").
- Making `enemyAffectedBy` resolvable off the gauge — same shape, different
  round.

## 4. Data changes (traveler_cryo.json only)

| where                             | change                                                                  |
| --------------------------------- | ----------------------------------------------------------------------- |
| skill summon, both crystal series | `conditions: not(inPolestarField)`                                      |
| skill summon, new effect          | per-hit crystal proc (§3.3) + Frostglow `gainStacks` from it            |
| passive Ever-Keen Frost           | `all(standing gate, inPolestarField)`                                   |
| skill caveat                      | rewrite: names the two behaviours and the field                         |
| C2                                | unchanged — it keys on ice-crystal HITS, and both branches produce them |

## 5. Verification

- Probe (measure, do not reason): `Cryo Traveler E > Fischl E N3 > Cryo Traveler N5 N5`
  with an Electro applier — expect interval crystals until the first Conduct,
  then a Prism window in which the interval markers are absent, crystal markers
  ride his swings, and his swing blocks are Cryo; after the Prism lapses, the
  interval resumes on the ORIGINAL phase. Without Fischl: no field ever opens,
  everything stays on the interval, no infusion. ⚓ The differential is the
  proof, as it was for Ever-Keen Frost's first landing.
- Corpus: every other character byte-identical at C0 and C6 (the leaf exists on
  one character).
- Seeded negatives: gate one tick reader only; drop `fieldAt` from
  `infusionAt`'s context; key the proc counter by effect object.
- Guards worth proposing (Nate approves promotions): a `fields.test.ts` case for
  `fieldOpenAt` against `mergePresences`; a `summonTickStacks`-style case for
  the paused series. ⛔ No new spec file without approval.
- Gates: vitest / check / lint / build per round; e2e before merge.

## 6. Order of work

1. `inPolestarField` leaf + `fieldOpenAt` + lint + TB caveat label (byte-identical corpus).
2. Consumer A (both tick readers) — measured on the probe.
3. Consumer B (the proc) — measured.
4. Consumer C (the infusion) — decide (a)/(b) on the block split; measured.
5. Caveat rewrite, notes, record in this file's §7, CLAUDE.md entry, memory.
