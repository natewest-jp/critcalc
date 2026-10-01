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
		The average damage multiplier — 1&nbsp;+&nbsp;(Crit Rate × Crit Damage) — across every stat
		combination. Drag the marker or use the sliders; cool blue is lower output, yellow through
		red-purple higher.
	</p>
	<p>
		Dashed lines mark builds with the same average damage. The solid equal-budget line traces every
		build sharing your total crit value (CV = 2·CR + CD) — drag along it to see where a fixed stat
		budget pays out best. Pin a build to freeze a second marker and eyeball a trade against it.
	</p>
	<p>
		The no-crit risk overlay darkens regions where a whole rotation can land zero crits, and
		<strong>Roll it</strong> samples your rotation for real, so you can watch how often the coin flips
		betray the average.
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
		application rate as you drag the hit interval.
	</p>
</section>

<section>
	<h2 id="artifact-rolls">Artifact Rolls</h2>
	<p>
		The real odds behind 5★ artifact farming, from datamined weights. <strong>Fresh Drop</strong>:
		how rare your target substat pair is. <strong>Upgrade Rolls</strong>: the exact crit-value
		distribution a piece can reach at +20. <strong>Reshape</strong>: what the Dust of Enlightenment
		guarantee actually does to the odds.
	</p>
	<p>
		The reshape guarantee is modelled as a conditional redistribution — at least N rolls into the
		selected pair, other outcomes renormalized — because the exact in-game implementation is not
		publicly documented. Sanctifying Elixir crafts skip the substat draw entirely and, since 5.5,
		guarantee at least 2 upgrade rolls into the crafted pair.
	</p>
	<p>
		<strong>Appraise</strong> dials in a real +20 piece's substat values and shows where it sits on its
		own outcome distribution. The value wheels only offer numbers the game can actually display; roll
		counts are inferred from them, cross-validated against the Genshin Optimizer.
	</p>
</section>

<section>
	<h2 id="gauge-explorer">Gauge Explorer</h2>
	<p>
		How elemental auras live and die. Build a sequence of applications and watch the gauge decay,
		the 0.8× aura tax, and how each reaction consumes aura at its own rate: ×2 forward vape/melt,
		×0.5 reverse, ×0.5 swirl/crystallize, 1:1 the rest, 2:1 for bloom. Mechanics follow KQM gauge
		theory cross-checked against gcsim.
	</p>
	<p>
		The strip under the chart shows which aura icons hang over the enemy at any moment. Press play
		to watch the gauges drain — slow-motion speeds are a chip away — or drag the paused playhead to
		read exact values. Single target only: swirl spreading, shatter, and what happens to Dendro
		Cores after they spawn are out of scope.
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
	<h2 id="enemy-def-res">Enemy DEF &amp; RES</h2>
	<p>
		The two hidden multipliers every hit passes through. <strong>DEF</strong>: your level against
		the enemy's sets a baseline cut — equal levels already cost you half — and shred or ignore claws
		it back. <strong>RES</strong>: most enemies resist 10%, and shred subtracts from that.
	</p>
	<p>
		Pushing RES below 0% still pays, but each negative point only counts half — exactly why 4pc
		Viridescent Venerer over-delivers on a 10%-RES enemy. Above 75% the curve flattens into deep
		diminishing returns.
	</p>
</section>

<section>
	<h2 id="wish-odds">Wish Odds</h2>
	<p>
		Which pull actually lands the featured 5★, from your current pity and guarantee state. The
		filled shape is "which pull gets it", the line is your cumulative chance, and the marker is your
		saved pulls — drag it.
	</p>
	<p>
		Pity model: 0.6% flat until soft pity ramps from pull 74 (weapons: 0.7% ramping from 63).
		Featured odds use the official consolidated rates — 55% character including Capturing Radiance,
		37.5% charted weapon, 1 fate point. The Radiance streak counter is not fully datamined and is
		deliberately not guessed at.
	</p>
</section>

<section>
	<h2 id="damage-anatomy">Damage Anatomy</h2>
	<p>
		Your hit as an equation of boxes. Each box has four lines, named by the key at the start of the
		row: what it is, its formula, the numbers from your sheet, and the multiplier it applies. Only
		the multiplier line takes part in the product. A box's <em>width</em> shows how far it moves the hit,
		so a ×2 box is the same width wherever it comes from. Hover or tap a box to have it read out in words.
	</p>
	<p>
		A direct hit is shown relative to a hit from its base stat alone, because its talent multiplier
		depends on the attack. Additive chunks, transformative damage, and Lunar and Stellar reaction
		damage come from level and EM, so they print as numbers. <strong>What the next roll buys</strong
		> applies one average 5★ substat roll at a time to your sheet; pick ATK, HP or DEF so the rolls match
		the stat your character scales on.
	</p>
</section>
