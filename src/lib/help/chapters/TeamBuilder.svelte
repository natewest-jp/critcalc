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
		Press <strong>Compare</strong> on a character card and it loads into the
		<strong>Compare</strong> tab — its portrait appears right in the tab, and you keep browsing. Open
		the tab when you're ready: the three-phase bars line every pick up on one shared time ruler (each
		effect's window against its cooldown), and below them a side-by-side table aligns the facts — cooldowns
		on one row, burst costs on the next, then the capabilities with their constellation gates.
	</p>
	<p>
		Fill the team slots and the panel reports what the composition <em>is</em> — elemental
		resonance, Natlan count, Moonsign — plus a coverage checklist. Facts, never a score. The bench
		is the same team the <a href={resolve('/rotation-planner')}>Rotation Planner</a> runs — switch tools
		and it glides across with you, slots and all, ready to rotate.
	</p>
</section>
