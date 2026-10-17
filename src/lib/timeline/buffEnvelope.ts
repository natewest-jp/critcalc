/**
 * src/lib/timeline/buffEnvelope.ts
 *
 * The time-scaling buff ENVELOPE (Yelan Q, Mavuika Q — a buff whose value
 * ramps or decays over its own window): the bar's glass density at each end of
 * a segment, as a fraction of `--glass-bar`'s own. Lifted from
 * RotationTimeline (2026-10-17) so the PNG export draws the same envelope —
 * it painted these bars flat until then (⚓ Nate: "everything about the
 * current live timeline should be copied by the PNG export, visually").
 *
 * Pure, shared by both renderers so they cannot drift.
 */

import { FPS } from '$lib/utils/frames';
import type { CharReceivedBuffBar } from './types';

/** The thinnest a scaling buff's material gets, as a fraction of --glass-bar's
 *  own density. 🎛️ ⚠ IT IS NOT THE OLD 0.2. When the envelope mixed an
 *  OPAQUE fill toward the chart ground, 0.2 still produced a solid colour
 *  near that ground — thin meant "close to the background", and the bar was
 *  always there. Scaling a translucent material by 0.2 gives alpha .116,
 *  which is SHEER, and sheer is retired ("opaque or obviously translucent —
 *  the middle is not a place"). 0.5 keeps the thin end at alpha .29: still
 *  unmistakably a bar, still obviously less than full. */
export const ENVELOPE_MIN = 0.5;

/** [start, end] densities of a RAMPING bar segment, or undefined. */
export function rampDensities(bar: CharReceivedBuffBar): [number, number] | undefined {
	const ramp = bar.rampParams;
	if (!ramp || bar.buffStart == null) return undefined;
	const rampDur =
		ramp.cap != null
			? ((ramp.cap - ramp.startValue) / ramp.stepValue) * ramp.stepInterval
			: 10 * FPS;
	const p0 = Math.min(1, Math.max(0, (bar.start - bar.buffStart) / rampDur));
	const p1 = Math.min(1, Math.max(0, (bar.end - bar.buffStart) / rampDur));
	return [ENVELOPE_MIN + p0 * (1 - ENVELOPE_MIN), ENVELOPE_MIN + p1 * (1 - ENVELOPE_MIN)];
}

/** [start, end] densities of a DECAYING bar segment (the ramp in reverse;
 *  the decay runs the host effect's buff duration), or undefined. */
export function decayDensities(bar: CharReceivedBuffBar): [number, number] | undefined {
	const decay = bar.decayParams;
	if (!decay || bar.buffStart == null || decay.duration <= 0) return undefined;
	const p0 = Math.min(1, Math.max(0, (bar.start - bar.buffStart) / decay.duration));
	const p1 = Math.min(1, Math.max(0, (bar.end - bar.buffStart) / decay.duration));
	return [1 - p0 * (1 - ENVELOPE_MIN), 1 - p1 * (1 - ENVELOPE_MIN)];
}

/** Either envelope — a bar carries at most one. */
export function envelopeDensities(bar: CharReceivedBuffBar): [number, number] | undefined {
	return rampDensities(bar) ?? decayDensities(bar);
}
