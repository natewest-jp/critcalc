# Caveat Refresh — 2026-08-18

> ⏭ **What this round left open lives in `docs/curation/caveat-open-items.md`** — the 29 unlanded
> trims, the positional-schema round, and the engine/data flags.

> Corpus-wide re-audit of all **261** user-facing `caveat` strings after the gauge (L0–L6), ICD,
> ICD-group, mark-triggered, coordinated-attack, tick-cap, constellation-gating and
> constellation-shield rounds. Branch `curation/caveat-refresh`.

## Why the round happened

The style guide’s CAN/CANNOT rubric was written 2026-07-19/20 and had gone stale in **14 named
places**. Judging caveats against it produces wrong verdicts, so the rubric was re-derived from
source FIRST (7 probes + 3 adversarial refuters, 15 of 168 claims refuted) and now lives in
`docs/curation/engine-capability-rubric.md`. ⚠️ Re-derive it at the start of the next pass.

## Method

- 22 batches, bin-packed so **no two agents ever touched the same file**
- Per batch: review + land prose rewrites → **independent adversarial verify** → repair
- Deletes were NEVER landed by an agent — they are proposals below
- 46 agents, 0 errors, all 261 caveats accounted for exactly once

## Result

| verdict            | n   | landed?                            |
| ------------------ | --- | ---------------------------------- |
| keep               | 158 | —                                  |
| rewrite            | 69  | ✅ landed                          |
| implementCandidate | 17  | caveat kept; queued below          |
| delete             | 17  | ⏸️ **4 refuted, 13 awaiting Nate** |

Verification caught real drift: **4 of 17** proposed deletes were refuted and downgraded, and
**3 of 73** landed rewrites had smuggled in a claim (scope words, dropped magnitudes) and were repaired.

---

## 🔴 THE HEADLINE: the “add it manually” defect

The style guide carried a wave-3 lesson telling curators to phrase a `manual`-trigger effect as
_“doesn’t fire on its own — add it manually.”_ **There is no such control and there never was.**
`'manual'` occurs **once** in the entire codebase — its own type declaration
(`src/lib/types/ability.ts:649`). **167 manual-trigger effects across 69 characters** reach no
surface at all.

15 live caveats were instructing players to use a control that does not exist. **All 15 are now
rewritten to honest “Not modeled: X.” phrasing, and the lesson is struck from the style guide** —
leaving it would have regenerated the defect on the next pass.

---

## 🟠 SYSTEMIC: effect-level caveats render nowhere

**20 caveats across 8 characters** (Durin ×7, Nicole ×7, Aino, Albedo, Cyno, Gaming, Klee, Sandrone)
are authored on an **Effect**, not an ability. Nothing reads them:

- `caveat?: string` is declared **exactly once**, on `AbilityCommon` (`src/lib/types/ability.ts:1686`).
  `Effect` has no such field — these are untyped extra JSON properties.
- `slotCaveats.ts:58-67` maps over `effectSourcesAtConstellation(...)` — **ability-shaped hosts only**,
  never descending into `.effects[]`.
- `scripts/caveat-lint.mjs:96-98` scans `abilities`/`passives`/`constellations` at the ability level
  only — and **never `factionBonuses` at all**.

⚓ **Written, never rendered, never style-linted — which is exactly why they drifted.** This is the
`docs/curation/orphaned-schema-audit.md` blind spot in its documented form: the guard matches by KEY NAME, `caveat` _is_
read (on abilities), so the test stays green over 20 dead strings.

⏭ **Decision needed:** delete them, or teach `slotCaveats` + the lint to descend into effects.
10 of the 13 delete proposals below are this class.

---

## ⏸️ DELETE PROPOSALS — 13, awaiting sign-off

⛔ **No caveat has been removed.** Every file below is untouched.

### 1. Durin · effect:buff · `constellations[5].effects[1]`

**Text:** Durin's Burst/dragon DMG ignores 30% of the enemy's DEF (70% in Dark form — the tool can't tell the forms apart, so it shows 30%).

**Grounds:** PROPOSAL ONLY — file untouched. Same dead surface as effects[0]: no reader for an effect-level `caveat`. Its content is already carried verbatim by sentence 1 of the C6 entry-level caveat, which renders. It also breaks style rule 3 by naming the character.

### 2. Durin · effect:resShred (factionBonus) · `factionBonuses[0].effects[0]`

**Text:** With 2 or more Hexerei on the team the White-form RES shred deepens from 20% to 35%.

**Grounds:** PROPOSAL ONLY — file untouched. Two independent grounds. (1) No reader: effect-level caveats are untyped extra properties (types/ability.ts:1686 is the only caveat declaration, on AbilityCommon), and factionBonuses are not even walked by slotCaveats or caveat-lint, so a faction bonus has no caveat channel at any level. (2) It describes WORKING behavior: the -35% and the base -20% are authored as mutually exclusive pairs (`teamFaction hexerei min 2` vs its `not`), teamFaction resolves definitively in every buff context, and factionBonuses get their own provenance-split window, row and label — so exactly one bar draws with the right number in either world. Nothing to warn about.

### 3. Durin · effect:resShred (factionBonus) · `factionBonuses[0].effects[1]`

**Text:** With 2 or more Hexerei on the team the White-form RES shred deepens from 20% to 35%.

**Grounds:** PROPOSAL ONLY — file untouched. Identical string and identical grounds to factionBonuses[0].effects[0]: no reader for an effect-level caveat, and the 20%→35% swap is working behavior (mutually exclusive teamFaction gating, one bar per element in either world).

### 4. Durin · effect:resShred (factionBonus) · `factionBonuses[0].effects[2]`

**Text:** With 2 or more Hexerei on the team the White-form RES shred deepens from 20% to 35%.

**Grounds:** PROPOSAL ONLY — file untouched. Identical string and identical grounds to factionBonuses[0].effects[0]: no reader for an effect-level caveat, and the 20%→35% swap is working behavior.

### 5. Durin · effect:resShred (factionBonus) · `factionBonuses[0].effects[3]`

**Text:** With 2 or more Hexerei on the team the White-form RES shred deepens from 20% to 35%.

**Grounds:** PROPOSAL ONLY — file untouched. Identical string and identical grounds to factionBonuses[0].effects[0]: no reader for an effect-level caveat, and the 20%→35% swap is working behavior.

### 6. Durin · effect:resShred (factionBonus) · `factionBonuses[0].effects[4]`

**Text:** With 2 or more Hexerei on the team the White-form RES shred deepens from 20% to 35%.

**Grounds:** PROPOSAL ONLY — file untouched. Identical string and identical grounds to factionBonuses[0].effects[0]: no reader for an effect-level caveat, and the 20%→35% swap is working behavior. Note for Nate: if the Hexerei uplift is judged worth disclosing at all, the only channel that renders is the A1 passive's ability-level caveat — but I judge it unnecessary, since the bar itself already shows -35%.

### 7. Nicole · effect:buff (C6) · `constellations[5].effects[0].caveat`

**Text:** Party members holding Guidance of Theosis ignore 40% of the enemy's DEF — at C6 the whole team holds it.

**Grounds:** PROPOSAL ONLY — file left untouched. This describes WORKING behavior end to end and warns of nothing. The effect is `buff`/`target:'team'`/`onCast skill`/20s on `defIgnore`, gated `constellation: 6`; team-target onCast buffs are the best-covered path in `deriveBuffWindows`, `defIgnore` is a real Stat (ability.ts:150) that buffStatMaps labels, and the entry is now gated at collection by `effectSourcesAtConstellation` (rubric C7), so it draws at C6 and only at C6 — which is exactly what the sentence says. Its second clause is the JUSTIFICATION for target:'team' (a curator's note about why the authoring is right), not a limitation. Style-guide test: a player who knows Nicole reads a 'DEF Ignore +40%' team bar for 20s and is not misled by its absence. ⚠️ Belt-and-braces: it is also effect-level, so removing it costs a reader nothing today.

### 8. Sandrone · effect:buff · `constellations[0].effects[0]`

**Text:** Shown always on; in game it applies only while Fagio is in Decoding mode.

**Grounds:** PROPOSAL ONLY — file untouched. This is an EFFECT-level caveat and it reaches no surface whatsoever: `caveat?: string` is declared exactly once in the type surface, on AbilityCommon (src/lib/types/ability.ts:1686); `Effect` has no such field. The only renderer is slotCaveats.ts:59-62, which maps over `effectSourcesAtConstellation(...)` ability-shaped hosts and reads `a.caveat` — it never descends into `effects`. deriveCapabilities' `caveats` array is unrelated (collectCaveats walks CONDITIONS, deriveCapabilities.ts:342-350). scripts/caveat-lint.mjs:89-98 does not scan it either, so it is also unlinted. Second, its content is fully duplicated by the C1 ability-level caveat one level up ('The party-wide Stellar-Conduct bonus only holds while Fagio is in Decoding mode'), which DOES render — so removing it costs the user nothing. Same class as the artifact-set effect caveats named in the rubric's traps.

### 9. Cyno · effect:buff (stellarConductReactionBonus) · `constellations[1].effects[0].caveat`

**Text:** Shown at the full 80%; in game it stacks 5 × 16% on Normal and Charged hits — near-instant during the burst — and rides Together We Rise.

**Grounds:** PROPOSAL ONLY — file untouched. This string reaches no reader anywhere. `caveat?: string` is declared on AbilityCommon and nowhere else (src/lib/types/ability.ts:1686); the Effect union has no caveat field, so this is an untyped extra JSON property. The only producer is slotCaveats.ts:58-67, which walks effectSourcesAtConstellation and reads `a.caveat` on ability-shaped hosts only — it never descends into effects — and RotationNotes.svelte:47 is the only render. scripts/caveat-lint.mjs:86-98 likewise scans abilities/passives/constellations only, which is why this string has never been style-checked. Its content is also already stated, almost word for word, in the C2 ability-level caveat that DOES render, so nothing is lost. Same class as the artifact-set effect-level caveats the rubric flags as look-live-but-are-not.

### 10. Klee · effect:energy · `passives[1].effects[0].caveat`

**Text:** Shown on every Charged Attack hit, but in game the Energy only flows when the hit is a CRIT.

**Grounds:** PROPOSAL ONLY — file untouched. Wrong on both counts. (1) It reaches no reader: `caveat` is declared only on AbilityCommon (types/ability.ts:1686); slotCaveats.ts:58-67 reads it on ability-shaped hosts and never descends into effects, and caveat-lint.mjs:86-98 does not scan effects either. (2) Even hoisted to the passive it would be false — nothing IS shown. `energy` effects have zero planner consumers: grep for 'energy' over src/lib/sim/, buffWindows.ts and effectCollection.ts returns nothing, and buffWindows emits windows for 'buff' and 'resShred' only. So no bar appears on any Charged Attack hit and no player can be misled by the timeline here, which fails the style guide's own test. ⚠ The CRIT gate is still a real unmodelable condition, and this effect DOES reach the Team Builder as a team-energy capability claim (target 'team', so deriveCapabilities.ts:628 admits it) with the CRIT condition unstated — but authored caveats reach exactly one surface and it is not the Team Builder, so a caveat cannot repair that. Worth Nate's judgement as a TB-surface gap, not as caveat text.

### 11. Dehya · skill · `abilities[1]`

**Text:** Not modeled: the field's coordinated Pyro attacks, which fire when an enemy inside it takes DMG, up to once every 2.5s. The active bar shows only the field's lifetime, not attack timing or DMG.

**Grounds:** STALE — the coordinated-attack round (2026-08-18) authored exactly this mechanic and I MEASURED it firing. Live parse of 'Dehya E Diluc N5 x8': the Fiery Sanctum window (21-741f) carries ticks [80, 242, 435, 628] and the rotation carries four Pyro applications at those same instants. Both sentences are now false: the attacks ARE modeled, and the field bar shows attack TIMING as tick markers, not just lifetime. Traced end to end: the effect is a summon-hosted damage proc on onHit/source:'team' WITH a non-empty application[] (the gate at src/lib/sim/procs.ts:157 that kills 17 other characters' procs), armSummonProcs hands it a tickKey because the trigger is not onReaction (procs.ts:289), the landings accumulate in ctx.stateGatedTicks (aura.ts:350-353), and finalize.ts:417 joins them onto the window. procCooldown 2.5 is honoured by takeCooldown, so the 'up to once every 2.5s' clause is modeled too. DMG is out of scope for every ability by constitution, so that clause was never a caveat. I did NOT edit the file. The `after` string is an OPTIONAL conservative fallback if Nate wants something to ship in its place — it states the positional gap gcsim enforces (radius 10) that we have no vocabulary for; I recommend outright removal instead, since the single-stationary-in-range enemy is already an engine-wide AURA_NOTES line rather than a Dehya fact.

### 12. Fischl · passive · `passives[1]`

**Text:** Thundering Retribution only fires when the on-field character triggers the reaction. Oz's own reactions do not count, and Oz's roughly 1s cadence often takes the reaction first.

**Grounds:** PROPOSAL ONLY — file untouched. Both claims are now WORKING BEHAVIOR, traced in source. The A4 proc is authored on BOTH Ozes (abilities[1].summons[0].effects[1] and abilities[2].summons[0].effects[1]) as a damage effect on trigger {type:'onReaction', source:'active', icdGate:'none'}, procCooldown 0.5, with a non-empty application[] — so it clears the procs.ts:157 rejection and is one of the 13 procs that actually fire. "Only when the on-field character triggers it" IS the source:'active' filter, and "Oz's own reactions do not count" IS the viaEntity refusal at procs.ts:365 (`if (source === 'active' && (src.viaEntity || src.characterId !== ctx.activeCharId)) continue;`) — the line whose comment says in as many words that 'active' is not "'team' narrowed by id". "Oz's roughly 1s cadence often takes the reaction first" is also modelled: Oz's tick chain feeds the same gauge and consumes the aura, so the competition the sentence describes is simulated, not approximated. What is left is pure kit explanation plus play advice, which the style guide's first corollary forbids. The two divergences the curator notes DO record (gcsim stores the 0.5s ICD on the active character; A4 snapshots Oz's stats) are invisible in a tool that draws no damage numbers. If Nate would rather keep a note here, the honest residual is not this text.

### 13. Gaming · passive (effect-level) · `passives[0].effects[0]`

**Text:** After Charmed Cloudstrider (plunge) hits, Gaming heals 1.5% of his Max HP every 0.2s for 0.8s (4 ticks); an 0.8s cooldown gates each proc window.

**Grounds:** PROPOSAL ONLY — file untouched. This string is on an EFFECT, not an ability, and nothing anywhere reads it. `caveat?:` is declared exactly once in the type surface, on AbilityCommon (src/lib/types/ability.ts:1686); slotCaveats.ts:59-62 walks ability-shaped hosts via effectSourcesAtConstellation and never descends into effects[]; characterLint.ts:638 and scripts/caveat-lint.mjs:89-98 do the same. It is the same dead-property class the rubric flags on silken_moons_serenade — it looks like a live warning and is not, and orphanedSchema.test.ts cannot see it because it matches by key name and `caveat` IS accessed, on abilities. On top of that the text is curator-facing (it duplicates passives[0].\_curatorNotes[0] almost word for word), it explains how the kit works, and it names the character, which the panel already shows. NOT an implementCandidate: the effect is a `heal`, and heals reach no planner surface on any trigger, so re-triggering it as onHit+procCooldown would still draw nothing. If Nate wants a live note, `after` above is a legitimate ability-level replacement on passives[0] — the heal's trigger is `manual`, which reaches no surface at all, so "Not modeled" is the accurate phrasing.

---

## 📋 IMPLEMENT QUEUE — 17 gaps now closable with wired primitives

Caveats kept as-is. Each names the primitive that could close it. ⛔ Authoring is a separate round
(char-JSON edits want a fresh context, and a fan-out that writes data needs its own re-derivation pass).

1. **Durin C2** — Per-reaction partner-element DMG bonus → one `buff` effect per reaction with `trigger.onReaction.reaction` narrowed to that reaction and `stat: <element>DmgBonus`, mirroring the five per-element resShred effects already authored on this character's A1.

2. **Qiqi skill** — The Herald's coordinated attack ('if your current active character hits an opponent, the Herald performs a coordinated attack dealing Cryo DMG', 2.2s CD) is now expressible as a summon-hosted `damage` effect with trigger onHit + procCooldown 2.2 carrying its own application[] — the Albedo/Dehya/Raid

3. **Diona passive** — An ability-hosted `damage` effect with trigger onReaction (reaction filter: superconduct / stellarConduct / cryoSwirl), `armedFor` 20 (the post-skill window — Nahida's Tri-Karma uses exactly this, armedFor 25), `procCooldown` 3.5, `source: 'team'` (party members trigger it), and its own application[

4. **Cyno C2** — C2 base half: gainStacks on {onHit, abilityType:'normal'} with max 5 and procCooldown 0.1, paired with a self buff on electroDmgBonus carrying a perStack BuffValue. All three primitives are wired — gainStacks dispatches on onHit, procCooldown IS honoured on the gainStacks path (unlike character onHi

5. **Klee passive** — gainStacks on {onCast, ability:'skill'} and {onCast, ability:'burst'}, max 3, paired with consumeStacks on {onHit, abilityType:'charged'} — the Yanfei Scarlet Seals shape exactly, which is the corpus precedent for a resource spent by a charged attack. To make it VISIBLE it needs a companion self buf

6. **Varka skill** — Four Winds' Ascension as a SEPARATE skill ability gated on `conditions: {type:'state', state:'inStance'}` (+ the existing teamElementCount tree), with its own `cooldown: 11` and `charges: 2` — the Cyno pattern the parser's own comment names ('each distinct skill ability has its own charge queue keye

7. **Itto burst** — Self RES drop during a stance → two `buff` effects (`allElementalRes: -20`, `physicalRes: -20`), target `self`, `onCast ability:'burst'`, duration 11 matching the stance. Corpus-first negative buff value (0 existing authors), so the value formatter and bar label need one look before landing.

8. **Zibai normal** — In-mode Geo conversion of N/CA → a second `normal` ability gated on `conditions: {type:'state', state:'inStance'}` carrying `infusion: 'geo'`, exactly Cyno's Pactsworn Pathclearer shape (cyno.json:81-91). Her skill is behavior:'stance', which finalize.ts:140-147 turns into a `state` window named `in

9. **Zibai C2** — Re-author the trigger as `{type: 'onState', state: 'inStance'}` and drop the `duration`. The onState pass (buffWindows.ts:773-813) joins the effect to `windows.filter(w => w.kind === 'state' && w.name === state)` and emits one bar per span with `start`/`end` taken FROM the span — so the bar would in

10. **Escoffier passive** — TWO independent authoring wins, both verified in source. (1) The tier ladder: `resShredBase` (buffWindows.ts:367-376) evaluates each effect's conditions against `baseCtx`, which DOES carry `teamElementCounts` (:360-364) — unlike the received/active-target path — so a `teamElementCount` gate on an en

11. **Escoffier C2** — Author the pair: `gainStacks` on `{onCast, ability:'skill'}` granting 5 coldDish (max 5), and `consumeStacks` on `{onHit, abilityType:['normal','charged','plunge','skill','burst'], source:'others'}` spending 1. consumeStacks-on-onHit is wired (stacks.ts:516 `dispatchConsumeStacksOnHit`, gate at :531

12. **Linnea skill** — Lumi's Super Power cadence is a fixed 111/63/144-frame cycle. Three summonTick damage series on one summon, each interval 318f (5.3s) with firstTickDelay 0 / 111f / 174f, reproduce that cycle exactly with wired primitives; `tickCap` bounds the count and `application[]` on each series feeds the gauge

13. **Mika burst** — `activeDuration: 15` on the burst would draw the Eagleplume window as the Q bar's active span — the exact shape Nicole's burst uses for her 20s Silent Contemplation mode and Thoma's for his 8s barrier (rubric C25, 10 authored sites). It is a mode on the character, not a thing left in the world, so ⛔

14. **Barbara skill** — Melody Loop's 15s window on an instant cast -> Ability.activeDuration (the field that retired the zero-effect stand-in summons in the shield/summon split)

15. **Ineffa burst** — Recast truncation of a shared summon — `terminatesOn: 'recast'` on BOTH Birgitta entries (abilities[1].summons[0] and abilities[2].summons[0]) would shorten the still-open prior window to the new spawn, which is exactly the in-game 're-summoned with duration reset'.

16. **Ineffa C6** — The old text was wrong in the OPPOSITE direction — it told the reader the hit OVER-shows, when in fact it does not show at all. The C6 effect is a `damage` proc with no `application[]`, and procs.ts:156-157 rejects exactly that (`if (!eff.application || eff.application.length === 0) return;`), so th

17. **Yaoyao burst** — Up to 3 Yuegui: Jumping Mode. gcsim's burst.go spawns them at frames 104 / 162 / 221, each living until the burst ends. The primitive is the summons[] ARRAY — findSummonsForBar returns the whole array and each entry gets its own lane row (C24, Furina's two summons) — so the 2nd and 3rd could be auth

---

## 🔍 STALE CURATOR NOTES — 44 flagged

Flagged while reading, **not edited** (curator notes have no style contract). Highest-value ones:

- **Durin skill** — The energy effect's note says "effects don't dispatch from normals (post-P4 #2 substrate-only decision)". That is now over-broad: onHit effects DO dispatch per-swing from normals (rubric P2, dispatchHit at run.ts:1145).

- **Columbina C1** — C1 note: "[A7] Rainsea Shield's 250% Hydro-DMG absorption effectiveness is not modeled; it is shown as a generic 12% Max HP shield." — it is NOT shown as anything. The constellation-shield wire (53db108) reaches only `on

- **Albedo skill** — Skill note: "Blossom emission is NOT a summonTick (P3 v1) — it's an onHit-from-summon trigger … the onHit-while-summon-active primitive is a separate future extension." That extension SHIPPED 2026-08-18 and the effect si

- **Albedo C2** — C2 note: "stacks accrue from Transient Blossoms, which are unmodelled (P3 gap) — no honest trigger exists … Revisit once the onHit-from-summon primitive lands." The primitive landed 2026-08-18 and the blossoms ARE modell

- **Nicole effect:shield** — ⚠️ SURFACE DEFECT, not content: this caveat sits on an EFFECT. `collectSlotCaveats` (src/lib/timeline/slotCaveats.ts:58-67) reads `a.caveat` only on ability/passive/constellation hosts, `scripts/caveat-lint.mjs:89-98` sc

- **Nicole effect:damage (Arcane Projection)** — Same surface defect as above: effect-level, so it reaches no reader. Of the burst's two notes only the ability-level Hexerei one renders.

- **Nicole effect:buff (A1)** — Effect-level → renders nowhere. Also note the residual is C6-only but sits on a PASSIVE, which is never constellation-gated (slotCaveats gates by entry, and a passive has no entry level), so once it does render it will s

- **Nicole effect:buff (A4)** — The \_curatorNotes' first ⚠️ says `source:'team'` is 'one step wider than gcsim' and that 'the over-fire is that an off-field summon's elemental hit upgrades Nicole'. That is now WRONG in the other direction — `source` is

- **Baizhu passive (A4)** — \_curatorNotes[1] says 'the Stat union has no bloom-family reaction DMG-bonus keys (Tier-2 reaction schema frozen)'. Partly stale since the faction-buffs round: `bloomReactionBonus` DOES exist now (ability.ts:144), as do

- **Skirk burst** — This ability's note says "Bar is gated on `stacks: { key: serpentsSubtlety, min: 51 }` so it only renders when the bonus is non-zero." Measured false in one case: run.ts:559 sets `stackContext` to undefined when the stac

- **Qiqi skill** — On abilities[0] (normal, not this entry): 'High plunge frames exist in gcsim (highPlungeFrames) but are not represented; recipe uses lowPlungeFrames only.' Stale since the L4b field split — `plungeFrames` IS the high plu

- **Qiqi C4** — '…target "team" + trigger "manual" follows the Traveler (Hydro) C6 precedent… Over-claim on scope is repaired by the caveat.' The caveat CANNOT repair it: authored caveats reach exactly one surface, the planner Notes pan

---

## 🐛 ENGINE BUG FOUND (out of scope — needs a decision)

`applyModifiers` (`src/lib/sim/conditions.ts:296`) calls `evalCondition` with **no `ConditionContext`**,
so a `teamElementCount`-gated `cooldownModifier` evaluates to `null` and `!== true` **skips it**.

**Arataki Itto C2** with two Geo allies shows a **16.5s** burst CD against the game’s **13.5s**, with no caveat.

⚠️ The inconsistency is that `null` means _keep optimistically_ in a buff pool and _drop_ here — the
field’s own doc comment (`conditions.ts:77-79`) says it returns null “so effects aren’t dropped”.
Fixing it is an engine change, not a caveat change.
