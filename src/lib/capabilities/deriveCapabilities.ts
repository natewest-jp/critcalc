/**
 * src/lib/capabilities/deriveCapabilities.ts
 *
 * Derives a character's *capabilities* — heals, shields, res shred, buffs,
 * off-field damage, etc. — from curated kit data, with provenance: which
 * ability grants it, at which constellation gate, under which runtime
 * conditions. The Team Builder's capability facets, badges, and detail-card
 * provenance all read from here, as do the build-time capability index
 * (scripts/generate-character-index.mjs) and the coverage audit
 * (scripts/audit-capabilities.mjs).
 *
 * Design rule: capabilities are DERIVED, never hand-maintained. A capability
 * exists because an `Effect` or `AbilityTag` in the character JSON implies it.
 * When data is missing the answer is "not derivable", not a guess — honesty
 * about curation gaps is handled by callers via `isCurated` (characterLint).
 *
 * This module is intentionally free of runtime imports (types only) so plain
 * Node ≥22.18 can execute it via native type stripping — the generator and
 * audit scripts import it directly with a `.ts` specifier.
 */

import type { CharacterData, RoleFunction } from '$lib/types/character';
import type {
	Ability,
	AbilityVariant,
	BuffValue,
	Condition,
	Effect,
	EffectTarget,
	Element,
	Reaction,
	Summon,
	Trigger
} from '$lib/types/ability';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CapabilityKind =
	| 'heal'
	| 'shield'
	| 'resShred'
	| 'buff'
	| 'energy'
	| 'infuse'
	| 'offFieldDamage'
	| 'summon'
	| 'taunt'
	| 'cleanse'
	| 'grouping';

/** Effect targets collapsed to who-benefits granularity for filtering. */
export type NormalizedTarget = 'team' | 'active' | 'self' | 'enemy';

export type CapabilitySection = 'ability' | 'passive' | 'constellation' | 'factionBonus';

export type CapabilitySource = {
	section: CapabilitySection;
	abilityId: string;
	abilityName: string;
	/** Variant label when the capability comes from a variant override (e.g. "Hold"). */
	variant?: string;
};

export type DerivedCapability = {
	kind: CapabilityKind;
	/** buff: the Stat key; resShred: the element ('all' = unrestricted shred, 'def'
	 *  = DEF shred); infuse: the element;
	 *  offFieldDamage: 'coordinatedAttack' | 'summon'. */
	detail?: string;
	/** Absent for tag-derived capabilities — tags carry no target information. */
	target?: NormalizedTarget;
	/** Minimum constellation at which this source grants the capability (0 = base kit). */
	minConstellation: number;
	/** Runtime conditions that must hold but can't be resolved statically
	 *  (labels like 'state:nightsoulBlessing', 'selfHp', 'stacks:declension'). */
	caveats: string[];
	/** Window length in seconds — the effect's own `duration`, or the hosting
	 *  summon's when the effect has none (heal ticks live as long as the herald).
	 *  Absent for instant effects and tag-derived entries. */
	duration?: number;
	/** Present when a SUMMON hosts this capability — its label, plus the tick
	 *  cadence when the producing effect fires on `summonTick`.
	 *
	 *  ⚠ This is emitted HERE, and not read off `computeSummonTicks` in
	 *  `$lib/timeline/summonSubrows`, on purpose: that helper calls the parser's
	 *  `evalCondition`, so importing it would drag notationParser into every
	 *  consumer of this module — including the Team Builder, which has no other
	 *  reason to carry it. This module imports TYPES ONLY and must stay that way.
	 *  The walk is three lines here because `pushSummonCapabilities` already has
	 *  the trigger in hand; tick OFFSETS are then arithmetic at the consumer. */
	summon?: { label: string; tickInterval?: number; firstTickDelay?: number };
	/** The effect's own number when it is a plain one: a shred's size as a
	 *  POSITIVE percent (the data stores shred negative), a buff's flat value.
	 *  Absent for scaling/unknown values and tag-derived entries. Read by the
	 *  Visualizers' DEF & RES sources list. */
	amount?: number;
	/** resShred: the in-game debuff it is (`mod`) — shared means "never stacks". */
	mod?: string;
	/** buff: the authored value, every arm (scaling, perStack, …) — the view
	 *  formats it with `formatBuffDisplayValue`. `amount` above stays the plain-
	 *  number reading the DEF & RES instrument depends on. */
	value?: BuffValue;
	/** What OPENS this window when the source is not itself a cast — a passive
	 *  or constellation whose trigger names the cast (Sucrose's EM share rides
	 *  her E and her Q hits), or any effect a REACTION sets off (Kazuha's
	 *  Swirl bonus). Absent = the source ability is its own host.
	 *
	 *  ⚠ `casts` is a LIST: 12 cast-set effects name no ability (either cast
	 *  arms them) and Sucrose's A4 names both. Narrowing to exactly one would
	 *  have kept the effect the measurement found missing, missing. */
	host?: { casts: ('skill' | 'burst')[] } | { reactions: string[] };
	/** What this capability needs from its TEAM (lineups design §5, §9.2) —
	 *  absent when nothing about the team decides it. Evaluated by
	 *  {@link evalTeamNeed}. */
	teamNeed?: TeamNeed;
	via: 'effect' | 'tag';
	source: CapabilitySource;
};

/** Aggregated form carried by the eager character index (one per kind/detail/target). */
export type CapabilitySummary = {
	kind: CapabilityKind;
	detail?: string;
	target?: NormalizedTarget;
	minCon: number;
	/** True when every source achieving minCon is gated on runtime conditions. */
	conditional: boolean;
	/** Present when any source depends on the TEAM: every source, each with its
	 *  own gate and need (null = needs nothing), so a team and a constellation
	 *  lens can be checked exactly — the capability is there when SOME source
	 *  is unlocked and its need holds ({@link summaryInTeam}). The eager index
	 *  carries it so the Team Builder needs no payload to check ~120 candidates
	 *  (§9.1). */
	teamGated?: { minCon: number; need: TeamNeed | null }[];
};

export type CharacterCapabilities = {
	id: string;
	capabilities: DerivedCapability[];
};

// ---------------------------------------------------------------------------
// Buff families — facet/audit-level granularity for the buff stat vocabulary
// ---------------------------------------------------------------------------

export type BuffFamily = 'atk' | 'em' | 'crit' | 'dmg' | 'hpdef' | 'other';

/** Distinct reactions a kit gates on via `teamEnablesReaction` conditions,
 *  anywhere in the JSON. Derived, never hand-maintained — feeds the eager
 *  index's `gatedReactions` and the Team Builder's Stellar filter (buffed
 *  characters aren't enablers, so `enablesReactions` alone can't find them).
 *  Shared by generate-character-index.mjs and the index-drift test. */
export function collectGatedReactions(node: unknown, acc: Set<string> = new Set()): string[] {
	if (Array.isArray(node)) {
		for (const n of node) collectGatedReactions(n, acc);
	} else if (node && typeof node === 'object') {
		const raw = node as Record<string, unknown>;
		if (raw.type === 'teamEnablesReaction' && typeof raw.reaction === 'string') {
			acc.add(raw.reaction);
		}
		for (const v of Object.values(raw)) collectGatedReactions(v, acc);
	}
	return [...acc].sort();
}

export function buffFamilyOf(stat: string): BuffFamily {
	if (stat === 'atk' || stat === 'atk%' || stat === 'baseAtk') return 'atk';
	if (stat === 'em') return 'em';
	if (stat === 'critRate' || stat === 'critDmg' || stat.endsWith('CritDmg')) return 'crit';
	if (stat.endsWith('DmgBonus') || stat.endsWith('FlatDmg')) return 'dmg';
	// Reaction Bonus (bucket 5) buffs damage the same way users filter for —
	// a different formula bracket than *DmgBonus, but the same facet.
	if (stat.endsWith('ReactionBonus')) return 'dmg';
	if (stat === 'hp' || stat === 'hp%' || stat === 'def' || stat === 'def%') return 'hpdef';
	return 'other'; // healingBonus, RES buffs, cdReduction, … — detail-card territory
}

// ---------------------------------------------------------------------------
// Condition evaluation — 3-valued, constellation-probing
// ---------------------------------------------------------------------------

/** Mirrors notationParser's DEFAULT_ASCENSION: the whole site assumes A4+. */
const DEFAULT_ASCENSION = 4;

type Tri = boolean | null;

/**
 * Evaluates a condition tree at a given constellation level. Semantics mirror
 * notationParser.evalCondition for the statically-resolvable leaves
 * (constellation, ascension, not/all/any); every runtime-dependent leaf
 * (state, stacks, team composition, HP thresholds, …) evaluates to `null`.
 * Kept separate from evalCondition so this module stays runtime-import-free.
 */
function evalAtConstellation(cond: Condition | undefined, con: number): Tri {
	if (!cond) return true;
	switch (cond.type) {
		case 'constellation':
			return con >= cond.level;
		case 'ascension':
			return DEFAULT_ASCENSION >= cond.min;
		case 'not': {
			const r = evalAtConstellation(cond.condition, con);
			return r === null ? null : !r;
		}
		case 'all': {
			let sawNull = false;
			for (const c of cond.conditions) {
				const r = evalAtConstellation(c, con);
				if (r === false) return false;
				if (r === null) sawNull = true;
			}
			return sawNull ? null : true;
		}
		case 'any': {
			let sawNull = false;
			for (const c of cond.conditions) {
				const r = evalAtConstellation(c, con);
				if (r === true) return true;
				if (r === null) sawNull = true;
			}
			return sawNull ? null : false;
		}
		default:
			return null;
	}
}

/**
 * First constellation level (0–6) at which the condition isn't definitively
 * false, or null when no level satisfies it (capability never available).
 */
function minConstellationFor(cond: Condition | undefined): number | null {
	for (let c = 0; c <= 6; c++) {
		if (evalAtConstellation(cond, c) !== false) return c;
	}
	return null;
}

/** Human-oriented caveat label for a runtime-dependent condition leaf. */
function caveatLabel(cond: Condition): string | null {
	switch (cond.type) {
		case 'state':
			return `state:${cond.state}`;
		case 'stacks':
			return `stacks:${cond.key}`;
		case 'teamFaction':
			return `teamFaction:${cond.faction}`;
		case 'teamEnablesReaction':
			return `needsEnabler:${cond.reaction}`;
		case 'inPolestarField':
			return 'needsField:polestar';
		case 'teamElementCount':
			return 'teamElements';
		case 'activeCharFaction':
			return `activeIs:${cond.faction}`;
		case 'enemyHpBelow':
		case 'enemyHpAbove':
			return 'enemyHp';
		case 'selfHpBelow':
		case 'selfHpAbove':
			return 'selfHp';
		case 'recipientHpBelow':
			return 'recipientHp';
		case 'enemyAffectedBy':
			return `enemyAura:${cond.element}`;
		case 'chainStage':
			return 'chainStage';
		case 'weaponType':
			return 'weaponType';
		default:
			return null;
	}
}

/**
 * Collects caveat labels for every runtime-dependent leaf still live at the
 * given constellation level (branches already definitively false are skipped;
 * an `any` already satisfied statically contributes no caveats).
 */
function collectCaveats(cond: Condition | undefined, con: number, out: Set<string>): void {
	if (!cond) return;
	switch (cond.type) {
		case 'constellation':
		case 'ascension':
			return;
		case 'not':
			// A negated state is its own label — the positive one read "during
			// inStance" for a buff that only works OUTSIDE the stance.
			if (cond.condition.type === 'state') out.add(`notState:${cond.condition.state}`);
			else collectCaveats(cond.condition, con, out);
			return;
		case 'all':
			for (const c of cond.conditions) {
				if (evalAtConstellation(c, con) === false) continue;
				collectCaveats(c, con, out);
			}
			return;
		case 'any': {
			if (cond.conditions.some((c) => evalAtConstellation(c, con) === true)) return;
			for (const c of cond.conditions) collectCaveats(c, con, out);
			return;
		}
		default: {
			const label = caveatLabel(cond);
			if (label) out.add(label);
			else out.add(`unknown:${(cond as { type: string }).type}`);
		}
	}
}

// ---------------------------------------------------------------------------
// Checking a capability against a TEAM (lineups design §5, rulings §9.2)
// ---------------------------------------------------------------------------
//
// ⚓ LIT MEANS THE TEAM CAN MAKE IT HAPPEN (Nate 2026-10-08). Players go out of
// their way to make difficult teams work, so a condition counts as met unless
// it needs something THIS TEAM cannot supply:
//
//   • the character's own kit and the fight — states, stacks, chain stages,
//     anyone's HP, the enemy's HP — are always possible;
//   • an INGREDIENT must be on the team: an enemy affected by Pyro needs a Pyro
//     character, a reaction needs both of its elements (Lunar/Stellar also
//     their enabler), the Polestar field needs Stellar-Conduct;
//   • team facts are checked as the Rotation Planner checks them — faction
//     levels over the whole party, element counts with the HOLDER EXCLUDED
//     (`teamComposition.computeHolderElementCounts`), enablers over the party;
//   • a RECEIVER's weapon or faction (Bennett C6, Candace, Nicole, Linnea) asks
//     no on-field question: it holds when ANY teammate, the provider included,
//     qualifies.
//
// ⛔ This module imports TYPES ONLY, so the parser's `evalCondition` is NOT
// used; `teamNeeds.test.ts` pins the shared team leaves to it so the two
// cannot drift.

type Weapon = 'sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst';

/** What a capability needs from its team. Derived, never authored. */
export type TeamNeed =
	| { type: 'all'; needs: TeamNeed[] }
	| { type: 'any'; needs: TeamNeed[] }
	| { type: 'not'; need: TeamNeed }
	/** A constellation gate kept beside a team leaf (`any(team, C6)`), read
	 *  against the lens. */
	| { type: 'con'; level: number }
	| { type: 'faction'; faction: string; min: number }
	/** Holder excluded — the corpus's convention for `teamElementCount`. */
	| { type: 'elementCount'; elements: Element[]; comparison: '>=' | '=' | '<='; value: number }
	| { type: 'enabler'; reaction: Reaction }
	/** Someone on the team, the holder included, is this element. */
	| { type: 'element'; element: Element }
	/** The team's elements can make this reaction (`'any'`: some reaction). */
	| { type: 'reaction'; reaction: Reaction | 'any' }
	/** Some teammate (the holder included) is — or, `negate`, is NOT — of this
	 *  faction / one of these weapons. */
	| { type: 'member'; faction?: string; weapons?: Weapon[]; negate?: boolean };

/**
 * What each reaction takes: one element from EACH group, somewhere on the
 * team. `enabler` = the reaction exists only with its enabler in the party;
 * `replacedBy` = an enabler for that reaction CONVERTS this one away
 * (`sim/reactionBridge.ts`: ⚓ a buff on the base is not a buff on the
 * converted reaction, so Venti going dark in an enabler team is CORRECT).
 * Bloom → Lunar-Bloom is an ADD, so bloom keeps happening.
 */
export const REACTION_INGREDIENTS: Record<
	Reaction,
	{ elements: Element[][]; enabler?: true; replacedBy?: Reaction }
> = {
	vaporize: { elements: [['pyro'], ['hydro']] },
	melt: { elements: [['pyro'], ['cryo']] },
	overloaded: { elements: [['pyro'], ['electro']] },
	burning: { elements: [['pyro'], ['dendro']] },
	pyroSwirl: { elements: [['anemo'], ['pyro']] },
	hydroSwirl: { elements: [['anemo'], ['hydro']] },
	cryoSwirl: { elements: [['anemo'], ['cryo']], replacedBy: 'stellarSwirl' },
	electroSwirl: { elements: [['anemo'], ['electro']] },
	pyroCrystallize: { elements: [['geo'], ['pyro']] },
	hydroCrystallize: { elements: [['geo'], ['hydro']], replacedBy: 'lunarCrystallize' },
	cryoCrystallize: { elements: [['geo'], ['cryo']] },
	electroCrystallize: { elements: [['geo'], ['electro']] },
	lunarCrystallize: { elements: [['geo'], ['hydro']], enabler: true },
	electroCharged: { elements: [['electro'], ['hydro']], replacedBy: 'lunarCharged' },
	lunarCharged: { elements: [['electro'], ['hydro']], enabler: true },
	frozen: { elements: [['cryo'], ['hydro']] },
	shatter: { elements: [['cryo'], ['hydro']] },
	bloom: { elements: [['dendro'], ['hydro']] },
	lunarBloom: { elements: [['dendro'], ['hydro']], enabler: true },
	burgeon: { elements: [['dendro'], ['hydro'], ['pyro']] },
	hyperbloom: { elements: [['dendro'], ['hydro'], ['electro']] },
	superConduct: { elements: [['electro'], ['cryo']], replacedBy: 'stellarConduct' },
	stellarConduct: { elements: [['electro'], ['cryo']], enabler: true },
	stellarSwirl: { elements: [['anemo'], ['cryo']], enabler: true },
	quicken: { elements: [['dendro'], ['electro']] },
	spread: { elements: [['dendro'], ['electro']] },
	aggravate: { elements: [['dendro'], ['electro']] }
};

/** A folded need: `true` (always met), `false` (never), `'free'` (possible
 *  whatever the team — survives `not`), or a need on the team. */
type Folded = boolean | 'free' | TeamNeed;

function foldAll(parts: Folded[]): Folded {
	if (parts.includes(false)) return false;
	// Flattened, so `all(all(a, b), c)` travels as `all(a, b, c)` — the index
	// carries these, and nesting is bytes with no meaning.
	const needs = parts
		.filter((p): p is TeamNeed => typeof p === 'object')
		.flatMap((p) => (p.type === 'all' ? p.needs : [p]));
	if (needs.length === 0) return true;
	return needs.length === 1 ? needs[0] : { type: 'all', needs };
}

function foldAny(parts: Folded[]): Folded {
	if (parts.includes(true) || parts.includes('free')) return true;
	const needs = parts
		.filter((p): p is TeamNeed => typeof p === 'object')
		.flatMap((p) => (p.type === 'any' ? p.needs : [p]));
	if (needs.length === 0) return false;
	return needs.length === 1 ? needs[0] : { type: 'any', needs };
}

/** Fold a condition tree into what it needs from a team. `positive` tracks
 *  negation, because an INGREDIENT test flips meaning under `not` ("the enemy
 *  is NOT affected by Pyro" is always possible, not "no Pyro teammate"). */
function foldCondition(
	cond: Condition | undefined,
	holderElement?: string,
	positive = true
): Folded {
	if (!cond) return true;
	switch (cond.type) {
		case 'all':
			return foldAll(cond.conditions.map((c) => foldCondition(c, holderElement, positive)));
		case 'any':
			return foldAny(cond.conditions.map((c) => foldCondition(c, holderElement, positive)));
		case 'not': {
			const inner = foldCondition(cond.condition, holderElement, !positive);
			if (inner === 'free') return 'free';
			if (typeof inner === 'boolean') return !inner;
			return { type: 'not', need: inner };
		}
		case 'ascension':
			return DEFAULT_ASCENSION >= cond.min;
		case 'constellation':
			return cond.level <= 0 ? true : { type: 'con', level: cond.level };
		case 'teamFaction':
			return { type: 'faction', faction: cond.faction, min: cond.min };
		case 'teamElementCount':
			return {
				type: 'elementCount',
				elements: [...cond.elements],
				comparison: cond.comparison,
				value: cond.value
			};
		case 'teamEnablesReaction':
			return { type: 'enabler', reaction: cond.reaction };
		case 'activeCharFaction':
			return { type: 'member', faction: cond.faction, ...(!positive && { negate: true }) };
		case 'weaponType':
			return { type: 'member', weapons: [...cond.weapons], ...(!positive && { negate: true }) };
		case 'enemyAffectedBy':
			// The holder applies their own element, so that ingredient is in
			// every team they are in.
			if (!positive || cond.element === holderElement) return 'free';
			return { type: 'element', element: cond.element };
		case 'inPolestarField':
			return positive ? { type: 'reaction', reaction: 'stellarConduct' } : 'free';
		default:
			// state, stacks, chainStage, self/recipient/enemy HP: the player can
			// make them happen in any team.
			return 'free';
	}
}

/** A condition's team need on its own — `true`/`false` when the team cannot
 *  change it, `'free'` when the player always can. Exported for the parity
 *  test against the parser; consumers read `DerivedCapability.teamNeed`. */
export function conditionTeamNeed(
	cond: Condition | undefined,
	holderElement?: string
): boolean | 'free' | TeamNeed {
	return foldCondition(cond, holderElement);
}

/** Does a need test anything about the TEAM (not just a constellation)? */
function hasTeamLeaf(need: TeamNeed): boolean {
	switch (need.type) {
		case 'all':
		case 'any':
			return need.needs.some(hasTeamLeaf);
		case 'not':
			return hasTeamLeaf(need.need);
		case 'con':
			return false;
		default:
			return true;
	}
}

/**
 * Everything a capability needs from its team: its conditions, plus — for an
 * effect a REACTION sets off — that the team can make one of its reactions.
 * Undefined when the team decides nothing (the common case).
 */
function teamNeedFor(
	cond: Condition | undefined,
	trigger: Trigger | undefined,
	holderElement: string | undefined
): TeamNeed | undefined {
	const parts: Folded[] = [foldCondition(cond, holderElement)];
	if (trigger?.type === 'onReaction') {
		const reactions = Array.isArray(trigger.reaction) ? trigger.reaction : [trigger.reaction];
		parts.push(foldAny(reactions.map((r) => ({ type: 'reaction', reaction: r }) as TeamNeed)));
	}
	const need = foldAll(parts);
	return typeof need === 'object' && hasTeamLeaf(need) ? need : undefined;
}

/** One teammate, as a team check needs them. Index entries satisfy it. */
export type TeamMember = {
	id: string;
	element?: string;
	weapon?: string;
	factions?: string[];
	enablesReactions?: readonly string[];
};

function canReact(reaction: Reaction | 'any', team: readonly TeamMember[]): boolean {
	if (reaction === 'any') {
		return (Object.keys(REACTION_INGREDIENTS) as Reaction[]).some((r) => canReact(r, team));
	}
	const spec = REACTION_INGREDIENTS[reaction];
	if (!spec) return false;
	const elements = team.map((m) => m.element);
	if (!spec.elements.every((group) => group.some((e) => elements.includes(e)))) return false;
	const enabled = (r: string) => team.some((m) => m.enablesReactions?.includes(r));
	if (spec.enabler && !enabled(reaction)) return false;
	if (spec.replacedBy && enabled(spec.replacedBy)) return false;
	return true;
}

/** Every reaction `team` can make (enablers and conversions applied) — the
 *  composition chips' source (lineups design §3). */
export function teamReactions(team: readonly TeamMember[]): Reaction[] {
	return (Object.keys(REACTION_INGREDIENTS) as Reaction[]).filter((r) => canReact(r, team));
}

/**
 * Does `team` meet `need` for the character `holderId`, at constellation
 * `con`? The team includes the holder.
 */
export function evalTeamNeed(
	need: TeamNeed,
	team: readonly TeamMember[],
	holderId: string,
	con: number
): boolean {
	switch (need.type) {
		case 'all':
			return need.needs.every((n) => evalTeamNeed(n, team, holderId, con));
		case 'any':
			return need.needs.some((n) => evalTeamNeed(n, team, holderId, con));
		case 'not':
			return !evalTeamNeed(need.need, team, holderId, con);
		case 'con':
			return con >= need.level;
		case 'faction':
			// ⚠ Members only: `factionContributions` (a benediction raising the
			// party level) has no author in the corpus and no index field. Add it
			// here and to the index together if one appears.
			return team.filter((m) => m.factions?.includes(need.faction)).length >= need.min;
		case 'elementCount': {
			const n = team.filter(
				(m) => m.id !== holderId && need.elements.includes(m.element as Element)
			).length;
			return need.comparison === '>='
				? n >= need.value
				: need.comparison === '='
					? n === need.value
					: n <= need.value;
		}
		case 'enabler':
			return team.some((m) => m.enablesReactions?.includes(need.reaction));
		case 'element':
			return team.some((m) => m.element === need.element);
		case 'reaction':
			return canReact(need.reaction, team);
		case 'member':
			return team.some((m) => {
				const is = need.faction
					? !!m.factions?.includes(need.faction)
					: !!need.weapons?.includes(m.weapon as Weapon);
				return need.negate ? !is : is;
			});
	}
}

/**
 * A capability summary in a concrete team, at the constellation lens `con`:
 *   'yes'      — some unlocked source is met by this team;
 *   'inactive' — unlocked, but no unlocked source's need is met here
 *                (the fingerprint's OUTLINED state);
 *   'locked'   — no source is unlocked at `con`.
 */
export function summaryInTeam(
	cap: CapabilitySummary,
	team: readonly TeamMember[],
	holderId: string,
	con: number
): 'yes' | 'inactive' | 'locked' {
	if (!cap.teamGated) return cap.minCon <= con ? 'yes' : 'locked';
	const unlocked = cap.teamGated.filter((s) => s.minCon <= con);
	if (unlocked.length === 0) return 'locked';
	return unlocked.some((s) => s.need === null || evalTeamNeed(s.need, team, holderId, con))
		? 'yes'
		: 'inactive';
}

// ---------------------------------------------------------------------------
// Target + effect mapping
// ---------------------------------------------------------------------------

function normalizeTarget(t: EffectTarget | EffectTarget[]): NormalizedTarget {
	const arr = Array.isArray(t) ? t : [t];
	if (arr.includes('team') || arr.includes('teamExcludingSelf')) return 'team';
	// A reaction's TRIGGERER is, in practice, the character on field.
	if (arr.includes('active') || arr.includes('next') || arr.includes('reactor')) return 'active';
	if (arr.includes('self')) return 'self';
	return 'enemy';
}

/** Effect types that map to a capability. Others (cdReset, gainStacks, elevate, …)
 *  are kit mechanics, not team-facing capabilities — Layer 1 skips them. */
function effectCapability(effect: Effect): { kind: CapabilityKind; detail?: string } | null {
	switch (effect.type) {
		case 'heal':
			return { kind: 'heal' };
		case 'shield':
			return { kind: 'shield' };
		case 'resShred':
			return {
				kind: 'resShred',
				detail: effect.shredStat === 'def' ? 'def' : (effect.element ?? 'all')
			};
		case 'buff':
			return { kind: 'buff', detail: effect.stat };
		case 'energy':
			return { kind: 'energy' };
		case 'infuse':
			return { kind: 'infuse', detail: effect.element };
		default:
			return null;
	}
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

type HostContext = {
	source: CapabilitySource;
	/** Positional gate for constellation-hosted entries (C-index + 1), else 0. */
	hostConstellation: number;
	/** Conditions inherited from the hosting ability (and variant, when nested). */
	hostConditions: Condition[];
	/** The character's own element — an ingredient every team of theirs has. */
	holderElement?: string;
};

function composeConditions(host: Condition[], own: Condition | undefined): Condition | undefined {
	const parts = own ? [...host, own] : host;
	if (parts.length === 0) return undefined;
	if (parts.length === 1) return parts[0];
	return { type: 'all', conditions: parts };
}

function pushEffectCapabilities(
	effects: Effect[] | undefined,
	ctx: HostContext,
	out: DerivedCapability[],
	fallbackDuration?: number,
	summonLabel?: string
): void {
	for (const effect of effects ?? []) {
		// ⛔⛔ THE `manual` SKIP THAT LIVED HERE IS GONE, and its absence is the
		// point. Step 1 of the retirement (2026-09-15) added it because the Team
		// Builder was claiming 167 effects the planner refused to draw; step 3
		// (2026-09-21) emptied the corpus of them and struck the member from the
		// `Trigger` union, so the condition no longer typechecks. ⚓ The guarantee
		// moved UPSTREAM — characterLint B.18 refuses the trigger — which is the
		// stronger place for it: a filter here would still have let the data exist.
		// docs/manual-trigger-retirement-round.md.
		const mapped = effectCapability(effect);
		if (!mapped) continue;
		const composed = composeConditions(ctx.hostConditions, effect.conditions);
		const gate = minConstellationFor(composed);
		if (gate === null) continue; // never available at any constellation
		const minConstellation = Math.max(gate, ctx.hostConstellation);
		const caveats = new Set<string>();
		collectCaveats(composed, minConstellation, caveats);
		const duration = typeof effect.duration === 'number' ? effect.duration : fallbackDuration;
		const host = hostOf(effect.trigger, ctx.source.section);
		const teamNeed = teamNeedFor(composed, effect.trigger, ctx.holderElement);
		out.push({
			kind: mapped.kind,
			detail: mapped.detail,
			target: normalizeTarget(effect.target),
			minConstellation,
			caveats: [...caveats].sort(),
			...(duration !== undefined && duration > 0 && { duration }),
			...(summonLabel !== undefined && { summon: summonHost(summonLabel, effect) }),
			...amountOf(effect),
			...(host !== undefined && { host }),
			...(teamNeed && { teamNeed }),
			via: 'effect',
			source: ctx.source
		});
	}
}

function amountOf(effect: Effect): { amount?: number; mod?: string; value?: BuffValue } {
	if (effect.type === 'resShred')
		return { amount: Math.abs(effect.value), ...(effect.mod !== undefined && { mod: effect.mod }) };
	if (effect.type === 'buff')
		return {
			...(typeof effect.value === 'number' && { amount: effect.value }),
			value: effect.value
		};
	return {};
}

/**
 * The cast (or reaction) that opens an effect's window when its host is not a
 * cast itself — read off the TRIGGER, which already names it.
 *
 * Measured 2026-10-07 over passives + constellations: 200 cast-set effects
 * name their ability, 12 name none (either cast arms them), 43 hit-set
 * effects name exactly one of skill/burst, Sucrose's A4 names both, and 51
 * are set off by a reaction. A cast host is only meaningful off an ability —
 * an ability's own effects already ride their own cast.
 */
function hostOf(
	trigger: Trigger | undefined,
	section: CapabilitySection
): DerivedCapability['host'] {
	if (!trigger) return undefined;
	if (trigger.type === 'onReaction') {
		return {
			reactions: Array.isArray(trigger.reaction) ? [...trigger.reaction] : [trigger.reaction]
		};
	}
	if (section === 'ability') return undefined;
	if (trigger.type === 'onCast') {
		return { casts: trigger.ability ? [trigger.ability] : ['skill', 'burst'] };
	}
	if (trigger.type === 'onHit') {
		const named = [trigger.abilityType ?? []]
			.flat()
			.filter((t): t is 'skill' | 'burst' => t === 'skill' || t === 'burst');
		return named.length > 0 ? { casts: named } : undefined;
	}
	return undefined;
}

/** The summon descriptor for one capability: the label always, plus the cadence
 *  when THIS effect is the one that ticks. An effect riding a summon without a
 *  `summonTick` trigger (an aura buff applied once at spawn) is still
 *  summon-hosted — it just has no rhythm of its own. */
function summonHost(label: string, effect: Effect): DerivedCapability['summon'] {
	const trigger = effect.trigger as { type?: string; interval?: number; firstTickDelay?: number };
	if (trigger?.type !== 'summonTick' || !(trigger.interval! > 0)) return { label };
	return {
		label,
		tickInterval: trigger.interval,
		...(trigger.firstTickDelay !== undefined && { firstTickDelay: trigger.firstTickDelay })
	};
}

/**
 * How long a coordinated attack stays armed after its cast, read from the
 * three places the corpus states it — in this order, because the first two
 * are the attack's OWN window and the third is the cast's:
 *
 *   1. the summon that carries its damage (Xingqiu's Rainbow Bladework,
 *      Yelan's Exquisite Throw, Raiden's Eye) — and its label, so this lane
 *      and the summon path's merge rather than drawing one window twice;
 *   2. the `armedFor` on a proc's trigger (Nahida's Tri-Karma, Beidou);
 *   3. the cast's `activeDuration` (Nicole).
 *
 * Until 2026-10-07 the tag path set no duration at all, so all nine
 * coordinated attacks in the corpus drew nothing on Compare.
 * ⚠ BASE length only: a constellation `durationModifiers` (Xingqiu C2 +3s,
 * Dehya C2 +6s — the only two) is not applied. Lengthening the window by a
 * gate would need a per-constellation duration this model does not carry.
 */
function coordinatedWindow(host: {
	effects?: Effect[];
	summons?: Summon[];
	activeDuration?: number;
}): { duration: number; summonLabel?: string } | undefined {
	for (const summon of host.summons ?? []) {
		const deals = (summon.effects ?? []).some(
			(e) => e.type === 'damage' && !(e.trigger?.type === 'summonTick' && e.trigger.appliesOnly)
		);
		if (deals && typeof summon.duration === 'number' && summon.duration > 0) {
			return { duration: summon.duration, summonLabel: summon.label };
		}
	}
	let armed = 0;
	for (const effect of host.effects ?? []) {
		if (effect.type !== 'damage') continue;
		const t = effect.trigger as { armedFor?: number } | undefined;
		if (typeof t?.armedFor === 'number') armed = Math.max(armed, t.armedFor);
	}
	if (armed > 0) return { duration: armed };
	if (typeof host.activeDuration === 'number' && host.activeDuration > 0) {
		return { duration: host.activeDuration };
	}
	return undefined;
}

function pushTagCapabilities(
	tags: readonly string[] | undefined,
	ctx: HostContext,
	out: DerivedCapability[],
	window?: { duration: number; summonLabel?: string }
): void {
	for (const tag of tags ?? []) {
		let kind: CapabilityKind;
		let detail: string | undefined;
		switch (tag) {
			case 'heal':
			case 'shield':
			case 'summon':
			case 'taunt':
			case 'cleanse':
			case 'grouping':
				kind = tag;
				break;
			case 'coordinatedAttack':
				kind = 'offFieldDamage';
				detail = 'coordinatedAttack';
				break;
			default:
				continue;
		}
		const composed = composeConditions(ctx.hostConditions, undefined);
		const gate = minConstellationFor(composed);
		if (gate === null) continue;
		const minConstellation = Math.max(gate, ctx.hostConstellation);
		const caveats = new Set<string>();
		collectCaveats(composed, minConstellation, caveats);
		const timed = detail === 'coordinatedAttack' ? window : undefined;
		const teamNeed = teamNeedFor(composed, undefined, ctx.holderElement);
		out.push({
			kind,
			detail,
			minConstellation,
			caveats: [...caveats].sort(),
			...(teamNeed && { teamNeed }),
			...(timed && { duration: timed.duration }),
			...(timed?.summonLabel !== undefined && { summon: { label: timed.summonLabel } }),
			via: 'tag',
			source: ctx.source
		});
	}
}

/** Summons whose effects tick damage while active imply off-field damage.
 *
 *  NOTE (verified 2026-07-12): this deliberately ignores `terminatesOnSwap` —
 *  every summonTick-damage summon in the corpus today genuinely persists
 *  off-field (Citlali/Kinich checked against gcsim explicitly). If P3-era
 *  authoring ever puts a summonTick damage effect on a stance-bound,
 *  terminatesOnSwap summon (e.g. Mizuki's Dreamdrifter cloud or Kinich's
 *  in-stance Loop Shots), add a `!summon.terminatesOnSwap` guard here or the
 *  facet will over-claim off-field damage. */
function pushSummonCapabilities(
	summons: Summon[] | undefined,
	ctx: HostContext,
	out: DerivedCapability[]
): void {
	for (const summon of summons ?? []) {
		// ⚓ A sequenced summon's strikes (`summonStrike`, Lumi) are off-field
		// damage too — with no fixed rhythm to report, so `summonHost` gives the
		// label alone.
		const tickingDamage = (summon.effects ?? []).find(
			(e) =>
				e.type === 'damage' &&
				((e.trigger?.type === 'summonTick' && !e.trigger.appliesOnly) ||
					e.trigger?.type === 'summonStrike')
		);
		const summonDuration =
			typeof summon.duration === 'number' && summon.duration > 0 ? summon.duration : undefined;
		if (tickingDamage) {
			const gate = minConstellationFor(composeConditions(ctx.hostConditions, undefined));
			if (gate !== null) {
				out.push({
					kind: 'offFieldDamage',
					detail: 'summon',
					minConstellation: Math.max(gate, ctx.hostConstellation),
					caveats: [],
					...(summonDuration !== undefined && { duration: summonDuration }),
					summon: summonHost(summon.label, tickingDamage),
					via: 'effect',
					source: ctx.source
				});
			}
		}
		// Non-damage summon effects (heal ticks — Qiqi herald, buff auras) are
		// capabilities in their own right.
		pushEffectCapabilities(summon.effects, ctx, out, summonDuration, summon.label);
	}
}

function walkAbility(
	ability: Ability,
	section: CapabilitySection,
	index: number,
	out: DerivedCapability[],
	holderElement?: string
): void {
	// Explicit constellationLevel is canonical (authored on all 708 corpus
	// entries); array position is the fallback for hypothetical partial stubs.
	const hostConstellation =
		section === 'constellation'
			? ((ability.abilityType === 'constellation' ? ability.constellationLevel : undefined) ??
				index + 1)
			: 0;
	const baseCtx: HostContext = {
		source: { section, abilityId: ability.id, abilityName: ability.name },
		hostConstellation,
		hostConditions: ability.conditions ? [ability.conditions] : [],
		holderElement
	};

	pushEffectCapabilities(ability.effects, baseCtx, out);
	pushTagCapabilities(
		'tags' in ability ? ability.tags : undefined,
		baseCtx,
		out,
		coordinatedWindow(ability as Parameters<typeof coordinatedWindow>[0])
	);
	if ('summons' in ability) pushSummonCapabilities(ability.summons, baseCtx, out);

	const variants: AbilityVariant[] | undefined =
		'variants' in ability ? ability.variants : undefined;
	for (const variant of variants ?? []) {
		const ctx: HostContext = {
			source: { ...baseCtx.source, variant: variant.label },
			hostConstellation,
			hostConditions: [
				...(ability.conditions ? [ability.conditions] : []),
				...(variant.conditions ? [variant.conditions] : [])
			],
			holderElement
		};
		pushEffectCapabilities(variant.effects, ctx, out);
		// A variant's summons/effects REPLACE the base's (.claude/rules/schema.md), so
		// its window is read off whatever the variant actually carries, falling
		// back to the base where the variant restates nothing.
		pushTagCapabilities(
			variant.tags,
			ctx,
			out,
			coordinatedWindow({
				effects: variant.effects ?? ability.effects,
				summons: variant.summons ?? ('summons' in ability ? ability.summons : undefined),
				activeDuration: (ability as { activeDuration?: number }).activeDuration
			})
		);
		pushSummonCapabilities(variant.summons, ctx, out);
	}
}

/** Derives every capability the character's curated data implies, with provenance. */
export function deriveCharacterCapabilities(char: CharacterData): CharacterCapabilities {
	const capabilities: DerivedCapability[] = [];
	const el = char.element;
	char.abilities?.forEach((a, i) => walkAbility(a, 'ability', i, capabilities, el));
	char.passives?.forEach((a, i) => walkAbility(a, 'passive', i, capabilities, el));
	char.constellations?.forEach((a, i) => walkAbility(a, 'constellation', i, capabilities, el));
	// Faction bonuses (e.g. Hexerei: Secret Rite) are team-conditional kit
	// additions hosted outside abilities/passives/constellations — without this
	// walk their effects are invisible to the facets (Fischl's team ATK/EM buffs
	// derived nothing until the 2026-07-28 capability sweep caught it).
	for (const fb of char.factionBonuses ?? []) {
		pushEffectCapabilities(
			fb.effects,
			{
				source: {
					section: 'factionBonus',
					abilityId: `${char.id}__faction__${fb.faction}`,
					abilityName: fb.name
				},
				hostConstellation: 0,
				hostConditions: [],
				holderElement: el
			},
			capabilities
		);
	}
	return { id: char.id, capabilities };
}

// ---------------------------------------------------------------------------
// Aggregation — the compact form the eager index carries
// ---------------------------------------------------------------------------

const KIND_ORDER: CapabilityKind[] = [
	'heal',
	'shield',
	'offFieldDamage',
	'resShred',
	'cleanse',
	'grouping',
	'buff',
	'energy',
	'infuse',
	'summon',
	'taunt'
];

/**
 * Groups derived capabilities by (kind, detail, target), keeping the lowest
 * constellation gate. `conditional` is true only when every source achieving
 * that gate is runtime-gated — an unconditional source anywhere clears it.
 */
export function summarizeCapabilities(caps: DerivedCapability[]): CapabilitySummary[] {
	const groups = new Map<string, CapabilitySummary>();
	// Every source of a group, for `teamGated` (kept only where a need exists).
	const sources = new Map<string, Map<string, { minCon: number; need: TeamNeed | null }>>();
	for (const cap of caps) {
		const key = `${cap.kind}|${cap.detail ?? ''}|${cap.target ?? ''}`;
		const src = { minCon: cap.minConstellation, need: cap.teamNeed ?? null };
		const bySig = sources.get(key) ?? new Map();
		bySig.set(JSON.stringify(src), src);
		sources.set(key, bySig);
		const conditional = cap.caveats.length > 0;
		const existing = groups.get(key);
		if (!existing) {
			groups.set(key, {
				kind: cap.kind,
				...(cap.detail !== undefined && { detail: cap.detail }),
				...(cap.target !== undefined && { target: cap.target }),
				minCon: cap.minConstellation,
				conditional
			});
		} else if (cap.minConstellation < existing.minCon) {
			existing.minCon = cap.minConstellation;
			existing.conditional = conditional;
		} else if (cap.minConstellation === existing.minCon) {
			existing.conditional = existing.conditional && conditional;
		}
	}
	for (const [key, summary] of groups) {
		const list = [...(sources.get(key)?.values() ?? [])];
		if (list.some((s) => s.need !== null)) {
			summary.teamGated = list.sort((a, b) => a.minCon - b.minCon);
		}
	}
	// A target-less (tag-derived) entry is subsumed by a target-ful (effect-
	// derived) entry of the same kind at the same-or-lower gate — the effect
	// entry carries strictly more information. Tag entries survive only when
	// they unlock EARLIER than any effect entry (e.g. base-kit tag alongside a
	// constellation-gated effect).
	const summaries = [...groups.values()].filter(
		(s) =>
			s.target !== undefined ||
			![...groups.values()].some(
				(other) =>
					other !== s &&
					other.kind === s.kind &&
					other.target !== undefined &&
					other.minCon <= s.minCon
			)
	);
	return summaries.sort(
		(a, b) =>
			KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
			(a.detail ?? '').localeCompare(b.detail ?? '') ||
			(a.target ?? '').localeCompare(b.target ?? '') ||
			a.minCon - b.minCon
	);
}

// ---------------------------------------------------------------------------
// Facet model — the filterable surface over capability summaries
//
// Lives here (not in the builder route lib) so the capability sweep
// audit (scripts/audit-capability-sweep.mjs) and the UI share ONE predicate
// and one role→facet grouping — they must never drift. The route modules
// (builder/lib/facets.ts, roles.ts) re-export these.
// ---------------------------------------------------------------------------

export type FacetKey =
	| 'heal'
	| 'shield'
	| 'offFieldDamage'
	| 'resShred'
	| 'cleanse'
	| 'grouping'
	| 'taunt'
	| 'energy'
	| 'infuse'
	| 'interruptionRes'
	| 'buff:atk'
	| 'buff:em'
	| 'buff:crit'
	| 'buff:dmg'
	| 'buff:hpdef';

/** Buff facets count only ally-facing buffs — a self-only Crit buff doesn't
 *  answer "who can buff my team's Crit". Tag-derived entries (no target) and
 *  non-buff kinds pass through; heals/shields are team-relevant even when
 *  self-targeted only in edge kits, and the badge shows the target anyway. */
export function capMatchesFacet(cap: CapabilitySummary, facet: FacetKey): boolean {
	if (facet.startsWith('buff:')) {
		if (cap.kind !== 'buff' || !cap.detail) return false;
		if (cap.target === 'self') return false;
		return `buff:${buffFamilyOf(cap.detail)}` === facet;
	}
	if (facet === 'energy') return cap.kind === 'energy' && cap.target !== 'self';
	// Interruption Res is derived as a generic buff (detail 'interruptionRes'),
	// so buffFamilyOf files it under 'other' — no buff:* facet catches it. Match
	// it explicitly; the infusion facet falls through to the kind check below.
	if (facet === 'interruptionRes')
		return cap.kind === 'buff' && cap.detail === 'interruptionRes' && cap.target !== 'self';
	return cap.kind === facet;
}

/** Does any of these capabilities answer `facet` within `conCap`? THE one
 *  provider test — the roster filter, the coverage checklist, the role
 *  sections, the audition seed and the capability sweep all asked it in their
 *  own words until 2026-10-07 (six copies), which is how two of them came to
 *  read the constellation cap differently. */
export function providesFacet(
	caps: readonly CapabilitySummary[],
	facet: FacetKey,
	conCap: number
): boolean {
	return caps.some((c) => capMatchesFacet(c, facet) && c.minCon <= conCap);
}

/** Capability facets grouped under each function — the drill-down rows for the
 *  Support/Survivability cards. DPS drills by element instead, so its list is
 *  empty. `offFieldDamage` is intentionally omitted for now: whether Off-Field
 *  DPS supersedes it as a capability is a deferred call. Interruption Res sits
 *  under Support (where its providers — Columbina, Gorou — are role-classed),
 *  not Survivability, so it surfaces where those characters actually appear. */
export const FUNCTION_FACETS: Record<RoleFunction, FacetKey[]> = {
	dps: [],
	support: [
		'resShred',
		'grouping',
		'buff:atk',
		'buff:em',
		'buff:crit',
		'buff:dmg',
		'buff:hpdef',
		'energy',
		'infuse',
		'interruptionRes'
	],
	survivability: ['heal', 'shield', 'cleanse', 'taunt']
};
