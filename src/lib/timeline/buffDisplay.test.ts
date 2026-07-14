import { describe, it, expect } from 'vitest';
import { formatBuffDisplayValue, resShredDisplayStat } from './buffDisplay';
import type { BuffValue } from '$lib/types/ability';

describe('formatBuffDisplayValue — perTeamCount (G2)', () => {
	it('formats element-count scaling as a per-ally formula with cap (pct stat)', () => {
		const v: BuffValue = { type: 'perTeamCount', count: { elements: ['geo'] }, per: 15, cap: 45 };
		expect(formatBuffDisplayValue('def%', v, 0)).toBe('+15%/geo ally (cap 45%)');
	});

	it('formats faction-count scaling as a per-member formula (no cap)', () => {
		const v: BuffValue = { type: 'perTeamCount', count: { faction: 'hexerei' }, per: 10 };
		expect(formatBuffDisplayValue('atk%', v, 0)).toBe('+10%/hexerei member');
	});

	it('omits the percent sign for a non-pct stat (EM)', () => {
		const v: BuffValue = {
			type: 'perTeamCount',
			count: { elements: ['hydro'] },
			per: 60,
			cap: 180
		};
		expect(formatBuffDisplayValue('em', v, 0)).toBe('+60/hydro ally (cap 180)');
	});
});

describe('resShredDisplayStat — DEF shred (G6)', () => {
	it("maps shredStat 'def' to the def% display key", () => {
		expect(resShredDisplayStat(undefined, 'def')).toBe('def%');
	});
	it('maps an element RES shred to the matching elementRes key', () => {
		expect(resShredDisplayStat('cryo')).toBe('cryoRes');
		expect(resShredDisplayStat(undefined)).toBe('allElementalRes');
	});
});
