// The ICD timeline's numbers that aren't drawing: how long an even string's
// axis runs, and the headline's share (`docs/rounds/viz-stage-icd-2026-11-04.md`).

import { simulateIcd, uniformHitTimes, type IcdParams } from '$lib/utils/icd';

/** 🎛️ An even string's axis shows this many timer windows… */
const EVEN_WINDOWS = 3;
/** …but never less than this, in seconds (No ICD, and short custom timers)… */
const EVEN_SPAN_MIN = 6;
/** …nor more (a 10s custom timer), so a 0.1s string stays a few hundred hits. */
const EVEN_SPAN_MAX = 20;

/**
 * ⚓ AN EVEN STRING'S AXIS IS SET BY THE RULE, NOT BY THE STRING. The hit
 * interval is a handle on the time axis, its thumb on hit 2; an axis that
 * followed the string's length would rescale under the thumb. So the axis
 * holds still while you drag, and the string fills it: as many hits as land
 * before its end.
 */
export function evenSpan(params: IcdParams): number {
	return Math.min(EVEN_SPAN_MAX, Math.max(EVEN_SPAN_MIN, EVEN_WINDOWS * params.timer));
}

/** The even string that fills the axis: hits from 0, every `interval`, before `span`. */
export function evenHits(interval: number, span: number): number[] {
	return uniformHitTimes(Math.floor(span / interval - 1e-9) + 1, interval);
}

/**
 * THE HEADLINE: what share of an even string's hits apply their element.
 *
 * Every timer window of an even string holds the same hits at the same
 * offsets (each opens on a hit, and the counter restarts with it), so the
 * first window's pattern repeats for good: "2 of every 5" at 0.5s under
 * Standard ICD (T··C·). `of` is the window's hits, unreduced, because it IS
 * the window: 2 of every 4 at 0.7s is T··C, which "1 of every 2" would
 * misdescribe. With no timer every hit applies.
 */
export function evenShare(interval: number, params: IcdParams): { applies: number; of: number } {
	if (params.timer === 0) return { applies: 1, of: 1 };
	// Enough hits to reach the second window's opening hit.
	const sim = simulateIcd(
		uniformHitTimes(Math.ceil(params.timer / interval) + 2, interval),
		params
	);
	const next = sim.findIndex((h, i) => i > 0 && h.viaTimer);
	const window = next > 0 ? sim.slice(0, next) : sim;
	return { applies: window.filter((h) => h.applies).length, of: window.length };
}

/**
 * THE COMPANION: how often an even string's element lands, as the seconds
 * between applications. The everyday question beside the headline's share,
 * and not its mirror: attacking slower can land the element MORE often
 * (under Standard ICD, every 4s at 2s apart but every 2.5s at 2.5s apart,
 * where each hit meets the timer as it runs out). Applications fall evenly
 * across a window only on average, so this is the window's length over its
 * applications.
 */
export function landsEvery(interval: number, params: IcdParams): number {
	const { applies, of } = evenShare(interval, params);
	return (of * interval) / applies;
}
