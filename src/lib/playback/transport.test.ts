import { describe, expect, it } from 'vitest';
import { dueBetween, positionAt } from './transport';
import { COUNT_IN_S, countInCues, type Cue } from './cues';

const cues: Cue[] = [
	{ t: 0, kind: 'skill', dur: 0.5 },
	{ t: 1.5, kind: 'burst', dur: 2 },
	{ t: 4, kind: 'swap', dur: 0.15 }
];
const countIn = countInCues();

describe('positionAt', () => {
	it('runs the count-in as negative time, then the rotation', () => {
		expect(positionAt(0, 3, 10, false)).toEqual({ t: -3, ended: false });
		expect(positionAt(2.5, 3, 10, false)).toEqual({ t: -0.5, ended: false });
		expect(positionAt(3, 3, 10, false)).toEqual({ t: 0, ended: false });
		expect(positionAt(9, 3, 10, false)).toEqual({ t: 6, ended: false });
	});

	it('ends at the duration without loop, and wraps with it', () => {
		expect(positionAt(13, 3, 10, false)).toEqual({ t: 10, ended: true });
		expect(positionAt(20, 3, 10, false)).toEqual({ t: 10, ended: true });
		expect(positionAt(13, 3, 10, true)).toEqual({ t: 0, ended: false });
		expect(positionAt(27.5, 3, 10, true).t).toBeCloseTo(4.5, 9);
	});

	it('with no lead the cursor starts at zero', () => {
		expect(positionAt(0, 0, 10, true)).toEqual({ t: 0, ended: false });
	});
});

describe('dueBetween', () => {
	it('takes the first count-in beat at elapsed 0 — the window is [from, to)', () => {
		const due = dueBetween(cues, countIn, COUNT_IN_S, 10, false, 0, 2.5);
		expect(due.map((d) => [d.kind, d.elapsed])).toEqual([
			['count', 0],
			['count', 1],
			['count', 2]
		]);
	});

	it('walks contiguous windows without repeating a cue', () => {
		const a = dueBetween(cues, countIn, COUNT_IN_S, 10, false, 0, 3);
		const b = dueBetween(cues, countIn, COUNT_IN_S, 10, false, 3, 6);
		expect(a.map((d) => d.elapsed)).toEqual([0, 1, 2]);
		// elapsed 4 is t = 0: the skill, on the downbeat after the fourth beat,
		// which is the different one
		expect(b.map((d) => [d.kind, d.elapsed])).toEqual([
			['countLast', 3],
			['skill', 4],
			['burst', 5.5]
		]);
		// the block's length rides along for the voice to ring
		expect(b.map((d) => d.dur)).toEqual([0, 0.5, 2]);
	});

	it('repeats rotation cues every lap when looping, and the count-in never', () => {
		const due = dueBetween(cues, countIn, 0, 5, true, 4, 12);
		expect(due.map((d) => [d.kind, d.elapsed])).toEqual([
			['swap', 4],
			['skill', 5],
			['burst', 6.5],
			['swap', 9],
			['skill', 10],
			['burst', 11.5]
		]);
		expect(due.some((d) => d.kind === 'count')).toBe(false);
	});

	it('without loop nothing follows the last lap', () => {
		const due = dueBetween(cues, countIn, 0, 5, false, 4, 12);
		expect(due.map((d) => d.kind)).toEqual(['swap']);
	});

	it('an empty window yields nothing', () => {
		expect(dueBetween(cues, countIn, 0, 5, true, 3, 3)).toEqual([]);
	});
});
