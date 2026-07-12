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

import type { CharacterData } from '$lib/types/character';
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
	| 'taunt';

/** Effect targets collapsed to who-benefits granularity for filtering. */
export type NormalizedTarget = 'team' | 'active' | 'self' | 'enemy';

export type CapabilitySection = 'ability' | 'passive' | 'constellation';

export type CapabilitySource = {
	section: CapabilitySection;
	abilityId: string;
	abilityName: string;
	/** Variant label when the capability comes from a variant override (e.g. "Hold"). */
	variant?: string;
};

export type DerivedCapability = {
	kind: CapabilityKind;
	/** buff: the Stat key; resShred/infuse: the element ('all' = unrestricted shred);
	 *  offFieldDamage: 'coordinatedAttack' | 'summon'. */
	detail?: string;
	/** Absent for tag-derived capabilities — tags carry no target information. */
	target?: NormalizedTarget;
	/** Minimum constellation at which this source grants the capability (0 = base kit). */
	minConstellation: number;
	/** Runtime conditions that must hold but can't be resolved statically
	 *  (labels like 'state:nightsoulBlessing', 'selfHp', 'stacks:declension'). */
	caveats: string[];
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

export function buffFamilyOf(stat: string): BuffFamily {
	if (stat === 'atk' || stat === 'atk%' || stat === 'baseAtk') return 'atk';
	if (stat === 'em') return 'em';
	if (stat === 'critRate' || stat === 'critDmg' || stat.endsWith('CritDmg')) return 'crit';
	if (stat.endsWith('DmgBonus') || stat.endsWith('FlatDmg')) return 'dmg';
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
			return { kind: 'resShred', detail: effect.element ?? 'all' };
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

function pushEffectCapabilities(effects: Effect[] | undefined, ctx: HostContext, out: DerivedCapability[]): void {
	for (const effect of effects ?? []) {
		const mapped = effectCapability(effect);
		if (!mapped) continue;
		const composed = composeConditions(ctx.hostConditions, effect.conditions);
		const gate = minConstellationFor(composed);
		if (gate === null) continue; // never available at any constellation
		const minConstellation = Math.max(gate, ctx.hostConstellation);
		const caveats = new Set<string>();
		collectCaveats(composed, minConstellation, caveats);
		out.push({
			kind: mapped.kind,
			detail: mapped.detail,
			target: normalizeTarget(effect.target),
			minConstellation,
			caveats: [...caveats].sort(),
			via: 'effect',
			source: ctx.source
		});
	}
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

/** Summons whose effects tick damage while active imply off-field damage. */
function pushSummonCapabilities(summons: Summon[] | undefined, ctx: HostContext, out: DerivedCapability[]): void {
	for (const summon of summons ?? []) {
		const ticksDamage = (summon.effects ?? []).some(
			(e) => e.type === 'damage' && e.trigger?.type === 'summonTick'
		);
		if (ticksDamage) {
			const gate = minConstellationFor(composeConditions(ctx.hostConditions, undefined));
			if (gate !== null) {
				out.push({
					kind: 'offFieldDamage',
					detail: 'summon',
					minConstellation: Math.max(gate, ctx.hostConstellation),
					caveats: [],
					via: 'effect',
					source: ctx.source
				});
			}
		}
		// Non-damage summon effects (heal ticks — Qiqi herald, buff auras) are
		// capabilities in their own right.
		pushEffectCapabilities(summon.effects, ctx, out);
	}
}

function walkAbility(ability: Ability, section: CapabilitySection, index: number, out: DerivedCapability[]): void {
	// Explicit constellationLevel is canonical (authored on all 708 corpus
	// entries); array position is the fallback for hypothetical partial stubs.
	const hostConstellation =
		section === 'constellation'
			? (ability.abilityType === 'constellation' ? ability.constellationLevel : undefined) ?? index + 1
			: 0;
	const baseCtx: HostContext = {
		source: { section, abilityId: ability.id, abilityName: ability.name },
		hostConstellation,
		hostConditions: ability.conditions ? [ability.conditions] : []
	};

	pushEffectCapabilities(ability.effects, baseCtx, out);
	pushTagCapabilities('tags' in ability ? ability.tags : undefined, baseCtx, out);
	if ('summons' in ability) pushSummonCapabilities(ability.summons, baseCtx, out);

	const variants: AbilityVariant[] | undefined = 'variants' in ability ? ability.variants : undefined;
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
				(other) => other !== s && other.kind === s.kind && other.target !== undefined && other.minCon <= s.minCon
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
