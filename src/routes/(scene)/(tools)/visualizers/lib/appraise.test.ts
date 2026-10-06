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
	type PieceQuery
} from './appraise';
import { collapse, distStats, freshOutcome, substatById } from './artifactOdds';

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

	it('a reshape keeps the first rolls and deals the rest again', () => {
		const after = collapse(pieceReshape(demo, 4, 2));
		expect(sum(after)).toBeCloseTo(1, 9);
		expect(after[0].x).toBeGreaterThanOrEqual(2 * 2.7 + 5.4 + 5.4);
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
