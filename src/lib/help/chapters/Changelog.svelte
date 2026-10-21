<!-- What's new chapter (/changelog) — see $lib/help/areas.ts. Every <h2>
	 carries an id; the area shell reads them for the sidebar's table of
	 contents, so a MONTH is an <h2> and an entry is an <h3> under it. The
	 entries of a month sit on a TIMELINE (⚓ Nate 2026-10-21): a rule down the
	 left with a dot at each date; the month heading interrupts it.

	 Added 2026-10-21 (⚓ Nate). The noticeable changes, newest first — ⛔ not
	 every commit: a change goes here when a player would notice it. Character
	 kits are the coverage page's job; an entry may name a character, but this
	 page mostly carries the rest. ⛔ No "planned" list: we ship faster than a
	 plan would stay true, and a plan with no date is a promise. Known gaps is
	 the exception, for long-term limits only, written as what the tools don't
	 do YET (style guide §1.3: ⛔ never "never" about the future).

	 To add an entry: one <article> at the top of its month's .timeline, newest
	 first; a new month is a new <section> with an <h2 id="YYYY-MM"> and its own
	 .timeline. The daily check-in proposes an entry when a user-visible to-do
	 item is removed. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
</script>

<h1>What’s new</h1>

<p class="lede">
	<a href="#known-gaps">Known gaps</a> are at the bottom of the page. For how far each character’s
	kit has gotten, see the
	<a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a>.
</p>

<section>
	<h2 id="2026-10">October 2026</h2>

	<div class="timeline">
		<article class="entry">
			<p class="entry-date"><time datetime="2026-10-21">October 21</time></p>
			<h3>A page for what’s new</h3>
			<p>
				Noticeable changes are listed here as they ship. <a href="#known-gaps">Known gaps</a>, at
				the bottom, lists what the tools don’t model yet.
			</p>
		</article>

		<article class="entry">
			<p class="entry-date"><time datetime="2026-10-19">October 19</time></p>
			<h3>critcalc launches</h3>
			<p>
				critcalc.app is public, with the Team Builder, the Rotation Planner, and eight Visualizers.
				The source code is on
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external -->
				<a href="https://github.com/natewest-jp/critcalc" target="_blank" rel="noopener noreferrer"
					>GitHub</a
				>.
			</p>
		</article>
	</div>
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
	/* THE TIMELINE. The gutter holds a rule and a dot per entry; the rule is
	   drawn per entry, from its own dot down to the next one, so it starts at
	   the first dot and stops at the last instead of running past either. It
	   is the entry's ::before so the dot (the date's ::before, a child) paints
	   over it. */
	.timeline {
		--tl-gutter: 1.6rem;
		--tl-x: 0.45rem; /* the rule's centre, from the gutter's left edge */
		--tl-dot: 9px;
		--tl-date-lh: 1.4rem;
		margin: 0 0 0.9rem;
	}

	.entry {
		position: relative;
		padding: 0 0 1.6rem var(--tl-gutter);
	}

	.entry:last-child {
		padding-bottom: 0;
	}

	.entry:not(:last-child)::before {
		content: '';
		position: absolute;
		left: calc(var(--tl-x) - 1px);
		top: calc(var(--tl-date-lh) / 2);
		bottom: calc(var(--tl-date-lh) / -2);
		width: 2px;
		background: var(--line-soft);
	}

	.entry-date {
		position: relative;
		margin: 0;
		font-size: var(--fs-md);
		line-height: var(--tl-date-lh);
		color: var(--muted);
	}

	.entry-date::before {
		content: '';
		position: absolute;
		left: calc(var(--tl-x) - var(--tl-gutter) - var(--tl-dot) / 2);
		top: calc(var(--tl-date-lh) / 2 - var(--tl-dot) / 2);
		width: var(--tl-dot);
		height: var(--tl-dot);
		border-radius: 50%;
		background: var(--accent);
	}

	/* The title binds to its date above and its text below; .prose h3's own
	   1.8rem top is for a heading that opens a block, which the date does here. */
	.entry h3 {
		margin: 0.1rem 0 0.35rem;
	}
</style>
