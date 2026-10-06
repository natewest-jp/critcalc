import { describe, it, expect } from 'vitest';
import {
	SLOTS,
	SUBSTATS,
	substatPool,
	presenceProbability,
	binomialDist,
	floorDist,
	pairOutcome,
	distStats,
	compareTo,
	percentileOf,
	rollEvents,
	rollsLeftAt,
	unitTiers,
	pairValue,
	farmMiss,
	farmStats,
	pieceChance,
	nextLineChance,
	EXTRA_FIVE_STAR,
	type ValueDist
} from './artifactOdds';

describe('presenceProbability — cross-checked against wiki Artifact/Occurrence', () => {
	it('flower: CR & CD both among the 4 lines = 9.2%', () => {
		const pool = substatPool('hp');
		expect(presenceProbability(pool, ['cr', 'cd'], 4)).toBeCloseTo(0.092, 3);
	});

	it('flower: CR among the 4 lines = 34.2%', () => {
		const pool = substatPool('hp');
		expect(presenceProbability(pool, ['cr'], 4)).toBeCloseTo(0.342, 3);
	});

	it('flower: flat ATK among the 4 lines = 57.8%', () => {
		const pool = substatPool('hp');
		expect(presenceProbability(pool, ['atk'], 4)).toBeCloseTo(0.578, 3);
	});

	it('ATK% sands: CR & CD pair = 8.3%', () => {
		const pool = substatPool('atkPct');
		expect(presenceProbability(pool, ['cr', 'cd'], 4)).toBeCloseTo(0.083, 3);
	});

	it('main stat is excluded from the pool', () => {
		expect(presenceProbability(substatPool('cr'), ['cr'], 4)).toBe(0);
		expect(substatPool('hp')).toHaveLength(9);
		expect(substatPool('elemDmg')).toHaveLength(10);
	});

	it('needing more stats than draws is impossible', () => {
		expect(presenceProbability(substatPool('hp'), ['cr', 'cd', 'atkPct', 'er'], 3)).toBe(0);
	});
});

describe('pairRollDist — cross-checked against wiki Artifact/Distribution upgrade table', () => {
	it('single-line upgrade counts over 5 events match the wiki table', () => {
		// Wiki: 0×=23.73%, 1×=39.55%, 2×=26.37%, 3×=8.79%, 4×=1.46%, 5×=0.10%
		const single = [0, 1, 2, 3, 4, 5].map((k) =>
			// Binomial(5, 1/4) for a single line:
			(([n, p]) => {
				const c = (n_: number, k_: number) => {
					let r = 1;
					for (let i = 0; i < k_; i++) r = (r * (n_ - i)) / (i + 1);
					return r;
				};
				return c(n, k) * p ** k * (1 - p) ** (n - k);
			})([5, 0.25])
		);
		expect(single[0]).toBeCloseTo(0.2373, 4);
		expect(single[1]).toBeCloseTo(0.3955, 4);
		expect(single[2]).toBeCloseTo(0.2637, 4);
		expect(single[5]).toBeCloseTo(0.001, 3);
	});

	it('pair rolls are Binomial(events, ½) and sum to 1', () => {
		const dist = binomialDist(5, 0.5);
		expect(dist).toHaveLength(6);
		expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
		expect(dist[0]).toBeCloseTo(0.03125, 5);
		expect(dist[2]).toBeCloseTo(0.3125, 5);
	});

	it('3-line start yields 4 value rolls, 4-line start yields 5', () => {
		expect(rollEvents(false)).toBe(4);
		expect(rollEvents(true)).toBe(5);
	});
});

describe('main stats', () => {
	it("every slot sums to 1, counting the goblet's Elemental DMG once per element", () => {
		for (const slot of SLOTS) {
			const sum = slot.mains.reduce((acc, m) => acc + m.chance * (m.each ? 7 : 1), 0);
			expect(sum).toBeCloseTo(1, 6);
		}
	});

	it('tier values are datamined: CR runs 70–100% of 3.89%', () => {
		const cr = SUBSTATS.find((s) => s.id === 'cr')!;
		expect(cr.tiers[3]).toBeCloseTo(0.0389, 4);
		expect(cr.tiers[0] / cr.tiers[3]).toBeCloseTo(0.7, 2);
	});

	it('the next line is a weighted draw from what is left', () => {
		// wiki Artifact/Distribution's worked example: a plume with ATK%, ER, CR
		// draws CD as its 4th line 3 / (6+6+4+4+4+3) = 11.1%
		expect(nextLineChance('atk', ['atkPct', 'er', 'cr'], 'cd')).toBeCloseTo(1 / 9, 6);
	});
});

describe('floorDist — the top-up floor', () => {
	it('no floor is the binomial', () => {
		expect(floorDist(5, 0.5)).toEqual(binomialDist(5, 0.5));
	});

	it('≥2 over 5 rolls: everything below 2 ends at 2 (mean 2.72, half reach 3+)', () => {
		const d = floorDist(5, 0.5, 2);
		expect(d[0]).toBe(0);
		expect(d[1]).toBe(0);
		expect(d[2]).toBeCloseTo(16 / 32, 12);
		expect(d[3]).toBeCloseTo(10 / 32, 12);
		expect(d.reduce((a, p, k) => a + p * k, 0)).toBeCloseTo(87 / 32, 12);
	});

	it("matches Genshin Optimizer's rollCountProb at the floor", () => {
		// GO: P(total == min) = Σ_{k ≤ min} C(N,k) (n/4)^k (1 − n/4)^(N−k)
		for (const [n, g] of [
			[5, 3],
			[4, 3],
			[5, 4]
		]) {
			const b = binomialDist(n, 0.5);
			expect(floorDist(n, 0.5, g)[g]).toBeCloseTo(
				b.slice(0, g + 1).reduce((a, c) => a + c, 0),
				12
			);
		}
	});

	it('counts rolls the pair already has', () => {
		// a defined piece at +12 whose pair already took 2 rolls: no top-up left
		expect(floorDist(2, 0.5, 2, 2)).toEqual(binomialDist(2, 0.5));
		// one already, two to come: at least one more
		const d = floorDist(2, 0.5, 2, 1);
		expect(d[0]).toBe(0);
		expect(d[1]).toBeCloseTo(0.75, 12);
	});

	it('rolls left by level', () => {
		expect(rollsLeftAt(0)).toBe(5);
		expect(rollsLeftAt(4)).toBe(4);
		expect(rollsLeftAt(19)).toBe(1);
		expect(rollsLeftAt(20)).toBe(0);
	});
});

describe('pairOutcome', () => {
	const sum = (d: ValueDist) => d.reduce((acc, x) => acc + x.p, 0);

	it('CV: sums to 1, spans the displayed extremes', () => {
		const d = pairOutcome('cv', ['cr', 'cd'], 5);
		expect(sum(d)).toBeCloseTo(1, 9);
		// both lines one min roll: 2 × 2.7 + 5.4
		expect(d[0].x).toBeCloseTo(10.8, 6);
		// every roll max: the rounding is per line, so the best split is CR × 3
		// (11.67 → 11.7) and CD × 4 (31.08 → 31.1) = 54.5 on screen, not 54.4
		expect(d[d.length - 1].x).toBeCloseTo(54.5, 6);
	});

	it('RV: the mean is the analytic one', () => {
		const { mean } = distStats(pairOutcome('rv', ['atkPct', 'er'], 4));
		expect(mean).toBeCloseTo(2 * 85 + 4 * 0.5 * 85, 9);
	});

	it('a floor lifts the bottom and leaves the top', () => {
		const d = pairOutcome('rv', ['atkPct', 'er'], 5, 2);
		expect(d[0].x).toBe(280);
		expect(d[d.length - 1].x).toBe(700);
		expect(distStats(d).mean).toBeCloseTo(2 * 85 + (87 / 32) * 85, 9);
	});

	it('a one-line piece is ranked among one-line pieces (¼ per roll)', () => {
		const { mean } = distStats(pairOutcome('rv', ['cr', 'cd'], 5, 0, [true, false]));
		expect(mean).toBeCloseTo(85 + 5 * 0.25 * 85, 9);
	});

	it('CV display: each line is rounded before it counts', () => {
		expect(pairValue('cv', 389, 777)).toBeCloseTo(15.6, 9); // 2 × 3.9 + 7.8
		expect(unitTiers('cv', 'cd')).toEqual([544, 622, 699, 777]);
	});
});

describe('the top-up floor, enumerated the other way round', () => {
	// SiriYu's enlightenment solver walks the rolls in order and, once the
	// pair can only reach the floor by taking every remaining roll, forces
	// them into it. Enumerating that literally must give the same pair values
	// as floorDist's top-up — the claim the model header rests on.
	function forcedLate(events: number, floor: number): Map<number, number> {
		const [cr, cd] = [unitTiers('cv', 'cr'), unitTiers('cv', 'cd')];
		const out = new Map<number, number>();
		const walk = (step: number, a: number, b: number, inPair: number, p: number) => {
			if (step === events) {
				const v = Math.round(pairValue('cv', a, b) * 10);
				out.set(v, (out.get(v) ?? 0) + p);
				return;
			}
			const forced = inPair + (events - step) === floor && inPair < floor;
			const lines = forced ? 2 : 4;
			for (let line = 0; line < lines; line++)
				for (let t = 0; t < 4; t++) {
					const q = p / lines / 4;
					if (line === 0) walk(step + 1, a + cr[t], b, inPair + 1, q);
					else if (line === 1) walk(step + 1, a, b + cd[t], inPair + 1, q);
					else walk(step + 1, a, b, inPair, q);
				}
		};
		for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) walk(0, cr[i], cd[j], 0, 1 / 16);
		return out;
	}

	for (const [events, floor] of [
		[5, 2],
		[5, 3],
		[4, 4]
	])
		it(`${events} rolls, ≥${floor}`, () => {
			const late = forcedLate(events, floor);
			const ours = pairOutcome('cv', ['cr', 'cd'], events, floor);
			expect(ours.length).toBe(late.size);
			for (const d of ours) expect(late.get(Math.round(d.x * 10))).toBeCloseTo(d.p, 12);
		});
});

describe('compareTo / percentileOf', () => {
	const dist: ValueDist = [
		{ x: 1, p: 0.25 },
		{ x: 2, p: 0.5 },
		{ x: 3, p: 0.25 }
	];
	it('splits below / equal / above', () => {
		expect(compareTo(dist, [{ x: 2, p: 1 }])).toEqual({ below: 0.25, equal: 0.5, above: 0.25 });
	});
	it('mid-rank: the middle of a symmetric distribution reads 50', () => {
		expect(percentileOf(dist, [{ x: 2, p: 1 }])).toBeCloseTo(0.5, 12);
	});
	it('an uncertain piece value averages over itself', () => {
		const half = percentileOf(dist, [
			{ x: 1, p: 0.5 },
			{ x: 3, p: 0.5 }
		]);
		expect(half).toBeCloseTo(0.5, 12);
	});
});

describe('farming', () => {
	it('a flower with CR and CD by +4: ½ set × ⅕ slot × 9.2%', () => {
		const p4 = presenceProbability(substatPool('hp'), ['cr', 'cd'], 4);
		expect(pieceChance(1, p4)).toBeCloseTo(0.5 * 0.2 * 0.092, 4);
	});

	it('nothing spent, nothing found; partial runs count for nothing', () => {
		expect(farmMiss(0, 0.5, false)).toBe(1);
		expect(farmMiss(19, 0.5, false)).toBe(1);
		expect(farmMiss(20, 0.5, false)).toBeCloseTo(0.5 * (1 - EXTRA_FIVE_STAR * 0.5), 12);
	});

	it('an Outbreak adds one piece per 120 resin', () => {
		const q = 0.01;
		expect(farmMiss(120, q, true) / farmMiss(120, q, false)).toBeCloseTo(1 - q, 12);
		expect(farmMiss(100, q, true)).toBe(farmMiss(100, q, false));
	});

	it('the mean is about 20 resin per 1.065 pieces, and Outbreak shortens it by 6.39/7.39', () => {
		const q = 0.001;
		const domain = farmStats(q, false);
		expect(domain.mean).toBeCloseTo(20 / (1 - (1 - q) * (1 - EXTRA_FIVE_STAR * q)), -1);
		const outbreak = farmStats(q, true);
		expect(outbreak.mean / domain.mean).toBeCloseTo(6.39 / 7.39, 2);
		expect(domain.median).toBeLessThan(domain.p90);
	});

	it('an impossible target never arrives', () => {
		expect(farmStats(0, false).mean).toBe(Infinity);
	});
});

it('3-line start yields 4 value rolls, 4-line start yields 5', () => {
	expect(rollEvents(false)).toBe(4);
	expect(rollEvents(true)).toBe(5);
});
