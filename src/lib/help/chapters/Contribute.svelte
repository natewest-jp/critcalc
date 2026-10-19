<!-- Contribute chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round). The feedback
	 form's address lives in $lib/feedback.ts. A future Ko-fi / GitHub Sponsors
	 link belongs in "Financial support": not promised until it exists.
	 ↻ 2026-10-18 (Nate's review): reports reach Nate, so "me" (style guide
	 §1.4); genshin-db left the upstream list — a datamine library takes
	 feature requests, not player corrections — and stays in About's credits. -->

<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { FEEDBACK_FORM_URL } from '$lib/feedback';
</script>

<h1>Contribute</h1>

<p class="lede">How to tell me something is wrong, and where else help goes furthest.</p>

<section>
	<h2 id="report">Report a problem</h2>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- the external form -->
	<p>
		Reports go through the
		<a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">feedback form</a>, which
		takes bugs, characters that behave differently from the game, ideas, and anything else.
	</p>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	<p>
		The quickest route is from inside a tool. <strong>Report a problem</strong> in a tool’s
		<strong>⋯</strong> menu opens the form with a link to what you’re looking at, so I see the same
		rotation, lineup, or instrument you did. A character’s details card has its own link,
		<strong>Something not right with this character?</strong> It fills in the character and their constellation.
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
		Most of what the tools show was measured by someone else and given to the community. A
		correction made in one of these projects reaches every tool built on it, critcalc included:
	</p>
	<ul>
		<li>
			<a href="https://gcsim.app" target="_blank" rel="noopener noreferrer">gcsim</a>, whose frame
			data and tick cadences the Rotation Planner is timed from. A character implementation or a bug
			report there helps directly.
		</li>
		<li>
			<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer">Keqing Mains</a>,
			which keeps the notation, the theorycrafting conventions, and the testing behind them.
		</li>
	</ul>
</section>

<section>
	<h2 id="money">Financial support</h2>
	<p>Thank you for checking! critcalc isn’t in need of financial support right now.</p>
</section>
