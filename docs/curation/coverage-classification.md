# Coverage classification — review table

_Generated 2026-09-23 for the coverage round (`docs/coverage-round.md` §6). Four agents read each
effect-less host's description, `_curatorNotes` and `caveat` and proposed one classification. ⏭ **Nate
reviews; nothing here is written to the data until then.** Accepted rows are written surgically
(`scripts/lib/json-edit.mjs`)._

**471 hosts** still read _missing_ (28 more were proposed but have since been lit by a derivation fix —
a stance or window a cast opens now counts as its grant). Proposals: **nothingToModel 71** ·
**notModeled 121** · **missing 279** — 39 low-confidence.

## ⏭ Rule these classes first — each one settles many rows

The agents flagged the same judgment calls independently. One ruling per class settles most of the table.

1. **A damage bonus on ONE named attack** (Citlali A4, Fischl C2, Albedo A1, Eula C6, Sethos A4/C1,
   Sandrone A1/C2/C4, Raiden's Resolve hosts, Heizou A1, Navia C6, Neuvillette C2, Yae A4, Anemo
   Traveler C1, Dendro/Hydro Traveler A4, Mizuki C6, Mualani A4, Shenhe C4). Proposed **notModeled**
   ("the planner doesn't show damage amounts"). Alternative: **missing**, authored as a `*DmgBonus`
   buff where a CLASS stat fits (Varka's A1 multiplier precedent) — and a ruling only where no class
   stat exists. The same question covers **ability-scoped CRIT** (Freminet C1, Gaming C6, Ganyu A1,
   Kinich C1), which the retirement round ruled out.
2. **Energy restoration.** Proposed **missing**. But `energy` effects reach no planner surface (the
   Team Builder reads them), so an authored one would light a column the planner doesn't draw.
   Missing, notModeled, or nothingToModel for the planner?
3. **Resource pools with no reader** — Nightsoul points (Iansan C1/C4, Kinich A1, Ifa C2) and Will to
   Win (Lohen A1/C1). Proposed **notModeled**. ⚠️ Kinich's curator note leans on the retired
   "windows, not gauges" line.
4. **Pickups** — particles, droplets, Puffers, Void Rifts, Bond of Life. Proposed **notModeled**,
   citing the rubric's out-of-scope list.
5. **CRIT-triggered effects** (Rosaria C1, Tartaglia A4, Dehya C6's second half). Proposed
   **missing**. Or rule them like random procs?
6. **Authored ELSEWHERE, with nothing that names the host.** The derivation credits a passive or
   constellation found through a gated condition or a `source`/`attribution` string. These carry
   neither, so they read missing while the planner draws them: Aino A1 (a Moonsign-gated tick series)
   and A4 (`flatScaling`), Collei A4 and Mizuki A1 (a summon's `durationExtensions`), Kachina A4
   (tick `flatScaling`), Yelan A4 (`source: 'passive'`), Illuga's skill (buff hosted on a passive),
   Sayu C1. **Proposal:** a fourth positive statement, `coveredBy: '<hostId>'`, which lint checks
   points at a real host. Or add `source` to `DurationExtension` instead.
7. **Tags as grants** — `grouping` on Jean, Ifa, Lan Yan and Kazuha's skill/burst. The Team Builder
   reads the tag; the planner has nothing to draw for a pull. Proposed **missing**; nothingToModel
   seems right to me.
8. **Notes that lean on the retired creed** — Citlali C6's "not modelled per the constitution".
   Proposed missing.
9. **No `physicalDmgBonus` stat** — Eula C1, Xinyan A4, Mika's Detector stacks. "Missing" here means
   a new Stat as well as data.

Also found along the way (not coverage, for the engine queue): Alhaitham's C4/C6 read a `mirrors`
stack key nothing grants; Eula's Hold variant keeps a 10s cooldown at C2 (no `cooldownModifiers` on
variants); Dahlia C4 extends a Favonian Favor window that isn't authored.

## Rows

Only `notModeled` rows carry a `reason`, and that reason is **rendered on the site** — read those as copy.
Columns: proposal · confidence · the deciding phrase / the shape that would author it.

### aino

| column   | host                     | proposal           | conf. | why                                                                                                        | reason (user-facing) |
| -------- | ------------------------ | ------------------ | ----- | ---------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Musecatcher              | **nothingToModel** | high  | Damage + Hydro application only; no buff, heal, summon or state.                                           |                      |
| A4       | Structured Power Booster | **missing**        | high  | AUTHORED ELSEWHERE: burst summon tick damage carries flatScaling {em,50}. Pure damage magnitude, no pixel. |                      |

### albedo

| column   | host                               | proposal           | conf.  | why                                                                                                                                                            | reason (user-facing)                                                                                                          |
| -------- | ---------------------------------- | ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Q.grants | Rite of Progeniture: Tectonic Tide | **nothingToModel** | high   | Damage only; Fatal Blossoms already authored as the 'With Solar Isotoma' variant's application[].                                                              |                                                                                                                               |
| A1       | Calcite Might                      | **notModeled**     | high   | Curator ruling: 'pure damage-MAGNITUDE adds… <50% HP gate unanswerable… Do not re-open'.                                                                       | This only raises Transient Blossom damage against opponents below 50% HP. We don't show damage amounts or track opponent HP.  |
| C2       | Opening of Phanerozoic             | **missing**        | medium | Fatal Reckoning stacks from Transient Blossoms + Hexerei +125 EM team buff; blocked because proc landings never enter the hit stream (engine gap, not ruling). |                                                                                                                               |
| C4       | Descent of Divinity                | **missing**        | medium | '+30% Plunging DMG within Solar Isotoma field'. Curator refused as positional, but in-field buffs (Bennett) are authored as duringSummon active buffs.         |                                                                                                                               |
| C6       | Dust of Purification               | **notModeled**     | medium | 'protected by a shield created by Crystallize… within the field' — shard pickup + position; curator: 'unexpressible'. Moondrift branch may be reachable now.   | This bonus needs a Crystallize shield picked up inside the Solar Isotoma field, and we don't model shard pickups or position. |

### alhaitham

| column   | host                                   | proposal    | conf.  | why                                                                                                                                                 | reason (user-facing) |
| -------- | -------------------------------------- | ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Universality: An Elaboration on Form   | **missing** | high   | Chisel-Light Mirrors: Dendro infusion + Projection Attack procs. 'mirrors' key is read by C4/C6 conditions but nothing grants it.                   |                      |
| Q.grants | Particular Field: Fetters of Phenomena | **missing** | medium | Consumes mirrors, regenerates 3/2/1/0 after 2s — mirror gainStacks/consumeStacks onCast burst; no mirror stack is authored anywhere.                |                      |
| C1       | Intuition                              | **missing** | high   | 'Projection Attack hits… CD decreased by 1.2s, once every 1s' — cooldownReduce onHit with procCooldown 1; Projection Attacks themselves unauthored. |                      |

### aloy

| column   | host               | proposal           | conf.  | why                                                                                                                                             | reason (user-facing) |
| -------- | ------------------ | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Frozen Wilds       | **missing**        | medium | AUTHORED ELSEWHERE (partly): coil gainStacks + Rushing Ice onStack live on strong_strike passive. Coil NA DMG%, Cryo infusion still unauthored. |                      |
| Q.grants | Prophecies of Dawn | **nothingToModel** | high   | 'dealing AoE Cryo DMG' — damage only.                                                                                                           |                      |
| A1       | Combat Override    | **missing**        | high   | 'ATK +16%, party +8%, 10s' on Coil gain — self/team atk buff onHit skill (or on coil gainStacks), 10s.                                          |                      |

### amber

| column | host                       | proposal       | conf.  | why                                                                                                                                           | reason (user-facing)                                                                                |
| ------ | -------------------------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A4     | Precise Shot               | **notModeled** | medium | 'Aimed Shot hits on weak points' — weak-point hits depend on aim and the opponent.                                                            | This needs an Aimed Shot to hit a weak point, and we don't model where a shot lands on an opponent. |
| C1     | One Arrow to Rule Them All | **missing**    | medium | 'Fires 2 arrows per Aimed Shot' — second arrow is an extra hit/application on the aimed shot; constellation-gated landing.                    |                                                                                                     |
| C2     | Bunny Triggered            | **missing**    | low    | Shooting Baron Bunny's foot detonates it early (+200% DMG) — changes when the Bunny's Pyro lands; needs an input. Could be a position ruling. |                                                                                                     |
| C6     | Wildfire                   | **missing**    | high   | 'all party members'… ATK by 15% for 10s' — team atk buff onCast burst 10s (gcsim says 15s; verify).                                           |                                                                                                     |

### arataki_itto

| column | host                         | proposal       | conf.  | why                                                                                                                                           | reason (user-facing)                                                                                |
| ------ | ---------------------------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A1     | Arataki Ichiban              | **notModeled** | high   | 'ATK SPD of the next slash by 10%' — attack speed is not a Stat; rubric lists attack-speed as out of scope. Interrupt resistance nothing.     | We don't model attack speed, so Arataki Kesagiri's faster slashes aren't reflected in their timing. |
| A4     | Bloodline of the Crimson Oni | **missing**    | medium | Kesagiri-only flat DMG; curator: 'nothing to wire' because planner's C is Saichimonji and Kesagiri is unmodeled. Data gap rather than ruling. |                                                                                                     |
| C1     | Stay a While and Listen Up   | **missing**    | medium | 'gains 2 stacks of Superlative Superstrength… 1 every 0.5s' — gainStacks onCast burst; SSS economy not modeled anywhere.                      |                                                                                                     |
| C6     | Arataki Itto, Present!       | **missing**    | low    | '+70% CRIT DMG on Charged Attacks' — no charge-only critDmg stat (self critDmg would over-claim). 50% no-consume half is RNG.                 |                                                                                                     |

### arlecchino

| column   | host                                                  | proposal       | conf.  | why                                                                                                                                          | reason (user-facing)                                                                        |
| -------- | ----------------------------------------------------- | -------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| E.grants | All Is Ash                                            | **missing**    | medium | Blood-Debt Directive: 2 Pyro ticks at 5s on the target, skill DMG — unauthored. Bond of Life half is out of scope.                           |                                                                                             |
| A1       | Agony Alone May Be Repaid                             | **notModeled** | high   | Both clauses change Bond of Life gained; rubric out-of-scope list: 'Bond of Life'.                                                           | We don't model Bond of Life, and this passive only changes how much of it Arlecchino gains. |
| C1       | "All Reprisals and Arrears, Mine to Bear..."          | **notModeled** | high   | Masque bonus scales with Bond of Life (curator: 'BoL-runtime scaling'); interruption resistance.                                             | We don't model Bond of Life, which this constellation's damage bonus depends on.            |
| C4       | "You Shall Love and Protect Each Other Henceforth..." | **missing**    | medium | 'absorbs a Blood-Debt Directive… Q CD −2s, 15 Energy, once every 10s' — cooldownReduce + energy onCast (charged/burst) with procCooldown 10. |                                                                                             |

### baizhu

| column | host                        | proposal       | conf.  | why                                                                                                                                                              | reason (user-facing)                                                                            |
| ------ | --------------------------- | -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A4     | All Things Are of the Earth | **notModeled** | high   | Trigger is 'healed by Seamless Shields' (onHeal has no reader); existing caveat already says 'Not modeled'.                                                      | This bonus goes to characters healed by the Seamless Shields, and we don't track who is healed. |
| C2     | Incisive Discernment        | **missing**    | medium | Gossamer Sprite: Splice — Dendro 1U proc on active hits, 5s ICD, plus heal; curator: no arming path for a permanent listener (engine gap). Heal half authorable. |                                                                                                 |

### barbara

| column | host                         | proposal           | conf.  | why                                                                                                         | reason (user-facing)                                                                           |
| ------ | ---------------------------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| A1     | Glorious Season              | **nothingToModel** | high   | 'Stamina Consumption… reduced by 12%'.                                                                      |                                                                                                |
| A4     | Encore                       | **notModeled**     | high   | 'gains an Elemental Orb/Particle' — rubric out of scope: 'orb/particle collection'.                         | This extension comes from picking up Elemental Particles, and we don't model particle pickups. |
| C1     | Gleeful Songs                | **missing**        | medium | 'regenerates 1 Energy every 10s' — self energy; retired only because no periodic non-summon trigger exists. |                                                                                                |
| C6     | Dedicating Everything to You | **notModeled**     | high   | 'party members falls… Automatically revives' — revive.                                                      | We don't model characters falling in battle, so this revive has nothing to show.               |

### beidou

| column | host                                       | proposal       | conf. | why                                                                                                | reason (user-facing)                                                                                     |
| ------ | ------------------------------------------ | -------------- | ----- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A1     | Retribution                                | **notModeled** | high  | 'Counterattacking… at the precise moment when the character is hit' — taking hits isn't simulated. | We don't model Beidou being hit, so the perfectly timed counter this rewards can't happen in a rotation. |
| C2     | Upon the Turbulent Sea, the Thunder Arises | **notModeled** | high  | 'arc lightning can jump to 2 additional targets' — single-opponent model.                          | We model a single opponent, so there are no extra targets for the lightning to jump to.                  |
| C4     | Stunning Revenge                           | **notModeled** | high  | 'Upon being attacked' — curator: 'Intentionally not authored… taking damage isn't simulated'.      | We don't model Beidou being hit, so the extra Electro damage this gives her Normal Attacks isn't shown.  |

### bennett

| column   | host                 | proposal           | conf.  | why                                                                                                                      | reason (user-facing) |
| -------- | -------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| E.grants | Passion Overload     | **nothingToModel** | high   | Press/Hold strikes deal Pyro DMG only; variants carry timing + application.                                              |                      |
| extra    | It Should Be Safe... | **nothingToModel** | high   | 'expedition… time consumed is reduced by 25%'.                                                                           |                      |
| C2       | Impasse Conqueror    | **missing**        | high   | 'HP falls below 70%, ER +30%' — self energyRecharge passive with selfHpBelow 70 (renders optimistically).                |                      |
| C4       | Unexpected Odyssey   | **missing**        | medium | C4 follow-up Pyro hit on h1E; curator: express as constellation-gated variant of the hold (third 1U application at f94). |                      |

### candace

| column | host                     | proposal       | conf. | why                                                                                                   | reason (user-facing)                                                                   |
| ------ | ------------------------ | -------------- | ----- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A1     | Aegis of Crossed Arrows  | **notModeled** | high  | 'hit by an attack in the Hold duration' — taking hits isn't simulated.                                | We don't model Candace being hit, so her Hold Skill always takes its full charge time. |
| A4     | Celestial Dome of Sand   | **missing**    | high  | Active normalDmgBonus (elemental NA) scaling 0.5% per 1000 Max HP during Prayer of the Crimson Crown. |                                                                                        |
| C2     | Moon-Piercing Brilliance | **missing**    | high  | 'Max HP increased by 20% for 15s' — self hp buff onHit skill (hold), 15s.                             |                                                                                        |

### charlotte

| column | host                        | proposal       | conf.  | why                                                                                                       | reason (user-facing)                                                               |
| ------ | --------------------------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A1     | Moment of Impact            | **notModeled** | high   | 'When opponents marked… are defeated' — opponent defeat isn't simulated.                                  | We don't model opponents being defeated, so this cooldown reduction can't trigger. |
| C2     | A Duty to Pursue Truth      | **missing**    | medium | 'ATK +10%/20%/30% by opponents hit, 12s' — single-target model gives self atk +10% onHit skill 12s.       |                                                                                    |
| C4     | A Responsibility to Oversee | **missing**    | medium | Burst hits on marked opponents: +10% DMG, 2 Energy, 5 per 20s — energy onHit burst (mark = skill window). |                                                                                    |

### chasca

| column   | host                            | proposal           | conf.  | why                                                                                                                                                                       | reason (user-facing) |
| -------- | ------------------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Q.grants | Soul Reaper's Fatal Round       | **nothingToModel** | high   | Damage only; team-element shell conversion is an application question.                                                                                                    |                      |
| A1       | Bullet Trick                    | **missing**        | low    | Spiritbinding Conversion chance + Shining Shell DMG stacks; curator: gated on Multitarget Fire (Hold), which isn't modeled. Partly RNG.                                   |                      |
| A4       | Intent to Cover                 | **missing**        | high   | 'party member triggers a Nightsoul Burst… fire a Burning Shadowhunt Shot' — damage proc on onTeamNightsoulBurst; element via teamElementPriority (ElementRef now exists). |                      |
| C1       | Cylinder, the Restless Roulette | **missing**        | low    | Raises conversion chance / converts 2nd shell — Multitarget Fire bullet system unmodeled; exploration half is nothing.                                                    |                      |
| C2       | Muzzle, the Searing Smoke       | **missing**        | medium | Field-entry Spirit stack + 400% ATK elemental AoE per Multitarget Fire — unmodeled bullet system.                                                                         |                      |
| C4       | Sparks, the Sudden Shot         | **missing**        | medium | 1.5 Energy per Radiant Shell hit + one 400% ATK elemental AoE per burst — energy + damage proc with application onHit burst.                                              |                      |
| C6       | Showdown, the Glory of Battle   | **missing**        | low    | 'Fatal Rounds' 3s state: instant charge + CRIT DMG +120%; gated on Spiritbinding Conversion (unmodeled).                                                                  |                      |

### chevreuse

| column   | host                                | proposal           | conf.  | why                                                                                                                      | reason (user-facing) |
| -------- | ----------------------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Q.grants | Ring of Bursting Grenades           | **nothingToModel** | high   | 'AoE Pyro DMG… secondary explosive shells' — damage only.                                                                |                      |
| C4       | The Secret to Rapid-Fire Multishots | **missing**        | medium | 'Hold mode… will not go on cooldown… removed after fired twice or 6s' — state window + bypassesCooldown on hold variant. |                      |

### chiori

| column | host                        | proposal    | conf.  | why                                                                                            | reason (user-facing) |
| ------ | --------------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------------- | -------------------- |
| C4     | A Tailor's Three Courtesies | **missing** | medium | Kinu summons on N/C/P hits after Tailor-Made; depends on A1's Tailor-Made windows (unmodeled). |                      |

### chongyun

| column   | host                             | proposal           | conf.  | why                                                                                                                   | reason (user-facing)                                                                           |
| -------- | -------------------------------- | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Q.grants | Spirit Blade: Cloud-Parting Star | **nothingToModel** | high   | 'deal AoE Cryo DMG and launch opponents' — damage only.                                                               |                                                                                                |
| A1       | Steady Breathing                 | **notModeled**     | high   | 'Normal ATK SPD increased by 8%' — attack speed is not a Stat; rubric out of scope.                                   | We don't model attack speed, so Normal Attacks inside the Frost Field keep their usual timing. |
| C1       | Ice Unleashed                    | **missing**        | medium | 3 Cryo blades on N4 (ICDTagNone, 1U each); curator: no arming path for a constellation-hosted swing proc. Engine gap. |                                                                                                |
| C2       | Atmospheric Revolution           | **missing**        | high   | 'cast within the Frost Field… CD decreased by 15%' — CLAUDE.md names Chongyun C2 a WISHLIST third shape.              |                                                                                                |
| C6       | Rally of Four Blades             | **missing**        | medium | 4th spirit blade at f77 = constellation-gated application entry; HP-comparison DMG% renders optimistically.           |                                                                                                |

### citlali

| column   | host                                | proposal       | conf.  | why                                                                                                                                                          | reason (user-facing)                                                                                |
| -------- | ----------------------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Q.grants | Edict of Entwined Splendor          | **notModeled** | medium | Only non-damage grant is Nightsoul points; curator: 'Restores 24 Nightsoul + 3 per skull; not modelled (resource accounting)'.                               | We don't track Nightsoul points, so the points this burst restores to Citlali aren't shown.         |
| A4       | Itzpapalotl's Star Garments         | **notModeled** | medium | Flat EM DMG on two named attacks; manual-retirement ruling: named-ability flat DMG is a RETIRE. Nightsoul +4 is resource.                                    | This adds Elemental Mastery-based damage to two specific attacks, and we don't show damage amounts. |
| C1       | Radiant Blades of Centzon Mimixcoah | **missing**    | medium | 10-stack pool spent by teammates' hits for +200% EM flat DMG; poolsAtHome now spends on teammate hits; no all-class FlatDmg stat.                            |                                                                                                     |
| C6       | Teoiztac's Secret Pact              | **missing**    | medium | Cifra points from Nightsoul consumed → team Pyro/Hydro DMG% perStack; curator 'not modelled per the constitution' (retired creed); accrual primitive exists. |                                                                                                     |

### clorinde

| column   | host                                | proposal       | conf.  | why                                                                                                                      | reason (user-facing)                                                             |
| -------- | ----------------------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| E.grants | Impale the Night                    | **notModeled** | medium | Heal and hit count scale with Bond of Life (curator: 'BoL branching (not authored)'); rubric: Bond of Life out of scope. | We don't model Bond of Life, which decides how much this lunge heals Clorinde.   |
| Q.grants | Last Lightfall                      | **notModeled** | high   | Only grant is 'a Bond of Life based upon her own max HP'; rubric out of scope.                                           | We don't model Bond of Life, so the Bond of Life this burst grants isn't shown.  |
| C4       | "To Enshrine Tears, Life, and Love" | **notModeled** | high   | 'Every 1% of her current Bond of Life will increase Last Lightfall DMG' — curator: 'BoL exception'.                      | We don't model Bond of Life, which this constellation's damage bonus depends on. |

### collei

| column | host                   | proposal    | conf.  | why                                                                                                                        | reason (user-facing) |
| ------ | ---------------------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A4     | The Languid Wood       | **missing** | high   | AUTHORED ELSEWHERE: collei burst summon Cuilein-Anbar durationExtensions (onReaction, +1s, max 3).                         |                      |
| C1     | Deepwood Patrol        | **missing** | high   | 'not on the field, ER increased by 20%' — self energyRecharge passive gated offField.                                      |                      |
| C2     | Through Hill and Copse | **missing** | medium | Sprout unconditional + one-shot 3s extension; curator restore path: constellation-gated variant with a summon tick series. |                      |

### columbina

| column | host                | proposal       | conf.  | why                                                                                                                         | reason (user-facing)                                                                                                                                  |
| ------ | ------------------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A4     | Law of the New Moon | **notModeled** | medium | Two 33% chance extra hits (low-probability procs) + Moonridge Dew, a Charged Attack resource. Curator: 'unmodelable procs'. | Two of these effects are 33% chances of an extra hit, and we don't draw chance-based procs. The third makes Moonridge Dew, a resource we don't track. |
| extra  | Lunar Vigil         | **notModeled** | high   | 'will revive this character' — revive; also disabled in Domains/Abyss.                                                      | We don't model characters falling in battle, so this revive has nothing to show.                                                                      |

### cyno

| column   | host                                   | proposal    | conf.  | why                                                                                                                                 | reason (user-facing) |
| -------- | -------------------------------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Mortuary Rite                          | **missing** | high   | AUTHORED ELSEWHERE: the extension lives on the burst's durationExtensions (onCast skill, inStance, +4s, max 2).                     |                      |
| A1       | Featherfall Judgment                   | **missing** | high   | Judication +35% skill DMG + 3 Duststalker Bolts (Electro); existing caveat 'Not modeled: the Duststalker Bolts'.                    |                      |
| extra    | A Star With Which to Start the Journey | **missing** | high   | AUTHORED ELSEWHERE: skill's opensTransientState {inStance, 6s}; Radiance clause is a gate for other hosts.                          |                      |
| C6       | Raiment: Just Scales                   | **missing** | medium | Day of the Jackal: 4 stacks onCast burst, consumed per NA hit to fire a bolt (0.4s) — gainStacks/consumeStacks onHit + damage proc. |                      |

### dahlia

| column   | host                       | proposal           | conf.  | why                                                                                                                               | reason (user-facing)                                                                                         |
| -------- | -------------------------- | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| E.grants | Immersive Ordinance        | **missing**        | medium | Sacramental Shower summon removed for lack of a lifetime source ('Re-add when KQM / in-game data lands').                         |                                                                                                              |
| A1       | The Wind's Gentle Grace    | **missing**        | medium | 'trigger Frozen… grant Dahlia 2 Benison stacks, once every 8s' — gainStacks onReaction frozen, procCooldown 8. Benison unmodeled. |                                                                                                              |
| A4       | Prayer of Well-Wrought Joy | **notModeled**     | high   | 'ATK SPD will increase based on Dahlia's Max HP' — attack speed is not a Stat.                                                    | We don't model attack speed, so this faster attacking isn't reflected in Normal Attack timing.               |
| C1       | Infallible Procession      | **missing**        | medium | 'Each time Dahlia gains 1 Benison stack, regain 2.5 Energy' — energy on stack gain; Benison unmodeled.                            |                                                                                                              |
| C2       | Revelation of Mercy        | **nothingToModel** | medium | '25% increased Shield Strength' — no shield-strength stat; shield bar span unchanged.                                             |                                                                                                              |
| C4       | Collect of the Assembly    | **missing**        | high   | 'Favonian Favor lasts 3 more seconds' — needs the Favonian Favor window authored first (burst has only the shield).               |                                                                                                              |
| C6       | You Shall Go Out With Joy  | **notModeled**     | high   | ATK SPD (not a Stat) + revive (curator: 'caveat-only… no on-death trigger').                                                      | We don't model attack speed or characters falling in battle, so neither half of this constellation is shown. |

### dehya

| column   | host                          | proposal           | conf.  | why                                                                                                                                     | reason (user-facing) |
| -------- | ----------------------------- | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Molten Inferno: Ranging Flame | **nothingToModel** | medium | Relocates Fiery Sanctum, which 'inherit[s] the remaining duration' — window unchanged. Curator notes a 0.4s pickup extension unmodeled. |                      |
| A1       | Unstinting Succor             | **nothingToModel** | high   | 'take 60% less DMG… from Redmane's Blood' + interruption resistance.                                                                    |                      |
| C6       | The Burning Claws Cleaving    | **missing**        | low    | Q CRIT Rate +10% (no burst-only CR stat); crit-triggered CRIT DMG + 0.5s stance extensions depend on crits.                             |                      |

### diluc

| column   | host                               | proposal           | conf.  | why                                                                                                        | reason (user-facing)                                                 |
| -------- | ---------------------------------- | ------------------ | ------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| E.grants | Searing Onslaught (E1)             | **nothingToModel** | high   | First slash, Pyro DMG only.                                                                                |                                                                      |
| E.grants | Searing Onslaught (E2)             | **nothingToModel** | high   | Second slash, Pyro DMG only.                                                                               |                                                                      |
| E.grants | Searing Onslaught (E3)             | **nothingToModel** | high   | Final slash, Pyro DMG only.                                                                                |                                                                      |
| A1       | Relentless                         | **nothingToModel** | high   | 'Charged Attack Stamina Cost is decreased by 50%' — stamina.                                               |                                                                      |
| C2       | Searing Ember                      | **notModeled**     | high   | 'When Diluc takes DMG' — taking damage isn't simulated.                                                    | We don't model Diluc taking damage, so this ATK bonus can't trigger. |
| C4       | Flowing Flame                      | **missing**        | medium | +40% DMG for a skill press 2–4s after the previous one — timed skillDmgBonus window after each skill cast. |                                                                      |
| C6       | Flaming Sword, Nemesis of the Dark | **missing**        | medium | Next 2 NAs within 6s +30% DMG — normalDmgBonus onCast skill 6s; ATK SPD half not a Stat.                   |                                                                      |

### diona

| column | host                   | proposal           | conf.  | why                                                                                                                         | reason (user-facing) |
| ------ | ---------------------- | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | Cat's Tail Secret Menu | **nothingToModel** | high   | Movement SPD +10% and Stamina Consumption −10%.                                                                             |                      |
| A4     | Drunkards' Farce       | **nothingToModel** | medium | 'Opponents… 10% decreased ATK' — no enemy-ATK stat we draw (also not in gcsim).                                             |                      |
| extra  | Choice Treasures       | **missing**        | low    | Reaction-fired Icy Paws (3 hits, 3.5s CD, 20s after skill); curator: no source gives their gauge, so unauthored.            |                      |
| C2     | Shaken, Not Purred     | **missing**        | medium | +15% Icy Paws DMG = skillDmgBonus passive (authorable). Splash shield is CO-OP, ruled unmodeled.                            |                      |
| C4     | Wine Industry Slayer   | **missing**        | low    | Aimed shot charge −60% in burst field — faster frames (gcsim aimedC4Frames) as a gated variant; positional 'within radius'. |                      |

### dori

| column   | host                                       | proposal           | conf.  | why                                                                                                            | reason (user-facing) |
| -------- | ------------------------------------------ | ------------------ | ------ | -------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Spirit-Warding Lamp: Troubleshooter Cannon | **nothingToModel** | high   | Troubleshooter Shot + After-Sales Rounds deal Electro DMG only.                                                |                      |
| A1       | An Eye for Gold                            | **missing**        | high   | 'triggers [Electro reactions]… CD decreased by 1s, once every 3s' — cooldownReduce onReaction, procCooldown 3. |                      |
| A4       | Compound Interest                          | **missing**        | medium | 'restore 5 Energy per 100% ER… max 15' — energy onHit skill, scaling ER.                                       |                      |
| C1       | Additional Investment                      | **missing**        | medium | 'After-Sales Service Rounds increased by 1' — constellation-gated extra application entry.                     |                      |
| C2       | Special Franchise                          | **missing**        | medium | Jinni Toop fires on each Jinni heal (6× Electro 1U); curator restore path: Jinni as a summon tick series.      |                      |
| C4       | Discretionary Supplement                   | **missing**        | medium | HP<50%: +50% incomingHealingBonus (authorable, optimistic); Energy<50%: +30% ER (no energy state).             |                      |

### durin

| column | host                        | proposal    | conf. | why                                                                                                                                              | reason (user-facing) |
| ------ | --------------------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| A4     | Chaos Formed Like the Night | **missing** | low   | Primordial Fusion: 10 stacks on burst, each summon tick consumes 1 for an ATK-scaled DMG amp — no amp stat; curator removed caveat as DMG% only. |                      |
| C1     | Adamah's Redemption         | **missing** | high  | Curator: 'the gap here is only a missing all-attack-class FlatDmg Stat key' — 20s team/self flat DMG stacks on burst.                            |                      |

### emilie

| column | host                     | proposal    | conf.  | why                                                                                                                        | reason (user-facing) |
| ------ | ------------------------ | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | Lingering Fragrance      | **missing** | medium | Cleardew Cologne (Dendro 1U); curator refused: Scent accrual needs a Burning-opponent gate we lack. Engine gap, not scope. |                      |
| C1     | Light Fragrance Leaching | **missing** | low    | +20% DMG to two named attacks + extra Scent every 2.9s; Scent/Cologne unmodeled.                                           |                      |

### escoffier

| column | host                   | proposal    | conf.  | why                                                                                                                    | reason (user-facing) |
| ------ | ---------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------- |
| C4     | Secret Rosemary Recipe | **missing** | medium | 'Rehab Diet lasts 6 more seconds' — heal duration extension. Crit-Rate chance heal/energy is RNG (curator: 'Skipped'). |                      |

### eula

| column | host                   | proposal       | conf.  | why                                                                                                                                      | reason (user-facing)                                                                                                                 |
| ------ | ---------------------- | -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A1     | Roiling Rime           | **missing**    | medium | Shattered Lightfall Sword (Physical hit) when hold E spends 2 Grimheart; Grimheart unmodeled.                                            |                                                                                                                                      |
| A4     | Wellspring of War-Lust | **missing**    | high   | 'When Glacial Illumination is cast, CD of Icetide Vortex reset + 1 Grimheart' — cdReset (resetsAbility skill) + gainStacks onCast burst. |                                                                                                                                      |
| C1     | Tidal Illusion         | **missing**    | high   | 'Physical DMG +30% for 6s' per Grimheart consumed — self physical DMG buff onCast hold E; no physicalDmgBonus stat exists.               |                                                                                                                                      |
| C2     | Lady of Seafoam        | **missing**    | high   | Hold variant cooldown 10 regardless of C2; curator: 'Schema has no cooldownModifiers on variants'.                                       |                                                                                                                                      |
| C6     | Noble Obligation       | **notModeled** | medium | Lightfall Sword start stacks = damage magnitude; extra stack is a 50% chance.                                                            | This only changes how hard the Lightfall Sword hits, partly on a 50% chance, and we don't show damage amounts or chance-based procs. |

### faruzan

| column   | host                    | proposal    | conf.  | why                                                                                                              | reason (user-facing) |
| -------- | ----------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Wind Realm of Nasamjnin | **missing** | medium | Manifest Gale 18s state + Pressurized Collapse Anemo vortex; existing caveat names the Hurricane Arrow gap.      |                      |
| A1       | Impetuous Flow          | **missing** | medium | A1 Perfidious Wind's Bale via the vortex — Anemo resShred without burst; faster charge. Vortex chain unauthored. |                      |
| C1       | Truth by Any Means      | **missing** | medium | Two Hurricane Arrows per Manifest Gale — depends on the unmodeled Manifest Gale state.                           |                      |
| C4       | Divine Comprehension    | **missing** | medium | 'restore 2 Energy' per vortex hit — energy onHit (vortex).                                                       |                      |

### fischl

| column | host                 | proposal       | conf.  | why                                                                                                                                | reason (user-facing)                                                                                          |
| ------ | -------------------- | -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A1     | Stellar Predator     | **missing**    | low    | 'hits Oz with a fully-charged Aimed Shot' — extra Electro AoE; requires aiming at Oz (possibly a position ruling).                 |                                                                                                               |
| C1     | Gaze of the Deep     | **missing**    | medium | 'Normal Attack… Oz fires a coordinated attack, 22% ATK' — physical proc onHit normal; application-less damage fires nothing today. |                                                                                                               |
| C2     | Devourer of All Sins | **notModeled** | medium | '+200% ATK as DMG, AoE +50%' on Nightrider's hit only — named-ability flat DMG (RETIRE ruling) + area.                             | This only raises the damage and size of Nightrider's summoning hit, and we don't show damage amounts or area. |

### flins

| column   | host                             | proposal           | conf. | why                                                                                                   | reason (user-facing) |
| -------- | -------------------------------- | ------------------ | ----- | ----------------------------------------------------------------------------------------------------- | -------------------- |
| Q.grants | Ancient Ritual: Cometh the Night | **nothingToModel** | high  | "all of which are considered Lunar-Charged DMG" — damage only; Thunderous Symphony variant is timing. |                      |

### freminet

| column   | host                              | proposal       | conf.  | why                                                                                                                                                  | reason (user-facing)                                                                                            |
| -------- | --------------------------------- | -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| E.grants | Pressurized Floe                  | **missing**    | medium | Pers Timer 10s state (normals add Cryo frost-wave proc w/ application, pressure levels) + Pneuma Spiritbreath Thorn hit; variants carry frames only. |                                                                                                                 |
| A1       | Saturation Deep Dive              | **missing**    | high   | "CD of Pressurized Floe decreased by 1s" — cooldownReduce onCast on the Lv 0–3 Shattering Pressure variant.                                          |                                                                                                                 |
| A4       | Parallel Condensers               | **notModeled** | medium | "triggers Shatter" — Shatter is never emitted (rubric N12, AURA_NOTES); also scoped to one variant's DMG.                                            | We don't model Shatter, which triggers this bonus.                                                              |
| C1       | Dreams of the Foamy Deep          | **notModeled** | high   | Curator: ability-scoped CRIT Rate has no stat, "that decision is made and the answer is no".                                                         | This CRIT bonus applies only to Shattering Pressure, and we don't show CRIT bonuses limited to a single attack. |
| C2       | Penguins and the Land of Plenty   | **missing**    | medium | "restore 2 Energy … Level 4 … 3 Energy" — self energy onCast skill variants (energy has no planner reader).                                          |                                                                                                                 |
| C4       | Dance of the Snowy Moon and Flute | **missing**    | high   | "ATK increased by 9% for 6s. Max 2 stacks" after Frozen/Superconduct — onReaction self atk% perStack, procCooldown 0.3s.                             |                                                                                                                 |

### furina

| column | host                                           | proposal       | conf.  | why                                                                                                                                            | reason (user-facing)                                                                                |
| ------ | ---------------------------------------------- | -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A1     | Endless Waltz                                  | **notModeled** | high   | Trigger is OnHeal overflow; curator: onHeal "has no reader… no partial trigger to fall back to".                                               | This heal is triggered by overflow healing from other sources, and we don't track healing received. |
| A4     | Unheard Confession                             | **missing**    | low    | Singer heal interval −16% (HP-scaled) changes drawn tick marks; Salon +28% DMG. Existing caveat names it; Max HP-dependent, may be notModeled. |                                                                                                     |
| C1     | "Love Is a Rebellious Bird That None Can Tame" | **notModeled** | medium | "+150 Fanfare, limit +100" — Fanfare untracked; burst buffs already `unknown` valued.                                                          | We don't track Fanfare, so the extra Fanfare and the higher limit aren't shown.                     |
| C2     | "A Woman Adapts Like Duckweed in Water"        | **notModeled** | medium | Fanfare gain from party HP changes (no HP-change reader) and HP% from overflow Fanfare.                                                        | We don't track Fanfare or party HP changes, so this bonus and the Max HP it grants aren't shown.    |

### gaming

| column   | host                    | proposal       | conf.  | why                                                                                                                                  | reason (user-facing)                                                                                             |
| -------- | ----------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| E.grants | Bestial Ascent          | **missing**    | medium | Charmed Cloudstrider: plunge "converted to Pyro DMG" after E — plunge infusion/special-plunge frames unauthored (no plungeVariants). |                                                                                                                  |
| A4       | Air of Prosperity       | **missing**    | medium | HP-gated: <50% incomingHealingBonus 20; ≥50% Cloudstrider +20% DMG (plungeDmgBonus over-claims other plunges).                       |                                                                                                                  |
| C2       | Plum Blossoms Underfoot | **notModeled** | high   | "receives healing and this instance of healing overflows" — onHeal has no reader.                                                    | This triggers on overflow healing Gaming receives, and we don't track healing received.                          |
| C4       | Soar Across Mountains   | **missing**    | medium | "restore 2 Energy … once every 0.2s" — self energy onHit plunge, procCooldown 0.2 (energy has no planner reader).                    |                                                                                                                  |
| C6       | To Tame All Beasts      | **notModeled** | high   | Curator retired: Cloudstrider-only CRIT has no ability-scoped stat; radius nothing to draw.                                          | This CRIT bonus applies only to Charmed Cloudstrider, and we don't show CRIT bonuses limited to a single attack. |

### ganyu

| column | host                   | proposal           | conf.  | why                                                                                                                                 | reason (user-facing)                                                                                          |
| ------ | ---------------------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A1     | Undivided Heart        | **notModeled**     | medium | Frostflake-only CRIT Rate; no class-scoped CRIT stat (the retirement brief's "CRIT Rate on Charged Attacks only" case).             | This CRIT bonus applies only to Frostflake Arrows, and we don't show CRIT bonuses limited to a single attack. |
| extra  | Preserved for the Hunt | **nothingToModel** | high   | "Refunds 15% of the ore used when crafting" — crafting.                                                                             |                                                                                                               |
| C4     | Westward Sojourn       | **notModeled**     | medium | Curator: "skipped"; DMG-taken ramp for opponents "within the AoE", lingers after leaving — position-based, no DMG-taken stat.       | This depends on how long opponents stay inside Celestial Shower's area, and we don't model positioning.       |
| C6     | The Clement            | **missing**        | medium | "next Frostflake Arrow within 30s to not require charging" — Q opens a 30s state; uncharged aimed-shot frames variant consuming it. |                                                                                                               |

### gorou

| column | host                             | proposal    | conf.  | why                                                                                                                                   | reason (user-facing) |
| ------ | -------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| C1     | Rushing Hound: Swift as the Wind | **missing** | medium | "CD … decreased by 2s … once every 10s" on others' Geo DMG — cooldownReduce onHit source others, element geo, procCooldown 10.        |                      |
| C2     | Sitting Hound: Steady as a Clock | **missing** | medium | Glory +1s per Crystallize shard / Lunar-Crystallize, max 3s — durationExtensions onReaction on the burst (shard pickup approximated). |                      |

### hu_tao

| column | host                   | proposal           | conf.  | why                                                                                                              | reason (user-facing)                                                                             |
| ------ | ---------------------- | ------------------ | ------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| C1     | Crimson Bouquet        | **nothingToModel** | high   | "Charged Attacks do not consume Stamina" — stamina.                                                              |                                                                                                  |
| C2     | Ominous Rainfall       | **missing**        | medium | Blood Blossom unauthored; C2 adds HP-scaled flat DMG to it and makes Spirit Soother apply it (Pyro application). |                                                                                                  |
| C4     | Garden of Eternal Rest | **notModeled**     | high   | "Upon defeating an enemy" — curator: no enemy death simulation, "not a DEFER".                                   | This triggers when an opponent is defeated, and we don't model opponents being defeated.         |
| C6     | Butterfly's Embrace    | **notModeled**     | high   | Revive + "HP drops below 25%" trigger (OnPlayerHPDrain); no reader.                                              | This triggers when Hu Tao's HP drops below 25% or she takes a lethal hit, and we don't track HP. |

### iansan

| column | host                          | proposal       | conf. | why                                                                                                                                             | reason (user-facing)                                                              |
| ------ | ----------------------------- | -------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| C1     | Starting's Never Easy         | **notModeled** | low   | Energy per 6 Nightsoul points consumed; Nightsoul points untracked. Curator rationale leans on retired "windows not gauges" — could be missing. | We don't track Nightsoul points, so this Energy restoration has nothing to count. |
| C4     | Slow and Steady Wins the Race | **notModeled** | low   | Surging Force stacks feed Scale Nightsoul restoration; curator: "too removed from the schema". Nightsoul points untracked.                      | We don't track Nightsoul points, which is all this constellation changes.         |

### ifa

| column   | host                               | proposal       | conf.  | why                                                                                                                        | reason (user-facing)                                                                           |
| -------- | ---------------------------------- | -------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Q.grants | Compound Sedation Field            | **missing**    | medium | AUTHORED ELSEWHERE: `grouping` tag carries the pull; the absorbed-element Sedation Mark hit waits on the absorption round. |                                                                                                |
| C2       | Guiding Spirit of Ballistic Prayer | **notModeled** | low    | Rescue Essentials from party Nightsoul points above 60 + cap +50; A1 magnitude already an assumption. Could be missing.    | We don't track Nightsoul points or Rescue Essentials, which is all this constellation changes. |
| C6       | Oath on a Feathered Knot           | **notModeled** | high   | "there is a 50% chance" — coin flip, curator: never drawn at 100% (Ayaka C1 precedent).                                    | This extra shot has a 50% chance to fire, and we don't draw chance-based effects.              |

### illuga

| column   | host                    | proposal    | conf.  | why                                                                                                                                                | reason (user-facing) |
| -------- | ----------------------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Dawnbearing Songbird    | **missing** | high   | AUTHORED ELSEWHERE: Lightkeeper's Oath team buff is on the Torchforger's Covenant passive (onCast skill or burst); Aedon itself is a one-shot hit. |                      |
| A4       | Demonhunter's Dusk      | **missing** | medium | Nightingale's Song EM-scaled per-hit DMG add, party-count tiered; no Geo flat-DMG stat (curator). Could be notModeled.                             |                      |
| C2       | Elk With Fanged Antlers | **missing** | medium | Aedon strike per 7 Nightingale's Song consumed — damage proc w/ application; curator: needs a drain-threshold trigger, no ruling.                  |                      |

### ineffa

| column | host                 | proposal    | conf. | why                                                                                                                                            | reason (user-facing) |
| ------ | -------------------- | ----------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | Overclocking Circuit | **missing** | low   | Extra Lunar-Charged hit per Birgitta discharge while a thundercloud is up — conditional summon damage (likely Durability 0, a tick mark only). |                      |

### jahoda

| column | host                     | proposal       | conf.  | why                                                                                                                           | reason (user-facing)                                                            |
| ------ | ------------------------ | -------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A1     | Plan to Get Paid         | **missing**    | medium | Team-element-gated robot count/interval; the robots' damage series is unauthored (curator T1.5 note).                         |                                                                                 |
| A4     | Sweet Berry Bounty       | **missing**    | medium | "+100 EM for 6s" per robot heal on active >70% HP — needs a summon-tick buff collector (queued, cf. Yae C4); has a caveat.    |                                                                                 |
| C1     | One More Flask!          | **notModeled** | high   | "there is a 50% chance for it to bounce".                                                                                     | This bounce has a 50% chance to happen, and we don't draw chance-based effects. |
| C2     | Rogue's Quick Thinking   | **missing**    | medium | Second A1 robot enhancement under Moonsign — same gap as A1.                                                                  |                                                                                 |
| C4     | Wild Berry Amid the Dust | **missing**    | medium | "+4 Energy" on robot Elemental Conversion — absorption; the absorption survey names Jahoda's robots.                          |                                                                                 |
| C6     | The Littlest Luck        | **missing**    | medium | "When the flask is full" team CRIT 5%/40% 20s — flask/absorption untracked; curator refused an onCast stand-in. Has a caveat. |                                                                                 |

### jean

| column   | host                                     | proposal           | conf.  | why                                                                                                                    | reason (user-facing)                                                                                       |
| -------- | ---------------------------------------- | ------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| E.grants | Gale Blade                               | **missing**        | medium | AUTHORED ELSEWHERE: the Hold pull is the `grouping` tag; otherwise damage only.                                        |                                                                                                            |
| A4       | Let the Wind Lead                        | **missing**        | high   | "regenerate 20% of its Energy" — self energy onCast burst, 16 (energy has no planner reader).                          |                                                                                                            |
| C1       | Spiraling Tempest                        | **missing**        | medium | Held ≥1s: Gale Blade +40% DMG — self skillDmgBonus 40; needs a hold variant (none exists). Pull speed nothing to draw. |                                                                                                            |
| C2       | People's Aegis                           | **notModeled**     | high   | Curator: "Intentionally not authored … particle/orb pickup is out-of-scope"; grants Movement/ATK SPD (no stat).        | This triggers when Jean picks up Energy particles and grants Movement and ATK SPD, none of which we model. |
| C6       | Lion's Fang, Fair Protector of Mondstadt | **nothingToModel** | medium | "Incoming DMG is decreased by 35%" — damage reduction with no drawn stat; gcsim leaves it unimplemented.               |                                                                                                            |

### kachina

| column   | host                                     | proposal           | conf.  | why                                                                                                                             | reason (user-facing) |
| -------- | ---------------------------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Q.grants | Time to Get Serious!                     | **nothingToModel** | medium | Turbo Drill Field only enlarges Turbo Twirly's AoE and Movement SPD; damage otherwise. Field window is the Q duration.          |                      |
| A4       | The Weight of Stone                      | **missing**        | high   | AUTHORED ELSEWHERE: curator folded it into the skill summon's summonTick flatScaling {def, 20}.                                 |                      |
| C1       | Shards Are Gems Too                      | **missing**        | medium | "3 Energy restored … once every 5s" on shard pickup or Lunar-Crystallize — energy onReaction lunarCrystallize (+pickup approx). |                      |
| C2       | Never Leave Home Without... Turbo Twirly | **missing**        | medium | Burst regains 20 Nightsoul points and summons Turbo Twirly if absent — C2-gated summon on the burst.                            |                      |

### kaedehara_kazuha

| column   | host                 | proposal    | conf.  | why                                                                                                                        | reason (user-facing) |
| -------- | -------------------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Chihayaburu          | **missing** | medium | Midare Ranzan plunge "converted to Anemo DMG" unauthored (plungeVariants carry frames only); pull is the `grouping` tag.   |                      |
| A1       | Soumon Swordsmanship | **missing** | medium | Absorbed-element extra 200% plunge hit — waits on the elemental absorption round (rubric N13).                             |                      |
| C4       | Oozora Genpou        | **missing** | medium | Energy <45: E regenerates 3/4 Energy — self energy onCast skill (energy gate unresolvable); gliding regen nothing to draw. |                      |

### kaeya

| column   | host                     | proposal           | conf. | why                                                              | reason (user-facing)                                                                                   |
| -------- | ------------------------ | ------------------ | ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| E.grants | Frostgnaw                | **nothingToModel** | high  | "dealing Cryo DMG" — damage only (A4 particles on its own host). |                                                                                                        |
| A4       | Glacial Heart            | **notModeled**     | high  | "drop additional Elemental Particles" — particle generation.     | We don't model Energy particles.                                                                       |
| C2       | Never-Ending Performance | **notModeled**     | high  | "for each opponent defeated, its duration is increased".         | This extends the burst only when an opponent is defeated, and we don't model opponents being defeated. |

### kamisato_ayaka

| column   | host                              | proposal           | conf.  | why                                                                                                                                               | reason (user-facing)                                                                  |
| -------- | --------------------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| E.grants | Kamisato Art: Hyouka              | **nothingToModel** | high   | "dealing AoE Cryo DMG" — damage only (A1 lives on its own host).                                                                                  |                                                                                       |
| A1       | Amatsumi Kunitsumi Sanctification | **missing**        | high   | "Normal and Charged Attacks deal 30% increased DMG for 6s" after E — self normal+chargeDmgBonus 30, onCast skill.                                 |                                                                                       |
| A4       | Kanten Senmyou Blessing           | **missing**        | medium | Senho dash Cryo hit → cryoDmgBonus 18 for 10s; curator: needs a dash-hit trigger, "not a DEFER" but no out-of-scope ruling. Stamina part nothing. |                                                                                       |
| C1       | Snowswept Sakura                  | **notModeled**     | high   | "has a 50% chance of decreasing the CD" — the named Ayaka C1 precedent.                                                                           | This has a 50% chance to reduce the cooldown, and we don't draw chance-based effects. |
| C2       | Blizzard Blade Seki no To         | **missing**        | medium | 2 extra storms at 20% DMG — C2-gated extra application[] on the burst (Cryo hits).                                                                |                                                                                       |
| C6       | Dance of Suigetsu                 | **missing**        | medium | Usurahi Butou every 10s: chargeDmgBonus 298, cleared 0.5s after a CA hit — a recurring self state consumed by onHit charged.                      |                                                                                       |

### kamisato_ayato

| column | host                                    | proposal       | conf.  | why                                                                                                                        | reason (user-facing)                                                      |
| ------ | --------------------------------------- | -------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A1     | Kamisato Art: Mine Wo Matoishi Kiyotaki | **missing**    | medium | Namisen +2 stacks on E, max on illusion explosion — gainStacks; depends on the unauthored Namisen resource.                |                                                                           |
| A4     | Kamisato Art: Michiyuku Hagetsu         | **missing**    | low    | "If … not on the field and his Energy is less than 40, regenerate 2 Energy every second" — periodic off-field energy.      |                                                                           |
| C2     | World Source                            | **missing**    | medium | Namisen cap 5 + hp% 50 at ≥3 stacks — stacks-gated self buff; depends on Namisen.                                          |                                                                           |
| C4     | Endless Flow                            | **notModeled** | high   | Curator retired: NA SPD, "⛔ Do not mint an atkSpd Stat"; attack speed is out of scope.                                    | We don't model attack speed, so this Normal Attack SPD bonus isn't shown. |
| C6     | Boundless Origin                        | **missing**    | medium | Two 450% Hydro strikes on the first Shunsuiken hit after E; curator: stack-resource shape works, "no round has queued it". |                                                                           |

### kaveh

| column   | host                 | proposal       | conf.  | why                                                                                                                                   | reason (user-facing)                                                      |
| -------- | -------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| E.grants | Artistic Ingenuity   | **notModeled** | low    | Bursts Dendro Cores in its AoE — core damage/bloom explosion are gauge non-goals; otherwise damage only. Could be nothingToModel.     | We don't model this skill bursting Dendro Cores early.                    |
| C1       | Sublime Salutations  | **missing**    | high   | "Dendro RES and Incoming Healing Bonus increased by 50% and 25%" for 3s after E — self dendroRes + incomingHealingBonus onCast skill. |                                                                           |
| C2       | Grace of Royal Roads | **notModeled** | high   | "Normal Attack SPD increases by 15%" — attack speed.                                                                                  | We don't model attack speed, so this Normal Attack SPD bonus isn't shown. |
| C4       | Feast of Apadana     | **missing**    | medium | Cores he triggers deal 60% more DMG — self bloomReactionBonus + lunarBloomReactionBonus 60 (passive).                                 |                                                                           |

### keqing

| column   | host                        | proposal           | conf.  | why                                                                                                                                           | reason (user-facing)                                                                      |
| -------- | --------------------------- | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| E.grants | Stellar Restoration         | **missing**        | medium | AUTHORED ELSEWHERE: the Stiletto window is this host's chainStage condition (5.33s) routing the recast; CA-consumes-Stiletto cuts unauthored. |                                                                                           |
| E.grants | Stellar Restoration (Blink) | **nothingToModel** | high   | Blink slash "deals AoE Electro DMG" — damage only (A1/C1 on their hosts).                                                                     |                                                                                           |
| Q.grants | Starward Sword              | **nothingToModel** | high   | "multiple instances of Electro DMG" — damage only.                                                                                            |                                                                                           |
| A1       | Thundering Penance          | **missing**        | high   | "Electro Infusion for 5s" after the recast — infuse self electro onCast skill (recast, chainStage 1), 5.33s.                                  |                                                                                           |
| C1       | Thundering Might            | **missing**        | medium | Two 50% Electro hits (1U, f3/f16) on the recast — C1-gated extra application[] (variant); damage alone reaches nothing.                       |                                                                                           |
| C2       | Keen Extraction             | **notModeled**     | high   | "50% chance of producing an Elemental Particle" — chance + particles.                                                                         | This has a 50% chance to produce an Energy particle, and we don't model Energy particles. |
| C4       | Attunement                  | **missing**        | high   | "ATK increased by 25%" 10s after an Electro reaction — self atk% onReaction (Electro reactions), 10s.                                         |                                                                                           |

### kinich

| column   | host                    | proposal           | conf.  | why                                                                                                                      | reason (user-facing)                                                                                                                                  |
| -------- | ----------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| E.grants | Scalespiker Cannon      | **nothingToModel** | high   | Cannon "Dendro DMG" — damage only (A4 flat DMG and C1 CRIT on their hosts).                                              |                                                                                                                                                       |
| A1       | The Price of Desolation | **notModeled**     | low    | "restore 7 Nightsoul points" — curator: "Pure Nightsoul resource flow — not modelled" (constitution rationale is stale). | We don't track Nightsoul points, which is all this passive restores.                                                                                  |
| C1       | Parrot's Beak           | **notModeled**     | medium | Curator: Cannon-only CRIT DMG, "no per-ability-scoped buff primitive"; placeholder removed. Movement SPD nothing.        | This CRIT DMG bonus applies only to Scalespiker Cannon, and we don't show CRIT bonuses limited to a single attack. Movement SPD isn't modeled either. |

### kirara

| column | host                          | proposal       | conf.  | why                                                                                                               | reason (user-facing)                                                      |
| ------ | ----------------------------- | -------------- | ------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A1     | Bewitching, Betwitching Tails | **missing**    | medium | Reinforced Packaging stacks per box-mode hit → shields on exit — gainStacks + a stack-scaled shield at state end. |                                                                           |
| A4     | Pupillary Variance            | **missing**    | high   | HP-scaled E +0.4%/Q +0.3% per 1,000 HP — passive self skillDmgBonus/burstDmgBonus, scaling hp.                    |                                                                           |
| C1     | Material Circulation          | **missing**    | low    | Extra Cat Grass Cardamoms per 8,000 Max HP (cap 4) — more burst hits/Dendro application; HP-dependent count.      |                                                                           |
| C2     | Perfectly Packaged            | **notModeled** | high   | gcsim: "C2 is not implemented, co-op only" — Kirara C2 is the house co-op form (CLAUDE.md).                       | We don't model co-op: these shields only go to other players' characters. |

### klee

| column   | host              | proposal    | conf.  | why                                                                                                                                                     | reason (user-facing) |
| -------- | ----------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Jumpy Dumpty      | **missing** | medium | Mines left on the third bounce explode later (Pyro) — not in summons[]; curator: needs verified spawn/delay timing.                                     |                      |
| A1       | Pounding Surprise | **missing** | medium | Explosive Spark (current patch: E/Q grant 1 each, max 3) consumed by next CA +50% DMG — gainStacks/consumeStacks + chargeDmgBonus; 50% procs not drawn. |                      |
| C4       | Sparkly Explosion | **missing** | medium | Swap-out explosion 555% Pyro 2U during burst — curator: onSwapOut has no character reader; a trigger gap, not a ruling.                                 |                      |

### kujou_sara

| column | host             | proposal    | conf.  | why                                                                                                                      | reason (user-facing) |
| ------ | ---------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| A1     | Immovable Will   | **missing** | medium | "Aimed Shot charge times decreased by 60%" in Crowfeather Cover — charged-frames variant gated on the Crowfeather state. |                      |
| A4     | Decorum          | **missing** | high   | "restore 1.2 Energy to all party members" per 100% ER on Ambush hit, 3s ICD — team energy onHit (TB battery).            |                      |
| C4     | Conclusive Proof | **missing** | medium | "Stormcluster … increased to 6" — C4-gated extra Stormcluster hits/application on the burst.                             |                      |

### kuki_shinobu

| column | host                   | proposal           | conf. | why                                                                                                   | reason (user-facing) |
| ------ | ---------------------- | ------------------ | ----- | ----------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | Breaking Free          | **missing**        | high  | "HP not higher than 50%, Healing Bonus increased by 15%" — passive self healingBonus, selfHpBelow 50. |                      |
| C1     | To Cloister Compassion | **nothingToModel** | high  | "AoE is increased by 50%" — area only.                                                                |                      |

### lan_yan

| column   | host                                       | proposal           | conf.  | why                                                                                                                                                      | reason (user-facing) |
| -------- | ------------------------------------------ | ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Feathermoon Ring (N follow-up)             | **nothingToModel** | high   | Feathermoon Ring "three Anemo hits" — damage only (A1/A4/C1 on their hosts).                                                                             |                      |
| E.grants | Feathermoon Ring (E follow-up)             | **nothingToModel** | high   | Same rings via E — damage only.                                                                                                                          |                      |
| Q.grants | Lustrous Moonrise                          | **missing**        | medium | AUTHORED ELSEWHERE: the pull is the `grouping` tag; C4's EM buff is on the C4 host; otherwise damage only.                                               |                      |
| A1       | Four Sealing Divination Charms             | **missing**        | medium | Shield Elemental Absorption + absorbed-element ring hits — waits on the elemental absorption round.                                                      |                      |
| A4       | Skyfeather Evil-Subduing Charm             | **missing**        | high   | E and Q DMG + 309%/774% of EM — flat-DMG add-on: passive self skillFlatDmg + burstFlatDmg, scaling em (curator's "never drawn" predates the house form). |                      |
| C1       | "As One Might Stride Betwixt the Clouds"   | **missing**        | medium | Extra Feathermoon Ring after A1 absorption — waits on the elemental absorption round.                                                                    |                      |
| C2       | "Dance Vestments Billow Like Rainbow Jade" | **nothingToModel** | high   | Restores shield absorption; curator: "the shield lane draws a span, not an absorption value, so there is no pixel".                                      |                      |

### lauma

| column | host                       | proposal    | conf.  | why                                                                                                                          | reason (user-facing) |
| ------ | -------------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | Light for the Frosty Night | **missing** | low    | 20s after E: Moonsign-tiered reaction CRIT (Bloom family / Lunar-Bloom) — needs reaction-CRIT stats; team onCast skill.      |                      |
| A4     | Cleansing for the Spring   | **missing** | medium | EM-scaled skillDmgBonus (cap 32%) authorable; the Spirit Envoy CD cut is a caveat by Nate's ruling (CLAUDE.md, Lauma round). |                      |

### layla

| column | host                | proposal           | conf.  | why                                                                                                                                           | reason (user-facing)                                                           |
| ------ | ------------------- | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A1     | Like Nascent Light  | **nothingToModel** | medium | "Shield Strength … increases by 6%" per Night Star — absorption size, no drawn stat (shield bars are spans).                                  |                                                                                |
| C1     | Fortress of Fantasy | **notModeled**     | medium | +20% absorption (nothing drawn) + a shield for party members "not being protected by a Curtain" — only other players' characters in practice. | We don't model co-op: this extra shield only covers other players' characters. |
| C2     | Light's Remit       | **missing**        | medium | "restore 1 Energy" per Shooting Star hit — Shooting Stars/Night Stars unauthored (curator: no event to anchor).                               |                                                                                |
| C4     | Starry Illumination | **missing**        | medium | Curator retired: Dawn Star N/CA flat DMG (team, 3s) needs the Night Star counter; "not a DEFER" but no ruling.                                |                                                                                |
| C6     | Radiant Soulfire    | **missing**        | medium | Night Star interval −20% + Shooting Star/Slug DMG +40% — Shooting Star series unauthored.                                                     |                                                                                |

### linnea

| column | host                      | proposal    | conf.  | why                                                                                                                  | reason (user-facing) |
| ------ | ------------------------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------- | -------------------- |
| C2     | Tidings of Joy and Sorrow | **missing** | medium | Hydro/Geo team CRIT DMG 40% 8s after Moondrift Harmony — waits on Lumi/Moondrift modelling (in-game counts pending). |                      |
| C4     | Expert Instinct           | **missing** | medium | DEF +25% self and active 5s after Moondrift Harmony — same Moondrift gap.                                            |                      |

### lisa

| column   | host                  | proposal           | conf.  | why                                                                                               | reason (user-facing)                                                                               |
| -------- | --------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| E.grants | Violet Arc            | **nothingToModel** | medium | Conductive stacks only scale the Hold E's damage — damage math, nothing drawn.                    |                                                                                                    |
| A1       | Induced Aftershock    | **nothingToModel** | medium | CA applies Conductive — only feeds Hold E damage.                                                 |                                                                                                    |
| C2       | Electromagnetic Field | **missing**        | medium | Hold E: "Increases DEF by 25%" (~2.1s) — self def% onCast Hold variant; interruption RES nothing. |                                                                                                    |
| C4       | Plasma Eruption       | **notModeled**     | low    | Random 1–3 bolts, spread across opponents; unsure — could be nothingToModel on one target.        | Lightning Rose's bolt count is random and spread across opponents, and we model a single opponent. |
| C6       | Pulsating Witch       | **nothingToModel** | medium | Conductive on swap-in — only feeds Hold E damage.                                                 |                                                                                                    |

### lohen

| column   | host                                         | proposal       | conf.  | why                                                                                                                                  | reason (user-facing)                                                 |
| -------- | -------------------------------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Q.grants | Manifest Judgment                            | **missing**    | high   | AUTHORED ELSEWHERE: Secret Rite buff in factionBonuses (Burst-triggered) + Masterstroke extension as the skill's durationExtensions. |                                                                      |
| A1       | Moratorium on Questioning                    | **notModeled** | low    | Extra Will to Win accrual; curator: "internal on-field-DPS resource … not modeled".                                                  | We don't track Will to Win, which is all this passive changes.       |
| C1       | O Breezes, That So Oft Bear Sorrowful Lament | **notModeled** | low    | Will to Win cap ×3, teammate accrual ×5; resource untracked (curator).                                                               | We don't track Will to Win, which is all this constellation changes. |
| C4       | Radiant Love, Laughing Death                 | **missing**    | medium | "recovers 15 Elemental Energy" on entering Masterstroke — self energy onCast skill (Will to Win half untracked).                     |                                                                      |

### lynette

| column | host                       | proposal    | conf.  | why                                                                                                                | reason (user-facing) |
| ------ | -------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------ | -------------------- |
| A1     | Sophisticated Synergy      | **missing** | high   | "ATK increased by 8%/12%/16%/20%" by party element types, 10s after Q — team atk% onCast burst, tiered conditions. |                      |
| A4     | Props Positively Prepped   | **missing** | medium | Burst +15% DMG after the Box's Elemental Conversion — waits on the elemental absorption round.                     |                      |
| C1     | A Cold Blade Like a Shadow | **missing** | medium | Vortex pulls opponents — a `grouping` tag on this host (TB facet; constellations accept tags).                     |                      |
| C2     | Endless Mysteries          | **missing** | medium | Extra Vivid Shot per Vivid Shot — Vivid Shots follow the Box's absorption; waits on that round.                    |                      |

### lyney

| column | host                 | proposal    | conf.  | why                                                                                                                                   | reason (user-facing) |
| ------ | -------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | Perilous Performance | **missing** | medium | "Hat... restore 3 Energy... increase DMG": +3 Energy per Hat hit; Prop Arrow Hat summon itself unauthored (no summons on chargeHits). |                      |
| A4     | Conclusive Ovation   | **missing** | high   | "DMG... to opponents affected by Pyro" +60–100%: passive allDmgBonus, enemyAffectedBy pyro + teamElementCount pyro tiers.             |                      |
| C1     | Whimsical Wonders    | **missing** | medium | "2 Grin-Malkin Hats... extra Prop Surplus": second Hat summon + stack; blocked on unauthored Prop Arrow Hat.                          |                      |
| C2     | Loquacious Cajoling  | **missing** | medium | "Crisp Focus every 2s... CRIT DMG 20%" max 3: ramping critDmg per on-field segment; no segment-start buff anchor (note).              |                      |
| C6     | Guarded Smile        | **missing** | high   | "fire a Pyrotechnic Strike: Reprised" on Prop Arrow: damage proc with Pyro application, onHit charged Prop Arrow.                     |                      |

### mavuika

| column | host                 | proposal    | conf. | why                                                                                                                                       | reason (user-facing) |
| ------ | -------------------- | ----------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| C4     | The Leader's Resolve | **missing** | high  | "will not decay... additional 10% DMG Bonus": modifies authored Kiongozi allDmgBonus onCast — constellation-gated value/no-decay variant. |                      |

### mika

| column   | host                  | proposal       | conf.  | why                                                                                                                                              | reason (user-facing)                                                                                                                                          |
| -------- | --------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E.grants | Starfrost Swirl       | **notModeled** | high   | "their ATK SPD will be increased": only grant is ATK SPD; no stat, rubric lists attack-speed out of scope; caveat present.                       | We don't model attack speed, so Soulwind's ATK SPD bonus isn't drawn.                                                                                         |
| A1       | Suppressive Barrage   | **notModeled** | low    | Physical DMG +10%/stack; curator: "Doubly unmodelable" (no physical stat, multi-enemy stack gain). Could be missing if a physical stat is added. | Detector stacks mostly come from hitting several opponents at once, and we model a single target. There's also no Physical DMG bonus among the stats we draw. |
| A4       | Topographical Mapping | **missing**    | low    | "scores a CRIT Hit... 1 stack of Detector": CRIT-triggered Detector stack + cap +1; depends on A1 Physical DMG stat. Crit trigger unexpressible. |                                                                                                                                                               |
| C1       | Factor Confluence     | **missing**    | medium | "decrease the healing interval" of Eagleplume by Soulwind's ATK SPD %: conditional heal-tick cadence (second series under Soulwind).             |                                                                                                                                                               |
| C2       | Companion's Ingress   | **missing**    | low    | "Flowfrost Arrow first hits... 1 Detector stack": gainStacks onHit skill; value only reaches Physical DMG (no stat) — tied to A1 fate.           |                                                                                                                                                               |
| C4       | Sunfrost Encomium     | **notModeled** | high   | "When... Eagleplume state heals party members, this will restore 3 Energy": onHeal trigger has no reader.                                        | We don't track healing as a trigger, so the Energy Eagleplume's heals restore isn't drawn.                                                                    |
| C6       | Companion's Counsel   | **missing**    | medium | "deal 60% more Physical CRIT DMG" in Soulwind: active-target critDmg onCast skill 12s, physical-only — no physical-scoped CRIT stat.             |                                                                                                                                                               |

### mona

| column | host                    | proposal    | conf.  | why                                                                                                                                         | reason (user-facing) |
| ------ | ----------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | "Come 'n' Get Me, Hag!" | **missing** | medium | "After... Illusory Torrent for 2s... create a Phantom": dash-duration-triggered Phantom damage + Hydro application; no dash trigger.        |                      |
| C1     | Prophecy of Submersion  | **missing** | medium | Reaction bonuses +15% 8s on Omen hit: electroCharged/lunarCharged/lunarCrystallizeReactionBonus team; blocked by enemy-Omen trigger (note). |                      |
| C6     | Rhetorics of Calamitas  | **missing** | medium | "+60% DMG of next Charged Attack per second of movement": ramping chargeDmgBonus; needs a dash-opened state (note).                         |                      |

### mualani

| column   | host                              | proposal           | conf.  | why                                                                                                                                                                     | reason (user-facing)                                                                                                                                                    |
| -------- | --------------------------------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q.grants | Boomsharka-laka                   | **nothingToModel** | high   | "Fires a Super Shark Missile... dealing... Hydro DMG": damage only; A4 bonus lives on its own host.                                                                     |                                                                                                                                                                         |
| A1       | Heat-Resistant Freshwater Floater | **notModeled**     | medium | "restore 20 Nightsoul points when she picks up a Puffer": pickup-driven; rubric out-of-scope list (pickups). Could be a stance extension if Nate prefers.               | Puffers are pickups, and we don't model picking things up, so the Nightsoul points they restore don't lengthen her Nightsoul's Blessing bar.                            |
| A4       | Natlan's Greatest Guide           | **notModeled**     | low    | "increase the DMG of this Boomsharka-laka by 15%/30%/45% of her Max HP": curator retired as "damage magnitude with no pixel". Could be burstFlatDmg perStack (missing). | These stacks only raise the damage of Boomsharka-laka, and the planner doesn't show damage amounts.                                                                     |
| C1       | The Leisurely "Meztli"...         | **notModeled**     | medium | "first Sharky's Surging Bite... increased by 66% of Max HP": single-hit add-on, retired "damage magnitude, no pixel".                                                   | This raises the damage of her first Sharky's Surging Bite, and the planner doesn't show damage amounts. The out-of-combat Nightsoul saving doesn't apply in a rotation. |
| C2       | Mualani, Going All Out!           | **missing**        | medium | "gains 2... Wave Momentum stacks when she enters Nightsoul's Blessing": gainStacks onCast skill; stacks gate the Surging Bite variant.                                  |                                                                                                                                                                         |
| C6       | Spirit of the Springs' People     | **notModeled**     | medium | "no longer limited to... once every Nightsoul's Blessing": modifier on C1, which is damage magnitude only.                                                              | This lets C1's extra damage apply to every Surging Bite, and the planner doesn't show damage amounts.                                                                   |

### nahida

| column | host                              | proposal    | conf. | why                                                                                                                                               | reason (user-facing) |
| ------ | --------------------------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| C6     | The Fruit of Reason's Culmination | **missing** | high  | Karmic Oblivion coordinated Dendro damage on N/CA: onHit proc w/ application on burst; blocked only on procCap per:"cast" (note gives full spec). |                      |

### navia

| column   | host                                            | proposal           | conf.  | why                                                                                                                                               | reason (user-facing)                                                                        |
| -------- | ----------------------------------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| E.grants | Ceremonial Crystalshot                          | **nothingToModel** | medium | Crystal Shrapnel only scales shot count/DMG of this cast; Surging Blade is Durability 0. Shrapnel's C1 effects live on C1.                        |                                                                                             |
| C1       | A Lady's Rules for Keeping a Courteous Distance | **missing**        | high   | "restore 3 Energy... decrease the CD of [burst] by 1s" per shrapnel: cooldownReduce burst + energy; needs Crystal Shrapnel stack source.          |                                                                                             |
| C2       | The President's Pursuit of Victory              | **missing**        | medium | "one Cannon Fire Support shot" on E hit: burst-DMG proc with Geo application. CRIT Rate half ruled no honest bar (note).                          |                                                                                             |
| C6       | The Flexible Finesse of the Spina's President   | **notModeled**     | medium | "increases the CRIT DMG of that Ceremonial Crystalshot by 45%": cast-snapshot CRIT, curator ruled no honest bar; shrapnel return also unmodelled. | This raises CRIT DMG for a single Crystalshot, and the planner doesn't show damage amounts. |

### nefer

| column   | host                            | proposal    | conf.  | why                                                                                                                             | reason (user-facing) |
| -------- | ------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Q.grants | Sacred Vow: True Eye's Phantasm | **missing** | low    | Veil consumption boosts this burst's DMG (magnitude); consumeStacks of Veil only matters once A1/C2 Veil stacks exist.          |                      |
| A1       | A Wager of Moonlight            | **missing** | high   | "Veil of Falsehood... 3 stacks... EM increased by 100 for 8s": onStack/perStack em self buff; seed conversion unexpressible.    |                      |
| A4       | Daughter of the Dust and Sand   | **missing** | medium | Verdant Dew rate (resource) + Lunar-Bloom base DMG +0.0175%/EM, max 14%: elevate/lunarBloom base-DMG scaling like Flins/Ineffa. |                      |
| C1       | Planning Breeds Success         | **missing** | medium | "Base DMG for Lunar-Bloom... by Phantasm Performance... +60% EM": scoped base-DMG add; Phantasm Performance unmodelled.         |                      |
| C2       | Observation Feeds Strategy      | **missing** | high   | Veil max 5, +5s, 2 Veils on E, "+200 EM for 8s" at 5 stacks: gainStacks onCast skill + threshold EM buff.                       |                      |

### neuvillette

| column   | host                     | proposal       | conf.  | why                                                                                                               | reason (user-facing)                                                                                                                                                           |
| -------- | ------------------------ | -------------- | ------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E.grants | O Tears, I Shall Repay   | **notModeled** | high   | Only non-damage output is "generate 3 Sourcewater Droplets"; rubric out-of-scope: pickups (Neuvillette droplets). | Sourcewater Droplets are pickups, and we don't model picking them up.                                                                                                          |
| Q.grants | O Tides, I Have Returned | **notModeled** | high   | Only non-damage output is "generate 6 Sourcewater Droplets"; pickups out of scope.                                | Sourcewater Droplets are pickups, and we don't model picking them up.                                                                                                          |
| C2       | Juridical Exhortation    | **notModeled** | high   | "CRIT DMG of Charged Attack: Equitable Judgment by 14%": curator "The stub IS the final state".                   | This raises the CRIT DMG of Equitable Judgment alone, and the planner doesn't show damage amounts.                                                                             |
| C4       | Crown of Commiseration   | **notModeled** | high   | "When Neuvillette is... healed, 1 Sourcewater Droplet": onHeal + pickup; curator "The stub IS the final state".   | This spawns a Sourcewater Droplet when Neuvillette is healed, and we don't track healing as a trigger or model droplet pickups.                                                |
| C6       | Wrathful Recompense      | **notModeled** | medium | Droplet absorption extends EJ; extra currents; curator "The stub IS the final state".                             | Absorbed droplets lengthen Equitable Judgment, and we don't model droplet pickups. The extra currents are part of Equitable Judgment's damage, which the planner doesn't show. |

### nilou

| column   | host                                                 | proposal           | conf.  | why                                                                                                                           | reason (user-facing) |
| -------- | ---------------------------------------------------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Whirling Steps 1                                     | **nothingToModel** | high   | "Single Hydro hit at frame 21": damage only (application authored).                                                           |                      |
| E.grants | Whirling Steps 2                                     | **nothingToModel** | high   | "Single Hydro hit at frame 29": damage only.                                                                                  |                      |
| E.grants | Water Wheel (Whirling Steps 3)                       | **missing**        | medium | AUTHORED ELSEWHERE: Tranquility Aura summon authored on base E dance_of_haftkarsvar (per note); WS3's own hit is damage only. |                      |
| Q.grants | Dance of Abzendegi: Distant Dreams, Listening Spring | **nothingToModel** | high   | Lingering Aeon delayed hit is already in application[] (frame 212); otherwise damage only.                                    |                      |
| A4       | Dreamy Dance of Aeons                                | **missing**        | medium | Bountiful Core DMG +9% per 1,000 HP over 30k, cap 400%: bloom-family ReactionBonus scaling hp with offset, team.              |                      |

### ningguang

| column   | host                                          | proposal           | conf.  | why                                                                                                                         | reason (user-facing) |
| -------- | --------------------------------------------- | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Q.grants | Starshatter                                   | **nothingToModel** | high   | "homing projectiles... Geo DMG"; Jade Screen extra gems are damage only.                                                    |                      |
| A1       | Backup Plan                                   | **nothingToModel** | high   | "her Charged Attack does not consume Stamina".                                                                              |                      |
| C1       | Piercing Fragments                            | **nothingToModel** | high   | "When a Normal Attack hits, it deals AoE DMG": hitbox size only; single target.                                             |                      |
| C2       | Shock Effect                                  | **missing**        | medium | "When Jade Screen is shattered, its CD will reset" (6s ICD): cdReset skill onCast burst (Starshatter shatters the Screen).  |                      |
| C4       | Exquisite be the Jade, Outshining All Beneath | **missing**        | medium | "Jade Screen increases nearby characters' Elemental RES by 10%": allElementalRes team buff for Jade Screen summon lifetime. |                      |
| C6       | Grandeur Be the Seven Stars                   | **missing**        | low    | "Starshatter... gains 7 Star Jades": jade stacks feed extra CA Geo projectiles; Star Jades unmodelled anywhere.             |                      |

### noelle

| column   | host            | proposal    | conf.  | why                                                                                                                             | reason (user-facing) |
| -------- | --------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Q.grants | Sweeping Time   | **missing** | high   | "Increased ATK... based on her DEF" + Geo infusion: self atk buff scaling def onCast burst ~15s + infusion; effects empty.      |                      |
| A4       | Nice and Clean  | **missing** | high   | "decrease the CD of Breastplate by 1s for every 4... hits": cooldownReduce onHit normal/charged (0.25s/hit or stack threshold). |                      |
| C1       | I Got Your Back | **missing** | medium | "chance of Breastplate's healing... increased to 100%" during burst: heal onHit certainty while burst active.                   |                      |
| C2       | Combat Maid     | **missing** | high   | "Charged Attack DMG by 15%": passive chargeDmgBonus 15; stamina half is nothing.                                                |                      |

### odette

| column   | host                           | proposal           | conf. | why                                                                                                                  | reason (user-facing) |
| -------- | ------------------------------ | ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Adagio: Coda at Dawn's Tolling | **nothingToModel** | high  | Coda deals Cryo DMG then Stellar-Conduct finisher; Dance Double extra damage is magnitude only (note: "no surface"). |                      |

### ororon

| column | host                         | proposal       | conf.  | why                                                                                                                                                  | reason (user-facing)                                                                                                                       |
| ------ | ---------------------------- | -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A1     | Nightshade Synesthesia       | **missing**    | medium | AUTHORED ELSEWHERE: Hypersense proc moved to ororon**skill**nights_sling.effects[0]. Remaining: Nightsoul point pool + 6s Blessing, unauthored.      |                                                                                                                                            |
| A4     | Aspect Catalyst              | **missing**    | medium | "active party member... restore 3 Energy", 1s ICD, 3 per window: energy onHit N/C/P; note says no energy surface.                                    |                                                                                                                                            |
| C1     | Trails Amidst the Forest Fog | **notModeled** | medium | "+2 bounces" (multi-target) and Nighttide "+50% Hypersense DMG" (magnitude); curator "Description-only".                                             | The extra bounces need more than one opponent, and Nighttide only raises Hypersense's damage, and the planner doesn't show damage amounts. |
| C6     | Ode to Deep Springs          | **missing**    | high   | "active character's ATK is increased by 10% for 9s" per Hypersense + Q free Hypersense (damage+Electro): proc-triggered stacks, onCast burst damage. |                                                                                                                                            |

### prune

| column   | host                              | proposal    | conf.  | why                                                                                                                                  | reason (user-facing) |
| -------- | --------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| E.grants | Ring-A-Ding-Ding! Hexhunter Chime | **missing** | medium | Clang Clang converted hammer (6s after Swirl, element of swirl) is a state window/variant; unmodelled. Tolling Rally caveat present. |                      |

### qiqi

| column | host                   | proposal       | conf.  | why                                                                                                                | reason (user-facing)                                                                                                                  |
| ------ | ---------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| A4     | A Glimpse Into Arcanum | **notModeled** | high   | "has a 50% chance to apply a Fortune-Preserving Talisman": low-probability proc class.                             | Applying the Talisman this way is a 50% chance, and we don't draw random procs as if they always happen.                              |
| C1     | Ascetics of Frost      | **missing**    | medium | "Herald of Frost hits... Talisman... regenerates 2 Energy": energy on summon hit; Herald damage series unauthored. |                                                                                                                                       |
| C4     | Divine Suppression     | **notModeled** | medium | Enemy ATK -20% + lowest-HP heal; curator: "takes the Kirara-C2 / Nicole-C2 house form".                            | We don't model the opponent's ATK, and the extra heal goes to whichever party member has the lowest HP, which the planner can't know. |

### raiden_shogun

| column | host                | proposal       | conf. | why                                                                                                      | reason (user-facing)                                                                                                                                       |
| ------ | ------------------- | -------------- | ----- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1     | Wishes Unnumbered   | **notModeled** | high  | "gain Elemental Orbs or Particles, Chakra Desiderata gains 2 Resolve": pickup-driven + damage magnitude. | Resolve only raises the burst's damage, and the planner doesn't show damage amounts. It also comes from picking up Energy particles, which we don't model. |
| C1     | Ominous Inscription | **notModeled** | high  | "Resolve gained is increased by 80%": Resolve is damage magnitude only (Q caveat removed as invisible).  | Resolve only raises the burst's damage, and the planner doesn't show damage amounts.                                                                       |
| C2     | Steelbreaker        | **missing**    | high  | "ignore 60% of opponents' DEF" in Musou Isshin: self defIgnore 60, onCast burst, whileState inStance.    |                                                                                                                                                            |

### razor

| column   | host             | proposal       | conf.  | why                                                                                                                                             | reason (user-facing)                                                                        |
| -------- | ---------------- | -------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| E.grants | Claw and Thunder | **missing**    | high   | Electro Sigil "increases his Energy Recharge": energyRecharge perStack (20%/sigil, max 3, 18s) gainStacks onHit skill; hold converts to Energy. |                                                                                             |
| Q.grants | Lightning Fang   | **missing**    | high   | Wolf Within 15s: electroRes buff, coordinated Electro strikes with normals (whileNormalAttacking/proc), energy return. effects empty.           |                                                                                             |
| A1       | Awakening        | **missing**    | high   | "Decreases Claw and Thunder's CD by 18%... Lightning Fang resets the CD": cooldownModifier percent + cdReset onCast burst.                      |                                                                                             |
| A4       | Hunger           | **missing**    | medium | "Energy is below 50%, increases Energy Recharge by 30%": energyRecharge self passive; no energy condition exists.                               |                                                                                             |
| C1       | Wolf's Instinct  | **notModeled** | high   | "Picking up an Elemental Orb or Particle increases... DMG by 10%": pickup-driven.                                                               | This triggers on picking up Elemental Orbs or Particles, and we don't model energy pickups. |

### rosaria

| column   | host                | proposal           | conf.  | why                                                                                                                                 | reason (user-facing) |
| -------- | ------------------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Ravaging Confession | **nothingToModel** | high   | "stabs and slashes them... dealing Cryo DMG": damage only.                                                                          |                      |
| C1       | Unholy Revelation   | **missing**        | low    | "CRIT Hit... Normal Attack DMG increases by 10% for 4s": normalDmgBonus onHit; CRIT trigger has no condition; ATK SPD half no stat. |                      |
| C4       | Painful Grace       | **missing**        | medium | "CRIT Hits regenerate 5 Energy" once per E: energy onHit skill; CRIT gate unexpressible.                                            |                      |

### sandrone

| column   | host                                      | proposal           | conf.  | why                                                                                                                           | reason (user-facing)                                                                                                                       |
| -------- | ----------------------------------------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Q.grants | Formule Phenomenale: Q.E.D.               | **nothingToModel** | high   | Cannons + Convective Inhibition Ray deal Cryo DMG; Radiance changes damage type only.                                         |                                                                                                                                            |
| A1       | Eternal Speculation Engine                | **notModeled**     | high   | "deal 400% of its original DMG" / ray "100% + stacks × 10%"; curator "not modeled", "Left unauthored".                        | Both effects raise damage, on Fagio's second Prism Shot and on the Convective Inhibition Ray, and the planner doesn't show damage amounts. |
| C2       | An Heiress Gazed Into the Looking-Glass   | **notModeled**     | high   | "Increases CRIT DMG from Charged Attack condensed beams by 40%"; curator "C2 NOT modeled (self-only)".                        | This raises CRIT DMG on Fagio's condensed beams, and the planner doesn't show damage amounts.                                              |
| C4       | In Knowledge Lies the World's True Ground | **notModeled**     | medium | Extra cannon Cryo coordinated attack, 4s ICD; curator "NOT modeled... damage magnitude". Could be missing if it applies Cryo. | The extra cannon attack is damage that follows Sandrone's own Stellar Glimmer hits, and the planner doesn't show damage amounts.           |

### sangonomiya_kokomi

| column | host                          | proposal    | conf.  | why                                                                                                                  | reason (user-facing) |
| ------ | ----------------------------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | Tamakushi Casket              | **missing** | high   | "Bake-Kurage's duration will be refreshed" on burst: summon durationExtension/refresh onCast burst.                  |                      |
| C4     | The Moon Overlooks the Waters | **missing** | medium | Normal ATK SPD +10% (no stat) and "Normal Attacks... restore 0.8 Energy" 0.2s ICD during burst: energy onHit normal. |                      |

### sayu

| column   | host                      | proposal       | conf.  | why                                                                                                                                | reason (user-facing)                                                                             |
| -------- | ------------------------- | -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| E.grants | Yoohoo Art: Fuuin Dash    | **missing**    | medium | Hold E Elemental Absorption (extra elemental DMG) — waits on the absorption round; rest is damage/interruption res.                |                                                                                                  |
| A1       | Someone More Capable      | **missing**    | high   | "triggers a Swirl... while active, she heals all your characters" 300+1.2×EM, 2s ICD: heal onReaction swirl source active.         |                                                                                                  |
| A4       | No Work Today!            | **notModeled** | medium | "heal characters near that healed character for 20%" (position) + AoE size (nothing).                                              | The extra healing reaches characters standing near the one healed, and we don't model positions. |
| C1       | Multi-Task no Jutsu       | **missing**    | medium | AUTHORED ELSEWHERE: Muji-Muji Daruma summon already carries both heal and damage tick series at every constellation (C1 behavior). |                                                                                                  |
| C2       | Egress Prep               | **notModeled** | high   | "DMG of Fuufuu Whirlwind Kick... increased by 3.3%" per 0.5s: kick damage magnitude only.                                          | This raises the damage of Fuufuu Whirlwind Kick, and the planner doesn't show damage amounts.    |
| C4       | Skiving: New and Improved | **missing**    | medium | "recovers 1.2 Energy when she triggers a Swirl" on field, 2s: energy onReaction swirl source active.                               |                                                                                                  |

### sethos

| column   | host                                | proposal       | conf.  | why                                                                                                                    | reason (user-facing)                                                                              |
| -------- | ----------------------------------- | -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| E.grants | Ancient Rite: The Thundering Sands  | **missing**    | medium | "If this attack triggers Electro-Charged... recovers... Energy": energy onReaction (electro reactions) from skill hit. |                                                                                                   |
| Q.grants | Secret Rite: Twilight Shadowpiercer | **missing**    | high   | Twilight Meditation 8s: NA→Dusk Bolts (Electro, CA DMG), ends on swap; needs state window + in-state normal sibling.   |                                                                                                   |
| A4       | The Sand King's Boon                | **notModeled** | medium | "increasing the DMG dealt by Shadowpiercing Shots by 700% of EM"; retired: "nothing to model it with".                 | This adds damage to Shadowpiercing Shots only, and the planner doesn't show damage amounts.       |
| C1       | Sealed Shrine's Spiritsong          | **notModeled** | high   | "CRIT Rate of Shadowpiercing Shot is increased by 15%"; retired, no ability-scoped CRIT stat, "none should be minted". | This raises CRIT Rate for Shadowpiercing Shots only, and the planner doesn't show damage amounts. |
| C6       | Pylon of the Sojourning Sun Temple  | **missing**    | medium | "Elemental Energy consumed by... Black Kite's Enigma will be returned", 15s: energy onHit Shadowpiercing Shot.         |                                                                                                   |

### shenhe

| column | host             | proposal       | conf.  | why                                                                                                                              | reason (user-facing)                                                                                                      |
| ------ | ---------------- | -------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| C4     | Insight          | **notModeled** | low    | Skyfrost Mantra "+5% DMG" per stack consumed by E; curator "not modelable as a static buff". Could be skillDmgBonus perStack.    | These stacks only raise the damage of Shenhe's next Spring Spirit Summoning, and the planner doesn't show damage amounts. |
| C6     | Mystical Abandon | **missing**    | medium | "does not count toward the Trigger Quota": Icy Quill quota is unmodelled (bars are duration-only); C6 matters once quota exists. |                                                                                                                           |

### shikanoin_heizou

| column   | host                     | proposal           | conf.  | why                                                                                                             | reason (user-facing)                                                                              |
| -------- | ------------------------ | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| E.grants | Heartstopper Strike      | **nothingToModel** | medium | Declension/Conviction only scale this skill's damage and AoE; stacks feed nothing drawn.                        |                                                                                                   |
| Q.grants | Windmuster Kick          | **missing**        | medium | Windmuster Iris: delayed damage of the absorbed element — absorption round; pull is the grouping tag (present). |                                                                                                   |
| A1       | Paradoxical Practice     | **notModeled**     | medium | "gain 1 Declension stack" on Swirl: stack feeds skill damage only.                                              | Declension only raises Heartstopper Strike's damage, and the planner doesn't show damage amounts. |
| C1       | Named Juvenile Casebook  | **notModeled**     | high   | "Normal Attack SPD is increased by 15%" + Declension: attack speed out of scope.                                | We don't model attack speed, and the Declension stack only raises Heartstopper Strike's damage.   |
| C2       | Investigative Collection | **notModeled**     | medium | "pull effect... enhanced, duration increased to 1s": enemy behavior; Q already carries grouping tag.            | We don't model how opponents move, so a stronger pull changes nothing on the timeline.            |
| C4       | Tome of Lies             | **missing**        | medium | Iris explosions "regenerate 9 Elemental Energy" +1.5 each: energy on Iris (needs absorption round's Iris).      |                                                                                                   |

### sigewinne

| column   | host                                   | proposal       | conf. | why                                                                                              | reason (user-facing)                                                                             |
| -------- | -------------------------------------- | -------------- | ----- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Q.grants | Super Saturated Syringing              | **notModeled** | high  | "absorbs up to 2 nearby Sourcewater Droplets": pickups + Bond of Life, both rubric out-of-scope. | Absorbing Sourcewater Droplets grants Bond of Life, and we don't model droplets or Bond of Life. |
| A4       | Detailed Diagnosis, Thorough Treatment | **notModeled** | high  | "healed... increased based on... Bonds of Life": Bond of Life out of scope.                      | This healing bonus scales with Bond of Life, which we don't model.                               |

### skirk

| column   | host                 | proposal       | conf. | why                                                                                                                                                     | reason (user-facing)                                                                                                    |
| -------- | -------------------- | -------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Q.grants | Havoc: Extinction    | **missing**    | high  | "All Shall Wither"... Normal Attack deal increased DMG (10 procs): normalDmgBonus onCast, whileState inStance. Caveat removal says expected-but-absent. |                                                                                                                         |
| A1       | Reason Beyond Reason | **notModeled** | high  | Void Rift gadgets; curator "The stub IS the final state".                                                                                               | Void Rifts are pickups Skirk absorbs, and we don't model them, so her Serpent's Subtlety count runs lower than in game. |
| C1       | Far to Fall          | **notModeled** | high  | Downstream of A1; curator "The stub IS the final state".                                                                                                | The crystal blades come from absorbing Void Rifts, which we don't model.                                                |
| C6       | To the Source        | **notModeled** | high  | Downstream of A1 + on-hurt trigger; curator "The stub IS the final state".                                                                              | Havoc: Sever stacks come from absorbing Void Rifts, which we don't model.                                               |

### sucrose

| column   | host                                    | proposal           | conf.  | why                                                                                                                                 | reason (user-facing) |
| -------- | --------------------------------------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Astable Anemohypostasis Creation - 6308 | **nothingToModel** | medium | "Creates a small Wind Spirit that pulls" — pull is the grouping tag (present); Hexerei Secret Rite buff authored in factionBonuses. |                      |
| C4       | Alchemania                              | **missing**        | low    | "reduce the CD... by 1-7s for every 7 Normal or Charged Attack hits": cooldownReduce onHit; amount is random (could be notModeled). |                      |
| C6       | Chaotic Entropy                         | **missing**        | high   | Absorbed-element +20% party DMG: deferred to the elemental absorption round (note "DEFERRED"); caveat present.                      |                      |

### tartaglia

| column   | host                                  | proposal           | conf.  | why                                                                                                               | reason (user-facing)                                                                           |
| -------- | ------------------------------------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| E.grants | Foul Legacy: Raging Tide (Exit Melee) | **nothingToModel** | high   | Empty description; exits Melee Stance early (terminates, no grant).                                               |                                                                                                |
| Q.grants | Havoc: Obliteration (Ranged Stance)   | **missing**        | medium | "applying the Riptide status" + "Returns a portion of its Energy Cost": Riptide debuff window + energy refund 20. |                                                                                                |
| Q.grants | Havoc: Obliteration (Melee Stance)    | **missing**        | medium | Riptide Blast: extra Hydro damage on Riptide-marked target — proc with application; Riptide unauthored.           |                                                                                                |
| A1       | Never Ending                          | **missing**        | medium | "Extends Riptide duration by 8s": modifier on Riptide window, which is unauthored.                                |                                                                                                |
| A4       | Sword of Torrents                     | **missing**        | low    | "on dealing a CRIT hit... apply the Riptide": Riptide on in-stance N/C CRIT; CRIT gate unexpressible.             |                                                                                                |
| C1       | Foul Legacy: Tide Withholder          | **missing**        | high   | "Decreases the CD of Foul Legacy: Raging Tide by 20%": cooldownModifier percent 20 (base CD is parametric).       |                                                                                                |
| C2       | Foul Legacy: Understream              | **notModeled**     | medium | "When opponents affected by Riptide are defeated... regenerates 4 Energy": enemy-death trigger.                   | This triggers when an opponent is defeated, and the planner models one opponent that stays up. |
| C4       | Abyssal Mayhem: Hydrospout            | **missing**        | medium | Riptide Slash/Flash "every 4s": periodic Hydro damage with application during stance; Riptide unauthored.         |                                                                                                |
| C6       | Havoc: Annihilation                   | **missing**        | high   | "CD of Foul Legacy... is reset" after melee Q, at stance exit: cdReset skill on stance end.                       |                                                                                                |

### thoma

| column | host               | proposal       | conf.  | why                                                                                                                                           | reason (user-facing)                                                                              |
| ------ | ------------------ | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A1     | Imbricated Armor   | **missing**    | medium | "Shield Strength will increase by 5% for 6s" max 5: no shieldStrength stat — needs one; stacks on Barrier gain.                               |                                                                                                   |
| C1     | A Comrade's Duty   | **notModeled** | high   | "is attacked, Thoma's own... CD is decreased by 3s": enemy-attack trigger.                                                                    | This triggers when an opponent attacks a shielded character, and we don't model incoming attacks. |
| C4     | Long-Term Planning | **missing**    | high   | "After using Crimson Ooyoroi, 15 Energy will be restored": energy onCast burst.                                                               |                                                                                                   |
| C6     | Burning Heart      | **missing**    | high   | "When a Blazing Barrier is obtained or refreshed... Normal, Charged, and Plunging Attacks... 15% for 6s": team N/C/P DmgBonus on shield gain. |                                                                                                   |

### tighnari

| column   | host                                 | proposal           | conf.  | why                                                                                                                               | reason (user-facing) |
| -------- | ------------------------------------ | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Q.grants | Fashioner's Tanglevine Shaft         | **nothingToModel** | high   | "fire 6 Tanglevine Shafts... Dendro DMG" + second wave: damage only.                                                              |                      |
| C1       | Beginnings Determined at the Roots   | **missing**        | medium | "Charged Attack CRIT Rate is increased by 15%": needs Charged-Attack-scoped CRIT Rate stat (curator: unauthorable today).         |                      |
| C6       | Karma Adjudged From the Leaden Fruit | **missing**        | high   | "charging time is decreased by 0.9s... 1 additional Clusterbloom Arrow": Wreath Arrow frames + extra Dendro hit (1U, ICDTagNone). |                      |

### traveler_anemo

| column   | host               | proposal           | conf.  | why                                                                                                                                                    | reason (user-facing)                                                               |
| -------- | ------------------ | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| E.grants | Palm Vortex        | **nothingToModel** | medium | Grants nothing but damage; hold absorption belongs to the planned absorption round, not this column.                                                   |                                                                                    |
| A1       | Slitting Wind      | **missing**        | high   | "last hit of a Normal Attack combo unleashes a wind blade" 60% Anemo — N5-armed damage proc with Anemo application (swing-armed proc has no host yet). |                                                                                    |
| A4       | Second Wind        | **notModeled**     | high   | "Palm Vortex kills regenerate 2% HP" — on-kill trigger; opponents are never defeated.                                                                  | We don't model defeating opponents, so there is no kill for this heal to follow.   |
| C1       | Raging Vortex      | **notModeled**     | medium | "Storm DMG is increased by 100%" on the first cast — damage magnitude only, like Yae A4's ruling. Could be a skillDmgBonus passive instead.            | We don't draw damage amounts, and this only changes how hard the first Storm hits. |
| C2       | Uprising Whirlwind | **missing**        | high   | "Increases Energy Recharge by 16%" — self energyRecharge passive buff; note says "Skipped for now — minor", not a ruling.                              |                                                                                    |
| C4       | Cherishing Breezes | **nothingToModel** | high   | "Decreases sprinting Stamina consumption by 20%".                                                                                                      |                                                                                    |

### traveler_dendro

| column   | host             | proposal           | conf.  | why                                                                                                                             | reason (user-facing)                                                                                        |
| -------- | ---------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| E.grants | Razorgrass Blade | **nothingToModel** | high   | Single Dendro hit; grants no buff, summon, state or cooldown change.                                                            |                                                                                                             |
| A4       | Verdant Luxury   | **notModeled**     | high   | EM → Razorgrass/Surgent DMG; note: "damage magnitude, which the tool never draws; description-only".                            | We don't draw damage amounts, and this only raises how hard Razorgrass Blade and Surgent Manifestation hit. |
| C4       | Treacle Grass    | **missing**        | medium | +5 Lotuslight stacks on Transfiguration — gainStacks; blocked because the Lamp's Transfiguration (Lamp reacting) is unmodelled. |                                                                                                             |

### traveler_electro

| column | host                        | proposal       | conf.  | why                                                                                                               | reason (user-facing)                                                                                |
| ------ | --------------------------- | -------------- | ------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A1     | Thunderflash                | **notModeled** | high   | CD −1.5s on a teammate's Abundance Amulet pickup; pickups are out of scope (rubric frozen list).                  | We don't model picking up Abundance Amulets, so the cooldown they shave off isn't shown.            |
| A4     | Resounding Roar             | **notModeled** | high   | Rider on the Amulet's ER buff; amulet pickup is out of scope.                                                     | We don't model picking up Abundance Amulets, so the Energy Recharge they grant isn't shown.         |
| C1     | Spring Thunder of Fertility | **notModeled** | high   | "Abundance Amulets … increased to 3" — pickup count only.                                                         | We don't model picking up Abundance Amulets, so how many there are changes nothing on the timeline. |
| C4     | Fickle Cloudstrike          | **notModeled** | high   | Amulet pickup Energy below 35% — pickups and Energy % are both unmodelled.                                        | We don't model picking up Abundance Amulets or Energy levels, which is all this changes.            |
| C6     | World-Shaker                | **notModeled** | medium | Every 3rd Falling Thunder 200% DMG + 1 Energy; note: "no primitive and no pixel". Energy has no planner consumer. | We don't draw damage amounts or Energy, which is all this changes.                                  |

### traveler_geo

| column | host              | proposal    | conf.  | why                                                                                                                                  | reason (user-facing) |
| ------ | ----------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| C2     | Rockcore Meltdown | **missing** | medium | Meteorite explodes when destroyed — extra Geo hit with application at the construct's end; note: "No construct-destroyed primitive". |                      |

### traveler_hydro

| column   | host             | proposal           | conf.  | why                                                                                         | reason (user-facing)                                                                     |
| -------- | ---------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| E.grants | Aquacrest Saber  | **nothingToModel** | medium | Damage only (Torrent Surge, Dewdrops, Spiritbreath Thorn); Suffusion HP drain is not drawn. |                                                                                          |
| A4       | Clear Waters     | **notModeled**     | medium | Torrent Surge bonus = 45% of HP spent via Suffusion — HP-drain aggregate; damage magnitude. | We don't track HP, and the size of this bonus depends on how much HP the hold spent.     |
| C1       | Swelling Lake    | **notModeled**     | high   | "Picking up a Sourcewater Droplet will restore 2 Energy" — pickup-driven.                   | We don't model picking up Sourcewater Droplets, so the Energy they restore isn't shown.  |
| C6       | Tides of Justice | **notModeled**     | high   | Droplet pickup heal; note: "pickup has no schema trigger". Pickups out of scope.            | We don't model picking up Sourcewater Droplets, so the healing they trigger isn't shown. |

### traveler_pyro

| column   | host                       | proposal           | conf.  | why                                                                                                                                              | reason (user-facing) |
| -------- | -------------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Q.grants | Plains Scorcher            | **missing**        | medium | "restoring Nightsoul points" — refreshes the E's Nightsoul window (E caveat says it empties in ~6s without it); durationExtension on the stance. |                      |
| A1       | True Flame of Incineration | **nothingToModel** | high   | "attack AoE … is increased".                                                                                                                     |                      |
| C2       | Ever-Lit Candle            | **missing**        | low    | +14 Nightsoul points on party Pyro reactions within 12s of E — would extend the Nightsoul window; points themselves are unmodelled.              |                      |

### varka

| column   | host                                              | proposal           | conf.  | why                                                                                                                                         | reason (user-facing) |
| -------- | ------------------------------------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Q.grants | Northwind Avatar                                  | **nothingToModel** | high   | Two slashes, first converted to the party element — damage and application only (covered by other columns).                                 |                      |
| C2       | "When Dawn Breaks, Our Journey Shall Take Flight" | **nothingToModel** | medium | Extra 800% Anemo strike on sE/sC; CLAUDE.md Varka round: "C2's strike: known, pixel-free (no Durability in gcsim)". Flag: maybe notModeled. |                      |

### venti

| column   | host             | proposal           | conf.  | why                                                                                                                                          | reason (user-facing) |
| -------- | ---------------- | ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Skyward Sonnet   | **nothingToModel** | medium | Damage + launch; Hold upcurrent is traversal (A1). Stray "summon" tag on host noted by curator.                                              |                      |
| A1       | Embrace of Winds | **nothingToModel** | high   | "creates an upcurrent that lasts for 20s" — traversal.                                                                                       |                      |
| C1       | Splitting Gales  | **missing**        | medium | 2 extra arrows per Aimed Shot (33% DMG) — extra hits/applications at the same hitmark (lands list). Note says damage-only, nothing authored. |                      |

### vesna

| column   | host                        | proposal    | conf.  | why                                                                                                                                         | reason (user-facing) |
| -------- | --------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | The Art of Victory          | **missing** | high   | Stub: Armed for Action mode, Anemo infusion, wind pinion summon, Sword Essence stacks, Windborne Sword special skill — nothing authored.    |                      |
| Q.grants | For the Tsaritsa!           | **missing** | medium | Spirit Blades damage + 1 Sword Essence stack — gainStacks onCast burst (stub, nothing authored).                                            |                      |
| A1       | Rite of Spring's Procession | **missing** | medium | Disciplinary Action stacks (20s, max 6, independent) — gainStacks; the damage scaling is magnitude but the stack count feeds C2's ATK buff. |                      |
| A4       | Truth Prevails              | **missing** | high   | Radiance: Stellar Swirl — ATK +6% per Cryo/Anemo, EM +25 per other element; passive buffs gated by teamElementCount + Radiance.             |                      |
| C1       | Winter's Farewell Feast     | **missing** | high   | Armed for Action: +20% Stellar Swirl DMG (stellarSwirlDmgBonus whileState) + 4th top-level Windborne Sword.                                 |                      |
| C2       | Kolo of Spring's Arrival    | **missing** | high   | Max Disciplinary Action on mode entry; ATK +40% at max stacks — gainStacks + stacks-gated atk% buff.                                        |                      |
| C4       | Glory to Our Forebears      | **missing** | high   | Triples A4's ATK/EM bonuses — constellationScaling / C4-gated variant of A4 buffs.                                                          |                      |
| C6       | Unwavering Ardor            | **missing** | medium | Windborne Sword: Transpose hits + coordinated wind pinion (authorable); Stellar Swirl "elevated" by 20% is the frozen elevate class.        |                      |

### vodyanitsa

| column   | host                                     | proposal           | conf.  | why                                                                                                                                     | reason (user-facing) |
| -------- | ---------------------------------------- | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Rechitativ: Sonorous Dawn                | **missing**        | high   | Stub: Horn of Spring's Call summon (periodic Hydro), Hydro/Cryo RES shred, periodic active-char heal — nothing authored.                |                      |
| Q.grants | Koda: Sink With Thee                     | **nothingToModel** | high   | Damage only; "DMG dealt is further increased" in Song of Ages Past — magnitude.                                                         |                      |
| A1       | The Last Djeguako Songstress             | **missing**        | high   | Wandering Vortex gadget, Anemo RES −35% 6s, +4s Radiance: Stellar Swirl extension.                                                      |                      |
| A4       | Dirge of the Fandyr                      | **missing**        | medium | 25 Lead Vocal + 10 Chorus stacks on E, 30s — gainStacks onCast skill (what reads them is unclear in the stub).                          |                      |
| C1       | Waters in Full Splendor                  | **missing**        | medium | Team ATK +0.8% of Max HP for 5s per Song heal — buff on the heal tick cadence (onHeal has no reader; needs summon-tick buff collector). |                      |
| C2       | Echoes That Pierce the Snow              | **missing**        | high   | Active char Hydro/Cryo CRIT DMG +50% 5s on Horn hit (hydroCritDmg/cryoCritDmg) + Song duration +9s (durationModifier).                  |                      |
| C4       | Melancholic Voice Upon the Gentle Waters | **missing**        | medium | On Song heal: Max HP +20% 6s (3 stacks) or healing +50% by receiver HP — HP-gated, heal-tick triggered.                                 |                      |
| C6       | Neverending Song of Revelry              | **missing**        | high   | C2 buff goes team-wide; in Song, Hydro/Cryo DMG +60% (authorable). Stellar Swirl elevate is the frozen class.                           |                      |

### wanderer

| column   | host                                   | proposal       | conf.  | why                                                                                                                                   | reason (user-facing)                                                                                           |
| -------- | -------------------------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Q.grants | Kyougen: Five Ceremonial Plays         | **missing**    | low    | Damage only, but "Windfavored state will end after casting" — needs stance cancel (rubric N15).                                       |                                                                                                                |
| A4       | Gales of Reverie                       | **notModeled** | high   | "has a 16% chance to obtain the Descent effect" with pity — random proc.                                                              | We don't draw chance-based procs: Descent triggers at random, with better odds after each miss.                |
| C1       | Shoban: Ostentatious Plumage           | **notModeled** | high   | Attack SPD +10% (no Stat; hitlag/attack speed out of scope) + bonus to A4's chance-based arrows.                                      | We don't model attack speed, and the wind arrows this strengthens come from a chance-based proc we don't draw. |
| C2       | Niban: Isle Amidst White Waves         | **missing**    | medium | Burst DMG +4% per Kuugoryoku Point spent (cap 200%) — burstDmgBonus onCast in stance with unknown/ capped value; resource unmodelled. |                                                                                                                |
| C4       | Yonban: Set Adrift into Spring         | **notModeled** | medium | Extra buff chosen at random from unabsorbed elements; element absorption is its own (planned) round.                                  | The extra buff is picked at random, so we don't draw it.                                                       |
| C6       | Shugen: The Curtains' Melancholic Sway | **missing**    | medium | Extra Fushoudan instance (40% DMG, Anemo, normal ATK DMG) on in-stance N hit, 12f ICD — stance-gated onHit proc with application.     |                                                                                                                |

### wriothesley

| column   | host                      | proposal           | conf.  | why                                                                                                                                         | reason (user-facing) |
| -------- | ------------------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Q.grants | Darkgold Wolfbite         | **nothingToModel** | high   | Icicle Impact + Ousia Surging Blade — damage and application only.                                                                          |                      |
| C1       | Terror for the Evildoers  | **missing**        | high   | Enhanced CA extends Chilling Penalty +4s once per window (caveat names it) — durationExtension maxExtensions 1; 200% DMG part is magnitude. |                      |
| C2       | Shackles for the Arrogant | **missing**        | high   | Burst DMG +40% per Prosecution Edict stack — perStack burstDmgBonus onCast burst.                                                           |                      |
| C6       | Esteem for the Innocent   | **missing**        | medium | Extra icicle (100% Rebuke Base DMG, Cryo, CA DMG) — extra hit with Cryo application; Rebuke-only CR/CD is magnitude.                        |                      |

### xiangling

| column | host                    | proposal           | conf. | why                                                                                                                                                        | reason (user-facing) |
| ------ | ----------------------- | ------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | Crossfire               | **nothingToModel** | high  | "Increases the flame range of Guoba by 20%".                                                                                                               |                      |
| A4     | Beware, It's Super Hot! | **missing**        | low   | Chili pepper pickup: active char ATK +10% 10s after Guoba ends — afterDuration buff; but pickup-driven empowerment may fall under the out-of-scope ruling. |                      |
| C2     | Oil Meets Fire          | **missing**        | high  | N5 Implode → 75% Pyro explosion 2s later, Durability 25 — note: a swing-armed damage proc "has no host" (engine gap).                                      |                      |

### xianyun

| column   | host                         | proposal           | conf.  | why                                                                                                                                 | reason (user-facing) |
| -------- | ---------------------------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| E.grants | Skyladder (1st Leap)         | **missing**        | medium | Cloud Transmogrification state (plunge → Driftcloud Wave) + CD −3s if no Driftcloud Wave; note: "not modelled as a separate state". |                      |
| E.grants | Skyladder (2nd Leap)         | **nothingToModel** | high   | Leap damage; "increases the DMG and AoE of the next Driftcloud Wave" — magnitude.                                                   |                      |
| E.grants | Skyladder (3rd Leap)         | **nothingToModel** | high   | Final leap damage; resets the chain (authored via chainStage).                                                                      |                      |
| C6       | They Call Her Cloud Retainer | **missing**        | medium | 16s after Q the skill ignores CD (max 8 uses) — CD-bypass window + procCap; plunge CRIT DMG by leap count is magnitude.             |                      |

### xiao

| column   | host                                  | proposal           | conf. | why                                                                                       | reason (user-facing)                                                                      |
| -------- | ------------------------------------- | ------------------ | ----- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| E.grants | Lemniscatic Wind Cycling              | **nothingToModel** | high  | Lunge damage; 2 charges authored.                                                         |                                                                                           |
| A4       | Dissolution Eon: Heaven Fall          | **missing**        | high  | "+15% [skill DMG] … 7s, max 3 stacks" — gainStacks + perStack skillDmgBonus onCast skill. |                                                                                           |
| C2       | Annihilation Eon: Blossom of Kaleidos | **missing**        | high  | "not on the field, Energy Recharge +25%" — self energyRecharge gated not onField.         |                                                                                           |
| C6       | Conqueror of Evil: Guardian Yaksha    | **notModeled**     | high  | "hitting at least 2 opponents with … Plunging Attack" — we model one opponent.            | We model a single opponent, so a Plunging Attack never hits the two opponents this needs. |

### xilonen

| column | host                        | proposal    | conf.  | why                                                                                                                                               | reason (user-facing) |
| ------ | --------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | Netotiliztli's Echoes       | **missing** | medium | <2 converted Samples: N/Plunge DMG +30%; ≥2: Nightsoul points — composition gate (teamElementCount); note predates that condition.                |                      |
| C2     | Chiucue Mix                 | **missing** | medium | Per-element teammate buffs (Geo DMG +50%, Pyro ATK +45%, Hydro HP +45%, Cryo CRIT DMG +60%, Electro Energy/Q CD) — needs receiver-element gating. |                      |
| C6     | Imperishable Night Carnival | **missing** | high   | Imperishable Night's Blessing: +300% DEF N/Plunge flat DMG 5s + heals every 1.5s, 15s ICD — normal/plungeFlatDmg + heal ticks.                    |                      |

### xingqiu

| column | host                           | proposal           | conf.  | why                                                                                                                   | reason (user-facing) |
| ------ | ------------------------------ | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------- | -------------------- |
| extra  | Flash of Genius                | **nothingToModel** | high   | Crafting refund, "25% chance to refund".                                                                              |                      |
| C1     | The Scent Remained             | **nothingToModel** | medium | "Increases the maximum number of Rain Swords by 1" — sword count isn't drawn (damage reduction/interruption only).    |                      |
| C4     | Evilsoother                    | **missing**        | high   | "Throughout the duration of Raincutter … Fatal Rainscreen DMG +50%" — skillDmgBonus gated duringSummon source burst.  |                      |
| C6     | Hence, Call Them My Own Verses | **missing**        | medium | Every 3rd wave 5 swords + 3 Energy — extra Hydro hits; note: needs a per-Nth-fire trigger, Energy reaches no surface. |                      |

### xinyan

| column   | host                                            | proposal           | conf.  | why                                                                                                                     | reason (user-facing)                                                                       |
| -------- | ----------------------------------------------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Q.grants | Riff Revolution                                 | **nothingToModel** | high   | Physical + Pyro damage and application only.                                                                            |                                                                                            |
| A1       | "The Show Goes On, Even Without an Audience..." | **notModeled**     | medium | Shield level depends on opponents hit; we model one opponent, and the planner draws one shield bar regardless of level. | Shield levels depend on how many opponents the swing hits, and we model a single opponent. |
| A4       | "...Now That's Rock 'N' Roll!"                  | **missing**        | medium | Shielded characters +15% Physical DMG — buff while shield; ⚠ no physicalDmgBonus Stat exists yet.                       |                                                                                            |
| C1       | Fatal Acceleration                              | **notModeled**     | high   | ATK SPD +12% on CRIT — attack speed (no Stat; hitlag/attack speed out of scope).                                        | We don't model attack speed.                                                               |
| C2       | Impromptu Opening                               | **missing**        | high   | "form a shield at Shield Level 3: Rave when cast" — shield onCast burst (C2); Physical CRIT Rate on burst is magnitude. |                                                                                            |

### yae_miko

| column   | host                            | proposal       | conf.  | why                                                                                                                                                             | reason (user-facing)                                                                |
| -------- | ------------------------------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Q.grants | Great Secret Art: Tenko Kenshin | **missing**    | medium | Burst destroys every Sesshou Sakura (terminatesOn: burst on the summon, absent) and fires a Tenko Thunderbolt per totem (Electro hits).                         |                                                                                     |
| A1       | The Shrine's Sacred Shade       | **missing**    | high   | Skill charge reset per Sakura destroyed by burst — cdReset/cooldownReduce onCast burst; caveat already says "Not modeled".                                      |                                                                                     |
| A4       | Enlightened Blessing            | **notModeled** | high   | EM → Sesshou Sakura DMG; note: "damage magnitude, which is out of scope — nothing to draw".                                                                     | We don't draw damage amounts, and this only raises how hard the Sesshou Sakura hit. |
| extra    | Edict of Cleansing              | **missing**    | medium | AUTHORED ELSEWHERE: the +10s is baked into Sesshou Sakura duration 24. Missing: Radiance extra 200% Stellar-Conduct hit and Radiance state in a Polestar Field. |                                                                                     |
| C6       | Forbidden Art: Daisesshou       | **missing**    | medium | Sakura ignores 60% DEF (defIgnore, but scoped to summon hits) + Stellar-Conduct CRIT DMG +200% (no reaction-scoped crit Stat).                                  |                                                                                     |

### yanfei

| column | host                      | proposal           | conf.  | why                                                                                                                               | reason (user-facing) |
| ------ | ------------------------- | ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A4     | Blazing Eye               | **missing**        | medium | CRIT CA → 80% Pyro hit, Durability 25 — onHit charged isCrit proc; note: refused only because nothing arms a passive-hosted proc. |                      |
| C1     | The Law Knows No Kindness | **nothingToModel** | high   | Stamina cost and interruption resistance.                                                                                         |                      |

### yaoyao

| column | host        | proposal    | conf.  | why                                                                                                                          | reason (user-facing) |
| ------ | ----------- | ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | Starscatter | **missing** | low    | Radishes thrown every 0.6s while sprinting/jumping/running in burst — movement-driven heal/Dendro hits; running is no token. |                      |
| C2     | Innocent    | **missing** | medium | +3 Energy on radish hit in burst, 0.8s ICD — energy effect (no planner consumer today).                                      |                      |

### yelan

| column | host             | proposal    | conf.  | why                                                                                                                                             | reason (user-facing) |
| ------ | ---------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1     | Turn Control     | **missing** | high   | Max HP +6/12/18/30% by party element-type count — passive hp% gated by team element types.                                                      |                      |
| A4     | Adapt With Ease  | **missing** | medium | AUTHORED ELSEWHERE: ramping allDmgBonus (1% +3.5%/s, cap 50%) on depthclarion_dice (burst) effects, source "passive", no attribution naming A4. |                      |
| C6     | Winner Takes All | **missing** | high   | Mastermind 20s: normals become special Breakthrough Barbs (CA DMG), cleared after 5 arrows — state + procCap.                                   |                      |

### yoimiya

| column   | host                     | proposal       | conf.  | why                                                                                                                       | reason (user-facing)                                                                 |
| -------- | ------------------------ | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Q.grants | Ryuukin Saxifrage        | **missing**    | high   | Aurous Blaze: teammates' hits trigger Pyro explosions, 2s ICD, 10s — cast-hosted onHit others proc with Pyro application. |                                                                                      |
| C1       | Agate Ryuukin            | **missing**    | medium | Aurous Blaze +4s (authorable once Aurous Blaze is); ATK +20% on defeating a marked opponent is on-kill (notModeled half). |                                                                                      |
| C4       | Pyrotechnic Professional | **missing**    | high   | Skill CD −1.2s per own Aurous Blaze explosion — cooldownReduce on the proc (needs Aurous Blaze first).                    |                                                                                      |
| C6       | Naganohara Meteor Swarm  | **notModeled** | high   | "50% chance of firing an extra Blazing Arrow" — random proc.                                                              | We don't draw chance-based procs: each extra Blazing Arrow has a 50% chance to fire. |

### yumemizuki_mizuki

| column | host                         | proposal       | conf.  | why                                                                                                                                     | reason (user-facing)                                                                           |
| ------ | ---------------------------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| A1     | Bright Moon's Restless Voice | **missing**    | medium | AUTHORED ELSEWHERE: aisa_utamakura_pilgrimage durationExtensions (Swirl onReaction, +2.5s, max 2, 0.3s CD) — no source string names A1. |                                                                                                |
| C4     | Buds Warm Lucid Springs      | **notModeled** | high   | Snack pickup heal/damage/Energy; note: "depends on snack-pickup events we don't model".                                                 | We don't model picking up Yumemi Style Special Snacks, so the Energy they restore isn't shown. |
| C6     | The Heart Lingers Long       | **notModeled** | medium | Lets Swirl DMG crit; note: Swirl "isn't subject to crit at all" — damage magnitude only.                                                | We don't draw damage amounts, and this only lets Swirl damage land critical hits.              |

### yun_jin

| column | host                 | proposal       | conf. | why                                                                                | reason (user-facing)                                                |
| ------ | -------------------- | -------------- | ----- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A1     | True to Oneself      | **notModeled** | high  | "at the precise moment when Yun Jin is attacked" — opponents never attack.         | Opponents don't attack in our model, so there is no hit to counter. |
| C1     | Thespian Gallop      | **missing**    | high  | "Opening Flourish's CD is decreased by 18%" — cooldownModifier (percent) gated C1. |                                                                     |
| C4     | Flower and a Fighter | **missing**    | high  | DEF +20% 12s on Crystallize/Lunar-Crystallize — self def% onReaction, source self. |                                                                     |
| C6     | Decorous Harmony     | **notModeled** | high  | Normal ATK SPD +12% — attack speed (no Stat; out of scope).                        | We don't model attack speed.                                        |

### zhongli

| column | host                         | proposal       | conf.  | why                                                                                                  | reason (user-facing)                                                                                   |
| ------ | ---------------------------- | -------------- | ------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A1     | Resonant Waves               | **notModeled** | high   | "When the Jade Shield takes DMG, it will Fortify" — incoming damage; shield strength not drawn.      | Opponents don't attack in our model, so the Jade Shield never takes the hits that strengthen it.       |
| C1     | Rock, the Backbone of Earth  | **missing**    | medium | Two concurrent Stone Steles — a recast shouldn't cut the first Stele (summon cap/recast rule at C1). |                                                                                                        |
| C6     | Chrysos, Bounty of Dominator | **notModeled** | high   | Heal from damage the Jade Shield takes; note: "no heal effect is authorable".                        | Opponents don't attack in our model, so the Jade Shield never takes the damage this heal is made from. |

### zibai

| column   | host                                         | proposal       | conf.  | why                                                                                                                                     | reason (user-facing)                                                                         |
| -------- | -------------------------------------------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Q.grants | Tri-Sphere Eminence                          | **missing**    | medium | AUTHORED ELSEWHERE: +1.7s is the skill's durationExtensions (burst-triggered). Otherwise damage only.                                   |                                                                                              |
| A1       | The Selenic Adeptus Descends                 | **missing**    | medium | Note "NOT MODELED": +60% DEF to Spirit Steed's Stride 2nd hit — blocked by the unmodelled Stride itself (data gap, not a scope ruling). |                                                                                              |
| C1       | Burst Forth With Vigor, But Enter in Silence | **missing**    | medium | Note "NOT MODELED": +100 Radiance, Stride uses 4→5, first Stride +220% — tied to the unmodelled Stride/Radiance.                        |                                                                                              |
| C4       | The Spirit Passes, Then Form Follows         | **missing**    | low    | Note "NOT MODELED": N combo doesn't reset in mode; Stride hit → next 4th-hit extra attack 250% — tied to unmodelled Stride.             |                                                                                              |
| C6       | The World, A Journey in Passing              | **notModeled** | medium | Radiance gain +50%; Stride consumes all Radiance to elevate DMG — elevate is frozen and Radiance is unmodelled.                         | We don't track Phase Shift Radiance, and this only raises damage by how much of it is spent. |
