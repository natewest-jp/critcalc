import { describe, it, expect } from 'vitest';
import { computeWeaponProcRows } from './weaponProcRows';
import type { TimelineWindow } from '$lib/utils/rotationEvents';

const procWindow = (characterId: string, start: number, end: number): TimelineWindow => ({
	kind: 'weaponProc',
	characterId,
	start,
	end
});

describe('computeWeaponProcRows', () => {
	it('returns an empty array for no windows', () => {
		expect(computeWeaponProcRows([], {})).toEqual([]);
	});

	it('ignores non-weaponProc windows', () => {
		const windows: TimelineWindow[] = [
			{ kind: 'shield', characterId: 'ganyu', source: 'skill', start: 0, end: 5 }
		];
		expect(computeWeaponProcRows(windows, {})).toEqual([]);
	});

	it('labels rows with the equipped weapon full name', () => {
		const rows = computeWeaponProcRows([procWindow('ganyu', 0.45, 10.45)], {
			ganyu: { weaponId: 'sacrificial_bow', weaponRefinement: 1 }
		});
		expect(rows).toEqual([
			{ characterId: 'ganyu', label: 'Sacrificial Bow', bars: [{ start: 0.45, end: 10.45 }] }
		]);
	});

	it("falls back to 'E reset' when the holder has no resolvable weapon", () => {
		const rows = computeWeaponProcRows([procWindow('ganyu', 1, 2)], {});
		expect(rows).toEqual([
			{ characterId: 'ganyu', label: 'E reset', bars: [{ start: 1, end: 2 }] }
		]);
	});

	it('groups multiple windows for one character into a single row, in order', () => {
		const rows = computeWeaponProcRows(
			[procWindow('ganyu', 0.5, 10.5), procWindow('ganyu', 12, 22)],
			{}
		);
		expect(rows).toEqual([
			{
				characterId: 'ganyu',
				label: 'E reset',
				bars: [
					{ start: 0.5, end: 10.5 },
					{ start: 12, end: 22 }
				]
			}
		]);
	});
});
