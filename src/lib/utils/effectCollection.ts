/**
 * src/lib/timeline/effectCollection.ts
 *
 * Effect candidate-pool collection + trigger-context resolution for the
 * timeline pipelines. Walks a character's full effect surface (abilities +
 * passives + constellations) and gathers effects by trigger type; resolves
 * the (ability, variant/hit) context a cast or input block fires under so
 * the fine-grained `trigger.filter` (G primitive) can be evaluated per cast.
 * Pure — extracted from RotationTimeline.svelte for unit testing.
 */

import type { InputBlock } from '$lib/utils/notationParser';
import {
	castIsNonHitting,
	getDefaultDamageTag,
	type TriggerFilterContext
} from '$lib/types/ability';
import type { Ability, AbilityVariant, Effect, EffectTarget, Stat } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';

/** Where on the character an effect came from, when that is a faction bonus
 *  rather than an ability / passive / constellation. */
export type FactionProvenance = { faction: string; bonusName: string };

/* ── Faction provenance (2026-08-15) ─────────────────────────────────────────
 *
 * ⚓ `factionBonuses` effects now join the candidate pool (they reached the
 * capability layer but never the planner, so no Secret Rite buff had ever drawn
 * a bar — see docs/faction-bonuses-round.md).
 *
 * ⚠ They must NOT be indistinguishable from the ability's own effects once
 * collected. Every emit site in `buffWindows` pools one cast's effects into ONE
 * window, so a faction buff merged into that pool would render inside the
 * ability's bar and label as plain "Sucrose E" — hiding the team-composition
 * gate that is the whole point of a Secret Rite. `emit` splits the pool by
 * provenance instead, which needs to recover it from the effect alone.
 *
 * ⛔ Not by widening the collectors' return type to a wrapper: they return
 * `Effect[]` to a dozen call sites that filter and narrow on `effect.type`, and
 * threading a box through all of them buys nothing the map does not. Effects
 * are stable object references off the loaded character JSON, so a WeakMap
 * keyed on identity is O(1), allocation-free after registration, and invisible
 * to every consumer that does not ask.
 *
 * ⚠ Identity is the one invariant this depends on. `normalizeBuffLikeEffect`
 * CLONES `elevate` effects, so it re-registers the clone below; no faction
 * bonus authors an `elevate` today, and that line is why one may. */
const FACTION_PROVENANCE = new WeakMap<Effect, FactionProvenance>();

/** Registration is idempotent, but the character walk is not free — a memo
 *  keeps `effectSourcesOf` cheap on the per-cast paths that call it in a loop. */
const REGISTERED = new WeakSet<CharacterData>();

/* ── The constellation gate (2026-08-18) ────────────────────────────────────
 *
 * ⚓ A CONSTELLATION ENTRY'S OWN `constellationLevel` IS THE GATE. It is
 * described that way in CLAUDE.md and `deriveCapabilities` has always honoured
 * it, but nothing on the planner path read it: every walk of a character's
 * effect surface took `char.constellations` whole and gated only on each
 * effect's own `conditions`. 184 constellation effects across 77 characters
 * carry no such condition, so they were live at C0 — measured, 34 buff/debuff
 * bars across 23 characters that should never have been drawn.
 *
 * ⛔ The fix is NOT to author 184 conditions. Making every curator restate the
 * field is exactly what produced 184 misses. It is gated HERE, at collection,
 * so a new constellation effect is gated by existing.
 *
 * ⚓ Safe because the 133 constellation effects that DO carry a constellation
 * condition are pure duplication of their entry's level — none names a
 * different level, none negates it — so an entry-level gate cannot change the
 * meaning of a single authored effect. It can only stop the ungated ones from
 * leaking. See docs/constellation-gating-plan.md.
 *
 * ⚠ `constellationScaling` is a DIFFERENT mechanism (it scales a buff's VALUE
 * at a level, on an effect that is already unlocked) and must not be folded in.
 * ⚠ Effects gated on `not(constellation N)` exist (Nicole's A1) but live on
 * PASSIVES, so an entry-level gate never touches them. */

/** The constellation entries unlocked at `cLevel`. */
export function unlockedConstellations(char: CharacterData, cLevel: number): Ability[] {
	const cons = char.constellations;
	if (!cons || cons.length === 0) return [];
	return cons.filter(
		(c) => (c.abilityType === 'constellation' ? c.constellationLevel : 0) <= cLevel
	);
}

/** The ability-shaped effect hosts a character has AT a constellation level:
 *  abilities + passives + the unlocked constellations.
 *
 *  ⚓ This is the one idiom. It replaces
 *  `[...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])]`,
 *  which appeared ~15 times and never carried the level. Grep for the old shape
 *  before adding a walk of your own. */
export function effectSourcesAtConstellation(char: CharacterData, cLevel: number): Ability[] {
	return [...char.abilities, ...(char.passives ?? []), ...unlockedConstellations(char, cLevel)];
}

/** The character's full effect surface at a constellation level: abilities +
 *  passives + unlocked constellations, and (since 2026-08-15) faction bonuses.
 *
 * ⚠ A faction bonus is not ability-shaped — it has no `abilityType`, so it
 * takes the same path a passive does through the collectors' trigger matching.
 * That is safe ONLY because every faction effect in the corpus declares its
 * trigger binding explicitly (`onCast ability:`, `onHit abilityType:`,
 * `onReaction reaction:`), so the "no explicit ability → fire on BOTH casts"
 * fall-through never reaches one. `characterLint` C.17 holds that property. */
export function effectSourcesOf(char: CharacterData, cLevel: number): EffectSource[] {
	return [...effectSourcesAtConstellation(char, cLevel), ...factionSourcesOf(char)];
}

/** An effect host as the collectors below consume it — an ability, a passive, a
 *  constellation entry or a faction bonus, reduced to the three fields trigger
 *  matching reads. */
type EffectSource = {
	/** An ability's id — present on abilities, passives and constellations,
	 *  absent on a faction bonus. Read by `hostedElsewhere` for cast abilities. */
	id?: string;
	abilityType?: string;
	effects?: Effect[];
	variants?: { input?: string[]; effects?: Effect[] }[];
};

/** The character's faction-bonus hosts, with provenance registered. Split out
 *  of `effectSourcesOf` so the non-ability collector can reuse both. */
function factionSourcesOf(char: CharacterData): EffectSource[] {
	const factionSources = char.factionBonuses ?? [];
	if (factionSources.length > 0 && !REGISTERED.has(char)) {
		for (const fb of factionSources) {
			for (const fx of fb.effects ?? []) {
				FACTION_PROVENANCE.set(fx, { faction: fb.faction, bonusName: fb.name });
			}
		}
		REGISTERED.add(char);
	}
	return factionSources.map((fb) => ({ effects: fb.effects }));
}

/** `effectSourcesOf` MINUS `char.abilities` — passives + unlocked
 *  constellations + faction bonuses.
 *
 *  ⚓ For a caller that has already RESOLVED which ability this cast is. The
 *  full pool walks every ability of the cast's type, which is wrong the moment
 *  a character has more than one: Lan Yan has three `skill` abilities and only
 *  the base one shields, so a pool-wide walk would hand her stance follow-ups
 *  a 12.5s shield they do not grant. A caller holding the resolved ability
 *  reads its effects itself and asks this for the rest. */
function nonAbilityEffectSourcesOf(char: CharacterData, cLevel: number): EffectSource[] {
	return [
		...(char.passives ?? []),
		...unlockedConstellations(char, cLevel),
		...factionSourcesOf(char)
	];
}

/** The faction bonus an effect came from, or undefined for ability / passive /
 *  constellation effects. Populated by `effectSourcesOf`, so it is only
 *  meaningful for effects that came out of a collector. */
export function factionProvenanceOf(effect: Effect): FactionProvenance | undefined {
	return FACTION_PROVENANCE.get(effect);
}

export function targetsTeamOrActive(target: EffectTarget | EffectTarget[]): boolean {
	const ts = Array.isArray(target) ? target : [target];
	return ts.some((t) => t === 'team' || t === 'teamExcludingSelf' || t === 'active');
}

export function targetsEnemy(target: EffectTarget | EffectTarget[]): boolean {
	const ts = Array.isArray(target) ? target : [target];
	return ts.includes('enemy');
}

// Returns true only when the effect exclusively targets the active character.
// These effects are segmented per on-field window rather than shown in the team buff row.
export function isActiveTargetOnly(target: EffectTarget | EffectTarget[]): boolean {
	return !Array.isArray(target) && target === 'active';
}

type Rx = import('$lib/types/ability').Reaction;

/** ⚓ FAMILY elevations — a kit that elevates "all Stellar Glimmer" or "all
 *  Lunar" reaction DMG names the WHOLE family, and the family has its own
 *  umbrella stat. Matched as a SET so order in the JSON cannot matter.
 *  ⚠️ Without this a family elevation falls through the `length !== 1` guard
 *  below and renders NOTHING — which is how Sandrone's C6 would have gone dark
 *  the moment 7.0 widened it from Stellar-Conduct to both Stellar reactions. */
const FAMILY_ELEVATIONS: ReadonlyArray<{ members: readonly Rx[]; stat: Stat }> = [
	{ members: ['stellarConduct', 'stellarSwirl'], stat: 'stellarGlimmerDmgBonus' },
	{ members: ['lunarCharged', 'lunarBloom', 'lunarCrystallize'], stat: 'lunarDmgBonus' }
];

function familyElevationStat(reactions: readonly Rx[]): Stat | null {
	for (const f of FAMILY_ELEVATIONS) {
		if (f.members.length !== reactions.length) continue;
		if (f.members.every((m) => reactions.includes(m))) return f.stat;
	}
	return null;
}

/** Maps a single Lunar/Stellar reaction to the matching `*DmgBonus` stat key
 *  used by display formatting and de-dup. Returns null for reactions outside
 *  the rendered set. Whole-family elevations go through `familyElevationStat`. */
function elevateReactionToDisplayStat(reaction: Rx): Stat | null {
	if (reaction === 'lunarCharged') return 'lunarChargedDmgBonus';
	if (reaction === 'lunarBloom') return 'lunarBloomDmgBonus';
	if (reaction === 'lunarCrystallize') return 'lunarCrystallizeDmgBonus';
	if (reaction === 'stellarConduct') return 'stellarConductDmgBonus';
	if (reaction === 'stellarSwirl') return 'stellarSwirlDmgBonus';
	return null;
}

/** Converts an `elevate` effect into a synthesized `buff` effect for renderer
 *  ingestion. Single-reaction elevations map to the matching `*DmgBonus` stat;
 *  a whole FAMILY maps to that family's umbrella stat; anything else returns
 *  null (not rendered). All other effect types pass through unchanged. */
function normalizeBuffLikeEffect(effect: Effect): Effect | null {
	if (effect.type !== 'elevate') return effect;
	const stat =
		effect.reactions.length === 1
			? elevateReactionToDisplayStat(effect.reactions[0])
			: familyElevationStat(effect.reactions);
	if (!stat) return null;
	const synthesized: Effect = {
		type: 'buff',
		target: effect.target,
		trigger: effect.trigger,
		conditions: effect.conditions,
		duration: effect.duration,
		durationType: effect.durationType,
		procCooldown: effect.procCooldown,
		attribution: effect.attribution,
		source: effect.source,
		stat,
		value: effect.value,
		snapshottable: effect.snapshottable
	};
	// ⚠ This is the ONE place a collected effect is not the authored object, so
	// it is the one place faction provenance can be lost. Carry it across.
	const prov = FACTION_PROVENANCE.get(effect);
	if (prov) FACTION_PROVENANCE.set(synthesized, prov);
	return synthesized;
}

/** Flat-maps a list of effects through `normalizeBuffLikeEffect`, dropping
 *  unrenderable elevations. Applied at character-effect collection helpers
 *  so downstream filter sites can keep their `effect.type === 'buff'`
 *  shape unchanged. */
function normalizeBuffLikeEffects(effects: Effect[]): Effect[] {
	const out: Effect[] = [];
	for (const e of effects) {
		const n = normalizeBuffLikeEffect(e);
		if (n) out.push(n);
	}
	return out;
}

/**
 * Collects all effects from a character that fire on the given cast type.
 * Walks the character's abilities, passives, and constellations — effects
 * live on their source (the C1 buff lives on the C1 constellation, not on
 * the burst it triggers off).
 *
 * Trigger matching:
 *   - `trigger.type` must be `'onCast'`.
 *   - If `trigger.ability` is set, it must equal `castType`.
 *   - If absent and source is skill/burst, the source's own abilityType
 *     is the implicit binding.
 *   - If absent and source is passive/constellation, the effect fires on
 *     any cast (matches both skill and burst) — e.g. Kazuha C6 infusion
 *     triggers after either E or Q.
 */
/**
 * A source's effects AS THIS CAST RESOLVED THEM — variant-aware (2026-08-14).
 *
 * 🐛 The collectors below used to read `src.effects` flat, and nothing else in
 * the parser descended into `variants`. So a variant's `effects` were dead data
 * on the rotation side while the capabilities layer (deriveCapabilities, which
 * DOES walk them) reported them to the Team Builder — five characters, all
 * `onCast`, and every one of them silently wrong on the timeline:
 *   Diona   hold-E shield 12s     rendered as the tap's 4.8s
 *   Candace hold-E shield 1.52s   rendered as 0.27s
 *   Shenhe  hold-E buff 15s       rendered as 10s
 *   Eula    hold-E resShred ×2    rendered as nothing
 *   Zhongli hold-E resShred 20s   rendered as nothing
 *
 * ⚓ A VARIANT'S EFFECTS REPLACE THE BASE ABILITY'S — they do not add to them.
 * The corpus is unanimous and it is the only reading that works: Diona's hold
 * shield is 12s INSTEAD OF the tap's 4.8s, not alongside it, and the additive
 * reading would put two shields on one cast. It also matches the convention
 * `AbilityVariant.summons` already documents ("Overrides the base ability's
 * summons[]"). ⚠ The consequence for curators: a variant that restates ONE of
 * its ability's effects drops the rest — list every effect the variant grants,
 * not just the ones whose values changed.
 *
 * `castLabel` absent = no cast context (a corpus-wide capability sweep rather
 * than a cast), so the base list stands. Passives and constellations have no
 * variants and are untouched.
 */
function effectsForCast(
	src: { effects?: Effect[]; variants?: { input?: string[]; effects?: Effect[] }[] },
	castLabel: string | undefined
): Effect[] {
	if (castLabel === undefined || !src.variants) return src.effects ?? [];
	const variant = src.variants.find((v) => v.input?.includes(castLabel));
	return variant?.effects ?? src.effects ?? [];
}

/** ⚓ AN EFFECT HOSTED ON A CAST ABILITY FIRES ONLY FOR CASTS OF THAT ABILITY
 *  (2026-09-19). The walk used to admit every skill-hosted effect for any skill
 *  cast, which no character could expose until one had a SIBLING skill and a
 *  skill-hosted `onCast` buff at once: Varka's A1 multiplier, authored on
 *  Windbound Execution, fired again on every in-stance Four Winds cast and
 *  refresh-merged its bar 10s past the stance's end. Passives, constellations
 *  and faction bonuses are untouched — they host no cast and fire for both
 *  kinds as before. `castAbilityId` absent keeps the old walk (callers that
 *  have no resolved ability in hand). */
function hostedElsewhere(src: EffectSource, castAbilityId: string | undefined): boolean {
	return (
		castAbilityId !== undefined &&
		(src.abilityType === 'skill' || src.abilityType === 'burst') &&
		src.id !== castAbilityId
	);
}

function collectOnCastEffects(
	sources: EffectSource[],
	castType: 'skill' | 'burst',
	castLabel: string | undefined,
	castAbilityId?: string
): Effect[] {
	const result: Effect[] = [];
	for (const src of sources) {
		if (hostedElsewhere(src, castAbilityId)) continue;
		for (const fx of effectsForCast(src, castLabel)) {
			if (fx.trigger.type !== 'onCast') continue;
			const explicit = fx.trigger.ability;
			if (explicit !== undefined) {
				if (explicit !== castType) continue;
			} else if (src.abilityType === 'skill' || src.abilityType === 'burst') {
				if (src.abilityType !== castType) continue;
			}
			// passive / constellation with no explicit ability → fire for both casts
			result.push(fx);
		}
	}
	return normalizeBuffLikeEffects(result);
}

export function getCharacterEffectsForCast(
	char: CharacterData,
	cLevel: number,
	castType: 'skill' | 'burst',
	castLabel?: string,
	/** The RESOLVED ability's id — see `hostedElsewhere`. */
	castAbilityId?: string
): Effect[] {
	return collectOnCastEffects(effectSourcesOf(char, cLevel), castType, castLabel, castAbilityId);
}

/** The onCast effects this cast fires that are NOT hosted on a cast ability —
 *  passives, unlocked constellations, faction bonuses (2026-08-18).
 *
 *  ⚓ The complement of the resolved ability's own `effects`, for a caller that
 *  already holds that ability and must not have a second one of the same type
 *  substituted for it (see `nonAbilityEffectSourcesOf`). `registerShieldOnCast`
 *  is the author: a shield Effect on a constellation entry reached no lane at
 *  any level until it read this pool — see docs/constellation-shield-gap.md.
 *
 *  ⚠ No `castLabel`: passives and constellations carry no `variants`, so there
 *  is nothing for a cast label to resolve against. */
export function getNonAbilityEffectsForCast(
	char: CharacterData,
	cLevel: number,
	castType: 'skill' | 'burst'
): Effect[] {
	return collectOnCastEffects(nonAbilityEffectSourcesOf(char, cLevel), castType, undefined);
}

/** Collects `onHit` effects whose abilityType matches the cast class. Accepts
 *  any of the five canonical classes — skill/burst (cast loops) and
 *  normal/charged/plunge (input-block loops, F2B). Mirrors
 *  `getCharacterEffectsForCast`'s passive/constellation fall-through, but
 *  ONLY for skill/burst — for N/CA/P, an effect must declare `abilityType`
 *  explicitly (otherwise a passive's onHit-without-abilityType would
 *  fire on every N hit too, almost always wrong).
 *
 *  The fine-grained `trigger.filter` (G primitive) is NOT applied here —
 *  filter eval is per-cast/per-block against the resolved context. This
 *  helper is purely the candidate-pool collector. */
export function getCharacterEffectsForOnHit(
	char: CharacterData,
	cLevel: number,
	castType: 'skill' | 'burst' | 'normal' | 'charged' | 'plunge',
	castLabel?: string,
	/** The RESOLVED cast ability's id for skill/burst — see `hostedElsewhere`. */
	castAbilityId?: string
): Effect[] {
	const sources = effectSourcesOf(char, cLevel);
	const result: Effect[] = [];
	const isInputClass = castType === 'normal' || castType === 'charged' || castType === 'plunge';
	for (const src of sources) {
		if (hostedElsewhere(src, castAbilityId)) continue;
		for (const fx of effectsForCast(src, castLabel)) {
			if (fx.trigger.type !== 'onHit') continue;
			const explicit = fx.trigger.abilityType;
			if (explicit !== undefined) {
				// Array form matches any listed class (Escoffier C6 NA/CA/PL).
				const classes = Array.isArray(explicit) ? explicit : [explicit];
				if (!classes.includes(castType)) continue;
			} else if (src.abilityType === 'skill' || src.abilityType === 'burst') {
				if (src.abilityType !== castType) continue;
			} else if (isInputClass) {
				// passive/constellation onHit with no abilityType → would over-fire
				// on every N/CA/P hit. Require explicit declaration.
				continue;
			}
			// passive / constellation, castType skill|burst → fire for both casts
			result.push(fx);
		}
	}
	return normalizeBuffLikeEffects(result);
}

/** Maps an input block to its damage-tag class (the `castType` slot used by
 *  `getCharacterEffectsForOnHit` and `resolveBlockContext`). Movement and
 *  unset blocks return null (no hit fires). */
export function getBlockDamageTag(block: InputBlock): 'normal' | 'charged' | 'plunge' | null {
	if (block.kind === 'movement' || block.kind === 'unset') return null;
	if (block.kind === 'skill' || block.kind === 'burst') return null;
	const part = block.parts[0] ?? '';
	if (/^[hl]?P$/.test(part)) return 'plunge';
	if (/^C/.test(part)) return 'charged';
	return 'normal';
}

/** Resolves the (ability, hit-name) pair backing an InputBlock so the G
 *  filter can evaluate against the block's actual damageTag/element/name.
 *  Mirrors `resolveCastContext` but for N/CA/P blocks.
 *
 *  - `damageTag` from `getBlockDamageTag(block)`.
 *  - `element` from `block.kind`: 'elemental-normal' → char element;
 *    'normal' → 'physical'. Approximation — doesn't track per-frame
 *    infusion state (Yoimiya burst infusing N hits, Cyno-stance, etc.);
 *    relies on the parser tagging infused N attacks with
 *    `kind: "elemental-normal"`.
 *  - `abilityName` includes the bow chargeHit-specific name when relevant
 *    (Wreath Arrow at C/C2 for Tighnari, Shadowpiercing Shot for Sethos)
 *    so `filter.abilityName: "Wreath Arrow"` matches via substring.
 *  - `isCrit: true` for optimistic-fire (filter v1 caveat).
 *  - `hitIndex` is left undefined (filter cases that need it — Chongyun C1
 *    N4-only, Kokomi A4 N3-final — require parser-side hitIndex tracking
 *    on the block, deferred). */
export function resolveBlockContext(
	char: CharacterData,
	block: InputBlock
): TriggerFilterContext | null {
	const tag = getBlockDamageTag(block);
	if (!tag) return null;
	const ability = char.abilities.find((a) => a.abilityType === 'normal');
	if (!ability) return null;
	const element: TriggerFilterContext['element'] =
		block.kind === 'elemental-normal'
			? (char.element as TriggerFilterContext['element'])
			: 'physical';
	const part = block.parts[0] ?? '';
	let abilityName = ability.name;
	const chargeHits = (ability as { chargeHits?: { name?: string }[] }).chargeHits;
	if (tag === 'charged' && chargeHits?.length) {
		const idx = part === 'C1' ? 0 : chargeHits.length - 1;
		const hitName = chargeHits[idx]?.name;
		if (hitName) abilityName = `${ability.name} ${hitName}`;
	}
	return {
		damageTag: tag,
		element,
		abilityName,
		isCrit: true
	};
}

/** The (ability, variant) pair backing a cast — the one the PARSE resolved.
 *
 *  ↻ 2026-09-19 (cast-binding round, §1.F): a `CastEvent` carries the resolved
 *  ability's `abilityId`, and this reads it. It used to take the unconditioned
 *  base ability whatever was cast, so a state-gated SIBLING was invisible here
 *  — Skirk's in-stance burst resolved to Havoc: Ruin, Clorinde's Impale the
 *  Night to Hunter's Vigil — and a trigger `filter.abilityName` on a cast hit
 *  could only ever name the base. ⚠️ No `abilityId` (a caller with no cast event
 *  in hand) falls back to the base, the old reading. */
function resolveCastPair(
	char: CharacterData,
	kind: 'skill' | 'burst',
	cast: { variantLabel?: string | null; abilityId?: string }
): { ability: Ability; variant: AbilityVariant | undefined } | null {
	const candidates = char.abilities.filter((a) => a.abilityType === kind);
	const ability =
		(cast.abilityId !== undefined ? candidates.find((a) => a.id === cast.abilityId) : undefined) ??
		candidates.find((a) => a.conditions === undefined) ??
		candidates[0];
	if (!ability) return null;
	// ⚓ THE PARSE ALREADY RESOLVED THE VARIANT, conditions included, and a
	// `CastEvent` carries it as `variantLabel` — ABSENT when the base cast (the
	// same reading `findSummonsForBar` takes through its `?? null`). ⛔ Never
	// fall back to an input match here: the press token is the same on Kujou
	// Sara's base E and her C2 variant, and an input match would take the
	// variant at C0. A caller with no cast event in hand has no business asking.
	const variant =
		cast.variantLabel == null
			? undefined
			: (ability as { variants?: AbilityVariant[] }).variants?.find(
					(v) => v.label === cast.variantLabel
				);
	return { ability, variant };
}

/** Did this cast land NO hit (non-hitting casts round, 2026-09-16)? The buff
 *  derivation asks it beside `resolveCastContext` at every site that anchors
 *  an `onHit skill|burst` effect on the cast event: such an effect on a
 *  non-hitting cast is dropped, an `onCast` one on the same cast is not. */
export function castLandsNoHit(
	char: CharacterData | null | undefined,
	kind: 'skill' | 'burst',
	cast: { variantLabel?: string | null; abilityId?: string }
): boolean {
	if (!char) return false;
	const pair = resolveCastPair(char, kind, cast);
	return pair ? castIsNonHitting(pair.ability, pair.variant) : false;
}

/** Resolves the (ability, variant) pair backing a cast so the G filter can
 *  evaluate against the cast's actual damageTag/element/name. Mirrors the
 *  resolution in `findCastSummon` — uses the unconditioned base ability and
 *  looks up the variant by matching label against variant.input.
 *
 *  The `cast` argument is a P4 `CastEvent`, accepted structurally as
 *  `{ label }` — the token text is the only field read here. */
export function resolveCastContext(
	char: CharacterData | null | undefined,
	kind: 'skill' | 'burst',
	cast: { label: string; variantLabel?: string | null; abilityId?: string }
): TriggerFilterContext | null {
	if (!char) return null;
	// ⚓ ONE resolution with `castLandsNoHit` beside it — the ability and variant
	// the parse resolved, never a second guess from the token.
	const pair = resolveCastPair(char, kind, cast);
	if (!pair) return null;
	const { ability, variant } = pair;
	const damageTag = getDefaultDamageTag(ability, variant as never);
	const variantLabel = variant?.label ? ` ${variant.label}` : '';
	return {
		damageTag,
		element: char.element as TriggerFilterContext['element'],
		abilityName: `${ability.name}${variantLabel}`,
		// Skill/burst single-hit casts have no hit index; default isCrit
		// to true (treat skill/burst snapshot as "crits expected" for
		// optimistic-fire semantics on isCrit:true filters).
		isCrit: true
	};
}

/** Same shape as `getCharacterEffectsForCast` but matching `afterDuration` triggers.
 *  Trigger matching mirrors `getCharacterEffectsForCast`: if `trigger.ability`
 *  is set, it must equal `castType`; otherwise the source's `abilityType`
 *  determines which host ability's duration binds the trigger. */
export function getCharacterEffectsForAfterDuration(
	char: CharacterData,
	cLevel: number,
	castType: 'skill' | 'burst',
	castLabel?: string,
	/** The RESOLVED cast ability's id — see `hostedElsewhere`. */
	castAbilityId?: string
): Effect[] {
	const sources = effectSourcesOf(char, cLevel);
	const result: Effect[] = [];
	for (const src of sources) {
		if (hostedElsewhere(src, castAbilityId)) continue;
		// Variant-resolved for SYMMETRY, not for a live case: no variant in the
		// corpus authors an afterDuration effect today. Leaving one of the three
		// cast-scoped collectors flat is how the next curator finds a gap the
		// hard way.
		for (const fx of effectsForCast(src, castLabel)) {
			if (fx.trigger.type !== 'afterDuration') continue;
			const explicit = fx.trigger.ability;
			if (explicit !== undefined) {
				if (explicit !== castType) continue;
			} else {
				if (src.abilityType !== castType) continue;
			}
			result.push(fx);
		}
	}
	return normalizeBuffLikeEffects(result);
}

/** Collects `onState` effects, grouped by the state they ride.
 *
 *  ⚓ An `onState` buff has no duration of its own — its span IS the state's
 *  window, which is why it is collected by state rather than by cast. Citlali
 *  C2 (+250 EM to the team while her Opal Shield holds) is the only author
 *  today, and it drew nothing at all until 2026-08-15 because no consumer
 *  matched the trigger. See docs/curation/orphaned-schema-audit.md. */
export function getCharacterEffectsForOnState(
	char: CharacterData,
	cLevel: number
): Map<string, Effect[]> {
	const byState = new Map<string, Effect[]>();
	for (const src of effectSourcesOf(char, cLevel)) {
		for (const fx of src.effects ?? []) {
			if (fx.trigger.type !== 'onState') continue;
			const state = (fx.trigger as { state: string }).state;
			const list = byState.get(state);
			if (list) list.push(fx);
			else byState.set(state, [fx]);
		}
	}
	for (const [state, list] of byState) byState.set(state, normalizeBuffLikeEffects(list));
	return byState;
}

/** Collects effects with `trigger.type === "onTeamNightsoulBurst"`. The trigger
 *  is global (fires on every team NB event in `nbBars`), so there's no per-cast
 *  filtering — just gather candidates. Source-agnostic; passives/constellations
 *  carry these triggers in practice (Mavuika A1, Varesa A4, Xilonen A2, Ifa A1). */
export function getCharacterEffectsForTeamNightsoulBurst(
	char: CharacterData,
	cLevel: number
): Effect[] {
	const sources = effectSourcesOf(char, cLevel);
	const result: Effect[] = [];
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.trigger.type !== 'onTeamNightsoulBurst') continue;
			result.push(fx);
		}
	}
	return normalizeBuffLikeEffects(result);
}

/** Collects effects with `trigger.type === "onStack"` — a stack-threshold
 *  fire's buffs, anchored by `buffWindows` on the parser's `stackThreshold`
 *  events the way NB buffs anchor on `nightsoulBurst` (stack-threshold round,
 *  2026-09-18). Constellation-gated like every collector here; the
 *  `dominant` gate is per EVENT and is applied at the anchor site. */
export function getCharacterEffectsForOnStack(char: CharacterData, cLevel: number): Effect[] {
	const sources = effectSourcesOf(char, cLevel);
	const result: Effect[] = [];
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.trigger.type !== 'onStack') continue;
			result.push(fx);
		}
	}
	return normalizeBuffLikeEffects(result);
}

/** Collects effects with `trigger.type === "onReaction"`. Source-agnostic;
 *  walks the full effect surface (abilities + passives + constellations).
 *  Pairs with the parser's `reaction` IR events — the dispatcher matches
 *  each event against `trigger.reaction` and the effect's `conditions` per
 *  cast at fire time. */
export function getCharacterEffectsForOnReaction(char: CharacterData, cLevel: number): Effect[] {
	const sources = effectSourcesOf(char, cLevel);
	const result: Effect[] = [];
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.trigger.type !== 'onReaction') continue;
			result.push(fx);
		}
	}
	return normalizeBuffLikeEffects(result);
}
