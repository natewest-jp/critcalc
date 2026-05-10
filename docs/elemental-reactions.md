This is a compilation of several pages under the "Elemental Reactions" section of the KQM Theorycrafting Library.

Important note from your coworker (Nate), the one copying all these documents here: The following document is all from the perspective of players doing as rigorous testing as they possibly can and documenting the results, not from people data-mining Genshin's source code and finding the exact workings (no one has done this, as far as I know). This means that while KQM is probably the strongest authority out there, it is not ground-truth in the sense that only the Genshin game engine has all the exact rules on elemental reactions. I mention this because you are free (and encouraged) to cross-reference gcsim and compare, and if you find different accountings of how things work, that doesn't mean that gcsim is wrong - we might need to evaluate together where KQM disagree (if anywhere) and decide how we want to handle those cases (if they come up). Alright, here is the KQM TCL Elemental Reactions section:


ELEMENTAL REACTIONS

SECTIONS

1 Elemental Guage Theory

2 Amplifying Reactions

3 Transformative Reactions

4 Additive Reactions

5 Elemental Absorption

6 Elemental Resonance

7 Weapon Infusion

8 Simultaneous Reaction Priorities


INFO
If any words are unfamiliar, we have an entry on common terms, with a specific section on terms commonly found when discussing reactions. (Note from coworker Nate: I will paste this common terms at the end of the document, for your reference if you need it.)


SECTION 1 Elemental Guage Theory

Disclaimer

To our knowledge, the framework of Elemental Gauge Theory can be applied to explain any Elemental-related concept in Genshin. Extensive testing has been done and is viewable in the Evidence Vault under Gauge Unit Theory - Testing and Evidence.

Notation

When an Elemental source is used to apply an Element, it applies a number of Gauge Units onto the enemy. The respective character page should be referenced to see how many units each source applies. However, this alone is not enough, it must also be combined with the unit modifier specific to the situation.

Units (U) are reported as the amount of aura they apply, when extending auras with stronger attacks with higher U or consuming auras via Elemental reactions, the resulting auras are not simply an addition of the unit.

CAUTION: The TCL previously used decay notations for auras; with 1U being 1A, 2U being 2B, and 4U being 4C. This system is no longer used due to its lack of versatility.

Notation	Decay Rate
1U	11.875s per unit
1.5U	8.9583s per unit
2U	7.5s per unit
4U	5.3125s per unit
8U	4.21875s per unit

The only source of 8U Cryo/Hydro/Pyro was available using the Supersense Skill in Day 5 of Fayz Trials, for more details see this Vault Entry.

Aura Application

Aura application has a 0.8x modifier. This is also referred to as Aura Tax.

Elemental Gauge of Source	After Aura Tax
1U	0.8U
1.5U	1.2U
2U	1.6U
4U	3.2U
8U	6.4U

Example of Aura Application:

Kaeya’s E applies 2U * 0.8 = 1.6U Cryo aura and the decay rate is 7.5s per unit.
In addition, neither Anemo nor Geo may be applied as an aura.
Hereinafter, all aura applications will be referred to with this unit modifier already applied.

Character Elemental Gauge Application

Each character has a set amount of Elemental gauge applied by each individual attack or Skill. A full list of character Skills and their corresponding Elemental gauges can be found below:

RESOURCE: 📄️ Elemental Gauge Database
The number of Gauge Units applied by a character attack, skill, or passive is referred to as Elemental Gauge.

Decay Rate

Decay rate is determined by the first aura applied. This decay rate is always in effect, until the aura is fully consumed/decayed.

Decay rate is calculated as follows:

D(U) = 875 / (4 × Durability) + 25 / 8​	
 
Durability is another way of measuring units, with each unit being the equivalent of 25 durability.

Additional applications of the aura Element will apply their own respective gauges, but follow the decay rate of the original aura. Meaning, a 2U or 4U Elemental Gauge can be decaying at the rate of D(1). To do this, apply a 1U gauge, then apply a 2U or 4U gauge of the same Element to get 1.6U or 3.2U auras that decay by 11.875s per unit.

Fischl's Charged Shot applies 0.8U Electro, the use of Beidou's Q will change the gauge to 3.2U Electro, resulting in a 3.2U Electro aura persisting for 38 seconds from the time of Beidou Q, instead of 17 seconds.

Something to note is that without extending auras, the total duration of an aura applied to the enemy is equivalent to 2.5 times the gauge of the Elemental source in GU plus 7 seconds. This alongside the post-tax gauge may be used to calculate the decay rate. The letter notation makes it easier to refer to a few standard decay rates.

As of 3.0, the decay rate of Pyro aura updates differently than other auras. Every time Pyro is applied, the decay rate either:

Stays the same if the trigger didn't change the amount of aura on the target.
Updates to the trigger decay rate if the aura did change.
Overloaded and Superconduct

These Transformative Reactions have a 1x unit modifier (effectively removing the same amount of units).

When an Elemental trigger is applied, it subtracts the corresponding number of Elemental units from the enemy’s existing gauge.

Kaeya’s E applies 1.6U Cryo aura followed by Fischl’s Aimed Shot immediately, which applies 1U Electro. Superconduct occurs, 0.6U Cryo aura remains.
If the Trigger Gauge is greater than the Aura Gauge, a reaction will still occur and the aura will be fully consumed and no Element will be left behind because gauges cannot go below zero.

Fischl’s Aimed Shot applies 0.8U Electro aura followed by Kaeya’s E immediately, applying 2U Cryo. Superconduct occurs, and no aura is left behind as reaction triggers can only remove units, they can’t add aura/gauge.
The AoE of these reactions have zero Elemental Gauge.

Frozen

Once Frozen is triggered, an enemy will be afflicted by a Frozen aura. Reactions with Frozen are equivalent to those with Cryo, though the gauge of a Frozen aura is often significantly higher. In addition, Cryo and Hydro may exist alongside the Frozen aura. Removing the Frozen aura, either through Melt or Shatter, will expose the coexisting Cryo/Hydro aura, allowing any Elemental sources to react with Cryo/Hydro. Even while the Cryo/Hydro aura is hidden under the Frozen aura, it will continue to decay as normal.

Freeze is extended when the Cryo or Hydro is applied to Freeze with a coexisting Hydro or Cryo aura respectively.

More details on the Frozen aura, including duration, coexisting Cryo/Hydro, and extension may be found in the Evidence Vault.

Melt and Vaporize

Reaction Basics

Melt and Vaporize have weak and strong Elements.

Using a weak Element as the trigger results in a 1.5x DMG multiplier. This is referred to as a Reverse Vape/Melt.

Cryo triggering Melt and Pyro triggering Vaporize
Using a strong Element as the trigger results in a 2.0x DMG multiplier. This is referred to as a Forward Vape/Melt.

Pyro triggering Melt and Hydro triggering Vaporize
Unit Modifiers to Gauge Consumption

Weak Amplifying Reaction triggers have a 0.5x unit modifier.

Elemental Gauge of Source	After Unit Modifier
1U	0.5U
2U	1U
An enemy affected by Amber’s Charged Shot has 1.6U Pyro with D(2) decay rate. Using Kaeya’s E (2U Cryo) only removes 1U Pyro because weak Melt occurs when the trigger is Cryo.
Strong Amplifying Reaction triggers have a 2x unit modifier.

Elemental Gauge of Source	After Unit Modifier
1U	2U
2U	4U
An enemy affected by Kaeya’s E has 1.6U Cryo with D(2) decay rate. Using Diluc’s E (1U) removes 2U worth of Cyro aura because strong Melt occurs when the trigger is Pyro. This leaves us with 0U Cryo as gauges cannot go below zero.
Crystallize and Swirl

Geo and Anemo can only be used as the trigger for Crystallize and Swirl reactions respectively. All Geo/Anemo triggers have a 0.5x unit modifier.

Elemental Gauge of Source	After Unit Modifier
1U	0.5U
2U	1U
4U	2U
Using a 1U Geo trigger on a 0.8U Electro aura will result in Crystallize, subtracting 0.5U and leaving 0.3U of Electro aura.
Unlike other Transformative Reactions which have an AoE, the AoE of Swirl has a non-zero gauge, which shall be explored in the following section.

Swirl Application

Swirl application occurs when an Elemental source is applied to an enemy through the use of Swirl spreading an Element. This may trigger additional reactions and or apply an aura following the same rules as any other Elemental source. Notably, tax is applied to any Swirl application that becomes an aura.

The Gauge Unit and decay rate of the Swirl application depend on both the aura of the entity on which Swirl triggered as well as the gauge of the Anemo trigger. A few basic examples may be seen in the table here:

Elemental Gauge of Aura	Anemo Gauge	Gauge of Swirl	Aura Applied After Tax	Decay Rate Conversion
0.8U	1U	2.2U	1.76U	~7.10227s per unit
0.8U	2U	1.95U	1.56U	~7.61218s per unit
1.6U	2U	3.45U	2.76U	~5.66123s per unit
Like all other applied auras, you can extend the duration of a swirled aura by already having an aura of the same Element on an enemy.

Barbara attacks (1U) an enemy and applies 0.8U Hydro. Venti's E (2U Anemo) swirls a Hydro Abyss Mage, which has 2U Hydro aura, spreading 3.45U Hydro to the enemy with 0.8U Hydro. Now, after that enemy has 2.76U Hydro, which will last a maximum of 32.775s.
Electro-Charged

Electro-Charged (EC) is unique to all previously covered reactions. The current theory is that in Electro-Charged, both Hydro and Electro simultaneously function and coexist as both the aura and trigger.

EC is triggered when an enemy with a Hydro or Electro aura has the other aura applied to it. EC will tick once per second so long as enough Electro and Hydro gauge remain, except in the following case:

When either the Electro or Hydro gauge completely decays, the next Electro-Charged tick will prematurely occur at the moment when the gauge is completely decayed. However, if one of the gauges empties within 0.5s of the last Electro-Charged tick, there will not be another tick of Electro-Charged.
Each tick of Electro-Charged consumes 0.4U from both gauges. Once a gauge is empty, the Element will disappear from the enemy’s status, but the other Element will remain available to further reactions.

AoE ticks of Electro-Charged have zero gauge.

Self Aura

Self Auras are Elements applied to the character. This can be from sources such as: leylines, taking Elemental damage from an enemy, or having an ability that imbues the character with an Element.

When a Self Aura application triggers a reaction, if the Self Aura's U value is higher than that of the existing aura, the aura directly transitions to the Self Aura. It should also be included that enemy shields, innate auras etc. are Self Auras.


SECTION 2 Amplifying Reactions

Formula

AmplifyingReaction = ReactionMultiplier × (1 + (2.78 × EM) / (1400 + EM) + ReactionBonus)

ReactionMultiplier = {
2 if triggering Vaporize with Hydro or Melt with Pyro;
1.5 if triggering Vaporize with Pyro or Melt with Cryo
}
 
Amplifying Reactions scale off of EM, Reaction DMG Bonuses, and the damage of the attack triggering the reaction. Since they scale off of base damage, Amplifying Reactions can make use of CRIT, ATK, EM, and character level. There are also Reaction DMG Bonuses to further amplify this, which currently only exist in the form of 4-Piece Crimson Witch and Mona C1.

INFO: For more information on the damage dealt by Amplifying Reactions, see the Damage Formula page.

Melt

Melt is an Amplifying Reaction triggered by applying Pyro onto a target already afflicted with Cryo or vice versa. Melt allows for a multiplier of damage amplification onto the attack triggering the reaction, heavily boosting the attack. Applying Cryo onto Pyro is colloquially referred to as a Reverse Melt as it has the smaller base multiplier of 1.5x as opposed to the 2x multiplier of Pyro onto Cryo.

Vaporize

Vaporize, or Vape, is an Amplifying Reaction triggered by applying Hydro onto a target already afflicted with Pyro or vice versa. Vaporize allows for a multiplier of damage amplification onto the attack triggering the reaction, heavily boosting the attack. Applying Pyro onto Hydro is colloquially referred to as a Reverse Vape as it has the smaller base multiplier of 1.5x as opposed to the 2x multiplier of Hydro onto Pyro.


SECTION 3 Transformative Reactions

Formula

TransformativeReactions = ReactionMultiplier × LevelMultiplier × (1 + (16 × EM) / (2000 + EM) + ReactionBonus) × EnemyResistanceMultiplier
 
ReactionMultiplier = {
3 if triggering Burgeon, Hyperbloom, and Shattered;
2.75 if triggering Overloaded;
2 × ECTriggers if triggering Electro-Charged;
2 if triggering Bloom;
1.5 if triggering Superconduct;
0.6 if triggering Swirl;
0.25 if triggering Burning;
0 otherwise
}

Level Multiplier
Player level multiplier at Lv. 90: 1446.85 (Note from Nate: In the TCL page the 90 is a drop-down where I can select the level. If you would like the multipliers for other levels just let me know.)
Enemy/environment level multiplier at Lv. : 1202.81

Transformative Reactions cannot crit (except some with Nahida C2), but count as hits from your character and can be used to stack Royal weapons and trigger Favonius weapons. They only scale off of Elemental Mastery and character level, and are affected by Elemental RES to the type of damage the reaction deals.

Transformative Reactions like Swirls, Swirl AoEs, Superconduct, Overload, and Shatter snapshot reaction damage bonuses when they are generated.

Poise Damage and Impulse Types

| Reaction | Type | Poise Damage | Impulse Type |
|----------|------|--------------|--------------|
| Bloom | To Enemies | 25 | 2 |
| Bloom | To Characters | 5 | 0 |
| Burgeon/Hyperbloom | To Enemies | 50 | 2 |
| Burgeon/Hyperbloom | To Characters | 10 | 0 |
| Burning | AoE (1m radius) | 30 | 0 |
| Electro-Charged | Direct Damage | 130 | 2 |
| Frozen | When Unfrozen | 30 | 2 |
| Overloaded | AoE (5m radius) | 90 | 5 |
| Superconduct | AoE (5m radius) | 30 | Heavy, 240, 300 |
| Shattered | Direct Damage | 30 | 3 |
| Swirl | Direct Damage | 130 | 1 |
| Swirl | AoE (6m radius) | 30 | 1 |

Overloaded

Overloaded, or Overload, is a Transformative Reaction triggered by applying Pyro on a target already afflicted by an Electro aura or vice versa. Overloaded will cause an explosion of Pyro DMG to occur that will destroy Geo shields quickly. Triggering Overloaded in an AoE will only cause one instance of Overload DMG.

- Can trigger on Electrified bodies of water.
- Overloaded has a reaction-specific ICD of 0.5 seconds, where enemies Overloaded or hit by the AoE caused by an Overload triggered by one character are then immune to the damage caused by Overload triggered by that character for 0.5 seconds. They still suffer gauge reduction and stagger, even without taking damage.

Superconduct

Superconduct is a Transformative Reaction triggered by applying Electro on a target already afflicted by a Cryo aura or vice versa, dealing Cryo DMG. Superconduct **reduces an enemy's Physical RES by 40% by 12 seconds**.

- Triggering Superconduct in an AoE will result in two instances of Superconduct DMG on each enemy. It has an ICD of 0.5s, where the same enemy will take no more than 2 instances of Superconduct DMG within 0.5s.
- Despite what TikTok may tell you, Superconduct does not lower Cryo or Electro DMG taken.

Electro-Charged

Electro-Charged, EC for short, is a Transformative Reaction triggered by applying Hydro to a target already afflicted by an Electro aura or vice versa, and deals Electro DMG.

Aura Mechanics
- When an enemy is Electro-Charged, both the Hydro and Electro auras lie underneath the Electro-Charged status. It follows that when applying a third Element, like Pyro, you can trigger **both** Vaporize and Overload with the same damage instance.
- Electro-Charged continues to tick every second until there is 0.5 seconds worth of Electro and Hydro aura remaining.

Duration & Spreading
- Electro-Charged duration can be extended by hitlag, presumably by extending the aura duration.
- With an excessive amount of Hydro application and a lot of hitlag, 4 Electro-Charged procs are possible with only one application of Electro.
- Electro-Charged ticks on secondary targets, however, are not affected by hitlag and happen exactly every 60 frames.
- Electro-Charged can spread to nearby targets if they have a Hydro aura, however, the chain lightning will trigger Electro-Charged DMG without applying an Elemental aura.

Damage & Cooldown
- Electro-Charged snapshots the Elemental Mastery of whoever last applied an Element for the reaction.
- Electro-Charged has a cooldown. An enemy can only take one instance of Electro-Charged DMG every ~0.5s.
- The ticks of the Electro-Charged reaction don't count as hitting an enemy or as triggering a reaction.
- Electro-Charged ticks only consume Hydro and Electro gauge when both Hydro and Electro are present.
- Electro-Charged ticks only remove gauges when they deal damage. Both gauges will still decay naturally over time though.
- 0-gauge Electro attacks don't change Electro-Charged ownership.
- As of patch 2.5, there is a bug when using Electro as the trigger. The Electro aura will not persist after the Electro-Charged ticks, even when the Electro gauge is greater than the Hydro gauge.
- When applying Electro-Charged on enemies already affected by the same reaction, effects that are triggered on-reaction will be triggered.

Frozen

Frozen is a Transformative Reaction triggered by applying Cryo on a target already afflicted by a Hydro aura or vice versa. If the Frozen aura expires or is Shattered, any underlying Hydro or Cryo aura will persist.

Gauge Interactions
- Applying a 2U Hydro -> 1U Cryo aura will cause the enemy to be affected by both Frozen and Hydro. However, applying a 1U Cryo -> 2U Hydro will only cause the enemy to be affected by Frozen.

Multi-Reaction Mechanics
For some attacks, only one reaction can occur at a time. For example, if you apply non-heavy Pyro to a Frozen aura that has an underlying Hydro aura, only Melt occurs.

Underlying Aura Interactions

| Reaction | Freeze Aura | Underlying Cryo | Underlying Hydro |
|----------|------------|-----------------|------------------|
| Melt | ✔️ | ✔️ | ❌ |
| Superconduct | ✔️ | ✔️ | ❌ |
| Shatter | ✔️ | ❌ | ❌ |
| Swirl | ✔️ | ✔️ | ✔️ |
| Crystallize | ✔️ | ✔️ | ✔️ |

Freeze Duration Formulas

```
Origin Aura Gauge when Frozen = (0.8 × Origin Element Gauge) × (1 - Time between Origin and Trigger Element Application / (2.5 × Origin Element Gauge + 7))
Frozen Aura Gauge = 2 × min(Origin Aura Gauge when Frozen, Trigger Element Gauge)
Freeze Duration = 2 × √(5 × Frozen Aura Gauge + 4) - 4
```

Consecutive Freeze Duration Rules
- Freeze aura decay starts off at a rate of 0.4 GU/s
- It accelerates at a rate of 0.1 GU/s²
- When unfrozen, it accelerates at a rate of −0.2 GU/s² back down to the minimum rate of 0.4 GU/s

Generalized Formula with Decay
```
Decay Time Modifier = Σ max(0, Time Spent Frozen − 2 × Time Spent Unfrozen)
For consecutive periods of Time Spent Frozen followed by Time Spent Unfrozen
Freeze Duration = √(20 × Frozen aura gauge + (Decay Time Modifier + 4)²) − Decay Time Modifier − 4
```

Full Formula with Freeze Resistance
```
Gauge_Freeze Aura = 2 × min(Gauge_Origin Aura, Gauge_Trigger Element)
Freeze Duration (Seconds) = 2√(5 × Gauge_Freeze Aura × (1 − Freeze Resistance_Target) + 4) − 4
```

Some enemies have Freeze resistance, which is taken into account in the Freeze duration calculation. Freeze RES does not affect the reaction gauge of Freeze itself.

Shattered

Shattered, or Shatter, is a second-stage Transformative Reaction triggered by using Blunt Attacks on a Frozen enemy and deals Physical DMG. It has an ICD of 2 damage instances every 0.5 seconds on the same enemy.

- Blunt Attacks (such as Claymores, Geo, Klee's bombs, etc.) will Shatter Frozen targets before any Elemental DMG is dealt, preventing you from Melting or Vaporizing.
- Attacks that trigger Shatter have different GU values.
- In some situations, Shattering a Frozen enemy removes less than the normal 8GU. This allows multiple Shatters to occur on a single Frozen, or Shatter + Melt at the same time. (Appears to be a bug.)
- Shatter does not trigger weapon, artifact, or character passives except **Tri-Karma Purification** from Nahida Skill.

Swirl

Swirl is a Transformative Reaction triggered by applying Anemo to a target already afflicted by Hydro, Pyro, Cryo, or Electro. Swirl will cause AoE Elemental DMG of the same type as the original aura, spreading that Element to affected targets which can trigger additional reactions.

AoE & ICD
- Triggering Swirl in an AoE can cause up to two instances of Swirl DMG per Element for each enemy in the AoE. Note that this constraint does not include the Anemo hit or any damage dealt by reactions caused by the Swirls.
- Swirl has an ICD of 2 damage instances every 0.5s on each target.

Special Cases
- In the special case of Hydro, only the target afflicted with the Hydro initially will take damage as the dispersion of Hydro will not harm enemies.
- All reactions caused by Swirling auras together use the stats of the character that triggered the Swirl in their damage calculation.
- If an Amplifying Reaction is triggered in this manner, the damage will snapshot EM and the Base Hit will be the Swirl damage number.
- Environmental Element sources (such as campfires and burning grass) can be Swirled.
- Swirl is a separate effect from Elemental Absorption.

Reaction Chaining
When a Swirl reaction occurs and the AoE effect of the Swirl reaction meets another enemy with an aura, the Swirled Element will cause a reaction with that aura. This reaction will use the Anemo character's level and Elemental Mastery to determine damage (if applicable).

Double Swirl
It is possible to simultaneously trigger two Swirls on one target from the same Anemo hit if the target has two Swirl-applicable auras, such as an Electro-Charged enemy or a Frozen enemy with an underlying Hydro aura. This double Swirl can only occur when the gauge reduction from the Anemo hit is greater than the Electro gauge (in the case of Electro-Charged) or the Hydro gauge (in Frozen/Hydro). If this condition is not met, the Anemo attack will only Swirl Electro (for Electro-Charged) or Hydro (for Freeze/Hydro).

Aggravated Swirl
If an Electro Swirl comes into contact with a Quicken aura, the Anemo character will trigger an Aggravated Swirl, which is a Transformative Reaction. This is only possible in multi-target due to not being able to be triggered on the enemy hit by the Swirl. Although Aggravate is an Additive Reaction, the damage from an Aggravated Swirl is calculated as a Transformative Reaction.

Crystallize

Crystallize is a Transformative Reaction triggered by applying Geo on a target already afflicted by Pyro/Hydro/Cryo/Electro that creates a shard of the given Element. Picking up the shard grants a shield of the respective Element. Crystallize deals no damage, but instead, the base damage absorption of the shield scales off of the Elemental Mastery and level of the character that triggered the Crystallize reaction.

- Triggering Crystallize on an Electro-Charged target will generate an Electro shard.
- Picking up multiple shards refreshes the duration of the shield and its Element type.
- Shards will always spawn in front of the enemy when possible.
- Crystallize has a global reaction-specific ICD of exactly 1 second, where any specific enemy Crystallized by any character is then immune to Crystallize by any character for 1 second. This cooldown prevents further shards to appear and any gauge consumption that would otherwise occur.

Burning

Burning is a Transformative Reaction triggered by applying Dendro on a target already afflicted by a Pyro aura or vice versa, dealing Pyro DMG that does not stagger. It ticks once every 0.25s and applies 1U Pyro sometime between 0.25s and 0.42s after the "Burning" text first appears, then once every 2s (assuming enough Dendro and Pyro are applied to the target).

Aura Mechanics
The Burning aura looks similar to the Pyro aura, except it has animated fire above. It acts as a Pyro aura when being reacted with and can be extinguished, leaving the underlying Dendro (and very infrequently, Pyro) aura. The attack that extinguishes Burning can react "through" the Burning aura, allowing a single attack to extinguish the Burning AND react with the underlying aura(s).

Ownership
Whichever character or enemy last refreshes the Burning aura with Dendro or Pyro will take "ownership" of the aura; the damage dealt by Burning depends on the stats of the aura owner.

Bloom

Bloom is a non-damaging Transformative Reaction triggered by applying Hydro to a target already afflicted by Dendro (or Quicken) or vice versa. Triggering the Bloom reaction generates a Dendro Core, which then either explodes or is used to trigger a second-stage reaction.

Core Mechanics
- A Dendro Core will explode after 6 seconds or if there are already 5 Dendro Cores present and a 6th Bloom is triggered.
- Applying Electro or Pyro to a Dendro Core will trigger Hyperbloom or Burgeon respectively.
- Skills and Bursts with suction (e.g. Venti Burst or Kazuha Skill) can group Dendro Cores. Enemies can also trigger Hyperbloom and Burgeon on Dendro Cores created by players.

ICD & Gauge
- All Bloom reactions that deal damage (Bloom Explosion, Hyperbloom, and Burgeon) share an ICD of 2 damage instances every 0.5s (on each enemy), and although they deal Dendro DMG, none of them applies Dendro.
- It is possible to bypass this ICD by using different sources of Dendro/Hydro/Electro/Pyro to trigger the reactions.
- Like Amplifying Reactions, Bloom (the generation of a Dendro Core) consumes a different amount of gauge depending on which Element is the trigger, with the ratio being a 2:1 (Hydro:Dendro), thus Hydro is the "weak" Element in Bloom.

On-Reaction Effects
- On-reaction effects can only be activated when reactions are triggered on enemies or animals (cats, dogs, kitsunes, and animals that give raw meat or fowl as only they can hold auras).
- They can be activated through Hyperbloom and Burgeon on Dendro Cores with or without any other target nearby.
- Such reactions are counted as Dendro-related reactions.

Core Properties
- Dendro Cores can also block projectiles and attacks that do not react with the Dendro Element (Cryo, Anemo, Geo, Physical, and Dendro itself).
- Bloom-related Reaction DMG under DMG ICD can still trigger certain on-CRIT effects such as Xinyan C1.

Bloom Explosion

Bloom Explosion is a Transformative Reaction that deals Dendro DMG and does not stagger. It is triggered when either of the following occurs:
1. It's been 6s since a Dendro Core has been on-field.
2. There are 5 Dendro Cores on-field and Bloom is triggered again.

- As the 6th Dendro Core is generated, the 1st one explodes.
- Bloom Explosion has an AoE radius of 5m and can easily damage the player, but it's reduced by 95% in comparison to the damage dealt to enemies.
- Bloom Explosions can also damage Ley Line Monoliths.

Hyperbloom

Hyperbloom is a second-stage Transformative Reaction that deals Dendro DMG when Electro is applied to a Dendro Core, this instance of damage does not stagger. When Hyperbloom is triggered, it creates a Sprawling Shot that targets the enemy nearest to the Dendro Core at the time it's triggered. The Sprawling Shot is a projectile with a small AoE (1m radius) so it can deal self-damage to the player if standing close enough.

The damage dealt by Hyperbloom scales off of the Electro applier's stats, whether it's an Electro character using an Electro attack or an Anemo character Swirling Electro.

- Electro Crystals can trigger Hyperbloom. Hyperblooms triggered by Electro Crystals or Enemies are inconsistent in what they do or do not target.
- Hyperbloom DMG does not snapshot EM on trigger, and Hyperbloom can benefit from the same 4pc FoPL/Gilded proc it triggers.

Burgeon

Burgeon is a second-stage Transformative Reaction that deals Dendro DMG when Pyro is applied to a Dendro core, this instance of damage does not stagger.

The damage dealt by Burgeon scales off of the Pyro applier's stats, whether it's a Pyro character using a Pyro attack, an Anemo character Swirling Pyro, or any melee character under the effect of Bennett C6.

- Similar to Bloom Explosion, Burgeon also has an AoE radius of 5m, does 95% reduced damage to the player, and can damage Ley Line Monoliths.
- The damage dealt to the player is only affected by the player's Dendro RES, and reducing the enemy's Dendro RES does nothing to the self-damage.
- Burgeon can benefit from the same 4pc FoPL/Gilded proc it triggers.
- However, Burgeon shows inconsistency with the Gilded set.


SECTION 4 Additive Reactions

Catalyze encompasses all Dendro-Electro reactions: Quicken (the non-damaging aura), Spread, and Aggravate.

Quicken Aura Formation

Quicken is a non-damaging Additive Reaction triggered by applying Dendro on a target already afflicted with Electro or vice versa. The aura persists via:

```
Duration = (Smaller gauge value × 5) + 6 seconds
```

The Quicken aura coexists with Electro, Dendro, or Cryo, and reacts as a Dendro source when meeting Pyro or Hydro.

Damage Formula

Both Spread and Aggravate use:

```
ReactionDamage = Multiplier × LevelMultiplier × (1 + (5 × EM) / (1200 + EM) + Bonus)
```

| Reaction | Multiplier |
|----------|-----------|
| Spread | 1.25 |
| Aggravate | 1.15 |

Important: EM does not snapshot for either reaction.

Spread

Spread is a second-stage Additive Reaction triggered by applying Dendro to a Quicken aura, dealing Dendro DMG. It adds flat damage to the triggering attack and has no inherent ICD — triggering frequency depends on the Dendro source's ICD.

Aggravate

Aggravate is a second-stage Additive Reaction triggered by applying Electro to a Quicken aura, dealing Electro DMG. Identical mechanics to Spread but with the lower 1.15 multiplier.


SECTION 5 Elemental Absorption

Elemental Absorption is the capability of certain Anemo abilities to be infused with either Hydro, Pyro, Cryo, or Electro.

Characters with Absorption
- Anemo Traveler (Skill and Burst)
- Venti (Burst)
- Sucrose (Burst)
- Kazuha (Burst and Skill)
- Sayu (Skill)

Absorption Priority Orders

Two distinct priority systems exist:

| Type | Priority | Characters |
|------|---------|-----------|
| 1 | Cryo > Pyro > Hydro > Electro | Anemo Traveler abilities |
| 2 | Pyro > Hydro > Electro > Cryo | Venti, Sucrose, Kazuha, Sayu abilities |

Trigger Requirements

Absorption activates through direct contact with elemental auras on enemies, objects, or players. It is insufficient to simply attack the Anemo ability with an Elemental Skill or infused weapon — either the character must touch the ability while infused with an element, or an enemy can serve as a carrier.

Limitations
- Such abilities can only be infused once with a single Element per use.

Note: KQM TCL flags absorption mechanics as "not yet fully understood" — ongoing investigation into triggering mechanics and inconsistencies.


SECTION 6 Elemental Resonance

(Not yet sourced — fetch from https://library.keqingmains.com/combat-mechanics/elemental-effects/elemental-resonance when needed. Resonance is the team-comp passive that grants stat bonuses based on element pairs/triples on the team. Not load-bearing for v1.5 reaction emission; deferred.)


SECTION 7 Weapon Infusion

(Not yet sourced — fetch from https://library.keqingmains.com/combat-mechanics/elemental-effects/weapon-infusion when needed. Covers bow Charged Shots, Catalyst attacks, stance infusions. Relevant to per-hit reaction emission in a future P4 expansion; not load-bearing for v1.5 cast-only emission.)


SECTION 8 Simultaneous Reaction Priorities

The KQM TCL page is a stub pointing at an external Google Doc that wasn't accessible during fetch (Nate has offered to source it manually). The implementable source-of-truth in the meantime is gcsim's `React()` function in `pkg/reactable/reactable.go`, which encodes the priority order used by the simulator. The order, by trigger element, is:

```
case Electro:    Aggravate → Overload → AddEC → FrozenSuperconduct → Superconduct → Quicken
case Pyro:       Overload → Vaporize → Melt → Burning
case Cryo:       Superconduct → Melt → Freeze
case Hydro:      Vaporize → Freeze → Bloom → AddEC
case Anemo:      SwirlElectro → SwirlPyro → SwirlHydro → SwirlCryo → SwirlFrozen
case Geo:        CrystallizeElectro → CrystallizeHydro → CrystallizeCryo → CrystallizePyro → CrystallizeFrozen
case Dendro:     Spread → Quicken → Burning → Bloom
```

Notes:
- Each `Try*` reaction in gcsim consumes durability proportionally and may set `a.Reacted = true`. Subsequent reactions on the same hit only fire if remaining durability allows.
- Anemo through electro-charged double-swirls (electro and hydro) — see Section 3 Swirl > Double Swirl for the gauge-reduction condition.
- Pyro through electro-charged: triggers BOTH Vape (consuming hydro) and Overload (consuming electro). Sequential, but observed as simultaneous.
- Geo on electro-charged: only one crystallize fires (electro takes priority); Crystallize has a 1s reaction-specific ICD that gates the second.

For our v1.5 cast-only emission model, this priority order isn't strictly load-bearing — we emit the full plausible reaction set per cast and let the consumer trigger filter narrow. But it informs the aura-update rules: which aura is consumed when multiple match.


---

REFERENCE SOURCING

- Sections 1, 2 introduction (above) — copied by Nate from the KQM TCL Elemental Effects index
- Sections 3 (per-reaction detail) and 4 — fetched 2026-05-10 from KQM TCL via WebFetch
- Section 5 — fetched 2026-05-10 from KQM TCL via WebFetch (KQM flags absorption as "not yet fully understood")
- Sections 6, 7 — deferred; not load-bearing for v1.5 implementation
- Section 8 — KQM page is a stub; gcsim React() priority used as canonical source. Nate will source the linked Google Doc manually if SRP edge cases come up during implementation.



INFO Reaction Terms

For a more in-depth look at reactions, there is a whole section dedicated to them in the TCL.

Amplified(Amped) = A category for reactions, which Melt and Vaporize fall into. Amped reactions multiply the trigger by a specific multiplier, for more details go to General Reaction Mechanics .

Aura = If a targetable entity is currently not affected by any Element, the next Elemental source will apply an aura.

Aura Tax = The aura tax reduces the gauge application from Elemental sources by a multiplier of 0.8.

Coexisting/Underlying Aura = In certain situations (e.g. Electro-Charged) multiple auras of different Elements may exist on the same entity.

Elemental Decay = An aura will persist a certain duration depending on the type of Elemental source. Think of the duration as a gauge that can decay or be reduced in 2 ways:

Via time (A, B, C)
The gauge will decay over time. Each letter represents a different decay rate, which can be referenced in Notation. Once the gauge empties, the Elemental aura disappears.
Via reactions (GU)
When you apply an Elemental trigger to an existing Elemental aura, a certain amount of the gauge is consumed. If an amount remains, then the aura will persist after the reaction. If the gauge is fully consumed, the aura disappears.
Elemental Gauge / Gauge Units (GU) = The strength of an Elemental source, which dictates how much of the aura is consumed when a reaction occurs.

See Gauge Unit Database to see each source’s U value
Elemental Source = An Element-imbued attack or Skill that will apply an Element on the enemy. All Elemental sources should have the decay and GU appended.

Internal Cooldown (ICD) = A hidden timer that occurs when an Elemental source applies an aura or trigger to an enemy. For more details, see our page on ICDs.

During this ICD, repeated use of that specific Elemental source WILL do Elemental damage, but WILL NOT apply an aura/trigger
Reverse [Melt/Vaporize] = A Vaporize or Melt reaction where the trigger gets a 1.5x modifier.

Is also referred to as Cryo Melt, Pyro Vaporize, Weak Melt/Vaporize
Swirled Aura = An aura that's applied through the use of Swirl spreading the aura of one enemy to a different enemy.

Transformative = A category for reactions, which Overload, Electro-Charged, Superconduct, Freeze, Shatter, Swirl, and Crystallize fall into.

Transformative reactions deal damage based on the trigger character level and their EM, for more details go to General Reaction Mechanics
Trigger = If a targetable entity has an existing aura, the next Elemental source will act as a trigger for a reaction.

Unit Modifier = A system of modifiers that apply to Elemental sources.

This modifier can increase or decrease how much of the aura is consumed in reactions.