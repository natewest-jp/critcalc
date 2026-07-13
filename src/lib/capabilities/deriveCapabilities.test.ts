import { describe, it, expect } from 'vitest';
import type { CharacterData } from '$lib/types/character';
import {
	deriveCharacterCapabilities,
	summarizeCapabilities,
	type DerivedCapability
} from './deriveCapabilities';

import bennett from '$lib/data/characters/bennett.json';
import xianyun from '$lib/data/characters/xianyun.json';
import charlotte from '$lib/data/characters/charlotte.json';
import fischl from '$lib/data/characters/fischl.json';

/** Minimal character wrapper — tests exercise the walker, not the full schema. */
function char(partial: Partial<CharacterData>): CharacterData {
	return { id: 'test', name: 'Test', displayName: 'Test', rarity: 4, ...partial } as CharacterData;
}

const HEAL_EFFECT = {
	type: 'heal',
	trigger: { type: 'onCast', ability: 'burst' },
	target: 'team',
	scaling: 100,
	stat: 'hp'
};

describe('deriveCharacterCapabilities', () => {
	it('derives an effect capability with target and C0 gate', () => {
		const c = char({
			abilities: [{ id: 'q', name: 'Q', abilityType: 'burst', effects: [HEAL_EFFECT] }]
		} as never);
		const { capabilities } = deriveCharacterCapabilities(c);
		expect(capabilities).toHaveLength(1);
		expect(capabilities[0]).toMatchObject({
			kind: 'heal',
			target: 'team',
			minConstellation: 0,
			via: 'effect',
			caveats: [],
			source: { section: 'ability', abilityId: 'q' }
		});
	});

	it('gates constellation-hosted effects positionally (index 3 → C4)', () => {
		const c = char({
			constellations: [
				{ id: 'c1', name: 'C1', abilityType: 'constellation' },
				{ id: 'c2', name: 'C2', abilityType: 'constellation' },
				{ id: 'c3', name: 'C3', abilityType: 'constellation' },
				{ id: 'c4', name: 'C4', abilityType: 'constellation', effects: [HEAL_EFFECT] }
			]
		} as never);
		const { capabilities } = deriveCharacterCapabilities(c);
		expect(capabilities[0].minConstellation).toBe(4);
		expect(capabilities[0].source.section).toBe('constellation');
	});

	it('takes the max of positional and explicit condition gates', () => {
		const gated = { ...HEAL_EFFECT, conditions: { type: 'constellation', level: 6 } };
		const c = char({
			constellations: [{ id: 'c1', name: 'C1', abilityType: 'constellation', effects: [gated] }]
		} as never);
		expect(deriveCharacterCapabilities(c).capabilities[0].minConstellation).toBe(6);
	});

	it('resolves any() to the lowest satisfying constellation', () => {
		const gated = {
			...HEAL_EFFECT,
			conditions: {
				type: 'any',
				conditions: [
					{ type: 'constellation', level: 4 },
					{ type: 'constellation', level: 2 }
				]
			}
		};
		const c = char({
			abilities: [{ id: 'q', name: 'Q', abilityType: 'burst', effects: [gated] }]
		} as never);
		expect(deriveCharacterCapabilities(c).capabilities[0].minConstellation).toBe(2);
	});

	it('collects runtime caveats live at the gate, skipping satisfied any() branches', () => {
		const gated = {
			...HEAL_EFFECT,
			conditions: {
				type: 'all',
				conditions: [
					{ type: 'constellation', level: 1 },
					{ type: 'selfHpBelow', threshold: 50 },
					{
						type: 'any',
						conditions: [
							{ type: 'constellation', level: 1 },
							{ type: 'state', state: 'nightsoulBlessing' }
						]
					}
				]
			}
		};
		const c = char({
			abilities: [{ id: 'e', name: 'E', abilityType: 'skill', effects: [gated] }]
		} as never);
		const cap = deriveCharacterCapabilities(c).capabilities[0];
		expect(cap.minConstellation).toBe(1);
		// selfHp is load-bearing; the any() is satisfied by C1 so its state leaf is not.
		expect(cap.caveats).toEqual(['selfHp']);
	});

	it('normalizes compound and exclusion targets to the widest beneficiary', () => {
		const fx = { ...HEAL_EFFECT, target: ['self', 'active'] };
		const fx2 = { ...HEAL_EFFECT, target: 'teamExcludingSelf' };
		const c = char({
			abilities: [{ id: 'q', name: 'Q', abilityType: 'burst', effects: [fx, fx2] }]
		} as never);
		const targets = deriveCharacterCapabilities(c).capabilities.map((x) => x.target);
		expect(targets).toEqual(['active', 'team']);
	});

	it('maps tags: coordinatedAttack → offFieldDamage, heal stays target-less', () => {
		const c = char({
			abilities: [{ id: 'e', name: 'E', abilityType: 'skill', tags: ['coordinatedAttack', 'heal'] }]
		} as never);
		const caps = deriveCharacterCapabilities(c).capabilities;
		expect(caps).toHaveLength(2);
		expect(caps[0]).toMatchObject({
			kind: 'offFieldDamage',
			detail: 'coordinatedAttack',
			via: 'tag'
		});
		expect(caps[1].kind).toBe('heal');
		expect(caps[1].target).toBeUndefined();
	});

	it('derives offFieldDamage from summons with damage ticks, and summon heal ticks as heal', () => {
		const c = char({
			abilities: [
				{
					id: 'e',
					name: 'E',
					abilityType: 'skill',
					summons: [
						{
							id: 's',
							name: 'S',
							duration: 10,
							effects: [
								{
									type: 'damage',
									trigger: { type: 'summonTick', interval: 1 },
									target: 'enemy',
									scaling: 50,
									stat: 'atk'
								},
								{
									type: 'heal',
									trigger: { type: 'summonTick', interval: 2 },
									target: 'active',
									scaling: 10,
									stat: 'hp'
								}
							]
						}
					]
				}
			]
		} as never);
		const kinds = deriveCharacterCapabilities(c).capabilities.map(
			(x) => `${x.kind}:${x.detail ?? x.target}`
		);
		expect(kinds).toContain('offFieldDamage:summon');
		expect(kinds).toContain('heal:active');
	});

	it('honors variant conditions on variant-hosted effects', () => {
		const c = char({
			abilities: [
				{
					id: 'e',
					name: 'E',
					abilityType: 'skill',
					variants: [
						{
							label: 'Hold',
							conditions: { type: 'constellation', level: 2 },
							effects: [HEAL_EFFECT]
						}
					]
				}
			]
		} as never);
		const cap = deriveCharacterCapabilities(c).capabilities[0];
		expect(cap.minConstellation).toBe(2);
		expect(cap.source.variant).toBe('Hold');
	});

	it('carries the effect duration; instant effects stay durationless', () => {
		const c = char({
			abilities: [
				{
					id: 'q',
					name: 'Q',
					abilityType: 'burst',
					effects: [
						{ ...HEAL_EFFECT, duration: 12, type: 'buff', stat: 'atk' },
						HEAL_EFFECT // no duration — instant
					]
				}
			]
		} as never);
		const caps = deriveCharacterCapabilities(c).capabilities;
		expect(caps.find((x) => x.kind === 'buff')?.duration).toBe(12);
		expect(caps.find((x) => x.kind === 'heal')?.duration).toBeUndefined();
	});

	it('summon-hosted effects fall back to the summon duration; summon damage carries it', () => {
		const c = char({
			abilities: [
				{
					id: 'e',
					name: 'E',
					abilityType: 'skill',
					summons: [
						{
							id: 's',
							name: 'S',
							duration: 10,
							effects: [
								{
									type: 'damage',
									trigger: { type: 'summonTick', interval: 1 },
									target: 'enemy',
									scaling: 50,
									stat: 'atk'
								},
								{
									type: 'heal',
									trigger: { type: 'summonTick', interval: 2 },
									target: 'active',
									scaling: 10,
									stat: 'hp'
								}
							]
						}
					]
				}
			]
		} as never);
		const caps = deriveCharacterCapabilities(c).capabilities;
		expect(caps.find((x) => x.kind === 'offFieldDamage')?.duration).toBe(10);
		expect(caps.find((x) => x.kind === 'heal')?.duration).toBe(10);
	});

	it('drops effects that no constellation level can satisfy', () => {
		const impossible = {
			...HEAL_EFFECT,
			conditions: {
				type: 'all',
				conditions: [
					{ type: 'constellation', level: 2 },
					{ type: 'not', condition: { type: 'constellation', level: 1 } }
				]
			}
		};
		const c = char({
			abilities: [{ id: 'q', name: 'Q', abilityType: 'burst', effects: [impossible] }]
		} as never);
		expect(deriveCharacterCapabilities(c).capabilities).toHaveLength(0);
	});
});

describe('summarizeCapabilities', () => {
	const base: DerivedCapability = {
		kind: 'heal',
		target: 'team',
		minConstellation: 0,
		caveats: [],
		via: 'effect',
		source: { section: 'ability', abilityId: 'q', abilityName: 'Q' }
	};

	it('keeps the lowest gate per group and clears conditional on an unconditional tie', () => {
		const caps: DerivedCapability[] = [
			{ ...base, minConstellation: 2 },
			{ ...base, caveats: ['selfHp'] },
			{ ...base }
		];
		const summary = summarizeCapabilities(caps);
		expect(summary).toHaveLength(1);
		expect(summary[0]).toMatchObject({
			kind: 'heal',
			target: 'team',
			minCon: 0,
			conditional: false
		});
	});

	it('marks conditional when every source at the gate is runtime-gated', () => {
		const summary = summarizeCapabilities([{ ...base, caveats: ['selfHp'] }]);
		expect(summary[0].conditional).toBe(true);
	});

	it('subsumes tag-derived entries covered by an effect-derived entry at the same gate', () => {
		const tag: DerivedCapability = { ...base, target: undefined, via: 'tag' };
		expect(summarizeCapabilities([base, tag])).toHaveLength(1);
		// …but keeps a tag entry that unlocks earlier than any effect entry.
		const lateEffect = { ...base, minConstellation: 4 };
		const kept = summarizeCapabilities([lateEffect, tag]);
		expect(kept).toHaveLength(2);
	});
});

describe('real corpus integration', () => {
	it('Bennett: burst-tagged heal plus atk buff, all at C0', () => {
		const caps = deriveCharacterCapabilities(bennett as unknown as CharacterData);
		const summary = summarizeCapabilities(caps.capabilities);
		expect(summary.some((s) => s.kind === 'heal' && s.minCon === 0)).toBe(true);
		expect(summary.some((s) => s.kind === 'buff' && s.minCon === 0)).toBe(true);
	});

	it('Xianyun: team heal gated at C4 via explicit condition', () => {
		const caps = deriveCharacterCapabilities(xianyun as unknown as CharacterData);
		const c4heal = caps.capabilities.find(
			(c) => c.kind === 'heal' && c.source.section === 'constellation'
		);
		expect(c4heal?.minConstellation).toBe(4);
	});

	it('Charlotte: constellation-hosted heal gates at C1 via constellationLevel', () => {
		const caps = deriveCharacterCapabilities(charlotte as unknown as CharacterData);
		const conHeal = caps.capabilities.find(
			(c) => c.kind === 'heal' && c.source.section === 'constellation'
		);
		expect(conHeal?.minConstellation).toBe(1);
	});

	it('Fischl: Oz summon damage ticks derive offFieldDamage', () => {
		const caps = deriveCharacterCapabilities(fischl as unknown as CharacterData);
		expect(caps.capabilities.some((c) => c.kind === 'offFieldDamage')).toBe(true);
	});
});
