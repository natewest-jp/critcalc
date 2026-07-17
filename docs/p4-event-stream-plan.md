# P4 — Parser Event-Stream Refactor: Design + Migration Spec

**Status:** ACTIVE (branch `refactor/p4-event-stream`, kicked off 2026-07-17).
**Baseline:** 995 vitest tests green on `main` at branch point.
**Goal:** `parseNotation` emits a first-class IR (`events: TimelineEvent[]` +
`windows: TimelineWindow[]`, types in `src/lib/utils/rotationEvents.ts`);
the rendering layer becomes a pure projection of that IR instead of
re-deriving windows from bar geometry. Scope-adds ratified with P4:
unify the E/Q cast handlers; replace parallel `Map<charId,…>` parser state
with per-character state objects.

**Non-goals (explicitly out of scope):**
- No new gameplay modeling. Zero behavior change outside the phases' stated
  refactors — every phase must keep the full suite green.
- Summon tick computation stays renderer-side (`computeSummonTicks` in
  `summonSubrows.ts` is pure + tested). A `tick` event kind can fold in later.
- Tier-2 schema work (reactions/elevation) is FROZEN by Nate — do not touch.

**Gates for EVERY phase commit:** `npx vitest run` && `npm run check` &&
`npm run lint`. One commit per phase, message prefix `refactor(p4):`.
Line numbers below were surveyed 2026-07-17 and are approximate — verify
against live code before editing.

---

## The IR (authored, committed with this doc)

See `src/lib/utils/rotationEvents.ts`. Two output surfaces on `ParsedRotation`:

- `events: TimelineEvent[]` — time-sorted point events:
  `cast` (NEW — one per resolved E/Q cast) plus the three existing arrays
  folded in as `reaction` / `hit` / `shieldEnd`.
- `windows: TimelineWindow[]` — span records with FINAL end times
  (`stance` / `state` / `summon` / `shield` / `weaponProc`). Windows are
  records, not open/close pairs: extensions retroactively move ends during
  parsing, and every consumer wants spans.

During migration the legacy fields (`reactionEvents`, `hitEvents`,
`shieldEndEvents`, `weaponProcBars`) remain populated — from Phase 2 onward
they are **filtered views of the IR** so consistency holds by construction.
They are deleted in Phase 4.

---

## Phase 0 — Per-character state objects (mechanical, no behavior change)

**Problem:** `parseNotation` threads ~18 parallel `Map<charId, …>`s; the
2026-07-05 bug sweep showed order-of-operations across them is the parser's
top bug class.

**Change:** introduce one `CharState` record per character,
`charStates: Map<string, CharState>` with a `getCharState(charId)`
get-or-create accessor. Fold in (current decls near notationParser.ts:1573–1840):

| Cluster | Today | Becomes |
|---|---|---|
| Q cooldown | `qReadyAt` | `cs.qReadyAt: number` |
| Sac ICD | `sacProcReadyAt` | `cs.sacProcReadyAt: number` |
| Stance | `stanceWindows`, `stanceTerminatesOnSwap`, `stanceOwnerAbility`, `stanceQBarRefs`, `extensionCounts`, `extensionLastFire` | `cs.stance?: StanceRecord` (end, terminatesOnSwap, ownerAbility, barRef, extCounts: Map<number,number>, extLastFire: Map<number,number>) |
| Named states | `stateWindows` | `cs.states: Map<string, number>` |
| Chains | `chainPositions` | `cs.chains: Map<'skill'\|'burst', {index, expiresAt}>` |
| Summon extensions | `summonExtensionOwners` | `cs.summonExt?: SummonExtRecord` |
| Shields | `shieldWindows`, `shieldEndProcCooldown` | `cs.shields: {ability, endTime}[]`, `cs.shieldEndProcCooldown: Map<string, number>` |
| Rotation-wide stacks | `onReactionStackState`, `onReactionStackInstances`, `sourceLifetimeState`, `drainLastUpdate` | `cs.onReactionStacks`, `cs.onReactionStackInstances`, `cs.sourceLifetime`, `cs.drainAnchors` |

**Deliberately unchanged:**
- `eChargeQueues` stays keyed by **abilityId** (stance characters keep
  independent charge queues per skill variant — Cyno). Document this with a
  comment at the decl.
- `weaponProcBars` (an output), per-segment locals (`stackState`,
  `stackInstances`, `normalCounter`, `lastEText`), `cursor`, `auraState`,
  team scaffolding.

**Acceptance:** pure renaming/re-grouping — control flow, evaluation order,
and all outputs byte-identical. Full suite green. No exported-type changes.

---

## Phase 1 — Unify the E and Q cast handlers

**Problem:** two ~200-line near-twins (Q at ~:2320–2508, E at ~:2509–2755)
that have drifted before (bug-sweep #5 fixed E by copying Q's ordering).

**Change:** one cast pipeline (e.g. `handleCast(kind: 'skill' | 'burst',
tok, …)`) executing the shared step sequence **in exactly the current
shared order**:

settle cursor (kind-specific, below) → `dispatchShieldEnds` →
`computeCurrentStates` → `applyDrain` → `applyLifetimeExpiry` →
`syncSourceLifetimeToStackState` → `syncOnReactionToStackState` →
`getChainIndexMap` → `resolveActiveAbility` → `resolveEQCastTime` /
`resolveAbilityTiming` → `dispatchGainStacks` → stack snapshot + **bar push**
→ `dispatchConsumeStacks` → **CD write (kind-specific)** → `emitBlock` →
advance cursor → `advanceChain` → stance-open → summon-extension
registration → `registerShieldOnCast` → `emitReactionsAtCast` →
`dispatchOnCastExtensions`.

**Kind-specific steps (the complete asymmetry table — nothing else differs):**

| Step | Q (burst) | E (skill) |
|---|---|---|
| Cursor settle | `Math.max(localCursor, cs.qReadyAt)`; no re-resolution | forward-scan wait loop (≤8 iters) re-resolving the active variant at each candidate cursor; lazily inits per-ability charge queue via `resolveEffectiveCharges` |
| CD write | `cs.qReadyAt = castStart + cooldownStartDelay/60 + cd`, written **before** emitBlock | `queue[0] = consumedReadyAt` then sort, written **after** the sac-proc check (proc may retarget it) |
| Weapon sac-proc (cdReset) | — | onHit proc: override `consumedReadyAt = hitTime`, push weaponProcBars, set `cs.sacProcReadyAt`, flag `bar.sacProcFired` |
| Character cdReset targets (Kazuha C1) | refunds own `eChargeQueues` / `qReadyAt` after cast | — |
| `lastEText` | — | set to `tok.text` after emitBlock (plunge-variant selection) |
| No-ability fallback | generic 15s-CD bar, `qReadyAt = cursor + 15` | single-charge queue keyed by bare charId, 12s CD, still sets `lastEText` |

Also **normalize the cast-start argument**: capture `const castStart =
localCursor` before advancing; pass it to `emitReactionsAtCast` /
`dispatchOnCastExtensions` for both kinds (today Q passes captured `qStart`,
E passes `localCursor - eCast` — same value, computed differently).

**Acceptance:** full suite green — the roster-wide parser-invariant sweep
(`notationParser.roster.test.ts`) is the real net (drives Hold/tap variants
corpus-wide, asserts no-throw / all-finite / hold≠tap timing). Outputs
byte-identical. The unified pipeline must read as ONE sequence with small
kind-branches, not two functions glued together.

---

## Phase 2 — Emit the IR

1. `ParsedRotation` gains `events: TimelineEvent[]` and
   `windows: TimelineWindow[]` (import types from `rotationEvents.ts`;
   re-export from notationParser for consumer convenience).
2. **Cast events:** emit one `cast` event per E/Q bar push (in the unified
   handler — single site). `abilityId` = resolved variant's id; `label` =
   `tok.text`; `fieldStart` = `time + (summonActivatesAt ?? 0)/60`;
   `stackContext` = the same snapshot stamped on the bar.
3. **Fold legacy events:** `emitReactionsAtCast` / hit emission /
   `dispatchShieldEnds` push into `events`; the legacy
   `reactionEvents`/`hitEvents`/`shieldEndEvents` returned fields become
   filtered projections of `events` built at return time (consistency by
   construction). Keep legacy field shapes identical.
4. **Window records become the SoT for span ends.** The Phase-0
   `StanceRecord` / state-map entries / `SummonExtRecord` / shield entries
   grow into (or produce) `TimelineWindow` records: opened at cast, `end`
   mutated by extension dispatchers, clamped by swap-close, pushed to
   `windows` at finalize. Summon windows: emit one per cast-spawned summon
   (spawn offset applied) — including summons WITHOUT durationExtensions
   (today only extension-bearing summons get parser records; the window
   registry must cover every `summons[0]` cast bar so consumers can drop
   geometry math). Apply the same end rules summonSubrows.ts applies today
   (terminatesOn swap/recast truncation) — port that logic parser-side.
   `weaponProc` windows mirror weaponProcBars.
5. **Kill the bar back-channel:** extension dispatchers stop mutating
   `bar.uptime` / stance-bar refs directly; at finalize, stamp
   `bar.uptime = record.end - record.fieldStart` for stance/summon owner
   bars from their window records. (`barRef` may live inside the record for
   the finalize stamp; nothing else touches bars post-push.)
6. **Invariant tests (new file, corpus-driven like the roster sweep):**
   - `events` sorted by time, all times finite; `windows` all `end >= start`.
   - Legacy arrays === filtered `events` projections (deep-equal).
   - Every eBar/qBar ↔ exactly one `cast` event (matching time/label/kind).
   - Every stance/summon owner bar's `start + offset + uptime` === its
     window's `end` (geometry agrees with records).

**Acceptance:** full suite + new invariants green. Renderer untouched.

---

## Phase 3 — Consumer migrations (one commit each, in this order)

Consumers stop walking bar geometry and read the IR. `evalCondition` /
`ConditionContext` signatures are a public contract — unchanged.

- **3a `moonsignRows.ts`:** replace eBars/qBars `.start` walks with `cast`
  events filtered by characterId. Tests updated to feed events.
- **3b `computeNBBars` → `src/lib/timeline/nbRows.ts`:** extract the inline
  Nightsoul-Burst derivation (RotationTimeline.svelte ~:324–353) into a
  tested pure module consuming `cast` events (+ `inputBlocks` for the
  catalyst-normals case, unchanged). New test file.
- **3c `summonSubrows.ts`:** consume `summon` windows (spawn/end/truncation
  now parser-authoritative); keep `computeSummonTicks` and condition gating
  as-is, fed by window spans. Delete the local spawn/end reconstruction.
- **3d `totalDuration`** (RotationTimeline.svelte ~:602–631): compute from
  IR extents — max over `windows[].end`, `events[].time`, track ends, and
  bar `start + cooldown` (ghost-CD tails still extend the axis).
- **3e Shared `barPhases()` helper** (new, `src/lib/timeline/barPhases.ts`):
  the three-case E/Q pill geometry (sacProc / stance / single-phase +
  ghost-CD split) currently duplicated in the Svelte template (~:1314–1563)
  and `timelineExport.ts` (~:316–364). One pure function of
  `(bar, hasSummon)` returning phase segments; both consumers project it.
  Visual output must be pixel-identical — compare a PNG export before/after
  on a reference rotation (e.g. `Furina E Q > Bennett E Q ~5s`).
- **3f `teamBuffRows.ts`:** replace per-bar walks with `cast` events
  (label/abilityId/fieldStart/stackContext all carried) + `windows` for
  afterDuration ends. `resolveCastContext` moves from `(bar)` to
  `(castEvent)` input. reactionEvents parameter → `reaction` events.
- **3g `charReceivedBuffRows.ts`:** same treatment as 3f.

**Acceptance per step:** module tests updated to construct IR fixtures;
full suite green; no visual change (3e explicitly verified).

---

## Phase 4 — Cleanup

- Delete legacy `reactionEvents` / `hitEvents` / `shieldEndEvents` /
  `weaponProcBars` fields; migrate remaining readers (weaponProcRows → 
  `weaponProc` windows; parser tests → IR assertions).
- Delete dead reconstruction code paths surfaced by 3a–3g.
- Update `CLAUDE.md` (parser section) + project memory.

---

## Risk register

- **Order-of-operations is the historical bug class** (bug-sweep 2026-07-05:
  E-handler eval-before-wait, stance-extension gates, reset scoping). Phases
  0–1 must not reorder ANY shared step. When in doubt, match Q's ordering —
  that's the reference the E fix copied.
- **Keyed `{#each}` blocks** in RotationTimeline: render keys are coarser
  than dedup keys in places (archived bug lesson). 3b/3e touch the template —
  do not change existing keys.
- **`evalCondition` / `ConditionContext` / `ChainIndex`** are imported by
  timeline modules + `constellationFilter.ts` — public contract, frozen.
- **Never statically import notationEditor** from planner-reachable code
  (perf constraint; irrelevant to these files but stated for safety).
- The parser stays **pure and runtime-import-free** (Node scripts execute
  sibling modules directly; no store imports).
