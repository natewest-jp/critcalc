import { describe, expect, it } from 'vitest';
import type { Ability } from '$lib/types/ability';
import type { DerivedCapability } from '$lib/capabilities/deriveCapabilities';
import { buildCompareModel, type CompareCharacter } from './compare';

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

// ---------------------------------------------------------------------------
// Lanes — the chart projection. A lane is an ABILITY under an EFFECT heading,
// so the fixtures below all carry ability ids (a lane resolves its host by id;
// the cells projection never needed one).
// ---------------------------------------------------------------------------

const skillOf = (id: string, cooldown: number, charges?: number) =>
	({ abilityType: 'skill', behavior: 'instant', id, cooldown, charges }) as unknown as Ability;

const burstOf = (id: string, cooldown: number, energyCost = 60) =>
	({ abilityType: 'burst', behavior: 'instant', id, cooldown, energyCost }) as unknown as Ability;

const from = (abilityId: string, extra: Partial<DerivedCapability> = {}) => ({
	source: { section: 'ability' as const, abilityId, abilityName: abilityId.toUpperCase() },
	...extra
});

describe('buildCompareModel — lanes', () => {
	it('emits ONE LANE PER HOST, so a two-button healer gets two lanes', () => {
		const model = buildCompareModel([
			char('jean', {
				abilities: [skillOf('e', 6), burstOf('q', 20)],
				capabilities: [
					cap({ kind: 'heal', target: 'team', duration: 4, ...from('e') }),
					cap({ kind: 'heal', target: 'team', duration: 10, ...from('q') })
				]
			})
		]);
		const lanes = model.capRows[0].lanes;
		expect(lanes.map((l) => l.host.label)).toEqual(['E', 'Q']);
		expect(lanes.map((l) => l.uptime)).toEqual([4, 10]);
		// The price travels with the lane — that is the whole point of host-as-lane.
		expect(lanes[0].host.cooldown).toBe(6);
		expect(lanes[1].host.energyCost).toBe(60);
	});

	it('carries the column index so stacked lanes know whose they are', () => {
		const healer = (id: string, cd: number) =>
			char(id, {
				abilities: [burstOf('q', cd)],
				capabilities: [cap({ kind: 'heal', target: 'team', duration: 8, ...from('q') })]
			});
		const model = buildCompareModel([healer('a', 15), healer('b', 20)]);
		expect(model.capRows[0].lanes.map((l) => l.columnIndex)).toEqual([0, 1]);
	});

	it('lists what else the SAME cast buys, excluding its own row', () => {
		const model = buildCompareModel([
			char('bennett', {
				abilities: [burstOf('q', 15)],
				capabilities: [
					cap({ kind: 'heal', target: 'team', duration: 12, ...from('q') }),
					cap({ kind: 'buff', detail: 'baseAtk', target: 'team', duration: 12, ...from('q') })
				]
			})
		]);
		const heal = model.capRows.find((r) => r.key === 'heal')!;
		const atk = model.capRows.find((r) => r.key === 'buff:atk')!;
		expect(heal.lanes[0].alsoCarries).toEqual(['buff:atk']);
		expect(atk.lanes[0].alsoCarries).toEqual(['heal']);
	});

	it('splits a summon off its parent cast and takes the summon cadence', () => {
		const model = buildCompareModel([
			char('xiangling', {
				abilities: [burstOf('q', 20)],
				capabilities: [
					cap({
						kind: 'offFieldDamage',
						detail: 'summon',
						duration: 14,
						summon: { label: 'Guoba', tickInterval: 4, firstTickDelay: 2 },
						...from('q')
					})
				]
			})
		]);
		const lane = model.capRows[0].lanes[0];
		expect(lane.host.label).toBe('Q · Guoba');
		expect(lane.host.summonLabel).toBe('Guoba');
		// Offsets stop INSIDE the window — a tick after the summon expires is a lie.
		expect(lane.ticks).toEqual([2, 6, 10]);
	});

	it('refuses a lane with no cast cycle — passives get no invented rhythm', () => {
		const model = buildCompareModel([
			char('a', {
				abilities: [burstOf('q', 20)],
				capabilities: [
					// Hosted by a passive: no cooldown-bearing ability with this id.
					cap({
						kind: 'heal',
						target: 'team',
						duration: 10,
						source: { section: 'passive', abilityId: 'p1', abilityName: 'A4' }
					})
				]
			})
		]);
		expect(model.capRows[0].lanes).toEqual([]);
		// …and the cell still reports the capability. The chart is quiet, not the table.
		expect(model.capRows[0].cells[0]).not.toBeNull();
	});

	// ⚓ 2026-10-07: a passive whose TRIGGER names a cast rides that cast's cycle.
	// Kazuha's C2 EM, Nahida's A1 EM and Sucrose's A4 had no lane before this.
	const passive = { source: { section: 'passive' as const, abilityId: 'p1', abilityName: 'A4' } };

	it('puts a passive on the lane of the cast its trigger names', () => {
		const model = buildCompareModel([
			char('a', {
				abilities: [skillOf('e', 15), burstOf('q', 20)],
				capabilities: [
					cap({
						kind: 'buff',
						detail: 'em',
						target: 'team',
						duration: 8,
						...passive,
						host: { casts: ['burst'] }
					})
				]
			})
		]);
		const lanes = model.capRows[0].lanes;
		expect(lanes).toHaveLength(1);
		expect(lanes[0].host.label).toBe('Q');
		expect(lanes[0].host.cooldown).toBe(20);
		expect(lanes[0].uptime).toBe(8);
	});

	it('rides EVERY cast its trigger names — one lane per cast', () => {
		// Sucrose's A4: set off by her E hits and her Q hits alike.
		const model = buildCompareModel([
			char('a', {
				abilities: [skillOf('e', 15), burstOf('q', 20)],
				capabilities: [
					cap({
						kind: 'buff',
						detail: 'em',
						target: 'team',
						duration: 8,
						...passive,
						host: { casts: ['skill', 'burst'] }
					})
				]
			})
		]);
		expect(model.capRows[0].lanes.map((l) => l.host.label).sort()).toEqual(['E', 'Q']);
	});

	it('draws no lane for a reaction-set effect — it has no cast cycle to tile', () => {
		const model = buildCompareModel([
			char('a', {
				abilities: [skillOf('e', 6)],
				capabilities: [
					cap({
						kind: 'buff',
						detail: 'pyroDmgBonus',
						target: 'team',
						duration: 8,
						...passive,
						host: { reactions: ['pyroSwirl'] }
					})
				]
			})
		]);
		expect(model.capRows[0].lanes).toEqual([]);
		expect(model.capRows[0].cells[0]).not.toBeNull();
	});

	it("lists a passive riding a cast in that cast's also: line", () => {
		const model = buildCompareModel([
			char('a', {
				abilities: [burstOf('q', 15)],
				capabilities: [
					cap({ kind: 'heal', target: 'team', duration: 12, ...from('q') }),
					cap({
						kind: 'buff',
						detail: 'atk',
						target: 'team',
						duration: 12,
						...passive,
						host: { casts: ['burst'] }
					})
				]
			})
		]);
		const heal = model.capRows.find((r) => r.key === 'heal')!;
		expect(heal.lanes[0].alsoCarries).toEqual(['buff:atk']);
	});

	it('takes the longest window at the gate, so variant order cannot decide it', () => {
		const model = buildCompareModel([
			char('a', {
				abilities: [burstOf('q', 20)],
				capabilities: [
					cap({ kind: 'shield', target: 'team', duration: 8, ...from('q') }),
					cap({ kind: 'shield', target: 'team', duration: 15, ...from('q') })
				]
			})
		]);
		expect(model.capRows[0].lanes).toHaveLength(1);
		expect(model.capRows[0].lanes[0].uptime).toBe(15);
	});

	it('keeps a gated lane and reports its gate rather than hiding it', () => {
		const model = buildCompareModel([
			char('a', {
				abilities: [skillOf('e', 12)],
				capabilities: [
					cap({
						kind: 'shield',
						target: 'team',
						duration: 6,
						minConstellation: 4,
						caveats: ['selfHp'],
						...from('e')
					})
				]
			})
		]);
		const lane = model.capRows[0].lanes[0];
		expect(lane.minCon).toBe(4);
		expect(lane.conditional).toBe(true);
	});
});
