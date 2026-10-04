import { describe, it, expect } from 'vitest';
import { simulateIcd, STANDARD_ICD } from '$lib/utils/icd';
import { ICD_EXAMPLES, type IcdExampleId } from './icdExamples';

// Which hits apply — under the example's own group, and under the standard
// rule for contrast. Worked by hand from gcsim's numbers (icdExamples.ts).
const applied = (id: IcdExampleId, own: boolean) => {
	const ex = ICD_EXAMPLES.find((e) => e.id === id)!;
	return simulateIcd(ex.hits, own ? ex.rule : STANDARD_ICD).flatMap((h, i) =>
		h.applies ? [i + 1] : []
	);
};

describe('ICD examples', () => {
	it('Oz: the 5s window lets the counter apply tick 5, then the timer tick 7', () => {
		expect(applied('oz', true)).toEqual([1, 5, 7]);
		expect(applied('oz', false)).toEqual([1, 4, 7, 10]);
	});

	it('Hu Tao: a 0.5s window under a 1.03s cadence — every charged attack applies', () => {
		expect(applied('hutao', true)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
		expect(applied('hutao', false)).toEqual([1, 4, 7]);
	});

	it('Chevreuse: the list stops after hit 4, where the standard would apply hit 7 too', () => {
		expect(applied('chevreuse', true)).toEqual([1, 4]);
		expect(applied('chevreuse', false)).toEqual([1, 4, 7]);
	});

	it('Layla: a volley never reaches the 8th star, so one Cryo per volley', () => {
		expect(applied('layla', true)).toEqual([1, 5]);
		expect(applied('layla', false)).toEqual([1, 4, 5, 8]);
	});
});
