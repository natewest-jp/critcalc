import { describe, it, expect } from 'vitest';
import { xForTime, barGeom, rulerTicks } from './barGeometry';

describe('xForTime', () => {
	it('rounds time × scale to an integer pixel', () => {
		expect(xForTime(0, 30)).toBe(0);
		expect(xForTime(1, 30)).toBe(30);
		expect(xForTime(1.017, 30)).toBe(31); // 30.51 → 31
		expect(xForTime(2.5, 12)).toBe(30);
	});
});

describe('barGeom', () => {
	it('left is the rounded start; width is the difference of rounded endpoints', () => {
		const g = barGeom(1, 2, 30);
		expect(g.left).toBe(30);
		expect(g.width).toBe(60); // round(3*30) - round(1*30) = 90 - 30
	});

	it('floors width at 2px for zero/near-zero spans', () => {
		expect(barGeom(5, 0, 30).width).toBe(2);
		expect(barGeom(5, 0.01, 30).width).toBe(2); // rounds to same px → floored
	});

	it('telescopes: adjacent segments share an edge with no ±1px drift', () => {
		// A non-clean scale where a rounded-span approach would drift.
		const scale = 37;
		const a = barGeom(0, 1.3, scale);
		const b = barGeom(1.3, 2.1, scale);
		// b.left must equal a.left + a.width (endpoints telescope exactly).
		expect(b.left).toBe(a.left + a.width);
		expect(b.left).toBe(xForTime(1.3, scale));
	});
});

describe('rulerTicks', () => {
	it('returns nothing for non-positive or non-finite durations', () => {
		expect(rulerTicks(0, 30)).toEqual([]);
		expect(rulerTicks(-5, 30)).toEqual([]);
		expect(rulerTicks(Infinity, 30)).toEqual([]);
		expect(rulerTicks(NaN, 30)).toEqual([]);
	});

	it('steps 1s when zoomed in (sc ≥ 50)', () => {
		const ts = rulerTicks(3, 50).map((t) => t.t);
		expect(ts).toEqual([0, 1, 2, 3]);
	});

	it('steps 2s at mid zoom (25 ≤ sc < 50)', () => {
		const ts = rulerTicks(8, 30).map((t) => t.t);
		expect(ts).toEqual([0, 2, 4, 6, 8]);
	});

	it('steps 5s when zoomed out (sc < 25)', () => {
		const ts = rulerTicks(12, 12).map((t) => t.t);
		expect(ts).toEqual([0, 5, 10]);
	});

	it('marks every 5th second as major and projects x at scale', () => {
		const ticks = rulerTicks(10, 50);
		const majors = ticks.filter((t) => t.major).map((t) => t.t);
		expect(majors).toEqual([0, 5, 10]);
		expect(ticks.find((t) => t.t === 5)?.x).toBe(250);
	});
});
