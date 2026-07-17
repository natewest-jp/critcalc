import { describe, it, expect } from 'vitest';
import { computeNBBars } from './nbRows';
import type { CharacterTrack, TimelineEvent } from '$lib/utils/notationParser';
import type { InputBlock } from '$lib/utils/notationParser';

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

function mkBlock(start: number, kind: InputBlock['kind']): InputBlock {
	return { start, duration: 1, parts: [kind], kind };
}

function mkTrack(characterId: string, inputBlocks: InputBlock[] = []): CharacterTrack {
	return {
		characterId,
		displayName: characterId,
		element: 'pyro',
		activeStart: 0,
		activeEnd: 0,
		inputBlocks,
		hasUnsetDuration: false,
		eBars: [],
		qBars: []
	};
}

describe('computeNBBars', () => {
	it('returns an empty array when no Natlan units are present', () => {
		const events = [mkCast('a', 0), mkCast('a', 5)];
		expect(computeNBBars(events, [mkTrack('a')], new Set(), 0)).toEqual([]);
	});

	it('returns an empty array when there are no triggers', () => {
		expect(computeNBBars([], [], new Set(), 2)).toEqual([]);
	});

	it('merges E/Q casts across characters into one sorted, cooldown-gated lane', () => {
		// 4 Natlan units → 9s cooldown. Casts at 0, 3, 10, 12 across two chars.
		const events = [
			mkCast('a', 0, 'skill'),
			mkCast('b', 3, 'burst'),
			mkCast('a', 10, 'skill'),
			mkCast('b', 12, 'burst')
		];
		const bars = computeNBBars(events, [mkTrack('a'), mkTrack('b')], new Set(), 4);
		// 0 fires (next allowed 9); 3 suppressed; 10 fires (next allowed 19); 12 suppressed.
		expect(bars).toEqual([
			{ start: 0, cooldown: 9 },
			{ start: 10, cooldown: 9 }
		]);
	});

	it('adds catalyst inputBlock triggers (skipping movement/unset)', () => {
		// 1 Natlan unit → 18s cooldown. Catalyst 'c' normals also trigger NB.
		const track = mkTrack('c', [
			mkBlock(2, 'normal'),
			mkBlock(4, 'movement'), // skipped
			mkBlock(6, 'unset'), // skipped
			mkBlock(25, 'elemental-normal')
		]);
		const bars = computeNBBars([], [track], new Set(['c']), 1);
		expect(bars).toEqual([
			{ start: 2, cooldown: 18 },
			{ start: 25, cooldown: 18 }
		]);
	});

	it('ignores inputBlocks for non-catalyst characters', () => {
		const track = mkTrack('m', [mkBlock(1, 'normal'), mkBlock(2, 'normal')]);
		expect(computeNBBars([], [track], new Set(), 2)).toEqual([]);
	});

	it('interleaves cast events and catalyst inputBlocks by time', () => {
		// 2 Natlan units → 12s cooldown.
		const events = [mkCast('c', 5, 'skill'), mkCast('c', 20, 'burst')];
		const track = mkTrack('c', [mkBlock(0, 'normal'), mkBlock(11, 'normal')]);
		const bars = computeNBBars(events, [track], new Set(['c']), 2);
		// Sorted triggers: 0, 5, 11, 20. 0 fires (→12); 5,11 suppressed; 20 fires.
		expect(bars).toEqual([
			{ start: 0, cooldown: 12 },
			{ start: 20, cooldown: 12 }
		]);
	});

	it('ignores non-cast events (reaction/shieldEnd)', () => {
		const events: TimelineEvent[] = [
			mkCast('a', 4, 'skill'),
			{ kind: 'shieldEnd', id: 90, characterId: 'a', ability: 'skill', time: 2 },
			{
				kind: 'reaction',
				id: 91,
				characterId: 'a',
				reaction: 'vaporize',
				time: 3,
				castKind: 'skill'
			}
		];
		expect(computeNBBars(events, [mkTrack('a')], new Set(), 3)).toEqual([
			{ start: 4, cooldown: 9 }
		]);
	});

	it('uses 18/12/9s cooldowns for 1/2/3+ Natlan units', () => {
		const events = [mkCast('a', 0)];
		expect(computeNBBars(events, [], new Set(), 1)[0].cooldown).toBe(18);
		expect(computeNBBars(events, [], new Set(), 2)[0].cooldown).toBe(12);
		expect(computeNBBars(events, [], new Set(), 3)[0].cooldown).toBe(9);
		expect(computeNBBars(events, [], new Set(), 4)[0].cooldown).toBe(9);
	});
});
