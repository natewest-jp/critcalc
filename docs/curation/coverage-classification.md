# Coverage classification — the record

_Coverage round (`docs/coverage-round.md` §6). First pass 2026-09-23 by four agents; ⚓ Nate ruled the nine
classes below the same day; a second pass applied the rulings row by row and the result is WRITTEN to
the character data (`notModeled` / `nothingToModel` / `modeledBy` on each host). **This file is now
the record of those calls, not a proposal.** ⚠️ Nate's markup landed inside `cdf62b29` (a
`commit -a` swept it in under an unrelated message)._

**471 hosts:** notModeled 184 · nothingToModel 57 · modeledBy
10 · **missing 220** — the last is the honest curation backlog (sort `/coverage` by least
covered). ⚓ The agreed test between the two n/a-ish states: _would a player reading the timeline ever
expect to see it?_ No → nothingToModel. Yes, but ruled out → notModeled, with a reason. A host
with ANY modelable-but-unauthored part stays missing.

## ⏭ Rule these classes first — each one settles many rows

The agents flagged the same judgment calls independently. One ruling per class settles most of the table.

1. **A damage bonus on ONE named attack** (Citlali A4, Fischl C2, Albedo A1, Eula C6, Sethos A4/C1,
   Sandrone A1/C2/C4, Raiden's Resolve hosts, Heizou A1, Navia C6, Neuvillette C2, Yae A4, Anemo
   Traveler C1, Dendro/Hydro Traveler A4, Mizuki C6, Mualani A4, Shenhe C4). Proposed **notModeled**
   ("the planner doesn't show damage amounts"). Alternative: **missing**, authored as a `*DmgBonus`
   buff where a CLASS stat fits (Varka's A1 multiplier precedent) — and a ruling only where no class
   stat exists. The same question covers **ability-scoped CRIT** (Freminet C1, Gaming C6, Ganyu A1,
   Kinich C1), which the retirement round ruled out. → N: notModeled
2. **Energy restoration.** Proposed **missing**. But `energy` effects reach no planner surface (the
   Team Builder reads them), so an authored one would light a column the planner doesn't draw.
   Missing, notModeled, or nothingToModel for the planner? → N: notModeled for the Planner
3. **Resource pools with no reader** — Nightsoul points (Iansan C1/C4, Kinich A1, Ifa C2) and Will to
   Win (Lohen A1/C1). Proposed **notModeled**. ⚠️ Kinich's curator note leans on the retired
   "windows, not gauges" line. → N: notModeled
4. **Pickups** — particles, droplets, Puffers, Void Rifts, Bond of Life. Proposed **notModeled**,
   citing the rubric's out-of-scope list. → N: Agreed, notModeled
5. **CRIT-triggered effects** (Rosaria C1, Tartaglia A4, Dehya C6's second half). Proposed
   **missing**. Or rule them like random procs? → N: notModeled - even though we can simulate RNG
   like we do for the Roll mini-tool/game on the CRIT Visualizer, we shouldn't simulate RNG on the
   Planner - otherwise users will see different windows from each other (different in a sense of
   seeing different bars - it's fine for users to see different timings based on ping / human timing)
6. **Authored ELSEWHERE, with nothing that names the host.** The derivation credits a passive or
   constellation found through a gated condition or a `source`/`attribution` string. These carry
   neither, so they read missing while the planner draws them: Aino A1 (a Moonsign-gated tick series)
   and A4 (`flatScaling`), Collei A4 and Mizuki A1 (a summon's `durationExtensions`), Kachina A4
   (tick `flatScaling`), Yelan A4 (`source: 'passive'`), Illuga's skill (buff hosted on a passive),
   Sayu C1. **Proposal:** a fourth positive statement, `coveredBy: '<hostId>'`, which lint checks
   points at a real host. Or add `source` to `DurationExtension` instead. → N: Approved to use whichever
   implementation you judge to be the strongest
7. **Tags as grants** — `grouping` on Jean, Ifa, Lan Yan and Kazuha's skill/burst. The Team Builder
   reads the tag; the planner has nothing to draw for a pull. Proposed **missing**; nothingToModel
   seems right to me. → N: I think notModeled is the right call here - grouping does exist in the
   game and in their kits; it's just something the Planner can't show. Do you agree?
8. **Notes that lean on the retired creed** — Citlali C6's "not modelled per the constitution".
   Proposed missing. → N: notModeled
9. **No `physicalDmgBonus` stat** — Eula C1, Xinyan A4, Mika's Detector stacks. "Missing" here means
   a new Stat as well as data. → N: this one is a true missing for us, isn't it

Also found along the way (not coverage, for the engine queue): Alhaitham's C4/C6 read a `mirrors`
stack key nothing grants; Eula's Hold variant keeps a 10s cooldown at C2 (no `cooldownModifiers` on
variants); Dahlia C4 extends a Favonian Favor window that isn't authored. → N: Thank you for finding
these; let's make sure they don't get dropped after this work!

## Rows

### aino

| column   | host                     | call               | class | why                                                                                 | reason (rendered)                                                                           |
| -------- | ------------------------ | ------------------ | ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| E.grants | Musecatcher              | **nothingToModel** |       | Damage + Hydro application only; no buff, heal, summon or state.                    |                                                                                             |
| A4       | Structured Power Booster | **notModeled**     | 1     | EM-scaled DMG on the burst only; authored as flatScaling but no pixel draws damage. | We don't draw damage amounts, and this only raises how hard Precision Hydronic Cooler hits. |

### albedo

| column   | host                               | call               | class | why                                                                                                                                                    | reason (rendered)                                                                                                                                |
| -------- | ---------------------------------- | ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q.grants | Rite of Progeniture: Tectonic Tide | **nothingToModel** |       | Damage only; Fatal Blossoms already authored as the 'With Solar Isotoma' variant's application[].                                                      |                                                                                                                                                  |
| A1       | Calcite Might                      | **notModeled**     | 1     | Transient Blossom DMG bonus gated on opponent HP: one named attack.                                                                                    | We don't draw damage amounts, and this only raises how hard Transient Blossoms hit opponents below 50% HP.                                       |
| C2       | Opening of Phanerozoic             | **missing**        |       | Hexerei +125 EM team buff is modelable (engine gap); the Fatal Reckoning DMG half is ruled (class 1).                                                  |                                                                                                                                                  |
| C4       | Descent of Divinity                | **missing**        |       | '+30% Plunging DMG within Solar Isotoma field'. Curator refused as positional, but in-field buffs (Bennett) are authored as duringSummon active buffs. |                                                                                                                                                  |
| C6       | Dust of Purification               | **notModeled**     | 4     | Crystallize shard pickup / Moondrifts inside the field (position); Hexerei half is named-attack DMG.                                                   | This needs a Crystallize shield or Moondrifts inside the Solar Isotoma field, and we don't model shard pickups or where things sit on the field. |

### alhaitham

| column   | host                                   | call        | class | why                                                                                                                                                 | reason (rendered) |
| -------- | -------------------------------------- | ----------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| E.grants | Universality: An Elaboration on Form   | **missing** |       | Chisel-Light Mirrors: Dendro infusion + Projection Attack procs. 'mirrors' key is read by C4/C6 conditions but nothing grants it.                   |                   |
| Q.grants | Particular Field: Fetters of Phenomena | **missing** |       | Consumes mirrors, regenerates 3/2/1/0 after 2s — mirror gainStacks/consumeStacks onCast burst; no mirror stack is authored anywhere.                |                   |
| C1       | Intuition                              | **missing** |       | 'Projection Attack hits… CD decreased by 1.2s, once every 1s' — cooldownReduce onHit with procCooldown 1; Projection Attacks themselves unauthored. |                   |

### aloy

| column   | host               | call               | class | why                                                                                                                                             | reason (rendered) |
| -------- | ------------------ | ------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| E.grants | Frozen Wilds       | **missing**        |       | AUTHORED ELSEWHERE (partly): coil gainStacks + Rushing Ice onStack live on strong_strike passive. Coil NA DMG%, Cryo infusion still unauthored. |                   |
| Q.grants | Prophecies of Dawn | **nothingToModel** |       | 'dealing AoE Cryo DMG' — damage only.                                                                                                           |                   |
| A1       | Combat Override    | **missing**        |       | 'ATK +16%, party +8%, 10s' on Coil gain — self/team atk buff onHit skill (or on coil gainStacks), 10s.                                          |                   |

### amber

| column | host                       | call           | class    | why                                                                                                                        | reason (rendered)                                                                                       |
| ------ | -------------------------- | -------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A4     | Precise Shot               | **notModeled** | existing | Weak-point hits depend on aim: a position mechanic.                                                                        | This needs an Aimed Shot to hit a weak point, and we don't model where a shot lands.                    |
| C1     | One Arrow to Rule Them All | **missing**    |          | 'Fires 2 arrows per Aimed Shot' — second arrow is an extra hit/application on the aimed shot; constellation-gated landing. |                                                                                                         |
| C2     | Bunny Triggered            | **notModeled** | existing | Needs a charged Aimed Shot to hit Baron Bunny's foot (aim/position); +200% is named-attack DMG.                            | We don't model where a shot lands, and this needs a fully charged Aimed Shot to hit Baron Bunny's foot. |
| C6     | Wildfire                   | **missing**    |          | 'all party members'… ATK by 15% for 10s' — team atk buff onCast burst 10s (gcsim says 15s; verify).                        |                                                                                                         |

### arataki_itto

| column | host                         | call           | class    | why                                                                                                        | reason (rendered)                                                                   |
| ------ | ---------------------------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A1     | Arataki Ichiban              | **notModeled** | existing | Attack speed on the next slash; interruption resistance is nothing.                                        | We don't model attack speed, so Arataki Kesagiri's slashes keep their usual timing. |
| A4     | Bloodline of the Crimson Oni | **notModeled** | 1        | Flat DMG on Arataki Kesagiri only, a named attack.                                                         | We don't draw damage amounts, and this only raises how hard Arataki Kesagiri hits.  |
| C1     | Stay a While and Listen Up   | **notModeled** | 3        | Superlative Superstrength is a resource pool the planner does not track.                                   | We don't track Superlative Superstrength, so the stacks this grants aren't shown.   |
| C6     | Arataki Itto, Present!       | **missing**    | 9        | Charged-Attack CRIT DMG needs a class-scoped CRIT stat that does not exist; the 50% half is RNG (class 5). |                                                                                     |

### arlecchino

| column   | host                                                  | call           | class | why                                                                                                                                          | reason (rendered)                                                                           |
| -------- | ----------------------------------------------------- | -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| E.grants | All Is Ash                                            | **missing**    |       | Blood-Debt Directive: 2 Pyro ticks at 5s on the target, skill DMG — unauthored. Bond of Life half is out of scope.                           |                                                                                             |
| A1       | Agony Alone May Be Repaid                             | **notModeled** | 4     | Both clauses change Bond of Life gained; rubric out-of-scope list: 'Bond of Life'.                                                           | We don't model Bond of Life, and this passive only changes how much of it Arlecchino gains. |
| C1       | "All Reprisals and Arrears, Mine to Bear..."          | **notModeled** | 4     | Masque bonus scales with Bond of Life (curator: 'BoL-runtime scaling'); interruption resistance.                                             | We don't model Bond of Life, which this constellation's damage bonus depends on.            |
| C4       | "You Shall Love and Protect Each Other Henceforth..." | **missing**    |       | 'absorbs a Blood-Debt Directive… Q CD −2s, 15 Energy, once every 10s' — cooldownReduce + energy onCast (charged/burst) with procCooldown 10. |                                                                                             |

### baizhu

| column | host                        | call           | class    | why                                                                                                               | reason (rendered)                                                                               |
| ------ | --------------------------- | -------------- | -------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A4     | All Things Are of the Earth | **notModeled** | existing | Trigger is 'healed by Seamless Shields' (onHeal has no reader); existing caveat already says 'Not modeled'.       | This bonus goes to characters healed by the Seamless Shields, and we don't track who is healed. |
| C2     | Incisive Discernment        | **missing**    |          | Gossamer Sprite: Splice Dendro proc on active hits, 5s ICD; no arming path for a permanent listener (engine gap). |                                                                                                 |

### barbara

| column | host                         | call               | class    | why                                                             | reason (rendered)                                                                                       |
| ------ | ---------------------------- | ------------------ | -------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A1     | Glorious Season              | **nothingToModel** |          | 'Stamina Consumption… reduced by 12%'.                          |                                                                                                         |
| A4     | Encore                       | **notModeled**     | 4        | Triggered by picking up Elemental Orbs/Particles.               | We don't model particle pickups, and this extension comes from picking up Elemental Orbs and Particles. |
| C1     | Gleeful Songs                | **notModeled**     | 2        | Periodic self energy regeneration; the planner draws no energy. | We don't track energy, so the planner doesn't draw the Energy this restores.                            |
| C6     | Dedicating Everything to You | **notModeled**     | existing | 'party members falls… Automatically revives' — revive.          | We don't model characters falling in battle, so this revive has nothing to show.                        |

### beidou

| column | host                                       | call           | class    | why                                                                                                | reason (rendered)                                                                                        |
| ------ | ------------------------------------------ | -------------- | -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A1     | Retribution                                | **notModeled** | existing | 'Counterattacking… at the precise moment when the character is hit' — taking hits isn't simulated. | We don't model Beidou being hit, so the perfectly timed counter this rewards can't happen in a rotation. |
| C2     | Upon the Turbulent Sea, the Thunder Arises | **notModeled** | existing | 'arc lightning can jump to 2 additional targets' — single-opponent model.                          | We model a single opponent, so there are no extra targets for the lightning to jump to.                  |
| C4     | Stunning Revenge                           | **notModeled** | existing | 'Upon being attacked' — curator: 'Intentionally not authored… taking damage isn't simulated'.      | We don't model Beidou being hit, so the extra Electro damage this gives her Normal Attacks isn't shown.  |

### bennett

| column   | host                 | call               | class | why                                                                                                                      | reason (rendered) |
| -------- | -------------------- | ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| E.grants | Passion Overload     | **nothingToModel** |       | Press/Hold strikes deal Pyro DMG only; variants carry timing + application.                                              |                   |
| extra    | It Should Be Safe... | **nothingToModel** |       | 'expedition… time consumed is reduced by 25%'.                                                                           |                   |
| C2       | Impasse Conqueror    | **missing**        |       | 'HP falls below 70%, ER +30%' — self energyRecharge passive with selfHpBelow 70 (renders optimistically).                |                   |
| C4       | Unexpected Odyssey   | **missing**        |       | C4 follow-up Pyro hit on h1E; curator: express as constellation-gated variant of the hold (third 1U application at f94). |                   |

### candace

| column | host                     | call           | class    | why                                                                                                   | reason (rendered)                                                                      |
| ------ | ------------------------ | -------------- | -------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A1     | Aegis of Crossed Arrows  | **notModeled** | existing | 'hit by an attack in the Hold duration' — taking hits isn't simulated.                                | We don't model Candace being hit, so her Hold Skill always takes its full charge time. |
| A4     | Celestial Dome of Sand   | **missing**    |          | Active normalDmgBonus (elemental NA) scaling 0.5% per 1000 Max HP during Prayer of the Crimson Crown. |                                                                                        |
| C2     | Moon-Piercing Brilliance | **missing**    |          | 'Max HP increased by 20% for 15s' — self hp buff onHit skill (hold), 15s.                             |                                                                                        |

### charlotte

| column | host                        | call           | class    | why                                                                                                 | reason (rendered)                                                                                                                        |
| ------ | --------------------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A1     | Moment of Impact            | **notModeled** | existing | 'When opponents marked… are defeated' — opponent defeat isn't simulated.                            | We don't model opponents being defeated, so this cooldown reduction can't trigger.                                                       |
| C2     | A Duty to Pursue Truth      | **missing**    |          | 'ATK +10%/20%/30% by opponents hit, 12s' — single-target model gives self atk +10% onHit skill 12s. |                                                                                                                                          |
| C4     | A Responsibility to Oversee | **notModeled** | 1        | +10% DMG on the burst (one named attack) and 2 Energy (class 2); both ruled.                        | We don't draw damage amounts or track energy, and this only makes Still Photo: Comprehensive Confirmation hit harder and restore Energy. |

### chasca

| column   | host                            | call               | class | why                                                                                                                                                                       | reason (rendered)                                                                                                                                                                                               |
| -------- | ------------------------------- | ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q.grants | Soul Reaper's Fatal Round       | **nothingToModel** |       | Damage only; team-element shell conversion is an application question.                                                                                                    |                                                                                                                                                                                                                 |
| A1       | Bullet Trick                    | **notModeled**     | 5     | Spiritbinding Conversion is a chance; the stacks only raise Shining Shell DMG (class 1).                                                                                  | We don't simulate chance, so two people planning the same rotation always see the same bars — Spiritbinding Conversion is a chance. The stacks only raise Shining Shadowhunt Shell damage, which we don't draw. |
| A4       | Intent to Cover                 | **missing**        |       | 'party member triggers a Nightsoul Burst… fire a Burning Shadowhunt Shot' — damage proc on onTeamNightsoulBurst; element via teamElementPriority (ElementRef now exists). |                                                                                                                                                                                                                 |
| C1       | Cylinder, the Restless Roulette | **notModeled**     | 5     | Raises a chance, converts a shell only when that chance lands; exploration half is nothing.                                                                               | We don't simulate chance, so two people planning the same rotation always see the same bars — the extra Shining Shadowhunt Shell depends on Spiritbinding Conversion, which is a chance.                        |
| C2       | Muzzle, the Searing Smoke       | **missing**        |       | Field-entry Spirit stack + 400% ATK elemental AoE per Multitarget Fire — unmodeled bullet system.                                                                         |                                                                                                                                                                                                                 |
| C4       | Sparks, the Sudden Shot         | **missing**        |       | 1.5 Energy per Radiant Shell hit + one 400% ATK elemental AoE per burst — energy + damage proc with application onHit burst.                                              |                                                                                                                                                                                                                 |
| C6       | Showdown, the Glory of Battle   | **missing**        |       | 'Fatal Rounds' 3s state: instant charge + CRIT DMG +120%; gated on Spiritbinding Conversion (unmodeled).                                                                  |                                                                                                                                                                                                                 |

### chevreuse

| column   | host                                | call               | class | why                                                                                                                      | reason (rendered) |
| -------- | ----------------------------------- | ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| Q.grants | Ring of Bursting Grenades           | **nothingToModel** |       | 'AoE Pyro DMG… secondary explosive shells' — damage only.                                                                |                   |
| C4       | The Secret to Rapid-Fire Multishots | **missing**        |       | 'Hold mode… will not go on cooldown… removed after fired twice or 6s' — state window + bypassesCooldown on hold variant. |                   |

### chiori

| column | host                        | call        | class | why                                                                                            | reason (rendered) |
| ------ | --------------------------- | ----------- | ----- | ---------------------------------------------------------------------------------------------- | ----------------- |
| C4     | A Tailor's Three Courtesies | **missing** |       | Kinu summons on N/C/P hits after Tailor-Made; depends on A1's Tailor-Made windows (unmodeled). |                   |

### chongyun

| column   | host                             | call               | class    | why                                                                                                                   | reason (rendered)                                                                              |
| -------- | -------------------------------- | ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Q.grants | Spirit Blade: Cloud-Parting Star | **nothingToModel** |          | 'deal AoE Cryo DMG and launch opponents' — damage only.                                                               |                                                                                                |
| A1       | Steady Breathing                 | **notModeled**     | existing | 'Normal ATK SPD increased by 8%' — attack speed is not a Stat; rubric out of scope.                                   | We don't model attack speed, so Normal Attacks inside the Frost Field keep their usual timing. |
| C1       | Ice Unleashed                    | **missing**        |          | 3 Cryo blades on N4 (ICDTagNone, 1U each); curator: no arming path for a constellation-hosted swing proc. Engine gap. |                                                                                                |
| C2       | Atmospheric Revolution           | **missing**        |          | 'cast within the Frost Field… CD decreased by 15%' — CLAUDE.md names Chongyun C2 a WISHLIST third shape.              |                                                                                                |
| C6       | Rally of Four Blades             | **missing**        |          | 4th spirit blade at f77 = constellation-gated application entry; HP-comparison DMG% renders optimistically.           |                                                                                                |

### citlali

| column   | host                                | call           | class | why                                                                                                                               | reason (rendered)                                                                                                                                |
| -------- | ----------------------------------- | -------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q.grants | Edict of Entwined Splendor          | **notModeled** | 3     | Only non-damage grant is Nightsoul points, a pool with no reader.                                                                 | We don't track Nightsoul points, so the points this burst restores to Citlali aren't shown.                                                      |
| A4       | Itzpapalotl's Star Garments         | **notModeled** | 1     | EM-scaled DMG on two named attacks plus Nightsoul points (class 3).                                                               | We don't draw damage amounts, and this only raises how hard Itzpapa's Frostfall Storm and Ice Storm hit. We don't track Nightsoul points either. |
| C1       | Radiant Blades of Centzon Mimixcoah | **missing**    | 9     | 10-stack pool spent by teammates' hits for +200% EM flat DMG; poolsAtHome now spends on teammate hits; no all-class FlatDmg stat. |                                                                                                                                                  |
| C6       | Teoiztac's Secret Pact              | **notModeled** | 8     | Nate ruling: Cifra builds from Nightsoul consumption, a pool with no reader; retired-creed note carries no weight.                | We don't track Nightsoul points, and the Cifra of the Secret Law behind this Pyro and Hydro DMG Bonus builds from the points Itzpapa consumes.   |

### clorinde

| column   | host                                | call           | class | why                                                                                                 | reason (rendered)                                                                |
| -------- | ----------------------------------- | -------------- | ----- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| E.grants | Impale the Night                    | **notModeled** | 4     | Heal and hit count scale with Bond of Life.                                                         | We don't model Bond of Life, which decides how much this lunge heals Clorinde.   |
| Q.grants | Last Lightfall                      | **notModeled** | 4     | Only grant is 'a Bond of Life based upon her own max HP'; rubric out of scope.                      | We don't model Bond of Life, so the Bond of Life this burst grants isn't shown.  |
| C4       | "To Enshrine Tears, Life, and Love" | **notModeled** | 4     | 'Every 1% of her current Bond of Life will increase Last Lightfall DMG' — curator: 'BoL exception'. | We don't model Bond of Life, which this constellation's damage bonus depends on. |

### collei

| column | host                   | call                                           | class | why                                                                                                                        | reason (rendered) |
| ------ | ---------------------- | ---------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| A4     | The Languid Wood       | **modeledBy** `collei__burst__trumpcard_kitty` | 6     | Burst summon durationExtensions draw the +1s per Dendro reaction, max 3.                                                   |                   |
| C1     | Deepwood Patrol        | **missing**                                    |       | 'not on the field, ER increased by 20%' — self energyRecharge passive gated offField.                                      |                   |
| C2     | Through Hill and Copse | **missing**                                    |       | Sprout unconditional + one-shot 3s extension; curator restore path: constellation-gated variant with a summon tick series. |                   |

### columbina

| column | host                | call           | class    | why                                                                            | reason (rendered)                                                                                                                                                                                              |
| ------ | ------------------- | -------------- | -------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A4     | Law of the New Moon | **notModeled** | 5        | Two 33% extra-hit chances plus Moonridge Dew, a pool with no reader (class 3). | We don't simulate chance, so two people planning the same rotation always see the same bars — two of these effects are 33% chances of an extra hit. The third builds Moonridge Dew, a resource we don't track. |
| extra  | Lunar Vigil         | **notModeled** | existing | 'will revive this character' — revive; also disabled in Domains/Abyss.         | We don't model characters falling in battle, so this revive has nothing to show.                                                                                                                               |

### cyno

| column   | host                                   | call                                                       | class | why                                                                                                                                 | reason (rendered) |
| -------- | -------------------------------------- | ---------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| E.grants | Mortuary Rite                          | **modeledBy** `cyno__burst__sacred_rite_wolfs_swiftness`   | 6     | The stance extension is drawn via the burst's durationExtensions (onCast skill, +4s, max 2).                                        |                   |
| A1       | Featherfall Judgment                   | **missing**                                                |       | Judication +35% skill DMG + 3 Duststalker Bolts (Electro); existing caveat 'Not modeled: the Duststalker Bolts'.                    |                   |
| extra    | A Star With Which to Start the Journey | **modeledBy** `cyno__skill__secret_rite_chasmic_soulfarer` | 6     | The 6s Pactsworn Pathclearer is drawn via the skill's opensTransientState; Radiance clause is only a gate.                          |                   |
| C6       | Raiment: Just Scales                   | **missing**                                                |       | Day of the Jackal: 4 stacks onCast burst, consumed per NA hit to fire a bolt (0.4s) — gainStacks/consumeStacks onHit + damage proc. |                   |

### dahlia

| column   | host                       | call           | class    | why                                                                                                                               | reason (rendered)                                                                                            |
| -------- | -------------------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| E.grants | Immersive Ordinance        | **missing**    |          | Sacramental Shower summon removed for lack of a lifetime source ('Re-add when KQM / in-game data lands').                         |                                                                                                              |
| A1       | The Wind's Gentle Grace    | **missing**    |          | 'trigger Frozen… grant Dahlia 2 Benison stacks, once every 8s' — gainStacks onReaction frozen, procCooldown 8. Benison unmodeled. |                                                                                                              |
| A4       | Prayer of Well-Wrought Joy | **notModeled** | existing | ATK SPD is not modeled.                                                                                                           | We don't model attack speed, so Normal Attacks keep their usual timing under this bonus.                     |
| C1       | Infallible Procession      | **notModeled** | 2        | Energy per Benison stack; the planner draws no energy.                                                                            | We don't track energy, so the planner doesn't draw the Energy this restores.                                 |
| C2       | Revelation of Mercy        | **notModeled** | 1        | Shield Strength is a magnitude on one shield; bar span unchanged (class 1 by analogy).                                            | We don't draw shield strength, and this only makes the Shield of Sacred Favor sturdier.                      |
| C4       | Collect of the Assembly    | **missing**    |          | 'Favonian Favor lasts 3 more seconds' — needs the Favonian Favor window authored first (burst has only the shield).               |                                                                                                              |
| C6       | You Shall Go Out With Joy  | **notModeled** | existing | ATK SPD (not a Stat) + revive (curator: 'caveat-only… no on-death trigger').                                                      | We don't model attack speed or characters falling in battle, so neither half of this constellation is drawn. |

### dehya

| column   | host                          | call               | class | why                                                                                                                                     | reason (rendered)                                                                                                                                                                                                      |
| -------- | ----------------------------- | ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E.grants | Molten Inferno: Ranging Flame | **nothingToModel** |       | Relocates Fiery Sanctum, which 'inherit[s] the remaining duration' — window unchanged. Curator notes a 0.4s pickup extension unmodeled. |                                                                                                                                                                                                                        |
| A1       | Unstinting Succor             | **nothingToModel** |       | 'take 60% less DMG… from Redmane's Blood' + interruption resistance.                                                                    |                                                                                                                                                                                                                        |
| C6       | The Burning Claws Cleaving    | **notModeled**     | 5     | Leonine Bite-only CRIT Rate (class 1) plus CRIT-triggered CRIT DMG and stance extensions.                                               | We don't simulate chance, so two people planning the same rotation always see the same bars — the extra Blazing Lioness time comes from CRIT hits. Its CRIT Rate bonus covers Leonine Bite alone, which we don't draw. |

### diluc

| column   | host                               | call               | class    | why                                                                                      | reason (rendered)                                                                            |
| -------- | ---------------------------------- | ------------------ | -------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| E.grants | Searing Onslaught (E1)             | **nothingToModel** |          | First slash, Pyro DMG only.                                                              |                                                                                              |
| E.grants | Searing Onslaught (E2)             | **nothingToModel** |          | Second slash, Pyro DMG only.                                                             |                                                                                              |
| E.grants | Searing Onslaught (E3)             | **nothingToModel** |          | Final slash, Pyro DMG only.                                                              |                                                                                              |
| A1       | Relentless                         | **nothingToModel** |          | 'Charged Attack Stamina Cost is decreased by 50%' — stamina.                             |                                                                                              |
| C2       | Searing Ember                      | **notModeled**     | existing | 'When Diluc takes DMG' — taking damage isn't simulated.                                  | We don't model Diluc taking damage, so this ATK bonus can't trigger.                         |
| C4       | Flowing Flame                      | **notModeled**     | 1        | +40% DMG on the next Searing Onslaught press, one named attack.                          | We don't draw damage amounts, and this only raises how hard the next Searing Onslaught hits. |
| C6       | Flaming Sword, Nemesis of the Dark | **missing**        |          | Next 2 NAs within 6s +30% DMG — normalDmgBonus onCast skill 6s; ATK SPD half not a Stat. |                                                                                              |

### diona

| column | host                   | call               | class | why                                                                                                                         | reason (rendered)                                                                                                                                              |
| ------ | ---------------------- | ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1     | Cat's Tail Secret Menu | **nothingToModel** |       | Movement SPD +10% and Stamina Consumption −10%.                                                                             |                                                                                                                                                                |
| A4     | Drunkards' Farce       | **nothingToModel** |       | 'Opponents… 10% decreased ATK' — no enemy-ATK stat we draw (also not in gcsim).                                             |                                                                                                                                                                |
| extra  | Choice Treasures       | **missing**        |       | Reaction-fired Icy Paws (3 hits, 3.5s CD, 20s after skill); curator: no source gives their gauge, so unauthored.            |                                                                                                                                                                |
| C2     | Shaken, Not Purred     | **notModeled**     | 1     | Icy Paws DMG and shield absorption are magnitudes; splash shield is co-op only.                                             | We don't draw damage amounts or shield strength, and this only strengthens Icy Paws and its shield. The shield it gives other characters only exists in co-op. |
| C4     | Wine Industry Slayer   | **missing**        |       | Aimed shot charge −60% in burst field — faster frames (gcsim aimedC4Frames) as a gated variant; positional 'within radius'. |                                                                                                                                                                |

### dori

| column   | host                                       | call               | class | why                                                                                                            | reason (rendered)                                                            |
| -------- | ------------------------------------------ | ------------------ | ----- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| E.grants | Spirit-Warding Lamp: Troubleshooter Cannon | **nothingToModel** |       | Troubleshooter Shot + After-Sales Rounds deal Electro DMG only.                                                |                                                                              |
| A1       | An Eye for Gold                            | **missing**        |       | 'triggers [Electro reactions]… CD decreased by 1s, once every 3s' — cooldownReduce onReaction, procCooldown 3. |                                                                              |
| A4       | Compound Interest                          | **notModeled**     | 2     | Energy restoration scaled by ER; the planner draws no energy.                                                  | We don't track energy, so the planner doesn't draw the Energy this restores. |
| C1       | Additional Investment                      | **missing**        |       | 'After-Sales Service Rounds increased by 1' — constellation-gated extra application entry.                     |                                                                              |
| C2       | Special Franchise                          | **missing**        |       | Jinni Toop fires on each Jinni heal (6× Electro 1U); curator restore path: Jinni as a summon tick series.      |                                                                              |
| C4       | Discretionary Supplement                   | **missing**        |       | HP<50%: +50% incomingHealingBonus (authorable, optimistic); Energy<50%: +30% ER (no energy state).             |                                                                              |

### durin

| column | host                        | call           | class | why                                                                                                                   | reason (rendered)                                                                                                   |
| ------ | --------------------------- | -------------- | ----- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| A4     | Chaos Formed Like the Night | **notModeled** | 1     | DMG amp on the dragons' ticks only: named-attack damage magnitude.                                                    | We don't draw damage amounts, and this only raises how hard the Dragon of White Flame and Dragon of Dark Decay hit. |
| C1     | Adamah's Redemption         | **missing**    | 9     | Curator: 'the gap here is only a missing all-attack-class FlatDmg Stat key' — 20s team/self flat DMG stacks on burst. |                                                                                                                     |

### emilie

| column | host                     | call        | class | why                                                                                                                        | reason (rendered) |
| ------ | ------------------------ | ----------- | ----- | -------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| A1     | Lingering Fragrance      | **missing** |       | Cleardew Cologne (Dendro 1U); curator refused: Scent accrual needs a Burning-opponent gate we lack. Engine gap, not scope. |                   |
| C1     | Light Fragrance Leaching | **missing** |       | +20% DMG to two named attacks + extra Scent every 2.9s; Scent/Cologne unmodeled.                                           |                   |

### escoffier

| column | host                   | call        | class | why                                                                                                                    | reason (rendered) |
| ------ | ---------------------- | ----------- | ----- | ---------------------------------------------------------------------------------------------------------------------- | ----------------- |
| C4     | Secret Rosemary Recipe | **missing** |       | 'Rehab Diet lasts 6 more seconds' — heal duration extension. Crit-Rate chance heal/energy is RNG (curator: 'Skipped'). |                   |

### eula

| column | host                   | call           | class | why                                                                                                                                      | reason (rendered)                                                                                                                                                                                                |
| ------ | ---------------------- | -------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1     | Roiling Rime           | **missing**    |       | Shattered Lightfall Sword (Physical hit) when hold E spends 2 Grimheart; Grimheart unmodeled.                                            |                                                                                                                                                                                                                  |
| A4     | Wellspring of War-Lust | **missing**    |       | 'When Glacial Illumination is cast, CD of Icetide Vortex reset + 1 Grimheart' — cdReset (resetsAbility skill) + gainStacks onCast burst. |                                                                                                                                                                                                                  |
| C1     | Tidal Illusion         | **missing**    | 9     | 'Physical DMG +30% for 6s' per Grimheart consumed — self physical DMG buff onCast hold E; no physicalDmgBonus stat exists.               |                                                                                                                                                                                                                  |
| C2     | Lady of Seafoam        | **missing**    |       | Hold variant cooldown 10 regardless of C2; curator: 'Schema has no cooldownModifiers on variants'.                                       |                                                                                                                                                                                                                  |
| C6     | Noble Obligation       | **notModeled** | 5     | Extra Lightfall Sword stacks are a 50% chance; starting stacks are damage magnitude.                                                     | We don't simulate chance, so two people planning the same rotation always see the same bars — the extra Lightfall Sword stacks are a 50% chance. The starting stacks only raise its damage, which we don't draw. |

### faruzan

| column   | host                    | call           | class | why                                                                                                              | reason (rendered)                                                            |
| -------- | ----------------------- | -------------- | ----- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| E.grants | Wind Realm of Nasamjnin | **missing**    |       | Manifest Gale 18s state + Pressurized Collapse Anemo vortex; existing caveat names the Hurricane Arrow gap.      |                                                                              |
| A1       | Impetuous Flow          | **missing**    |       | A1 Perfidious Wind's Bale via the vortex — Anemo resShred without burst; faster charge. Vortex chain unauthored. |                                                                              |
| C1       | Truth by Any Means      | **missing**    |       | Two Hurricane Arrows per Manifest Gale — depends on the unmodeled Manifest Gale state.                           |                                                                              |
| C4       | Divine Comprehension    | **notModeled** | 2     | Energy per vortex hit; the planner draws no energy.                                                              | We don't track energy, so the planner doesn't draw the Energy this restores. |

### fischl

| column | host                 | call           | class    | why                                                                                                                                | reason (rendered)                                                                                 |
| ------ | -------------------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A1     | Stellar Predator     | **notModeled** | existing | Needs a charged Aimed Shot to hit Oz: aim/position.                                                                                | We don't model where a shot lands, and this needs a fully charged Aimed Shot to hit Oz.           |
| C1     | Gaze of the Deep     | **missing**    |          | 'Normal Attack… Oz fires a coordinated attack, 22% ATK' — physical proc onHit normal; application-less damage fires nothing today. |                                                                                                   |
| C2     | Devourer of All Sins | **notModeled** | 1        | Named-attack damage and AoE size on Nightrider's summoning hit.                                                                    | We don't draw damage amounts, and this only makes Nightrider's summoning hit stronger and larger. |

### flins

| column   | host                             | call               | class | why                                                                   | reason (rendered) |
| -------- | -------------------------------- | ------------------ | ----- | --------------------------------------------------------------------- | ----------------- |
| Q.grants | Ancient Ritual: Cometh the Night | **nothingToModel** |       | Lunar-Charged DMG only; Thunderous Symphony is timing, already drawn. |                   |

### freminet

| column   | host                              | call           | class    | why                                                                                           | reason (rendered)                                                                           |
| -------- | --------------------------------- | -------------- | -------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| E.grants | Pressurized Floe                  | **missing**    |          | Pers Timer state, frost-wave proc with application and Spiritbreath Thorn hit are unauthored. |                                                                                             |
| A1       | Saturation Deep Dive              | **missing**    |          | 1s cooldown reduction on Shattering Pressure; cooldownReduce onCast is authorable.            |                                                                                             |
| A4       | Parallel Condensers               | **notModeled** | existing | Triggers on Shatter, which we don't model; bonus is also scoped to one attack.                | We don't model Shatter, which triggers this bonus.                                          |
| C1       | Dreams of the Foamy Deep          | **notModeled** | 1        | Shattering Pressure-only CRIT Rate.                                                           | We don't draw damage amounts, and this CRIT Rate bonus only applies to Shattering Pressure. |
| C2       | Penguins and the Land of Plenty   | **notModeled** | 2        | Energy restoration only.                                                                      | We don't track energy, so the planner doesn't draw the Energy this restores.                |
| C4       | Dance of the Snowy Moon and Flute | **missing**    |          | ATK% stacks after Frozen/Superconduct; onReaction self buff is authorable.                    |                                                                                             |

### furina

| column | host                                           | call           | class    | why                                                                                            | reason (rendered)                                                                                   |
| ------ | ---------------------------------------------- | -------------- | -------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A1     | Endless Waltz                                  | **notModeled** | existing | Triggered by overflow healing; heal-event triggers are ruled out.                              | This heal is triggered by overflow healing from other sources, and we don't track healing received. |
| A4     | Unheard Confession                             | **missing**    |          | Singer heal interval cut is drawable (tick marks); Salon DMG +28% part is ruled out (class 1). |                                                                                                     |
| C1     | "Love Is a Rebellious Bird That None Can Tame" | **notModeled** | 3        | Fanfare gain and limit only; Fanfare is untracked.                                             | We don't track Fanfare, which is all this constellation changes.                                    |
| C2     | "A Woman Adapts Like Duckweed in Water"        | **notModeled** | 3        | Fanfare from party HP changes and HP% from overflow Fanfare; pool and HP events untracked.     | We don't track Fanfare or party HP changes, so the Max HP this grants isn't shown.                  |

### gaming

| column   | host                    | call           | class    | why                                                                                                   | reason (rendered)                                                                       |
| -------- | ----------------------- | -------------- | -------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| E.grants | Bestial Ascent          | **missing**    |          | Charmed Cloudstrider plunge Pyro conversion unauthored.                                               |                                                                                         |
| A4       | Air of Prosperity       | **missing**    |          | Incoming Healing Bonus under 50% HP is authorable; Cloudstrider-only DMG part is ruled out (class 1). |                                                                                         |
| C2       | Plum Blossoms Underfoot | **notModeled** | existing | Overflow-heal trigger; heal-event triggers are ruled out.                                             | This triggers on overflow healing Gaming receives, and we don't track healing received. |
| C4       | Soar Across Mountains   | **notModeled** | 2        | Energy restoration only; area/other parts nothing to draw.                                            | We don't track energy, so the planner doesn't draw the Energy this restores.            |
| C6       | To Tame All Beasts      | **notModeled** | 1        | Charmed Cloudstrider-only CRIT.                                                                       | We don't draw damage amounts, and this CRIT bonus only applies to Charmed Cloudstrider. |

### ganyu

| column | host                   | call               | class    | why                                                                                  | reason (rendered)                                                                                |
| ------ | ---------------------- | ------------------ | -------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| A1     | Undivided Heart        | **notModeled**     | 1        | Frostflake Arrow-only CRIT Rate.                                                     | We don't draw damage amounts, and this CRIT Rate bonus only applies to Frostflake Arrows.        |
| extra  | Preserved for the Hunt | **nothingToModel** |          | Crafting refund.                                                                     |                                                                                                  |
| C4     | Westward Sojourn       | **notModeled**     | existing | DMG-taken ramp depends on opponents staying inside the field; position is ruled out. | This depends on how long opponents stay inside Celestial Shower, and we don't model positioning. |
| C6     | The Clement            | **missing**        |          | Q opens a 30s state for an uncharged Frostflake Arrow; authorable.                   |                                                                                                  |

### gorou

| column | host                             | call        | class | why                                                                                      | reason (rendered) |
| ------ | -------------------------------- | ----------- | ----- | ---------------------------------------------------------------------------------------- | ----------------- |
| C1     | Rushing Hound: Swift as the Wind | **missing** |       | Cooldown reduction on others' Geo DMG; cooldownReduce onHit is authorable.               |                   |
| C2     | Sitting Hound: Steady as a Clock | **missing** |       | Lunar-Crystallize extension is authorable; the shard-pickup half is ruled out (class 4). |                   |

### hu_tao

| column | host                   | call               | class    | why                                                                            | reason (rendered)                                                                                |
| ------ | ---------------------- | ------------------ | -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| C1     | Crimson Bouquet        | **nothingToModel** |          | Stamina.                                                                       |                                                                                                  |
| C2     | Ominous Rainfall       | **missing**        |          | Blood Blossom unauthored; C2 makes Spirit Soother apply it (Pyro application). |                                                                                                  |
| C4     | Garden of Eternal Rest | **notModeled**     | existing | Triggers on opponent defeat.                                                   | This triggers when an opponent is defeated, and we don't model opponents being defeated.         |
| C6     | Butterfly's Embrace    | **notModeled**     | existing | Revive plus HP-drop trigger; both ruled out.                                   | This triggers when Hu Tao's HP drops below 25% or she takes a lethal hit, and we don't track HP. |

### iansan

| column | host                          | call           | class | why                                                                        | reason (rendered)                                                                                |
| ------ | ----------------------------- | -------------- | ----- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| C1     | Starting's Never Easy         | **notModeled** | 2     | Energy per Nightsoul points consumed; energy and Nightsoul both untracked. | We don't track energy or Nightsoul points, so the planner doesn't draw the Energy this restores. |
| C4     | Slow and Steady Wins the Race | **notModeled** | 3     | Surging Force only feeds Scale Nightsoul restoration.                      | We don't track Nightsoul points, which is all this constellation changes.                        |

### ifa

| column   | host                               | call           | class | why                                                                                                      | reason (rendered)                                                                                                              |
| -------- | ---------------------------------- | -------------- | ----- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Q.grants | Compound Sedation Field            | **missing**    |       | Absorbed-element Sedation Mark hit waits on absorption; the pull (grouping) part is ruled out (class 7). |                                                                                                                                |
| C2       | Guiding Spirit of Ballistic Prayer | **notModeled** | 3     | Only raises Rescue Essentials gain and cap; pool untracked.                                              | We don't track Nightsoul points or Rescue Essentials, which is all this constellation changes.                                 |
| C6       | Oath on a Feathered Knot           | **notModeled** | 5     | 50% chance extra shot.                                                                                   | This extra shot fires on a 50% chance. We don't simulate chance, so the same rotation always draws the same bars for everyone. |

### illuga

| column   | host                    | call                                                   | class | why                                                                                                  | reason (rendered) |
| -------- | ----------------------- | ------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------- | ----------------- |
| E.grants | Dawnbearing Songbird    | **modeledBy** `illuga__passive__torchforgers_covenant` | 6     | Lightkeeper's Oath is drawn from the Torchforger's Covenant passive; Aedon's hit is the cast itself. |                   |
| A4       | Demonhunter's Dusk      | **missing**                                            | 9     | Nightingale's Song EM-scaled Geo DMG add needs a Geo flat-DMG stat that doesn't exist.               |                   |
| C2       | Elk With Fanged Antlers | **missing**                                            |       | Aedon strike per 7 Nightingale's Song consumed; needs a drain-threshold trigger, not ruled out.      |                   |

### ineffa

| column | host                 | call        | class | why                                                                              | reason (rendered) |
| ------ | -------------------- | ----------- | ----- | -------------------------------------------------------------------------------- | ----------------- |
| A1     | Overclocking Circuit | **missing** |       | Extra Lunar-Charged hit per Birgitta discharge under a thundercloud; unauthored. |                   |

### jahoda

| column | host                     | call           | class | why                                                                          | reason (rendered)                                                                                                            |
| ------ | ------------------------ | -------------- | ----- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A1     | Plan to Get Paid         | **missing**    |       | Robot count/interval by party elements; robot damage series unauthored.      |                                                                                                                              |
| A4     | Sweet Berry Bounty       | **missing**    |       | EM buff per robot heal tick; waits on a summon-tick buff collector (queued). |                                                                                                                              |
| C1     | One More Flask!          | **notModeled** | 5     | 50% chance bounce.                                                           | This bounce happens on a 50% chance. We don't simulate chance, so the same rotation always draws the same bars for everyone. |
| C2     | Rogue's Quick Thinking   | **missing**    |       | Second robot enhancement under Moonsign; same gap as A1.                     |                                                                                                                              |
| C4     | Wild Berry Amid the Dust | **notModeled** | 2     | Energy on robot Elemental Conversion only.                                   | We don't track energy, so the planner doesn't draw the Energy this restores.                                                 |
| C6     | The Littlest Luck        | **missing**    |       | Team CRIT when the flask fills; waits on the absorption round.               |                                                                                                                              |

### jean

| column   | host                                     | call           | class | why                                                                    | reason (rendered)                                                                                  |
| -------- | ---------------------------------------- | -------------- | ----- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| E.grants | Gale Blade                               | **notModeled** | 7     | Hold pull is grouping; otherwise damage only.                          | We don't model pulling opponents together, which is all holding Gale Blade adds beyond its damage. |
| A4       | Let the Wind Lead                        | **notModeled** | 2     | Energy regeneration only.                                              | We don't track energy, so the planner doesn't draw the Energy this restores.                       |
| C1       | Spiraling Tempest                        | **notModeled** | 1     | Held Gale Blade +40% DMG on one attack; pull speed nothing to draw.    | We don't draw damage amounts, and this only raises how hard a held Gale Blade hits.                |
| C2       | People's Aegis                           | **notModeled** | 4     | Particle-pickup trigger granting Movement and ATK SPD; both ruled out. | This triggers on picking up Energy particles, and we don't model particles or ATK SPD.             |
| C6       | Lion's Fang, Fair Protector of Mondstadt | **missing**    | 9     | Field DMG reduction needs a DMG-reduction stat that doesn't exist.     |                                                                                                    |

### kachina

| column   | host                                     | call               | class | why                                                                                           | reason (rendered)                                                              |
| -------- | ---------------------------------------- | ------------------ | ----- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Q.grants | Time to Get Serious!                     | **nothingToModel** |       | Only enlarges Turbo Twirly's AoE and Movement SPD.                                            |                                                                                |
| A4       | The Weight of Stone                      | **notModeled**     | 1     | Flat DMG on Turbo Twirly only (folded into its tick's flatScaling, which draws no pixel).     | We don't draw damage amounts, and this only raises how hard Turbo Twirly hits. |
| C1       | Shards Are Gems Too                      | **notModeled**     | 2     | Energy on shard pickup or Lunar-Crystallize only.                                             | We don't track energy, so the planner doesn't draw the Energy this restores.   |
| C2       | Never Leave Home Without... Turbo Twirly | **missing**        |       | C2-gated Turbo Twirly summon on burst is authorable; Nightsoul regain is ruled out (class 3). |                                                                                |

### kaedehara_kazuha

| column   | host                 | call           | class | why                                                                                         | reason (rendered)                                                            |
| -------- | -------------------- | -------------- | ----- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| E.grants | Chihayaburu          | **missing**    |       | Midare Ranzan Anemo conversion unauthored; the pull (grouping) part is ruled out (class 7). |                                                                              |
| A1       | Soumon Swordsmanship | **missing**    |       | Absorbed-element plunge hit waits on the absorption round.                                  |                                                                              |
| C4       | Oozora Genpou        | **notModeled** | 2     | Energy on skill cast only; gliding regen is nothing to draw.                                | We don't track energy, so the planner doesn't draw the Energy this restores. |

### kaeya

| column   | host                     | call               | class    | why                                          | reason (rendered)                                                                                      |
| -------- | ------------------------ | ------------------ | -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| E.grants | Frostgnaw                | **nothingToModel** |          | Damage only; A4 particles on their own host. |                                                                                                        |
| A4       | Glacial Heart            | **notModeled**     | 4        | Extra particles from frozen opponents.       | We don't model Energy particles, so the extra particles this drops aren't shown.                       |
| C2       | Never-Ending Performance | **notModeled**     | existing | Extends the burst per opponent defeated.     | This extends the burst only when an opponent is defeated, and we don't model opponents being defeated. |

### kamisato_ayaka

| column   | host                              | call               | class | why                                                                     | reason (rendered)                                                                                                               |
| -------- | --------------------------------- | ------------------ | ----- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| E.grants | Kamisato Art: Hyouka              | **nothingToModel** |       | Damage only; A1 on its own host.                                        |                                                                                                                                 |
| A1       | Amatsumi Kunitsumi Sanctification | **missing**        |       | N/CA +30% DMG for 6s after E; authorable.                               |                                                                                                                                 |
| A4       | Kanten Senmyou Blessing           | **missing**        |       | Dash-hit Cryo DMG Bonus needs a dash-hit trigger; stamina part nothing. |                                                                                                                                 |
| C1       | Snowswept Sakura                  | **notModeled**     | 5     | 50% chance cooldown reduction (Ayaka C1 precedent).                     | This cuts the cooldown on a 50% chance. We don't simulate chance, so the same rotation always draws the same bars for everyone. |
| C2       | Blizzard Blade Seki no To         | **missing**        |       | Two extra storms, C2-gated application on the burst; authorable.        |                                                                                                                                 |
| C6       | Dance of Suigetsu                 | **missing**        |       | Recurring Usurahi Butou state consumed by a CA hit; authorable.         |                                                                                                                                 |

### kamisato_ayato

| column | host                                    | call           | class    | why                                                            | reason (rendered)                                                            |
| ------ | --------------------------------------- | -------------- | -------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A1     | Kamisato Art: Mine Wo Matoishi Kiyotaki | **missing**    |          | Namisen stacks feed C2's HP buff; stack machinery exists.      |                                                                              |
| A4     | Kamisato Art: Michiyuku Hagetsu         | **notModeled** | 2        | Periodic off-field Energy regen only.                          | We don't track energy, so the planner doesn't draw the Energy this restores. |
| C2     | World Source                            | **missing**    |          | HP% buff at 3+ Namisen stacks; depends on Namisen.             |                                                                              |
| C4     | Endless Flow                            | **notModeled** | existing | Normal Attack SPD.                                             | We don't model attack speed, so this Normal Attack SPD bonus isn't shown.    |
| C6     | Boundless Origin                        | **missing**    |          | Two Hydro strikes on first Shunsuiken hit after E; authorable. |                                                                              |

### kaveh

| column   | host                 | call           | class    | why                                                                                                  | reason (rendered)                                                         |
| -------- | -------------------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| E.grants | Artistic Ingenuity   | **missing**    |          | Cores are drawn in the gadget row; bursting them early is modelable. Skip-creed rationale discarded. |                                                                           |
| C1       | Sublime Salutations  | **missing**    |          | Dendro RES + Incoming Healing Bonus after E; authorable.                                             |                                                                           |
| C2       | Grace of Royal Roads | **notModeled** | existing | Normal Attack SPD.                                                                                   | We don't model attack speed, so this Normal Attack SPD bonus isn't shown. |
| C4       | Feast of Apadana     | **missing**    |          | Bloom/Lunar-Bloom reaction bonus for his cores; authorable.                                          |                                                                           |

### keqing

| column   | host                        | call               | class | why                                                                                                 | reason (rendered)                                                                                                                      |
| -------- | --------------------------- | ------------------ | ----- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| E.grants | Stellar Restoration         | **missing**        | 6     | Stiletto window drawn via chainStage, but CA-consumes-Stiletto is unauthored, so only partly drawn. |                                                                                                                                        |
| E.grants | Stellar Restoration (Blink) | **nothingToModel** |       | Damage only; A1/C1 on their hosts.                                                                  |                                                                                                                                        |
| Q.grants | Starward Sword              | **nothingToModel** |       | Damage only.                                                                                        |                                                                                                                                        |
| A1       | Thundering Penance          | **missing**        |       | Electro Infusion after the recast; authorable.                                                      |                                                                                                                                        |
| C1       | Thundering Might            | **missing**        |       | C1 extra Electro hits on the recast; application authorable.                                        |                                                                                                                                        |
| C2       | Keen Extraction             | **notModeled**     | 5     | 50% chance particle.                                                                                | This makes an Energy particle on a 50% chance. We don't simulate chance, so the same rotation always draws the same bars for everyone. |
| C4       | Attunement                  | **missing**        |       | ATK% after an Electro reaction; authorable.                                                         |                                                                                                                                        |

### kinich

| column   | host                    | call               | class | why                                                             | reason (rendered)                                                                         |
| -------- | ----------------------- | ------------------ | ----- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| E.grants | Scalespiker Cannon      | **nothingToModel** |       | Damage only; A4/C1 on their hosts.                              |                                                                                           |
| A1       | The Price of Desolation | **notModeled**     | 3     | Restores Nightsoul points only.                                 | We don't track Nightsoul points, which is all this passive changes.                       |
| C1       | Parrot's Beak           | **notModeled**     | 1     | Scalespiker Cannon-only CRIT DMG; Movement SPD nothing to draw. | We don't draw damage amounts, and this CRIT DMG bonus only applies to Scalespiker Cannon. |

### kirara

| column | host                          | call           | class    | why                                                                   | reason (rendered)                                                             |
| ------ | ----------------------------- | -------------- | -------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A1     | Bewitching, Betwitching Tails | **missing**    |          | Reinforced Packaging stacks and exit shields; authorable.             |                                                                               |
| A4     | Pupillary Variance            | **missing**    |          | HP-scaled E/Q DMG Bonus; house form exists.                           |                                                                               |
| C1     | Material Circulation          | **missing**    |          | Extra Cat Grass Cardamoms per Max HP; HP-dependent application count. |                                                                               |
| C2     | Perfectly Packaged            | **notModeled** | existing | Co-op only shields.                                                   | We don't model co-op, and these shields only go to other players' characters. |

### klee

| column   | host              | call        | class | why                                                                                     | reason (rendered) |
| -------- | ----------------- | ----------- | ----- | --------------------------------------------------------------------------------------- | ----------------- |
| E.grants | Jumpy Dumpty      | **missing** |       | Delayed mine explosions unauthored; timing needs verifying.                             |                   |
| A1       | Pounding Surprise | **missing** |       | Explosive Spark CA bonus is authorable; the old 50% chance part is ruled out (class 5). |                   |
| C4       | Sparkly Explosion | **missing** |       | Swap-out explosion during burst; onSwapOut trigger gap, not a ruling.                   |                   |

### kujou_sara

| column | host             | call           | class | why                                                                        | reason (rendered)                                                                         |
| ------ | ---------------- | -------------- | ----- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A1     | Immovable Will   | **missing**    |       | Faster aimed shot in Crowfeather Cover; charged-frames variant authorable. |                                                                                           |
| A4     | Decorum          | **notModeled** | 2     | Team Energy on Ambush hit only.                                            | We don't track energy, so the planner doesn't draw the Energy this restores to the party. |
| C4     | Conclusive Proof | **missing**    |       | C4 extra Stormcluster hits on the burst; authorable.                       |                                                                                           |

### kuki_shinobu

| column | host                   | call               | class | why                                                 | reason (rendered) |
| ------ | ---------------------- | ------------------ | ----- | --------------------------------------------------- | ----------------- |
| A1     | Breaking Free          | **missing**        |       | Healing Bonus under 50% HP; selfHpBelow authorable. |                   |
| C1     | To Cloister Compassion | **nothingToModel** |       | Area only.                                          |                   |

### lan_yan

| column   | host                                       | call               | class | why                                                                                           | reason (rendered)                                                                                 |
| -------- | ------------------------------------------ | ------------------ | ----- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| E.grants | Feathermoon Ring (N follow-up)             | **nothingToModel** |       | Damage only.                                                                                  |                                                                                                   |
| E.grants | Feathermoon Ring (E follow-up)             | **nothingToModel** |       | Damage only.                                                                                  |                                                                                                   |
| Q.grants | Lustrous Moonrise                          | **notModeled**     | 7     | Pull is grouping; C4's EM buff on its own host; otherwise damage.                             | We don't model pulling opponents together, which is all Lustrous Moonrise adds beyond its damage. |
| A1       | Four Sealing Divination Charms             | **missing**        |       | Absorption and absorbed-element hits wait on the absorption round.                            |                                                                                                   |
| A4       | Skyfeather Evil-Subduing Charm             | **missing**        |       | EM-scaled E/Q flat DMG; house form (passive + FlatDmg) authorable.                            |                                                                                                   |
| C1       | "As One Might Stride Betwixt the Clouds"   | **missing**        |       | Extra ring after absorption; waits on the absorption round.                                   |                                                                                                   |
| C2       | "Dance Vestments Billow Like Rainbow Jade" | **notModeled**     |       | Restores shield absorption; the shield lane draws when a shield is up, not how much it holds. | We draw when a shield is up, not how much it absorbs, and this only refills Swallow-Wisp Shield.  |

### lauma

| column | host                       | call        | class | why                                                                    | reason (rendered) |
| ------ | -------------------------- | ----------- | ----- | ---------------------------------------------------------------------- | ----------------- |
| A1     | Light for the Frosty Night | **missing** | 9     | Bloom-family reaction CRIT needs reaction-CRIT stats that don't exist. |                   |
| A4     | Cleansing for the Spring   | **missing** |       | EM-scaled skill DMG Bonus authorable; CD cut is a caveat.              |                   |

### layla

| column | host                | call           | class    | why                                                                    | reason (rendered)                                                                  |
| ------ | ------------------- | -------------- | -------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A1     | Like Nascent Light  | **missing**    | 9        | Shield Strength stacks need a Shield Strength stat that doesn't exist. |                                                                                    |
| C1     | Fortress of Fantasy | **notModeled** | existing | Co-op shield plus absorption size; both ruled out.                     | We don't model co-op, and this extra shield only covers other players' characters. |
| C2     | Light's Remit       | **notModeled** | 2        | Energy per Shooting Star hit only.                                     | We don't track energy, so the planner doesn't draw the Energy this restores.       |
| C4     | Starry Illumination | **missing**    |          | Dawn Star team flat DMG needs the Night Star counter; not ruled out.   |                                                                                    |
| C6     | Radiant Soulfire    | **missing**    |          | Night Star interval cut is drawable; Shooting Star series unauthored.  |                                                                                    |

### linnea

| column | host                      | call        | class | why                                                                       | reason (rendered) |
| ------ | ------------------------- | ----------- | ----- | ------------------------------------------------------------------------- | ----------------- |
| C2     | Tidings of Joy and Sorrow | **missing** |       | Team CRIT DMG after Moondrift Harmony; waits on Lumi/Moondrift modelling. |                   |
| C4     | Expert Instinct           | **missing** |       | DEF% after Moondrift Harmony; same Moondrift gap.                         |                   |

### lisa

| column   | host                  | call           | class | why                                                        | reason (rendered)                                                                                                                      |
| -------- | --------------------- | -------------- | ----- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| E.grants | Violet Arc            | **notModeled** | 1     | Conductive only raises the Hold's damage.                  | We don't draw damage amounts, and this only raises how hard Violet Arc's Hold hits. Conductive stacks exist only to feed it.           |
| A1       | Induced Aftershock    | **notModeled** | 1     | Applies Conductive, which only raises the Hold E's damage. | We don't draw damage amounts, and this only raises how hard Violet Arc's Hold hits. Conductive stacks exist only to feed it.           |
| C2       | Electromagnetic Field | **missing**    |       | DEF% on Hold E; self onCast authorable.                    |                                                                                                                                        |
| C4       | Plasma Eruption       | **notModeled** | 5     | Random 1–3 bolt count.                                     | Lightning Rose fires a random number of bolts. We don't simulate chance, so the same rotation always draws the same bars for everyone. |
| C6       | Pulsating Witch       | **notModeled** | 1     | Swap-in Conductive only raises the Hold E's damage.        | We don't draw damage amounts, and this only raises how hard Violet Arc's Hold hits. Conductive stacks exist only to feed it.           |

### lohen

| column   | host                                         | call                                            | class | why                                                                                                                | reason (rendered)                                                                     |
| -------- | -------------------------------------------- | ----------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Q.grants | Manifest Judgment                            | **modeledBy** `lohen__skill__unforeseen_strike` | 6     | Masterstroke extension drawn on the skill; Secret Rite buff drawn from factionBonuses; Will to Win half ruled out. |                                                                                       |
| A1       | Moratorium on Questioning                    | **notModeled**                                  | 3     | Will to Win accrual only.                                                                                          | We don't track Will to Win, which is all this passive changes.                        |
| C1       | O Breezes, That So Oft Bear Sorrowful Lament | **notModeled**                                  | 3     | Will to Win cap and accrual only.                                                                                  | We don't track Will to Win, which is all this constellation changes.                  |
| C4       | Radiant Love, Laughing Death                 | **notModeled**                                  | 2     | Energy on entering Masterstroke plus Will to Win; both ruled out.                                                  | We don't track energy or Will to Win, so the planner doesn't draw what this restores. |

### lynette

| column | host                       | call           | class | why                                                                  | reason (rendered)                                                                                  |
| ------ | -------------------------- | -------------- | ----- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A1     | Sophisticated Synergy      | **missing**    |       | Tiered team ATK% after Q; authorable.                                |                                                                                                    |
| A4     | Props Positively Prepped   | **missing**    |       | Burst DMG after Elemental Conversion; waits on the absorption round. |                                                                                                    |
| C1     | A Cold Blade Like a Shadow | **notModeled** | 7     | Vortex pull only.                                                    | We don't model pulling opponents together, which is all this constellation adds beyond its damage. |
| C2     | Endless Mysteries          | **missing**    |       | Extra Vivid Shots follow the Box's absorption; waits on that round.  |                                                                                                    |

### lyney

| column | host                 | call           | class | why                                                                                                                                                | reason (rendered)                                                                                                                              |
| ------ | -------------------- | -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A1     | Perilous Performance | **notModeled** | 2     | Energy on the Hat's hit (ruled) plus +80% ATK on the Hat's Pyrotechnic Strike, one named attack (ruled). Hat summon belongs to the charged attack. | We don't track energy or draw damage amounts, and this only restores Energy and raises how hard the Grin-Malkin Hat's Pyrotechnic Strike hits. |
| A4     | Conclusive Ovation   | **missing**    |       | "DMG... to opponents affected by Pyro" +60–100%: passive allDmgBonus, enemyAffectedBy pyro + teamElementCount pyro tiers.                          |                                                                                                                                                |
| C1     | Whimsical Wonders    | **missing**    |       | "2 Grin-Malkin Hats... extra Prop Surplus": second Hat summon + stack; blocked on unauthored Prop Arrow Hat.                                       |                                                                                                                                                |
| C2     | Loquacious Cajoling  | **missing**    |       | "Crisp Focus every 2s... CRIT DMG 20%" max 3: ramping critDmg per on-field segment; no segment-start buff anchor (note).                           |                                                                                                                                                |
| C6     | Guarded Smile        | **missing**    |       | "fire a Pyrotechnic Strike: Reprised" on Prop Arrow: damage proc with Pyro application, onHit charged Prop Arrow.                                  |                                                                                                                                                |

### mavuika

| column | host                 | call        | class | why                                                                                                                                       | reason (rendered) |
| ------ | -------------------- | ----------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| C4     | The Leader's Resolve | **missing** |       | "will not decay... additional 10% DMG Bonus": modifies authored Kiongozi allDmgBonus onCast — constellation-gated value/no-decay variant. |                   |

### mika

| column   | host                  | call           | class    | why                                                                                                                                    | reason (rendered)                                                            |
| -------- | --------------------- | -------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| E.grants | Starfrost Swirl       | **notModeled** | existing | "their ATK SPD will be increased": only grant is ATK SPD; no stat, rubric lists attack-speed out of scope; caveat present.             | We don't model attack speed, so Soulwind's ATK SPD bonus isn't drawn.        |
| A1       | Suppressive Barrage   | **missing**    | 9        | Physical DMG Bonus stat doesn't exist yet (class 9); multi-opponent stack gain is the ruled part.                                      |                                                                              |
| A4       | Topographical Mapping | **missing**    |          | Mixed: CRIT-triggered Detector stack is ruled (class 5), but +1 max Detector stacks on A1 is modelable once A1 is.                     |                                                                              |
| C1       | Factor Confluence     | **missing**    |          | "decrease the healing interval" of Eagleplume by Soulwind's ATK SPD %: conditional heal-tick cadence (second series under Soulwind).   |                                                                              |
| C2       | Companion's Ingress   | **missing**    |          | "Flowfrost Arrow first hits... 1 Detector stack": gainStacks onHit skill; value only reaches Physical DMG (no stat) — tied to A1 fate. |                                                                              |
| C4       | Sunfrost Encomium     | **notModeled** | 2        | Only output is Energy (on Eagleplume heals); energy and heal triggers both ruled.                                                      | We don't track energy, so the planner doesn't draw the Energy this restores. |
| C6       | Companion's Counsel   | **missing**    | 9        | Physical CRIT DMG for the active character needs a Physical-scoped stat that doesn't exist yet.                                        |                                                                              |

### mona

| column | host                    | call        | class | why                                                                                                                                         | reason (rendered) |
| ------ | ----------------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| A1     | "Come 'n' Get Me, Hag!" | **missing** |       | "After... Illusory Torrent for 2s... create a Phantom": dash-duration-triggered Phantom damage + Hydro application; no dash trigger.        |                   |
| C1     | Prophecy of Submersion  | **missing** |       | Reaction bonuses +15% 8s on Omen hit: electroCharged/lunarCharged/lunarCrystallizeReactionBonus team; blocked by enemy-Omen trigger (note). |                   |
| C6     | Rhetorics of Calamitas  | **missing** |       | "+60% DMG of next Charged Attack per second of movement": ramping chargeDmgBonus; needs a dash-opened state (note).                         |                   |

### mualani

| column   | host                              | call               | class | why                                                                                                                                    | reason (rendered)                                                                                                  |
| -------- | --------------------------------- | ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Q.grants | Boomsharka-laka                   | **nothingToModel** |       | "Fires a Super Shark Missile... dealing... Hydro DMG": damage only; A4 bonus lives on its own host.                                    |                                                                                                                    |
| A1       | Heat-Resistant Freshwater Floater | **notModeled**     | 4     | Puffer pickups restoring Nightsoul points: pickups and Nightsoul pool both ruled.                                                      | We don't model pickups, so the Nightsoul points Mualani gets from Puffers don't lengthen her Nightsoul's Blessing. |
| A4       | Natlan's Greatest Guide           | **notModeled**     | 1     | Wave Momentum-style stacks only raise Boomsharka-laka's damage: one named attack.                                                      | We don't draw damage amounts, and this only raises how hard Boomsharka-laka hits.                                  |
| C1       | The Leisurely "Meztli"...         | **notModeled**     | 1     | First Surging Bite damage add-on (one named attack); out-of-combat Nightsoul saving is nothing to model.                               | We don't draw damage amounts, and this only raises how hard her first Sharky's Surging Bite hits.                  |
| C2       | Mualani, Going All Out!           | **missing**        |       | "gains 2... Wave Momentum stacks when she enters Nightsoul's Blessing": gainStacks onCast skill; stacks gate the Surging Bite variant. |                                                                                                                    |
| C6       | Spirit of the Springs' People     | **notModeled**     | 1     | Removes C1's once-per-Blessing limit; C1 is a one-attack damage bonus.                                                                 | We don't draw damage amounts, and this only raises how hard Sharky's Surging Bite hits, now on every bite.         |

### nahida

| column | host                              | call        | class | why                                                                                                                                               | reason (rendered) |
| ------ | --------------------------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| C6     | The Fruit of Reason's Culmination | **missing** |       | Karmic Oblivion coordinated Dendro damage on N/CA: onHit proc w/ application on burst; blocked only on procCap per:"cast" (note gives full spec). |                   |

### navia

| column   | host                                            | call           | class | why                                                                                                                                      | reason (rendered)                                                                          |
| -------- | ----------------------------------------------- | -------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| E.grants | Ceremonial Crystalshot                          | **notModeled** | 1     | Crystal Shrapnel only changes shot count and damage of this Crystalshot: a damage bonus on one named attack.                             | We don't draw damage amounts, and this only raises how hard Ceremonial Crystalshot hits.   |
| C1       | A Lady's Rules for Keeping a Courteous Distance | **missing**    |       | "restore 3 Energy... decrease the CD of [burst] by 1s" per shrapnel: cooldownReduce burst + energy; needs Crystal Shrapnel stack source. |                                                                                            |
| C2       | The President's Pursuit of Victory              | **missing**    |       | "one Cannon Fire Support shot" on E hit: burst-DMG proc with Geo application. CRIT Rate half ruled no honest bar (note).                 |                                                                                            |
| C6       | The Flexible Finesse of the Spina's President   | **notModeled** | 1     | CRIT DMG for a single Crystalshot (ability-scoped CRIT); excess-Shrapnel return is part of the same damage bonus.                        | We don't draw damage amounts, and this only raises the CRIT DMG of Ceremonial Crystalshot. |

### nefer

| column   | host                            | call           | class | why                                                                                                                             | reason (rendered)                                                                                     |
| -------- | ------------------------------- | -------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Q.grants | Sacred Vow: True Eye's Phantasm | **missing**    |       | Veil consumption boosts this burst's DMG (magnitude); consumeStacks of Veil only matters once A1/C2 Veil stacks exist.          |                                                                                                       |
| A1       | A Wager of Moonlight            | **missing**    |       | "Veil of Falsehood... 3 stacks... EM increased by 100 for 8s": onStack/perStack em self buff; seed conversion unexpressible.    |                                                                                                       |
| A4       | Daughter of the Dust and Sand   | **missing**    |       | Verdant Dew rate (resource) + Lunar-Bloom base DMG +0.0175%/EM, max 14%: elevate/lunarBloom base-DMG scaling like Flins/Ineffa. |                                                                                                       |
| C1       | Planning Breeds Success         | **notModeled** | 1     | Lunar-Bloom base DMG add scoped to Phantasm Performance's own hits: one named attack.                                           | We don't draw damage amounts, and this only raises the Lunar-Bloom damage Phantasm Performance deals. |
| C2       | Observation Feeds Strategy      | **missing**    |       | Veil max 5, +5s, 2 Veils on E, "+200 EM for 8s" at 5 stacks: gainStacks onCast skill + threshold EM buff.                       |                                                                                                       |

### neuvillette

| column   | host                     | call           | class | why                                                                                                         | reason (rendered)                                                                                                                          |
| -------- | ------------------------ | -------------- | ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| E.grants | O Tears, I Shall Repay   | **notModeled** | 4     | Only non-damage output is Sourcewater Droplets: pickups.                                                    | We don't model pickups, so the Sourcewater Droplets this creates aren't drawn.                                                             |
| Q.grants | O Tides, I Have Returned | **notModeled** | 4     | Only non-damage output is Sourcewater Droplets: pickups.                                                    | We don't model pickups, so the Sourcewater Droplets this creates aren't drawn.                                                             |
| C2       | Juridical Exhortation    | **notModeled** | 1     | CRIT DMG scoped to Charged Attack: Equitable Judgment, one named attack.                                    | We don't draw damage amounts, and this only raises the CRIT DMG of Equitable Judgment.                                                     |
| C4       | Crown of Commiseration   | **notModeled** | 4     | Heal-triggered droplet spawn: heal triggers and pickups both ruled.                                         | We don't model pickups or track healing, so the Sourcewater Droplet Neuvillette gets when healed isn't drawn.                              |
| C6       | Wrathful Recompense      | **notModeled** | 4     | Droplet absorption lengthening Equitable Judgment (pickup) plus extra currents (damage of that one attack). | We don't model pickups, so absorbed Sourcewater Droplets don't lengthen Equitable Judgment, and its extra currents only add to its damage. |

### nilou

| column   | host                                                 | call                                               | class | why                                                                                                              | reason (rendered) |
| -------- | ---------------------------------------------------- | -------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- | ----------------- |
| E.grants | Whirling Steps 1                                     | **nothingToModel**                                 |       | "Single Hydro hit at frame 21": damage only (application authored).                                              |                   |
| E.grants | Whirling Steps 2                                     | **nothingToModel**                                 |       | "Single Hydro hit at frame 29": damage only.                                                                     |                   |
| E.grants | Water Wheel (Whirling Steps 3)                       | **modeledBy** `nilou__skill__dance_of_haftkarsvar` | 6     | Tranquility Aura is drawn (and its gap counted) on the base skill.                                               |                   |
| Q.grants | Dance of Abzendegi: Distant Dreams, Listening Spring | **nothingToModel**                                 |       | Lingering Aeon delayed hit is already in application[] (frame 212); otherwise damage only.                       |                   |
| A4       | Dreamy Dance of Aeons                                | **missing**                                        |       | Bountiful Core DMG +9% per 1,000 HP over 30k, cap 400%: bloom-family ReactionBonus scaling hp with offset, team. |                   |

### ningguang

| column   | host                                          | call               | class | why                                                                                                                         | reason (rendered) |
| -------- | --------------------------------------------- | ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Q.grants | Starshatter                                   | **nothingToModel** |       | "homing projectiles... Geo DMG"; Jade Screen extra gems are damage only.                                                    |                   |
| A1       | Backup Plan                                   | **nothingToModel** |       | "her Charged Attack does not consume Stamina".                                                                              |                   |
| C1       | Piercing Fragments                            | **nothingToModel** |       | "When a Normal Attack hits, it deals AoE DMG": hitbox size only; single target.                                             |                   |
| C2       | Shock Effect                                  | **missing**        |       | "When Jade Screen is shattered, its CD will reset" (6s ICD): cdReset skill onCast burst (Starshatter shatters the Screen).  |                   |
| C4       | Exquisite be the Jade, Outshining All Beneath | **missing**        |       | "Jade Screen increases nearby characters' Elemental RES by 10%": allElementalRes team buff for Jade Screen summon lifetime. |                   |
| C6       | Grandeur Be the Seven Stars                   | **missing**        |       | "Starshatter... gains 7 Star Jades": jade stacks feed extra CA Geo projectiles; Star Jades unmodelled anywhere.             |                   |

### noelle

| column   | host            | call        | class | why                                                                                                                             | reason (rendered) |
| -------- | --------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Q.grants | Sweeping Time   | **missing** |       | "Increased ATK... based on her DEF" + Geo infusion: self atk buff scaling def onCast burst ~15s + infusion; effects empty.      |                   |
| A4       | Nice and Clean  | **missing** |       | "decrease the CD of Breastplate by 1s for every 4... hits": cooldownReduce onHit normal/charged (0.25s/hit or stack threshold). |                   |
| C1       | I Got Your Back | **missing** |       | "chance of Breastplate's healing... increased to 100%" during burst: heal onHit certainty while burst active.                   |                   |
| C2       | Combat Maid     | **missing** |       | "Charged Attack DMG by 15%": passive chargeDmgBonus 15; stamina half is nothing.                                                |                   |

### odette

| column   | host                           | call        | class | why                                                                                                                                | reason (rendered) |
| -------- | ------------------------------ | ----------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| E.grants | Adagio: Coda at Dawn's Tolling | **missing** |       | Dance Double's extra Stellar Glimmer hits under Radiance are extra damage instances — the direct reaction damage gap, not a bonus. |                   |

### ororon

| column | host                         | call           | class | why                                                                                                                                                  | reason (rendered)                                                                                                                              |
| ------ | ---------------------------- | -------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A1     | Nightshade Synesthesia       | **missing**    |       | Nightsoul points ruled (class 3), Hypersense drawn via Night's Sling, but its Nightsoul-aligned-DMG trigger is unauthored.                           |                                                                                                                                                |
| A4     | Aspect Catalyst              | **notModeled** | 2     | Aspect Sigil only restores Energy.                                                                                                                   | We don't track energy, so the planner doesn't draw the Energy this restores.                                                                   |
| C1     | Trails Amidst the Forest Fog | **notModeled** | 1     | Extra bounces need multiple opponents; Nighttide only raises Hypersense's damage.                                                                    | We don't draw damage amounts, and Nighttide only raises how hard Hypersense hits. The extra bounces need more opponents than the one we model. |
| C6     | Ode to Deep Springs          | **missing**    |       | "active character's ATK is increased by 10% for 9s" per Hypersense + Q free Hypersense (damage+Electro): proc-triggered stacks, onCast burst damage. |                                                                                                                                                |

### prune

| column   | host                              | call        | class | why                                                                                                                                  | reason (rendered) |
| -------- | --------------------------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| E.grants | Ring-A-Ding-Ding! Hexhunter Chime | **missing** |       | Clang Clang converted hammer (6s after Swirl, element of swirl) is a state window/variant; unmodelled. Tolling Rally caveat present. |                   |

### qiqi

| column | host                   | call           | class    | why                                                                                      | reason (rendered)                                                                                                                           |
| ------ | ---------------------- | -------------- | -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A4     | A Glimpse Into Arcanum | **notModeled** | 5        | Talisman application is a 50% chance.                                                    | We don't simulate chance, so two people planning the same rotation always see the same bars — this Talisman only has a 50% chance to apply. |
| C1     | Ascetics of Frost      | **notModeled** | 2        | Only output is Energy on Talisman-marked Herald hits (Herald series is the skill's gap). | We don't track energy, so the planner doesn't draw the Energy this restores.                                                                |
| C4     | Divine Suppression     | **notModeled** | existing | Enemy ATK -20% + lowest-HP heal; curator: "takes the Kirara-C2 / Nicole-C2 house form".  | We don't model the opponent's ATK, and the extra heal goes to whichever party member has the lowest HP, which the planner can't know.       |

### raiden_shogun

| column | host                | call           | class | why                                                                                                   | reason (rendered)                                                                                                          |
| ------ | ------------------- | -------------- | ----- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A1     | Wishes Unnumbered   | **notModeled** | 4     | Resolve from particle pickups; Resolve only raises burst damage (one named attack).                   | We don't model pickups, and the Resolve this grants only raises how hard Secret Art: Musou Shinsetsu and Musou Isshin hit. |
| C1     | Ominous Inscription | **notModeled** | 1     | More Resolve, which only raises burst damage.                                                         | We don't draw damage amounts, and this only raises how hard Secret Art: Musou Shinsetsu and Musou Isshin hit.              |
| C2     | Steelbreaker        | **missing**    |       | "ignore 60% of opponents' DEF" in Musou Isshin: self defIgnore 60, onCast burst, whileState inStance. |                                                                                                                            |

### razor

| column   | host             | call           | class | why                                                                                                                                             | reason (rendered)                                                                                      |
| -------- | ---------------- | -------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| E.grants | Claw and Thunder | **missing**    |       | Electro Sigil "increases his Energy Recharge": energyRecharge perStack (20%/sigil, max 3, 18s) gainStacks onHit skill; hold converts to Energy. |                                                                                                        |
| Q.grants | Lightning Fang   | **missing**    |       | Wolf Within 15s: electroRes buff, coordinated Electro strikes with normals (whileNormalAttacking/proc), energy return. effects empty.           |                                                                                                        |
| A1       | Awakening        | **missing**    |       | "Decreases Claw and Thunder's CD by 18%... Lightning Fang resets the CD": cooldownModifier percent + cdReset onCast burst.                      |                                                                                                        |
| A4       | Hunger           | **notModeled** | 2     | ER bonus gated on Energy below 50%; the planner tracks no energy.                                                                               | We don't track energy, so we can't tell when Razor is below 50% Energy for this Energy Recharge bonus. |
| C1       | Wolf's Instinct  | **notModeled** | 4     | DMG bonus triggered by Elemental Orb or Particle pickup.                                                                                        | We don't model pickups, so this DMG bonus from picking up Elemental Orbs or Particles isn't drawn.     |

### rosaria

| column   | host                | call               | class | why                                                        | reason (rendered)                                                                                                                   |
| -------- | ------------------- | ------------------ | ----- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| E.grants | Ravaging Confession | **nothingToModel** |       | "stabs and slashes them... dealing Cryo DMG": damage only. |                                                                                                                                     |
| C1       | Unholy Revelation   | **notModeled**     | 5     | CRIT-triggered NA DMG bonus; ATK SPD half also ruled.      | We don't simulate chance, so two people planning the same rotation always see the same bars — this triggers on CRIT hits.           |
| C4       | Painful Grace       | **notModeled**     | 5     | CRIT-triggered Energy regen (energy also ruled).           | We don't simulate chance, so two people planning the same rotation always see the same bars — this Energy is restored on CRIT hits. |

### sandrone

| column   | host                                      | call               | class | why                                                                                                                                             | reason (rendered)                                                                                                            |
| -------- | ----------------------------------------- | ------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Q.grants | Formule Phenomenale: Q.E.D.               | **nothingToModel** |       | Cannons + Convective Inhibition Ray deal Cryo DMG; Radiance changes damage type only.                                                           |                                                                                                                              |
| A1       | Eternal Speculation Engine                | **notModeled**     | 1     | Damage raises on Fagio's second Prism Shot and the Convective Inhibition Ray: named attacks.                                                    | We don't draw damage amounts, and this only raises how hard Fagio's second Prism Shot and the Convective Inhibition Ray hit. |
| C2       | An Heiress Gazed Into the Looking-Glass   | **notModeled**     | 1     | CRIT DMG scoped to condensed beams.                                                                                                             | We don't draw damage amounts, and this only raises the CRIT DMG of Fagio's condensed beams.                                  |
| C4       | In Knowledge Lies the World's True Ground | **missing**        | 8     | Extra Cryo cannon attack is a new damage instance, not a bonus; old 'damage magnitude' ruling is the retired creed. Direct reaction damage gap. |                                                                                                                              |

### sangonomiya_kokomi

| column | host                          | call           | class | why                                                                                                 | reason (rendered)                                                                                                               |
| ------ | ----------------------------- | -------------- | ----- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A1     | Tamakushi Casket              | **missing**    |       | "Bake-Kurage's duration will be refreshed" on burst: summon durationExtension/refresh onCast burst. |                                                                                                                                 |
| C4     | The Moon Overlooks the Waters | **notModeled** | 2     | ATK SPD (ruled) and Energy from Normal Attacks (ruled).                                             | We don't model attack speed or track energy, so neither the ATK SPD bonus nor the Energy these Normal Attacks restore is drawn. |

### sayu

| column   | host                      | call                                                  | class    | why                                                                                                                        | reason (rendered)                                                                                |
| -------- | ------------------------- | ----------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| E.grants | Yoohoo Art: Fuuin Dash    | **missing**                                           |          | Hold E Elemental Absorption (extra elemental DMG) — waits on the absorption round; rest is damage/interruption res.        |                                                                                                  |
| A1       | Someone More Capable      | **missing**                                           |          | "triggers a Swirl... while active, she heals all your characters" 300+1.2×EM, 2s ICD: heal onReaction swirl source active. |                                                                                                  |
| A4       | No Work Today!            | **notModeled**                                        | existing | "heal characters near that healed character for 20%" (position) + AoE size (nothing).                                      | The extra healing reaches characters standing near the one healed, and we don't model positions. |
| C1       | Multi-Task no Jutsu       | **modeledBy** `sayu__burst__yoohoo_art_mujina_flurry` | 6        | Muji-Muji Daruma already draws heal and damage series together at every constellation, which is C1's whole behavior.       |                                                                                                  |
| C2       | Egress Prep               | **notModeled**                                        | 1        | Damage bonus on Fuufuu Whirlwind Kick only.                                                                                | We don't draw damage amounts, and this only raises how hard Fuufuu Whirlwind Kick hits.          |
| C4       | Skiving: New and Improved | **notModeled**                                        | 2        | Only output is Energy on Swirl.                                                                                            | We don't track energy, so the planner doesn't draw the Energy this restores.                     |

### sethos

| column   | host                                | call           | class | why                                                                                                                  | reason (rendered)                                                                        |
| -------- | ----------------------------------- | -------------- | ----- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| E.grants | Ancient Rite: The Thundering Sands  | **notModeled** | 2     | Only non-damage output is Energy on reaction.                                                                        | We don't track energy, so the planner doesn't draw the Energy this restores.             |
| Q.grants | Secret Rite: Twilight Shadowpiercer | **missing**    |       | Twilight Meditation 8s: NA→Dusk Bolts (Electro, CA DMG), ends on swap; needs state window + in-state normal sibling. |                                                                                          |
| A4       | The Sand King's Boon                | **notModeled** | 1     | Flat damage add on Shadowpiercing Shot only.                                                                         | We don't draw damage amounts, and this only raises how hard Shadowpiercing Shot hits.    |
| C1       | Sealed Shrine's Spiritsong          | **notModeled** | 1     | CRIT Rate scoped to Shadowpiercing Shot.                                                                             | We don't draw damage amounts, and this only raises the CRIT Rate of Shadowpiercing Shot. |
| C6       | Pylon of the Sojourning Sun Temple  | **notModeled** | 2     | Energy refund on Shadowpiercing Shot hit.                                                                            | We don't track energy, so the planner doesn't draw the Energy this restores.             |

### shenhe

| column | host             | call           | class | why                                                                                                                              | reason (rendered)                                                                                       |
| ------ | ---------------- | -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| C4     | Insight          | **notModeled** | 1     | Skyfrost Mantra stacks only raise the next Spring Spirit Summoning's damage.                                                     | We don't draw damage amounts, and this only raises how hard Shenhe's next Spring Spirit Summoning hits. |
| C6     | Mystical Abandon | **missing**    |       | "does not count toward the Trigger Quota": Icy Quill quota is unmodelled (bars are duration-only); C6 matters once quota exists. |                                                                                                         |

### shikanoin_heizou

| column   | host                     | call           | class    | why                                                                                                             | reason (rendered)                                                                                    |
| -------- | ------------------------ | -------------- | -------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| E.grants | Heartstopper Strike      | **notModeled** | 1        | Declension/Conviction only raise Heartstopper Strike's own damage.                                              | We don't draw damage amounts, and this only raises how hard Heartstopper Strike hits.                |
| Q.grants | Windmuster Kick          | **missing**    |          | Windmuster Iris: delayed damage of the absorbed element — absorption round; pull is the grouping tag (present). |                                                                                                      |
| A1       | Paradoxical Practice     | **notModeled** | 1        | Declension stack only raises Heartstopper Strike's damage.                                                      | We don't draw damage amounts, and this only raises how hard Heartstopper Strike hits.                |
| C1       | Named Juvenile Casebook  | **notModeled** | existing | ATK SPD (ruled) plus a Declension stack (one-attack damage).                                                    | We don't model attack speed, and the Declension stack only raises how hard Heartstopper Strike hits. |
| C2       | Investigative Collection | **notModeled** | 7        | Stronger, longer pull: grouping.                                                                                | We don't model pulling opponents together, so a stronger pull changes nothing on the timeline.       |
| C4       | Tome of Lies             | **notModeled** | 2        | Only output is Energy from Iris explosions.                                                                     | We don't track energy, so the planner doesn't draw the Energy this restores.                         |

### sigewinne

| column   | host                                   | call           | class | why                                                   | reason (rendered)                                                                              |
| -------- | -------------------------------------- | -------------- | ----- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Q.grants | Super Saturated Syringing              | **notModeled** | 4     | Droplet absorption granting Bond of Life: both ruled. | We don't model pickups or Bond of Life, so the Sourcewater Droplets this absorbs aren't drawn. |
| A4       | Detailed Diagnosis, Thorough Treatment | **notModeled** | 4     | Healing bonus scaled by Bond of Life, which is ruled. | We don't model Bond of Life, and this healing bonus scales with it.                            |

### skirk

| column   | host                 | call           | class | why                                                                                                                                                     | reason (rendered)                                                                                                         |
| -------- | -------------------- | -------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Q.grants | Havoc: Extinction    | **missing**    |       | "All Shall Wither"... Normal Attack deal increased DMG (10 procs): normalDmgBonus onCast, whileState inStance. Caveat removal says expected-but-absent. |                                                                                                                           |
| A1       | Reason Beyond Reason | **notModeled** | 4     | Void Rift pickups feeding Serpent's Subtlety.                                                                                                           | We don't model pickups, so the Void Rifts Skirk absorbs aren't drawn, and her Serpent's Subtlety runs lower than in game. |
| C1       | Far to Fall          | **notModeled** | 4     | Crystal blades come from absorbing Void Rifts.                                                                                                          | We don't model pickups, and the crystal blades come from the Void Rifts Skirk absorbs.                                    |
| C6       | To the Source        | **notModeled** | 4     | Havoc: Sever stacks come from Void Rifts; on-hurt trigger also ruled.                                                                                   | We don't model pickups, and Havoc: Sever stacks come from the Void Rifts Skirk absorbs.                                   |

### sucrose

| column   | host                                    | call           | class | why                                                                                                            | reason (rendered)                                                                                                                          |
| -------- | --------------------------------------- | -------------- | ----- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| E.grants | Astable Anemohypostasis Creation - 6308 | **notModeled** | 7     | Wind Spirit's pull is grouping (ruled); its damage and Hexerei Secret Rite bar are already drawn.              | We don't model pulling opponents together, so the Wind Spirit's pull isn't drawn.                                                          |
| C4       | Alchemania                              | **notModeled** | 5     | CD reduction amount is random (1–7s).                                                                          | We don't simulate chance, so two people planning the same rotation always see the same bars — the cooldown cut is a random 1 to 7 seconds. |
| C6       | Chaotic Entropy                         | **missing**    |       | Absorbed-element +20% party DMG: deferred to the elemental absorption round (note "DEFERRED"); caveat present. |                                                                                                                                            |

### tartaglia

| column   | host                                  | call               | class    | why                                                                                                               | reason (rendered)                                                                                                                   |
| -------- | ------------------------------------- | ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| E.grants | Foul Legacy: Raging Tide (Exit Melee) | **nothingToModel** |          | Empty description; exits Melee Stance early (terminates, no grant).                                               |                                                                                                                                     |
| Q.grants | Havoc: Obliteration (Ranged Stance)   | **missing**        |          | "applying the Riptide status" + "Returns a portion of its Energy Cost": Riptide debuff window + energy refund 20. |                                                                                                                                     |
| Q.grants | Havoc: Obliteration (Melee Stance)    | **missing**        |          | Riptide Blast: extra Hydro damage on Riptide-marked target — proc with application; Riptide unauthored.           |                                                                                                                                     |
| A1       | Never Ending                          | **missing**        |          | "Extends Riptide duration by 8s": modifier on Riptide window, which is unauthored.                                |                                                                                                                                     |
| A4       | Sword of Torrents                     | **notModeled**     | 5        | Riptide applied on CRIT hits.                                                                                     | We don't simulate chance, so two people planning the same rotation always see the same bars — this Riptide is applied on CRIT hits. |
| C1       | Foul Legacy: Tide Withholder          | **missing**        |          | "Decreases the CD of Foul Legacy: Raging Tide by 20%": cooldownModifier percent 20 (base CD is parametric).       |                                                                                                                                     |
| C2       | Foul Legacy: Understream              | **notModeled**     | existing | Enemy-defeat trigger restoring Energy.                                                                            | This triggers when an opponent is defeated, and we model one opponent that stays up.                                                |
| C4       | Abyssal Mayhem: Hydrospout            | **missing**        |          | Riptide Slash/Flash "every 4s": periodic Hydro damage with application during stance; Riptide unauthored.         |                                                                                                                                     |
| C6       | Havoc: Annihilation                   | **missing**        |          | "CD of Foul Legacy... is reset" after melee Q, at stance exit: cdReset skill on stance end.                       |                                                                                                                                     |

### thoma

| column | host               | call           | class    | why                                                                                                                                           | reason (rendered)                                                                                 |
| ------ | ------------------ | -------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A1     | Imbricated Armor   | **missing**    | 9        | No Shield Strength stat yet; stacks on Barrier gain.                                                                                          |                                                                                                   |
| C1     | A Comrade's Duty   | **notModeled** | existing | "is attacked, Thoma's own... CD is decreased by 3s": enemy-attack trigger.                                                                    | This triggers when an opponent attacks a shielded character, and we don't model incoming attacks. |
| C4     | Long-Term Planning | **notModeled** | 2        | Only output is Energy after the burst.                                                                                                        | We don't track energy, so the planner doesn't draw the Energy this restores.                      |
| C6     | Burning Heart      | **missing**    |          | "When a Blazing Barrier is obtained or refreshed... Normal, Charged, and Plunging Attacks... 15% for 6s": team N/C/P DmgBonus on shield gain. |                                                                                                   |

### tighnari

| column   | host                                 | call               | class | why                                                                                                                               | reason (rendered) |
| -------- | ------------------------------------ | ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Q.grants | Fashioner's Tanglevine Shaft         | **nothingToModel** |       | "fire 6 Tanglevine Shafts... Dendro DMG" + second wave: damage only.                                                              |                   |
| C1       | Beginnings Determined at the Roots   | **missing**        | 9     | Charged Attack CRIT Rate is a whole attack class; needs a class-scoped CRIT stat that doesn't exist yet.                          |                   |
| C6       | Karma Adjudged From the Leaden Fruit | **missing**        |       | "charging time is decreased by 0.9s... 1 additional Clusterbloom Arrow": Wreath Arrow frames + extra Dendro hit (1U, ICDTagNone). |                   |

### traveler_anemo

| column   | host               | call               | class    | why                                                                                                   | reason (rendered)                                                                 |
| -------- | ------------------ | ------------------ | -------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| E.grants | Palm Vortex        | **nothingToModel** |          | Grants nothing beyond damage; hold absorption belongs to the elemental absorption round.              |                                                                                   |
| A1       | Slitting Wind      | **missing**        |          | Wind blade on the last hit of a Normal Attack combo, 60% Anemo — a swing-armed proc with no host yet. |                                                                                   |
| A4       | Second Wind        | **notModeled**     | existing | On-kill heal; opponents are never defeated in our model.                                              | We don't model defeating opponents, so there is no kill for this heal to follow.  |
| C1       | Raging Vortex      | **notModeled**     | 1        | First Storm's DMG +100% — damage on one named attack.                                                 | We don't draw damage amounts, and this only raises how hard the first Storm hits. |
| C2       | Uprising Whirlwind | **missing**        |          | Self Energy Recharge +16% — an authorable stat buff; the skip note is not a ruling.                   |                                                                                   |
| C4       | Cherishing Breezes | **nothingToModel** |          | "Decreases sprinting Stamina consumption by 20%".                                                     |                                                                                   |

### traveler_dendro

| column   | host             | call               | class | why                                                                                                                             | reason (rendered)                                                                                           |
| -------- | ---------------- | ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| E.grants | Razorgrass Blade | **nothingToModel** |       | Single Dendro hit; grants no buff, summon, state or cooldown change.                                                            |                                                                                                             |
| A4       | Verdant Luxury   | **notModeled**     | 1     | EM → Razorgrass Blade/Surgent Manifestation DMG — named attacks only.                                                           | We don't draw damage amounts, and this only raises how hard Razorgrass Blade and Surgent Manifestation hit. |
| C4       | Treacle Grass    | **missing**        |       | +5 Lotuslight stacks on Transfiguration — gainStacks; blocked because the Lamp's Transfiguration (Lamp reacting) is unmodelled. |                                                                                                             |

### traveler_electro

| column | host                        | call           | class | why                                                                             | reason (rendered)                                                                                                            |
| ------ | --------------------------- | -------------- | ----- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A1     | Thunderflash                | **notModeled** | 4     | CD −1.5s on Abundance Amulet pickup; pickups are ruled out.                     | We don't model picking up Abundance Amulets, so the cooldown they take off Lightning Blade isn't shown.                      |
| A4     | Resounding Roar             | **notModeled** | 4     | Adds to the Amulet's Energy Recharge; pickups are ruled out.                    | We don't model picking up Abundance Amulets, so the Energy Recharge they grant isn't shown.                                  |
| C1     | Spring Thunder of Fertility | **notModeled** | 4     | Abundance Amulet count only; pickups are ruled out.                             | We don't model picking up Abundance Amulets, so how many there are changes nothing on the timeline.                          |
| C4     | Fickle Cloudstrike          | **notModeled** | 4     | Amulet pickup Energy below 35%; pickups and energy both ruled out.              | We don't model picking up Abundance Amulets or track energy, which is all this changes.                                      |
| C6     | World-Shaker                | **notModeled** | 1     | Every 3rd Falling Thunder: 200% DMG + 1 Energy — one-attack damage plus energy. | We don't draw damage amounts or track energy, and this only makes every third Falling Thunder hit harder and restore Energy. |

### traveler_geo

| column | host              | call        | class | why                                                                                                                                  | reason (rendered) |
| ------ | ----------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| C2     | Rockcore Meltdown | **missing** |       | Meteorite explodes when destroyed — extra Geo hit with application at the construct's end; note: "No construct-destroyed primitive". |                   |

### traveler_hydro

| column   | host             | call               | class | why                                                                                         | reason (rendered)                                                                                             |
| -------- | ---------------- | ------------------ | ----- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| E.grants | Aquacrest Saber  | **nothingToModel** |       | Damage only (Torrent Surge, Dewdrops, Spiritbreath Thorn); Suffusion HP drain is not drawn. |                                                                                                               |
| A4       | Clear Waters     | **notModeled**     | 1     | Torrent Surge bonus from HP spent — one named attack, sized by HP.                          | We don't draw damage amounts or track HP, and this only raises how hard Torrent Surge hits based on HP spent. |
| C1       | Swelling Lake    | **notModeled**     | 4     | Sourcewater Droplet pickup restores Energy; pickups ruled out.                              | We don't model picking up Sourcewater Droplets, so the Energy they restore isn't shown.                       |
| C6       | Tides of Justice | **notModeled**     | 4     | Sourcewater Droplet pickup heal; pickups ruled out.                                         | We don't model picking up Sourcewater Droplets, so the healing they trigger isn't shown.                      |

### traveler_pyro

| column   | host                       | call               | class | why                                                                         | reason (rendered)                                                                                 |
| -------- | -------------------------- | ------------------ | ----- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Q.grants | Plains Scorcher            | **notModeled**     | 3     | Restores Nightsoul points; the planner tracks no Nightsoul pool.            | We don't track Nightsoul points, so the planner doesn't draw the points Plains Scorcher restores. |
| A1       | True Flame of Incineration | **nothingToModel** |       | "attack AoE … is increased".                                                |                                                                                                   |
| C2       | Ever-Lit Candle            | **notModeled**     | 3     | +14 Nightsoul points on party Pyro reactions; Nightsoul pool has no reader. | We don't track Nightsoul points, so the planner doesn't draw the points this restores.            |

### varka

| column   | host                                              | call               | class    | why                                                                                                         | reason (rendered)                                                     |
| -------- | ------------------------------------------------- | ------------------ | -------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Q.grants | Northwind Avatar                                  | **nothingToModel** |          | Two slashes, first converted to the party element — damage and application only (covered by other columns). |                                                                       |
| C2       | "When Dawn Breaks, Our Journey Shall Take Flight" | **notModeled**     | existing | Extra 800% Anemo strike with no Durability; Nate: "known, not worth a pixel".                               | This extra strike applies no Anemo, and we don't draw damage amounts. |

### venti

| column   | host             | call               | class | why                                                                                                                                          | reason (rendered) |
| -------- | ---------------- | ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| E.grants | Skyward Sonnet   | **nothingToModel** |       | Damage + launch; Hold upcurrent is traversal (A1). Stray "summon" tag on host noted by curator.                                              |                   |
| A1       | Embrace of Winds | **nothingToModel** |       | "creates an upcurrent that lasts for 20s" — traversal.                                                                                       |                   |
| C1       | Splitting Gales  | **missing**        |       | 2 extra arrows per Aimed Shot (33% DMG) — extra hits/applications at the same hitmark (lands list). Note says damage-only, nothing authored. |                   |

### vesna

| column   | host                        | call        | class | why                                                                                                                                         | reason (rendered) |
| -------- | --------------------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| E.grants | The Art of Victory          | **missing** |       | Stub: Armed for Action mode, Anemo infusion, wind pinion summon, Sword Essence stacks, Windborne Sword special skill — nothing authored.    |                   |
| Q.grants | For the Tsaritsa!           | **missing** |       | Spirit Blades damage + 1 Sword Essence stack — gainStacks onCast burst (stub, nothing authored).                                            |                   |
| A1       | Rite of Spring's Procession | **missing** |       | Disciplinary Action stacks (20s, max 6, independent) — gainStacks; the damage scaling is magnitude but the stack count feeds C2's ATK buff. |                   |
| A4       | Truth Prevails              | **missing** |       | Radiance: Stellar Swirl — ATK +6% per Cryo/Anemo, EM +25 per other element; passive buffs gated by teamElementCount + Radiance.             |                   |
| C1       | Winter's Farewell Feast     | **missing** |       | Armed for Action: +20% Stellar Swirl DMG (stellarSwirlDmgBonus whileState) + 4th top-level Windborne Sword.                                 |                   |
| C2       | Kolo of Spring's Arrival    | **missing** |       | Max Disciplinary Action on mode entry; ATK +40% at max stacks — gainStacks + stacks-gated atk% buff.                                        |                   |
| C4       | Glory to Our Forebears      | **missing** |       | Triples A4's ATK/EM bonuses — constellationScaling / C4-gated variant of A4 buffs.                                                          |                   |
| C6       | Unwavering Ardor            | **missing** |       | Windborne Sword: Transpose hits + coordinated wind pinion (authorable); Stellar Swirl "elevated" by 20% is the frozen elevate class.        |                   |

### vodyanitsa

| column   | host                                     | call           | class    | why                                                                                                                      | reason (rendered)                                                                                      |
| -------- | ---------------------------------------- | -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| E.grants | Rechitativ: Sonorous Dawn                | **missing**    |          | Stub: Horn of Spring's Call summon (periodic Hydro), Hydro/Cryo RES shred, periodic active-char heal — nothing authored. |                                                                                                        |
| Q.grants | Koda: Sink With Thee                     | **notModeled** | 1        | Only adds damage to this burst inside Song of Ages Past — one named attack.                                              | We don't draw damage amounts, and this only raises how hard Koda: Sink With Thee hits.                 |
| A1       | The Last Djeguako Songstress             | **missing**    |          | Wandering Vortex gadget, Anemo RES −35% 6s, +4s Radiance: Stellar Swirl extension.                                       |                                                                                                        |
| A4       | Dirge of the Fandyr                      | **missing**    |          | 25 Lead Vocal + 10 Chorus stacks on E, 30s — gainStacks onCast skill (what reads them is unclear in the stub).           |                                                                                                        |
| C1       | Waters in Full Splendor                  | **notModeled** | existing | Team ATK buff triggered by each Song heal — a heal-event trigger.                                                        | We don't draw effects triggered by healing, so the ATK each Song of Ages Past heal grants isn't shown. |
| C2       | Echoes That Pierce the Snow              | **missing**    |          | Active char Hydro/Cryo CRIT DMG +50% 5s on Horn hit (hydroCritDmg/cryoCritDmg) + Song duration +9s (durationModifier).   |                                                                                                        |
| C4       | Melancholic Voice Upon the Gentle Waters | **notModeled** | existing | Triggered by Song heals and split by the receiver's HP — heal trigger and HP gate.                                       | We don't draw effects triggered by healing or track HP, which is all this depends on.                  |
| C6       | Neverending Song of Revelry              | **missing**    |          | C2 buff goes team-wide; in Song, Hydro/Cryo DMG +60% (authorable). Stellar Swirl elevate is the frozen class.            |                                                                                                        |

### wanderer

| column   | host                                   | call           | class | why                                                                                                                               | reason (rendered)                                                                                                                    |
| -------- | -------------------------------------- | -------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Q.grants | Kyougen: Five Ceremonial Plays         | **missing**    |       | Damage only, but "Windfavored state will end after casting" — needs stance cancel (rubric N15).                                   |                                                                                                                                      |
| A4       | Gales of Reverie                       | **notModeled** | 5     | 16% chance to obtain Descent, with pity — random proc.                                                                            | We don't simulate chance, so two people planning the same rotation always see the same bars — Descent triggers at random.            |
| C1       | Shoban: Ostentatious Plumage           | **notModeled** | 5     | Attack SPD +10% plus a bonus to A4's chance-based arrows.                                                                         | We don't model attack speed, and the wind arrows this strengthens come from a chance-based proc we don't draw.                       |
| C2       | Niban: Isle Amidst White Waves         | **notModeled** | 3     | Burst DMG per Kuugoryoku Point spent; the pool has no reader.                                                                     | We don't track Kuugoryoku Points, and this bonus scales with how many were spent.                                                    |
| C4       | Yonban: Set Adrift into Spring         | **notModeled** | 5     | Extra buff element chosen at random.                                                                                              | We don't simulate chance, so two people planning the same rotation always see the same bars — the extra element is picked at random. |
| C6       | Shugen: The Curtains' Melancholic Sway | **missing**    |       | Extra Fushoudan instance (40% DMG, Anemo, normal ATK DMG) on in-stance N hit, 12f ICD — stance-gated onHit proc with application. |                                                                                                                                      |

### wriothesley

| column   | host                      | call               | class | why                                                                                                                                         | reason (rendered) |
| -------- | ------------------------- | ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Q.grants | Darkgold Wolfbite         | **nothingToModel** |       | Icicle Impact + Ousia Surging Blade — damage and application only.                                                                          |                   |
| C1       | Terror for the Evildoers  | **missing**        |       | Enhanced CA extends Chilling Penalty +4s once per window (caveat names it) — durationExtension maxExtensions 1; 200% DMG part is magnitude. |                   |
| C2       | Shackles for the Arrogant | **missing**        |       | Burst DMG +40% per Prosecution Edict stack — perStack burstDmgBonus onCast burst.                                                           |                   |
| C6       | Esteem for the Innocent   | **missing**        |       | Extra icicle (100% Rebuke Base DMG, Cryo, CA DMG) — extra hit with Cryo application; Rebuke-only CR/CD is magnitude.                        |                   |

### xiangling

| column | host                    | call               | class | why                                                                                                                   | reason (rendered)                                                                 |
| ------ | ----------------------- | ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A1     | Crossfire               | **nothingToModel** |       | "Increases the flame range of Guoba by 20%".                                                                          |                                                                                   |
| A4     | Beware, It's Super Hot! | **notModeled**     | 4     | ATK buff from picking up Guoba's chili pepper — a pickup.                                                             | We don't model picking up Guoba's chili pepper, so the ATK it grants isn't shown. |
| C2     | Oil Meets Fire          | **missing**        |       | N5 Implode → 75% Pyro explosion 2s later, Durability 25 — note: a swing-armed damage proc "has no host" (engine gap). |                                                                                   |

### xianyun

| column   | host                         | call               | class | why                                                                                                                                 | reason (rendered)                                                                          |
| -------- | ---------------------------- | ------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| E.grants | Skyladder (1st Leap)         | **missing**        |       | Cloud Transmogrification state (plunge → Driftcloud Wave) + CD −3s if no Driftcloud Wave; note: "not modelled as a separate state". |                                                                                            |
| E.grants | Skyladder (2nd Leap)         | **notModeled**     | 1     | Raises the next Driftcloud Wave's DMG and AoE — one named attack.                                                                   | We don't draw damage amounts, and this only raises how hard the next Driftcloud Wave hits. |
| E.grants | Skyladder (3rd Leap)         | **nothingToModel** |       | Final leap damage; resets the chain (authored via chainStage).                                                                      |                                                                                            |
| C6       | They Call Her Cloud Retainer | **missing**        |       | 16s after Q the skill ignores CD (max 8 uses) — CD-bypass window + procCap; plunge CRIT DMG by leap count is magnitude.             |                                                                                            |

### xiao

| column   | host                                  | call               | class    | why                                                                                       | reason (rendered)                                                                         |
| -------- | ------------------------------------- | ------------------ | -------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| E.grants | Lemniscatic Wind Cycling              | **nothingToModel** |          | Lunge damage; 2 charges authored.                                                         |                                                                                           |
| A4       | Dissolution Eon: Heaven Fall          | **missing**        |          | "+15% [skill DMG] … 7s, max 3 stacks" — gainStacks + perStack skillDmgBonus onCast skill. |                                                                                           |
| C2       | Annihilation Eon: Blossom of Kaleidos | **missing**        |          | "not on the field, Energy Recharge +25%" — self energyRecharge gated not onField.         |                                                                                           |
| C6       | Conqueror of Evil: Guardian Yaksha    | **notModeled**     | existing | Needs a Plunging Attack to hit 2+ opponents; we model one.                                | We model a single opponent, so a Plunging Attack never hits the two opponents this needs. |

### xilonen

| column | host                        | call        | class | why                                                                                                                                               | reason (rendered) |
| ------ | --------------------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| A1     | Netotiliztli's Echoes       | **missing** |       | <2 converted Samples: N/Plunge DMG +30%; ≥2: Nightsoul points — composition gate (teamElementCount); note predates that condition.                |                   |
| C2     | Chiucue Mix                 | **missing** |       | Per-element teammate buffs (Geo DMG +50%, Pyro ATK +45%, Hydro HP +45%, Cryo CRIT DMG +60%, Electro Energy/Q CD) — needs receiver-element gating. |                   |
| C6     | Imperishable Night Carnival | **missing** |       | Imperishable Night's Blessing: +300% DEF N/Plunge flat DMG 5s + heals every 1.5s, 15s ICD — normal/plungeFlatDmg + heal ticks.                    |                   |

### xingqiu

| column | host                           | call               | class | why                                                                                                                   | reason (rendered) |
| ------ | ------------------------------ | ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------- | ----------------- |
| extra  | Flash of Genius                | **nothingToModel** |       | Crafting refund, "25% chance to refund".                                                                              |                   |
| C1     | The Scent Remained             | **nothingToModel** |       | "Increases the maximum number of Rain Swords by 1" — sword count isn't drawn (damage reduction/interruption only).    |                   |
| C4     | Evilsoother                    | **missing**        |       | "Throughout the duration of Raincutter … Fatal Rainscreen DMG +50%" — skillDmgBonus gated duringSummon source burst.  |                   |
| C6     | Hence, Call Them My Own Verses | **missing**        |       | Every 3rd wave 5 swords + 3 Energy — extra Hydro hits; note: needs a per-Nth-fire trigger, Energy reaches no surface. |                   |

### xinyan

| column   | host                                            | call               | class    | why                                                                                                                     | reason (rendered)                                                                          |
| -------- | ----------------------------------------------- | ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Q.grants | Riff Revolution                                 | **nothingToModel** |          | Physical + Pyro damage and application only.                                                                            |                                                                                            |
| A1       | "The Show Goes On, Even Without an Audience..." | **notModeled**     | existing | Shield level depends on opponents hit; one opponent, one shield bar.                                                    | Shield level depends on how many opponents the swing hits, and we model a single opponent. |
| A4       | "...Now That's Rock 'N' Roll!"                  | **missing**        | 9        | Shielded characters +15% Physical DMG; needs a Physical DMG Bonus stat.                                                 |                                                                                            |
| C1       | Fatal Acceleration                              | **notModeled**     | 5        | ATK SPD +12% on CRIT — attack speed and a CRIT trigger.                                                                 | We don't model attack speed, and this triggers on CRIT hits, which we don't simulate.      |
| C2       | Impromptu Opening                               | **missing**        |          | "form a shield at Shield Level 3: Rave when cast" — shield onCast burst (C2); Physical CRIT Rate on burst is magnitude. |                                                                                            |

### yae_miko

| column   | host                            | call           | class | why                                                                                                                                                             | reason (rendered)                                                                |
| -------- | ------------------------------- | -------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Q.grants | Great Secret Art: Tenko Kenshin | **missing**    |       | Burst destroys every Sesshou Sakura (terminatesOn: burst on the summon, absent) and fires a Tenko Thunderbolt per totem (Electro hits).                         |                                                                                  |
| A1       | The Shrine's Sacred Shade       | **missing**    |       | Skill charge reset per Sakura destroyed by burst — cdReset/cooldownReduce onCast burst; caveat already says "Not modeled".                                      |                                                                                  |
| A4       | Enlightened Blessing            | **notModeled** | 1     | EM → Sesshou Sakura DMG — damage on one named attack.                                                                                                           | We don't draw damage amounts, and this only raises how hard Sesshou Sakura hits. |
| extra    | Edict of Cleansing              | **missing**    |       | AUTHORED ELSEWHERE: the +10s is baked into Sesshou Sakura duration 24. Missing: Radiance extra 200% Stellar-Conduct hit and Radiance state in a Polestar Field. |                                                                                  |
| C6       | Forbidden Art: Daisesshou       | **missing**    |       | Sakura ignores 60% DEF (defIgnore, but scoped to summon hits) + Stellar-Conduct CRIT DMG +200% (no reaction-scoped crit Stat).                                  |                                                                                  |

### yanfei

| column | host                      | call               | class | why                                                     | reason (rendered)                                                                                                                    |
| ------ | ------------------------- | ------------------ | ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A4     | Blazing Eye               | **notModeled**     | 5     | 80% Pyro hit on a CRIT Charged Attack — CRIT-triggered. | We don't simulate chance, so two people planning the same rotation always see the same bars — this triggers on CRIT Charged Attacks. |
| C1     | The Law Knows No Kindness | **nothingToModel** |       | Stamina cost and interruption resistance.               |                                                                                                                                      |

### yaoyao

| column | host        | call           | class | why                                                                                                                          | reason (rendered)                                                            |
| ------ | ----------- | -------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A1     | Starscatter | **missing**    |       | Radishes thrown every 0.6s while sprinting/jumping/running in burst — movement-driven heal/Dendro hits; running is no token. |                                                                              |
| C2     | Innocent    | **notModeled** | 2     | +3 Energy on radish hits during the burst — energy restoration.                                                              | We don't track energy, so the planner doesn't draw the Energy this restores. |

### yelan

| column | host             | call                                            | class | why                                                                                                           | reason (rendered) |
| ------ | ---------------- | ----------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- | ----------------- |
| A1     | Turn Control     | **missing**                                     |       | Max HP +6/12/18/30% by party element-type count — passive hp% gated by team element types.                    |                   |
| A4     | Adapt With Ease  | **modeledBy** `yelan__burst__depthclarion_dice` | 6     | Ramping active-character DMG buff drawn on Depth-Clarion Dice's cast.                                         |                   |
| C6     | Winner Takes All | **missing**                                     |       | Mastermind 20s: normals become special Breakthrough Barbs (CA DMG), cleared after 5 arrows — state + procCap. |                   |

### yoimiya

| column   | host                     | call           | class | why                                                                                                                        | reason (rendered)                                                                                                                                |
| -------- | ------------------------ | -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q.grants | Ryuukin Saxifrage        | **missing**    |       | Aurous Blaze: teammates' hits trigger Pyro explosions, 2s ICD, 10s — cast-hosted onHit others proc with Pyro application.  |                                                                                                                                                  |
| C1       | Agate Ryuukin            | **missing**    |       | Aurous Blaze +4s (authorable once Aurous Blaze is); ATK +20% on defeating a marked opponent is on-kill (notModelled half). |                                                                                                                                                  |
| C4       | Pyrotechnic Professional | **missing**    |       | Skill CD −1.2s per own Aurous Blaze explosion — cooldownReduce on the proc (needs Aurous Blaze first).                     |                                                                                                                                                  |
| C6       | Naganohara Meteor Swarm  | **notModeled** | 5     | 50% chance of an extra Blazing Arrow — random proc.                                                                        | We don't simulate chance, so two people planning the same rotation always see the same bars — each extra Blazing Arrow has a 50% chance to fire. |

### yumemizuki_mizuki

| column | host                         | call                                                                | class | why                                                                            | reason (rendered)                                                                                        |
| ------ | ---------------------------- | ------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| A1     | Bright Moon's Restless Voice | **modeledBy** `yumemizuki_mizuki__skill__aisa_utamakura_pilgrimage` | 6     | Swirl extension (+2.5s, max 2, 0.3s CD) authored on Aisa Utamakura Pilgrimage. |                                                                                                          |
| C4     | Buds Warm Lucid Springs      | **notModeled**                                                      | 4     | Snack pickup heal, damage and Energy — pickups ruled out.                      | We don't model picking up Yumemi Style Special Snacks, so their healing, damage and Energy aren't shown. |
| C6     | The Heart Lingers Long       | **notModeled**                                                      | 1     | Lets Swirl DMG crit — ability-scoped CRIT.                                     | We don't draw damage amounts, and this only lets Swirl damage land critical hits.                        |

### yun_jin

| column | host                 | call           | class    | why                                                                                | reason (rendered)                                                     |
| ------ | -------------------- | -------------- | -------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A1     | True to Oneself      | **notModeled** | existing | Counter at the moment Yun Jin is attacked; opponents never attack.                 | Opponents don't attack in our model, so there is no hit to counter.   |
| C1     | Thespian Gallop      | **missing**    |          | "Opening Flourish's CD is decreased by 18%" — cooldownModifier (percent) gated C1. |                                                                       |
| C4     | Flower and a Fighter | **missing**    |          | DEF +20% 12s on Crystallize/Lunar-Crystallize — self def% onReaction, source self. |                                                                       |
| C6     | Decorous Harmony     | **notModeled** | existing | Normal ATK SPD +12% — attack speed.                                                | We don't model attack speed, so this changes nothing on the timeline. |

### zhongli

| column | host                         | call           | class    | why                                                                                                  | reason (rendered)                                                                                      |
| ------ | ---------------------------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A1     | Resonant Waves               | **notModeled** | existing | Fortify when the Jade Shield takes DMG; incoming damage unmodeled.                                   | Opponents don't attack in our model, so the Jade Shield never takes the hits that strengthen it.       |
| C1     | Rock, the Backbone of Earth  | **missing**    |          | Two concurrent Stone Steles — a recast shouldn't cut the first Stele (summon cap/recast rule at C1). |                                                                                                        |
| C6     | Chrysos, Bounty of Dominator | **notModeled** | existing | Heal from damage the Jade Shield absorbs; incoming damage unmodeled.                                 | Opponents don't attack in our model, so the Jade Shield never takes the damage this heal is made from. |

### zibai

| column   | host                                         | call                                                         | class | why                                                                                                                                     | reason (rendered)                                                                            |
| -------- | -------------------------------------------- | ------------------------------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Q.grants | Tri-Sphere Eminence                          | **modeledBy** `zibai__skill__heaven_and_earth_made_manifest` | 6     | +1.7s stance extension authored on the skill's burst-triggered durationExtensions; otherwise damage only.                               |                                                                                              |
| A1       | The Selenic Adeptus Descends                 | **missing**                                                  |       | Note "NOT MODELED": +60% DEF to Spirit Steed's Stride 2nd hit — blocked by the unmodelled Stride itself (data gap, not a scope ruling). |                                                                                              |
| C1       | Burst Forth With Vigor, But Enter in Silence | **missing**                                                  |       | Note "NOT MODELED": +100 Radiance, Stride uses 4→5, first Stride +220% — tied to the unmodelled Stride/Radiance.                        |                                                                                              |
| C4       | The Spirit Passes, Then Form Follows         | **missing**                                                  |       | Note "NOT MODELED": N combo doesn't reset in mode; Stride hit → next 4th-hit extra attack 250% — tied to unmodelled Stride.             |                                                                                              |
| C6       | The World, A Journey in Passing              | **notModeled**                                               | 3     | Radiance gain +50%, Stride spends Radiance to raise DMG; pool has no reader.                                                            | We don't track Phase Shift Radiance, and this only raises damage by how much of it is spent. |
