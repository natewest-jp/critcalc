import { describe, it, expect } from 'vitest';
import { computeNBBars } from './nbRows';
import type { TimelineEvent } from '$lib/utils/notationParser';
import type { ActionEvent } from '$lib/utils/rotationEvents';

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

/** One anchor action event (its own group — `blockId === id`). */
function mkAction(
	characterId: string,
	time: number,
	action: ActionEvent['action'] = 'normal'
): ActionEvent {
	const id = nextId++;
	return {
		kind: 'action',
		id,
		characterId,
		action,
		label: action === 'normal' ? 'N1' : action,
		blockId: id,
		time,
		duration: 1
	};
}

/** A follow-up swing in an existing group (non-anchor). */
function mkSwing(anchor: ActionEvent, time: number, comboIndex: number): ActionEvent {
	return { ...anchor, id: nextId++, time, comboIndex };
}

describe('computeNBBars', () => {
	it('returns an empty array when no Natlan units are present', () => {
		const events = [mkCast('a', 0), mkCast('a', 5)];
		expect(computeNBBars(events, new Set(), 0)).toEqual([]);
	});

	it('returns an empty array when there are no triggers', () => {
		expect(computeNBBars([], new Set(), 2)).toEqual([]);
	});

	it('merges E/Q casts across characters into one sorted, cooldown-gated lane', () => {
		// 4 Natlan units → 9s cooldown. Casts at 0, 3, 10, 12 across two chars.
		const events = [
			mkCast('a', 0, 'skill'),
			mkCast('b', 3, 'burst'),
			mkCast('a', 10, 'skill'),
			mkCast('b', 12, 'burst')
		];
		const bars = computeNBBars(events, new Set(), 4);
		// 0 fires (next allowed 9); 3 suppressed; 10 fires (next allowed 19); 12 suppressed.
		expect(bars).toEqual([
			{ start: 0, cooldown: 9 },
			{ start: 10, cooldown: 9 }
		]);
	});

	it('adds catalyst action triggers (skipping movement/unset)', () => {
		// 1 Natlan unit → 18s cooldown. Catalyst 'c' normals also trigger NB.
		const events: TimelineEvent[] = [
			mkAction('c', 2, 'normal'),
			mkAction('c', 4, 'dash'), // skipped
			mkAction('c', 5, 'jump'), // skipped
			mkAction('c', 6, 'unset'), // skipped
			mkAction('c', 25, 'charged')
		];
		const bars = computeNBBars(events, new Set(['c']), 1);
		expect(bars).toEqual([
			{ start: 2, cooldown: 18 },
			{ start: 25, cooldown: 18 }
		]);
	});

	it('triggers once per input token — non-anchor swings do not trigger', () => {
		// An N3 group: anchor at 20 + two follow-up swings. Only the anchor
		// triggers, preserving the legacy per-block cadence.
		const anchor = mkAction('c', 20, 'normal');
		const events: TimelineEvent[] = [anchor, mkSwing(anchor, 20.4, 1), mkSwing(anchor, 20.8, 2)];
		const bars = computeNBBars(events, new Set(['c']), 1);
		expect(bars).toEqual([{ start: 20, cooldown: 18 }]);
	});

	it('ignores action events for non-catalyst characters', () => {
		const events: TimelineEvent[] = [mkAction('m', 1, 'normal'), mkAction('m', 2, 'normal')];
		expect(computeNBBars(events, new Set(), 2)).toEqual([]);
	});

	it('interleaves cast events and catalyst actions by time', () => {
		// 2 Natlan units → 12s cooldown.
		const events: TimelineEvent[] = [
			mkCast('c', 5, 'skill'),
			mkCast('c', 20, 'burst'),
			mkAction('c', 0, 'normal'),
			mkAction('c', 11, 'normal')
		];
		const bars = computeNBBars(events, new Set(['c']), 2);
		// Sorted triggers: 0, 5, 11, 20. 0 fires (→12); 5,11 suppressed; 20 fires.
		expect(bars).toEqual([
			{ start: 0, cooldown: 12 },
			{ start: 20, cooldown: 12 }
		]);
	});

	it('ignores non-cast events (reaction/shieldEnd)', () => {
		const events: TimelineEvent[] = [
			mkCast('a', 4, 'skill'),
			{ kind: 'shieldEnd', id: nextId++, characterId: 'a', ability: 'skill', time: 2 },
			{
				kind: 'reaction',
				id: nextId++,
				characterId: 'a',
				reaction: 'vaporize',
				time: 3,
				castKind: 'skill'
			}
		];
		expect(computeNBBars(events, new Set(), 3)).toEqual([{ start: 4, cooldown: 9 }]);
	});

	it('uses 18/12/9s cooldowns for 1/2/3+ Natlan units', () => {
		const events = [mkCast('a', 0)];
		expect(computeNBBars(events, new Set(), 1)[0].cooldown).toBe(18);
		expect(computeNBBars(events, new Set(), 2)[0].cooldown).toBe(12);
		expect(computeNBBars(events, new Set(), 3)[0].cooldown).toBe(9);
		expect(computeNBBars(events, new Set(), 4)[0].cooldown).toBe(9);
	});
});
