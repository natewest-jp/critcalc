import { afterEach, describe, it, expect } from 'vitest';
import { overwriteGetLocale } from '$lib/paraglide/runtime';
import { formatBuffDisplayValue, resShredDisplayStat } from './buffDisplay';
import type { BuffValue } from '$lib/types/ability';

describe('formatBuffDisplayValue — perTeamCount (G2)', () => {
	it('formats element-count scaling as a per-ally formula with cap (pct stat)', () => {
		const v: BuffValue = { type: 'perTeamCount', count: { elements: ['geo'] }, per: 15, cap: 45 };
		expect(formatBuffDisplayValue('def%', v, 0)).toBe('+15%/Geo ally (cap 45%)');
	});

	it('formats faction-count scaling as a per-member formula (no cap)', () => {
		const v: BuffValue = { type: 'perTeamCount', count: { faction: 'hexerei' }, per: 10 };
		expect(formatBuffDisplayValue('atk%', v, 0)).toBe('+10%/Hexerei member');
	});

	it('omits the percent sign for a non-pct stat (EM)', () => {
		const v: BuffValue = {
			type: 'perTeamCount',
			count: { elements: ['hydro'] },
			per: 60,
			cap: 180
		};
		expect(formatBuffDisplayValue('em', v, 0)).toBe('+60/Hydro ally (cap 180)');
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

describe('formatBuffDisplayValue — in the page language', () => {
	afterEach(() => overwriteGetLocale(() => 'en'));

	// The fragments around a value ("/stack", "(cap N)") and the ids inside one
	// (an element, a faction) are words, so they follow the page's language.
	it('writes the per-stack form, the cap, and the per-member unit in Japanese', () => {
		overwriteGetLocale(() => 'ja');
		const perStack: BuffValue = { type: 'perStack', key: 'k', per: 5, cap: 20 };
		expect(formatBuffDisplayValue('atk%', perStack, 0)).toBe('1層ごとに+5%（上限20）');
		const perMember: BuffValue = { type: 'perTeamCount', count: { faction: 'moonsign' }, per: 10 };
		expect(formatBuffDisplayValue('atk%', perMember, 0)).toBe('+10%/月兆のメンバー');
	});

	it('keeps the English forms in English', () => {
		const perStack: BuffValue = { type: 'perStack', key: 'k', per: 5, cap: 20 };
		expect(formatBuffDisplayValue('atk%', perStack, 0)).toBe('+5%/stack (cap 20)');
	});
});
