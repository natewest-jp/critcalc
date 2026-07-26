<!-- Help chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents. -->
<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<h1>Team Builder</h1>

<p class="lede">
	Find characters by what they can actually provide — healing, shields, off-field damage, RES shred,
	ally buffs — with every capability derived from curated kit data and traced back to the ability,
	and the constellation, that grants it.
</p>

<section>
	<h2 id="finding">Finding characters</h2>
	<p>
		The middle panel has two tabs. Browse by capability in the <strong>Atlas</strong>, or by
		identity — element, weapon, region — in the <strong>Roster</strong>.
	</p>
	<ul>
		<li>
			Capability filters combine. "Heals + ATK buff" means characters that provide <em>both</em>,
			not either.
		</li>
		<li>
			Conditional badges are shown in italics: the capability depends on runtime state. Open a
			character's details for the exact condition.
		</li>
		<li>
			Characters whose kits aren't curated yet are listed separately when you filter, never silently
			hidden — a missing badge means "unknown," not "no."
		</li>
	</ul>
</section>

<section>
	<h2 id="constellations">Constellations change the answer</h2>
	<p>
		Many capabilities are gated behind a constellation, so "who can do this" depends on whose
		constellations you mean. The switch offers three readings:
	</p>
	<ul>
		<li><strong>C0</strong> — base kits only, the floor every player shares.</li>
		<li><strong>My roster</strong> — the constellation levels you've saved, i.e. your account.</li>
		<li>
			<strong>C6</strong> — everything a kit can ever do, useful for judging a long-term goal.
		</li>
	</ul>
	<p>
		Your roster is shared across the site: set it once and the Rotation Planner reads the same
		levels. It is stored only in your browser.
	</p>
</section>

<section>
	<h2 id="compare">Comparing and assembling</h2>
	<p>
		Add characters to <strong>Compare</strong> to line them up row by row on one ruler — cooldowns on
		one line, burst costs on the next, then the capabilities themselves. The small three-phase bars show
		each effect's window against its cooldown, all on a shared time scale, so you can see at a glance
		who covers the gap.
	</p>
	<p>
		Fill the team slots and the panel reports what the composition <em>is</em> — elemental
		resonance, Natlan count, Moonsign — plus a coverage checklist. Facts, never a score. From there,
		send the team to the <a href={resolve('/rotation-planner')}>Rotation Planner</a> to actually run it.
	</p>
</section>
