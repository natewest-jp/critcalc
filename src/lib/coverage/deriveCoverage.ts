/**
 * src/lib/coverage/deriveCoverage.ts
 *
 * Derives a character's COVERAGE — how much of the kit the Rotation Planner
 * represents, per piece of kit anatomy — from the character JSON. The
 * `/coverage` page draws it as a strip; the eager index carries it compactly
 * (`encodeCoverage`), stamped by scripts/generate-character-index.mjs and
 * drift-guarded by characterIndex.test.ts. Spec: docs/coverage-round.md.
 *
 * ⚓ DERIVED, never hand-maintained (the deriveCapabilities pattern). Where the
 * data cannot say something the strip needs, the DATA learns to say it — the
 * three positive statements this module reads are `notModeled` (a ruling),
 * `nothingToModel` (n/a) and a summon's `dealsNothing` — never this file.
 *
 * ⚓ The output is STATES and line CODES, never prose: the page turns a code
 * into one whole sentence (style guide §3.1 — a string is a sentence, never
 * assembled from parts), so this module stays locale-free.
 *
 * Runtime-import-free except for sibling modules that are themselves
 * runtime-import-free, imported with their `.ts` extension, so plain Node
 * ≥22.18 can execute it via native type stripping (the generator imports it).
 */

import type { CharacterData } from '$lib/types/character';
import type {
	Ability,
	AbilityVariant,
	CastAbility,
	Condition,
	Effect,
	FrameMap,
	NormalAbility,
	Summon
} from '$lib/types/ability';
import { landsAt } from '../utils/frames.ts';

// ---------------------------------------------------------------------------
// The strip's anatomy — ONE table, fixed order (⚓ identical places)
// ---------------------------------------------------------------------------

export type CoverageColumn =
	| 'normals'
	| 'skill'
	| 'burst'
	| 'a1'
	| 'a4'
	| 'extra'
	| 'c1'
	| 'c2'
	| 'c4'
	| 'c6';

/** A sub-segment of the strip. Action columns carry a timing | application
 *  (| grants) ladder; effect columns are one `grants` segment. */
export type CoverageFacet = 'timing' | 'application' | 'grants';

export type CoverageSegmentKey =
	| 'N.timing'
	| 'N.application'
	| 'C.timing'
	| 'C.application'
	| 'P.timing'
	| 'P.application'
	| 'E.timing'
	| 'E.application'
	| 'E.grants'
	| 'Q.timing'
	| 'Q.application'
	| 'Q.grants'
	| 'A1'
	| 'A4'
	| 'extra'
	| 'C1'
	| 'C2'
	| 'C4'
	| 'C6';

export type CoverageSegment = {
	key: CoverageSegmentKey;
	column: CoverageColumn;
	facet: CoverageFacet;
	/** `N` / `C` / `P` inside the Normals column; absent elsewhere. */
	action?: 'N' | 'C' | 'P';
};

/** ⚓ The fixed order of the strip. ⛔ Never conditional per character — the
 *  encoded index string is positional, so reordering this is a format change
 *  (regenerate the index). */
export const COVERAGE_SEGMENTS: readonly CoverageSegment[] = [
	{ key: 'N.timing', column: 'normals', facet: 'timing', action: 'N' },
	{ key: 'N.application', column: 'normals', facet: 'application', action: 'N' },
	{ key: 'C.timing', column: 'normals', facet: 'timing', action: 'C' },
	{ key: 'C.application', column: 'normals', facet: 'application', action: 'C' },
	{ key: 'P.timing', column: 'normals', facet: 'timing', action: 'P' },
	{ key: 'P.application', column: 'normals', facet: 'application', action: 'P' },
	{ key: 'E.timing', column: 'skill', facet: 'timing' },
	{ key: 'E.application', column: 'skill', facet: 'application' },
	{ key: 'E.grants', column: 'skill', facet: 'grants' },
	{ key: 'Q.timing', column: 'burst', facet: 'timing' },
	{ key: 'Q.application', column: 'burst', facet: 'application' },
	{ key: 'Q.grants', column: 'burst', facet: 'grants' },
	{ key: 'A1', column: 'a1', facet: 'grants' },
	{ key: 'A4', column: 'a4', facet: 'grants' },
	{ key: 'extra', column: 'extra', facet: 'grants' },
	{ key: 'C1', column: 'c1', facet: 'grants' },
	{ key: 'C2', column: 'c2', facet: 'grants' },
	{ key: 'C4', column: 'c4', facet: 'grants' },
	{ key: 'C6', column: 'c6', facet: 'grants' }
];

// ---------------------------------------------------------------------------
// States and line codes
// ---------------------------------------------------------------------------

/** The five states (spec §3). ⚓ `na` vs `missing` is the page's whole
 *  honesty — n/a is NEVER drawn as missing, and `notModeled` NEVER counts
 *  against a character. */
export type CoverageState = 'lit' | 'provisional' | 'missing' | 'notModeled' | 'na';

/** What a sub-segment's tooltip says, as a code the page turns into ONE whole
 *  sentence. `form` names the ability/variant when a column has several. */
export type CoverageLineCode =
	// timing
	| 'frames.gcsim'
	| 'frames.gcsimPr'
	| 'frames.wiki'
	| 'frames.hand'
	| 'frames.none'
	| 'frames.someForms'
	| 'charged.generic'
	| 'plunge.generic'
	// application
	| 'app.lands'
	| 'app.atSwingEnd'
	| 'app.physical'
	| 'app.nonHitting'
	| 'app.measured'
	| 'app.appliesNothing'
	| 'app.atCast'
	| 'app.unitsUnmeasured'
	// grants
	| 'grants.authored'
	| 'grants.elsewhere'
	| 'grants.summon'
	| 'grants.window'
	| 'grants.summonSilent'
	| 'grants.summonDealsNothing'
	| 'grants.noReader'
	| 'grants.unknownValue'
	| 'grants.none'
	| 'grants.nothingToModel'
	| 'grants.notModeled'
	| 'grants.noHost';

export type CoverageLine = { code: CoverageLineCode; state: CoverageState; form?: string };

export type CoverageCell = {
	state: CoverageState;
	lines: CoverageLine[];
	/** Ids of the ability-shaped hosts this cell reads — the page looks up each
	 *  one's `caveat` (lint E.28 puts every caveat on such a host, so a caveat's
	 *  host IS its column). */
	hosts: string[];
	/** `notModeled.reason`, user-facing, when the host carries a ruling. */
	reason?: string;
};

export type Coverage = Record<CoverageSegmentKey, CoverageCell>;

/** ⚓ Worst-wins order across a column's forms. `notModeled` outranks `lit`
 *  so a ruling on one form is not hidden by a sibling; it never outranks a
 *  gap. */
const RANK: Record<CoverageState, number> = {
	na: 0,
	lit: 1,
	notModeled: 2,
	provisional: 3,
	missing: 4
};

export function worstState(states: CoverageState[]): CoverageState {
	let worst: CoverageState = 'na';
	for (const s of states) if (RANK[s] > RANK[worst]) worst = s;
	return worst;
}

function cell(lines: CoverageLine[], hosts: string[], reason?: string): CoverageCell {
	return { state: worstState(lines.map((l) => l.state)), lines, hosts, reason };
}

// ---------------------------------------------------------------------------
// Frames provenance
// ---------------------------------------------------------------------------

/** Where a character's FrameMaps came from (`CharacterMeta.framesSource`).
 *  Absent = `gcsim` (merged main). Anything else is a stand-in until gcsim
 *  main carries the character. */
export type FramesSource = 'gcsim' | 'gcsim-pr' | 'wiki' | 'hand';

const FRAMES_LINE: Record<FramesSource, { code: CoverageLineCode; state: CoverageState }> = {
	gcsim: { code: 'frames.gcsim', state: 'lit' },
	'gcsim-pr': { code: 'frames.gcsimPr', state: 'provisional' },
	wiki: { code: 'frames.wiki', state: 'provisional' },
	hand: { code: 'frames.hand', state: 'provisional' }
};

// ---------------------------------------------------------------------------
// Grants — the effect surface
// ---------------------------------------------------------------------------

/** Triggers with NO reader anywhere (memory project_manual_trigger_retirement):
 *  an effect on one is data the planner draws nothing for. */
const UNREAD_TRIGGERS = new Set([
	'onHeal',
	'onEnergy',
	'onHPChange',
	'onHPDecrease',
	'onHPIncrease'
]);

function effectLines(effects: Effect[], form?: string): CoverageLine[] {
	const lines: CoverageLine[] = [];
	if (effects.some((e) => UNREAD_TRIGGERS.has(e.trigger?.type)))
		lines.push({ code: 'grants.noReader', state: 'provisional', form });
	if (effects.some(hasUnknownValue))
		lines.push({ code: 'grants.unknownValue', state: 'provisional', form });
	if (lines.length === 0 || effects.some((e) => !UNREAD_TRIGGERS.has(e.trigger?.type)))
		lines.unshift({ code: 'grants.authored', state: 'lit', form });
	return lines;
}

function hasUnknownValue(e: Effect): boolean {
	const v = (e as { value?: unknown }).value;
	return typeof v === 'object' && v !== null && (v as { type?: string }).type === 'unknown';
}

/** A summon is covered when something carries its damage — its own tick
 *  series or proc (`effects`), or the casting ability's `application[]`
 *  schedule or a `damage` proc on it (Ganyu's lotus, Klee's Sparks, Albedo's
 *  blossom; docs/summon-tick-gaps-round.md §0) — or when it states it deals
 *  nothing. Otherwise its window draws and its hits may not. */
function summonLines(
	s: Summon,
	carrier: { application?: { frame: number }[]; effects?: Effect[]; anim?: number },
	form?: string
): CoverageLine {
	const f = form ?? s.label;
	if (s.dealsNothing) return { code: 'grants.summonDealsNothing', state: 'lit', form: f };
	const carried =
		(s.effects?.length ?? 0) > 0 ||
		// A schedule carries a summon only when it reaches past the cast's own
		// animation or lands after the summon spawns — one hit at the cast is
		// the cast's, not the summon's (Diluc's Phoenix is the second case).
		(carrier.application ?? []).some(
			(e) =>
				carrier.anim === undefined ||
				e.frame > carrier.anim ||
				(s.spawnsAt !== undefined && e.frame > s.spawnsAt)
		) ||
		(carrier.effects ?? []).some((e) => e.type === 'damage');
	if (carried) return { code: 'grants.summon', state: 'lit', form: f };
	return { code: 'grants.summonSilent', state: 'provisional', form: f };
}

function opensWindow(cast: CastAbility): boolean {
	const c = cast as {
		behavior?: string;
		opensState?: unknown;
		opensTransientState?: unknown;
	};
	return (
		c.behavior === 'stance' ||
		c.behavior === 'persistent' ||
		c.opensState !== undefined ||
		c.opensTransientState !== undefined ||
		(cast.variants ?? []).some(
			(v) => v.behavior === 'stance' || v.behavior === 'persistent' || v.opensState !== undefined
		)
	);
}

/** The grants of one ability-shaped host, its own surface only. */
function hostGrantLines(host: Ability): CoverageLine[] {
	const lines: CoverageLine[] = [];
	if (host.effects?.length) lines.push(...effectLines(host.effects));
	const cast = host.abilityType === 'skill' || host.abilityType === 'burst' ? host : null;
	if (cast) {
		for (const s of cast.summons ?? [])
			lines.push(summonLines(s, { ...cast, anim: cast.frames?.anim }));
		if ((cast as { activeDuration?: number }).activeDuration !== undefined && lines.length === 0)
			lines.push({ code: 'grants.authored', state: 'lit' });
		// A stance or a timed window IS what the cast grants (Wanderer's Hanega,
		// Zhongli's Petrification): the planner draws it, whether or not the
		// cast also carries effects.
		if (opensWindow(cast)) lines.push({ code: 'grants.window', state: 'lit' });
		for (const v of cast.variants ?? []) {
			if (v.effects?.length) lines.push(...effectLines(v.effects, v.label));
			for (const s of v.summons ?? [])
				lines.push(
					summonLines(
						s,
						{
							application: v.application ?? cast.application,
							effects: v.effects ?? cast.effects,
							anim: (v.frames ?? cast.frames)?.anim
						},
						v.label
					)
				);
			if (v.activeDuration !== undefined && !v.effects?.length && !v.summons?.length)
				lines.push({ code: 'grants.authored', state: 'lit', form: v.label });
		}
	}
	return lines;
}

/** Evidence that a passive or constellation is authored SOMEWHERE ELSE in the
 *  kit: a constellation-gated variant (Chiori C2), a constellation- or
 *  ascension-gated condition on another host's effect, or a modifier whose
 *  `source` names it ("A1: Rekindle", "C4: Sentinel Oath"). Keyed `A1`/`A4`/
 *  `C1`…`C6`. */
function authoredElsewhere(c: CharacterData): Map<string, Set<string>> {
	const out = new Map<string, Set<string>>();
	const note = (key: string, hostId: string) => {
		if (!out.has(key)) out.set(key, new Set());
		out.get(key)!.add(hostId);
	};
	const scanCondition = (cond: Condition | undefined, hostId: string) => {
		if (!cond) return;
		switch (cond.type) {
			case 'constellation':
				note(`C${cond.level}`, hostId);
				return;
			case 'ascension':
				note(`A${cond.min}`, hostId);
				return;
			case 'all':
			case 'any':
				for (const sub of cond.conditions) scanCondition(sub, hostId);
				return;
			// ⚠️ A `not` gate is a PRE-constellation behaviour (the Nascent rung),
			// never evidence that the gated entry is authored.
			default:
				return;
		}
	};
	const walk = (o: unknown, hostId: string) => {
		if (Array.isArray(o)) {
			for (const x of o) walk(x, hostId);
			return;
		}
		if (!o || typeof o !== 'object') return;
		const rec = o as Record<string, unknown>;
		for (const [k, v] of Object.entries(rec)) {
			if (k === 'conditions' && v && typeof v === 'object' && !Array.isArray(v))
				scanCondition(v as Condition, hostId);
			else if ((k === 'source' || k === 'attribution') && typeof v === 'string') {
				const m = /^(A1|A4|C[1-6]):/.exec(v);
				if (m) note(m[1], hostId);
			} else walk(v, hostId);
		}
	};
	for (const a of c.abilities) walk(a, a.id);
	for (const p of c.passives ?? []) walk(p, p.id);
	for (const k of c.constellations ?? []) walk(k, k.id);
	// A faction bonus can carry a constellation's half (Venti's C4 rides his
	// Secret Rite); it has no ability id, so it is credited to no host.
	for (const fb of c.factionBonuses ?? []) walk(fb, '');
	return out;
}

/** A passive or constellation's ONE `grants` cell. */
function effectHostCell(
	host: Ability | undefined,
	elsewhere: Set<string> | undefined
): CoverageCell {
	if (!host) return cell([{ code: 'grants.noHost', state: 'na' }], []);
	const hosts = [host.id];
	if (host.notModeled)
		return cell(
			[{ code: 'grants.notModeled', state: 'notModeled' }],
			hosts,
			host.notModeled.reason
		);
	if (host.modeledBy)
		return cell([{ code: 'grants.elsewhere', state: 'lit' }], [...hosts, host.modeledBy]);
	const own = hostGrantLines(host);
	const others = [...(elsewhere ?? [])].filter((id) => id !== host.id);
	if (own.length === 0 && others.length > 0) own.push({ code: 'grants.elsewhere', state: 'lit' });
	if (own.length > 0) return cell(own, [...hosts, ...others.filter((id) => id !== '')]);
	if (host.nothingToModel) return cell([{ code: 'grants.nothingToModel', state: 'na' }], hosts);
	return cell([{ code: 'grants.none', state: 'missing' }], hosts);
}

// ---------------------------------------------------------------------------
// Normals
// ---------------------------------------------------------------------------

function isFramed(fm: FrameMap | undefined): fm is FrameMap {
	return !!fm && typeof fm.anim === 'number';
}

function normalTimingLine(
	maps: (FrameMap | undefined)[],
	source: FramesSource,
	form?: string
): CoverageLine {
	if (maps.length === 0 || !maps.every(isFramed))
		return { code: 'frames.none', state: 'missing', form };
	return { ...FRAMES_LINE[source], form };
}

/** ⚓ When a swing's element lands: at its stated landing (`landsAt`, the ONE
 *  resolver), or — a map that states none — at the swing's end. */
function landingLine(maps: (FrameMap | undefined)[], form?: string): CoverageLine {
	if (maps.length === 0 || !maps.every(isFramed))
		return { code: 'frames.none', state: 'missing', form };
	if (maps.every((fm) => landsAt(fm) !== null)) return { code: 'app.lands', state: 'lit', form };
	return { code: 'app.atSwingEnd', state: 'provisional', form };
}

type SwingKind = 'N' | 'C' | 'P';

/** Whether a swing of this kind applies an element at all. Mirrors
 *  `resolveActionElement` (catalysts always; a bow's charged shot; any
 *  infusion) plus a GRANTED infusion anywhere in the kit, which can make the
 *  same swing elemental for a window. */
function swingIsElemental(c: CharacterData, form: NormalAbility, kind: SwingKind): boolean {
	if (c.weapon === 'catalyst') return true;
	if (kind === 'C' && c.weapon === 'bow') return true;
	if (form.infusion !== undefined || form.coInfusion !== undefined) return true;
	return kitGrantsInfusion(c);
}

function kitGrantsInfusion(c: CharacterData): boolean {
	return JSON.stringify([c.abilities, c.passives, c.constellations]).includes('"type":"infuse"');
}

function nonHitting(form: NormalAbility, kind: SwingKind): boolean {
	const nh = form.nonHitting;
	if (!nh) return false;
	return kind === 'N' ? !!nh.normal : kind === 'C' ? !!nh.charged : !!nh.plunge;
}

function swingMaps(form: NormalAbility, kind: SwingKind): (FrameMap | undefined)[] {
	if (kind === 'N') return (form.hits ?? []).map((h) => h.frames);
	if (kind === 'C') {
		if (form.chargeHits?.length) return form.chargeHits.map((h) => h.frames);
		return form.chargeFrames ? [form.chargeFrames] : [];
	}
	const maps: (FrameMap | undefined)[] = [];
	if (form.plungeFrames) maps.push(form.plungeFrames);
	if (form.lowPlungeFrames) maps.push(form.lowPlungeFrames);
	for (const v of form.plungeVariants ?? []) maps.push(v.frames);
	return maps;
}

function normalsCells(
	c: CharacterData,
	source: FramesSource
): Pick<
	Coverage,
	'N.timing' | 'N.application' | 'C.timing' | 'C.application' | 'P.timing' | 'P.application'
> {
	const forms = c.abilities.filter((a): a is NormalAbility => a.abilityType === 'normal');
	const hosts = forms.map((f) => f.id);
	const named = forms.length > 1;
	const out = {} as Pick<
		Coverage,
		'N.timing' | 'N.application' | 'C.timing' | 'C.application' | 'P.timing' | 'P.application'
	>;
	for (const kind of ['N', 'C', 'P'] as const) {
		const timing: CoverageLine[] = [];
		const application: CoverageLine[] = [];
		// A form states a C or a P only if it carries maps for it; the kind is
		// MISSING only when no form does (a stance sibling without a charged
		// attack of its own is not a gap in the kit).
		const stating = kind === 'N' ? forms : forms.filter((f) => swingMaps(f, kind).length > 0);
		if (stating.length === 0) {
			// ⚓ An absent C or P is TAKEN with a stand-in (`GENERIC_CHARGE_FRAMES` /
			// `GENERIC_PLUNGE_FRAMES`) — a claymore's spin is the common case — so
			// it is provisional, not missing. Only a frameless kit is missing here.
			const generic =
				kind !== 'N' &&
				forms.some(
					(f) => (f.hits ?? []).every((h) => isFramed(h.frames)) && (f.hits ?? []).length > 0
				);
			const genericCode: CoverageLineCode = kind === 'C' ? 'charged.generic' : 'plunge.generic';
			timing.push(
				generic
					? { code: genericCode, state: 'provisional' }
					: { code: 'frames.none', state: 'missing' }
			);
			application.push(
				forms.some((f) => swingIsElemental(c, f, kind))
					? generic
						? { code: genericCode, state: 'provisional' }
						: { code: 'frames.none', state: 'missing' }
					: { code: 'app.physical', state: 'na' }
			);
		}
		for (const f of stating) {
			const form = named ? f.name : undefined;
			const maps = swingMaps(f, kind);
			timing.push(normalTimingLine(maps, source, form));
			if (nonHitting(f, kind)) application.push({ code: 'app.nonHitting', state: 'na', form });
			else if (!swingIsElemental(c, f, kind))
				application.push({ code: 'app.physical', state: 'na', form });
			else application.push(landingLine(maps, form));
		}
		out[`${kind}.timing`] = cell(timing, hosts);
		out[`${kind}.application`] = cell(application, hosts);
	}
	return out;
}

// ---------------------------------------------------------------------------
// Skill / burst
// ---------------------------------------------------------------------------

type CastForm = {
	label?: string;
	frames?: FrameMap;
	application?: CastAbility['application'];
	nonHitting?: boolean;
};

function castForms(a: CastAbility): { base: CastForm; variants: (AbilityVariant & CastForm)[] } {
	return {
		base: { frames: a.frames, application: a.application, nonHitting: a.nonHitting === true },
		variants: a.variants ?? []
	};
}

function castTimingLines(a: CastAbility, source: FramesSource, form?: string): CoverageLine[] {
	const { base, variants } = castForms(a);
	if (isFramed(base.frames)) return [{ ...FRAMES_LINE[source], form }];
	const framed = variants.filter((v) => isFramed(v.frames));
	if (framed.length === 0) return [{ code: 'frames.none', state: 'missing', form }];
	// The base is unframed but some variant carries frames: the unframed forms
	// ride the generic cast length.
	return [
		{ ...FRAMES_LINE[source], form },
		{ code: 'frames.someForms', state: 'provisional', form }
	];
}

function applicationLine(f: CastForm, form?: string): CoverageLine {
	if (f.nonHitting) return { code: 'app.nonHitting', state: 'na', form };
	if (f.application === undefined) return { code: 'app.atCast', state: 'provisional', form };
	if (f.application.length === 0) return { code: 'app.appliesNothing', state: 'lit', form };
	if (f.application.some((e) => e.units === undefined))
		return { code: 'app.unitsUnmeasured', state: 'provisional', form };
	return { code: 'app.measured', state: 'lit', form };
}

function castApplicationLines(a: CastAbility, form?: string): CoverageLine[] {
	const { base, variants } = castForms(a);
	const lines = [applicationLine(base, form)];
	for (const v of variants) {
		// A variant that restates neither field inherits the base's application.
		if (v.application === undefined && v.nonHitting === undefined) continue;
		lines.push(
			applicationLine(
				{ application: v.application ?? base.application, nonHitting: v.nonHitting === true },
				form ? `${form} · ${v.label}` : v.label
			)
		);
	}
	return lines;
}

function castCells(
	c: CharacterData,
	kind: 'skill' | 'burst',
	source: FramesSource
): [CoverageCell, CoverageCell, CoverageCell] {
	const casts = c.abilities.filter((a): a is CastAbility => a.abilityType === kind);
	if (casts.length === 0) {
		const none: CoverageLine[] = [{ code: 'frames.none', state: 'missing' }];
		return [cell(none, []), cell(none, []), cell([{ code: 'grants.none', state: 'missing' }], [])];
	}
	const named = casts.length > 1;
	const hosts = casts.map((a) => a.id);
	const timing = casts.flatMap((a) => castTimingLines(a, source, named ? a.name : undefined));
	const application = casts.flatMap((a) => castApplicationLines(a, named ? a.name : undefined));
	const grants: CoverageLine[] = [];
	let reason: string | undefined;
	for (const a of casts) {
		const form = named ? a.name : undefined;
		if (a.notModeled) {
			grants.push({ code: 'grants.notModeled', state: 'notModeled', form });
			reason ??= a.notModeled.reason;
			continue;
		}
		if (a.modeledBy) {
			grants.push({ code: 'grants.elsewhere', state: 'lit', form });
			continue;
		}
		const own = hostGrantLines(a).map((l) => (form && !l.form ? { ...l, form } : l));
		if (own.length > 0) grants.push(...own);
		else if (a.nothingToModel) grants.push({ code: 'grants.nothingToModel', state: 'na', form });
		else grants.push({ code: 'grants.none', state: 'missing', form });
	}
	return [cell(timing, hosts), cell(application, hosts), cell(grants, hosts, reason)];
}

// ---------------------------------------------------------------------------
// The whole strip
// ---------------------------------------------------------------------------

export function framesSourceOf(c: CharacterData): FramesSource {
	return c.meta?.framesSource ?? 'gcsim';
}

export function deriveCoverage(c: CharacterData): Coverage {
	const source = framesSourceOf(c);
	const elsewhere = authoredElsewhere(c);
	const [eT, eA, eG] = castCells(c, 'skill', source);
	const [qT, qA, qG] = castCells(c, 'burst', source);
	const passives = c.passives ?? [];
	const cAt = (level: number) =>
		(c.constellations ?? []).find(
			(k) => k.abilityType === 'constellation' && k.constellationLevel === level
		);
	const constellationCell = (level: number) =>
		c.noConstellations
			? cell([{ code: 'grants.noHost', state: 'na' }], [])
			: effectHostCell(cAt(level), elsewhere.get(`C${level}`));

	return {
		...normalsCells(c, source),
		'E.timing': eT,
		'E.application': eA,
		'E.grants': eG,
		'Q.timing': qT,
		'Q.application': qA,
		'Q.grants': qG,
		// ⚠️ POSITIONAL: the ingest writes the ascension passives first (A1, A4),
		// then anything else — a utility passive, a Witch's Revelation, a Stellar
		// Jubilee. The `extra` column takes the rest plus faction bonuses.
		A1: effectHostCell(passives[0], elsewhere.get('A1')),
		A4: effectHostCell(passives[1], elsewhere.get('A4')),
		extra: extraCell(c, passives.slice(2)),
		C1: constellationCell(1),
		C2: constellationCell(2),
		C4: constellationCell(4),
		C6: constellationCell(6)
	};
}

/** Passives past the two ascension slots, plus faction bonuses — one cell. */
function extraCell(c: CharacterData, rest: Ability[]): CoverageCell {
	const lines: CoverageLine[] = [];
	const hosts: string[] = [];
	let reason: string | undefined;
	for (const p of rest) {
		const one = effectHostCell(p, undefined);
		hosts.push(...one.hosts);
		reason ??= one.reason;
		lines.push(...one.lines.map((l) => ({ ...l, form: l.form ?? p.name })));
	}
	for (const fb of c.factionBonuses ?? [])
		if (fb.effects?.length) lines.push(...effectLines(fb.effects, fb.name));
	if (lines.length === 0) return cell([{ code: 'grants.noHost', state: 'na' }], []);
	return cell(lines, hosts, reason);
}

// ---------------------------------------------------------------------------
// Compact form for the eager index
// ---------------------------------------------------------------------------

const STATE_CHAR: Record<CoverageState, string> = {
	lit: 'l',
	provisional: 'p',
	missing: 'm',
	notModeled: 'x',
	na: '-'
};
const CHAR_STATE: Record<string, CoverageState> = Object.fromEntries(
	Object.entries(STATE_CHAR).map(([s, ch]) => [ch, s as CoverageState])
);

/** One character per segment, in `COVERAGE_SEGMENTS` order. */
export function encodeCoverage(cov: Coverage): string {
	return COVERAGE_SEGMENTS.map((s) => STATE_CHAR[cov[s.key].state]).join('');
}

export function decodeCoverage(code: string): CoverageState[] {
	return [...code].map((ch) => CHAR_STATE[ch] ?? 'missing');
}

/** The sort key's visible face — "12 of 15": lit segments over segments that
 *  could be lit. ⚓ `na` and `notModeled` leave the denominator (a ruling
 *  never counts against a character). ⛔ Never printed as a percentage. */
export function coverageCount(states: CoverageState[]): { lit: number; of: number } {
	let lit = 0;
	let of = 0;
	for (const s of states) {
		if (s === 'na' || s === 'notModeled') continue;
		of++;
		if (s === 'lit') lit++;
	}
	return { lit, of };
}
