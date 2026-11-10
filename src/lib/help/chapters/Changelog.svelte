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
	<h2 id="2026-11">November 2026</h2>

	<div class="timeline">
		<article class="entry">
			<header class="entry-head">
				<h3>Sandrone is ready in the Rotation Planner</h3>
				<time class="entry-date" datetime="2026-11-10">November 10</time>
			</header>
			<p>
				Sandrone’s attacks, Skill, and Burst now run on gcsim’s frame data. A Charged Attack holds
				until just before Fagio overheats, or for as long as you set with C ~Xs. Fagio’s temperature
				carries through the rotation, cooling over time and faster off-field, and a quick Skill
				clears the way for the next hold. Fagio’s fire and beams now reach the aura lane, and the
				beams stop applying Cryo during Radiance. Neuvillette’s Charged Attack also takes C ~Xs now,
				to end Equitable Judgment early.
			</p>
		</article>
		<article class="entry">
			<header class="entry-head">
				<h3>Durin’s two dragons and Lan Yan’s Feathermoon Rings</h3>
				<time class="entry-date" datetime="2026-11-07">November 7</time>
			</header>
			<p>
				After Durin’s Denial of Darkness, his next Normal Attack starts the string again from the
				first hit. Durin’s passives and constellations now follow the dragon that is out, so the
				White and Dark forms draw their own effects.
			</p>
			<p>
				Pressing Normal Attack right after Lan Yan’s Swallow-Wisp Pinion Dance now throws her
				Feathermoon Rings, as it does in game, instead of an ordinary Normal Attack. Lan Yan’s
				Feathermoon Rings now also deal damage in the element her dash absorbs, her shield becomes
				infused, and her first constellation’s extra rings appear.
			</p>
		</article>
		<article class="entry">
			<header class="entry-head">
				<h3>Mitya and Valeriy, the Witch’s Revelation, and Kokomi’s jellyfish</h3>
				<time class="entry-date" datetime="2026-11-06">November 6</time>
			</header>
			<p>
				Mitya and Valeriy are in the roster. Their kits come from the game’s own text, and their
				casts use generic timing until frame data exists for them.
			</p>
			<p>
				Diona’s, Mizuki’s, and Cyno’s Witch’s Revelation talents were cross-checked against gcsim.
				Diona’s extra Icy Paws now apply Cryo, her C6 bonuses follow the Stellar reaction the team
				enables, and Mizuki’s C2 lowers enemy RES for as long as Dreamdrifter lasts.
			</p>
			<p>
				Kokomi’s burst now refreshes a Bake-Kurage that’s still out, as Tamakushi Casket says, and
				Nicole’s Guidance of Theosis no longer lands on Nicole herself.
			</p>
		</article>
		<article class="entry">
			<header class="entry-head">
				<h3>A new layout for the visualizers</h3>
				<time class="entry-date" datetime="2026-11-04">November 4</time>
			</header>
			<p>
				Visualizers has a new layout. All of the heavy panels have been slimmed to control bars,
				buttons, and interactions directly on the graphs. The headline (the large text) now appears
				for all visualizers and carries more useful information.
			</p>
			<p>
				Each one also now remembers your last-used settings, so you’ll find things the way you left
				them.
			</p>
			<p>
				Artifact odds has a new Try a reshape button that simulates the game’s Reshape animation.
				<a href="{resolve('/visualizers')}?i=artifact&do=reshape">Give it a try!</a>
			</p>
		</article>
		<article class="entry">
			<header class="entry-head">
				<h3>Capturing Radiance in Wish Odds</h3>
				<time class="entry-date" datetime="2026-11-02">November 2</time>
			</header>
			<p>
				Wish odds can follow your Capturing Radiance counter now, using the community’s model of how
				Radiance works. Find your current Radiance chances from a Paimon.moe export, or by answering
				a few questions about your recent 5★s.
			</p>
		</article>
		<article class="entry">
			<header class="entry-head">
				<h3>Editing in the gauge explorer</h3>
				<time class="entry-date" datetime="2026-11-01">November 1</time>
			</header>
			<p>
				The gauge explorer’s controls have been simplified: Now the element buttons on the toolbar
				add the next application, and editing gauge strength and element can be done by clicking on
				an existing application. Playback has been removed; it was only confusing users and not
				providing much.
			</p>
		</article>
	</div>
</section>

<section>
	<h2 id="2026-10">October 2026</h2>

	<div class="timeline">
		<article class="entry">
			<header class="entry-head">
				<h3>Alhaitham’s Mirrors, Ifa’s hover, and held skills</h3>
				<time class="entry-date" datetime="2026-10-30">October 30</time>
			</header>
			<p>
				Alhaitham’s Chisel-Light Mirrors are now simulated. While he holds a Mirror, his attacks
				deal Dendro damage and fire Projection Attacks, his burst hits more times for each Mirror it
				consumes, and his C1, C2, C4, and C6 follow the count. The timeline shows how many Mirrors
				he has.
			</p>
			<p>
				Ifa’s hover runs on Nightsoul points, so dashing shortens it, and his skill’s cooldown
				starts sooner.
			</p>
			<p>
				Held skills start their cooldown at the right moment. Fourteen characters’ Hold variants,
				including Candace’s, Charlotte’s, and Razor’s, were ending their cooldown early.
			</p>
		</article>
		<article class="entry">
			<header class="entry-head">
				<h3>The Traveler twins, and Arlecchino’s cooldown</h3>
				<time class="entry-date" datetime="2026-10-28">October 28</time>
			</header>
			<p>
				Aether and Lumine attack at different speeds in game, and the rotation planner now times
				each twin separately, in all seven elements. <code>Cryo Traveler</code> uses your profile’s
				twin; write <code>Cryo Aether</code> or <code>Cryo Lumine</code> to choose one, or pick the twin
				from the Traveler’s constellation on the bench.
			</p>
			<p>
				Arlecchino’s skill cooldown. Each Normal Attack hit now takes 0.8 seconds off All Is Ash’s
				cooldown, as it does in game.
			</p>
		</article>

		<!-- ⏭ Ships with the flip (copy pass 2026-10-27): date it the day it goes live. -->
		<article class="entry">
			<header class="entry-head">
				<h3>Profiles, and a new layout</h3>
				<time class="entry-date" datetime="2026-10-27">October 27</time>
			</header>
			<p>
				critcalc now keeps your work in profiles, so you can plan for separate Genshin accounts. A
				profile holds its own roster, teams, and library of rotations and lineups.
			</p>
			<p>
				Shared links open in Theorycraft, a built-in profile with no roster for exploring ideas
				outside your own profiles.
			</p>
			<p>
				Tools now work with one rotation or lineup at a time. However, the rotation planner has a
				<strong>Compare</strong> button beside the bench, so you can flip between two ideas quickly.
			</p>
			<p>
				Work saves itself as you go, and anything you delete stays in the Trash for 30 days. If you
				used the site before, everything you had is in a new profile called My profile.
			</p>
		</article>

		<article class="entry">
			<header class="entry-head">
				<h3>A team you open stays on the bench</h3>
				<time class="entry-date" datetime="2026-10-22">October 22</time>
			</header>
			<p>
				On the rotation planner: A team opened from the Library, a lineup, or a team link now
				arrives with an empty notation box and its four characters already in their slots. Each one
				keeps their slot until you write their actions. Until their name is typed, they’re shown
				resting (dimmed). Before this, clearing the notation box to start writing removed
				characters.
			</p>
		</article>

		<article class="entry">
			<header class="entry-head">
				<h3>critcalc launches</h3>
				<time class="entry-date" datetime="2026-10-19">October 19</time>
			</header>
			<p>
				critcalc.app goes live with a team builder, rotation planner, and eight visualizers. Source
				code is on
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
			<strong>Energy.</strong> The rotation planner treats a burst as ready whenever its cooldown is.
		</li>
		<li>
			<strong>More than one enemy.</strong> The rotation planner and the gauge explorer assume a single
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
			<strong>Lunar-Charged and Lunar-Crystallize in the gauge explorer.</strong> The rotation planner
			models both; the gauge explorer doesn’t yet.
		</li>
		<li>
			<strong>Co-op shields.</strong> Shields that only reach other players’ characters in co-op, such
			as Nicole’s C2 and the splash from Diona’s C2.
		</li>
		<li><strong>Languages.</strong> The site is in English only for now.</li>
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
