<!-- What's new chapter (/changelog) — see $lib/help/areas.ts. Every <h2>
	 carries an id; the area shell reads them for the sidebar's table of
	 contents, so a MONTH is an <h2> and an entry is an <h3> under it.

	 Added 2026-10-21 (⚓ Nate). The noticeable changes, newest first — ⛔ not
	 every commit: a change goes here when a player would notice it. Character
	 kits are the coverage page's job; an entry may name a character, but this
	 page mostly carries the rest. ⛔ No "planned" list: we ship faster than a
	 plan would stay true, and a plan with no date is a promise. Known gaps is
	 the exception, for long-term limits only, written as what the tools don't
	 do YET (style guide §1.3: ⛔ never "never" about the future).

	 To add an entry: one <article> at the top of its month, newest first; a new
	 month is a new <section> with an <h2 id="YYYY-MM">. The daily check-in
	 proposes an entry when a user-visible to-do item is removed. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
</script>

<h1>What’s new</h1>

<p class="lede">
	The changes you’re most likely to notice, newest first. For how far each character’s kit has
	gotten, see the
	<a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a>.
</p>

<section>
	<h2 id="2026-10">October 2026</h2>

	<article class="entry">
		<h3>A page for what’s new</h3>
		<p class="entry-date"><time datetime="2026-10-21">October 21</time></p>
		<p>
			Noticeable changes are listed here as they ship. <a href="#known-gaps">Known gaps</a>, at the
			bottom, lists what the tools don’t model yet.
		</p>
	</article>

	<article class="entry">
		<h3>critcalc launches</h3>
		<p class="entry-date"><time datetime="2026-10-19">October 19</time></p>
		<p>
			critcalc.app is public, with the Team Builder, the Rotation Planner, and eight Visualizers.
			The source code is on
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external -->
			<a href="https://github.com/natewest-jp/critcalc" target="_blank" rel="noopener noreferrer"
				>GitHub</a
			>.
		</p>
	</article>
</section>

<section>
	<h2 id="known-gaps">Known gaps</h2>
	<p>
		Longer-term limits that are not yet modeled. Gaps in a single character’s kit are on the
		<a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a>.
	</p>
	<ul>
		<li>
			<strong>Energy.</strong> The Rotation Planner treats a burst as ready whenever its cooldown is.
		</li>
		<li>
			<strong>More than one enemy.</strong> The Rotation Planner and the Gauge Explorer assume a single
			target, so Swirl’s spread to other enemies isn’t drawn.
		</li>
		<li>
			<strong>Enemies with their own element.</strong> The enemy is assumed to have no permanent aura
			and to apply nothing back to you.
		</li>
		<li><strong>Shatter.</strong></li>
		<li>
			<strong>Damage from reaction objects.</strong> Dendro Cores, Starlight Prisms, the Thundercloud,
			and Moondrifts are drawn while they exist, but the damage they deal isn’t.
		</li>
		<li>
			<strong>Lunar-Charged and Lunar-Crystallize in the Gauge Explorer.</strong> The Rotation Planner
			models both; the Gauge Explorer doesn’t yet.
		</li>
		<li>
			<strong>Co-op shields.</strong> Shields that only reach other players’ characters in co-op, such
			as Nicole’s C2 and the splash from Diona’s C2.
		</li>
		<li><strong>Languages.</strong> The site is in English only for now.</li>
	</ul>
</section>

<style>
	/* The date binds UP to its title: h3 already spaces itself to bind down,
	   so the date pulls in under it and the body follows at the normal gap. */
	.entry-date {
		margin: -0.1rem 0 0.6rem;
		font-size: var(--fs-md);
		color: var(--muted);
	}
</style>
