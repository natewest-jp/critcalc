import { describe, expect, it } from 'vitest';
import {
	MAX_RING_S,
	MELODIC_SETS,
	PALETTES,
	PREVIEW_PHRASE,
	RELEASE_S,
	SET_TRIM,
	SOUND_SETS,
	SOUND_SET_LABELS,
	ringFor,
	type Layer,
	type SoundSet
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
const end = (l: Layer) => (typeof l.delay === 'number' ? l.delay : 0) + l.dur;

describe('the sound palettes', () => {
	it('every set voices every cue kind', () => {
		for (const set of SOUND_SETS) {
			for (const kind of KINDS)
				expect(PALETTES[set][kind].length, `${set}.${kind}`).toBeGreaterThan(0);
		}
	});

	it('base lengths stay short enough for the fastest pair of presses; only a burst may ring', () => {
		for (const set of SOUND_SETS) {
			for (const kind of KINDS) {
				const longest = Math.max(...PALETTES[set][kind].map(end));
				const cap = kind === 'burst' || kind === 'plunge' ? 0.26 : 0.16;
				expect(longest, `${set}.${kind}`).toBeLessThanOrEqual(cap);
			}
		}
	});

	it('weight rides on contour: a burst sits below a skill, which sits below a normal', () => {
		const fundamental = (set: SoundSet, kind: CueKind) => {
			const tone = PALETTES[set][kind].find(
				(l): l is Extract<Layer, { kind: 'tone' | 'fm' }> => l.kind === 'tone' || l.kind === 'fm'
			);
			if (!tone) return null;
			return Array.isArray(tone.freq) ? tone.freq[1] : tone.freq;
		};
		for (const set of MELODIC_SETS) {
			expect(fundamental(set, 'burst')!, set).toBeLessThan(fundamental(set, 'skill')!);
			expect(fundamental(set, 'skill')!, set).toBeLessThan(fundamental(set, 'normal')!);
		}
		expect(fundamental('percussive', 'burst')!).toBeLessThan(fundamental('percussive', 'skill')!);
	});

	it('every voice lives on A major pentatonic inside an octave and a fifth', () => {
		const scale = [440, 659.25, 739.99, 880, 1108.73];
		const partials = [1, 2, 2.76, 3, 4, 5.4, 10];
		for (const set of MELODIC_SETS) {
			for (const kind of KINDS) {
				for (const l of PALETTES[set][kind]) {
					if (l.kind !== 'tone' && l.kind !== 'fm') continue;
					// A partial is a multiple of its note; a glide lands ON the note.
					const f = Array.isArray(l.freq) ? l.freq[1] : l.freq;
					const inScale = scale.some((n) => partials.some((m) => Math.abs(f - m * n) < 0.01));
					expect(inScale, `${set}.${kind} ${f}`).toBe(true);
				}
			}
		}
	});

	it('six sets, each named and trimmed', () => {
		expect(SOUND_SETS).toHaveLength(6);
		for (const set of SOUND_SETS) {
			expect(SOUND_SET_LABELS[set]).toBeTruthy();
			expect(SET_TRIM[set]).toBeGreaterThan(0);
		}
	});

	it('the preview phrase is ordered and under three seconds', () => {
		for (let i = 1; i < PREVIEW_PHRASE.length; i++)
			expect(PREVIEW_PHRASE[i].at).toBeGreaterThan(PREVIEW_PHRASE[i - 1].at);
		expect(PREVIEW_PHRASE.at(-1)!.at).toBeLessThan(3);
	});

	it('a sustained layer rings for the input less the release, floored and capped', () => {
		expect(ringFor(0.25, 0)).toBe(0.25); // no length known: the base
		expect(ringFor(0.25, 0.1)).toBe(0.25); // shorter than the base: the base
		expect(ringFor(0.25, 2)).toBeCloseTo(2 - RELEASE_S, 9);
		expect(ringFor(0.25, 30)).toBe(MAX_RING_S);
	});

	it('every voice sustains and the kit does not; every swap lands its second note at the arrival', () => {
		const sustains = (set: SoundSet) =>
			KINDS.some((k) => PALETTES[set][k].some((l) => l.sustain === true));
		for (const set of MELODIC_SETS) {
			expect(sustains(set), set).toBe(true);
			expect(
				PALETTES[set].count.some((l) => l.sustain),
				set
			).toBe(false);
		}
		expect(sustains('percussive')).toBe(false);
		for (const set of SOUND_SETS)
			expect(
				PALETTES[set].swap.some((l) => l.delay === 'end'),
				set
			).toBe(true);
	});
});
