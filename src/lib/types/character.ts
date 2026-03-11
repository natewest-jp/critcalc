/**
 * src/lib/types/character.ts
 *
 * Type definitions for the Genshin Rotation Planner character schema.
 * These types mirror the JSON structure output by transform-characters.js.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type Element =
  | "Anemo"
  | "Cryo"
  | "Dendro"
  | "Electro"
  | "Geo"
  | "Hydro"
  | "Pyro";

export type WeaponType =
  | "Sword"
  | "Claymore"
  | "Polearm"
  | "Catalyst"
  | "Bow";

export type Rarity = 4 | 5;

/** Who a buff applies to */
export type BuffTarget =
  | "active"   // only the currently on-field character
  | "team"     // all characters simultaneously
  | "self";    // only the character who cast the ability (for self-buffs)

/** The stat that a buff modifies */
export type BuffStat =
  | "ATK%"
  | "ATK_flat"
  | "DEF%"
  | "DEF_flat"
  | "HP%"
  | "HP_flat"
  | "EM"
  | "ER"
  | "CR"
  | "CD"
  | "Pyro%"
  | "Hydro%"
  | "Cryo%"
  | "Electro%"
  | "Anemo%"
  | "Geo%"
  | "Dendro%"
  | "Physical%"
  | "AllDMG%"
  | "HealingBonus%"
  | "Infusion";

/**
 * What the buff value scales off, for buffs that aren't a flat % but
 * are derived from another stat (e.g. Bennett Q scales off Base ATK).
 */
export type BuffScaling =
  | "baseATK"
  | "baseHP"
  | "baseDEF"
  | "EM"
  | "flat"     // fixed value, no scaling
  | "none";    // e.g. an infusion, no numeric value

// ---------------------------------------------------------------------------
// Buff
// ---------------------------------------------------------------------------

export interface Buff {
  /** Which ability triggers this buff */
  source: "E" | "Q" | "A1" | "A4" | "C1" | "C2" | "C4" | "C6";

  /** Who receives the buff */
  target: BuffTarget;

  /** The stat being buffed */
  stat: BuffStat;

  /**
   * What the buff value scales off.
   * Use "flat" for a fixed numeric value (e.g. 80 EM from Kazuha's passive).
   * Use "none" for non-numeric effects like infusions.
   */
  scaling: BuffScaling;

  /**
   * How long the buff lasts in seconds.
   * Should match the ability's duration for most cases,
   * but some buffs expire before the ability does.
   */
  duration: number;

  /** Optional human-readable note for edge cases, conditions, C-level requirements, etc. */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Ability data
// ---------------------------------------------------------------------------

export interface SkillData {
  /** Display name of the ability (from TCL) */
  name: string | null;

  /**
   * Cooldown in seconds.
   * An array means the skill has hold variants: [press, hold-L1, hold-L2]
   */
  cooldown: number | number[] | null;

  /**
   * True if the cooldown array represents hold variants (tap E vs hold E).
   * Always false when cooldown is a single number.
   */
  holdVariants: boolean;

  /** How long the skill's effect/field lasts, if applicable */
  duration: number | null;
}

export interface BurstData {
  /** Display name of the burst (from TCL) */
  name: string | null;

  /** Cooldown in seconds */
  cooldown: number | null;

  /** How long the burst field/effect lasts */
  duration: number | null;

  /** Energy cost */
  energyCost: number | null;
}

// ---------------------------------------------------------------------------
// Roster index entry (used in characters.json)
// ---------------------------------------------------------------------------

/**
 * Lightweight entry used in the roster index (characters.json).
 * Enough data to populate the character picker without loading full data.
 */
export interface CharacterSummary {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  weaponType: WeaponType;
  tags: CharacterTag[];
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export type CharacterTag =
  | "DPS"
  | "sub-DPS"
  | "support"
  | "healer"
  | "shielder"
  | "buffer"
  | "debuffer"
  | "battery";

// ---------------------------------------------------------------------------
// Full character
// ---------------------------------------------------------------------------

export interface Character extends CharacterSummary {
  /** Elemental Skill data */
  E: SkillData | null;

  /** Elemental Burst data */
  Q: BurstData | null;

  /**
   * All buffs this character can apply.
   * Empty array if the character has no relevant buff for rotation planning.
   */
  buffs: Buff[];

  /**
   * Valid KQM-style notation tokens for this character.
   * Used by the notation parser to tokenise rotation strings.
   * e.g. ["Q", "E", "hE", "N1", "N2", "N3", "N4", "N5", "CA"]
   */
  notationTokens: string[];

  /**
   * True if the character has a meaningful off-field presence
   * (e.g. Fischl's Oz, Xiangling's Pyronado, Xingqiu's rain swords).
   * Used to decide whether to render an off-field activity bar.
   */
  offField: boolean;
}
