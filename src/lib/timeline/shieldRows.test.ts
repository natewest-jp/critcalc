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

	// The names arrived 2026-08-14 with `ShieldEffect.label`; before that every
	// row read "Shield" because the name lived on a stand-in summon.
	it('uses the shield’s own name, and falls back only when it has none', () => {
		const rows = computeShieldSubrows(
			[shield('layla', 0, 12, { label: 'Curtain of Slumber' }), shield('diona', 0, 4.8)],
			slotIdxFor
		);
		expect(rows.map((r) => r.label)).toEqual(['Curtain of Slumber', 'Shield']);
	});

	// Same rule the summon lane uses: one row per (character, label). Thoma
	// shields off E and Q under one name and keeps one row; two differently
	// named shields are two different things.
	it('splits rows by name but merges sources sharing one', () => {
		const rows = computeShieldSubrows(
			[
				shield('thoma', 0, 8, { label: 'Blazing Barrier' }),
				shield('thoma', 10, 18, { source: 'burst', label: 'Blazing Barrier' }),
				shield('thoma', 2, 6, { source: 'burst', label: 'Scorching Ooyoroi' })
			],
			slotIdxFor
		);
		expect(rows.map((r) => r.label)).toEqual(['Blazing Barrier', 'Scorching Ooyoroi']);
		expect(rows[0].bars).toHaveLength(2);
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
