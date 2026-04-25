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

/** Element keys used by the transformer output (lowercase). */
export type Element =
  | "anemo"
  | "cryo"
  | "dendro"
  | "electro"
  | "geo"
  | "hydro"
  | "pyro";

/** Elemental reactions used by triggers and effects. */
export type Reaction =
  | "vaporize"
  | "overloaded"
  | "melt"
  | "burning"
  | "swirl"
  | "crystallize"
  | "lunarCrystallize"
  | "electroCharged"
  | "lunarCharged"
  | "frozen"
  | "shatter"
  | "bloom"
  | "lunarBloom"
  | "burgeon"
  | "hyperbloom"
  | "superConduct"
  | "quicken"
  | "spread"
  | "aggravate";

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Canonical stat keys used by the gold-standard effect model. */
export type Stat =
  | "atk"
  | "baseAtk"
  | "em"
  | "hp"
  | "def"
  | "critRate"
  | "critDmg"
  | "atk%"
  | "hp%"
  | "def%"
  | "allDmgBonus"
  | "anemoDmgBonus"
  | "cryoDmgBonus"
  | "dendroDmgBonus"
  | "electroDmgBonus"
  | "geoDmgBonus"
  | "hydroDmgBonus"
  | "pyroDmgBonus"
  | "lunarDmgBonus"
  | "skillDmgBonus"
  | "burstDmgBonus"
  | "cdReduction"
  | "incomingHealingBonus"
  // Flat DMG bonuses added to damage output (not % multipliers); commonly HP-scaled.
  | "normalFlatDmg"
  | "chargeFlatDmg"
  | "plungeFlatDmg"
  | "skillFlatDmg"
  | "burstFlatDmg";

// ---------------------------------------------------------------------------
// Ability sections & inputs
// ---------------------------------------------------------------------------

/** High-level grouping for ability description sections. */
export type AbilitySectionType =
  | "normal"
  | "charged"
  | "plunging"
  | "skill"
  | "burst"
  | "passive"
  | "other";

/** A display section used to organize ability descriptions. */
export type AbilitySection = {
  type: AbilitySectionType;
  title: string;
  description: string;
};

/** Rotation input tokens used by the notation parser. */
export type Input =
  | "N"
  | "N1"
  | "N2"
  | "N3"
  | "N4"
  | "N5"
  | "N6"
  | "C"
  | "C1"
  | "C2"
  | "P"
  | "E"
  | "Q"
  | "tE"
  | "pE"
  | "hE"
  | "h1E"
  | "h2E"
  | "D"
  | "J";

// ---------------------------------------------------------------------------
// Ability tags
// ---------------------------------------------------------------------------

/** Canonical tag keys for ability classification (singular). */
export type AbilityTag =
  | "coordinatedAttack"
  | "heal"
  | "shield"
  | "summon"
  | "taunt";

// ---------------------------------------------------------------------------
// Scaling helpers
// ---------------------------------------------------------------------------

/** Refinement-scaled values for weapons or effects. */
export type ScaledValue = {
  refinementValues: [number, number, number, number, number];
};

/** Stats that a value can scale from. */
export type ScalingStat = "atk" | "baseAtk" | "em" | "hp" | "def";

// ---------------------------------------------------------------------------
// Conditions & triggers
// ---------------------------------------------------------------------------

/** Custom condition keys for gameplay state checks. */
export type CustomConditionKey =
  | "enemyFrozen"
  | "enemyAffectedByPyro"
  | "enemyAffectedByHydro"
  | "enemyBelow50"
  | "enemyAbove50";

/** Logical condition tree for effect gating. */
export type Condition =
  | { type: "state"; state: State }
  | { type: "not"; condition: Condition }
  | { type: "all"; conditions: Condition[] }
  | { type: "any"; conditions: Condition[] }
  | { type: "ascension"; min: number }
  | { type: "constellation"; level: number }
  | { type: "teamFaction"; faction: string; min: number }
  | { type: "weaponType"; weapons: ("sword" | "claymore" | "polearm" | "bow" | "catalyst")[] }
  | { type: "custom"; key: CustomConditionKey };

/** Event trigger definition for when an effect applies. */
export type Trigger =
  | {
      type: "onCast";
      /** Which ability type's cast fires the trigger. Omit to match any cast. */
      ability?: "skill" | "burst";
    }
  | { type: "onHit"; abilityType?: "skill" | "burst" | "normal" | "charged" | "plunge"; damageType?: "elemental" | "physical" }
  | { type: "onReaction"; reaction: Reaction | Reaction[] | "any" }
  | { type: "onEnergy"; threshold: number }
  | { type: "onHPChange" }
  | { type: "onHPDecrease" }
  | { type: "onHPIncrease" }
  | { type: "onHeal" }
  | { type: "onState"; state: State }
  | { type: "manual" }
  /** Fires when the holder leaves the field; buff targets the incoming character (e.g. TTDS). */
  | { type: "onSwapOut" }
  /** Fires when the holder enters the field; buff targets themselves (e.g. The Widsith). */
  | { type: "onSwapIn" }
  /** Fires after N qualifying events accumulate (e.g. Freedom-Sworn: 2 reactions). */
  | { type: "onStack"; count: number }
  /** Always-on passive — not rendered in the team buffs row. */
  | { type: "passive" }
  /** Fires when the host ability's duration expires; buff starts at bar.end.
   *  When the effect lives on a passive/constellation (not on the host ability itself),
   *  `ability` must be set to disambiguate which ability's duration binds the trigger.
   *  Example: Raiden C4 Pledge of Propriety — ATK% buff after Musou Isshin ends. */
  | { type: "afterDuration"; ability?: "skill" | "burst" }
  /** Fires when the character's active stance window closes (naturally or via Q cast). Buff starts at stance end time. Used for post-stance team buffs (e.g. Hu Tao A1: CRIT Rate after Paramita Papilio ends). */
  | { type: "onStanceEnd" };

/** Known gameplay state keys used in conditions and triggers. */
export type State =
  | "afterNormalAttack"
  | "afterSkill"
  | "afterBurst"
  | "afterDurationEnds"
  | "shielded"
  | "onField"
  | "offField"
  | "duringSummon"
  | "hpBelow50"
  | "hpBelow70"
  | "hpAbove50"
  | "hpAbove70"
  | "hpFull"
  | "nightsoulBlessing"
  | "inStance";

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

/** Base modifier data shared by cooldown/duration modifiers. */
export type ModifierBase = {
  source: string;
  type: "percent" | "flat";
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
// Effects
// ---------------------------------------------------------------------------

/** Who an effect applies to. Array form expresses compound targets (e.g. ["self", "active"]). */
export type EffectTarget = "self" | "team" | "teamExcludingSelf" | "active" | "next" | "enemy";

/** Base effect payload shared by all effect kinds. */
export type EffectBase = {
  type: "buff" | "damage" | "heal" | "shield" | "resShred" | "energy" | "cdReset" | "infuse";
  trigger: Trigger;
  conditions?: Condition;
  duration?: number;
  durationType?: "refresh" | "fixed";
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
      type: "scaling";
      stat: Stat;
      ratio: number | ScaledValue;
      cap?: number;
    }
  | {
      /** Value exists but depends on runtime inputs (e.g. a character's ER or energy cost) that the planner cannot resolve. The description is shown verbatim in tooltips. */
      type: "unknown";
      description: string;
    }
  | {
      /** Buff value ramps up over time from startValue by stepValue every stepInterval seconds, capping at cap. */
      type: "ramping";
      startValue: number;
      stepValue: number;
      stepInterval: number;
      cap?: number;
    };

/** Full effect union used by the gold-standard model. */
export type Effect =
  | (EffectBase & {
      type: "buff";
      source: "character" | "weapon" | "artifact";
      stat: Stat;
      value: BuffValue;
      snapshottable: boolean;
      stacks?: {
        maxStacks: number;
        durationModel: "shared" | "separate";
      };
      constellationScaling?: {
        conditions: Condition;
        value: BuffValue;
      };
    })
  | (EffectBase & {
      type: "damage";
      scaling: number | ScaledValue;
      stat: ScalingStat;
      element?: Element;
    })
  | (EffectBase & {
      type: "heal";
      scaling: number | ScaledValue;
      stat: ScalingStat;
    })
  | (EffectBase & {
      type: "shield";
      scaling: number | ScaledValue;
      stat: ScalingStat;
    })
  | (EffectBase & {
      type: "resShred";
      element?: Element;
      value: number;
    })
  | (EffectBase & {
      type: "energy";
      amount: number;
    })
  | (EffectBase & {
      type: "infuse";
      element: Element;
    })
  | (EffectBase & {
      type: "cdReset";
      source: "weapon";
      // Which ability's cooldown is reset is encoded in `trigger.ability`;
      // cdReset only makes sense on `trigger.type === "onCast"`.
    });

// ---------------------------------------------------------------------------
// Frame timing
// ---------------------------------------------------------------------------

/**
 * Keys representing the action that follows a cast — used to look up the
 * correct cancel window. "swap" is the fallback (full animation, no cancel).
 * Hitlag and attack speed are not modelled at this level.
 */
export type ActionKey = "N" | "C" | "E" | "Q" | "D" | "J" | "P" | "swap";

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
 */
export type NormalHit = { name?: string; frames: FrameMap };

/**
 * Describes how casting this ability extends an already-active stance window.
 * Used on abilities like Cyno's Mortuary Rite (in-stance E extends Q duration).
 * Also handles the reverse case where a Q extends an E-opened stance — the same
 * field on the Q ability is sufficient since only one stance window exists per
 * character at a time.
 */
export type StanceExtension = {
  /** Frames to add to the stance window end time (60fps). */
  frames: number;
  /** Maximum total extensions allowed per stance window (resets on new Q cast). */
  maxExtensions: number;
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
  abilityType: "normal";
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
  abilityType: "skill";
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
  variants?: AbilityVariant[];
};

/** Skill ability — discriminated by behavior. Persistent/stance variants require duration. */
export type SkillAbility =
  | (SkillCommonFields & { behavior: "instant" })
  | (SkillCommonFields & {
      behavior: "persistent";
      /** Persistent-summon active-window duration in seconds. Required on persistent. */
      duration: number;
      durationModifiers?: DurationModifier[];
      persistentBehavior?: "stationary" | "follows";
      /** Frame (60fps) at which the persistent summon becomes active, relative to cast start.
       *  Sourced from gcsim's per-character activation constant. Defaults to 0. */
      summonActivatesAt?: number;
    })
  | (SkillCommonFields & {
      behavior: "stance";
      /** Stance window duration in seconds. Required on stance. */
      duration: number;
      durationModifiers?: DurationModifier[];
      /** Extends the active stance window when this ability is cast. */
      stanceExtension?: StanceExtension;
      /** Stance window closes when this character swaps off-field. */
      terminatesOnSwap?: boolean;
    });

/** Fields shared by all burst behavior variants. */
type BurstCommonFields = AbilityCommon & {
  abilityType: "burst";
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
  variants?: AbilityVariant[];
};

/** Burst ability — same behavior split as skill, plus required energyCost. */
export type BurstAbility =
  | (BurstCommonFields & { behavior: "instant" })
  | (BurstCommonFields & {
      behavior: "persistent";
      duration: number;
      durationModifiers?: DurationModifier[];
      persistentBehavior?: "stationary" | "follows";
      summonActivatesAt?: number;
    })
  | (BurstCommonFields & {
      behavior: "stance";
      duration: number;
      durationModifiers?: DurationModifier[];
      stanceExtension?: StanceExtension;
      terminatesOnSwap?: boolean;
    });

/** Convenience union for code that needs cooldown/frames-bearing abilities. */
export type CastAbility = SkillAbility | BurstAbility;

/** Ascension/utility passive. Description + optional effects. */
export type PassiveAbility = AbilityCommon & {
  abilityType: "passive";
};

/** Constellation node. Description + optional effects + level. */
export type ConstellationAbility = AbilityCommon & {
  abilityType: "constellation";
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
  behavior?: "instant" | "persistent" | "stance";
  duration?: number;
  durationModifiers?: DurationModifier[];
  persistentBehavior?: "stationary" | "follows";
  summonActivatesAt?: number;
  stanceExtension?: StanceExtension;
  terminatesOnSwap?: boolean;
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
// absent for the active behavior. Use these in consumers that don't otherwise
// narrow on `behavior` themselves.

/** Active-window duration; 0 for instant abilities. */
export function getDuration(a: CastAbility): number {
  return a.behavior === "instant" ? 0 : a.duration;
}

/** Duration modifier list, or undefined for instant abilities. */
export function getDurationModifiers(a: CastAbility): DurationModifier[] | undefined {
  return a.behavior === "instant" ? undefined : a.durationModifiers;
}

/** Frames from cast start until the persistent summon becomes active.
 *  0 for non-persistent abilities. */
export function getSummonActivatesAt(a: CastAbility): number {
  return a.behavior === "persistent" ? (a.summonActivatesAt ?? 0) : 0;
}

/** Persistent-summon mobility; undefined for non-persistent abilities. */
export function getPersistentBehavior(a: CastAbility): "stationary" | "follows" | undefined {
  return a.behavior === "persistent" ? a.persistentBehavior : undefined;
}

/** Stance extension config; undefined for non-stance abilities. */
export function getStanceExtension(a: CastAbility): StanceExtension | undefined {
  return a.behavior === "stance" ? a.stanceExtension : undefined;
}

/** True when the ability's stance window closes on swap. */
export function getTerminatesOnSwap(a: CastAbility): boolean {
  return a.behavior === "stance" ? a.terminatesOnSwap === true : false;
}

/** True when the given ability is a stance burst/skill. */
export function isStanceAbility(a: Ability | undefined): boolean {
  if (!a) return false;
  if (a.abilityType !== "skill" && a.abilityType !== "burst") return false;
  return a.behavior === "stance";
}
