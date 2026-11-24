<!-- Help chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar’s table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round), from a fact
	 sweep of the shipped instruments and their pass records
	 (docs/*-pass-2026-10-0*.md). If an instrument is added or renamed,
	 INSTRUMENTS in visualizers/lib/workspace.ts is the source of truth for the
	 roster, and the sections follow the picker’s order.

	 The text is in messages/*.json (`help_vz_*`). A paragraph is one message,
	 its bold words, links, and screenshot numbers as markup (`{#ref}2{/ref}` is
	 HelpRef 2), so a translation can move them; `p` below says what each tag
	 renders as. The formulas keep their non-breaking spaces in the message. -->

<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MessagePart } from '$lib/paraglide/runtime';
	import HelpFigure from '$lib/components/HelpFigure.svelte';
	import HelpRef from '$lib/components/HelpRef.svelte';
	import Msg from '$lib/components/Msg.svelte';
</script>

{#snippet strong(t: string)}<strong>{t}</strong>{/snippet}
{#snippet ref(t: string)}<HelpRef n={Number(t)} />{/snippet}
{#snippet eod(t: string)}<a
		href="https://www.hoyolab.com/article/622264"
		target="_blank"
		rel="noopener noreferrer">{t}</a
	>{/snippet}
{#snippet gganalysis(t: string)}<a
		href="https://github.com/OneBST/GGanalysis"
		target="_blank"
		rel="noopener noreferrer">{t}</a
	>{/snippet}
{#snippet p(parts: MessagePart[])}<Msg {parts} tags={{ strong, ref, eod, gganalysis }} />{/snippet}

<h1>{m.help_vz_visualizers()}</h1>

<p class="flavor">{m.help_vz_a_dome_with_eight_apertures_each_lens()}</p>

<p class="lede">{m.help_vz_eight_instruments_each_taking_one()}</p>

<section>
	<h2 id="workspace">{m.help_vz_the_workspace()}</h2>
	<HelpFigure shot="vz-workspace" alt={m.help_vz_the_gauge_explorer_s_bar_the_instrument()}>
		<p>{@render p(m.help_vz_the_workspace_shows_one_instrument_at_a.parts())}</p>
		<p>{@render p(m.help_vz_each_instrument_has_defaults_which_puts.parts())}</p>
	</HelpFigure>
	<p>{m.help_vz_each_instrument_s_settings_are_saved()}</p>
</section>

<section>
	<h2 id="crit-heatmap">{m.help_vz_crit_heatmap()}</h2>
	<HelpFigure shot="vz-crit" alt={m.help_vz_the_crit_heatmap_with_a_build_at_50_crit()}>
		<p>{@render p(m.help_vz_your_average_damage_per_hit_1_crit_rate.parts())}</p>
		<p>{@render p(m.help_vz_the_solid_line_through_your_build_is.parts())}</p>
		<p>{@render p(m.help_vz_the_average_hides_how_uneven_a_rotation.parts())}</p>
	</HelpFigure>
	<p>{@render p(m.help_vz_i_came_up_with_the_concept_for_the_crit.parts())}</p>
</section>

<section>
	<h2 id="gauge-explorer">{m.help_vz_gauge_explorer()}</h2>
	<HelpFigure shot="vz-gauge" alt={m.help_vz_the_gauge_explorer_s_overvape_example()}>
		<p>{@render p(m.help_vz_how_auras_attach_decay_and_get_consumed.parts())}</p>
		<p>{@render p(m.help_vz_the_chart_draws_each_aura_s_gauge_over.parts())}</p>
	</HelpFigure>
	<p>{m.help_vz_the_model_is_based_on_kqm_s_study_of()}</p>
	<p>{m.help_vz_the_instrument_is_built_assuming_one()}</p>
</section>

<section>
	<h2 id="icd-timeline">{m.help_vz_icd_timeline()}</h2>
	<HelpFigure shot="vz-icd" alt={m.help_vz_the_icd_timeline_with_hits_every_0_5s()}>
		<p>{@render p(m.help_vz_which_hits_in_a_string_actually_apply.parts())}</p>

		<p>{@render p(m.help_vz_the_row_over_the_chart_picks_the_string.parts())}</p>
	</HelpFigure>
	<p>{m.help_vz_standard_icd_is_a_2_5s_timer_and_every()}</p>
	<p>{@render p(m.help_vz_send_to_gauge_explorer_hands_the_first.parts())}</p>
</section>

<section>
	<h2 id="reaction-curves">{m.help_vz_reaction_curves()}</h2>
	<HelpFigure shot="vz-curves" alt={m.help_vz_reaction_curves_with_all_families_at_600()}>
		<p>{@render p(m.help_vz_how_each_family_of_reactions_scales_with.parts())}</p>
	</HelpFigure>
	<p>{m.help_vz_every_curve_has_the_same_shape_a_bonus()}</p>
	<p>{m.help_vz_every_figure_is_before_the_enemy_s_res()}</p>
</section>

<section>
	<h2 id="damage-breakdown">{m.help_vz_damage_breakdown()}</h2>
	<HelpFigure shot="vz-breakdown" alt={m.help_vz_damage_breakdown_for_a_direct_hit_at_70()}>
		<p>{@render p(m.help_vz_one_hit_written_out_as_its_damage.parts())}</p>
		<p>{@render p(m.help_vz_the_tabs_choose_the_kind_of_hit_a_direct.parts())}</p>
		<p>{@render p(m.help_vz_the_marks_at_the_end_of_a_bar_are_one.parts())}</p>
	</HelpFigure>
</section>

<section>
	<h2 id="enemy-res-def">{m.help_vz_enemy_res_def()}</h2>
	<HelpFigure shot="vz-defres" alt={m.help_vz_enemy_res_def_for_pyro_with_viridescent()}>
		<p>{@render p(m.help_vz_how_much_of_a_hit_gets_through_the_enemy.parts())}</p>
	</HelpFigure>
	<p>{m.help_vz_shred_works_at_three_strengths_between_0()}</p>
	<p>{m.help_vz_the_shred_setting_holds_every_character()}</p>
</section>

<section>
	<h2 id="artifact-odds">{m.help_vz_artifact_odds()}</h2>
	<HelpFigure shot="vz-artifact-piece" alt={m.help_vz_artifact_odds_your_piece_view_for_a_20()}>
		<p>{@render p(m.help_vz_a_5_artifact_s_odds_over_its_life_in.parts())}</p>
		<p>{@render p(m.help_vz_drop_answers_how_long_a_piece_takes_to.parts())}</p>
		<p>{@render p(m.help_vz_level_up_shows_the_chance_a_fresh_piece.parts())}</p>
		<p>{@render p(m.help_vz_your_piece_is_where_you_enter_a_real.parts())}</p>
	</HelpFigure>
	<HelpFigure shot="vz-artifact-reshape" alt={m.help_vz_the_reshape_view_for_the_same_flower()}>
		<p>{@render p(m.help_vz_reshape_picks_two_substats_as_the_game_s.parts())}</p>
	</HelpFigure>
	<p>{m.help_vz_the_reshape_guarantee_is_read_as_a_top()}</p>
</section>

<section>
	<h2 id="wish-odds">{m.help_vz_wish_odds()}</h2>
	<HelpFigure shot="vz-wish" alt={m.help_vz_wish_odds_for_c1_of_a_featured_5_from_30()}>
		<p>{@render p(m.help_vz_how_many_pulls_a_goal_takes_from_where.parts())}</p>
		<p>{@render p(m.help_vz_you_win_a_50_50_about_55_of_the_time.parts())}</p>
	</HelpFigure>
	<p>{m.help_vz_a_featured_4_comes_about_22_of_the_time()}</p>
	<p>{m.help_vz_on_the_weapon_banner_a_fate_point_charts()}</p>
	<p>{@render p(m.help_vz_the_pity_curves_are_the_game_s_published.parts())}</p>
</section>
