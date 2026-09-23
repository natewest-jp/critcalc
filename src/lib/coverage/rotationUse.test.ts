import { describe, it, expect } from 'vitest';
import type { TimelineEvent } from '$lib/utils/rotationEvents';
import { unusedSegments } from './rotationUse';

const cast = (characterId: string, ability: 'skill' | 'burst') =>
	({ kind: 'cast', characterId, ability }) as unknown as TimelineEvent;
const act = (characterId: string, action: 'normal' | 'charged' | 'plunge' | 'dash') =>
	({ kind: 'action', characterId, action }) as unknown as TimelineEvent;

describe('unusedSegments', () => {
	it('dims the actions a rotation never types, and constellations above the slot', () => {
		const events = [act('a', 'normal'), cast('a', 'skill'), cast('b', 'burst')];
		const dim = unusedSegments(events, 'a', 2);
		expect([...dim].sort()).toEqual(
			[
				'C.application',
				'C.timing',
				'C4',
				'C6',
				'P.application',
				'P.timing',
				'Q.application',
				'Q.grants',
				'Q.timing'
			].sort()
		);
	});

	it('never dims the passives, and reads only its own character', () => {
		const dim = unusedSegments([cast('b', 'skill'), act('b', 'dash')], 'a', 6);
		for (const k of ['A1', 'A4', 'extra', 'C1', 'C6'] as const) expect(dim.has(k)).toBe(false);
		expect(dim.has('E.timing')).toBe(true);
	});
});
