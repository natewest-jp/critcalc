/**
 * src/lib/timeline/barCycles.ts
 *
 * Tiling a single cast's phase layout across a fixed axis — the Team Builder's
 * Compare chart, and nothing else.
 *
 * WHY THIS EXISTS. The planner draws casts that HAPPENED: it has a parsed
 * rotation, so every bar is where the player put it. Compare has no rotation —
 * it holds one character against another with nothing between them — so drawing
 * a single cast leaves a stub in the left fifth of the track and four fifths of
 * dead air, and the reader is left doing uptime arithmetic in their head.
 *
 * Tiling the cycle across a shared absolute axis fixes that, and pays three
 * ways at once: DUTY CYCLE becomes visible as texture (a near-solid row is
 * near-permanent uptime, a dashed row has gaps) where the eye is far better
 * than it is at comparing two lengths; DURATION stays honest, because the axis
 * is still absolute shared seconds; and PERMANENT UPTIME draws itself, as a bar
 * that simply never breaks.
 *
 * ⚠ A REPEAT IS A CLAIM, AND THE PICTURE HAS TO SAY SO. Cycle 0 is what you get.
 * Everything after it assumes you cast the instant the cooldown lapses — and for
 * a burst it also assumes the energy is there, which this site does not model
 * and (per the Team Builder constitution, where energy data is reference-tier
 * and never load-bearing) should not. So every segment carries its `cycle`
 * index, the renderer draws 1..n weaker than 0, and the chart footnote names
 * energy out loud. The honesty is IN the drawing, not only beside it.
 *
 * ⛔ Charges are deliberately NOT modelled as banking. A two-charge skill can be
 * held and double-cast, which is a real cadence this tiler would have to invent
 * to draw — so it doesn't; the fact column carries `×2` and the bar shows one
 * charge's rhythm. Never fake timing.
 *
 * Pure + framework-free, like its neighbours.
 */

import { barPhases, type BarPhaseSegment } from './barPhases';

/** A runaway `cycleSeconds` (a 0.1s cooldown against a 60s axis) must not emit
 *  thousands of segments. Far past any real kit — the shortest E in the corpus
 *  is a handful of seconds. */
const MAX_CYCLES = 200;

/** How much of its full strength a HYPOTHETICAL cycle keeps. Cycle 0 happened;
 *  1..n are the cadence continued, so they read as the same bar, quieter.
 *  🎛️ Tuning knob — the floor is legibility: below ~30 the rhythm stops
 *  reading as rhythm and starts reading as one bar with smudges after it. */
export const COMPARE_REPEAT_MIX = 40;

/** How much a lane keeps when its constellation gate is above the view's cap.
 *  ⚠ Spent in the PAINT, never as element `opacity` — see the sub-pixel laws. */
export const COMPARE_LOCKED_MIX = 45;

/**
 * Repeat one cycle's segments across `axisSeconds`, tagging each with its
 * repetition index and clipping the final partial cycle at the axis end.
 *
 * The clip is a real clip, not a drop: an ability whose window is still open
 * when the axis runs out should be drawn running off the edge, because that is
 * what it does.
 */
export function repeatCycles(
	cycle: readonly BarPhaseSegment[],
	cycleSeconds: number,
	axisSeconds: number
): BarPhaseSegment[] {
	if (!(cycleSeconds > 0) || !(axisSeconds > 0) || cycle.length === 0) return [];

	const out: BarPhaseSegment[] = [];
	const count = Math.min(Math.ceil(axisSeconds / cycleSeconds), MAX_CYCLES);

	for (let c = 0; c < count; c++) {
		const offset = c * cycleSeconds;
		for (const seg of cycle) {
			const start = offset + seg.start;
			if (start >= axisSeconds) continue;
			const span = Math.min(start + seg.span, axisSeconds) - start;
			if (span <= 0) continue;
			out.push({ ...seg, start, span, cycle: c });
		}
	}
	return out;
}

/**
 * The Compare chart's lane geometry: one effect window on one host's cooldown,
 * tiled across the axis.
 *
 * ⚓ `uptime >= cooldown` is PERMANENT UPTIME and gets ONE unbroken segment, not
 * a tiling. The ability is back before its window lapses, so there is nothing to
 * repeat — and `barPhases`' case B (a window outlasting its cooldown) is a
 * ONE-CAST reading that would draw a spurious seam at every cooldown boundary.
 * Same math, different question: the planner asks "what did this cast do", and
 * Compare asks "what does this ability hold". Intercept before delegating.
 */
export function laneSegments(
	uptime: number,
	cooldown: number,
	axisSeconds: number
): BarPhaseSegment[] {
	if (!(uptime > 0) || !(cooldown > 0) || !(axisSeconds > 0)) return [];
	if (uptime >= cooldown) {
		return [{ role: 'uptime', start: 0, span: axisSeconds, cycle: 0 }];
	}
	return repeatCycles(
		barPhases({ start: 0, castTime: 0, cooldown, uptime }, false),
		cooldown,
		axisSeconds
	);
}
