<!-- Help chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round), from a fact
	 sweep of the shipped tool. Glossary names: the composer, the bench / bench
	 card / slot, the timeline (never "chart"), a tab holding a rotation (never
	 "plan"), the aura lane = the gauge lines + the reaction spawns, the aura
	 log, the view bar / document bar. ⚓ A limit is the TOOL's ("The Rotation
	 Planner doesn't…"); "we" only for a choice that isn't a limit. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
</script>

<h1>Rotation Planner</h1>

<p class="flavor">
	A ledger of where every star will be, frame by frame. Its compiler held that the heavens keep
	perfect time and can be charted in intricate detail.
</p>

<p class="lede">
	Write a rotation in KQM notation and the Rotation Planner draws it as a timeline: who is on field,
	every cast and its cooldown, the buffs it grants, and what it does to the enemy’s aura, timed from
	measured frame data.
</p>

<section>
	<h2 id="notation">Writing a rotation</h2>
	<p>
		The composer under the timeline takes
		<a
			href="https://library.keqingmains.com/theorycrafting#combat-notation"
			target="_blank"
			rel="noopener noreferrer">KQM notation</a
		>. A rotation is segments separated by <code>&gt;</code>, each starting with a character’s name
		and followed by what they do:
	</p>
	<ul>
		<li>
			<code>N</code> to <code>N9</code> are normal attacks — <code>N3</code> is three swings, and
			<code>N2 N3</code> continues the same string. <code>C</code> is a charged attack,
			<code>P</code>
			a plunge (<code>lP</code> a low one), <code>D</code> a dash, and <code>J</code> a jump.
			<code>A</code> is a bow’s fully charged aimed shot.
		</li>
		<li>
			<code>E</code> and <code>Q</code> are skill and burst, with <code>hE</code> for a hold where the
			kit has one.
		</li>
		<li>
			Stances add special forms: <code>sE</code> a special skill, <code>sQ</code> a short burst,
			<code>sC</code> a special charged attack, and <code>F</code> the finisher of a spinning charged
			attack like Mavuika’s.
		</li>
		<li>
			<code>[N2 D]x3</code> repeats, <code>(E)</code> marks an optional action that isn’t drawn on
			the timeline, and <code>E/Q</code> draws the first of two alternatives.
		</li>
		<li>
			critcalc adds a time token of its own, written <code>~Xs</code>. <code>~1.5s</code> adds 1.5
			seconds of waiting on the active character’s row. It can also end an action early:
			<code>Mizuki E</code> draws her Dreamdrifter state for its full ten seconds, while
			<code>Mizuki E ~2s</code> ends it after two, so you can place her <code>Q</code> or a swap at that
			moment.
		</li>
	</ul>
	<p>
		Names are the game’s display names — Kazuha, Raiden, Tartaglia — and the composer suggests them
		as you type. Actions can be run together (<code>QEN2</code>), and pasted rotations are cleaned
		up for you: footnote marks dropped, line breaks joined.
	</p>
	<p>
		Undo and redo sit at the end of the composer, alongside Ctrl+Z and Ctrl+Shift+Z (⌘Z and ⌘⇧Z on a
		Mac). They work for edits made from the bench and the Team Builder too. Each tab keeps its own
		edit history until the page reloads.
	</p>
	<p>
		A skill or burst written before it’s ready waits for its cooldown, and everything after it waits
		too. Charges come back one at a time, as in the game.
	</p>
	<p>
		The composer underlines what it can’t draw exactly as written, in two colors. An
		<strong>orange</strong> underline means it couldn’t take the text: a name that matches no
		character, like <code class="flag-warning">Kazuah</code> (that segment is skipped), an aimed
		shot on a character without a bow, or a token it doesn’t know. A <strong>yellow</strong> one
		means it took the text and drew a stand-in: a hold version the kit doesn’t have, like
		<code class="flag-approx">hE</code>, timed as a tap instead; a plunge with no measured frames; a
		fifth character, who has no slot. Hover the token for the reason.
	</p>
	<p>
		<strong>Walk-cancels aren’t simulated.</strong> <code>W</code> is recognized and skipped, so
		<code>N1 W N2</code> times exactly like <code>N1 N2</code>. A walk-cancel is worth doing because
		it ends an animation early while keeping the attack string going, and the frame data for that is
		exactly the hard part; drawing it approximately would be worse than not drawing it. gcsim, where
		the frame data comes from, doesn’t simulate it either. Use <code>~0.5s</code> or similar when you
		want time to pass.
	</p>
</section>

<section>
	<h2 id="team">The team</h2>
	<p>
		The team is whoever the notation names: the first four characters, in the order they first
		appear. To add someone, type their name, even with no actions after it; to remove someone,
		delete their segments.
	</p>
	<p>
		Each slot on the bench beside the timeline has a bench card. On a wide screen, clicking the
		portrait opens the Team Builder’s swap mode for that slot, and picking someone there renames
		them throughout the notation; an empty slot adds someone instead. The magnifier in the corner
		opens the character’s details.
	</p>
	<p>
		The chip on the portrait sets the character’s constellation for this tab, and the pill beside it
		sets their weapon and artifact set. Neither touches your roster: a tab keeps its own levels and
		loadouts, so one rotation can be written at C6 while your roster says C0. When the tab asks for
		more than you own, the chip is drawn hollow.
	</p>
	<p>
		A character without curated frame data carries a mark beside their name, and their actions are
		drawn with generic timing. The
		<a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a> shows what is covered
		for each character.
	</p>
</section>

<section>
	<h2 id="timeline">Reading the timeline</h2>
	<p>
		Each character gets a group of rows: their skill, then any summons and shields, then their
		burst, then the active row, which shows when they’re on field and what they’re doing. Received
		buffs and weapon procs follow underneath, and connectors mark each swap.
	</p>
	<p>
		A skill or burst bar is followed by a faded tail labeled with the cooldown, ending where the
		ability can be used again. A stance that lasts longer than its own cooldown is drawn dimmer past
		the point where the cooldown ran out.
	</p>
	<p>
		Below the characters are the team-wide lanes — team buffs, Nightsoul bursts and Moonsign’s
		Ascendant Gleam when the team has them — and above the composer a strip lists the always-on
		bonuses: resonances, faction bonuses and permanent passives.
	</p>
	<p>
		Energy isn’t modeled: a burst is ready whenever its cooldown is. Characters without curated
		frames fall back to a 12s skill and a 15s burst cooldown alongside the generic timings.
	</p>
	<p>
		<strong>Zoom</strong> in the view bar opens a slider and <strong>Reset</strong>; the mouse wheel
		over the ruler scrolls sideways. <strong>Total</strong> is the rotation’s length.
	</p>
	<p>
		<strong>Buffs</strong> and <strong>Auras</strong> in the view bar are layers. Buffs hides every bar
		that says what a cast grants — buff rows, weapon procs, the team lanes and the always-on strip — and
		Auras hides the aura lane. Skills, bursts, summons and shields stay, since they say when an ability
		is happening. With both off, the timeline is ability timings and nothing else. Your choice is remembered;
		on a small screen both start off.
	</p>
</section>

<section>
	<h2 id="human-timing">Timing like a person</h2>
	<p>
		<strong>Human timing</strong> is on by default. It adds a few frames of reaction time before each
		input the game doesn’t buffer for you: after a skill, burst, plunge, dash or jump, from a normal attack
		into anything but another normal or a charged attack, and on the first input after a swap. Normal
		into normal and normal into charged are free, because the game queues those. A bow’s charged shot
		always pays.
	</p>
	<p>
		Settings decides what it changes. <strong>Padding</strong> (the default) adds the reaction time,
		10 frames to start with, the KQM starting point; <strong>Animations</strong> lets each action
		play out in full instead of canceling; <strong>Both</strong> does both. The padding shows as
		hatched slivers on the active row, which <strong>Show padding</strong> turns off. Turn Human timing
		off in the view bar for the frame-perfect rotation.
	</p>
	<p>
		Swaps take time either way: your ping plus about 90 ms, set under <strong>Swap ping</strong> in
		Settings. Writing the same character on both sides of a <code>&gt;</code> costs nothing, because they
		never left the field.
	</p>
	<p>
		A swap ends a stance only where the game does: Hu Tao’s Paramita ends when she leaves, while
		Ifa’s flight and Mavuika’s Nightsoul Blessing carry on. A few stances hold the field — Mizuki’s
		Dreamdrifter keeps her on field until it ends, unless the segment ends with a wait or a second
		press of her skill.
	</p>
	<p>
		Because Human timing is your preference, it isn’t stored in a share link. Someone opening your
		rotation sees it at their own setting.
	</p>
</section>

<section>
	<h2 id="playback">Playing it back</h2>
	<p>
		<strong>Play</strong> (or Space) runs a cursor along the timeline at game speed, and the plate
		beside it slows it to 0.75× or 0.5×. With sound on, each start counts in four beats and every
		action plays a note; Settings has the sounds and the volume. <strong>Back to the start</strong>
		(Home) rewinds.
	</p>
	<p>
		<strong>Laps</strong> simulates the rotation five times over, as one run. A skill still on cooldown
		waits and pushes the rest back, and buffs, stacks and auras carry from one lap into the next, so a
		rotation that doesn’t loop cleanly shows it. Gold marks on the ruler show where each lap begins. Laps
		isn’t saved, shared or exported.
	</p>
</section>

<section>
	<h2 id="aura">The enemy’s aura</h2>
	<p>
		The aura lane above the ruler is the enemy. The gauge lines draw each element stuck to them, and
		a line’s height is how much gauge is left, so you can see an aura land, decay, get topped up and
		get eaten by a reaction. The gaps are where the next trigger has nothing to react with. Hover
		anywhere on it to read every aura at that instant.
	</p>
	<p>
		Above the lines, a pill in the element’s color marks each hit that applied an element, and a
		labeled marker above that names each reaction it caused; a run of a ticking reaction such as
		Electro-Charged is one marker with a count. Frozen, Quicken, Burning and Burning’s Dendro fuel
		are separate objects from the auras that made them, with their own decay, so they get their own
		lines. A yellow ring on a pill means the hit has no measured gauge strength, and 1U is assumed.
	</p>
	<p>
		<strong>The reaction spawns</strong>, below the baseline, are what some reactions leave behind:
		a Dendro Core from Bloom, a Starlight Prism from Stellar-Conduct, a Thundercloud from
		Lunar-Charged, Moondrifts from Lunar-Crystallize. A dot marks each one appearing, and a stepped
		shape shows how many there are, so a step down is one expiring or being spent. A Dendro Core
		arrives half a second after its Bloom, lasts 6s, and Hyperbloom or Burgeon takes the oldest;
		there can be five. A Starlight Prism lasts 7s and a further Stellar-Conduct refreshes it. There
		is only ever one Thundercloud, lasting 5.5s, and another Lunar-Charged restarts its clock.
		Lunar-Crystallize keeps three Moondrifts topped up, 9s each, drawn as one row. What these deal
		isn’t modeled; when they exist is.
	</p>
	<p>
		<strong>The Polestar Field.</strong> A Starlight Prism holds a Polestar Field around it, and the field’s
		buffs sit in the team buffs, because any party member’s Stellar-Conduct raises the same field. Its
		Cryo and Electro bonus moves: the field counts the Cryo and Electro hits that applied an element,
		resets every 4s, and pays out on the count — 20% with none, 29% at one, up to 40% at twelve. The Rotation
		Planner assumes you stand in the field throughout.
	</p>
	<p>
		<strong>Log</strong> in the view bar opens the aura log beside the timeline: every application and
		reaction in words, in order. Hovering a row marks that moment on the timeline, clicking one scrolls
		there, and clicking a pill or marker on the timeline opens the log at its row. The log works with
		the Auras layer off.
	</p>
	<p>
		The model behind it is the Gauge Explorer’s: the ×0.8 aura tax, decay rates, how much each
		reaction consumes, the Crystallize cooldown. It assumes one enemy that applies nothing back to
		you — no Pyro from a Blazing Axe Mitachurl — and hits landing on their listed timing. Shatter
		isn’t modeled. The aura log repeats these limits at its head.
	</p>
</section>

<section>
	<h2 id="notes">Notes and coverage</h2>
	<p>
		<strong>Notes</strong> opens the notes panel: the caveats on each character’s kit, where the timeline
		knowingly differs from the game, with constellation notes shown from the level the tab uses. Each
		character ends with a link to their coverage. The button is disabled when the team’s kits have nothing
		to note, and the notes panel and the aura log share one place, so opening one closes the other.
	</p>
	<p>
		<strong>Coverage strips</strong>, in Settings, draws each character’s coverage under the
		composer and dims the parts of the kit this rotation doesn’t use.
	</p>
</section>

<section>
	<h2 id="tabs">Tabs, saving and sharing</h2>
	<p>
		Each tab holds one rotation with its own team, constellations and loadouts. Up to twelve stay
		open; double-click one to rename it, drag to reorder. A closed tab with anything in it goes to
		<strong>Recently closed</strong> in the Library, and so does anything deleted from it.
	</p>
	<p>
		<strong>Save</strong> puts the rotation in the Library and links the tab to it, after which the
		button reads <strong>Save changes</strong>; <strong>Save as new</strong> in the
		<strong>⋯</strong> menu forks a copy. A saved rotation keeps the constellations it was saved
		with. Once you’ve marked characters as owned, <strong>Sync</strong> in the Library makes a rotation
		follow your roster instead, until you set a level on its bench.
	</p>
	<p>
		The Library groups saved rotations by team. Its search turns a character, element or reaction
		into a tag, and tags combine. Its <strong>Roster</strong> tab is where you mark who you own, which
		the Team Builder shares.
	</p>
	<p>
		<strong>Share</strong> copies a link, the KQM notation, or an image of the timeline. The link opens
		the rotation with its constellations and loadouts in a new tab for whoever follows it, without touching
		their roster. The KQM copy drops what only the Rotation Planner reads — waits, optional marks, stack
		counts — and keeps the rest as you wrote it. The image is the whole timeline, not only the part on
		screen, with the notation written above it.
	</p>
</section>

<section>
	<h2 id="phone">On a phone</h2>
	<p>
		On a phone the composer docks to the bottom of the screen. Collapsed it shows the last line of
		the rotation; tap it to open it with the keyboard, and tap anywhere else to close it. A row of
		keys above the keyboard offers what fits where the cursor is — the team’s names at the start of
		a segment, that character’s actions inside one.
	</p>
	<p>
		The bench becomes a row above the timeline, which <strong>Bench</strong> hides. A portrait there
		opens the character’s details; swapping needs a wider screen. The layers start off and the zoom
		starts wider, and the view bar folds its less-used controls into <strong>⋯</strong>.
	</p>
</section>
