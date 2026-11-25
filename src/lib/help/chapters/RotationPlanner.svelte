<!-- Help chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round), from a fact
	 sweep of the shipped tool. Glossary names: the composer, the bench / bench
	 card / slot, the timeline (never "chart"), a tab holding a rotation (never
	 "plan"), the aura lane = the gauge lines + the reaction spawns, the aura
	 log, the view bar / document bar. ⚓ A limit is the TOOL's ("The Rotation
	 Planner doesn't…"); "we" only for a choice that isn't a limit.

	 The text is in messages/*.json (`help_planner_*`). A paragraph is one
	 message, its bold words, code, links, and screenshot numbers as markup
	 (`{#ref}2{/ref}` is HelpRef 2), so a translation can move them; `p` below
	 says what each tag renders as. Notation in `{#code}` stays as written. -->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MessagePart } from '$lib/paraglide/runtime';
	import { hrefTo } from '$lib/i18n/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { feedbackFormUrl } from '$lib/feedback';
	import HelpFigure from '$lib/components/HelpFigure.svelte';
	import HelpRef from '$lib/components/HelpRef.svelte';
	import Msg from '$lib/components/Msg.svelte';
</script>

{#snippet strong(t: string)}<strong>{t}</strong>{/snippet}
{#snippet code(t: string)}<code>{t}</code>{/snippet}
{#snippet warn(t: string)}<code class="flag-warning">{t}</code>{/snippet}
{#snippet approx(t: string)}<code class="flag-approx">{t}</code>{/snippet}
{#snippet ref(t: string)}<HelpRef n={Number(t)} />{/snippet}
{#snippet kqm(t: string)}<a
		href="https://library.keqingmains.com/theorycrafting#combat-notation"
		target="_blank"
		rel="noopener noreferrer">{t}</a
	>{/snippet}
{#snippet coverage(t: string)}<a href={hrefTo('/coverage')} onclick={(e) => openCoverage(e)}>{t}</a
	>{/snippet}
{#snippet feedback(t: string)}<a href={feedbackFormUrl()} target="_blank" rel="noopener noreferrer"
		>{t}</a
	>{/snippet}
{#snippet p(parts: MessagePart[])}<Msg
		{parts}
		tags={{ strong, code, warn, approx, ref, kqm, coverage, feedback }}
	/>{/snippet}

<h1>{m.help_planner_rotation_planner()}</h1>

<p class="flavor">{m.help_planner_a_ledger_of_where_every_star_will_be()}</p>

<p class="lede">{m.help_planner_write_a_rotation_in_kqm_notation_and_the()}</p>

<section>
	<h2 id="notation">{m.help_planner_writing_a_rotation()}</h2>
	<p>{@render p(m.help_planner_the_composer_under_the_timeline_takes.parts())}</p>
	<ul>
		<li>{@render p(m.help_planner_n_to_n9_are_normal_attacks_n3_is_three.parts())}</li>
		<li>{@render p(m.help_planner_e_and_q_are_skill_and_burst_with_he_for.parts())}</li>
		<li>{@render p(m.help_planner_stances_add_special_forms_se_a_special.parts())}</li>
		<li>{@render p(m.help_planner_3_n2_d_or_n2_d_x3_repeat_the_actions_in.parts())}</li>
		<li id="time-token">
			{@render p(m.help_planner_critcalc_adds_a_time_token_of_its_own.parts())}
			<ul>
				<li>{@render p(m.help_planner_mizuki_s_dreamdrifter_and_chasca_s.parts())}</li>
				<li>{@render p(m.help_planner_sandrone_s_charged_attack_holds_until.parts())}</li>
				<li>{@render p(m.help_planner_sayu_s_held_skill_rolls_for_as_long_as.parts())}</li>
				<li>{@render p(m.help_planner_neuvillette_s_charged_attack_runs_the.parts())}</li>
			</ul>
		</li>
	</ul>
	<p>{@render p(m.help_planner_names_are_the_game_s_display_names.parts())}</p>
	<p>{m.help_planner_undo_and_redo_sit_at_the_end_of_the()}</p>
	<p>{m.help_planner_a_skill_or_burst_written_before_it_s()}</p>
	<HelpFigure
		shot="planner-composer"
		alt={m.help_planner_the_composer_holding_a_rotation_sucrose()}
	>
		<p>{@render p(m.help_planner_the_composer_underlines_what_it_can_t.parts())}</p>
	</HelpFigure>
	<p>{@render p(m.help_planner_walk_cancels_w_ends_the_attack_string.parts())}</p>
</section>

<section>
	<h2 id="team">{m.help_planner_the_team()}</h2>
	<p>{m.help_planner_the_bench_holds_four_slots_typing_a()}</p>
	<HelpFigure shot="planner-bench-card" alt={m.help_planner_flins_s_bench_card_its_five_controls()}>
		<p>{@render p(m.help_planner_each_slot_on_the_bench_beside_the.parts())}</p>
		<p>{@render p(m.help_planner_the_chip_on_the_portrait_is_the.parts())}</p>
	</HelpFigure>
	<p>{@render p(m.help_planner_a_character_without_curated_frame_data.parts())}</p>
</section>

<section>
	<!-- Nate's wording, 2026-11-08. A literal brace in a message is written
	     `\{` in messages/*.json. -->
	<h2 id="blank">{m.help_planner_blank_a_stand_in_character()}</h2>
	<p>{@render p(m.help_planner_type_blank_in_the_notation_box_to_create.parts())}</p>
	<p>{@render p(m.help_planner_to_show_how_long_a_skill_or_burst_lasts.parts())}</p>
	<p>{@render p(m.help_planner_a_rotation_can_only_use_one_blank_if_you.parts())}</p>
	<p>{m.help_planner_blank_counts_as_no_element_it_never()}</p>
</section>

<section>
	<h2 id="timeline">{m.help_planner_reading_the_timeline()}</h2>
	<HelpFigure shot="planner-timeline" alt={m.help_planner_columbina_s_rows_over_the_first_five()}>
		<p>{@render p(m.help_planner_each_character_gets_a_group_of_rows.parts())}</p>
		<p>{@render p(m.help_planner_a_skill_or_burst_bar_is_followed_by_a.parts())}</p>
	</HelpFigure>
	<p>{m.help_planner_below_the_characters_are_the_team_wide()}</p>
	<p>{m.help_planner_energy_isn_t_modeled_a_burst_is_ready()}</p>
	<p>{@render p(m.help_planner_zoom_in_the_toolbar_opens_a_slider_and.parts())}</p>
	<p>{@render p(m.help_planner_buffs_and_auras_in_the_toolbar_are.parts())}</p>
</section>

<section>
	<h2 id="human-timing">{m.help_planner_timing_like_a_person()}</h2>
	<p>{@render p(m.help_planner_human_timing_is_on_by_default_it_adds.parts())}</p>
	<HelpFigure
		shot="planner-padding"
		alt={m.help_planner_flins_s_active_row_with_a_hatched_sliver()}
	>
		<p>{@render p(m.help_planner_settings_decides_what_it_changes_padding.parts())}</p>
	</HelpFigure>
	<p>{@render p(m.help_planner_swaps_take_time_either_way_your_ping.parts())}</p>
	<p>{m.help_planner_a_swap_ends_a_stance_only_where_the_game()}</p>
	<p>{m.help_planner_because_human_timing_is_your_preference()}</p>
</section>

<section>
	<h2 id="playback">{m.help_planner_playing_it_back()}</h2>
	<HelpFigure shot="planner-playback" alt={m.help_planner_the_playback_controls_with_laps_on_and()}>
		<p>{@render p(m.help_planner_play_or_space_runs_a_cursor_along_the.parts())}</p>
		<p>{m.help_planner_bluetooth_headphones_and_speakers_delay()}</p>
		<p>{@render p(m.help_planner_laps_simulates_the_rotation_five_times.parts())}</p>
	</HelpFigure>
</section>

<section>
	<h2 id="aura">{m.help_planner_the_enemy_s_aura()}</h2>
	<HelpFigure shot="planner-aura" alt={m.help_planner_the_aura_lane_over_the_first_seven()}>
		<p>{@render p(m.help_planner_the_aura_lane_above_the_ruler_represents.parts())}</p>
		<p>{@render p(m.help_planner_above_the_lines_a_pill_in_the_element_s.parts())}</p>
		<p>{@render p(m.help_planner_the_reaction_spawns_below_the_baseline.parts())}</p>
	</HelpFigure>
	<p>{@render p(m.help_planner_the_polestar_field_a_starlight_prism.parts())}</p>
	<p>{@render p(m.help_planner_log_in_the_toolbar_opens_the_aura_log.parts())}</p>
	<p>{@render p(m.help_planner_the_model_behind_it_is_the_gauge.parts())}</p>
</section>

<section>
	<h2 id="inspector">{m.help_planner_the_inspector()}</h2>
	<HelpFigure
		shot="planner-inspector"
		alt={m.help_planner_the_inspector_open_on_the_team_columbina()}
	>
		<p>{@render p(m.help_planner_inspector_opens_a_panel_beside_the.parts())}</p>
	</HelpFigure>
	<p>{@render p(m.help_planner_turn_on_coverage_strips_in_settings_to.parts())}</p>
</section>

<section>
	<h2 id="saving">{m.help_planner_saving_comparing_and_sharing()}</h2>
	<p>{@render p(m.help_planner_the_planner_shows_one_rotation_at_a_time.parts())}</p>
	<p>{@render p(m.help_planner_a_rotation_in_theorycraft_can_go_to_one.parts())}</p>
	<p>{@render p(m.help_planner_compare_under_the_bench_pairs_two.parts())}</p>
	<p>{@render p(m.help_planner_share_in_the_toolbar_copies_a_link_the.parts())}</p>
</section>

<section>
	<h2 id="phone">{m.help_planner_on_a_phone()}</h2>
	<HelpFigure shot="planner-phone-dock" alt={m.help_planner_the_rotation_planner_on_a_phone_the()}>
		<p>{@render p(m.help_planner_on_a_phone_the_composer_docks_to_the.parts())}</p>
		<p>{@render p(m.help_planner_the_bench_becomes_a_row_above_the.parts())}</p>
	</HelpFigure>
</section>
