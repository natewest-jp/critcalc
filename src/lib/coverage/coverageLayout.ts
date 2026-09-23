/**
 * src/lib/coverage/coverageLayout.ts
 *
 * ⚓ IDENTICAL PLACES — the one grid template every coverage strip, header and
 * row is drawn on (the /coverage list and the planner's opt-in strips), built
 * from COVERAGE_WIDTHS: a track per segment, a seam between the segments of one
 * column, a gap between columns. A column therefore sits at the same x in every
 * row of every surface.
 */

import { COVERAGE_SEGMENTS, type CoverageColumn } from './deriveCoverage';
import { COVERAGE_COLUMN_GAP_PX, COVERAGE_SEAM_PX, COVERAGE_WIDTHS } from './coverageWidths';

export type CoverageLayout = {
	/** `grid-template-columns` value. */
	template: string;
	/** 1-based grid column of each segment, keyed by segment key. */
	segCol: Record<string, number>;
	/** Each column's first and last grid line, for its header label. */
	colSpan: [CoverageColumn, [number, number]][];
};

function build(): CoverageLayout {
	const tracks: string[] = [];
	const segCol: Record<string, number> = {};
	const colSpan: Partial<Record<CoverageColumn, [number, number]>> = {};
	let prev: CoverageColumn | undefined;
	for (const seg of COVERAGE_SEGMENTS) {
		if (prev !== undefined)
			tracks.push(`${seg.column === prev ? COVERAGE_SEAM_PX : COVERAGE_COLUMN_GAP_PX}px`);
		tracks.push(`${COVERAGE_WIDTHS[seg.key]}fr`);
		const line = tracks.length;
		segCol[seg.key] = line;
		const span = colSpan[seg.column];
		colSpan[seg.column] = span ? [span[0], line] : [line, line];
		prev = seg.column;
	}
	return {
		template: tracks.join(' '),
		segCol,
		colSpan: Object.entries(colSpan) as [CoverageColumn, [number, number]][]
	};
}

export const COVERAGE_LAYOUT: CoverageLayout = build();
