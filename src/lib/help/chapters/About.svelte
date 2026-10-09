<!-- About chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents. -->
<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<h1>About critcalc</h1>

<p class="lede">
	<strong>critcalc.app</strong> is a small set of theorycrafting tools for Genshin Impact. The idea
	is to <em>visualize</em> the mechanics behind a team — how crit rolls, buffs, cooldowns, and rotations
	actually stack up — rather than reduce everything to a single number.
</p>

<section>
	<h2 id="tools">The three tools</h2>
	<ul>
		<li>
			<strong>Team Builder</strong> — find characters by what they actually provide (healing, shields,
			off-field damage, RES shred, buffs), each traced to the ability and constellation that grants it,
			and compare their timings side by side.
		</li>
		<li>
			<strong>Rotation Planner</strong> — write a rotation in KQM-style notation and watch it render as
			a frame-accurate timeline: ability windows, buff uptime, cooldowns, and swaps.
		</li>
		<li>
			<strong>Visualizers</strong> — a shelf of small graph instruments: how crit rate and crit damage
			combine across the whole spread of possible rolls, how elemental application lands, the real odds
			behind artifact farming and wishing, how gauges decay, and how reactions scale with EM.
		</li>
	</ul>
</section>

<section>
	<h2 id="philosophy">The philosophy</h2>
	<p>
		critcalc deliberately <strong>visualizes mechanics, never verdicts</strong>. There are no damage
		totals, no tier lists, and no "synergy scores." The tools show you how the pieces fit together
		so the judgment stays yours. Terminology throughout follows the
		<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer">Keqing Mains</a> (KQM)
		standards.
	</p>
	<p>
		The same principle governs the data. Timing is only ever taken from gcsim or in-game kit text,
		never invented, and a kit that hasn't been curated yet is labelled as such rather than filled in
		with plausible guesses.
	</p>
</section>

<section>
	<h2 id="credits">Credits</h2>
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
			— theorycrafting standards and the action notation the Rotation Planner reads.
		</li>
		<li>
			<a href="https://github.com/theBowja/genshin-db" target="_blank" rel="noopener noreferrer"
				>genshin-db</a
			> — the datamined character, talent, and identity data our pipeline is seeded from.
		</li>
		<li>
			<a href="https://lunaris.moe" target="_blank" rel="noopener noreferrer">Lunaris.moe</a> — Stygian
			Onslaught's seasons, bosses and battlefield checks, and the boss artwork, from the game's own data.
		</li>
		<li>
			<a href="https://www.stygian.moe" target="_blank" rel="noopener noreferrer">Stygian.moe</a> — the
			Stygian Onslaught archive we check each season's dates against.
		</li>
		<li>
			<a href="https://genshin-impact.fandom.com" target="_blank" rel="noopener noreferrer"
				>Genshin Impact Wiki</a
			> — kit details our sources leave out, and the capability lists we check ours against.
		</li>
	</ul>
	<p>
		If you get value out of critcalc, the best thing you can do is
		<a href={resolve('/contribute')}>support those projects</a> — their work is what this one is built
		on.
	</p>
</section>

<section>
	<h2 id="fan-project">A fan project</h2>
	<p>
		critcalc is an independent, non-commercial fan project. It is not affiliated with, endorsed by,
		or sponsored by HoYoverse. Genshin Impact and all related trademarks and assets belong to
		HoYoverse.
	</p>
</section>
