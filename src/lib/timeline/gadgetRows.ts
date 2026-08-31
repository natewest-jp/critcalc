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
 * ↻⚓ A LIFE IS A DOT, A THIN LINE AND AN END MARK (2026-09-01, ⚓ Nate) — the
 * Gauge Explorer's core marker, given a duration. It replaced a count profile
 * that was elegant on paper and did not read: a staircase tells you HOW MANY are
 * up and refuses to tell you WHICH, and a bloom player looking at the strip is
 * looking for a particular core's life.
 *
 * ⚠️⚠️ THE OVERLAP IS STILL THE THING TO DESIGN AGAINST, and the measurement that
 * killed the first cut (translucent stacked bars) still stands. Over 122 corpus
 * rotations with a bloom-capable pair, peak concurrency was 2 in 79, 3 in 9 and
 * 4–5 in 7 — and **66% of the time any core is live, at least two are**. That is
 * why a life gets a SLOT (see `assignSlots`) rather than sharing one baseline:
 * per-entity marks only stay legible if two entities cannot draw through each
 * other.
 *
 * ⚠️⚠️ THE OPPOSITE FINDING TO THE AURA LANE'S, from the same instrument. L6
 * collapsed the aura ROWS into one plot because ⚓ Nate measured that auras
 * barely coexist; the strip needs the opposite because gadgets almost always do.
 * ⛔ Neither result may be assumed for the other — count the case.
 *
 * ⚠️ THE BAND'S HEIGHT IS A PROPERTY OF THE KIND, NEVER OF THE ROTATION. A Prism
 * can never exceed one (presences are merged before they are emitted) so its row
 * is one line; cores get a band of five, which is `MAX_CORES` and a game fact.
 * ⛔ Never size the band to a rotation's own peak — two charts of the same team
 * would then have different heights and could not be compared.
 */

import type { TimelineWindow } from '$lib/utils/notationParser';

export type GadgetBar = {
	start: number;
	end: number;
	/** Set when the world took it back before its nominal end — a core eaten by
	 *  a Hyperbloom. Read by the tooltip and by the end mark's colour; ⛔ never
	 *  re-derive an end from it. */
	endReason?: 'consumed' | 'popped';
	/** Which line of the band this life draws on, 0 at the bottom. Assigned by
	 *  {@link assignSlots}; absent only before that runs. */
	slot?: number;
};

export type GadgetRow = {
	kind: 'prism' | 'core';
	label: string;
	color: string;
	/** How many of this kind can be live at once — the band's slot count.
	 *  ⚠️ Of the KIND, not of this rotation (see the header). */
	capacity: number;
	bars: GadgetBar[];
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
 * ⚓⚓ EVERY GADGET GETS ITS OWN SLOT IN A FIXED BAND — greedy interval colouring:
 * each life takes the lowest slot whose previous occupant has already left.
 *
 * ⚠️⚠️ THIS IS WHAT MAKES A PER-ENTITY DRAWING SURVIVE THE OVERLAP. Measured, 66%
 * of the time any core is live at least two are, so a single baseline would run
 * two lives' leader lines through each other and the reader would be counting
 * dots to recover what the chart should be showing. With slots, two concurrent
 * cores are two lines at two heights and nothing has to be inferred.
 *
 * ⚓ IT IS NOT THE SUB-ROW PATTERN THAT WAS REJECTED. That one sized the lane to
 * whatever the rotation happened to peak at, so two charts of the same team could
 * disagree about their own height. The band here is `capacity` slots ALWAYS —
 * a game fact (`MAX_CORES`), not a measurement — so an empty slot is just empty
 * and the row is the same height in every rotation.
 *
 * ⚠️ Slots fill from the BOTTOM, so a busier moment is a taller stack: the one
 * thing the count profile did well, kept.
 */
function assignSlots(bars: GadgetBar[], capacity: number): GadgetBar[] {
	const freeFrom: number[] = [];
	return bars.map((bar) => {
		let slot = freeFrom.findIndex((end) => end <= bar.start);
		if (slot === -1) {
			slot = freeFrom.length;
			freeFrom.push(bar.end);
		} else {
			freeFrom[slot] = bar.end;
		}
		// ⚠️ A gadget past the band's capacity is CLAMPED into the top slot rather
		// than dropped. It cannot happen today — the gauge caps live cores at the
		// same number this band is built from — but a silently missing life is the
		// worse failure of the two, and a doubled-up top line is visibly odd.
		return { ...bar, slot: Math.min(slot, capacity - 1) };
	});
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
		out.push({ ...row, bars: assignSlots(sorted, row.capacity) });
	}
	return out;
}
