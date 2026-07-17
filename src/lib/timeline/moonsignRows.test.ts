import { describe, it, expect } from 'vitest';
import { computeMoonsignRows } from './moonsignRows';
import type { TimelineEvent } from '$lib/utils/notationParser';

function mkCast(
	characterId: string,
	time: number,
	ability: 'skill' | 'burst' = 'skill'
): TimelineEvent {
	return {
		kind: 'cast',
		characterId,
		ability,
		abilityId: characterId,
		label: ability === 'burst' ? 'Q' : 'E',
		time,
		castTime: 0.5,
		fieldStart: time
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
		const events = [mkCast('c', 8, 'skill'), mkCast('c', 1, 'burst'), mkCast('d', 3, 'skill')];
		const rows = computeMoonsignRows(events, [2], ['a', 'b', 'c', 'd']);
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

	it('collects casts for a character regardless of source ordering', () => {
		const events = [mkCast('c', 0, 'skill'), mkCast('other', 5), mkCast('c', 9, 'skill')];
		const rows = computeMoonsignRows(events, [0], ['c', 'other', 'blank', 'blank']);
		expect(rows[0].windows.map((w) => w.start)).toEqual([0, 9]);
	});

	it('ignores non-cast events', () => {
		const events: TimelineEvent[] = [
			mkCast('c', 4, 'skill'),
			{ kind: 'hit', characterId: 'c', element: 'pyro', time: 2, castKind: 'skill' },
			{ kind: 'reaction', characterId: 'c', reaction: 'vaporize', time: 3, castKind: 'skill' }
		];
		const rows = computeMoonsignRows(events, [0], ['c', 'x', 'y', 'z']);
		expect(rows[0].windows).toEqual([{ start: 4, duration: 20 }]);
	});
});
