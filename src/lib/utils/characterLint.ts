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
	AbsorbSpec,
	Ability,
	FrameMap,
	AbilityVariant,
	Condition,
	Effect,
	ElementalApplication,
	ElementRef,
	IcdWindow,
	NormalAbility,
	SkillAbility,
	BurstAbility,
	Summon
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
const STANDARD_ICD_FRAMES = { timer: 150, hits: 3, cap: 8 };

/**
 * (D.27f) An `IcdWindow.cap`'s shape, ONE check for all three window sites
 * (ICD cap round, 2026-10-04). A cap is a COUNT, so it has no unit trap; what
 * it has is two ways to say nothing: without `every` only the window's first
 * hit applies, and `cap: 1` IS that — both spell "first only" the long way.
 */
function icdCapProblem(w: IcdWindow): string | null {
	if (w.cap === undefined) return null;
	if (!isPositiveInt(w.cap)) return `cap must be a positive integer when present (got ${w.cap})`;
	if (w.every === undefined)
		return `cap without every says nothing — only the window's first hit applies; omit it`;
	if (w.cap < 2) return `cap 1 is "first only"; omit both every and cap`;
	return null;
}

/** Is this window the standard one spelled out? ⚓ A cap absent and a cap of 8
 *  are the same rule at the standard's timer and period. */
const restatesStandard = (w: IcdWindow): boolean =>
	w.timer === STANDARD_ICD_FRAMES.timer &&
	w.every === STANDARD_ICD_FRAMES.hits &&
	(w.cap === undefined || w.cap === STANDARD_ICD_FRAMES.cap);

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
	'swirlReactionBonus',
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
	'skillDefIgnore',
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

const TARGETS = new Set([
	'self',
	'team',
	'teamExcludingSelf',
	'active',
	'next',
	'enemy',
	'reactor'
]);

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
	'soloDanceDouble',
	// Mavuika's Ring (DEF & RES pass, 2026-10-06).
	'searingRing',
	'pneuma',
	// Lauma's two charged forms (charged-forms round, 2026-09-16).
	'spiritEnvoy',
	'envoyCooldown',
	// Varesa's Follow-Up Strike (T1 tranche, 2026-09-17).
	'followUpStrike',
	// Illuga's Haunted Night's Oriole-Song (event-ended buffs round, 2026-09-21).
	'orioleSong',
	// Mavuika's Flamestrider form (Nightsoul round, 2026-10-16).
	'flamestrider'
]);

const ABILITY_TYPES = new Set(['normal', 'skill', 'burst', 'passive', 'constellation']);
const BEHAVIORS = new Set(['instant', 'persistent', 'stance']);
const SUMMON_TERMINATES = new Set(['swap', 'recast', 'skill', 'burst']);
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

/** A FrameMap entry's value: a positive integer — or, for `lands` alone, the LIST
 *  form (every-landing round, 2026-09-21): two or more positive integers, first
 *  to last. ⚠️ Equal neighbours are legal (two hits on one frame); a one-element
 *  list is not — that is the scalar. */
function isFrameValue(k: string, v: unknown): boolean {
	if (k === 'lands' && Array.isArray(v))
		return v.length >= 2 && v.every(isPositiveInt) && v.every((f, i) => i === 0 || f >= v[i - 1]);
	return isPositiveInt(v);
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

/** Every `{type:'state'}` node inside one RAW condition tree, with its path.
 *  Raw rather than typed because the `source` qualifier is exactly the kind of
 *  key TypeScript stops seeing once the JSON is cast to `CharacterData`. */
function walkRawStateNodes(
	node: unknown,
	path: string,
	fn: (node: { state?: unknown; source?: unknown }, path: string) => void
): void {
	if (typeof node !== 'object' || node === null) return;
	if (Array.isArray(node)) {
		node.forEach((n, i) => walkRawStateNodes(n, `${path}[${i}]`, fn));
		return;
	}
	const raw = node as Record<string, unknown>;
	if (raw.type === 'state') fn(raw, path);
	for (const [key, value] of Object.entries(raw)) {
		if (typeof value === 'object') walkRawStateNodes(value, `${path}.${key}`, fn);
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

/** `CharacterMeta.framesSource`'s members (lint E.31). */
const FRAMES_SOURCES = ['gcsim', 'gcsim-pr', 'wiki', 'hand'];

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

	// (E.31) frames provenance is a closed vocabulary (coverage round §5.3).
	const fs = (c.meta as { framesSource?: unknown } | undefined)?.framesSource;
	if (fs !== undefined && !FRAMES_SOURCES.includes(fs as string))
		push(
			'strict',
			'frames-source-value',
			`meta.framesSource "${String(fs)}" is not one of ${FRAMES_SOURCES.join(' / ')}`
		);
	if (!hasSkillOrBurst)
		push('warn', 'missing-cast-ability', 'character has no skill or burst ability');

	// (D.50) A CHANNELLED Charged Attack and the droplets it absorbs
	// (`ChargeChannel`, Neuvillette's Equitable Judgment, 2026-10-17): every
	// number a non-negative integer of FRAMES, the charge-up shrinking with each
	// droplet, the hits ascending (the last is the beam's end), and droplets only
	// on a kit whose channel can absorb them — nothing else reads them.
	{
		const isFrames = (n: unknown, min = 0) =>
			typeof n === 'number' && Number.isInteger(n) && n >= min;
		let hasChannel = false;
		for (const a of c.abilities) {
			if (a.abilityType !== 'normal' || a.chargeChannel === undefined) continue;
			hasChannel = true;
			const ch = a.chargeChannel;
			const bad = (msg: string) => push('strict', 'charge-channel-shape', msg, a.id);
			if (!isFrames(ch.windup) || !isFrames(ch.absorbAt) || !isFrames(ch.dropletLife, 1))
				bad('chargeChannel windup / absorbAt / dropletLife must be integers of FRAMES');
			if (
				ch.chargeUp?.length !== 4 ||
				!ch.chargeUp.every((n, i) => isFrames(n) && (i === 0 || n <= ch.chargeUp[i - 1]))
			)
				bad(
					'chargeChannel chargeUp must be four FRAMES values, one per droplet count 0–3, never growing'
				);
			if (
				!ch.hits?.length ||
				!ch.hits.every((n, i) => isFrames(n, 1) && (i === 0 || n > ch.hits[i - 1]))
			)
				bad('chargeChannel hits must be ascending positive FRAMES (the last is the beam end)');
			if (!Object.values(ch.endLag ?? {}).every((n) => isFrames(n)))
				bad('chargeChannel endLag values must be integers of FRAMES');
		}
		for (const a of c.abilities) {
			if ((a.abilityType !== 'skill' && a.abilityType !== 'burst') || !a.spawnsDroplets) continue;
			if (!hasChannel)
				push(
					'strict',
					'droplets-unread',
					`${a.id} drops droplets, but no Charged Attack channels to absorb them`,
					a.id
				);
			if (!a.spawnsDroplets.every((d) => isFrames(d.at) && isFrames(d.count, 1)))
				push(
					'strict',
					'droplets-shape',
					`${a.id} spawnsDroplets entries need integer FRAMES \`at\` and a positive \`count\``,
					a.id
				);
		}
	}

	// (D.51) A TIMED BLESSING and what feeds it (Varesa's Fiery Passion,
	// 2026-10-17): points only on a kit with the Blessing (nothing else reads
	// them), a plunge either adds or spends, and a shared charge pool names a
	// real sibling skill that keeps its own.
	{
		const tb = c.timedBlessing;
		const bad = (msg: string, id?: string) => push('strict', 'timed-blessing-shape', msg, id);
		if (tb && (!(tb.max > 0) || !(tb.duration > 0)))
			bad('timedBlessing max and duration (seconds) must be positive');
		for (const a of c.abilities) {
			const pts =
				a.abilityType === 'skill' || a.abilityType === 'burst'
					? [a.blessingPoints, ...(a.variants ?? []).map((v) => v.blessingPoints)]
					: [];
			const pl = a.abilityType === 'normal' ? a.plungeBlessing : undefined;
			if (!tb && (pts.some((x) => x !== undefined) || pl))
				bad(`${a.id} feeds a timed Blessing the character does not have`, a.id);
			if (pl && (pl.spendsAll === true) === (pl.points !== undefined))
				bad(
					`${a.id} plungeBlessing must either add points or spend all, not both or neither`,
					a.id
				);
			if (a.abilityType === 'skill' && a.sharesChargesWith !== undefined) {
				const sib = c.abilities.find((x) => x.id === a.sharesChargesWith);
				if (
					!sib ||
					sib.abilityType !== 'skill' ||
					sib.id === a.id ||
					sib.sharesChargesWith !== undefined
				)
					bad(`${a.id} sharesChargesWith must name another skill that keeps its own pool`, a.id);
				else if ((sib.charges ?? 1) !== (a.charges ?? 1) || sib.cooldown !== a.cooldown)
					bad(`${a.id} shares ${sib.id}'s charges but states different charges or cooldown`, a.id);
			}
		}
	}

	// (D.55) A HELD CAST (Sayu, 2026-10-17): the hold is a SKILL VARIANT's, in
	// integer FRAMES; an entry marked `held` stands only on a form that holds,
	// and a `'during'` entry cannot land before the held phase begins.
	{
		const bad = (msg: string, id?: string) => push('strict', 'held-cast', msg, id);
		const whole = (n: unknown, min: number) =>
			typeof n === 'number' && Number.isInteger(n) && n >= min;
		for (const a of c.abilities) {
			if (a.abilityType !== 'skill' && a.abilityType !== 'burst') continue;
			if ((a as { held?: unknown }).held !== undefined)
				bad(`${a.id}: \`held\` belongs on a variant, never the cast itself`, a.id);
			if ((a.application ?? []).some((e) => e.held !== undefined))
				bad(`${a.id}: a \`held\` application entry needs a variant with \`held\``, a.id);
			for (const v of a.variants ?? []) {
				const where = `${a.id} variant "${v.label}"`;
				const h = v.held;
				if (h) {
					if (a.abilityType !== 'skill') bad(`${where}: only a skill holds`, a.id);
					if (!whole(h.max, 1) || !whole(h.from, 0))
						bad(`${where}: held.max/from must be integer FRAMES`, a.id);
					if (h.cooldownPerSecond !== undefined && !(h.cooldownPerSecond > 0))
						bad(`${where}: held.cooldownPerSecond must be positive`, a.id);
				}
				for (const e of v.application ?? []) {
					if (e.held === undefined) continue;
					if (!h) bad(`${where}: a \`held\` application entry needs \`held\``, a.id);
					else if (e.held === 'during' && e.frame < h.from)
						bad(`${where}: a 'during' entry at ${e.frame} lands before held.from`, a.id);
				}
			}
		}
	}

	// (D.54) ELEMENTAL ABSORPTION (absorption round, 2026-10-17): a lock is a
	// priority over the four absorbable elements in integer FRAMES; an absorbed
	// tick or entry names no element of its own and needs a lock on its host.
	{
		const ABSORBABLE = new Set(['pyro', 'hydro', 'electro', 'cryo']);
		const bad = (msg: string, id?: string) => push('strict', 'absorb-shape', msg, id);
		const frames = (n: unknown, min: number) =>
			typeof n === 'number' && Number.isInteger(n) && n >= min;
		const checkSpec = (spec: AbsorbSpec | undefined, where: string, id: string) => {
			if (!spec) return;
			if (!spec.order?.length || !spec.order.every((e) => ABSORBABLE.has(e)))
				bad(`${where}: absorbs.order must list pyro/hydro/electro/cryo`, id);
			if (!frames(spec.from, 0)) bad(`${where}: absorbs.from must be integer FRAMES`, id);
			if (spec.every !== undefined && !frames(spec.every, 1))
				bad(`${where}: absorbs.every must be positive integer FRAMES`, id);
			if (spec.polls !== undefined && (!frames(spec.polls, 1) || spec.every === undefined))
				bad(`${where}: absorbs.polls needs \`every\` and a positive count`, id);
		};
		const isAbsorbedRef = (el: unknown) =>
			typeof el === 'object' && el !== null && (el as { type?: string }).type === 'absorbed';
		for (const a of c.abilities) {
			if (a.abilityType !== 'skill' && a.abilityType !== 'burst') continue;
			const forms: { absorbs?: AbsorbSpec; application?: ElementalApplication[]; label: string }[] =
				[
					{ absorbs: a.absorbs, application: a.application, label: a.id },
					...(a.variants ?? []).map((v) => ({
						absorbs: v.absorbs ?? a.absorbs,
						application: v.application ?? a.application,
						label: `${a.id} variant "${v.label}"`
					}))
				];
			for (const f of forms) {
				checkSpec(f.absorbs, f.label, a.id);
				if ((f.application ?? []).some((e) => isAbsorbedRef(e.element)) && !f.absorbs)
					bad(`${f.label}: an absorbed application entry needs an \`absorbs\` lock`, a.id);
			}
			for (const sm of a.summons ?? []) {
				checkSpec(sm.absorbs, `${a.id} summon "${sm.label}"`, a.id);
				for (const e of sm.effects ?? []) {
					if (e.trigger.type !== 'summonTick') continue;
					const t = e.trigger;
					if (t.units !== undefined && !(t.units > 0))
						bad(`summon "${sm.label}": units must be positive`, a.id);
					// `travel` is read by the live chain alone, which publishes only an
					// ABSORBED series' marks — anywhere else it would bound the hits
					// and not the markers. Integer FRAMES, inside the first landing.
					if (t.travel !== undefined) {
						if (t.absorbed === undefined)
							bad(`summon "${sm.label}": travel is for an absorbed series only`, a.id);
						if (!frames(t.travel, 1) || t.travel > Math.round((t.firstTickDelay ?? 0) * 60))
							bad(
								`summon "${sm.label}": travel must be positive integer FRAMES within firstTickDelay`,
								a.id
							);
					}
					if (t.absorbed === undefined) continue;
					if (!sm.absorbs)
						bad(`summon "${sm.label}": an absorbed series needs the summon's \`absorbs\``, a.id);
					if (e.type !== 'damage' || e.element !== undefined)
						bad(
							`summon "${sm.label}": an absorbed series is a damage tick that names no element`,
							a.id
						);
				}
			}
		}
	}

	// (D.27i) `summonTick.icdCounter` — two SERIES on one named counter
	// (Alyosha's Field + Tugarin, 2026-10-16). One clock runs one window, so the
	// sharers must state the same `icdGate`; a lone name shares nothing; and
	// `'none'` touches no clock at all. Judged over the whole character because
	// the sharers are, by construction, on different summons.
	{
		const byName = new Map<string, { gate: string; where: string }[]>();
		for (const a of c.abilities)
			for (const s of (a as { summons?: Summon[] }).summons ?? [])
				for (const eff of s.effects ?? []) {
					if (eff.trigger.type !== 'summonTick' || eff.trigger.icdCounter === undefined) continue;
					const name = eff.trigger.icdCounter;
					const where = `${a.id} / ${s.label}`;
					if (typeof name !== 'string' || !name || eff.trigger.icdGate === 'none') {
						push(
							'strict',
							'summon-tick-icd-counter',
							`${where}: icdCounter must be a non-empty name on a gated series (not icdGate 'none')`,
							a.id
						);
						continue;
					}
					byName.set(name, [
						...(byName.get(name) ?? []),
						{ gate: JSON.stringify(eff.trigger.icdGate ?? null), where }
					]);
				}
		for (const [name, holders] of byName) {
			if (holders.length < 2)
				push(
					'strict',
					'summon-tick-icd-counter',
					`icdCounter "${name}" is on one series only (${holders[0].where}) — it shares nothing; drop it`,
					c.id
				);
			else if (new Set(holders.map((h) => h.gate)).size > 1)
				push(
					'strict',
					'summon-tick-icd-counter',
					`icdCounter "${name}" is shared by series with different icdGates (${holders.map((h) => `${h.where} ${h.gate}`).join(' · ')}) — one clock runs one window`,
					c.id
				);
		}
	}

	// (D.27h) `icdCounter` — a NAMED counter shared across abilities (ICD cap
	// round follow-up, 2026-10-04). A name only one ability carries shares
	// nothing, and beside the ability's own `noICD` it contradicts it (no clock
	// vs a named one). ⛔ Opt-in by design: the per-cast isolation is right for the
	// rest of the corpus (Xiao), so a lone name is refused rather than tolerated.
	{
		const holders = new Map<string, string[]>();
		for (const a of c.abilities) {
			const name = (a as { icdCounter?: unknown }).icdCounter;
			if (name === undefined) continue;
			if (typeof name !== 'string' || !name) {
				push('strict', 'icd-counter-invalid', `icdCounter must be a non-empty string`, a.id);
				continue;
			}
			if ((a as { noICD?: boolean }).noICD)
				push(
					'strict',
					'icd-counter-invalid',
					`${a.id} sets both noICD and icdCounter "${name}" — keep one`,
					a.id
				);
			holders.set(name, [...(holders.get(name) ?? []), a.id]);
		}
		// ⚓ One holder is enough when it spends the counter from SEVERAL action
		// classes — a spinning Charged Attack or a dash hit beside its Normal
		// Attacks (Mavuika's Flamestrider: gcsim's one `ICDTagMavuikaFlamestrider`
		// across NA, spin, finisher and Sprint), which would otherwise land on
		// separate normal and charged counters.
		const multiClass = (id: string): boolean => {
			const a = c.abilities.find((x) => x.id === id) as
				| { chargeSpin?: unknown; dashHit?: unknown }
				| undefined;
			return a?.chargeSpin !== undefined || a?.dashHit !== undefined;
		};
		for (const [name, ids] of holders)
			if (ids.length < 2 && !multiClass(ids[0]))
				push(
					'strict',
					'icd-counter-invalid',
					`icdCounter "${name}" is carried by ${ids[0]} alone — a counter one ability spends shares nothing; drop it`,
					ids[0]
				);
	}

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

	// Which cast kinds of this character leave a summon in the world — base
	// ability or variant, since a variant-only summon still opens `duringSummon`.
	const summonKinds = new Set<string>();
	for (const a of c.abilities) {
		if (a.abilityType !== 'skill' && a.abilityType !== 'burst') continue;
		const raw = a as unknown as { summons?: unknown[]; variants?: { summons?: unknown[] }[] };
		const has =
			(raw.summons?.length ?? 0) > 0 ||
			(raw.variants ?? []).some((v) => (v.summons?.length ?? 0) > 0);
		if (has) summonKinds.add(a.abilityType);
	}
	const speaksOfStellarConduct =
		(c.enablesReactions ?? []).includes('stellarConduct') ||
		JSON.stringify([c.abilities, c.passives, c.constellations, c.factionBonuses]).includes(
			'"reaction":"stellarConduct"'
		);
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
			// (C.19) `inPolestarField` is Radiance: Stellar-Conduct as a WINDOW
			// (Radiance-window round, 2026-09-19) — it belongs to a kit that speaks
			// of Stellar-Conduct at all: an enabler, or a holder gating on one.
			// Anywhere else it is a copy-paste error that silently never resolves.
			if (JSON.stringify(cond).includes('"inPolestarField"') && !speaksOfStellarConduct) {
				push(
					'strict',
					'polestar-field-unrelated',
					`${path}: inPolestarField on a character whose kit never names stellarConduct (no enablesReactions entry, no teamEnablesReaction gate)`
				);
			}
			// (C.20) A `source` QUALIFIER NAMES A SUMMON THE HOLDER HAS
			// (summon-bound buffs round, 2026-09-21). It is meaningful only on
			// `duringSummon` — every other state has one opener vocabulary of its
			// own, and a qualifier there would read as a gate and resolve as `null`
			// forever. Naming a kind the character never summons is the same
			// silence from the other side: `trackedStatesOf` drops the key as
			// un-openable, and the gate stops narrowing anything.
			walkRawStateNodes(cond, path, (node, where) => {
				if (node.source === undefined) return;
				if (node.state !== 'duringSummon') {
					push(
						'strict',
						'state-source-scope',
						`${where}: 'source' qualifier on state "${String(node.state)}" — only duringSummon can name the cast kind that opened it`
					);
				} else if (node.source !== 'skill' && node.source !== 'burst') {
					push(
						'strict',
						'state-source-scope',
						`${where}: state source "${String(node.source)}" is not a cast kind (skill|burst)`
					);
				} else if (!summonKinds.has(node.source)) {
					push(
						'strict',
						'state-source-scope',
						`${where}: duringSummon source "${node.source}" but no ${node.source} of this character summons anything`
					);
				}
			});
		}
	);

	// (D.45 / D.46) A BUFF BOUND TO A STATE, AND A SPEND THAT CLOSES ONE
	// (event-ended buffs round, 2026-09-21). Both name a state whose WINDOW the
	// parse must actually record for this holder — a stance, an `opensState`
	// companion, a transient spec or its `onEnd` chain. Anything else has no
	// `state` window to intersect with or to clamp, so `whileState` would delete
	// the bar outright and `closesStateWhenEmpty` would close nothing, both in
	// silence. ⚠️ The same "openable" walk `stateIndex.ts` makes, restated here
	// because this module must stay runtime-import-free.
	{
		const openable = new Set<string>();
		const specStates = (spec: unknown): void => {
			if (!spec || typeof spec !== 'object') return;
			const sp = spec as { state?: unknown; onEnd?: { state?: unknown } };
			if (typeof sp.state === 'string') openable.add(sp.state);
			if (typeof sp.onEnd?.state === 'string') openable.add(sp.onEnd.state);
		};
		const bound: Array<{ node: Record<string, unknown>; field: string }> = [];
		const walkRaw = (node: unknown): void => {
			if (!node || typeof node !== 'object') return;
			if (Array.isArray(node)) {
				for (const n of node) walkRaw(n);
				return;
			}
			const o = node as Record<string, unknown>;
			if (o.behavior === 'stance') openable.add('inStance');
			if (typeof o.opensState === 'string') openable.add(o.opensState);
			// A Nightsoul pool opens its Blessing and every form's state.
			if (o.drainPerTick !== undefined && Array.isArray(o.forms)) specStates(o);
			if (o.drainPerTick !== undefined && Array.isArray(o.forms))
				for (const f of o.forms) specStates(f);
			if (o.opensTransientState) specStates(o.opensTransientState);
			if (o.actionOpensState && typeof o.actionOpensState === 'object')
				for (const spec of Object.values(o.actionOpensState)) specStates(spec);
			if (o.whileState !== undefined) bound.push({ node: o, field: 'whileState' });
			if (o.closesStateWhenEmpty !== undefined)
				bound.push({ node: o, field: 'closesStateWhenEmpty' });
			for (const v of Object.values(o)) walkRaw(v);
		};
		walkRaw({
			abilities: c.abilities,
			passives: c.passives,
			constellations: c.constellations,
			factionBonuses: c.factionBonuses,
			nightsoulPool: c.nightsoulPool
		});
		for (const { node, field } of bound) {
			const state = node[field];
			if (typeof state !== 'string' || !openable.has(state)) {
				push(
					'strict',
					'state-binding-unopenable',
					`${field} "${String(state)}" names a state this character's data never opens as a window (a stance, opensState, a transient spec or its onEnd) — nothing would be there to bind to`
				);
			}
			if (field === 'whileState') {
				// ⚓ A `whileStacks` window has no duration of its own — the count IS
				// its span (stepped stacks round) — and it is clipped all the same.
				const trig = node.trigger as { type?: unknown } | undefined;
				const ok =
					(node.type === 'buff' || node.type === 'resShred' || node.type === 'elevate') &&
					(typeof node.duration === 'number' || trig?.type === 'whileStacks');
				if (!ok)
					push(
						'strict',
						'while-state-scope',
						`whileState on a "${String(node.type)}" effect${typeof node.duration === 'number' ? '' : ' with no duration'} — it clips a drawn buff window, so it belongs on a buff, resShred or elevate that has a duration`
					);
			} else {
				const trig = node.trigger as { type?: unknown } | undefined;
				if (node.type !== 'consumeStacks' || trig?.type !== 'onHit')
					push(
						'strict',
						'closes-state-scope',
						`closesStateWhenEmpty belongs on an onHit consumeStacks — the cast-side consume dispatcher does not read it`
					);
			}
		}
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

	// (D.39) STACK SCOPE IS A PROPERTY OF THE KEY, so every gainStacks effect
	// that grants it must say the same thing. ⛔ Not the `drain` convention of
	// declaring once on the first grant: `scope` is one enum, so a disagreement
	// is checkable here — while an OMISSION is invisible, and would silently
	// revert the key to `'segment'` the day the declaring effect is edited away.
	// Reference: Alyosha's `huntersMark`, the only corpus author.
	{
		const scopesByKey = new Map<string, Set<string>>();
		// ⚠️ Summon effects too — a summon tick may grant a key (stepped stacks
		// round), and `stackScopesOf` reads its scope from there.
		const lists: (readonly Effect[] | undefined)[] = [];
		for (const src of [...c.abilities, ...(c.passives ?? []), ...(c.constellations ?? [])]) {
			lists.push(src.effects);
			for (const s of (src as { summons?: { effects?: Effect[] }[] }).summons ?? [])
				lists.push(s.effects);
		}
		for (const list of lists) {
			for (const fx of list ?? []) {
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

	// (D.40) A STACK THRESHOLD NAMES RESOURCES THAT EXIST AND A COUNT THAT CAN
	// BE REACHED (stack-threshold round, 2026-09-18). Every key in `keys` must
	// have a `gainStacks` author on this character (a key nobody grants is a
	// threshold that never fires — silently); `count` may not exceed the summed
	// `max` of the keys when every key states one (a threshold above the cap is
	// the same silence); and effects sharing one (keys, count) must agree on
	// `label`, since the group is one fire and one row.
	{
		const grantMax = new Map<string, number | null>(); // null = unbounded
		for (const src of [...c.abilities, ...(c.passives ?? []), ...(c.constellations ?? [])]) {
			for (const fx of src.effects ?? []) {
				if (fx.type !== 'gainStacks') continue;
				const prev = grantMax.get(fx.key);
				const mx = typeof fx.max === 'number' ? fx.max : null;
				if (prev === undefined) grantMax.set(fx.key, mx);
				else if (prev !== null && mx !== null) grantMax.set(fx.key, Math.max(prev, mx));
				else grantMax.set(fx.key, null);
			}
		}
		const labelsByGroup = new Map<string, Set<string>>();
		for (const src of [...c.abilities, ...(c.passives ?? []), ...(c.constellations ?? [])]) {
			for (const fx of src.effects ?? []) {
				if (fx.trigger.type !== 'onStack') continue;
				const t = fx.trigger;
				if (!Array.isArray(t.keys)) continue;
				for (const k of t.keys) {
					if (!grantMax.has(k)) {
						push(
							'strict',
							'onstack-key-unauthored',
							`onStack key "${k}" has no gainStacks author on this character — the threshold can never fire`,
							src.id
						);
					}
				}
				const maxes = t.keys.map((k) => grantMax.get(k));
				if (maxes.length > 0 && maxes.every((m) => typeof m === 'number')) {
					const cap = (maxes as number[]).reduce((a, b) => a + b, 0);
					if (typeof t.count === 'number' && t.count > cap) {
						push(
							'strict',
							'onstack-count-unreachable',
							`onStack count ${t.count} exceeds the keys' summed max ${cap} — the threshold can never fire`,
							src.id
						);
					}
				}
				const gk = `${t.keys.join('|')}#${t.count}`;
				if (t.label !== undefined) {
					const set = labelsByGroup.get(gk) ?? new Set<string>();
					set.add(t.label);
					labelsByGroup.set(gk, set);
				}
			}
		}
		for (const [gk, labels] of labelsByGroup) {
			if (labels.size > 1) {
				push(
					'strict',
					'onstack-label-disagreement',
					`onStack effects on one threshold (${gk}) name it differently (${[...labels].sort().join(', ')}) — one fire, one label`
				);
			}
		}
	}

	// FactionBonus effects also need linting
	for (const fb of factionBonuses) {
		for (const eff of fb.effects ?? []) {
			lintEffect(c, `factionBonuses[${fb.faction}]`, eff, push, {
				isPassiveOrConstellation: false,
				isFactionBonus: true
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
		// (gcsim sync, 2026-09-27) `atFirstHit` anchors on a CAST's landing, so it
		// means nothing on an action-class opener, which fires at the action's end.
		const s1 = spec as { atFirstHit?: unknown };
		if (s1.atFirstHit !== undefined) {
			if (s1.atFirstHit !== true) {
				push('strict', 'transient-state-spec', `${where}.atFirstHit must be literally true`, a.id);
			} else if (where !== 'opensTransientState') {
				push(
					'strict',
					'transient-state-spec',
					`${where}.atFirstHit is only meaningful on opensTransientState (an action opener fires at the action's end)`,
					a.id
				);
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

	// (E.29) The coverage page's two positive statements (docs/coverage-round.md
	// §5.1, §6). A ruling and "nothing to model" each REPLACE authored effects,
	// so a host carrying either beside `effects` says two things at once — and
	// the page would believe whichever it read first. A ruling's `reason` is
	// rendered, so it follows the caveat style guide.
	const nm = (a as { notModeled?: unknown }).notModeled;
	const ntm = (a as { nothingToModel?: unknown }).nothingToModel;
	const hasEffects = ((a as { effects?: unknown[] }).effects ?? []).length > 0;
	if (nm !== undefined) {
		const reason = (nm as { reason?: unknown })?.reason;
		if (typeof reason !== 'string' || reason.trim().length === 0) {
			push('strict', 'not-modeled-shape', `notModeled must be { reason: string }`, a.id);
		} else {
			for (const issue of caveatStyleIssues(reason)) {
				push(issue.severity, 'not-modeled-style', issue.message, a.id);
			}
		}
		if (hasEffects)
			push('strict', 'not-modeled-with-effects', `notModeled beside authored effects`, a.id);
	}
	if (ntm !== undefined) {
		if (ntm !== true) push('strict', 'nothing-to-model-shape', `nothingToModel must be true`, a.id);
		if (hasEffects)
			push(
				'strict',
				'nothing-to-model-with-effects',
				`nothingToModel beside authored effects`,
				a.id
			);
		if (nm !== undefined)
			push('strict', 'nothing-to-model-with-ruling', `nothingToModel beside notModeled`, a.id);
	}

	// (E.29b) `modeledBy` points at ANOTHER host of this character, and says
	// the same thing as authored effects or a ruling would, so never beside one.
	const mb = (a as { modeledBy?: unknown }).modeledBy;
	if (mb !== undefined) {
		const ids = new Set(
			[...c.abilities, ...(c.passives ?? []), ...(c.constellations ?? [])].map((h) => h.id)
		);
		if (typeof mb !== 'string' || !ids.has(mb) || mb === a.id)
			push(
				'strict',
				'modeled-by-target',
				`modeledBy "${String(mb)}" is not another host of this character`,
				a.id
			);
		if (hasEffects || nm !== undefined || ntm !== undefined)
			push(
				'strict',
				'modeled-by-with-statement',
				`modeledBy beside effects, notModeled or nothingToModel`,
				a.id
			);
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
			lintNormal(c, a, push);
			break;
		case 'skill':
		case 'burst':
			lintCastAbility(a, push);
			lintSummonEffects(c, a, push);
			lintEndsStance(c, a, push);
			lintHoldsField(a, push);
			lintStanceTimeCooldown(a, push);
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
		// (E.32) …and so is a sequenced summon's strike.
		if (eff.trigger.type === 'summonStrike') {
			push(
				'strict',
				'summon-strike-misplaced',
				`summonStrike trigger only valid inside summons[].effects[]; found on ability/passive/constellation effect`,
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
			// ⚓ A GATED VARIANT ON THE BASE'S OWN TOKEN (summon-conditions round,
			// 2026-09-19) is how a cast changes shape at a constellation or under a
			// state without a new token — Chiori's C2 Kinu, Emilie's C4 Cases,
			// Furina's Pneuma lineup. `matchVariant` takes it only when its conditions
			// hold, and `variantLabel` carries that answer to every summon, frame and
			// application reader. ⚠️⚠️ The cast-EFFECT collectors do not read it:
			// `effectsForCast` and `resolveCastContext` pick a variant by input token
			// ALONE, so `effects` / `tags` / `damageTag` on such a variant would apply
			// on every cast of the token, condition or no condition. Refused until
			// those collectors take the resolved label.
			const sharesBaseToken =
				v.conditions !== undefined &&
				(v.input ?? []).some((t) => ((a as { input?: string[] }).input ?? []).includes(t));
			if (
				sharesBaseToken &&
				(v.effects !== undefined || v.tags !== undefined || v.damageTag !== undefined)
			) {
				push(
					'strict',
					'variant-gated-effects',
					`variant "${v.label}" is gated by conditions on the base ability's own input token and authors effects/tags/damageTag — the cast-effect collectors match a variant by token alone, so these would apply even when the gate is false`,
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
	c: CharacterData,
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
			if (v !== undefined && !isFrameValue(k, v)) {
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
		const capProblem = icdCapProblem(a.chargedIcdWindow);
		if (capProblem)
			push('strict', 'charged-icd-window-invalid', `chargedIcdWindow.${capProblem}`, a.id);
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

	// (A.4d) `projectile` — the EXCEPTIONS to "a bow's normals and aimed shots fly,
	// everything else is melee" (projectile-travel round, 2026-09-21). A value
	// that restates the rule is refused, so the field keeps meaning "this one is
	// different": `true` on a bow and `false` off one are both noise, and noise
	// here is how a mass-annotation starts. ⛔ No `plunge` key — a plunge is melee.
	const pj = (a as unknown as { projectile?: unknown }).projectile;
	if (pj !== undefined) {
		if (typeof pj !== 'object' || pj === null || Array.isArray(pj)) {
			push('strict', 'projectile-shape', `projectile must be an object of action classes`, a.id);
		} else {
			for (const [k, v] of Object.entries(pj)) {
				if (k !== 'normal' && k !== 'charged')
					push(
						'strict',
						'projectile-shape',
						`projectile key "${k}" is not normal|charged (a plunge is melee)`,
						a.id
					);
				else if (typeof v !== 'boolean')
					push('strict', 'projectile-shape', `projectile.${k} must be a boolean`, a.id);
				else if (v === (c.weapon === 'bow'))
					push(
						'strict',
						'projectile-shape',
						`projectile.${k}: ${v} restates the rule for a ${c.weapon} — state only the exception`,
						a.id
					);
			}
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
			if (v !== undefined && !isFrameValue(k, v)) {
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
				if (v !== undefined && !isFrameValue(k, v)) {
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

	// (A.4c) specialChargeFrames — KQM's `sC`. ⛔ Meaningless on a bow (the token
	// is a stance's substitute charged attack, and a bow's charge is `chargeHits`),
	// and meaningless without an ordinary `chargeFrames` to be the substitute FOR.
	if (a.specialChargeFrames) {
		if (a.chargeHits) {
			push(
				'strict',
				'invalid-frames',
				'specialChargeFrames alongside chargeHits (a bow has no special charged attack)',
				a.id
			);
		}
		if (!a.chargeFrames) {
			push('strict', 'missing-frames', 'specialChargeFrames without chargeFrames', a.id);
		}
	}

	// (A.4d) specialChargeSpends — the skill charge an `sC` SPENDS (Varka's Azure
	// Devour, 2026-09-18). Needs the special frames (no special form, nothing
	// to spend on) and must name a SKILL ability of this character, because the
	// parser keys the charge queue it spends from by ability id.
	if (a.specialChargeSpends !== undefined) {
		if (!a.specialChargeFrames) {
			push(
				'strict',
				'special-charge-spends-frames',
				'specialChargeSpends without specialChargeFrames',
				a.id
			);
		}
		const target = c.abilities.find((x) => x.id === a.specialChargeSpends);
		if (!target || target.abilityType !== 'skill') {
			push(
				'strict',
				'special-charge-spends-target',
				`specialChargeSpends "${a.specialChargeSpends}" does not name a skill ability of this character`,
				a.id
			);
		}
	}

	// plungeFrames (HIGH plunge — the default) and lowPlungeFrames (`lP` only),
	// and specialChargeFrames (`sC`) — every one needs a positive `anim`.
	for (const [field, fm] of [
		['plungeFrames', a.plungeFrames],
		['lowPlungeFrames', a.lowPlungeFrames],
		['specialChargeFrames', a.specialChargeFrames]
	] as const) {
		if (!fm) continue;
		if (!isPositiveInt(fm.anim)) {
			push('strict', 'missing-anim', `${field}.anim missing or not a positive integer`, a.id);
		}
	}
	// (A.5c) `lands` — where a swing's first hit lands, on the maps `hit` cannot
	// say it for (§1.K stage 2, 2026-09-20). Three ways to author it wrong, each
	// silent: past the animation (a hit that lands after the swing is over);
	// restating `hit` (absent must keep meaning "`hit` already says it", or the
	// field stops distinguishing the two map shapes); and beside a `nonHitting`
	// claim for the same action class, which says nothing lands at all.
	const landed: [string, FrameMap | undefined, 'normal' | 'charged' | 'plunge'][] = [
		...a.hits.map((h, i): [string, FrameMap, 'normal'] => [
			`hits[${i}].frames`,
			h.frames,
			'normal'
		]),
		['chargeFrames', a.chargeFrames, 'charged'],
		['specialChargeFrames', a.specialChargeFrames, 'charged'],
		...(a.chargeHits ?? []).map((h, i): [string, FrameMap, 'charged'] => [
			`chargeHits[${i}].frames`,
			h.frames,
			'charged'
		]),
		['plungeFrames', a.plungeFrames, 'plunge'],
		['lowPlungeFrames', a.lowPlungeFrames, 'plunge'],
		...(a.plungeVariants ?? []).map((v, i): [string, FrameMap, 'plunge'] => [
			`plungeVariants[${i}].frames`,
			v.frames,
			'plunge'
		])
	];
	for (const [field, fm, cls] of landed) {
		if (fm?.lands === undefined) continue;
		// ↻ The LIST form (every-landing round, 2026-09-21) is checked at its LAST
		// frame; "restates `hit`" is a claim about the SCALAR only — a list beside
		// `hit` is the 80 multi-hit normals saying what `hit` (their last hitmark,
		// and their cancel tier) cannot.
		const last = Array.isArray(fm.lands) ? Math.max(...fm.lands) : fm.lands;
		if (isPositiveInt(fm.anim) && last > fm.anim)
			push(
				'strict',
				'frame-value-invalid',
				`${field}.lands (${JSON.stringify(fm.lands)}) is past anim (${fm.anim})`,
				a.id
			);
		if (fm.lands === fm.hit)
			push('strict', 'frame-value-invalid', `${field}.lands restates hit — omit it`, a.id);
		if (a.nonHitting?.[cls])
			push('strict', 'frame-value-invalid', `${field}.lands on a nonHitting ${cls}`, a.id);
	}
	// ⛔ A low-plunge map with no high-plunge map beside it inverts the default:
	// the bare `P` token would fall through to nothing while `lP` resolved.
	if (a.lowPlungeFrames && !a.plungeFrames) {
		push('strict', 'missing-frames', 'lowPlungeFrames without plungeFrames', a.id);
	}

	// (C.19) infusion is a valid Element, or a sound ElementRef
	if (a.infusion !== undefined) {
		const issue = elementRefIssue(a.infusion, CHARACTER_ELEMENTS);
		if (issue) push('strict', 'invalid-element', `infusion: ${issue}`, a.id);
	}
	// (C.19b) coInfusion likewise — and ⚓ it is meaningless without a primary:
	// the two fields are the two claymores, and one hand alone is just `infusion`.
	if (a.coInfusion !== undefined) {
		const issue = elementRefIssue(a.coInfusion, CHARACTER_ELEMENTS);
		if (issue) push('strict', 'invalid-element', `coInfusion: ${issue}`, a.id);
		if (a.infusion === undefined)
			push('strict', 'invalid-element', 'coInfusion without infusion', a.id);
	}
}

/**
 * Shape check for an `ElementRef` (Varka's two claymores round, 2026-09-16) —
 * a complaint, or `null` when the ref is sound.
 *
 * ⚠️ The literal is checked against the CALLER's element set, because the two
 * callers do not share one: an infusion or a cast application must name a
 * character element (Physical is not something you infuse), while a damage
 * effect's application may name Physical.
 */
function elementRefIssue(ref: ElementRef, allowed: ReadonlySet<string>): string | null {
	if (typeof ref === 'string') return allowed.has(ref) ? null : `"${ref}" is not a valid Element`;
	// An absorbed element is sound in shape; D.54 says where it may stand.
	if (ref.type === 'absorbed') return null;
	if (ref.type !== 'teamElementPriority')
		return `unknown ElementRef type "${String((ref as { type: unknown }).type)}"`;
	if (!Array.isArray(ref.order) || ref.order.length === 0)
		return 'teamElementPriority needs a non-empty `order`';
	for (const e of ref.order)
		if (!CHARACTER_ELEMENTS.has(e)) return `teamElementPriority order has "${e}"`;
	if (new Set(ref.order).size !== ref.order.length)
		return 'teamElementPriority `order` repeats an element';
	if (ref.fallback !== undefined && !allowed.has(ref.fallback))
		return `teamElementPriority fallback "${ref.fallback}" is not a valid Element`;
	return null;
}

// (D.47) `endsStance` (cast-ends-stance round, 2026-10-04): `at` is a frame
// count from the cast's start (a non-negative integer) or 'castEnd', and the
// character must OWN a stance for the cast to end — on a stanceless kit the
// field is inert, which is the orphaned-data class wearing a valid shape.
function lintEndsStance(
	c: CharacterData,
	a: SkillAbility | BurstAbility,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void
): void {
	const hosts = [
		{ where: a.id, ends: a.endsStance },
		...(a.variants ?? []).map((v) => ({ where: `${a.id} · ${v.label}`, ends: v.endsStance }))
	].filter((h) => h.ends !== undefined);
	if (!hosts.length) return;
	const hasStance = c.abilities.some(
		(x) =>
			(x.abilityType === 'skill' || x.abilityType === 'burst') &&
			(x.behavior === 'stance' || (x.variants ?? []).some((v) => v.behavior === 'stance'))
	);
	for (const { where, ends } of hosts) {
		const at = ends!.at;
		if (at !== 'castEnd' && !(Number.isInteger(at) && at >= 0)) {
			push(
				'strict',
				'ends-stance-invalid',
				`${where} endsStance.at must be 'castEnd' or a non-negative frame count, got ${JSON.stringify(at)}`,
				a.id
			);
		}
		if (!hasStance) {
			push(
				'strict',
				'ends-stance-invalid',
				`${where} ends a stance, but ${c.id} has no stance-behavior skill or burst — the field would be inert`,
				a.id
			);
		}
	}
}

// (D.48) A stance that HOLDS THE FIELD, and a hit bound to its stance (Mizuki
// round, 2026-10-16). `holdsField` only means something beside
// `terminatesOnSwap` — a stance a swap does not end needs nobody to stay — and
// `whileStance` only on a cast that opens a stance, or no stance ever gates it.
function lintHoldsField(
	a: SkillAbility | BurstAbility,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void
): void {
	const stance = a.behavior === 'stance' ? a : undefined;
	if (stance && 'holdsField' in stance && stance.holdsField && stance.terminatesOnSwap !== true) {
		push(
			'strict',
			'holds-field-invalid',
			`${a.id} holdsField without terminatesOnSwap — a stance a swap does not end needs no hold`,
			a.id
		);
	}
	const hosts = [
		{ where: a.id, opens: a.behavior === 'stance', app: a.application },
		...(a.variants ?? []).map((v) => ({
			where: `${a.id} · ${v.label}`,
			opens: (v.behavior ?? a.behavior) === 'stance',
			app: v.application ?? a.application
		}))
	];
	for (const { where, opens, app } of hosts) {
		const bound = (app ?? []).filter((e) => e.whileStance !== undefined);
		if (!bound.length) continue;
		if (!opens) {
			push(
				'strict',
				'while-stance-invalid',
				`${where} has whileStance hits but does not open a stance — nothing would gate them`,
				a.id
			);
		}
		for (const e of bound) {
			const t = e.whileStance!.travel;
			if (!(Number.isInteger(t) && t >= 0 && t <= e.frame)) {
				push(
					'strict',
					'while-stance-invalid',
					`${where} whileStance.travel must be a frame count between 0 and the hit's frame (${e.frame}), got ${JSON.stringify(t)}`,
					a.id
				);
			}
		}
	}
}

// (D.49) `cooldownByStanceTime` (Tartaglia, stance-exits round, 2026-10-16):
// only beside `cooldownStartsAtStanceEnd`, whose clock it sets the length of;
// bands strictly ascending by a positive `below`, the last no later than the
// stance's own duration (past it, `atExpiry` answers); non-negative lengths.
function lintStanceTimeCooldown(
	a: SkillAbility | BurstAbility,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void
): void {
	if (a.behavior !== 'stance' || !('cooldownByStanceTime' in a) || !a.cooldownByStanceTime) return;
	const spec = a.cooldownByStanceTime;
	const bad = (msg: string) =>
		push('strict', 'stance-time-cooldown-invalid', `${a.id} ${msg}`, a.id);
	if (a.cooldownStartsAtStanceEnd !== true)
		bad(
			'cooldownByStanceTime without cooldownStartsAtStanceEnd — the table sets the length of a stance-end clock'
		);
	let prev = 0;
	for (const b of spec.bands) {
		if (!(b.below > prev))
			bad(
				`cooldownByStanceTime bands must ascend by a positive below (got ${b.below} after ${prev})`
			);
		if (!(b.cooldown >= 0))
			bad(`cooldownByStanceTime band below ${b.below} has a negative cooldown`);
		prev = b.below;
	}
	if (prev > a.duration)
		bad(
			`cooldownByStanceTime's last band (${prev}s) is past the stance's duration (${a.duration}s)`
		);
	if (!(spec.atExpiry >= 0))
		bad('cooldownByStanceTime.atExpiry must be a non-negative number of seconds');
	if (spec.exitDelay !== undefined && !(Number.isInteger(spec.exitDelay) && spec.exitDelay >= 0))
		bad('cooldownByStanceTime.exitDelay must be a non-negative frame count');
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
		// …and a cast's landings are `application[]`, which says element and units
		// too. `lands` is a swing's field.
		if (a.frames.lands !== undefined) {
			push('strict', 'frame-value-invalid', 'frames.lands is not valid on a skill/burst map', a.id);
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
			// nothing downstream would notice. ⚠️ A held cast's `'after'` entry is
			// written for a zero-length hold and lands after every `'during'` one, so
			// it stands at the END of the list and outside this check (D.55).
			if (e.held !== 'after' && e.frame < last) {
				push(
					'strict',
					'application-invalid',
					`${where} application[${i}] is out of frame order`,
					a.id
				);
			}
			if (e.held !== 'after') last = e.frame;
			const elIssue =
				e.element === undefined ? null : elementRefIssue(e.element, CHARACTER_ELEMENTS);
			if (elIssue) {
				push('strict', 'invalid-element', `${where} application[${i}].element: ${elIssue}`, a.id);
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

	// (D.27c) A cast's `icdGate` window shape — FRAMES, not seconds (the
	// cast-side twin of A.4b and D.27b, cast-icd-gate round 2026-09-17).
	//
	// ⚠️⚠️ THE SAME UNIT TRAP, and here the neighbour is `application[].frame`,
	// which IS in frames — so the trap is subtler: a curator copying a
	// `summonTick.interval` of 1.5 (seconds) gets a 1.5-FRAME window, which
	// reads as "every hit applies". gcsim's smallest real group timer is 6.
	// ⛔ `noICD` and `icdGate` together is a contradiction: one says no clock,
	// the other names one. And a gate on a cast with NO `application[]` gates
	// nothing — the absent-list fallback applies once at the cast.
	if (a.icdGate) {
		const capProblem = icdCapProblem(a.icdGate);
		if (capProblem)
			push('strict', 'cast-icd-gate-invalid', `icdGate.${capProblem} (${a.id})`, a.id);
		if (restatesStandard(a.icdGate))
			push(
				'strict',
				'cast-icd-gate-invalid',
				`icdGate on ${a.id} restates the standard window; omit it — absent means standard`,
				a.id
			);
		if (!isPositiveInt(a.icdGate.timer) || a.icdGate.timer < 6) {
			push(
				'strict',
				'cast-icd-gate-invalid',
				`icdGate.timer on ${a.id} must be a positive integer of FRAMES (got ${a.icdGate.timer}); gcsim's smallest group timer is 6`,
				a.id
			);
		}
		if (a.icdGate.every !== undefined && !isPositiveInt(a.icdGate.every)) {
			push(
				'strict',
				'cast-icd-gate-invalid',
				`icdGate.every on ${a.id} must be a positive integer when present (got ${a.icdGate.every}); omit it to mean "only the first hit of the window applies"`,
				a.id
			);
		}
		if (a.noICD) {
			push(
				'strict',
				'cast-icd-gate-invalid',
				`${a.id} authors both noICD and icdGate — one says no clock, the other names one; keep one`,
				a.id
			);
		}
		if (!a.application || a.application.length < 2) {
			push(
				'strict',
				'cast-icd-gate-invalid',
				`${a.id} authors icdGate but its application[] has fewer than two entries — a window gates nothing there`,
				a.id
			);
		}
	}
	// (D.27c, cont.) An entry-level `noICD` says "this ONE hit is on no counter";
	// beside the ability's own `noICD` it says nothing, and on a one-entry list
	// there is no counter to be off.
	for (const form of [a, ...(a.variants ?? [])]) {
		const entries = form.application ?? [];
		if (!entries.some((e) => e.noICD)) continue;
		if (a.noICD) {
			push(
				'strict',
				'cast-icd-gate-invalid',
				`${a.id} marks an application entry noICD while the ability is already noICD — drop the entry flag`,
				a.id
			);
		}
		if (entries.length < 2) {
			push(
				'strict',
				'cast-icd-gate-invalid',
				`${a.id} marks its only application entry noICD — with one hit there is no counter to be off; use the ability's noICD`,
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
		if (
			a.cooldownStartDelay !== undefined ||
			a.variants?.some((v) => v.cooldownStartDelay !== undefined)
		) {
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

	// (D.44) startsOnCooldown rides a STANCE OPENING — the sibling must be
	// gated on inStance, or there is no instant at which its chain is written
	// (cooldown-reduction round, 2026-09-18). And it is never alone: the base
	// skill's `cooldownStartDelay` is its clock start, which is fine, but a
	// stance it can never be reached in is a queue nobody reads.
	if (a.abilityType === 'skill' && a.startsOnCooldown === true) {
		let underStance = false;
		walkConditions(a.conditions, (cond) => {
			if (cond.type === 'state' && cond.state === 'inStance') underStance = true;
		});
		if (!underStance) {
			push(
				'strict',
				'starts-on-cooldown-stance',
				'startsOnCooldown is written at a stance opening, so the ability must be a sibling gated on { type: "state", state: "inStance" }',
				a.id
			);
		}
		if (a.behavior === 'stance') {
			push(
				'strict',
				'starts-on-cooldown-behavior',
				'startsOnCooldown is for the sibling a stance makes available, not for the stance opener itself',
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
		// (D.22c) `opensState` names a known State and an end the spawn can know
		// (gcsim sync, 2026-09-27 — see `Summon.opensState`).
		const os = (s as { opensState?: unknown }).opensState;
		if (os !== undefined) {
			if (typeof os !== 'string' || !STATES.has(os)) {
				push(
					'strict',
					'summon-opens-state',
					`summon "${s.label}" opensState "${String(os)}" is not a known State`,
					a.id
				);
			}
			// ⚓ A summon a CAST ends may open one too (2026-10-06): the
			// terminating cast closes the state where it retires the summon.
			if (
				s.terminatesOn === 'swap' ||
				(s.durationExtensions?.length ?? 0) > 0 ||
				(a as unknown as Record<string, unknown>).summonsFollowState === true
			) {
				push(
					'strict',
					'summon-opens-state',
					`summon "${s.label}" opensState but its end is not known at the spawn (terminatesOn swap, durationExtensions, or summonsFollowState)`,
					a.id
				);
			}
		}
		if (s.terminatesOn !== undefined && !SUMMON_TERMINATES.has(s.terminatesOn)) {
			push(
				'strict',
				'summon-terminates-invalid',
				`summon "${s.label}" has invalid terminatesOn "${s.terminatesOn}"`,
				a.id
			);
		}
		// (D.22b) 'skill' / 'burst' name the owner's OTHER ability — the cast that
		// ends this summon. The host's own kind is a recast, which has its own word.
		if (s.terminatesOn === a.abilityType) {
			push(
				'strict',
				'summon-terminates-own-kind',
				`summon "${s.label}" terminatesOn "${s.terminatesOn}" names its own ability's kind — that is 'recast'`,
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
	const capProblem = icdCapProblem(gate);
	if (capProblem)
		push(
			'strict',
			'summon-tick-icd-window-invalid',
			`${what} icdGate.${capProblem} (summon "${summonLabel}")`,
			abilityId
		);
	if (restatesStandard(gate)) {
		push(
			'strict',
			'summon-tick-icd-window-invalid',
			`${what} icdGate on summon "${summonLabel}" restates the standard window (${gate.timer}f / every ${gate.every}); omit it — absent means standard`,
			abilityId
		);
	}
}

/** (E.32) A sequenced summon (Lumi round, 2026-10-17): its `summonStrike`
 *  steps and its `strikeSequence` come together, every gap is a positive
 *  integer of FRAMES, and the fallback names a step that exists. A step is a
 *  `damage` effect with no `conditions` — the sequence has no reader for a
 *  gate, so one would be silently ignored. */
function lintStrikeSequence(
	s: Summon,
	abilityId: string,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void
): void {
	const steps = (s.effects ?? []).filter((e) => e.trigger.type === 'summonStrike');
	const seq = s.strikeSequence;
	if (steps.length === 0 && seq === undefined) return;
	const bad = (msg: string) =>
		push('strict', 'strike-sequence-shape', `summon "${s.label}" ${msg}`, abilityId);
	const frames = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n > 0;
	if (seq === undefined) return bad('has summonStrike steps but no strikeSequence');
	if (steps.length === 0) return bad('has a strikeSequence but no summonStrike steps');
	if (!frames(seq.firstStrikeAt) || !frames(seq.fallbackGap))
		bad('strikeSequence firstStrikeAt / fallbackGap must be positive integers of FRAMES');
	if (
		!Number.isInteger(seq.fallbackStep) ||
		seq.fallbackStep < 0 ||
		seq.fallbackStep >= steps.length
	)
		bad(`strikeSequence fallbackStep ${seq.fallbackStep} names no step (${steps.length} steps)`);
	else if (
		steps[seq.fallbackStep].trigger.type === 'summonStrike' &&
		(steps[seq.fallbackStep].trigger as { onlyWithMoondrift?: true }).onlyWithMoondrift
	)
		bad('strikeSequence fallbackStep is itself a gated step — a refusal would repeat forever');
	steps.forEach((e, i) => {
		if (e.trigger.type !== 'summonStrike') return;
		if (e.type !== 'damage') bad(`step ${i} must be a damage effect (got ${e.type})`);
		if (e.conditions !== undefined) bad(`step ${i} carries conditions, which no strike reads`);
		if (!frames(e.trigger.framesToNext))
			bad(
				`step ${i} framesToNext must be a positive integer of FRAMES (got ${e.trigger.framesToNext})`
			);
		if (e.trigger.onlyWithMoondrift !== undefined && e.trigger.onlyWithMoondrift !== true)
			bad(`step ${i} onlyWithMoondrift must be true`);
	});
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
		// (E.30) `dealsNothing` is the positive statement that a summon has no
		// damage of its own (coverage round §5.2) — it cannot sit beside one.
		if (s.dealsNothing !== undefined) {
			if (s.dealsNothing !== true)
				push(
					'strict',
					'deals-nothing-shape',
					`summon "${s.label}" dealsNothing must be true`,
					a.id
				);
			if ((s.effects ?? []).some((e) => e.type === 'damage'))
				push(
					'strict',
					'deals-nothing-with-damage',
					`summon "${s.label}" dealsNothing beside a damage effect`,
					a.id
				);
		}
		lintStrikeSequence(s, a.id, push);
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
				// (D.27g) `sharesCastCounter` — the series is fed its cast's counted
				// hits (ICD cap round follow-up, 2026-10-04). It says nothing on an
				// ungated series ('none' touches no clock) and nothing beside a cast
				// that lands no counted hit (no element, all `noICD`, or the ability's
				// own `noICD` — gcsim's ICDTagNone spends no counter).
				if (eff.trigger.sharesCastCounter !== undefined) {
					const counted = (a.application ?? []).some((e) => e.element !== undefined && !e.noICD);
					if (
						eff.trigger.sharesCastCounter !== true ||
						eff.trigger.icdGate === 'none' ||
						a.noICD ||
						!counted
					)
						push(
							'strict',
							'summon-tick-shares-cast-counter',
							`summonTick on summon "${s.label}" sets sharesCastCounter, but ${eff.trigger.icdGate === 'none' ? "its icdGate is 'none'" : a.noICD ? 'the cast is noICD' : !counted ? 'the cast lands no counted hit' : 'the value must be true'} — the flag shares nothing; drop it`,
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
	c: CharacterData,
	location: string,
	eff: Effect,
	push: (sev: Severity, check: string, message: string, abilityId?: string) => void,
	ctx: { isPassiveOrConstellation: boolean; isSummon?: boolean; isFactionBonus?: boolean }
): void {
	// (D.52) The reactor and the others (Prune round, 2026-10-17): a `'reactor'`
	// target names who triggered a REACTION, so only an `onReaction` buff has
	// one; `source: 'others'` is read by the buff passes alone.
	{
		const targets = Array.isArray(eff.target) ? eff.target : [eff.target];
		if (targets.includes('reactor') && (eff.type !== 'buff' || eff.trigger.type !== 'onReaction'))
			push(
				'strict',
				'reactor-target-invalid',
				`${location}: target 'reactor' is only read on an onReaction buff`
			);
		if (
			eff.trigger.type === 'onReaction' &&
			eff.trigger.source === 'others' &&
			eff.type !== 'buff' &&
			eff.type !== 'resShred'
		)
			push(
				'strict',
				'reaction-others-unread',
				`${location}: onReaction source 'others' is only read on buffs and RES shreds`
			);
	}
	// (B.8) effects on passive/constellation with onCast/afterDuration must set trigger.ability
	// (B.20) `whileStacks` — a buff that IS its count (stepped stacks round,
	// 2026-09-27). Only a rotation-scoped key has a time-ordered history, and a
	// lifetime drop is swept late, so either would draw a wrong window.
	if (eff.trigger.type === 'whileStacks') {
		const key = eff.trigger.key;
		if (eff.type !== 'buff' && eff.type !== 'elevate')
			push(
				'strict',
				'whilestacks-scope',
				`whileStacks is a buff/elevate trigger (got "${eff.type}")`,
				location
			);
		const target = (eff as { target?: string }).target;
		if (target !== 'self' && target !== 'team' && target !== 'teamExcludingSelf')
			push(
				'strict',
				'whilestacks-scope',
				`whileStacks targets self, team or teamExcludingSelf — its window is not sliced per receiver (got "${String(target)}")`,
				location
			);
		if (ctx.isSummon)
			push(
				'strict',
				'whilestacks-scope',
				`whileStacks is hosted on an ability entry, not a summon`,
				location
			);
		let rotation = false;
		let lifetime = false;
		const scan = (list: readonly Effect[] | undefined): void => {
			for (const fx of list ?? []) {
				if (fx.type !== 'gainStacks' || fx.key !== key) continue;
				if (fx.scope === 'rotation') rotation = true;
				if (fx.lifetime !== undefined) lifetime = true;
			}
		};
		for (const src of [...c.abilities, ...(c.passives ?? []), ...(c.constellations ?? [])]) {
			scan(src.effects);
			for (const sm of (src as { summons?: { effects?: Effect[] }[] }).summons ?? [])
				scan(sm.effects);
		}
		if (!rotation || lifetime)
			push(
				'strict',
				'whilestacks-key',
				`whileStacks key "${key}" must be granted with scope: 'rotation' and no lifetime — only those counts are recorded in time order`,
				location
			);
		if ((eff as { duration?: unknown }).duration !== undefined)
			push(
				'strict',
				'whilestacks-duration',
				`whileStacks takes no duration — the window is the span the key is above zero`,
				location
			);
	}

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

	// (B.18) ⛔⛔ `manual` IS NOT A TRIGGER. It was authored as "the player toggles
	// it" and there has never been a toggle: its only occurrence in `src` was its
	// own type declaration, so 167 effects across 69 characters drew no bar, no
	// marker and no chip — while `deriveCapabilities` derived every one of them as
	// a live Team Builder claim until 2026-09-15. The two surfaces disagreed about
	// the same effect and only one of them could be caveated.
	//
	// ⚓ The rule that replaces it: an effect states WHEN IT FIRES, and if our
	// vocabulary cannot say when, the effect does not exist — its kit text lives in
	// the host `description` and its numbers in `_curatorNotes`, which is where a
	// future round reads them back. ⚠️ When a kit clause names SEVERAL in-game
	// sources, that is one effect PER SOURCE, never one partial trigger:
	// Alhaitham's C2 mirror gain is `onCast skill` + `onCast burst` + the A1 path,
	// not an `onCast skill` with an apology attached.
	//
	// docs/manual-trigger-retirement.md is the record.
	//
	// ⚠️ The allowlist this rule shipped behind is GONE (2026-09-21) and so is
	// `'manual'` itself — the member no longer exists in the `Trigger` union, so
	// the cast below is what lets the rule keep catching a hand-written one in a
	// JSON the type system never sees. ⛔ Do not "simplify" it away.
	if ((eff.trigger as { type: string }).type === 'manual') {
		push(
			'strict',
			'manual-trigger',
			'`manual` is a retired trigger and reaches no surface — state when the effect fires (one effect per in-game source), or retire it to the host description + _curatorNotes (docs/manual-trigger-retirement.md)',
			location
		);
	}

	// (B.19) AN `onHit` BUFF THAT LISTENS TO THE PARTY'S HITS (cross-character
	// onHit round, 2026-09-21). `source: 'others' | 'team' | 'active'` on a buff
	// is anchored on the rotation-wide hit stream by ONE pass, and that pass has
	// exactly the reach the corpus needed: a SELF-target buff on a passive, a
	// constellation or a faction bonus. Anything else used to be pooled under the
	// holder's own casts with `source` unread — Nicole's A4 drew at her own E and
	// Q and at nobody's hits — and now would be pooled under nothing. Refused
	// here so the gap is a red test rather than a missing bar.
	//
	// ⚠️ A cast-ability host is refused because there is no cast to resolve it
	// against: "while my burst is up" is a `state` condition on a passive host,
	// which the per-hit gate answers. ⚠️ `damage` / `heal` / `shield` /
	// `gainStacks` with a party source are other machinery (`sim/procs.ts`,
	// `sim/stacks.ts`, `sim/shields.ts`) and are untouched.
	if (
		eff.trigger.type === 'onHit' &&
		eff.trigger.source !== undefined &&
		eff.trigger.source !== 'self' &&
		(eff.type === 'buff' || eff.type === 'resShred' || eff.type === 'elevate')
	) {
		if (!ctx.isPassiveOrConstellation && !ctx.isFactionBonus) {
			push(
				'strict',
				'teamhit-buff-host',
				`an onHit ${eff.type} with source "${eff.trigger.source}" must be hosted on a passive, a constellation or a faction bonus — a cast ability's effects fire for its own casts, and this one listens to the party's hits (gate it on a \`state\` condition instead)`,
				location
			);
		} else if (eff.type !== 'buff' || eff.target !== 'self') {
			push(
				'strict',
				'teamhit-buff-target',
				`an onHit ${eff.type} with source "${eff.trigger.source}" reaches the self-target surface only — no pass anchors a team, active or enemy target on the party's hit stream yet (buffWindows.ts, "listening to the PARTY's hits")`,
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
	// (B.10c) cdReset.resetsAbility (2026-09-18) names ONE of the character's own
	// abilities of the reset kind; and a SKILL-fired reset of `resets: "skill"`
	// must name one — unnamed, it refunds the very cast that fired it (Varka's
	// C1 refunds Four Winds, not the Windbound Execution clock the same cast
	// wrote).
	if (eff.type === 'cdReset' && eff.source === 'character' && eff.trigger.type === 'onCast') {
		const kind = eff.resets ?? eff.trigger.ability;
		if (eff.resetsAbility !== undefined) {
			const target = c.abilities.find((x) => x.id === eff.resetsAbility);
			if (!target || target.abilityType !== kind) {
				push(
					'strict',
					'cdreset-resets-ability',
					`cdReset.resetsAbility "${eff.resetsAbility}" does not name a ${kind ?? 'skill/burst'} ability of this character`,
					location
				);
			}
		} else if (eff.trigger.ability === 'skill' && kind === 'skill') {
			push(
				'strict',
				'cdreset-skill-self',
				'a skill-fired cdReset of resets: "skill" must name resetsAbility — without it the reset refunds the cast that fired it',
				location
			);
		}
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
		// (B.10c) …and since it has a reader (cooldown-reduction round,
		// 2026-09-18) the reader's contract is pinned: one of its three
		// triggers, a `reduces` wherever the trigger does not name the ability,
		// and a target the mover can resolve to a receiver.
		const t = eff.trigger.type;
		if (t !== 'onHit' && t !== 'onCast' && t !== 'onReaction') {
			push(
				'strict',
				'cooldownreduce-trigger',
				`cooldownReduce is dispatched on onHit, onCast and onReaction only — got "${t}"`,
				location
			);
		}
		if (eff.reduces !== undefined && eff.reduces !== 'skill' && eff.reduces !== 'burst') {
			push(
				'strict',
				'cooldownreduce-reduces',
				`cooldownReduce.reduces must be "skill" or "burst"`,
				location
			);
		}
		if (eff.reduces === undefined && t !== 'onCast') {
			push(
				'strict',
				'cooldownreduce-reduces-missing',
				`cooldownReduce on an ${t} trigger must say which cooldown it moves (reduces: "skill" | "burst")`,
				location
			);
		}
		const cdTargets = Array.isArray(eff.target) ? eff.target : [eff.target];
		for (const tg of cdTargets) {
			if (tg !== 'self' && tg !== 'team' && tg !== 'teamExcludingSelf') {
				push(
					'strict',
					'cooldownreduce-target',
					`cooldownReduce.target must be self, team or teamExcludingSelf — a cooldown belongs to a character, got "${tg}"`,
					location
				);
			}
		}
	}

	// (B.17) procCap shape — a count per WINDOW, and the window must exist.
	if (eff.procCap !== undefined) {
		const cap = eff.procCap;
		if (!Number.isInteger(cap.count) || cap.count <= 0) {
			push(
				'strict',
				'proccap-count',
				`procCap.count must be a positive integer, got ${JSON.stringify(cap.count)}`,
				location
			);
		}
		if (cap.per !== 'stance') {
			push(
				'strict',
				'proccap-per',
				`procCap.per admits "stance" only (a member is added with its consumer), got ${JSON.stringify(cap.per)}`,
				location
			);
		} else {
			let underStance = false;
			walkConditions(eff.conditions, (cond) => {
				if (cond.type === 'state' && cond.state === 'inStance') underStance = true;
			});
			if (!underStance) {
				push(
					'strict',
					'proccap-stance-condition',
					`procCap.per: "stance" counts fires per stance window, so the effect must be gated on { type: "state", state: "inStance" }`,
					location
				);
			}
		}
		if (eff.type !== 'cooldownReduce') {
			push(
				'strict',
				'proccap-consumer',
				`procCap is read by cooldownReduce only today — a ${eff.type} carrying one would silently fire uncapped`,
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
		if (
			src !== undefined &&
			src !== 'self' &&
			src !== 'team' &&
			src !== 'active' &&
			src !== 'others'
		) {
			push(
				'strict',
				'invalid-reaction-source',
				`onReaction trigger source must be 'self', 'team', 'active' or 'others' (got ${JSON.stringify(src)})`,
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
		// ↻ An `onStack` fire may state an EMPTY list (stack-threshold round,
		// 2026-09-18): the fire draws a mark and applies nothing, and `[]` is the
		// positive statement of that (Columbina's Interference is Durability 0).
		// A non-empty list there is unread — no fire feeds the gauge yet.
		const emptyOnStack = eff.trigger.type === 'onStack' && eff.application.length === 0;
		if (eff.trigger.type === 'onStack' && !emptyOnStack) {
			push(
				'strict',
				'onstack-application-unread',
				`a damage effect on an onStack trigger applies nothing (the fire is a mark, not an application) — author application: [] or drop it`,
				location
			);
		} else if (
			!emptyOnStack &&
			eff.trigger.type !== 'summonStrike' &&
			!(PROC_TRIGGERS as readonly string[]).includes(eff.trigger.type)
		) {
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
			const appElIssue =
				app.element === undefined ? null : elementRefIssue(app.element, DAMAGE_ELEMENTS);
			if (appElIssue) {
				push(
					'strict',
					'effect-application-element-invalid',
					`application[${i}].element: ${appElIssue}`,
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
		// A single element or a non-empty list of them (one effect, one clock).
		const elementOk = (e: unknown): boolean => typeof e === 'string' && DAMAGE_ELEMENTS.has(e);
		if (
			f.element !== undefined &&
			!(Array.isArray(f.element)
				? f.element.length > 0 && f.element.every(elementOk)
				: elementOk(f.element))
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
		// (D.53) An applies-only tick (`summonTick.appliesOnly`, Nilou's aura) is a
		// damage effect with no damage: it must name the element it applies and
		// state the known zero.
		if (eff.trigger.type === 'summonTick' && eff.trigger.appliesOnly !== undefined) {
			if (
				eff.type !== 'damage' ||
				eff.trigger.appliesOnly !== true ||
				!eff.element ||
				eff.scaling !== 0
			)
				push(
					'strict',
					'applies-only-shape',
					`appliesOnly must be true, on a damage tick with an element and scaling 0`,
					location
				);
		}
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
			eff.trigger.type !== 'onHit' &&
			// A stack per threshold fire (stack-count display round) — B.16 holds
			// its scope and own-key rules.
			eff.trigger.type !== 'onStack' &&
			// Taking the field (swap-in stacks round) — written to the key's HOME.
			eff.trigger.type !== 'onSwapIn' &&
			// A summon's tick (stepped stacks round) — summon-hosted only (D.28)
			// and rotation-scoped only (below).
			eff.trigger.type !== 'summonTick'
		) {
			push(
				'strict',
				'gainstacks-trigger-invalid',
				`gainStacks effect trigger.type must be one of "onCast", "onReaction", "onHit", "onStack", "onSwapIn" or "summonTick" (got "${eff.trigger.type}")`,
				location
			);
		}
		// (B.13m) A gainStacks on a summon's tick writes a ROTATION home: the tick
		// fires inside whoever's segment is live, where the holder has no pool.
		if (eff.trigger.type === 'summonTick' && eff.scope !== 'rotation') {
			push(
				'strict',
				'summontick-gainstacks-scope',
				`a gainStacks on a summonTick trigger must declare scope: 'rotation' — a tick has no segment pool to write`,
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
		// (B.13f2) lifetimeRefresh — the SHARED duration model is a statement about
		// a `lifetime`, so it means nothing without one; and it is `true` or absent.
		if (eff.lifetimeRefresh !== undefined) {
			if (eff.lifetimeRefresh !== true || eff.lifetime === undefined) {
				push(
					'strict',
					'gainstacks-lifetime-refresh-invalid',
					`gainStacks lifetimeRefresh must be true and sit beside a lifetime (got ${JSON.stringify(eff.lifetimeRefresh)}, lifetime ${JSON.stringify(eff.lifetime)})`,
					location
				);
			}
		}
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
		// (B.13k) gainStacks accrual — a RATE into a shared status (exact-model
		// round, 2026-09-18): group a non-empty string, window > 0, only on an
		// onReaction grant with source team (a tick refresh has no trigger
		// character), and never beside another decay/rate shape — the amount is
		// per second here, and a second shape would read it as a count.
		if (eff.accrual !== undefined) {
			const acc = eff.accrual as { group?: unknown; window?: unknown };
			if (typeof acc.group !== 'string' || acc.group.length === 0) {
				push(
					'strict',
					'gainstacks-accrual-invalid',
					`gainStacks accrual.group must be a non-empty string (got ${JSON.stringify(acc.group)})`,
					location
				);
			}
			if (typeof acc.window !== 'number' || !Number.isFinite(acc.window) || acc.window <= 0) {
				push(
					'strict',
					'gainstacks-accrual-invalid',
					`gainStacks accrual.window must be a positive number of seconds (got ${JSON.stringify(acc.window)})`,
					location
				);
			}
			if (eff.trigger.type !== 'onReaction' || eff.trigger.source !== 'team') {
				push(
					'strict',
					'gainstacks-accrual-trigger',
					`gainStacks accrual is read only on an onReaction grant with source "team" — a reaction tick has no trigger character`,
					location
				);
			}
			if (
				eff.procCooldown !== undefined ||
				eff.lifetime !== undefined ||
				eff.drain !== undefined ||
				eff.sourceLifetime !== undefined
			) {
				push(
					'strict',
					'gainstacks-accrual-conflict',
					`gainStacks accrual cannot sit beside procCooldown, lifetime, drain or sourceLifetime — amount is a rate per second here`,
					location
				);
			}
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
		if (
			eff.trigger.type !== 'onCast' &&
			eff.trigger.type !== 'onHit' &&
			// A summon's tick (stepped stacks round) — summon-hosted only (D.28).
			eff.trigger.type !== 'summonTick'
		) {
			push(
				'strict',
				'consumestacks-trigger-invalid',
				`consumeStacks effect trigger.type must be "onCast", "onHit" or "summonTick" (got "${eff.trigger.type}")`,
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
		const mod = (eff as { mod?: unknown }).mod;
		if (mod !== undefined && (typeof mod !== 'string' || !/^[a-z][A-Za-z0-9]*$/.test(mod))) {
			push(
				'strict',
				'resshred-mod-invalid',
				`resShred mod must be a camelCase key, got ${JSON.stringify(mod)}`,
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

	// (B.16) onStack trigger shape (stack-threshold round, 2026-09-18): the
	// keys it sums, a positive integer threshold, a dominant key from the set,
	// and an effect type the reader acts on. Key authorship and reachability
	// are character-level (D.40) — they need every grant in hand.
	if (eff.trigger.type === 'onStack') {
		const t = eff.trigger as {
			keys?: unknown;
			count?: unknown;
			dominant?: unknown;
			label?: unknown;
		};
		const keysOk =
			Array.isArray(t.keys) &&
			t.keys.length > 0 &&
			t.keys.every((k) => typeof k === 'string' && k.length > 0);
		if (!keysOk) {
			push(
				'strict',
				'onstack-keys-invalid',
				`onStack trigger needs a non-empty keys[] of stack keys (got ${JSON.stringify(t.keys)})`,
				location
			);
		}
		if (typeof t.count !== 'number' || !Number.isInteger(t.count) || t.count <= 0) {
			push(
				'strict',
				'onstack-count-invalid',
				`onStack trigger count must be a positive integer (got ${JSON.stringify(t.count)})`,
				location
			);
		}
		if (t.dominant !== undefined) {
			if (typeof t.dominant !== 'string' || !keysOk || !(t.keys as string[]).includes(t.dominant)) {
				push(
					'strict',
					'onstack-dominant-invalid',
					`onStack dominant must name one of the trigger's keys (got ${JSON.stringify(t.dominant)})`,
					location
				);
			}
		}
		if (t.label !== undefined && (typeof t.label !== 'string' || t.label.length === 0)) {
			push(
				'strict',
				'onstack-label-invalid',
				`onStack label must be a non-empty string when present`,
				location
			);
		}
		if (
			eff.type !== 'buff' &&
			eff.type !== 'damage' &&
			eff.type !== 'shield' &&
			eff.type !== 'energy' &&
			eff.type !== 'resShred' &&
			eff.type !== 'gainStacks'
		) {
			push(
				'strict',
				'onstack-effect-unread',
				`onStack is read for buff, damage (a mark), shield, energy, resShred and gainStacks effects — a "${eff.type}" on it reaches nothing`,
				location
			);
		}
		// A stack per fire (stack-count display round, 2026-09-19). A fire lands at
		// a reaction, a tick or a scheduled poll — no segment pool is in hand, so
		// the grant must live rotation-wide (the summon-tick rule) — and a grant of
		// one of the threshold's OWN keys would re-arm the fire that made it.
		if (eff.type === 'gainStacks') {
			if (eff.scope !== 'rotation') {
				push(
					'strict',
					'onstack-gainstacks-scope',
					`a gainStacks on an onStack trigger must declare scope: 'rotation' — a fire has no segment pool to write`,
					location
				);
			}
			if (Array.isArray(t.keys) && t.keys.includes(eff.key)) {
				push(
					'strict',
					'onstack-gainstacks-own-key',
					`a gainStacks on an onStack trigger cannot grant one of the threshold's own keys ("${eff.key}")`,
					location
				);
			}
		}
		if (eff.type === 'damage' && eff.application === undefined) {
			push(
				'strict',
				'onstack-damage-application-missing',
				`a damage effect on onStack must state application: [] — the fire is a mark and applies nothing, and an absent list means "unmeasured" everywhere else`,
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
