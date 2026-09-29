/**
 * The playback sound — two palettes, synthesised (playback round, 2026-09-29;
 * plan docs/playback-round-plan.md §5; the two-set design ⚓ Nate 2026-09-29).
 *
 * ⚓ SYNTHESISED, NO ASSETS. Every sound is a few LAYERS with gain envelopes,
 * built from the numbers in this file, so it is identical on every browser and
 * OS (only the speakers differ) and every number is a knob for Nate's ear.
 *
 * Rules both sets obey (the acoustics behind them, so nobody re-derives):
 *   - THE TRANSIENT MARKS THE BEAT. The ear places a sound by its onset and
 *     hears a slow attack late, so every layer attacks in a few ms — a marimba,
 *     never a flute. `ATTACK_S` is that.
 *   - THE TAIL NEVER CROSSES THE NEXT PRESS. A fixed-length layer stays under
 *     the fastest pair of presses (a dash cancel or an E into Q is 6–10 frames
 *     apart): under ~120 ms, a burst to ~250 ms. A SUSTAINED layer (the kalimba
 *     voice) rings for the INPUT'S OWN LENGTH instead — the cue carries the
 *     block's drawn duration, the cancel-adjusted animation the bar is drawn
 *     from — and releases `RELEASE_S` before it ends, so the next onset is
 *     always heard clean and a human-timing pad plays as silence (⚓ Nate
 *     2026-09-29: "we have all the frame data"). It still DECAYS, kalimba-wise;
 *     a sustained organ would say nothing about weight.
 *   - CUT THROUGH THE GAME. Game audio is dense from ~100 Hz to 2 kHz, so a cue
 *     carries some energy above 3 kHz (a click, a metallic ring, a harmonic),
 *     and nothing lives below ~300 Hz alone — phone speakers cannot make it.
 *   - MEANING RIDES ON CONTOUR. Nobody learns seven pitches; everyone learns
 *     weight: the heavier the input, the lower and longer the sound. A swap is
 *     the one cue that MOVES: two notes, the press and the ARRIVAL — the second
 *     lands where the new character takes the field, so the gap is your ping.
 *   - THE COUNT-IN STAYS OUTSIDE THE INPUT VOCABULARY: same family, a pitch or
 *     colour no input uses.
 *
 * Six sets: the drum kit and five pitched VOICES on one pentatonic assignment
 * (`melodicPalette`) — kalimba, electric piano, music box, handpan, marimba,
 * vibraphone — ⚓ Nate 2026-09-29: build them all and strike by ear. Each voice is one note
 * recipe; the frequency-modulated tine is the only one that is not additive.
 *
 * `percussive` is a drum machine's kit, on the classic recipes: a metallic hat
 * is six square waves at inharmonic ratios through a high bandpass (the 808's
 * numbers), a rimshot two resonances and a crack, a snare two bodies under a
 * band of noise, a woodblock a fast pitch drop, a tom a slow one, a cowbell
 * two squares a minor sixth apart. It marks
 * the PRESS and sits in the gaps of the game's mix. The voices play on
 * A major pentatonic — ⚓ pentatonic because the scale has no semitone
 * neighbours, so any two notes overlapping (a skill's tail under the burst)
 * are consonant; kept inside an octave and a fifth (A4–C♯6) where hearing is
 * most sensitive and small speakers are honest — and it plays the LENGTH too.
 *
 * ⚠️ Gains are normalised BY EAR, not by number: a 440 Hz tone needs
 * noticeably more gain than a 1.7 kHz one to sound as loud.
 */

import type { CueKind } from './cues';

export type SoundSet =
	| 'percussive'
	| 'kalimba'
	| 'epiano'
	| 'musicbox'
	| 'handpan'
	| 'marimba'
	| 'vibraphone';
export const SOUND_SETS: readonly SoundSet[] = [
	'percussive',
	'kalimba',
	'epiano',
	'musicbox',
	'handpan',
	'marimba',
	'vibraphone'
];
/** The pitched voices — every set but the drum kit. All share one pentatonic
 *  assignment (`melodicPalette`) and differ only in the NOTE's recipe. */
export const MELODIC_SETS: readonly SoundSet[] = SOUND_SETS.filter((s) => s !== 'percussive');
/** What the Settings segment calls each set. */
export const SOUND_SET_LABELS: Record<SoundSet, string> = {
	percussive: 'Percussive',
	kalimba: 'Kalimba',
	epiano: 'E-piano',
	musicbox: 'Music box',
	handpan: 'Handpan',
	marimba: 'Marimba',
	vibraphone: 'Vibraphone'
};

type Common = {
	/** Base length in seconds; a sustained layer's floor. */
	dur: number;
	gain: number;
	/** Seconds after the cue's instant, or `'end'`: at the input's end (a
	 *  swap's arrival). `'end'` falls back to `END_FALLBACK_S` with no length. */
	delay?: number | 'end';
	/** Ring for the input's own length (less the release), never shorter than
	 *  `dur`, never longer than `MAX_RING_S`. */
	sustain?: boolean;
};
/** A pitched layer: an oscillator, optionally gliding. */
type Tone = Common & {
	kind: 'tone';
	/** Hz; a pair glides exponentially from the first to the second over
	 *  `glide` seconds (default: `dur`). A short glide is a strike's pitch dip. */
	freq: number | [number, number];
	wave: OscillatorType;
	glide?: number;
};
/** A frequency-modulated layer: a sine carrier whose pitch a second sine
 *  wobbles, the wobble's depth dying away fast — the electric piano's tine. */
type Fm = Common & {
	kind: 'fm';
	freq: number;
	/** Modulator frequency as a multiple of the carrier's. */
	ratio: number;
	/** Peak modulation depth as a multiple of the carrier frequency. */
	index: number;
	/** Seconds for the depth to decay away. */
	indexDecay: number;
};
/** A noise layer: white noise through a bandpass. Cracks and clicks. */
type Noise = Common & { kind: 'noise'; freq: number; q: number };
/** A metallic layer: a bank of square waves through a bandpass and a highpass.
 *  Hats, cowbells — the inharmonic ratios are what make metal. */
type Metal = Common & { kind: 'metal'; freqs: number[]; band: number; high: number };
export type Layer = Tone | Noise | Metal | Fm;

/** Attack, in seconds — a hard onset clicks on cheap speakers. */
const ATTACK_S = 0.003;
/** A sustained layer lets go this long before the input ends. */
export const RELEASE_S = 0.02;
/** No sustained layer rings past this, however long the hold. */
export const MAX_RING_S = 4;
/** Where an `'end'` layer lands when the cue carries no length. */
const END_FALLBACK_S = 0.075;

/** The 808 hat's six partials, Hz. */
const HAT = [205.3, 304.4, 369.6, 522.7, 540, 800];
/** The 808 cowbell's two, and the pair a fourth up for the arrival. */
const BELL = [540, 800];
const BELL_UP = [720, 1067];

/**
 * ⚓ THE DEGREE ASSIGNMENT IS SHARED; THE KEY AND REGISTER ARE PER VOICE (⚓ Nate
 * 2026-09-29). The sets never sound together, so nothing binds them to one
 * key — but which scale degree means which input must not move, or the
 * contour learnt on one voice would not transfer to the next. What moves is
 * the OCTAVE (instruments have home registers: a marimba's warmth is below
 * 500 Hz, a music box lives high) and the MODE (a handpan is almost always
 * tuned minor). The roles, on A:
 *
 *   burst   the root          A4
 *   skill   the fifth         E5
 *   attack  the octave        A5 (normal short, charged long)
 *   cancel  the third above   C♯6 major · C6 minor
 *   count   the odd note out  F♯5 major · G5 minor — the one no input takes
 *   swap    fifth → octave    E5 → A5, the second at the arrival
 */
export type Tuning = {
	/** Octaves from the reference (A4 = 440 as the root). */
	octave: number;
	mode: 'major' | 'minor';
	/** Scales every base length — a vibraphone's floor is longer than a tine's. */
	durScale?: number;
};
type Roles = { root: number; fifth: number; octave: number; third: number; count: number };
function roles(t: Tuning): Roles {
	const a = 440 * Math.pow(2, t.octave);
	const r = (semitones: number) => a * Math.pow(2, semitones / 12);
	return {
		root: a,
		fifth: r(7),
		octave: r(12),
		third: t.mode === 'major' ? r(16) : r(15),
		count: t.mode === 'major' ? r(9) : r(10)
	};
}
export const SET_TUNING: Record<Exclude<SoundSet, 'percussive'>, Tuning> = {
	kalimba: { octave: 0, mode: 'major' },
	epiano: { octave: -1, mode: 'major' },
	musicbox: { octave: 1, mode: 'major' },
	handpan: { octave: -1, mode: 'minor' },
	marimba: { octave: -1, mode: 'major' },
	vibraphone: { octave: 0, mode: 'major', durScale: 1.8 }
};

/** A voice: how one note of `freq` sounds, ringing `dur` at `gain`. */
type Voice = (freq: number, dur: number, gain: number, delay?: number | 'end') => Layer[];

/** The whisper of click at a note's onset, so the beat is placeable. */
const click = (delay?: number | 'end'): Layer => ({
	kind: 'noise',
	freq: 4500,
	q: 1,
	dur: 0.004,
	gain: 0.12,
	delay
});

/** Kalimba: the fundamental and a second partial that dies sooner — a real
 *  tine's is a few cents SHARP of the octave (×2.03), which is the life in it. */
const kalimba: Voice = (freq, dur, gain, delay) => [
	{ kind: 'tone', freq, dur, wave: 'sine', gain, delay, sustain: true },
	{
		kind: 'tone',
		freq: freq * 2.03,
		dur: dur * 0.4,
		wave: 'sine',
		gain: gain * 0.28,
		delay,
		sustain: true
	},
	click(delay)
];

/** Electric piano: the two things a Rhodes is — a body (modulator at the
 *  carrier's pitch, depth settling over ~150 ms) and the TINE, a second
 *  operator fourteen times up that rings for a few ms and gives the strike its
 *  "ting". A plain sine carries the hold. Lives an octave down (SET_TUNING). */
const epiano: Voice = (freq, dur, gain, delay) => [
	{
		kind: 'fm',
		freq,
		ratio: 1,
		index: 1.4,
		indexDecay: 0.15,
		dur,
		gain: gain * 0.7,
		delay,
		sustain: true
	},
	{
		kind: 'fm',
		freq,
		ratio: 14,
		index: 0.9,
		indexDecay: 0.035,
		dur: 0.05,
		gain: gain * 0.3,
		delay
	},
	{ kind: 'tone', freq, dur, wave: 'sine', gain: gain * 0.5, delay, sustain: true },
	click(delay)
];

/** Music box: a bright tine with two INHARMONIC partials (a steel comb's),
 *  short. An octave UP (SET_TUNING): a music box is a high instrument. */
const musicbox: Voice = (freq, dur, gain, delay) => [
	{ kind: 'tone', freq, dur, wave: 'sine', gain, delay, sustain: true },
	{
		kind: 'tone',
		freq: freq * 2.76,
		dur: dur * 0.5,
		wave: 'sine',
		gain: gain * 0.35,
		delay,
		sustain: true
	},
	{ kind: 'tone', freq: freq * 5.4, dur: dur * 0.25, wave: 'sine', gain: gain * 0.15, delay },
	click(delay)
];

/** Handpan: fundamental, octave and fifth in a 1:2:3 stack, and a small pitch
 *  dip on the strike (the shell flexing). Round and mellow; MINOR and an octave
 *  down (SET_TUNING), as the instrument is almost always tuned. */
const handpan: Voice = (freq, dur, gain, delay) => [
	{
		kind: 'tone',
		freq: [freq * 1.015, freq],
		glide: 0.03,
		dur,
		wave: 'sine',
		gain,
		delay,
		sustain: true
	},
	{
		kind: 'tone',
		freq: freq * 2,
		dur: dur * 0.8,
		wave: 'sine',
		gain: gain * 0.4,
		delay,
		sustain: true
	},
	{
		kind: 'tone',
		freq: freq * 3,
		dur: dur * 0.5,
		wave: 'sine',
		gain: gain * 0.22,
		delay,
		sustain: true
	},
	click(delay)
];

/** Marimba: a woody bar — the fundamental with a strong FOURTH harmonic (the
 *  tuned bar's signature), short and dry. An octave down (SET_TUNING): at the
 *  reference register it was a xylophone, and the fourth harmonic keeps every
 *  note present on a phone speaker with the fundamental at 220 Hz. */
const marimba: Voice = (freq, dur, gain, delay) => [
	{ kind: 'tone', freq, dur, wave: 'sine', gain, delay, sustain: true },
	{
		kind: 'tone',
		freq: freq * 4,
		dur: dur * 0.35,
		wave: 'sine',
		gain: gain * 0.4,
		delay,
		sustain: true
	},
	{ kind: 'tone', freq: freq * 10, dur: 0.015, wave: 'sine', gain: gain * 0.12, delay },
	click(delay)
];

/** Vibraphone, motor off: the marimba's bar in metal — the fourth harmonic
 *  SUSTAINS instead of dying, with a faint shimmer on top. The instrument
 *  built for holding a note, so the length rule shows best here; its floors
 *  are longer (SET_TUNING.durScale). */
const vibraphone: Voice = (freq, dur, gain, delay) => [
	{ kind: 'tone', freq, dur, wave: 'sine', gain, delay, sustain: true },
	{
		kind: 'tone',
		freq: freq * 4,
		dur: dur * 0.9,
		wave: 'sine',
		gain: gain * 0.3,
		delay,
		sustain: true
	},
	{
		kind: 'tone',
		freq: freq * 10,
		dur: dur * 0.25,
		wave: 'sine',
		gain: gain * 0.06,
		delay,
		sustain: true
	},
	click(delay)
];

/**
 * The one degree assignment every pitched voice plays, in its own key and
 * register (`roles`): burst on the root, skill on the fifth, the attacks on the
 * octave at two lengths, cancel a very short third above, the swap stepping
 * fifth → octave with the second note at the arrival, and the count-in on the
 * odd note out in a plain sine — a purer colour than any voice.
 */
function melodicPalette(note: Voice, tuning: Tuning): Record<CueKind, Layer[]> {
	const n = roles(tuning);
	const d = tuning.durScale ?? 1;
	return {
		count: [{ kind: 'tone', freq: n.count, dur: 0.12, wave: 'sine', gain: 0.45 }],
		normal: note(n.octave, 0.07 * d, 0.42),
		charged: note(n.octave, 0.16 * d, 0.4),
		skill: note(n.fifth, 0.12 * d, 0.5),
		burst: note(n.root, 0.25 * d, 0.62),
		plunge: [...note(n.fifth, 0.05 * d, 0.45), ...note(n.root, 0.18 * d, 0.55, 0.06)],
		movement: note(n.third, 0.035 * d, 0.32),
		swap: [...note(n.fifth, 0.08 * d, 0.45), ...note(n.octave, 0.085 * d, 0.45, 'end')]
	};
}

export const PALETTES: Record<SoundSet, Record<CueKind, Layer[]>> = {
	percussive: {
		// A metronome click: a 1 kHz tick with a bright edge.
		count: [
			{ kind: 'tone', freq: 1000, dur: 0.03, wave: 'sine', gain: 0.55 },
			{ kind: 'noise', freq: 4000, q: 1, dur: 0.012, gain: 0.35 }
		],
		// Rimshot: two resonances and a crack.
		normal: [
			{ kind: 'tone', freq: 1720, dur: 0.03, wave: 'sine', gain: 0.4 },
			{ kind: 'tone', freq: 455, dur: 0.02, wave: 'sine', gain: 0.3 },
			{ kind: 'noise', freq: 3600, q: 1, dur: 0.008, gain: 0.32 }
		],
		// Snare: a charged attack is a BIGGER hit, not a longer tap (⚓ Nate
		// 2026-09-29 — the cross-stick that sat here was too faint). The 808
		// recipe: two sine bodies, the low one dropping, under a wide band of
		// noise that outlasts them.
		charged: [
			{ kind: 'tone', freq: [200, 150], dur: 0.09, wave: 'sine', gain: 0.65 },
			{ kind: 'tone', freq: 330, dur: 0.06, wave: 'sine', gain: 0.35 },
			{ kind: 'noise', freq: 1800, q: 0.8, dur: 0.14, gain: 0.6 }
		],
		// Woodblock: a fast pitch drop with a bright partial and a crack.
		skill: [
			{ kind: 'tone', freq: [900, 650], dur: 0.06, wave: 'sine', gain: 0.7 },
			{ kind: 'tone', freq: 1800, dur: 0.02, wave: 'sine', gain: 0.2 },
			{ kind: 'noise', freq: 2800, q: 2, dur: 0.006, gain: 0.25 }
		],
		// Tuned tom: a slow drop to the floor, with a click on top so a phone
		// speaker still marks it.
		burst: [
			{ kind: 'tone', freq: [160, 80], dur: 0.22, wave: 'sine', gain: 0.95 },
			{ kind: 'noise', freq: 2500, q: 1, dur: 0.01, gain: 0.35 }
		],
		// A higher tom that falls further.
		plunge: [
			{ kind: 'tone', freq: [300, 90], dur: 0.18, wave: 'sine', gain: 0.85 },
			{ kind: 'noise', freq: 2500, q: 1, dur: 0.008, gain: 0.3 }
		],
		// The tightest closed hat: a metallic tick.
		movement: [{ kind: 'metal', freqs: HAT, band: 10000, high: 7000, dur: 0.014, gain: 0.5 }],
		// Cowbell on the press, a fourth up on the arrival.
		swap: [
			{ kind: 'metal', freqs: BELL, band: 2640, high: 400, dur: 0.06, gain: 0.45 },
			{ kind: 'metal', freqs: BELL_UP, band: 3500, high: 500, dur: 0.06, gain: 0.45, delay: 'end' }
		]
	},
	kalimba: melodicPalette(kalimba, SET_TUNING.kalimba),
	epiano: melodicPalette(epiano, SET_TUNING.epiano),
	musicbox: melodicPalette(musicbox, SET_TUNING.musicbox),
	handpan: melodicPalette(handpan, SET_TUNING.handpan),
	marimba: melodicPalette(marimba, SET_TUNING.marimba),
	vibraphone: melodicPalette(vibraphone, SET_TUNING.vibraphone)
};

/** Per-set trim, so switching sets does not switch loudness. By ear. */
export const SET_TRIM: Record<SoundSet, number> = {
	percussive: 1,
	kalimba: 1.1,
	epiano: 1,
	musicbox: 1,
	handpan: 1.05,
	marimba: 1.1,
	vibraphone: 1
};
/** Master level at volume 1. The palettes' gains are relative to this. */
export const MASTER_GAIN = 0.5;

/** The Settings preview: a phrase that shows the set — two normals, a skill, a
 *  burst, a swap — at offsets in seconds, each with a plausible length so the
 *  melodic set is heard ringing. */
export const PREVIEW_PHRASE: readonly { kind: CueKind; at: number; dur: number }[] = [
	{ kind: 'normal', at: 0, dur: 0.26 },
	{ kind: 'normal', at: 0.26, dur: 0.26 },
	{ kind: 'skill', at: 0.52, dur: 0.34 },
	{ kind: 'burst', at: 0.86, dur: 1.2 },
	{ kind: 'swap', at: 2.06, dur: 0.15 }
];

/** How long a sustained layer rings for an input of `dur` seconds. */
export function ringFor(base: number, dur: number): number {
	if (!(dur > 0)) return base;
	return Math.min(MAX_RING_S, Math.max(base, dur - RELEASE_S));
}

export type Sounder = {
	/** Queue one cue of `set` at an absolute AudioContext time; `dur` is the
	 *  input's length in seconds (0 = unknown). */
	play(kind: CueKind, at: number, set: SoundSet, dur?: number): void;
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

	function track(srcs: AudioScheduledSourceNode[], at: number, dur: number, ...nodes: AudioNode[]) {
		let live = srcs.length;
		for (const src of srcs) {
			src.start(at);
			src.stop(at + dur + 0.02);
			pending.add(src);
			src.onended = () => {
				pending.delete(src);
				src.disconnect();
				if (--live === 0) for (const n of nodes) n.disconnect();
			};
		}
	}

	function layer(l: Layer, at0: number, trim: number, inputDur: number) {
		const at =
			at0 + (l.delay === 'end' ? (inputDur > 0 ? inputDur : END_FALLBACK_S) : (l.delay ?? 0));
		const dur = l.sustain ? ringFor(l.dur, inputDur) : l.dur;
		const peak = l.gain * trim;
		if (l.kind === 'tone') {
			const osc = ctx.createOscillator();
			osc.type = l.wave;
			if (Array.isArray(l.freq)) {
				osc.frequency.setValueAtTime(l.freq[0], at);
				osc.frequency.exponentialRampToValueAtTime(l.freq[1], at + (l.glide ?? l.dur));
			} else {
				osc.frequency.setValueAtTime(l.freq, at);
			}
			const env = envelope(at, dur, peak);
			osc.connect(env);
			track([osc], at, dur, env);
		} else if (l.kind === 'fm') {
			const carrier = ctx.createOscillator();
			carrier.type = 'sine';
			carrier.frequency.value = l.freq;
			const mod = ctx.createOscillator();
			mod.type = 'sine';
			mod.frequency.value = l.freq * l.ratio;
			// Depth in Hz, decaying: the tine's bright strike settling to a tone.
			const depth = ctx.createGain();
			depth.gain.setValueAtTime(l.freq * l.index, at);
			depth.gain.exponentialRampToValueAtTime(1, at + l.indexDecay);
			mod.connect(depth);
			depth.connect(carrier.frequency);
			const env = envelope(at, dur, peak);
			carrier.connect(env);
			track([carrier, mod], at, dur, depth, env);
		} else if (l.kind === 'noise') {
			const src = ctx.createBufferSource();
			src.buffer = noise;
			// A random slice, so two cracks in a row are not the same grains.
			src.loop = true;
			src.loopStart = Math.random() * 0.5;
			src.loopEnd = src.loopStart + 0.4;
			const band = ctx.createBiquadFilter();
			band.type = 'bandpass';
			band.frequency.value = l.freq;
			band.Q.value = l.q;
			const env = envelope(at, dur, peak);
			src.connect(band);
			band.connect(env);
			track([src], at, dur, band, env);
		} else {
			const band = ctx.createBiquadFilter();
			band.type = 'bandpass';
			band.frequency.value = l.band;
			band.Q.value = 1;
			const high = ctx.createBiquadFilter();
			high.type = 'highpass';
			high.frequency.value = l.high;
			// Six squares sum loud; the bank is scaled by its size.
			const env = envelope(at, dur, peak / Math.sqrt(l.freqs.length));
			band.connect(high);
			high.connect(env);
			const oscs = l.freqs.map((f) => {
				const osc = ctx.createOscillator();
				osc.type = 'square';
				osc.frequency.value = f;
				osc.connect(band);
				return osc;
			});
			track(oscs, at, dur, band, high, env);
		}
	}

	return {
		ctx,
		play(kind, at, set, dur = 0) {
			const trim = SET_TRIM[set];
			for (const l of PALETTES[set][kind]) layer(l, at, trim, dur);
		},
		preview(set) {
			const at0 = ctx.currentTime + 0.05;
			for (const step of PREVIEW_PHRASE) this.play(step.kind, at0 + step.at, set, step.dur);
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
