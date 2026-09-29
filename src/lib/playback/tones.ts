/**
 * The playback sound — voices, synthesised (playback round, 2026-09-29; plan
 * docs/playback-round-plan.md §5; the vocabulary ⚓ Nate 2026-09-29).
 *
 * ⚓ SYNTHESISED, NO ASSETS. Every sound is a few LAYERS with gain envelopes,
 * built from the numbers in this file, so it is identical on every browser and
 * OS (only the speakers differ) and every number is a knob for Nate's ear.
 *
 * ⚓ THE VOCABULARY IS THREE NOTES. Every input the planner voices is one of
 * three roles — ATTACK (N, C, A, P), SKILL (E in every form, sE), BURST (Q, sQ)
 * — plus a cancel tick (D, J), a hum for the swap, and the count-in. What the
 * hand does differently is what gets a different sound; a hold, a charged
 * attack or a plunge is a LONGER note of the same role, because the note rings
 * for the input's own length. A `W` is refused by the planner and makes no
 * sound. Two settings shape the three notes: the ORDER (which role sits low,
 * mid, high) and the NOTE SET (which three steps of the pentatonic those are);
 * the cancel and the count-in are placed by the note set, off the three.
 *
 * Rules every voice obeys (the acoustics behind them, so nobody re-derives):
 *   - THE TRANSIENT MARKS THE BEAT. The ear places a sound by its onset and
 *     hears a slow attack late, so every struck layer attacks in a few ms.
 *   - THE TAIL NEVER CROSSES THE NEXT PRESS. A sustained layer rings for the
 *     INPUT'S OWN LENGTH — the cue carries the block's drawn duration — and
 *     releases `RELEASE_S` before it ends, so the next onset is heard clean
 *     and a human-timing pad plays as silence. It still DECAYS.
 *   - TONAL AND NARROW, OR IT IS NOT HEARD. ⚓ Measured at the DPS dummy (Nate
 *     2026-09-29): every voice carried over the game's audio and a drum kit did
 *     not — Genshin's SFX are broadband noise, and a hit is camouflaged by its
 *     own kind. The non-melodic option is a METRONOME: one pitch, the length
 *     rule carrying the meaning.
 *   - A SWAP IS THE ONE SOUND THAT IS NOT STRUCK. ⚓ Nate: two hits confused,
 *     a slide was tolerable, a hum is "by far the best." A swap is a transition
 *     rather than a beat, and the hum says so by breaking the rule above on
 *     purpose: a slow attack, no click, held for the swap's length.
 *   - THE COUNT-IN STAYS OUTSIDE THE INPUT VOCABULARY: a plain sine on a step
 *     the three notes do not use.
 *
 * ⚓ KEY AND REGISTER ARE PER VOICE; THE STEPS ARE SHARED. The sets never sound
 * together, so nothing binds them to one key — but which step means which role
 * is a setting the reader changes, never the voice, so the contour learnt on
 * one voice transfers. What moves per voice is the OCTAVE (a marimba's warmth
 * is below 500 Hz, a music box lives high) and the MODE (a handpan is almost
 * always tuned minor). All on A, major or minor pentatonic — ⚓ pentatonic
 * because the scale has no semitone neighbours, so any two notes overlapping
 * (a skill's tail under the burst) are consonant.
 *
 * ⚠️ Gains are normalised BY EAR, not by number: a 440 Hz tone needs
 * noticeably more gain than a 1.7 kHz one to sound as loud.
 */

import type { CueKind } from './cues';

// ── Sets ──────────────────────────────────────────────────────────────────

/** The pitched voices. */
export type VoiceId = 'kalimba' | 'epiano' | 'musicbox' | 'handpan' | 'marimba' | 'vibraphone';
export const VOICE_IDS: readonly VoiceId[] = [
	'kalimba',
	'epiano',
	'musicbox',
	'handpan',
	'marimba',
	'vibraphone'
];
export const VOICE_LABELS: Record<VoiceId, string> = {
	kalimba: 'Kalimba',
	epiano: 'E-piano',
	musicbox: 'Music box',
	handpan: 'Handpan',
	marimba: 'Marimba',
	vibraphone: 'Vibraphone'
};
/** The Settings' first choice: a metronome, or a melodic voice. */
export type SoundMode = 'metronome' | 'melodic';
export const SOUND_MODES: readonly SoundMode[] = ['metronome', 'melodic'];
export const SOUND_MODE_LABELS: Record<SoundMode, string> = {
	metronome: 'Metronome',
	melodic: 'Melodic'
};
/** What actually plays: the metronome, or one voice. */
export type SoundSet = 'metronome' | VoiceId;
export const SOUND_SETS: readonly SoundSet[] = ['metronome', ...VOICE_IDS];

export type Tuning = {
	/** Octaves from the reference (A4 = 440 as the root). */
	octave: number;
	mode: 'major' | 'minor';
	/** Scales every base length — a vibraphone's floor is longer than a tine's. */
	durScale?: number;
	/** ONE pitch for every input, in Hz: the metronome. The steps then say
	 *  nothing about pitch and the length rule carries all the meaning. */
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

// ── Steps, orders, note sets, swaps ───────────────────────────────────────

/**
 * Scale STEPS of the pentatonic, 1 = the root, 6 = the octave, on up to 9.
 * Resolved per mode: major A B C♯ E F♯, minor A C D E G.
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

/** Which role sits low, mid and high (⚓ Nate 2026-09-29). */
export type OrderId = 'weighty' | 'skillUp' | 'rising';
export const ORDER_IDS: readonly OrderId[] = ['weighty', 'skillUp', 'rising'];
type Slot = 'low' | 'mid' | 'high';
export const ORDERS: Record<OrderId, { attack: Slot; skill: Slot; burst: Slot }> = {
	/** The heavier the input, the lower: attacks high, skill mid, burst low. */
	weighty: { attack: 'high', skill: 'mid', burst: 'low' },
	/** The frequent event in the middle; the skill announces itself. */
	skillUp: { attack: 'mid', skill: 'high', burst: 'low' },
	/** The heavier the input, the higher. */
	rising: { attack: 'low', skill: 'mid', burst: 'high' }
};
export const ORDER_LABELS: Record<OrderId, string> = {
	weighty: 'Weighty',
	skillUp: 'Skill up',
	rising: 'Rising'
};

/**
 * Which three steps the three roles take (⚓ Nate 2026-09-29: 1-2-5, 2-5-6,
 * 2-3-5), ascending, with the cancel tick placed above them and the count-in on
 * a step they leave free.
 */
export type NoteSetId = '125' | '256' | '235';
export const NOTE_SET_IDS: readonly NoteSetId[] = ['125', '256', '235'];
export const NOTE_SETS: Record<
	NoteSetId,
	{ steps: [Step, Step, Step]; cancel: Step; count: Step }
> = {
	'125': { steps: [1, 2, 5], cancel: 6, count: 4 },
	'256': { steps: [2, 5, 6], cancel: 7, count: 4 },
	'235': { steps: [2, 3, 5], cancel: 6, count: 4 }
};
export const NOTE_SET_LABELS: Record<NoteSetId, string> = {
	'125': '1 · 2 · 5',
	'256': '2 · 5 · 6',
	'235': '2 · 3 · 5'
};

/**
 * How the swap hums (⚓ Nate 2026-09-29: "demo a few different hum options").
 * Every one attacks slowly, has no click, and is held for the swap's length.
 */
export type SwapStyle = 'humLow' | 'humFifth' | 'humBreath' | 'humRise';
export const SWAP_STYLES: readonly SwapStyle[] = ['humLow', 'humFifth', 'humBreath', 'humRise'];
export const SWAP_STYLE_LABELS: Record<SwapStyle, string> = {
	humLow: 'Low',
	humFifth: 'Fifth',
	humBreath: 'Breath',
	humRise: 'Rise'
};

/** What the voice, the order, the note set and the swap together select. */
export type SoundChoice = { set: SoundSet; order: OrderId; notes: NoteSetId; swap: SwapStyle };

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
	/** Glide the pitch by this ratio over the input's length. */
	slide?: number;
	/** Attack in seconds, when a layer is deliberately NOT struck (the hum).
	 *  Default `ATTACK_S`. */
	attack?: number;
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
/** A noise layer: white noise through a bandpass. The click at an onset; the
 *  breath of a hum. */
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
/** A hum's attack: slow enough to be heard as not struck. */
const HUM_ATTACK_S = 0.04;
/** A sustained layer lets go this long before the input ends. */
export const RELEASE_S = 0.02;
/** No sustained layer rings past this, however long the hold. */
export const MAX_RING_S = 4;
/** How long a slide takes when the cue carries no length. */
const SLIDE_FALLBACK_S = 0.12;

// ── Voices ────────────────────────────────────────────────────────────────

/** A voice: how one note of `freq` sounds, ringing `dur` at `gain`. */
type Voice = (freq: number, dur: number, gain: number) => Layer[];

/** The whisper of click at a note's onset, so the beat is placeable. */
const click: Layer = { kind: 'noise', freq: 4500, q: 1, dur: 0.004, gain: 0.12 };

/** Metronome: a woodblock's ping — a bright fundamental with a fast dip, a
 *  short second partial — that RINGS for the input, so a burst is a long tick
 *  and a normal a short one. One pitch; the length is the whole message. */
const metronome: Voice = (freq, dur, gain) => [
	{ kind: 'tone', freq: [freq * 1.06, freq], glide: 0.012, dur, wave: 'sine', gain, sustain: true },
	{ kind: 'tone', freq: freq * 2.4, dur: 0.03, wave: 'sine', gain: gain * 0.3 },
	click
];

/** Kalimba: the fundamental and a second partial that dies sooner — a real
 *  tine's is a few cents SHARP of the octave (×2.03), which is the life in it. */
const kalimba: Voice = (freq, dur, gain) => [
	{ kind: 'tone', freq, dur, wave: 'sine', gain, sustain: true },
	{
		kind: 'tone',
		freq: freq * 2.03,
		dur: dur * 0.4,
		wave: 'sine',
		gain: gain * 0.28,
		sustain: true
	},
	click
];

/** Electric piano: the two things a Rhodes is — a body (modulator at the
 *  carrier's pitch, depth settling over ~150 ms) and the TINE, a second
 *  operator fourteen times up that rings for a few ms and gives the strike its
 *  "ting". A plain sine carries the hold. Lives an octave down (SET_TUNING). */
const epiano: Voice = (freq, dur, gain) => [
	{
		kind: 'fm',
		freq,
		ratio: 1,
		index: 1.4,
		indexDecay: 0.15,
		dur,
		gain: gain * 0.7,
		sustain: true
	},
	{ kind: 'fm', freq, ratio: 14, index: 0.9, indexDecay: 0.035, dur: 0.05, gain: gain * 0.3 },
	{ kind: 'tone', freq, dur, wave: 'sine', gain: gain * 0.5, sustain: true },
	click
];

/** Music box: a bright tine with two INHARMONIC partials (a steel comb's),
 *  short. An octave UP (SET_TUNING): a music box is a high instrument. */
const musicbox: Voice = (freq, dur, gain) => [
	{ kind: 'tone', freq, dur, wave: 'sine', gain, sustain: true },
	{
		kind: 'tone',
		freq: freq * 2.76,
		dur: dur * 0.5,
		wave: 'sine',
		gain: gain * 0.35,
		sustain: true
	},
	{ kind: 'tone', freq: freq * 5.4, dur: dur * 0.25, wave: 'sine', gain: gain * 0.15 },
	click
];

/** Handpan: fundamental, octave and fifth in a 1:2:3 stack, and a small pitch
 *  dip on the strike (the shell flexing). Round and mellow; MINOR and an octave
 *  down (SET_TUNING), as the instrument is almost always tuned. */
const handpan: Voice = (freq, dur, gain) => [
	{ kind: 'tone', freq: [freq * 1.015, freq], glide: 0.03, dur, wave: 'sine', gain, sustain: true },
	{ kind: 'tone', freq: freq * 2, dur: dur * 0.8, wave: 'sine', gain: gain * 0.4, sustain: true },
	{ kind: 'tone', freq: freq * 3, dur: dur * 0.5, wave: 'sine', gain: gain * 0.22, sustain: true },
	click
];

/** Marimba: a woody bar — the fundamental with a strong FOURTH harmonic (the
 *  tuned bar's signature), short and dry. An octave down (SET_TUNING): at the
 *  reference register it was a xylophone, and the fourth harmonic keeps every
 *  note present on a phone speaker with the fundamental at 220 Hz. */
const marimba: Voice = (freq, dur, gain) => [
	{ kind: 'tone', freq, dur, wave: 'sine', gain, sustain: true },
	{ kind: 'tone', freq: freq * 4, dur: dur * 0.35, wave: 'sine', gain: gain * 0.4, sustain: true },
	{ kind: 'tone', freq: freq * 10, dur: 0.015, wave: 'sine', gain: gain * 0.12 },
	click
];

/** Vibraphone, motor off: the marimba's bar in metal — the fourth harmonic
 *  SUSTAINS instead of dying, with a faint shimmer on top. The instrument
 *  built for holding a note, so the length rule shows best here; its floors
 *  are longer (SET_TUNING.durScale). */
const vibraphone: Voice = (freq, dur, gain) => [
	{ kind: 'tone', freq, dur, wave: 'sine', gain, sustain: true },
	{ kind: 'tone', freq: freq * 4, dur: dur * 0.9, wave: 'sine', gain: gain * 0.3, sustain: true },
	{
		kind: 'tone',
		freq: freq * 10,
		dur: dur * 0.25,
		wave: 'sine',
		gain: gain * 0.06,
		sustain: true
	},
	click
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

// ── The hums ──────────────────────────────────────────────────────────────

/** The hum's home: an octave under the three notes' lowest. */
function hums(low: number): Record<SwapStyle, Layer[]> {
	const soft = (freq: number, gain: number, extra: Partial<Common> = {}): Layer => ({
		kind: 'tone',
		freq,
		dur: 0.12,
		wave: 'sine',
		gain,
		sustain: true,
		attack: HUM_ATTACK_S,
		...extra
	});
	return {
		/** A soft sine an octave under, with its octave above it so a phone
		 *  speaker still carries it. */
		humLow: [soft(low / 2, 0.5), soft(low, 0.18)],
		/** The same with a fifth on top: a soft open dyad. */
		humFifth: [soft(low / 2, 0.45), soft((low / 2) * 1.5, 0.3), soft(low, 0.12)],
		/** No pitch at all: a breath of band-limited noise swelling in — the
		 *  one non-tonal sound, kept mid-band so the game's mix does not eat it. */
		humBreath: [
			{ kind: 'noise', freq: 1600, q: 0.6, dur: 0.14, gain: 0.55, sustain: true, attack: 0.06 }
		],
		/** The low hum bending gently up a fifth over the swap — the slide's
		 *  motion with the hum's manners. */
		humRise: [soft(low / 2, 0.5, { slide: 1.5 }), soft(low, 0.16, { slide: 1.5 })]
	};
}

// ── Palettes ──────────────────────────────────────────────────────────────

/**
 * A palette for one choice: the note set's three steps sorted low → high, the
 * order deciding which role takes which; the cancel tick on the note set's
 * step above them; the count-in on its free step in a plain sine; the plunge a
 * long attack note (it always follows a jump's tick, and "tick, then a long
 * attack" is a plunge); the swap the chosen hum. A mono voice takes its one
 * pitch for every role.
 */
function paletteOf(choice: SoundChoice): Record<CueKind, Layer[]> {
	const t = SET_TUNING[choice.set];
	const note = VOICES[choice.set];
	const set = NOTE_SETS[choice.notes];
	const order = ORDERS[choice.order];
	const d = t.durScale ?? 1;
	const hz = (step: Step) => t.mono ?? stepHz(t, step);
	const steps = [...set.steps].sort((a, b) => a - b) as [Step, Step, Step];
	const slot: Record<Slot, number> = { low: hz(steps[0]), mid: hz(steps[1]), high: hz(steps[2]) };
	const attack = slot[order.attack];
	const skill = slot[order.skill];
	const burst = slot[order.burst];
	return {
		count: [
			{
				kind: 'tone',
				freq: t.mono ? t.mono * 0.667 : hz(set.count),
				dur: 0.12,
				wave: 'sine',
				gain: 0.45
			}
		],
		normal: note(attack, 0.07 * d, 0.42),
		charged: note(attack, 0.16 * d, 0.4),
		plunge: note(attack, 0.18 * d, 0.48),
		skill: note(skill, 0.12 * d, 0.5),
		burst: note(burst, 0.25 * d, 0.62),
		movement: note(hz(set.cancel), 0.035 * d, 0.32),
		swap: hums(t.mono ?? slot.low)[choice.swap]
	};
}

const paletteCache = new Map<string, Record<CueKind, Layer[]>>();
/** The palette for a choice, built once. */
export function paletteFor(choice: SoundChoice): Record<CueKind, Layer[]> {
	const key = `${choice.set}/${choice.order}/${choice.notes}/${choice.swap}`;
	let p = paletteCache.get(key);
	if (!p) {
		p = paletteOf(choice);
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
	{ kind: 'swap', at: 2.06, dur: 0.2 }
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
	play(kind: CueKind, at: number, choice: SoundChoice, dur?: number): void;
	/** Play the preview phrase now. */
	preview(choice: SoundChoice): void;
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

	function envelope(at: number, dur: number, peak: number, attack = ATTACK_S): GainNode {
		const env = ctx.createGain();
		env.gain.setValueAtTime(0, at);
		env.gain.linearRampToValueAtTime(peak, at + attack);
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

	/** Pitch a param at `f`, with the layer's own glide and then its slide. */
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
			const env = envelope(at, dur, peak, l.attack);
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
			const env = envelope(at, dur, peak, l.attack);
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
			const env = envelope(at, dur, peak, l.attack);
			src.connect(band);
			band.connect(env);
			track([src], at, dur, band, env);
		}
	}

	return {
		ctx,
		play(kind, at, choice, dur = 0) {
			const trim = SET_TRIM[choice.set];
			for (const l of paletteFor(choice)[kind]) layer(l, at, trim, dur);
		},
		preview(choice) {
			const at0 = ctx.currentTime + 0.05;
			for (const step of PREVIEW_PHRASE) this.play(step.kind, at0 + step.at, choice, step.dur);
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
