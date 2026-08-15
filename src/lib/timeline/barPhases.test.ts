import { describe, it, expect } from 'vitest';
import { barPhases, type BarPhaseBar, type BarPhaseSegment } from './barPhases';

/**
 * Expected segments are computed BY HAND from the pre-3e inline arithmetic
 * (RotationTimeline.svelte E/Q rows + timelineExport.ts collectBarPhases,
 * the two identical twins). Fixtures use binary-exact values (multiples of
 * 0.5) so exact structural equality holds without float slop.
 */

const base: BarPhaseBar = {
	start: 0,
	castTime: 0.5,
	cooldown: 0,
	uptime: 0
};

const bar = (overrides: Partial<BarPhaseBar>): BarPhaseBar => ({ ...base, ...overrides });

describe('barPhases — case 1: sac-proc reset', () => {
	it('uptime > 0 → single dim bar at the field-start, spanning the duration', () => {
		// fieldOffset 0, fieldStart 3; span = uptime = 2; start = fieldStart = 3
		expect(barPhases(bar({ start: 3, cooldown: 0, uptime: 2, sacProcFired: true }), false)).toEqual(
			[{ role: 'uptimeDim', start: 3, span: 2 }] satisfies BarPhaseSegment[]
		);
	});

	it('uptime = 0 (instant) → dim bar at bar.start, spanning the cast time', () => {
		// span = castTime = 0.5; start = bar.start = 5
		expect(
			barPhases(bar({ start: 5, castTime: 0.5, cooldown: 0, uptime: 0, sacProcFired: true }), false)
		).toEqual([{ role: 'uptimeDim', start: 5, span: 0.5 }] satisfies BarPhaseSegment[]);
	});

	it('applies the summonActivatesAt field offset to the dim bar start', () => {
		// summonActivatesAt 30 → fieldOffset 0.5 → fieldStart 2.5; span = uptime = 3
		expect(
			barPhases(bar({ start: 2, uptime: 3, summonActivatesAt: 30, sacProcFired: true }), false)
		).toEqual([{ role: 'uptimeDim', start: 2.5, span: 3 }] satisfies BarPhaseSegment[]);
	});

	it('takes precedence over the stance/summon branches (hasSummon true, uptime > 0)', () => {
		expect(barPhases(bar({ start: 0, uptime: 4, sacProcFired: true }), true)).toEqual([
			{ role: 'uptimeDim', start: 0, span: 4 }
		] satisfies BarPhaseSegment[]);
	});
});

describe('barPhases — case 2A: stance, cooldown outlasts window', () => {
	it('uptime bar + ghost CD remainder (no field offset)', () => {
		// cooldown 16 >= 0 + 9 → case A; cdSpan = 16 - 0 - 9 = 7; ghost start 1+9=10
		expect(barPhases(bar({ start: 1, cooldown: 16, uptime: 9 }), false)).toEqual([
			{ role: 'uptime', start: 1, span: 9 },
			{ role: 'ghost', start: 10, span: 7, cooldown: 16 }
		] satisfies BarPhaseSegment[]);
	});

	it('applies the field offset to both the uptime bar and the ghost', () => {
		// summonActivatesAt 60 → fieldOffset 1 → fieldStart 3; cooldown 12 >= 1+6=7 → case A
		// cdSpan = 12 - 1 - 6 = 5; ghost start = 3 + 6 = 9
		expect(
			barPhases(bar({ start: 2, cooldown: 12, uptime: 6, summonActivatesAt: 60 }), false)
		).toEqual([
			{ role: 'uptime', start: 3, span: 6 },
			{ role: 'ghost', start: 9, span: 5, cooldown: 12 }
		] satisfies BarPhaseSegment[]);
	});

	it('omits the ghost when the cooldown exactly equals the window end (cdSpan = 0)', () => {
		// cooldown 5 >= 0 + 5 → case A; cdSpan = 5 - 0 - 5 = 0 (not > 0)
		expect(barPhases(bar({ start: 0, cooldown: 5, uptime: 5 }), false)).toEqual([
			{ role: 'uptime', start: 0, span: 5 }
		] satisfies BarPhaseSegment[]);
	});
});

describe('barPhases — case 2B: stance, window outlasts cooldown', () => {
	it('first phase up to CD + dim overflow past it (no field offset)', () => {
		// cooldown 4 < 0 + 10 → case B
		// phase1 span = cooldown - fieldOffset = 4; overflow start = start + cooldown = 5,
		// overflow span = fieldOffset + uptime - cooldown = 0 + 10 - 4 = 6
		expect(barPhases(bar({ start: 1, cooldown: 4, uptime: 10 }), false)).toEqual([
			{ role: 'uptimeFlush', start: 1, span: 4 },
			{ role: 'overflow', start: 5, span: 6 }
		] satisfies BarPhaseSegment[]);
	});

	it('applies the field offset to phase-1 span and overflow start', () => {
		// summonActivatesAt 60 → fieldOffset 1 → fieldStart 3; cooldown 5 < 1+8=9 → case B
		// phase1 span = 5 - 1 = 4; overflow start = 2 + 5 = 7; overflow span = 1 + 8 - 5 = 4
		expect(
			barPhases(bar({ start: 2, cooldown: 5, uptime: 8, summonActivatesAt: 60 }), false)
		).toEqual([
			{ role: 'uptimeFlush', start: 3, span: 4 },
			{ role: 'overflow', start: 7, span: 4 }
		] satisfies BarPhaseSegment[]);
	});
});

describe('barPhases — case 3: single-phase (cast + ghost CD)', () => {
	it('cast bar + ghost CD remainder (uptime = 0)', () => {
		// single-phase; cast (0, 0.5); cdSpan = 6 - 0.5 = 5.5; ghost start = 0 + 0.5 = 0.5
		expect(barPhases(bar({ start: 0, castTime: 0.5, cooldown: 6, uptime: 0 }), false)).toEqual([
			{ role: 'uptime', start: 0, span: 0.5 },
			{ role: 'ghost', start: 0.5, span: 5.5, cooldown: 6 }
		] satisfies BarPhaseSegment[]);
	});

	it('hasSummon = true collapses a stance-style bar (uptime > 0) to single-phase', () => {
		// uptime 15 > 0 but hasSummon true → single-phase; cdSpan = 20 - 0.5 = 19.5; ghost start 3.5
		expect(barPhases(bar({ start: 3, castTime: 0.5, cooldown: 20, uptime: 15 }), true)).toEqual([
			{ role: 'uptime', start: 3, span: 0.5 },
			{ role: 'ghost', start: 3.5, span: 19.5, cooldown: 20 }
		] satisfies BarPhaseSegment[]);
	});

	it('omits the ghost when the cooldown does not outlast the cast (cdSpan <= 0)', () => {
		// single-phase; cdSpan = 2 - 2 = 0 (not > 0)
		expect(barPhases(bar({ start: 1, castTime: 2, cooldown: 2, uptime: 0 }), false)).toEqual([
			{ role: 'uptime', start: 1, span: 2 }
		] satisfies BarPhaseSegment[]);
	});
});

/**
 * Delayed cooldown starts (2026-08-15). A skill's cooldown clock does not
 * start on the press — `Ability.cooldownStartDelay` (frames) offsets it, and
 * 124 abilities carry one. The ghost tail must end where the ability is
 * actually castable (`readyAt`), not at `start + cooldown`.
 */
describe('barPhases — delayed cooldown start (readyAt)', () => {
	it('no readyAt → identical to the pre-2026-08-15 geometry', () => {
		const b = bar({ castTime: 0.5, cooldown: 4, uptime: 0 });
		expect(barPhases(b, false)).toEqual([
			{ role: 'uptime', start: 0, span: 0.5 },
			{ role: 'ghost', start: 0.5, span: 3.5, cooldown: 4 }
		] satisfies BarPhaseSegment[]);
	});

	// Nahida's shape: cooldownStartDelay 11f, so readyAt = 5.183 while the
	// cooldown is 5. The tail stretches; the LABEL still names the length.
	it('an instant cast stretches its ghost tail to readyAt, label unchanged', () => {
		const b = bar({ castTime: 0.5, cooldown: 5, uptime: 0, readyAt: 5.5 });
		expect(barPhases(b, false)).toEqual([
			{ role: 'uptime', start: 0, span: 0.5 },
			{ role: 'ghost', start: 0.5, span: 5, cooldown: 5 }
		] satisfies BarPhaseSegment[]);
	});

	// ⚓ THE CASE FLIP, and the reason this is worth a test. Xilonen's shape:
	// uptime 9, cooldown 7, but the CD clock only starts when Nightsoul ENDS
	// (gcsim sets it inside exitNightsoul), so readyAt = 16. Read off `cooldown`
	// alone this takes case B — "cooldown finished, stance still running" —
	// which told Nate he could recast at 7s when the parser placed it at 16s.
	// With readyAt it takes case A and the chart explains itself: the stance
	// runs to 9, then a 7s ghost.
	it('⛔ a stance whose CD starts at stance END takes case A, not case B', () => {
		const b = bar({ castTime: 0.5, cooldown: 7, uptime: 9, readyAt: 16 });
		expect(barPhases(b, false)).toEqual([
			{ role: 'uptime', start: 0, span: 9 },
			{ role: 'ghost', start: 9, span: 7, cooldown: 7 }
		] satisfies BarPhaseSegment[]);
	});

	it('a stance that genuinely outlasts its cooldown still takes case B', () => {
		// Hu Tao's shape — a small animation offset does not flip the case.
		const b = bar({ castTime: 0.5, cooldown: 4, uptime: 9, readyAt: 4.25 });
		expect(barPhases(b, false)).toEqual([
			{ role: 'uptimeFlush', start: 0, span: 4.25 },
			{ role: 'overflow', start: 4.25, span: 4.75 }
		] satisfies BarPhaseSegment[]);
	});

	it('a sac proc still wins over readyAt — the CD was reset, not delayed', () => {
		const b = bar({ cooldown: 7, uptime: 9, readyAt: 16, sacProcFired: true });
		expect(barPhases(b, false)).toEqual([
			{ role: 'uptimeDim', start: 0, span: 9 }
		] satisfies BarPhaseSegment[]);
	});
});
