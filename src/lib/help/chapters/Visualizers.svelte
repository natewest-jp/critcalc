<!-- Help chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-07-26 against the shipped tool: the old copy predated the
	 workspace layer and listed five instruments of eight. If an instrument is
	 added or renamed, INSTRUMENTS in visualizers/lib/workspace.ts is the
	 source of truth for the roster. -->

<h1>Visualizers</h1>

<p class="lede">
	A family of small graph instruments, each one taking a single mechanic and drawing it. On wide
	screens several sit side by side.
</p>

<section>
	<h2 id="workspace">The workspace</h2>
	<p>
		Use the dropdown above each tile to choose which instrument lives in that slot. Your layout is
		remembered between visits; <strong>Reset layout</strong> restores the default, and each tile can be
		reset on its own without disturbing the others.
	</p>
	<p>
		<strong>Share</strong> copies a link that reopens an instrument exactly as it looks, inputs and all.
		Some instruments can also hand off to each other — the ICD Timeline can send its applying hits straight
		to the Gauge Explorer, for instance.
	</p>
</section>

<section>
	<h2 id="crit-heatmap">Crit Heatmap</h2>
	<p>
		The average damage multiplier — 1&nbsp;+&nbsp;(CRIT Rate × CRIT DMG) — across every stat
		combination. Drag the marker or use the sliders; cool blue is lower output, yellow through
		red-purple higher.
	</p>
	<p>
		Dashed lines mark builds with the same average damage. The solid equal-budget line traces every
		build sharing your total crit value (2 × CRIT Rate + CRIT DMG) — drag along it to see where a
		fixed stat budget pays out best. Pin a build to freeze a second marker and eyeball a trade
		against it.
	</p>
	<p>
		Below the build, a bar chart shows how likely each number of crits is across one rotation of the
		hits you set, with a line at the average. <strong>Roll</strong> plays one rotation and lights up the
		bar it landed on. The no-crit risk overlay darkens the builds where a whole rotation can land zero
		crits.
	</p>
</section>

<section>
	<h2 id="gauge-explorer">Gauge Explorer</h2>
	<p>
		How elemental auras live and die. Build a sequence of applications and watch the gauge decay,
		the ×0.8 aura tax, and how each reaction consumes aura at its own rate: ×2 for forward Vaporize
		and Melt, ×0.5 reverse, ×0.5 for Swirl and Crystallize, 1:1 the rest, 2:1 for Bloom. Mechanics
		follow KQM gauge theory, cross-checked against gcsim.
	</p>
	<p>
		Click the band above the chart to add an application there — a copy of the selected one — and
		drag a marker to move it in time. The toolbar over the chart sets the selected application's
		element and size. Point at the chart to read every aura at that moment, or press play to watch
		the gauges drain, at slow motion if you like. The strip under the chart shows which aura icons
		hang over the enemy. Single target only: Swirl spreading, Shatter, and what happens to Dendro
		Cores after they spawn are out of scope.
	</p>
</section>

<section>
	<h2 id="icd-timeline">ICD Timeline</h2>
	<p>
		Which hits of an attack string actually apply their element. Standard ICD allows an application
		every 2.5 seconds or every 3rd hit; the 3-hit rule does <em>not</em> reset the 2.5s timer, which is
		why application patterns look irregular.
	</p>
	<p>
		Faster attack strings do not mean proportionally more elemental application — watch the
		applications per window as you drag the hit interval, and point at a hit to see why it applies
		or is blocked.
	</p>
	<p>
		Standard is the default, not the only rule. The examples load real hit timings with their own
		ICD groups — Fischl's Oz, Hu Tao's charged attacks, Chevreuse's Burst and Layla's Shooting
		Stars. Some groups stop applying after a set number of hits until their timer runs out.
	</p>
</section>

<section>
	<h2 id="reaction-curves">Reaction Curves</h2>
	<p>
		How reaction payouts scale with Elemental Mastery. Each family rides a different curve:
		amplifying 2.78·EM/(1400+EM), transformative 16·EM/(2000+EM), additive 5·EM/(1200+EM), Lunar and
		Stellar 6·EM/(2000+EM), crystallize 4.44·EM/(1400+EM). <strong>All families</strong> puts those five
		on one chart; pick a family's tab to see its reactions' damage at a given level. Drag on the chart
		or slide to move along it, and hover or tap a row of the readout to have it read out in words below
		the table.
	</p>
	<p>
		A Reaction Bonus such as 4pc Crimson Witch adds inside the same bracket as EM, so the Reaction
		Bonus slider also says how much EM it is worth from where you are. Values are before enemy RES.
		Transformative damage can't crit for most characters; additive flat damage joins the hit and
		crits with it; Lunar and Stellar reaction damage crits on its own.
	</p>
</section>

<section>
	<h2 id="damage-breakdown">Damage Breakdown</h2>
	<p>
		Your hit as its formula, one multiplier per row, read top to bottom. Each row shows the
		multiplier's formula, the numbers from your sheet, and a bar. The bars share one axis whose
		gridlines double the hit, so a ×2 is the same length wherever it sits, each bar starts where the
		one above it ended, and a cut such as enemy DEF runs backward. Hover or tap a row to have it
		read out in words, with its share of the boost.
	</p>
	<p>
		A direct hit is shown relative to a hit from its base stat alone, because its talent multiplier
		depends on the attack. Additive chunks, transformative damage, and Lunar and Stellar reaction
		damage come from level and EM, so they end in a number. <strong>What the next roll buys</strong>
		applies one average 5★ substat roll at a time to your sheet; pick ATK, HP or DEF so the rolls match
		the stat your character scales on.
	</p>
</section>

<section>
	<h2 id="enemy-res-def">Enemy RES &amp; DEF</h2>
	<p>
		Two hidden multipliers every hit passes through, stacked one above the other. Point at either
		chart to read it, and drag to move the enemy. Pick your hit's element and level, the enemy's RES
		and level, and tick the shred you bring; the readout multiplies them together.
	</p>
	<p>
		Equal levels already cost you half your damage, and DEF shred and ignore win it back. Below 0%
		RES, shred still helps at half strength; above 75%, it's weaker until RES drops back under 75%.
	</p>
</section>

<section>
	<h2 id="artifact-odds">Artifact Odds</h2>
	<p>
		The odds behind a 5★ artifact, from datamined weights, through a piece's life. Pick
		<strong>your stats</strong> — up to four substats that count as good — and every view measures
		them. <strong>Drop</strong>: how many days of resin it takes to get the piece you want, from a
		domain or during a Stygian Onslaught Disturbance Outbreak. <strong>Level up</strong>: what your
		stats reach at +20 on a piece that has them, coloured by how many upgrades landed in them.
		<strong>Your piece</strong>: enter a real piece, line by line as the game shows it, to see how
		it ranks, what it can still become, and what a reshape would do.
	</p>
	<p>
		Your stats are measured in crit value when they are CRIT Rate and CRIT DMG, and otherwise in
		useful rolls: each upgrade into them counts by its size, a top roll 1 and the smallest 0.7.
	</p>
	<p>
		The game doesn't say how a guarantee of at least N upgrades is met, for reshaping or for a piece
		defined with Sanctifying Elixir. The Artifact Odds instrument assumes the upgrades land as usual
		and any shortfall is moved into the selected lines — the reading Genshin Optimizer uses.
	</p>
</section>

<section>
	<h2 id="wish-odds">Wish Odds</h2>
	<p>
		How many pulls a goal takes, from your current pity and guarantee: the featured 5★ or 4★ up to
		C6, the charted weapon up to R5, or a 5★ and their weapon together. There is one line per level
		on the way to the goal, each showing your chance of being there by a given pull. The marker is
		your saved pulls; drag it.
	</p>
	<p>
		Pity model: a 5★ drops at 0.6% per pull until soft pity ramps from pull 74 (on the weapon
		banner, 0.7% ramping from 63); a 4★ drops at 5.1%, then 56.1% on the 9th pull, and is certain on
		the 10th. Featured odds use the official rates: 55% for a 5★ character including Capturing
		Radiance, 37.5% for the charted weapon with one fate point, and 50% for a 4★, which is then one
		of three featured characters, split evenly. The Radiance streak counter is not fully datamined,
		so each 5★ is modeled as an independent 55%.
	</p>
	<p>
		Only pulls on a banner that features your goal count. Copies from Starglitter or events are not
		in the curves, so set <strong>You have</strong> to what you own. A 5★ landing on the 10th pull
		pushes that 4★ to the 11th; it is left out, and moves 4★ C6 by about one pull. The model matches
		<a href="https://github.com/OneBST/GGanalysis" target="_blank" rel="noopener noreferrer"
			>GGanalysis</a
		>.
	</p>
</section>
