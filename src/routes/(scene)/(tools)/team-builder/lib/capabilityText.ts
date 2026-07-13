/**
 * team-builder/lib/capabilityText.ts
 *
 * Shared presentation vocabulary for derived capabilities — used by the
 * DetailCard and the CompareView so the two surfaces can't drift.
 */

import type { CapabilityKind } from '$lib/capabilities/deriveCapabilities';

export const KIND_LABEL: Record<CapabilityKind, string> = {
	heal: 'Heal',
	shield: 'Shield',
	offFieldDamage: 'Off-field DMG',
	resShred: 'RES shred',
	cleanse: 'Cleanse',
	grouping: 'Grouping',
	buff: 'Buff',
	energy: 'Energy',
	infuse: 'Infusion',
	summon: 'Summon',
	taunt: 'Taunt'
};

export const KIND_ORDER = Object.keys(KIND_LABEL) as CapabilityKind[];

export const TARGET_LABEL: Record<string, string> = {
	team: 'team-wide',
	active: 'active character',
	self: 'self only',
	enemy: 'on enemies'
};

/** Compact target words for dense cells (CompareView). */
export const TARGET_SHORT: Record<string, string> = {
	team: 'team',
	active: 'active',
	self: 'self',
	enemy: 'enemies'
};

export function caveatText(caveat: string): string {
	const [key, arg] = caveat.split(':');
	switch (key) {
		case 'state':
			return `during ${arg}`;
		case 'stacks':
			return `needs ${arg} stacks`;
		case 'teamFaction':
			return `needs ${arg} teammates`;
		case 'teamElements':
			return 'depends on team elements';
		case 'activeIs':
			return `when active character is ${arg}`;
		case 'enemyHp':
			return 'depends on enemy HP';
		case 'selfHp':
			return 'depends on own HP';
		case 'recipientHp':
			return 'depends on recipient HP';
		case 'enemyAura':
			return `vs ${arg}-affected enemies`;
		case 'chainStage':
			return 'at a specific cast in the chain';
		case 'weaponType':
			return 'weapon-type dependent';
		default:
			return caveat;
	}
}
