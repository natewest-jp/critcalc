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
	Condition,
	Effect,
	EffectTarget,
	Summon
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
			collectCaveats(cond.condition, con, out);
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
// Target + effect mapping
// ---------------------------------------------------------------------------

function normalizeTarget(t: EffectTarget | EffectTarget[]): NormalizedTarget {
	const arr = Array.isArray(t) ? t : [t];
	if (arr.includes('team') || arr.includes('teamExcludingSelf')) return 'team';
	if (arr.includes('active') || arr.includes('next')) return 'active';
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
		// ⛔⛔ A `manual` trigger reaches NO planner surface and never did (rubric N1:
		// its one code occurrence is its own type declaration), yet until 2026-09-15
		// this walk never inspected triggers, so the Team Builder claimed all 167 such
		// effects as live capabilities — including at least one fabricated value
		// (Wriothesley's +50% ATK). Two surfaces disagreeing about one effect, and
		// only one of them can be caveated. ⚓ Nate's decision: retire the channel —
		// the TB skips it first, lint refuses it next, and each effect is re-triggered
		// or retired to description (docs/manual-trigger-retirement.md). A claim that
		// vanishes here is a claim the planner never honoured.
		if (effect.trigger?.type === 'manual') continue;
		const mapped = effectCapability(effect);
		if (!mapped) continue;
		const composed = composeConditions(ctx.hostConditions, effect.conditions);
		const gate = minConstellationFor(composed);
		if (gate === null) continue; // never available at any constellation
		const minConstellation = Math.max(gate, ctx.hostConstellation);
		const caveats = new Set<string>();
		collectCaveats(composed, minConstellation, caveats);
		const duration = typeof effect.duration === 'number' ? effect.duration : fallbackDuration;
		out.push({
			kind: mapped.kind,
			detail: mapped.detail,
			target: normalizeTarget(effect.target),
			minConstellation,
			caveats: [...caveats].sort(),
			...(duration !== undefined && duration > 0 && { duration }),
			...(summonLabel !== undefined && { summon: summonHost(summonLabel, effect) }),
			via: 'effect',
			source: ctx.source
		});
	}
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

function pushTagCapabilities(
	tags: readonly string[] | undefined,
	ctx: HostContext,
	out: DerivedCapability[]
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
		out.push({
			kind,
			detail,
			minConstellation,
			caveats: [...caveats].sort(),
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
		const tickingDamage = (summon.effects ?? []).find(
			(e) => e.type === 'damage' && e.trigger?.type === 'summonTick'
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
	out: DerivedCapability[]
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
		hostConditions: ability.conditions ? [ability.conditions] : []
	};

	pushEffectCapabilities(ability.effects, baseCtx, out);
	pushTagCapabilities('tags' in ability ? ability.tags : undefined, baseCtx, out);
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
			]
		};
		pushEffectCapabilities(variant.effects, ctx, out);
		pushTagCapabilities(variant.tags, ctx, out);
		pushSummonCapabilities(variant.summons, ctx, out);
	}
}

/** Derives every capability the character's curated data implies, with provenance. */
export function deriveCharacterCapabilities(char: CharacterData): CharacterCapabilities {
	const capabilities: DerivedCapability[] = [];
	char.abilities?.forEach((a, i) => walkAbility(a, 'ability', i, capabilities));
	char.passives?.forEach((a, i) => walkAbility(a, 'passive', i, capabilities));
	char.constellations?.forEach((a, i) => walkAbility(a, 'constellation', i, capabilities));
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
				hostConditions: []
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
	for (const cap of caps) {
		const key = `${cap.kind}|${cap.detail ?? ''}|${cap.target ?? ''}`;
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
// Lives here (not in the team-builder route lib) so the capability sweep
// audit (scripts/audit-capability-sweep.mjs) and the UI share ONE predicate
// and one role→facet grouping — they must never drift. The route modules
// (team-builder/lib/facets.ts, roles.ts) re-export these.
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
