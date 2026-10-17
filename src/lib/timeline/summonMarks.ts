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

/**
 * ⚓ A LUNAR HIT IS A MOONBEAM (⚓ Nate, 2026-10-17 — the /lab board's 3e).
 * Columbina's Gravity Interference strikes are moon-power lilac in game, not the
 * reaction's element, so a threshold fire draws as a falling GLEAM: 7px wide
 * (↻ 6 → 7, ⚓ Nate same day; placed on whole pixels, its core ½px right),
 * white at the core through a light lilac to nothing at its sides, brightest at
 * the bar's top edge and gone by its foot — where the ticks rise from, so the
 * two never share pixels. The lilac is the Moonsign lane's (`#b0a9ff`) 40% of the
 * way to white. ⛔ The hit's element is not drawn; it is kept on the data.
 */
export const LUNAR_GLEAM_W = 7;
export const LUNAR_GLEAM_STOPS: readonly [number, string][] = [
	[0, '#d0cbff00'],
	[0.35, '#d0cbffcc'],
	[0.5, '#ffffff'],
	[0.65, '#d0cbffcc'],
	[1, '#d0cbff00']
];

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
