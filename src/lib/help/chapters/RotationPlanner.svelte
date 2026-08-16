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
		jump, and <code>&gt;</code> to separate swaps. Hold variants and short-burst forms are
		recognized where a kit has them, and <code>~2s</code> waits where you want a deliberate pause.
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
</section>

<section>
	<h2 id="aura">The target's aura</h2>
	<p>
		The bottom lane is the enemy. One row per element currently stuck to them, and the height of
		each bar is how much gauge is left — so you can see an aura land, decay, get topped up, and get
		eaten by a reaction. The gaps are the point: they are where the next trigger has nothing to
		react with.
	</p>
	<p>
		Above the rows, a fine tick marks every hit that applied an element, and a labelled dot marks
		every reaction it caused. Compound states get their own rows too — Frozen, Quicken, Burning and
		the dendro fuel that feeds it are different objects from the auras that made them, with
		different decay, so they are drawn separately.
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
