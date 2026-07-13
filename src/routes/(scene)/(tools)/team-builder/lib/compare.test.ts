import { describe, expect, it } from 'vitest';
import type { Ability } from '$lib/types/ability';
import type { DerivedCapability } from '$lib/capabilities/deriveCapabilities';
import { buildCompareModel, glyphScaleSeconds, type CompareCharacter } from './compare';

// ---------------------------------------------------------------------------
// Fixtures — minimal shapes; the model only reads the fields it aligns on.
// ---------------------------------------------------------------------------

const skill = (cooldown: number, charges?: number) =>
	({ abilityType: 'skill', behavior: 'instant', cooldown, charges }) as unknown as Ability;

const burst = (cooldown: number, energyCost: number) =>
	({ abilityType: 'burst', behavior: 'instant', cooldown, energyCost }) as unknown as Ability;

const cap = (partial: Partial<DerivedCapability> & { kind: DerivedCapability['kind'] }) =>
	({
		minConstellation: 0,
		caveats: [],
		via: 'effect',
		source: { section: 'ability', abilityId: 'x', abilityName: 'Some Ability' },
		...partial
	}) as DerivedCapability;

const char = (id: string, over: Partial<CompareCharacter> = {}): CompareCharacter => ({
	id,
	curated: true,
	abilities: [],
	capabilities: [],
	...over
});

// ---------------------------------------------------------------------------

describe('buildCompareModel — timing rows', () => {
	it('aligns E cooldown, Q cooldown, Q energy across characters', () => {
		const model = buildCompareModel([
			char('a', { abilities: [skill(15), burst(20, 60)] }),
			char('b', { abilities: [skill(21, 2), burst(15, 40)] })
		]);
		const byKey = Object.fromEntries(model.timingRows.map((r) => [r.key, r.cells]));
		expect(byKey['skill-cd']).toEqual(['15s', '21s ×2']);
		expect(byKey['burst-cd']).toEqual(['20s', '15s']);
		expect(byKey['burst-cost']).toEqual(['60', '40']);
	});

	it('renders null cells for kits missing a value, drops all-null rows', () => {
		const model = buildCompareModel([
			char('a', { abilities: [skill(12)] }),
			char('b', { abilities: [] })
		]);
		const byKey = Object.fromEntries(model.timingRows.map((r) => [r.key, r.cells]));
		expect(byKey['skill-cd']).toEqual(['12s', null]);
		expect(byKey['burst-cd']).toBeUndefined();
		expect(byKey['burst-cost']).toBeUndefined();
	});

	it('joins multiple skills of one kit into a single cell', () => {
		const model = buildCompareModel([char('a', { abilities: [skill(10), skill(18)] })]);
		expect(model.timingRows[0].cells).toEqual(['10s / 18s']);
	});
});

describe('buildCompareModel — capability rows', () => {
	it('unions row keys across characters in kind order, null where absent', () => {
		const model = buildCompareModel([
			char('a', { capabilities: [cap({ kind: 'heal', target: 'team' })] }),
			char('b', { capabilities: [cap({ kind: 'shield', target: 'team' })] })
		]);
		expect(model.capRows.map((r) => r.key)).toEqual(['heal', 'shield']);
		expect(model.capRows[0].cells[0]).not.toBeNull();
		expect(model.capRows[0].cells[1]).toBeNull();
		expect(model.capRows[1].cells[0]).toBeNull();
		expect(model.capRows[1].cells[1]).not.toBeNull();
	});

	it('splits buffs into family rows (facet-aligned granularity)', () => {
		const model = buildCompareModel([
			char('a', {
				capabilities: [
					cap({ kind: 'buff', detail: 'baseAtk', target: 'team' }),
					cap({ kind: 'buff', detail: 'em', target: 'team' })
				]
			})
		]);
		expect(model.capRows.map((r) => r.key)).toEqual(['buff:atk', 'buff:em']);
		expect(model.capRows.map((r) => r.label)).toEqual(['ATK buff', 'EM buff']);
	});

	it('keeps the lowest constellation gate and its conditional flag', () => {
		const model = buildCompareModel([
			char('a', {
				capabilities: [
					cap({ kind: 'heal', target: 'self', minConstellation: 4 }),
					cap({ kind: 'heal', target: 'self', minConstellation: 1, caveats: ['selfHp'] })
				]
			})
		]);
		const cell = model.capRows[0].cells[0]!;
		expect(cell.minCon).toBe(1);
		expect(cell.conditional).toBe(true);
	});

	it('an unconditional source at the gate clears the conditional flag', () => {
		const model = buildCompareModel([
			char('a', {
				capabilities: [
					cap({ kind: 'heal', target: 'team', minConstellation: 0, caveats: ['selfHp'] }),
					cap({ kind: 'heal', target: 'team', minConstellation: 0 })
				]
			})
		]);
		expect(model.capRows[0].cells[0]!.conditional).toBe(false);
	});

	it('prefers the broadest target at the same gate', () => {
		const model = buildCompareModel([
			char('a', {
				capabilities: [
					cap({ kind: 'heal', target: 'self', minConstellation: 0 }),
					cap({ kind: 'heal', target: 'team', minConstellation: 0 })
				]
			})
		]);
		expect(model.capRows[0].cells[0]!.target).toBe('team');
	});

	it('surfaces a later broader-target unlock as an `also` upgrade', () => {
		const model = buildCompareModel([
			char('a', {
				capabilities: [
					cap({ kind: 'heal', target: 'self', minConstellation: 0 }),
					cap({ kind: 'heal', target: 'team', minConstellation: 2 })
				]
			})
		]);
		const cell = model.capRows[0].cells[0]!;
		expect(cell.minCon).toBe(0);
		expect(cell.target).toBe('self');
		expect(cell.also).toEqual({ target: 'team', minCon: 2 });
	});

	it('builds an uptime glyph when the window has a cooldown-bearing host', () => {
		const model = buildCompareModel([
			char('a', {
				abilities: [
					{
						abilityType: 'burst',
						behavior: 'instant',
						cooldown: 15,
						energyCost: 60,
						id: 'q'
					} as unknown as Ability
				],
				capabilities: [
					cap({
						kind: 'buff',
						detail: 'baseAtk',
						target: 'active',
						duration: 12,
						source: { section: 'ability', abilityId: 'q', abilityName: 'Q' }
					})
				]
			})
		]);
		expect(model.capRows[0].cells[0]!.glyph).toEqual({ uptime: 12, cooldown: 15 });
	});

	it('glyph falls back to the longest window at the gate when the primary is instant', () => {
		const model = buildCompareModel([
			char('a', {
				abilities: [
					{
						abilityType: 'skill',
						behavior: 'instant',
						cooldown: 15,
						id: 'e'
					} as unknown as Ability
				],
				capabilities: [
					// Primary (broadest target) has no duration; two variants carry windows.
					cap({
						kind: 'shield',
						target: 'team',
						source: { section: 'ability', abilityId: 'e', abilityName: 'E' }
					}),
					cap({
						kind: 'shield',
						target: 'active',
						duration: 4.8,
						source: { section: 'ability', abilityId: 'e', abilityName: 'E' }
					}),
					cap({
						kind: 'shield',
						target: 'active',
						duration: 12,
						source: { section: 'ability', abilityId: 'e', abilityName: 'E' }
					})
				]
			})
		]);
		expect(model.capRows[0].cells[0]!.glyph).toEqual({ uptime: 12, cooldown: 15 });
	});

	it('no glyph for passive-hosted windows (no cast cycle to visualize)', () => {
		const model = buildCompareModel([
			char('a', {
				capabilities: [
					cap({
						kind: 'buff',
						detail: 'em',
						target: 'team',
						duration: 8,
						source: { section: 'passive', abilityId: 'a4', abilityName: 'A4' }
					})
				]
			})
		]);
		expect(model.capRows[0].cells[0]!.glyph).toBeUndefined();
	});

	it('glyphScaleSeconds spans the longest cycle across all glyphs', () => {
		const burstOf = (id: string, cd: number) =>
			({
				abilityType: 'burst',
				behavior: 'instant',
				cooldown: cd,
				energyCost: 60,
				id
			}) as unknown as Ability;
		const withGlyph = (id: string, cd: number, dur: number) =>
			char(id, {
				abilities: [burstOf('q', cd)],
				capabilities: [
					cap({
						kind: 'buff',
						detail: 'baseAtk',
						target: 'active',
						duration: dur,
						source: { section: 'ability', abilityId: 'q', abilityName: 'Q' }
					})
				]
			});
		const model = buildCompareModel([withGlyph('a', 15, 12), withGlyph('b', 20, 25)]);
		expect(glyphScaleSeconds(model)).toBe(25);
	});

	it('collects distinct details at the gate and all source names', () => {
		const model = buildCompareModel([
			char('a', {
				capabilities: [
					cap({
						kind: 'resShred',
						detail: 'pyro',
						target: 'enemy',
						source: { section: 'ability', abilityId: 'q', abilityName: 'Burst Q' }
					}),
					cap({
						kind: 'resShred',
						detail: 'hydro',
						target: 'enemy',
						source: { section: 'constellation', abilityId: 'c1', abilityName: 'C1 Name' }
					})
				]
			})
		]);
		const cell = model.capRows[0].cells[0]!;
		expect(cell.details.sort()).toEqual(['hydro', 'pyro']);
		expect(cell.sources.sort()).toEqual(['Burst Q', 'C1 Name']);
	});
});
