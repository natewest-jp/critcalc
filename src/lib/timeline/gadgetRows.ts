/**
 * src/lib/timeline/gadgetRows.ts
 *
 * ⚓⚓ THE GADGET STRIP — things a reaction left in the world (Polestar-Field
 * round, 2026-09-01). A pure projection of the `gadget` TimelineWindows the
 * parse publishes; it decides nothing.
 *
 * ⚓ WHY IT IS NOT A TRACK LANE. Every other span the planner draws belongs to
 * somebody — a summon to its caster, a shield to the character wearing it — and
 * `computeSummonSubrows` groups them under that character's tracks. A dendro
 * core belongs to whoever blooms next; a Starlight Prism is raised by ANY party
 * member's Stellar-Conduct. Put either under a character and the chart makes a
 * claim the game does not: that a second enabler raises a second field. So the
 * strip lives in the aura lane's own header, which is already the one
 * team-scoped piece of chart furniture the planner has.
 *
 * ⚓ IT EXTENDS THE MARKER GRAMMAR'S SENTENCE rather than starting a new one.
 * The aura lane reads top to bottom: what it CAUSED (the reaction label), what
 * LANDED (the application pill), a HAIRLINE into the gauge it changed. Under the
 * plot's baseline, this is what it LEFT BEHIND — in the world, but not in the
 * aura, which is exactly why it sits below the 0U datum rather than inside the
 * plot.
 *
 * ⚠️ ONE ROW PER KIND, and rows appear only when that kind occurs. Two rows is
 * today's ceiling (cores and Prisms) and most rotations have none, which is what
 * makes the strip affordable: ⚓ anything above the first track row moves the
 * BENCH (`headerH` is published through `benchBand.trackTop`), and a lane that
 * cost every rotation 20px to serve bloom and Stellar teams would not be worth
 * it. ⛔ Don't give a kind a permanent row.
 *
 * ↻⚓⚓ A ROW IS A COUNT PROFILE, NOT A PILE OF SPANS (2026-09-01, ⚓ Nate) — and
 * the reversal came from MEASURING the overlap the first cut assumed it could
 * paint through. Over 122 corpus rotations with a bloom-capable pair, peak
 * concurrency was 2 in 79 of them, 3 in 9, and 4–5 in 7 — and **66% of the time
 * any core is live, at least two are**. Purpose-built bloom teams measure
 * 59–75%. So overlap is not the exception here, it is the resting state, and
 * translucent spans were making the one claim they cannot keep: at 52% alpha
 * five stacked spans composite to 97% opaque, so "darker means more" saturates
 * by the third core.
 *
 * ⚠️⚠️ THIS IS THE OPPOSITE FINDING TO THE AURA LANE'S, and both came from the
 * same instrument. L6 collapsed the aura ROWS into one plot because ⚓ Nate
 * measured that auras barely coexist; the strip goes the other way because
 * gadgets almost always do. ⛔ Neither result may be assumed for the other —
 * count the case.
 *
 * ⚓ IDENTITY IS NEARLY WORTHLESS HERE, which is what makes the profile a
 * straight win rather than a trade. Cores are consumed OLDEST-FIRST, so "which
 * core did my Hyperbloom eat" is a question nobody asks; the real ones are *is
 * one up*, *how many*, and *when does the next one drop* — and a step down
 * answers the third exactly where five overlapping spans answered none of them.
 * The individual spans survive in `bars` for the tooltip.
 *
 * ⚠️ THE CAPACITY IS A PROPERTY OF THE KIND, NEVER OF THE ROTATION. A Prism can
 * never exceed one (presences are merged before they are emitted) so it draws at
 * capacity 1 — a full-height fill, i.e. the plain bar it always was, and the
 * degenerate case of the same grammar. Cores draw against a FIXED ceiling of 5,
 * so the y axis means the same thing in every rotation. ⛔ Never scale the axis
 * to the rotation's own peak: two charts of the same team would then disagree
 * about what half-height means.
 */

import type { TimelineWindow } from '$lib/utils/notationParser';

export type GadgetBar = {
	start: number;
	end: number;
	/** Set when the world took it back before its nominal end — a core eaten by
	 *  a Hyperbloom. Read by the tooltip; ⛔ never re-derive an end from it. */
	endReason?: 'consumed' | 'popped';
};

/** One run of CONSTANT live count — the profile's unit, and the thing the
 *  cursor isolates. A run ends where a gadget spawns or leaves. */
export type GadgetRun = {
	start: number;
	end: number;
	/** How many of this gadget are live across the run. */
	count: number;
};

export type GadgetRow = {
	kind: 'prism' | 'core';
	label: string;
	color: string;
	/** The y ceiling — how many of this kind can be live at once. ⚠️ Of the KIND,
	 *  not of this rotation (see the header). */
	capacity: number;
	/** The individual lives, kept for the tooltip. ⛔ Not the drawing. */
	bars: GadgetBar[];
	/** The drawing: runs of constant count, contiguous, count 0 included so a
	 *  renderer can walk one list and never guess at a gap. */
	runs: GadgetRun[];
};

/** ⚠️ ORDER IS FIXED, not emission-derived: a strip whose rows swap places
 *  between two rotations is unreadable. The Prism sits nearest the plot because
 *  it is the one whose buffs the reader is about to look for in the lane below. */
const ROW_ORDER = [
	{
		kind: 'prism' as const,
		label: 'Starlight Prism',
		color: 'var(--rx-starlight-prism)',
		capacity: 1
	},
	// ⚓ 5 is `MAX_CORES` in gauge.ts (KQM: a sixth Bloom pops the oldest). ⚠️ Not
	// imported — this module is a pure projection with no runtime imports, and
	// the number is a stated game fact rather than an implementation detail. If
	// the gauge's cap ever moves, this is the second place.
	{ kind: 'core' as const, label: 'Dendro Core', color: 'var(--rx-dendro-core)', capacity: 5 }
];

/**
 * Bars → runs of constant live count.
 *
 * ⚠️ A SWEEP OVER BOUNDARIES, not a sample per frame: the strip is drawn at
 * whatever zoom the reader chose, and a fixed-interval sample would alias a
 * one-frame gap between two cores into either a phantom or a miss. Ends are
 * processed before starts at the same instant, so a core that expires exactly
 * where the next spawns reads as a handover and not as a moment of two.
 */
function runsOf(bars: GadgetBar[]): GadgetRun[] {
	if (bars.length === 0) return [];
	const points = new Set<number>();
	for (const b of bars) {
		points.add(b.start);
		points.add(b.end);
	}
	const edges = [...points].sort((a, b) => a - b);
	const runs: GadgetRun[] = [];
	for (let i = 0; i < edges.length - 1; i++) {
		const start = edges[i];
		const end = edges[i + 1];
		const count = bars.filter((b) => b.start <= start && b.end > start).length;
		const open = runs[runs.length - 1];
		if (open && open.count === count && open.end === start) open.end = end;
		else runs.push({ start, end, count });
	}
	return runs;
}

export function computeGadgetRows(windows: ReadonlyArray<TimelineWindow>): GadgetRow[] {
	const byKind = new Map<string, GadgetBar[]>();
	for (const w of windows) {
		if (w.kind !== 'gadget') continue;
		const bars = byKind.get(w.gadget) ?? [];
		bars.push({
			start: w.start,
			end: w.end,
			...(w.endReason !== undefined ? { endReason: w.endReason } : {})
		});
		byKind.set(w.gadget, bars);
	}
	const out: GadgetRow[] = [];
	for (const row of ROW_ORDER) {
		const bars = byKind.get(row.kind);
		if (!bars || bars.length === 0) continue;
		const sorted = bars.sort((a, b) => a.start - b.start || a.end - b.end);
		out.push({ ...row, bars: sorted, runs: runsOf(sorted) });
	}
	return out;
}
