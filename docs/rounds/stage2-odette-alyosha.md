# Stage 2 — Odette + Alyosha (2026-08-31)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Branch `curation/7.0-stage2-odette-alyosha`. The Stage-2 half of
`docs/rounds/reaction-conversion-model.md`'s open list. ⛔ Stage 4 stays blocked —
gcsim has nothing for either, so both keep FRAMELESS_EXEMPT and read as
"not yet curated".

## ⚠️⚠️ genshin-db's kit text is INCOMPLETE for both, in the load-bearing place

It never says what **Hunter's Mark** does (the skill description stops before
that paragraph) and never says what **Marvelous Splendor** does (the passive
says only "obtains 4 stacks"). Both live in **Fandom Extra Effect tooltips**,
reachable through the MediaWiki API — ⚓ `curl` works from Bash; WebFetch 403s
on prydwen. This is a second failure mode beside the positional `extraPassives`
split: ⛔ **never author a 7.x kit from genshin-db text alone.**

## ⚓⚓ A MARK CONSUMED BY RE-APPLICATION IS A STACK RESOURCE, AND THE GATE IS `min: 2`

Hunter's Mark: applying to an already-marked opponent ACTIVATES it (removing
the mark) and grants Hunter's Precision. Authored as `gainStacks` key
`huntersMark` (`lifetime: 15`, `max: 2`) + a buff gated on it +
`consumeStacks: 'all'`, on the E (`onCast`) and on N4 (`onHit`,
`filter.hitIndex: 3`).

⚠️⚠️ **The gate is `min: 2`, never `min: 1`.** Both dispatch pipelines run
**gains → stack snapshot → consumes** (`sim/run.ts` `handleCast` ~:544 and
`dispatchHit` ~:326), so THIS application is already counted when the buff
reads the snapshot. "A mark already existed" is therefore "the count reached 2".
⛔ Do not "fix" it to 1 — that grants on the first mark, which the game does not.

⚠️ `filter.hitIndex` on a FRAMELESS character reads the RAW normal counter (no
`hits[]` to modulo), and the counter resets on any non-normal action. So it
matches the first N-token and any N-token after an E/Q/C/P — but not a second
consecutive `N4 N4`. Degenerate notation; measured, not assumed.

## ⚠️ ONLY `summons[0]`'s durationModifiers REACH THE BAR

`getActiveDuration`/`getActiveDurationModifiers` read `summons[0]`; a secondary
summon takes its own authored `duration` **flat**. So a constellation that
extends a burst carrying TWO summons can only reach one of them. Alyosha's C2
(+6s) goes to Tugarin — summon order is authoring-significant — and the
Fulgurite Field's short bar at C2 is caveated. ⛔ Not fixable by authoring.

## ⏭ Two rounds specced and NOT started

- ✅ **`docs/curation/polestar-field-round.md` SHIPPED 2026-09-01 — see
  `docs/curation/polestar-field-round.md`.** ⚓ Nate's split (entity in the aura area, buffs in
  the team lane) is the LAYERS LAW; the ledger needed no `BuffValue` form because
  the field is its own producer; **Cryo Traveler needs no mirror**. The rest of
  this bullet is the BEFORE. ⚠️⚠️ the entity is a **Starlight
  Prism** and it is **7s, not 6s**, and there are TWO clocks (the Prism's 7s and
  the "every 4s the count is reset, buffs lasting 4s are granted" cycle, which
  is what the corpus already draws). Needs a non-cast window producer, a lane
  for something that belongs to no character (⚓ which moves the bench),
  replace-not-extend refresh, a `BuffWindowSource` arm, and a schema home for
  reaction-level data. ⚓ **Do it WITH the hit ledger or not at all** — Nate's
  2026-07-29 "unmodelable" ruling predates the gauge, and "hits that apply an
  element as limited by ICD" is now answerable; what is missing is a
  `BuffValue` recomputed per window. Until then each enabler carries a MIRROR
  of the three field effects (Sandrone, Odette, and Cryo Traveler next) —
  a stand-in, ⛔ not a second source.
- ✅ **`docs/rounds/summon-tick-stacks-round.md` — BOTH HALVES SHIPPED 2026-08-31, see
  `docs/rounds/summon-tick-stacks-round.md`.** ⚠️⚠️ Its census found the blast radius here is
  **ZERO** (five onHit stack effects corpus-wide, all N/CA/P-gated) — and Half A
  needed a CONTAINER decision, not wiring: 🆕 `gainStacks.scope: 'rotation'` is
  the answer, so Alyosha's mark now survives a swap and Tugarin's maul activates
  it. **Both of his caveats are retired.** ⛔ **This bullet used to warn about a
  corpus-wide blast radius; that was measured FALSE** — do not reinstate it.
  ⚠️ The `min: 2` rule below still stands and the burst adds a sibling to it:
  `min: 1` below C2 and `min: 2` at C2, because C2's per-maul application is
  itself counted in the gains → snapshot → consumes order.

## ⚠️⚠️ ALYOSHA'S TWO BURST SUMMONS TICK IDENTICALLY, AND BOTH APPLY

Found 2026-09-01 while chasing a Polestar Field count that read high. His burst
carries **two** summons — Tugarin and the Fulgurite Hunting Field — each with a
`damage` tick on the SAME 2s interval and neither authored an `icdGate`. So both
apply Electro on the same frames, and the gauge receives two applications at one
instant.

⚓ **Legitimate under our model**: a summon's ICD counter is its own
(`${char}:summon:${label}:${index}`), so two entities hitting together each
apply. ⚠️ Whether the GAME does that is unanswerable today — gcsim has nothing
for him, which is why both series are deliberately bare.

⚠️ It is visible on screen as a pill that hides another (the two applications
draw at one x and never separate at any zoom), which is what
`docs/curation/polestar-field-round.md` §12 added `AuraTick.sameFrame` for. ⏭ **When gcsim
ships frames for him, check whether the two series are OFFSET** — if they are,
the applications separate and this stops being a coincidence at all.

## Smaller rulings worth keeping

- ⚓ **Odette's Coda is a state-conditioned SIBLING ABILITY, not a variant**
  (Durin's Transmutation pattern): a variant shares the base skill's charge
  queue, so the base's own 15s CD — started by the cast that opens the 6s
  window — would block the Coda for the whole window. New State member
  `codaWindow`, opened by BOTH her E and her Q.
- ⚓ **Marvelous Splendor is FOUR gainStacks effects**, on mutually-exclusive
  constellation branches (4/max 4 below C1, 6/max 6 at C1). The stacks are SET
  on each summon and there is no set-form: `constellationScaling` would clamp
  C1 back to 4, and a single `max: 6` would let an E→Q chain reach 6 at C0.
  ⚠️ ONE drain spec per key, so C1's 2/s and C6's no-decay are unmodelled — and
  ⚠️ NOT a caveat, because `perStack` reads a cast-time snapshot, so no printed
  value or bar length changes.
- ⛔ **`BuffEffect.stacks` {maxStacks, durationModel} has NO consumer** — the
  only `maxStacks` reader is the `perStack` BuffValue. Authoring it renders
  nothing. Alyosha's C6 two-stack doubling is a caveat instead, and
  ⛔ `constellationScaling` was rejected for it too (it draws the bar but prints
  the BASE value — the presence-vs-reachability trap).
- ⚓ Odette's A4 Pathetique is `offset`'s **eighth** holder, as its census
  predicted. ⚠️ Nate's bucket call: Fandom says it raises the Base DMG
  MULTIPLIER and is explicitly **not** a Reaction Base DMG Bonus — a bucket with
  no Stat key — so it is authored on the closest bracket
  (`stellarGlimmerDmgBonus`) with the divergence in `_curatorNotes`, rather than
  minting a key for one holder.
- ⚠️ The wiki capability snapshot is **2026-07-28** and predates 7.0 — it has no
  Sandrone either. The sweep's "we derive it, the wiki doesn't list it" rows for
  these two are snapshot staleness, ⛔ not over-derivation.
