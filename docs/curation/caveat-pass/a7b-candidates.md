# A7b Candidates — zero-caveat characters with divergence hints in curator notes (36 chars, 85 abilities)

Generated 2026-07-20 by the A7 Wave 9 sweep. These characters shipped NO user-facing
caveats, but their `_curatorNotes` contain divergence-keyword matches — each is a
CANDIDATE for a missing caveat, not a confirmed one. A7b is a separate future audit:
authoring caveats from curator notes carries invention risk, so each candidate needs
the full compression-only + verification treatment against kit text before any
caveat is written.

## amber

- `amber__skill__explosive_puppet`
  - Hold E variant: all frames += hold parameter (variable), Baron Bunny spawnsAt = 45+hold, cooldownStartDelay = 5+hold. Variable offset not modeled in variants[]. Reviewer to decide if a variant entry is warranted.
- `amber__passive__every_arrow_finds_its_target`
  - AoE widening (30% on Fiery Rain AoE) not modeled — no schema field for AoE radius modifiers.

## arataki_itto

- `arataki_itto__burst__royal_descent_behold_itto_the_evil`
  - C2: each Geo team member reduces Q CD by 1.5s (cap 4.5s) and restores 6 energy (cap 18) on Q cast — not authored; cooldownReduction/energyRestore based on team composition is not modelable in current schema.
- `arataki_itto__passive__arataki_ichiban`
  - No effects authored. ATK SPD ramp on Kesagiri (CA1/CA2) only, +10% per stack max 30%, only applies during ChargeAttackState (gcsim asc.go a1Update). Resets on Saichi or non-CA action. Schema has no consecutive-slash counter; reviewer to decide whether to model. Interrupt resistance is not modeled.
- `arataki_itto__constellation__arataki_itto_present`
  - No effects authored. Two parts: (a) +70% CRIT DMG on all Charged Attacks (gcsim cons.go c6: AttackMod gated on AttackTagExtra, permanent at C6) — schema can express as a self buff with stat=critDmg on chargeAttack hits, but generator did not author it; reviewer to wire. (b) 50% chance to not consume SSS stacks on Kesagiri — SSS economy not modelable, flag only.

## charlotte

- `charlotte__normal__coolcolor_capture`
  - Arkhe: Pneuma — Spiritbreath Thorn fires 30f after Charged Attack lands (QueueCharTask +30), 6s ICD (arkheIcdKeys), AttackTagExtra, ICDTagNone, Cryo, 0 durability. Not modeled in effects — reviewer to decide representation.
- `charlotte__skill__framing_freezing_point_composition`
  - Snappy Silhouette and Focused Impression marks are enemy-targeted periodic DMG sources (AttackTagElementalArt, ICDTagCharlotteMark / ICDGroupCharlotteMark), ticking every 90f (1.5s). Not spawned entities — not modeled as summons[]. Reviewer to decide representation. Press mark: 360+48=408f (~6.8s); Hold mark: 720+54=774f (~12.9s).

## collei

- `collei__passive__the_languid_wood`
  - Authored 2026-05-10 (E3 v1.5) as durationExtensions[] on the burst summon (Cuilein-Anbar) — see the burst's summon entry for the full extension shape and cast-only emission caveat.

## diluc

- `diluc__skill__searing_onslaught_e1`
  - Particle generation: 1 Pyro particle per cast (33% chance of 2), gated by a 0.3s particle ICD across the chain (gcsim particleICDKey). Not modeled as an effect; reviewer to wire energy generation if needed.
- `diluc__passive__relentless`
  - No effects authored. Pattern 5 (stamina-cost / damage modifier with no animation change). Stamina is not modeled in the planner, and the +3s CA duration is also stamina-related. Both parts are practically inert in the planner. Reviewer to confirm no schema action is needed.
- `diluc__constellation__conviction`
  - C1: +15% DMG vs enemies with HP > 50%. Authored 2026-05-11 via the new `enemyHpAbove` Condition variant (mirror of `enemyHpBelow`, shipped E2-partial). Resolves to null at planner-time so the buff renders optimistically with the standard 'assumed to hold' caveat (same treatment as Razor C2 / Yanfei C1 / Eula C4 enemy-HP gates). The 'specific enemy class' gating in the original gcsim code is approximated as an unscoped DMG bonus — over-renders against ALL Diluc damage but matches the schema's existing per-effect granularity (no per-enemy-target routing in the model).
- `diluc__constellation__searing_ember`
  - No effect authored. Pattern: stack-on-hit buff (max 3 stacks) granting +10% ATK + 5% ATK SPD per stack, 10s duration, 1.5s ICD between stack additions. Likely trigger: `onPlayerHit` (gcsim subscribes to event.OnPlayerHit) with `target: self`, `duration: 10`, `value: 10` (atk%) per stack and `value: 5` (atkspd%) per stack, `procCooldown: 1.5`, max 3 stacks. Schema has no stack-count concept on effects; reviewer to decide whether to extend or to model as a single 30%/15% buff with caveats.

## dori

- `dori__skill__spiritwarding_lamp_troubleshooter_cannon`
  - C6: Dori gains Electro Infusion for 3s (228 frames) after using this skill at C6 (wired in skill.go via AddWeaponInfuse). Not modeled as an effect skeleton — reviewer to author.
- `dori__burst__alcazarzarays_exactitude`
  - Heal/energy target 'active': gcsim heals c.Core.Player.Active() and adds energy to ActiveChar each tick — the Jinni re-connects to whoever is on field, so post-cast swaps redirect the heal/energy to the new active character (wiki-confirmed 'connects to a nearby character'). Ticks are suppressed if the active char leaves the burst area; not modelled.
  - Connected-character electro self-infusion: gcsim source has TODO comment ('TODO: find actual duration') on ApplySelfInfusion call — actual duration uncertain. Not modeled.
- `dori__constellation__sprinkling_weight`
  - Electro Infusion (3s after E at C6) is not modeled here — see skill \_curatorNotes.

## eula

- `eula__constellation__the_obstinacy_of_ones_inferiors`
  - Migrated 2026-05-10 (E2 + schema-mismatch): rewrote stat hp% → burstDmgBonus, value 50 → 25, added trigger: passive + condition `enemyHpBelow: { threshold: 50 }` (new primitive). Schema cannot scope to Lightfall-only — gcsim applies DmgP=0.25 only to 'Glacial Illumination (Initial)' abil, but the buff here over-renders against ALL Eula burst DMG. Acceptable approximation since enemyHpBelow already renders optimistically. Tighter scoping would need a sub-burst stat key or per-buff abilityName filter.

## faruzan

- `faruzan__skill__wind_realm_of_nasamjnin`
  - Manifest Gale state: AddStatus(skillKey, 1080f=18s). Not modeled as a summon — it is a character status that enables Hurricane Arrow (next fully-charged shot becomes Hurricane Arrow dealing Pressurized Collapse). At C1, up to 2 Hurricane Arrows can be fired per cast. Reviewer to decide representation (state window / buff duration field).
- `faruzan__burst__the_winds_secret_ways`
  - Effects authored 2026-07-12: Perfidious Wind's Bale (Anemo RES -30%, fixed across talent levels per burst table) and Prayerful Wind's Benefit (Anemo DMG Bonus 32.4% at talent lvl 10, burst table row 'Anemo DMG Bonus'; applies to all party members incl. off-field per KQM TCL). Both are re-applied by each Whirlwind Pulse (~every 2s, 4s per application) for the polyhedron's 12s lifetime — authored as a single 12s onCast window matching the C6 effect's precedent. Approximation: the final pulse's ~4s tail past polyhedron expiry is not modeled; C2's +6s polyhedron extension extends effective buff/shred coverage to ~18s but Effect.duration has no modifier field — not modeled.
- `faruzan__passive__impetuous_flow`
  - A1's Perfidious Wind's Bale application via the Pressurized Collapse vortex (Hurricane Arrow CA chain, no burst required) is team-facing but not modeled — the Hurricane Arrow → vortex chain isn't authored (E effects[] empty; CA flow is personal-damage territory). The burst-sourced shred is authored on the burst.
- `faruzan__passive__lost_wisdom_of_the_seven_caverns`
  - Semantics caveat: in-game this is a FlatDmg addition to the triggering hit, not a separate damage instance; a 'damage' effect is the closest schema shape (no element-filtered all-class flat-DMG buff stat exists).
- `faruzan__constellation__the_wondrous_path_of_truth`
  - C6 also triggers a Pressurized Collapse every 3s (ICD=180 frames) when the active character deals DMG while under Prayerful Wind's Benefit. This proc mechanic is not modeled in effects[]; needs the active-char-hit trigger primitive.

## freminet

- `freminet__normal__flowing_eddies`
  - No chargeFrames defined in gcsim — no Charge() function in attack.go and no chargeFrames slice. Freminet's charged attack is a stamina-drain claymore spin; gcsim does not model it with custom cancel frames. Data not available.
- `freminet__burst__shadowhunters_ambush`
  - Q also resets Elemental Skill CD on cast (ResetActionCooldown in burst.go) — not modeled as an effect.

## gorou

- `gorou__skill__inuzaka_allround_defense`
  - Buffs apply to the ACTIVE character within the banner AoE (kit text; target: 'active'). The in-game 2s buff linger after the active character leaves the field is not modeled — buff windows run the banner's 10s lifetime.
- `gorou__burst__juuga_forward_unto_victory`
  - General's Glory recreates the same three banner buffs as E (identical tier gating; talent level 10 values shared — the DEF Increase / Geo DMG Bonus rows live on the SKILL talent table and are not boosted by C5), authored for the field's 9s duration. Same caveats as E: target 'active', 2s off-field linger not modeled.
  - C2 extends General's Glory duration by 1s per Crystallize shard pickup (once per 0.1s, max +3s per cast). This is event-driven (subscribes to OnShielded + Crystallize shield type check), not a flat constellation durationModifier — not modeled here. Reviewer to decide representation.
- `gorou__constellation__valiant_hound_mountainous_fealty`
  - In-game 'cannot stack; takes reference from the last instance triggered' — overlapping E and Q windows render as separate 12s bars; last-cast-wins replacement is not modeled. Element-specific crit stat authored snapshottable: false per Escoffier C1 cryoCritDmg precedent.

## jean

- `jean__burst__dandelion_breeze`
  - Field also continuously imbues the active character with Anemo (self-swirl mechanic in gcsim — see burst.go ReactWithSelf, ticks alongside each heal tick); not modeled — no infusion-of-recipient primitive for summon fields.
- `jean__passive__wind_companion`
  - Migrated to onHit ability:normal 2026-05-09 (F1). The 50% proc chance is not modeled in the current effect schema — the heal renders on every Jean N hit, doubling its actual frequency. Acceptable approximation.
- `jean__constellation__spiraling_tempest`
  - Effect not yet authored — C1 grants +40% DMG to Gale Blade when held for ≥1s (≥60 frames). Conditional on hold duration; not modeled in gcsim skill frame data. Reviewer to author.
- `jean__constellation__peoples_aegis`
  - Intentionally not authored per stub-with-caveat philosophy 2026-05-14 (onParticleReceived category — particle/orb pickup is out-of-scope per the tool constitution; auto-fulfills in canonical rotations). C2 grants all party members +15% Movement SPD and +15% ATK SPD for 15s when Jean picks up an Elemental Orb/Particle (Jean must be active on-field). gcsim trigger: onParticleReceived. Re-evaluate only if particle-gen modelling ever enters scope (unlikely).

## kaeya

- `kaeya__constellation__excellent_blood`
  - Migrated 2026-05-10 (E2 follow-up): trigger manual → passive with `enemyAffectedBy: { element: 'cryo' }` condition (new primitive). Schema cannot scope CR to N/CA-only (no chargeCritRate / normalCritRate stat); buff over-renders against ALL Kaeya attacks. Acceptable since enemyAffectedBy itself renders optimistically. Frozen-tagged enemies carry Cryo aura in-game so the cryo condition covers both 'Cryo aura' and 'Frozen' description branches.
- `kaeya__constellation__frozen_kiss`
  - 2026-05-09 model-mismatch cleanup: rewrote the effect from `damage hp 30 target:enemy` to `shield self hp 30 duration:20`. The 250% Cryo absorption efficiency is not modelled (no per-element shield-efficiency primitive).
  - 2026-05-11: `selfHpBelow: 20` condition added (E2 follow-up). Trigger now `passive` — renders optimistically as an always-active conditional shield with the HP gate caveat. The 60s ICD is not enforced; the planner doesn't model shield procCooldown for self-shield grants.
- `kaeya__constellation__glacial_whirlwind`
  - Energy regeneration (15 Energy on burst cast) not yet authored in effects array — reviewer pass. Additional icicle (+1, total 4 at C6) also not modeled in summons.

## kamisato_ayato

- `kamisato_ayato__constellation__kyouka_fuushi`
  - 2026-05-11 (E2 follow-up): migrated to `normalDmgBonus 40` + `enemyHpBelow: 50`, trigger `passive`. Schema simplification — the Stat union's `normalDmgBonus` is unscoped, so this over-renders against Marobashi (Ayato's out-of-stance Normal) too. The actual gcsim AttackTag check covers all of Ayato's Normal hits, so the over-render is bounded to ~all of Ayato's N taps; the cleaner fix would be per-abilityName-filtered buff routing.

## kaveh

- `kaveh__normal__schematic_setup`
  - plungeFrames: LowPlungeAttack and HighPlungeAttack in gcsim only accept AirborneXianyun state — standard plunge not modeled. Reviewer to verify in-game plunge availability independently of Xianyun.

## keqing

- `keqing__normal__yunlai_swordsmanship`
  - Thunderclap Slash: CA while Lightning Stiletto is active fires 2 additional Electro hits at the stiletto location (skillCA scaling, 2× hits, per charge.go). Not modeled in chargeFrames — reviewer to decide if a conditional chargeFrames variant or a skill effect is more appropriate.
- `keqing__skill__stellar_restoration`
  - Charged-Attack consumption of the Stiletto (the alternate to the E recast) is a normal-side mechanic, not modeled here.
- `keqing__constellation__keen_extraction`
  - Partial fit for `enemyAffectedBy` primitive (E2 follow-up, 2026-05-10). Effect would be `onHit` (N/CA only) + `enemyAffectedBy: electro` + 5s procCooldown + energy effect. Defer authoring: the 50%-chance gate is not expressible in the schema (no probabilistic-trigger primitive), and authoring without it would make the buff over-render at 100% rate vs the in-game 50%. gcsim c2ICDKey + makeC2CB() in cons.go for full mechanic.

## kirara

- `kirara__skill__meowteor_kick`
  - Shield absorbs Dendro DMG with 250% effectiveness — not modeled (schema has no element-specific shield-effectiveness field).
- `kirara__burst__secret_art_surprise_dispatch`
  - C1 adds up to 4 extra cardamoms (1 per 8000 Max HP) — a scaling buff on the summon's projectile count, not a damage scaling on existing hits. Flagged on the C1 constellation entry; not modeled on the burst summon.

## klee

- `klee__skill__jumpy_dumpty`
  - Jumpy Dumpty mines: the 3rd bounce (absolute frame ~140 from cast start) splits into mines deployed on the ground as persistent deployable entities. gcsim models them as scheduled explosion events (default mine_delay=240 frames from cast start = 4s total) rather than persistent lifetime tracking. Actual mine duration from game data and exact spawnsAt need KQM verification. Not modeled in summons[].

## lauma

- `lauma__normal__peregrination_of_linnunrata`
  - Spirit Envoy Metamorphosis (deer state) is not modeled in schema. gcsim has separate deerFrames for state entry: swap=49, N=61, C=63, E=63, Q=63, J=49 (D disabled — dash.go returns error in deer state). Base duration=10s (C1 extends by 5s), 4s CD after exit (A4 reduces by up to 20% via EM scaling, max at 1000 EM). chargeFrames here records Spiritcall Prayer only — the damaging CA form active while Spirit Envoy CD is active. Reviewer to decide schema representation for deerFrames and the two-state cooldown mechanic.
- `lauma__constellation__o_lips_weave_me_songs_and_psalms`
  - The 20s c1Key gate (status applied on E or Q cast) isn't expressed as a condition — the heal will fire on any Lunar-Bloom in the rotation. In canonical Lauma rotations the gate is auto-fulfilled by the opening E/Q. C1 also reduces Spirit Envoy Stamina cost by 40% and extends duration by 5s — not modeled.

## lisa

- `lisa__burst__lightning_rose`
  - C4: each Lightning Rose tick fires 1–3 discharges instead of 1, count is probabilistic based on enemy count and prior discharge count (Markov chain). Effect not modeled — needs reviewer pass.

## lyney

- `lyney__skill__bewildering_lights`
  - If a Grin-Malkin Hat is on field when E is cast, the Hat explodes (skillExplode) dealing AoE Charged Attack DMG equal to a Pyrotechnic Strike. Not modeled in effects.
- `lyney__burst__wondrous_trick_miracle_parade`
  - Cat ticks deal Pyro DMG to each enemy at most once per cast (burstMarkKey status). Not modeled in effects skeleton.

## mona

- `mona__skill__mirror_reflection_of_doom`
  - A1 auto-Phantom during dash (50% explosion DMG, 2s duration after 2s of dash) not modeled — requires complex dash-duration trigger not covered in this pass.
- `mona__burst__stellaris_phantasm`
  - Omen window (5s, starts when Bubble pops/ends) is NOT modeled. Requires Summon.terminatesOn:{type:'trigger',...} for hit-with-impulse pop, plus a sequential-spawn semantic (Omen begins where Bubble ends). Both are deferred schema work.
  - Bubble does not pop on NoImpulse hits or from freeze-breaking logic (complex conditional in triggerBubbleBurst); caveat for reviewer.
- `mona__passive__come_n_get_me_hag`
  - A1: After 2s in Illusory Torrent, auto-creates a Phantom (2s duration, 50% explosion DMG of Mirror Reflection). Checks every 2s via recursive task queue in dash.go. Not modeled — requires complex dash-duration trigger. Effect not yet authored — needs reviewer pass.
- `mona__constellation__lunar_chain`
  - Effect not yet authored — needs reviewer pass. C2 auto-follows 20% of Normal Attack hits with a free Charged Attack (5s ICD, 0.7s delay after N hit). Proc mechanic not modeled in this schema.
- `mona__constellation__rhetorics_of_calamitas`
  - 2026-05-09 model-mismatch cleanup: fixed effect 1 stat 'atk%' → 'allDmgBonus' (gcsim uses DmgP, not ATK%) and deleted effect 2 (allDmgBonus 180, the 3-stack cap misrepresented as a separate flat buff). Per-stack value 60 is preserved on the remaining effect; stacks (max 3 = 180% cap, reset on CA use or after 8s) are not yet modelled — reviewer to wire as stacking/ramping CA DMG bonus, triggered by Illusory Torrent (dash) entry. Trigger remains manual.

## mualani

- `mualani__normal__sharkys_bite`
  - Each press fires one bite (gcsim resets NormalCounter to 0); not a multi-hit string. Sharky's Bite has its own 1.8s cooldown (gcsim SetCDWithDelay on ActionAttack); not modelled at the normal-ability level.
- `mualani__constellation__the_leisurely_meztli`
  - The out-of-combat Nightsoul-consumption reduction is a resource-pool effect not modelled in schema.
- `mualani__constellation__sharky_eats_puffies`
  - Energy regen on Puffer pickup intentionally not authored per stub-with-caveat philosophy 2026-05-14 (onPickup category — non-deterministic in planner). gcsim source: c4puffer() AddEnergy 8 per Puffer. Re-evaluate only if a pickup-event primitive ever lands (out-of-scope per current curation philosophy; particle/orb pickup auto-fulfills in canonical rotations).

## navia

- `navia__normal__blunt_refusal`
  - No charge.go in gcsim character dir — chargeFrames not available. Navia has a spinning stamina-drain charged attack (claymore type) that is not modeled in gcsim.

## nicole

- `nicole__constellation__whether_left_or_right_no_matter_which_way_you_turn`
  - Not modeled: the flat-DMG add applies across all five attack classes from a single shared 8-instance consumable pool — no single stat expresses this, and the per-hit consumption/16s-per-char gating is beyond the buff model. Flag-and-ask on whether to approximate with per-class \*FlatDmg buffs.

## qiqi

- `qiqi__constellation__rite_of_resurrection`
  - Migrated to onCast burst 2026-05-09 (F1). 50% MaxHP team heal authored. The revival mechanic (dead → alive) is outside the current schema; the 15min ICD is not modeled (gcsim doesn't enforce it either). Heal portion only.

## razor

- `razor__burst__lightning_fang`
  - Wolf Within is a 15-second self-status on Razor (gcsim: AddStatus(burstBuffKey, 15\*60) applied at burstHitmark=32), terminated when Razor swaps off-field (event.OnCharacterSwap). Not a spawned entity — not modeled as summons[]. `duration` field removed from ability per recipe. Reviewer to decide representation for the 15s status window.
- `razor__constellation__suppression`
  - Migrated 2026-05-10 (E2): trigger manual → passive with condition `enemyHpBelow: { threshold: 30 }` (new primitive). The planner cannot simulate enemy HP, so the condition resolves null at evaluation time; the buff renders optimistically (assumed-to-hold). Generator had value: 30 (incorrect — description and gcsim both confirm +10%); corrected to 10.

## sandrone

- `sandrone__passive__eternal_speculation_engine`
  - A1 (self-damage amplification, not modeled). Two intertwined mechanics both ride on untracked state: (a) the enhanced second Prism Shot (400% of its DMG) is gated on Fagio's Decoding Power > 50 and being in the Radiance: Stellar-Conduct state — Decoding Power is a continuous resource the planner does not simulate; (b) Refined Tactics stacks accrue per 10 Decoding Power lost (max 10, 60s) and, on a Radiance-state burst, boost the Convective Inhibition Ray to 100% + stacks×10% of its DMG. No primitive tracks Decoding-Power loss, and the amp lands on Sandrone's own on-field burst hit (FrameMap territory, and Sandrone is frameless). Left unauthored.
- `sandrone__constellation__morrow_after_the_golden_dusk`
  - C1 team buff NOT modeled: '+30% Stellar-Conduct DMG to all party members' has no schema stat — Stellar-Conduct is a new reaction (not in the Reaction union) and there is no `stellarConductDmgBonus` DMG-bonus stat. Real, decision-relevant team buff; flagged as unmodelable pending schema support for the Stellar-Conduct reaction/DMG-bonus family. The Decoding-Power-rate half is a self mechanic, also untracked.
- `sandrone__constellation__an_heiress_gazed_into_the_lookingglass`
  - C2 NOT modeled (self-only): +40% CRIT DMG on Charged Attack condensed beams, plus +20% per beam fired this Decoding period (max 3 stacks). Scopes to condensed-beam charged-attack hits only and is gated on the Radiance: Stellar-Conduct state; there is no beam-specific critDmg stat, and the beams are Sandrone's own on-field damage (FrameMap territory, frameless). Left unauthored.
- `sandrone__constellation__in_knowledge_lies_the_worlds_true_ground`
  - C4 extra cannon DMG NOT modeled: 125% ATK Cryo (Stellar-Conduct), 4s ICD. The trigger is 'Sandrone deals Stellar-Conduct DMG' — Stellar-Conduct is a new reaction absent from the schema's Reaction union, so no onHit/onReaction filter can express it. Despite the in-game phrase 'coordinated attack', it is self-triggered on Sandrone's own damage (not an off-field team-attack-triggered strike), so the `coordinatedAttack` tag does not apply per its definition. Scaling (125% ATK Cryo) and ICD (4s) recorded here for a future pass once the reaction primitive exists.
- `sandrone__constellation__narcissus_wakes_her_eyes_upon_the_dawn`
  - C6 NOT modeled: (a) the Condensed Cluster Beam adds up to 4 extra AoE instances at 100% ATK Cryo (80% ATK as Stellar-Conduct in Radiance) on Sandrone's own third+ Decoding beams — self on-field damage, FrameMap territory, frameless; (b) 'all Stellar-Conduct DMG dealt by Sandrone is elevated by 20%' cannot use the `elevate` Effect type, whose `reactions` filter is keyed to the schema's Reaction union, which has no Stellar-Conduct member. Both recorded for a future pass once the reaction primitive exists.

## shenhe

- `shenhe__skill__spring_spirit_summoning`
  - Icy Quill mechanic: Shenhe's E applies Icy Quill to all party members (Press: 5 stacks/10s; Hold: 7 stacks/15s). On each Cryo DMG hit from a party member, 1 stack is consumed and flat DMG equal to (skillpp multiplier × Shenhe's current ATK) is added — this is an ATK-scaling buff. Not modelable as a static value; reviewer to author scaling-buff representation. C6 exempts Normal and Charged Attack Cryo hits from consuming stacks.
- `shenhe__constellation__insight`
  - C4 Skyfrost Mantra: when party members consume an Icy Quill stack (i.e. trigger the DMG Bonus), Shenhe gains a stack (max 50, lasts 60s; gcsim: c4count++, AddStatus(c4BuffKey, 3600)). On Shenhe's next E cast, all stacks are consumed and each adds 5% DMG Bonus to that cast (gcsim: c4() returns 0.05\*c4count, injected into the E hit snapshot). This is a dynamic self-buff that accrues between casts — not modelable as a static buff entry. Not authored; reviewer to decide representation.

## tighnari

- `tighnari__skill__vijnanaphala_mine`
  - Vijnana Suffusion self-buff (reduces Wreath Arrow charge time by 2.4s; lasts 12s or until 3 Wreath Arrows are fired) is a duration-bounded self-status with no spawned entity — not modeled as a summon. gcsim: AddStatus(vijnanasuffusionStatus, 12\*60, false) + SetTag(wreatharrows, 3) at delay=13. Reviewer to decide effect-row representation.
- `tighnari__constellation__karma_adjudged_from_the_leaden_fruit`
  - C6 also reduces Wreath Arrow charge time by 0.9s (54 frames). In gcsim: skip += 54 (on top of Vijnana Suffusion's 142f skip), capped at aimedWreathHitmark=175f. This mechanic is not modeled in the current JSON — reviewer to decide representation.

## traveler_geo

- `traveler_geo__burst__wake_of_earth`
  - C4 Shoreline: -5 Energy per enemy hit (max 25 from one cast). Authored conceptually but per-hit-energy-callback not modeled.
- `traveler_geo__passive__resonant_waves`
  - A4: Wake of Earth shockwaves count as elemental crystals to form Crystallize shields if there are no Geo constructs nearby. Not modeled (Crystallize shielding mechanic is out of planner scope).

## wriothesley

- `wriothesley__normal__forceful_fists_of_frost`
  - Catalyst CA is gated by gcsim's NextQueueItemIsValid: charge cannot be queued unless prior action is ActionAttack — this is a per-character constraint not modeled in the planner.
  - Combo-counter persistence: gcsim preserves NormalCounter across DashState and SkillState (savedNormalCounter mechanic), enabling N continues after dash/E. Description-level mechanic; planner may not model this.
- `wriothesley__normal__forceful_fists_of_frost_chilling_penalty`
  - HP-cost mechanic: each in-stance N hit triggers chillingPenalty callback that drains 4.5% of MaxHP with a 6f ICD (gcsim skillLoseHPICD). Not authored as an effect; HP economy is not modeled in the planner.
- `wriothesley__passive__there_shall_be_a_plea_for_justice`
  - Stamina-cost waiver on Rebuke (gcsim ActionStam returns 0 when graciousRebukeReady) — stamina is not modeled in the planner. No effect to author.
- `wriothesley__passive__there_shall_be_a_reckoning_for_sin`
  - Intentionally not authored per stub-with-caveat philosophy 2026-05-14 (onPlayerHit + onHeal categories — both HP-change subscriptions are null-resolving in the planner; HP state isn't simulated). Probable shape if a primitive ever lands: type:'buff', target:'self', stat:'atk%', value: scaling on stack count (6% × stacks, max 5 stacks = 30%), trigger gated on stance + HP-change subscription. gcsim source: subscribes to OnPlayerHPDrain and OnHeal; stacks reset when stance ends (resetA4 called on each Skill cast).
- `wriothesley__constellation__terror_for_the_evildoers`
  - C1 also adds a second Gracious Rebuke trigger: N5 hit during stance also generates one. Stack-source diversification not modeled.

## xiangling

- `xiangling__normal__doughfu`
  - N3 has two hitmarks [11, 18] and N4 has four hitmarks [5, 15, 24, 29]; cancel frames sourced from last hitmark per recipe. N5 gcsim sets C=500 with comment 'this action is illegal' — omitted. High plunge exists in gcsim (swap=63, N=58, E=60, Q=60; no D/J set) but not represented (recipe uses lowPlungeFrames only). gcsim restricts LowPlungeAttack to AirborneXianyun context — plunge returns error unless launched by Xianyun E; reviewer may want to add a plunge caveat.

## yanfei

- `yanfei__normal__seal_of_approval`
  - A1 Proviso reduces CA stamina cost by 15% per seal (25% at C1+) via gcsim's ActionStam override. Stamina cost is not modeled in the planner (Pattern 5).
  - C1 (The Law Knows No Kindness) doubles the per-seal stamina reduction to 25% and adds interruption resist during CA release. Stamina is not modeled; interruption-resist is not in the schema. Flagged on the C1 entry.
- `yanfei__passive__proviso`
  - [A7] Caveat removed in the A7 pass: Proviso is fully rendered (perStack buff anchored at each CA hit with the pre-consume seal snapshot, showing the real per-seal value) and seals auto-track, so the note described only working behavior plus kit scaling with no timeline divergence left to repair. The `{seal:N}` manual override still exists but is a working feature, not a limitation.
- `yanfei__constellation__right_of_final_interpretation`
  - Migrated 2026-05-10 (E2): trigger manual → passive with `enemyHpBelow: { threshold: 50 }` condition. Schema cannot scope CR to charged-attack-only (no chargeCritRate stat); the buff over-renders against ALL Yanfei attacks (in-game it gates on AttackTagExtra in gcsim). Acceptable approximation — the condition itself isn't simulable so the entry already renders optimistically. Tighter scoping would need a per-attack-class CR stat key.

## yoimiya

- `yoimiya__constellation__agate_ryuukin`
  - Intentionally not authored per stub-with-caveat philosophy 2026-05-14 (onTargetDied category — enemy death state is null-resolving in the planner). Two parts: (a) Aurous Blaze duration 10s → 14s at Cons:1 (gcsim duration = 840 if Cons >= 1) — depends on Aurous Blaze representation, also not authored. (b) On enemy death while debuffed, +20% ATK for 20s self-buff (gcsim 'yoimiya-c1' modifier, 1200 frames). Re-evaluate if a death-tracking primitive ever lands.
- `yoimiya__constellation__a_procession_of_bonfires`
  - 2026-05-09 F2A migration: trigger:manual → onHit with filter.element:pyro + filter.isCrit:true. gcsim makeC2CB filters on a.IsCrit && Element == Pyro on every Yoimiya hit. Renders on Yoimiya's pyro-infused N hits (burst-active; the parser tags those as elemental-normal), CA hits (always pyro on bow), and skill/burst hits. The renderer's optimistic-fire isCrit semantics treat every hit as a potential crit (filter v1 caveat); the filter primarily serves as a schema-fidelity declaration.
- `yoimiya__constellation__naganohara_meteor_swarm`
  - Probabilistic extra-hit mechanic: 50% chance per in-stance N for an extra arrow at 60% of total mult. Not modeled — schema has no probabilistic damage-add concept and proc reliability is non-trivial in practice. Reviewer-owned.

## yun_jin

- `yun_jin__skill__opening_flourish`
  - 2026-07-12 (A3 pass): shield effect authored — 21.6% Max HP at talent level 10 (sidecar 'Shield DMG Absorption' row, 10th column: '21.6% Max HP+2542'). The +2542 flat portion is dropped — schema gap, shield effect has no `flat` field (same gap as heal flat, see escoffier burst note). target 'self': the parry shield covers only Yun Jin while she charges. Effect duration omitted — shield lifetime is carried by the per-variant summons entries (Tap 0.2s / Hold Lv.1 0.8s / Hold Lv.2 1.6s); a single duration on the base effect would misstate the Hold variants. 150% DMG absorption effectiveness vs all Elemental and Physical DMG not modeled.
- `yun_jin__burst__cliffbreakers_banner`
  - The 30-trigger quota per party member (sidecar 'Trigger Quota' row) is not modeled — planner has no per-hit stack-consumption primitive; the buff renders for the full 12s duration. In practice most rotations exhaust neither the 30 stacks nor the 12s, so duration-only is the right approximation.

## zhongli

- `zhongli__skill__dominus_lapidis`
  - Multi-stele spawning (C2 max 2 steles, Hold-E spawning a stele alongside Jade Shield) is not modelled — the renderer's findCastSummon picks summons[0] only. The first-cast rendering is correct; subsequent casts on the same input refresh the same sub-row.
