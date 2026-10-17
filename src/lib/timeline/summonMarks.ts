/**
 * src/lib/timeline/summonMarks.ts
 *
 * ⚓ AN ABSORBING SUMMON BECOMES ITS ELEMENT (⚓ Nate, 2026-10-17 — the /lab
 * board's candidate D, Varka's rule). From its first absorbed hit the bar
 * FADES into the absorbed element over `ABSORB_FADE_PX` and stays that element
 * to its end; the absorbed hits keep no mark of their own. Their ticks merge
 * into the summon's: ONE stub per FRAME, so a twin (Kazuha, Sucrose) collapses
 * into the Anemo tick it shares a frame with and a stream on its own cadence
 * (Venti, every 24f) keeps its stubs. A stub past the fade's start takes the
 * element's `hi`, since the bar beneath it is the element now.
 *
 * ↻ Retires the 2026-10-17 morning's "one stub per frame AND element" — the
 * aura lane is where an absorbed hit's element is read.
 *
 * Pure, shared by the live timeline and the PNG export so they cannot drift.
 */

import type { Element } from '$lib/types/ability';

/** Screen pixels the bar takes to fade into the absorbed element — the same
 *  length at every zoom, like a border. */
export const ABSORB_FADE_PX = 24;

type MarkedBar = {
	ticks: number[];
	absorbedTicks?: { time: number; element: string }[];
};

export type SummonMarks = {
	/** Where the bar starts turning, and into what — absent when nothing was absorbed. */
	absorbed?: { time: number; element: Element };
	/** Every stub, one per frame, ascending; `absorbed` past the fade's start. */
	ticks: { time: number; absorbed: boolean }[];
};

export function summonMarks(bar: MarkedBar): SummonMarks {
	const first = bar.absorbedTicks?.[0];
	const at = first?.time ?? Infinity;
	const frames = [...new Set([...bar.ticks, ...(bar.absorbedTicks ?? []).map((a) => a.time)])].sort(
		(a, b) => a - b
	);
	return {
		...(first ? { absorbed: { time: first.time, element: first.element as Element } } : {}),
		ticks: frames.map((time) => ({ time, absorbed: time >= at }))
	};
}
