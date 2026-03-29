/**
 * src/lib/types/character.ts
 *
 * Character type definitions for the rotation planner schema and transformer output.
 */

import type { Ability, Element } from './ability';
import type { WeaponType } from './weapon';

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

/** Star rarity for playable characters. */
export type Rarity = 4 | 5;

// ---------------------------------------------------------------------------
// Rotation planner buff model
// ---------------------------------------------------------------------------

/** Who a rotation planner buff applies to. */
export type BuffTarget =
  | "active" // only the currently on-field character
  | "team" // all characters simultaneously
  | "self"; // only the character who cast the ability (for self-buffs)

/** The stat that a rotation planner buff modifies. */
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

/** What the buff value scales off for rotation planner buffs. */
export type BuffScaling =
  | "baseATK"
  | "baseHP"
  | "baseDEF"
  | "EM"
  | "flat" // fixed value, no scaling
  | "none"; // e.g. an infusion, no numeric value

/** Rotation planner buff record for character abilities. */
export interface Buff {
  /** Which ability triggers this buff */
  source: "E" | "Q" | "A1" | "A4" | "C1" | "C2" | "C4" | "C6";

  /** Who receives the buff */
  target: BuffTarget;

  /** The stat being buffed */
  stat: BuffStat;

  /** What the buff value scales off */
  scaling: BuffScaling;

  /** How long the buff lasts in seconds */
  duration: number;

  /** Optional human-readable note for edge cases, conditions, or C-level requirements */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Rotation planner ability data
// ---------------------------------------------------------------------------

/** Elemental skill metadata for rotation planner cards. */
export interface SkillData {
  /** Display name of the ability (from TCL) */
  name: string | null;

  /** Cooldown in seconds */
  cooldown: number | number[] | null;

  /** True when cooldown represents hold variants */
  holdVariants: boolean;

  /** How long the skill's effect/field lasts */
  duration: number | null;
}

/** Elemental burst metadata for rotation planner cards. */
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
// Rotation planner character schema
// ---------------------------------------------------------------------------

/** Tags used to describe a character's role in rotations. */
export type CharacterTag =
  | "DPS"
  | "sub-DPS"
  | "support"
  | "healer"
  | "shielder"
  | "buffer"
  | "debuffer"
  | "battery";

/** Lightweight roster entry used to populate character pickers. */
export interface CharacterSummary {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  weaponType: WeaponType;
  tags: CharacterTag[];
}

/** Full rotation planner character definition. */
export interface Character extends CharacterSummary {
  /** Elemental Skill data */
  E: SkillData | null;

  /** Elemental Burst data */
  Q: BurstData | null;

  /** All buffs this character can apply */
  buffs: Buff[];

  /** Valid KQM-style notation tokens for this character */
  notationTokens: string[];

  /** True if the character has a meaningful off-field presence */
  offField: boolean;
}

// ---------------------------------------------------------------------------
// Transformer character schema (gold standard)
// ---------------------------------------------------------------------------

/** Metadata attached to generated character data. */
export type CharacterMeta = {
  source: "genshin-db";
  generatedAt: string;
};

/** Canonical character data model used by the transformer output. */
export type CharacterData = {
  id: string;
  name: string;
  displayName: string;
  element?: Element;
  weapon?: string;
  gender?: string;
  affiliation?: string;
  region?: string;
  rarity: Rarity;

  abilities: Ability[];
  passives: Ability[];
  constellations: Ability[];

  meta: CharacterMeta;
};

// ---------------------------------------------------------------------------
// Current project character JSON schema
// ---------------------------------------------------------------------------

/** Character JSON payload used by the rotation planner UI today. */
export type RawCharacter = {
  id: string;
  name: string;
  displayName: string;
  element?: Element;
  weapon?: WeaponType;
  gender?: string;
  affiliation?: string;
  region?: string;
  rarity: Rarity;

  abilities: Ability[];
  passives: Ability[];
  constellations: Ability[];

  meta?: CharacterMeta;
};
