<!-- About chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round). ⚓ The one place
	 the project says what it is FOR — once, as a description (style guide
	 §1.3). Credits name every source a help chapter cites. -->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MessagePart } from '$lib/paraglide/runtime';
	import Msg from '$lib/components/Msg.svelte';
	import { hrefTo } from '$lib/i18n/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
</script>

{#snippet strong(t: string)}<strong>{t}</strong>{/snippet}
{#snippet builder(t: string)}<a href={hrefTo('/help/builder')}>{t}</a>{/snippet}
{#snippet planner(t: string)}<a href={hrefTo('/help/planner')}>{t}</a>{/snippet}
{#snippet visualizers(t: string)}<a href={hrefTo('/help/visualizers')}>{t}</a>{/snippet}
{#snippet contribute(t: string)}<a href={hrefTo('/contribute')}>{t}</a>{/snippet}
{#snippet coverage(t: string)}<a href={hrefTo('/coverage')} onclick={(e) => openCoverage(e)}>{t}</a
	>{/snippet}
{#snippet out(href: string, t: string)}<a {href} target="_blank" rel="noopener noreferrer">{t}</a
	>{/snippet}
{#snippet gcsim(t: string)}{@render out('https://gcsim.app', t)}{/snippet}
{#snippet kqm(t: string)}{@render out('https://keqingmains.com', t)}{/snippet}
{#snippet genshindb(t: string)}{@render out('https://github.com/theBowja/genshin-db', t)}{/snippet}
{#snippet fandom(t: string)}{@render out('https://genshin-impact.fandom.com', t)}{/snippet}
{#snippet lunaris(t: string)}{@render out('https://lunaris.moe', t)}{/snippet}
{#snippet stygian(t: string)}{@render out('https://www.stygian.moe', t)}{/snippet}
{#snippet gganalysis(t: string)}{@render out('https://github.com/OneBST/GGanalysis', t)}{/snippet}
{#snippet eodgamer(t: string)}{@render out('https://www.hoyolab.com/article/622264', t)}{/snippet}
{#snippet github(t: string)}{@render out('https://github.com/natewest-jp/critcalc', t)}{/snippet}
{#snippet p(parts: MessagePart[])}<Msg
		{parts}
		tags={{
			strong,
			builder,
			planner,
			visualizers,
			contribute,
			coverage,
			gcsim,
			kqm,
			genshindb,
			fandom,
			lunaris,
			stygian,
			gganalysis,
			eodgamer,
			github
		}}
	/>{/snippet}

<h1>{m.about_about_critcalc()}</h1>

<p class="lede">{m.about_critcalc_app_is_three_tools_for_genshin()}</p>

<section>
	<h2 id="tools">{m.about_the_tools()}</h2>
	<p>{@render p(m.about_the_team_builder_is_a_party_setup_screen.parts())}</p>
	<p>{@render p(m.about_the_rotation_planner_turns_a_rotation.parts())}</p>
	<p>{@render p(m.about_the_visualizers_are_eight_small.parts())}</p>
</section>

<section>
	<h2 id="data">{m.about_where_the_data_comes_from()}</h2>
	<p>{m.about_each_character_starts_from_genshin_db_s()}</p>
	<p>{@render p(m.about_curation_is_uneven_because_some_kits_are.parts())}</p>
</section>

<section>
	<h2 id="who">{m.about_who_makes_it()}</h2>
	<p>{@render p(m.about_critcalc_is_nate_west_s_project_it_is.parts())}</p>
</section>

<section>
	<h2 id="credits">{m.about_credits()}</h2>
	<ul>
		<li>{@render p(m.about_gcsim_the_open_source_combat_simulator.parts())}</li>
		<li>{@render p(m.about_keqing_mains_the_notation_the_rotation.parts())}</li>
		<li>{@render p(m.about_genshin_db_the_datamined_kits_every.parts())}</li>
		<li>{@render p(m.about_the_genshin_impact_fandom_wiki_kit.parts())}</li>
		<li>{@render p(m.about_lunaris_moe_for_stygian_onslaught_and.parts())}</li>
		<li>{@render p(m.about_gganalysis_which_the_wish_odds.parts())}</li>
		<li>{@render p(m.about_eodgamer_s_crit_heatmap_the_spreadsheet.parts())}</li>
		<li>{m.about_type_is_ibm_plex_and_bitter_the()}</li>
	</ul>
</section>

<section>
	<h2 id="fan-project">{m.about_a_fan_project()}</h2>
	<p>{m.about_critcalc_is_an_unofficial_fan_project()}</p>
	<p>{@render p(m.about_the_code_is_licensed_under_the_agpl_3_0.parts())}</p>
</section>
