/**
 * The playback sound — two palettes, synthesised (playback round, 2026-09-29;
 * plan docs/playback-round-plan.md §5; the two-set design ⚓ Nate 2026-09-29).
 *
 * ⚓ SYNTHESISED, NO ASSETS. Every sound is a few oscillator and noise LAYERS
 * with gain envelopes, built from the numbers in this file, so it is identical
 * on every browser and OS (only the speakers differ) and every number is a knob
 * for Nate's ear.
 *
 * Rules both sets obey (the acoustics behind them, so nobody re-derives):
 *   - THE TRANSIENT MARKS THE BEAT. The ear places a sound by its onset and
 *     hears a slow attack late, so every layer attacks in a few ms and decays
 *     fast — a marimba, never a flute. `ATTACK_S` is that.
 *   - SHORT ENOUGH FOR THE FASTEST PAIR OF PRESSES. A dash cancel or an E into Q
 *     can be 6–10 frames apart: normals, charged, skill and cancel stay under
 *     ~120 ms; a burst may ring to ~250 ms because the game gives it room.
 *   - CUT THROUGH THE GAME. Game audio is dense from ~100 Hz to 2 kHz, so a cue
 *     carries some energy above 3 kHz (a click, a noise burst, a harmonic), and
 *     nothing lives below ~300 Hz alone — phone speakers cannot make it anyway.
 *   - MEANING RIDES ON CONTOUR. Nobody learns seven pitches; everyone learns
 *     weight: the heavier the input, the lower and longer the sound. A swap is
 *     the one cue that MOVES (two notes stepping up — "leaving").
 *   - THE COUNT-IN STAYS OUTSIDE THE INPUT VOCABULARY: same family, a pitch or
 *     colour no input uses.
 *
 * `percussive` is a drum kit: hats, a woodblock, a tom, claves. It sits in the
 * gaps of the game's mix and never fatigues. `melodic` is a kalimba on A major
 * pentatonic — ⚓ pentatonic because the scale has no semitone neighbours, so
 * any two notes overlapping (a skill's tail under the burst) are consonant;
 * kept inside an octave and a fifth (A4–C♯6) where hearing is most sensitive
 * and small speakers are honest.
 *
 * ⚠️ Gains are normalised BY EAR, not by number: a 440 Hz tone needs
 * noticeably more gain than a 1.7 kHz one to sound as loud.
 */

import type { CueKind } from './cues';

export type SoundSet = 'percussive' | 'melodic';
export const SOUND_SETS: readonly SoundSet[] = ['percussive', 'melodic'];

/** A pitched layer: an oscillator, optionally gliding, with a decay. */
type Tone = {
	kind: 'tone';
	/** Hz; a pair glides exponentially from the first to the second over `dur`. */
	freq: number | [number, number];
	dur: number;
	wave: OscillatorType;
	gain: number;
	/** Seconds after the cue's instant (a swap's second note). */
	delay?: number;
};
/** A noise layer: white noise through a bandpass, with a decay. Hats, clicks. */
type Noise = {
	kind: 'noise';
	/** Bandpass centre, Hz. */
	freq: number;
	/** Bandpass Q — higher is narrower and more pitched. */
	q: number;
	dur: number;
	gain: number;
	delay?: number;
};
export type Layer = Tone | Noise;

/** A major pentatonic, the melodic set's five notes. */
const A4 = 440;
const E5 = 659.25;
const FS5 = 739.99;
const A5 = 880;
const CS6 = 1108.73;

/** A kalimba note: the fundamental, a second harmonic that dies sooner, and a
 *  whisper of click at the onset so the beat is placeable. */
function kalimba(freq: number, dur: number, gain: number, delay = 0): Layer[] {
	return [
		{ kind: 'tone', freq, dur, wave: 'sine', gain, delay },
		{ kind: 'tone', freq: freq * 2, dur: dur * 0.4, wave: 'sine', gain: gain * 0.28, delay },
		{ kind: 'noise', freq: 4500, q: 1, dur: 0.004, gain: 0.12, delay }
	];
}

export const PALETTES: Record<SoundSet, Record<CueKind, Layer[]>> = {
	percussive: {
		// A metronome click: a 1 kHz tick with a bright edge.
		count: [
			{ kind: 'tone', freq: 1000, dur: 0.03, wave: 'sine', gain: 0.55 },
			{ kind: 'noise', freq: 4000, q: 1, dur: 0.012, gain: 0.35 }
		],
		// Closed hat.
		normal: [{ kind: 'noise', freq: 7000, q: 1.2, dur: 0.022, gain: 0.5 }],
		// The hat left open.
		charged: [{ kind: 'noise', freq: 7000, q: 1.2, dur: 0.085, gain: 0.42 }],
		// Woodblock: a sine dropping an octave, fast, with a click.
		skill: [
			{ kind: 'tone', freq: [800, 400], dur: 0.05, wave: 'sine', gain: 0.75 },
			{ kind: 'noise', freq: 2500, q: 1.5, dur: 0.006, gain: 0.25 }
		],
		// Tom: a sine falling to the floor, with a click on top so a phone speaker
		// still marks it.
		burst: [
			{ kind: 'tone', freq: [180, 60], dur: 0.2, wave: 'sine', gain: 0.95 },
			{ kind: 'noise', freq: 3000, q: 1, dur: 0.009, gain: 0.35 }
		],
		// Plunge: a tom that starts higher and falls further.
		plunge: [
			{ kind: 'tone', freq: [420, 70], dur: 0.16, wave: 'sine', gain: 0.85 },
			{ kind: 'noise', freq: 3000, q: 1, dur: 0.008, gain: 0.3 }
		],
		// A very short high tick.
		movement: [{ kind: 'noise', freq: 9000, q: 2, dur: 0.01, gain: 0.38 }],
		// Two claves a fourth apart.
		swap: [
			{ kind: 'tone', freq: 1870, dur: 0.035, wave: 'sine', gain: 0.5 },
			{ kind: 'tone', freq: 2500, dur: 0.035, wave: 'sine', gain: 0.5, delay: 0.075 }
		]
	},
	melodic: {
		// F♯5, a purer voice than the inputs: the one pentatonic note no input takes.
		count: [{ kind: 'tone', freq: FS5, dur: 0.12, wave: 'sine', gain: 0.45 }],
		normal: kalimba(A5, 0.07, 0.42),
		charged: kalimba(A5, 0.16, 0.4),
		skill: kalimba(E5, 0.12, 0.5),
		burst: kalimba(A4, 0.25, 0.62),
		plunge: [...kalimba(E5, 0.05, 0.45), ...kalimba(A4, 0.18, 0.55, 0.06)],
		movement: kalimba(CS6, 0.035, 0.32),
		swap: [...kalimba(E5, 0.08, 0.45), ...kalimba(A5, 0.085, 0.45, 0.075)]
	}
};

/** Per-set trim, so switching sets does not switch loudness. By ear. */
export const SET_TRIM: Record<SoundSet, number> = { percussive: 1, melodic: 1.1 };
/** Master level at volume 1. The palettes' gains are relative to this. */
export const MASTER_GAIN = 0.5;
/** Attack, in seconds — a hard onset clicks on cheap speakers. */
const ATTACK_S = 0.003;

/** The Settings preview: a phrase that shows the set — two normals, a skill, a
 *  burst, a swap — at offsets in seconds. */
export const PREVIEW_PHRASE: readonly { kind: CueKind; at: number }[] = [
	{ kind: 'normal', at: 0 },
	{ kind: 'normal', at: 0.26 },
	{ kind: 'skill', at: 0.52 },
	{ kind: 'burst', at: 0.86 },
	{ kind: 'swap', at: 1.4 }
];

export type Sounder = {
	/** Queue one cue of `set` at an absolute AudioContext time. */
	play(kind: CueKind, at: number, set: SoundSet): void;
	/** Play the preview phrase now, in `set`. */
	preview(set: SoundSet): void;
	/** Master volume, 0–1. */
	setVolume(v: number): void;
	/** Silence every layer not yet heard — pause, seek, stop. */
	cancelPending(): void;
	readonly ctx: AudioContext;
};

/**
 * Bind the palettes to a context. One sounder per context; the transport keeps
 * one for the session (an AudioContext is a real OS resource, and iOS lets a
 * page create only a few before it starts refusing).
 */
export function createSounder(ctx: AudioContext, volume = 1): Sounder {
	const master = ctx.createGain();
	master.gain.value = MASTER_GAIN * volume;
	master.connect(ctx.destination);

	// One second of white noise, made once; every noise layer plays a slice.
	const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
	const data = noise.getChannelData(0);
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

	// Every queued source, until it has sounded. `cancelPending` stops them
	// early; the `ended` handler prunes the ones that played.
	const pending = new Set<AudioScheduledSourceNode>();

	function envelope(at: number, dur: number, peak: number): GainNode {
		const env = ctx.createGain();
		env.gain.setValueAtTime(0, at);
		env.gain.linearRampToValueAtTime(peak, at + ATTACK_S);
		env.gain.exponentialRampToValueAtTime(0.001, at + dur);
		env.connect(master);
		return env;
	}

	function track(src: AudioScheduledSourceNode, at: number, dur: number, ...nodes: AudioNode[]) {
		src.start(at);
		src.stop(at + dur + 0.02);
		pending.add(src);
		src.onended = () => {
			pending.delete(src);
			src.disconnect();
			for (const n of nodes) n.disconnect();
		};
	}

	function layer(l: Layer, at0: number, trim: number) {
		const at = at0 + (l.delay ?? 0);
		const peak = l.gain * trim;
		if (l.kind === 'tone') {
			const osc = ctx.createOscillator();
			osc.type = l.wave;
			if (Array.isArray(l.freq)) {
				osc.frequency.setValueAtTime(l.freq[0], at);
				osc.frequency.exponentialRampToValueAtTime(l.freq[1], at + l.dur);
			} else {
				osc.frequency.setValueAtTime(l.freq, at);
			}
			const env = envelope(at, l.dur, peak);
			osc.connect(env);
			track(osc, at, l.dur, env);
		} else {
			const src = ctx.createBufferSource();
			src.buffer = noise;
			// A random slice, so two hats in a row are not the same grains.
			src.loop = true;
			src.loopStart = Math.random() * 0.5;
			src.loopEnd = src.loopStart + 0.4;
			const band = ctx.createBiquadFilter();
			band.type = 'bandpass';
			band.frequency.value = l.freq;
			band.Q.value = l.q;
			const env = envelope(at, l.dur, peak);
			src.connect(band);
			band.connect(env);
			track(src, at, l.dur, band, env);
		}
	}

	return {
		ctx,
		play(kind, at, set) {
			const trim = SET_TRIM[set];
			for (const l of PALETTES[set][kind]) layer(l, at, trim);
		},
		preview(set) {
			const at0 = ctx.currentTime + 0.05;
			for (const step of PREVIEW_PHRASE) this.play(step.kind, at0 + step.at, set);
		},
		setVolume(v) {
			master.gain.setTargetAtTime(MASTER_GAIN * Math.max(0, Math.min(1, v)), ctx.currentTime, 0.01);
		},
		cancelPending() {
			const now = ctx.currentTime;
			for (const src of pending) {
				try {
					src.stop(now);
				} catch {
					// already stopped — `stop` twice throws, and the ended handler prunes
				}
			}
			pending.clear();
		}
	};
}
