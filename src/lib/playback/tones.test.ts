import { describe, expect, it } from 'vitest';
import {
	MAX_RING_S,
	NOTE_SETS,
	NOTE_SET_IDS,
	NOTE_SET_LABELS,
	ORDER_IDS,
	ORDER_LABELS,
	PREVIEW_PHRASE,
	RELEASE_S,
	SET_TRIM,
	SET_TUNING,
	SOUND_SETS,
	SWAP_STYLES,
	SWAP_STYLE_LABELS,
	VOICE_IDS,
	VOICE_LABELS,
	paletteFor,
	ringFor,
	noteHz,
	NOTE_CANCEL,
	NOTE_LOW,
	type Layer,
	type SoundChoice
} from './tones';
import type { CueKind } from './cues';

const KINDS: CueKind[] = [
	'count',
	'normal',
	'charged',
	'plunge',
	'skill',
	'burst',
	'movement',
	'swap'
];
const end = (l: Layer) => (l.delay ?? 0) + l.dur;
type Pitched = Extract<Layer, { kind: 'tone' | 'fm' }>;
const isPitched = (l: Layer): l is Pitched => l.kind === 'tone' || l.kind === 'fm';
const settle = (l: Pitched) => (Array.isArray(l.freq) ? l.freq[1] : l.freq);
const choice = (over: Partial<SoundChoice> = {}): SoundChoice => ({
	set: 'kalimba',
	order: 'weighty',
	notes: 'open',
	swap: 'humLow',
	...over
});
const fundamental = (c: SoundChoice, kind: CueKind) => {
	const l = paletteFor(c)[kind].find(isPitched);
	return l ? settle(l) : null;
};
const PITCHED_SETS = SOUND_SETS.filter((s) => SET_TUNING[s].mono === undefined);

describe('the sound palettes', () => {
	it('every set voices every cue kind under every order, note set and swap', () => {
		for (const set of SOUND_SETS)
			for (const order of ORDER_IDS)
				for (const notes of NOTE_SET_IDS)
					for (const swap of SWAP_STYLES)
						for (const kind of KINDS)
							expect(paletteFor(choice({ set, order, notes, swap }))[kind].length).toBeGreaterThan(
								0
							);
	});

	it('base lengths stay short enough for the fastest pair of presses; only a burst may ring', () => {
		for (const set of SOUND_SETS) {
			const scale = SET_TUNING[set].durScale ?? 1;
			for (const kind of KINDS) {
				const longest = Math.max(...paletteFor(choice({ set }))[kind].map(end));
				const cap = (kind === 'burst' || kind === 'plunge' ? 0.26 : 0.16) * scale;
				expect(longest, `${set}.${kind}`).toBeLessThanOrEqual(cap);
			}
		}
	});

	it("the three roles take A and the note set's two notes in the order's arrangement", () => {
		for (const set of PITCHED_SETS) {
			for (const notes of NOTE_SET_IDS) {
				const n = NOTE_SETS[notes];
				const [lo, mid, hi] = [NOTE_LOW, n.mid, n.high].map(noteHz);
				const f = (order: (typeof ORDER_IDS)[number], kind: CueKind) =>
					fundamental(choice({ set, notes, order }), kind)!;
				expect([f('weighty', 'burst'), f('weighty', 'skill'), f('weighty', 'normal')]).toEqual([
					lo,
					mid,
					hi
				]);
				expect([f('skillUp', 'burst'), f('skillUp', 'normal'), f('skillUp', 'skill')]).toEqual([
					lo,
					mid,
					hi
				]);
				expect([f('rising', 'normal'), f('rising', 'skill'), f('rising', 'burst')]).toEqual([
					lo,
					mid,
					hi
				]);
				// a charged attack and a plunge are the attack's note, longer
				expect(f('weighty', 'charged')).toBe(hi);
				expect(f('weighty', 'plunge')).toBe(hi);
				// the same notes on every voice: A4 at the bottom
				expect(lo).toBe(440);
			}
		}
	});

	it('the cancel tick is A5 on top and the count-in a free note inside the span', () => {
		for (const notes of NOTE_SET_IDS) {
			const n = NOTE_SETS[notes];
			expect(NOTE_CANCEL).toBeGreaterThan(n.high);
			expect([NOTE_LOW, n.mid, n.high, NOTE_CANCEL].includes(n.count)).toBe(false);
			expect(n.count).toBeGreaterThan(NOTE_LOW);
			expect(n.count).toBeLessThan(NOTE_CANCEL);
			expect(fundamental(choice({ notes }), 'movement')).toBe(880);
		}
	});

	it('the metronome is one pitch for every role', () => {
		for (const order of ORDER_IDS)
			for (const notes of NOTE_SET_IDS) {
				const c = choice({ set: 'metronome', order, notes });
				const pitches = new Set(
					KINDS.filter((k) => k !== 'count' && k !== 'swap').map((k) => fundamental(c, k))
				);
				expect([...pitches]).toEqual([SET_TUNING.metronome.mono!]);
			}
	});

	it('every pitched voice stays on A B D E F♯ between A4 and A5', () => {
		const partials = [1, 2, 2.03, 2.76, 3, 4, 5.4, 10];
		const scale = [0, 2, 5, 7, 9, 12].map((st) => 440 * Math.pow(2, st / 12));
		for (const set of PITCHED_SETS)
			for (const notes of NOTE_SET_IDS)
				for (const kind of KINDS) {
					if (kind === 'swap') continue;
					for (const l of paletteFor(choice({ set, notes }))[kind]) {
						if (!isPitched(l)) continue;
						const f = settle(l);
						expect(
							scale.some((n) => partials.some((m) => Math.abs(f - m * n) < 0.05)),
							`${set}/${notes}.${kind} ${f}`
						).toBe(true);
					}
				}
	});

	it('every hum is the one sound not struck: slow attack, no click, held, one onset', () => {
		for (const set of SOUND_SETS)
			for (const swap of SWAP_STYLES) {
				const p = paletteFor(choice({ set, swap }));
				expect(
					p.swap.every((l) => (l.attack ?? 0) >= 0.03),
					`${set}/${swap}`
				).toBe(true);
				expect(
					p.swap.every((l) => l.sustain === true),
					`${set}/${swap}`
				).toBe(true);
				expect(
					p.swap.every((l) => !l.delay),
					`${set}/${swap}`
				).toBe(true);
				expect(
					p.swap.some((l) => l.kind === 'noise' && l.dur < 0.01),
					`${set}/${swap}`
				).toBe(false);
			}
		expect(paletteFor(choice({ swap: 'humRise' })).swap.some((l) => l.slide === 1.5)).toBe(true);
		// the swap style changes the swap alone
		for (const kind of KINDS)
			if (kind !== 'swap')
				expect(paletteFor(choice({ swap: 'humFifth' }))[kind]).toEqual(paletteFor(choice())[kind]);
	});

	it('every voice sustains, and the count-in never does', () => {
		for (const set of SOUND_SETS) {
			const p = paletteFor(choice({ set }));
			expect(
				KINDS.some((k) => p[k].some((l) => l.sustain === true)),
				set
			).toBe(true);
			expect(
				p.count.some((l) => l.sustain),
				set
			).toBe(false);
		}
	});

	it('the vocabulary: six voices, three orders, four note sets, three hums, all named', () => {
		expect(VOICE_IDS).toHaveLength(6);
		expect(ORDER_IDS).toHaveLength(3);
		expect(NOTE_SET_IDS).toHaveLength(4);
		expect(SWAP_STYLES).toHaveLength(3);
		for (const v of VOICE_IDS) expect(VOICE_LABELS[v]).toBeTruthy();
		for (const o of ORDER_IDS) expect(ORDER_LABELS[o]).toBeTruthy();
		for (const n of NOTE_SET_IDS) expect(NOTE_SET_LABELS[n]).toBeTruthy();
		for (const s of SWAP_STYLES) expect(SWAP_STYLE_LABELS[s]).toBeTruthy();
		for (const s of SOUND_SETS) expect(SET_TRIM[s]).toBeGreaterThan(0);
	});

	it('the preview phrase is ordered and under three seconds', () => {
		for (let i = 1; i < PREVIEW_PHRASE.length; i++)
			expect(PREVIEW_PHRASE[i].at).toBeGreaterThan(PREVIEW_PHRASE[i - 1].at);
		expect(PREVIEW_PHRASE.at(-1)!.at).toBeLessThan(3);
	});

	it('a sustained layer rings for the input less the release, floored and capped', () => {
		expect(ringFor(0.25, 0)).toBe(0.25);
		expect(ringFor(0.25, 0.1)).toBe(0.25);
		expect(ringFor(0.25, 2)).toBeCloseTo(2 - RELEASE_S, 9);
		expect(ringFor(0.25, 30)).toBe(MAX_RING_S);
	});
});
