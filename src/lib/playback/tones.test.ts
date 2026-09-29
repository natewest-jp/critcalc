import { describe, expect, it } from 'vitest';
import { PALETTES, PREVIEW_PHRASE, SOUND_SETS, type Layer } from './tones';
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

describe('the sound palettes', () => {
	it('every set voices every cue kind', () => {
		for (const set of SOUND_SETS) {
			for (const kind of KINDS)
				expect(PALETTES[set][kind].length, `${set}.${kind}`).toBeGreaterThan(0);
		}
	});

	it('stays short enough for the fastest pair of presses; only a burst may ring', () => {
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

	it('the preview phrase is ordered and under two seconds', () => {
		for (let i = 1; i < PREVIEW_PHRASE.length; i++)
			expect(PREVIEW_PHRASE[i].at).toBeGreaterThan(PREVIEW_PHRASE[i - 1].at);
		expect(PREVIEW_PHRASE.at(-1)!.at).toBeLessThan(2);
	});
});
