/**
 * $lib/capabilities/capabilityText.ts
 *
 * Shared presentation vocabulary for derived capabilities — used by the
 * DetailCard (both tools open it) and anything that names a capability beside it.
 *
 * ↻ 2026-08-12: hoisted out of team-builder/lib with the DetailCard, which the
 * Rotation Planner now opens too (the bench portrait does the same thing in
 * both tools). ↻ 2026-10-13: its other reader, the Team Builder's Compare,
 * retired into swap mode (lineups design §11.6 item 20), and TARGET_SHORT
 * with it.
 */

import type { CapabilityKind } from '$lib/capabilities/deriveCapabilities';
import type { Stat } from '$lib/types/ability';
import { BUFF_STAT_LABEL } from '$lib/timeline/buffStatMaps';

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

/** Shred-stat / element detail words that aren't plain capitalizations. */
const DETAIL_WORD: Record<string, string> = {
	def: 'DEF',
	all: 'all elements'
};

/** How off-field damage is delivered. */
const OFF_FIELD_WORD: Record<string, string> = {
	coordinatedAttack: 'coordinated attack',
	summon: 'summon'
};

/** Human label for a capability's `detail` — buff stats via the planner's
 *  shared stat map, shred/infuse elements capitalized. */
export function capDetailText(kind: CapabilityKind, detail: string): string {
	if (kind === 'buff') return BUFF_STAT_LABEL[detail as Stat] ?? detail;
	if (kind === 'resShred' || kind === 'infuse')
		return DETAIL_WORD[detail] ?? detail.charAt(0).toUpperCase() + detail.slice(1);
	// ⛔ A raw id must never reach the page — "coordinatedAttack" did, in
	// Compare's table, until 2026-10-07.
	if (kind === 'offFieldDamage') return OFF_FIELD_WORD[detail] ?? detail;
	return detail;
}

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
