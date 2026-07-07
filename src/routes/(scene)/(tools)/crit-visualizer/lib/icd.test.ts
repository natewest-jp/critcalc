import { describe, it, expect } from 'vitest';
import { simulateIcd, uniformHitTimes, STANDARD_ICD } from './icd';

const applyPattern = (hits: ReturnType<typeof simulateIcd>) => hits.map((h) => h.applies);

describe('simulateIcd — standard 2.5s / 3-hit', () => {
	it('fast string (0.5s): counter app at hit 4 does NOT reset the timer', () => {
		// h1(0s) timer; h4(1.5s) counter; h6(2.5s) timer — the KQM asymmetry:
		// if hit 4 reset the timer, hit 6 would not apply
		const sim = simulateIcd(uniformHitTimes(8, 0.5), STANDARD_ICD);
		expect(applyPattern(sim)).toEqual([true, false, false, true, false, true, false, false]);
		expect(sim[3].viaTimer).toBe(false);
		expect(sim[5].viaTimer).toBe(true);
	});

	it('1s string: timer expiry resets the hit count', () => {
		// h4 (3s ≥ 2.5) applies via timer and resets the count — h5, h6 blocked
		const sim = simulateIcd(uniformHitTimes(6, 1.0), STANDARD_ICD);
		expect(applyPattern(sim)).toEqual([true, false, false, true, false, false]);
		expect(sim[3].viaTimer).toBe(true);
	});

	it('slow string (3s > timer): every hit applies via timer', () => {
		const sim = simulateIcd(uniformHitTimes(5, 3.0), STANDARD_ICD);
		expect(applyPattern(sim)).toEqual([true, true, true, true, true]);
		expect(sim.every((h) => h.viaTimer)).toBe(true);
	});

	it('exact timer-edge hits (0.25s × 10 = 2.5s) apply despite float noise', () => {
		const sim = simulateIcd(uniformHitTimes(11, 0.25), STANDARD_ICD);
		expect(sim[10].applies).toBe(true);
		expect(sim[10].viaTimer).toBe(true);
	});
});

describe('simulateIcd — non-standard params', () => {
	it('timer 0 = no ICD, every hit applies', () => {
		const sim = simulateIcd(uniformHitTimes(6, 0.2), { timer: 0, hits: 3 });
		expect(sim.every((h) => h.applies)).toBe(true);
	});

	it('counter 1 = every hit applies even under a long timer', () => {
		const sim = simulateIcd(uniformHitTimes(5, 0.3), { timer: 10, hits: 1 });
		expect(sim.every((h) => h.applies)).toBe(true);
		expect(sim.slice(1).every((h) => !h.viaTimer)).toBe(true);
	});

	it('empty hit list', () => {
		expect(simulateIcd([], STANDARD_ICD)).toEqual([]);
	});
});
