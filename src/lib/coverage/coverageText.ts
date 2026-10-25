/**
 * src/lib/coverage/coverageText.ts
 *
 * Every user-facing string on the coverage page that is not a character's own
 * `caveat` or `notModeled.reason`. ⚓ Nate 2026-09-23: a limitation is the
 * ROTATION PLANNER's ("The Rotation Planner doesn't…"), never "we" — "we"
 * reads as a stance taken, the tool's name as a limit of this tool. ⚓ One whole sentence per line code (style
 * guide §3.1 — a string is a sentence, never assembled from parts); a line's
 * `form` renders as its own label beside the sentence, never inside it. Kept in
 * one module so the i18n extraction finds them together.
 */

import type {
	CoverageColumn,
	CoverageFacet,
	CoverageLineCode,
	CoverageSegmentKey,
	CoverageState
} from './deriveCoverage';

export const LINE_TEXT: Record<CoverageLineCode, string> = {
	'frames.gcsim': 'Timed from gcsim’s frame data.',
	'frames.gcsimPr':
		'Timed from a gcsim change that hasn’t been merged yet, so these frames may still move.',
	'frames.wiki': 'Timed from wiki frame counts rather than gcsim.',
	'frames.hand': 'Timed from frame counts measured by hand rather than gcsim.',
	'frames.none': 'There is no frame data for this yet, so the planner uses a generic length.',
	'frames.someForms': 'Some forms have no frame data and use a generic length.',
	'charged.generic':
		'This kit has no charged-attack frames, so C is timed with a generic stand-in.',
	'plunge.generic': 'This kit has no plunge frames, so P is timed with a generic stand-in.',
	'app.lands': 'Each hit applies its element when it lands.',
	'app.atSwingEnd': 'The element is applied at the end of the swing rather than at the hit.',
	'app.physical': 'These attacks deal Physical DMG, so there is no element to apply.',
	'app.nonHitting': 'This lands no hit.',
	'app.measured': 'Element, timing and gauge units are measured from gcsim.',
	'app.appliesNothing': 'Measured from gcsim: this applies no element.',
	'app.atCast':
		'Not measured yet, so the rotation planner applies the element once, at the cast, and marks it on the aura lane.',
	'app.unitsUnmeasured': 'Timing is measured, but some hits’ gauge units are assumed to be 1U.',
	'grants.authored': 'Its effects are drawn on the timeline.',
	'grants.elsewhere': 'Drawn as part of another ability.',
	'grants.summon': 'Its summon is drawn, with its hits.',
	'grants.window': 'The state it opens is drawn on the timeline.',
	'grants.summonSilent': 'Its summon’s window is drawn, but its hits aren’t yet.',
	'grants.summonDealsNothing': 'Its summon is drawn; it deals no damage of its own.',
	'grants.noReader':
		'Part of this waits on healing, energy or HP changes, which the planner doesn’t track, so it isn’t drawn.',
	'grants.unknownValue': 'Its exact value isn’t known yet, so the bar is drawn without one.',
	'grants.none': 'This hasn’t been added to the planner yet.',
	'grants.nothingToModel': 'Nothing here changes what the planner draws.',
	'grants.notModeled': 'The rotation planner doesn’t show this.',
	'grants.noHost': 'There’s nothing in this slot.'
};

export const STATE_LABEL: Record<CoverageState, string> = {
	lit: 'Modeled',
	provisional: 'Stand-in',
	missing: 'Missing',
	notModeled: 'Not modeled',
	na: 'Nothing to model'
};

export const STATE_DESCRIPTION: Record<CoverageState, string> = {
	lit: 'Drawn by the planner.',
	provisional: 'Drawn with a stand-in.',
	missing: 'In the kit, not yet in the planner.',
	notModeled: 'Outside the planner’s scope; the details say why.',
	na: 'Nothing of that kind in the kit.'
};

/** Column headers — the ONLY labels on the strip (rows carry none). */
export const COLUMN_LABEL: Record<CoverageColumn, string> = {
	normals: 'Normal',
	skill: 'Skill',
	burst: 'Burst',
	a1: 'A1',
	a4: 'A4',
	extra: 'Other',
	c1: 'C1',
	c2: 'C2',
	c4: 'C4',
	c6: 'C6'
};

export const FACET_LABEL: Record<CoverageFacet, string> = {
	timing: 'Timing',
	application: 'Element',
	grants: 'Effects'
};

/** A sub-segment's own title, for the tooltip head and the details list. */
export const SEGMENT_TITLE: Record<CoverageSegmentKey, string> = {
	'N.timing': 'Normal attack · timing',
	'N.application': 'Normal attack · element',
	'C.timing': 'Charged attack · timing',
	'C.application': 'Charged attack · element',
	'P.timing': 'Plunge · timing',
	'P.application': 'Plunge · element',
	'E.timing': 'Skill · timing',
	'E.application': 'Skill · element',
	'E.grants': 'Skill · effects',
	'Q.timing': 'Burst · timing',
	'Q.application': 'Burst · element',
	'Q.grants': 'Burst · effects',
	A1: 'First ascension passive',
	A4: 'Fourth ascension passive',
	extra: 'Other passives',
	C1: 'Constellation 1',
	C2: 'Constellation 2',
	C4: 'Constellation 4',
	C6: 'Constellation 6'
};
