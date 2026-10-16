<!-- About chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round). The feedback
	 form's address lives in $lib/feedback.ts. A future Ko-fi / GitHub Sponsors
	 link belongs in "Money": not promised until it exists. -->

<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { FEEDBACK_FORM_URL } from '$lib/feedback';
</script>

<h1>Contribute</h1>

<p class="lede">How to tell us something is wrong, and where else help goes furthest.</p>

<section>
	<h2 id="report">Report a problem</h2>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- the external form -->
	<p>
		Reports go through the
		<a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">feedback form</a>, which
		takes bugs, characters that behave differently from the game, ideas and anything else.
	</p>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	<p>
		The quickest route is from inside a tool. <strong>Report a problem</strong> in a tool’s
		<strong>⋯</strong> menu opens the form with a link to what you’re looking at, so whoever reads
		it sees the same rotation, lineup or instrument you did. A character’s details card has its own
		<strong>Something’s not right with this character</strong>, which fills in the character and
		their constellation.
	</p>
	<p>
		What helps most is what you expected and what you got instead. For a character, the source helps
		too: the kit text, a gcsim config, or a combat log from the training dummy.
	</p>
	<p>
		Before reporting a missing mechanic, check the
		<a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a>. A part of a
		kit the Rotation Planner leaves out on purpose is listed there with the reason.
	</p>
</section>

<section>
	<h2 id="upstream">Help the projects critcalc is built on</h2>
	<p>
		Most of what the tools know was measured by someone else and given away. A correction made in
		one of these projects reaches every tool built on it, critcalc included:
	</p>
	<ul>
		<li>
			<a href="https://gcsim.app" target="_blank" rel="noopener noreferrer">gcsim</a>, whose frame
			data and tick cadences the Rotation Planner is timed from. A character implementation or a bug
			report there helps directly.
		</li>
		<li>
			<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer">Keqing Mains</a>,
			which keeps the notation, the theorycrafting conventions and the testing behind them.
		</li>
		<li>
			<a href="https://github.com/theBowja/genshin-db" target="_blank" rel="noopener noreferrer"
				>genshin-db</a
			>, the datamine every character here starts from.
		</li>
	</ul>
</section>

<section>
	<h2 id="money">Money</h2>
	<p>critcalc takes no money. There are no ads, no accounts and nothing to subscribe to.</p>
</section>
