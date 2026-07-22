<!-- Static content page — no state, fully prerendered. -->
<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>About · critcalc.app</title>
	<meta
		name="description"
		content="What critcalc is: a set of Genshin Impact theorycrafting tools that visualize mechanics rather than reduce them to a score."
	/>
</svelte:head>

<h1>About critcalc</h1>

<p class="lede">
	<strong>critcalc.app</strong> is a small set of theorycrafting tools for Genshin Impact. The idea
	is to <em>visualize</em> the mechanics behind a team — how crit rolls, buffs, cooldowns, and rotations
	actually stack up — rather than reduce everything to a single number.
</p>

<h2>The three tools</h2>
<ul>
	<li>
		<strong>Crit Visualizer</strong> — see how crit rate and crit damage combine across the whole spread
		of possible rolls, how elemental application (ICD) actually lands, the real odds behind artifact farming,
		how gauges decay, and how reactions scale with EM.
	</li>
	<li>
		<strong>Rotation Planner</strong> — write a rotation in KQM-style notation and watch it render as
		a frame-accurate timeline: ability windows, buff uptime, cooldowns, and swaps.
	</li>
	<li>
		<strong>Team Builder</strong> — find characters by what they actually provide (healing, shields, off-field
		damage, RES shred, buffs), each traced to the ability and constellation that grants it, and compare
		their timings side by side.
	</li>
</ul>

<h2>The philosophy</h2>
<p>
	critcalc deliberately <strong>visualizes mechanics, never verdicts</strong>. There are no damage
	totals, no tier lists, and no "synergy scores." The tools show you how the pieces fit together so
	the judgment stays yours. Terminology throughout follows the
	<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer">Keqing Mains</a> (KQM) standards.
</p>

<h2>Credits</h2>
<p>Character data is curated in-house, but this project stands on the community's work:</p>
<ul>
	<li>
		<a href="https://gcsim.app" target="_blank" rel="noopener noreferrer">gcsim</a> — the open-source
		Genshin combat simulator, our primary source for tick cadences, ability scalings, and targeting.
	</li>
	<li>
		<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer"
			>Keqing Mains (KQM)</a
		>
		— theorycrafting standards and the action-notation the Rotation Planner reads.
	</li>
	<li>
		<a href="https://github.com/theBowja/genshin-db" target="_blank" rel="noopener noreferrer"
			>genshin-db</a
		> — the datamined character, talent, and identity data our pipeline is seeded from.
	</li>
</ul>

<h2>A fan project</h2>
<p>
	critcalc is an independent, non-commercial fan project. It is not affiliated with, endorsed by, or
	sponsored by HoYoverse. Genshin Impact and all related trademarks and assets belong to HoYoverse.
	Have a question or spotted something wrong? The <a href={resolve('/faq')}>Help &amp; FAQ</a> page is
	the place to start.
</p>
