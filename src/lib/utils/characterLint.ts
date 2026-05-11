/**
 * src/lib/utils/characterLint.ts
 *
 * Curation lint for character JSONs. Run via vitest in characterLint.test.ts.
 *
 * Scope: only curated characters (heuristic: has frames on normal hits[] AND
 * frames on the skill ability). Uncurated stubs are skipped — they don't
 * conform to the strict shape and would drown the output.
 *
 * Severity:
 *   - "strict" issues fail the test
 *   - "warn"   issues are reported via console.warn but pass the test
 */

import type { CharacterData } from '$lib/types/character';
import type {
	Ability,
	AbilityVariant,
	Condition,
	Effect,
	NormalAbility,
	SkillAbility,
	BurstAbility
} from '$lib/types/ability';

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

export type Severity = 'strict' | 'warn';

export type LintIssue = {
	severity: Severity;
	check: string;
	charId: string;
	abilityId?: string;
	message: string;
};

// ---------------------------------------------------------------------------
// Vocabulary sets — kept aligned with src/lib/types/ability.ts
// ---------------------------------------------------------------------------

/** The 7 character-assignable elements. Used for character.element,
 *  NormalAbility.infusion, and the `infuse` Effect — Physical is not a
 *  valid character element. */
const CHARACTER_ELEMENTS = new Set(['anemo', 'cryo', 'dendro', 'electro', 'geo', 'hydro', 'pyro']);

/** All damage-tagging elements, including Physical. Used for `damage` and
 *  `resShred` Effect element fields where Physical is valid (e.g. Rosaria C6,
 *  Razor's Physical N hits). */
const DAMAGE_ELEMENTS = new Set([...CHARACTER_ELEMENTS, 'physical']);

/** Elements that can leave a persistent aura on enemies. Used by the
 *  `enemyAffectedBy` condition. Anemo / Geo / Physical excluded — they never
 *  persist as a lasting enemy aura in-game. */
const AURA_ELEMENTS = new Set(['cryo', 'dendro', 'electro', 'hydro', 'pyro']);

const REACTIONS = new Set([
	'vaporize',
	'overloaded',
	'melt',
	'burning',
	'swirl',
	'crystallize',
	'lunarCrystallize',
	'electroCharged',
	'lunarCharged',
	'frozen',
	'shatter',
	'bloom',
	'lunarBloom',
	'burgeon',
	'hyperbloom',
	'superConduct',
	'quicken',
	'spread',
	'aggravate'
]);

const STATS = new Set([
	'atk',
	'baseAtk',
	'em',
	'hp',
	'def',
	'critRate',
	'critDmg',
	'atk%',
	'hp%',
	'def%',
	'allDmgBonus',
	'anemoDmgBonus',
	'cryoDmgBonus',
	'dendroDmgBonus',
	'electroDmgBonus',
	'geoDmgBonus',
	'hydroDmgBonus',
	'pyroDmgBonus',
	'lunarDmgBonus',
	'lunarChargedDmgBonus',
	'lunarBloomDmgBonus',
	'lunarCrystallizeDmgBonus',
	'skillDmgBonus',
	'burstDmgBonus',
	'normalDmgBonus',
	'chargeDmgBonus',
	'plungeDmgBonus',
	'cdReduction',
	'healingBonus',
	'incomingHealingBonus',
	'anemoRes',
	'cryoRes',
	'dendroRes',
	'electroRes',
	'geoRes',
	'hydroRes',
	'pyroRes',
	'physicalRes',
	'allElementalRes',
	'anemoCritDmg',
	'cryoCritDmg',
	'dendroCritDmg',
	'electroCritDmg',
	'geoCritDmg',
	'hydroCritDmg',
	'pyroCritDmg',
	'normalFlatDmg',
	'chargeFlatDmg',
	'plungeFlatDmg',
	'skillFlatDmg',
	'burstFlatDmg',
	'lunarCrystallizeFlatDmg'
]);

const SCALING_STATS = new Set(['atk', 'baseAtk', 'em', 'hp', 'def', 'healingBonus']);

const TARGETS = new Set(['self', 'team', 'teamExcludingSelf', 'active', 'next', 'enemy']);

const STATES = new Set([
	'afterNormalAttack',
	'afterSkill',
	'afterBurst',
	'afterDurationEnds',
	'shielded',
	'onField',
	'offField',
	'duringSummon',
	'nightsoulBlessing',
	'inStance'
]);

const ABILITY_TYPES = new Set(['normal', 'skill', 'burst', 'passive', 'constellation']);
const BEHAVIORS = new Set(['instant', 'persistent', 'stance']);
const SUMMON_TERMINATES = new Set(['swap', 'recast']);
const DAMAGE_TAGS = new Set(['normal', 'charged', 'plunge', 'skill', 'skillHold', 'burst']);

const ID_PATTERN = /^[a-z][a-z0-9_]*__(normal|skill|burst|passive|constellation)__[a-z0-9_]+$/;

const IMPL_PHRASES = [
	'TODO',
	'todo:',
	'not modeled',
	'not modelled',
	'see curator',
	'see _curator'
];

// ---------------------------------------------------------------------------
// Curation heuristic
// ---------------------------------------------------------------------------

/** Curated characters have frames on normal hits[] AND frames on the skill ability. */
export function isCurated(c: CharacterData): boolean {
	const normal = c.abilities.find((a) => a.abilityType === 'normal') as NormalAbility | undefined;
	const skill = c.abilities.find((a) => a.abilityType === 'skill') as SkillAbility | undefined;
	if (!normal || !skill) return false;
	if (!normal.hits?.length) return false;
	const firstHitFrames = normal.hits[0]?.frames;
	if (!firstHitFrames || typeof firstHitFrames.swap !== 'number') return false;
	const skillFrames = (skill as { frames?: { swap?: unknown } }).frames;
	if (!skillFrames || typeof skillFrames.swap !== 'number') return false;
	return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPositiveInt(v: unknown): v is number {
	return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function isPositiveNumber(v: unknown): v is number {
	return typeof v === 'number' && v > 0 && Number.isFinite(v);
}

function walkConditions(cond: Condition | undefined, fn: (c: Condition) => void): void {
	if (!cond) return;
	fn(cond);
	if (cond.type === 'not') walkConditions(cond.condition, fn);
	if (cond.type === 'all' || cond.type === 'any') {
		for (const c of cond.conditions) walkConditions(c, fn);
	}
}

function abilityHasStanceBehavior(c: CharacterData): boolean {
	for (const a of c.abilities) {
		if ((a.abilityType === 'skill' || a.abilityType === 'burst') && a.behavior === 'stance') {
			return true;
		}
		const variants = (a as { variants?: AbilityVariant[] }).variants;
		if (variants?.some((v) => v.behavior === 'stance')) return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Per-character lint
// ---------------------------------------------------------------------------

export function lintCharacter(c: CharacterData): LintIssue[] {
	const issues: LintIssue[] = [];
	const push = (sev: Severity, check: string, message: string, abilityId?: string) =>
		issues.push({ severity: sev, check, charId: c.id, abilityId, message });

	// (E.26) at least one normal + at least one of skill|burst
	const hasNormal = c.abilities.some((a) => a.abilityType === 'normal');
	const hasSkillOrBurst = c.abilities.some(
		(a) => a.abilityType === 'skill' || a.abilityType === 'burst'
	);
	if (!hasNormal) push('strict', 'missing-normal', 'character has no normal-attack ability');
	if (!hasSkillOrBurst)
		push('warn', 'missing-cast-ability', 'character has no skill or burst ability');

	// (A.6) id uniqueness
	const idsSeen = new Set<string>();
	for (const a of c.abilities) {
		if (idsSeen.has(a.id)) push('strict', 'duplicate-id', `duplicate ability id`, a.id);
		idsSeen.add(a.id);
	}

	// (C.16) factions ↔ factionBonuses bidirectional
	const factions = c.factions ?? [];
	const factionBonuses = c.factionBonuses ?? [];
	if (factions.length > 0 && factionBonuses.length === 0) {
		push(
			'warn',
			'faction-without-bonus',
			`factions=${JSON.stringify(factions)} but no factionBonuses authored`
		);
	}
	for (const fb of factionBonuses) {
		if (!factions.includes(fb.faction)) {
			push(
				'strict',
				'faction-bonus-orphan',
				`factionBonuses[].faction "${fb.faction}" not declared in factions[]`
			);
		}
	}

	// Per-ability checks
	const allAbilities: Ability[] = [...c.abilities, ...c.passives, ...c.constellations];
	for (const a of allAbilities) {
		lintAbility(c, a, push);
	}

	// (C.18) inStance condition only on characters with a stance-bearing ability
	const stanceBearer = abilityHasStanceBehavior(c);
	if (!stanceBearer) {
		for (const a of allAbilities) {
			let referencesInStance = false;
			walkConditions(a.conditions, (cond) => {
				if (cond.type === 'state' && cond.state === 'inStance') referencesInStance = true;
			});
			if (referencesInStance) {
				push(
					'warn',
					'instance-overload',
					'inStance condition used on character with no stance-bearing ability (P2 migration target)',
					a.id
				);
			}
		}
	}

	// FactionBonus effects also need linting
	for (const fb of factionBonuses) {
		for (const eff of fb.effects ?? []) {
			lintEffect(c, `factionBonuses[${fb.faction}]`, eff, push, {
				isPassiveOrConstellation: false
			});
		}
	}

	return issues;
}

function lintAbility(
	c: CharacterData,
	a: Ability,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void
): void {
	// (A.1) abilityType discriminator
	if (!ABILITY_TYPES.has(a.abilityType)) {
		push('strict', 'invalid-ability-type', `unknown abilityType "${a.abilityType}"`, a.id);
		return; // bail; downstream checks assume valid type
	}

	// (A.7) id pattern match
	if (!ID_PATTERN.test(a.id)) {
		push('strict', 'id-pattern', `id does not match pattern <charId>__<type>__<snake_name>`, a.id);
	} else if (!a.id.startsWith(`${c.id}__`)) {
		push('strict', 'id-pattern', `id prefix does not match character id "${c.id}"`, a.id);
	}

	// (E.23) _curatorNotes is array
	const cn = (a as { _curatorNotes?: unknown })._curatorNotes;
	if (cn !== undefined && !Array.isArray(cn)) {
		push('strict', 'curator-notes-shape', `_curatorNotes must be an array of strings`, a.id);
	}

	// (E.24) caveat non-empty when present
	const caveat = (a as { caveat?: unknown }).caveat;
	if (caveat !== undefined && (typeof caveat !== 'string' || caveat.trim().length === 0)) {
		push('strict', 'empty-caveat', `caveat is present but empty`, a.id);
	}

	// (E.25) description doesn't contain implementation phrases
	const desc = (a as { description?: unknown }).description;
	if (typeof desc === 'string') {
		const lower = desc.toLowerCase();
		for (const phrase of IMPL_PHRASES) {
			if (lower.includes(phrase.toLowerCase())) {
				push(
					'warn',
					'description-impl-leak',
					`description contains implementation phrase: "${phrase}" — move to caveat or _curatorNotes`,
					a.id
				);
				break;
			}
		}
	}

	// Per-type checks
	switch (a.abilityType) {
		case 'normal':
			lintNormal(a, push);
			break;
		case 'skill':
		case 'burst':
			lintCastAbility(a, push);
			lintSummonEffects(c, a, push);
			break;
		case 'passive':
		case 'constellation':
			// Effects on passive/constellation are linted below with isPassiveOrConstellation: true
			break;
	}

	// Validate any conditions on the ability itself (e.g. an in-stance variant
	// gated by `state: "inStance"` or a stack-loaded variant gated by `stacks`).
	walkConditions(a.conditions, (cond) => {
		if (cond.type === 'state' && !STATES.has(cond.state)) {
			push('strict', 'invalid-state', `unknown state "${cond.state}" on ability conditions`, a.id);
		}
		if (
			cond.type === 'enemyHpBelow' &&
			(typeof cond.threshold !== 'number' ||
				!Number.isFinite(cond.threshold) ||
				cond.threshold <= 0 ||
				cond.threshold > 100)
		) {
			push(
				'strict',
				'enemy-hp-below-threshold-invalid',
				`enemyHpBelow.threshold must be a number in (0, 100] on ability conditions (got ${JSON.stringify(cond.threshold)})`,
				a.id
			);
		}
		if (
			cond.type === 'enemyAffectedBy' &&
			(typeof cond.element !== 'string' || !AURA_ELEMENTS.has(cond.element))
		) {
			push(
				'strict',
				'enemy-affected-by-element-invalid',
				`enemyAffectedBy.element must be one of cryo/dendro/electro/hydro/pyro on ability conditions (got ${JSON.stringify(cond.element)})`,
				a.id
			);
		}
		if (
			(cond.type === 'selfHpBelow' || cond.type === 'selfHpAbove') &&
			(typeof cond.threshold !== 'number' ||
				!Number.isFinite(cond.threshold) ||
				cond.threshold <= 0 ||
				cond.threshold > 100)
		) {
			push(
				'strict',
				'self-hp-threshold-invalid',
				`${cond.type}.threshold must be a number in (0, 100] on ability conditions (got ${JSON.stringify(cond.threshold)})`,
				a.id
			);
		}
		if (cond.type === 'stacks') {
			if (typeof cond.key !== 'string' || cond.key.length === 0) {
				push(
					'strict',
					'stacks-key-invalid',
					`stacks condition has invalid key on ability conditions`,
					a.id
				);
			}
			if (!Number.isInteger(cond.min) || cond.min < 0) {
				push(
					'strict',
					'stacks-min-invalid',
					`stacks condition min must be a non-negative integer on ability conditions (got ${cond.min})`,
					a.id
				);
			}
			if (cond.max !== undefined && (!Number.isInteger(cond.max) || cond.max < cond.min)) {
				push(
					'strict',
					'stacks-max-invalid',
					`stacks condition max must be an integer ≥ min on ability conditions (got max=${cond.max}, min=${cond.min})`,
					a.id
				);
			}
		}
	});

	// Effects
	const isPC = a.abilityType === 'passive' || a.abilityType === 'constellation';
	for (const eff of a.effects ?? []) {
		lintEffect(c, a.id, eff, push, { isPassiveOrConstellation: isPC });
		// (D.28) summonTick trigger only valid inside summons[].effects[]
		if (eff.trigger.type === 'summonTick') {
			push(
				'strict',
				'summon-tick-misplaced',
				`summonTick trigger only valid inside summons[].effects[]; found on ability/passive/constellation effect`,
				a.id
			);
		}
	}

	// Variant effects + per-variant damageTag override
	const variants = (a as { variants?: AbilityVariant[] }).variants;
	if (variants) {
		for (const v of variants) {
			if (v.damageTag !== undefined && !DAMAGE_TAGS.has(v.damageTag)) {
				push(
					'strict',
					'damageTag-invalid',
					`variant "${v.label}".damageTag "${v.damageTag}" is not a valid DamageTag`,
					a.id
				);
			}
			for (const eff of v.effects ?? []) {
				lintEffect(c, `${a.id} variant "${v.label}"`, eff, push, {
					isPassiveOrConstellation: false
				});
			}
		}
	}
}

function lintNormal(
	a: NormalAbility,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void
): void {
	// (A.3) non-empty hits[]
	if (!a.hits?.length) {
		push('strict', 'normal-empty-hits', 'normal ability has empty or missing hits[]', a.id);
		return;
	}

	// (A.5) FrameMap values positive integers; swap required
	for (let i = 0; i < a.hits.length; i++) {
		const fm = a.hits[i].frames;
		if (!fm) {
			push('strict', 'missing-frames', `hits[${i}].frames is missing`, a.id);
			continue;
		}
		if (!isPositiveInt(fm.swap)) {
			push(
				'strict',
				'missing-swap',
				`hits[${i}].frames.swap missing or not a positive integer`,
				a.id
			);
		}
		for (const [k, v] of Object.entries(fm)) {
			if (v !== undefined && !isPositiveInt(v)) {
				push(
					'strict',
					'frame-value-invalid',
					`hits[${i}].frames.${k} is not a positive integer (got ${JSON.stringify(v)})`,
					a.id
				);
			}
		}
		// (D.33) per-hit damageTag override valid (G primitive)
		const tag = a.hits[i].damageTag;
		if (tag !== undefined && !DAMAGE_TAGS.has(tag)) {
			push(
				'strict',
				'damageTag-invalid',
				`hits[${i}].damageTag "${tag}" is not a valid DamageTag`,
				a.id
			);
		}
	}

	// (A.4) chargeFrames vs chargeHits mutually exclusive
	if (a.chargeFrames && a.chargeHits) {
		push(
			'strict',
			'charge-mutex',
			'chargeFrames and chargeHits are both present (mutually exclusive)',
			a.id
		);
	}

	// chargeFrames frame values
	if (a.chargeFrames) {
		if (!isPositiveInt(a.chargeFrames.swap)) {
			push('strict', 'missing-swap', `chargeFrames.swap missing or not a positive integer`, a.id);
		}
		for (const [k, v] of Object.entries(a.chargeFrames)) {
			if (v !== undefined && !isPositiveInt(v)) {
				push('strict', 'frame-value-invalid', `chargeFrames.${k} is not a positive integer`, a.id);
			}
		}
	}

	// chargeHits frame values
	if (a.chargeHits) {
		for (let i = 0; i < a.chargeHits.length; i++) {
			const fm = a.chargeHits[i].frames;
			if (!fm) {
				push('strict', 'missing-frames', `chargeHits[${i}].frames is missing`, a.id);
				continue;
			}
			if (!isPositiveInt(fm.swap)) {
				push(
					'strict',
					'missing-swap',
					`chargeHits[${i}].frames.swap missing or not a positive integer`,
					a.id
				);
			}
			for (const [k, v] of Object.entries(fm)) {
				if (v !== undefined && !isPositiveInt(v)) {
					push(
						'strict',
						'frame-value-invalid',
						`chargeHits[${i}].frames.${k} is not a positive integer`,
						a.id
					);
				}
			}
			const tag = a.chargeHits[i].damageTag;
			if (tag !== undefined && !DAMAGE_TAGS.has(tag)) {
				push(
					'strict',
					'damageTag-invalid',
					`chargeHits[${i}].damageTag "${tag}" is not a valid DamageTag`,
					a.id
				);
			}
		}
	}

	// plungeFrames
	if (a.plungeFrames) {
		if (!isPositiveInt(a.plungeFrames.swap)) {
			push('strict', 'missing-swap', `plungeFrames.swap missing or not a positive integer`, a.id);
		}
	}

	// (C.19) infusion is valid Element
	if (a.infusion !== undefined && !CHARACTER_ELEMENTS.has(a.infusion)) {
		push('strict', 'invalid-element', `infusion "${a.infusion}" is not a valid Element`, a.id);
	}
}

function lintCastAbility(
	a: SkillAbility | BurstAbility,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void
): void {
	// (A.2) behavior valid
	if (!BEHAVIORS.has(a.behavior)) {
		push('strict', 'invalid-behavior', `unknown behavior "${a.behavior}"`, a.id);
		return;
	}

	// (A.3) frames present with swap; (A.5) values positive integers
	if (!a.frames) {
		push('strict', 'missing-frames', 'skill/burst missing frames map', a.id);
	} else {
		if (!isPositiveInt(a.frames.swap)) {
			push('strict', 'missing-swap', 'frames.swap missing or not a positive integer', a.id);
		}
		for (const [k, v] of Object.entries(a.frames)) {
			if (v !== undefined && !isPositiveInt(v)) {
				push(
					'strict',
					'frame-value-invalid',
					`frames.${k} is not a positive integer (got ${JSON.stringify(v)})`,
					a.id
				);
			}
		}
	}

	// (A.3) cooldown positive
	if (!isPositiveNumber(a.cooldown) && a.cooldown !== 0) {
		push('strict', 'invalid-cooldown', `cooldown must be a non-negative number`, a.id);
	}

	// (A.3) burst energyCost
	if (a.abilityType === 'burst') {
		if (!isPositiveInt(a.energyCost)) {
			push('strict', 'invalid-energy-cost', `burst energyCost must be a positive integer`, a.id);
		}
	}

	// (A.3) persistent/stance: duration required when no summons[]
	if (a.behavior === 'persistent' || a.behavior === 'stance') {
		const hasSummons = !!a.summons?.length;
		if (!hasSummons && !isPositiveNumber(a.duration)) {
			push(
				'strict',
				'missing-duration',
				`${a.behavior} ability without summons[] requires positive duration`,
				a.id
			);
		}
	}

	// (D.20) stance: terminatesOnSwap explicit
	if (a.behavior === 'stance') {
		if (a.terminatesOnSwap === undefined) {
			push(
				'strict',
				'stance-terminates-implicit',
				'stance ability must set terminatesOnSwap explicitly (true or false)',
				a.id
			);
		}
	}

	// (D.33) durationExtensions[] only valid on stance behavior
	const baseExts = (a as { durationExtensions?: unknown }).durationExtensions;
	if (baseExts !== undefined && a.behavior !== 'stance') {
		push(
			'strict',
			'durationext-non-stance',
			'durationExtensions[] can only be authored on stance abilities',
			a.id
		);
	}
	if (a.behavior === 'stance' && a.durationExtensions) {
		lintDurationExtensions(a.durationExtensions, a.id, a.id, push);
	}
	for (const v of a.variants ?? []) {
		if (v.durationExtensions) {
			lintDurationExtensions(v.durationExtensions, `${a.id} variant "${v.label}"`, a.id, push);
		}
	}

	// (D.22) summons[].terminatesOn valid
	for (const s of a.summons ?? []) {
		if (s.terminatesOn !== undefined && !SUMMON_TERMINATES.has(s.terminatesOn)) {
			push(
				'strict',
				'summon-terminates-invalid',
				`summon "${s.label}" has invalid terminatesOn "${s.terminatesOn}"`,
				a.id
			);
		}
		if (!isPositiveNumber(s.duration)) {
			push(
				'strict',
				'summon-duration-invalid',
				`summon "${s.label}" has invalid duration ${s.duration}`,
				a.id
			);
		}
	}
}

/** Lint summon effects (P3 — Summon.effects[]). Walks each summon owned by a
 *  cast ability and validates its effects with the same rules as ability
 *  effects, plus summonTick-specific checks. */
function lintSummonEffects(
	c: CharacterData,
	a: SkillAbility | BurstAbility,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void
): void {
	for (const s of a.summons ?? []) {
		for (const eff of s.effects ?? []) {
			const location = `${a.id} summon "${s.label}"`;
			lintEffect(c, location, eff, push, { isPassiveOrConstellation: false });

			// (D.27) summonTick interval positive
			if (eff.trigger.type === 'summonTick') {
				if (!isPositiveNumber(eff.trigger.interval)) {
					push(
						'strict',
						'summon-tick-interval-invalid',
						`summonTick effect on summon "${s.label}" requires positive interval (got ${eff.trigger.interval})`,
						a.id
					);
				}
				if (eff.trigger.firstTickDelay !== undefined && eff.trigger.firstTickDelay < 0) {
					push(
						'strict',
						'summon-tick-delay-invalid',
						`summonTick effect on summon "${s.label}" has negative firstTickDelay (${eff.trigger.firstTickDelay})`,
						a.id
					);
				}
			}
		}

		// (D.33) durationExtensions[] on summons
		if (s.durationExtensions) {
			lintDurationExtensions(s.durationExtensions, `${a.id} summon "${s.label}"`, a.id, push);
		}
	}
}

/** Validates a DurationExtension[] array authored on a stance ability or a
 *  summon. Each entry needs a positive `delta`, valid `maxExtensions`/
 *  `procCooldown` shape, and a recognized `trigger.type` (with reaction list
 *  validity for onReaction triggers). Conditions are walked for state-name +
 *  stacks-shape validity, mirroring ability-level condition lint.
 *
 *  Emits a warn when the trigger.type isn't `onCast` to flag that the entry
 *  is schema-only (the parser doesn't dispatch other trigger types yet). */
function lintDurationExtensions(
	exts: import('$lib/types/ability').DurationExtension[],
	location: string,
	abilityId: string,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void
): void {
	for (let i = 0; i < exts.length; i++) {
		const ext = exts[i];
		const where = `${location} durationExtensions[${i}]`;

		if (typeof ext.delta !== 'number' || ext.delta <= 0 || !Number.isFinite(ext.delta)) {
			push(
				'strict',
				'durationext-delta-invalid',
				`${where} delta must be a positive finite number (seconds), got ${JSON.stringify(ext.delta)}`,
				abilityId
			);
		}
		if (ext.maxExtensions !== undefined) {
			if (!Number.isInteger(ext.maxExtensions) || ext.maxExtensions <= 0) {
				push(
					'strict',
					'durationext-maxextensions-invalid',
					`${where} maxExtensions must be a positive integer, got ${JSON.stringify(ext.maxExtensions)}`,
					abilityId
				);
			}
		}
		if (ext.procCooldown !== undefined) {
			if (typeof ext.procCooldown !== 'number' || ext.procCooldown < 0) {
				push(
					'strict',
					'durationext-proccd-invalid',
					`${where} procCooldown must be a non-negative number (seconds), got ${JSON.stringify(ext.procCooldown)}`,
					abilityId
				);
			}
		}

		const trig = ext.trigger;
		if (!trig || typeof trig !== 'object' || typeof trig.type !== 'string') {
			push('strict', 'durationext-trigger-invalid', `${where} missing trigger.type`, abilityId);
			continue;
		}

		// onReaction reaction list validity (mirrors B.12)
		if (trig.type === 'onReaction') {
			const r = trig.reaction;
			const reactions = Array.isArray(r) ? r : [r];
			for (const rx of reactions) {
				if (rx !== 'any' && !REACTIONS.has(rx)) {
					push(
						'strict',
						'durationext-reaction-invalid',
						`${where} unknown reaction "${rx}"`,
						abilityId
					);
				}
			}
		}

		// Flag triggers other than onCast/onReaction as warn — parser dispatch
		// for those is not yet wired; authoring is schema-only until the
		// relevant event hook lands. onCast (E5 v1) and onReaction (E3 v1.5,
		// 2026-05-10) both dispatch today.
		if (trig.type !== 'onCast' && trig.type !== 'onReaction') {
			push(
				'warn',
				'durationext-trigger-deferred',
				`${where} trigger.type "${trig.type}" is schema-accepted but parser dispatch is not yet wired (only onCast and onReaction fire extensions today)`,
				abilityId
			);
		}

		// Walk conditions for state/stacks shape — same checks as ability conditions
		walkConditions(ext.conditions, (cond) => {
			if (cond.type === 'state' && !STATES.has(cond.state)) {
				push(
					'strict',
					'durationext-condition-state-invalid',
					`${where} unknown state "${cond.state}" in conditions`,
					abilityId
				);
			}
			if (
				cond.type === 'enemyHpBelow' &&
				(typeof cond.threshold !== 'number' ||
					!Number.isFinite(cond.threshold) ||
					cond.threshold <= 0 ||
					cond.threshold > 100)
			) {
				push(
					'strict',
					'durationext-enemy-hp-below-invalid',
					`${where} enemyHpBelow.threshold must be a number in (0, 100] (got ${JSON.stringify(cond.threshold)})`,
					abilityId
				);
			}
			if (
				cond.type === 'enemyAffectedBy' &&
				(typeof cond.element !== 'string' || !AURA_ELEMENTS.has(cond.element))
			) {
				push(
					'strict',
					'durationext-enemy-affected-by-invalid',
					`${where} enemyAffectedBy.element must be one of cryo/dendro/electro/hydro/pyro (got ${JSON.stringify(cond.element)})`,
					abilityId
				);
			}
			if (
				(cond.type === 'selfHpBelow' || cond.type === 'selfHpAbove') &&
				(typeof cond.threshold !== 'number' ||
					!Number.isFinite(cond.threshold) ||
					cond.threshold <= 0 ||
					cond.threshold > 100)
			) {
				push(
					'strict',
					'durationext-self-hp-threshold-invalid',
					`${where} ${cond.type}.threshold must be a number in (0, 100] (got ${JSON.stringify(cond.threshold)})`,
					abilityId
				);
			}
			if (cond.type === 'stacks') {
				if (typeof cond.key !== 'string' || cond.key.length === 0) {
					push(
						'strict',
						'durationext-stacks-key-invalid',
						`${where} stacks condition has invalid key`,
						abilityId
					);
				}
				if (!Number.isInteger(cond.min) || cond.min < 0) {
					push(
						'strict',
						'durationext-stacks-min-invalid',
						`${where} stacks min must be a non-negative integer (got ${cond.min})`,
						abilityId
					);
				}
			}
		});
	}
}

function lintEffect(
	_c: CharacterData,
	location: string,
	eff: Effect,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void,
	ctx: { isPassiveOrConstellation: boolean }
): void {
	// (B.8) effects on passive/constellation with onCast/afterDuration must set trigger.ability
	if (ctx.isPassiveOrConstellation) {
		const t = eff.trigger;
		if ((t.type === 'onCast' || t.type === 'afterDuration') && !t.ability) {
			push(
				'warn',
				'trigger-ability-missing',
				`effect on passive/constellation with trigger ${t.type} should set trigger.ability (omit only when intentionally firing on both skill and burst, like Kazuha C6)`,
				location
			);
		}
	}

	// (B.9) procCooldown not on passive trigger
	if (eff.trigger.type === 'passive' && eff.procCooldown !== undefined) {
		push(
			'strict',
			'proc-cooldown-on-passive',
			'procCooldown is meaningless on a passive trigger',
			location
		);
	}

	// (B.10) cdReset has source: weapon | character
	if (eff.type === 'cdReset' && eff.source !== 'weapon' && eff.source !== 'character') {
		push(
			'strict',
			'cdreset-source',
			`cdReset effect must have source: "weapon" or "character"`,
			location
		);
	}
	if (eff.type === 'cdReset' && eff.trigger.type !== 'onCast') {
		push('strict', 'cdreset-trigger', `cdReset effect must have trigger.type: "onCast"`, location);
	}
	if (
		eff.type === 'cdReset' &&
		eff.trigger.type === 'onCast' &&
		eff.trigger.ability === undefined
	) {
		push(
			'strict',
			'cdreset-ability',
			`cdReset effect must specify trigger.ability ("skill" or "burst") to indicate which CD is reset`,
			location
		);
	}

	// (B.10b) cooldownReduce shape
	if (eff.type === 'cooldownReduce') {
		if (eff.source !== 'character') {
			push(
				'strict',
				'cooldownreduce-source',
				`cooldownReduce effect must have source: "character"`,
				location
			);
		}
		if (typeof eff.amount !== 'number' || eff.amount <= 0) {
			push(
				'strict',
				'cooldownreduce-amount',
				`cooldownReduce effect must have amount: positive number (seconds)`,
				location
			);
		}
		if (eff.trigger.type === 'onCast' && eff.trigger.ability === undefined) {
			push(
				'strict',
				'cooldownreduce-ability',
				`cooldownReduce effect on onCast trigger must specify trigger.ability ("skill" or "burst")`,
				location
			);
		}
	}

	// (B.11) target valid
	const targets = Array.isArray(eff.target) ? eff.target : [eff.target];
	for (const t of targets) {
		if (!TARGETS.has(t)) {
			push('strict', 'invalid-target', `unknown target "${t}"`, location);
		}
	}

	// (B.12) onReaction valid
	if (eff.trigger.type === 'onReaction') {
		const r = eff.trigger.reaction;
		const reactions = Array.isArray(r) ? r : [r];
		for (const rx of reactions) {
			if (rx !== 'any' && !REACTIONS.has(rx)) {
				push('strict', 'invalid-reaction', `unknown reaction "${rx}"`, location);
			}
		}
		const src = (eff.trigger as { source?: string }).source;
		if (src !== undefined && src !== 'self' && src !== 'team') {
			push(
				'strict',
				'invalid-reaction-source',
				`onReaction trigger source must be 'self' or 'team' (got ${JSON.stringify(src)})`,
				location
			);
		}
	}

	// (D.32) onHit TriggerFilter shape — G primitive
	if (eff.trigger.type === 'onHit' && eff.trigger.filter !== undefined) {
		const f = eff.trigger.filter as Record<string, unknown>;
		if (
			f.damageTag !== undefined &&
			(typeof f.damageTag !== 'string' || !DAMAGE_TAGS.has(f.damageTag as string))
		) {
			push(
				'strict',
				'filter-damageTag-invalid',
				`onHit filter has invalid damageTag "${JSON.stringify(f.damageTag)}"`,
				location
			);
		}
		if (
			f.element !== undefined &&
			(typeof f.element !== 'string' || !DAMAGE_ELEMENTS.has(f.element as string))
		) {
			push(
				'strict',
				'filter-element-invalid',
				`onHit filter has invalid element "${JSON.stringify(f.element)}"`,
				location
			);
		}
		if (f.abilityName !== undefined) {
			if (typeof f.abilityName !== 'string' || (f.abilityName as string).length === 0) {
				push(
					'strict',
					'filter-abilityName-invalid',
					`onHit filter abilityName must be a non-empty string`,
					location
				);
			}
		}
		if (f.hitIndex !== undefined) {
			if (
				typeof f.hitIndex !== 'number' ||
				!Number.isInteger(f.hitIndex) ||
				(f.hitIndex as number) < 0
			) {
				push(
					'strict',
					'filter-hitIndex-invalid',
					`onHit filter hitIndex must be a non-negative integer (got ${JSON.stringify(f.hitIndex)})`,
					location
				);
			}
		}
		if (f.isCrit !== undefined && typeof f.isCrit !== 'boolean') {
			push(
				'strict',
				'filter-isCrit-invalid',
				`onHit filter isCrit must be a boolean (got ${JSON.stringify(f.isCrit)})`,
				location
			);
		}
	}

	// (B.13) buff stat / damage|heal|shield stat valid
	if (eff.type === 'buff') {
		if (!STATS.has(eff.stat)) {
			push('strict', 'invalid-stat', `unknown buff stat "${eff.stat}"`, location);
		}
	} else if (eff.type === 'damage' || eff.type === 'heal' || eff.type === 'shield') {
		if (!SCALING_STATS.has(eff.stat)) {
			push(
				'strict',
				'invalid-scaling-stat',
				`unknown ${eff.type} scaling stat "${eff.stat}"`,
				location
			);
		}
	}

	// (B.13b) elevate reactions valid
	if (eff.type === 'elevate') {
		if (!Array.isArray(eff.reactions) || eff.reactions.length === 0) {
			push(
				'strict',
				'elevate-reactions-empty',
				`elevate effect must have a non-empty reactions array`,
				location
			);
		} else {
			for (const rx of eff.reactions) {
				if (!REACTIONS.has(rx)) {
					push(
						'strict',
						'elevate-reaction-invalid',
						`elevate reaction "${rx}" is not a valid Reaction`,
						location
					);
				}
			}
		}
		if (typeof eff.snapshottable !== 'boolean') {
			push(
				'strict',
				'elevate-snapshottable-missing',
				`elevate effect must have snapshottable: boolean`,
				location
			);
		}
	}

	// (B.13c) gainStacks shape — non-empty key, positive integer amount,
	// max ≥ 1 when present, onCast trigger required (v1 dispatch only fires
	// onCast — onReaction / onHit triggers schema-accepted but ignored).
	if (eff.type === 'gainStacks') {
		if (typeof eff.key !== 'string' || eff.key.length === 0) {
			push(
				'strict',
				'gainstacks-key-invalid',
				`gainStacks effect must have a non-empty string key`,
				location
			);
		}
		if (typeof eff.amount !== 'number' || !Number.isFinite(eff.amount) || eff.amount <= 0) {
			push(
				'strict',
				'gainstacks-amount-invalid',
				`gainStacks effect amount must be a positive finite number (got ${JSON.stringify(eff.amount)})`,
				location
			);
		}
		if (eff.max !== undefined) {
			if (
				typeof eff.max !== 'number' ||
				!Number.isFinite(eff.max) ||
				!Number.isInteger(eff.max) ||
				(eff.max as number) <= 0
			) {
				push(
					'strict',
					'gainstacks-max-invalid',
					`gainStacks effect max must be a positive integer when present (got ${JSON.stringify(eff.max)})`,
					location
				);
			}
		}
		if (eff.trigger.type !== 'onCast' && eff.trigger.type !== 'onReaction' && eff.trigger.type !== 'onHit') {
			push(
				'strict',
				'gainstacks-trigger-invalid',
				`gainStacks effect trigger.type must be one of "onCast", "onReaction", or "onHit" (got "${eff.trigger.type}")`,
				location
			);
		}
		// (B.13d) gainStacks onCast trigger.input — when present must be a
		// non-empty string array (each entry an ability token like "E" or "hE").
		if (eff.trigger.type === 'onCast' && eff.trigger.input !== undefined) {
			const inputs = eff.trigger.input as unknown;
			if (!Array.isArray(inputs) || inputs.length === 0 || inputs.some((s) => typeof s !== 'string' || s.length === 0)) {
				push(
					'strict',
					'gainstacks-trigger-input-invalid',
					`gainStacks trigger.input must be a non-empty array of ability-token strings (got ${JSON.stringify(eff.trigger.input)})`,
					location
				);
			}
		}
		if (eff.drain !== undefined) {
			const d = eff.drain;
			if (
				typeof d.ratePerSecond !== 'number' ||
				!Number.isFinite(d.ratePerSecond) ||
				d.ratePerSecond <= 0
			) {
				push(
					'strict',
					'gainstacks-drain-rate-invalid',
					`gainStacks drain.ratePerSecond must be a positive finite number (got ${JSON.stringify(d.ratePerSecond)})`,
					location
				);
			}
			if (typeof d.state !== 'string' || !STATES.has(d.state)) {
				push(
					'strict',
					'gainstacks-drain-state-invalid',
					`gainStacks drain.state must be a known State (got ${JSON.stringify(d.state)})`,
					location
				);
			}
		}
	}

	// (B.13e) consumeStacks shape — non-empty key, amount is "all" or a positive
	// finite number, onCast trigger required (v1 dispatch only fires onCast).
	if (eff.type === 'consumeStacks') {
		if (typeof eff.key !== 'string' || eff.key.length === 0) {
			push(
				'strict',
				'consumestacks-key-invalid',
				`consumeStacks effect must have a non-empty string key`,
				location
			);
		}
		if (eff.amount !== 'all') {
			if (typeof eff.amount !== 'number' || !Number.isFinite(eff.amount) || eff.amount <= 0) {
				push(
					'strict',
					'consumestacks-amount-invalid',
					`consumeStacks amount must be "all" or a positive finite number (got ${JSON.stringify(eff.amount)})`,
					location
				);
			}
		}
		if (eff.trigger.type !== 'onCast') {
			push(
				'strict',
				'consumestacks-trigger-invalid',
				`consumeStacks effect trigger.type must be "onCast" (got "${eff.trigger.type}")`,
				location
			);
		}
		if (eff.trigger.type === 'onCast' && eff.trigger.input !== undefined) {
			const inputs = eff.trigger.input as unknown;
			if (!Array.isArray(inputs) || inputs.length === 0 || inputs.some((s) => typeof s !== 'string' || s.length === 0)) {
				push(
					'strict',
					'consumestacks-trigger-input-invalid',
					`consumeStacks trigger.input must be a non-empty array of ability-token strings (got ${JSON.stringify(eff.trigger.input)})`,
					location
				);
			}
		}
	}

	// (B.14) elements
	if (eff.type === 'damage' && eff.element !== undefined && !DAMAGE_ELEMENTS.has(eff.element)) {
		push(
			'strict',
			'invalid-element',
			`damage element "${eff.element}" is not a valid Element`,
			location
		);
	}
	if (eff.type === 'infuse' && !CHARACTER_ELEMENTS.has(eff.element)) {
		push(
			'strict',
			'invalid-element',
			`infuse element "${eff.element}" is not a valid character Element (Physical is not a valid infusion)`,
			location
		);
	}
	if (eff.type === 'resShred' && eff.element !== undefined && !DAMAGE_ELEMENTS.has(eff.element)) {
		push(
			'strict',
			'invalid-element',
			`resShred element "${eff.element}" is not a valid Element`,
			location
		);
	}

	// (B.15) buff value shape (warn — common drafting issue)
	if (eff.type === 'buff') {
		const v = eff.value;
		if (v === undefined || v === null) {
			push('warn', 'buff-value-shape', `buff value is missing`, location);
		} else if (typeof v !== 'number' && typeof v !== 'object') {
			push(
				'warn',
				'buff-value-shape',
				`buff value must be number or object (ScaledValue / scaling / unknown / ramping / decaying / perStack); got ${typeof v}`,
				location
			);
		} else if (typeof v === 'object') {
			const obj = v as Record<string, unknown>;
			const isScaled = Array.isArray(obj.refinementValues);
			const isTagged =
				typeof obj.type === 'string' &&
				['scaling', 'unknown', 'ramping', 'decaying', 'perStack'].includes(obj.type as string);
			if (!isScaled && !isTagged) {
				push(
					'warn',
					'buff-value-shape',
					`buff value object is neither ScaledValue nor a tagged variant (scaling/unknown/ramping/decaying/perStack)`,
					location
				);
			}
			// (D.31) decaying shape — startValue finite, endValue finite when
			// present (default 0).
			if (obj.type === 'decaying') {
				if (typeof obj.startValue !== 'number' || !Number.isFinite(obj.startValue as number)) {
					push(
						'strict',
						'decaying-startvalue-invalid',
						`decaying buff value must have finite startValue (got ${JSON.stringify(obj.startValue)})`,
						location
					);
				}
				if (obj.endValue !== undefined) {
					if (typeof obj.endValue !== 'number' || !Number.isFinite(obj.endValue as number)) {
						push(
							'strict',
							'decaying-endvalue-invalid',
							`decaying endValue must be a finite number when present (got ${JSON.stringify(obj.endValue)})`,
							location
						);
					}
				}
			}
			// (D.30) perStack shape — key non-empty, per is either a finite
			// number OR a scaling object { stat, ratio }, maxStacks positive
			// integer when present.
			if (obj.type === 'perStack') {
				if (typeof obj.key !== 'string' || (obj.key as string).length === 0) {
					push('strict', 'perstack-key-invalid', `perStack buff value has invalid key`, location);
				}
				const per = obj.per;
				if (typeof per === 'number') {
					if (!Number.isFinite(per)) {
						push(
							'strict',
							'perstack-per-invalid',
							`perStack per must be a finite number (got ${JSON.stringify(per)})`,
							location
						);
					}
				} else if (per !== null && typeof per === 'object') {
					const scaling = per as Record<string, unknown>;
					if (typeof scaling.stat !== 'string' || !SCALING_STATS.has(scaling.stat as string)) {
						push(
							'strict',
							'perstack-per-invalid',
							`perStack scaling per.stat must be a ScalingStat (got ${JSON.stringify(scaling.stat)})`,
							location
						);
					}
					if (typeof scaling.ratio !== 'number' || !Number.isFinite(scaling.ratio as number)) {
						push(
							'strict',
							'perstack-per-invalid',
							`perStack scaling per.ratio must be a finite number (got ${JSON.stringify(scaling.ratio)})`,
							location
						);
					}
				} else {
					push(
						'strict',
						'perstack-per-invalid',
						`perStack per must be a number or { stat, ratio } object (got ${JSON.stringify(per)})`,
						location
					);
				}
				if (obj.maxStacks !== undefined) {
					if (!Number.isInteger(obj.maxStacks) || (obj.maxStacks as number) <= 0) {
						push(
							'strict',
							'perstack-maxstacks-invalid',
							`perStack maxStacks must be a positive integer (got ${JSON.stringify(obj.maxStacks)})`,
							location
						);
					}
				}
				// (D.30b) perStack threshold — non-negative integer when present.
				// Threshold is the offset subtracted from stack count before
				// clamping; effectiveStacks = min(max(stacks - threshold, 0), maxStacks).
				if (obj.threshold !== undefined) {
					if (!Number.isInteger(obj.threshold) || (obj.threshold as number) < 0) {
						push(
							'strict',
							'perstack-threshold-invalid',
							`perStack threshold must be a non-negative integer (got ${JSON.stringify(obj.threshold)})`,
							location
						);
					}
				}
				// (D.30c) perStack cap — positive finite number when present.
				// Cap clamps the FINAL contribution (after per × effectiveStacks).
				// For plain-number `per` the renderer clamps the displayed total;
				// for scaling `per` the renderer appends a "(cap N)" suffix since
				// it can't clamp without knowing the recipient's stat values.
				if (obj.cap !== undefined) {
					if (typeof obj.cap !== 'number' || !Number.isFinite(obj.cap) || (obj.cap as number) <= 0) {
						push(
							'strict',
							'perstack-cap-invalid',
							`perStack cap must be a positive finite number (got ${JSON.stringify(obj.cap)})`,
							location
						);
					}
				}
			}
		}
	}

	// Validate states referenced in conditions
	walkConditions(eff.conditions, (cond) => {
		if (cond.type === 'state' && !STATES.has(cond.state)) {
			push('strict', 'invalid-state', `unknown state "${cond.state}"`, location);
		}
		// (D.29) stacks condition shape — key non-empty, min positive integer,
		// max ≥ min when present.
		if (cond.type === 'stacks') {
			if (typeof cond.key !== 'string' || cond.key.length === 0) {
				push('strict', 'stacks-key-invalid', `stacks condition has invalid key`, location);
			}
			if (!Number.isInteger(cond.min) || cond.min < 0) {
				push(
					'strict',
					'stacks-min-invalid',
					`stacks condition min must be a non-negative integer (got ${cond.min})`,
					location
				);
			}
			if (cond.max !== undefined) {
				if (!Number.isInteger(cond.max) || cond.max < cond.min) {
					push(
						'strict',
						'stacks-max-invalid',
						`stacks condition max must be an integer ≥ min (got max=${cond.max}, min=${cond.min})`,
						location
					);
				}
			}
		}
		// (D.34) enemyHpBelow condition shape — threshold in (0, 100].
		if (cond.type === 'enemyHpBelow') {
			if (
				typeof cond.threshold !== 'number' ||
				!Number.isFinite(cond.threshold) ||
				cond.threshold <= 0 ||
				cond.threshold > 100
			) {
				push(
					'strict',
					'enemy-hp-below-threshold-invalid',
					`enemyHpBelow.threshold must be a number in (0, 100] (got ${JSON.stringify(cond.threshold)})`,
					location
				);
			}
		}
		// (D.35) enemyAffectedBy condition shape — element must leave a persistent
		// aura. Anemo / Geo / Physical excluded; only the 5 aura-leaving elements.
		if (cond.type === 'enemyAffectedBy') {
			if (typeof cond.element !== 'string' || !AURA_ELEMENTS.has(cond.element)) {
				push(
					'strict',
					'enemy-affected-by-element-invalid',
					`enemyAffectedBy.element must be one of cryo/dendro/electro/hydro/pyro (got ${JSON.stringify(cond.element)})`,
					location
				);
			}
		}
		// (D.36) selfHpBelow / selfHpAbove condition shape — threshold in (0, 100].
		if (cond.type === 'selfHpBelow' || cond.type === 'selfHpAbove') {
			if (
				typeof cond.threshold !== 'number' ||
				!Number.isFinite(cond.threshold) ||
				cond.threshold <= 0 ||
				cond.threshold > 100
			) {
				push(
					'strict',
					'self-hp-threshold-invalid',
					`${cond.type}.threshold must be a number in (0, 100] (got ${JSON.stringify(cond.threshold)})`,
					location
				);
			}
		}
	});
}
