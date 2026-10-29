# Autonomous Loop Queue (Cluster C — 2026-05-14)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

## How to use this file

Same posture as `docs/rounds/manual-trigger-retirement-round.md`:

- Pick first PENDING item, ship per `feedback_loop_autonomy.md`, commit on `main`, update status to `SHIPPED` with SHA + date inline. Pause and escalate on the listed pause signals; status → `PAUSED`.
- Tests + lint per primitive; `npm test` + `npm run check` before each commit.
- Commit per item; primitive + direct migration may share a commit (Wave 2 Item 1 pattern).
- All three items extend the canonical-assumption thread settled 2026-05-14: visualize decision-relevant mechanics by "faking" the assumed value with explicit user notification, instead of either silently hardcoding (current Mavuika pattern) OR leaving as stub-with-caveat (current Wave-2 pattern).

## Queue

### Item 1 — `canonicalAssumption` primitive + Nahida Awakening Elucidated + Compassion Illuminated [SHIPPED 2026-05-14 · 9f0a95d]

**Goal:** New optional field on BuffEffect (and applicable Effect types) that marks a buff's display value as a canonical-rotation assumption. The mechanic-faithful formula stays in `value`; the renderer favors `canonicalAssumption.headlineValue` for display + surfaces the `caveat`. Migration cost: zero when a real primitive eventually resolves the input — the canonicalAssumption block deletes and the formula takes over cleanly.

**Schema:**

```ts
canonicalAssumption?: {
  /** The value to render as the headline buff display, expressed in the
   *  same units the host stat uses. For Nahida Awakening Elucidated: 80
   *  (= +80% Pyro/Hydro/Electro/Dendro DmgBonus to active char,
   *  the cap reached at Nahida built to 1000 EM). */
  headlineValue: number;
  /** User-facing explanation of the assumption — surfaced via the
   *  ability caveat panel and (TBD) inline near the bar. */
  caveat: string;
}
```

**Renderer:** Extend `formatBuffDisplayValue` in `RotationTimeline.svelte` to check for `canonicalAssumption.headlineValue` BEFORE falling back to formula computation. When present, the headline shows `+{value}% {stat}` directly. The underlying `value` (scaling/perStack) becomes secondary — surfaced in tooltip / details only.

Visual differentiation deferred to the broader "null-resolving-condition bar" design pass (per `docs/rounds/launch-roadmap.md` L3). For v1, the bar renders normally; the `caveat` carries the "this is assumed" framing via the existing caveat panel. Future design pass will pick this up consistently with stub-with-caveat bars and null-resolving-condition bars.

**Lint:** `buff-canonical-assumption-headline-invalid` (positive finite number when present), `buff-canonical-assumption-caveat-invalid` (non-empty string when present), `buff-canonical-assumption-shape-invalid` (both fields required together — having only one is a transcription error).

**Migrations:**

- **Nahida Awakening Elucidated (A1)** — currently authored... need to check. Likely a buff effect scaling on `em` with cap. Migrate to add `canonicalAssumption: { headlineValue: 80, caveat: "Assumes Nahida built to 1000+ EM (canonical Dendro investment); +0.1% Elemental DMG Bonus per EM point above 200, capped at +80%." }`. Preserve the `scaling` formula in `value`.
- **Nahida Compassion Illuminated (A4)** — same shape. CR for Nahida scaling on max team-member EM, capped. Migrate to `canonicalAssumption: { headlineValue: 24, caveat: "Assumes Nahida (or any teammate) built to 1000+ EM; +0.03% CR per EM point of the highest-EM teammate above 200, capped at +24% CR." }`. In canonical play Nahida is the highest-EM character so this also maxes.

Verify the exact numbers + scaling-stat shape against gcsim / wiki before authoring. Awakening Elucidated's cap might be expressed as `80%` per element, not `80%` flat; double-check the stat key.

**Tests:**

- Lint tests covering the 3 new strict checks (headline-invalid, caveat-invalid, shape-invalid + valid Nahida shape).
- Renderer test: `formatBuffDisplayValue` returns the canonicalAssumption headline string when the field is set; falls back to formula when absent. (Or simpler: snapshot-style test on a synthetic effect.)

**Pause signals:**

- If Nahida's existing authoring already has a different shape (e.g. `value: { type: 'unknown' }` with description-only fallback), surface the structural delta before migrating.
- If the cap-rendering pass from `72489c4` already covers Nahida's display in a way that obviates `canonicalAssumption` — i.e. the cap suffix `(cap 80)` is sufficient user notification — surface and discuss whether the new primitive earns its place. Likely answer: yes, because the cap suffix is "the formula could reach 80" while canonicalAssumption is "the formula IS at 80 in canonical play" — different semantic.

---

### Item 2 — Cross-char onReaction dispatch + Neuvillette A1 Past Draconic Glories [SHIPPED 2026-05-14 · 5f6a83d]

**Status:** Reaction-filter side unblocked 2026-05-14. Shape A landed at `ab87119` (composite Reaction keys + 7 consumer migrations); Neuvillette A1's `reaction: ['vaporize', 'frozen', 'electroCharged', 'bloom', 'hydroSwirl', 'hydroCrystallize', 'lunarCrystallize']` is now expressible. Three architectural pieces remain before Neuvillette A1 can be authored end-to-end.

### Cold-start brief for the next session

**What's already shipped (don't re-do):**

- Shape A composite Reaction keys (`pyroSwirl`/`hydroSwirl`/`cryoSwirl`/`electroSwirl` + 4 crystallize variants; `lunarCrystallize` unchanged). `'swirl'` and `'crystallize'` are NO LONGER in the Reaction union — any code that references them will fail type-check.
- `computeReactionsForCast` (`notationParser.ts:~1093`) emits the element-tagged variants based on consumed aura.
- 7 consumer migrations: VV 4pc, Kazuha A4 (now element-specific per-buff, more accurate than before), Sucrose A4, Mizuki A1 + C1, Varka, Illuga, Columbina. Yun Jin C4 curator note refreshed (effect still unauthored).
- `canonicalAssumption` BuffEffect field shipped at `9f0a95d` (Item 1) — generally useful, but Neuvillette A1 likely doesn't use it (see "Why not canonicalAssumption" below).
- `teamElementCount` Condition variant shipped at `d0ccbf4` (Item 3) — relevant only as a precedent for the per-holder context-threading pattern.

**Three architectural pieces remaining for Item 2:**

**Piece 1 — Cross-char dispatch in `dispatchGainStacksOnReaction`.**
Current implementation (`notationParser.ts:1251`) walks only the casting character's effects. For Neuvillette A1's `source: 'team'` to actually fire when Furina/Yelan trigger reactions while Neuvillette is off-field, the dispatcher must iterate ALL team characters and apply the `source` filter at the inner loop.

Precedent: `dispatchGainStacksOnHit` (`notationParser.ts:1313`) — Skirk A4 v0.8. Same pattern: walks `allChars`, source filter applies `'self'` / `'team'` / `'others'`. Mirror this for the onReaction variant.

Signature change required:

```ts
// BEFORE (single-char):
dispatchGainStacksOnReaction(char, emittedReaction, castTime, resolvedStates, ...)

// AFTER (team-walk, mirroring dispatchGainStacksOnHit):
dispatchGainStacksOnReaction(
  allChars,
  triggerCharId,           // who emitted the reaction (for source filter)
  emittedReaction,
  castTime,
  resolvedStatesByHolder,  // Map<holderId, ReadonlySet<string>>
  constellationByHolder,   // Map<holderId, number>
  ...
)
```

Single caller in `emitReactionsAtCast` (`notationParser.ts:~2003`) — update to pass team-wide state maps.

**Piece 2 — Rotation-wide stack state for off-field accrual.**
`stackState` is currently per-segment per-char. Neuvillette accrues stacks during teammates' segments (when Neuvillette is off-field, his stackState doesn't exist in the current segment's scope). Need a rotation-wide accumulator.

Precedent: `sourceLifetimeState: Map<holder, Map<key, Map<source, expiry>>>` (`notationParser.ts:~1467`) — Skirk A4 v0.8. Persists across segments. Same shape for Neuvillette: maintain `onReactionStackState: Map<holder, Map<key, number>>` and `onReactionStackInstances: Map<holder, Map<key, number[]>>` for lifetime tracking, both rotation-wide.

At each segment start, sync the rotation-wide stack count into the per-segment `stackState` so existing `stacks` Condition resolution works unchanged. Mirror the `syncSourceLifetimeToStackState` (`notationParser.ts:~1364`) pattern.

**Piece 3 — Thread `stackInstances` for lifetime support.**
Originally the only piece the queue anticipated. Once Pieces 1 + 2 are in place, this is mechanical — when an onReaction gainStacks effect declares `lifetime`, push instances at `castTime + lifetime` to the holder's `onReactionStackInstances` map; `applyLifetimeExpiry` (or a parallel onReaction variant) drops expired entries at the next cast. Saturation drops oldest first when `instances.length > max`. Mirror the existing onCast lifetime path in `dispatchGainStacks` (`notationParser.ts:~872`, lifetime branch).

### Neuvillette A1 authoring (post-Pieces 1-3)

Add to Neuvillette's existing passive `heir_to_the_ancient_seas_authority` (currently has only curator notes, no effects):

```jsonc
{
  "type": "gainStacks",
  "target": "self",
  "trigger": {
    "type": "onReaction",
    "source": "team",
    "reaction": ["vaporize", "frozen", "electroCharged", "bloom",
                 "hydroSwirl", "hydroCrystallize", "lunarCrystallize"]
  },
  "key": "pastDraconicGlories",
  "amount": 1,
  "max": 3,
  "lifetime": 30
}

// Per-tier chargeDmgBonus buffs (×1.1 / ×1.25 / ×1.6 →
// additive +10 / +25 / +60 chargeDmgBonus in standard damage formula):
{ "type": "buff", "target": "self",
  "trigger": { "type": "passive" },
  "conditions": { "type": "stacks", "key": "pastDraconicGlories", "min": 1, "max": 1 },
  "source": "character", "stat": "chargeDmgBonus", "value": 10,
  "snapshottable": false }
// ... tier 2: +25 at stacks=2; tier 3: +60 at stacks=3
```

Notes:

- `source: 'team'` includes Neuvillette himself per in-game text ("When a party member triggers...").
- The 8th reaction listed in the in-game text (`lunarBloom`) is in the schema but only emitted in 2-Moonsign-team Hydro+Dendro contexts. Include in the array if relevant; verify against gcsim.
- 8th reaction `lunarCharged` is in the schema and emitted in 2-Moonsign Hydro+Electro contexts. Same note.

### Why not canonicalAssumption?

Considered during the 2026-05-14 session: author Neuvillette A1 as a fixed `canonicalAssumption` tier-3 buff (skip the dispatch work). Audit found this DOESN'T cleanly fit:

- Past Draconic Glories stacks are per-reaction-type (each reaction type contributes 1 stack with its own 30s timer). Canonical max-tier (3 stacks) requires 3+ distinct reaction types active simultaneously.
- Canonical Neuvillette comps span variable tier-resolution: Freeze (Furina+Citlali+Zhongli) → 1 reaction type sustained (frozen) → tier 1; Hydro-mono → 0-1 reaction types → tier 0-1; Taser-shape (Furina+Fischl+Yelan) → multiple → tier 2-3.
- No single canonical tier — fidelity to "the buff is at canonical max" can't be claimed honestly.

The dispatch is the right answer.

### Tests to add

- Parser: synthetic team Neuvillette + hydro-applier + anemo-swirler. Reactions accrue stacks across segments while Neuvillette is off-field; tier-N buff fires when Neuvillette swaps in.
- Parser: `lifetime: 30` correctly drops stacks 30s after grant.
- Parser: `source: 'self'` correctly excludes teammate reactions when set.
- Parser: `source: 'team'` includes the holder's own reactions.

### Test baseline + repo state at hand-off

Working tree clean on `main` at `ab87119`. 348 tests pass; type-check green. The 6 Wave-3 expected commits:

```
ab87119 feat(schema,parser,curation): Shape A — element-tagged swirl/crystallize reactions
d0ccbf4 feat(schema,renderer,lint,curation): teamElementCount Condition + Skirk A4 migration
9f0a95d feat(schema,renderer,lint,curation): canonicalAssumption + Nahida A1/A4
```

### Pause signals for next session

- If `sourceLifetimeState` pattern doesn't quite fit (it was designed for per-source slot tracking on hit events; onReaction is per-reaction accrual without source-uniqueness), surface and reconsider. The simpler shape is just `Map<holder, Map<key, number>>` without per-source tracking — sufficient for Neuvillette since lifetime governs expiry, not source-uniqueness.
- If `dispatchGainStacksOnHit`'s existing test coverage relies on the single-char signature, those tests still pass since they're synthetic stubs — but the parser-wide refactor surface is meaningful. Plan to surface any signature-cascade impact when threading the new state.
- If multiple new tests are needed to validate cross-segment accrual + cross-segment expiry independently, factor them so each piece has its own focused parser test.

---

### Item 3 — `teamElementCount` Condition primitive + Skirk A4 migration [SHIPPED 2026-05-14 · d0ccbf4]

**Goal:** Replace Skirk A4's live per-cast dispatch (v0.8 `sourceLifetime` over the HitEvent stream) with a canonical team-composition computation. New Condition variant counts non-holder team members with element ∈ {set} and resolves at planner time. The existing per-tier buff effects re-gate from `stacks` to `teamElementCount`.

**Why drop the v0.8 dispatch?** Two reasons: (1) canonical play (Skirk + Cryo support + Hydro support) always reaches max tier, but the v0.8 dispatch makes tier-3 emerge only after teammates have cast — meaning the first few seconds of Skirk's burst window under-render the bonus. (2) Per-hit NA fidelity isn't modeled in v0.8 anyway (only per-cast), so the live dispatch's precision is already half-truth; the canonical assumption is a cleaner story for the user.

**Schema:**

```ts
| {
    /** Resolves to true when the count of non-holder team members whose
     *  character.element is in `elements` satisfies `comparison`. */
    type: 'teamElementCount';
    elements: Element[];  // restricted to character-assignable elements
    /** Standard comparison op against the count. */
    comparison: '>=' | '=' | '<=';
    value: number;
  }
```

Resolves definitively at planner time (`evalCondition`) since team composition is fully known. Mirrors the existing `teamFaction` Condition (which resolves the same way but against `factions`).

**Parser:** Extend `evalCondition` to handle the new variant. Compute the count from `teamChars` (already available in the parser scope; computed at the top of `parseNotation`). The `excludeSelf` semantic is implicit — when evaluated for character X, X is excluded from the count automatically.

Wait — `teamChars` includes ALL team members. To exclude the current holder, the evaluator needs the holder's id. Check `evalCondition`'s existing signature — it's already threaded with the holder via `ConditionContext` for `activeCharFaction`. Use the same hook.

**Lint:** `condition-team-element-count-elements-invalid` (non-empty Element array), `condition-team-element-count-value-invalid` (non-negative integer), `condition-team-element-count-comparison-invalid`.

**Skirk A4 authoring change:**

DROP:

- The 2 gainStacks effects (Cryo source='others', Hydro source='team' — both target `deathsCrossing` key).
- The current per-tier buffs gated on `stacks: deathsCrossing` for tiers 1/2/3.

REPLACE with three per-tier buffs gated on the new condition. For NA buffs (using prior +10/+20/+70 normalDmgBonus authoring, gated on inStance + exact tier):

```jsonc
// Tier 1: ≥1 eligible teammate
{ ..., "conditions": {
    "type": "all",
    "conditions": [
      { "type": "state", "state": "inStance" },
      { "type": "ascension", "min": 4 },
      { "type": "teamElementCount",
        "elements": ["cryo", "hydro"], "comparison": "=", "value": 1 }
    ]
  },
  "stat": "normalDmgBonus", "value": 10, ... }
// Tier 2 / Tier 3 mirror with comparison value 2 / 3 (or =3 → tier 3,
// with the "=" comparison ensuring only-one-tier-fires-at-a-time)
```

Same shape for burst-tier (+5/+15/+60 burstDmgBonus) and C4 atk% (+10/+20/+40).

Keep the existing per-tier buff effects' duration/trigger shapes — they fire on the same E/Q casts as before, just with team-comp-based gating instead of stacks-based.

**Add canonicalAssumption (from Item 1) to the tier-3 buff** to mark the canonical-team-assumption framing:

```
"canonicalAssumption": {
  "headlineValue": 70,
  "caveat": "Assumes a canonical Skirk team with 3 non-Skirk Cryo or Hydro members (e.g. Escoffier, Furina, Citlali). With fewer eligible teammates, lower-tier buffs (+10% / +20%) apply instead — each tier-specific buff resolves independently from team composition."
}
```

**Tests:**

- evalCondition tests: teamElementCount with 0/1/2/3 eligible teammates × `=` / `>=` / `<=` comparisons; excludeSelf semantic.
- Parser test: synthetic Skirk + 3 Cryo teammates → tier-3 buff fires (`normalDmgBonus +70`); with 1 Cryo teammate → tier-1 buff fires.
- Lint tests for the 3 new rules.

**Pause signals:**

- If `ConditionContext` doesn't currently thread holder-id (`activeCharFaction` may use a different routing for "active" vs "holder"), surface the integration question. May need a new context field.
- If the comparison-op exhaustiveness creates lint complexity (e.g. is `value=0` valid for `=` ?), surface and ask. Default: allow but document the corner case (zero-teammates explicitly).
- If the existing v0.8 `dispatchGainStacksOnHit` test coverage relies on Skirk specifically, the test rewrite is part of this work — refactor those tests to verify the new gating path. Don't just delete the v0.8 tests.

---

## Status log

- 2026-05-14: Queue file created. 3 items PENDING. Tests baseline: 333 passing on `main` at `dbe4189`. Wave 3 covers the Cluster C "canonical-assumption" pattern conversation settled 2026-05-14 (Mavuika A4 Kiongozi as precedent; new explicit `canonicalAssumption` primitive; Skirk A4 simplification by dropping live dispatch). Each item is primitive + direct migration in one commit per the Wave 2 Item-1 pattern. Items selected per user direction "clear out all of these cases first, and we'll discover other Cluster C cases as we go through more Tier O work."
- 2026-05-14: Item 1 SHIPPED at `9f0a95d`. `canonicalAssumption` primitive + Nahida migration. Schema adds optional `{ headlineValue, caveat }` field on BuffEffect; renderer's `formatBuffDisplayValue` accepts an optional 5th `canonicalHeadline` param and short-circuits to it when present; helper `canonicalHeadlineOf(e)` threads through all 15 call sites. Lint adds 3 strict checks (shape, headline, caveat). Nahida Compassion Illuminated consolidated 2 broken effects → 1 buff (target:active, onCast burst, dur:15, em:250 + canonicalAssumption). Nahida Awakening Elucidated consolidated 3 broken effects → 2 buffs (skillDmgBonus:80 + critRate:24, target:self, passive trigger; critRate carries an explicit over-render caveat for the per-abilityName scoping gap). 4 new lint tests. 333 → 337 tests; type-check green.
- 2026-05-14: Item 2 PAUSED. Reaction union lacks element-variant composite keys (hydroSwirl, hydroCrystallize) — Neuvillette A1's "Hydro Swirl / Hydro Crystallize" filter needs a schema decision before authoring. Three plausible shapes documented inline (composite keys / element-filtered ReactionEvent / defer-with-over-render). Recommendation: Shape B (element-filtered ReactionEvent + onReaction.elementFilter). Surfacing to Nate for direction. Item 3 proceeds independently.
- 2026-05-14: Item 3 SHIPPED at `d0ccbf4`. `teamElementCount` Condition primitive + Skirk A4/C4 migration. Schema adds the Condition variant `{ type: 'teamElementCount'; elements: Element[]; comparison: '>=' | '=' | '<='; value: number }`. Parser extends `ConditionContext` with `teamElementCounts?: ReadonlyMap<Element, number>` and adds the corresponding `evalCondition` case. Renderer (`computeTeamBuffRows`) pre-computes `teamElementCountsByHolder` (charId → element-count map of OTHER team members, holder excluded) and layers a per-holder context onto baseCtx. Lint adds 3 strict checks (elements / value / comparison). Skirk A4 drops 2 gainStacks effects (v0.8 sourceLifetime dispatch retired for Skirk; HitEvent stream stays on ParsedRotation for future use); 6 A4 tier buffs (NA + burst) re-gate from `stacks:deathsCrossing` → `teamElementCount`. C4 atk% tier buffs migrate identically. Tier-3 A4 NA/burst + C4 atk% gain `canonicalAssumption` markers. 6 evalCondition tests + 5 lint tests (337 → 348 total). Wave 3 closes cleanly except Item 2 (PAUSED pending design call).
- 2026-05-14: Item 2 reaction-filter side UNBLOCKED at `ab87119` (Shape A). Nate's call: Shape A wins (match game ontology; cryoSwirl-specific buffs are leaked-future). Schema retires broad `'swirl'` and `'crystallize'` keys; emits 8 element-tagged composite variants. 7 consumer migrations: VV 4pc + Sucrose A4 + Mizuki A1/C1 + Varka + Illuga + Columbina use OR-arrays; Kazuha A4's 4 per-element DmgBonus buffs each retarget to their matching element's swirl (more accurate than the previous broad-key authoring which over-fired all 4 buffs per event). Yun Jin C4 curator note refreshed. Item 2 NOW PENDING with 3 remaining architectural pieces (cross-char dispatch, rotation-wide stackState, lifetime threading) — comprehensive hand-off brief inline above for the next session.
- 2026-05-14: Item 2 SHIPPED at `5f6a83d`. All 3 architectural pieces landed in one commit: (1) `dispatchGainStacksOnReaction` refactored to team-walk with source='self'/'team' filtering (mirrors `dispatchGainStacksOnHit` shape); (2) rotation-wide `onReactionStackState` + `onReactionStackInstances` maps for off-field accrual, with `syncOnReactionToStackState` writing per-segment `stackState` at each cast handler; (3) lifetime branch in the new dispatcher anchors per-instance expiry rotation-wide with oldest-dropped saturation. `applyLifetimeExpiry` now skips onReaction-trigger keys (handled by the sync). Neuvillette A1 authored: gainStacks(onReaction, team, 9 reactions, max=3, lifetime=30) + 3 chargeDmgBonus tier buffs (+10/+25/+60) gated on exact stack count, anchored to onCast skill (so the per-tier buff renders as a 30s bar in the team buffs row). Curator notes flag the per-reaction-type vs per-event simplification (in canonical multi-reaction comps the distinction is rarely load-bearing; over-render risk in mono-reaction comps with 4+ same-type events within 30s) and the rotation-without-E visualization gap. 6 new parser tests (team-source accrual, holder-own reactions, max-cap saturation, lifetime expiry, source='self' filter, cross-segment persistence). 348 → 354 tests; type-check green. Wave 3 fully closed.

## Out-of-queue notes for next planning conversation

**Mavuika A4 Kiongozi retrofit** — current authoring uses a `decaying` BuffValue with `startValue: 40` to represent the canonical-FS-peak. Could be retrofit to add `canonicalAssumption` for explicit user notification, but the decaying primitive carries useful timing info that canonicalAssumption doesn't replace — they're orthogonal. Optional polish; skip unless Nate wants the explicit "this is assumed" flag.

**Other potential canonicalAssumption candidates discovered during Wave 2 / Tier O work** (surface as they appear):

- Per-element-Hyperbloom / Burgeon damage modeling — null-resolving on aura state; might benefit from canonical-assumption "we assume the reaction triggers" framing.
- Other "active char EM-gated" mechanics that follow the Nahida pattern.

**Other potential teamElementCount candidates** (mirror Skirk A4):

- Per-faction-count cases like Mavuika A1 (Natlan team), Varesa A4 — currently rendered via the deferred-extension list; teamFaction handles this. teamElementCount is for raw element-count gating.

**Bigger architectural items still in Track O / Cluster C** (defer to future conversation):

- Per-hit HitEvent emission (NA/CA/plunge fidelity for Skirk A4 + downstream)
- Multi-element absorption full table (Chasca, Wanderer C4) — different shape from canonical-assumption; needs gadget-like primitive
- Skirk Void Rifts / Neuvillette Sourcewater Droplets — same gadget primitive, hard skip per philosophy
