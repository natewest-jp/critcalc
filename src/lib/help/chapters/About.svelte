<!-- About chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round). ⚓ The one place
	 the project says what it is FOR — once, as a description (style guide
	 §1.3). Credits name every source a help chapter cites. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
</script>

<h1>About critcalc</h1>

<p class="lede">
	critcalc.app is three tools for Genshin Impact theorycrafting. They draw how the game’s mechanics
	play out — when a buff is up, which hit applies its element, how likely a roll is — and leave the
	decision about what to build, run or pull with you.
</p>

<section>
	<h2 id="tools">The tools</h2>
	<p>
		<strong>The Team Builder</strong> is a party setup screen for Stygian Onslaught, the Spiral
		Abyss and your own lineups. Each team shows what it can provide — healing, shields, RES shred,
		buffs and more — read from the kits at the constellations you own, and what a swap would cost or
		gain.
		<a href={resolve('/help/builder')}>How it works</a>
	</p>
	<p>
		<strong>The Rotation Planner</strong> turns a rotation written in KQM notation into a timeline:
		every cast and swap, cooldowns, buff windows, the enemy’s aura, timed frame by frame.
		<a href={resolve('/help/planner')}>How it works</a>
	</p>
	<p>
		<strong>The Visualizers</strong> are eight small instruments, each about one mechanic: crit,
		elemental gauge, ICD, reaction scaling, the damage formula, enemy RES and DEF, artifact odds and
		wish odds. <a href={resolve('/help/visualizers')}>How they work</a>
	</p>
</section>

<section>
	<h2 id="data">Where the data comes from</h2>
	<p>
		Each character starts from genshin-db’s datamined kit and is then curated by hand: the effects,
		their conditions and their constellation gates are written from the kit text, and every frame
		count is measured against gcsim. Kits newer than genshin-db’s text are read from the Fandom
		wiki’s tooltips.
	</p>
	<p>
		Curation is uneven, because some kits are much harder to model than others. Where a character
		isn’t finished, the tools say so rather than guess, and the
		<a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a> lists, for every
		character, what the Rotation Planner draws and what it leaves out.
	</p>
</section>

<section>
	<h2 id="who">Who makes it</h2>
	<p>
		critcalc is Nate West’s project, built with Claude, Anthropic’s AI model, which wrote most of
		the code. It is one person’s work rather than a team’s, and it leans heavily on what the
		community has measured. Corrections are welcome — the
		<a href={resolve('/contribute')}>Contribute</a> page says how to send one.
	</p>
</section>

<section>
	<h2 id="credits">Credits</h2>
	<ul>
		<li>
			<a href="https://gcsim.app" target="_blank" rel="noopener noreferrer">gcsim</a>, the
			open-source combat simulator: frame data, tick cadences, ICD groups and targeting, and the
			reference for the gauge model.
		</li>
		<li>
			<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer">Keqing Mains</a>:
			the notation the Rotation Planner reads, and the theorycrafting conventions the tools follow.
		</li>
		<li>
			<a href="https://github.com/theBowja/genshin-db" target="_blank" rel="noopener noreferrer"
				>genshin-db</a
			>: the datamined kits every character starts from.
		</li>
		<li>
			<a href="https://genshin-impact.fandom.com" target="_blank" rel="noopener noreferrer"
				>The Genshin Impact Fandom wiki</a
			>: kit details for newer characters, capability lists, and the artifact and wish rates.
		</li>
		<li>
			<a href="https://lunaris.moe" target="_blank" rel="noopener noreferrer">Lunaris.moe</a> for
			Stygian Onslaught and Spiral Abyss data, and
			<a href="https://www.stygian.moe" target="_blank" rel="noopener noreferrer">Stygian.moe</a>
			for cross-checking season dates.
		</li>
		<li>
			<a href="https://github.com/OneBST/GGanalysis" target="_blank" rel="noopener noreferrer"
				>GGanalysis</a
			>, which Wish Odds is tested against; and Genshin Optimizer and SiriYu’s reshape solver, the
			two models behind Artifact Odds’ reading of a reshape.
		</li>
		<li>
			<a href="https://www.hoyolab.com/article/622264" target="_blank" rel="noopener noreferrer"
				>EODGamer’s crit heatmap</a
			>, the spreadsheet the Crit Heatmap grew out of.
		</li>
		<li>Type is IBM Plex and Bitter; the interface icons are Lucide’s. Both are open-licensed.</li>
	</ul>
</section>

<section>
	<h2 id="fan-project">A fan project</h2>
	<p>
		critcalc is an unofficial fan project, not affiliated with or endorsed by HoYoverse. Genshin
		Impact, its characters and its artwork belong to HoYoverse. critcalc takes no money and shows no
		ads.
	</p>
	<p>
		The code is licensed under the AGPL-3.0 and the curated data under CC BY-SA 4.0. critcalc’s own
		artwork — the logo, the icons and the scene — is not covered by either.
	</p>
</section>
