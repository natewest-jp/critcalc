# Tier C Architecture Plan

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Reviewed at the Tier B / Tier C seam (2026-05-07) after Tier B finished and the tool constitutions were authored. Goal: identify the schema/parser stress points Tier C will expose and decide what to address before merging more curated characters that paper over them.

## Calls already settled (2026-05-07)

1. **Resource pools render as state windows, not gauges.** Nightsoul Blessing, Niwabi Fire-Dance, etc. all collapse to "named state is open / closed" — same primitive as `inStance`. No point/drain tracking. Constitution-aligned ("windows not numbers").
2. **Migrate aggressively.** When a schema change lands, migrate all curated characters in the same PR; lint test enforces. The cost is bounded at ~20 curated chars and grows if deferred.
3. **Parser event-stream refactor (Proposal 4) goes after Tier C, before Team Builder.** Tier C exposes what events the stream needs to carry; Team Builder needs a clean parsed-rotation API.

## Status (2026-05-07)

**P5 (curation lint test) — DONE.** Lives in `src/lib/utils/characterLint.ts` + test file. Runs via `npm test`, fails CI on strict issues. Rules cover schema-level invariants (id pattern, frame validity, behavior fields), effect invariants (passive/constellation triggers, stat/element validity), cross-references (factions ↔ factionBonuses), stance consistency, and curation hygiene (`_curatorNotes` shape). Heuristic for "curated character" = "has hits[] frames + skill frames" (no explicit flag yet — upgrade later if heuristic gets wobbly). Migration-window check #18 (`inStance` overload) is `warn` until P2-style migrations finish; tighten to strict afterward.

**P2 (chainStage condition) — DONE.** New `Condition` variant `{ type: "chainStage"; ability: "skill" | "burst"; index: number; window?: number }` in `src/lib/types/ability.ts`. Parser threads `ChainIndex` through `evalCondition` / `applyModifiers` / `resolveAbilityTiming` / `resolveActiveAbility`. New `chainPositions` map tracks per-character per-ability-kind position with `expiresAt`; `advanceChain` after E/Q cast advances index (or resets on terminal stage with no `window`). Diluc E1/E2/E3 migrated off the `cooldown: 0` stop-gap to canonical chainStage authoring; three parser tests cover sequential firing, post-terminal reset, and window expiry. `findChainStage` helper recurses into `all` but not `not`/`any` (semantics deferred).

**Stacks condition — DONE 2026-05-08.** Path B (user-asserted) shipped:

- Schema: new `Condition` variant `{ type: "stacks"; key: string; min: number; max?: number }` in `src/lib/types/ability.ts`.
- Tokenizer: new `stack-assert` token kind matching `{key:N}` form (key must be lowercase identifier with letters/digits/underscore/hyphen). Pattern added to outer regex, concatenated-split regex, multi-word-name skip logic, and ACTION_FIRST_CHARS.
- Parser: per-segment `stackState: Map<string, number>` resets at each segment start (so swap clears the pool). Stack-assert tokens update state without advancing cursor or emitting blocks. `evalCondition` extended with optional `stacks` parameter; without context returns null (timeline-side preview), with context resolves true/false based on min/max. Threaded through `applyModifiers`, `resolveActiveAbility`, `resolveAbilityTiming`, and the E/Q handlers.
- Lint: validates `key` non-empty, `min` non-negative integer, `max` >= min (when present). Rules walk both effect-level and ability-level conditions. 4 synthetic lint tests cover each failure case + the happy path.
- Parser tests: 6 tests on a synthetic character cover base-skill resolution, loaded-skill resolution after assertion, stacks-below-min, later-assertion-overrides, per-segment reset on swap, and zero-width-assertion semantics.
- Migrations: Heizou C6 +32% CD (declension >= 4) and Yanfei A1 Pyro DMG +15% (seal >= 3 at C0) — both with caveats about the v1 over-render limitation.
- The original lint check #18 (`inStance` overload) is no longer relevant — Heizou and Yanfei never actually used `inStance` for their stack mechanics in the JSONs (the architecture plan handoff was based on an older state). Check #18 stays as `warn` for any future cases.

**Per-cast stack-stamping — DONE 2026-05-08** (same session as stacks v1). New `stackContext?: ReadonlyMap<string, number>` field on `TimelineBar`, snapshotted from per-segment `stackState` at each cast (Q and E handlers in `notationParser.ts`). All four `evalCondition` call sites in `RotationTimeline.svelte` (onCast team buffs, afterDuration team buffs, active-target buffs, self-target buffs) refactored from filter-once-per-castType into filter-per-bar so that stack-gated effects render only on the casts whose `stackContext` satisfies the condition. Heizou C6 caveat updated to reflect this. Yanfei A1's onHit trigger still doesn't render in the team buffs row (separate gap), but the `stackContext` plumbing is in place for when onHit-buff display lands. CodeMirror highlighter also updated with a `rp-tok-stack` class (muted-violet italic) for the new token kind.

One synthetic parser test (`stamps stackContext onto the bar at cast time`) verifies the per-cast snapshot lands on the bar correctly across mixed-assertion casts.

**Per-stack buff-value scaling v1+v2 — DONE 2026-05-08** (two sessions, both forms shipped):

v1 (plain-numeric):

- Schema: new `BuffValue` variant `{ type: "perStack"; key: string; per: number; maxStacks?: number }` in `src/lib/types/ability.ts`.
- Renderer: `formatBuffDisplayValue` in `RotationTimeline.svelte` extended with optional `stackContext` arg; resolves perStack against the cast's stack snapshot, falls back to "+per%/stack" placeholder otherwise. Wired through 5 in-bar call sites (team buff onCast, team buff afterDuration, artifact 4pc, active-target, self-target). Weapon-proc site unchanged (no bar in scope).
- Lint: strict rules `perstack-key-invalid`, `perstack-per-invalid`, `perstack-maxstacks-invalid` + buff-value-shape vocabulary updated.
- Migrations: Yanfei A1 Proviso (`value: 15` → `perStack` per=5, maxStacks=4); Heizou C6 +4% CR per declension (NEW effect alongside existing Conviction +32% CD).

v2 (scaling form):

- Schema: `per` extended from `number` to `number | { stat: ScalingStat; ratio: number }`. Same maxStacks/key fields; render-time resolution multiplies effective stacks by ratio and renders as `~X% STAT` (whole-number convention, NOT the existing scaling-BuffValue's × 100 decimal convention — chose readability over consistency since perStack-scaling values match the in-game text directly, e.g. "320% ATK per stack"). The decimal-vs-whole inconsistency on the existing `scaling` BuffValue exists but isn't observed because passive-trigger scaling buffs (Mavuika C2 etc.) don't render through the team-buff/active/self paths.
- Lint: `perstack-per-invalid` extended to handle both forms (number must be finite; object must have `stat ∈ SCALING_STATS` and finite `ratio`).
- Migration: Kinich A4 Hunter's Experience — NEW buff effect on the passive: stat=`skillFlatDmg`, target=self, trigger onCast skill, condition stacks min=1, value perStack with per={stat:atk, ratio:320} maxStacks=2. Caveat documents the over-render on non-Cannon E presses (Loop Shot, cold-open Canopy Hunter — schema has no per-ability scoping inside skill).
- Effective value at render: e.g. Kinich at 2 huntersExperience stacks → "~640% atk" on the buff bar.

**Decaying-buff primitive — DONE 2026-05-08** (same session). Plain-numeric form shipped:

- Schema: new `BuffValue` variant `{ type: "decaying"; startValue: number; endValue?: number }` in `src/lib/types/ability.ts`. Inverse of `ramping`. Decay duration = host effect's `duration`.
- Renderer: `formatBuffDisplayValue` formats decaying as `+startValue% → endValue% over duration`. New `DecayParams` type + `decayingBackground` helper in `RotationTimeline.svelte` returns a CSS gradient that fades from full opacity at decay start to dim at decay end (mirrors `rampingBackground` in reverse). New `decayParams?: DecayParams` field on `CharReceivedBuffBar`. Active-target loop wires `decayParams` from `firstValue.startValue/endValue/duration`. Template uses `rampingBackground(bar) ?? decayingBackground(bar)` for the bar background.
- Lint: 2 strict rules (`decaying-startvalue-invalid`, `decaying-endvalue-invalid`) + buff-value-shape vocabulary updated. 4 synthetic lint tests added.
- Migration: Mavuika A4 Kiongozi authored as max-FS case (startValue: 40, endValue defaults 0) on a target=active onCast burst trigger with duration 20. Caveat documents the per-FS-point peak compromise.

**Still deferred (separate primitives, not subsumed by decaying or perStack):**

- **Mavuika Sunfell Slice FlatDmg** — per-FS-point ATK FlatDmg on the burst hit. Curator note flags `burstQBonus × ATK` shape but the per-FS-point ratio value isn't sourced (would need gcsim cross-reference). Schema is ready; migration pending the in-game number.
- **Mavuika A4 Kiongozi v2 (per-FS-point peak)** — current authoring uses the max-FS-case startValue: 40. The actual peak scales 0.2% per FS consumed (max 200 FS → 40%). To express this, schema needs either decaying×perStack composition (e.g. recursive value spec, or perStack with `decayingTo` field). Mavuika C4 also blocked: it removes the decay entirely and adds +10% allDmgBonus, needing constellation-conditional override of the decaying envelope.
- **Varesa A4 The Hero Twice-Returned** — team-Nightsoul-Burst trigger landed 2026-05-09; authored at single-stack value (+35% atk%, 12s, refresh). Independent-2-stack-duration semantics (parallel 12s timers, max +70%) still deferred — separate primitive (perStack/decaying don't compose to "two parallel windows that don't merge").
- **Teammate-hit trigger** — Escoffier C6, Mavuika A1, Varesa A4, Xilonen A2 all gate on "the active character (not me) does X." Highest-leverage trigger gap surfaced during Tier C; should align with P4 event-stream refactor.

**P1 partial — `opensState` field shipped 2026-05-07.** Minimal extension of the stance primitive: stance variants of skill/burst can declare `opensState?: State` to open a named state alongside the default `inStance` for the stance window's duration. Used by Xilonen and Mizuki for `nightsoulBlessing`. Parser additions: new `stateWindows: Map<charId, Map<state, endTime>>`, populated when stance opens; cleared on terminatesOnSwap; merged into `computeCurrentStates` alongside the existing inStance check. Conditions on `state: "nightsoulBlessing"` now resolve correctly inside Natlan-stance windows.

**E-stance window opening — fixed 2026-05-07.** Latent bug: parser only opened stance windows from Q casts (line ~696), so E-stance characters (Hu Tao, Lanyan, Xilonen, etc.) silently bypassed the window. In-stance N abilities gated on `state: "inStance"` would never resolve. Fix: mirror the Q stance-open logic in the E branch. Two parser tests added covering Hu Tao Paramita Papilio (inStance) and Xilonen Blade Roller (nightsoulBlessing via opensState).

**Full P1 — STILL DEFERRED.** The current opensState shim covers the single-state-per-stance case. The bigger P1 vision (multiple states open simultaneously, replace `behavior: "stance"` entirely with `opensState[]` primitive) hasn't shipped. Mavuika's burst+skill double-stance scenario will likely need this; today's opensState only handles one named state at a time.

## Files changed in P5+P2+opensState sessions

- `src/lib/types/ability.ts` — added `chainStage` Condition variant + `ChainStageCondition` extract type; added `healingBonus` to Stat union; added `opensState?: State` to stance variants of SkillAbility and BurstAbility (2026-05-07 Nightsoul session).
- `src/lib/utils/characterLint.ts` — new lint module (vocabulary sets, isCurated heuristic, lintCharacter walker).
- `src/lib/utils/characterLint.test.ts` — new vitest runner.
- `src/lib/utils/notationParser.ts` — `chainIndex` plumbing, `chainPositions` state, `advanceChain` helper, `findChainStage` exported helper.
- `src/lib/utils/notationParser.test.ts` — three Diluc chainStage tests.
- `scripts/migrate-curator-notes.mjs` — one-shot `_curatorNotes` string→array migration script (kept for future use; idempotent).
- 9 character JSONs migrated (`_curatorNotes` shape): baizhu, charlotte, chongyun, gorou, jean, rosaria, thoma, xiangling, yaoyao.
- diluc — migrated to chainStage; stop-gap notes replaced.
- clorinde — cooldown: 0 note clarified (was correct semantically, not a stop-gap).
- furina — `terminatesOnSwap: false` added to burst stance; healingBonus stub now type-valid.
- dahlia — Sacramental Shower summons removed (was duration: 0 placeholder); replaced with `caveat`.
- barbara, chongyun — burst frames.swap added (gcsim lookup: 195 / 79).
- docs/curation/recipe.md, recipe-tier-b.md — archival headers (autonomous batch runs retired post-Tier-B).

## Why now

Four structural smells the Tier B recipe is routing around rather than solving:

- `state: "inStance"` is overloaded — hides chain stage, stack count, mode toggle, and stance-with-N-replacement (different mechanics, same flag).
- `Condition` union is closed and `State` is a flat enum; every Tier C character that adds a state means a type/parser/recipe rev.
- Parser doesn't emit a state-event stream; the timeline reconstructs windows by walking bars (RotationTimeline.svelte at 2,800 lines).
- No curation lint test; Tier C drift will be the highest-probability bug class.

## Five proposals, ranked

### P5 — Curation lint test (do first)

Lowest effort, highest leverage. vitest test alongside parser tests. Enforces:

- Every effect on a constellation/passive has `trigger.ability` set (Kazuha C6 footgun).
- No two abilities for the same character share `(abilityType, conditions)`.
- Characters with `factions[]` have matching `factionBonuses[]`.
- Every `state` referenced is opened by at least one ability somewhere.
- `behavior: "stance"` requires explicit `terminatesOnSwap`.
- `procCooldown` not on `trigger: "passive"`.
- Valid stat/element keys.

### P2 — `chainStage` + `stacks` conditions

Extend `Condition`:

```ts
| { type: "chainStage"; ability: "skill"; index: number }   // Diluc E1/E2/E3
| { type: "stacks"; key: string; min: number; max?: number } // Heizou, Yanfei
```

Parser tracks per-character chain stage / stack counts. Stacks are largely user-asserted (the planner doesn't infer "you have 4 Declension stacks now" — the user signals it via notation, the gating is exposed visually). Migrate Diluc / Heizou / Yanfei off the `inStance` hack.

### P3 — `Summon.effects[]`

Move from "summons are windows" to "summons can emit effects." Unlocks Oz/Albedo/Chiori/Zhongli stele tick markers and reaction-trigger windows that depend on summon emission. Most constitution-aligned addition (pure visualization).

```ts
type Summon = {
	// ... existing fields
	effects?: Effect[];
	tickInterval?: number; // for predictable pulses
};
```

### P1 — Generalize "stance" into "state windows"

Replace `behavior: "stance" + duration + terminatesOnSwap` with a more general primitive:

```ts
opensState?: {
  state: State;
  duration: number;
  terminatesOnSwap?: boolean;
  extension?: StanceExtension;
}
```

Multiple states can be open simultaneously (Mavuika in burst+skill stance). Parser's `stanceWindows` becomes `stateWindows: Map<charId, Map<state, endTime>>`. Required before Mavuika / Kinich / Ororon.

### P4 — Parser emits state-event stream

Add `events: TimelineEvent[]` to ParsedRotation: `stateOpen`/`stateClose`, `summonSpawn`/`summonExpire`, `buffOpen`/`buffClose`, `tickEvent`. Renderer becomes a pure projection. Several hundred lines move from timeline into parser where they're testable. Scheduled post-Tier-C, pre-Team-Builder.

**2026-07-14 line-count correction:** notationParser.ts = **2,954 lines**, RotationTimeline.svelte = **2,942 lines** (the "~4,500" below is stale — the 2026-07-10 `docs/rounds/timeline-extraction-cleanup.md` moved the row-builders into `src/lib/timeline/`, shrinking the renderer). **Precursor DONE** (`src/lib/timeline/` pure tested modules exist). **Event stream partially seeded:** ParsedRotation already carries `reactionEvents` / `hitEvents` / `shieldEndEvents` — P4 folds these into one `TimelineEvent[]` IR + adds stateOpen/Close, summonSpawn/Expire, buffOpen/Close, tickEvent. **Recommended kickoff (Nate 2026-07-14): new context, plan-mode-first** — design the IR shape + a migration sequence that keeps the 849-test suite green throughout, before any code moves.

**2026-07-06 refresh (post bug-sweep, still accurate + strengthened):** RotationTimeline.svelte is now ~4,500 lines (the 2,800 figure above is stale). The `docs/rounds/bug-sweep-2026-07-05.md` provided direct evidence for P4's premise: the confirmed bug classes were (a) parser state-threading errors — order-of-operations across the ~dozen parallel `Map<charId,…>`s (E-handler eval-before-wait #5, stance-extension gates #7, rotation-global reset scoping #1), and (b) renderer-side window-reconstruction errors — per-track loops mixing track-scoped and character-scoped dispatch (#11 + bonus). An event-stream IR with per-character state objects addresses (a); renderer-as-projection addresses (b). Two scope additions worth folding into P4 when it runs: **unify the E and Q cast handlers** (two ~200-line near-twins that drifted — batch 3 fixed E by copying Q's ordering) and **per-character state objects instead of parallel charId-keyed maps**. Precursor: `docs/rounds/timeline-extraction-cleanup.md` (extract computeTeamBuffRows-and-friends into pure tested modules first — shrinks P4's blast radius; can happen opportunistically before it).

## Execution order

1. ~~P5 (lint test)~~ — DONE 2026-05-07.
2. ~~P2 chainStage~~ — DONE 2026-05-07. Diluc migrated. **Stacks condition still pending** (separate session — Heizou/Yanfei still use inStance overload).
3. ~~Tier C: albedo, chiori, dehya, escoffier, xilonen~~ — albedo / chiori / dehya / xilonen done 2026-05-07; escoffier still pending (stacks-blocked).
4. ~~P1 partial (opensState field)~~ — DONE 2026-05-07 alongside Ororon + Mizuki curation. Mavuika / Kinich / Varesa now unblocked for the simpler 'stance opens nightsoulBlessing' case.
5. ~~Nightsoul Tier C: kinich, varesa, mavuika~~ — DONE 2026-05-07. Kinich uses Lanyan-shape in-stance N (Loop Shot as `abilityType: "skill"` + `input: ["N"]`) with separate in-stance Scalespiker Cannon entry. Varesa has dual-mode normals (base + Fiery Passion) gated by `state: "nightsoulBlessing"` + dual-mode skill (base + Fiery Passion Rush). Mavuika simplified — only Burst opens NS Blessing (Hold E captured as variant for frames only since AbilityVariant cannot override `opensState`); skill recast not authored. **Volcano Kablam (Varesa) and skill recast (Mavuika) both flagged as `apexDrive`-state-deferred — schema would need a per-character "post-action transient state" primitive to express these "Q during Apex Drive fires different burst" / "E during NS toggles mode" mechanics.**
6. P3 (Summon.effects[]) once Tier C surfaces what shape it needs. **High urgency now** — every curated Tier C char (11 of 11) flagged a P3 gap. Mavuika in particular has TWO P3 gaps (Ring of Searing Radiance per-tick Pyro + C6 bike-ring Ring summon every 3s).
7. Full P1 (multi-state windows) — Mavuika's dual-stance scenario was avoided in the v1 by collapsing both modes onto burst-opens-NS-stance only. A future migration to multi-state opensState would unlock: bike vs ring distinction inside NS, Hold E entering bike mode, skill recast toggling state. Full P1 also unlocks Varesa's apexDrive-state and a cleaner expression for "stance + transient post-action gate" patterns.
8. ~~**Variant-aware behavior/opensState**~~ — DONE 2026-05-08. Schema gained `opensState?: State` on `AbilityVariant`. New `resolveStanceFields(ability, tokenText)` helper in the parser resolves effective `behavior`, `opensState`, and `terminatesOnSwap` with variant overrides applied. New `stanceTerminatesOnSwap: Map<charId, boolean>` records the resolved flag at open-time so swap-out close uses the variant value (replacing the prior `getTerminatesOnSwap(ability)` heuristic that only checked base behavior). Mavuika Hold-E migrated from frame-only variant → true bike-NS opener (`behavior: "stance" + duration: 9 + terminatesOnSwap: true + opensState: "nightsoulBlessing"`). Three new parser tests on a synthetic Mavuika-shape character verify Tap-E doesn't open NS, Hold-E does, and Hold-E + swap closes the stance correctly.
9. P4 (event stream) after Tier C, before Team Builder.

## Open follow-ups

- **Stacks condition** — see dedicated handoff section below. Mavuika A4 (per-FS-point), Kinich A4 (Hunter's Experience), Varesa A4 (Hero Twice-Returned) all flagged as stacks-deferred during this session.
- ~~**Per-stack BuffValue v2** (scaling-per-stack form)~~ — DONE 2026-05-08, same session as v1. Mavuika Sunfell migration still blocked on sourcing the per-FS-point ratio from gcsim.
- **Lint check #18** (`inStance` overload) tightens from warn to strict after stacks lands.
- **Variant-aware behavior + opensState** — see Execution order step 8. Required for clean Mavuika Tap/Hold authoring without splitting into two abilities.
- **apexDrive-equivalent "post-action transient state" primitive** — Varesa's Apex Drive (post-plunge → 2.33s window where Q fires Volcano Kablam), Mavuika's skill recast (E during NS toggles bike/ring), and **Flins Thunderous Symphony** (post-Spearstorm 6s window where Q fires the 30-energy mini-burst) all need a "transient action-triggered state" that the schema doesn't express. Distinct from `afterDuration` which fires on stance-end. Probably needs a `state: "afterPlunge" | "afterSkill"` extension or a new trigger primitive. **Flins is the worked reference case (Nate 2026-07-15):** it needs a new `sQ` (short-Q) notation token and token-text-aware burst-variant selection. **KQM uses the same `sQ` token for Varesa's Volcano Kablam** (Nate confirmed) — so wire `sQ` for BOTH Flins (Thunderous Symphony) and Varesa (Volcano Kablam) in one pass. Full turnkey wire-up design lives in `flins.json` → Northland Spearstorm `_curatorNotes` (tokenizer `sQ` as kind Q, thread `tok.text` through resolveEQCastTime/resolveAbilityTiming instead of hardcoded `'Q'`, make variant selection honor `variant.conditions`, author the mini-burst as a burst variant, thread `variant.label` onto the qBar); Varesa's `varesa.json` Volcano Kablam note now points back to it. Grep `post-action transient state` to find all three migration targets.
- **"normal-attack opens a mode state" primitive (Durin dual-form)** — sibling of the post-action-transient-state gap, surfaced 2026-07-15 (Nate chose faithful auto-tracking + defer over a user-assertion workaround). Durin's Burst form (White default / Dark) must follow the mode set by his Skill: `E E` → White (Confirmation of Purity), `E N` → Dark (Denial of Darkness), each a 30s state. WHITE path + burst form-resolution are buildable TODAY with existing primitives (tap-E opens a `transmuting` stance → recast E gated on `state:transmuting` opens `whiteForm`; Dark Burst = a separate burst ability gated on `state:darkForm` via resolveActiveAbility, White = default base). The BLOCKED step is DARK ENTRY: it's a **normal attack** during the transmutation window, and the N-token handler (notationParser.ts ~L2789) routes only to normal abilities + emits normal blocks with no `opensState` path (and N doesn't route to skills — Kinich `input:['N']` isn't reachable via N). Primitive needed: let a state-gated normal (or normal variant) carry `opensState` and have the N-handler open that window like the E/Q stance blocks. Full turnkey design in `durin.json` → Binary Form skill `_curatorNotes`. Durin currently sits on the `variant-unreachable` lint warn list by design until this lands.
- **`barbara`/`chongyun` burst swap frames** — sourced 2026-05-07 (195 / 79); may need KQM cross-check for the rest of the burst frame map.
- **Dahlia Sacramental Shower duration** — currently absent from the JSON (with a caveat surfaced). Re-add summons[] when KQM/in-game data lands.
- **Existing legacy `behavior: "persistent"` shape** — uncurated stubs still use it; migration to `summons[]` can be a Tier C+ pass via the lint test.
- ~~**Decaying-buff primitive**~~ — DONE 2026-05-08, same session. Plain-numeric form shipped; Mavuika A4 migrated at max-FS peak. Per-FS-point peak scaling (decaying×perStack composition) deferred to v2.
- ~~**Team-Nightsoul-Burst trigger**~~ — DONE 2026-05-09 (F2C-D session). New `Trigger` variant `onTeamNightsoulBurst` in `ability.ts`; renderer passes for team-target and self-target rows fed from `nbBars`. Migrations: Mavuika A1, Varesa A4 (single-stack only — independent-2-stack-duration deferred), Xilonen A2, Ifa A1. Curator notes updated for Chasca A2 + Iansan A2 (remaining gaps are non-trigger primitives: element-by-team-comp resolution and heal-on-NS-tick). Active-target NB renderer pass deferred until Iansan A2 lands.

### Gaps surfaced 2026-05-08 (gcsim-PR + Traveler curation pass) — status after 2026-05-09 session

The 2026-05-09 session shipped A (Stat union), B (teamFaction + off-field), Physical Element, and G (TriggerFilter / damageTag). Status update:

- ~~**Reaction-DMG-bonus stat**~~ — DONE (commit fbe4988, A). Added `lunarChargedDmgBonus`, `lunarBloomDmgBonus`, `lunarCrystallizeDmgBonus` plus 9 element-self RES + 7 element-specific CRIT DMG keys. 7 character migrations: Escoffier C1, Shenhe C6, Arlecchino A4, Aino C6 (partial), Ineffa C1; Hu Tao C6 / Arlecchino C2 notes updated. Bloom/Hyperbloom/Burgeon/Aggravate/Spread reaction-DMG stats deferred (Baizhu A4 still flagged) — add when needed.
- **Per-attack Elevation primitive** — STILL OPEN. Flins C6, Nefer C6, Linnea C6, Lauma C6 (Frostgrove sanctuary +25%) all use gcsim's `atk.Info.Elevation += X`. Distinct from dmg-bonus stat — Elevation is a multiplicative tier on per-attack damage. Probably authorable as a new `Effect.type: "elevate"` or as an extension on the reaction-DMG-bonus primitive. Look up "Elevation" or "elevated" in the curated data when starting this work to find migration targets.
- ~~**`teamFaction:moonsign` runtime resolution**~~ — DONE (commit 39e268b, B). `evalCondition` extended with `ConditionContext.teamFactionCounts`. Migrations: Flins A1, Lauma C2, Aino C6 Gleam-tier (mutually-exclusive `teamFaction` vs `not(teamFaction)` authoring pattern).
- **Conditional-target buff routing** — PARTIALLY DONE (commit 39e268b, B). Off-field gating shipped via `negatedStates: Set<'offField'|'onField'>` per-segment + per-segment evalCondition. Iansan C2 migrated. **Still open**: "active-Moonsign-vs-non-Moonsign" routing (Linnea A4 — buff goes to active if Moonsign, else self) needs a different primitive — either conditional-target as an Effect-side pattern or per-segment target rewriting based on receiver attributes. No migration path yet.
- **Custom auto-tracked resource stacks** — v1 SHIPPED 2026-05-10 (commits `2122b21` + `303665e`). Path A chosen: new `Effect.type: 'gainStacks'` declares "this cast grants N stacks of named resource"; parser walks the rotation and accumulates per-character per-segment stack state with saturating cap; feeds existing `perStack` BuffValue + `stacks` Condition consumers. v1 dispatches `onCast` triggers only; Linnea C1 Field Catalog migrated as the v1 reference. Tokenizer regex relaxed to accept camelCase keys (matches the codebase's existing `coldDish`/`huntersExperience`/`fieldCatalog` convention). **Still open:** v1.5 reaction-event accrual (Linnea Moondrift Harmony, also unblocks E5's deferred Mizuki/Collei reaction-trigger duration extensions); v2 drain semantics (Iansan NS points, Skirk SS); Linnea C1 perStack consumer (needs `lunarCrystallizeFlatDmg` stat key + onReaction trigger dispatch); Linnea C6 enhanced grant (constellation-conditional `gainStacks.amount`); Nefer pre-release (wait for upstream); Hydro-Traveler Suffusion (different shape — continuous HP delta). See `docs/rounds/e3-handoff.md` for cold-start details.
- **Construct-destruct trigger** — STILL OPEN, now captured in F2C custom-event-trigger cluster (see `docs/rounds/f2-residuals.md`). Geo Traveler C2 Rockcore Meltdown is the canonical case. Likely overlaps with `onShieldExpire` / `onShieldDestroyed` for Noelle / Kachina under the same primitive.
- **Summon-duration constellation modifier** — STILL OPEN. Geo Traveler C6 (+5s wall, +10s meteorite), Hydro Traveler C2 (+3s bubble), Iansan C6 (+3s Scale). Schema-side fix: add `summons[].durationModifiers[]` mirroring the existing `cooldownModifiers` (small, contained extension).
- **HealEffect with flat + scaling combination** — STILL OPEN. Jahoda's Robot heal + Linnea Q heal both have `flat + DEF/ATK%` formulas. Extend `heal` Effect with optional `flat: number` field. Same shape works for `damage` Effect (Aino A4's burst tick has 50% EM flat + ATK% scaling co-located).

The Traveler entries (`traveler_<element>`) and the 5 PR-character drafts (iansan/jahoda/aino/nefer/linnea) carry `_curatorNotes` pointers to whichever primitive gates each unauthored effect — when a primitive lands, grep the data dir for the relevant gap-name string to find migration targets.

### New deferred primitives surfaced during F1 (2026-05-09)

These weren't on the original list but came up during F1's audit-and-categorize pass. Documented here so they don't get lost.

- **Energy / CD effect types** — `cdReset` exists for weapons only; `energy` exists but doesn't cover all cases. Affects Arlecchino C4 (-2s burst CD per directive absorb), Klee C6 (+3 energy per 3s), Gorou C2 (CD reduction + energy per Geo team member), Kazuha C1 (Q resets E cooldown — character cdReset, not weapon), Lauma A4 (5 energy per 100% ER on hit), Ineffa Lunar-Charged. Likely two extensions: `cdReset.source` to allow `"character"`, and a `cooldownReduce` effect type for fixed-amount reductions. ~7 effects across 5+ chars.
- **Dynamic event-triggered duration extension** — Distinct from static `durationModifiers`. Charlotte A4 Encore (+1s per orb pickup, max +5s), Sethos C2 (+2.5s per kill, max 3 extensions), Cyno burst (Mortuary Rite +4s per cast, currently shipped as `stanceExtension` shape), Collei A4 (Sprout +3s on dendro reaction, once), Kaveh A4, Gaming C2. Probably folds under one `durationExtensions[]` primitive that supersedes the stance-specific `stanceExtension`. ~6 effects.
- **Aura / target-state condition primitives** — `enemyAffectedByCryo`/`enemyFrozen`/etc. exist as `CustomConditionKey` but currently always evaluate to null. Razor C2 (enemy HP < 30% conditional CR), Yanfei A1/A4 (enemy HP < 50%), Eula A4 (Lightfall Sword enemy HP < 50%), Ayato C1 (target HP ≤ 50%), Kaeya A4 (Cryo aura), Chongyun C4 (Cryo aura), Keqing C2 (Electro aura), Kuki A4 (HP-drain trigger). ~10 effects. Need `targetHpBelow: N` condition primitive + aura state resolution.
- **Periodic / runtime-state poll primitive** — Shenhe A1/C2 (every 18f field-presence check), Diona C6 (every 30f HP check), Tighnari A4/C1/C2 (permanent stat mods recalc every 30f), Nahida A4 (a4Tick), Chevreuse C6 (per-heal-tick). Could mostly fold into `passive` trigger with documented imprecision (the buff renders unconditionally; gating is approximate). ~15 effects — may not need a new primitive at all if we accept the imprecision.

---

## Stacks condition handoff (cold-start ready) — STATUS UPDATE

**Both paths shipped.** Path B (user-asserted `{key:N}`) shipped 2026-05-08; Path A (parser-tracked `gainStacks` Effect) shipped 2026-05-10 as v1 (onCast dispatch only). Linnea C1 Field Catalog is the Path A reference migration; v1.5 (reaction-event accrual) and v2 (drain) remain open — see [E3 Hand-off](e3-handoff.md). The historical Path A vs Path B framing below is preserved as design-decision context.

---

**Goal:** Migrate Heizou (4-stack Fudou Punch) and Yanfei (Seal-loaded CA) off the `state: inStance` overload, and unblock Escoffier / Mualani / Neuvillette from authoring stack-gated abilities.

### The problem

The schema today has no way to express "this ability is gated on N or more stacks of resource X." The recipe-tier-b workaround was `state: inStance` as the closest existing condition — which is wrong (different mechanic) and conflicts with characters that have both a stance AND a stack-gated ability.

### The two design paths

**Path A — Parser-tracked stacks (more faithful):**

- Add an effect type `gainStacks` on abilities/normals (e.g. Heizou N1-N4 each emit `gainStacks: { key: "declension", amount: 1, max: 4 }`).
- Parser maintains `stacks: Map<charId, Map<key, count>>` and increments on relevant casts/hits.
- Ability has `conditions: { type: "stacks", key, min }` to gate.
- Pros: faithful to game; enables visualizing stack accumulation over the rotation.
- Cons: significant new parser state; needs UI (otherwise stack counts are invisible).

**Path B — User-asserted stacks (lighter, recommended):**

- Add a new input token form like `{4}C` or `+4 C` that asserts stack count at that point.
- Or simpler: add a per-character "stack mode" notation prefix (`Heizou stacked C`, `Heizou hC`).
- Loaded CA ability has `conditions: { type: "stacks", key, min }`; the parser resolves to the loaded variant only when the user has asserted enough stacks.
- Pros: lighter implementation; matches the constitution ("the user types choreography, not state").
- Cons: less faithful; the planner doesn't _show_ whether the rotation actually generates enough stacks.

**Recommended: Path B.** The constitution leans toward "windows not numbers." Stacks are choreography input, not derived state. Path A would drift toward calculation territory (stack accumulation = "how much damage did N1-N4 generate"). Path B keeps the planner honest: the user asserts they have stacks, the planner shows the loaded variant fires.

### Implementation steps (Path B)

1. **Schema**: add `{ type: "stacks"; key: string; min: number; max?: number }` to `Condition` union in `src/lib/types/ability.ts`.
2. **Notation**: pick the user-assertion syntax. Options:
   - `Heizou {seal:4} C` — explicit key + count
   - `Heizou +seal +seal +seal +seal C` — incremental
   - `Heizou stacked C` — mode-style (per-character, less general)
   - **Recommended**: `Heizou {seal:4} C` — explicit and self-documenting.
3. **Tokenizer**: add a `{key:N}` token kind that opens/sets a stack count. Resets at swap or segment-end (mirroring `normalCounter`).
4. **Parser**: thread `stackState: Map<charId, Map<key, count>>` through `evalCondition` (similar to `chainIndex`). New context arg or extend the existing pattern.
5. **`evalCondition`**: handle `stacks` — return `true` iff `stackState.get(charId)?.get(cond.key) ?? 0 >= cond.min` (and `<= cond.max` if specified).
6. **Migration**: Heizou's 4-stack Fudou Punch and Yanfei's Seal-loaded CA — replace `conditions: { state: "inStance" }` with `conditions: { type: "stacks", key: "declension"|"seal", min: 4 }` (or whatever).
7. **Lint**: tighten check #18 from `warn` to `strict` (no more `inStance` on non-stance characters).
8. **Tests**: add parser tests for Heizou (`{seal:4} C` resolves to loaded; `C` alone resolves to base).
9. **Docs**: update `docs/curation/tier-c-guide.md` — move stacks from "deferred" to "available," add reference characters.

### Files that will touch

- `src/lib/types/ability.ts` — Condition union extension.
- `src/lib/utils/tokenizer.ts` — new token kind for `{key:N}`.
- `src/lib/utils/notationParser.ts` — stackState plumbing, `evalCondition` extension.
- `src/lib/utils/notationParser.test.ts` — Heizou/Yanfei tests.
- `src/lib/utils/characterLint.ts` — tighten check #18.
- `src/lib/data/characters/shikanoin_heizou.json`, `yanfei.json` — migrate off `inStance` overload.
- `docs/curation/tier-c-guide.md` — schema feature table update.

### Open design questions to resolve at start

- **Tokenizer syntax**: `{key:N}`, `+key×N`, character-mode prefix, or something else? Decide before implementing the tokenizer change.
- **Default key**: should `{4} C` (no key) work for characters with a single stack type? Or always require explicit key? Probably always explicit; ambiguity is worse than verbosity.
- **Stack reset**: does swap reset stacks? In-game it varies (Heizou stacks persist; Yanfei seals consumed by full CA). Probably the answer is "user asserts each time" — stacks don't decay automatically in our model.

### Why this is its own session

Path B is ~half the work of P2 (chainStage) but it touches the tokenizer, which has its own footgun history (see `bug_multiword_name_and_crash.md`). Doing it as a focused session minimizes risk of churning notation syntax later.

## Things considered and rejected

- Removing legacy `behavior: "persistent"` — accessors handle it; 100+ stubs still use it; cleanup can be a later pass.
- Code-DSL for character authoring — JSON-as-data + external generator suits how the data is authored and survives engineer turnover.
- Formal token grammar — current tokenizer/parser is the right complexity for the language size.
