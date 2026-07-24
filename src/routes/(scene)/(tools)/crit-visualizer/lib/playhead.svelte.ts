/**
 * Reactive rAF playhead for timeline instruments (Gauge Explorer playback).
 *
 * The loop runs only while `playing && active` — a benched tile (the
 * workspace hides unslotted instruments via display:none) passes
 * active=false and burns zero rAF; hidden tabs suspend for free because
 * rAF doesn't fire there, and advance()'s delta clamp absorbs the return.
 * Suspension is in-place: `playing` stays true and playback resumes exactly
 * where it stopped.
 */

import { DEFAULT_PLAYHEAD_SPEED, advance } from './playhead';

export function createPlayhead(getDuration: () => number) {
	let t = $state(0);
	let playing = $state(false);
	let speed = $state<number>(DEFAULT_PLAYHEAD_SPEED);
	let active = true;
	let raf = 0;
	let last = 0;

	function frame(now: number) {
		raf = 0;
		if (!playing || !active) return;
		const step = advance(t, now - last, speed, getDuration());
		last = now;
		t = step.t;
		if (step.ended) {
			playing = false;
			return;
		}
		raf = requestAnimationFrame(frame);
	}

	function schedule() {
		if (raf || !playing || !active) return;
		last = performance.now();
		raf = requestAnimationFrame(frame);
	}

	function cancel() {
		if (raf) {
			cancelAnimationFrame(raf);
			raf = 0;
		}
	}

	function play() {
		if (t >= getDuration()) t = 0; // play at the end restarts
		playing = true;
		schedule();
	}

	function pause() {
		playing = false;
		cancel();
	}

	return {
		get t() {
			return t;
		},
		get playing() {
			return playing;
		},
		get speed() {
			return speed;
		},
		play,
		pause,
		toggle() {
			if (playing) pause();
			else play();
		},
		seek(to: number) {
			t = Math.max(0, Math.min(getDuration(), to));
		},
		setSpeed(s: number) {
			speed = s;
		},
		/** Suspend-in-place for benched tiles: playing stays true, rAF stops. */
		setActive(a: boolean) {
			active = a;
			if (a) schedule();
			else cancel();
		},
		/** Hard reset — the sim underneath changed. */
		stop() {
			playing = false;
			cancel();
			t = 0;
		}
	};
}
