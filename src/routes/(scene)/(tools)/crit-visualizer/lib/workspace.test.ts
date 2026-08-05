import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ASSIGNMENT,
	INSTRUMENTS,
	MAX_GAUGE_APPS,
	MAX_GAUGE_TIME,
	MAX_SLOTS,
	effectiveSlots,
	icdHitsToGaugeApps,
	normalizeAssignment,
	normalizeSlots,
	viewportCapacity
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

describe('normalizeSlots', () => {
	it('accepts whole counts within range', () => {
		for (let n = 1; n <= MAX_SLOTS; n++) expect(normalizeSlots(n)).toBe(n);
	});

	it("keeps 'auto' as 'auto'", () => {
		expect(normalizeSlots('auto')).toBe('auto');
	});

	it("falls back to 'auto' for anything else", () => {
		for (const bad of [null, undefined, 0, -1, MAX_SLOTS + 1, 1.5, NaN, '2', {}, [], () => {}]) {
			expect(normalizeSlots(bad)).toBe('auto');
		}
	});

	it("treats a payload written before the control existed as 'auto'", () => {
		// The v1 envelope gained `slots` without a version bump: an older record
		// has no such key, and must restore to the pre-control behavior.
		const legacy = { v: 1, assignment: [...DEFAULT_ASSIGNMENT] } as { slots?: unknown };
		expect(normalizeSlots(legacy.slots)).toBe('auto');
	});
});

describe('viewportCapacity', () => {
	it('steps 1 → 2 → 3 at the layout thresholds', () => {
		expect(viewportCapacity(1359)).toBe(1);
		expect(viewportCapacity(1360)).toBe(2);
		expect(viewportCapacity(2199)).toBe(2);
		expect(viewportCapacity(2200)).toBe(3);
	});

	it('never exceeds MAX_SLOTS, including the SSR zero width', () => {
		expect(viewportCapacity(0)).toBe(1);
		expect(viewportCapacity(99999)).toBe(MAX_SLOTS);
	});
});

describe('effectiveSlots', () => {
	it("follows the viewport under 'auto'", () => {
		expect(effectiveSlots('auto', 1)).toBe(1);
		expect(effectiveSlots('auto', 3)).toBe(3);
	});

	it('caps a roomy viewport down to the preference', () => {
		expect(effectiveSlots(1, 3)).toBe(1);
		expect(effectiveSlots(2, 3)).toBe(2);
	});

	it('never promises more than the viewport can hold', () => {
		expect(effectiveSlots(3, 1)).toBe(1);
		expect(effectiveSlots(2, 1)).toBe(1);
	});

	it('never exceeds the instrument roster', () => {
		expect(effectiveSlots(MAX_SLOTS, 99)).toBeLessThanOrEqual(INSTRUMENTS.length);
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
