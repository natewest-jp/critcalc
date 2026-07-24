/**
 * Pure core of the timeline playhead (see playhead.svelte.ts for the rAF
 * wrapper). Kept rune-free so vitest exercises it directly.
 */

/** Playback speeds relative to real time. Real-time default; the slowed
 * speeds stay a chip away for reading dense sequences (Nate 2026-07-24). */
export const PLAYHEAD_SPEEDS = [0.25, 0.5, 1] as const;
export const DEFAULT_PLAYHEAD_SPEED = 1;

/**
 * Advance the playhead by one frame delta. The delta is clamped so a
 * hidden-tab return (rAF suspends in background tabs, so the next frame's
 * delta spans the whole absence) resumes where it left off instead of
 * jumping.
 */
export function advance(
	t: number,
	dtMs: number,
	speed: number,
	duration: number
): { t: number; ended: boolean } {
	const next = t + (Math.min(Math.max(dtMs, 0), 100) / 1000) * speed;
	return next >= duration ? { t: duration, ended: true } : { t: next, ended: false };
}
