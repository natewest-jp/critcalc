# Autonomous loop queue (2026-05-12)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

## How to use this file

Each iter: pick the first item with status `PENDING`, ship it per `feedback_loop_autonomy.md`, commit on `main`, then update the status to `SHIPPED` with commit SHA and date. If you hit a pause signal listed under the item, escalate (don't ship) — update status to `PAUSED` with the reason.

**Posture reminders:**

- Verify the codebase state before assuming a primitive doesn't exist — some schema bits may have landed in earlier "Quick Schema Wins" passes and just need migrations
- Test discipline: add tests for every primitive, every migration that touches parser behavior
- Lint discipline: every new schema field gets a lint rule
- Commit per item; don't bundle
- Run `npm test` + `npm run check` before each commit
- If an item is smaller than expected (just migration, no schema work), still commit it as its own item — keeps the trail clean

## Queue

### Item 1 — Constellation-aware ability panel display [SHIPPED 2026-05-12 · 791c52c]

**Goal:** Filter `RotationCharacterPanel.svelte` content by current constellation level. Effects/variants gated on `{ type: "constellation", level: N }` where N > current level are hidden. Effects with `constellationScaling` overrides show the active value (base when level < threshold; override when level ≥ threshold).

**Design call settled:** Option A — show only what's currently unlocked. (Option B "show all with locked badge" is reserved for the Team Builder tool.)

**Files:**

- `src/lib/components/RotationCharacterPanel.svelte` — read from `$constellations` store; apply filtering
- Probably needs a helper like `isEffectUnlocked(effect, conLevel)` and `resolveEffectAtLevel(effect, conLevel)`
- Consider whether to extract to `src/lib/utils/constellationFilter.ts` if logic is reused — judgment call; default to inline if simple enough

**What "currently unlocked" means precisely:**

- Effect on a `passive` node → always shown if ascension permits (ascension conditions are out of scope here; same as today)
- Effect on a `constellation` node `c1`-`c6` → shown only if `conLevel >= constellation_number`
- Effect with `conditions` containing `{ type: "constellation", level: N }` (could be on E/Q/passive) → shown only if `conLevel >= N`
- Effect with `constellationScaling` override → show with the resolved value (base if locked, override if unlocked)
- Variants with constellation conditions follow the same rule

**Tests:**

- Synthetic test that constellation-gated effects appear/disappear based on store value. Use existing characters (Diluc C1, Linnea C6) as fixtures.
- Verify scaling overrides resolve correctly at threshold

**Pause signals:**

- If the panel's current effect-collection helper is shared with `RotationTimeline.svelte` (`getCharacterEffectsForCast` / etc.) — wiring the constellation filter into those could change timeline rendering too. **Stop and confirm** whether the panel filter should be local-only or threaded through.
- If variant filtering is more entangled with other condition types than expected, surface and ask.

---

### Item 2 — Summon-duration constellation modifier [SHIPPED 2026-05-12 · 6b234c1]

**Goal:** Allow constellation-gated extensions to summon durations.

**Verify-first:** The 2026-05-09 "Quick Schema Wins" mentioned `Summon.durationModifiers[]`. Check `src/lib/types/ability.ts` and the parser to confirm whether the schema is already present. If yes → migrations only. If no → ship the schema + migrations.

**Schema (if missing):** `Summon.durationModifiers?: SummonDurationModifier[]` mirroring the existing `cooldownModifiers[]` shape — `{ source: string; type: "flat"; value: number; conditions?: Condition }`.

**Parser (if missing):** Apply matching modifiers when computing summon duration in `notationParser.ts` (find where summons are spawned and `duration` is read).

**Lint (if missing):** `summon-duration-modifier-*` rules — source non-empty, type='flat', value positive finite, conditions optional.

**Migrations:**

- **Geo Traveler C6** — Wall summons get `+5s` each; Meteorite summon gets `+10s`. Gate on `constellation: 6`.
- **Hydro Traveler C2** — Bubble summon gets `+3s`. Gate on `constellation: 2`.
- **Iansan C6** — Scale summon gets `+3s`. Gate on `constellation: 6`.

**Tests:**

- Parser test that summon duration extends correctly at the gated constellation level (synthetic char or real char fixtures)

**Pause signals:**

- If a char's summon already has a different mechanism for constellation extension authored (e.g. via abilityVariant duration override), surface and ask before duplicating

---

### Item 3 — HealEffect flat + scaling combination [PARTIAL-SHIPPED 2026-05-12 · eb8f89c · Linnea Q heal deferred]

**Goal:** Allow heal effects to specify both `flat: number` and a scaling component, mirroring how `damage` got its `flat` field during schema-mismatch cleanup.

**Verify-first:** The 2026-05-09 "Quick Schema Wins" mentioned `flat: number` on damage/heal. Check `src/lib/types/ability.ts` for whether `Heal` already has `flat?: number`. If yes → migrations only. If no → ship the schema + migrations.

**Schema (if missing):** Extend `Heal` Effect to accept optional `flat: number`. Same convention as `Damage.flat` (whole-number unit per stat).

**Renderer:** Heal magnitudes mostly don't render on the timeline as numeric values today (heals are window-tracked). If they do render anywhere with magnitude (tooltip?), confirm flat + scaling sums correctly.

**Lint (if missing):** `heal-flat-invalid` (positive finite when present).

**Migrations:**

- **Jahoda Robot heal** — currently scaling-only; add `flat` per gcsim source
- **Linnea Q heal** — `flat + DEF%` formula; author both halves
- (Aino A4 burst tick is a damage effect with flat + scaling co-located; skip unless that's also pending — check during verify)

**Tests:**

- Lint tests for the new field
- If renderer changes anywhere, a renderer test

**Pause signals:**

- If gcsim source for any heal formula is ambiguous or absent, surface the gap and migrate only the unambiguous ones

---

### Item 4 — onConstructSpawned trigger primitive + Chiori A4 [SHIPPED 2026-05-12 · a27bf5d · Shape C chosen]

**Surfaced finding (loop autonomy: stop and ask):**

**What I found:**
Chiori A4 "The Finishing Touch" currently uses `trigger: { type: "manual" }` with curator note "Trigger is manual — fires on any nearby Geo construct creation (other Geo characters' skills + Chiori's own Tamoto). The schema has no 'onConstructSpawned' event."

The mechanic is: when a **nearby party member** (any Geo character, not just Chiori) creates a Geo Construct, Chiori gains +20% Geo DMG for 20s. Construct-spawning abilities span the corpus: Noelle shield, Zhongli pillar, Albedo flower, Geo Traveler walls/meteorite, Chiori's own Tamoto. The trigger is genuinely team-wide, not bound to Chiori's own casts.

This is the "is this worth a primitive?" call for a new category that doesn't appear elsewhere — exactly the case `feedback_loop_autonomy.md` says NOT to ship without check-in.

**What I considered:**

1. **Shape A — `Trigger.onConstructSpawned`, no fields.** Adds a "construct" classification (likely a `kind: "construct"` tag on `Summon`) plus team-wide dispatch (similar to existing `onTeamNightsoulBurst`). Migration scope: tag every Geo construct-spawning summon in the corpus (Noelle shield, Zhongli pillar, Albedo flower, Geo Traveler walls/meteorite, Chiori Tamoto — possibly more). Parser dispatch on construct-spawn events. Cost: ~7-10 char tagging migrations + new trigger type + dispatch + lint. Value: Chiori A4 fires correctly for Geo team comps, with potential to power future "construct" mechanics.
2. **Shape B — Generalize: `Trigger.onTeamEvent` with `event: "constructSpawn"` (or other event keys).** Future-proofs to other team-event triggers (currently we have `onTeamNightsoulBurst` as a discrete trigger type; generalizing it is a possible refactor). Cost: higher than Shape A because it reshapes existing primitives. Value: cleaner long-term schema if more team-event types are coming.
3. **Shape C — Stub-with-caveat.** Keep `manual` trigger; add a permanent caveat to the effect ("fires when a teammate creates a Geo Construct; the planner doesn't simulate teammate construct spawns — toggle manually when applicable"); drop the curator note's "schema has no..." line. Pattern matches the out-of-queue list (onPickup, onTargetDied, onPlayerHit, etc. — all stub-with-caveat candidates per curation philosophy).

**What I recommend:**
**Shape C (stub-with-caveat)** is the loop-autonomy-aligned default for this kind of mechanic, AND the cost/value tradeoff probably favors it. Reasoning:

- Chiori's user base for team-building is narrow (Geo comps); the impact is real but limited.
- Shape A requires construct-tagging the corpus (~7-10 chars) plus a new dispatch path; that's "new primitive design" cost.
- The buff is already authored at the correct value (+20% Geo, 20s); only the trigger semantics are wrong.
- The user-facing caveat on Chiori's chip would be one sentence: "fires when a Geo teammate creates a Construct."
- If the user ever adds Geo team-comp rotations and the chip's static treatment becomes a problem, the cost of upgrading to Shape A later is the same as the cost now.

**However**, Shape A is _also_ defensible if Nate's view is "Geo team comps are a known interaction worth simulating correctly." The decision turns on whether Geo-construct mechanics are a one-off (Chiori A4 + maybe Albedo C2) or a recurring category.

**What I'd do next assuming Shape C:**

- Edit `chiori.json` "The Finishing Touch" passive: keep manual trigger, replace `_curatorNotes` line with a permanent user-facing caveat field on the effect (pattern: see `caveat` usage in Linnea burst).
- Add an entry to the out-of-queue notes list under "F2C null-resolving triggers" / "stub-with-caveat candidates" so future curation passes don't re-investigate.
- No schema changes, no lint changes, no test changes; one-file commit.

**What I'd do next assuming Shape A:**

- Add `Trigger.onConstructSpawned` with optional `ability?` field (mirroring `onTeamNightsoulBurst`).
- Add `kind?: "construct"` to `Summon` schema (or equivalent classifier).
- Lint: `summon-kind-construct-required-on-known-constructs` (probably warn-tier; allowlist of construct-spawning chars).
- Parser dispatch: extend the team-event walk to fire `onConstructSpawned` for each construct-spawning summon emission, routed to listeners on every team member's passives/constellations.
- Curation pass: tag Noelle shield, Zhongli pillar, Albedo flower, Geo Traveler walls + meteorite, Chiori Tamoto. Audit for any other constructs.
- Migrate Chiori A4 from `manual` → `onConstructSpawned`.
- Tests: parser dispatch (Chiori + Noelle pair); lint rules.

**Goal:** Express "fires when a construct entity spawns" as a first-class trigger so Chiori A4 (and future construct-spawn-triggered effects) can dispatch correctly.

**Research-first:** Read Chiori's current JSON. Look at:

- How is Chiori's skill summon authored? Is it tagged as `construct`?
- What is Chiori A4's effect shape currently? (Likely `manual` trigger placeholder)
- Is there an existing pattern (`onCast` with offset, `afterDuration` with `ability`) that would suffice without a new trigger type?

**Decision fork:**

- **If existing primitives suffice** (e.g. `onCast` of the construct-spawning ability with the right offset): use them; migrate Chiori A4; document the decision; don't add `onConstructSpawned`. This is a stub-philosophy-aligned outcome — no new primitive without justification.
- **If a new trigger is genuinely needed** (multiple construct spawn paths, deferred spawn from other events, etc.): add `Trigger.onConstructSpawned` shape mirroring `onTeamNightsoulBurst` (no extra fields likely; maybe `ability?` if multiple constructs per char).

**Migration:** Chiori A4 from `manual` → whichever trigger fits.

**Tests:** Parser test that A4 dispatches at construct spawn time on Chiori cast.

**Pause signals:**

- If construct-spawn timing depends on enemy interaction or runtime state (and thus null-resolves), this becomes a stub-with-caveat candidate per `feedback_curation_philosophy.md`. Surface and propose stub treatment rather than building.
- If "construct" overlaps semantically with summon-with-collision (Noelle shield, Zhongli pillar), surface — the trigger boundary needs Nate's call.

---

### Item 5 — `name` field backfill on hits[] / chargeHits[] [SHIPPED 2026-05-12 · c2ae316 + 5bd05ab]

**Goal:** Mechanical cleanup. Older curated characters' `hits[]` and `chargeHits[]` entries are missing the `name` field that's standard on newer chars. Reference: `docs/rounds/curation-plan.md` § "Outstanding retroactive cleanup".

**Step 1 — Audit:** Write a one-off script (or grep) to enumerate `hits[]` / `chargeHits[]` entries missing `name`. Likely concentrated on the original 4 chars (Ganyu, Diluc, Bennett, Xingqiu — verify) and possibly other Tier A early-batch chars.

**Step 2 — Source:** For each gap, look up the hit name from gcsim source OR KQM (priority: KQM > gcsim per `reference_framemap_conventions.md`).

**Step 3 — Migrate in batches:** Commit per ~5-7 chars. Don't bundle into one giant commit. Commit message style: `curation: backfill hits[] name field — N chars (batch X)`.

**Pause signals:**

- If a hit's name is genuinely unknown (gcsim absent + KQM absent), skip that hit and document in the audit script output. Don't fake it.
- If the audit surfaces a much larger gap than expected (>30 chars), surface and ask whether to scope down

---

## Out-of-queue notes for next planning conversation

Surface these in the next planning conversation — they're cost/value calls that need his eye, not loop-shippable:

**F2C null-resolving triggers** (likely stub-with-caveat per curation philosophy):

- `onPickup` (Mualani C4, Faruzan, Diona, Klee C6) — particle/orb pickup is non-deterministic in planner
- `onTargetDied` (Hu Tao A4, Yoimiya C1) — enemy death state unknown
- `onPlayerHit` (Beidou C4, Wriothesley A4) — taking damage isn't simulated
- `onAbsorption` (Sucrose C6, Wanderer) — multi-element absorption already flagged
- `onParticleReceived` (Venti C4, Jean C2) — particle gen is out of scope per tool constitution

For each, the right call is probably stub-with-caveat: leave a permanent user-facing caveat on the effect; drop the curator note; mark intentionally-not-rendered. But that's Nate's judgment to confirm.

**F2C event-driven triggers** (loop-shippable when queued, similar to Item 4):

- `onShieldEnd` (Noelle A4 reapply, Kachina C6) — shield duration is deterministic
- `onHeal` (Sigewinne C6) — heals fire at known cadences
- (`onConstructSpawned` is Item 4)

## Status log

(Each iter appends a one-line entry here when status changes — keeps progression visible cold.)

- 2026-05-12: Queue file created. 5 items pending. Tests baseline: 305 passing on `main` at `5ea384d`.
- 2026-05-12: Item 1 SHIPPED at `791c52c`. Panel-local filter on E/Q effect chips + skill variants via new `constellationFilter` helper. Constellation-node row display deferred (not in queued scope). 316 tests pass. Pause signal resolved inline: panel uses its own `effectChips`, not `getCharacterEffectsForCast` — no timeline-side change.
- 2026-05-12: Item 2 SHIPPED at `6b234c1`. Verify-first confirmed schema (`Summon.durationModifiers`), parser (`resolveActiveDuration` + `getActiveDurationModifiers`), AND all three migrations (Geo Traveler C6, Hydro Traveler C2, Iansan C6) were already authored as part of the 2026-05-09 Quick Schema Wins pass. Only gap was the parser test — committed three Iansan C0/C5/C6 cases. 319 tests pass.
- 2026-05-12: Item 3 PARTIAL-SHIPPED at `eb8f89c`. Verify-first confirmed `Heal.flat?: number` schema + Jahoda migration (`flat: 1101.7`) already done via 2026-05-09 pass. Gap closed: added strict `damage-flat-invalid` + `heal-flat-invalid` lint rules + 4 synthetic tests (323 total pass). **Linnea Q heal authoring DEFERRED** per pause signal — gcsim values (`burstInitialDef`, `burstInitialFlat`, `burstTickDef`, `burstTickFlat`) aren't transcribed into the repo; the curator note references them by name only. Blocked on a future gcsim source transcription pass; do NOT fabricate values.
- 2026-05-12: Item 4 PAUSED. Chiori A4 trigger is "fires when any nearby teammate creates a Geo Construct" — genuinely team-wide, not bound to Chiori's casts. Three plausible shapes (new `onConstructSpawned` primitive + corpus tagging pass; generalize to `onTeamEvent`; or stub-with-caveat). Hits the "novel primitive design with multiple plausible shapes" + "is this worth a primitive? first time the category appears" pause signals. Surfaced in Item 4 body. **Recommendation: Shape C (stub-with-caveat) — but Nate's call.** Skipping Item 4 and proceeding to Item 5 (mechanical backfill — explicitly in the "ship without check-in" list).
- 2026-05-12: Item 5 SHIPPED in two batches: `c2ae316` (Bennett, Cyno, Fischl, Ganyu — 28 names) and `5bd05ab` (Kazuha, Raiden Shogun, Xingqiu, Zhongli — 26 names). All 8 chars surfaced by the audit cleaned. Convention used: `N1..Nn` for normal hits; `["Aimed Shot", "Fully-Charged Aimed Shot"]` for 2-entry bow chargeHits; `["Fully-Charged Aimed Shot"]` for Fischl's single chargeHit (frame-matched against Aloy). Corpus audit now reports zero remaining gaps. 323 tests pass; svelte-check clean. Migration script lives at `/tmp/backfill_hit_names_v2.js` for reference but isn't committed (one-off tool).
- 2026-05-12: Item 4 SHIPPED at `a27bf5d`. Shape C (stub-with-caveat) per Nate's decision. Chiori "The Finishing Touch" passive now carries a user-facing `caveat` explaining the manual-trigger toggle convention; curator note records the cost/value reasoning for not building `onConstructSpawned`. No schema change. All 5 queue items now closed.
