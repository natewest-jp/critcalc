import { describe, it, expect } from 'vitest';
import { computeShieldSubrows } from './shieldRows';
import type { TimelineWindow } from '$lib/utils/notationParser';

const shield = (
	characterId: string,
	start: number,
	end: number,
	extra: Partial<Extract<TimelineWindow, { kind: 'shield' }>> = {}
): TimelineWindow =>
	({
		kind: 'shield',
		characterId,
		source: 'skill',
		start,
		end,
		...extra
	}) as TimelineWindow;

const slots: Record<string, number> = { layla: 0, thoma: 1, diona: 2 };
const slotIdxFor = (id: string) => slots[id];

describe('computeShieldSubrows', () => {
	it('projects a shield window into a labelled lane row', () => {
		const rows = computeShieldSubrows([shield('diona', 0, 4.8)], slotIdxFor);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ slotIdx: 2, characterId: 'diona', label: 'Shield' });
		expect(rows[0].bars).toEqual([{ start: 0, end: 4.8, source: 'skill', ticks: [] }]);
	});

	// The whole reason `coveredBySummon` exists: nine abilities author their
	// shield as a zero-effect `summons[]` entry, which the summon lane already
	// draws. Drawing it here too would put the same span on the chart twice.
	it('SKIPS a shield already drawn as its stand-in summon', () => {
		const rows = computeShieldSubrows(
			[shield('layla', 0, 12, { coveredBySummon: true }), shield('diona', 0, 4.8)],
			slotIdxFor
		);
		expect(rows.map((r) => r.characterId)).toEqual(['diona']);
	});

	// Mirrors the summon lane's one-sub-row-per-label rule. Thoma shields off
	// both E and Q; two rows both reading "Shield" would be indistinguishable.
	it('gives a character ONE row carrying every source', () => {
		const rows = computeShieldSubrows(
			[shield('thoma', 0, 8), shield('thoma', 10, 18, { source: 'burst' })],
			slotIdxFor
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].bars.map((b) => b.source)).toEqual(['skill', 'burst']);
	});

	it('orders a row’s bars chronologically regardless of window order', () => {
		const rows = computeShieldSubrows(
			[shield('diona', 20, 24.8), shield('diona', 0, 4.8)],
			slotIdxFor
		);
		expect(rows[0].bars.map((b) => b.start)).toEqual([0, 20]);
	});

	it('drops unslotted characters and zero-length spans', () => {
		expect(computeShieldSubrows([shield('ganyu', 0, 12)], slotIdxFor)).toEqual([]);
		expect(computeShieldSubrows([shield('diona', 3, 3)], slotIdxFor)).toEqual([]);
	});

	it('ignores every non-shield window kind', () => {
		const summon = {
			kind: 'summon',
			characterId: 'diona',
			label: 'Drunken Mist',
			start: 0,
			end: 12,
			source: 'burst'
		} as TimelineWindow;
		expect(computeShieldSubrows([summon], slotIdxFor)).toEqual([]);
	});
});
