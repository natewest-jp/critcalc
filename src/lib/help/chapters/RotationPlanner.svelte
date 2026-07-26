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
		is two hits), <code>C</code> charged, <code>D</code> dash, <code>J</code> jump, and
		<code>&gt;</code> to separate swaps. Hold variants and short-burst forms are recognised where a kit
		has them.
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
	<h2 id="team">Team, weapons and constellations</h2>
	<p>
		Click a team portrait to change who fills that slot. Each portrait carries chips for that
		character's weapon, artifact set, and constellation — set them there and the timeline accounts
		for what they change.
	</p>
	<p>
		Constellations set here apply to the planner tab you're in; your saved roster stays untouched
		unless you change it in the Team Builder.
	</p>
</section>

<section>
	<h2 id="notes">Notes and caveats</h2>
	<p>
		Open <strong>Notes</strong> (top right of the frame) for the caveats behind the buffs and mechanics
		your rotation relies on — the conditions a buff assumes, what a summon's ticks are modelled from,
		and anything the tool deliberately does not simulate.
	</p>
	<p>
		Copy your rotation as KQM text, or export the timeline as a PNG, from the buttons beside the
		composer.
	</p>
</section>
