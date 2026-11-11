import { describe, it, expect } from 'vitest';
import { cycleAt, inThisCycle, lineupCycle } from './endgameCycle';
import { liveAbyssCycles } from './endgame';
import type { LineupBody } from './storage/records';

/**
 * Which cycle a lineup was planned for (⚓ Nate 2026-11-11): an edited lineup
 * is an archive of its cycle, an untouched one follows the game. The dates
 * stand inside the committed data: Stygian 7.1 (2026-09-30 → 11-11) and 7.2,
 * the Abyss cycles from 2026-09-16 a month apart, Theater from 2026-09-01.
 */

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const at = (iso: string) => day(iso).getTime();

const team = (...slots: (string | null)[]) => ({ id: 't', slots });
const body = (b: Partial<LineupBody> & Pick<LineupBody, 'preset'>): LineupBody => ({
	noRepeats: true,
	teams: [team(null, null, null, null)],
	...b
});

describe('cycleAt', () => {
	it('names each endgame’s running cycle by the string a lineup stores', () => {
		expect(cycleAt('stygian', day('2026-11-01'))).toBe('7.1');
		expect(cycleAt('stygian', day('2026-11-11'))).toBe('7.2');
		expect(cycleAt('abyss', day('2026-11-01'))).toBe('2026-10-16');
		expect(cycleAt('theater', day('2026-11-11'))).toBe('2026-11-01');
	});
});

describe('liveAbyssCycles', () => {
	it('lists only the cycles that have opened, newest first', () => {
		const starts = liveAbyssCycles(day('2026-11-11')).map((c) => c.start);
		expect(starts.slice(0, 2)).toEqual(['2026-10-16', '2026-09-16']);
		expect(starts).not.toContain('2026-11-16');
	});
});

describe('lineupCycle', () => {
	const today = day('2026-11-11');

	it('keeps the cycle a lineup stores, after the game moves on', () => {
		const b = body({ preset: 'stygian', season: '7.1', teams: [team('furina')] });
		expect(lineupCycle(b, at('2026-10-20'), today)).toBe('7.1');
		expect(inThisCycle(b, at('2026-10-20'), today)).toBe(false);
	});

	it('lets an untouched lineup follow the running cycle', () => {
		const b = body({ preset: 'abyss' });
		expect(lineupCycle(b, at('2026-09-20'), today)).toBe('2026-10-16');
		expect(inThisCycle(b, at('2026-09-20'), today)).toBe(true);
	});

	it('reads an unpinned Abyss lineup with anyone in it as the cycle of its last edit', () => {
		const b = body({ preset: 'abyss', teams: [team('furina'), team(null)] });
		expect(lineupCycle(b, at('2026-09-20'), today)).toBe('2026-09-16');
		expect(inThisCycle(b, at('2026-09-20'), today)).toBe(false);
		expect(inThisCycle(b, at('2026-10-20'), today)).toBe(true);
	});

	it('reads a Theater lineup’s season from its plan', () => {
		const b = body({
			preset: 'theater',
			teams: [],
			theater: { season: '2026-10-01', cast: ['furina'] }
		});
		expect(lineupCycle(b, at('2026-10-05'), today)).toBe('2026-10-01');
		expect(inThisCycle(b, at('2026-10-05'), today)).toBe(false);
	});

	it('gives a Custom lineup no cycle', () => {
		const b = body({ preset: 'custom', teams: [team('furina')] });
		expect(lineupCycle(b, at('2026-11-11'), today)).toBeUndefined();
		expect(inThisCycle(b, at('2026-11-11'), today)).toBe(false);
	});
});
