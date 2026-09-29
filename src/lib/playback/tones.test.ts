import { describe, expect, it } from 'vitest';
import {
	ASSIGNMENTS,
	ASSIGNMENT_IDS,
	ASSIGNMENT_LABELS,
	MAX_RING_S,
	PITCHED_SETS,
	PREVIEW_PHRASE,
	RELEASE_S,
	SET_TRIM,
	SET_TUNING,
	SOUND_SETS,
	SOUND_SET_LABELS,
	stepHz,
	paletteFor,
	ringFor,
	type AssignmentId,
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
const end = (l: Layer) => (l.delay ?? 0) + l.dur;
type Pitched = Extract<Layer, { kind: 'tone' | 'fm' }>;
const isPitched = (l: Layer): l is Pitched => l.kind === 'tone' || l.kind === 'fm';
/** The note a pitched layer settles on. */
const settle = (l: Pitched) => (Array.isArray(l.freq) ? l.freq[1] : l.freq);
/** A cue's fundamental: the first pitched layer's note. */
const fundamental = (set: SoundSet, a: AssignmentId, kind: CueKind) => {
	const l = paletteFor(set, a)[kind].find(isPitched);
	return l ? settle(l) : null;
};

describe('the sound palettes', () => {
	it('every set voices every cue kind under every assignment', () => {
		for (const set of SOUND_SETS)
			for (const a of ASSIGNMENT_IDS)
				for (const kind of KINDS)
					expect(paletteFor(set, a)[kind].length, `${set}/${a}.${kind}`).toBeGreaterThan(0);
	});

	it('base lengths stay short enough for the fastest pair of presses; only a burst may ring', () => {
		for (const set of SOUND_SETS) {
			const scale = SET_TUNING[set].durScale ?? 1;
			for (const kind of KINDS) {
				const longest = Math.max(...paletteFor(set, 'weight')[kind].map(end));
				const cap = (kind === 'burst' || kind === 'plunge' ? 0.26 : 0.16) * scale;
				expect(longest, `${set}.${kind}`).toBeLessThanOrEqual(cap);
			}
		}
	});

	it('the weight assignment puts a burst below a skill below a normal; rising inverts it', () => {
		for (const set of PITCHED_SETS) {
			expect(fundamental(set, 'weight', 'burst')!, set).toBeLessThan(
				fundamental(set, 'weight', 'skill')!
			);
			expect(fundamental(set, 'weight', 'skill')!, set).toBeLessThan(
				fundamental(set, 'weight', 'normal')!
			);
			expect(fundamental(set, 'rising', 'normal')!, set).toBeLessThan(
				fundamental(set, 'rising', 'skill')!
			);
			expect(fundamental(set, 'rising', 'skill')!, set).toBeLessThan(
				fundamental(set, 'rising', 'burst')!
			);
		}
	});

	it('the metronome is one pitch for every input', () => {
		for (const a of ASSIGNMENT_IDS) {
			const notes = new Set(
				KINDS.filter((k) => k !== 'count').map((k) => fundamental('metronome', a, k))
			);
			expect([...notes], a).toEqual([SET_TUNING.metronome.mono!]);
		}
	});

	it("every pitched voice lives on its pentatonic, in its own octave and the assignment's mode", () => {
		const partials = [1, 2, 2.03, 2.76, 3, 4, 5.4, 10];
		for (const set of PITCHED_SETS) {
			for (const id of ASSIGNMENT_IDS) {
				const t = SET_TUNING[set];
				const a = 440 * Math.pow(2, t.octave);
				const mode = ASSIGNMENTS[id].mode ?? t.mode;
				const semis =
					mode === 'major' ? [0, 2, 4, 7, 9, 12, 14, 16, 19] : [0, 3, 5, 7, 10, 12, 15, 17, 19];
				const scale = semis.map((st) => a * Math.pow(2, st / 12));
				for (const kind of KINDS) {
					for (const l of paletteFor(set, id)[kind]) {
						if (!isPitched(l)) continue;
						const f = settle(l);
						const inScale = scale.some((n) => partials.some((m) => Math.abs(f - m * n) < 0.05));
						expect(inScale, `${set}/${id}.${kind} ${f}`).toBe(true);
					}
				}
			}
		}
	});

	it('every assignment counts in on a degree no input takes', () => {
		for (const id of ASSIGNMENT_IDS) {
			const a = ASSIGNMENTS[id];
			const taken = new Set([a.normal, a.skill, a.burst, a.cancel, ...a.swap]);
			expect(taken.has(a.count), id).toBe(false);
		}
		// and a minor voice's count note is off its inputs too
		const count = paletteFor('handpan', 'weight').count[0] as Pitched;
		const inputs = KINDS.filter((k) => k !== 'count').map((k) =>
			fundamental('handpan', 'weight', k)
		);
		expect(inputs.some((f) => Math.abs(f! - settle(count)) < 0.05)).toBe(false);
	});

	it('a swap is the one sound that slides, once, in every set', () => {
		for (const set of SOUND_SETS) {
			for (const id of ASSIGNMENT_IDS) {
				const p = paletteFor(set, id);
				expect(
					p.swap.some((l) => l.slide !== undefined),
					`${set}/${id}`
				).toBe(true);
				// one onset: no layer of the swap is delayed
				expect(
					p.swap.every((l) => !l.delay),
					`${set}/${id}`
				).toBe(true);
				for (const kind of KINDS) {
					if (kind === 'swap') continue;
					expect(
						p[kind].some((l) => l.slide !== undefined),
						`${set}/${id}.${kind}`
					).toBe(false);
				}
			}
		}
		// the slide lands on the assignment's second degree
		const a = ASSIGNMENTS.weight;
		const l = paletteFor('kalimba', 'weight').swap.find(isPitched)!;
		expect(settle(l) * l.slide!).toBeCloseTo(stepHz(SET_TUNING.kalimba, a.swap[1]), 6);
	});

	it('every voice sustains, and the count-in never does', () => {
		for (const set of SOUND_SETS) {
			const p = paletteFor(set, 'weight');
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

	it('a chime assignment uses neighbouring steps, in both modes', () => {
		for (const id of ['chime', 'chimeMinor', 'chimeRising', 'chimeRisingMinor'] as const) {
			const a = ASSIGNMENTS[id];
			const steps = [a.normal, a.skill, a.burst].sort((x, y) => x - y);
			expect(steps, id).toEqual([1, 2, 3]);
			expect(a.mode, id).toBe(id.endsWith('Minor') ? 'minor' : 'major');
		}
		// and the override reaches a major voice: the kalimba's chime-minor burst is A, skill C
		expect(fundamental('kalimba', 'chimeMinor', 'burst')).toBeCloseTo(440, 6);
		expect(fundamental('kalimba', 'chimeMinor', 'skill')).toBeCloseTo(523.25, 1);
		expect(fundamental('kalimba', 'chime', 'skill')).toBeCloseTo(493.88, 1);
	});

	it('seven sets and eight assignments, each named and trimmed', () => {
		expect(SOUND_SETS).toHaveLength(7);
		expect(ASSIGNMENT_IDS).toHaveLength(8);
		for (const set of SOUND_SETS) {
			expect(SOUND_SET_LABELS[set]).toBeTruthy();
			expect(SET_TRIM[set]).toBeGreaterThan(0);
		}
		for (const id of ASSIGNMENT_IDS) expect(ASSIGNMENT_LABELS[id]).toBeTruthy();
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
