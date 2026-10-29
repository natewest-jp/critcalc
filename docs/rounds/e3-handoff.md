# E3 hand-off: auto-tracked resource stacks (2026-05-10)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

## Status (2026-05-10) — E3 v1.5 SHIPPED

Cast-only synthetic reaction emission shipped. Builds on v1's gainStacks foundation by emitting typed reactions at each E/Q cast against a rotation-wide aura state, then dispatching to gainStacks(onReaction) and durationExtensions(onReaction) consumers. Tests green, **238 pass** (up from 224 at v1; +14 new tests covering cold-start, anemo→anemo no-op, pyro→anemo swirl, EC coexistence, bloom→hyperbloom, lunarCrystallize Moonsign gating, Mizuki A1 stance extension, Collei A4 summon extension).

**What landed in v1.5:**

- Parser aura tracker (`AuraState`: `Set<AuraElement>` + `burning` + `quickened` + `bloomCores`). Rotation-wide; persists across segments. No decay (auras stick until consumed). Cold-start emerges naturally from empty initial set.
- `computeReactionsForCast(element, aura, hasMoonsignTeam)` returns the typed `Reaction[]` plausible for the cast given current aura. Optimistic — emits all eligible reactions; consumer trigger filters narrow.
- `updateAuraStateAfterCast(element, aura)` mutates aura per simplified consumption rules: anemo and geo are no-ops; PHEC consumes opposing(s) + applies own; EC coexistence (hydro+electro stay both); bloom (push core, consume both); burning/quicken (compound flags + both elements remain); hyperbloom/burgeon (consume core).
- `dispatchOnReactionExtensions(charId, reaction, ...)` (parser-closure helper) walks both stance owner's `durationExtensions[]` AND active summon-bound extensions. Mirrors `dispatchOnCastExtensions` for procCooldown, maxExtensions, and condition gating.
- `dispatchGainStacksOnReaction(char, reaction, ...)` (top-level helper) walks `gainStacks` effects with `onReaction` trigger, filters by reaction match, applies saturating cap.
- `summonExtensionOwners` map (parser-closure) tracks active summon-bound extension state (for Collei A4 — burst summon's `durationExtensions[]`). Registered on cast; entries auto-skip when expired.
- Reaction emission wired into both Q and E handlers via `emitReactionsAtCast(char, castKind, ...)`. Order: stance-open → summon-register → emit reactions (which dispatch to extensions + gainStacks + push to `reactionEvents`) → onCast extensions.
- `ReactionEvent` type + `ParsedRotation.reactionEvents: ReactionEvent[]` surface for renderer consumption.
- Renderer: `computeTeamBuffRows` extended to handle artifact 4pc `onReaction` buff effects via `reactionEvents`. **Instructor 4pc** (+120 team EM on any reaction, 8s) now fires correctly. **VV 4pc resShred is parser-dispatched but not yet rendered** — resShred has no shared rendering treatment yet (CLAUDE.md roadmap item; separate from v1.5).
- Schema/lint: relaxed `durationext-trigger-deferred` warn rule to accept `onReaction` triggers (only `onHit` and other types still warn-deferred).
- Mizuki A1 migrated: `durationExtensions[]` on the skill (Dreamdrifter stance), `{ trigger: onReaction swirl, delta: 2.5, maxExtensions: 2, procCooldown: 0.3 }`. Caveat documents under-firing (per-N anemo and drift-cloud ticks not modeled).
- Collei A4 migrated: `durationExtensions[]` on the burst's Cuilein-Anbar summon, `{ trigger: onReaction [8 dendro reactions], delta: 1, maxExtensions: 3 }`. Caveat documents that teammates' reactions in the zone aren't modeled — extensions under-fire.
- Linnea C1 NOT migrated: explicitly skipped onReaction path because the existing onCast skill grant already covers Linnea's E-press accrual (the canonical Moondrift Harmony trigger from her own attacks). Adding onReaction would double-count for E presses. Lumi-attack-driven Moondrift accrual remains deferred (would need summon-tick reaction emission, out of cast-only scope).
- Reference: KQM TCL Elemental Reactions sourced into `docs/library/game/elemental-reactions.md` (Sections 1-5 + gcsim React() priority for Section 8). User noted KQM is the strongest authority but not ground-truth; cross-reference with gcsim when discrepancies surface.

**Cast-only emission limitations (acceptable v1.5 trade-offs):**

- No per-N hit emission (catalyst N/C, bow charged shots, infused N attacks, summon ticks). Mizuki A1 fires only on E and Q swirls — no drift-cloud ticks.
- No element absorption tracking (Kazuha-shape characters use their own element; absorbed-element reactions deferred).
- No team teammates' between-cast aura churn (no Furina per-N hydro pulse re-application). Collei A4 fires only on Collei's own dendro casts.
- No reaction consumption asymmetry: anemo/geo never consume; PHEC consumes opposing(s). Always-on aura teams render correctly because rotations re-apply auras frequently via E/Q.
- No aura decay (auras stick until consumed). Long-gap rotations may over-fire; rare in practice.

**What did NOT land in v1.5 (still open):**

- **VV 4pc resShred rendering** — parser dispatches the events; the renderer needs a separate "resShred treatment" (general roadmap item). Until that lands, VV 4pc's −40% Anemo RES shred won't visualize despite the underlying dispatch firing correctly. Same applies to Deepwood Memories, Zhongli's resShred, etc.
- **Linnea C1 perStack consumer** (per-stack DEF FlatDmg on team Lunar-Crystallize hits). Two gaps: (a) no `lunarCrystallizeFlatDmg` stat key — closest fits are `normalFlatDmg`/`skillFlatDmg`, both inaccurate; (b) `onReaction` trigger isn't dispatched per-segment for buff rendering at the consumer side (separate from extension dispatch).
- **Linnea C6 enhanced grant** (18 per E instead of 6) — needs constellation-conditional override of `gainStacks.amount`.
- **Iansan / Skirk drain semantics** — separate primitive (E3 v2). NS/SS drain over time + variant burst gating.
- **Hydro Traveler Suffusion HP-drain accumulator** — different shape entirely; probably its own primitive.

## Status (2026-05-10) — E3 v1 SHIPPED

Path A chosen. v1 ships **gainStacks Effect** with onCast dispatch, Linnea Field Catalog migrated. Tests green, 223 pass (up from 217 at hand-off; +6 synthetic gainStacks parser tests).

**What landed:**

- Schema: `Effect.type: 'gainStacks'` variant added to `src/lib/types/ability.ts` with `key`, `amount`, `max?` fields. Added `'gainStacks'` to `EffectBase.type` union.
- Parser: `dispatchGainStacks(char, castType, ...)` in `src/lib/utils/notationParser.ts` walks abilities + passives + constellations for `gainStacks` effects matching the cast event, applies saturating cap. Wired into both E and Q handlers, fires BEFORE the cast's `stackContext` snapshot so the cast bar reflects post-grant state (symmetric with Path B's `{key:N}` assertion semantics).
- Lint: shape rules `gainstacks-key-invalid`, `gainstacks-amount-invalid`, `gainstacks-max-invalid`, `gainstacks-trigger-invalid` in `characterLint.ts`. Trigger lint accepts onCast / onReaction / onHit (forward-compat for v1.5 / v2) but only onCast actually dispatches today.
- Linnea C1 migrated: gainStacks effect (key: `fieldCatalog`, amount: 6, max: 18, onCast skill, conditions constellation 1). Curator notes updated to flag what's still deferred.
- Key-name convention: **camelCase** (matching the rest of the codebase; `coldDish`, `huntersExperience`, `fieldCatalog`). The tokenizer's STACK*ASSERT_RE was relaxed in commit `303665e` from `[a-z]a-z0-9*-]_`to`[a-z]a-zA-Z0-9_-]\_` to accept this; previously camelCase keys silently failed to tokenize even though they were already in use as JSON keys for Escoffier/Kinich consumers.

**What did NOT land in v1 (still open):**

- **Linnea C1 perStack consumer** (per-stack DEF FlatDmg on team Lunar-Crystallize hits). Two gaps: (a) no `lunarCrystallizeFlatDmg` stat key — closest fits are `normalFlatDmg`/`skillFlatDmg`, both inaccurate; (b) `onReaction` trigger isn't dispatched per-segment for buff rendering. Authoring deferred until either lands.
- **Linnea C6 enhanced grant** (18 per E instead of 6) — would need a constellation-conditional override of `gainStacks.amount`. Schema-side: extend `gainStacks` with optional `constellationScaling` mirroring the BuffEffect shape, OR add a second gainStacks effect with conditions: constellation 6 + a "skip C1 grant when C6 active" pattern. Not yet decided.
- **Moondrift Harmony accrual** — Linnea's own attacks triggering Lunar-Crystallize fire a +6 stacks event. Needs onReaction trigger dispatch in `dispatchGainStacks`. This is the natural E3 v1.5 + P4 reaction-event slice.

## What E3 is

A primitive for **resource stacks that accrue from in-rotation events** rather than user assertion. Distinct from the **Path B** stacks shipped 2026-05-08 (Heizou Declension, Yanfei Seals — those use the `{key:N}` notation token and are user-asserted at cast time). Path B works for "hit your stamps and assert when needed"-style stacks but breaks down for stacks that should auto-track from notation events the user shouldn't have to count manually.

Quick test: if a sane user types `Skirk E N1 N2 N3 N4 Q` and would expect "yes obviously you have ~20 SS by now," you need E3. If a user types `Heizou {seal:4} C` to deliberately enter a loaded-CA state, Path B is fine.

## Affected characters (5 known)

Each character's curator notes already flag the gap; grep the data corpus for "deferred resource" / "stack-resource" / "custom resource" to find them.

| Char                       | Resource                       | Accrual                                                         | Consumption                                                                  | Primary gating                                               |
| -------------------------- | ------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Linnea** (Tier C)        | Field Catalog                  | E cast +6, Moondrift Harmony +6 (max 18)                        | Per team Lunar-Crystallize hit (1 stack); Million Ton Crush (up to 5 stacks) | C1: +75% DEF FlatDmg per consumed stack                      |
| **Iansan** (Tier C)        | Nightsoul points               | E +54 (Tap), Q +15, Scale-distance regen                        | Drains over time while NS Blessing active                                    | Burst's Kinetic Energy Scale ATK formula switches at NS≥42   |
| **Skirk** (Tier C)         | Serpent's Subtlety             | Tap-E +45, Hold-E +18 (later +10 from C2)                       | Drains 7/sec in Seven-Phase Flash; Q consumes all                            | Stance duration; +burst DMG per SS over 50 (max +12, +22 C2) |
| **Nefer** (gcsim-PR draft) | Verdant Dew                    | Skill cast spawns; +25% rate during Shadow Dance (C4)           | Phantasm Performance CA consumes 1 per cast                                  | Gates the Phantasm Performance CA replacement entirely       |
| **Nefer** (gcsim-PR draft) | Veil of Falsehood              | Per-cast accumulation (C2: +2 instant on E with Moonsign Gleam) | (gcsim-tracked)                                                              | Cons interactions                                            |
| **Hydro Traveler**         | Suffusion HP-drain accumulator | Hold-E Dewdrop ticks consume HP, accumulating                   | Releases on Torrent Surge                                                    | A4: +45% accumulated HP as Torrent Surge FlatDmg, max 5000   |

Skirk is the most complex (drain mechanic, variant burst, cons interactions). Linnea is the cleanest (clear accrue-on-event, consume-on-event without time decay). **Recommend starting with Linnea** to validate the primitive shape, then generalizing.

## Why this is bigger than the previous E sessions

E1/E4/E5/E2 all had the property that the **planner doesn't need to compute new state** — they were schema additions whose evaluation either resolves at parser-cursor time (state, chainStage) or returns null and renders optimistically (enemyHpBelow, enemyAffectedBy, activeCharFaction). E3 cannot return null and call it a day: a stat scaling on stack count needs the stack count to render. The planner has to derive it.

This means E3 is the first Session E topic that **may require parser changes beyond a single dispatch site**. The Tier C Architecture Plan flags Proposal P4 (parser event-stream refactor) as "post-Tier-C, pre-Team-Builder" — E3 is the natural forcing function for at least a slice of P4.

## Two design paths

### Path A — Parser-tracks-stacks (faithful)

Add an effect type `gainStacks` (or a per-ability-level `gainStacks?` field) that declares "casting/hitting this fires +N stacks of named resource." Parser walks the rotation, tallies stack state per character per resource, exposes the snapshot via `TimelineBar.stackContext` (the field that already exists, populated today by `{key:N}` Path-B assertions).

**Schema sketch:**

```ts
type GainStacks = {
	/** Resource name (must match the consumer's `stacks` condition key). */
	key: string;
	/** Stacks added per trigger fire. Can be > 1 for batch grants (e.g. Linnea +6 per E). */
	amount: number;
	/** Cap; consumer may further cap at consumption time. */
	max?: number;
	/** Trigger event(s) that fire stack gain. Subset of the existing Trigger union? */
	trigger: Trigger;
};
```

Authoring shape — Linnea C1:

```json
{
	"type": "gainStacks",
	"key": "fieldCatalog",
	"amount": 6,
	"max": 18,
	"trigger": { "type": "onCast", "ability": "skill" }
}
```

Then C1's per-stack DMG bonus is a separate consumer effect:

```json
{
  "type": "buff",
  "stat": "skillFlatDmg",
  "value": { "type": "perStack", "key": "fieldCatalog", "per": { "stat": "def", "ratio": 75 } },
  "conditions": { "type": "stacks", "key": "fieldCatalog", "min": 1 },
  "trigger": { "type": "onHit", ... },
  ...
}
```

The `perStack` BuffValue + `stacks` Condition primitives both already exist (Path B v1+v2 shipped 2026-05-08) — Path A only needs the **accrual** half. The renderer already handles per-stack value scaling against `stackContext`.

**Pros:** faithful; visible-buff progress tracks the rotation; same `perStack`/`stacks` primitives that Path B uses.

**Cons:** parser state grows; need an event hook for `onHit`/`onReaction` triggers if Field Catalog accrues from non-cast events (it accrues on Moondrift Harmony — a Lunar-Crystallize trigger Linnea opens via her own attacks). This is where P4 event-stream creeps in.

### Path B-extension — Asserted-only (constitutionally pure)

Keep `{key:N}` notation as the only stack mechanism. Don't add `gainStacks`. Author each affected character with a `value: { type: 'unknown', description: '...' }` placeholder for the stat scaling and document the gap in caveats.

**Pros:** zero parser changes; "windows not numbers" constitution; same approach Iansan's flat-ATK buff already uses.

**Cons:** user must mentally track stacks AND assert them. For Linnea/Skirk that's painful (counts can change every hit). Visible-buff progress on these chars is essentially frozen.

## Recommended sequencing

1. **Read the constitution** ([project_design_constitution.md](project_design_constitution.md)) and [Tool Constitutions](tool-constitutions.md) on visualization-vs-calculation. The bias is "windows not gauges" but stack accrual that's clearly notation-derived (E cast → +6 stacks) doesn't violate the principle — it's choreography we already have.

2. **Pick Linnea Field Catalog as the v1 target.** Cleanest accrual/consumption pair, no time drain, no variant burst. If the primitive can't express Linnea, scrap and rethink.

3. **Decide Path A vs B-extension at session start** before writing code. The user has a stake here — surface the choice via AskUserQuestion.

4. **If Path A**: design `gainStacks` to fit the existing `Trigger` union. The first `gainStacks` to ship needs only `onCast` (Linnea E). `onReaction` accrual (Linnea Moondrift Harmony) is the second wave.

5. **Lint + parser changes**:
   - Schema: new `gainStacks` Effect type (or a `Trigger` extension — design call).
   - Parser: extend the segment loop to read `gainStacks` declarations on cast/hit and update `stackState` (the per-segment map already exists for Path B).
   - Parser tests: synthetic char with `gainStacks` on E + a `perStack` consumer.
   - Lint: validate `key`, `amount`, `max` shape; cross-ref with `stacks` Condition consumers.

6. **Migrate Linnea C1**: gainStacks on E + perStack consumer on the team-Lunar-Crystallize hit. Note: the consumer's `onHit + element: lunarCrystallize` trigger is already the schema; what's missing is the renderer firing it on team Lunar-Crystallize events (separate trigger-dispatch gap, possibly in the F2C remaining list).

7. **Don't migrate Iansan yet.** The drain-over-time mechanic doesn't fit `gainStacks` directly — it'd need a `consumeStacks` complement plus continuous-rate semantics. Defer to E3 v2.

8. **Don't migrate Skirk yet.** Same drain issue, plus variant burst gating, plus EnergyMax=0 (already authored as a workaround).

9. **Don't touch Nefer (Verdant Dew, Veil of Falsehood).** Pre-release gcsim-PR draft; data may shift before release.

## P4 event-stream — how much does E3 need?

Not the full P4. E3 v1 (Linnea Field Catalog accrual on E cast only) needs zero new event hooks — it just reads the `onCast` event the parser already emits. v1.5 (Moondrift Harmony, which is a Lunar-Crystallize-trigger event) needs a reaction-event hook the parser doesn't emit. So:

- **E3 v1 — zero P4.** Just `gainStacks` on `onCast` + Linnea E migration.
- **E3 v1.5 — slice of P4.** Add `onReaction` event emission to the parser (this is a small chunk of the broader P4 — probably ~50-100 LOC). Unlocks Moondrift Harmony accrual + dispatches the deferred E5 reaction-trigger duration extensions (Mizuki A1, Collei A4) at the same time.
- **E3 v2 — full drain semantics.** Iansan/Skirk consume-over-time. Bigger; defer.

If you're appetite-bound, ship **E3 v1 only**. The single-char migration is verifiable; the primitive is right-sized; future migrations layer on without re-architecting.

## Open design questions to resolve at start

- **`gainStacks` as an `Effect.type` vs as a `Trigger` extension?** Effect-type is simpler (sits next to `damage`/`heal`/`buff`); trigger-extension might be denser but couples accrual to trigger semantics. **Lean: Effect type.**
- **Cap enforcement: at accrue time or at render time?** Probably accrue (saturating add to `stackState`). Consumer-side cap would over-scale on perStack values when over the cap. **Lean: at accrue time.**
- **Scope: per-character or per-team?** Linnea's Field Catalog is per-Linnea. Hypothetical team-resources don't exist in the data set yet. **Lean: per-character only; revisit if team-scope appears.**
- **Decay between segments?** Linnea's stacks have a 10s lifetime. The parser doesn't model arbitrary-resource decay today. v1 could ignore (just saturate forever, document caveat); v2 adds `lifetime?: number` to `gainStacks`. **Lean: ignore in v1, log as caveat.**
- **Consumption side?** Linnea's stacks are consumed on team Lunar-Crystallize hits — but the schema's `onHit` trigger filter doesn't have an "is reaction" gate. The consumer is `perStack`-valued and renders without consumption tracking (just shows "+N% per stack" assuming the stack is still there). True consumption would need a `consumeStacks` complement. **Lean: defer consumption tracking; render perStack at peak stack count with caveat.** This means Linnea's bar over-renders by a factor of (stacks-built / stacks-consumed) — acceptable approximation.

## Files that will touch (Path A v1 estimate)

- `src/lib/types/ability.ts` — new `Effect.type: "gainStacks"` variant + EffectBase tweaks.
- `src/lib/utils/notationParser.ts` — read `gainStacks` declarations on each cast; update per-segment `stackState`. The existing `stackState` plumbing (Path B) is the integration point; minimal new state.
- `src/lib/utils/notationParser.test.ts` — synthetic-char tests for accrual + perStack rendering.
- `src/lib/utils/characterLint.ts` — lint `gainStacks` shape + cross-reference with `stacks` consumers.
- `src/lib/data/characters/linnea.json` — migrate C1 + remove deferral note.

## What's NOT in E3 v1

- Iansan NS / Skirk SS drain semantics — separate primitive (drain + accrue). Defer.
- Nefer Verdant Dew / Veil of Falsehood — pre-release gcsim-PR draft. Wait.
- Hydro Traveler Suffusion HP-drain accumulator — this is a different shape entirely (continuous HP delta, not discrete stacks). Probably its own primitive.
- Reaction-event hook for Moondrift Harmony / Mizuki Swirl / Collei dendro reactions — that's E3 v1.5 (slice of P4).
- Full event-stream refactor — that's P4 proper, post-E3.

## Repo state at hand-off

```
bcb75b6 feat(schema,parser,curation): E2 — enemyAffectedBy condition (AuraElement) + 2 char migrations
1ea08d0 feat(schema,parser,curation): E2 — enemyHpBelow condition + 3 char migrations
4d16503 feat(schema,parser,curation): E5 — DurationExtension primitive + Cyno migration
```

217 tests passing; type-check green. Working tree clean at `bcb75b6` on `main`.

## Required reading before starting

1. **[project_tier_c_architecture_plan.md](tier-c-architecture-plan.md)** — read the "Stacks condition handoff" section at the bottom. P2 (chainStage + stacks) shipped that with Path B; E3 is its natural successor.
2. **`src/lib/types/ability.ts`** — read the `BuffValue` `perStack` variant (already shipped; renderer wires through). Read the `stacks` Condition variant. E3's job is to feed these consumers automatically.
3. **`src/lib/utils/notationParser.ts`** — find `stackState` and read how Path B writes it (`stack-assert` token). E3 writes the same map from `gainStacks` effects instead of `{key:N}` tokens.
4. **`src/lib/data/characters/linnea.json`** — C1 effect block + curator notes; the migration target.
5. **[project_tool_constitutions.md](tool-constitutions.md)** — the "windows not gauges" thread. Confirm Path A doesn't violate the constitution (the answer: it doesn't, since stack accrual from notation is choreography, not state simulation).
