/**
 * src/lib/types/character.ts
 *
 * Character type definitions for the rotation planner schema and transformer output.
 */

import type {
	Ability,
	Effect,
	Element,
	NightsoulPoolSpec,
	TimedBlessingSpec,
	Reaction
} from './ability';
import type { WeaponType } from './weapon';
import type { CapabilitySummary } from '../capabilities/deriveCapabilities';
import type { FramesSource } from '../coverage/deriveCoverage';

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

/** Star rarity for playable characters. */
export type Rarity = 4 | 5;

// ---------------------------------------------------------------------------
// Editorial roles (Imaginarium Theater)
// ---------------------------------------------------------------------------

/** Field position — a set (Mavuika is both). */
export type RolePosition = 'onField' | 'offField';
/** Functional role — multi-valued (Furina is all three). */
export type RoleFunction = 'dps' | 'support' | 'survivability';

/** A character's editorial roles, imported from Genshin's Imaginarium Theater
 *  classification (docs/library/game/genshin-character-roles.csv). Presence
 *  tags, cited to Genshin, NEVER ranked or scored — "dps" means "Genshin
 *  classes this a DPS". Editorial (hand-sourced), so it lives OUTSIDE the
 *  derive-only capabilities layer; the Team Builder joins it by id. */
export type CharacterRoles = { position: RolePosition[]; function: RoleFunction[] };

// ---------------------------------------------------------------------------
// Transformer character schema
// ---------------------------------------------------------------------------

/** Metadata attached to generated character data. */
export type CharacterMeta = {
	source: 'genshin-db';
	generatedAt: string;
	/** Where the FrameMaps came from (coverage round, docs/rounds/coverage-round.md
	 *  §5.3). Absent = `gcsim` (merged main). `gcsim-pr` (an unmerged PR — the
	 *  Ifa/Varka precedent), `wiki` and `hand` read as stand-in timing on the
	 *  coverage page. */
	framesSource?: FramesSource;
};

/** Canonical character data model — the shape of committed character JSONs. */
export type CharacterData = {
	id: string;
	name: string;
	displayName: string;
	element?: Element;
	weapon?: WeaponType;
	gender?: string;
	affiliation?: string;
	region?: string;
	rarity: Rarity;
	/** The patch the character released in, `"major.minor"` (genshin-db's
	 *  `version`; the seven Travelers by hand). Read by the coverage page's
	 *  "Newest first" sort. The patch only — two releases in one patch tie, and
	 *  sort by name. Required by characterIndex.test.ts. */
	release?: string;
	/** True for characters whose in-game constellations are permanently locked
	 *  (Aloy: "The time has not yet come…"). Constellation steppers and badges
	 *  don't render for these — there is nothing to set. */
	noConstellations?: true;
	/** Gameplay-mechanic faction memberships. Known values: "moonsign", "hexerei". Distinct from lore affiliation. */
	factions?: string[];
	/** Extra contribution this character makes to a faction's *level*, beyond the
	 *  implicit +1 from membership (`factions`). Party faction level = members + Σ
	 *  contributions; `teamFaction {faction, min}` gates on that sum. Use for
	 *  benedictions that raise a party level by more than the holder's own
	 *  presence (e.g. a Moonsign benediction that adds an extra level, or a
	 *  non-member that still contributes). Most faction chars need only
	 *  `factions` — leave this unset. Forward-looking for 7.x faction mechanics. */
	factionContributions?: Record<string, number>;
	/** Reactions this character's presence ENABLES for the whole party (the
	 *  Stellar model: one enabler converts all of the base reaction — e.g.
	 *  Sandrone: ['stellarConduct'] turns every Superconduct into
	 *  Stellar-Conduct). Gated against by `teamEnablesReaction` conditions.
	 *  Distinct from `factions` (no count semantics) and from carrying
	 *  Stellar-conditional buffs (buffed characters are NOT enablers). */
	enablesReactions?: Reaction[];

	abilities: Ability[];
	passives: Ability[];
	constellations: Ability[];
	/** Per-character contributions to faction bonuses (e.g. Hexerei: Secret Rite).
	 *  Distinct from passives because the trigger is team-conditional, not character-intrinsic.
	 *  Empty/absent on characters with no faction membership or no contributing effects. */
	factionBonuses?: FactionBonus[];
	/** A simulated Nightsoul pool — see `NightsoulPoolSpec` (Mavuika). */
	nightsoulPool?: NightsoulPoolSpec;
	/** A Nightsoul Blessing on a timer, fed by points that build outside it —
	 *  see `TimedBlessingSpec` (Varesa). */
	timedBlessing?: TimedBlessingSpec;

	meta?: CharacterMeta;
};

/** Lightweight index entry for a character — the scalar identity fields plus
 *  derived capability summaries; no abilities/passives/constellations. Backs
 *  the eager, synchronous index (`src/lib/data/characterIndex.generated.ts`)
 *  used by the selector, autocomplete, slot resolution, and the Team Builder's
 *  capability facets; full payloads load lazily on demand via
 *  `src/lib/data/characterData.ts`. */
export type CharacterIndexEntry = Pick<
	CharacterData,
	| 'id'
	| 'name'
	| 'displayName'
	| 'element'
	| 'weapon'
	| 'gender'
	| 'affiliation'
	| 'region'
	| 'rarity'
	| 'release'
	| 'noConstellations'
	| 'factions'
	| 'enablesReactions'
> & {
	/** Frame-level curation (characterLint.isCurated). The Team Builder's trust
	 *  signal: when false, an absent capability means "not yet curated", NOT
	 *  "doesn't have it" — uncurated characters must never be silently filtered
	 *  out by capability facets. */
	curated: boolean;
	/** The E/Q entry tokens this character can actually perform
	 *  (castTokens.declaredCastTokens), computed at index-generation time.
	 *  EAGER because the notation editor lints against it per keystroke — a
	 *  token outside this list is approximated by the parser, and the squiggle
	 *  that says so cannot wait for a lazy payload. Empty = an uncurated stub
	 *  with no skill or burst ability at all. */
	casts: string[];
	/** Whether the kit carries a MEASURED plunge (`castTokens.hasPlungeFrames`).
	 *  Absent frames, a `P` draws with `GENERIC_PLUNGE_FRAMES` and the editor
	 *  flags it provisional — eager for the same reason as `casts`. */
	plunge: boolean;
	/** Whether the kit carries a MEASURED charged attack (`castTokens.hasChargeFrames`
	 *  — a bow's `chargeHits` count). Absent frames, a `C` draws with
	 *  `GENERIC_CHARGE_FRAMES` and the editor flags it provisional, as `plunge`. */
	charged: boolean;
	/** Present (and true) only when the kit carries KQM's `sC`
	 *  (`castTokens.hasSpecialChargeFrames`, Varka alone today). Anyone else's
	 *  `sC` is timed as a plain `C`, and the editor flags it provisional. */
	specialCharge?: true;
	/** Present (and true) only when a normal ability's Charged Attack SPINS
	 *  (`chargeSpin`, Mavuika alone) — the one kit where `F`, the finisher,
	 *  means something. The editor flags `F` anywhere else. */
	chargeSpin?: true;
	/** Distinct reactions the kit gates on via `teamEnablesReaction`
	 *  conditions — derived at index generation. A character with
	 *  `stellarConduct` here carries Stellar-conditional buffs without being
	 *  an enabler (enablers declare `enablesReactions` instead). */
	gatedReactions?: Reaction[];
	/** Derived capability summaries (deriveCapabilities.summarizeCapabilities),
	 *  computed at index-generation time from the character JSON. */
	caps: CapabilitySummary[];
	/** The coverage strip (coverage/deriveCoverage.ts), one state character
	 *  per segment in `COVERAGE_SEGMENTS` order — `decodeCoverage` reads it.
	 *  The per-segment lines and caveats are derived on demand from the lazy
	 *  payload; only the states are eager. */
	coverage: string;
};

/** A single character's contribution to a team-wide faction bonus.
 *  The buff fires when the faction-membership condition is met (e.g.
 *  ≥2 Hexerei in team) AND the per-effect trigger fires. Encoded as
 *  effects with a `teamFaction` condition; consumers walk these via
 *  the same effect helpers used for ability/passive/constellation effects. */
export type FactionBonus = {
	/** Faction key — must match a value in `CharacterData.factions`. */
	faction: string;
	/** Display name shown in the team bonuses panel (e.g. "Secret Rite"). */
	name: string;
	description?: string;
	effects: Effect[];
};
