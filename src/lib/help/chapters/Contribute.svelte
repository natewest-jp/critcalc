<!-- Contribute chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round). The feedback
	 form's address lives in $lib/feedback.ts. A future Ko-fi / GitHub Sponsors
	 link belongs in "Financial support": not promised until it exists.
	 ↻ 2026-10-18 (Nate's review): reports reach Nate, so "me" (style guide
	 §1.4); genshin-db left the upstream list — a datamine library takes
	 feature requests, not player corrections — and stays in About's credits.

	 The text is in messages/*.json (`contribute_*`). A paragraph is one message,
	 its bold words and links as markup, so a translation can move them; `p`
	 below says what each tag renders as. -->

<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MessagePart } from '$lib/paraglide/runtime';
	import Msg from '$lib/components/Msg.svelte';
	import { hrefTo } from '$lib/i18n/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { feedbackFormUrl } from '$lib/feedback';
</script>

{#snippet strong(t: string)}<strong>{t}</strong>{/snippet}
{#snippet coverage(t: string)}<a href={hrefTo('/coverage')} onclick={(e) => openCoverage(e)}>{t}</a
	>{/snippet}
{#snippet out(href: string, t: string)}<a {href} target="_blank" rel="noopener noreferrer">{t}</a
	>{/snippet}
{#snippet feedback(t: string)}{@render out(feedbackFormUrl(), t)}{/snippet}
{#snippet gcsim(t: string)}{@render out('https://gcsim.app', t)}{/snippet}
{#snippet kqm(t: string)}{@render out('https://keqingmains.com', t)}{/snippet}
{#snippet p(parts: MessagePart[])}<Msg
		{parts}
		tags={{ strong, coverage, feedback, gcsim, kqm }}
	/>{/snippet}

<h1>{m.contribute_contribute()}</h1>

<p class="lede">{m.contribute_how_to_tell_me_something_is_wrong_and()}</p>

<section>
	<h2 id="report">{m.contribute_report_a_problem()}</h2>
	<p>{@render p(m.contribute_reports_go_through_the_feedback_form.parts())}</p>
	<p>{@render p(m.contribute_the_quickest_route_is_report_a_problem.parts())}</p>
	<p>{m.contribute_what_helps_most_is_what_you_expected_and()}</p>
	<p>{@render p(m.contribute_before_reporting_a_missing_mechanic.parts())}</p>
</section>

<section>
	<h2 id="upstream">{m.contribute_help_the_projects_critcalc_is_built_on()}</h2>
	<p>{m.contribute_most_of_what_the_tools_show_was_measured()}</p>
	<ul>
		<li>{@render p(m.contribute_gcsim_whose_frame_data_and_tick_cadences.parts())}</li>
		<li>{@render p(m.contribute_keqing_mains_which_keeps_the_notation.parts())}</li>
	</ul>
</section>

<section>
	<h2 id="money">{m.contribute_financial_support()}</h2>
	<p>{m.contribute_thank_you_for_checking_critcalc_isn_t_in()}</p>
</section>
