import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ASSIGNMENT,
	INSTRUMENTS,
	MAX_GAUGE_APPS,
	MAX_GAUGE_TIME,
	icdHitsToGaugeApps,
	normalizeAssignment
} from './workspace';
import { simulateIcd, uniformHitTimes, STANDARD_ICD } from './icd';

const ALL = INSTRUMENTS.map((i) => i.id);

describe('normalizeAssignment', () => {
	it('accepts a full valid permutation unchanged', () => {
		const stored = [...ALL].reverse();
		expect(normalizeAssignment(stored)).toEqual(stored);
	});

	it('appends instruments a stored layout predates (they land on the bench)', () => {
		// A pre-defres layout: normalize appends the new id at the end
		const legacy = ['curves', 'icd', 'crit', 'gauge', 'rolls'];
		const out = normalizeAssignment(legacy);
		expect(out.slice(0, 5)).toEqual(legacy);
		expect([...out].sort()).toEqual([...ALL].sort());
	});

	it('is the default for garbage input', () => {
		for (const bad of [null, undefined, 42, 'crit', {}, () => {}]) {
			expect(normalizeAssignment(bad)).toEqual(DEFAULT_ASSIGNMENT);
		}
	});

	it('drops retired/unknown ids and appends missing ones in default order', () => {
		const stored = ['retiredthing', 'gauge', 'crit'];
		const out = normalizeAssignment(stored);
		expect(out.slice(0, 2)).toEqual(['gauge', 'crit']);
		expect(out).toHaveLength(ALL.length);
		expect([...out].sort()).toEqual([...ALL].sort());
		// appended tail follows DEFAULT_ASSIGNMENT's relative order
		const tail = out.slice(2);
		const defaultOrder = DEFAULT_ASSIGNMENT.filter((id) => tail.includes(id));
		expect(tail).toEqual(defaultOrder);
	});

	it('dedupes keeping the first occurrence', () => {
		const out = normalizeAssignment(['gauge', 'gauge', 'crit', 'gauge']);
		expect(out[0]).toBe('gauge');
		expect(out[1]).toBe('crit');
		expect(out.filter((id) => id === 'gauge')).toHaveLength(1);
	});

	it('ignores non-string entries', () => {
		const out = normalizeAssignment([1, null, 'rolls', {}, 'icd']);
		expect(out.slice(0, 2)).toEqual(['rolls', 'icd']);
		expect(out).toHaveLength(ALL.length);
	});

	it('always returns a permutation of the current roster', () => {
		expect([...normalizeAssignment([])].sort()).toEqual([...ALL].sort());
	});
});

describe('icdHitsToGaugeApps', () => {
	it('keeps only applying hits and threads the element through', () => {
		const sim = simulateIcd(uniformHitTimes(9, 0.5), STANDARD_ICD);
		const apps = icdHitsToGaugeApps(sim, 'electro');
		const applying = sim.filter((h) => h.applies);
		expect(apps).toHaveLength(applying.length);
		expect(apps.every((a) => a.element === 'electro' && a.gauge === 1)).toBe(true);
		expect(apps.map((a) => a.time)).toEqual(applying.map((h) => h.time));
	});

	it('caps at the gauge row limit', () => {
		// no ICD: every hit applies — 30 hits must clip to the cap
		const sim = simulateIcd(uniformHitTimes(30, 0.3), { timer: 0, hits: 1 });
		expect(icdHitsToGaugeApps(sim, 'pyro')).toHaveLength(MAX_GAUGE_APPS);
	});

	it('clamps times into the gauge slider range and rounds to 0.1s', () => {
		const sim = simulateIcd([0.123, 25], { timer: 0, hits: 1 });
		const apps = icdHitsToGaugeApps(sim, 'hydro');
		expect(apps[0].time).toBeCloseTo(0.1);
		expect(apps[1].time).toBe(MAX_GAUGE_TIME);
	});
});
