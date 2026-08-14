import { describe, expect, it } from 'vitest';
import { defMultiplier, resMultiplier } from './defres';

describe('defMultiplier', () => {
	it('equal levels with no modifiers is exactly one half', () => {
		expect(defMultiplier(90, 90)).toBeCloseTo(0.5, 12);
		expect(defMultiplier(1, 1)).toBeCloseTo(0.5, 12);
	});

	it('level 90 vs a level 100 enemy', () => {
		expect(defMultiplier(90, 100)).toBeCloseTo(190 / 390, 12);
	});

	it('shred and ignore multiply on the enemy side', () => {
		// 90 vs 90: 60% reduction alone → 190 / (190 + 190×0.4)
		expect(defMultiplier(90, 90, 0.6)).toBeCloseTo(190 / (190 + 190 * 0.4), 12);
		// plus 50% ignore → enemy side halves again
		expect(defMultiplier(90, 90, 0.6, 0.5)).toBeCloseTo(190 / (190 + 190 * 0.4 * 0.5), 12);
	});

	it('clamps modifier inputs to [0, 1]', () => {
		expect(defMultiplier(90, 90, 2)).toBe(1); // enemy side zeroed
		expect(defMultiplier(90, 90, -1)).toBeCloseTo(0.5, 12);
	});
});

describe('resMultiplier', () => {
	it('standard 10% enemy takes 90%', () => {
		expect(resMultiplier(0.1)).toBeCloseTo(0.9, 12);
	});

	it('below zero, each point counts half — the VV over-delivery', () => {
		// 10% base − 40% VV = −30% → ×1.15 (not ×1.30)
		expect(resMultiplier(-0.3)).toBeCloseTo(1.15, 12);
		expect(resMultiplier(-1)).toBeCloseTo(1.5, 12);
	});

	it('is continuous at the 75% regime boundary', () => {
		expect(resMultiplier(0.75)).toBeCloseTo(0.25, 12);
		expect(resMultiplier(0.7499999)).toBeCloseTo(0.25, 5);
		expect(resMultiplier(0.7500001)).toBeCloseTo(0.25, 5);
	});

	it('diminishing regime above 75%', () => {
		expect(resMultiplier(1)).toBeCloseTo(0.2, 12);
		expect(resMultiplier(2)).toBeCloseTo(1 / 9, 12);
	});

	it('zero resistance is a clean ×1', () => {
		expect(resMultiplier(0)).toBe(1);
	});
});
