/**
 * src/lib/coverage/coverageWidths.ts
 *
 * ⚓ THE WEIGHTING, DRAWN. The coverage strip prints no percentage
 * (docs/rounds/coverage-round.md §1): what a gap costs is its WIDTH, and every width is
 * here, in one table, in units. Timing is widest because frames shift everything
 * after them; a missing buff is narrowest.
 *
 * 🎛️ NATE'S TO TUNE — these are the spec's §2.1 first cut, not measurements
 * (memory feedback_expose_tuning_knobs). The strip, its column headers and its
 * legend all read this one table, so a change here moves every row at once and
 * no row can disagree with another (⚓ identical places).
 */

import type { CoverageSegmentKey } from './deriveCoverage';

export const COVERAGE_WIDTHS: Record<CoverageSegmentKey, number> = {
	'N.timing': 1.0,
	'N.application': 0.5,
	'C.timing': 0.5,
	'C.application': 0.25,
	'P.timing': 0.5,
	'P.application': 0.25,
	'E.timing': 1.0,
	'E.application': 0.6,
	'E.grants': 0.4,
	'Q.timing': 1.0,
	'Q.application': 0.6,
	'Q.grants': 0.4,
	A1: 0.6,
	A4: 0.6,
	/** A third passive or a faction bonus — not in the spec's nine; ⏭ Nate. */
	extra: 0.5,
	C1: 0.5,
	C2: 0.5,
	C4: 0.5,
	C6: 0.5
};

/** Gap between two columns, in px — the eye reads a column across rows. */
export const COVERAGE_COLUMN_GAP_PX = 6;
/** Seam between two sub-segments of one column, in px. */
export const COVERAGE_SEAM_PX = 1;
