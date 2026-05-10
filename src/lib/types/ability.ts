/**
 * src/lib/types/ability.ts
 *
 * Ability/effect model types. `Ability` is a discriminated union over
 * `abilityType`; skill/burst additionally discriminate over `behavior`
 * (instant vs persistent vs stance) so duration-bearing fields are required
 * on the variants where they apply.
 */

// ---------------------------------------------------------------------------
// Elements & reactions
// ---------------------------------------------------------------------------

/** Element keys used by the transformer output (lowercase).
 *
 * Note: "physical" is valid for damage instances and RES debuffs (Rosaria C6
 * Physical RES, Razor's Physical N hits, etc.) but is not a valid character
 * element — no character has Physical as their assigned element. The
 * `CharacterData.element` field and `NormalAbility.infusion`/`infuse` Effect
 * `element` fields should never be set to "physical"; the lint enforces this
 * via separate vocabulary sets. */
export type Element =
	| 'anemo'
	| 'cryo'
	| 'dendro'
	| 'electro'
	| 'geo'
	| 'hydro'
	| 'pyro'
	| 'physical';

/** Elemental reactions used by triggers and effects. */
export type Reaction =
	| 'vaporize'
	| 'overloaded'
	| 'melt'
	| 'burning'
	| 'swirl'
	| 'crystallize'
	| 'lunarCrystallize'
	| 'electroCharged'
	| 'lunarCharged'
	| 'frozen'
	| 'shatter'
	| 'bloom'
	| 'lunarBloom'
	| 'burgeon'
	| 'hyperbloom'
	| 'superConduct'
	| 'quicken'
	| 'spread'
	| 'aggravate';

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Canonical stat keys used by the gold-standard effect model. */
export type Stat =
	| 'atk'
	| 'baseAtk'
	| 'em'
	| 'hp'
	| 'def'
	| 'critRate'
	| 'critDmg'
	| 'atk%'
	| 'hp%'
	| 'def%'
	| 'allDmgBonus'
	| 'anemoDmgBonus'
	| 'cryoDmgBonus'
	| 'dendroDmgBonus'
	| 'electroDmgBonus'
	| 'geoDmgBonus'
	| 'hydroDmgBonus'
	| 'pyroDmgBonus'
	| 'lunarDmgBonus'
	| 'skillDmgBonus'
	| 'burstDmgBonus'
	// Reaction-specific DMG bonus modifiers — apply only to damage that triggers
	// the named reaction (Moonsign characters: Flins/Ineffa, Aino/Nefer, Linnea
	// moonsign-init/C6, Jahoda C6).
	| 'lunarChargedDmgBonus'
	| 'lunarBloomDmgBonus'
	| 'lunarCrystallizeDmgBonus'
	| 'cdReduction'
	| 'healingBonus'
	| 'incomingHealingBonus'
	// Element-self RES — defensive resistance buffs (Hu Tao C6, Arlecchino A4 +
	// C2 + C6, Wanderer C6). `allElementalRes` is the all-7-elements shorthand;
	// `physicalRes` is its physical counterpart. Pair them when a buff covers
	// both ("all-element + Physical RES").
	| 'anemoRes'
	| 'cryoRes'
	| 'dendroRes'
	| 'electroRes'
	| 'geoRes'
	| 'hydroRes'
	| 'pyroRes'
	| 'physicalRes'
	| 'allElementalRes'
	// Element-specific CRIT DMG modifiers — buff CRIT DMG only on attacks of the
	// named element (Escoffier C1 Cryo CRIT DMG, Shenhe C6 Cryo CRIT DMG inside
	// burst field, Columbina C2 per-reaction-element CRIT DMG). Distinct from
	// generic `critDmg` which applies to all of the recipient's attacks.
	| 'anemoCritDmg'
	| 'cryoCritDmg'
	| 'dendroCritDmg'
	| 'electroCritDmg'
	| 'geoCritDmg'
	| 'hydroCritDmg'
	| 'pyroCritDmg'
	// Flat DMG bonuses added to damage output (not % multipliers); commonly HP-scaled.
	| 'normalFlatDmg'
	| 'chargeFlatDmg'
	| 'plungeFlatDmg'
	| 'skillFlatDmg'
	| 'burstFlatDmg';

// ---------------------------------------------------------------------------
// Ability sections & inputs
// ---------------------------------------------------------------------------

/** High-level grouping for ability description sections. */
export type AbilitySectionType =
	| 'normal'
	| 'charged'
	| 'plunging'
	| 'skill'
	| 'burst'
	| 'passive'
	| 'other';

/** A display section used to organize ability descriptions. */
export type AbilitySection = {
	type: AbilitySectionType;
	title: string;
	description: string;
};

/** Rotation input tokens used by the notation parser. */
export type Input =
	| 'N'
	| 'N1'
	| 'N2'
	| 'N3'
	| 'N4'
	| 'N5'
	| 'N6'
	| 'C'
	| 'C1'
	| 'C2'
	| 'P'
	| 'E'
	| 'Q'
	| 'tE'
	| 'pE'
	| 'hE'
	| 'h1E'
	| 'h2E'
	| 'D'
	| 'J';

// ---------------------------------------------------------------------------
// Ability tags
// ---------------------------------------------------------------------------

/** Canonical tag keys for ability classification (singular). */
export type AbilityTag = 'coordinatedAttack' | 'heal' | 'shield' | 'summon' | 'taunt';

// ---------------------------------------------------------------------------
// Scaling helpers
// ---------------------------------------------------------------------------

/** Refinement-scaled values for weapons or effects. */
export type ScaledValue = {
	refinementValues: [number, number, number, number, number];
};

/** Stats that a value can scale from. */
export type ScalingStat = 'atk' | 'baseAtk' | 'em' | 'hp' | 'def';

// ---------------------------------------------------------------------------
// Damage tags & trigger filters (G primitive — sub-ability filtering)
// ---------------------------------------------------------------------------

/**
 * Canonical tag carried by a damage instance, mirroring gcsim's `AttackTag`.
 *
 * Most damage maps cleanly from its source ability:
 *   - normal-attack hits → `normal`
 *   - charged-attack hits → `charged`
 *   - plunge hits → `plunge`
 *   - skill cast/hits → `skill`
 *   - skill cast via Hold variant → `skillHold` (Diluc Hold-E, Wriothesley
 *     in-stance distinction)
 *   - burst cast/hits → `burst`
 *
 * The `getDefaultDamageTag` helper resolves the implicit tag from the host
 * ability + variant. Authors only set `damageTag` explicitly when the default
 * doesn't match (the rare "stance-N-still-tagged-Normal" cases handle
 * themselves; specific overrides like Mavuika's bike-N tagging differently
 * would set it explicitly).
 *
 * Stance-converted N attacks RETAIN their `normal` tag in the in-game system
 * — Hu Tao's Paramita N1-N6, Cyno's Pactsworn N1-N4, Itto's Saichi sequence
 * are all still tagged Normal, just with element infusion changing.
 */
export type DamageTag = 'normal' | 'charged' | 'plunge' | 'skill' | 'skillHold' | 'burst';

/**
 * Fine-grained filter on `onHit` triggers. All specified fields must match
 * for the trigger to fire (intersection). Absent fields don't constrain.
 *
 * - `damageTag` — exact match against the hit's resolved damage tag. Used
 *   when `abilityType` is too coarse (Hold-only filtering needs `skillHold`,
 *   plunge-extra-only would need a more specific tag, etc.).
 * - `element` — element of the hit. For normals, this is the active infusion
 *   (or `physical` if uninfused). For skill/burst, the source ability's
 *   element (typically the character's element).
 * - `abilityName` — substring match (case-sensitive) against the parent
 *   ability's `name`. Used for sub-ability gates like "Wreath Arrow only"
 *   (Tighnari A1/A4/C1/C6), "Saichi exclusion" (Itto A4 — match all
 *   Kesagiri variants by negation in a future revision), "Pressurized Floe"
 *   (Aloy A4, Freminet A1), "Shadowpiercing Shot" (Sethos).
 * - `hitIndex` — 0-based index into a normal-attack combo (or charged-hit
 *   list). Used for "only N4 fires this" (Chongyun C1: NormalCounter==3) /
 *   "only N3 final hit triggers" (Kokomi A4) / "C2 fires on the final
 *   Wreath Arrow hit" patterns. Has no meaning for skill/burst hits.
 * - `isCrit` — when `true`, the trigger only fires on critical hits. Used
 *   for Yoimiya C2 (Pyro crit), Rosaria C1 (any crit), Gaming C2 (crit-on-
 *   plunge), etc. The planner doesn't simulate crit outcomes; the renderer
 *   treats this as "fire optimistically — assume crit when applicable".
 */
export type TriggerFilter = {
	damageTag?: DamageTag;
	element?: Element;
	abilityName?: string;
	hitIndex?: number;
	isCrit?: boolean;
};

// ---------------------------------------------------------------------------
// Conditions & triggers
// ---------------------------------------------------------------------------

/** Custom condition keys for gameplay state checks. */
export type CustomConditionKey =
	| 'enemyFrozen'
	| 'enemyAffectedByPyro'
	| 'enemyAffectedByHydro'
	| 'enemyBelow50'
	| 'enemyAbove50';

/** Logical condition tree for effect gating. */
export type Condition =
	| { type: 'state'; state: State }
	| { type: 'not'; condition: Condition }
	| { type: 'all'; conditions: Condition[] }
	| { type: 'any'; conditions: Condition[] }
	| { type: 'ascension'; min: number }
	| { type: 'constellation'; level: number }
	| { type: 'teamFaction'; faction: string; min: number }
	/** True when the currently-active character (the receiver, in per-segment
	 *  evaluation) belongs to the named faction. Used for buff routing that
	 *  depends on the active char's identity rather than team-wide composition.
	 *
	 *  Resolves only inside per-segment renderer evaluation (where the receiver's
	 *  factions are known); returns null on parser-side and team-buff-row calls.
	 *
	 *  Reference: Linnea A4 — 5% DEF → EM, routed to the active char if Moonsign,
	 *  else to Linnea herself. Author as two effects: target=active gated on
	 *  `activeCharFaction: moonsign`, target=self gated on the negation. */
	| { type: 'activeCharFaction'; faction: string }
	| { type: 'weaponType'; weapons: ('sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst')[] }
	/** Multi-stage skill or burst chain. Each stage in the chain has an entry
	 *  with this condition; the parser tracks per-character chain position and
	 *  picks the matching ability on each press.
	 *
	 *  - `index` is 0-based; index 0 is the cold-open (the press that starts the chain).
	 *  - `window` is the seconds within which the *next* stage must fire after this
	 *    one. Omit on the terminal (last) stage; absence signals "after firing me,
	 *    reset the chain to index 0."
	 *
	 *  Reference: Diluc Searing Onslaught E1 → E2 → E3, each within 4s of the prior. */
	| { type: 'chainStage'; ability: 'skill' | 'burst'; index: number; window?: number }
	/** Gates on user-asserted stack count for a named resource (Heizou
	 *  Declension, Yanfei Scarlet Seals, Mualani Wave Momentum, etc.).
	 *
	 *  The planner does NOT auto-track stack accumulation. Stacks are
	 *  asserted by the user via the `{key:N}` notation token: typing
	 *  `Heizou {declension:4} E` sets declension=4 immediately before the
	 *  E cast, and the parser uses that state to resolve the active ability
	 *  variant and gate stack-conditioned effects.
	 *
	 *  - `key` — resource name (must match the assertion token key)
	 *  - `min` — minimum stack count for the condition to hold
	 *  - `max` — optional upper bound (rarely needed; useful for per-tier
	 *    buff effects where exactly-N stacks gives a specific bonus)
	 *
	 *  Stack state resets to 0 on character swap; assertions persist across
	 *  multiple actions within a single on-field segment until the next
	 *  assertion of the same key changes the value. */
	| { type: 'stacks'; key: string; min: number; max?: number }
	| { type: 'custom'; key: CustomConditionKey };

/** A specific chain-stage condition extracted from a Condition tree. */
export type ChainStageCondition = Extract<Condition, { type: 'chainStage' }>;

/** Event trigger definition for when an effect applies. */
export type Trigger =
	| {
			type: 'onCast';
			/** Which ability type's cast fires the trigger. Omit to match any cast. */
			ability?: 'skill' | 'burst';
	  }
	| {
			type: 'onHit';
			/** Coarse filter — preferred for simple cases. The fine-grained
			 *  `filter.damageTag` is preferred when distinguishing skillHold from
			 *  skill, charged-attack-extra from regular Extra, etc. */
			abilityType?: 'skill' | 'burst' | 'normal' | 'charged' | 'plunge';
			damageType?: 'elemental' | 'physical';
			/** Fine-grained filter (G primitive). Lets effects gate triggers on
			 *  damageTag, element of the hit, sub-ability name, hit index, or
			 *  crit state. See {@link TriggerFilter}. When present, ALL specified
			 *  fields must match for the trigger to fire (intersection). */
			filter?: TriggerFilter;
	  }
	| { type: 'onReaction'; reaction: Reaction | Reaction[] | 'any' }
	| { type: 'onEnergy'; threshold: number }
	| { type: 'onHPChange' }
	| { type: 'onHPDecrease' }
	| { type: 'onHPIncrease' }
	| { type: 'onHeal' }
	| { type: 'onState'; state: State }
	| { type: 'manual' }
	/** Fires when the holder leaves the field; buff targets the incoming character (e.g. TTDS). */
	| { type: 'onSwapOut' }
	/** Fires when the holder enters the field; buff targets themselves (e.g. The Widsith). */
	| { type: 'onSwapIn' }
	/** Fires after N qualifying events accumulate (e.g. Freedom-Sworn: 2 reactions). */
	| { type: 'onStack'; count: number }
	/** Always-on passive — not rendered in the team buffs row. */
	| { type: 'passive' }
	/** Fires when the host ability's duration expires; buff starts at bar.end.
	 *  When the effect lives on a passive/constellation (not on the host ability itself),
	 *  `ability` must be set to disambiguate which ability's duration binds the trigger.
	 *  Example: Raiden C4 Pledge of Propriety — ATK% buff after Musou Isshin ends. */
	| { type: 'afterDuration'; ability?: 'skill' | 'burst' }
	/** Fires when the character's active stance window closes (naturally or via Q cast). Buff starts at stance end time. Used for post-stance team buffs (e.g. Hu Tao A1: CRIT Rate after Paramita Papilio ends). */
	| { type: 'onStanceEnd' }
	/** Fires on every team Nightsoul Burst event — the same rolling-cooldown
	 *  events the NB lane renders (E/Q cast or catalyst entering field; cooldown
	 *  18s/12s/9s for 1/2/3+ Natlan units). Global team event: not gated on
	 *  the trigger-owner being on-field, since the in-game OnNightsoulBurst
	 *  event is team-scoped. Used for "+ATK when teammate triggers NB"-shape
	 *  passives (Mavuika A1, Varesa A4, Xilonen A2, Ifa A1, Chasca A2,
	 *  Iansan A2). Does not fire when no NB events occur (no Natlan units in
	 *  team — `nbBars` is empty). */
	| { type: 'onTeamNightsoulBurst' }
	/** Fires periodically while the parent summon is active. Only valid on
	 *  effects within `Summon.effects[]`. The timeline renders one marker per
	 *  tick on the summon bar.
	 *
	 *  - `interval` — seconds between ticks.
	 *  - `firstTickDelay` — seconds from summon spawn to first tick. Defaults
	 *    to `interval` (mirrors gcsim's "first tick after one interval"
	 *    convention for most summons).
	 *
	 *  Reference: Fischl Oz, Zhongli Stone Stele, Albedo Solar Isotoma blossom,
	 *  Ororon Supersonic Oculus, Mavuika Ring of Searing Radiance. */
	| { type: 'summonTick'; interval: number; firstTickDelay?: number };

/** Known gameplay state keys used in conditions and triggers. */
export type State =
	| 'afterNormalAttack'
	| 'afterSkill'
	| 'afterBurst'
	| 'afterDurationEnds'
	| 'shielded'
	| 'onField'
	| 'offField'
	| 'duringSummon'
	| 'hpBelow50'
	| 'hpBelow70'
	| 'hpAbove50'
	| 'hpAbove70'
	| 'hpFull'
	| 'nightsoulBlessing'
	| 'inStance';

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

/** Base modifier data shared by cooldown/duration modifiers. */
export type ModifierBase = {
	source: string;
	type: 'percent' | 'flat';
	value: number;
	conditions?: Condition;
	priority?: number;
};

/** Cooldown-specific modifier payload. */
export type CooldownModifier = ModifierBase;

/** Duration-specific modifier payload. */
export type DurationModifier = ModifierBase;

/** Charge-count modifier payload. */
export type ChargeModifier = ModifierBase;

// ---------------------------------------------------------------------------
// Summons
// ---------------------------------------------------------------------------

/**
 * An entity (summon, field, deployable) spawned by an ability with its own
 * lifetime, decoupled from the cast/cancel window.
 *
 * Examples: Fischl Oz, Mona Bubble + Omen, Zhongli stele, Bennett field,
 * Sucrose burst gust, Ganyu lotus. One ability may own multiple summons.
 *
 * When `summons[]` is populated on an ability, the timeline's active-window
 * rendering derives from the summons (one lane per entry). When absent,
 * rendering falls back to the ability's own `duration` (legacy persistent shape).
 *
 * An ability can be `behavior: "instant"` and still own summons — that's the
 * canonical case for "the cast is short but spawns something that persists."
 */
export type Summon = {
	/** Display label (e.g. "Oz", "Stone Stele", "Illusory Bubble"). */
	label: string;
	/** Lifetime in seconds, measured from spawn. Required. */
	duration: number;
	/** Frames (60fps) from cast start until the summon spawns. Defaults to 0. */
	spawnsAt?: number;
	durationModifiers?: DurationModifier[];
	/** Whether the summon stays in place or follows the caster. */
	mobility?: 'stationary' | 'follows';
	/** Conditions that end the summon before its natural duration.
	 *  "swap" — ends when the caster swaps off-field.
	 *  "recast" — ends when the source ability is cast again. */
	terminatesOn?: 'swap' | 'recast';
	/** Effects emitted by the summon while active. Damage effects with
	 *  `trigger: { type: "summonTick", interval: N }` fire at fixed intervals
	 *  during the summon's lifetime; the timeline renders one marker per tick
	 *  on the summon bar. Other trigger types (onHit, onReaction, etc.) are
	 *  reserved for future P3 extensions and currently unused. */
	effects?: Effect[];
	/** Dynamic event-triggered duration extensions for this summon. Each entry
	 *  describes an event that adds `delta` seconds to the summon's lifetime
	 *  while it's active (e.g. Collei's Cuilein-Anbar zone +1s per dendro
	 *  reaction). Parser dispatch is currently `onCast`-only; other triggers
	 *  are schema-accepted but not yet wired. */
	durationExtensions?: DurationExtension[];
};

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/** Who an effect applies to. Array form expresses compound targets (e.g. ["self", "active"]). */
export type EffectTarget = 'self' | 'team' | 'teamExcludingSelf' | 'active' | 'next' | 'enemy';

/** Base effect payload shared by all effect kinds. */
export type EffectBase = {
	type:
		| 'buff'
		| 'damage'
		| 'heal'
		| 'shield'
		| 'resShred'
		| 'energy'
		| 'cdReset'
		| 'cooldownReduce'
		| 'infuse'
		| 'elevate';
	trigger: Trigger;
	conditions?: Condition;
	duration?: number;
	durationType?: 'refresh' | 'fixed';
	/**
	 * Minimum seconds between procs of this effect. 0 or absent = no ICD.
	 * Distinct from duration: ICD governs re-proc frequency; duration governs
	 * how long each proc's buff window lasts. Example: TTDS — procCooldown: 20, duration: 10.
	 * ScaledValue form used when the ICD scales by weapon refinement (e.g. Sacrificial series).
	 */
	procCooldown?: number | ScaledValue;
	target: EffectTarget | EffectTarget[];
	/** Attribution label for effects collapsed from passives/constellations, e.g. "P2: Harmony Between Heaven and Earth" */
	attribution?: string;
};

/** Value payload for buffs, including scaling or capped scaling. */
export type BuffValue =
	| number
	| ScaledValue
	| {
			type: 'scaling';
			stat: Stat;
			ratio: number | ScaledValue;
			cap?: number;
	  }
	| {
			/** Value exists but depends on runtime inputs (e.g. a character's ER or energy cost) that the planner cannot resolve. The description is shown verbatim in tooltips. */
			type: 'unknown';
			description: string;
	  }
	| {
			/** Buff value ramps up over time from startValue by stepValue every stepInterval seconds, capping at cap. */
			type: 'ramping';
			startValue: number;
			stepValue: number;
			stepInterval: number;
			cap?: number;
	  }
	| {
			/** Buff value decays linearly from `startValue` to `endValue` (default 0)
			 *  over the host effect's `duration`. Inverse of `ramping`.
			 *
			 *  Use this for post-cast buffs that ramp DOWN to nothing within their
			 *  buff window (Mavuika A4 Kiongozi: per-FS-point allDmgBonus decaying
			 *  linearly to 0 over 20s post-burst).
			 *
			 *  The renderer shows a gradient bar — full opacity at decay start,
			 *  dim at decay end — mirroring the existing `ramping` gradient in
			 *  reverse. Active-target segmentation picks up the gradient at the
			 *  correct decay progress for each on-field window.
			 *
			 *  v1 supports a plain-numeric `startValue`. Composing decaying with
			 *  perStack (per-FS-point peak that then decays — Mavuika A4 actually
			 *  scales 0.2% allDmgBonus per FS consumed, max 40%) is not yet
			 *  expressible; author at the max-stack peak with caveat. Future v2
			 *  would either nest a `BuffValue` as the start, or extend `perStack`
			 *  with a `decayingTo` field. */
			type: 'decaying';
			startValue: number;
			endValue?: number;
	  }
	| {
			/** Buff value scales linearly with user-asserted stack count for a named
			 *  resource. Resolved at render time against the cast's `stackContext`
			 *  snapshot (TimelineBar.stackContext, populated by the parser when the
			 *  user asserts stacks via the `{key:N}` notation token).
			 *
			 *  Effective value = min(stacks, maxStacks ?? stacks) * per.
			 *
			 *  Pair with `conditions: { type: "stacks", key, min: 1 }` so the buff
			 *  bar only renders on casts that have at least one asserted stack.
			 *
			 *  Two `per` forms:
			 *  - **Plain number** — percentage points or flat numbers in the unit
			 *    of the host `stat` (Heizou Declension +4% CR/stack, Yanfei Seal
			 *    +5% pyroDmgBonus/stack).
			 *  - **Scaling object** `{ stat, ratio }` — per-stack stat scaling
			 *    (Kinich A4 Hunter's Experience: 320% ATK FlatDmg/stack on
			 *    Scalespiker Cannon; Mavuika Sunfell Slice: per-FS-point ATK
			 *    FlatDmg). Renders like the standard `scaling` BuffValue but
			 *    multiplied by stack count. */
			type: 'perStack';
			key: string;
			per: number | { stat: ScalingStat; ratio: number };
			maxStacks?: number;
	  };

/** Full effect union used by the gold-standard model. */
export type Effect =
	| (EffectBase & {
			type: 'buff';
			source: 'character' | 'weapon' | 'artifact';
			stat: Stat;
			value: BuffValue;
			snapshottable: boolean;
			stacks?: {
				maxStacks: number;
				durationModel: 'shared' | 'separate';
			};
			constellationScaling?: {
				conditions: Condition;
				value: BuffValue;
			};
	  })
	| (EffectBase & {
			type: 'damage';
			scaling: number | ScaledValue;
			stat: ScalingStat;
			element?: Element;
			/** Optional literal flat addend co-located with the scaling source. The
			 *  effective per-hit damage is `scaling% × stat + flat` (gcsim's
			 *  AttackInfo.FlatDmg). Use for talent-table flat damage that's tabulated
			 *  alongside the % scaling — Jahoda burst-tick base, etc. EM-scaling /
			 *  stat-scaled flat addends (Aino A4) need a separate primitive; defer. */
			flat?: number;
	  })
	| (EffectBase & {
			type: 'heal';
			scaling: number | ScaledValue;
			stat: ScalingStat;
			/** Optional literal flat addend co-located with the scaling source. The
			 *  effective per-tick heal is `scaling% × stat + flat`. Use for talent-
			 *  table flat heal that's tabulated alongside the scaling — Jahoda Robot
			 *  heal-tick base (~1102 at lvl=10), Linnea Q heal flat portions. */
			flat?: number;
	  })
	| (EffectBase & {
			type: 'shield';
			scaling: number | ScaledValue;
			stat: ScalingStat;
	  })
	| (EffectBase & {
			type: 'resShred';
			element?: Element;
			value: number;
	  })
	| (EffectBase & {
			type: 'energy';
			amount: number;
	  })
	| (EffectBase & {
			type: 'infuse';
			element: Element;
	  })
	| (EffectBase & {
			type: 'cdReset';
			source: 'weapon' | 'character';
			// The trigger encodes WHICH cast fires the reset (`trigger.type ===
			// "onCast"` only). The optional `resets` field encodes WHICH ability's
			// CD is reset; when omitted, defaults to `trigger.ability` (the
			// Sacrificial-weapon convention where the firing ability is also the
			// reset target). For character resets where firing ≠ reset target
			// (Kazuha C1: Q resets E), set `resets` explicitly.
			//
			// `source: "weapon"` is used by the Sacrificial weapon series (proc on
			// skill hit, refunds the skill charge). `source: "character"` is used
			// by character-intrinsic resets — Kazuha C1 (Q resets E), etc. The
			// parser handles both: weapon procs use the weapon's procCooldown;
			// character cdReset fires unconditionally on every matching cast (no
			// procCooldown).
			resets?: 'skill' | 'burst';
	  })
	| (EffectBase & {
			/** Fixed-amount cooldown reduction on the ability named by `trigger.ability`.
			 *  Distinct from `cdReset` (which fully refunds a charge): `cooldownReduce`
			 *  shaves a literal number of seconds off the CD timer.
			 *
			 *  Use cases: Arlecchino C4 (-2s burst CD on absorb event), Gorou C2
			 *  (-2s skill CD on team Geo hit), Navia C1 (-1s burst CD per Crystal
			 *  Shrapnel stack consumed). Schema-only at v1; parser implementation
			 *  deferred until the surrounding event-trigger primitives land
			 *  (onAbsorbDirective, team-Geo-onHit, etc.). */
			type: 'cooldownReduce';
			source: 'character';
			/** Seconds to subtract from the named ability's remaining CD. */
			amount: number;
	  })
	| (EffectBase & {
			/** Multiplicative per-attack DMG bonus tier, distinct from reaction-bonus
			 *  stat keys. Maps to gcsim's `atk.Info.Elevation += value/100` — the
			 *  damage formula applies it as `damage *= (1 + elevation)` after the
			 *  EM/reaction bracket. The `reactions` filter scopes the elevation to
			 *  damage instances tagged with one of the named reactions; each entry
			 *  covers both the direct hit (AttackTagDirect*) and the reaction-trigger
			 *  (AttackTagReaction*) sub-tags in gcsim's taxonomy.
			 *
			 *  Use cases: Flins C6 (+35% Lunar-Charged self, +10% team Moonsign),
			 *  Lauma C6 (+25% Lunar-Bloom team Moonsign), Linnea C6 (+25% Lunar-
			 *  Crystallize team Moonsign), Nefer C6 (+15% Lunar-Bloom self Moonsign).
			 *
			 *  Renderer treatment: rendered as a buff bar via display-stat mapping
			 *  (single-reaction → matching `lunar*DmgBonus` synthetic stat for
			 *  formatting/de-dup). Multi-reaction arrays are reserved for future
			 *  cases (Columbina "all lunar reactions") and not yet rendered. */
			type: 'elevate';
			source: 'character' | 'weapon' | 'artifact';
			reactions: Reaction[];
			value: BuffValue;
			snapshottable: boolean;
	  });

// ---------------------------------------------------------------------------
// Frame timing
// ---------------------------------------------------------------------------

/**
 * Keys representing the action that follows a cast — used to look up the
 * correct cancel window. "swap" is the fallback (full animation, no cancel).
 * Hitlag and attack speed are not modelled at this level.
 */
export type ActionKey = 'N' | 'C' | 'E' | 'Q' | 'D' | 'J' | 'P' | 'swap';

/**
 * Per-next-action frame durations (60fps integers).
 * `swap` is required and acts as the fallback when a key is absent.
 * Absent keys resolve to `frames.swap` in the parser.
 *
 * Curation convention: for multi-hit attacks where the cancel window only opens
 * after the final hitmark (e.g. a double-hit N4), all keys must reflect the
 * frame of the *last* hitmark — not an earlier sub-hit. Cancelling before the
 * final hit lands loses damage and is not a valid rotation decision.
 */
export type FrameMap = Partial<Record<ActionKey, number>> & { swap: number };

/**
 * Timing data for a single hit in a normal-attack combo.
 * Array index = hit number (0-based). Parser indexes by normalCounter.
 * For multi-hit entries see the FrameMap curation convention above.
 *
 * `damageTag` is rarely set explicitly — `getDefaultDamageTag` infers it
 * from the parent context (`normal` for entries in `hits[]`, `charged` for
 * `chargeHits[]`). Override only when the canonical tag diverges (none in
 * the curated corpus today).
 */
export type NormalHit = { name?: string; frames: FrameMap; damageTag?: DamageTag };

/**
 * Dynamic event-triggered extension of an active duration window. Authored on
 * the ability that *opens* the window — for stance abilities, that's the
 * stance variant of the skill/burst that owns the stance window; for summons,
 * the `Summon` itself.
 *
 * Each entry adds `delta` seconds to the active window's end time when its
 * `trigger` fires (and `conditions` hold), up to `maxExtensions` per window
 * (omit for unlimited), with at least `procCooldown` seconds between
 * consecutive extensions from the same entry.
 *
 * Reference: Cyno's burst stance is extended +4s by each in-stance Mortuary
 * Rite cast (max 2 extensions). Authored on the burst as
 * `{ trigger: { type: "onCast", ability: "skill" },
 *    conditions: { type: "state", state: "inStance" },
 *    delta: 4, maxExtensions: 2 }`.
 *
 * Parser dispatch is currently wired only for `onCast` triggers. Other trigger
 * types (`onReaction`, `onHit`, etc.) are accepted in schema but don't yet
 * fire extensions at runtime — those characters' curator notes flag the gap.
 */
export type DurationExtension = {
	trigger: Trigger;
	/** Seconds added to the window end time per extension. Fractional allowed. */
	delta: number;
	/** Cap on total extensions per window (resets when the window re-opens).
	 *  Omit for unlimited. */
	maxExtensions?: number;
	/** Minimum seconds between consecutive extensions from this entry. */
	procCooldown?: number;
	/** Additional gating beyond the trigger (e.g. a `state` condition). */
	conditions?: Condition;
};

// ---------------------------------------------------------------------------
// Ability — discriminated union over abilityType (and behavior on skill/burst)
// ---------------------------------------------------------------------------

/** Fields shared by every ability variant. */
export type AbilityCommon = {
	id: string;
	name: string;
	shortName?: string;
	/** In-game description text from the game source (genshin-db / wiki).
	 *  Canonical only — do NOT place implementation notes, planner caveats,
	 *  or curator observations here. */
	description?: string;
	/** User-facing caveat about how the planner represents this ability —
	 *  limitations, unmodelled mechanics, things a user should know when
	 *  reading the timeline. Rendered in the timeline caveats panel. */
	caveat?: string;
	/** Curator-only scratch notes. Never rendered to end users.
	 *  Use for: skipped effects with reasons, design questions,
	 *  future-wiring ideas, frame-source confidence notes. */
	_curatorNotes?: string[];
	sections?: AbilitySection[];
	/** Availability gate — if present and evaluates false, ability is not resolvable. */
	conditions?: Condition;
	effects?: Effect[];
};

/** Normal-attack ability. Holds normals + charged + plunge frames in one record. */
export type NormalAbility = AbilityCommon & {
	abilityType: 'normal';
	input: Input[];
	/** Per-hit timing for the normal-attack combo. Required. */
	hits: NormalHit[];
	/** Charged-attack frames for sword/claymore/polearm. Mutually exclusive with chargeHits. */
	chargeFrames?: FrameMap;
	/** Per-level charged hits for bow characters. Mutually exclusive with chargeFrames.
	 *  Index 0 = C1 (partial); index 1 = C2 (full / Frostflake). */
	chargeHits?: NormalHit[];
	/** Plunge attack frames (base). Covers the standalone `P` token and the
	 *  `E P` path where no plungeVariant matches the preceding E token. */
	plungeFrames?: FrameMap;
	/** Plunge variants keyed by the preceding E token — e.g. Kazuha's
	 *  Midare Ranzan has distinct frames for `E P` (press) vs `hE P` (hold).
	 *  Selection is "first entry whose input[] contains the preceding E text". */
	plungeVariants?: PlungeVariant[];
	/** Elemental infusion applied to N/C/P while this ability is active.
	 *  Used on stance normals (e.g. Cyno's Pactsworn Pathclearer). */
	infusion?: Element;
	noICD?: boolean;
	tags?: AbilityTag[];
};

/** Plunge-variant override selected by the preceding E token text. */
export type PlungeVariant = {
	label: string;
	input: Input[];
	frames: FrameMap;
};

/** Fields shared by all skill behavior variants. */
type SkillCommonFields = AbilityCommon & {
	abilityType: 'skill';
	input: Input[];
	/** Frame-accurate cast timing (60fps). Required for E/Q. */
	frames: FrameMap;
	/** Cooldown in seconds. Required. */
	cooldown: number;
	/** Frames (60fps) from cast start until the cooldown timer begins ticking.
	 *  Sourced from gcsim's `SetCDWithDelay` second argument. Only needed when non-zero. */
	cooldownStartDelay?: number;
	cooldownModifiers?: CooldownModifier[];
	charges?: number;
	chargeModifiers?: ChargeModifier[];
	snapshots?: boolean;
	noICD?: boolean;
	tags?: AbilityTag[];
	/** Entities spawned by this cast with their own lifetimes. When present,
	 *  these supersede the ability's own `duration` for active-window rendering. */
	summons?: Summon[];
	variants?: AbilityVariant[];
};

/** Skill ability — discriminated by behavior. Persistent/stance variants require duration. */
export type SkillAbility =
	| (SkillCommonFields & { behavior: 'instant' })
	| (SkillCommonFields & {
			behavior: 'persistent';
			/** Persistent-summon active-window duration in seconds. Required on persistent. */
			duration: number;
			durationModifiers?: DurationModifier[];
			persistentBehavior?: 'stationary' | 'follows';
			/** Frame (60fps) at which the persistent summon becomes active, relative to cast start.
			 *  Sourced from gcsim's per-character activation constant. Defaults to 0. */
			summonActivatesAt?: number;
	  })
	| (SkillCommonFields & {
			behavior: 'stance';
			/** Stance window duration in seconds. Required on stance. */
			duration: number;
			durationModifiers?: DurationModifier[];
			/** Dynamic event-triggered extensions of this stance window. See
			 *  {@link DurationExtension}. Authored on the ability that opens
			 *  the stance — extensions fire while the window is active. */
			durationExtensions?: DurationExtension[];
			/** Stance window closes when this character swaps off-field. */
			terminatesOnSwap?: boolean;
			/** Additional named state opened when this stance is active, alongside the
			 *  default "inStance". Closes with the stance window. Used for Natlan
			 *  Nightsoul characters where the stance is semantically a Nightsoul Blessing
			 *  window (opensState: "nightsoulBlessing"). Conditions can gate on either
			 *  inStance (for backwards compat) or the named state. */
			opensState?: State;
	  });

/** Fields shared by all burst behavior variants. */
type BurstCommonFields = AbilityCommon & {
	abilityType: 'burst';
	input: Input[];
	frames: FrameMap;
	cooldown: number;
	cooldownStartDelay?: number;
	cooldownModifiers?: CooldownModifier[];
	/** Energy cost of the burst. Required. */
	energyCost: number;
	snapshots?: boolean;
	noICD?: boolean;
	tags?: AbilityTag[];
	/** Entities spawned by this cast with their own lifetimes. When present,
	 *  these supersede the ability's own `duration` for active-window rendering. */
	summons?: Summon[];
	variants?: AbilityVariant[];
};

/** Burst ability — same behavior split as skill, plus required energyCost. */
export type BurstAbility =
	| (BurstCommonFields & { behavior: 'instant' })
	| (BurstCommonFields & {
			behavior: 'persistent';
			duration: number;
			durationModifiers?: DurationModifier[];
			persistentBehavior?: 'stationary' | 'follows';
			summonActivatesAt?: number;
	  })
	| (BurstCommonFields & {
			behavior: 'stance';
			duration: number;
			durationModifiers?: DurationModifier[];
			/** Dynamic event-triggered extensions of this stance window. See
			 *  {@link DurationExtension}. */
			durationExtensions?: DurationExtension[];
			terminatesOnSwap?: boolean;
			/** Additional named state opened when this stance is active. See SkillAbility opensState. */
			opensState?: State;
	  });

/** Convenience union for code that needs cooldown/frames-bearing abilities. */
export type CastAbility = SkillAbility | BurstAbility;

/** Ascension/utility passive. Description + optional effects. */
export type PassiveAbility = AbilityCommon & {
	abilityType: 'passive';
};

/** Constellation node. Description + optional effects + level. */
export type ConstellationAbility = AbilityCommon & {
	abilityType: 'constellation';
	constellationLevel: number;
};

/** Top-level ability union. */
export type Ability =
	| NormalAbility
	| SkillAbility
	| BurstAbility
	| PassiveAbility
	| ConstellationAbility;

/**
 * Variant override on a SkillAbility or BurstAbility (e.g. Bennett "Hold Lv.2").
 * Listed fields **replace** (not compose with) the base ability's values.
 * If a variant omits a modifier array, the base's array applies; if the variant
 * has one, the base's is fully overridden.
 */
export type AbilityVariant = {
	label: string;
	input?: Input[];
	frames?: FrameMap;
	cooldown?: number;
	cooldownModifiers?: CooldownModifier[];
	/** Overrides the base ability's behavior (e.g. Zhongli hE: instant skill → persistent shield). */
	behavior?: 'instant' | 'persistent' | 'stance';
	duration?: number;
	durationModifiers?: DurationModifier[];
	persistentBehavior?: 'stationary' | 'follows';
	summonActivatesAt?: number;
	/** Overrides the base ability's summons[]. */
	summons?: Summon[];
	/** Overrides the base ability's `durationExtensions[]`. */
	durationExtensions?: DurationExtension[];
	terminatesOnSwap?: boolean;
	/** Overrides the base ability's `opensState`. Used when a Tap/Hold pair
	 *  opens different named states (e.g. Mavuika Tap-E ring vs Hold-E
	 *  bike-NS). The parser reads this when behavior resolves to "stance"
	 *  via the variant. */
	opensState?: State;
	/** Overrides the inferred damage tag for hits emitted from this variant.
	 *  Most commonly used to mark Hold-skill variants as `skillHold` so that
	 *  `TriggerFilter.damageTag = "skillHold"` selectively gates them
	 *  (Diluc Hold-E, Wriothesley Icefang Rush). When absent, the inference
	 *  helper auto-derives `skillHold` from variant input/label heuristics. */
	damageTag?: DamageTag;
	charges?: number;
	chargeModifiers?: ChargeModifier[];
	energyCost?: number;
	tags?: AbilityTag[];
	conditions?: Condition;
	effects?: Effect[];
};

// ---------------------------------------------------------------------------
// Behavior-aware accessors
// ---------------------------------------------------------------------------
//
// These read fields that only exist on certain behavior variants of
// SkillAbility/BurstAbility, returning a sensible default when the field is
// absent. Use these in consumers that don't otherwise narrow on `behavior`.
//
// Resolution order: prefer `summons[0]` when present (canonical post-2026-04-28
// shape), else fall back to the legacy `behavior: "persistent"` fields. New
// curation should populate `summons[]`; old curation continues to work.

/** First summon owned by this ability, if any. */
export function getPrimarySummon(a: CastAbility): Summon | undefined {
	return a.summons?.[0];
}

/** Active-window duration in seconds. Reads `summons[0].duration` when present,
 *  else the legacy persistent/stance `duration`. 0 when no active window exists. */
export function getActiveDuration(a: CastAbility): number {
	const s = a.summons?.[0];
	if (s) return s.duration;
	return a.behavior === 'instant' ? 0 : a.duration;
}

/** Duration modifiers for the active window. Reads `summons[0].durationModifiers`
 *  when summons[0] is present, else the legacy `durationModifiers`. */
export function getActiveDurationModifiers(a: CastAbility): DurationModifier[] | undefined {
	const s = a.summons?.[0];
	if (s) return s.durationModifiers;
	return a.behavior === 'instant' ? undefined : a.durationModifiers;
}

/** Frames from cast start until the active window begins. Reads
 *  `summons[0].spawnsAt` when present, else the legacy `summonActivatesAt`. */
export function getSummonActivatesAt(a: CastAbility): number {
	const s = a.summons?.[0];
	if (s) return s.spawnsAt ?? 0;
	return a.behavior === 'persistent' ? (a.summonActivatesAt ?? 0) : 0;
}

/** Mobility of the active summon: "stationary" or "follows". Reads
 *  `summons[0].mobility` when present, else the legacy `persistentBehavior`. */
export function getPersistentBehavior(a: CastAbility): 'stationary' | 'follows' | undefined {
	const s = a.summons?.[0];
	if (s) return s.mobility;
	return a.behavior === 'persistent' ? a.persistentBehavior : undefined;
}

/** Duration-extension entries declared on the ability (stance behavior only).
 *  Returns the array as-authored, or undefined when the ability isn't a stance
 *  or has no extensions. The parser dispatches matching entries when their
 *  trigger fires while the window is active. */
export function getDurationExtensions(a: CastAbility): DurationExtension[] | undefined {
	return a.behavior === 'stance' ? a.durationExtensions : undefined;
}

/** True when the ability's stance window closes on swap. */
export function getTerminatesOnSwap(a: CastAbility): boolean {
	return a.behavior === 'stance' ? a.terminatesOnSwap === true : false;
}

/** True when the given ability is a stance burst/skill. */
export function isStanceAbility(a: Ability | undefined): boolean {
	if (!a) return false;
	if (a.abilityType !== 'skill' && a.abilityType !== 'burst') return false;
	return a.behavior === 'stance';
}

// ---------------------------------------------------------------------------
// G primitive helpers — damageTag inference + TriggerFilter evaluation
// ---------------------------------------------------------------------------

/**
 * Resolves the implicit damage tag for a hit emitted by the given ability +
 * variant. Most curation doesn't author `damageTag` explicitly; this helper
 * gives the renderer/lint a default value that matches the in-game tagging.
 *
 * Resolution order:
 *   1. `variant.damageTag` if explicitly set
 *   2. Heuristic Hold-detection on the variant (input contains "hE"/"h1E"/
 *      "h2E"/"pE" or label matches /hold/i) → `skillHold` for skill, but
 *      bursts stay `burst` since burst Hold variants are exotic
 *   3. Default per abilityType: normal/charged/plunge/skill/burst
 *
 * `hit.damageTag` (per-hit override) is read by the caller separately —
 * this helper produces the *ability/variant-level* default that per-hit
 * tags can refine.
 */
export function getDefaultDamageTag(ability: Ability, variant?: AbilityVariant): DamageTag {
	if (variant?.damageTag) return variant.damageTag;
	if (ability.abilityType === 'normal') return 'normal';
	if (ability.abilityType === 'skill') {
		if (variant) {
			const inputs = variant.input ?? [];
			const isHoldInput = inputs.some(
				(i) => i === 'hE' || i === 'h1E' || i === 'h2E' || i === 'pE'
			);
			const isHoldLabel = /hold/i.test(variant.label ?? '');
			if (isHoldInput || isHoldLabel) return 'skillHold';
		}
		return 'skill';
	}
	if (ability.abilityType === 'burst') return 'burst';
	// passive/constellation hosts have no canonical damage tag
	return 'skill';
}

/**
 * Per-hit damage tag resolver: prefers the hit's explicit override, else
 * the array-position default ("normal" for hits[]; "charged" for chargeHits[];
 * "plunge" for plungeFrames-derived hits).
 */
export function getNormalHitDamageTag(
	hit: NormalHit,
	defaultTag: 'normal' | 'charged' | 'plunge'
): DamageTag {
	return hit.damageTag ?? defaultTag;
}

/**
 * Context passed to {@link evalTriggerFilter}. The fields describe the
 * candidate hit/cast against which the filter is checked.
 */
export type TriggerFilterContext = {
	damageTag: DamageTag;
	element?: Element;
	abilityName?: string;
	/** 0-based hit index for normals; absent for skill/burst single-hit casts. */
	hitIndex?: number;
	/** True when the hit is presumed to crit; the planner doesn't simulate
	 *  crit outcomes, so the renderer treats `isCrit: true` filters as
	 *  "fire optimistically" — the ctx.isCrit defaults true when crits are
	 *  the typical case (skill/burst snapshots), false otherwise. */
	isCrit?: boolean;
};

/**
 * Returns true iff the filter accepts the candidate hit context. Absent
 * filter (or absent fields within it) accept anything. Use this in the
 * renderer's onHit pass to gate per-cast / per-hit firing.
 */
export function evalTriggerFilter(
	filter: TriggerFilter | undefined,
	ctx: TriggerFilterContext
): boolean {
	if (!filter) return true;
	if (filter.damageTag !== undefined && filter.damageTag !== ctx.damageTag) return false;
	if (filter.element !== undefined && filter.element !== ctx.element) return false;
	if (filter.abilityName !== undefined) {
		if (!ctx.abilityName || !ctx.abilityName.includes(filter.abilityName)) return false;
	}
	if (filter.hitIndex !== undefined && filter.hitIndex !== ctx.hitIndex) return false;
	if (filter.isCrit === true && ctx.isCrit !== true) return false;
	if (filter.isCrit === false && ctx.isCrit === true) return false;
	return true;
}
