<!-- What's new chapter (/changelog) — see $lib/help/areas.ts. Every <h2>
	 carries an id; the area shell reads them for the sidebar's table of
	 contents, so a MONTH is an <h2> and an entry is an <h3> under it. The
	 entries of a month sit on a TIMELINE (⚓ Nate 2026-10-21): a rule down the
	 left with a pip at each title, the date after the title in small type; the
	 rule runs the month's whole height and a little above its first pip, and
	 the month heading interrupts it.

	 Added 2026-10-21 (⚓ Nate). The noticeable changes, newest first — ⛔ not
	 every commit: a change goes here when a player would notice it. Character
	 kits are the coverage page's job; an entry may name a character, but this
	 page mostly carries the rest. ⛔ No "planned" list: we ship faster than a
	 plan would stay true, and a plan with no date is a promise. Known gaps is
	 the exception, for long-term limits only, written as what the tools don't
	 do YET (style guide §1.3: ⛔ never "never" about the future).
	 ⚓ Nate 2026-11-04: a change across a whole tool is one entry about what
	 changed everywhere, plus only the standout new features, not a paragraph
	 per part. ⚓ Nate 2026-11-07: an entry covering several characters gives
	 each one its own paragraph, and leaves out timing a player would not
	 notice (when a hit applies its element).

	 To add an entry: one <article> at the top of its month's .timeline, newest
	 first, with its title and paragraphs as `changelog_*` messages in
	 messages/en.json (then run scripts/generate-pseudo-locale.mjs); a new month
	 is a new <section> with an <h2 id="YYYY-MM"> and its own .timeline. Dates
	 are written from the ISO day in the page's language, so they need no
	 message. The daily check-in proposes an entry when a user-visible to-do
	 item is removed.

	 A paragraph is one message, its bold words, code, and links as markup, so a
	 translation can move them; `p` below says what each tag renders as. -->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MessagePart } from '$lib/paraglide/runtime';
	import Msg from '$lib/components/Msg.svelte';
	import { formatDay } from '$lib/i18n/dates';
	import { hrefTo } from '$lib/i18n/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { chapterSection, menu } from '$lib/menuState.svelte';

	/** Opens Help at the time token, over whatever is showing; a new-tab click
	 *  keeps the link's own address. */
	function openTimeToken(event: MouseEvent): void {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		menu.show(chapterSection('help', 'planner'), 'time-token');
	}

	/** "November 2026", from any day in the month. */
	const monthOf = (iso: string) => formatDay(iso, { month: 'long', year: 'numeric' });
</script>

{#snippet strong(t: string)}<strong>{t}</strong>{/snippet}
{#snippet code(t: string)}<code>{t}</code>{/snippet}
{#snippet gaps(t: string)}<a href="#known-gaps">{t}</a>{/snippet}
{#snippet coverage(t: string)}<a href={hrefTo('/coverage')} onclick={(e) => openCoverage(e)}>{t}</a
	>{/snippet}
{#snippet timetoken(t: string)}<a
		href="{hrefTo('/help/planner')}#time-token"
		onclick={openTimeToken}>{t}</a
	>{/snippet}
{#snippet reshape(t: string)}<a href="{hrefTo('/visualizers')}?i=artifact&do=reshape">{t}</a
	>{/snippet}
{#snippet github(t: string)}<a
		href="https://github.com/natewest-jp/critcalc"
		target="_blank"
		rel="noopener noreferrer">{t}</a
	>{/snippet}
{#snippet p(parts: MessagePart[])}<Msg
		{parts}
		tags={{ strong, code, gaps, coverage, timetoken, reshape, github }}
	/>{/snippet}

<!-- An entry's title, with its date after it. -->
{#snippet head(title: string, iso: string)}
	<header class="entry-head">
		<h3>{title}</h3>
		<time class="entry-date" datetime={iso}
			>{formatDay(iso, { month: 'long', day: 'numeric' })}</time
		>
	</header>
{/snippet}

<h1>{m.changelog_what_s_new()}</h1>

<p class="lede">{@render p(m.changelog_known_gaps_are_at_the_bottom_of_the_page.parts())}</p>

<section>
	<h2 id="2026-11">{monthOf('2026-11-01')}</h2>

	<div class="timeline">
		<!-- Approved by Nate, 2026-11-27; docs/rounds/jahoda-robots-2026-11-27.md. -->
		<article class="entry">
			{@render head(m.changelog_elemental_absorption_for_prune_wanderer_sucrose(), '2026-11-27')}
			<p>{m.changelog_when_prune_s_skill_triggers_swirl_pressing()}</p>
			<p>{m.changelog_wanderer_s_jade_claimed_flower_now_grants()}</p>
			<p>{m.changelog_under_moonsign_ascendant_gleam_jahoda_s()}</p>
		</article>
		<!-- Nate's wording, 2026-11-11 ("exlude" corrected to "exclude"). -->
		<article class="entry">
			{@render head(m.changelog_imaginarium_theater_added_to_the_team(), '2026-11-11')}
			<p>{m.changelog_you_can_now_plan_lineups_for_imaginarium()}</p>
		</article>
		<article class="entry">
			{@render head(m.changelog_sandrone_is_ready_in_the_rotation(), '2026-11-10')}
			<p>{@render p(m.changelog_sandrone_s_attacks_skill_and_burst_now.parts())}</p>
		</article>
		<article class="entry">
			{@render head(m.changelog_durin_s_two_dragons_and_lan_yan_s(), '2026-11-07')}
			<p>{m.changelog_after_durin_s_denial_of_darkness_his()}</p>
			<p>{m.changelog_pressing_normal_attack_right_after_lan()}</p>
		</article>
		<article class="entry">
			{@render head(m.changelog_mitya_and_valeriy_the_witch_s_revelation(), '2026-11-06')}
			<p>{m.changelog_mitya_and_valeriy_are_in_the_roster()}</p>
			<p>{m.changelog_diona_s_mizuki_s_and_cyno_s_witch_s()}</p>
			<p>{m.changelog_kokomi_s_burst_now_refreshes_a_bake()}</p>
		</article>
		<article class="entry">
			{@render head(m.changelog_a_new_layout_for_the_visualizers(), '2026-11-04')}
			<p>{m.changelog_visualizers_has_a_new_layout_all_of_the()}</p>
			<p>{m.changelog_each_one_also_now_remembers_your_last()}</p>
			<p>{@render p(m.changelog_artifact_odds_has_a_new_try_a_reshape.parts())}</p>
		</article>
		<article class="entry">
			{@render head(m.changelog_capturing_radiance_in_wish_odds(), '2026-11-02')}
			<p>{m.changelog_wish_odds_can_follow_your_capturing()}</p>
		</article>
		<article class="entry">
			{@render head(m.changelog_editing_in_the_gauge_explorer(), '2026-11-01')}
			<p>{m.changelog_the_gauge_explorer_s_controls_have_been()}</p>
		</article>
	</div>
</section>

<section>
	<h2 id="2026-10">{monthOf('2026-10-01')}</h2>

	<div class="timeline">
		<article class="entry">
			{@render head(m.changelog_alhaitham_s_mirrors_ifa_s_hover_and_held(), '2026-10-30')}
			<p>{m.changelog_alhaitham_s_chisel_light_mirrors_are_now()}</p>
			<p>{m.changelog_ifa_s_hover_runs_on_nightsoul_points_so()}</p>
			<p>{m.changelog_held_skills_start_their_cooldown_at_the()}</p>
		</article>
		<article class="entry">
			{@render head(m.changelog_the_traveler_twins_and_arlecchino_s(), '2026-10-28')}
			<p>{@render p(m.changelog_aether_and_lumine_attack_at_different.parts())}</p>
			<p>{m.changelog_arlecchino_s_skill_cooldown_each_normal()}</p>
		</article>
		<!-- ⏭ Ships with the flip (copy pass 2026-10-27): date it the day it goes live. -->
		<article class="entry">
			{@render head(m.changelog_profiles_and_a_new_layout(), '2026-10-27')}
			<p>{m.changelog_critcalc_now_keeps_your_work_in_profiles()}</p>
			<p>{m.changelog_shared_links_open_in_theorycraft_a_built()}</p>
			<p>{@render p(m.changelog_tools_now_work_with_one_rotation_or.parts())}</p>
			<p>{m.changelog_work_saves_itself_as_you_go_and_anything()}</p>
		</article>
		<article class="entry">
			{@render head(m.changelog_a_team_you_open_stays_on_the_bench(), '2026-10-22')}
			<p>{m.changelog_on_the_rotation_planner_a_team_opened()}</p>
		</article>
		<article class="entry">
			{@render head(m.changelog_critcalc_launches(), '2026-10-19')}
			<p>{@render p(m.changelog_critcalc_app_goes_live_with_a_team.parts())}</p>
		</article>
	</div>
</section>

<section>
	<h2 id="known-gaps">{m.changelog_known_gaps()}</h2>
	<p>{@render p(m.changelog_longer_term_limits_that_are_not_yet.parts())}</p>
	<ul>
		<li>{@render p(m.changelog_energy_the_rotation_planner_treats_a.parts())}</li>
		<li>{@render p(m.changelog_more_than_one_enemy_the_rotation_planner.parts())}</li>
		<li>{@render p(m.changelog_enemies_with_their_own_element_the_enemy.parts())}</li>
		<li>{@render p(m.changelog_shatter.parts())}</li>
		<li>{@render p(m.changelog_damage_from_reaction_objects_dendro.parts())}</li>
		<li>{@render p(m.changelog_lunar_charged_and_lunar_crystallize_in.parts())}</li>
		<li>{@render p(m.changelog_co_op_shields_shields_that_only_reach.parts())}</li>
		<li>{@render p(m.changelog_languages_the_site_is_in_english_only.parts())}</li>
	</ul>
</section>

<style>
	/* THE TIMELINE. One rule per month, the .timeline's own ::before: it runs
	   the month's full height and starts a little ABOVE the first pip, so the
	   line reads as continuing into the month rather than starting at it
	   (⚓ Nate). Each pip sits on its title's first line, centred on it. */
	.timeline {
		--tl-gutter: 1.6rem;
		--tl-x: 0.45rem; /* the rule's centre, from the gutter's left edge */
		--tl-dot: 9px;
		--tl-head-lh: 1.6rem;
		--tl-lead: 0.6rem; /* how far the rule rises above the first pip */
		position: relative;
		margin: 0 0 0.9rem;
	}

	.timeline::before {
		content: '';
		position: absolute;
		left: calc(var(--tl-x) - 1px);
		top: calc(var(--tl-head-lh) / 2 - var(--tl-lead));
		bottom: 0;
		width: 2px;
		background: var(--line-soft);
	}

	.entry {
		position: relative;
		padding: 0 0 1.6rem var(--tl-gutter);
	}

	.entry:last-child {
		padding-bottom: 0;
	}

	/* The title and its date share a line, on the title's baseline; a long
	   title lets the date wrap under it rather than squeeze. */
	.entry-head {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 0.6rem;
		margin: 0 0 0.35rem;
	}

	.entry-head::before {
		content: '';
		position: absolute;
		left: calc(var(--tl-x) - var(--tl-gutter) - var(--tl-dot) / 2);
		top: calc(var(--tl-head-lh) / 2 - var(--tl-dot) / 2);
		width: var(--tl-dot);
		height: var(--tl-dot);
		border-radius: 50%;
		background: var(--accent);
	}

	.entry-head h3 {
		margin: 0;
		line-height: var(--tl-head-lh);
	}

	.entry-date {
		font-size: var(--fs-md);
		color: var(--muted);
	}
</style>
