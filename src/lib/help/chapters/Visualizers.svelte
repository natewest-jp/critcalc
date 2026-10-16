<!-- Help chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round), from a fact
	 sweep of the shipped instruments and their pass records
	 (docs/*-pass-2026-10-0*.md). If an instrument is added or renamed,
	 INSTRUMENTS in visualizers/lib/workspace.ts is the source of truth for the
	 roster, and the sections follow the picker's order. -->

<h1>Visualizers</h1>

<p class="flavor">
	A dome with eight apertures, each lens ground to bring a single law of the world into focus. The
	keeper’s notebook records what every lens showed, and none of the keeper’s conclusions.
</p>

<p class="lede">
	Eight instruments, each taking one mechanic and drawing it, with the controls to push it around
	and a Readout that puts the result in words.
</p>

<section>
	<h2 id="workspace">The workspace</h2>
	<p>
		The workspace shows as many instruments side by side as the window has room for: one, two from
		1360px wide, three from 2200px. The menu over each tile picks its instrument; picking one
		already showing in another tile swaps the two. <strong>Instruments shown</strong> in the
		document bar can lower the count, and <strong>Reset layout</strong> puts back the default lineup.
		Both are hidden when only one tile fits.
	</p>
	<p>
		Each tile has its own <strong>Defaults</strong>, which resets that instrument’s controls, and
		<strong>Share</strong>, which copies a link that reopens the instrument exactly as it looks; the
		link opens in the first tile. The tile’s <strong>⋯</strong> menu has
		<strong>Report a problem</strong>, carrying the same link.
	</p>
	<p>
		The layout is remembered between visits; the instruments’ settings are not, and start from their
		defaults each time. Within a visit, an instrument keeps its state while it’s out of view.
	</p>
</section>

<section>
	<h2 id="crit-heatmap">Crit Heatmap</h2>
	<p>
		Your average damage multiplier, 1&nbsp;+&nbsp;CRIT Rate&nbsp;×&nbsp;CRIT DMG, across every split
		of CRIT Rate (up the side) and CRIT DMG (along the bottom). Press anywhere on the map to move
		your build there, or use the sliders and number fields. The dashed contours join builds with the
		same average.
	</p>
	<p>
		<strong>Equal-budget line</strong> draws every build with your total crit value (CV), counted as
		2&nbsp;×&nbsp;CRIT Rate&nbsp;+&nbsp;CRIT DMG with the base 5% and 50% included. A ring marks
		that budget’s best split, which sits on the 1:2 diagonal until CRIT Rate would pass 100% and
		then leaves it. <strong>Pin this build</strong> holds a second marker so you can compare a trade.
	</p>
	<p>
		The average hides how uneven a rotation can be. The <strong>no-crit risk</strong> shading
		darkens builds by their chance of a whole rotation without a single crit, and the chart under
		the map shows every outcome for one rotation of however many hits you set — how often 3 of 8
		crit, or none do. <strong>Roll</strong> plays one rotation out.
	</p>
	<p>
		The Crit Heatmap grew out of
		<a href="https://www.hoyolab.com/article/622264" target="_blank" rel="noopener noreferrer"
			>EODGamer’s spreadsheet heatmap</a
		>.
	</p>
</section>

<section>
	<h2 id="gauge-explorer">Gauge Explorer</h2>
	<p>
		How auras attach, decay and get consumed, over up to 15s and eight applications. The band above
		the chart is the editor: click empty band to add an application (a copy of the selected one),
		drag a pill to move it, and use the toolbar to change its element and size or remove it. A
		focused pill moves with the arrow keys, 0.1s at a time or 1s with Shift, and Delete removes it.
		Fourteen worked examples, from a single aura to Burning, load from the menu.
	</p>
	<p>
		The chart draws each aura’s gauge over time and the reactions above the applications that caused
		them. Point at the chart to read that moment in the Readout, or play it through. The aura log
		below lists every application and reaction with what each took off the gauge.
	</p>
	<p>
		The model is KQM’s elemental gauge theory, checked against gcsim and stepped at 60 frames a
		second. An aura keeps 80% of what was applied and decays over 2.5s per unit plus 7s. Applying
		the same element tops the gauge up but keeps the first application’s decay rate, except Pyro
		since version 3.0, where a weaker hit does nothing and a stronger one replaces the aura
		outright. Reactions consume different amounts: forward Vaporize and Melt take twice the trigger,
		reverse half; Overloaded, Superconduct and Quicken one for one; Swirl and Crystallize half, with
		a 1s cooldown on Crystallize. Bloom takes Dendro at half the Hydro rate. Electro-Charged leaves
		both auras in place and drains each by 0.4U a second; Aggravate and Spread consume nothing.
	</p>
	<p>
		One target, and every application you place lands — ICD is the ICD Timeline’s job. Swirl’s
		spread to other enemies, Shatter and Lunar-Charged aren’t modeled.
	</p>
</section>

<section>
	<h2 id="icd-timeline">ICD Timeline</h2>
	<p>
		Which hits in a string actually apply their element. Each hit is a stalk: tall in the element’s
		color if it applies, a short faint tick if ICD blocks it. The digit under each hit is the hit
		counter, ringed where the counter is what let it through, and the bands underneath are the timer
		windows. Point at a hit to read why it did or didn’t apply.
	</p>
	<p>
		The attack string is either evenly spaced hits, with a slider for the interval, or one of four
		real examples taken from gcsim: Fischl’s Oz, Hu Tao’s charged attacks, Chevreuse’s burst and
		Layla’s Shooting Stars. The rule is <strong>Standard</strong>, <strong>No ICD</strong>, the
		example’s own, or <strong>Custom</strong>.
	</p>
	<p>
		Standard ICD is a 2.5s timer and every third hit, and it stops after eight applications in one
		window, though no real string gets that far. A hit let through by the timer restarts the timer
		and the counter; a hit let through by the counter restarts neither. The examples show how far
		real rules differ: under its own rule Oz applies on its 1st, 5th and 7th ticks, not the 1st,
		4th, 7th and 10th Standard would give.
	</p>
	<p>
		<strong>Send to Gauge Explorer</strong> hands the first eight applying hits within 15s to the Gauge
		Explorer, at 1U each.
	</p>
</section>

<section>
	<h2 id="reaction-curves">Reaction Curves</h2>
	<p>
		How each family of reactions scales with Elemental Mastery. The tabs over the chart are the
		families: Amplifying, Transformative, Additive, Lunar &amp; Stellar and Crystallize, plus
		<strong>All families</strong>, which puts them on one scale as the bonus each gets from EM. Drag
		across the chart to set EM; the table reads each reaction at that value, with what the next 50
		EM would add.
	</p>
	<p>
		Every curve has the same shape, a bonus of k&nbsp;×&nbsp;EM&nbsp;/&nbsp;(c&nbsp;+&nbsp;EM), with
		its own k and c per family, and Reaction Bonus adds inside it. On All families, a Reaction Bonus
		above zero adds a column for how much EM the bonus is worth, which varies a lot: at 600 EM, +40%
		is worth about 87 EM for a transformative reaction and over 500 for an amplifying one. Level
		matters for the reactions that scale with it; the slider runs to 90, then 95 and 100.
	</p>
	<p>
		Lunar and Stellar reactions show the share of the character who contributes most, 60%. Every
		figure is before the enemy’s RES, and Stellar Swirl’s figures come from gcsim and haven’t been
		confirmed in game.
	</p>
</section>

<section>
	<h2 id="damage-breakdown">Damage Breakdown</h2>
	<p>
		One hit written out as its damage formula, one multiplier per row, in the formula’s order. Each
		bar starts where the last one ended, on a scale where each gridline doubles the damage, so a ×2
		is the same width wherever it falls and a cut like enemy DEF runs backward. Hover or tap a row
		to read what share of the result it accounts for.
	</p>
	<p>
		The tabs choose the kind of hit: a direct hit (optionally Vaporized or Melted), an additive one
		like Spread, a transformative reaction, or a Lunar or Stellar one. Only the sliders that feed
		that formula are shown. A direct hit ends as a ratio against a hit from your scaling stat alone,
		because the talent multiplier isn’t an input; the reaction families end in a number. Enemy RES
		is entered after shred.
	</p>
	<p>
		<strong>What the next roll buys</strong> adds one average 5★ substat roll of each kind and shows what
		it gains. DMG Bonus never appears there, since no substat carries it. For an additive reaction the
		gain is measured on the added damage alone, not the whole hit.
	</p>
</section>

<section>
	<h2 id="enemy-res-def">Enemy RES &amp; DEF</h2>
	<p>
		How much of a hit gets through the enemy’s resistance and defense. The upper chart is RES and
		the lower is DEF; point at either to read it, and drag to set the value — the enemy’s RES after
		shred on the first, its level on the second.
	</p>
	<p>
		Shred works at three strengths. Between 0% and 75% RES it counts in full; below 0% it still
		helps, at half strength; above 75% it helps less than in full. Equal levels already halve your
		damage through DEF, and DEF shred and DEF ignore win it back, multiplying together.
		Transformative, Lunar and Stellar reactions ignore DEF entirely.
	</p>
	<p>
		The shred list holds every character and artifact set that shreds the element you’ve chosen,
		with the constellation it needs and its amounts where they vary. Several shreds add up, but two
		routes to the same in-game debuff count once. An immune enemy takes nothing of that element,
		whatever the shred.
	</p>
</section>

<section>
	<h2 id="artifact-odds">Artifact Odds</h2>
	<p>
		A 5★ artifact’s odds over its life, in three views. Throughout, <strong>Your stats</strong> are the
		substats you’d count as good. With only CRIT Rate and CRIT DMG chosen, results are in crit value;
		otherwise in useful rolls, where a top roll counts 1 and the smallest 0.7.
	</p>
	<p>
		<strong>Drop</strong> answers how long a piece takes to farm: pick the slot, every main stat you’d
		accept and how many of your stats it needs, and the chart shows the chance you’d have it after each
		day of resin, from the domain alone and with a Stygian Onslaught Outbreak. A day is 180 resin, and
		a run averages a little over one 5★.
	</p>
	<p>
		<strong>Level up</strong> shows where a fresh piece would land at +20, as a histogram stacked by how
		many upgrades went into your stats. Drag the marker to set the value to beat. It covers pieces that
		drop with three substats or four, and pieces made with Sanctifying Elixir, which guarantees two of
		your chosen lines at least two upgrades.
	</p>
	<p>
		<strong>Your piece</strong> takes a real artifact, laid out like the game’s reshape screen. Each value
		wheel offers only values the game can produce, and a badge shows how many upgrades a line has taken;
		a red pip means the values fit two counts and lets you pick. A finished piece is ranked against every
		+20 piece with the same four lines. Select two lines to see what a Standard, Advanced or Decreed reshape
		would do: a reshape keeps each line’s starting roll, rerolls its upgrades, and you keep whichever
		result you prefer.
	</p>
	<p>
		The reshape guarantee is read as a top-up: upgrades land at random, and if the two lines would
		end below the guarantee, they end exactly at it. That is how both independent exact models read
		it — Genshin Optimizer’s and SiriYu’s solver — and nothing published settles it further.
	</p>
</section>

<section>
	<h2 id="wish-odds">Wish Odds</h2>
	<p>
		How many pulls a goal takes from where you are now. Pick what you’re pulling for — a featured
		5★, a featured 4★, the charted weapon, or a 5★ and their weapon together — then set what you
		have, what you’re aiming for (up to C6 or R5), your current pity and whether you hold a
		guarantee. The chart shows the chance of reaching each step by every pull count; drag across it,
		or use
		<strong>Pulls saved</strong>, to read your odds with what you have.
	</p>
	<p>
		You win a 50/50 about 55% of the time, Capturing Radiance included; its exact rules aren’t
		public, so every 50/50 is taken as a flat 55%. A featured 4★ comes about 22% of the time for
		each 4★ you pull, and never from a lost 50/50 on its own banner, even if they’re in the standard
		pool. On the weapon banner, a Fate Point charts the weapon you want; without one it’s 37.5% for
		each featured weapon and 25% for a standard one. For a character and weapon together the pulls
		add up, because each banner keeps its own pity.
	</p>
	<p>
		The pity curves are the game’s published rates with the community’s soft-pity measurements, and
		the model is tested against
		<a href="https://github.com/OneBST/GGanalysis" target="_blank" rel="noopener noreferrer"
			>GGanalysis</a
		>: averages agree to two decimal places and medians exactly. Only pulls on a banner featuring
		your goal count, so copies from Starglitter or events go into what you already have.
	</p>
</section>
