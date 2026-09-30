<!-- Help chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents. -->

<h1>Rotation Planner</h1>

<p class="lede">
	Write your rotation in KQM-style notation and the timeline renders its choreography — ability
	uptimes, cooldowns, swap connectors, and team buff windows, frame-accurate. It visualizes timing
	and windows; it never computes damage numbers.
</p>

<section>
	<h2 id="notation">Writing the notation</h2>
	<p>
		Type into the composer along the bottom edge — the timeline above redraws as you write, and
		autocomplete suggests each character's action tokens as you go.
	</p>
	<p>
		The notation follows the
		<a href="https://compendium.keqingmains.com/" target="_blank" rel="noopener noreferrer"
			>KQM standard</a
		>: <code>E</code> and <code>Q</code> for skill and burst, <code>N</code> for normal attacks (<code
			>N2</code
		>
		is two hits), <code>C</code> charged, <code>A</code> a bow's aimed shot, <code>D</code> dash,
		<code>J</code>
		jump, and <code>&gt;</code> to separate swaps. Hold variants are recognized where a kit has
		them, as are the <strong>special forms</strong> a stance substitutes —
		<code>sQ</code>
		for a short burst, <code>sE</code> for a special skill and <code>sC</code> for a special charged
		attack. <code>~2s</code> waits where you want a deliberate pause.
	</p>
	<p>
		The composer underlines anything the timeline can't draw exactly as written, and there are two
		kinds. An <strong>amber</strong> underline means the text can't be taken: a name that matches no
		character (the whole segment is skipped), or a token we don't simulate. A
		<strong>yellow</strong> one means we took it and what you see stands in for it — an action the character
		doesn't have, or a fifth character, who parses but has no slot to be drawn in. Hover any underlined
		token for the reason.
	</p>
	<p>
		<strong>Walk-cancels aren't simulated.</strong> KQM's <code>W</code> is recognized and then
		ignored — it changes nothing about the timing. That is deliberate rather than pending: a
		walk-cancel's whole value is ending an animation early while keeping the attack string, which is
		the timing every frame-perfect trick is built on, and modelling it badly would be worse than not
		modelling it. gcsim, our frame-data source, doesn't simulate it either. Use <code>~2s</code> when
		you want time to pass.
	</p>
</section>

<section>
	<h2 id="timeline">Reading the timeline</h2>
	<ul>
		<li>
			Each character gets rows for their skill and burst, plus an active row showing when they are
			on field. Connectors mark the swaps between them.
		</li>
		<li>
			Buff rows show who is buffing whom, and for how long — including windows that a later action
			refreshes or cuts short.
		</li>
		<li>
			Cooldowns render as a distinct edge treatment rather than a separate bar, so an ability's
			window and its wait read as one object.
		</li>
		<li>Zoom and scroll the ruler to work at the scale the rotation actually needs.</li>
	</ul>
	<p>
		Where a kit's frame data hasn't been curated yet, the planner says so and falls back to generic
		cast timings rather than inventing numbers.
	</p>
	<p>
		<strong>Human timing.</strong> By default the chart is frame-perfect: every cancel lands on the
		first frame the game allows, the way a macro plays. That is what the game permits, but it is not
		how most rotations go, and a buff that runs out on the chart before it does in your hands is the
		usual symptom. <em>Human timing</em> in the view bar times the rotation the way a person does. It
		adds a few frames before every input the game does not buffer — a skill after a normal attack, an
		aimed shot, the first press after a swap — and can let each animation finish instead of cancelling
		it. A normal-attack string costs nothing extra, because the game queues the next swing for you. The
		padding draws as a faint hatch on the active row so you can see where the time went; how many frames,
		and which of the two adjustments apply, are set in Settings, where KQM's starting point of ten frames
		is the default. It is your preference, not part of the rotation: a link you share opens frame-perfect
		for whoever follows it.
	</p>
	<p>
		<strong>Play and Repeat.</strong> <em>Play</em> in the view bar runs a cursor along the timeline
		at game speed, with four beats to count you in (the last one higher) and a note at every press.
		Every start counts in, a resume after a pause included, and the button before Play takes you
		back to the start — or, while playing, goes again from the top. Each note rings for as long as
		its input holds the field, so a burst is a long note and a normal attack a short one; a swap is
		a soft hum, the one sound that is not struck. The voice, which note each input gets, and the
		volume are set in Settings. The notes keep time with the tab hidden, so you can play the
		rotation with the game in front of you and the chart behind it.
		<em>Repeat</em> draws the laps that follow: the notation is run again from its last action, joined
		by a swap back to your opener, and the laps are simulated rather than copied. A skill still on cooldown
		waits where it really waits, and everything after it moves; a buff or an aura from one lap is still
		there in the next if it really is. Energy is not modeled, so a burst is drawn as ready whenever its
		cooldown is — the most common reason a real rotation does not come round cleanly is the one thing
		the chart cannot show you.
	</p>
</section>

<section>
	<h2 id="aura">The target's aura</h2>
	<p>
		The lane above the time axis is the enemy. It is one plot with a line per element currently
		stuck to them, and the height of each line is how much gauge is left — so you can see an aura
		land, decay, get topped up, and get eaten by a reaction. The gaps are the point: they are where
		the next trigger has nothing to react with. Hover anywhere on it to read every aura at that
		instant.
	</p>
	<p>
		Above the plot, a fine tick marks every hit that applied an element, and a labelled dot marks
		every reaction it caused. Compound states get their own lines — Frozen, Quicken, Burning and the
		dendro fuel that feeds it are different objects from the auras that made them, with different
		decay, so they are drawn separately.
	</p>
	<p>
		<strong>Under the plot: what the reaction left behind.</strong> Some reactions leave a thing standing
		in the world rather than an aura on the enemy, and those get their own strip below the baseline: a
		Dendro Core from a Bloom, a Starlight Prism from a Stellar-Conduct, a Thundercloud from a Lunar-Charged,
		Moondrifts from a Lunar-Crystallize. Each row is a dot where something appeared over a shape showing
		how many are standing — so a step down is one expiring, or one being spent. Hover the shape to read
		the count, or a dot to read what appeared there. The strip only appears when your rotation makes one
		of these.
	</p>
	<p>
		<strong>What each one does.</strong> A Dendro Core arrives half a second after its Bloom and lasts
		6s, and a Hyperbloom or Burgeon consumes the oldest one standing — you can watch the count drop as
		you spend them. A Starlight Prism lasts 7s and any further Stellar-Conduct refreshes it. A Thundercloud
		lasts 5.5s, and there is only ever one: another Lunar-Charged restarts its clock rather than adding
		a second. A Lunar-Crystallize tops the field up to three Moondrifts at once, each lasting 9s, and
		keeps refreshing them while you keep reacting. We draw these because they are things you can see and
		time; what they hit for is not modelled.
	</p>
	<p>
		<strong>The Polestar Field.</strong> A Starlight Prism sustains a Polestar Field around it, and the
		field's buffs are their own row in the team buffs — not one enabler's, because any party member's
		Stellar-Conduct raises the same field. Its Cryo and Electro bonus is not a flat number: the field
		records the Cryo and Electro hits that applied an element, resets the count every 4s, and pays out
		on what it counted — 20% with nothing recorded, then 29% at one hit up to 40% at twelve. That is why
		the row's value changes from one 4s block to the next. We assume you are standing in the field; we
		do not model walking out of it.
	</p>
	<p>
		<strong>Turning it off.</strong> <em>Auras</em> in the view bar hides the lane and the strip
		under it. Its neighbour, <em>Buffs</em>, hides the buff bars, weapon procs, Nightsoul bursts and
		Ascendant Gleam — turn both off for a chart of ability timings and nothing else. Summons and
		shields stay either way: they are things standing in the world, not effects granted to your
		team.
	</p>
	<p>
		<strong>What it assumes.</strong> One enemy, standing still, applying nothing back at you — no Pyro
		from a Blazing Axe Mage, and no auras you did not put there. Hits land on their listed timing, a swing
		that connects several times counts as one application, and Shatter is not modelled. Where we do not
		have a measured gauge strength for a hit we use 1U and mark that tick yellow. Everything else — the
		×0.8 aura tax, decay rates, unit multipliers, the crystallize cooldown, dendro cores and their spawn
		delay — follows the same model the Gauge Explorer teaches.
	</p>
</section>

<section>
	<h2 id="team">Team, weapons and constellations</h2>
	<p>
		<strong>The notation is the team.</strong> Whoever your rotation names, in the order it names them,
		fills the bench — so typing a character adds them, and you can add somebody with nothing to do yet
		by writing just their name. The bench's ⇄ hands that slot to the Team Builder to compare replacements
		against, and ✕ removes the character by deleting their part of the notation. Undo (beside the composer,
		or ⌘Z) takes any of it back.
	</p>
	<p>
		Click a team portrait to read that character's details. Each portrait also carries chips for
		their weapon, artifact set, and constellation — set them there and the timeline accounts for
		what they change.
	</p>
	<p>
		Constellations and loadouts set on the bench apply to the plan (the tab you're in); your saved
		roster stays untouched unless you change it in the Team Builder's roster or a character's
		details. The bench is one and the same team in both tools — each planner tab is its own team,
		and the active tab is the one the Team Builder edits.
	</p>
</section>

<section>
	<h2 id="notes">Notes and caveats</h2>
	<p>
		Open <strong>Notes</strong> (in the view controls above the timeline) for the caveats behind the buffs
		and mechanics your rotation relies on — the conditions a buff assumes, what a summon's ticks are modelled
		from, and anything the tool deliberately does not simulate.
	</p>
	<p>
		Copy your rotation as KQM text, or export the timeline as a PNG, from <strong>Share</strong> in the
		document bar at the top.
	</p>
</section>
