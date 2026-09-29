/**
 * The playback sound — voices, synthesised (playback round, 2026-09-29; plan
 * docs/playback-round-plan.md §5; sets and assignments ⚓ Nate 2026-09-29).
 *
 * ⚓ SYNTHESISED, NO ASSETS. Every sound is a few LAYERS with gain envelopes,
 * built from the numbers in this file, so it is identical on every browser and
 * OS (only the speakers differ) and every number is a knob for Nate's ear.
 *
 * Rules every voice obeys (the acoustics behind them, so nobody re-derives):
 *   - THE TRANSIENT MARKS THE BEAT. The ear places a sound by its onset and
 *     hears a slow attack late, so every layer attacks in a few ms — a marimba,
 *     never a flute. `ATTACK_S` is that.
 *   - THE TAIL NEVER CROSSES THE NEXT PRESS. A fixed-length layer stays under
 *     the fastest pair of presses (a dash cancel or an E into Q is 6–10 frames
 *     apart). A SUSTAINED layer rings for the INPUT'S OWN LENGTH instead — the
 *     cue carries the block's drawn duration, the cancel-adjusted animation the
 *     bar is drawn from — and releases `RELEASE_S` before it ends, so the next
 *     onset is always heard clean and a human-timing pad plays as silence (⚓
 *     Nate 2026-09-29: "we have all the frame data"). It still DECAYS.
 *   - TONAL AND NARROW, OR IT IS NOT HEARD. ⚓ Measured at the DPS dummy (Nate
 *     2026-09-29): every voice carried over the game's audio and the drum kit
 *     did not. Genshin's hit and skill sounds are broadband noise, and a snare
 *     or a hat is camouflaged by its own kind; a narrow tone that rings pokes
 *     through and gives the ear time to find it. ⛔ So there is no drum kit —
 *     the non-melodic option is a METRONOME, one pitch with the length rule.
 *   - MEANING RIDES ON CONTOUR. Nobody learns seven pitches; everyone learns
 *     weight. The default assignment puts the heavier input lower and longer;
 *     the ASSIGNMENT is a setting (Nate is testing alternatives), the length
 *     rule is not.
 *   - A SWAP IS THE ONE SOUND THAT MOVES. One onset, gliding from one step to
 *     another over the swap's own length, so the pitch ARRIVES where the new
 *     character takes the field — the gap is your ping, inside one sound.
 *     ⚓ Nate 2026-09-29: two hits for a swap were confusing at the dummy.
 *   - THE COUNT-IN STAYS OUTSIDE THE INPUT VOCABULARY: a plain sine on a note
 *     no input takes.
 *
 * ⚓ THE DEGREE ASSIGNMENT IS SHARED ACROSS VOICES; THE KEY AND REGISTER ARE PER
 * VOICE. The sets never sound together, so nothing binds them to one key — but
 * which step means which input must not change between voices, or the
 * contour learnt on one would not transfer (it is a SETTING, so the reader
 * changes it, never the voice). What moves per voice is the OCTAVE
 * (a marimba's warmth is below 500 Hz, a music box lives high) and the MODE (a
 * handpan is almost always tuned minor). All on A, major or minor pentatonic —
 * ⚓ pentatonic because the scale has no semitone neighbours, so any two notes
 * overlapping (a skill's tail under the burst) are consonant.
 *
 * ⚠️ Gains are normalised BY EAR, not by number: a 440 Hz tone needs
 * noticeably more gain than a 1.7 kHz one to sound as loud.
 */

import type { CueKind } from './cues';

// ── Sets ──────────────────────────────────────────────────────────────────

export type SoundSet =
	| 'metronome'
	| 'kalimba'
	| 'epiano'
	| 'musicbox'
	| 'handpan'
	| 'marimba'
	| 'vibraphone';
export const SOUND_SETS: readonly SoundSet[] = [
	'metronome',
	'kalimba',
	'epiano',
	'musicbox',
	'handpan',
	'marimba',
	'vibraphone'
];
/** What the Settings segment calls each set. */
export const SOUND_SET_LABELS: Record<SoundSet, string> = {
	metronome: 'Metronome',
	kalimba: 'Kalimba',
	epiano: 'E-piano',
	musicbox: 'Music box',
	handpan: 'Handpan',
	marimba: 'Marimba',
	vibraphone: 'Vibraphone'
};

export type Tuning = {
	/** Octaves from the reference (A4 = 440 as the root). */
	octave: number;
	mode: 'major' | 'minor';
	/** Scales every base length — a vibraphone's floor is longer than a tine's. */
	durScale?: number;
	/** ONE pitch for every input, in Hz: the metronome. The assignment then
	 *  says nothing about pitch and the length rule carries all the meaning. */
	mono?: number;
};
export const SET_TUNING: Record<SoundSet, Tuning> = {
	metronome: { octave: 0, mode: 'major', mono: 1175 },
	kalimba: { octave: 0, mode: 'major' },
	epiano: { octave: -1, mode: 'major' },
	musicbox: { octave: 1, mode: 'major' },
	handpan: { octave: -1, mode: 'minor' },
	marimba: { octave: -1, mode: 'major' },
	vibraphone: { octave: 0, mode: 'major', durScale: 1.8 }
};
/** The sets whose pitch means something — every set but the metronome. */
export const PITCHED_SETS: readonly SoundSet[] = SOUND_SETS.filter(
	(s) => SET_TUNING[s].mono === undefined
);

// ── Degrees and assignments ───────────────────────────────────────────────

/**
 * Scale STEPS of the pentatonic, 1 = the root, 6 = the octave, on up to 9 —
 * so an assignment can say "the next note up", the way wind chimes are tuned
 * (⚓ Nate 2026-09-29: neighbouring notes separate well enough by pitch, and
 * the cluster is what makes a chime). Resolved per mode: major A B C♯ E F♯,
 * minor A C D E G.
 */
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
const STEP_SEMITONES: Record<'major' | 'minor', number[]> = {
	major: [0, 2, 4, 7, 9, 12, 14, 16, 19],
	minor: [0, 3, 5, 7, 10, 12, 15, 17, 19]
};
export function stepHz(t: Tuning, step: Step): number {
	const a = 440 * Math.pow(2, t.octave);
	return a * Math.pow(2, STEP_SEMITONES[t.mode][step - 1] / 12);
}

/**
 * Which step each input gets. ⚓ Nate 2026-09-29 asked to TEST alternatives,
 * so this is a setting rather than a constant, applied to every voice alike.
 * `count` must be a step no input takes; `swap` glides from its first step to
 * its second; `mode`, when set, overrides the voice's own — the chime
 * assignments come in both so every voice can be heard both ways.
 */
export type Assignment = {
	normal: Step;
	skill: Step;
	burst: Step;
	cancel: Step;
	count: Step;
	swap: [Step, Step];
	mode?: 'major' | 'minor';
};
export type AssignmentId =
	| 'weight'
	| 'skillUp'
	| 'rising'
	| 'close'
	| 'chime'
	| 'chimeMinor'
	| 'chimeRising'
	| 'chimeRisingMinor';
export const ASSIGNMENT_IDS: readonly AssignmentId[] = [
	'weight',
	'skillUp',
	'rising',
	'close',
	'chime',
	'chimeMinor',
	'chimeRising',
	'chimeRisingMinor'
];
export const ASSIGNMENTS: Record<AssignmentId, Assignment> = {
	/** The original: the heavier the input, the lower. Burst root · skill fifth
	 *  · attacks octave · cancel the third above · count the sixth. */
	weight: { normal: 6, skill: 4, burst: 1, cancel: 8, count: 5, swap: [4, 6] },
	/** The frequent event sits in the middle and the skill ANNOUNCES: attacks
	 *  fifth · skill octave · burst root. */
	skillUp: { normal: 4, skill: 6, burst: 1, cancel: 8, count: 5, swap: [6, 4] },
	/** Weight inverted: the heavier the input, the HIGHER. */
	rising: { normal: 1, skill: 4, burst: 6, cancel: 8, count: 5, swap: [4, 6] },
	/** Everything inside a fifth, in thirds: attacks fifth · skill third · burst
	 *  root · cancel the sixth · count the octave. */
	close: { normal: 4, skill: 3, burst: 1, cancel: 5, count: 6, swap: [3, 4] },
	/** WIND CHIME: neighbouring steps, the heavier the lower — attacks the third
	 *  step, skill the second, burst the root, cancel the fifth, count the
	 *  fourth. In major: C♯ · B · A, cancel F♯, count E. */
	chime: { normal: 3, skill: 2, burst: 1, cancel: 5, count: 4, swap: [2, 3], mode: 'major' },
	/** The same chime in minor: D · C · A, cancel G, count E. */
	chimeMinor: { normal: 3, skill: 2, burst: 1, cancel: 5, count: 4, swap: [2, 3], mode: 'minor' },
	/** The chime climbing with weight: attacks root · skill second · burst third. */
	chimeRising: { normal: 1, skill: 2, burst: 3, cancel: 5, count: 4, swap: [2, 3], mode: 'major' },
	chimeRisingMinor: {
		normal: 1,
		skill: 2,
		burst: 3,
		cancel: 5,
		count: 4,
		swap: [2, 3],
		mode: 'minor'
	}
};
export const ASSIGNMENT_LABELS: Record<AssignmentId, string> = {
	weight: 'Weight',
	skillUp: 'Skill up',
	rising: 'Rising',
	close: 'Close',
	chime: 'Chime',
	chimeMinor: 'Chime minor',
	chimeRising: 'Chime up',
	chimeRisingMinor: 'Chime up minor'
};

// ── Layers ────────────────────────────────────────────────────────────────

type Common = {
	/** Base length in seconds; a sustained layer's floor. */
	dur: number;
	gain: number;
	/** Seconds after the cue's instant. */
	delay?: number;
	/** Ring for the input's own length (less the release), never shorter than
	 *  `dur`, never longer than `MAX_RING_S`. */
	sustain?: boolean;
	/** Glide the pitch by this ratio over the input's length — the swap. */
	slide?: number;
};
/** A pitched layer: an oscillator, optionally gliding on its own. */
type Tone = Common & {
	kind: 'tone';
	/** Hz; a pair glides exponentially from the first to the second over
	 *  `glide` seconds (default: `dur`). A short glide is a strike's pitch dip. */
	freq: number | [number, number];
	wave: OscillatorType;
	glide?: number;
};
/** A noise layer: white noise through a bandpass. The click at an onset. */
type Noise = Common & { kind: 'noise'; freq: number; q: number };
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
export type Layer = Tone | Noise | Fm;

/** Attack, in seconds — a hard onset clicks on cheap speakers. */
const ATTACK_S = 0.003;
/** A sustained layer lets go this long before the input ends. */
export const RELEASE_S = 0.02;
/** No sustained layer rings past this, however long the hold. */
export const MAX_RING_S = 4;
/** How long a slide takes when the cue carries no length. */
const SLIDE_FALLBACK_S = 0.12;

// ── Voices ────────────────────────────────────────────────────────────────

/** A voice: how one note of `freq` sounds, ringing `dur` at `gain`. */
type Voice = (freq: number, dur: number, gain: number, delay?: number) => Layer[];

/** The whisper of click at a note's onset, so the beat is placeable. */
const click = (delay?: number): Layer => ({
	kind: 'noise',
	freq: 4500,
	q: 1,
	dur: 0.004,
	gain: 0.12,
	delay
});

/** Metronome: a woodblock's ping — a bright fundamental with a fast dip, a
 *  short second partial — that RINGS for the input, so a burst is a long tick
 *  and a normal a short one. One pitch; the length is the whole message. */
const metronome: Voice = (freq, dur, gain, delay) => [
	{
		kind: 'tone',
		freq: [freq * 1.06, freq],
		glide: 0.012,
		dur,
		wave: 'sine',
		gain,
		delay,
		sustain: true
	},
	{ kind: 'tone', freq: freq * 2.4, dur: 0.03, wave: 'sine', gain: gain * 0.3, delay },
	click(delay)
];

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

const VOICES: Record<SoundSet, Voice> = {
	metronome,
	kalimba,
	epiano,
	musicbox,
	handpan,
	marimba,
	vibraphone
};

/** Per-set trim, so switching sets does not switch loudness. By ear. */
export const SET_TRIM: Record<SoundSet, number> = {
	metronome: 1,
	kalimba: 1.1,
	epiano: 1,
	musicbox: 1,
	handpan: 1.05,
	marimba: 1.1,
	vibraphone: 1
};
/** Master level at volume 1. The palettes' gains are relative to this. */
export const MASTER_GAIN = 0.5;

// ── Palettes ──────────────────────────────────────────────────────────────

/**
 * A voice's palette under an assignment: the assignment's step for each
 * input in the voice's key and register (the assignment's mode, if it has one), the count-in on the odd note out in
 * a plain sine (a purer colour than any voice), and the swap one note of the
 * voice sliding from the assignment's first step to its second over the
 * swap's own length, a little quieter than a press. A mono voice takes its one
 * pitch for every input and the assignment says only which way the swap slides.
 */
function paletteOf(set: SoundSet, assignment: Assignment): Record<CueKind, Layer[]> {
	const own = SET_TUNING[set];
	const t: Tuning = assignment.mode ? { ...own, mode: assignment.mode } : own;
	const note = VOICES[set];
	const hz = (step: Step) => t.mono ?? stepHz(t, step);
	const d = t.durScale ?? 1;
	const [from, to] = assignment.swap;
	const slide = t.mono ? Math.pow(2, 5 / 12) : hz(to) / hz(from);
	return {
		count: [
			{
				kind: 'tone',
				freq: t.mono ? t.mono * 0.667 : hz(assignment.count),
				dur: 0.12,
				wave: 'sine',
				gain: 0.45
			}
		],
		normal: note(hz(assignment.normal), 0.07 * d, 0.42),
		charged: note(hz(assignment.normal), 0.16 * d, 0.4),
		skill: note(hz(assignment.skill), 0.12 * d, 0.5),
		burst: note(hz(assignment.burst), 0.25 * d, 0.62),
		plunge: [
			...note(hz(assignment.skill), 0.05 * d, 0.45),
			...note(hz(assignment.burst), 0.18 * d, 0.55, 0.06)
		],
		movement: note(hz(assignment.cancel), 0.035 * d, 0.32),
		swap: note(hz(from), 0.1 * d, 0.34).map((l) => (l.kind === 'noise' ? l : { ...l, slide }))
	};
}

const paletteCache = new Map<string, Record<CueKind, Layer[]>>();
/** The palette for a set under an assignment, built once per pair. */
export function paletteFor(set: SoundSet, assignment: AssignmentId): Record<CueKind, Layer[]> {
	const key = `${set}/${assignment}`;
	let p = paletteCache.get(key);
	if (!p) {
		p = paletteOf(set, ASSIGNMENTS[assignment]);
		paletteCache.set(key, p);
	}
	return p;
}

/** The Settings preview: a phrase that shows the set — two normals, a skill, a
 *  burst, a swap — at offsets in seconds, each with a plausible length so a
 *  voice is heard ringing. */
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

// ── The sounder ───────────────────────────────────────────────────────────

export type Sounder = {
	/** Queue one cue at an absolute AudioContext time; `dur` is the input's
	 *  length in seconds (0 = unknown). */
	play(kind: CueKind, at: number, set: SoundSet, assignment: AssignmentId, dur?: number): void;
	/** Play the preview phrase now. */
	preview(set: SoundSet, assignment: AssignmentId): void;
	/** Master volume, 0–1. */
	setVolume(v: number): void;
	/** Silence every layer not yet heard — pause, seek, stop. */
	cancelPending(): void;
	readonly ctx: AudioContext;
};

/**
 * Bind the voices to a context. One sounder per context; the transport keeps
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

	/** Pitch a param at `f`, with the layer's own glide and then the swap's slide. */
	function pitch(
		param: AudioParam,
		f: number | [number, number],
		l: Layer,
		at: number,
		inputDur: number
	) {
		const start = Array.isArray(f) ? f[0] : f;
		const settle = Array.isArray(f) ? f[1] : f;
		param.setValueAtTime(start, at);
		if (Array.isArray(f) && l.kind === 'tone') {
			param.exponentialRampToValueAtTime(settle, at + (l.glide ?? l.dur));
		}
		if (l.slide) {
			const over = inputDur > 0 ? inputDur : SLIDE_FALLBACK_S;
			param.exponentialRampToValueAtTime(settle * l.slide, at + over);
		}
	}

	function layer(l: Layer, at0: number, trim: number, inputDur: number) {
		const at = at0 + (l.delay ?? 0);
		const dur = l.sustain ? ringFor(l.dur, inputDur) : l.dur;
		const peak = l.gain * trim;
		if (l.kind === 'tone') {
			const osc = ctx.createOscillator();
			osc.type = l.wave;
			pitch(osc.frequency, l.freq, l, at, inputDur);
			const env = envelope(at, dur, peak);
			osc.connect(env);
			track([osc], at, dur, env);
		} else if (l.kind === 'fm') {
			const carrier = ctx.createOscillator();
			carrier.type = 'sine';
			pitch(carrier.frequency, l.freq, l, at, inputDur);
			const mod = ctx.createOscillator();
			mod.type = 'sine';
			pitch(mod.frequency, l.freq * l.ratio, l, at, inputDur);
			// Depth in Hz, decaying: the tine's bright strike settling to a tone.
			const depth = ctx.createGain();
			depth.gain.setValueAtTime(l.freq * l.index, at);
			depth.gain.exponentialRampToValueAtTime(1, at + l.indexDecay);
			mod.connect(depth);
			depth.connect(carrier.frequency);
			const env = envelope(at, dur, peak);
			carrier.connect(env);
			track([carrier, mod], at, dur, depth, env);
		} else {
			const src = ctx.createBufferSource();
			src.buffer = noise;
			// A random slice, so two clicks in a row are not the same grains.
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
		}
	}

	return {
		ctx,
		play(kind, at, set, assignment, dur = 0) {
			const trim = SET_TRIM[set];
			for (const l of paletteFor(set, assignment)[kind]) layer(l, at, trim, dur);
		},
		preview(set, assignment) {
			const at0 = ctx.currentTime + 0.05;
			for (const step of PREVIEW_PHRASE)
				this.play(step.kind, at0 + step.at, set, assignment, step.dur);
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
