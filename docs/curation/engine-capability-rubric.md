# Engine Capability Rubric

> **Re-derived 2026-08-18** by 7 source probes + 3 adversarial refuters (15 of 168 claims refuted
> and corrected inline). ⚠️ **This is a SNAPSHOT of a moving engine — re-derive it at the start of
> any caveat pass rather than trusting it.** The previous edition sat inside the style guide and went
> stale in 14 places over four weeks, which is what made this round necessary.

> ⛔ **THIS SUPERSEDES the "Capability rubric" section of `docs/curation/caveat-style-guide.md`**, which was
> written 2026-07-19/20 and is stale in 14 named places. The style guide's STYLE rules (length, banned tokens,
> voice, verdict taxonomy) are all still in force — only its capability lists are replaced here.
> Re-derived from source by 7 probes + 3 adversarial refuters; 15 of 168 claims were refuted and are corrected inline.

---

## ⚠️ DELTAS — what changed since the last caveat pass

Every line here is a place the OLD rubric is now WRONG. These drive most verdicts.

### D1

**OLD (now false):** Reactions are cast-only + optimistic: no aura decay, no absorbed elements, no gauge/ICD simulation ("windows, not gauges").

**NOW TRUE:** Three of the four clauses are false. There IS a real gauge with per-mod decay (gauge.ts:172-178), there IS ICD simulation at four scopes (icd.ts:39 + per-cast/per-series/per-listener clocks), and applications come from four sources, not casts alone (aura.ts `offerApplication` callers). Every `onReaction` buff/shred bar is now gated on the gauge actually producing that reaction. ONLY "no absorbed elements" survives: grep for `absorb` finds no sim path, and an absorbing Anemo ability still applies only Anemo.

**AUDITOR ACTION:** Split this sentence when auditing. Delete caveats claiming no aura decay / no ICD / cast-only application / 'windows, not gauges'. KEEP every absorption caveat (Kazuha, Anemo Traveler, Wanderer, Sucrose family) — deleting the decay half must not take the absorption half with it.

### D2

**OLD (now false):** Unconsumed triggers: `onEnergy`, `onHPChange/Decrease/Increase`, `onHeal`, `onState`, `onStack`, `manual`; `onShieldEnd`/`onStanceEnd` emit events but don't drive buff windows.

**NOW TRUE:** Two changes. (1) `onState` is now consumed: `getCharacterEffectsForOnState` is emitted at buffWindows.ts:773, so Citlali C2's while-shielded +EM team bar draws — but ONLY for team-target buffs, once per character; a self- or active-target `onState` buff would still draw nothing. (2) `onStanceEnd` NO LONGER EXISTS — retired 2026-08-15 (ability.ts:663-671) and its one author (Hu Tao A1) was re-authored as `afterDuration + ability:'skill'` targeting `teamExcludingSelf`, which the team pass DOES emit. The rest of the list is exactly right, and `manual`/`onShieldEnd` are confirmed dead.

**AUDITOR ACTION:** Delete the `onStanceEnd` clause. Move `onState` to PARTIAL with the team-target scope named. Hu Tao's post-Paramita CRIT share now draws — a caveat saying it is not shown is an implementDelete candidate. ⛔ Do NOT generalise 'onState is wired' beyond team targets.

### D3

**OLD (now false):** **Authored manual triggers are not "Not modeled"** _(wave-3 lesson)_: if the effect exists with a manual trigger, the honest phrasing is "doesn't fire on its own — add it manually" (it IS on the timeline once toggled). Reserve "Not modeled" for mechanics with no authored effect at all.

**NOW TRUE:** FALSE against current code, and this is the single most dangerous stale line in the guide. There is no toggle and no window: grep for `'manual'` across src/lib and src/routes returns exactly one line, the type declaration itself (ability.ts:649). 167 manual-trigger effects across 69 characters reach no planner surface.

**AUDITOR ACTION:** Strike the lesson. "Not modeled" IS the accurate phrasing for a manual-trigger effect's planner absence. ⛔ Never rewrite such a caveat into 'add it manually', and never delete one on the grounds that the effect is authored.

### D4

**OLD (now false):** Stacks: `gainStacks` on onCast/onHit/onReaction (`max`, decay shapes `drain`/`lifetime`/`sourceLifetime`), `consumeStacks` **on onCast only**, per-effect `procCooldown` ICDs, self-vs-team scoping.

**NOW TRUE:** Three corrections. (1) `consumeStacks` now works on `onHit` too (stacks.ts:516, Yanfei's seals) — but NOT on onReaction, which the lint forbids outright (characterLint.ts:2367-2374). (2) `sourceLifetime` has ZERO corpus authors (verified by walking all 123 JSONs), so it is machinery with no data, not a capability. (3) `procCooldown` is honoured for gainStacks, damage procs, artifact 4pc onHit, weapon swap procs, onShieldEnd and durationExtensions — but NOT for character `buff`/`resShred` onHit bars, which read only `evalTriggerFilter` (Lohen's 4s ICD and Traveler Electro C2's 0.5s ICD are ignored).

**AUDITOR ACTION:** Yanfei's hit-consumed seals: implementDelete candidate. Reaction-consumed resources: keep/rewrite. Do not read 'procCooldown ICDs' as covering character onHit buff/shred bars.

### D5

**OLD (now false):** Buff windows: refresh-merge, active-target slicing, all `BuffValue` kinds (perStack, perTeamCount, scaling, ramping/decaying, canonicalAssumption headline), `resShred` debuff windows.

**NOW TRUE:** 'all BuffValue kinds' is wrong three ways. `perTeamCount` never resolves × count — the formatter prints the per-member formula (buffDisplay.ts:74-82) and its only two authors are `passive`-triggered, so they appear as chips, never bars. `ramping`/`decaying` gradients are computed at exactly ONE emit site, the active-target CAST path (buffWindows.ts:1303/1312) — Yelan and Mavuika are covered, Aloy's `manual` Coil ramp is not, and a team/self ramping buff would draw flat. `canonicalAssumption` was RETIRED 2026-07-20 (ability.ts:1247-1254) and is no longer a BuffValue kind at all. `refresh-merge`, `active-target slicing`, `scaling`, `unknown`, `perStack` and `resShred` are all genuinely wired.

**AUDITOR ACTION:** Zibai's per-ally scaling and Aloy's Coil ramp are true omissions — keep. Canonical-rotation assumptions now live in the ability `caveat` as 'Assumes X.' — those caveats ARE the intended surface and must NOT be deleted as 'the schema handles it'.

### D6

**OLD (now false):** Conditions that resolve definitively: `state`, `not/all/any`, `ascension`, `constellation`, `teamFaction`, `teamElementCount`, `activeCharFaction`, `weaponType`, `chainStage`, `stacks`.

**NOW TRUE:** Four of the ten over-claim. `state`: only onField/offField ever resolve in buff-window evaluation — all 88 kit-state conditions over 36 characters return null and render optimistically. `teamElementCount`: resolves for team/self targets but NOT for active-target buffs (`receivedBaseCtx` omits `teamElementCounts`), so Gorou's Geo-count tiers all draw in a one-Geo team; it also never resolves inside `cooldownModifiers`. `activeCharFaction`: supplied only at the per-segment sites and the onFieldDelay waiver; its two direct authors (Linnea A4) sit on a `passive` trigger and draw no bar. `ascension`: resolves, but always against a hardcoded Ascension 4 — every call site passes the literal `4`. `chainStage` is definitively evaluated only for `index: 0` in deriveBuffWindows (every call passes an empty chain index); no Effect authors one today.

**AUDITOR ACTION:** ⛔ Never implementDelete a caveat about a stance/summon-gated buff on the strength of 'state resolves definitively'. A caveat saying 'needs N of element X in the party' on an ACTIVE-target buff is legitimate. 'Assumes Ascension 4' notes are legitimate.

### D7

**OLD (now false):** Trigger dispatch: `onCast`, `onHit` (per-swing, with `damageType`/`filter`/`source`), `onReaction`, `afterDuration`, `onTeamNightsoulBurst`, `passive`, weapon `onSwapIn/Out`, artifact-4pc `onCast`/`onReaction`, `summonTick`.

**NOW TRUE:** Add `onState` (team-target) and artifact-4pc `onHit` (Deepwood, Tenacity, Silken Moon draw since 2026-08-15). Add `whileNormalAttacking` (coordinated-attack waves, 5 summon-hosted authors). Correct three over-claims: `onHit`'s `damageType`/`source` are honoured only on the STACK, ARTIFACT and PROC paths, never on character buff/shred bars; `afterDuration` is emitted only in the team pass; `passive` renders as always-on CHIPS in the planner (TeamBonusesBlock) and as TB capability claims, never as a timeline bar, and shield/heal/elevate passives are excluded from the chips. Also add the entirely-new `onCast.input` gap: the hold/tap gate is read only by the stack dispatchers, so a hold-gated buff (Razor C6, Mavuika C6) draws after a tap E too.

**AUDITOR ACTION:** 'Artifact set does not show' caveats for hit-triggered 4pc sets: implementDelete candidates. Coordinated-attack caveats for Xingqiu/Yelan/Thoma/Fischl C6: implementDelete for the PLANNER only. ⛔ Never classify a hold/tap-gating caveat as implementDelete.

### D8

**OLD (now false):** Cooldowns: `cooldown`, `cooldownModifiers`, base-ability `cooldownStartDelay`, `charges`/`chargeModifiers` with per-variant E-charge queues, variant `bypassesCooldown`, `cdReset` effects (character unconditional; weapon via `procCooldown` — Sacrificial), ghost-CD tails.

**NOW TRUE:** Two live over-claims. (1) `cooldownModifiers` gated on TEAM COMPOSITION never fire — `applyModifiers` passes no `ConditionContext`, so `teamElementCount` returns null and the modifier is skipped; Arataki Itto's C2 reads 16.5s where the game gives 13.5s with two Geo allies. (2) `cdReset` is NOT unconditional for characters: the source walk is passives + unlocked constellations only, `char.abilities` is never walked, so Freminet's burst does not refund his skill cooldown. Also new: the ghost tail now ends at `readyAt` rather than `start + cooldown` (barPhases.ts:91-96) and a cooldown clock can start at the STANCE END (Xilonen, Ifa) — but neither reaches the Team Builder's Compare lane, which constructs a bar with no `readyAt` and prints raw `ability.cooldown`/`ability.charges`.

**AUDITOR ACTION:** ⚠️ HIGHEST-VALUE ROW. Itto C2's caveat was deleted in 2026-07-20 on the claim 'divergence eliminated' — the 3s divergence is still there; restore. Freminet's cdReset caveat is TRUE and should be restored/kept. Constellation/ascension-gated CD caveats are deletable for the PLANNER but not if the caveat is about what the Team Builder shows.

### D9

**OLD (now false):** `consumeStacks` on onHit/onReaction; `durationExtensions` on onHit/onReaction (outside the summon path); summon non-tick effect triggers.

**NOW TRUE:** Half-obsolete. `consumeStacks` on onHit is WIRED (see above); on onReaction it is lint-forbidden. `durationExtensions` on `onReaction` IS dispatched now — to a STANCE window and to `cs.summonExt` (extensions.ts:88-151) — so the 'outside the summon path' clause is wrong for the stance case; what remains true is that only the character who CAUSED the reaction extends their own window (a teammate's reaction inside Collei's or Mizuki's field does not), and that `onHit` extensions are still never dispatched. 'Summon non-tick effect triggers' is now false for `whileNormalAttacking` and for summon-hosted damage procs carrying `application[]`.

**AUDITOR ACTION:** Delete-candidate: caveats saying reaction-triggered extensions are not modelled at all. KEEP: caveats saying a zone is not extended by a TEAMMATE's reaction (Collei, Mizuki).

### D10

**OLD (now false):** No `maxProcs` / per-window proc caps (Escoffier C6 cap).

**NOW TRUE:** The rule is unchanged (no `maxProcs` anywhere) but the named example is now worse than stated: Escoffier's C6 is a `damage` effect with NO `application[]`, so the proc registry rejects it outright (procs.ts:157) — the effect itself never fires, never draws, never applies. The cap is moot because the mechanic is absent. Same for the other 16 application-less damage procs.

**AUDITOR ACTION:** Keep the rule. When auditing an off-field-damage caveat, first check whether the effect authors `application[]`: 13 do (visible), 17 do not (entirely absent). ⛔ Do not let `summonTick.tickCap`'s arrival be mistaken for a proc cap.

### D11

**OLD (now false):** ⛔ FROZEN (Nate, 2026-07-14 — never implement, regardless of schema presence): `elevate` rendering / reaction-DMG derivation; multi-reaction & non-lunar elevate; `stellarConduct`; reaction-multiplier-vs-DMG-bonus distinction.

**NOW TRUE:** `stellarConduct` shipped in the faction-buffs round (2026-07-29) and is live: one enabler in the slot roster REPLACES every Superconduct party-wide (reactionBridge.ts:84 `return [team.teamEnabledReactions.has('stellarConduct') ? 'stellarConduct' : 'superConduct']`), with its own aura-lane label and TB filter. Lunar-Crystallize also ships, emitted ALONGSIDE crystallize when 2+ Moonsign characters are in the team (reactionBridge.ts:75-79). The rest of the frozen list stands.

**AUDITOR ACTION:** Remove `stellarConduct` from FROZEN. A caveat saying Stellar-Conduct or Lunar-Crystallize is not modelled is stale; caveats about their DAMAGE derivation stay frozen/true.

### D12

**OLD (now false):** Per-swing action events (N5 → 5 events, infusion resolution, `plungeVariants` auto-selection, `chargeHits`), summons with ticks/`terminatesOn`, shields (scheduled expiry + `shieldEnd`).

**NOW TRUE:** 'shields (scheduled expiry + `shieldEnd`)' was OVER-STATED when written — the windows existed but NOTHING rendered them until 2026-08-14, and `shieldEnd` still has no renderer. Shields now draw as labelled bars on the summon lane, including constellation-hosted ones (Beidou C1, Yanfei C4). 'Infusion resolution' then meant `NormalAbility.infusion` only; the five `infuse` EFFECTS were orphaned schema until 2026-08-15 and are wired now. 'Summons with ticks' has gained tick CAPS, per-series `icdGate`, conditional cadence, and multi-summon resolution (`summons[1]` was ignored until 2026-08-14).

**AUDITOR ACTION:** Delete caveats saying a shield or a second summon does not appear on the timeline, and caveats saying one of the five `infuse` grants is not modelled. KEEP caveats about a shield on a non-onCast trigger (Thoma's burst), a shield with no duration (Beidou skill, Traveler Hydro C4), and about what happens WHEN a shield ends.

### D13

**OLD (now false):** One surface: the planner NOTES panel — a narrow (240px) scrolling column…

**NOW TRUE:** Still the only surface for authored `caveat` prose (verified by exhaustive grep), but three facts changed: the column is 262px (toolColumns.ts:58 `ASIDE_W = 262`); the panel is now MUTUALLY EXCLUSIVE with the aura LOG occupying the same aside (plannerView.svelte.ts:56-73), and the Notes button disables when a team has no caveats; and constellation caveats are now GATED by the reader's effective constellation (slotCaveats.ts:58) — roughly a third of the corpus's 239 caveats sit on constellation entries and are invisible at C0. Two new engine-wide honesty surfaces exist beside it and are NOT authored caveats: the aura log's AURA_NOTES lead block (+page.svelte:322-329) and the Rotation Planner help chapter's 'What it assumes'.

**AUDITOR ACTION:** Update 240px → 262px. A constellation caveat can never warn a player who does not have the constellation — if the divergence matters at C0, author it on the base ability. Per-character caveats that merely restate an AURA_NOTES line (one enemy, one application per swing, Shatter, the 1U yellow ring) are redundancy-based delete candidates — but note the aura log and the Notes panel cannot both be open, so downgrade to rewrite when in doubt.

### D14

**OLD (now false):** **Presence ≠ reachability** _(wave-3 lesson)_: … read the ability's `_curatorNotes` residuals … A modeled-but-unreachable mechanic is a divergence, not working behavior.

**NOW TRUE:** Still correct and now MORE load-bearing than in July — the engine has grown several classes where the field is authored, the guard is green, and the surface is still wrong or missing (`constellationScaling` prints the base value; a damage proc with no `application[]` fires nothing; `trigger.input` is dropped for buffs; team-gated `cooldownModifiers` are skipped; `tickCap` and stance-end cooldowns do not reach the Team Builder).

**AUDITOR ACTION:** Extend the check from '\_curatorNotes residuals' to: which CONSUMER reads this field, on which SURFACE, and does the value it prints depend on anything the field was supposed to change.

---

## 🪤 TRAPS — where an auditor is most likely to wrongly delete

- A `damage` effect on a proc trigger with NO `application[]` is rejected at src/lib/sim/procs.ts:157 and produces nothing at all — no marker, no application, no bar, and `damage` maps to no Team Builder capability. 17 corpus effects are in this state (Escoffier C6, Chevreuse, Clorinde, Collei A1, Faruzan A4, Ineffa, Kinich, Nicole burst + C, Ororon A, Prune ×2, Razor C, Traveler Electro ×2, Mizuki C, Yun Jin A4) against 13 that work. 'Off-field damage is modelled now' is true for 13 characters and false for 17.
- `BuffEffect.constellationScaling`: the bar DRAWS, so every who-renders check passes — but it prints the BASE value at every constellation (Illuga's +5%/+10%, Xianyun's 200%/400%). The field IS read (by gainStacks and tickCapScaling), so `orphanedSchema.test.ts` stays green. Presence-vs-reachability in its purest form.
- `trigger.input` (hold vs tap): read ONLY by the stack dispatchers. Razor C6's and Mavuika C6's `input:['hE']` buff/shred bars draw after a TAP E as well. The data is authored, the lint checks its shape, and the buff collector never looks at it.
- `cooldownModifiers` gated on team composition are skipped SILENTLY — `applyModifiers` calls `evalCondition` with six arguments and no `ConditionContext`, so `teamElementCount` returns null and the modifier is dropped by `!== true`. Itto C2 is 3s wrong and its caveat was already deleted once on a false 'divergence eliminated'. Traveler Geo's A1 modifier is inert for a different reason: it authors `{type:'ascension', level:1}` where the evaluator reads `cond.min`, and neither TypeScript nor characterLint catches it.
- `cdReset` looks blanket-wired but the walk is passives + unlocked constellations only (cooldowns.ts:88) — `char.abilities` is never walked, and the function's own doc comment falsely claims it is. Freminet's burst is the live casualty.
- ↻ **Summon damage ticks reach FIVE streams and the answer is now YES to four of them (2026-08-31, both halves of `docs/summon-tick-stacks-round.md`).** They drive damage procs, they feed the gauge, they extend artifact 4pc onHit windows, they fire their owner's CHARACTER onHit buff/shred bars (Half B — ten characters, Xiangling C1 went `0.22→6.22s` to `0.22→13.10s`), and they dispatch `gainStacks`/`consumeStacks` on the LIVE tick chain (Half A — Alyosha's Tugarin). ⛔ **This bullet used to say the last two were NO, and that sentence is what let a defect stand for sixteen days** — it survived a fix to `hitRecords` because a hit reaching that list is not a hit reaching a CONSUMER. The two remaining NOs are narrow and measured: a tick cannot fire a `target: 'self'` onHit buff (no corpus author), and it can only write a stack key whose `gainStacks.scope` is `'rotation'` — a segment-scoped key has no container at a tick, because the owner may be off field. So Xiangling C1 and Emilie C2 are tick-anchored now; ⚠️ before deleting a caveat on this basis, check which of the two remaining NOs the character sits in.
- Everything the gauge shows a reader is OPT-IN: the aura lane defaults OFF and the aura log is an aside panel that cannot be open at the same time as the Notes panel. ⛔ Never delete a caveat on the grounds that 'the aura lane shows this' — most readers have never opened it, and the AURA_NOTES limits block lives inside the log panel.
- The Team Builder is a second surface that lags the planner on at least five mechanics: `cooldownModifiers` (raw `a.cooldown`), `cooldownStartsAtStanceEnd` (Compare lanes have no `readyAt`, so Xilonen reads 'castable at 7s' vs the planner's 16s), `charges`/`chargeModifiers` (raw base value, con lens ignored), `summonTick.tickCap` (duration÷interval), and conditional tick cadence (first authored series wins). A caveat that is stale for the planner can still be true for Compare.
- Two surfaces disagree about which constellations the reader has: the Notes panel uses the tab-EFFECTIVE map (`{...$constellations, ...rt.tabCon}`) while TeamBonusesBlock's always-on chips use the SAVED ROSTER only. TeamBonusesBlock also explicitly relies on per-character caveats to disclose that its chips list optimistically with conditions unevaluated (its own comment says so) — those caveats are load-bearing for a surface the planner's parser does gate but the chip strip does not.
- A stance's GATING clamps at a swap but its DRAWN WIDTH does not — the E/Q pill keeps the full authored duration. Buffs conditioned on the stance end correctly; the bar lies. Knowingly out of scope.
- `enemyAffectedBy` is still unanswerable despite the gauge round. `ConditionContext` has six fields and none is aura or HP, and `deriveBuffWindows` receives no aura input. The aura lane can visibly show no Cryo at the instant a Cryo-gated buff bar draws — which makes the caveat more useful, not less.
- A stack TIER LADDER authored as N same-stat effects (Neuvillette A4) is deduped by `stat` BEFORE the stack condition is evaluated, so only the first-authored tier survives and the bar vanishes at every other stack count. A single `perStack` BuffValue is genuinely wired; the ladder shape is not. Check which shape the character uses before deleting.
- `onState`, `afterDuration` and `onTeamNightsoulBurst` each have exactly ONE collector call site, in the TEAM pass. Any of them authored on a self- or active-target effect would draw nothing. Today's corpus happens to sit entirely inside the handled paths — a green who-renders check on today's data is not a statement about the trigger.
- The wave-4 who-renders check must be applied by TRIGGER as well as by target: `manual` (167 effects, 69 characters) and `passive` (72 effects, 40 characters — chips only, never bars, and shield/heal/elevate excluded even from the chips) are the two largest classes of authored-but-not-on-the-timeline data in the corpus.
- scripts/caveat-lint.mjs is in no npm script and no CI gate — only characterLint E.26 (ten banned substrings, 280 warn / 400 fail) runs under vitest. A rewrite that clears E.26 can still violate the camelCase, frame-count, backtick and sentence-count rules. The corpus is currently at 0 FAIL / 0 WARN, so any new finding is attributable to the wave.
- Artifact-set effect-level `caveat` strings (silken_moons_serenade.json:29, :50) are untyped extra JSON properties with no reader anywhere in src — `Effect` has no `caveat` field. They look like live warnings and are not. `orphanedSchema.test.ts` cannot see this because it matches by key name and `caveat` IS accessed, on abilities.

---

## ✅ CAN — wired end to end (stale caveats about these are delete candidates)

**C1.** A real elemental gauge with decay, attach modes and per-mod trajectory — not "windows, not gauges". Decay is `(0.8×gauge)/(2.5×gauge+7)` U/s subtracted every frame, with a frozen ramp and top-up/refresh/too-weak attach rules.

- _evidence:_ src/lib/utils/gauge.ts:172-178 (`AURA_TAX = 0.8`, `auraDuration = 2.5*gauge+7`, `auraDecayRate`); gauge.ts:190-192 frozen ramp constants; live gauge sampled at src/lib/sim/aura.ts (createAuraState/collectAuraSeries)
- _surface:_ Aura lane line per mod + "<label> gone" row in the aura log (src/lib/timeline/auraPlot.ts, src/lib/timeline/auraLog.ts:147-155)

**C2.** Reactions are emitted from the gauge, not assumed at cast: Vaporize/Melt (both directions), Overload, Superconduct, Electro-Charged, Freeze, Swirl ×4, Crystallize ×4, Quicken/Aggravate/Spread, Bloom/Burning/Hyperbloom/Burgeon, plus Stellar-Conduct and Lunar-Crystallize.

- _evidence:_ src/lib/utils/gauge.ts:78-97 (`ReactionKind`) + the per-element switch in `applyElement`; translation src/lib/sim/reactionBridge.ts:69-111; IR events pushed at src/lib/sim/aura.ts:213-216
- _surface:_ Aura-lane reaction markers, aura-log rows, and every `onReaction` buff/resShred bar (which now only draws if the gauge actually produced that reaction)

**C3.** Four independent sources of elemental application: cast `application[]` entries, N/C/P swings, summon damage-tick chains, and procs (onReaction / onHit / whileNormalAttacking).

- _evidence:_ All four call `offerApplication` in src/lib/sim/aura.ts (cast schedule, `emitReactionsAtSwing`, the summon tick chain, `fireProc` from `scheduleReactionProcs`/`notifyDamage`/`notifyNormalAttack`)
- _surface:_ One application pip per source on the aura lane + one row each in the aura log

**C4.** Real ICD simulation, with per-source scopes: a (character, tag) clock for N/C swings, a per-cast clock for a cast's own hits, per-series clocks for summon ticks, per-listener clocks for procs, plus Burning's own re-application ICD.

- _evidence:_ src/lib/utils/icd.ts:39 `STANDARD_ICD_FRAMES = { timer: 150, hits: 3 }`, `icdApplies`, `resolveActionIcd`; summon key `${char.id}:summon:${summon.label}:${series.index}` in src/lib/sim/aura.ts:772; gauge.ts:220 `BURNING_ICD`
- _surface:_ Decides which hits become application pips / log rows / gauge deflections

**C5.** `summonTick.icdGate` — a tick series can declare its own application window ('none' = every tick applies; absent = standard).

- _evidence:_ src/lib/sim/aura.ts:777-781 `const gate = ... ; const params = gate === 'none' ? null : gate ? icdParamsFor(gate) : STANDARD_ICD_FRAMES`; shared translation src/lib/utils/icd.ts:68
- _surface:_ Which summon ticks produce an aura-lane pip / log row (deliberately NOT the summon-lane tick marks, which say the tick HAPPENED)

**C6.** `application[]` empty vs absent are visibly different: `[]` is the positive claim that the cast applies nothing (no pip at all); absent falls back to the character's element at frame 0, 1U, marked provisional.

- _evidence:_ src/lib/sim/aura.ts:471-476 (`if (!application) return char.element ? [{frame:0, element, units: DEFAULT_UNITS, provisionalUnits: true}] : []`); corpus census over src/lib/data/characters/\*.json skill+burst: 201 authored, 34 empty, 33 absent across 18 characters
- _surface:_ Aura lane: no pip vs a pip with a `--ui-provisional` foot

**C7.** Constellation gating at COLLECTION — a locked constellation entry contributes no effects at any decision site, and its caveat does not show either.

- _evidence:_ src/lib/utils/effectCollection.ts:76-93 (`unlockedConstellations` / `effectSourcesAtConstellation`), :104-106 (`effectSourcesOf` takes cLevel as a required param); applied at src/lib/sim/cooldowns.ts:88, src/lib/sim/shields.ts, stacks.ts, and src/lib/timeline/slotCaveats.ts:58; guarded by src/lib/utils/constellationGating.test.ts
- _surface:_ Every buff/debuff bar AND the Notes panel — a C6 note no longer appears in a C0 rotation
- ⚠️ **REFUTED / CORRECTED:** Constellation gating at collection is WIRED for buff/debuff bars, shields, stacks, cooldown resets, parser guards and the Notes caveats. It is NOT applied to the planner's always-on permanent-bonus chip strip, which reads `$constellations` (saved roster) rather than the tab-effective map; and proc listeners are gated by authored condition rather than by entry.

**C8.** Shield spans draw as labelled bars on the summon lane, including from constellation-hosted `shield` Effects (Beidou C1, Yanfei C4).

- _evidence:_ src/lib/timeline/shieldRows.ts:44-85 projects `shield` windows into `SummonSubrow`; src/lib/sim/shields.ts:139 (half A, resolved ability) + :146-148 (`getNonAbilityEffectsForCast`); asserted in src/lib/sim/shields.test.ts
- _surface:_ Summon lane bar between the E and Q rows; also the PNG export

**C9.** `infuse` Effects (Bennett C6, Candace Q, Dori C6, Kazuha C6, Lohen E) are resolved and applied — and a stance's own `NormalAbility.infusion` wins over a granted one.

- _evidence:_ src/lib/sim/infusions.ts:52-97, :113-134 (`infusionAt`, newest wins); consumed at src/lib/sim/run.ts:1073, 1200, 1301 (`activeNormal?.infusion ?? infusionAt(...)`)
- _surface:_ Normal/charged/plunge block tinted with the granted element (RotationTimeline.svelte:2417-2419) and the swings apply that element to the gauge

**C10.** Artifact 4pc dispatch now covers `onHit` as well as `onCast`/`onReaction` — Deepwood Memories, Tenacity of the Millelith and Silken Moon's Serenade draw, rotation-wide, fed by summon-tick hits synthesized at finalize.

- _evidence:_ src/lib/utils/buffWindows.ts:945-1073 (the onHit branch, using `onHitTriggerMatches` at :1049 over `charHits`); synthesis src/lib/sim/finalize.ts:430-452
- _surface:_ Team-surface buff/debuff bars in the planner

**C11.** `whileNormalAttacking` coordinated-attack waves (Xingqiu Q, Yelan Q, Thoma Q, Fischl C6) fire on elapsed animation TIME, not swing count.

- _evidence:_ src/lib/sim/procs.ts:436-460 `takeWaveFires` (`t = max(spanStart, l.start, l.lastFire + interval)`), notified from src/lib/sim/run.ts:1099; markers via `tickKey` → src/lib/sim/finalize.ts:417-427 → src/lib/timeline/summonSubrows.ts:170
- _surface:_ Tick markers on the host summon's bar + aura-lane applications + aura-log rows

**C12.** Summon tick cadence (`interval` + `firstTickDelay`) is published by the PARSE and read by the projection — the marks a reader counts and the ticks that fire are one computation.

- _evidence:_ src/lib/sim/summons.ts:251-272, :166-193; src/lib/sim/finalize.ts:412-427 (`win.ticks`); consumed src/lib/timeline/summonSubrows.ts:170, RotationTimeline.svelte:2293, src/lib/utils/timelineExport.ts:851-853
- _surface:_ Summon-lane tick marks + PNG export

**C13.** `consumeStacks` on an `onHit` trigger (Yanfei's Scarlet Seals spent by a charged attack).

- _evidence:_ src/lib/sim/stacks.ts:516 `dispatchConsumeStacksOnHit`, gate at :531; called from src/lib/sim/run.ts:346; lint opens the schema at src/lib/utils/characterLint.ts:2367-2374
- _surface:_ The `perStack` value printed on the buff bar (src/lib/timeline/buffDisplay.ts:49-73) and `stacks`-gated bars appearing/disappearing

**C14.** `cooldownStartsAtStanceEnd` — the cooldown clock can start at the stance's end (Xilonen, Ifa), and the ghost-CD tail ends at `readyAt`, not `start + cooldown`.

- _evidence:_ src/lib/sim/run.ts:583, :592; src/lib/timeline/barPhases.ts:91-96 (`bar.readyAt !== undefined ? bar.readyAt - bar.start : bar.cooldown`)
- _surface:_ Planner ghost-CD tail and the placement of the next cast; also the PNG export

**C15.** `onTeamNightsoulBurst` buffs draw on both the team and self surfaces (Ifa, Kachina, Mavuika, Varesa, Xilonen).

- _evidence:_ src/lib/utils/buffWindows.ts:819 and :1767; collector src/lib/utils/effectCollection.ts:529. Corpus: 6 authors, 5 buff + 1 heal
- _surface:_ Team buff rows / received buff rows
- ⚠️ **REFUTED / CORRECTED:** `onTeamNightsoulBurst` buffs reach the RECEIVED (self) surface only — all five buff authors are `target: 'self'`. The team-target NB pass is dormant corpus-wide, and Iansan's NB-triggered `heal` (target `active`) reaches no buff row.

**C16.** Weapon `onSwapIn`/`onSwapOut` procs with refinement-scaled `procCooldown` ICDs (The Widsith, Thrilling Tales).

- _evidence:_ src/lib/utils/buffWindows.ts:1142-1194 `processWeaponEffects`, driven at :1197-1226
- _surface:_ Received-buff rows carrying duration / procCooldown / mutual-exclusivity in the tooltip

**C17.** `factionBonuses` get their own provenance-split window, row and label; `teamFaction` resolves definitively in every buff context.

- _evidence:_ src/lib/utils/effectCollection.ts:117-131, :152-154; pools split at src/lib/utils/buffWindows.ts:133-172; labelled after the BONUS at src/lib/timeline/teamBuffRows.ts:100-118
- _surface:_ Team + received buff rows under the bonus's own name

**C18.** `BuffEffect.onFieldDelay` (Nicole A4 Methexis, C4) — each receiver's segment starts 3s into their on-field time unless the waiver resolves definitively true.

- _evidence:_ src/lib/utils/buffWindows.ts:1330-1358; lint B.14 at src/lib/utils/characterLint.ts:1760-1777
- _surface:_ Received-buff bar start per receiver

**C19.** Refresh-merge of buff bars on both the team and received surfaces (windows stay one-per-trigger in the IR; only the drawing merges).

- _evidence:_ src/lib/timeline/mergeRefreshedBars.ts:44-51, :71-80; applied at src/lib/timeline/teamBuffRows.ts:170 and charReceivedBuffRows.ts:113-125
- _surface:_ Buff rows in the planner and in the PNG export

**C20.** Transient states — `opensTransientState`, `actionOpensState`, `consumesState`, spec-level `terminatesOnSwap` — are tracked and gate variant resolution and state-conditioned effects.

- _evidence:_ src/lib/sim/states.ts:169-211 `openTransientState`; cast site src/lib/sim/run.ts:744-764; action sites :1109, :1317; close at :772-774
- _surface:_ Which variant a token resolves to (the E/Q pill's label, cooldown and width) — Flins sQ, Varesa sQ, Durin's forms
- ⚠️ **REFUTED / CORRECTED:** True for parser-side decisions (variant matching, transient consumption, shields/stacks/infusion condition trees, which are handed real state snapshots). FALSE for buff/debuff bars: every team-surface `evalCondition` in buffWindows.ts passes `new Set()` as resolvedStates (:372, 410, 468, 510, 533, 569, 646, 718, 787, 831, 1097), and conditions.ts:136-140 returns null for an unlisted state — so a kit-state-gated buff bar (inStance, duringSummon, nightsoulBlessing, …) renders optimistically. Only 'onField'/'offField' are ever populated (buffWindows.ts:1603, 1692, and segResolved/segNegated at :1380-1381).

**C21.** Variant `bypassesCooldown` (Flins Thunderous Symphony) — the sQ cast neither waits for nor writes the shared burst clock.

- _evidence:_ src/lib/sim/run.ts:396-414 and :618-622
- _surface:_ The Q row's bar placement and label

**C22.** Conditions `not/all/any` propagate three-valued (Kleene) logic; `constellation`, `teamFaction`, `stacks` and `weaponType` (at the per-receiver slice) resolve definitively.

- _evidence:_ src/lib/sim/conditions.ts:211-256 (combinators), :134-135, :154-161, :143-153, :194-200; receiver weapon supplied at src/lib/utils/buffWindows.ts:1396, :1506
- _surface:_ Whether a buff bar draws at all

**C23.** `charges` / `chargeModifiers` with per-variant E-charge queues (planner only).

- _evidence:_ src/lib/sim/conditions.ts:373-385 `resolveEffectiveCharges`; queue src/lib/sim/run.ts:453-457, :516-525; wait scan :461-466
- _surface:_ Where the next E bar lands on the timeline (there is no charge counter anywhere)

**C24.** Multiple summons from one cast (Furina's Salon Solitaire + Singer of Many Waters) each get their own lane row.

- _evidence:_ src/lib/sim/summons.ts:46-75 (`findSummonsForBar` returns the WHOLE array), :91-98, :132-144; src/lib/timeline/summonSubrows.ts:117-141
- _surface:_ Summon-lane rows

**C25.** `activeDuration` gives an instant cast its own active window (12 authors incl. Zhongli hE, Xinyan, Kirara, Layla, Thoma, Nicole).

- _evidence:_ src/lib/types/ability.ts:2143-2151 `getActiveDuration`; src/lib/sim/resolve.ts:127-148 six-rung precedence
- _surface:_ The E/Q bar's active span
- ⚠️ **REFUTED / CORRECTED:** `activeDuration` is WIRED, with 10 authored sites across 8 characters (Kirara, Layla, Nicole, Noelle, Thoma, Xinyan, Yun Jin, Zhongli) — not 12 authors. Beidou, Citlali, Ineffa and Nahida mention the field only in curator notes.

---

## 🟡 PARTIAL — works on some paths only (⛔ NEVER a blanket delete)

**P1.** `onCast.input` — the hold-vs-tap gate on a trigger

- ✅ works for: `gainStacks` / `consumeStacks` only (Skirk Tap-E 45 vs Hold-E 18)
- ❌ does NOT work for: buff / resShred / shield / infusion collection. `collectOnCastEffects` never reads it, so those bars draw on ANY cast of the matching ability type — Razor C6 (`input:['hE']`, crit bonuses) and Mavuika C6 (`input:['hE']`, DEF shred) both draw after a TAP E too.
- _evidence:_ Declared src/lib/types/ability.ts:493-497. Read ONLY at src/lib/sim/stacks.ts:90-91 and :178-179. `collectOnCastEffects` (src/lib/utils/effectCollection.ts:280-299) matches `src.abilityType === castType` and resolves `castLabel` against `variant.input` (a DIFFERENT field, :276) — verified by grep: the only `trigger.input` readers in src/lib are stacks.ts

**P2.** Character-hosted `onHit` buff / resShred windows

- ✅ works for: `source:'self'` (the default) and `trigger.filter`; per-swing anchoring for N/CA/P
- ❌ does NOT work for: `source:'team'`/`'others'` and `damageType` are IGNORED (the pools never call `onHitTriggerMatches`), so Nicole's A4 (`onHit`, `damageType:'elemental'`, `source:'team'`) fires off her OWN casts and never off a teammate's. A skill/burst `onHit` buff anchors at the cast instant, not the hitmark. A passive/constellation `onHit` with no `abilityType` is excluded from the N/CA/P pass entirely (Yoimiya C1). `procCooldown` is not honoured on these bars (Lohen C, Traveler Electro C2).
- _evidence:_ `onHitTriggerMatches` (src/lib/sim/hits.ts:69-96) is called at exactly three places — src/lib/utils/buffWindows.ts:1049 (ARTIFACT branch only), src/lib/sim/stacks.ts:414 and :532, src/lib/sim/procs.ts:396. Character pools use only `evalTriggerFilter`. `hitsForTrack` (buffWindows.ts:284-293) hard-filters `h.characterId === track.characterId` and `h.abilityType === cls` for cls ∈ normal|charged|plunge

**P3.** Off-field damage procs (`onHit` / `onReaction` / `whileNormalAttacking` damage effects)

- ✅ works for: The 13 effects that carry a non-empty `application[]`: Aino, Albedo, Beidou burst, Dehya, Fischl ×4 (both Ozes), Nahida, Raiden, Thoma, Xingqiu, Yelan — these produce aura-lane applications, aura-log rows, and (when summon-hosted and not an `onReaction`) tick markers on the summon bar
- ❌ does NOT work for: The 17 that do NOT carry `application[]` produce NOTHING — no marker, no application, no bar, and `damage` maps to no Team Builder capability: Chevreuse C, Clorinde C, Collei A1, Escoffier C6, Faruzan A4, Ineffa C, Kinich C, Nicole burst + C, Ororon A, Prune A + C, Razor C, Traveler Electro ×2, Mizuki C, Yun Jin A4
- _evidence:_ src/lib/sim/procs.ts:156-157 `if (eff.type !== 'damage') return; ... if (!eff.application || eff.application.length === 0) return;`. Census run over src/lib/data/characters/\*.json (abilities+summons+variants+passives+constellations, trigger ∈ onReaction|onHit|whileNormalAttacking, type 'damage'): 13 with `application`, 17 without

**P4.** Summon damage ticks entering downstream streams

- ✅ works for: (a) the PROC/damage stream — a summon tick can fire Raiden's Eye etc. (src/lib/sim/aura.ts:846 `notifyDamage` inside the tick chain); (b) the ARTIFACT 4pc `onHit` branch, which walks `charHits` including the finalize-synthesized tick hits
- ❌ does NOT work for: (a) the STACK machinery — synthesized hits deliberately bypass `dispatchHit`, so a summon's ticks never grant or spend a resource; (b) CHARACTER `onHit` buff/resShred bars — `hitsForTrack` only selects normal|charged|plunge hits, and a synthesized tick is tagged `abilityType: win.source` (skill|burst), so Xiangling C1 / Emilie C2 / Escoffier A4 / Anemo Traveler C6 bars stay anchored to the cast and are NOT extended by ticks
- _evidence:_ src/lib/sim/finalize.ts:383-392 ("THESE HITS FEED deriveBuffWindows ONLY — deliberately NOT put through dispatchHit"), :430-452; src/lib/utils/buffWindows.ts:1015-1018 (artifact `charHits`) vs :284-293 (`hitsForTrack`)

**P5.** `cooldownModifiers`

- ✅ works for: unconditional, `constellation`-gated and `ascension:{min}`-gated modifiers (Bennett E 5s→4.0s, Kazuha C1, Amber C4, Flins C1, Qiqi)
- ❌ does NOT work for: any modifier gated on TEAM COMPOSITION. `applyModifiers` calls `evalCondition` with SIX arguments and never passes a `ConditionContext`, so `teamElementCount` returns null and the modifier is skipped. Live case: Arataki Itto C2's two Geo-ally rungs (−1.5s each) never fire — his burst reads 16.5s at C2 regardless of party, vs 13.5s in game. Separately Traveler Geo's A1 modifier authors `{type:'ascension', level:1}` where the evaluator reads `cond.min`, so it is silently inert. AND the Team Builder reads raw `ability.cooldown` — it shows Bennett 5s where the planner shows 4.0s.
- _evidence:_ src/lib/sim/conditions.ts:297-321 (`applyModifiers` → `evalCondition(mod.conditions, ascension, resolvedStates, constellationLevel, chainIndex, stacks)` — 6 args, no context); conditions.ts:168-187 `if (!context?.teamElementCounts) return null;`; conditions.ts:132 `case 'ascension': return ascension >= cond.min;`; corpus dump of all 7 `cooldownModifiers` sites confirms Itto's two teamElementCount rungs and traveler_geo's `level` key

**P6.** `cdReset` effects with `source:'character'`

- ✅ works for: a cdReset hosted on a PASSIVE or a CONSTELLATION (Kazuha C1)
- ❌ does NOT work for: a cdReset hosted on the ABILITY itself. The source list is `[...(char.passives ?? []), ...unlockedConstellations(char, constellationLevel)]` — `char.abilities` is NOT walked, despite the function's own doc comment claiming it walks "the character's burst, passives, and constellations". Corpus: exactly two character cdReset effects, and Freminet's is on `freminet__burst__shadowhunters_ambush` (`resets: 'skill'`), so his burst does not refund his skill cooldown on the timeline.
- _evidence:_ src/lib/sim/cooldowns.ts:62-64 (the stale doc comment) and :88 (the source array); corpus JSON walk finds cdReset only on kaedehara_kazuha (constellation) and freminet (ability)

**P7.** `onState` buff windows (co-extensive with a state or shield span)

- ✅ works for: team-target buffs only, once per character — Citlali C2's while-shielded +EM bar draws
- ❌ does NOT work for: self-target and active-target-only `onState` buffs, which would draw nothing. `getCharacterEffectsForOnState` has exactly ONE call site, inside the team pass, gated on `firstTrackOfChar`, and the pool requires `targetsTeamOrActive && !isActiveTargetOnly`. Latent today: Citlali is the corpus's only `onState` author (census: 1 effect, 1 character).
- _evidence:_ grep for `getCharacterEffectsForOnState` in src/lib returns src/lib/utils/buffWindows.ts:55 (import) and :773 (the sole call); pool filter at buffWindows.ts:781-800

**P8.** `afterDuration` buff/debuff windows

- ✅ works for: `team` / `teamExcludingSelf` buffs and enemy resShred (Itto C4, Hu Tao A1, Raiden C4, Chongyun A4)
- ❌ does NOT work for: self-target and active-target `afterDuration` buffs — `getCharacterEffectsForAfterDuration` has exactly one call site, inside the team pass. Also the two `energy`-type authors (Diona C1, Venti A4) have no planner consumer at all.
- _evidence:_ grep: src/lib/utils/buffWindows.ts:453 is the only call. Corpus census: 7 afterDuration effects across 6 characters — 4 buff, 1 resShred, 2 energy

**P9.** `passive`-trigger effects

- ✅ works for: buff and resShred effects hosted on `char.passives` or on an UNLOCKED constellation entry — they render as CHIPS in the planner's always-on strip with a hover tooltip of stat + value (this is the surface probe 6 said did not exist; corrected here). They also become Team Builder capability claims.
- ❌ does NOT work for: They never draw a timeline BAR. `shield`, `heal` and `elevate` passives are deliberately excluded from the chips. Conditions on the listed effects are NOT evaluated — the chips list optimistically. And the chip strip resolves the constellation level from the SAVED ROSTER (`$constellations`) while the Notes panel resolves it from the tab-effective map, so the two surfaces can disagree about which constellations the reader has.
- _evidence:_ src/lib/components/TeamBonusesBlock.svelte:60-91 (`permanentPassives` requires `fx.trigger.type === 'passive'`; `permanentConstellations` filters to `buff`/`resShred` and uses `$constellations[c.id] ?? 0`), :96-118 (`chipEffects` → `formatBuffDisplayValue`); mounted at src/routes/(scene)/(tools)/rotation-planner/+page.svelte:567. No `'passive'` branch exists anywhere in buffWindows.ts (grep returns nothing). Notes panel uses the effective map at +page.svelte:291. Corpus: 72 passive-trigger effects across 40 characters — 58 buff, 12 elevate, 2 shield
- ⚠️ **REFUTED / CORRECTED:** Passive-trigger effects chip as claimed, but shield/heal/elevate exclusion applies to CONSTELLATION entries and to the tooltip ROWS only — a passive hosting only such effects still produces a chip with an empty tooltip (Noelle's Devotion is the live case).

**P10.** BuffValue `perTeamCount`

- ✅ works for: it reaches the always-on chip tooltip (Zibai's two Geo/Hydro-ally DEF buffs are `passive`+`self`, so they are chipped)
- ❌ does NOT work for: the value is never resolved × count — the formatter prints the per-member FORMULA (`+15%/geo ally (cap 45%)`), and no `perTeamCount` effect draws a timeline bar (both corpus authors are `passive`-triggered).
- _evidence:_ src/lib/timeline/buffDisplay.ts:74-82 (formula only); type JSDoc at src/lib/types/ability.ts:1183-1184 ("live × count resolution against the loadout is a renderer follow-up"); zibai.json passives[1] effects are `buff/passive/self` with `perTeamCount` values

**P11.** BuffValue `ramping` / `decaying` envelopes

- ✅ works for: `target:'active'` cast-triggered buffs only — Yelan's burst ramp and Mavuika's decay draw as gradients
- ❌ does NOT work for: any other target or trigger. `rampParams`/`decayParams` are computed at exactly ONE emit site (the active-target cast path) and consumed only by the received surface; a `team`- or `self`-target ramping buff would draw a flat bar with the formula in text. Aloy's Coil ramp is `trigger:'manual'` and draws nothing at all.
- _evidence:_ grep for rampParams/decayParams in src/lib: buffWindows.ts:1303, :1312 (computed), :1421-1422 (carried), charReceivedBuffRows.ts:86-87 (consumed) — no other site

**P12.** Condition `teamElementCount`

- ✅ works for: `target:'team'` and `target:'self'` buffs (Gorou C6's three exclusive tiers resolve, exactly one draws)
- ❌ does NOT work for: `target:'active'` buffs — `receivedBaseCtx` is literally `{ teamFactionCounts, teamEnabledReactions }` and the per-segment ctx omits it too, so Gorou's A1/A4 Geo-count tiers all render regardless of party composition (his +15% Geo DMG bar draws in a one-Geo team). It also never resolves inside `cooldownModifiers` (see that row).
- _evidence:_ src/lib/utils/buffWindows.ts:1140 `const receivedBaseCtx: ConditionContext = { teamFactionCounts, teamEnabledReactions };` vs baseCtx at :360-364 which carries `teamElementCounts`; conditions.ts:168-187

**P13.** Condition `activeCharFaction`

- ✅ works for: the `onFieldDelay` waiver evaluation only (Nicole's Hexerei-receiver waiver)
- ❌ does NOT work for: its two DIRECT corpus uses (Linnea A4's routed DEF→EM pair) sit on a `passive` trigger, so they draw no bar — they list optimistically as chips with the condition unevaluated.
- _evidence:_ conditions.ts:188-193; supplied only at src/lib/utils/buffWindows.ts:1383-1385, :1494-1496 and :1348-1354; linnea.json passives[1] effects are `buff/passive` (verified by JSON dump)

**P14.** Condition `ascension`

- ✅ works for: it evaluates definitively
- ❌ does NOT work for: it always evaluates against a hardcoded Ascension 4 — every `deriveBuffWindows` call site passes the literal `4`, and there is no per-character ascension input anywhere in the planner. An A1/A4 passive always shows as unlocked.
- _evidence:_ src/lib/sim/conditions.ts:31 `DEFAULT_ASCENSION = 4`, :132-133; the literal `4` at buffWindows.ts:372, 410, 468, 510, 533, 569, 646, 718, 787, 831, 993, 1097, 1258, 1285, 1348, 1400, 1443, 1463, 1512, 1629, 1656, 1709, 1732, 1776

**P15.** Condition `state` (kit states) inside buff-window evaluation

- ✅ works for: `onField` / `offField`, on the self-target and per-segment active-target paths
- ❌ does NOT work for: every kit state — inStance, duringSummon, nightsoulBlessing, apexDrive, darkForm, symphonyWindow, transmuting — returns null in `deriveBuffWindows`, so a state-gated buff/shred bar renders OPTIMISTICALLY at every trigger. The parser HAS those windows (it uses them for the `onState` span join) but never feeds them back into condition evaluation. Corpus: 88 `state` conditions over 36 characters.
- _evidence:_ src/lib/sim/conditions.ts:136-140; every team-surface call passes `new Set()` as resolvedStates (buffWindows.ts:372, 410, 468, 510, 533, 569, 646, 718, 787, 831, 1097); only :1603-1608 (`selfResolved = new Set(['onField'])`) and :1384-1396 (`segNegated`) put anything in

**P16.** `terminatesOnSwap` on a stance

- ✅ works for: the GATING half — the `inStance` window, its `opensState` companions and every buff conditioned on them clamp at the swap-out
- ❌ does NOT work for: the VISIBLE half — the E/Q pill still draws the stance's full authored duration. Measured example in the source comment: a swap-terminated stance keeps its full owner-bar width while `end` clamps. Knowingly out of scope (⚓ Nate 2026-08-15).
- _evidence:_ src/lib/sim/run.ts:1420-1428 (clamp) and :1466-1468 ("barRef is intentionally retained … a swap-terminated stance keeps its full owner-bar width while `end` clamps to the swap-out time")

**P17.** `summonTick.tickCap` / `tickCapScaling`

- ✅ works for: the planner — summon-lane marker count, synthesized off-field hits, gauge applications, PNG. 21 authored sites across 10 characters (Aino, Kazuha, Kaeya, Kuki, Mona, Sayu, Sigewinne, Sucrose, Mizuki, Zhongli).
- ❌ does NOT work for: the Team Builder's Compare/Audition lane, which re-derives ticks as duration÷interval with no cap parameter — so Sayu's Daruma draws 6 marks in the planner and 8 in Compare.
- _evidence:_ src/lib/sim/summons.ts:182-190, :203-221; TB derivation at src/routes/(scene)/(tools)/team-builder/lib/compare.ts:201-203 `for (let t = firstDelay; t < uptime && ticks.length < MAX_TICKS; t += interval)` — no cap argument; the capability record carries only interval/firstTickDelay (deriveCapabilities.ts:363-370)

**P18.** Conditional tick cadence (two mutually-exclusive `summonTick` series on one summon: Aino under Moonsign, Ororon C4, Kaeya C6)

- ✅ works for: the planner — markers and the gauge both read one answer, gated by a `ConditionContext` handed to both readers
- ❌ does NOT work for: the Team Builder's Compare lane, which takes the FIRST authored damage series and never consults effect `conditions` — Aino always shows the non-Moonsign 1.5s cadence, Ororon the C0 1s, Kaeya the C0 0.667s, regardless of the con lens or team. Also note gating drops only a DEFINITIVE false, so an unresolvable condition fires BOTH series.
- _evidence:_ src/lib/sim/summons.ts:261-264; contexts at src/lib/sim/finalize.ts:211-214 and aura.ts:752-757; TB at src/lib/capabilities/deriveCapabilities.ts:429-431 (`.find(e => e.type === 'damage' && e.trigger?.type === 'summonTick')`)

**P19.** Reverse vs forward Vaporize/Melt

- ✅ works for: the GAUGE — the right multiplier is spent and the right amount consumed
- ❌ does NOT work for: the IR and every planner surface: `reactionBridge` collapses both pairs to `['vaporize']`/`['melt']`, so the aura lane and log say only "Vaporize"/"Melt". Only the Visualizers' Gauge Explorer names the multiplier.
- _evidence:_ src/lib/sim/reactionBridge.ts:82-88; the lossiness is documented at src/lib/utils/auraDisplay.ts:146-153 ("that translation is LOSSY, DELIBERATELY … and that is a real gap")

**P20.** The crystallize 1s GCD

- ✅ works for: the RULE is modelled and correctly suppresses the second shard, so a Zhongli rotation no longer crystallizes on every cast
- ❌ does NOT work for: a blocked crystallize is rendered as itself only in the Gauge Explorer. In the planner it is an ABSENCE — no marker, no log row, nothing saying a crystallize was refused.
- _evidence:_ src/lib/utils/gauge.ts:760-783 (`if (S.frame < S.crysGcdUntil) emit('crystallizeBlocked', …)`); src/lib/sim/reactionBridge.ts:80-81 `case 'crystallizeBlocked': return [];`

**P21.** Electro-Charged and Burning

- ✅ works for: both are fully simulated — the 1s / 0.4U EC drain, Burning's fixed 2U aura plus a draining fuel series, and both lines draw on the aura lane
- ❌ does NOT work for: the EC tick EVENT is not in the IR (pushed as `{kind:'ecTick'}`, which `offerApplication` skips), so a long EC sustained with no new applications shows ONE marker in the planner; and Burning's own re-applied Pyro is applied with `appIndex: null` and never enters `applications`, so the Pyro line refreshes with nothing above it saying why. Tick DAMAGE is unmodelled in both cases.
- _evidence:_ src/lib/utils/gauge.ts:426-468 (`startEC`/`ecTick`, `{kind:'ecTick'}` at :151), :472-499 (`startBurning`, internal Pyro at :497); filter at src/lib/sim/aura.ts:206 `if (e.kind !== 'reaction') continue`

**P22.** Dendro cores

- ✅ works for: full lifecycle — 30f spawn delay, 6s life, cap 5 with the sixth popping the oldest; Hyperbloom and Burgeon reach the planner as reaction markers, log rows and `onReaction` dispatch
- ❌ does NOT work for: the CORE itself is drawn only in the Gauge Explorer's log; the planner never shows a core, its lifetime or the cap. Core damage, the bloom explosion, projectile seeking and AoE reaching several cores are explicit non-goals.
- _evidence:_ src/lib/utils/gauge.ts:222-273 (`CORE_SPAWN_DELAY = 30`, `CORE_LIFETIME = 360`, `MAX_CORES = 5`) and the non-goals list at :229-232

**P23.** Attribution of an application to a character vs their summon/mark

- ✅ works for: internally — `Offer.viaEntity` is what makes `source:'active'` correct where gcsim's ActorIndex is wrong
- ❌ does NOT work for: on screen it is erased: `collectApplications` deliberately does not publish `viaEntity`, and the log prints `${nameOf(tick.characterId)} · ${element}`, so Oz's ticks read "Fischl · Electro", indistinguishable from her own bow shot.
- _evidence:_ src/lib/sim/aura.ts:89-92 ("It is deliberately not published here: it exists for one source filter"); src/lib/timeline/auraLog.ts:110

**P24.** What each application DID to the gauge (amounts attached / consumed)

- ✅ works for: the Visualizers' Gauge Explorer, which drives `simulateGauge` directly and keeps its `SimEvent`s
- ❌ does NOT work for: the planner — the parse keeps only the resulting trajectory plus reaction events, so the aura log can say WHO and WHAT LANDED but never how much was consumed, nor whether an application attached / topped up / was too weak. The Gauge Explorer is hand-fed (max 8 applications) and knows nothing about characters or rotations.
- _evidence:_ src/lib/timeline/auraLog.ts:14-24 ("WHAT IT CANNOT SAY …"); amounts exist on `SimEvent` (gauge.ts:111, :120-122, :146-148) and are rendered only by the instrument

**P25.** Visibility of the whole aura surface

- ✅ works for: the downstream consequences (buff/debuff bars) are on by default
- ❌ does NOT work for: the aura LANE is OFF by default and the aura LOG is a separate aside panel that is mutually exclusive with the Notes panel. Everything the gauge shows a reader — plot, pips, reaction markers, log rows and the AURA_NOTES limits block — is behind an opt-in, and a reader with Notes open cannot see AURA_NOTES at all.
- _evidence:_ src/lib/stores.ts:332-335 `TIMELINE_LAYER_DEFAULTS = { showAuraLane: false, showTimelineBuffs: true }`; src/lib/plannerView.svelte.ts:56-73 (one `aside: 'notes' | 'log' | null`); src/routes/(scene)/(tools)/rotation-planner/+page.svelte:585-597

**P26.** Constellation-hosted `shield` Effects reaching the shield lane

- ✅ works for: Beidou C1 and Yanfei C4 (both `onCast ability:'burst'`, 15s, rendered as the generic "Shield")
- ❌ does NOT work for: five other non-ability shield Effects still draw nothing — Columbina C1 and Sigewinne C2 (`trigger:'manual'`), Kaeya C4 (`trigger:'passive'` + `selfHpBelow`), Traveler Hydro C4 (`onCast skill` but NO duration, channel-bound), Noelle A1 (`trigger:'passive'`). `pushShield` requires `type==='shield'` AND `onCast` AND `duration > 0`.
- _evidence:_ src/lib/sim/shields.ts:111-132 (`pushShield` gate), :139 (half A), :146-148 (half B via `getNonAbilityEffectsForCast`); asserted in src/lib/sim/shields.test.ts

**P27.** Ability-hosted shields

- ✅ works for: an `onCast` shield with an explicit `duration`
- ❌ does NOT work for: a shield on any other trigger, or with no duration. Thoma's burst Crimson Ooyoroi (`onHit`, team normals, 8s) draws NO shield bar — only his 15s field appears in the summon lane; Beidou's skill shield has no authored duration and draws nothing. Both refusals are deliberate.
- _evidence:_ src/lib/sim/shields.ts:113-115; the reasoning at :149-158 (refusing to infer an 8s shield from a 15s field)

**P28.** Sibling-ability over-pooling on the cast surface

- ✅ works for: characters with one ability per class
- ❌ does NOT work for: a character with two abilities of the same class — `collectOnCastEffects` matches on `src.abilityType === castType` and never evaluates the ability's own `conditions`, so casting EITHER draws the other's onCast buff bars. Live carriers: Skirk (two bursts), Varesa (two skills). I did NOT verify against kit text whether the drawn bar is wrong in game.
- _evidence:_ src/lib/utils/effectCollection.ts:280-300; contrast the shield path's deliberate avoidance at src/lib/sim/shields.ts:146-148 ("⛔ NOT `getCharacterEffectsForCast`: that walks EVERY ability of this cast's type")
- ⚠️ **REFUTED / CORRECTED:** Sibling over-pooling on the cast surface has FOUR live carriers, not two: Durin (skill), Lan Yan (skill), Skirk (burst) and Varesa (skill). As the original claim notes, whether the drawn bar is wrong in game was not checked against kit text.

**P29.** Stack-TIERED buffs authored as sibling effects on one stat

- ✅ works for: a single `perStack` BuffValue (resolves against the snapshot and prints the summed number)
- ❌ does NOT work for: a tier LADDER expressed as N same-stat effects with mutually exclusive `stacks` ranges — the pool dedupes by `stat` BEFORE the stack condition is evaluated, and evaluates those conditions with `undefined` stacks, so only the FIRST-authored tier survives and the bar disappears at every other stack count (Neuvillette A4's three `chargeDmgBonus` tiers). This is probe 3's measurement; the dedupe idiom is verified in source, the measurement itself I did not re-run.
- _evidence:_ src/lib/utils/buffWindows.ts:1620 `const seenStats = new Set<string>();` … :1640-1642; the same idiom at :638, :1249, :1437, :1703

**P30.** `durationExtensions[]`

- ✅ works for: `onCast` extensions to a STANCE window, and `onReaction` extensions to a stance or `cs.summonExt` — the extension grows both `end` and the E/Q pill's width
- ❌ does NOT work for: a reaction only extends the window of the character who CAUSED it, so a teammate reacting inside Collei's zone or Mizuki's field never extends it; an `onCast` extension on a summon is dropped; only `summons[0]` extensions register; any other trigger type is accepted by the schema and never dispatched.
- _evidence:_ src/lib/sim/extensions.ts:36-51 (onCast reads `ctx.getCharState(charId).stance` only), :88-151; dispatch at src/lib/sim/aura.ts:230 passing `src.characterId`. ⚠ The JSDoc at src/lib/types/ability.ts:1652-1655 is STALE — it still says dispatch is "currently wired only for `onCast`"

**P31.** scripts/caveat-lint.mjs (the fuller style gate)

- ✅ works for: the rules are implemented and the corpus is currently at 0 FAIL / 0 WARN
- ❌ does NOT work for: nothing invokes it — it is in no npm script and no CI gate; only characterLint E.26 (banned substrings + length) runs under vitest. It must be run by hand after any rewrite wave.
- _evidence:_ scripts/caveat-lint.mjs:21-99; package.json has no caveat entry (`test` is `vitest run`, `lint` is `prettier --check . && eslint .`)

---

## ❌ CANNOT — real gaps (caveats about these are keep/rewrite)

**N1.** ✅ **CLOSED 2026-09-21** — `manual` is RETIRED: 0 effects in the corpus, the member struck from the `Trigger` union, characterLint B.18 refuses it (`docs/manual-trigger-retirement-round.md`). It used to read: "nothing consumes it, and there is no toggle; 167 authored effects across 69 characters reach no planner surface at all." ⚠️ Its SIBLINGS are still open and are the live version of this finding: `onHeal`, `onEnergy`, `onHPChange`, `onHPDecrease` and `onHPIncrease` have no reader either — ⛔ never re-trigger an effect into one.

- _user sees:_ The effect simply is not there — no bar, no marker, no chip, and nothing the user can click to add it. The style guide's wave-3 lesson ("it IS on the timeline once toggled") is FALSE.
- _evidence:_ grep for `'manual'` across src/lib and src/routes (.ts/.svelte) returns exactly ONE line: src/lib/types/ability.ts:649 `| { type: 'manual' }`. No collector, no proc, no stack dispatcher, no chip (TeamBonusesBlock requires `trigger.type === 'passive'`), no notation token. Corpus census by walking abilities+passives+constellations+factionBonuses+summons+variants.

**N2.** `cooldownReduce` effect — schema + lint only, and unauthored.

- _user sees:_ Incremental / hit-driven CD reduction (Raiden C6, Beidou, Arlecchino C4, Gorou C2, Navia C1) never shortens a bar. Still the canonical implementDelete trap.
- _evidence:_ Declared src/lib/types/ability.ts:1038, :1397; the only other mention is the lint shape rule at src/lib/utils/characterLint.ts:1663-1690. Zero character JSONs author one.

**N3.** `maxProcs` / per-window proc caps.

- _user sees:_ An N-times-per-window cap is not enforced. ⚠ Do not mistake `summonTick.tickCap` (a tick-series count bound) or `DurationExtension.maxExtensions` for a proc cap.
- _evidence:_ grep for `maxProcs|maxTriggers|procLimit` over src and scripts returns zero code hits; only curator notes asking for the field (escoffier.json, cyno.json, ororon.json). The only limiter in the proc registry is the time-based `takeCooldown` (src/lib/sim/procs.ts:336).

**N4.** Multi-hit swings collapse to one hit (no `hitCount`).

- _user sees:_ Hit-counting effects undercount. Stated tool-level as AURA_NOTES line 2.
- _evidence:_ src/lib/types/ability.ts:1634 `NormalHit = { name?; frames; damageTag? }` — no multiplicity field; one `dispatchHit` per swing at src/lib/sim/run.ts:1145, and a charged attack with several `chargeHits[]` still dispatches once (:1243).

**N5.** `onShieldEnd` — dispatched but with no renderer-visible side effect; the `shieldEnd` IR event has no consumer.

- _user sees:_ A shield-expiry payoff is invisible.
- _evidence:_ src/lib/sim/shields.ts:310-312 ("v1 records the dispatch via the event stream above; no renderer-visible side effect yet"), :325-342 (the loop evaluates and does nothing). grep for `shieldEnd` over src/lib/timeline, src/lib/components and timelineExport.ts returns only a doc comment. Corpus: 2 authors, both `damage` (Noelle C4, Kachina C6).

**N6.** Unauthored + unconsumed triggers: `onEnergy`, `onHeal`, `onStack`, `onHPChange`, `onHPIncrease`. `onHPDecrease` has one author (Xingqiu's damage-taken heal) and no reader.

- _user sees:_ Energy-threshold, HP-movement and heal-triggered mechanics never fire. ⛔ Do not confuse `onStack` with `gainStacks`/`consumeStacks`, which are wired.
- _evidence:_ Declared src/lib/types/ability.ts:643-655; grep finds no evaluator for any of them. Corpus census: onEnergy 0, onHeal 0, onStack 0, onHPChange 0, onHPIncrease 0, onHPDecrease 1 (heal).

**N7.** `consumeStacks` on `onReaction` — not merely unconsumed, the lint refuses to let it be authored.

- _user sees:_ A reaction consuming a resource is unmodellable.
- _evidence:_ Only two dispatchers exist (src/lib/sim/stacks.ts:157 onCast, :516 onHit); src/lib/utils/characterLint.ts:2367-2374 `consumeStacks effect trigger.type must be "onCast" or "onHit"`.

**N8.** `sourceLifetime` stack decay — machinery complete, ZERO corpus authors.

- _user sees:_ Nothing today. Report it as "no corpus consumer", not as a capability — a per-contributor stack timer must be verified against the character's own JSON.
- _evidence:_ src/lib/sim/stacks.ts:453-467, :628; lint B.13h at characterLint.ts:2292-2322. Corpus walk over all 123 character JSONs: 0 effects declare `sourceLifetime`.

**N9.** `BuffEffect.constellationScaling` — a buff's VALUE changing at a constellation. Read only by the `gainStacks` amount override and by `tickCapScaling`, never by buff-window emission or display.

- _user sees:_ The bar DRAWS but prints the BASE value — at C6 Illuga's team bar still reads +5% CRIT Rate instead of +10%. A naive who-renders check passes; the number is wrong.
- _evidence:_ grep for `constellationScaling` in src/lib: src/lib/sim/stacks.ts:107-116, :263-272, :442-451 (gainStacks amounts), src/lib/sim/summons.ts:211 (tick caps), plus lint. It appears NOWHERE in buffWindows.ts or buffDisplay.ts. Six authored buff uses: Illuga A (×3), Linnea C1, Skirk, Varesa, Xianyun A4.

**N10.** `BuffEffect.stacks` (`maxStacks` / `durationModel: shared|separate`) — stackable buff INSTANCES.

- _user sees:_ A stackable buff draws as one undifferentiated bar; nothing shows how many instances are up, or whether refreshing one refreshes all.
- _evidence:_ Declared on BuffEffect; `durationModel` sits on the INERT allow-list with the reason "audit finding #4, decision pending" (src/lib/data/orphanedSchema.test.ts:50). Absent from buffWindows.ts and every timeline module. 3 authors: Alhaitham, Columbina, Varka.

**N11.** HP, enemy state and aura are not inputs to condition evaluation: `enemyHpBelow`, `enemyHpAbove`, `enemyAffectedBy`, `selfHpBelow`, `selfHpAbove`, `recipientHpBelow` all return null and render assumed-true.

- _user sees:_ ⚠️ THE GAUGE ROUND DID NOT MAKE `enemyAffectedBy` ANSWERABLE. The aura lane may visibly show no Cryo at the instant a Cryo-gated buff bar draws.
- _evidence:_ src/lib/sim/conditions.ts:201-210 — all six fall through one `return null;`. `ConditionContext` (conditions.ts:62-94) has exactly six fields and none of them is aura or HP; `deriveBuffWindows`' input carries no aura either.

**N12.** Reactions never emitted: Shatter, Lunar-Bloom, Lunar-Charged, Stellar Swirl.

- _user sees:_ An `onReaction` effect authored against any of these four can never fire. Shatter is also named tool-level in AURA_NOTES.
- _evidence:_ src/lib/sim/reactionBridge.ts:23-24 ("⛔ `shatter`, `lunarBloom`, `lunarCharged` and `stellarSwirl` stay unemitted"); `toReactions` (:69-111) has no branch returning any of them, though they exist as union members with display labels.

**N13.** Anemo absorption — an absorbing ability still applies only Anemo.

- _user sees:_ Kazuha / Anemo Traveler / Sucrose-family absorption caveats are still fully TRUE. This half of the old rubric's reaction line survives.
- _evidence:_ grep for `absorb` over src/lib returns no sim path; gauge.ts's anemo case consumes the aura and emits `swirl` with an `of` key but never re-applies the swirled element as an infusion of the absorbing ability's ticks. Curator caveats already state it (traveler_anemo.json:79, kaedehara_kazuha.json:133).

**N14.** Shield shatter-by-damage, absorption size, and per-element shield efficiency.

- _user sees:_ A shield bar always runs its full authored span.
- _evidence:_ src/lib/sim/shields.ts:8-10 ("the planner has no enemy or HP state, so a shield always survives to its scheduled expiry"); `dispatchShieldEnds` drains purely on `endTime <= currentTime`. No HP or absorption state exists in src/lib/sim/.

**N15.** Stance CANCEL — a token that terminates a stance rather than opening one.

- _user sees:_ Ifa's skill always draws a 10s stance and a tail ending at 17.5s however early you land; Xilonen's E re-press cannot be expressed. ⛔ Do not 'fix' Ifa by copying Xilonen's `terminatesOnSwap: true`.
- _evidence:_ `TokenKind` is a closed union at src/lib/utils/tokenizer.ts:45-56 with no terminator; a stance ends only by its authored duration (run.ts:711) or by a swap when `terminatesOnSwap`. Stated as still-open in docs/stance-cooldown-round.md.

**N16.** `cooldownStartDelay` on Hold/tap VARIANTS — four variants author it and it is silently discarded.

- _user sees:_ Every hold-E takes its tap's delay — Lisa's hold returns ~1.6s early, Eula ~0.5s, Kazuha ~0.38s. The old CANNOT line is still right and should be strengthened, not deleted.
- _evidence:_ `AbilityVariant` declares no `cooldownStartDelay`; the parser reads the resolved BASE ability at src/lib/sim/run.ts:594 `castStart + (active.cooldownStartDelay ?? 0) + cd`. Authors: Eula Hold, Kazuha Hold, Lisa Press/Holding.

**N17.** Authored `Ability.caveat` reaches exactly ONE surface and it is not the Team Builder, the PNG export, or any lane/tooltip.

- _user sees:_ A TB-only wrong claim has no caveat channel; a shared PNG carries no caveats. Effect-level caveats on artifact sets (silken_moons_serenade.json:29, :50) are untyped extra properties with no reader anywhere.
- _evidence:_ Exhaustive grep for `.caveat` in src (non-test) returns four hits: characterLint.ts:638 (the linter), RotationNotes.svelte:47 (the only render), slotCaveats.ts:59 and :62 (the producer). `RotationNotes` is imported only by the planner page.

**N18.** There is no per-VARIANT caveat channel — `AbilityVariant` has no `caveat` field and `slotCaveats` never descends into variants.

- _user sees:_ A hold-only or aimed-shot-only divergence can only be caveated on the parent ability, where it shows for every cast of that ability.
- _evidence:_ The only `caveat?:` declaration in the type surface is on `AbilityCommon` (src/lib/types/ability.ts:1686); src/lib/timeline/slotCaveats.ts:58-67 iterates ability-shaped hosts only; scripts/caveat-lint.mjs:89-98 likewise.

---

## ⛔ FROZEN / OUT OF SCOPE — never an implementCandidate

- Damage numbers and damage math of any kind — the tool constitution (visualize mechanics, never calculate verdicts). No damage arithmetic exists in src/lib/sim/\*\*; `spent`/`consumed` on gauge events are GAUGE units, not damage. The only reaction-damage arithmetic in the repo is the standalone Visualizers instrument (visualizers/lib/reactionCurves.ts:1-10, "the base scaling shape only", pre-resistance), which is slider-driven and connected to no character or rotation.
- `elevate` rendering / reaction-DMG derivation; multi-reaction and non-lunar elevate; the reaction-multiplier-vs-DMG-bonus distinction (FROZEN, Nate 2026-07-14). Still frozen.
- ⚠️ `stellarConduct` is NO LONGER FROZEN — the frozen list names it but the faction-buffs round shipped it 2026-07-29. See deltas. Reaction DAMAGE derivation for it stays frozen.
- Shield shatter-by-damage — scheduled expiry is by design (src/lib/sim/shields.ts:8-10), not a backlog item.
- Single stationary enemy that never applies an element back; no AoE spread, no per-target ICD, no multi-target aura. The gauge carries ONE `ModState` (gauge.ts:277-315) and this is stated tool-level as AURA_NOTES line 1.
- Core damage, the bloom explosion, hyperbloom projectile seeking, and AoE reaching several cores at once — explicit non-goals at src/lib/utils/gauge.ts:229-232.
- Nicole C2's shield is deliberately UNMODELLED as co-op-only (⚓ Nate) — Kirara C2 is the house form. Needs no caveat.
- Pickup-driven empowerment (Neuvillette droplets, orb/particle collection), Bond of Life, field redirect (Dehya/Xianyun), hitlag/attack-speed, multi-element absorption — unchanged from the July out-of-scope list; nothing in the gauge round touched them.
- Feeding a real rotation into the Gauge Explorer is closed by measurement (`MAX_GAUGE_APPS` is 8; a heavy rotation makes ~230). The Explorer is hand-fed and knows nothing about characters.
