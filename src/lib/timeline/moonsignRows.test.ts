import { describe, it, expect } from 'vitest';
import { computeMoonsignRows } from './moonsignRows';
import type { TimelineEvent } from '$lib/utils/notationParser';

let nextId = 0;
function mkCast(
	characterId: string,
	time: number,
	ability: 'skill' | 'burst' = 'skill'
): TimelineEvent {
	return {
		kind: 'cast',
		id: nextId++,
		characterId,
		ability,
		abilityId: characterId,
		label: ability === 'burst' ? 'Q' : 'E',
		time,
		castTime: 0.5,
		uptime: 0,
		cooldown: 10,
		readyAt: time + 10,
		summonActivatesAt: 0,
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

	// ↻ 2026-08-15: casts inside 20s of each other now merge into ONE window.
	// Two casts at 1 and 8 used to draw two bars with two identical
	// "· Ascendant Gleam" labels; they are one covered span from 1 to 28.
	it('merges overlapping windows into one covered span', () => {
		const events = [mkCast('c', 8, 'skill'), mkCast('c', 1, 'burst'), mkCast('d', 3, 'skill')];
		const rows = computeMoonsignRows(events, [2], ['a', 'b', 'c', 'd']);
		expect(rows).toEqual([{ slotIdx: 2, windows: [{ start: 1, duration: 27 }] }]);
	});

	it('emits one 20s window per cast when they do NOT overlap', () => {
		const events = [mkCast('c', 0, 'skill'), mkCast('c', 25, 'burst')];
		const rows = computeMoonsignRows(events, [2], ['a', 'b', 'c', 'd']);
		expect(rows[0].windows).toEqual([
			{ start: 0, duration: 20 },
			{ start: 25, duration: 20 }
		]);
	});

	it('collects casts for a character regardless of source ordering', () => {
		const events = [mkCast('c', 0, 'skill'), mkCast('other', 5), mkCast('c', 9, 'skill')];
		const rows = computeMoonsignRows(events, [0], ['c', 'other', 'blank', 'blank']);
		// Both inside 20s of each other — one span, 0 → 29.
		expect(rows[0].windows).toEqual([{ start: 0, duration: 29 }]);
	});

	it('ignores non-cast events', () => {
		const events: TimelineEvent[] = [
			mkCast('c', 4, 'skill'),
			{ kind: 'shieldEnd', id: 90, characterId: 'c', ability: 'skill', time: 2 },
			{
				kind: 'reaction',
				id: 91,
				characterId: 'c',
				reaction: 'vaporize',
				time: 3,
				castKind: 'skill'
			}
		];
		const rows = computeMoonsignRows(events, [0], ['c', 'x', 'y', 'z']);
		expect(rows[0].windows).toEqual([{ start: 4, duration: 20 }]);
	});
});
