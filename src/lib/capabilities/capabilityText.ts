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
import { REACTION_LABEL, elementLabel } from '$lib/utils/auraDisplay';
import { labels } from '$lib/i18n/labels';
import { factionName } from '$lib/i18n/gameNames';
import { m } from '$lib/paraglide/messages';

export const KIND_LABEL: Record<CapabilityKind, string> = labels({
	heal: m.tb_heal,
	shield: m.tb_shield,
	offFieldDamage: m.tb_off_field_dmg,
	resShred: m.tb_res_shred,
	cleanse: m.tb_cleanse,
	grouping: m.tb_grouping,
	buff: m.tb_buff,
	energy: m.tb_energy,
	infuse: m.tb_infusion,
	summon: m.tb_summon,
	taunt: m.tb_taunt
});

export const KIND_ORDER = Object.keys(KIND_LABEL) as CapabilityKind[];

export const TARGET_LABEL: Record<string, string> = labels({
	team: m.tb_team_wide,
	active: m.tb_active_character,
	self: m.tb_self_only,
	enemy: m.tb_on_enemies
});

/** Shred-stat / element detail words that aren't plain capitalizations. */
const DETAIL_WORD: Record<string, string> = labels({
	def: m.tb_def,
	all: m.tb_all_elements,
	physical: m.tb_physical
});

/** How off-field damage is delivered. */
const OFF_FIELD_WORD: Record<string, string> = {
	get coordinatedAttack() {
		return m.tb_coordinated_attack();
	},
	get summon() {
		return m.tb_summon_b52a();
	}
};

/** Human label for a capability's `detail` — buff stats via the planner's
 *  shared stat map, shred/infuse elements by their name in the page's
 *  language. */
export function capDetailText(kind: CapabilityKind, detail: string): string {
	if (kind === 'buff') return BUFF_STAT_LABEL[detail as Stat] ?? detail;
	if (kind === 'resShred' || kind === 'infuse') return DETAIL_WORD[detail] ?? elementLabel(detail);
	// ⛔ A raw id must never reach the page — "coordinatedAttack" did, in
	// Compare's table, until 2026-10-07.
	if (kind === 'offFieldDamage') return OFF_FIELD_WORD[detail] ?? detail;
	return detail;
}

/** A state condition as the card says it. ⛔ A raw id must never reach the
 *  page — "during duringSummon" did, on Columbina's C6, until 2026-10-16.
 *  Keyed by the whole `State` union so a new member fails the type check
 *  rather than leaking. Each entry is a whole phrase (style guide §3.1). */
const STATE_PHRASE: Record<State, string> = labels({
	afterNormalAttack: m.tb_after_a_normal_attack,
	afterSkill: m.tb_after_an_elemental_skill,
	afterBurst: m.tb_after_an_elemental_burst,
	afterDurationEnds: m.tb_after_the_effect_ends,
	shielded: m.tb_while_shielded,
	onField: m.tb_while_on_field,
	offField: m.tb_while_off_field,
	duringSummon: m.tb_while_the_summon_is_present,
	nightsoulBlessing: m.tb_during_nightsoul_s_blessing,
	inStance: m.tb_during_the_stance,
	symphonyWindow: m.tb_while_thunderous_symphony_is_ready,
	apexDrive: m.tb_during_apex_drive,
	transmuting: m.tb_during_essential_transmutation,
	whiteForm: m.tb_during_confirmation_of_purity,
	darkForm: m.tb_during_denial_of_darkness,
	whiteDragon: m.tb_while_the_dragon_of_white_flame_is,
	darkDragon: m.tb_while_the_dragon_of_dark_decay_is,
	codaWindow: m.tb_while_adagio_coda_at_dawn_s_tolling_is_3465,
	soloDanceDouble: m.tb_while_the_solo_dance_double_is_present,
	searingRing: m.tb_while_the_ring_of_searing_radiance_is,
	charmAbsorbed: m.tb_after_an_elemental_absorption,
	pneuma: m.tb_in_pneuma_alignment,
	spiritEnvoy: m.tb_during_spirit_envoy_metamorphosis,
	envoyCooldown: m.tb_while_spirit_envoy_is_on_cooldown,
	followUpStrike: m.tb_during_follow_up_strike,
	orioleSong: m.tb_during_haunted_night_s_oriole_song,
	flamestrider: m.tb_while_on_the_flamestrider
});

/** The negated forms the data actually authors (`not` around a state). A
 *  state with no entry falls back to a phrase that is vague but never wrong —
 *  ⛔ never the positive phrase, which says the opposite. */
const NOT_STATE_PHRASE: Partial<Record<State, string>> = labels({
	inStance: m.tb_outside_the_stance,
	nightsoulBlessing: m.tb_outside_nightsoul_s_blessing,
	codaWindow: m.tb_while_adagio_coda_at_dawn_s_tolling_is_c9ba,
	soloDanceDouble: m.tb_while_no_solo_dance_double_is_present
});

export function caveatText(caveat: string): string {
	const [key, arg] = caveat.split(':');
	switch (key) {
		case 'state':
			return STATE_PHRASE[arg as State] ?? m.tb_depends_on_a_character_state();
		case 'notState':
			return NOT_STATE_PHRASE[arg as State] ?? m.tb_depends_on_a_character_state();
		case 'needsEnabler':
			return m.tb_needs_a_arg_enabler({ reaction: REACTION_LABEL[arg as Reaction] ?? arg });
		case 'needsField':
			return m.tb_inside_the_polestar_field();
		case 'stacks':
			return m.tb_depends_on_stacks();
		case 'teamFaction':
			return m.tb_needs_arg_teammates({ faction: factionName(arg) });
		case 'teamElements':
			return m.tb_depends_on_team_elements();
		case 'activeIs':
			return m.tb_when_active_character_is_arg({ faction: factionName(arg) });
		case 'enemyHp':
			return m.tb_depends_on_enemy_hp();
		case 'selfHp':
			return m.tb_depends_on_own_hp();
		case 'recipientHp':
			return m.tb_depends_on_recipient_hp();
		case 'enemyAura':
			return m.tb_vs_arg_affected_enemies({ element: elementLabel(arg) });
		case 'chainStage':
			return m.tb_at_a_specific_cast_in_the_chain();
		case 'weaponType':
			return m.tb_weapon_type_dependent();
		default:
			return m.tb_depends_on_the_situation();
	}
}
