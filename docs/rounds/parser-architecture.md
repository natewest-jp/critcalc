# Notation parser architecture: key decisions (post-P4, 2026-07-17)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Refreshed 2026-07-17 after the P4 event-stream refactor merged (`70daaec`); updated same day for the post-P4 #1/#3 sessions (`5e280f5`, `cd48921`), the sQ primitive (`5e962ad`), and post-P4 #2 action-level events (branch `feat/action-events`, `ff8b23f`..`c4bf96a`).** For design rationale, execution model, and residual hazards see `docs/rounds/p4-event-stream-plan.md`; spec + backlog statuses in `docs/rounds/p4-event-stream-plan.md`.

`src/lib/utils/notationParser.ts` is a pure function (`parseNotation`) — no store imports, no side effects. Returns:

```ts
{ tracks, totalDuration, unknownTokens,
  events: TimelineEvent[],      // time-sorted points: cast | action | reaction | shieldEnd — each with a stable per-parse `id`
  windows: TimelineWindow[] }   // finalized spans: state | summon | shield | weaponProc — `sourceCastId` (cast-opened) / `sourceActionId` (action-opened) provenance
```

**Action events (post-P4 #2, 2026-07-17):** per-SWING for normals — an `N5` token emits 5 `ActionEvent`s sharing a `blockId` (= the anchor event's id; anchor ⇔ `id === blockId`), each with `comboIndex` (`normalCounter % hits.length`) + `duration` + optional `element` (present ⇔ elemental; the block-kind projection key) + `abilityId` (resolved NormalAbility). One event each for charged/plunge/dash/jump/unset; an unresolvable plunge (no frames) emits NO event. **SUBSTRATE-ONLY: actions emit no hits — onHit dispatch/aura/gainStacks stay E/Q-cast-only** (wiring them is an open follow-up). `track.inputBlocks` are now **finalize projections** of cast events (`{time, castTime, [label], ability}`) + action groups (durations summed in id order — bit-identical to the old inline emission; guarded by a permanent independent-reconstruction invariant in ir.test.ts, the summon-window pattern). `emitBlock` is GONE. `TimelineBar` carries `abilityId` (bijection-guarded), and `findSummonForBar`/`findCastSummon` prefer the exact resolved ability — a state-gated sibling ability can carry its own summon (Durin's two bursts). `computeNBBars(events, catalystIds, natlanCount)` — no `tracks` param; catalyst triggers are ANCHOR action events only (per-token cadence preserved; per-swing triggering is a deliberate non-change).

**Per-action state opener (generalized sQ primitive):** `actionOpensState {normal?, plunge?}` on NormalAbility replaced `plungeOpensState` (varesa migrated); `TransientStateSpec` gained `consumes?: State[]` (close named windows at open — mode displacement, gcsim DeleteStatus). One shared `openTransientState`/`closeStateWindows` helper pair serves the instant-cast site, variant `consumesState`, the plunge landing, and the normal first-swing opener (fires ONCE per N token, token-start state snapshot, no per-swing re-resolution). Durin's dual-form rides this: tap E opens `transmuting` 6s; gated skill commits White (`whiteForm`), gated normal commits Dark (`darkForm` gates the separate Dark burst); States union + lint STATES carry transmuting/whiteForm/darkForm (+ backfilled symphonyWindow/apexDrive) and lint has a strict `transient-state-spec` vocabulary check.

**No `stance` window kind (post-P4 #4, `80ef4dc`):** stance casts emit `state` windows named `inStance` with `source` = the opening cast kind — the ONLY state windows carrying `source` (invariant-guarded). `opensState: "inStance"` on data is redundant and skipped parser-side. Consumers wanting "the cast's active span" filter `(kind === 'state' && name === 'inStance') || kind === 'summon'` — the name filter matters because opensState companions share the `sourceCastId` but never receive extension deltas.

IR types live in `src/lib/utils/rotationEvents.ts` (re-exported from the parser). The pre-P4 fields `reactionEvents`/`hitEvents`/`shieldEndEvents`/`weaponProcBars` are GONE. **Hit records are parser-private** (post-P4 #1 decision stands) but are now PER-SWING (post-P4 #5, 2026-07-17): every E/Q cast AND every normal swing/charged/plunge emits a `HitEvent {characterId, time, abilityType, element?, damageTag, abilityName?, hitIndex?, stacks?, sourceEventId}` — cast hits at castStart, action hits at swing END (`per-swing = one hit` is the ratified multi-hit convention; element absent ⇒ physical). The type is exported for `buffWindows.ts` only, never on ParsedRotation.

**Post-P4 #5 (2026-07-17, branch `feat/onhit-buff-windows`):**

- **onHit dispatch is FULL SYMMETRIC:** `dispatchGainStacksOnHit` (all decay shapes) + `dispatchConsumeStacksOnHit` fire per hit through `onHitTriggerMatches` (abilityType single-or-ARRAY = one shared procCooldown clock, damageType, evalTriggerFilter w/ per-swing hitIndex/element). `source:'self'` grants write the SEGMENT stackState (swap clears — Yanfei seals); team/others accrue rotation-wide (`CharState.onHitStacks`/`onHitStackInstances`, synced by `syncOnHitToStackState` — APPENDED to the cast settle order, never reordered; lint `gainstacks-onhit-unbounded` requires a decay shape). `Effect.procCooldown` gates per `${nodeId}#${effIdx}` (`CharState.onHitProcLastFire`). Action-site hits settle via `settleStacksAt` (= cast settle minus dispatchShieldEnds), gated on `teamHasOnHitStackEffects` so corpus drain anchoring stays float-identical. `holderStatesAt(holder, t)` resolves ANY holder's states at hit time with a following-summon-aware `duringSummon` (Escoffier C6's gate; broader than `inferredStates`, scoped to onHit eval only).
- **Buff windows:** `deriveBuffWindows` (`src/lib/utils/buffWindows.ts`, finalize step 8, AFTER the event/window sorts) emits `buff` TimelineWindows for ALL who-buffs-whom-when: character onCast/onHit/afterDuration/onReaction pools, N/CA/P per-swing hits WITH refresh-merge (overlapping same-shape hits extend one window — Flins C2), NB, artifact 4pc, weapon swap-proc ICDs, active-target slices with CONCRETE receivers (pre-sliced at swap boundaries; `receiverId` present ⇔ received-surface). Windows carry effects + trigger-time context (stackContext/refinementIndex/ramp/decay/poolFirstEffect) + provenance; display strings stay in `buffDisplay.ts`. `teamBuffRows`/`charReceivedBuffRows` are ~140-line group+format projections ordering by window emission `id` (byte-parity to the deleted legacy was proven pre-flip). `effectCollection.ts` moved to `src/lib/utils/`.
- **NB events:** `nightsoulBurst` public event kind (greedy 18/12/9s clock, catalyst anchor triggers); `nbRows.computeNBBars(events)` is a filter. `parseNotation` param 6 `teamCharacters?: (CharacterData|null)[]` = the slot roster (NB + buff team context; falls back to notation-derived team).
- **Module cycle note:** notationParser ⇄ buffWindows is benign (hoisted function exports only).

## IR semantics (load-bearing invariants — guarded by `notationParser.ir.test.ts`)

- **Bars are PROJECTIONS (post-P4 #3):** `CastEvent` carries the full geometry (`uptime`/`cooldown`/`readyAt`/`summonActivatesAt`/`sacProcFired`); `track.eBars`/`qBars` are built at finalize from the cast records AFTER extension uptime stamps land on the events. Bijection + field agreement hold by construction and are asserted corpus-wide. `StanceRecord.castRef`/`SummonExtRecord.castRef` point at the EVENT (no bar refs mid-parse); `inferredStates` (duringSummon) reads cast events.
- Event `id`s are unique per parse (emission order); every cast-opened window's `sourceCastId` resolves to a same-character cast at/before the window start, every action-opened window's `sourceActionId` to a same-character action likewise; at most one of the two is set (invariant-guarded). `teamBuffRows` joins afterDuration windows to casts on `sourceCastId`.
- **sQ / transient states (2026-07-17):** variant matching is condition-aware (`matchVariant` — requires definitively-true variant `conditions`; parser builds team faction/element context). `opensTransientState` (instant casts) + `actionOpensState.{normal,plunge}` (action's end, post-P4 #2) open short `state` windows; spec `consumes` closes named windows at open; variant `consumesState` clamps them at cast; variant `bypassesCooldown` skips the burst-clock gate AND write (Flins Symphony) while default variants gate on + write the shared clock with their own cooldown (Varesa Kablam, 1s). Burst timing resolves against `tok.text` (no more hardcoded 'Q').
- `cast.fieldStart = time + (summonActivatesAt ?? 0)/60`; `cast.stackContext` is the same snapshot stamped on the bar; `cast.abilityId` is the RESOLVED variant (= E-charge-queue key).
- **Windows are records with FINAL ends** (extensions/swap/recast truncation pre-applied), not open/close pairs — extensions retroactively move ends during parsing, so pairs were the wrong shape.
- **Stance windows are `[castStart, castStart+dur]` — NO spawn offset** (Nilou E has `summonActivatesAt: 161` but inStance starts at cast). Summon windows DO include the offset. Don't mix these up.
- Summon windows exist for every cast-spawned summon; swap-out truncation uses next-different-characterId, proven ≙ summonSubrows' old next-different-slotIdx (invariant commented at both sites).

## Parser state model (post-P4)

- **`charStates: Map<charId, CharState>`** (get-or-create via `getCharState`) holds per-character state: `qReadyAt` (−Infinity = never cast), `sacProcReadyAt`, `stance?: StanceRecord` (end/terminatesOnSwap/ownerAbility/barRef/ownerUptime/extCounts/extLastFire), `states: Map<name, endTime>`, `chains`, `summonExt?: SummonExtRecord`, `shields[]`, `shieldEndProcCooldown`, and the rotation-wide stack clusters (`onReactionStacks`/`onReactionStackInstances`/`sourceLifetime`/`drainAnchors`).
- **`eChargeQueues: Map<abilityId, number[]>` deliberately stays OUTSIDE CharState** — keyed by ability id so stance characters keep independent per-variant charge queues (Cyno base E 7.5s vs Mortuary Rite 3s).
- Per-segment locals: `stackState`, `stackInstances`, `normalCounter`, `lastEText`.
- Window records opened during parsing are also retained in parser-scope collections (`stanceWindowRecs` etc.); extensions/swap-close mutate the SAME record objects, so the collections stay current for finalize.

## The unified cast pipeline — `handleCast(kind: 'skill'|'burst', tok, j)`

ONE handler for E and Q (P4 replaced the drifting twins). Canonical shared order — do not reorder, this is the historical bug class:

settle cursor → `dispatchShieldEnds` → `computeCurrentStates` → `applyDrain` → `applyLifetimeExpiry` → `syncSourceLifetimeToStackState` → `syncOnReactionToStackState` → chainIdx → `resolveActiveAbility` → timing resolution → `dispatchGainStacks` (pre-snapshot) → stack snapshot + bar push + **cast event** → `dispatchConsumeStacks` (post-snapshot) → CD write → `emitBlock` → advance → `advanceChain` → stance-open → summon-ext registration → `registerShieldOnCast` → `emitReactionsAtCast` → `dispatchOnCastExtensions`.

Kind asymmetries (the COMPLETE list): Q settles via scalar `cs.qReadyAt` max; E settles via a ≤8-iter forward scan that re-resolves the active variant at each boundary (a CD wait can cross a stance window and flip WHICH ability casts). Q writes CD before emitBlock; E defers `queue[0]` write until after the Sacrificial proc check (proc retargets ready-at to hitmark). Weapon sac-proc is E-only; character cdReset targets (Kazuha C1 Q→E refund, `Math.min` so a ready charge never gets pushed later) is Q-only; `lastEText` (plunge-variant selection) is E-only; fallbacks are Q 15s / E 12s bare-charId queue.

## Finalize pass (end of parseNotation, search "P4 finalize")

1. Stamps owner-bar `uptime` from stance/summonExt records (`ownerUptime`) — extension dispatchers NEVER touch bars mid-parse anymore. ⚠️ `inferredStates` reads `bar.uptime` mid-parse (duringSummon detection) and sees the un-extended value — inert today, commented latent trap.
2. Authors all `windows` (stance/state/shield/weaponProc from records; summon windows from bars × `findSummonForBar` with truncation).
3. Stable-sorts `events` by time.

- `ownerUptime` ≠ `end` on swap-terminated stances: bar keeps full width, window end clamps to swap-out.

## Renderer projection layer (`src/lib/timeline/` — all pure, all tested)

`RotationTimeline.svelte` is the ONLY production consumer of `parseNotation`. It projects `rotation.events` into `castEvents`/`reactionTimelineEvents` $deriveds and feeds the modules:

| Module                                                 | Consumes                                       | Notes                                                                                                                                                              |
| ------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `teamBuffRows` (`projectTeamBuffRows`)                 | `buff` windows (receiver-less) + getCharacter  | group+format only (post-P4 #5); rebuilds legacy row keys/labels, orders by window emission id                                                                      |
| `charReceivedBuffRows` (`projectCharReceivedBuffRows`) | `buff` windows (receiverId set) + getCharacter | group+format only; weapon labels via getWeaponById                                                                                                                 |
| `summonSubrows`                                        | summon windows + annotatedTracks               | `computeSummonTicks` (tick markers) stays renderer-side by design                                                                                                  |
| `nbRows` (`computeNBBars`)                             | `nightsoulBurst` events                        | pure filter (post-P4 #5); derivation lives in the parser                                                                                                           |
| `moonsignRows`                                         | cast events                                    | 20s window per cast for non-Moonsign slots                                                                                                                         |
| `weaponProcRows`                                       | weaponProc windows                             |                                                                                                                                                                    |
| `barPhases`                                            | a TimelineBar + hasSummon                      | the three-case E/Q pill geometry (sacProc / stance / single-phase + ghost CD) — SHARED by the Svelte template and `timelineExport.ts`; change it in one place only |
| `effectCollection`                                     | char data + cast events/blocks                 | `resolveCastContext` takes `{label}`                                                                                                                               |

**Frozen contracts:** `evalCondition`/`ConditionContext`/`ChainIndex` signatures (imported by timeline modules + `constellationFilter.ts`). `timelineExport.ts` consumes a component-built snapshot mixing raw bars (via barPhases) + derived rows; its colors mirror the Svelte CSS (keep in lockstep).

## Still-accurate pre-P4 mechanics (unchanged by P4)

- **Cooldown model:** Q single scalar per char; E sorted ready-at queue per abilityId, each charge independent; both persist across segments. Sac proc fires onHit; `consumedReadyAt` computed BEFORE the proc check.
- **Condition pipeline:** `evalCondition` → true/false/null (null = unresolvable runtime state; state conditions never return false). Variant modifier arrays REPLACE base arrays, never compose. `DEFAULT_ASCENSION = 4`.
- **N-token:** `N5` = 5-normal loop from `normalCounter` (wraps `% hits.length`); resets at segment start, stance open, and every non-normal action. Bracket expansion (`2[N5C]`, `[..]x3`, ranges) pre-expands action tokens. D/J = 21f movement blocks. P reads `plungeVariants` matched by `lastEText`.
- **Reaction emission (cast-only aura model):** rotation-wide `AuraState`, no decay; `emitReactionsAtCast` fires AFTER stance/summon registration (so this cast's reactions can extend the just-opened window) and BEFORE aura mutation (cast sees pre-cast aura). Cast-start arg is plain `castStart` since P4 Phase 4 (the legacy 1-ULP E-handler rounding was normalized away).
- **Behavior-aware accessors** in `ability.ts` (`getActiveDuration`, `getPrimarySummon`, `resolveStanceFields`, …) absorb the instant/persistent/stance narrowing — use them, don't inline-narrow.
