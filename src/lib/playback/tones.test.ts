import { describe, expect, it } from 'vitest';
import {
	MAX_RING_S,
	PALETTES,
	PREVIEW_PHRASE,
	RELEASE_S,
	SOUND_SETS,
	ringFor,
	type Layer
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
		const fundamental = (set: 'percussive' | 'melodic', kind: CueKind) => {
			const tone = PALETTES[set][kind].find(
				(l): l is Extract<Layer, { kind: 'tone' }> => l.kind === 'tone'
			);
			if (!tone) return null;
			return Array.isArray(tone.freq) ? tone.freq[0] : tone.freq;
		};
		expect(fundamental('melodic', 'burst')!).toBeLessThan(fundamental('melodic', 'skill')!);
		expect(fundamental('melodic', 'skill')!).toBeLessThan(fundamental('melodic', 'normal')!);
		expect(fundamental('percussive', 'burst')!).toBeLessThan(fundamental('percussive', 'skill')!);
	});

	it('the melodic set lives on A major pentatonic inside an octave and a fifth', () => {
		const scale = [440, 659.25, 739.99, 880, 1108.73];
		for (const kind of KINDS) {
			for (const l of PALETTES.melodic[kind]) {
				if (l.kind !== 'tone') continue;
				const f = Array.isArray(l.freq) ? l.freq[0] : l.freq;
				const inScale = scale.some((n) => Math.abs(f - n) < 0.01 || Math.abs(f - 2 * n) < 0.01);
				expect(inScale, `${kind} ${f}`).toBe(true);
			}
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

	it('only the melodic set sustains, and its swap lands its second note at the arrival', () => {
		const sustains = (set: 'percussive' | 'melodic') =>
			KINDS.some((k) => PALETTES[set][k].some((l) => l.sustain === true));
		expect(sustains('melodic')).toBe(true);
		expect(sustains('percussive')).toBe(false);
		for (const set of SOUND_SETS)
			expect(PALETTES[set].swap.some((l) => l.delay === 'end')).toBe(true);
		expect(PALETTES.melodic.count.some((l) => l.sustain)).toBe(false);
	});
});
