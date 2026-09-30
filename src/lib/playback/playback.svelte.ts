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
 * Domains (see transport.ts): `t` is seconds on the rotation's axis; `#from`
 * is where a run started (0, or where a pause left it) and survives a pause;
 * `elapsed` since the anchor is what the clock reads, count-in included.
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

/** The speeds the plate cycles, fastest first (Nate 2026-09-30: half speed
 *  for learning; ¾ because half is often too slow once you nearly have it). */
export const PLAYBACK_RATES = [1, 0.75, 0.5] as const;
/** A speed as its plate says it. Decimals, ⛔ never the ½ ¾ glyphs — a
 *  vulgar fraction falls back to another face (the sub-pixel laws). */
export const rateLabel = (rate: number) => `${rate}×`;

class Playback {
	/** Rotation-axis position in seconds; parked at the start during the
	 *  count-in. */
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
	/** The position this run started from — 0, or where a pause left it. */
	#from = 0;
	#lead = 0;
	#raf = 0;
	#timer: ReturnType<typeof setInterval> | null = null;
	#sounder: Sounder | null = null;
	/** Elapsed instant up to which tones have been queued. */
	#queuedTo = 0;
	/** The cue list the queue was built from — a change re-queues. */
	#queuedFrom: readonly Cue[] | null = null;
	/** The count-in on the ROTATION's axis at the current rate — see `rate`. */
	#countIn = countInCues();

	/**
	 * Playback speed (2026-09-30): 1, ¾ or ½ — for LEARNING a rotation, away
	 * from the game (the game will not slow down with it). Per LOOK like zoom,
	 * so not stored; ⛔ never in `?r=`.
	 *
	 * ⚓ The ROTATION slows and the COUNT-IN DOES NOT. The count-in's beats are
	 * a second apart at every speed (it has never carried the rotation's tempo
	 * — a rotation has none), so it is scaled onto the rotation's axis here and
	 * comes out at one second a beat in real time. Everything else — the
	 * cursor, every press, every note's ring, the human-timing pads — divides
	 * by the rate, because it is all read on the one axis.
	 */
	rate = $state(1);

	/** The next speed down, wrapping back to full — what the plate does. */
	cycleRate() {
		const i = PLAYBACK_RATES.indexOf(this.rate as (typeof PLAYBACK_RATES)[number]);
		this.setRate(PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length]);
	}

	/** Change speed. Mid-play it re-anchors in place, without a count-in. */
	setRate(rate: number) {
		if (rate === this.rate) return;
		const wasPlaying = this.playing;
		this.pause();
		this.rate = rate;
		if (wasPlaying) this.#start(false);
	}

	/** Elapsed seconds on the rotation's axis since the anchor. */
	#elapsed(): number {
		return (this.#now() - this.#anchor) * this.rate;
	}

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

	/** Start from where the cursor stands, counting in (⚓ Nate 2026-09-30:
	 *  every start counts in, a resume included — see transport.ts). */
	play() {
		this.#start(true);
	}

	/** `countIn` false re-anchors in place without the beats — a change of
	 *  clock or of speed under a rotation that is already playing. */
	#start(countIn: boolean) {
		if (!this.canPlay || this.playing) return;
		const duration = pv.playbackEnd;
		const sounder = get(siteSettings).playbackSound ? this.#ensureSounder() : null;
		this.#clock = sounder ? 'audio' : 'wall';
		// Play at the end of a single pass starts over.
		if (!this.loop && this.#from >= duration) this.#from = 0;
		// The count-in needs something to hear: a silent one is a cursor parked
		// for four seconds, which reads as a hang.
		this.#lead = sounder && countIn ? COUNT_IN_S * this.rate : 0;
		this.#countIn = countInCues().map((c) => ({ ...c, t: c.t * this.rate }));
		this.#anchor = this.#now() + (sounder ? START_LATENCY_S : 0);
		this.#queuedTo = 0;
		this.#queuedFrom = null;
		this.t = this.#from;
		this.playing = true;
		this.#frame();
		if (sounder) {
			this.#tick();
			this.#timer = setInterval(() => this.#tick(), TICK_MS);
		}
	}

	/** Where the cursor stands now. Inside the count-in it has not left
	 *  `#from` yet, so that is where a pause leaves it. */
	#position(): number {
		const elapsed = this.#elapsed();
		if (elapsed < this.#lead) return this.#from;
		return positionAt(elapsed, this.#lead, pv.playbackEnd, this.loop, this.#from).t;
	}

	pause() {
		if (!this.playing) return;
		this.#from = this.#position();
		this.#halt();
	}

	toggle() {
		if (this.playing) this.pause();
		else this.play();
	}

	/** Anywhere to rewind from: the cursor has left the start, or is playing. */
	get canRewind() {
		return this.playing || this.#from > 0 || this.t > 0;
	}

	/** Back to the start. Playing, it goes again from the top with the
	 *  count-in — "once more" is what a rewind mid-play means; stopped, it
	 *  parks the cursor at 0 for the next Play. */
	rewind() {
		const wasPlaying = this.playing;
		this.#halt();
		this.#from = 0;
		this.t = 0;
		if (wasPlaying) this.play();
	}

	/** Back to the start, silent. The page left, or there is nothing to play. */
	stop() {
		this.#halt();
		this.#from = 0;
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

	/** Sound on/off (Settings' Sound row). Mid-play it re-anchors onto the
	 *  other clock in place, without a count-in. */
	setSound(on: boolean) {
		siteSettings.setPlaybackSound({ playbackSound: on });
		if (!this.playing) return;
		this.pause();
		this.#start(false);
	}

	#frame = () => {
		this.#raf = 0;
		if (!this.playing) return;
		const duration = pv.playbackEnd;
		if (duration <= 0) {
			this.stop();
			return;
		}
		const elapsed = this.#elapsed();
		const pos = positionAt(elapsed, this.#lead, duration, this.loop, this.#from);
		// The cursor waits at its start while the beats count it in.
		this.t = elapsed < this.#lead ? this.#from : pos.t;
		if (pos.ended) {
			this.#from = duration;
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
		// On the rotation's axis; the context's clock is real seconds.
		const nowElapsed = (s.ctx.currentTime - this.#anchor) * this.rate;
		if (this.#queuedFrom !== null && this.#queuedFrom !== cues) {
			// The rotation changed under us: drop what was queued from the old
			// parse and rebuild from now with the new one. A tone already
			// sounding is a few ms long and is left alone.
			s.cancelPending();
			this.#queuedTo = nowElapsed;
		}
		this.#queuedFrom = cues;
		const to = nowElapsed + LOOKAHEAD_S * this.rate;
		if (to <= this.#queuedTo) return;
		const choice = this.#choice();
		for (const due of dueBetween(
			cues,
			this.#countIn,
			this.#lead,
			duration,
			this.loop,
			this.#queuedTo,
			to,
			this.#from
		)) {
			s.play(due.kind, this.#anchor + due.elapsed / this.rate, choice, due.dur / this.rate);
		}
		this.#queuedTo = to;
	}
}

export const playback = new Playback();
