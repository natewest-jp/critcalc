/**
 * clock.test.ts — the sim clock's contract (gauge-round.md C6, L3 plan §3.2).
 *
 * Three of these are the LANDING's load-bearing claims rather than ordinary
 * unit coverage, and they are why this file exists:
 *
 *   - the band order is pinned, including the two bands that carry nothing
 *     yet (TICK / LAND) — an empty band that is tested is a contract, an
 *     empty band that is only documented is a speculative abstraction;
 *   - same-frame order is a TOTAL order, which is what makes the sim
 *     deterministic for a given notation;
 *   - ⚓ the clock JUMPS: a task 432 million frames out costs one hop, not
 *     432 million. That is the measured constraint from L3 plan §2.
 */

import { describe, it, expect } from 'vitest';
import { Band, createClock } from './clock';

describe('clock — same-frame ordering', () => {
	it('fires bands in EXPIRE < TICK < LAND < ACT order', () => {
		const clock = createClock();
		const log: string[] = [];
		// Scheduled deliberately backwards, so passing cannot be an accident of
		// insertion order.
		clock.schedule(100, Band.ACT, () => log.push('act'));
		clock.schedule(100, Band.LAND, () => log.push('land'));
		clock.schedule(100, Band.TICK, () => log.push('tick'));
		clock.schedule(100, Band.EXPIRE, () => log.push('expire'));
		clock.drain();
		expect(log).toEqual(['expire', 'tick', 'land', 'act']);
	});

	it('keeps insertion order within one band (FIFO)', () => {
		const clock = createClock();
		const log: number[] = [];
		for (let i = 0; i < 10; i++) clock.schedule(50, Band.ACT, () => log.push(i));
		clock.drain();
		expect(log).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it('orders by frame first, band second, insertion third', () => {
		const clock = createClock();
		const log: string[] = [];
		clock.schedule(2, Band.EXPIRE, () => log.push('f2-expire'));
		clock.schedule(1, Band.ACT, () => log.push('f1-act-a'));
		clock.schedule(1, Band.ACT, () => log.push('f1-act-b'));
		clock.schedule(1, Band.EXPIRE, () => log.push('f1-expire'));
		clock.drain();
		expect(log).toEqual(['f1-expire', 'f1-act-a', 'f1-act-b', 'f2-expire']);
	});
});

describe('clock — advancing', () => {
	it('runs everything due at or before the target and lands on it', () => {
		const clock = createClock();
		const log: number[] = [];
		clock.schedule(5, Band.ACT, () => log.push(5));
		clock.schedule(10, Band.ACT, () => log.push(10));
		clock.schedule(20, Band.ACT, () => log.push(20));
		clock.advance(10);
		expect(log).toEqual([5, 10]);
		expect(clock.now).toBe(10);
		clock.advance(20);
		expect(log).toEqual([5, 10, 20]);
	});

	it('exposes `now` as the frame of the task being run, not the advance target', () => {
		// A task that schedules "5 frames from now" must get its own instant —
		// otherwise every deferred consequence of an early task would pile up on
		// whatever frame the caller happened to be advancing to.
		const clock = createClock();
		const seen: number[] = [];
		clock.schedule(30, Band.ACT, () => seen.push(clock.now));
		clock.schedule(60, Band.ACT, () => seen.push(clock.now));
		clock.advance(1000);
		expect(seen).toEqual([30, 60]);
		expect(clock.now).toBe(1000);
	});

	it('runs tasks a task schedules at the same instant, after its band siblings', () => {
		const clock = createClock();
		const log: string[] = [];
		clock.schedule(10, Band.EXPIRE, () => {
			log.push('expire');
			clock.schedule(10, Band.EXPIRE, () => log.push('expire-cascade'));
			clock.schedule(10, Band.ACT, () => log.push('act-from-expire'));
		});
		clock.schedule(10, Band.ACT, () => log.push('act'));
		clock.drain();
		expect(log).toEqual(['expire', 'expire-cascade', 'act', 'act-from-expire']);
	});

	it('never moves time backwards', () => {
		const clock = createClock();
		clock.advance(500);
		clock.advance(100);
		expect(clock.now).toBe(500);
	});

	it('clamps a task scheduled into the past and counts it', () => {
		// ⚠️ Reported rather than silently rounded: a task that lost its ordering
		// guarantee is a caller bug the differ should be able to see.
		const clock = createClock();
		const log: string[] = [];
		clock.advance(100);
		expect(clock.latecomers).toBe(0);
		clock.schedule(40, Band.ACT, () => log.push('late'));
		expect(clock.latecomers).toBe(1);
		clock.drain();
		expect(log).toEqual(['late']);
		expect(clock.now).toBe(100);
	});

	it('`step` moves to the next scheduled instant and drains it whole', () => {
		const clock = createClock();
		const log: string[] = [];
		clock.schedule(7, Band.EXPIRE, () => log.push('a'));
		clock.schedule(7, Band.ACT, () => log.push('b'));
		clock.schedule(9, Band.ACT, () => log.push('c'));
		expect(clock.step()).toBe(7);
		expect(log).toEqual(['a', 'b']);
		expect(clock.step()).toBe(9);
		expect(clock.step()).toBeNull();
	});

	it('peeks the earliest queued frame', () => {
		const clock = createClock();
		expect(clock.peek()).toBeNull();
		clock.schedule(90, Band.ACT, () => {});
		clock.schedule(12, Band.ACT, () => {});
		expect(clock.peek()).toBe(12);
	});
});

describe('clock — ⚓ it jumps, it does not walk', () => {
	it('reaches a task 432 million frames out in one hop', () => {
		// The measured wait-bomb from L3 plan §2: 14 KB of legal `~3600s` tokens
		// is 432,000,000 frames of simulated time. A per-frame loop over that is
		// seconds of frozen tab; this must be instant.
		const clock = createClock();
		let fired = false;
		const FAR = 432_000_000;
		clock.schedule(FAR, Band.ACT, () => (fired = true));
		const t0 = performance.now();
		clock.drain();
		const ms = performance.now() - t0;
		expect(fired).toBe(true);
		expect(clock.now).toBe(FAR);
		expect(ms).toBeLessThan(50);
	});

	it('costs time proportional to TASKS, not to elapsed frames', () => {
		// 20k tasks spread a million frames apart — 2×10^10 frames of span. If
		// anything in here were per-frame this would never return.
		const clock = createClock();
		let n = 0;
		for (let i = 0; i < 20_000; i++) clock.schedule(i * 1_000_000, Band.TICK, () => n++);
		const t0 = performance.now();
		clock.drain();
		const ms = performance.now() - t0;
		expect(n).toBe(20_000);
		expect(ms).toBeLessThan(250);
	});

	it('keeps (frame, band, insertion) order under heap churn', () => {
		// The heap reorders internally; the drained sequence must still be the
		// total order. Deterministic pseudo-random insertion — ⛔ not Math.random,
		// a test that fails one run in fifty is worse than no test.
		const clock = createClock();
		const bands = [Band.EXPIRE, Band.TICK, Band.LAND, Band.ACT];
		const expected: string[] = [];
		const got: string[] = [];
		let x = 1;
		const entries: { frame: number; band: Band; seq: number }[] = [];
		for (let i = 0; i < 2000; i++) {
			x = (x * 1103515245 + 12345) & 0x7fffffff;
			const frame = x % 500;
			const band = bands[(x >> 8) % 4];
			entries.push({ frame, band, seq: i });
			const tag = `${frame}:${band}:${i}`;
			clock.schedule(frame, band, () => got.push(tag));
		}
		entries.sort((a, b) => a.frame - b.frame || a.band - b.band || a.seq - b.seq);
		for (const e of entries) expected.push(`${e.frame}:${e.band}:${e.seq}`);
		clock.drain();
		expect(got).toEqual(expected);
	});
});
