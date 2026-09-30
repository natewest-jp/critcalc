/**
 * Playback cues — the rotation's INPUTS as a list of instants (playback round,
 * 2026-09-29; plan: docs/playback-round-plan.md §5).
 *
 * ⚓ A cue marks a PRESS, never a hit. The sound exists so a player can follow
 * the rotation with their eyes on the game, and what they do at each instant is
 * press something — so every cue sits on the frame the sim says the input
 * happens (`CastEvent.time`, `ActionEvent.time`), which is AFTER any human-timing
 * pad. Hits, ticks, reactions and buffs make no sound: nobody presses them.
 *
 * Sources, all in `ParsedRotation.events` except the swap:
 *   - a cast (E/Q) → `skill` / `burst`
 *   - an action → `normal` / `charged` / `plunge`; dash + jump fold to `movement`
 *     (a cancel is a cancel; which key is not worth a second sound). ⛔ `unset` is
 *     a `~?s` wait — nothing is pressed.
 *   - a track boundary → `swap`, at the PREVIOUS track's end: that is when the
 *     player presses the swap key; the next track starts `swapF` later.
 *     ⚠️ Two consecutive segments of ONE character are not a swap and get none —
 *     the sim still charges `swapF` between them (run.ts, a pre-existing quirk
 *     the Repeat round fixes), but no key is pressed.
 *
 * Pure and rune-free so vitest reads it directly. Times are SECONDS — the
 * transport and the audio clock both run in seconds, and the chart converts to
 * px in one place anyway (plannerView's two hover channels set the precedent).
 */

import type { ParsedRotation } from '$lib/sim/types';
import { FPS } from '$lib/utils/frames';

export type CueKind =
	| 'count' // a count-in beat before the first press
	| 'countLast' // the count-in's final beat — the press comes on the next one
	| 'normal'
	| 'charged'
	| 'plunge'
	| 'skill'
	| 'burst'
	| 'movement'
	| 'swap';

export type Cue = {
	/** Seconds from the rotation's start. Count-in beats are NEGATIVE. */
	t: number;
	kind: CueKind;
	/**
	 * How long the input holds the field, in seconds — the block's drawn width:
	 * a cast's cancel-adjusted animation, a swing's duration, a swap's delay up
	 * to the next character's arrival. The melodic set rings for this long (⚓
	 * Nate 2026-09-29: "we have all the frame data"), and a swap's second note
	 * lands at its end. 0 where the data has no length (the count-in).
	 */
	dur: number;
};

/**
 * The count-in: beats before the first press, one per second, so the first
 * input lands on the downbeat rather than by surprise. ⏭ Nate tunes both by ear
 * (plan §9): the beat count and the beat spacing are the two knobs a metronome
 * has, and neither has a derivation.
 *
 * ⚓ FOUR, and not a setting (Nate 2026-09-30: "my mind wanted there to be
 * four") — a bar of four is the count the ear already expects. ⚓ The LAST beat
 * sounds different (`countLast`), so the player does not have to count to
 * know that the next beat is the press.
 */
export const COUNT_IN_BEATS = 4;
export const COUNT_IN_BEAT_S = 1;
/** Seconds of lead the count-in takes before t = 0. */
export const COUNT_IN_S = COUNT_IN_BEATS * COUNT_IN_BEAT_S;

/** The count-in beats, as cues at negative t (−4 … −1 by default), the last
 *  one `countLast`. */
export function countInCues(): Cue[] {
	const out: Cue[] = [];
	for (let i = COUNT_IN_BEATS; i >= 1; i--)
		out.push({ t: -i * COUNT_IN_BEAT_S, kind: i === 1 ? 'countLast' : 'count', dur: 0 });
	return out;
}

/** Every press in the rotation, sorted by time. Same-frame cues are kept — two
 *  sounds on one frame is the honest rendering of two things pressed at once
 *  (a cast whose swap lands on the same frame as the next press does happen). */
export function cuesFor(rotation: ParsedRotation): Cue[] {
	const out: Cue[] = [];
	for (const ev of rotation.events) {
		if (ev.kind === 'cast') {
			out.push({ t: ev.time / FPS, kind: ev.ability, dur: ev.castTime / FPS });
		} else if (ev.kind === 'action') {
			if (ev.action === 'unset') continue;
			out.push({
				t: ev.time / FPS,
				kind: ev.action === 'dash' || ev.action === 'jump' ? 'movement' : ev.action,
				dur: ev.duration / FPS
			});
		}
	}
	const tracks = rotation.tracks;
	for (let i = 1; i < tracks.length; i++) {
		if (tracks[i].characterId === tracks[i - 1].characterId) continue;
		out.push({
			t: tracks[i - 1].activeEnd / FPS,
			kind: 'swap',
			dur: (tracks[i].activeStart - tracks[i - 1].activeEnd) / FPS
		});
	}
	out.sort((a, b) => a.t - b.t);
	return out;
}
