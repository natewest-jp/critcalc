/**
 * The transport's pure core (playback round, 2026-09-29; plan
 * docs/playback-round-plan.md §5–§6). Rune-free so vitest exercises it.
 *
 * ⚓ ONE CLOCK, READ ABSOLUTELY. The Gauge Explorer's playhead advances by rAF
 * DELTAS and clamps a long absence, so a hidden tab suspends it in place — the
 * right behaviour for reading a chart. This transport does the opposite on
 * purpose: its job is to keep time with a GAME the player is looking at instead
 * of the tab, so position is `elapsed since the anchor`, taken from a wall clock
 * (the AudioContext's when sound is on, `performance.now()` otherwise). rAF
 * freezes in a hidden tab; the clock does not; when the tab comes back the
 * cursor is where the game is. ⛔ Don't "fix" the jump on return — it is the
 * feature.
 *
 * Domains:
 *   elapsed — seconds since play was pressed (the anchor), always ≥ 0
 *   t       — seconds on the rotation's axis; below `start` during the count-in
 *   t = start + elapsed − lead, then wrapped when looping. The count-in plays
 *   ONCE per press of Play.
 *
 * ⚓ EVERY START COUNTS IN (Nate 2026-09-30), a resume included: jumping back
 * into a rotation mid-flight with no warning is useless with the game in front
 * of you, so a start from a paused position `start` counts the beats and then
 * picks up there. The cue before `start` never sounds.
 */

import type { Cue, CueKind } from './cues';

export type Position = {
	/** Rotation-axis time in seconds. Negative while the count-in runs. */
	t: number;
	/** True when a non-looping run has reached the end. */
	ended: boolean;
};

/**
 * Where the cursor is, given how long play has run.
 * @param elapsed  seconds since the anchor (≥ 0)
 * @param lead     count-in seconds (0 when sound is off — a silent count-in is a
 *                 cursor parked at zero for three seconds, which reads as a hang)
 * @param duration the rotation's length in seconds (> 0)
 * @param loop     wrap at the end instead of stopping
 * @param start    the position play was pressed from (0, or where it paused)
 */
export function positionAt(
	elapsed: number,
	lead: number,
	duration: number,
	loop: boolean,
	start = 0
): Position {
	const raw = start + elapsed - lead;
	if (raw < duration) return { t: raw, ended: false };
	if (!loop) return { t: duration, ended: true };
	return { t: raw % duration, ended: false };
}

export type Due = { kind: CueKind; elapsed: number; dur: number };

/**
 * The cues that fall in the elapsed window [from, to), as absolute elapsed
 * instants — what the audio scheduler queues. Count-in cues play once at
 * `lead + cue.t`; rotation cues repeat every `duration` while looping, and a
 * start from `start` skips every cue before it on the first lap.
 *
 * ⚠️ Half-open on the RIGHT — [from, to) — so a scheduler walking contiguous
 * windows never queues a cue twice, and the very first window (from = 0) still
 * takes the count-in's first beat at elapsed 0.
 */
export function dueBetween(
	cues: readonly Cue[],
	countIn: readonly Cue[],
	lead: number,
	duration: number,
	loop: boolean,
	from: number,
	to: number,
	start = 0
): Due[] {
	const out: Due[] = [];
	if (to <= from) return out;
	for (const c of countIn) {
		const at = lead + c.t;
		if (at >= from && at < to) out.push({ kind: c.kind, elapsed: at, dur: c.dur });
	}
	if (duration > 0) {
		// Rotation time x sounds at elapsed `lead + x − start`.
		const shift = lead - start;
		const firstLap = Math.max(0, Math.floor((from - shift) / duration));
		const lastLap = loop ? Math.floor((to - shift) / duration) : 0;
		for (let lap = firstLap; lap <= lastLap; lap++) {
			for (const c of cues) {
				const x = lap * duration + c.t;
				if (x < start) continue;
				const at = shift + x;
				if (at >= from && at < to) out.push({ kind: c.kind, elapsed: at, dur: c.dur });
			}
		}
	}
	out.sort((a, b) => a.elapsed - b.elapsed);
	return out;
}
