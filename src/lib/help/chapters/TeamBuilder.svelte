<!-- Help chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch against the LINEUPS tool (design doc
	 docs/design/team-builder-lineups-design.md §11 wins; swap mode is §11.6 item 20).
	 Glossary names: Lineup (never "board"), Characters (the grid), Roster (the
	 Library tab ONLY), "the team's capabilities" (never "fingerprint"). ⚠ The
	 Abyss banner + Opponents need a CURRENT cycle in season-dates.json, so the
	 copy says "when a cycle is listed". The Theater section is design doc §12.

	 The text is in messages/*.json (`help_tb_*`). A paragraph is one message,
	 its bold words, links, and screenshot numbers as markup (`{#ref}2{/ref}` is
	 HelpRef 2), so a translation can move them; `p` below says what each tag
	 renders as. -->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MessagePart } from '$lib/paraglide/runtime';
	import { hrefTo } from '$lib/i18n/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import HelpFigure from '$lib/components/HelpFigure.svelte';
	import HelpRef from '$lib/components/HelpRef.svelte';
	import Msg from '$lib/components/Msg.svelte';
</script>

{#snippet strong(t: string)}<strong>{t}</strong>{/snippet}
{#snippet ref(t: string)}<HelpRef n={Number(t)} />{/snippet}
{#snippet theater(t: string)}<a href="#theater">{t}</a>{/snippet}
{#snippet roster(t: string)}<a href="#roster">{t}</a>{/snippet}
{#snippet coverage(t: string)}<a href={hrefTo('/coverage')} onclick={(e) => openCoverage(e)}>{t}</a
	>{/snippet}
{#snippet stygian(t: string)}<a
		href="https://www.stygian.moe"
		target="_blank"
		rel="noopener noreferrer">{t}</a
	>{/snippet}
{#snippet p(parts: MessagePart[])}<Msg
		{parts}
		tags={{ strong, ref, theater, roster, coverage, stygian }}
	/>{/snippet}

<h1>{m.help_tb_team_builder()}</h1>

<p class="flavor">{m.help_tb_a_brass_disc_of_nested_rings_each()}</p>

<p class="lede">{m.help_tb_a_party_setup_screen_build_a_lineup_of()}</p>

<section>
	<h2 id="lineups">{m.help_tb_lineups()}</h2>
	<HelpFigure shot="builder-new-lineup" alt={m.help_tb_the_new_lineup_menu_open_offering()}>
		<p>{@render p(m.help_tb_new_lineup_in_the_library_under_lineups.parts())}</p>
		<ul>
			<li>{@render p(m.help_tb_stygian_onslaught_three_teams_one_per.parts())}</li>
			<li>{@render p(m.help_tb_spiral_abyss_two_teams_for_floor_12_s.parts())}</li>
			<li>{@render p(m.help_tb_imaginarium_theater_a_cast_instead_of.parts())}</li>
			<li>{@render p(m.help_tb_custom_one_team_to_start_and_add_team_in.parts())}</li>
		</ul>
	</HelpFigure>
	<p>{@render p(m.help_tb_new_lineup_on_a_team_in_teams_does_the.parts())}</p>
	<p>{m.help_tb_once_you_ve_added_characters_to_a_lineup()}</p>
	<p>{@render p(m.help_tb_in_the_library_the_top_section_this.parts())}</p>
	<p>{@render p(m.help_tb_no_repeats_keeps_each_character_on_one.parts())}</p>
</section>

<section>
	<h2 id="building">{m.help_tb_building_a_team()}</h2>
	<HelpFigure shot="builder-adding" alt={m.help_tb_the_characters_grid_under_a_banner()}>
		<p>{@render p(m.help_tb_click_a_team_to_select_it_a_banner_in.parts())}</p>
		<p>{@render p(m.help_tb_the_magnifier_on_a_card_opens_the.parts())}</p>
	</HelpFigure>
</section>

<section>
	<h2 id="characters">{m.help_tb_finding_characters()}</h2>
	<HelpFigure shot="builder-characters" alt={m.help_tb_the_toolbar_and_filter_strip_over_the()}>
		<p>{@render p(m.help_tb_the_strip_over_characters_filters_by.parts())}</p>
		<p>{m.help_tb_character_roles_come_from_genshin_s_own()}</p>
		<p>{@render p(m.help_tb_the_toolbar_narrows_further_a_name.parts())}</p>
		<p>{@render p(m.help_tb_the_column_of_icons_on_a_card_is_that.parts())}</p>
	</HelpFigure>
	<p>{@render p(m.help_tb_some_kits_have_no_capability_data_yet.parts())}</p>
</section>

<section>
	<h2 id="capabilities">{m.help_tb_what_a_team_can_provide()}</h2>
	<HelpFigure shot="builder-capabilities" alt={m.help_tb_a_team_s_fifteen_capability_icons_some()}>
		<p>{@render p(m.help_tb_each_team_shows_fifteen_capabilities_in.parts())}</p>
	</HelpFigure>
	<p>{m.help_tb_conditions_are_read_against_the_team_a()}</p>
	<p>{m.help_tb_click_a_faint_capability_to_find_who()}</p>
	<p>{m.help_tb_the_icons_say_what_a_team_can_do_not_how()}</p>
	<p>{@render p(m.help_tb_on_a_stygian_battlefield_the_chips.parts())}</p>
</section>

<section>
	<h2 id="swapping">{m.help_tb_swapping_a_character()}</h2>
	<HelpFigure shot="builder-swap" alt={m.help_tb_swap_mode_replacing_columbina_five()}>
		<p>{@render p(m.help_tb_click_a_portrait_in_the_selected_team_to.parts())}</p>
		<ul>
			<li>{@render p(m.help_tb_keeps_everything_nothing_the_team.parts())}</li>
			<li>{@render p(m.help_tb_trades_something_is_lost_listed_in_the.parts())}</li>
			<li>{@render p(m.help_tb_changes_the_reactions_the_team_s.parts())}</li>
			<li>{@render p(m.help_tb_not_yet_curated_no_capability_data_so.parts())}</li>
		</ul>
		<p>{@render p(m.help_tb_what_a_candidate_would_add_shows_as.parts())}</p>
	</HelpFigure>
	<p>{@render p(m.help_tb_picking_someone_makes_the_swap_and_the.parts())}</p>
	<p>{@render p(m.help_tb_the_rotation_planner_sends_you_here_too.parts())}</p>
</section>

<section>
	<h2 id="theater">{m.help_tb_imaginarium_theater()}</h2>
	<p>{m.help_tb_a_theater_lineup_is_a_cast_not_teams()}</p>
	<p>{@render p(m.help_tb_with_a_theater_lineup_open_the_character.parts())}</p>
	<p>{@render p(m.help_tb_1_supporting_cast_counts_a_friend_s.parts())}</p>
	<p>{@render p(m.help_tb_the_roster_doesn_t_track_levels_mark.parts())}</p>
	<p>{@render p(m.help_tb_a_theater_lineup_has_no_share_button.parts())}</p>
</section>

<section>
	<h2 id="rotations">{m.help_tb_rotations()}</h2>
	<p>{@render p(m.help_tb_if_this_profile_has_a_rotation_for.parts())}</p>
</section>

<section>
	<h2 id="roster">{m.help_tb_your_roster_and_sharing()}</h2>
	<p>{@render p(m.help_tb_your_roster_is_under_roster_in_the.parts())}</p>
	<HelpFigure shot="builder-team-chips" alt={m.help_tb_a_team_s_four_portraits_illuga_who_isn_t()}>
		<p>{@render p(m.help_tb_the_chip_on_a_team_portrait_is_the.parts())}</p>
	</HelpFigure>
	<p>{@render p(m.help_tb_share_in_the_toolbar_copies_a_link_with.parts())}</p>
</section>

<section>
	<h2 id="phone">{m.help_tb_on_a_phone()}</h2>
	<HelpFigure shot="builder-phone" alt={m.help_tb_the_builder_on_a_phone_showing_the()}>
		<p>{@render p(m.help_tb_on_narrower_screens_characters_and_the.parts())}</p>
	</HelpFigure>
</section>
