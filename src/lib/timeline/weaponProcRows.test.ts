import { describe, it, expect } from 'vitest';
import { computeWeaponProcRows } from './weaponProcRows';

describe('computeWeaponProcRows', () => {
	it('returns an empty array for no proc bars', () => {
		expect(computeWeaponProcRows(new Map(), {})).toEqual([]);
	});

	it('skips characters whose proc-bar list is empty', () => {
		expect(computeWeaponProcRows(new Map([['ganyu', []]]), {})).toEqual([]);
	});

	it('labels rows with the equipped weapon shortName ?? name', () => {
		const bars = [{ start: 0.45, end: 10.45 }];
		const rows = computeWeaponProcRows(new Map([['ganyu', bars]]), {
			ganyu: { weaponId: 'sacrificial_bow', weaponRefinement: 1 }
		});
		expect(rows).toEqual([{ characterId: 'ganyu', label: 'Sacrificial Bow', bars }]);
	});

	it("falls back to 'E reset' when the holder has no resolvable weapon", () => {
		const bars = [{ start: 1, end: 2 }];
		const rows = computeWeaponProcRows(new Map([['ganyu', bars]]), {});
		expect(rows).toEqual([{ characterId: 'ganyu', label: 'E reset', bars }]);
	});
});
