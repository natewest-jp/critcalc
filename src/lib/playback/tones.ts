/**
 * The playback palette — one short synthesised tone per input class (playback
 * round, 2026-09-29; plan docs/playback-round-plan.md §5).
 *
 * ⚓ SYNTHESISED, NO ASSETS. Every sound here is an oscillator and a gain
 * envelope, a few milliseconds long, built from numbers in this file. That is
 * what lets the palette be TUNED — Nate listens and moves a frequency — and what
 * keeps the transport free of a fetch, a decode and a cache.
 *
 * ⚓ The palette is by INPUT CLASS, so it can be learned without looking: a
 * normal is a click, a charged a longer click, a skill a mid tone, a burst a
 * low long one, a swap a two-note step, a cancel a tick, and the count-in a
 * plain beat. Pitch and length are the two axes an ear separates in a hurry;
 * timbre (the waveform) is the third and is used sparingly.
 *
 * ⚠️ Scheduling is the CALLER's: `play(kind, at)` queues the tone at an absolute
 * AudioContext time. Web Audio keeps a queued tone on schedule in a hidden tab,
 * which is the whole reason playback runs on the audio clock (see
 * playback.svelte.ts). Nothing here reads `currentTime` except the master gain.
 *
 * ⏭ Every number below is a knob for Nate's ear (plan §9 — "count-in length and
 * whether the sound palette needs more than the six classes").
 */

import type { CueKind } from './cues';

type Tone = {
	/** Hz. A second entry is a glide target (a swap steps UP to its new pitch). */
	freq: number | [number, number];
	/** Seconds from onset to silence. */
	dur: number;
	wave: OscillatorType;
	/** Peak gain relative to the master (0–1). Clicks run hot; long tones soft. */
	gain: number;
};

export const TONE_PALETTE: Record<CueKind, Tone> = {
	count: { freq: 880, dur: 0.06, wave: 'sine', gain: 0.5 },
	normal: { freq: 1400, dur: 0.03, wave: 'square', gain: 0.35 },
	charged: { freq: 1400, dur: 0.11, wave: 'square', gain: 0.35 },
	plunge: { freq: [1100, 500], dur: 0.14, wave: 'triangle', gain: 0.5 },
	skill: { freq: 660, dur: 0.12, wave: 'triangle', gain: 0.6 },
	burst: { freq: 330, dur: 0.28, wave: 'sawtooth', gain: 0.45 },
	movement: { freq: 2200, dur: 0.018, wave: 'square', gain: 0.25 },
	swap: { freq: [520, 780], dur: 0.16, wave: 'sine', gain: 0.55 }
};

/** Master level. The palette peaks are relative to this. */
export const MASTER_GAIN = 0.35;
/** Attack, in seconds — a hard onset clicks on cheap speakers. */
const ATTACK_S = 0.004;

export type Sounder = {
	/** Queue one tone at an absolute AudioContext time. */
	play(kind: CueKind, at: number): void;
	/** Silence every tone not yet heard — pause, seek, stop. */
	cancelPending(): void;
	readonly ctx: AudioContext;
};

/**
 * Bind the palette to a context. One sounder per context; the transport keeps
 * one for the session (an AudioContext is a real OS resource, and iOS lets a
 * page create only a few before it starts refusing).
 */
export function createSounder(ctx: AudioContext): Sounder {
	const master = ctx.createGain();
	master.gain.value = MASTER_GAIN;
	master.connect(ctx.destination);
	// Every queued oscillator, until it has sounded. `cancelPending` stops them
	// early; the `ended` handler prunes the ones that played.
	const pending = new Set<OscillatorNode>();

	return {
		ctx,
		play(kind, at) {
			const tone = TONE_PALETTE[kind];
			const osc = ctx.createOscillator();
			const env = ctx.createGain();
			osc.type = tone.wave;
			if (Array.isArray(tone.freq)) {
				osc.frequency.setValueAtTime(tone.freq[0], at);
				osc.frequency.exponentialRampToValueAtTime(tone.freq[1], at + tone.dur);
			} else {
				osc.frequency.setValueAtTime(tone.freq, at);
			}
			env.gain.setValueAtTime(0, at);
			env.gain.linearRampToValueAtTime(tone.gain, at + ATTACK_S);
			env.gain.exponentialRampToValueAtTime(0.001, at + tone.dur);
			osc.connect(env);
			env.connect(master);
			osc.start(at);
			osc.stop(at + tone.dur + 0.01);
			pending.add(osc);
			osc.onended = () => {
				pending.delete(osc);
				osc.disconnect();
				env.disconnect();
			};
		},
		cancelPending() {
			const now = ctx.currentTime;
			for (const osc of pending) {
				try {
					osc.stop(now);
				} catch {
					// already stopped — `stop` twice throws, and the ended handler prunes
				}
			}
			pending.clear();
		}
	};
}
