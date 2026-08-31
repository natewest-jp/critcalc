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
 * ⚠️ WITHIN THE CORE ROW, SPANS OVERLAP AND THAT IS THE POINT. Up to five cores
 * live at once and "how many are up" is the question a bloom player is asking,
 * so overlapping translucent spans read as the count with no extra height. ⛔ Do
 * not pack them into sub-rows — that trades the count for geometry and moves the
 * bench while doing it.
 */

import type { TimelineWindow } from '$lib/utils/notationParser';

export type GadgetBar = {
	start: number;
	end: number;
	/** Set when the world took it back before its nominal end — a core eaten by
	 *  a Hyperbloom. Read by the tooltip; ⛔ never re-derive an end from it. */
	endReason?: 'consumed' | 'popped';
};

export type GadgetRow = {
	kind: 'prism' | 'core';
	label: string;
	color: string;
	bars: GadgetBar[];
};

/** ⚠️ ORDER IS FIXED, not emission-derived: a strip whose rows swap places
 *  between two rotations is unreadable. The Prism sits nearest the plot because
 *  it is the one whose buffs the reader is about to look for in the lane below. */
const ROW_ORDER = [
	{ kind: 'prism' as const, label: 'Starlight Prism', color: 'var(--rx-starlight-prism)' },
	{ kind: 'core' as const, label: 'Dendro Core', color: 'var(--rx-dendro-core)' }
];

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
		out.push({ ...row, bars: bars.sort((a, b) => a.start - b.start || a.end - b.end) });
	}
	return out;
}
