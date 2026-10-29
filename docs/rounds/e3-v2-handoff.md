# E3 v2 hand-off: drain semantics for auto-tracked stacks (2026-05-11)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

## Status — v0.1 SHIPPED 2026-05-11 (`7ed34ff`)

**What landed:** `gainStacks.drain?: { ratePerSecond, state }` schema field. Parser closure-scoped `drainLastUpdate: Map<charId, Map<key, number>>` anchors decay timing per (character, key); `applyDrain(char, cursor, currentStates, stackState)` is called at the top of each E and Q handler before any read of stackState. Two regimes:

- **State active**: decay = `ratePerSecond × (cursor - lastUpdate)`, clamped to 0; `lastUpdate` advances to `cursor`.
- **State inactive (settled)**: if `lastUpdate` is present, decay up to the recorded state-end time (`stanceWindows` for `inStance`, `stateWindows` otherwise) so post-state snapshots reflect the value the resource drained to before the state expired. Then clear the anchor; future state-reopen casts re-seed via `dispatchGainStacks`.

`dispatchGainStacks` (and the `onReaction` variant) anchor `lastUpdate = castTime` after adding stacks for any effect with a `drain` field. Convention: declare drain on the FIRST gainStacks effect that introduces the key (Iansan E carries drain spec; Iansan Q is pure +15 grant). The parser looks up the drain spec by key, so duplicating it across effects would create contradiction risk.

**Iansan migration:** E gainStacks(`nightsoul`, +54, max 54, drain 6/sec while `nightsoulBlessing`) + Q gainStacks(`nightsoul`, +15, max 54). Burst's flat-ATK effect remains `value: unknown` — the NS<42 vs NS≥42 threshold-formula switch is still deferred (out-of-scope primitive).

**Tests (244 total, +6 new):** synthetic DrainStub validates: full-grant snapshot when state opens after cast, drain decays in-state across cast gaps, settle-after-state-expires (stops at stateEnd not at cursor), re-grant after expire (anchor cleared), saturation at 0 (no negative values), no-op for keys without drain spec.

**Lint added:** `gainstacks-drain-rate-invalid` (rate must be positive finite), `gainstacks-drain-state-invalid` (state must be a known State).

---

## What's still open (v2.x)

| Char                                              | Open piece                                                                                                                                                                    | Why deferred                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~**Skirk** A4 (Death's Crossing)~~               | ~~Per-character-source on-team Cryo/Hydro stack accumulator + tiered multipliers~~                                                                                            | **SHIPPED v0.8 (`568b289`)** — Path C (sourceLifetime) + Path Y (HitEvent stream on ParsedRotation) + Path P (per-tier buff effects). C4 ATK% also authored with same per-tier treatment. Known fidelity gap: per-cast HitEvent emission only (NA/CA/plunge with infusion not yet emitting per-hit) — Cryo NAs from e.g. Chongyun/Wriothesley don't currently trigger Death's Crossing.                                        |
| **Skirk** A1 / C1 / C6 (Void Rift / Havoc: Sever) | Void Rifts as gadget-like collectibles spawned by team Cryo reactions; per-rift onAbsorb trigger; Havoc: Sever stacks consumed three different ways (Q-cast, N3/N5 hit, hurt) | Multiple deferred primitives. Hard skip until Sourcewater-Droplet-shape gadgets land.                                                                                                                                                                                                                                                                                                                                          |
| ~~**Linnea**~~                                    | ~~10s stack lifetime on Field Catalog~~                                                                                                                                       | **SHIPPED v0.6 (`d9e2707`)** — added `gainStacks.lifetime?: number`. Parser maintains per-segment `stackInstances` map of expiry timestamps; `applyLifetimeExpiry` runs at every cast event and drops expired instances. Saturation drops oldest first when `+amount` would exceed `max` (matches in-game pool-refresh behavior). consumeStacks operates on instances symmetrically. Mutually exclusive with `drain` per lint. |
| ~~**Linnea C6**~~                                 | ~~6→18 enhanced grant + ×2 / +150% DEF consumption~~                                                                                                                          | **SHIPPED v0.7 (`ea39f94`)** — added `gainStacks.constellationScaling: { conditions, amount }` (new schema, mirrors BuffEffect.constellationScaling). C1 gainStacks gets cons:6 → amount:18; C1 consumer buff gets cons:6 → ratio:150 via the existing-schema BuffEffect.constellationScaling. Both halves modelled with no separate "skip C0 grant at C6" gate (the override fully replaces the base amount at cons:6+).      |
| ~~**Iansan**~~                                    | ~~Burst Kinetic Energy Scale ATK formula~~                                                                                                                                    | **SHIPPED v0.3 (`12b2f21`)** — modelled as two buff effects with mutually-exclusive `stacks` conditions on the `nightsoul` key. NS=1..41 → perStack scaling 0.5%×ATK per stack; NS≥42 → scaling 27%×ATK cap 690. No schema additions needed (existing primitives sufficed). Cap rendering for both branches deferred to a future cap-rendering pass (shared gap with Xianyun/Varesa/Yelan/Nilou).                              |
| **Iansan**                                        | Distance-based NS regen via Scale                                                                                                                                             | Not modelable (no movement-distance primitive). Hard skip.                                                                                                                                                                                                                                                                                                                                                                     |
| **Iansan**                                        | Burst opens NS-blessing from zero (`Q` standalone case)                                                                                                                       | Schema models burst as `behavior: instant`, not stance/opensState. Q +15 grant fires but state doesn't open. Workaround: rotation must lead with E. Acceptable since the dominant rotation does.                                                                                                                                                                                                                               |
| **Hydro Traveler**                                | Suffusion HP-drain accumulator                                                                                                                                                | Different primitive entirely (continuous HP delta + accumulator that releases on Torrent Surge). Out of scope for the stack-drain primitive.                                                                                                                                                                                                                                                                                   |
| **Nefer** (gcsim-PR draft)                        | Verdant Dew + Veil of Falsehood                                                                                                                                               | Pre-release; wait.                                                                                                                                                                                                                                                                                                                                                                                                             |

## v0.2 ship — Skirk SS (2026-05-11)

**Schema additions:**

- `Trigger.onCast.input?: string[]` — cast-input filter. When set, the trigger only fires for casts whose token text is in the list (e.g. `['E']` vs `['hE']`). Absent → fires on any cast of the matching `ability` type. Used by both `gainStacks` (variant-gated grants) and `consumeStacks` (variant-gated consumes).
- `Effect.type === 'consumeStacks'` — new branch with `key: string`, `amount: number | 'all'`. Triggered onCast. Symmetric to `gainStacks`: the parser walks effects matching the cast and decrements (or zeroes for `'all'`); saturates at 0. Fires AFTER the cast's `stackContext` snapshot so the bar reflects pre-consume value (the `perStack` consumer's input); subsequent cursor advances see post-consume `stackState`.
- `BuffValue.perStack.threshold?: number` — non-negative integer offset subtracted from stack count before clamping. `effectiveStacks = min(max(stacks - threshold, 0), maxStacks ?? Infinity)`. Used for "+1% per resource above N" shapes (Skirk: threshold 50, max 12 at C0 / 22 at C2).

**Parser:**

- `dispatchGainStacks(..., castInput?)` accepts the cast token text; trigger.input filter narrows by exact match. Drain anchoring unchanged.
- New `dispatchConsumeStacks(...)` — symmetric helper. Called in both E and Q handlers AFTER the snapshot push.
- Renderer's `formatBuffDisplayValue` extended with threshold semantics + new "+X%/stack over N" suffix when the resource hasn't reached threshold.

**Skirk authoring:**

- `skirk__skill__havoc_warp` — two `gainStacks` effects with mutually-exclusive `trigger.input`: Tap-E (`['E']`) +45 SS with drain 7/sec inStance; Hold-E (`['hE']`) +18 SS no drain (first-spec convention).
- `skirk__constellation__into_the_abyss` (C2) — adds a third `gainStacks` (no input filter, gated on Cons:2) +10 SS on every E cast.
- `skirk__burst__havoc_ruin` — `consumeStacks` (key=serpentsSubtlety, amount='all') + perStack-threshold buff (stat=burstDmgBonus, threshold=50, maxStacks=12, per=1, duration=2.6s for hit window). `constellationScaling` raises maxStacks to 22 at C2.
- `skirk__burst__havoc_extinction` — unchanged. No consumeStacks (in-stance burst doesn't consume); no perStack bonus buff (bound to Havoc: Ruin only). Gating via the `state: inStance` ability condition handles the routing.

**Parser improvement (forward-looking):** terminate-on-swap stance handling now CLAMPS `stanceWindows[char]` and named state windows to `localCursor` (instead of deleting), so future-segment `applyDrain` could settle drain over the actual in-stance window rather than the stale max-duration end-time. This is benign today — `stackState` is per-segment by design, so cross-segment drain settle has no resource to act on — but lays the groundwork if cross-segment stack carry is ever needed for drain-bearing resources.

**Tests (264 total, +20 new):** 7 parser (variant-gating Tap-E vs Hold-E vs C2 mixed; consumeStacks 'all' post-snapshot ordering; consumeStacks not firing without burst; numeric consumeStacks subtract+saturate) + 13 lint (consumeStacks shape × 5; gainStacks trigger.input × 4; perStack threshold × 4 inc. valid case).

**Operational caveats** (also noted in skirk.json curator notes):

- The planner does NOT enforce SS≥50 at burst cast time; a Q with insufficient SS still fires (the bonus buff bar simply doesn't render, since stack-min-51 condition fails).
- `stackState` is per-segment — Skirk users wanting the burst bonus to render must structure E and Q in a single segment (no `>` between them). Cross-segment Q after E would lose the SS carry.
- A4 Death's Crossing multiplier is NOT modelled — at full 3 stacks Skirk's NA dmg is ×1.7 and burst dmg is ×1.6, significant uplift not represented.
- Hold-E SS = 18 per gcsim source; in-game text says 45. Sticking with gcsim per curation convention.

## ⏭ UNBLOCKED 2026-08-31 — the cross-segment carry now has a schema

`gainStacks.scope: 'segment' | 'rotation'` shipped with the summon-tick stacks
round (`docs/rounds/summon-tick-stacks-round.md`; `docs/rounds/summon-tick-stacks-round.md` §10).
A rotation-scoped key lives on `CharState` and is mirrored into the per-segment
pool, so declaring it on Serpent's Subtlety's three `gainStacks` effects would
retire this doc's operational caveat — "Skirk users must structure E and Q in a
single segment; a cross-segment Q after E loses the SS carry".

⛔ **Deliberately NOT done in that round**, and the reason is right below in
"v2.x parser-side gaps": SS is the corpus's one **drain**-bearing key, and
`drainLastUpdate`/`drainAnchors` is ALREADY rotation-level while its pool is
per-segment — so `applyDrain`'s settle-after-state-ends regime has never had a
resource to act on across a swap. That interaction is unmeasured and wants its
own before/after. ⚠️ Also re-check the burst's `consumeStacks: 'all'` and the
fails-open `stacks: { min: 51 }` gate under the new scope before flipping it.
Flagged curator-facing in `skirk.json`'s skill notes.

## v2.x parser-side gaps to keep in mind

- **Drain anchoring on summon-tick triggers** — `dispatchGainStacks` (onCast) and `dispatchGainStacksOnReaction` both anchor `lastUpdate` after a drain-bearing grant. A future `summonTick`-trigger gainStacks (e.g. periodic resource accrual from a summon) would need the same anchoring path. Trivial extension when it lands.
- **Cross-segment drain semantics** — `drainLastUpdate` is parser-level (across segments) but `stackState` is per-segment. The interaction is currently consistent (per-segment-zero stackState makes drain a no-op even with stale anchors), but worth re-checking if a consumer ever gates on cross-segment stack values.
- **No per-segment lastUpdate clearing** — see above. Stale anchors are harmless today; if a drain-bearing key ever needs cross-segment carry, anchor reset in segment setup may need explicit handling.

## Schema convention (canonized)

Declare `drain` on the **first** gainStacks effect that introduces the key. Follow-up grants on the same key (Iansan Q +15) omit the `drain` field — the parser looks up the spec by key. Duplicating the spec across effects creates contradiction risk and is implicitly disallowed (first match wins; lint could be tightened to enforce).

## Reference shape (Iansan, in `iansan.json`)

```jsonc
// On the skill (E):
{ "type": "gainStacks", "target": "self",
  "trigger": { "type": "onCast", "ability": "skill" },
  "key": "nightsoul", "amount": 54, "max": 54,
  "drain": { "ratePerSecond": 6, "state": "nightsoulBlessing" } }

// On the burst (Q):
{ "type": "gainStacks", "target": "self",
  "trigger": { "type": "onCast", "ability": "burst" },
  "key": "nightsoul", "amount": 15, "max": 54 }
```

## v0.3 ship — Iansan burst NS-threshold (2026-05-11, `12b2f21`)

No schema additions. Replaces Iansan's `value: unknown` burst flat-ATK buff with two buff effects gated by mutually-exclusive `stacks` conditions on the `nightsoul` key (key already populated by the v0.1 drain primitive's gainStacks):

```jsonc
// NS=1..41 — linear scaling
{ "type": "buff", "target": "active", "trigger": { "type": "onCast", "ability": "burst" },
  "duration": 12, "durationType": "fixed",
  "conditions": { "type": "stacks", "key": "nightsoul", "min": 1, "max": 41 },
  "source": "character", "stat": "atk",
  "value": { "type": "perStack", "key": "nightsoul",
             "per": { "stat": "atk", "ratio": 0.5 } },
  "snapshottable": false }
// NS≥42 — constant rate
{ "type": "buff", "target": "active", "trigger": { "type": "onCast", "ability": "burst" },
  "duration": 12, "durationType": "fixed",
  "conditions": { "type": "stacks", "key": "nightsoul", "min": 42 },
  "source": "character", "stat": "atk",
  "value": { "type": "scaling", "stat": "atk", "ratio": 27, "cap": 690 },
  "snapshottable": false }
```

Tests (270 total, +6 new): evalCondition coverage for the stacks min/max range pattern at boundaries (stacks=0/20/41/42/54).

**Known gap, NOT addressed in this slice (shared with other characters):** `scaling.cap` is currently metadata-only — `formatBuffDisplayValue`'s scaling branch returns `~ratio% stat` and ignores the cap. `perStack` lacks a `cap` field entirely. Both gaps affect display only (the schema records the cap correctly); fixing them is a small "cap-rendering" pass that would also benefit Xianyun (200% ATK plungeFlatDmg cap 9000), Varesa (cap 20000), Yelan (cap 50), Nilou (cap 30/60), and Flins (cap 160).

## v0.4 ship — cap-rendering pass (2026-05-11, `72489c4`)

Schema: `perStack.cap?: number` mirrors `scaling.cap`. Renderer (`formatBuffDisplayValue` in RotationTimeline.svelte:247-300):

- `scaling`: appends ` (cap N)` suffix when `cap` is present — can't clamp without recipient stat
- `perStack` with plain-number `per`: clamps the displayed total at cap (units match host stat)
- `perStack` with scaling `per`: appends ` (cap N)` suffix — same reason as scaling

Lint: `perstack-cap-invalid` (positive finite when present). 4 new lint tests cover both per shapes + non-positive + non-numeric rejections.

**Discovered (NOT fixed in this slice):** the scaling branch does `Math.round(ratioNum * 100)` which assumes decimal-form ratios (Bennett 0.952 → 95%). Percentage-form ratios overdisplay (Iansan 27 → "2700%", Xianyun 200 → "20000%", Cyno 250 → "25000%"). Corpus authoring is split — ~10 chars use decimal form, ~12 use percentage form. This is an authoring-convention bug at `RotationTimeline.svelte:299` and is independent of the cap addition. Fix is either standardizing all corpus to one form + updating display, or making the formatter heuristic-aware (`if ratio < 1: percent = ratio * 100; else: percent = ratio`). Either path is its own pass.

## v0.5 ship — scaling-ratio display fix (2026-05-11, `0d8461a`)

`formatBuffDisplayValue`'s scaling branch now treats `ratio` as percentage points directly (display: `~{ratio}% {stat}`) instead of multiplying by 100. Audit found the corpus is overwhelmingly percentage-form (Iansan 27 = 27%, Hu Tao 5.957 = 5.957% HP, Linnea 75 = 75% DEF, Kazuha 0.04 = 0.04% per EM, Nilou 0.0006 = 0.0006% per HP). Bennett alone authored decimal-multiplier form (0.952 = 0.952x baseATK, copied verbatim from gcsim's `attackBuff` table) — migrated to 95.2 (and 0.2 → 20 for the C1 effect). Schema JSDoc on `BuffValue.scaling` canonizes percentage-points convention so future authoring follows.

**Pre-fix display bugs (now correct):** Iansan "2700% atk" → "27% atk"; Xianyun "20000% atk" → "200% atk"; Cyno "25000% hp" → "250% hp"; Hu Tao "596% hp" → "5.957% hp" (verified against wiki: PP gives `5.957% × Max HP` flat ATK at TL9, so 5.957 percentage form was correct all along; pre-fix displayed at \*100 by accident).

Note for any new scaling authoring: gcsim source tables sometimes mix conventions — `attackBuff` (Bennett) uses decimal multipliers like 0.952, while `ppatk` (Hu Tao) uses percentage points like 5.957. Always cross-check against the genshin-impact wiki tooltip to convert to the schema's percentage-points form before authoring.

## v0.6 ship — gainStacks lifetime + Linnea (2026-05-11, `d9e2707`)

Schema: `gainStacks.lifetime?: number` (positive finite seconds). Each granted instance lives independently for `lifetime` seconds; expired instances are dropped at the next cast event (lazy expiry). Distinct from `drain`: drain is continuous-rate decay, lifetime is discrete per-instance expiry. Mutually exclusive with `drain` on the same effect (lint enforces `gainstacks-lifetime-drain-conflict`).

Parser: per-segment `stackInstances: Map<string, number[]>` (parallel to `stackState`) tracks expiry timestamps for each individual stack instance.

- `applyLifetimeExpiry(char, cursor, stackState, stackInstances)` runs at every cast event in both E and Q handlers (right after `applyDrain`, before `dispatchGainStacks`). Filters out expired instances and updates `stackState[key] = remaining.length`.
- `dispatchGainStacks` for lifetime-bearing grants: appends `amount` instances at the same expiry-time (`castTime + lifetime`); on `instances.length > max`, splices off the oldest first.
- `dispatchConsumeStacks` symmetrically: `amount: 'all'` clears the instance list; numeric amount splices the oldest N off the front.
- Per-segment scope (matching `stackState`); a swap-out clears all instances.

Linnea migration: added `"lifetime": 10` to the C1 fieldCatalog gainStacks effect. Stacks now correctly decay 10s after grant. The per-Lunar-Crystallize-hit consumer (lunarCrystallizeFlatDmg buff) remains optimistic-fire — it doesn't actually consume stacks per hit (that would need an onReaction-trigger consumeStacks, separate primitive).

10 new tests (6 parser, 4 lint). Coverage: single-grant snapshot, accumulate within window, drop after expiry, partial expiry (middle batch drops, later batch persists), over-saturation drops oldest first, per-segment reset; lint rejects non-positive/non-numeric/drain-conflict and accepts valid Linnea-shape.

**Known gaps (NOT addressed):**

- `dispatchGainStacksOnReaction` doesn't yet thread `stackInstances` — onReaction-trigger lifetime grants would saturate unbounded. Trivial extension when a use case appears (none in current corpus).
- `{key:N}` user assertions don't interact with `stackInstances` — assertion sets `stackState` directly but doesn't seed instances. For lifetime keys, a subsequent `applyLifetimeExpiry` would see no instances and reset count to 0 on the next cast. Not a problem for Linnea (no fieldCatalog assertions in practice); document if it surfaces.

## v0.7 ship — gainStacks.constellationScaling + Linnea C6 (2026-05-11, `ea39f94`)

Schema: `gainStacks.constellationScaling?: { conditions: Condition; amount: number }`. Mirrors `BuffEffect.constellationScaling`. When `conditions` resolves definitively true (typically `{ type: 'constellation', level: N }`), the override `amount` replaces the base `amount` for the dispatch. All other fields (`max`, `lifetime`, `drain`) carry through unchanged — only the per-fire grant count changes.

Parser: both `dispatchGainStacks` and `dispatchGainStacksOnReaction` resolve `effAmount` upfront via a second `evalCondition` call on the override conditions; the lifetime-bearing branch and the base accrual branch both consume `effAmount` instead of `fx.amount`.

Linnea C6 migration:

- C1 gainStacks (key=fieldCatalog, amount=6, max=18, lifetime=10) gets `constellationScaling: { conditions: cons:6, amount: 18 }` → at C6 a single E grants 18 stacks (max-out), saturating any pre-existing pool via lifetime's oldest-first drop.
- C1 consumer buff (lunarCrystallizeFlatDmg, scaling DEF × 75) gets existing-schema `constellationScaling: { conditions: cons:6, value: { type: scaling, stat: def, ratio: 150 } }` → at C6 the per-hit bonus doubles. The "consume 2 stacks per hit" half is observationally identical to the "consume 1 stack per hit" model since both fire optimistically gated on stacks≥1; only the value changes.
- C1 / C6 curator notes refreshed.

Lint: `gainstacks-constellation-scaling-amount-invalid` (positive finite when present) + `gainstacks-constellation-scaling-conditions-invalid` (Condition object required when present).

8 new tests (4 parser, 4 lint). Coverage: at C1 single E → 6 (override gated on cons:6 inert); at C5 single E → 6 (still below threshold); at C6 single E → 18 (override fires); at C6 two E → second still 18 (lifetime saturation drops oldest first). Lint: non-positive amount, non-numeric amount, missing conditions, valid Linnea C6-shape.

**Known gaps (NOT addressed):**

- Only `amount` is overridable on gainStacks — `max`, `lifetime`, `drain` are not. No corpus need today; trivial extension when one appears.
- No lint check for the existing `BuffEffect.constellationScaling` shape (pre-existing gap; surfaced here, not closed in this slice).

## v0.8 ship — Skirk A4 Death's Crossing (2026-05-11, `568b289`)

Resolves the three forks documented previously in `decision_pending_skirk_a4_deaths_crossing.md` (since deleted): Q1 Path C, Q2 Path Y, Q3 Path P.

**Schema:**

- `gainStacks.sourceLifetime?: number` — per-source slot expiry. Each contributing source occupies one rotation-wide slot until their timer expires; same-source re-trigger refreshes their slot. Mutually exclusive with both `lifetime` and `drain` per lint.
- `onHit.source?: 'self' | 'team' | 'others'` — mirrors `onReaction.source` with `'others'` added for "team minus self." Skirk A4's Cryo filter uses `'others'` (exclude Skirk's own Cryo); Hydro filter uses `'team'` (Skirk can't deal Hydro, but the explicit value documents intent).

**Parser (Path Y — event stream):**

- New `HitEvent` type: `{ characterId, element, time, castKind }`. Per-cast granularity for v1 (skill + burst). Element = casting character's element by default. Per-hit fidelity (NA/CA/plunge with infusion-tagged elements) deferred — Cryo NAs from a Cryo-infused teammate (Chongyun, Cyno-cryo-stance) currently DO NOT trigger Death's Crossing. Documented gap; no driver beyond Skirk yet.
- `hitEvents: HitEvent[]` exposed on `ParsedRotation` for downstream subscribers.
- `dispatchGainStacksOnHit` walks all team characters' onHit gainStacks effects per HitEvent; applies source/element/abilityType filters; updates `sourceLifetimeState: Map<holder, Map<key, Map<source, expiry>>>` rotation-wide. Saturation drops earliest-expiry slot when count exceeds `max`. Implemented as in-line single-pass walk during the cast walk (no separate post-walk pass needed; the event stream is still exposed for path-Y consumers).
- `syncSourceLifetimeToStackState` runs at every E and Q cast handler entry (alongside `applyDrain` and `applyLifetimeExpiry`). Drops expired entries and writes the unexpired slot count to per-segment `stackState[key]` so downstream `stacks` Conditions evaluate uniformly regardless of grant mechanism (gainStacks accrual, lifetime, sourceLifetime).

**Skirk migration:**

- A4 passive gains 8 effects:
  - 2 gainStacks (Cryo via source='others' excluding Skirk; Hydro via source='team'). Both grant +1 to key=deathsCrossing with sourceLifetime=20 max=3, gated on ascension>=4.
  - 3 NA-tier buffs (stat=normalDmgBonus, value=+10/+20/+70 at exact stacks 1/2/3). Gated on `state: inStance` + exact-tier stacks condition. trigger=onCast skill duration=12.57 (stance window).
  - 3 burst-tier buffs (stat=burstDmgBonus, value=+5/+15/+60 at exact stacks 1/2/3). trigger=onCast burst duration=2.6 (burst hit window).
- C4 constellation gains 3 atk% buffs (+10/+20/+40 at exact stacks 1/2/3), trigger=onCast skill duration=12.57, gated on Cons:4 + Asc:4 + exact-tier. Reuses existing atk% stat; no schema change.

Mathematically: additive normalDmgBonus +10/+20/+70 ≡ ×1.1/×1.2/×1.7 in the standard `talent × (1 + ΣDmgBonus%)` formula. Same for burst +5/+15/+60 ≡ ×1.05/×1.15/×1.6.

**Lint:**

- `gainstacks-source-lifetime-invalid` — positive finite when present
- `gainstacks-source-lifetime-drain-conflict` — mutually exclusive with drain
- `gainstacks-source-lifetime-lifetime-conflict` — mutually exclusive with lifetime

**Tests (301 total, +9 new):** 5 parser (HitEvent emission shape, source=team grants 1 stack, same-source no-double-stack, source=others excludes self, sourceLifetime expires after 20s) + 4 lint (non-positive sourceLifetime, drain conflict, lifetime conflict, valid Skirk A4-shape).

**Known gaps (documented in skirk.json curator notes):**

- Per-cast emission only — NA/CA/plunge fidelity deferred. Affects e.g. Cryo-infused teammate NAs not triggering Death's Crossing.
- `dispatchGainStacksOnHit` uses empty resolved-states map per holder — onHit triggers with state-based conditions on the EFFECT (not the trigger filter) won't resolve true at hit time. No current corpus need; trivial extension when one appears.
- Tier-buff rendering: the bars fire at Skirk's own E/Q cast (not at teammate hits that grant stacks). Visually, the tier buffs only become visible during Skirk's segments. The model is correct; the UX could later surface "pre-rotation Death's Crossing state" if needed.

## Repo state at v0.8 ship (Skirk A4, `568b289`)

301 tests passing; type-check green; working tree clean on `main`.

```
568b289 feat(schema,parser,lint,curation): E3 v2.x — Skirk A4 Death's Crossing
ea39f94 feat(schema,parser,lint,curation): E3 v2.x — gainStacks.constellationScaling + Linnea C6
d9e2707 feat(schema,parser,lint,curation): E3 v2.x — gainStacks per-stack lifetime + Linnea migration
0d8461a fix(renderer,curation): scaling-ratio display — standardize on percentage-form authoring
72489c4 feat(schema,renderer,lint): E3 v2.x — cap rendering pass for scaling + perStack BuffValues
12b2f21 feat(curation,test): E3 v2.x — Iansan burst NS-threshold formula via two-effect split
9454d30 feat(schema,parser,renderer,curation): E3 v2.x — Skirk SS (variant gating + consumeStacks + perStack threshold)
7ed34ff feat(schema,parser,curation): E3 v2 — gainStacks drain + Iansan migration
9479bfd feat(schema,renderer,curation): Linnea C1 perStack consumer
7ebf9d4 feat(schema,curation): E2 follow-up — N/CA/P DmgBonus stats + 4 chars
ec132ae feat(schema,parser,curation): E2 follow-up — selfHpBelow/Above + State subsume
54fa047 chore(schema): drop vestigial CustomConditionKey + 'custom' Condition
06dd76e feat(renderer): resShred debuff bars + character onReaction dispatch
```
