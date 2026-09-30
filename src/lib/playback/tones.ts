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
 * mid, high) and the NOTE SET (which two notes join A at the bottom); the cancel
 * tick is A5 and the count-in a free note of the set.
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
 * ⚓ ONE OCTAVE, EVERY VOICE. A4 is the bottom of every note set and A5 the
 * cancel tick on top; the two notes between are the set's choice, all drawn
 * from A B D E F♯ — D major pentatonic, which has no semitone neighbours, so any
 * two notes overlapping (a skill's tail under the burst) are consonant. Every
 * voice plays the same notes, a material in its own register; only the timbre
 * changes.
 *
 * ⚠️ Gains are normalised BY EAR, not by number: a 440 Hz tone needs
 * noticeably more gain than a 1.7 kHz one to sound as loud.
 */

import type { CueKind } from './cues';

// ── Sets ──────────────────────────────────────────────────────────────────

/**
 * The pitched voices — five MATERIALS (⚓ Nate 2026-09-29: "I like when it
 * sounds like an actual material being struck"; kalimba and handpan struck as
 * the least differentiated and most synthetic; the e-piano retargeted to the
 * pipe it already sounded like; the music box to the muted bell it already
 * sounded like). Wood, muted metal, sustained metal, a hollow tube, glass.
 */
export type VoiceId = 'marimba' | 'bell' | 'vibraphone' | 'pipe' | 'glass';
export const VOICE_IDS: readonly VoiceId[] = ['marimba', 'bell', 'vibraphone', 'pipe', 'glass'];
export const VOICE_LABELS: Record<VoiceId, string> = {
	marimba: 'Marimba',
	bell: 'Bell',
	vibraphone: 'Vibraphone',
	pipe: 'Pipe',
	glass: 'Glass'
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
	/** Octaves from the notes' reference (A4 at the bottom). ⚓ The NOTES are the
	 *  same on every voice (Nate 2026-09-29); a material may play them in its
	 *  own register — a marimba's warmth and a pipe's hollowness are below
	 *  500 Hz, and at A4 both sounded like metal. */
	octave: number;
	/** Scales every base length — a vibraphone's floor is longer than wood's. */
	durScale?: number;
	/** ONE pitch for every input, in Hz: the metronome. The note set then says
	 *  nothing about pitch and the length rule carries all the meaning. */
	mono?: number;
};
export const SET_TUNING: Record<SoundSet, Tuning> = {
	metronome: { octave: 0, mono: 1175 },
	marimba: { octave: -1 },
	bell: { octave: 0 },
	vibraphone: { octave: 0, durScale: 1.8 },
	pipe: { octave: -1 },
	glass: { octave: 0 }
};

// ── Notes, orders, note sets, swaps ──────────────────────────────────────

/**
 * A note as semitones above A4, the bottom of the octave every set lives in
 * (⚓ Nate 2026-09-29: "A as the bottom note and A as the top cancel-type-input
 * note — that octave framing works very well"). The notes he chose are all in A
 * major and together make the D major pentatonic: A B D E F♯, with A5 on top.
 */
export type Note = 0 | 2 | 5 | 7 | 9 | 12;
export const NOTE_NAMES: Record<Note, string> = {
	0: 'A',
	2: 'B',
	5: 'D',
	7: 'E',
	9: 'F♯',
	12: 'A'
};
export function noteHz(n: Note, octave = 0): number {
	return 440 * Math.pow(2, octave + n / 12);
}
/** The bottom of every set, and the cancel tick on top: the octave's frame. */
export const NOTE_LOW: Note = 0;
export const NOTE_CANCEL: Note = 12;

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
/** "Burst low · skill middle · attacks high" — an order spelled out, bottom
 *  up, for the Settings hint. Derived from `ORDERS`, so it cannot drift. */
export function orderHint(id: OrderId): string {
	const o = ORDERS[id];
	const word: Record<Slot, string> = { low: 'low', mid: 'middle', high: 'high' };
	const rank: Record<Slot, number> = { low: 0, mid: 1, high: 2 };
	return (
		[
			['attacks', o.attack],
			['skill', o.skill],
			['burst', o.burst]
		] as const
	)
		.slice()
		.sort((a, b) => rank[a[1]] - rank[b[1]])
		.map(
			([role, slot], i) => `${i === 0 ? role[0].toUpperCase() + role.slice(1) : role} ${word[slot]}`
		)
		.join(' · ');
}

/**
 * The four note sets Nate chose at a keyboard (2026-09-29), each A plus two
 * notes, named for how they sit. The count-in takes a free note inside the
 * span, in a plain sine. Which role gets which note is the ORDER's business.
 */
export type NoteSetId = 'open' | 'anchor' | 'lantern' | 'meadow';
export const NOTE_SET_IDS: readonly NoteSetId[] = ['open', 'anchor', 'lantern', 'meadow'];
export const NOTE_SETS: Record<NoteSetId, { mid: Note; high: Note; count: Note }> = {
	/** A · B · E — a second and a fifth, the suspended, unresolved sound: airy,
	 *  modern, nothing leaning anywhere. Count on D. */
	open: { mid: 2, high: 7, count: 5 },
	/** A · D · E — a fourth and a fifth, the oldest cadence there is: grounded,
	 *  a horn call, a gong. Count on B. */
	anchor: { mid: 5, high: 7, count: 2 },
	/** A · B · F♯ — a second and a sixth: the sixth leans toward F♯ minor and
	 *  makes it wistful, a lullaby in a lit window. Count on D. */
	lantern: { mid: 2, high: 9, count: 5 },
	/** A · E · F♯ — a fifth and a sixth, the pastoral added-sixth: bright,
	 *  folk, a morning field. Count on D. */
	meadow: { mid: 7, high: 9, count: 5 }
};
export const NOTE_SET_LABELS: Record<NoteSetId, string> = {
	open: 'Open',
	anchor: 'Anchor',
	lantern: 'Lantern',
	meadow: 'Meadow'
};
/** "A · B · E" — the notes, for the Settings hint. */
export function noteSetNotes(id: NoteSetId): string {
	const n = NOTE_SETS[id];
	return [NOTE_LOW, n.mid, n.high].map((x) => NOTE_NAMES[x]).join(' · ');
}

/**
 * How the swap hums (⚓ Nate 2026-09-29: "demo a few different hum options";
 * the breath of noise was struck). Every one attacks slowly, has no click, and
 * is held for the swap's length. ⚓ `off` (Nate 2026-09-30) voices nothing: a
 * swap is also heard as the gap before the next character's first note.
 */
export type SwapStyle = 'off' | 'humLow' | 'humFifth' | 'humRise';
export const SWAP_STYLES: readonly SwapStyle[] = ['off', 'humLow', 'humFifth', 'humRise'];
export const SWAP_STYLE_LABELS: Record<SwapStyle, string> = {
	off: 'Off',
	humLow: 'Low',
	humFifth: 'Fifth',
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
	/** A sustained partial's share of the ring — ⚓ the organic rule: damping
	 *  rises with frequency, so an upper partial dies sooner than the
	 *  fundamental on a long hold too, not only on a short one. */
	ringScale?: number;
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

/**
 * A MATERIAL: partials as ratios of the note, each with its own gain, its own
 * base length as a share of the note's, and its own share of a long ring —
 * the fundamental longest, every partial above it shorter, so the tail sounds
 * like something vibrating rather than an oscillator (⚓ the advice Nate
 * brought, 2026-09-29, which was right: staggered envelopes are most of the
 * difference between synthesised and synthetic). Plus the material's own
 * transient: wood thuds, metal tings, glass chimes, a pipe thocks.
 */
type PartialTone = { ratio: number; gain: number; dur: number; ring: number };
type Material = {
	partials: PartialTone[];
	/** The strike: band-limited noise, centred where the material speaks. */
	transient: { freq: number; q: number; dur: number; gain: number };
};

function strike(m: Material): Voice {
	return (freq, dur, gain) => [
		...m.partials.map(
			(p): Layer => ({
				kind: 'tone',
				freq: freq * p.ratio,
				dur: dur * p.dur,
				wave: 'sine',
				gain: gain * p.gain,
				sustain: true,
				ringScale: p.ring
			})
		),
		{
			kind: 'noise',
			freq: m.transient.freq,
			q: m.transient.q,
			dur: m.transient.dur,
			gain: m.transient.gain
		}
	];
}

/** Metronome: a woodblock's ping — a bright fundamental with a fast dip, a
 *  short second partial — that RINGS for the input, so a burst is a long tick
 *  and a normal a short one. One pitch; the length is the whole message. */
const metronome: Voice = (freq, dur, gain) => [
	{ kind: 'tone', freq: [freq * 1.06, freq], glide: 0.012, dur, wave: 'sine', gain, sustain: true },
	{ kind: 'tone', freq: freq * 2.4, dur: 0.03, wave: 'sine', gain: gain * 0.3 },
	{ kind: 'noise', freq: 4500, q: 1, dur: 0.004, gain: 0.12 }
];

/** Wood: a rosewood bar, an octave down. The tuned bar's partials sit near
 *  ×4 and ×10 (a real marimba's are tuned to them), the upper two dying fast;
 *  the strike is a low thud, the mallet's felt on wood. */
const marimba = strike({
	partials: [
		{ ratio: 1, gain: 1, dur: 1, ring: 1 },
		{ ratio: 3.93, gain: 0.45, dur: 0.3, ring: 0.35 },
		{ ratio: 9.5, gain: 0.15, dur: 0.1, ring: 0.12 }
	],
	transient: { freq: 900, q: 1.2, dur: 0.012, gain: 0.28 }
});

/** Muted metal: a small bell with its damper touching — a bell's inharmonic
 *  partials (×2.76, ×5.4, ×8.9), each shorter than the last, and a bright
 *  ting for the strike. */
const bell = strike({
	partials: [
		{ ratio: 1, gain: 1, dur: 1, ring: 1 },
		{ ratio: 2.76, gain: 0.5, dur: 0.6, ring: 0.6 },
		{ ratio: 5.4, gain: 0.25, dur: 0.35, ring: 0.35 },
		{ ratio: 8.93, gain: 0.12, dur: 0.2, ring: 0.2 }
	],
	transient: { freq: 5000, q: 1, dur: 0.004, gain: 0.15 }
});

/** Sustained metal: a vibraphone bar, motor off — the ×4 partial rings on
 *  with the fundamental (it is what makes the bar metal), a ×10 shimmer dies
 *  early. The instrument built for holding a note; longer floors. */
const vibraphone = strike({
	partials: [
		{ ratio: 1, gain: 1, dur: 1, ring: 1 },
		{ ratio: 4, gain: 0.32, dur: 0.8, ring: 0.7 },
		{ ratio: 10, gain: 0.06, dur: 0.3, ring: 0.25 }
	],
	transient: { freq: 3500, q: 1, dur: 0.004, gain: 0.12 }
});

/** A hollow tube struck with a paddle, an octave down: a closed pipe speaks
 *  in ODD harmonics only (×3, ×5, ×7), which is the hollow, plastic-wood
 *  sound Nate heard in the e-piano; the strike is a mid thock. */
const pipe = strike({
	partials: [
		{ ratio: 1, gain: 1, dur: 1, ring: 1 },
		{ ratio: 3, gain: 0.5, dur: 0.5, ring: 0.5 },
		{ ratio: 5, gain: 0.25, dur: 0.3, ring: 0.3 },
		{ ratio: 7, gain: 0.12, dur: 0.2, ring: 0.15 }
	],
	transient: { freq: 650, q: 1, dur: 0.014, gain: 0.35 }
});

/** Glass: a struck glass bar — nearly pure, with glass's inharmonic partials
 *  (×2.32, ×4.25) ringing long and clean, and the faintest, brightest chime
 *  for the strike. The soft, airy option. */
const glass = strike({
	partials: [
		{ ratio: 1, gain: 1, dur: 1, ring: 1 },
		{ ratio: 2.32, gain: 0.35, dur: 0.7, ring: 0.7 },
		{ ratio: 4.25, gain: 0.12, dur: 0.4, ring: 0.4 }
	],
	transient: { freq: 7000, q: 2, dur: 0.003, gain: 0.1 }
});

const VOICES: Record<SoundSet, Voice> = { metronome, marimba, bell, vibraphone, pipe, glass };

/** Per-set trim, so switching sets does not switch loudness. By ear. */
export const SET_TRIM: Record<SoundSet, number> = {
	metronome: 1,
	marimba: 1.15,
	bell: 1,
	vibraphone: 1,
	pipe: 1.1,
	glass: 1.1
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
		off: [],
		/** A soft sine an octave under, with its octave above it so a phone
		 *  speaker still carries it. */
		humLow: [soft(low / 2, 0.5), soft(low, 0.18)],
		/** The same with a fifth on top: a soft open dyad. */
		humFifth: [soft(low / 2, 0.45), soft((low / 2) * 1.5, 0.3), soft(low, 0.12)],
		/** The low hum bending gently up a fifth over the swap — the slide's
		 *  motion with the hum's manners. */
		humRise: [soft(low / 2, 0.5, { slide: 1.5 }), soft(low, 0.16, { slide: 1.5 })]
	};
}

// ── Palettes ──────────────────────────────────────────────────────────────

/**
 * A palette for one choice: A4, the note set's mid and high, the order
 * deciding which role takes which; the cancel tick on A5; the count-in on the
 * set's free note in a plain sine, its last beat an octave up; the plunge a
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
	const hz = (n: Note) => t.mono ?? noteHz(n, t.octave);
	const slot: Record<Slot, number> = { low: hz(NOTE_LOW), mid: hz(set.mid), high: hz(set.high) };
	const attack = slot[order.attack];
	const skill = slot[order.skill];
	const burst = slot[order.burst];
	const countBeat = (octave: number): Layer => ({
		kind: 'tone',
		freq: (t.mono ? t.mono * 0.667 : hz(set.count)) * octave,
		dur: 0.12,
		wave: 'sine',
		gain: 0.45
	});
	return {
		count: [countBeat(1)],
		// The last beat an octave up: the same plain sine, so it is still the
		// count-in, and still outside the input vocabulary (it sits above A5).
		countLast: [countBeat(2)],
		normal: note(attack, 0.07 * d, 0.42),
		charged: note(attack, 0.16 * d, 0.4),
		plunge: note(attack, 0.18 * d, 0.48),
		skill: note(skill, 0.12 * d, 0.5),
		burst: note(burst, 0.25 * d, 0.62),
		movement: note(hz(NOTE_CANCEL), 0.035 * d, 0.32),
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
export function ringFor(base: number, dur: number, share = 1): number {
	if (!(dur > 0)) return base;
	return Math.max(base, Math.min(MAX_RING_S, dur - RELEASE_S) * share);
}

/** ⚓ Nothing real repeats exactly: every strike is detuned by up to this many
 *  cents and varied in level by `HUMAN_GAIN`, the same amount for all of a
 *  cue's partials so they stay one object. Inaudible as tuning; audible as
 *  life. */
export const HUMAN_CENTS = 3;
export const HUMAN_GAIN = 0.06;

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
		inputDur: number,
		detune = 1
	) {
		const start = (Array.isArray(f) ? f[0] : f) * detune;
		const settle = (Array.isArray(f) ? f[1] : f) * detune;
		param.setValueAtTime(start, at);
		if (Array.isArray(f) && l.kind === 'tone') {
			param.exponentialRampToValueAtTime(settle, at + (l.glide ?? l.dur));
		}
		if (l.slide) {
			const over = inputDur > 0 ? inputDur : SLIDE_FALLBACK_S;
			param.exponentialRampToValueAtTime(settle * l.slide, at + over);
		}
	}

	function layer(l: Layer, at0: number, trim: number, inputDur: number, detune = 1) {
		const at = at0 + (l.delay ?? 0);
		const dur = l.sustain ? ringFor(l.dur, inputDur, l.ringScale) : l.dur;
		const peak = l.gain * trim;
		if (l.kind === 'tone') {
			const osc = ctx.createOscillator();
			osc.type = l.wave;
			pitch(osc.frequency, l.freq, l, at, inputDur, detune);
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
			// One detune and one level per strike, shared by its partials.
			const detune = Math.pow(2, ((Math.random() * 2 - 1) * HUMAN_CENTS) / 1200);
			const trim = SET_TRIM[choice.set] * (1 - Math.random() * HUMAN_GAIN);
			for (const l of paletteFor(choice)[kind]) layer(l, at, trim, dur, detune);
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
