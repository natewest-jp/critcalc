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
 * ⚠ A REPEAT IS A CLAIM. Cycle 0 is what you get. Everything after it assumes
 * you cast the instant the cooldown lapses — and for a burst it also assumes the
 * energy is there, which this site does not model. Every segment carries its
 * `cycle` index (the renderer's seam reads it), but repeats are drawn at FULL
 * strength: the fade that used to mark them is retired (see
 * `COMPARE_REPEAT_MIX` below), and the caveat lives in words beside the chart.
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

/** How much a lane keeps when its constellation gate is above the view's cap.
 *  ⚠ Spent in the PAINT, never as element `opacity` — see the sub-pixel laws. */
export const COMPARE_LOCKED_MIX = 45;

/* ⛔ `COMPARE_REPEAT_MIX` IS RETIRED (⚓ Nate 2026-08-13, at the surface).
   Repeated cycles used to render weaker, on the reasoning that a projected cast
   is a claim and the drawing should say so. It was worth trying and it did not
   read: a faded uptime block landed at almost exactly the value of the PREVIOUS
   cycle's cooldown ghost, and the width difference was not enough to separate
   them — so the fade did not mark a repeat, it blurred the boundary between
   uptime and cooldown, which is the one distinction this chart exists to draw.

   The caveat did not go anywhere; it moved to the only place that was carrying
   it unambiguously anyway — the footnote under the chart. A repeat is still a
   claim. It is just drawn at full strength, because a legible bar that needs a
   sentence beats an illegible one that tried to be self-documenting. */

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
 * ⚓ `uptime >= cooldown` is PERMANENT UPTIME, and it still TILES — as abutting
 * `uptimeFlush` blocks one cooldown long, which the renderer separates with a
 * hairline seam.
 *
 * ⚠ IT USED TO RETURN ONE UNBROKEN SEGMENT, AND THAT WAS A REAL LOSS OF
 * INFORMATION (⚓ Nate 2026-08-13): on a 30s axis, a 30s window and a 15s window
 * on a 15s cooldown drew the IDENTICAL solid bar — but in play they are not the
 * same thing at all, because the second one needs you to come back to that
 * character at 15s and cast again or it lapses. Permanent uptime is a *result*,
 * not a property; the seams are what it costs, and a chart that hides the cost
 * of holding a buff up is telling you the easy half of the story.
 *
 * The seam sits on the COOLDOWN boundary — the moment the cast comes back and
 * the rhythm resets. When `uptime > cooldown` there is slack (you may recast any
 * time between the cooldown and the window's end); the fact column carries both
 * numbers, and the seam marks the earliest honest moment rather than inventing a
 * deadline inside the slack.
 *
 * `barPhases` is bypassed on this branch on purpose: its case B is a ONE-CAST
 * reading (window, then overflow past the cooldown), and tiling that would make
 * each cycle's overflow collide with the next cycle's window. Same math,
 * different question — the planner asks "what did this cast do", Compare asks
 * "what does this ability hold".
 */
export function laneSegments(
	uptime: number,
	cooldown: number,
	axisSeconds: number
): BarPhaseSegment[] {
	if (!(uptime > 0) || !(cooldown > 0) || !(axisSeconds > 0)) return [];
	if (uptime >= cooldown) {
		// `uptimeFlush` = square corners, which is what abutting blocks need.
		return repeatCycles([{ role: 'uptimeFlush', start: 0, span: cooldown }], cooldown, axisSeconds);
	}
	return repeatCycles(
		barPhases({ start: 0, castTime: 0, cooldown, uptime }, false),
		cooldown,
		axisSeconds
	);
}

/**
 * A window a REACTION opens (Kazuha's Swirl bonus): ONE block of its length
 * at the start of the axis, clipped, and never tiled.
 *
 * ⚓ Nate 2026-10-07. It has no cooldown, so tiling would have to invent how
 * often the reaction happens — the one number this chart cannot know. The
 * block says how long the buff lasts; the lane's label says what opens it.
 */
export function singleWindowSegments(uptime: number, axisSeconds: number): BarPhaseSegment[] {
	if (!(uptime > 0) || !(axisSeconds > 0)) return [];
	return [{ role: 'uptime', start: 0, span: Math.min(uptime, axisSeconds), cycle: 0 }];
}
