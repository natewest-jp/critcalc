/**
 * src/lib/timeline/mergeRefreshedBars.ts
 *
 * Refresh-merge for buff ROWS (2026-08-15).
 *
 * ⚓ A BUFF RE-APPLIED BEFORE IT EXPIRES IS ONE COVERED SPAN, NOT TWO BARS.
 * Every emit site in `deriveBuffWindows` produces one window per mechanical
 * trigger — which is correct, and the IR keeps it that way for provenance and
 * for the export. What the CHART wants is different: two windows saying the
 * same thing at overlapping times used to draw as two bars, two leading edges
 * and — the actual pain — TWO LABELS, the second landing on top of the first's
 * tail. Merging happens here, at the projection, so the windows stay honest and
 * only the drawing changes.
 *
 * ⛔ NO INTERIOR SEAMS (⚓ Nate 2026-08-15). A merged bar gets ONE lit leading
 * edge and nothing inside it. The seam was considered and refused on a
 * principle worth keeping: in the Team Builder's Compare the lane IS the
 * ability, so a seam is the only place "where does this cast end" can live —
 * but in the planner the cast markers and E/Q bars sit one row up, so a seam in
 * a buff row re-encodes what the chart already says. That is the same
 * redundancy the labels were guilty of. The 2px edge itself STAYS; it was only
 * ever doing two jobs (separating stacked bars, and marking a buff bar as a
 * different kind of object), and merging retires the first while leaving the
 * second untouched.
 *
 * ⚓ The payoff is that a seam becomes MEANINGFUL. Only same-shape overlaps
 * merge, so two bars that still touch in one row are genuinely different — a
 * stack-scaled buff at 2 stacks vs 3, or a cast whose conditions qualified a
 * different effect set. Today an edge means "a bar starts here" and is nearly
 * always noise; after this it means "the buff CHANGED here".
 */

import type { MergedEffectDisplay } from './types';

/** The shape both buff-row bar types share. */
type MergeableBar = {
	start: number;
	end: number;
	effects: MergedEffectDisplay[];
};

/** Two bars say the same thing iff their display effects match pairwise. The
 *  comparison is on the FORMATTED value, not the underlying effect object,
 *  because that is exactly the question being asked: would these two bars print
 *  identical text? A stack-scaled buff that ramped between the two triggers
 *  formats differently and therefore stays two bars, which is the intent. */
function sameDisplay(a: MergeableBar, b: MergeableBar): boolean {
	if (a.effects.length !== b.effects.length) return false;
	return a.effects.every(
		(e, i) => e.stat === b.effects[i].stat && e.displayValue === b.effects[i].displayValue
	);
}

/**
 * Collapse overlapping same-shape bars within ONE row into single spans.
 *
 * `canMerge` is an extra per-consumer gate, checked only after the display
 * comparison passes. The received surface needs it: its bars carry ramp/decay
 * envelopes drawn from `buffStart`, and a refreshed ramp RESTARTS — merging two
 * of those would paint one continuous gradient over a buff that actually
 * reset. It also carries `procCooldown` and `duration` for the tooltip, which
 * must agree before two bars can become one.
 *
 * ⚠ Sorts by start first. Bars arrive in window-EMISSION order (`id`), which is
 * per-track and only incidentally time-ordered; the renderer's `labelCapPx`
 * already assumed `bars[i + 1]` is the next bar SPATIALLY, so sorting fixes a
 * latent mismatch as well as making the merge order-independent.
 */
export function mergeRefreshedBars<T extends MergeableBar>(
	bars: T[],
	canMerge?: (a: T, b: T) => boolean
): T[] {
	if (bars.length < 2) return bars;
	const sorted = [...bars].sort((a, b) => a.start - b.start || a.end - b.end);
	const out: T[] = [];
	for (const bar of sorted) {
		const open = out[out.length - 1];
		if (
			open &&
			bar.start <= open.end &&
			sameDisplay(open, bar) &&
			(canMerge === undefined || canMerge(open, bar))
		) {
			// ⚠ max(), not assignment: a shorter effect re-triggering inside a
			// longer open window must not pull its end backwards.
			open.end = Math.max(open.end, bar.end);
			continue;
		}
		// Copied rather than pushed by reference — `open.end` above mutates, and
		// the caller's array must not change under it.
		out.push({ ...bar });
	}
	return out;
}
