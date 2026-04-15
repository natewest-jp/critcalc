/**
 * src/lib/types/ability.ts
 *
 * Gold-standard ability/effect model types, plus local extensions used by the
 * rotation planner UI and current character JSON data.
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
  | "cdReduction";

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
  | { type: "onCast"; ability?: string }
  | { type: "onHit"; abilityType?: "skill" | "burst" | "normal" | "charged" | "plunge" }
  | { type: "onReaction"; reaction: Reaction | Reaction[] }
  | { type: "onEnergy"; threshold: number }
  | { type: "onHPChange" }
  | { type: "onHPDecrease" }
  | { type: "onHPIncrease" }
  | { type: "onHeal" }
  | { type: "onState"; state: State }
  | { type: "manual" };

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
export type EffectTarget = "self" | "team" | "active" | "next" | "enemy";

/** Base effect payload shared by all effect kinds. */
export type EffectBase = {
  type: "buff" | "damage" | "heal" | "shield" | "resShred" | "energy";
  trigger: Trigger;
  conditions?: Condition;
  duration?: number;
  durationType?: "refresh" | "fixed";
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
    });

// ---------------------------------------------------------------------------
// Frame timing
// ---------------------------------------------------------------------------

/**
 * Keys representing the action that follows a cast — used to look up the
 * correct cancel window. "swap" is the fallback (full animation, no cancel).
 * Hitlag and attack speed are not modelled at this level.
 */
export type ActionKey = "N" | "C" | "E" | "Q" | "D" | "J" | "swap";

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
export type NormalHit = { frames: FrameMap };

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
// Abilities
// ---------------------------------------------------------------------------

/** Canonical ability definition used by the transformer output. */
export type Ability = {
  id: string;
  name: string;
  shortName?: string;
  sections?: AbilitySection[];
  note?: string;
  caveat?: string;
  input?: Input[];
  abilityType: "skill" | "burst" | "normal" | "charged" | "plunge" | "passive" | "constellation";
  type: "instant" | "persistent" | "stance" | "movement";
  persistentBehavior?: "stationary" | "follows";
  /**
   * Frame (at 60fps) at which the persistent summon becomes active, relative
   * to cast start. Defaults to 0 (active immediately from cast).
   *
   * Sourced from gcsim's per-character activation constant (e.g. `burstStart`,
   * `skillOzSpawn`). The renderer offsets the active bar by this value;
   * `duringSummon` state detection uses it for both the start and end bounds
   * of the active window. Only required when activation ≠ 0.
   *
   * Examples: Ganyu Q (Sacred Cryo Pearl) → 122; Bennett Q (field) → 34;
   * Fischl E (Oz) → 18; Fischl Q (Oz, swap path) → 1.
   */
  summonActivatesAt?: number;
  tags?: AbilityTag[];
  /**
   * Frame-accurate cast timing (60fps). Required on E/Q abilities.
   * Absent keys fall back to `frames.swap`. See FrameMap.
   */
  frames?: FrameMap;
  /**
   * Per-hit timing for normal-attack combos. Array length = combo length.
   * Parser indexes by normalCounter; replaces `castTime` on normal abilities.
   */
  hits?: NormalHit[];
  /**
   * Charged attack frame timing for sword/claymore/polearm characters (single action).
   * For bow characters use `chargeHits` instead.
   */
  chargeFrames?: FrameMap;
  /**
   * Per-level charged attack timing for bow characters.
   * Index 0 = C1 (partial charge), index 1 = C2 (full charge / Frostflake etc.).
   * Parser: `C` resolves to the last entry (full charge default); `C1`/`C2` index explicitly.
   * Single-entry arrays are valid for bows with only one meaningful charge level.
   */
  chargeHits?: NormalHit[];
  /**
   * Plunge attack frame timing. Single entry covers most characters.
   * Characters with plunge-heavy rotations (e.g. Xiao) can be extended per-level later.
   */
  plungeFrames?: FrameMap;
  /** Availability gate — if present and evaluates false, ability is not resolvable. */
  conditions?: Condition;
  /** Stance window closes when this character swaps off-field. */
  terminatesOnSwap?: boolean;
  /** Extends the active stance window when this ability is cast. See StanceExtension. */
  stanceExtension?: StanceExtension;
  cooldown?: number;
  cooldownModifiers?: CooldownModifier[];
  duration?: number;
  durationModifiers?: DurationModifier[];
  charges?: number;
  chargeModifiers?: ChargeModifier[];
  snapshots?: boolean;
  noICD?: boolean;
  energyCost?: number;
  effects?: Effect[];
  variants?: AbilityVariant[];
};

/** Ability variant that overrides specific fields on a base ability. */
export type AbilityVariant = Omit<Partial<Ability>, "variants"> & {
  label: string;
};
