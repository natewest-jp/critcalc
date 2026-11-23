/**
 * src/lib/coverage/coverageText.ts
 *
 * Every user-facing string on the coverage page that is not a character's own
 * `caveat` or `notModeled.reason`. ⚓ Nate 2026-09-23: a limitation is the
 * ROTATION PLANNER's ("The Rotation Planner doesn't…"), never "we" — "we"
 * reads as a stance taken, the tool's name as a limit of this tool. ⚓ One whole sentence per line code (style
 * guide §3.1 — a string is a sentence, never assembled from parts); a line's
 * `form` renders as its own label beside the sentence, never inside it. Kept in
 * one module so the i18n extraction finds them together.
 */

import type {
	CoverageColumn,
	CoverageFacet,
	CoverageLineCode,
	CoverageSegmentKey,
	CoverageState
} from './deriveCoverage';
import { labels } from '$lib/i18n/labels';
import { m } from '$lib/paraglide/messages';

export const LINE_TEXT: Record<CoverageLineCode, string> = labels({
	'frames.gcsim': m.coverage_timed_from_gcsim_s_frame_data,
	'frames.gcsimPr': m.coverage_timed_from_a_gcsim_change_that_hasn_t,
	'frames.wiki': m.coverage_timed_from_wiki_frame_counts_rather_than,
	'frames.hand': m.coverage_timed_from_frame_counts_measured_by_hand,
	'frames.none': m.coverage_there_is_no_frame_data_for_this_yet_so,
	'frames.someForms': m.coverage_some_forms_have_no_frame_data_and_use_a,
	'charged.generic': m.coverage_this_kit_has_no_charged_attack_frames_so,
	'plunge.generic': m.coverage_this_kit_has_no_plunge_frames_so_p_is,
	'app.lands': m.coverage_each_hit_applies_its_element_when_it,
	'app.atSwingEnd': m.coverage_the_element_is_applied_at_the_end_of_the,
	'app.physical': m.coverage_these_attacks_deal_physical_dmg_so_there,
	'app.nonHitting': m.coverage_this_lands_no_hit,
	'app.measured': m.coverage_element_timing_and_gauge_units_are,
	'app.appliesNothing': m.coverage_measured_from_gcsim_this_applies_no,
	'app.atCast': m.coverage_not_measured_yet_so_the_rotation_planner,
	'app.unitsUnmeasured': m.coverage_timing_is_measured_but_some_hits_gauge,
	'grants.authored': m.coverage_its_effects_are_drawn_on_the_timeline,
	'grants.elsewhere': m.coverage_drawn_as_part_of_another_ability,
	'grants.summon': m.coverage_its_summon_is_drawn_with_its_hits,
	'grants.window': m.coverage_the_state_it_opens_is_drawn_on_the,
	'grants.summonSilent': m.coverage_its_summon_s_window_is_drawn_but_its,
	'grants.summonDealsNothing': m.coverage_its_summon_is_drawn_it_deals_no_damage,
	'grants.noReader': m.coverage_part_of_this_waits_on_healing_energy_or,
	'grants.unknownValue': m.coverage_its_exact_value_isn_t_known_yet_so_the,
	'grants.none': m.coverage_this_hasn_t_been_added_to_the_planner,
	'grants.nothingToModel': m.coverage_nothing_here_changes_what_the_planner,
	'grants.notModeled': m.coverage_the_rotation_planner_doesn_t_show_this,
	'grants.noHost': m.coverage_there_s_nothing_in_this_slot
});

export const STATE_LABEL: Record<CoverageState, string> = labels({
	lit: m.coverage_modeled,
	provisional: m.coverage_stand_in,
	missing: m.coverage_missing,
	notModeled: m.coverage_not_modeled,
	na: m.coverage_nothing_to_model
});

export const STATE_DESCRIPTION: Record<CoverageState, string> = labels({
	lit: m.coverage_drawn_by_the_planner,
	provisional: m.coverage_drawn_with_a_stand_in,
	missing: m.coverage_in_the_kit_not_yet_in_the_planner,
	notModeled: m.coverage_outside_the_planner_s_scope_the_details,
	na: m.coverage_nothing_of_that_kind_in_the_kit
});

/** Column headers — the ONLY labels on the strip (rows carry none). A1 to C6
 *  are notation, left in English as C6 is everywhere. */
export const COLUMN_LABEL: Record<CoverageColumn, string> = labels({
	normals: m.coverage_normal,
	skill: m.coverage_skill,
	burst: m.coverage_burst,
	a1: () => 'A1',
	a4: () => 'A4',
	extra: m.coverage_other,
	c1: () => 'C1',
	c2: () => 'C2',
	c4: () => 'C4',
	c6: () => 'C6'
});

export const FACET_LABEL: Record<CoverageFacet, string> = labels({
	timing: m.coverage_timing,
	application: m.coverage_element,
	grants: m.coverage_effects
});

/** A sub-segment's own title, for the tooltip head and the details list. */
export const SEGMENT_TITLE: Record<CoverageSegmentKey, string> = labels({
	'N.timing': m.coverage_normal_attack_timing,
	'N.application': m.coverage_normal_attack_element,
	'C.timing': m.coverage_charged_attack_timing,
	'C.application': m.coverage_charged_attack_element,
	'P.timing': m.coverage_plunge_timing,
	'P.application': m.coverage_plunge_element,
	'E.timing': m.coverage_skill_timing,
	'E.application': m.coverage_skill_element,
	'E.grants': m.coverage_skill_effects,
	'Q.timing': m.coverage_burst_timing,
	'Q.application': m.coverage_burst_element,
	'Q.grants': m.coverage_burst_effects,
	A1: m.coverage_first_ascension_passive,
	A4: m.coverage_fourth_ascension_passive,
	extra: m.coverage_other_passives,
	C1: m.coverage_constellation_1,
	C2: m.coverage_constellation_2,
	C4: m.coverage_constellation_4,
	C6: m.coverage_constellation_6
});
