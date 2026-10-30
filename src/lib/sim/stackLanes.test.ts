/**
 * A drawn stack count (Mirror row round, 2026-10-30): the steps rebuilt from
 * the turn pool's expiry lists, and Alhaitham's Chisel-Light Mirrors drawn from
 * them. The Mirror frames are gcsim's (`mirrors.test.ts` derives each one): the
 * E's Mirrors land 15f after a tap, one leaves every 233f, A1 adds one on a
 * Charged hit, an overflow restarts the clock, and the swap drops them all.
 */
import { describe, it, expect } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { ParsedRotation } from './types';
import { stepsOf } from './stackLanes';

const modules = import.meta.glob<{ default: CharacterData }>('$lib/data/characters/*.json', {
	eager: true
});
const byName = new Map(Object.values(modules).map((m) => [m.default.name, m.default]));
const parse = (notation: string): ParsedRotation =>
	parseNotation(notation, (n) => byName.get(n) ?? null, 8);

const mirrorBars = (r: ParsedRotation) =>
	r.windows.flatMap((w) =>
		w.kind === 'stacks' && w.key === 'mirrors'
			? [{ start: w.start, end: w.end, steps: w.steps.map((s) => [s.at, s.count]) }]
			: []
	);

describe('stepsOf', () => {
	it('counts down through one list, one expiry at a time', () => {
		expect(stepsOf([{ at: 10, expiries: [100, 200] }])).toEqual([
			{ at: 10, count: 2 },
			{ at: 100, count: 1 },
			{ at: 200, count: 0 }
		]);
	});

	it('takes the later list from its own instant, dropping what it replaced', () => {
		// A grant at 50 joins the back; a consume at 150 empties the pool.
		expect(
			stepsOf([
				{ at: 10, expiries: [100] },
				{ at: 50, expiries: [100, 333] },
				{ at: 150, expiries: [] }
			])
		).toEqual([
			{ at: 10, count: 1 },
			{ at: 50, count: 2 },
			{ at: 100, count: 1 },
			{ at: 150, count: 0 }
		]);
	});

	it('reads an expiry already past at its write as gone', () => {
		expect(stepsOf([{ at: 10, expiries: [5, 40] }])).toEqual([
			{ at: 10, count: 1 },
			{ at: 40, count: 0 }
		]);
	});
});

describe("Alhaitham's Mirror row", () => {
	it('steps down one Mirror every 233f from the E', () => {
		expect(mirrorBars(parse('Alhaitham E N5 N5 N5'))).toEqual([
			{
				start: 15,
				end: 481,
				steps: [
					[15, 2],
					[248, 1]
				]
			}
		]);
	});

	it("steps up at A1's Mirror, which joins the back of the queue", () => {
		expect(mirrorBars(parse('Alhaitham E C N5 N5'))).toEqual([
			{
				start: 15,
				end: 714,
				steps: [
					[15, 2],
					[63, 3],
					[248, 2],
					[481, 1]
				]
			}
		]);
	});

	it('ends at the burst, restarts at its refill, and ends again at the swap', () => {
		expect(mirrorBars(parse('Alhaitham E Q N3 ~2s N3 > Nahida E'))).toEqual([
			{ start: 15, end: 28, steps: [[15, 2]] },
			{ start: 212, end: 418, steps: [[212, 1]] }
		]);
	});

	it('moves every loss when an overflow restarts the clock', () => {
		// The refill fills him at 184; A1 overflows at 226 → 459, 692, 925.
		expect(mirrorBars(parse('Alhaitham Q ~2s C N5 N5 N5 N5 N5 N5 N5'))).toEqual([
			{
				start: 184,
				end: 925,
				steps: [
					[184, 3],
					[459, 2],
					[692, 1]
				]
			}
		]);
	});

	it('is a row for nobody else', () => {
		expect(parse('Nahida E N3 > Bennett E Q').windows.some((w) => w.kind === 'stacks')).toBe(false);
	});
});
