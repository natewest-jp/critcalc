import { describe, it, expect } from 'vitest';
import type { TimelineWindow } from '$lib/utils/rotationEvents';
import { computeStackSubrows } from './stackRows';

const win = (
	start: number,
	end: number,
	steps: [number, number][],
	characterId = 'alhaitham'
): TimelineWindow => ({
	kind: 'stacks',
	characterId,
	key: 'mirrors',
	label: 'Chisel-Light Mirror',
	source: 'skill',
	start,
	end,
	steps: steps.map(([at, count]) => ({ at, count })),
	max: 3
});

describe('computeStackSubrows', () => {
	it('draws one row per character and label, a stepped bar per window', () => {
		const rows = computeStackSubrows([win(15, 28, [[15, 2]]), win(212, 418, [[212, 1]])], () => 0);
		expect(rows).toHaveLength(1);
		expect(rows[0].label).toBe('Chisel-Light Mirror');
		expect(rows[0].bars.map((b) => [b.start, b.end, b.stepMax])).toEqual([
			[15, 28, 3],
			[212, 418, 3]
		]);
	});

	it('runs each step to the next, and the last to the window end', () => {
		const [row] = computeStackSubrows(
			[
				win(15, 481, [
					[15, 2],
					[248, 1]
				])
			],
			() => 0
		);
		expect(row.bars[0].steps?.map((s) => [s.start, s.end, s.count])).toEqual([
			[15, 248, 2],
			[248, 481, 1]
		]);
	});

	it('skips a character with no slot', () => {
		expect(computeStackSubrows([win(15, 28, [[15, 2]])], () => undefined)).toEqual([]);
	});
});
