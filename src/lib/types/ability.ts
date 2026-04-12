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
  | "P"
  | "E"
  | "Q"
  | "tE"
  | "pE"
  | "hE"
  | "h1E"
  | "h2E";

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
  | "insideField"
  | "hpBelow50"
  | "hpBelow70"
  | "hpAbove50"
  | "hpAbove70"
  | "hpFull"
  | "nightsoulBlessing";

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
// Abilities
// ---------------------------------------------------------------------------

/** Canonical ability definition used by the transformer output. */
export type Ability = {
  id: string;
  name: string;
  shortName?: string;
  sections?: AbilitySection[];
  note?: string;
  input?: Input[];
  abilityType: "skill" | "burst" | "normal" | "charged" | "plunge" | "passive" | "constellation";
  type: "instant" | "persistent" | "stance" | "movement";
  persistentBehavior?: "stationary" | "follows";
  tags?: AbilityTag[];
  castTime?: number;
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
