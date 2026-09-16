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
	ElementalApplication,
	IcdWindow,
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

/**
 * The trigger kinds that carry an effect-level `application[]` and feed the gauge
 * through `sim/procs.ts` (coordinated-attack round, 2026-08-18).
 *
 * ⚠️⚠️ RESTATED, NOT IMPORTED, for the same forced reason as STANDARD_ICD_FRAMES
 * below — this file must stay free of runtime imports. ⚓ The drift it accepts is
 * one-directional and safe: the sim's `procEffects` is the authority on what gets
 * ARMED, so a name missing here would let an effect past the lint that the sim
 * still runs, and a name here that the sim drops shows up as an application the
 * oracle says we never make.
 */
const PROC_TRIGGERS = ['onReaction', 'onHit', 'whileNormalAttacking'] as const;

/**
 * Standard element-application ICD, restated for D.27b's "did a curator annotate
 * the default" check.
 *
 * ⚠️⚠️ RESTATED, NOT IMPORTED, AND THAT IS FORCED. `scripts/generate-character-index.mjs`
 * imports this module under bare Node type-stripping, so ⛔ **this file must stay
 * free of runtime imports** — a value import of `$lib/utils/icd` breaks `prebuild`
 * with `Cannot find package '$lib'`, which no test or `svelte-check` run can see.
 * (Type-only imports are fine; they are stripped.) Same reason the vocabulary sets
 * below are copies rather than references.
 *
 * ⚓ The drift this accepts is covered elsewhere: `gcsim-frames-diff.md` §5 flags an
 * authored gate that disagrees with the measured group, so a stale number here
 * cannot quietly bless a wrong annotation. Source of truth is
 * `STANDARD_ICD_FRAMES` in `$lib/utils/icd`.
 */
const STANDARD_ICD_FRAMES = { timer: 150, hits: 3 };

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
	'pyroSwirl',
	'hydroSwirl',
	'cryoSwirl',
	'electroSwirl',
	'pyroCrystallize',
	'hydroCrystallize',
	'cryoCrystallize',
	'electroCrystallize',
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
	'stellarConduct',
	'stellarSwirl',
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
	'energyRecharge',
	'lunarChargedDmgBonus',
	'lunarBloomDmgBonus',
	'lunarCrystallizeDmgBonus',
	'stellarConductDmgBonus',
	'stellarSwirlDmgBonus',
	'stellarGlimmerDmgBonus',
	'superConductReactionBonus',
	'cryoSwirlReactionBonus',
	'electroChargedReactionBonus',
	'bloomReactionBonus',
	'stellarConductReactionBonus',
	'stellarSwirlReactionBonus',
	'stellarGlimmerReactionBonus',
	'lunarChargedReactionBonus',
	'lunarBloomReactionBonus',
	'lunarCrystallizeReactionBonus',
	'skillDmgBonus',
	'burstDmgBonus',
	'normalDmgBonus',
	'chargeDmgBonus',
	'plungeDmgBonus',
	'cdReduction',
	'defIgnore',
	'healingBonus',
	'incomingHealingBonus',
	'interruptionRes',
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
	'inStance',
	// Transient-state vocabulary (sQ primitive + post-P4 #2 openers).
	'symphonyWindow',
	'apexDrive',
	'transmuting',
	'whiteForm',
	'darkForm',
	// ⚠️⚠️ `codaWindow` was added to the `State` union in the Odette Stage-2 round
	// and NOT here, and nothing noticed for four days — this list is checked only
	// for `isCurated` characters and Odette is in FRAMELESS_EXEMPT, so her
	// `opensTransientState.state` never reached the vocabulary check at all.
	// ⛔ Adding a State member is TWO edits; the suite cannot tell you when the
	// character that needs it is frameless.
	'codaWindow',
	'pneuma',
	// Lauma's two charged forms (charged-forms round, 2026-09-16).
	'spiritEnvoy',
	'envoyCooldown'
]);

const ABILITY_TYPES = new Set(['normal', 'skill', 'burst', 'passive', 'constellation']);
const BEHAVIORS = new Set(['instant', 'persistent', 'stance']);
const SUMMON_TERMINATES = new Set(['swap', 'recast']);
const DAMAGE_TAGS = new Set(['normal', 'charged', 'plunge', 'skill', 'skillHold', 'burst']);

/** Characters whose input-less cast variants are known-unreachable *by design*,
 *  pending a deferred rebuild — the `variant-unreachable` check reports them at
 *  `warn` (a visible reminder) instead of `strict` (which would fail CI).
 *  EMPTY since 2026-07-17: Durin's placeholder variants became real state-gated
 *  abilities when the dual-form model landed (post-P4 #2). Any NEW input-less
 *  castable variant is `strict`. */
const UNREACHABLE_VARIANT_EXEMPT = new Set<string>([]);

/** AbilityTag vocabulary — JSONs aren't typechecked, so an unknown tag would
 *  silently derive nothing (capabilities, Team Builder facets). Kept aligned
 *  with ability.ts AbilityTag. */
const ABILITY_TAGS = new Set([
	'coordinatedAttack',
	'heal',
	'shield',
	'summon',
	'taunt',
	'cleanse',
	'grouping'
]);

const ID_PATTERN = /^[a-z][a-z0-9_]*__(normal|skill|burst|passive|constellation)__[a-z0-9_]+$/;

const IMPL_PHRASES = [
	'TODO',
	'todo:',
	'not modeled',
	'not modelled',
	'see curator',
	'see _curator'
];

// (E.26) Caveat style guarantees from the A7 pass (2026-07-20). The full
// style contract lives in docs/curation/caveat-style-guide.md; its
// caveat-lint-config block is the sync source for this banned list, and
// scripts/caveat-lint.mjs runs the fuller pattern checks at authoring time.
const CAVEAT_BANNED_SUBSTRINGS = [
	'gcsim',
	'schema',
	'parser',
	'renderer',
	'modelled',
	'_curatorNotes',
	'_todo',
	'hitmark',
	' v1.',
	' v2.'
];
const CAVEAT_WARN_LENGTH = 280;
const CAVEAT_FAIL_LENGTH = 400;

// (E.27) Bounds for a `BuffValue { type: 'unknown' }` description. ⚠ Far
// tighter than the caveat bounds above, and deliberately: a caveat gets its own
// paragraph in the notes panel, while this string is squeezed into a tooltip
// cell beside a stat name. The corpus spans 23–48 chars; the warn line sits
// just above the longest legitimate entry, and the hard cap is set where the
// tooltip stops looking like a value and starts looking like prose.
const UNKNOWN_VALUE_WARN_LENGTH = 60;
const UNKNOWN_VALUE_FAIL_LENGTH = 100;

/** Style issues for a user-facing caveat string (E.26). */
function caveatStyleIssues(text: string): { severity: Severity; message: string }[] {
	const issues: { severity: Severity; message: string }[] = [];
	if (text.length > CAVEAT_FAIL_LENGTH) {
		issues.push({
			severity: 'strict',
			message: `caveat length ${text.length} exceeds hard cap ${CAVEAT_FAIL_LENGTH}`
		});
	} else if (text.length > CAVEAT_WARN_LENGTH) {
		issues.push({
			severity: 'warn',
			message: `caveat length ${text.length} exceeds soft cap ${CAVEAT_WARN_LENGTH}`
		});
	}
	const lower = text.toLowerCase();
	for (const banned of CAVEAT_BANNED_SUBSTRINGS) {
		if (lower.includes(banned.toLowerCase())) {
			issues.push({ severity: 'strict', message: `caveat contains banned token "${banned}"` });
		}
	}
	return issues;
}

// ---------------------------------------------------------------------------
// Curation heuristic
// ---------------------------------------------------------------------------

/** Curated characters have frames on normal hits[] AND frames on the skill ability. */
export function isCurated(c: CharacterData): boolean {
	const normal = c.abilities.find((a) => a.abilityType === 'normal') as NormalAbility | undefined;
	const skill = c.abilities.find((a) => a.abilityType === 'skill') as SkillAbility | undefined;
	if (!normal || !skill) return false;
	if (!normal.hits?.length) return false;
	// ⚠️ The framed-vs-not sentinel is `anim` since L4b, not `swap`: `anim` is what
	// every FrameMap is now required to carry, and `swap` became an ordinary
	// optional override that two curated maps never had in the first place.
	const firstHitFrames = normal.hits[0]?.frames;
	if (!firstHitFrames || typeof firstHitFrames.anim !== 'number') return false;
	const skillFrames = (skill as { frames?: { anim?: unknown } }).frames;
	if (!skillFrames || typeof skillFrames.anim !== 'number') return false;
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

/**
 * Structural validation of a condition tree from the RAW (untyped) JSON —
 * TypeScript can't catch a malformed node like `{all: [...]}` missing its
 * `type` discriminant once the JSON is cast to CharacterData, and such a node
 * silently never evaluates anywhere (found live on Skirk C2, 2026-07-12).
 * Returns a problem description or null.
 */
function conditionShapeProblem(node: unknown, path: string): string | null {
	if (typeof node !== 'object' || node === null || Array.isArray(node)) {
		return `${path}: condition is not an object`;
	}
	const raw = node as Record<string, unknown>;
	if (typeof raw.type !== 'string') {
		const keys = Object.keys(raw).join(',');
		return `${path}: condition node lacks a string 'type' (keys: ${keys})`;
	}
	if (raw.type === 'all' || raw.type === 'any') {
		if (!Array.isArray(raw.conditions)) return `${path}: '${raw.type}' node lacks conditions[]`;
		for (let i = 0; i < raw.conditions.length; i++) {
			const p = conditionShapeProblem(raw.conditions[i], `${path}.conditions[${i}]`);
			if (p) return p;
		}
	}
	if (raw.type === 'not') {
		if (raw.condition === undefined) return `${path}: 'not' node lacks condition`;
		return conditionShapeProblem(raw.condition, `${path}.condition`);
	}
	return null;
}

/** Deep-walks raw JSON finding every condition root: an object-valued
 *  `conditions` property (hosts author a single node; all/any nodes hold an
 *  array, so they don't re-trigger). Covers effects, variants, summons,
 *  constellationScaling, durationExtensions — every host, present and future. */
function walkRawConditionRoots(
	node: unknown,
	path: string,
	fn: (cond: unknown, path: string) => void
): void {
	if (Array.isArray(node)) {
		node.forEach((n, i) => walkRawConditionRoots(n, `${path}[${i}]`, fn));
		return;
	}
	if (typeof node !== 'object' || node === null) return;
	const raw = node as Record<string, unknown>;
	for (const [key, value] of Object.entries(raw)) {
		if (
			key === 'conditions' &&
			typeof value === 'object' &&
			value !== null &&
			!Array.isArray(value)
		) {
			fn(value, `${path}.conditions`);
		} else if (typeof value === 'object') {
			walkRawConditionRoots(value, `${path}.${key}`, fn);
		}
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

	// (C.17) a faction effect must BIND ITS TRIGGER EXPLICITLY.
	//
	// ⚠ Since 2026-08-15 `factionBonuses` effects join the planner's candidate
	// pool (`effectSourcesOf`), and they enter it as a source with NO
	// `abilityType` — the same shape a passive has. The collectors' fall-through
	// for that shape is "no explicit ability → fire on BOTH casts", which for a
	// passive is deliberate (Kazuha C6 infuses after either E or Q) and for a
	// faction bonus is almost always an accident: a Secret Rite that names one
	// ability would silently draw a bar on the other too.
	//
	// Every faction effect in the corpus already binds explicitly, so this rule
	// pins a property the engine now relies on rather than fixing anything.
	for (const fb of factionBonuses) {
		for (const fx of fb.effects ?? []) {
			const trig = fx.trigger as { type?: string; ability?: string; abilityType?: unknown };
			if (trig?.type === 'onCast' && trig.ability === undefined) {
				push(
					'strict',
					'faction-effect-unbound-trigger',
					`factionBonuses["${fb.name}"] onCast effect has no trigger.ability — it would fire on BOTH skill and burst`
				);
			}
			if (trig?.type === 'onHit' && trig.abilityType === undefined) {
				push(
					'strict',
					'faction-effect-unbound-trigger',
					`factionBonuses["${fb.name}"] onHit effect has no trigger.abilityType — it would fire on both skill and burst hits`
				);
			}
		}
	}

	// Per-ability checks
	const allAbilities: Ability[] = [...c.abilities, ...c.passives, ...c.constellations];
	for (const a of allAbilities) {
		lintAbility(c, a, push);
	}

	// (NEW) every condition tree, wherever hosted, must be structurally valid —
	// malformed nodes silently never evaluate (Skirk C2 shipped with one).
	walkRawConditionRoots(
		{
			abilities: c.abilities,
			passives: c.passives,
			constellations: c.constellations,
			factionBonuses: c.factionBonuses
		},
		c.id,
		(cond, path) => {
			const problem = conditionShapeProblem(cond, path);
			if (problem) push('strict', 'condition-shape', problem);
		}
	);

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

	// (D.39) STACK SCOPE IS A PROPERTY OF THE KEY, so every gainStacks effect
	// that grants it must say the same thing. ⛔ Not the `drain` convention of
	// declaring once on the first grant: `scope` is one enum, so a disagreement
	// is checkable here — while an OMISSION is invisible, and would silently
	// revert the key to `'segment'` the day the declaring effect is edited away.
	// Reference: Alyosha's `huntersMark`, the only corpus author.
	{
		const scopesByKey = new Map<string, Set<string>>();
		for (const src of [...c.abilities, ...(c.passives ?? []), ...(c.constellations ?? [])]) {
			for (const fx of src.effects ?? []) {
				if (fx.type !== 'gainStacks') continue;
				const set = scopesByKey.get(fx.key) ?? new Set<string>();
				set.add(fx.scope ?? 'segment');
				scopesByKey.set(fx.key, set);
			}
		}
		for (const [key, scopes] of scopesByKey) {
			if (scopes.size > 1) {
				push(
					'strict',
					'gainstacks-scope-disagreement',
					`gainStacks key "${key}" is granted with disagreeing scopes (${[...scopes].sort().join(', ')}); a key has ONE home — declare the same scope on every grant of it`
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

	// (NEW) ability-tag vocabulary — unknown tags silently derive nothing
	const tagBags: (readonly string[] | undefined)[] = [
		'tags' in a ? a.tags : undefined,
		...('variants' in a ? (a.variants ?? []).map((v) => v.tags) : [])
	];
	for (const tags of tagBags) {
		for (const tag of tags ?? []) {
			if (!ABILITY_TAGS.has(tag)) {
				push('strict', 'unknown-ability-tag', `unknown AbilityTag "${tag}"`, a.id);
			}
		}
	}

	// (NEW post-P4 #2) Transient-state opener specs (`opensTransientState`,
	// `actionOpensState.{normal,plunge,charged}`): unknown state names would
	// silently never gate anything, so vocabulary is strict. `conditions` inside
	// the specs are covered by the generic condition-shape walk.
	// Every state a `toggle: true` spec anywhere on this character opens — the
	// `summonsFollowState` guard further down needs it, and a toggle authored on
	// the NORMAL ability is what gates a SKILL's variants (Furina), so it has to
	// be a character-wide walk rather than a per-ability one.
	const toggledStates = new Set<string>();
	for (const other of [...c.abilities, ...(c.passives ?? []), ...(c.constellations ?? [])]) {
		const raw = other as unknown as Record<string, unknown>;
		const bags = [
			raw.opensTransientState,
			...Object.values((raw.actionOpensState ?? {}) as object)
		];
		for (const bag of bags) {
			const spec = bag as { state?: unknown; toggle?: unknown } | undefined;
			if (spec && spec.toggle === true && typeof spec.state === 'string') {
				toggledStates.add(spec.state);
			}
		}
	}

	const specSites: { spec: unknown; where: string }[] = [];
	const rawAbility = a as unknown as Record<string, unknown>;
	if (rawAbility.opensTransientState !== undefined) {
		specSites.push({ spec: rawAbility.opensTransientState, where: 'opensTransientState' });
	}
	const aos = rawAbility.actionOpensState as Record<string, unknown> | undefined;
	if (aos !== undefined) {
		for (const key of Object.keys(aos)) {
			if (key !== 'normal' && key !== 'plunge' && key !== 'charged') {
				push(
					'strict',
					'transient-state-spec',
					`actionOpensState key "${key}" is not an action class (normal|plunge|charged)`,
					a.id
				);
			} else if (aos[key] !== undefined) {
				specSites.push({ spec: aos[key], where: `actionOpensState.${key}` });
			}
		}
	}
	for (const { spec, where } of specSites) {
		const s = spec as {
			state?: unknown;
			duration?: unknown;
			toggle?: unknown;
			consumes?: unknown;
		};
		if (typeof s.state !== 'string' || !STATES.has(s.state)) {
			push(
				'strict',
				'transient-state-spec',
				`${where}.state "${String(s.state)}" is not a known State`,
				a.id
			);
		}
		// ⚓ EXACTLY ONE OF `duration` / `toggle` (Arkhe round, 2026-09-04). The two
		// arms are the two ways a state can END — by itself after N seconds, or
		// only when the same action fires again — and a spec carrying both is not
		// a longer toggle, it is an author who has not decided. ⚠️ TypeScript
		// already refuses the pair via the union's `never`s, but the character
		// JSONs are cast to `CharacterData` rather than checked against it, so
		// this is the only gate that actually runs on authored data.
		if (s.toggle !== undefined && s.toggle !== true) {
			push(
				'strict',
				'transient-state-spec',
				`${where}.toggle must be literally true when present (a toggle has no other setting)`,
				a.id
			);
		}
		if (s.toggle === true) {
			if (s.duration !== undefined) {
				push(
					'strict',
					'transient-state-spec',
					`${where} sets both toggle and duration; a toggle has no length — it ends when the action fires again`,
					a.id
				);
			}
		} else if (typeof s.duration !== 'number' || !isFinite(s.duration) || s.duration <= 0) {
			push(
				'strict',
				'transient-state-spec',
				`${where}.duration must be a finite positive number (or set toggle: true instead)`,
				a.id
			);
		}
		if (s.consumes !== undefined) {
			if (!Array.isArray(s.consumes)) {
				push('strict', 'transient-state-spec', `${where}.consumes must be an array`, a.id);
			} else {
				for (const n of s.consumes) {
					if (typeof n !== 'string' || !STATES.has(n)) {
						push(
							'strict',
							'transient-state-spec',
							`${where}.consumes entry "${String(n)}" is not a known State`,
							a.id
						);
					}
				}
			}
		}
		// (charged-forms round, 2026-09-16) `terminatesOnAction` is a flag with
		// one setting, like `toggle`; `onEnd` is a `{state, duration}` pair and
		// is refused on a toggle, which has no end to chain from.
		const s2 = spec as { terminatesOnAction?: unknown; onEnd?: unknown };
		if (s2.terminatesOnAction !== undefined && s2.terminatesOnAction !== true) {
			push(
				'strict',
				'transient-state-spec',
				`${where}.terminatesOnAction must be literally true when present`,
				a.id
			);
		}
		if (s2.onEnd !== undefined) {
			const oe = s2.onEnd as { state?: unknown; duration?: unknown } | null;
			if (s.toggle === true) {
				push(
					'strict',
					'transient-state-spec',
					`${where}.onEnd on a toggle: a toggle has no end to chain from`,
					a.id
				);
			}
			if (typeof oe !== 'object' || oe === null) {
				push('strict', 'transient-state-spec', `${where}.onEnd must be an object`, a.id);
			} else {
				if (typeof oe.state !== 'string' || !STATES.has(oe.state)) {
					push(
						'strict',
						'transient-state-spec',
						`${where}.onEnd.state "${String(oe.state)}" is not a known State`,
						a.id
					);
				}
				if (typeof oe.duration !== 'number' || !isFinite(oe.duration) || oe.duration <= 0) {
					push(
						'strict',
						'transient-state-spec',
						`${where}.onEnd.duration must be a finite positive number of seconds`,
						a.id
					);
				}
			}
		}
	}

	// ⚓⚓ (NEW, Arkhe round) `summonsFollowState` RE-RESOLVES AT STATE EDGES THE
	// PARSE CAN SEE, and a TIMED window's expiry is not one of them — it fires no
	// event, so a lineup gated on a 6s window would keep the wrong occupant for
	// the rest of the cast. The flag is therefore only sound when every state
	// gating its variants is opened by a TOGGLE, which never expires.
	// ⛔ Don't relax this to a warning: the failure is silent and looks correct.
	if ((a as unknown as Record<string, unknown>).summonsFollowState === true) {
		const gating = new Set<string>();
		for (const v of ('variants' in a ? (a.variants ?? []) : []) as { conditions?: unknown }[]) {
			walkConditions(v.conditions as Condition | undefined, (cond) => {
				if (cond.type === 'state') gating.add(cond.state);
			});
		}
		if (gating.size === 0) {
			push(
				'strict',
				'summons-follow-state',
				`summonsFollowState is set but no variant gates on a state — nothing could ever change the occupant`,
				a.id
			);
		}
		for (const name of gating) {
			if (!toggledStates.has(name)) {
				push(
					'strict',
					'summons-follow-state',
					`summonsFollowState gates on "${name}", which no toggle on this character opens — a timed window expires with no event and the lineup would never hand back`,
					a.id
				);
			}
		}
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

	// (E.26) caveat style — user-facing voice, no curator-speak, bounded length
	if (typeof caveat === 'string' && caveat.trim().length > 0) {
		for (const issue of caveatStyleIssues(caveat)) {
			push(issue.severity, 'caveat-style', issue.message, a.id);
		}
	}

	// (E.28) ⛔ A CAVEAT MAY ONLY LIVE ON AN ABILITY-SHAPED HOST (2026-08-19).
	//
	// ⚓ The render surface is ability-shaped BY CONSTRUCTION: `collectSlotCaveats`
	// (src/lib/timeline/slotCaveats.ts) maps `effectSourcesAtConstellation(...)` and
	// emits `{ name, caveat, kind }` — the Notes panel prints the ability's NAME and
	// KIND CHIP above each entry. An Effect has neither, so there is nothing to label
	// it with; "teach slotCaveats to descend" is a new design question, not a fix.
	//
	// ⚠️⚠️ This was a SILENT DATA-LOSS BUG, not a tidiness rule. 20 effect-level
	// caveats across 8 characters rendered to nobody, and 7 of them sat on abilities
	// with no entry-level caveat at all — so those abilities warned the player about
	// nothing. `scripts/caveat-lint.mjs` never scanned them either (it walks
	// abilities/passives/constellations at entry level, and factionBonuses not at
	// all), which is exactly why they drifted for a month.
	//
	// ⚠️ NO KEY-NAME CHECK CAN CATCH THIS CLASS. `caveat` is legal on AbilityCommon
	// and illegal here — the defect is POSITIONAL. `orphanedSchema.test.ts` stayed
	// green over all 20 because it asks "is this key read anywhere", and it is. The
	// general form of this guard is corpus-wide positional validation against the TS
	// types (generated JSON Schema, `additionalProperties: false`); this rule is the
	// cheap, precise instance of it. See docs/curation/caveat-ruthless-pass-2026-08-19.md.
	for (const [label, list] of [
		['effects', (a as { effects?: unknown[] }).effects],
		[
			'summons[].effects',
			((a as { summons?: { effects?: unknown[] }[] }).summons ?? []).flatMap((s) => s.effects ?? [])
		]
	] as const) {
		for (const fx of list ?? []) {
			if (fx && typeof fx === 'object' && typeof (fx as { caveat?: unknown }).caveat === 'string') {
				push(
					'strict',
					'caveat-below-ability',
					`caveat on ${label} reaches NO reader — only an ability/passive/constellation ENTRY renders. ` +
						`Move it up to this entry's own caveat, or drop it.`,
					a.id
				);
			}
		}
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
			cond.type === 'enemyHpAbove' &&
			(typeof cond.threshold !== 'number' ||
				!Number.isFinite(cond.threshold) ||
				cond.threshold <= 0 ||
				cond.threshold > 100)
		) {
			push(
				'strict',
				'enemy-hp-above-threshold-invalid',
				`enemyHpAbove.threshold must be a number in (0, 100] on ability conditions (got ${JSON.stringify(cond.threshold)})`,
				a.id
			);
		}
		if (
			cond.type === 'recipientHpBelow' &&
			(typeof cond.threshold !== 'number' ||
				!Number.isFinite(cond.threshold) ||
				cond.threshold <= 0 ||
				cond.threshold > 100)
		) {
			push(
				'strict',
				'recipient-hp-below-threshold-invalid',
				`recipientHpBelow.threshold must be a number in (0, 100] on ability conditions (got ${JSON.stringify(cond.threshold)})`,
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
			// A variant is selected ONLY by matching a notation token against its
			// `input` (resolveAbilityTiming / resolveEQCastTime / resolveEffectiveCharges
			// in notationParser.ts). A variant that customizes cast/timeline behavior
			// but declares no `input` is therefore unreachable: no token can select it,
			// so the parser silently falls back to the base ability's timing/frames/effects.
			// Regression guard for the 2026-07-15 Tap/Hold batch (candace/diona/razor/
			// shenhe/venti had input-less Hold variants whose longer cooldown + frames +
			// shield never applied; also fixed keqing/lauma/nahida/charlotte, removed
			// wriothesley's mismodeled variant). `strict` now, except UNREACHABLE_VARIANT_EXEMPT
			// (durin's deferred dual-form placeholders) which stay `warn`.
			const customizesCast =
				v.frames !== undefined ||
				v.cooldown !== undefined ||
				(v.cooldownModifiers?.length ?? 0) > 0 ||
				v.energyCost !== undefined ||
				v.charges !== undefined ||
				v.behavior !== undefined;
			if (customizesCast && !v.input?.length) {
				push(
					UNREACHABLE_VARIANT_EXEMPT.has(c.id) ? 'warn' : 'strict',
					'variant-unreachable',
					`variant "${v.label}" customizes cast behavior (frames/cooldown/energyCost/charges/behavior) but has no \`input\` token — it is unreachable; the parser falls back to the base ability`,
					a.id
				);
			}
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
		if (!isPositiveInt(fm.anim)) {
			push(
				'strict',
				'missing-anim',
				`hits[${i}].frames.anim missing or not a positive integer`,
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

	// (A.4b) chargedIcdWindow shape — FRAMES, not seconds.
	//
	// ⚠️⚠️ The unit trap this exists for: `summonTick.interval` beside it is in
	// SECONDS while this is in FRAMES, so a curator reaching for "0.5s" writes
	// `0.5` and silently gets a window that expires before the swing lands —
	// which reads as "every charged attack applies", the very thing the field is
	// supposed to STOP over-claiming. The smallest real group timer in gcsim's
	// table is 6 frames, so anything under that is a unit error and not a value.
	if (a.chargedIcdWindow) {
		if (!isPositiveInt(a.chargedIcdWindow.timer) || a.chargedIcdWindow.timer < 6) {
			push(
				'strict',
				'charged-icd-window-invalid',
				`chargedIcdWindow.timer must be a positive integer of FRAMES (got ${a.chargedIcdWindow.timer}); gcsim's smallest group timer is 6`,
				a.id
			);
		}
		if (a.chargedIcdWindow.every !== undefined && !isPositiveInt(a.chargedIcdWindow.every)) {
			push(
				'strict',
				'charged-icd-window-invalid',
				`chargedIcdWindow.every must be a positive integer when present (got ${a.chargedIcdWindow.every}); omit it to mean "only the first hit of the window applies"`,
				a.id
			);
		}
	}

	// (A.4c) `nonHitting` — a keyed object of action classes, each literally
	// `true` (charged-forms round, 2026-09-16). A `chargedIcdWindow` beside a
	// non-hitting charged attack is a gate on a swing that never applies.
	const nh = (a as unknown as { nonHitting?: unknown }).nonHitting;
	if (nh !== undefined) {
		if (typeof nh !== 'object' || nh === null || Array.isArray(nh)) {
			push('strict', 'non-hitting-shape', `nonHitting must be an object of action classes`, a.id);
		} else {
			for (const [k, v] of Object.entries(nh as Record<string, unknown>)) {
				if (k !== 'normal' && k !== 'charged' && k !== 'plunge') {
					push(
						'strict',
						'non-hitting-shape',
						`nonHitting key "${k}" is not an action class (normal|charged|plunge)`,
						a.id
					);
				} else if (v !== true) {
					push(
						'strict',
						'non-hitting-shape',
						`nonHitting.${k} must be literally true when present`,
						a.id
					);
				}
			}
			if ((nh as { charged?: unknown }).charged === true && a.chargedIcdWindow) {
				push(
					'warn',
					'non-hitting-shape',
					`chargedIcdWindow on a non-hitting charged attack gates a swing that never applies`,
					a.id
				);
			}
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
		if (!isPositiveInt(a.chargeFrames.anim)) {
			push('strict', 'missing-anim', `chargeFrames.anim missing or not a positive integer`, a.id);
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
			if (!isPositiveInt(fm.anim)) {
				push(
					'strict',
					'missing-anim',
					`chargeHits[${i}].frames.anim missing or not a positive integer`,
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

	// plungeFrames (HIGH plunge — the default) and lowPlungeFrames (`lP` only)
	for (const [field, fm] of [
		['plungeFrames', a.plungeFrames],
		['lowPlungeFrames', a.lowPlungeFrames]
	] as const) {
		if (!fm) continue;
		if (!isPositiveInt(fm.anim)) {
			push('strict', 'missing-anim', `${field}.anim missing or not a positive integer`, a.id);
		}
	}
	// ⛔ A low-plunge map with no high-plunge map beside it inverts the default:
	// the bare `P` token would fall through to nothing while `lP` resolved.
	if (a.lowPlungeFrames && !a.plungeFrames) {
		push('strict', 'missing-frames', 'lowPlungeFrames without plungeFrames', a.id);
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
		if (!isPositiveInt(a.frames.anim)) {
			push('strict', 'missing-anim', 'frames.anim missing or not a positive integer', a.id);
		}
		// ⛔ `hit` is `InitNormalCancelSlice`'s tier and an E/Q slice has no such
		// tier — `InitAbilSlice` takes one number. Authoring it here would create a
		// silent second fallback that gcsim does not have.
		if (a.frames.hit !== undefined) {
			push('strict', 'frame-value-invalid', 'frames.hit is not valid on a skill/burst map', a.id);
		}
	}

	// (A.6c) `nonHitting` on a cast (non-hitting casts round, 2026-09-16): the
	// base takes a literal `true` and must state `application: []` beside it —
	// two claims, both written; a variant takes a boolean, and either value
	// needs the variant's own `application[]` (`true` an empty one, `false` a
	// real list — the hit it re-enables must say when it lands).
	if (a.abilityType === 'skill' || a.abilityType === 'burst') {
		const nh = (a as unknown as { nonHitting?: unknown }).nonHitting;
		if (nh !== undefined) {
			if (nh !== true) {
				push(
					'strict',
					'non-hitting-cast',
					`nonHitting must be literally true on a cast ability`,
					a.id
				);
			} else if (!Array.isArray(a.application) || a.application.length !== 0) {
				push(
					'strict',
					'non-hitting-cast',
					`nonHitting cast must author application: [] beside it (a cast that lands no hit applies nothing, and both claims are stated)`,
					a.id
				);
			}
		}
		for (const v of a.variants ?? []) {
			const vnh = (v as unknown as { nonHitting?: unknown }).nonHitting;
			if (vnh === undefined) continue;
			if (typeof vnh !== 'boolean') {
				push(
					'strict',
					'non-hitting-cast',
					`variant "${v.label}" nonHitting must be a boolean`,
					a.id
				);
			} else if (!Array.isArray(v.application)) {
				push(
					'strict',
					'non-hitting-cast',
					`variant "${v.label}" nonHitting: ${vnh} needs the variant's own application[] (${vnh ? 'an empty one' : 'the hit it re-enables'})`,
					a.id
				);
			} else if (vnh && v.application.length !== 0) {
				push(
					'strict',
					'non-hitting-cast',
					`variant "${v.label}" nonHitting: true with a non-empty application[]`,
					a.id
				);
			}
		}
	}

	// (A.6) application[] — the elemental hit schedule (gauge round L4c)
	for (const [where, list] of [
		[a.id, a.application],
		...(a.variants ?? []).map((v) => [`${a.id} variant "${v.label}"`, v.application])
	] as [string, ElementalApplication[] | undefined][]) {
		if (!list) continue;
		let last = -1;
		for (let i = 0; i < list.length; i++) {
			const e = list[i];
			if (!Number.isInteger(e.frame) || e.frame < 0) {
				push(
					'strict',
					'application-invalid',
					`${where} application[${i}].frame is not a non-negative integer`,
					a.id
				);
			}
			// ⚠️ SORTED, and it matters: the sim schedules these in order and the report
			// reads them as a timeline. An out-of-order entry is an authoring slip that
			// nothing downstream would notice.
			if (e.frame < last) {
				push(
					'strict',
					'application-invalid',
					`${where} application[${i}] is out of frame order`,
					a.id
				);
			}
			last = e.frame;
			if (e.element !== undefined && !CHARACTER_ELEMENTS.has(e.element)) {
				push(
					'strict',
					'invalid-element',
					`${where} application[${i}].element "${e.element}" is not a valid Element`,
					a.id
				);
			}
			// ↻ `units` is authored since L5d — its consumer, the gauge, landed at
			// L5c (before then this rule REFUSED the field, which is the
			// orphaned-data class the schema guard exists to catch).
			//
			// ⚠️ ABSENT IS LEGAL AND MEANS UNMEASURED — gcsim logs no durability for
			// a hit its own ICD suppressed, and the sim falls back to 1U, flagged
			// provisional. ⛔ Never make it required.
			//
			// The bound is a sanity check, not a vocabulary: the corpus measured
			// 1U ×327, 2U ×58, 4U ×2, and a value outside 0–4 means the durability
			// conversion (25 per unit) went wrong rather than that a new gauge size
			// exists.
			if (e.units !== undefined && !(typeof e.units === 'number' && e.units > 0 && e.units <= 4)) {
				push(
					'strict',
					'application-invalid',
					`${where} application[${i}].units is not a gauge value in (0, 4] (got ${JSON.stringify(e.units)})`,
					a.id
				);
			}
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

	// (D.21) cooldownStartsAtStanceEnd is exclusive with cooldownStartDelay.
	// The two mean different things — a stance-end CLOCK vs. an animation-frame
	// offset — and authoring both leaves the reader (and the parser's readyAt
	// branch) no way to know which was intended. Xilonen and Ifa were once
	// encoded as the second because a delay equal to the duration happens to
	// compute the same first cast; ⛔ don't go back.
	if (a.behavior === 'stance' && a.cooldownStartsAtStanceEnd === true) {
		if (a.cooldownStartDelay !== undefined) {
			push(
				'strict',
				'cd-stance-end-with-delay',
				'cooldownStartsAtStanceEnd and cooldownStartDelay are mutually exclusive — the first is a stance-end clock, the second an animation-frame offset',
				a.id
			);
		}
		// (D.22) …and not modelled alongside durationExtensions. The recast is
		// placed mid-parse from the stance's expected end; an extension that
		// fires LATER moves the real end past a placement already written.
		// Early exit (the swap close) moves it earlier and IS handled.
		if (a.durationExtensions?.length) {
			push(
				'strict',
				'cd-stance-end-with-extensions',
				'cooldownStartsAtStanceEnd is not modelled together with durationExtensions[] — an extension moves the stance end after the recast has been placed',
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
		// A variant's frames REPLACE the base's, so they carry the same obligations.
		if (v.frames) {
			if (!isPositiveInt(v.frames.anim)) {
				push(
					'strict',
					'missing-anim',
					`variant "${v.label}" frames.anim missing or not a positive integer`,
					a.id
				);
			}
			if (v.frames.hit !== undefined) {
				push(
					'strict',
					'frame-value-invalid',
					`variant "${v.label}" frames.hit is not valid on a skill/burst map`,
					a.id
				);
			}
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

/**
 * The `icdGate` window's shape, shared by `summonTick` and `whileNormalAttacking`
 * (coordinated-attack round). ⚓ ONE check for one field — the two triggers carry
 * the same key with the same meaning, and two copies of a unit trap is two
 * chances to fix only one of them.
 */
function lintIcdGate(
	gate: IcdWindow | 'none' | undefined,
	what: string,
	summonLabel: string,
	abilityId: string,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void
): void {
	if (!gate || gate === 'none') return;
	// ⚠️⚠️ THE UNIT TRAP A.4b EXISTS FOR, AND HERE THE TWO UNITS SIT IN THE SAME
	// OBJECT: `interval` beside it is in SECONDS and this is in FRAMES. A curator
	// reaching for "1s" writes `1` and gets a window that has expired before the
	// next tick, which reads as "every tick applies" — the exact over-claim the
	// field exists to stop. gcsim's smallest real group timer is 6 frames, so
	// anything under that is a unit error rather than a value.
	if (!isPositiveInt(gate.timer) || gate.timer < 6) {
		push(
			'strict',
			'summon-tick-icd-window-invalid',
			`${what} icdGate.timer on summon "${summonLabel}" must be a positive integer of FRAMES (got ${gate.timer}); gcsim's smallest group timer is 6, and the interval beside it is in SECONDS`,
			abilityId
		);
	}
	if (gate.every !== undefined && !isPositiveInt(gate.every)) {
		push(
			'strict',
			'summon-tick-icd-window-invalid',
			`${what} icdGate.every on summon "${summonLabel}" must be a positive integer when present (got ${gate.every}); omit it to mean "only the first tick of the window applies"`,
			abilityId
		);
	}
	// ⚓ A window equal to the standard is the DEFAULT spelled out, and icd.md
	// forbids annotating the default: absent already means this, and a redundant
	// annotation asserts a measurement as if it were a finding.
	if (gate.timer === STANDARD_ICD_FRAMES.timer && gate.every === STANDARD_ICD_FRAMES.hits) {
		push(
			'strict',
			'summon-tick-icd-window-invalid',
			`${what} icdGate on summon "${summonLabel}" restates the standard window (${gate.timer}f / every ${gate.every}); omit it — absent means standard`,
			abilityId
		);
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
			lintEffect(c, location, eff, push, { isPassiveOrConstellation: false, isSummon: true });

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
				// (D.27b) icdGate window shape — FRAMES, not seconds.
				//
				// ⚠️⚠️ THE SAME UNIT TRAP A.4b EXISTS FOR, AND HERE THE TWO UNITS SIT
				// IN THE SAME OBJECT: `interval` two lines up is in SECONDS and this
				// is in FRAMES. A curator reaching for "1s" writes `1` and gets a
				// window that has expired before the next tick, which reads as "every
				// tick applies" — the exact over-claim the field exists to stop.
				// gcsim's smallest real group timer is 6 frames, so anything under
				// that is a unit error rather than a value.
				// (D.27d) tickCap shape, and ⛔ never a restatement of the derived
				// count. ⚠️⚠️ The rule that makes this field honest: absent means the
				// count comes from the summon's lifetime, which is right for 26 of
				// the 37 series the oracle can compare. A cap that merely repeats
				// `ceil((duration − firstTickDelay) / interval)` asserts a
				// measurement nobody made and hides the day the duration changes.
				const cap = eff.trigger.tickCap;
				const capScaled = eff.trigger.tickCapScaling;
				for (const [what, n] of [
					['tickCap', cap],
					['tickCapScaling.ticks', capScaled?.ticks]
				] as const) {
					if (n === undefined) continue;
					if (!isPositiveInt(n)) {
						push(
							'strict',
							'summon-tick-cap-invalid',
							`summonTick ${what} on summon "${s.label}" must be a positive integer of TICKS (got ${n})`,
							a.id
						);
					}
				}
				// ⚓ A bare `tickCapScaling` with no base cap is ALLOWED on purpose: a
				// series derived at C0 and capped at C6 is a real shape. Nothing in
				// the corpus needs it yet, so there is nothing to check.
				if (cap !== undefined && isPositiveInt(cap) && typeof s.duration === 'number') {
					const iv = Math.round((eff.trigger.interval ?? 0) * 60);
					const first =
						eff.trigger.firstTickDelay !== undefined
							? Math.round(eff.trigger.firstTickDelay * 60)
							: iv;
					const end = Math.round(s.duration * 60);
					if (iv > 0 && end > first) {
						const derived = Math.ceil((end - first) / iv);
						if (cap === derived) {
							push(
								'strict',
								'summon-tick-cap-invalid',
								`summonTick tickCap on summon "${s.label}" restates the derived count (${derived} from duration ${s.duration}s / interval ${eff.trigger.interval}s); omit it — absent means derived`,
								a.id
							);
						}
					}
				}
				lintIcdGate(eff.trigger.icdGate, 'summonTick', s.label, a.id, push);
			}

			// (D.27e) ⚓ THE WAVE — `whileNormalAttacking`, the coordinated attack
			// that fires while the ACTIVE character is normal-attacking
			// (coordinated-attack round, 2026-08-18). Placement and shape are
			// checked in lintEffect (B.13c); the cadence is checked here, beside the
			// summon-tick one it mirrors.
			if (eff.trigger.type === 'whileNormalAttacking') {
				if (!isPositiveNumber(eff.trigger.interval)) {
					push(
						'strict',
						'wave-interval-invalid',
						`whileNormalAttacking effect on summon "${s.label}" requires a positive interval in SECONDS (got ${eff.trigger.interval})`,
						a.id
					);
				}
				lintIcdGate(eff.trigger.icdGate, 'whileNormalAttacking', s.label, a.id, push);
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
				cond.type === 'enemyHpAbove' &&
				(typeof cond.threshold !== 'number' ||
					!Number.isFinite(cond.threshold) ||
					cond.threshold <= 0 ||
					cond.threshold > 100)
			) {
				push(
					'strict',
					'durationext-enemy-hp-above-invalid',
					`${where} enemyHpAbove.threshold must be a number in (0, 100] (got ${JSON.stringify(cond.threshold)})`,
					abilityId
				);
			}
			if (
				cond.type === 'recipientHpBelow' &&
				(typeof cond.threshold !== 'number' ||
					!Number.isFinite(cond.threshold) ||
					cond.threshold <= 0 ||
					cond.threshold > 100)
			) {
				push(
					'strict',
					'durationext-recipient-hp-below-invalid',
					`${where} recipientHpBelow.threshold must be a number in (0, 100] (got ${JSON.stringify(cond.threshold)})`,
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
	ctx: { isPassiveOrConstellation: boolean; isSummon?: boolean }
): void {
	// (B.8) effects on passive/constellation with onCast/afterDuration must set trigger.ability
	if (ctx.isPassiveOrConstellation) {
		const t = eff.trigger;
		if ((t.type === 'onCast' || t.type === 'afterDuration') && !t.ability) {
			// (B.8a) …and for a SHIELD it is not a preference. Since 2026-08-18
			// `registerShieldOnCast` reads passive/constellation effects too, and
			// its fall-through for an unbound onCast is the collectors' own —
			// fire on BOTH casts. For a Kazuha-C6 infusion that is deliberate;
			// for a shield it registers a whole extra bar on the wrong cast and
			// a second `shieldEnd` with it. All four onCast shields hosted this
			// way bind explicitly today, so this pins the property rather than
			// fixing anything. See docs/constellation-shield-gap.md.
			const sev = eff.type === 'shield' && t.type === 'onCast' ? 'strict' : 'warn';
			push(
				sev,
				sev === 'strict' ? 'shield-trigger-ability-missing' : 'trigger-ability-missing',
				sev === 'strict'
					? `shield effect on passive/constellation must set trigger.ability — an unbound onCast shield registers a window on BOTH the skill and the burst`
					: `effect on passive/constellation with trigger ${t.type} should set trigger.ability (omit only when intentionally firing on both skill and burst, like Kazuha C6)`,
				location
			);
		}
	}

	// (E.27) an unknown-value `description` is a DISPLAY LABEL, not prose.
	//
	// ⚠ It is rendered VERBATIM in the slot where a number would go
	// (`formatBuffDisplayValue`), on the timeline tooltip and in the Team
	// Builder's bonuses block — so it has to read like a value. Prune's A4
	// shipped a 182-char sentence that wrapped the tooltip to full width
	// (⚓ Nate, 2026-08-15); the rest of the corpus sits at 23–48, and the
	// house form is Arlecchino's "+1% per 100 ATK above 1000, cap 20%".
	//
	// ⛔ Explanation does NOT belong here, and mostly does not belong in a
	// `caveat` either — the style guide reserves those for the timeline
	// visibly diverging from the game. Kit mechanics go to `_curatorNotes`.
	if ((eff.type === 'buff' || eff.type === 'elevate') && typeof eff.value === 'object') {
		const v = eff.value as { type?: string; description?: string };
		if (v.type === 'unknown' && typeof v.description === 'string') {
			const n = v.description.length;
			if (n > UNKNOWN_VALUE_FAIL_LENGTH) {
				push(
					'strict',
					'unknown-value-description-too-long',
					`unknown-value description is ${n} chars (hard cap ${UNKNOWN_VALUE_FAIL_LENGTH}) — it renders verbatim where a number goes; shorten to a label like "+2.5% per 100 ATK above 2,000, cap 50%" and move the explanation to _curatorNotes`,
					location
				);
			} else if (n > UNKNOWN_VALUE_WARN_LENGTH) {
				push(
					'warn',
					'unknown-value-description-long',
					`unknown-value description is ${n} chars (corpus norm is 23–48) — it renders verbatim where a number goes; prefer a terse label`,
					location
				);
			}
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
		const src = eff.trigger.source;
		if (src !== undefined && src !== 'self' && src !== 'team' && src !== 'active') {
			push(
				'strict',
				'invalid-reaction-source',
				`onReaction trigger source must be 'self', 'team' or 'active' (got ${JSON.stringify(src)})`,
				location
			);
		}
		// (B.12d) `source` is REQUIRED (2026-09-15). Every reader defaults an absent
		// source to `'self'` — only the HOLDER's reactions fire it — and the
		// essential-characters scoping found that default silently wrong on the
		// effects a reader looks for most: Chevreuse's A1 shred ("after a character
		// triggers"), Citlali's A1 + C2 ("nearby party members"), Clorinde's C2,
		// Ororon's Hypersense — all self-only, so in their canonical teams they drew
		// NOTHING. An omission is invisible; a stated `'self'` is a claim the author
		// made. So the field is demanded, and "who may fire this" is read off the
		// kit text every time (docs/curation/essential-characters-2026-09-15.md §1.C).
		if (src === undefined) {
			push(
				'strict',
				'reaction-source-missing',
				`onReaction trigger must state source ('self' | 'team' | 'active') — an absent source defaults to 'self' and that default has been wrong per kit text; say who may fire it`,
				location
			);
		}

		// (B.12b) armedFor — the MARK's lifetime in seconds, so a positive number.
		const armedFor = eff.trigger.armedFor;
		if (armedFor !== undefined && !isPositiveNumber(armedFor)) {
			push(
				'strict',
				'armed-for-invalid',
				`onReaction trigger armedFor must be a positive number of seconds (got ${JSON.stringify(armedFor)})`,
				location
			);
		}

		// (B.12c) ⚓ A REACTION PROC MUST HAVE A WINDOW. A `damage` effect carrying
		// an `application[]` is the fourth source that feeds the gauge
		// (`sim/reactionProcs.ts`); armed by a cast it needs `armedFor`, and armed
		// by a summon it needs none — the summon's own liveness is the window.
		// ⛔ Without one it would listen for the rest of the rotation, which is
		// never what a kit says, so the sim refuses to arm it and this reports why.
		if (eff.type === 'damage' && eff.application && eff.application.length > 0) {
			if (!ctx.isSummon && armedFor === undefined) {
				push(
					'strict',
					'reaction-proc-unarmed',
					`onReaction damage effect with application[] needs trigger.armedFor (the mark's lifetime in seconds) unless it is hosted on a summon`,
					location
				);
			}
			if (ctx.isSummon && armedFor !== undefined) {
				push(
					'strict',
					'reaction-proc-double-window',
					`onReaction damage effect on a summon must not set trigger.armedFor — the summon's own lifetime is the window`,
					location
				);
			}
		}
	}

	// (B.14) ⚓ `onFieldDelay` IS A PER-RECEIVER QUESTION, so it is only
	// answerable on an `active`-target buff — the one scope where a slice knows
	// WHO is receiving and when they arrived. On a team/self/enemy target there
	// is nobody to have been standing there, and the field would read as a
	// promise the projection cannot keep.
	if (eff.type === 'buff' && eff.onFieldDelay !== undefined) {
		// ⚠️ Restated rather than imported (`isActiveTargetOnly` in
		// effectCollection.ts) for the reason at the head of this file: no runtime
		// imports. One line, and the shape is `target === 'active'` exactly.
		if (Array.isArray(eff.target) || eff.target !== 'active') {
			push(
				'strict',
				'on-field-delay-not-active',
				`onFieldDelay is only read on a target:'active' buff — a per-receiver slice is the only scope that knows how long the receiver has been on field`,
				location
			);
		}
		if (!isPositiveNumber(eff.onFieldDelay.seconds)) {
			push(
				'strict',
				'on-field-delay-invalid',
				`onFieldDelay.seconds must be a positive number of seconds (got ${JSON.stringify(eff.onFieldDelay.seconds)})`,
				location
			);
		}
	}

	// (B.13b) ⚓ AN `onHit` DAMAGE PROC MUST HAVE A WINDOW AND A COOLDOWN
	// (coordinated-attack round, 2026-08-18). Beidou's Stormbreaker, Raiden's Eye,
	// Albedo's Transient Blossom, Dehya's Fiery Sanctum, Nicole's burst.
	//
	// ⚓ A BUFF on `onHit` needs neither and must not carry `armedFor`: it is armed
	// for as long as its holder is on the team, and `buffWindows` derives its span
	// from the hit. A damage proc is the opposite — without a window it listens for
	// the rest of the rotation, and without a cooldown it fires on EVERY hit in a
	// stream that now includes summon ticks and other procs.
	if (eff.trigger.type === 'onHit') {
		const isDamageProc = eff.type === 'damage' && !!eff.application && eff.application.length > 0;
		const armedFor = eff.trigger.armedFor;
		if (armedFor !== undefined && !isPositiveNumber(armedFor)) {
			push(
				'strict',
				'armed-for-invalid',
				`onHit trigger armedFor must be a positive number of seconds (got ${JSON.stringify(armedFor)})`,
				location
			);
		}
		if (armedFor !== undefined && !isDamageProc) {
			push(
				'strict',
				'hit-proc-armed-for-unread',
				`onHit trigger armedFor is read only by the damage-proc path — put it on a damage effect that carries an application[], or drop it`,
				location
			);
		}
		if (isDamageProc) {
			if (!ctx.isSummon && armedFor === undefined) {
				push(
					'strict',
					'hit-proc-unarmed',
					`onHit damage effect with application[] needs trigger.armedFor (how long the proc listens, in seconds) unless it is hosted on a summon`,
					location
				);
			}
			if (ctx.isSummon && armedFor !== undefined) {
				push(
					'strict',
					'hit-proc-double-window',
					`onHit damage effect on a summon must not set trigger.armedFor — the summon's own lifetime is the window`,
					location
				);
			}
			// ⚓ The ICD is the whole mechanism. Every authored proc states one
			// (0.9 s Raiden … 3 s Nicole), and `MIN_REPROC_F` is a one-frame
			// termination floor, ⛔ never a stand-in for a real cooldown.
			if (eff.procCooldown === undefined) {
				push(
					'strict',
					'hit-proc-no-cooldown',
					`onHit damage effect with application[] needs procCooldown — it listens to every damage-dealing hit, summon ticks included`,
					location
				);
			}
		}
	}

	// (B.13c) ⚓ A WAVE IS SUMMON-HOSTED, ALWAYS. All four authors (Xingqiu Q,
	// Yelan Q, Thoma Q, Fischl C6) hang off a summon that was already authored, so
	// the summon's own liveness IS the window — and its lane is where the measured
	// fire markers are drawn. An ability-hosted wave would have neither.
	if (eff.trigger.type === 'whileNormalAttacking') {
		if (!ctx.isSummon) {
			push(
				'strict',
				'wave-not-on-summon',
				`whileNormalAttacking is only valid on a summon's effects[] — the summon's lifetime is the wave's window and its lane is where the fires are drawn`,
				location
			);
		}
		if (eff.type !== 'damage' || !eff.application || eff.application.length === 0) {
			push(
				'strict',
				'wave-no-application',
				`whileNormalAttacking must be a damage effect carrying an application[] — a wave TRAVELS, and the frame offset is what application[] says`,
				location
			);
		}
	}

	// (B.12d) An effect-level `application[]` — the FOURTH application source.
	// ⚠️ Its absent case is NOT the ability's: on an ability an absent list means
	// UNMEASURED, here it means "does not reach the aura". So an authored entry
	// has to be complete — a frame, and a real element.
	if (eff.type === 'damage' && eff.application !== undefined) {
		// ↻ THREE triggers read it since the coordinated-attack round (2026-08-18):
		// `onReaction` (somebody reacted), `onHit` (the opponent took damage) and
		// `whileNormalAttacking` (the active character is swinging). ⚓ One list,
		// shared with the sim's acceptance rule, so the lint can never accept an
		// effect the sim ignores.
		if (!(PROC_TRIGGERS as readonly string[]).includes(eff.trigger.type)) {
			push(
				'strict',
				'effect-application-unread',
				`effect-level application[] is only read on a proc trigger (${PROC_TRIGGERS.join(', ')}) — got "${eff.trigger.type}"; a summon tick's application comes from the summonTick path`,
				location
			);
		}
		eff.application.forEach((app, i) => {
			if (!Number.isFinite(app.frame) || app.frame < 0) {
				push(
					'strict',
					'effect-application-frame-invalid',
					`application[${i}].frame must be a non-negative frame offset from the trigger (got ${JSON.stringify(app.frame)})`,
					location
				);
			}
			if (app.element !== undefined && !DAMAGE_ELEMENTS.has(app.element)) {
				push(
					'strict',
					'effect-application-element-invalid',
					`application[${i}].element "${app.element}" is not a valid Element`,
					location
				);
			}
			if (app.units !== undefined && !isPositiveNumber(app.units)) {
				push(
					'strict',
					'effect-application-units-invalid',
					`application[${i}].units must be positive gauge units (got ${JSON.stringify(app.units)})`,
					location
				);
			}
		});
	}

	// (D.31b) onHit abilityType — one of the five hit classes, or a non-empty
	// array of them (array = any listed class under ONE shared procCooldown
	// clock — Escoffier C6's NA/CA/PL 0.5s ICD).
	if (eff.trigger.type === 'onHit' && eff.trigger.abilityType !== undefined) {
		const HIT_CLASSES = new Set(['skill', 'burst', 'normal', 'charged', 'plunge']);
		const at = eff.trigger.abilityType as unknown;
		const entries = Array.isArray(at) ? at : [at];
		if (entries.length === 0 || entries.some((e) => typeof e !== 'string' || !HIT_CLASSES.has(e))) {
			push(
				'strict',
				'onhit-ability-type-invalid',
				`onHit abilityType must be a hit class or non-empty array of hit classes (got ${JSON.stringify(at)})`,
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

	// (D.34) canonicalAssumption retired 2026-07-20 (cA-fold): any lingering
	// field is a schema violation now.
	if ((eff as { canonicalAssumption?: unknown }).canonicalAssumption !== undefined) {
		push(
			'strict',
			'buff-canonical-assumption-retired',
			`canonicalAssumption was retired — state the assumption in the ability-level caveat instead`,
			location
		);
	}

	// (D.33) onShieldEnd trigger shape — source / ability / procCooldown valid
	if (eff.trigger.type === 'onShieldEnd') {
		const t = eff.trigger as { source?: unknown; ability?: unknown };
		if (t.source !== undefined && t.source !== 'self' && t.source !== 'team') {
			push(
				'strict',
				'onshieldend-source-invalid',
				`onShieldEnd trigger source must be 'self' or 'team' when present (got ${JSON.stringify(t.source)})`,
				location
			);
		}
		if (t.ability !== undefined && t.ability !== 'skill' && t.ability !== 'burst') {
			push(
				'strict',
				'onshieldend-ability-invalid',
				`onShieldEnd trigger ability must be 'skill' or 'burst' when present (got ${JSON.stringify(t.ability)})`,
				location
			);
		}
		const pc = eff.procCooldown;
		if (pc !== undefined) {
			if (typeof pc === 'number') {
				if (!Number.isFinite(pc) || pc < 0) {
					push(
						'strict',
						'onshieldend-proc-cooldown-invalid',
						`onShieldEnd procCooldown must be a non-negative finite number when present (got ${JSON.stringify(pc)})`,
						location
					);
				}
			}
			// ScaledValue form is accepted but rare; per-refinement validation
			// is handled by the existing procCooldown lint elsewhere.
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

	// (B.13a) optional `flat` addend on damage/heal/shield: positive finite when
	// present. Anything non-positive or non-finite indicates a transcription
	// error. (shield gained `flat` 2026-07-12.)
	if (eff.type === 'damage' || eff.type === 'heal' || eff.type === 'shield') {
		const flat = (eff as { flat?: unknown }).flat;
		if (flat !== undefined) {
			if (typeof flat !== 'number' || !Number.isFinite(flat) || flat <= 0) {
				push(
					'strict',
					`${eff.type}-flat-invalid`,
					`${eff.type} flat must be a positive finite number when present (got ${JSON.stringify(flat)})`,
					location
				);
			}
		}
	}

	// (B.13a.2) optional `flatScaling` stat-scaled addend on damage/heal: object
	// with `{ stat, ratio }` both required, ratio positive finite, stat a valid
	// ScalingStat. Seeded for Aino A4 (+50% Aino's EM as Hydro flat DMG on every
	// burst tick); the schema preserves `flat` and `flatScaling` as independent
	// addends that sum at evaluation time.
	if (eff.type === 'damage' || eff.type === 'heal') {
		const fs = (eff as { flatScaling?: unknown }).flatScaling;
		if (fs !== undefined) {
			if (typeof fs !== 'object' || fs === null || Array.isArray(fs)) {
				push(
					'strict',
					`${eff.type}-flat-scaling-shape-invalid`,
					`${eff.type} flatScaling must be an object with { stat, ratio } when present (got ${JSON.stringify(fs)})`,
					location
				);
			} else {
				const fso = fs as { stat?: unknown; ratio?: unknown };
				const hasStat = fso.stat !== undefined;
				const hasRatio = fso.ratio !== undefined;
				if (!hasStat || !hasRatio) {
					push(
						'strict',
						`${eff.type}-flat-scaling-shape-invalid`,
						`${eff.type} flatScaling must have both stat and ratio fields (got ${JSON.stringify(fs)})`,
						location
					);
				} else {
					if (typeof fso.stat !== 'string' || !SCALING_STATS.has(fso.stat)) {
						push(
							'strict',
							`${eff.type}-flat-scaling-stat-invalid`,
							`${eff.type} flatScaling.stat must be a valid ScalingStat (got ${JSON.stringify(fso.stat)})`,
							location
						);
					}
					if (typeof fso.ratio !== 'number' || !Number.isFinite(fso.ratio) || fso.ratio <= 0) {
						push(
							'strict',
							`${eff.type}-flat-scaling-shape-invalid`,
							`${eff.type} flatScaling.ratio must be a positive finite number (got ${JSON.stringify(fso.ratio)})`,
							location
						);
					}
				}
			}
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
	// max ≥ 1 when present, trigger one of onCast / onReaction / onHit (all
	// three dispatch parser-side since the onHit wiring, 2026-07-17).
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
		if (
			eff.trigger.type !== 'onCast' &&
			eff.trigger.type !== 'onReaction' &&
			eff.trigger.type !== 'onHit'
		) {
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
			if (
				!Array.isArray(inputs) ||
				inputs.length === 0 ||
				inputs.some((s) => typeof s !== 'string' || s.length === 0)
			) {
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
		// (B.13f) gainStacks lifetime — positive finite number when present.
		// Each granted instance lives independently for `lifetime` seconds before
		// expiring. Mutually exclusive with `drain` — the two decay shapes are
		// incompatible (drain is continuous-rate, lifetime is discrete per-instance).
		if (eff.lifetime !== undefined) {
			if (
				typeof eff.lifetime !== 'number' ||
				!Number.isFinite(eff.lifetime) ||
				(eff.lifetime as number) <= 0
			) {
				push(
					'strict',
					'gainstacks-lifetime-invalid',
					`gainStacks lifetime must be a positive finite number (got ${JSON.stringify(eff.lifetime)})`,
					location
				);
			}
			if (eff.drain !== undefined) {
				push(
					'strict',
					'gainstacks-lifetime-drain-conflict',
					`gainStacks cannot declare both drain and lifetime on the same effect — pick one decay shape`,
					location
				);
			}
		}
		// (B.13g) gainStacks constellationScaling — when present must carry both
		// `conditions` (a Condition object) and an `amount` (positive finite
		// number; mirrors the base-amount validation). Mirrors the existing
		// `BuffEffect.constellationScaling` shape; only `amount` is overridable
		// (max / lifetime / drain carry through unchanged).
		if (eff.constellationScaling !== undefined) {
			const cs = eff.constellationScaling as { conditions?: unknown; amount?: unknown };
			if (
				cs.conditions === undefined ||
				cs.conditions === null ||
				typeof cs.conditions !== 'object'
			) {
				push(
					'strict',
					'gainstacks-constellation-scaling-conditions-invalid',
					`gainStacks constellationScaling.conditions must be a Condition object`,
					location
				);
			}
			if (
				typeof cs.amount !== 'number' ||
				!Number.isFinite(cs.amount) ||
				(cs.amount as number) <= 0
			) {
				push(
					'strict',
					'gainstacks-constellation-scaling-amount-invalid',
					`gainStacks constellationScaling.amount must be a positive finite number (got ${JSON.stringify(cs.amount)})`,
					location
				);
			}
		}
		// (B.13h) gainStacks sourceLifetime — positive finite when present.
		// Per-source slot expiry (Skirk A4). Mutually exclusive with both
		// `drain` (continuous-rate decay) and `lifetime` (per-grant expiry)
		// — the three decay shapes describe non-overlapping mechanics.
		if (eff.sourceLifetime !== undefined) {
			if (
				typeof eff.sourceLifetime !== 'number' ||
				!Number.isFinite(eff.sourceLifetime) ||
				(eff.sourceLifetime as number) <= 0
			) {
				push(
					'strict',
					'gainstacks-source-lifetime-invalid',
					`gainStacks sourceLifetime must be a positive finite number (got ${JSON.stringify(eff.sourceLifetime)})`,
					location
				);
			}
			if (eff.drain !== undefined) {
				push(
					'strict',
					'gainstacks-source-lifetime-drain-conflict',
					`gainStacks cannot declare both drain and sourceLifetime on the same effect — pick one decay shape`,
					location
				);
			}
			if (eff.lifetime !== undefined) {
				push(
					'strict',
					'gainstacks-source-lifetime-lifetime-conflict',
					`gainStacks cannot declare both lifetime and sourceLifetime on the same effect — pick one decay shape`,
					location
				);
			}
		}
		// (B.13i) onHit gainStacks with team/others source must carry a decay
		// shape (sourceLifetime or lifetime): the grant accrues ROTATION-WIDE
		// (the holder may be off-field), so an unbounded shape would grow
		// without expiry. `source: 'self'` grants are per-segment (a swap
		// clears them — Yanfei's Scarlet Seals) and may be plain.
		if (
			eff.trigger.type === 'onHit' &&
			(eff.trigger.source === 'team' || eff.trigger.source === 'others') &&
			eff.sourceLifetime === undefined &&
			eff.lifetime === undefined
		) {
			push(
				'strict',
				'gainstacks-onhit-unbounded',
				`onHit gainStacks with source "${eff.trigger.source}" accrues rotation-wide and must declare a decay shape (sourceLifetime or lifetime)`,
				location
			);
		}
		// (B.13j) gainStacks scope — the two legal values, and ⛔ NOT on a
		// team/others onHit grant. Those already accrue rotation-wide via
		// `CharState.onHitStacks`, for a different reason (the HOLDER may be off
		// field, rather than the RESOURCE outliving a segment) — declaring a scope
		// there would give one key two homes and split its count between them.
		if (eff.scope !== undefined) {
			if (eff.scope !== 'segment' && eff.scope !== 'rotation') {
				push(
					'strict',
					'gainstacks-scope-invalid',
					`gainStacks scope must be "segment" or "rotation" (got ${JSON.stringify(eff.scope)})`,
					location
				);
			} else if (
				eff.scope === 'rotation' &&
				eff.trigger.type === 'onHit' &&
				(eff.trigger.source === 'team' || eff.trigger.source === 'others')
			) {
				push(
					'strict',
					'gainstacks-scope-redundant',
					`onHit gainStacks with source "${eff.trigger.source}" already accrues rotation-wide on the holder's CharState; declaring scope "rotation" would split the key between two containers`,
					location
				);
			}
		}
	}

	// (B.13e) consumeStacks shape — non-empty key, amount is "all" or a positive
	// finite number, trigger onCast or onHit (both dispatch parser-side since
	// the onHit wiring, 2026-07-17 — Yanfei's CA-hit seal consume).
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
		if (eff.trigger.type !== 'onCast' && eff.trigger.type !== 'onHit') {
			push(
				'strict',
				'consumestacks-trigger-invalid',
				`consumeStacks effect trigger.type must be "onCast" or "onHit" (got "${eff.trigger.type}")`,
				location
			);
		}
		if (eff.trigger.type === 'onCast' && eff.trigger.input !== undefined) {
			const inputs = eff.trigger.input as unknown;
			if (
				!Array.isArray(inputs) ||
				inputs.length === 0 ||
				inputs.some((s) => typeof s !== 'string' || s.length === 0)
			) {
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
	if (eff.type === 'resShred') {
		const shredStat = (eff as { shredStat?: string }).shredStat;
		if (shredStat !== undefined && shredStat !== 'res' && shredStat !== 'def') {
			push(
				'strict',
				'resshred-shredstat-invalid',
				`resShred shredStat "${shredStat}" must be 'res' or 'def'`,
				location
			);
		}
		if (shredStat === 'def' && eff.element !== undefined) {
			push(
				'strict',
				'resshred-def-with-element',
				`resShred with shredStat 'def' must not set element (DEF shred is element-agnostic)`,
				location
			);
		}
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
				`buff value must be number or object (ScaledValue / scaling / unknown / ramping / decaying / perStack / perTeamCount); got ${typeof v}`,
				location
			);
		} else if (typeof v === 'object') {
			const obj = v as Record<string, unknown>;
			const isScaled = Array.isArray(obj.refinementValues);
			const isTagged =
				typeof obj.type === 'string' &&
				['scaling', 'unknown', 'ramping', 'decaying', 'perStack', 'perTeamCount'].includes(
					obj.type as string
				);
			if (!isScaled && !isTagged) {
				push(
					'warn',
					'buff-value-shape',
					`buff value object is neither ScaledValue nor a tagged variant (scaling/unknown/ramping/decaying/perStack/perTeamCount)`,
					location
				);
			}
			// (D.38) scaling `offset` — the THRESHOLD the stat must exceed. Must be
			// a finite positive number in the host stat's units. ⚠️ Zero is not a
			// legal offset: it means "no threshold", which is what OMITTING it
			// says, and an authored 0 reads as a deliberate claim that the kit
			// states one. Keeps the display honest ("above 0" is noise).
			if (obj.type === 'scaling' && obj.offset !== undefined) {
				if (
					typeof obj.offset !== 'number' ||
					!Number.isFinite(obj.offset as number) ||
					(obj.offset as number) <= 0
				) {
					push(
						'strict',
						'scaling-offset-invalid',
						`scaling buff value offset must be a positive finite number (got ${JSON.stringify(obj.offset)}); omit it when the kit states no threshold`,
						location
					);
				}
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
					if (
						typeof obj.cap !== 'number' ||
						!Number.isFinite(obj.cap) ||
						(obj.cap as number) <= 0
					) {
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
		// (D.34b) enemyHpAbove condition shape — threshold in (0, 100]. Mirrors enemyHpBelow.
		if (cond.type === 'enemyHpAbove') {
			if (
				typeof cond.threshold !== 'number' ||
				!Number.isFinite(cond.threshold) ||
				cond.threshold <= 0 ||
				cond.threshold > 100
			) {
				push(
					'strict',
					'enemy-hp-above-threshold-invalid',
					`enemyHpAbove.threshold must be a number in (0, 100] (got ${JSON.stringify(cond.threshold)})`,
					location
				);
			}
		}
		// (D.34c) recipientHpBelow condition shape — threshold in (0, 100]. Gates on the
		// effect's recipient (the active char for target:'active', the holder for
		// target:'self', etc). Resolves to null at planner time; renders optimistically.
		if (cond.type === 'recipientHpBelow') {
			if (
				typeof cond.threshold !== 'number' ||
				!Number.isFinite(cond.threshold) ||
				cond.threshold <= 0 ||
				cond.threshold > 100
			) {
				push(
					'strict',
					'recipient-hp-below-threshold-invalid',
					`recipientHpBelow.threshold must be a number in (0, 100] (got ${JSON.stringify(cond.threshold)})`,
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
		// (D.37) teamElementCount condition shape — non-empty elements array,
		// integer-valid value, recognized comparison op. Resolves at evaluation
		// time when teamElementCounts context is provided (renderer side); the
		// excludeSelf semantic is baked into the pre-computed map.
		if (cond.type === 'teamElementCount') {
			if (!Array.isArray(cond.elements) || cond.elements.length === 0) {
				push(
					'strict',
					'condition-team-element-count-elements-invalid',
					`teamElementCount.elements must be a non-empty array of Element keys (got ${JSON.stringify(cond.elements)})`,
					location
				);
			} else {
				for (const el of cond.elements) {
					if (typeof el !== 'string' || !CHARACTER_ELEMENTS.has(el)) {
						push(
							'strict',
							'condition-team-element-count-elements-invalid',
							`teamElementCount.elements contains invalid element ${JSON.stringify(el)} (must be one of cryo/dendro/electro/hydro/pyro/anemo/geo — physical is excluded since no character has physical as their element)`,
							location
						);
						break;
					}
				}
			}
			if (typeof cond.value !== 'number' || !Number.isInteger(cond.value) || cond.value < 0) {
				push(
					'strict',
					'condition-team-element-count-value-invalid',
					`teamElementCount.value must be a non-negative integer (got ${JSON.stringify(cond.value)})`,
					location
				);
			}
			if (cond.comparison !== '>=' && cond.comparison !== '=' && cond.comparison !== '<=') {
				push(
					'strict',
					'condition-team-element-count-comparison-invalid',
					`teamElementCount.comparison must be one of '>=' / '=' / '<=' (got ${JSON.stringify(cond.comparison)})`,
					location
				);
			}
		}
	});
}
