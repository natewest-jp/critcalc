/**
 * The Rotation Planner's transport (playback round, 2026-09-29; plan
 * docs/playback-round-plan.md §5–§6). ONE instance for the site, like
 * `plannerView`: band B's plates drive it and the timeline draws its cursor, and
 * the two must agree on a single clock.
 *
 * ⚓ THE AUDIO CLOCK LEADS, THE CURSOR FOLLOWS. With sound on, position is read
 * from `AudioContext.currentTime` and every tone is queued AHEAD on that clock
 * (`LOOKAHEAD_S`). A hidden tab freezes requestAnimationFrame and throttles
 * timers to once a second, but queued Web Audio plays on schedule — so the
 * player can alt-tab into the game and the beats keep time; when they come back
 * the cursor is where the sound is. That is why this is NOT the Gauge Explorer's
 * `createPlayhead` (rAF deltas, clamped): the two want opposite things from a
 * hidden tab, and a flag on one would be a lie about the other.
 *
 * With sound off the clock is `performance.now()` — the same absolute reading,
 * no AudioContext touched (iOS refuses one outside a gesture, and a silent
 * context is a resource for nothing).
 *
 * State: `plannerView`-class view state, ⛔ never `?r=`, ⛔ never the PNG. The
 * sound PREFERENCE is per taste and lives in `siteSettings.playbackSound`.
 *
 * Repeat OFF: the cursor WRAPS at the document's end — a rhythm aid that makes
 * no claim about the next lap. Repeat ON (Round B): the chart draws the next
 * laps for real, so the cursor runs on through them to the drawn horizon and
 * stops there; a wrap would be the lie the stream exists to avoid.
 *
 * Domains (see transport.ts): `position` is seconds on the rotation's axis and
 * is what survives a pause; `elapsed` = position + lead is what the clock reads.
 */

import { get } from 'svelte/store';
import { siteSettings } from '$lib/stores';
import { plannerView as pv } from '$lib/plannerView.svelte';
import { COUNT_IN_S, countInCues, type Cue } from './cues';
import { dueBetween, positionAt } from './transport';
import { createSounder, type SoundChoice, type Sounder } from './tones';

/** How far ahead tones are queued. ⚠️ Must exceed the ~1 s timer throttle a
 *  hidden tab applies, or the queue runs dry between ticks. */
const LOOKAHEAD_S = 2.5;
/** How often the scheduler tops the queue up, foreground. */
const TICK_MS = 100;
/** The first tone is queued this far ahead of "now" so it is never late: a
 *  tone started at `currentTime` exactly plays on the NEXT render quantum. */
const START_LATENCY_S = 0.05;

class Playback {
	/** Rotation-axis position in seconds; negative during the count-in. */
	t = $state(0);
	playing = $state(false);
	/** Wrap at the end — whenever the chart is NOT drawing the next laps. */
	get loop() {
		return !pv.repeat;
	}

	// ── The clock ────────────────────────────────────────────────────────────
	#clock: 'audio' | 'wall' = 'wall';
	/** Wall-clock instant at which elapsed = 0. */
	#anchor = 0;
	/** Position (lead already removed) carried across a pause. */
	#positionAtPause = 0;
	#lead = 0;
	#raf = 0;
	#timer: ReturnType<typeof setInterval> | null = null;
	#sounder: Sounder | null = null;
	/** Elapsed instant up to which tones have been queued. */
	#queuedTo = 0;
	/** The cue list the queue was built from — a change re-queues. */
	#queuedFrom: readonly Cue[] | null = null;
	#countIn = countInCues();

	/** Nothing to play: an empty rotation, or one that parses to zero length. */
	get canPlay() {
		return pv.playbackEnd > 0;
	}

	#now(): number {
		return this.#clock === 'audio' && this.#sounder
			? this.#sounder.ctx.currentTime
			: performance.now() / 1000;
	}

	/** Lazily create the context INSIDE the gesture that pressed Play (or a
	 *  Settings preview — also a gesture). */
	#ensureSounder(): Sounder | null {
		if (typeof AudioContext === 'undefined') return null;
		if (!this.#sounder) {
			this.#sounder = createSounder(new AudioContext(), get(siteSettings).playbackVolume);
			// Volume follows the setting for the life of the context.
			siteSettings.subscribe((v) => this.#sounder?.setVolume(v.playbackVolume));
		}
		if (this.#sounder.ctx.state === 'suspended') void this.#sounder.ctx.resume();
		return this.#sounder;
	}

	/** The Settings preview phrase — the way a set or an assignment is chosen.
	 *  Either argument defaults to the stored setting. */
	preview(over: Partial<SoundChoice> = {}) {
		this.#ensureSounder()?.preview({ ...this.#choice(), ...over });
	}

	#choice(): SoundChoice {
		const s = get(siteSettings);
		return {
			set: s.playbackSoundMode === 'metronome' ? 'metronome' : s.playbackVoice,
			order: s.playbackOrder,
			notes: s.playbackNotes,
			swap: s.playbackSwap
		};
	}

	play() {
		if (!this.canPlay || this.playing) return;
		const duration = pv.playbackEnd;
		const sounder = get(siteSettings).playbackSound ? this.#ensureSounder() : null;
		this.#clock = sounder ? 'audio' : 'wall';
		// Play at the end of a single pass starts over.
		if (!this.loop && this.#positionAtPause >= duration) this.#positionAtPause = 0;
		// The count-in needs something to hear and a start to count into: a
		// resume mid-rotation counts nothing in.
		this.#lead = sounder && this.#positionAtPause === 0 ? COUNT_IN_S : 0;
		// Elapsed resumes at the carried POSITION: a count-in only ever runs from
		// position 0, where elapsed 0 is t = −lead — the beats are time still to
		// spend, not time already spent. (A first cut added the lead here and the
		// cursor set off on the first frame with the count-in unheard.)
		const elapsed = this.#positionAtPause;
		this.#anchor = this.#now() + (sounder ? START_LATENCY_S : 0) - elapsed;
		this.#queuedTo = elapsed;
		this.#queuedFrom = null;
		this.playing = true;
		this.#frame();
		if (sounder) {
			this.#tick();
			this.#timer = setInterval(() => this.#tick(), TICK_MS);
		}
	}

	pause() {
		if (!this.playing) return;
		// Paused inside the count-in → back to 0, and the next Play counts in again.
		this.#positionAtPause = Math.max(0, this.#now() - this.#anchor - this.#lead);
		this.#halt();
	}

	toggle() {
		if (this.playing) this.pause();
		else this.play();
	}

	/** Back to the start, silent. The page left, or there is nothing to play. */
	stop() {
		this.#halt();
		this.#positionAtPause = 0;
		this.t = 0;
	}

	#halt() {
		this.playing = false;
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.#raf = 0;
		if (this.#timer !== null) clearInterval(this.#timer);
		this.#timer = null;
		this.#sounder?.cancelPending();
	}

	/** The sound plate. Mid-play it re-anchors onto the other clock in place. */
	setSound(on: boolean) {
		siteSettings.setPlaybackSound({ playbackSound: on });
		if (!this.playing) return;
		this.pause();
		this.play();
	}

	#frame = () => {
		this.#raf = 0;
		if (!this.playing) return;
		const duration = pv.playbackEnd;
		if (duration <= 0) {
			this.stop();
			return;
		}
		const pos = positionAt(this.#now() - this.#anchor, this.#lead, duration, this.loop);
		this.t = pos.t;
		if (pos.ended) {
			this.#positionAtPause = duration;
			this.#halt();
			return;
		}
		this.#raf = requestAnimationFrame(this.#frame);
	};

	/** Top the audio queue up to `now + LOOKAHEAD_S`. */
	#tick() {
		const s = this.#sounder;
		if (!s || !this.playing) return;
		const duration = pv.playbackEnd;
		if (duration <= 0) return;
		const cues = pv.playbackCues;
		const nowElapsed = s.ctx.currentTime - this.#anchor;
		if (this.#queuedFrom !== null && this.#queuedFrom !== cues) {
			// The rotation changed under us: drop what was queued from the old
			// parse and rebuild from now with the new one. A tone already
			// sounding is a few ms long and is left alone.
			s.cancelPending();
			this.#queuedTo = nowElapsed;
		}
		this.#queuedFrom = cues;
		const to = nowElapsed + LOOKAHEAD_S;
		if (to <= this.#queuedTo) return;
		const choice = this.#choice();
		for (const due of dueBetween(
			cues,
			this.#countIn,
			this.#lead,
			duration,
			this.loop,
			this.#queuedTo,
			to
		)) {
			s.play(due.kind, this.#anchor + due.elapsed, choice, due.dur);
		}
		this.#queuedTo = to;
	}
}

export const playback = new Playback();
