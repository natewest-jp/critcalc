// Pure time→pixel projection for timeline bars and rulers.
//
// Lifted verbatim from RotationTimeline.svelte so a second renderer (the Team
// Builder's stacked-bar Compare) can position bars on the SAME geometry the
// planner uses — the two can never drift. The planner keeps thin local wrappers
// that close over its reactive `scale`; every caller here passes `scale`
// explicitly. Framework-free and side-effect-free.

/** THE time→x mapping. Every horizontal position derives from this one helper,
 *  so DOM bars, ruler ticks, and any overlay layer can never disagree. */
export function xForTime(t: number, scale: number): number {
	return Math.round(t * scale);
}

/** Bar left/width in px. Width is the DIFFERENCE of rounded endpoints (not a
 *  rounded span) so adjacent segments telescope pixel-perfectly at every zoom —
 *  a rounded span drifts ±1px against its neighbours whenever `scale` isn't a
 *  clean multiple of the frame grid. Width floors at 2px so zero-span markers
 *  stay visible. */
export function barGeom(
	start: number,
	span: number,
	scale: number
): { left: number; width: number } {
	const left = xForTime(start, scale);
	return {
		left,
		width: Math.max(xForTime(start + span, scale) - left, 2)
	};
}

/** Evenly-spaced ruler ticks across `dur` seconds at pixel scale `sc`. Step
 *  widens as you zoom out (1s / 2s / 5s); every 5th second is a major tick. */
export function rulerTicks(
	dur: number,
	sc: number
): Array<{ t: number; x: number; major: boolean }> {
	if (!isFinite(dur) || dur <= 0) return [];
	const step = sc >= 50 ? 1 : sc >= 25 ? 2 : 5;
	const ticks: Array<{ t: number; x: number; major: boolean }> = [];
	for (let t = 0; t <= dur; t += step) {
		ticks.push({ t, x: Math.round(t * sc), major: t % 5 === 0 });
	}
	return ticks;
}
