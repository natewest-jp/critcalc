<!-- Help chapter. Rendered both at /help and inside the chrome's Help overlay —
	 see $lib/help/areas.ts. Every <h2> carries an id: the area shell reads them
	 to build the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round). ↻ 2026-10-18,
	 Nate's review: "What is critcalc?" and "Does it tell me my damage number"
	 are cut (About says what the site is; ⛔ the aim is not restated here) —
	 describe the thing. The home-screen links go to Google's and Apple's own
	 help pages.

	 The text is in messages/*.json (`faq_*`). A paragraph is one message, its
	 bold words and links as markup, so a translation can move them; `p` below
	 says what each tag renders as. -->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MessagePart } from '$lib/paraglide/runtime';
	import { hrefTo } from '$lib/i18n/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { feedbackFormUrl } from '$lib/feedback';
	import Msg from '$lib/components/Msg.svelte';
</script>

{#snippet strong(t: string)}<strong>{t}</strong>{/snippet}
{#snippet beta(t: string)}<a href={hrefTo('/beta')}>{t}</a>{/snippet}
{#snippet privacy(t: string)}<a href={hrefTo('/privacy')}>{t}</a>{/snippet}
{#snippet settings(t: string)}<a href={hrefTo('/settings')}>{t}</a>{/snippet}
{#snippet about(t: string)}<a href={hrefTo('/about')}>{t}</a>{/snippet}
{#snippet coverage(t: string)}<a href={hrefTo('/coverage')} onclick={(e) => openCoverage(e)}>{t}</a
	>{/snippet}
{#snippet feedback(t: string)}<a href={feedbackFormUrl()} target="_blank" rel="noopener noreferrer"
		>{t}</a
	>{/snippet}
{#snippet kqm(t: string)}<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer"
		>{t}</a
	>{/snippet}
{#snippet android(t: string)}<a
		href="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid"
		target="_blank"
		rel="noopener noreferrer">{t}</a
	>{/snippet}
{#snippet iphone(t: string)}<a
		href="https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios"
		target="_blank"
		rel="noopener noreferrer">{t}</a
	>{/snippet}
{#snippet p(parts: MessagePart[])}<Msg
		{parts}
		tags={{ strong, beta, privacy, settings, about, coverage, feedback, kqm, android, iphone }}
	/>{/snippet}

<h1>{m.faq_help_faq()}</h1>

<p class="lede">{m.faq_questions_about_the_site_as_a_whole_each()}</p>

<section>
	<h2 id="what-it-is">{m.faq_what_critcalc_is()}</h2>

	<h3>{m.faq_is_critcalc_official()}</h3>
	<p>{m.faq_no_it_s_an_unofficial_fan_project_not()}</p>

	<h3>{m.faq_what_does_the_beta_tag_mean()}</h3>
	<p>{@render p(m.faq_that_the_site_is_still_in_its_early.parts())}</p>
</section>

<section>
	<h2 id="your-data">{m.faq_your_data()}</h2>

	<h3>{m.faq_do_i_need_an_account()}</h3>
	<p>{@render p(m.faq_no_everything_you_set_up_your_profiles.parts())}</p>

	<h3>{m.faq_how_do_i_move_my_data_to_another_device()}</h3>
	<p>{@render p(m.faq_in_settings_under_backup_click_export_to.parts())}</p>

	<h3>{m.faq_what_does_a_share_link_carry()}</h3>
	<p>{m.faq_only_the_thing_you_re_sharing_written()}</p>
	<p>{m.faq_a_link_opens_at_the_reader_s_own()}</p>
</section>

<section>
	<h2 id="the-data">{m.faq_the_data_behind_it()}</h2>

	<h3>{m.faq_where_does_the_character_data_come_from()}</h3>
	<p>{@render p(m.faq_each_kit_starts_from_genshin_db_s.parts())}</p>

	<h3>{m.faq_is_my_character_fully_in()}</h3>
	<p>{@render p(m.faq_the_coverage_page_answers_that_for_every.parts())}</p>

	<h3>{m.faq_something_looks_wrong()}</h3>
	<p>{@render p(m.faq_please_report_it_through_the_feedback.parts())}</p>
</section>

<section>
	<h2 id="timing">{m.faq_timing()}</h2>

	<h3>{m.faq_why_is_the_timeline_faster_or_slower()}</h3>
	<p>{@render p(m.faq_check_human_timing_it_s_on_by_default.parts())}</p>
	<p>{@render p(m.faq_swapping_characters_costs_time_either.parts())}</p>

	<h3>{m.faq_why_does_a_skill_come_back_later_than()}</h3>
	<p>{m.faq_because_for_most_skills_the_cooldown()}</p>
</section>

<section>
	<h2 id="odds-and-ends">{m.faq_odds_and_ends()}</h2>

	<h3>{m.faq_which_terminology_does_critcalc_follow()}</h3>
	<p>{@render p(m.faq_keqing_mains_its_notation_for_rotations.parts())}</p>

	<h3>{m.faq_does_it_work_on_a_phone()}</h3>
	<p>{m.faq_yes_down_to_320px_wide_though_the()}</p>
	<p>{m.faq_if_you_use_critcalc_on_your_phone_often()}</p>
	<p>{@render p(m.faq_here_s_how_to_add_it_to_your_home_screen.parts())}</p>
</section>
