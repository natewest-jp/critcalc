/**
 * $lib/capabilities/capabilityText.ts
 *
 * Shared presentation vocabulary for derived capabilities — used by the
 * DetailCard (both tools open it) and anything that names a capability beside it.
 *
 * ↻ 2026-08-12: hoisted out of builder/lib with the DetailCard, which the
 * Rotation Planner now opens too (the bench portrait does the same thing in
 * both tools). ↻ 2026-10-13: its other reader, the Team Builder's Compare,
 * retired into swap mode (lineups design §11.6 item 20), and TARGET_SHORT
 * with it.
 */

import type { CapabilityKind } from '$lib/capabilities/deriveCapabilities';
import type { Reaction, Stat, State } from '$lib/types/ability';
import { BUFF_STAT_LABEL } from '$lib/timeline/buffStatMaps';
import { REACTION_LABEL } from '$lib/utils/auraDisplay';

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

/** A state condition as the card says it. ⛔ A raw id must never reach the
 *  page — "during duringSummon" did, on Columbina's C6, until 2026-10-16.
 *  Keyed by the whole `State` union so a new member fails the type check
 *  rather than leaking. Each entry is a whole phrase (style guide §3.1). */
const STATE_PHRASE: Record<State, string> = {
	afterNormalAttack: 'after a Normal Attack',
	afterSkill: 'after an Elemental Skill',
	afterBurst: 'after an Elemental Burst',
	afterDurationEnds: 'after the effect ends',
	shielded: 'while shielded',
	onField: 'while on field',
	offField: 'while off-field',
	duringSummon: 'while the summon is out',
	nightsoulBlessing: "during Nightsoul's Blessing",
	inStance: 'during the stance',
	symphonyWindow: 'while Thunderous Symphony is ready',
	apexDrive: 'during Apex Drive',
	transmuting: 'during Essential Transmutation',
	whiteForm: 'during Confirmation of Purity',
	darkForm: 'during Denial of Darkness',
	codaWindow: "while Adagio: Coda at Dawn's Tolling is ready",
	soloDanceDouble: 'while the Solo Dance Double is out',
	searingRing: 'while the Ring of Searing Radiance is out',
	pneuma: 'in Pneuma alignment',
	spiritEnvoy: 'during Spirit Envoy Metamorphosis',
	envoyCooldown: 'while Spirit Envoy is on cooldown',
	followUpStrike: 'during Follow-Up Strike',
	orioleSong: "during Haunted Night's Oriole-Song"
};

/** The negated forms the data actually authors (`not` around a state). A
 *  state with no entry falls back to a phrase that is vague but never wrong —
 *  ⛔ never the positive phrase, which says the opposite. */
const NOT_STATE_PHRASE: Partial<Record<State, string>> = {
	inStance: 'outside the stance',
	nightsoulBlessing: "outside Nightsoul's Blessing",
	codaWindow: "while Adagio: Coda at Dawn's Tolling is not ready",
	soloDanceDouble: 'while no Solo Dance Double is out'
};

export function caveatText(caveat: string): string {
	const [key, arg] = caveat.split(':');
	switch (key) {
		case 'state':
			return STATE_PHRASE[arg as State] ?? 'depends on a character state';
		case 'notState':
			return NOT_STATE_PHRASE[arg as State] ?? 'depends on a character state';
		case 'needsEnabler':
			return `needs a ${REACTION_LABEL[arg as Reaction] ?? arg} enabler`;
		case 'needsField':
			return 'inside the Polestar Field';
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
			return 'depends on the situation';
	}
}
