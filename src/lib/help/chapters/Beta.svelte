<!-- Beta chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 The BETA tag's target (2026-10-16; it pointed at Contribute until this
	 page existed). ↻ Rewritten by Nate 2026-10-18 in the first person: the
	 note now covers the data as well as the surface (the kits are where
	 checking matters most), and ⛔ it still names no end date. Style guide
	 §1.4: "I" for what is personal, "we" for modelling decisions.

	 The text is in messages/*.json (`beta_*`). A paragraph is one message, its
	 bold words and links as markup, so a translation can move them; `p` below
	 says what each tag renders as. -->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MessagePart } from '$lib/paraglide/runtime';
	import Msg from '$lib/components/Msg.svelte';
	import { hrefTo } from '$lib/i18n/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
</script>

{#snippet strong(t: string)}<strong>{t}</strong>{/snippet}
{#snippet contribute(t: string)}<a href={hrefTo('/contribute')}>{t}</a>{/snippet}
{#snippet coverage(t: string)}<a href={hrefTo('/coverage')} onclick={(e) => openCoverage(e)}>{t}</a
	>{/snippet}
{#snippet p(parts: MessagePart[])}<Msg {parts} tags={{ strong, contribute, coverage }} />{/snippet}

<h1>{m.beta_beta()}</h1>

<p class="lede">{m.beta_critcalc_may_be_rough_around_the_edges()}</p>

<section>
	<h2 id="report">{m.beta_if_something_looks_wrong()}</h2>
	<p>{@render p(m.beta_i_ve_only_been_able_to_test_the_site_on.parts())}</p>
	<p>{@render p(m.beta_the_character_data_is_where_i_could_use.parts())}</p>
	<p>{@render p(m.beta_that_said_i_don_t_have_all_characters_or.parts())}</p>
	<p>{m.beta_any_and_all_help_is_appreciated()}</p>
</section>

<section>
	<h2 id="what-changes">{m.beta_what_changes_and_what_stays_the_same()}</h2>
	<p>{m.beta_the_interface_will_keep_changing_for_a()}</p>
	<p>{@render p(m.beta_while_that_happens_your_saved_data_won_t.parts())}</p>
</section>
