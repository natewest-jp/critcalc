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
 * ↻⚓⚓ EVENTS AS MARKS, STATE AS AN AREA — the strip is a MINIATURE OF THE PLOT
 * ABOVE IT (2026-09-01, the fourth and final cut). A solid dot for every spawn,
 * a stepped area for how many are live. ⚓ That is the aura lane's own grammar
 * one row up — points for what happened, a continuum for what is true — so the
 * whole header reads with one vocabulary top to bottom.
 *
 * ⚓⚓ THE INSIGHT THAT ENDED THREE CUTS OF THRASHING: **A DENDRO CORE'S DURATION
 * IS A CONSTANT.** Every core lives exactly `CORE_LIFETIME` (6s) unless something
 * eats it. So eleven individual 6s leaders were spending all of the row's ink on
 * the one quantity that never varies — the only facts a life carries are WHEN IT
 * SPAWNED and WHETHER IT ENDED EARLY. ⛔ Do not reintroduce a per-life duration
 * mark: it encodes nothing, and it is what made every previous cut read as
 * clutter (⚓ Nate, on the third: "is it four or five bloom cores...").
 *
 * The three superseded cuts and what each got wrong, so none is re-proposed:
 *   1. translucent stacked spans — five at 52% alpha composite to 97% opaque, so
 *      "darker means more" saturates by the third core;
 *   2. a bare count profile — says how many, structurally cannot say WHICH;
 *   3. per-life dot + lane + terminator — says which, at the cost of 33 marks in
 *      a 16px row, and the count became unreadable.
 * ⚓ The area answers 2's question and the dots answer 3's, and together they
 * cost one path plus one dot per bloom.
 *
 * ⚠️⚠️ THE OVERLAP MEASUREMENT IS WHY STATE NEEDS AN AREA AT ALL. Over 122 corpus
 * rotations with a bloom-capable pair, peak concurrency was 2 in 79, 3 in 9 and
 * 4–5 in 7 — **66% of the time any core is live, at least two are**. ⚠️⚠️ That is
 * the OPPOSITE of the aura lane's finding from the same instrument (L6 collapsed
 * the aura ROWS because ⚓ Nate measured that auras barely coexist) — ⛔ neither
 * result may be assumed for the other, count the case.
 *
 * ⚠️ THE CEILING IS A PROPERTY OF THE KIND, NEVER OF THE ROTATION. Cores draw
 * against a fixed 5 (`MAX_CORES`, a game fact); a Prism can never exceed one, so
 * its area is the plain presence bar it always was. ⛔ Never scale to a
 * rotation's own peak — two charts of the same team would then disagree about
 * what half-height means.
 */

import type { TimelineWindow } from '$lib/utils/notationParser';

export type GadgetBar = {
	start: number;
	end: number;
	/** Set when the world took it back before its nominal end — a core eaten by
	 *  a Hyperbloom. Read by the tooltip and by the end mark's colour; ⛔ never
	 *  re-derive an end from it. */
	endReason?: 'consumed' | 'popped';
};

/** ⚓ ONE DISC PER INSTANT, not per life. A Lunar-Crystallize tops the field up
 *  to three AT ONCE, so drawing a life apiece put three identical discs at one x
 *  — redundant ink for a count the area already carries. `bars` is what spawned
 *  here, so the tooltip can still say how many. */
export type GadgetSpawn = {
	time: number;
	bars: GadgetBar[];
};

export type GadgetRow = {
	kind: 'prism' | 'core' | 'thundercloud' | 'moondrift';
	label: string;
	color: string;
	/** How many of this kind can be live at once — the area's y ceiling.
	 *  ⚠️ Of the KIND, not of this rotation (see the header). */
	capacity: number;
	/** Every life — the substrate for both projections below. */
	bars: GadgetBar[];
	/** The marks: one per distinct spawn instant. */
	spawns: GadgetSpawn[];
	/** The area: runs of constant live count. */
	runs: GadgetRun[];
};

/** ⚠️ ORDER IS FIXED, not emission-derived: a strip whose rows swap places
 *  between two rotations is unreadable. The Prism sits nearest the plot because
 *  it is the one whose buffs the reader is about to look for in the lane below. */
const ROW_ORDER = [
	// ⚓ AN ENTITY THAT HAS AN ELEMENT WEARS IT (⚓ Nate 2026-09-01). A Starlight
	// Prism is Cryo in game and a Moondrift is Geo; a minted --rx-* hue for
	// either was a primitive standing in for one we already have, and the strip
	// reads better against the aura plot when a gadget answers to the same
	// palette its reaction does. ⛔ Only the two that are NOT an element keep
	// their own: a dendro core and a thundercloud are their own objects.
	{
		kind: 'prism' as const,
		label: 'Starlight Prism',
		color: 'var(--el-cryo-main)',
		capacity: 1
	},
	{
		kind: 'thundercloud' as const,
		label: 'Thundercloud',
		color: 'var(--rx-thundercloud)',
		// ⚠️ ONE cloud, ever — gcsim keeps it as a STATUS, not a count, so a second
		// Lunar-Charged restarts its clock rather than adding a second cloud.
		capacity: 1
	},
	// ⚠️⚠️ CAPACITY 1, THOUGH THERE ARE ALWAYS THREE (⚓ Nate). A Lunar-Crystallize
	// tops the field up to three and Moondrift Harmony refreshes all three at
	// once, so they appear and lapse TOGETHER — measured, a partial field is
	// unreachable. A three-deep axis therefore drew one number forever, spending
	// 8px of strip on a count that never varies. The three lives stay in `bars`,
	// so the disc's tooltip still says "3 at once".
	{ kind: 'moondrift' as const, label: 'Moondrift', color: 'var(--el-geo-main)', capacity: 1 },
	// ⚓ 5 is `MAX_CORES` in gauge.ts (KQM: a sixth Bloom pops the oldest). ⚠️ Not
	// imported — this module is a pure projection with no runtime imports, and
	// the number is a stated game fact rather than an implementation detail. If
	// the gauge's cap ever moves, this is the second place.
	{ kind: 'core' as const, label: 'Dendro Core', color: 'var(--rx-dendro-core)', capacity: 5 }
];

/** One run of CONSTANT live count — the area's unit, and what the cursor reads.
 *  A run ends wherever a gadget spawns or leaves. */
export type GadgetRun = {
	start: number;
	end: number;
	count: number;
};

/**
 * Bars → runs of constant live count.
 *
 * ⚠️ A SWEEP OVER BOUNDARIES, not a sample per frame: the strip draws at whatever
 * zoom the reader chose, and a fixed-interval sample would alias a one-frame gap
 * between two cores into either a phantom or a miss.
 */
function runsOf(bars: GadgetBar[]): GadgetRun[] {
	if (bars.length === 0) return [];
	const edges = [...new Set(bars.flatMap((b) => [b.start, b.end]))].sort((a, b) => a - b);
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
		const spawns: GadgetSpawn[] = [];
		for (const bar of sorted) {
			const open = spawns[spawns.length - 1];
			if (open && open.time === bar.start) open.bars.push(bar);
			else spawns.push({ time: bar.start, bars: [bar] });
		}
		out.push({ ...row, bars: sorted, spawns, runs: runsOf(sorted) });
	}
	return out;
}
