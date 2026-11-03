import { describe, it, expect } from 'vitest';
import {
	inferRollCounts,
	resolvePiece,
	displayValue,
	possibleValues,
	lineDetail,
	pieceNow,
	pieceFuture,
	pieceReshape,
	piecePopulation,
	upgradeTotals,
	rollReshape,
	type PieceQuery
} from './appraise';
import { collapse, compareTo, distStats, freshOutcome, substatById } from './artifactOdds';

// Expectations pinned after a full cross-validation against the Genshin
// Optimizer's generated artifact_sub_rolls.json (2026-07-07): identical
// roll-count sets for every displayed value across all 10 substats.

describe('inferRollCounts', () => {
	it('CR 3.9 → exactly 1 roll (a max-tier roll)', () => {
		const inf = inferRollCounts('cr', 3.9);
		expect(inf.map((i) => i.count)).toEqual([1]);
		expect(inf[0].rvMax).toBe(100);
	});

	it('CR 6.6 → exactly 2 rolls', () => {
		expect(inferRollCounts('cr', 6.6).map((i) => i.count)).toEqual([2]);
	});

	it('CD 21.8 → ambiguous: 3 or 4 rolls', () => {
		expect(inferRollCounts('cd', 21.8).map((i) => i.count)).toEqual([3, 4]);
	});

	it('impossible values return empty (typo guard)', () => {
		expect(inferRollCounts('cr', 4.0)).toEqual([]);
		expect(inferRollCounts('cr', 2.0)).toEqual([]);
	});

	it('flat stats round to integers: single-roll EM displays as 16/18/20/23', () => {
		expect(inferRollCounts('em', 16).map((i) => i.count)).toEqual([1]);
		expect(inferRollCounts('em', 23).map((i) => i.count)).toEqual([1]);
		expect(inferRollCounts('em', 17)).toEqual([]);
	});

	it('possibleValues enumerates exactly the legal displayed values', () => {
		const cr = possibleValues('cr');
		// 53 distinct CR displayed values at 5★ — matches the GO-generated table
		expect(cr).toHaveLength(53);
		expect(cr).toContain(3.9);
		expect(cr).toContain(6.6);
		expect(cr).not.toContain(4.0);
		expect(cr[0]).toBeCloseTo(2.7, 5);
		expect(cr[cr.length - 1]).toBeCloseTo(23.3, 5);
		// sorted ascending
		expect([...cr].sort((a, b) => a - b)).toEqual(cr);
	});

	it('float32-faithful display formatting', () => {
		// One max CD roll: 0.0777 → ×100 in float32 → "7.8"
		expect(displayValue(substatById('cd'), Math.fround(Math.fround(0.0777) * 100))).toBe('7.8');
	});
});

describe('resolvePiece', () => {
	const infer = (id: Parameters<typeof inferRollCounts>[0], v: number) => inferRollCounts(id, v);

	it('resolves the demo piece uniquely as a 3-line start (8 total rolls)', () => {
		// CR 6.6 (2), CD 21.0 (3), ATK% 9.9 (2), ER 5.2 (1) → 8 rolls
		const res = resolvePiece([
			infer('cr', 6.6),
			infer('cd', 21.0),
			infer('atkPct', 9.9),
			infer('er', 5.2)
		]);
		expect(res).toHaveLength(1);
		expect(res[0].fourLineStart).toBe(false);
		expect(res[0].events).toBe(4);
		expect(res[0].counts).toEqual([2, 3, 2, 1]);
	});

	it('surfaces ambiguity when counts admit both 8 and 9 totals', () => {
		// CD 21.8 is 3-or-4; with 2+2+1 elsewhere both totals are reachable
		const res = resolvePiece([
			infer('cr', 6.6),
			infer('cd', 21.8),
			infer('atkPct', 9.9),
			infer('er', 5.2)
		]);
		expect(res).toHaveLength(2);
		expect(res.map((r) => r.events).sort()).toEqual([4, 5]);
	});

	it('reads a piece at any level', () => {
		// +8 with 4 lines: 4 + 2 rolls (4-line start) or 3 + 2 (3-line start)
		const at8 = resolvePiece(
			[infer('cr', 6.6), infer('cd', 7.8), infer('atkPct', 5.8), infer('er', 6.5)],
			8
		);
		expect(at8).toEqual([{ counts: [2, 1, 1, 1], events: 4, fourLineStart: false }]);
		// +0: three lines, one roll each
		expect(
			resolvePiece([infer('cr', 3.9), infer('cd', 7.8), infer('atkPct', 5.8)], 0)
		).toHaveLength(1);
		// three lines past +4 is impossible
		expect(resolvePiece([infer('cr', 3.9), infer('cd', 7.8), infer('atkPct', 5.8)], 4)).toEqual([]);
	});

	it('rejects incomplete pieces', () => {
		expect(resolvePiece([infer('cr', 6.6), infer('cd', 21.0), infer('atkPct', 9.9), []])).toEqual(
			[]
		);
	});
});

describe('lineDetail', () => {
	it('one max CR roll: its initial roll is the top tier', () => {
		const d = lineDetail('cr', 3.9, 1);
		expect([...d.initial]).toEqual([[3, 1]]);
		expect([...d.units]).toEqual([[389, 1]]);
		expect([...d.rv]).toEqual([[100, 1]]);
	});

	it('two rolls: ordered sequences weigh equally', () => {
		// CR 6.6 over 2 rolls: (2.72, 3.89) → 6.61, (3.11, 3.50) → 6.61 — and
		// each in either order, so the initial tier is any of the four
		const d = lineDetail('cr', 6.6, 2);
		expect([...d.initial.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
		expect(d.initial.size).toBe(4);
	});
});

describe('a piece', () => {
	const sum = (d: { p: number }[]) => d.reduce((acc, x) => acc + x.p, 0);
	const demo: PieceQuery = {
		unit: 'cv',
		wanted: ['cr', 'cd'],
		main: 'hp',
		level: 20,
		lines: [
			{ id: 'cr', value: 6.6 },
			{ id: 'cd', value: 21.0 },
			{ id: 'atkPct', value: 9.9 },
			{ id: 'er', value: 5.2 }
		],
		counts: [2, 3, 2, 1],
		selected: ['cr', 'cd']
	};

	it('now: the displayed crit value', () => {
		const now = pieceNow(demo);
		expect(now).toHaveLength(1);
		expect(now[0].x).toBeCloseTo(34.2, 9);
		expect(now[0].p).toBeCloseTo(1, 12);
	});

	it('at +20 the future IS now, tagged with the upgrades your stats took', () => {
		const future = pieceFuture(demo);
		expect(collapse(future).map((d) => d.x)).toEqual(pieceNow(demo).map((d) => d.x));
		expect(future.every((o) => o.k === 3)).toBe(true);
	});

	it('a fresh 4-line +0 piece starts the Level up chart from its own rolls', () => {
		const fresh: PieceQuery = {
			...demo,
			level: 0,
			lines: [
				{ id: 'cr', value: 2.7 },
				{ id: 'cd', value: 5.4 },
				{ id: 'atkPct', value: 4.1 },
				{ id: 'er', value: 4.5 }
			],
			counts: [1, 1, 1, 1]
		};
		const future = distStats(collapse(pieceFuture(fresh)));
		const generic = distStats(collapse(freshOutcome('cv', ['cr', 'cd'], 5)));
		// same rolls to come, but this piece starts on the bottom tier of both
		// lines: (6.61 − 5.44) CV under the CR average, (6.605 − 5.44) under CD's
		// (to 0.1 — the display rounds each line)
		expect(future.mean).toBeCloseTo(generic.mean - (6.61 - 5.44) - (6.605 - 5.44), 1);
	});

	it('a 3-line +0 piece mixes over its 4th line', () => {
		const three: PieceQuery = {
			...demo,
			level: 0,
			lines: [
				{ id: 'cr', value: 3.9 },
				{ id: 'atkPct', value: 4.1 },
				{ id: 'er', value: 4.5 }
			],
			counts: [1, 1, 1],
			selected: []
		};
		const d = collapse(pieceFuture(three));
		expect(sum(d)).toBeCloseTo(1, 9);
		// the bottom: CD never arrives and CR takes no rolls → 2 × 3.9
		expect(d[0].x).toBeCloseTo(7.8, 9);
	});

	// The game shows a 3-line piece's 4th substat from the start, grayed out
	// as "(unactivated)" (Nate, 2026-11-03): every fresh piece's four lines
	// are known. Its first upgrade (at +4) only turns that line on, so from +0
	// the piece is exactly a 3-line piece at +4 whose 4th line has just come.
	it('an unactivated 4th line is a 3-line piece at +4, known in advance', () => {
		const known: PieceQuery = {
			...demo,
			level: 0,
			lines: [
				{ id: 'atkPct', value: 4.1 },
				{ id: 'er', value: 4.5 },
				{ id: 'cd', value: 5.4 },
				{ id: 'cr', value: 2.7 }
			],
			counts: [1, 1, 1, 1],
			selected: [],
			unactivated: true
		};
		const atFour: PieceQuery = { ...known, level: 4, unactivated: false };
		expect(collapse(pieceFuture(known))).toEqual(collapse(pieceFuture(atFour)));
		// its value now leaves the unactivated line out: CD 5.4 only
		expect(pieceNow(known)[0].x).toBeCloseTo(5.4, 9);
	});

	it('an unactivated 4th line resolves as a 3-line start at +0', () => {
		const inf = (
			[
				['atkPct', 4.1],
				['er', 4.5],
				['cd', 5.4],
				['cr', 2.7]
			] as const
		).map(([id, v]) => inferRollCounts(id, v));
		expect(resolvePiece(inf, 0).map((r) => r.fourLineStart)).toEqual([true]);
		const res = resolvePiece(inf, 0, true);
		expect(res.map((r) => [r.fourLineStart, r.events])).toEqual([[false, 4]]);
	});

	it('a reshape keeps the first rolls and deals the rest again', () => {
		const after = collapse(pieceReshape(demo, 4, 2));
		expect(sum(after)).toBeCloseTo(1, 9);
		expect(after[0].x).toBeGreaterThanOrEqual(2 * 2.7 + 5.4 + 5.4);
	});

	// "Try a reshape" rolls ONE result; it must be a draw from the very
	// distribution the chart draws, or the dot it lights would lie.
	describe('one reshape, rolled', () => {
		/** A seeded generator (mulberry32), so the test is the same every run */
		const seeded = (seed: number) => () => {
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};

		for (const floor of [2, 3, 4]) {
			it(`a floor-${floor} roll is a draw from pieceReshape`, () => {
				const exact = collapse(pieceReshape(demo, 4, floor));
				const support = new Set(exact.map((d) => d.x.toFixed(6)));
				const rand = seeded(floor);
				const N = 20000;
				let mean = 0;
				let beats = 0;
				for (let i = 0; i < N; i++) {
					const r = rollReshape(demo, 4, floor, rand);
					expect(support.has(r.x.toFixed(6))).toBe(true);
					mean += r.x / N;
					if (r.x > 34.2 + 1e-6) beats++;
				}
				expect(mean).toBeCloseTo(distStats(exact).mean, 0);
				expect(beats / N).toBeCloseTo(compareTo(exact, [{ x: 34.2, p: 1 }]).above, 1);
			});
		}

		it("keeps the floor, the starting rolls and the game's display", () => {
			const rand = seeded(7);
			for (let i = 0; i < 200; i++) {
				const r = rollReshape(demo, 4, 4, rand);
				expect(r.steps).toHaveLength(4);
				// Decreed on CR and CD: all four upgrades go to them
				expect(r.steps.every((s) => s.line === 0 || s.line === 1)).toBe(true);
				expect(r.counts.reduce((a, b) => a + b, 0)).toBe(8);
				// a start is one roll the line's value can begin with
				r.start.forEach((v, li) => {
					const id = demo.lines[li].id;
					expect(inferRollCounts(id, Number(v)).some((c) => c.count === 1)).toBe(true);
				});
				// the last step on a line shows what the line ends on
				r.steps.forEach((s, k) => {
					if (!r.steps.slice(k + 1).some((t) => t.line === s.line))
						expect(s.value).toBe(r.final[s.line]);
				});
			}
		});
	});

	it('no reshape without two selected lines', () => {
		expect(pieceReshape({ ...demo, selected: ['cr'] }, 4, 2)).toEqual([]);
	});

	it('the population is every finished piece with these lines', () => {
		const pop = piecePopulation(demo, 4);
		expect(sum(pop)).toBeCloseTo(1, 9);
		expect(distStats(pop).median).toBeLessThan(34.2);
	});

	it('upgrade totals list what the values could add up to', () => {
		const inf = [
			inferRollCounts('cr', 6.6),
			inferRollCounts('cd', 21.8),
			inferRollCounts('atkPct', 9.9),
			inferRollCounts('er', 5.2)
		];
		// CR 1 + CD 2-or-3 + ATK% 1 + ER 0
		expect(upgradeTotals(inf)).toEqual([4, 5]);
	});
});
