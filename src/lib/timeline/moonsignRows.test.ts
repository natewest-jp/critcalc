import { describe, it, expect } from 'vitest';
import { computeMoonsignRows } from './moonsignRows';
import type { CharacterTrack, TimelineBar } from '$lib/utils/notationParser';

function mkBar(start: number, label = 'E'): TimelineBar {
	return { start, uptime: 0, cooldown: 10, label, castTime: 0.5 };
}

function mkTrack(characterId: string, over: Partial<CharacterTrack> = {}): CharacterTrack {
	return {
		characterId,
		displayName: characterId,
		element: 'pyro',
		activeStart: 0,
		activeEnd: 10,
		inputBlocks: [],
		hasUnsetDuration: false,
		eBars: [],
		qBars: [],
		...over
	};
}

describe('computeMoonsignRows', () => {
	it('returns an empty array when no slots qualify', () => {
		expect(computeMoonsignRows([], [], ['a', 'b', 'c', 'd'])).toEqual([]);
	});

	it('emits an empty-window row for a qualifying slot with no casts', () => {
		expect(computeMoonsignRows([], [2], ['a', 'b', 'c', 'd'])).toEqual([
			{ slotIdx: 2, windows: [] }
		]);
	});

	it('emits one 20s window per E/Q cast, sorted chronologically', () => {
		const tracks = [
			mkTrack('c', { eBars: [mkBar(8)], qBars: [mkBar(1, 'Q')] }),
			mkTrack('d', { eBars: [mkBar(3)] })
		];
		const rows = computeMoonsignRows(tracks, [2], ['a', 'b', 'c', 'd']);
		expect(rows).toEqual([
			{
				slotIdx: 2,
				windows: [
					{ start: 1, duration: 20 },
					{ start: 8, duration: 20 }
				]
			}
		]);
	});

	it('collects casts across multiple tracks of the same character', () => {
		const tracks = [
			mkTrack('c', { activeEnd: 5, eBars: [mkBar(0)] }),
			mkTrack('other', { activeStart: 5, activeEnd: 8 }),
			mkTrack('c', { activeStart: 8, activeEnd: 12, eBars: [mkBar(9)] })
		];
		const rows = computeMoonsignRows(tracks, [0], ['c', 'other', 'blank', 'blank']);
		expect(rows[0].windows.map((w) => w.start)).toEqual([0, 9]);
	});
});
