import { describe, it, expect } from 'vitest';
import {
	inferRollCounts,
	resolvePiece,
	rvDistribution,
	percentileOf,
	displayValue,
	possibleValues
} from './appraise';
import { substatById } from './artifactRolls';

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

	it('rejects incomplete pieces', () => {
		expect(resolvePiece([infer('cr', 6.6), infer('cd', 21.0), infer('atkPct', 9.9), []])).toEqual(
			[]
		);
	});
});

describe('rvDistribution', () => {
	it('sums to 1 with exact support bounds', () => {
		const dist = rvDistribution(5, 2);
		expect(dist.reduce((acc, d) => acc + d.p, 0)).toBeCloseTo(1, 9);
		expect(dist[0].rv).toBe(140); // two initial min rolls
		expect(dist[dist.length - 1].rv).toBe(700); // 7 max rolls
	});

	it('mean matches the analytic expectation', () => {
		// lines × 85 + events × (lines/4) × 85
		const mean = rvDistribution(4, 1).reduce((acc, d) => acc + d.rv * d.p, 0);
		expect(mean).toBeCloseTo(85 + 4 * 0.25 * 85, 9);
	});
});

describe('percentileOf', () => {
	it('accumulates probability at and below the value', () => {
		const dist = rvDistribution(5, 2);
		expect(percentileOf(dist, 'rv', 139)).toBe(0);
		expect(percentileOf(dist, 'rv', 700)).toBeCloseTo(1, 9);
		const mid = percentileOf(dist, 'rv', 420);
		expect(mid).toBeGreaterThan(0.3);
		expect(mid).toBeLessThan(0.7);
	});
});
