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
	import { FEEDBACK_FORM_URL } from '$lib/feedback';
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
		<strong>Walk-cancels.</strong> <code>W</code> ends the attack string the way walking does in
		game: <code>N1 W N1</code> is two first hits. For most attacks a walk can start only once the animation
		has ended, though some characters can walk out a little sooner. Regardless, walk cancels give you
		a reset of the attack string without the stamina a dash would cost.
	</p>
</section>

<section>
	<h2 id="team">The team</h2>
	<p>
		The bench holds four slots. Typing a character’s name puts them in the first empty slot, even
		with no actions after it, and deleting all of their notation frees the slot again. A team opened
		from the Library, a lineup, or a team link is placed in its slots and stays there while you
		write. When a placed character isn’t written into the notation yet, they’re shown resting
		(dimmed). When no slot is empty, any other name you type takes the first resting character’s
		slot.
	</p>
	<p>
		Each slot on the bench beside the timeline has a bench card. Clicking the portrait opens the
		character’s details. On a wide screen, the two buttons at the card’s left change the slot: The
		top one opens the Team Builder’s swap mode for that slot, and picking someone there takes you
		back to the Planner with the notation renamed throughout. The bottom one removes the character
		from the team and deletes their notation. Clicking an empty slot’s portrait adds someone
		instead. On a phone, the remove button is in the character’s details.
	</p>
	<p>
		The chip on the portrait sets the character’s constellation for this tab, and the pill beside it
		sets their weapon and artifact set. Neither touches your roster: A tab keeps its own levels and
		loadouts, so one rotation can be written at C6 while your roster says C0. When the tab uses a
		constellation you don’t own the chip is drawn hollow.
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
		Below the characters are the team-wide lanes — team buffs, Nightsoul bursts, and Moonsign’s
		Ascendant Gleam bonuses when the team has them — and above the composer a strip lists the
		always-on bonuses: resonances, faction bonuses, and permanent passives.
	</p>
	<p>Energy isn’t modeled: A burst is ready whenever its cooldown is.</p>
	<p>
		<strong>Zoom</strong> in the view bar opens a slider and <strong>Reset</strong>; the mouse wheel
		over the ruler scrolls sideways. <strong>Total</strong> is the rotation’s length.
	</p>
	<p>
		<strong>Buffs</strong> and <strong>Auras</strong> in the view bar are layers. Buffs hides every bar
		that says what a cast grants — buff rows, weapon procs, the team lanes, and the always-on strip —
		and Auras hides the aura lane. Skills, bursts, summons, and shields stay, since they say when an ability
		is happening. With both off, the timeline is ability timings and nothing else. If you change either
		one, your choice is remembered. On a small screen both are off to begin with.
	</p>
</section>

<section>
	<h2 id="human-timing">Timing like a person</h2>
	<p>
		<strong>Human timing</strong> is on by default. It adds some frames of reaction time before each input
		the game doesn’t buffer for you: after a skill, burst, plunge, dash, or jump, from a normal attack
		into anything but another normal or a charged attack, and on the first input after a swap. Normal
		into normal and normal into charged are exempt, because the game allows queuing of those inputs. A
		bow’s charged shot is the exception: It always takes the reaction time.
	</p>
	<p>
		Settings decides what it changes. <strong>Padding</strong> (the default) is the reaction time.
		This is 10 frames to start with (the KQM starting point), and you can adjust it there.
		<strong>Animations</strong> lets each action play out in full instead of canceling.
		<strong>Both</strong>
		enables both. The padding shows as hatched slivers on the active row, which
		<strong>Show padding</strong>
		hides. Turn Human timing off in the view bar to see the frame-perfect rotation.
	</p>
	<p>
		Swaps take time either way: your ping plus about 90 ms, set under <strong>Swap ping</strong> in
		Settings. If you write the same character on both sides of a <code>&gt;</code> it costs no swap time,
		since the character never left the field. Laps relies on this when a rotation ends with the character
		it starts with.
	</p>
	<p>
		A swap ends a stance only where the game does: Hu Tao’s Paramita ends when she leaves, while
		Mavuika’s Nightsoul Blessing or Noelle’s Sweeping Time carries on. A few stances hold the field
		— Mizuki’s Dreamdrifter keeps her on field until it ends, unless the segment is cut short with a
		time token or a second press of her skill.
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
		beside it slows it to 0.75× or 0.5×. With sound on, you’ll hear four beats to count you in, then
		a note for every input. Settings has the sounds and the volume.
		<strong>Back to the start</strong> (Home) rewinds.
	</p>
	<p>
		Bluetooth headphones and speakers delay sound by a tenth of a second or more, so the cursor
		waits for your device’s delay and stays in step with what you hear.
	</p>
	<p>
		<strong>Laps</strong> simulates the rotation five times in a row, as one run. A skill still on cooldown
		waits and pushes the rest back, and buffs, stacks, and auras carry from one lap into the next, so
		a rotation that doesn’t loop cleanly shows it. Gold marks on the ruler show where each lap begins.
		Laps isn’t saved, shared, or exported.
	</p>
</section>

<section>
	<h2 id="aura">The enemy’s aura</h2>
	<p>
		The aura lane above the ruler represents the elemental aura on the enemy. The gauge lines draw
		each element attached to them, and a line’s height is how much gauge is left, so you can see an
		aura land, decay, get topped up, and get eaten by a reaction. The gaps are where the next
		trigger has nothing to react with. Hover anywhere on it to read all the auras present at that
		moment.
	</p>
	<p>
		Above the lines, a pill in the element’s color marks each hit that applied an element, and a
		labeled marker above that names each reaction it caused. A run of a ticking reaction such as
		Electro-Charged is one marker with a count. Frozen, Quicken, Burning, and Burning’s Dendro fuel
		are separate objects from the auras that made them, with their own decay, so they get their own
		lines. A yellow ring on a pill means the hit has no measured gauge strength, and 1U is assumed.
	</p>
	<p>
		<strong>The reaction spawns</strong>, below the baseline, are what some reactions leave behind:
		a Dendro Core from Bloom, a Starlight Prism from Stellar-Conduct, a Thundercloud from
		Lunar-Charged, and Moondrifts from Lunar-Crystallize. A dot marks each one appearing, and a
		stepped shape shows how many there are, so a step down is one expiring or being spent. A Dendro
		Core arrives half a second after its Bloom, lasts 6s, and there can be five on the field at
		once. Hyperbloom or Burgeon takes the oldest Dendro Core. A Starlight Prism lasts 7s and a
		further Stellar-Conduct refreshes it. There is only ever one Thundercloud, lasting 5.5s, and
		another Lunar-Charged restarts its clock. Lunar-Crystallize keeps three Moondrifts topped up, 9s
		each, drawn as one row. The damage these deal isn’t modeled; their presence is, along with any
		character effect that depends on it.
	</p>
	<p>
		<strong>The Polestar Field.</strong> A Starlight Prism holds a Polestar Field around it, and the field’s
		buffs sit in the team buffs, because any party member’s Stellar-Conduct raises the same field. Its
		Cryo and Electro bonus moves: The field counts the Cryo and Electro hits that applied an element,
		resets every 4s, and boosts based on that count — 20% with none, 29% at one, up to 40% at twelve.
	</p>
	<p>
		<strong>Log</strong> in the view bar opens the aura log beside the timeline. Hovering a row highlights
		that moment on the aura lane, clicking one scrolls there, and clicking a pill or marker on the aura
		lane opens the log at its row. The log also works with the Auras layer off.
	</p>
	<p>
		The model behind it is the Gauge Explorer’s: the ×0.8 aura tax, decay rates, how much each
		reaction consumes, and the Crystallize cooldown. It assumes one enemy without a permanent aura
		that applies nothing back to you, and Shatter isn’t modeled. (If you would like to see permanent
		auras as a feature, please send a request through the
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the external form -->
		<a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">feedback form</a>.)
	</p>
</section>

<section>
	<h2 id="notes">Notes and coverage</h2>
	<p>
		<strong>Notes</strong> opens the notes panel: the caveats on each character’s kit, where the timeline
		knowingly differs from the game, with constellation notes shown from the level the tab uses. Each
		character ends with a link to their coverage. The button is disabled when the team’s kits have nothing
		to note.
	</p>
	<p>
		Turn on <strong>Coverage strips</strong> in Settings to draw each character’s coverage under the composer
		and dim the parts of the kit this rotation doesn’t use.
	</p>
</section>

<section>
	<h2 id="tabs">Tabs, saving, and sharing</h2>
	<p>
		Each tab holds one rotation with its own team, constellations, and loadouts. You can keep up to
		twelve tabs open. Double-click a tab to rename it, and drag to reorder them. A closed tab with
		anything in it goes to <strong>Recently closed</strong> in the Library.
	</p>
	<p>
		<strong>Save</strong> puts the rotation in the Library and links the tab to it, after which the
		button reads <strong>Save changes</strong>. <strong>Save as new</strong> in the
		<strong>⋯</strong> menu forks a copy of the rotation. A saved rotation keeps the constellations
		it was saved with. Once you’ve marked characters as owned, <strong>Sync</strong> in the Library makes
		a rotation follow your roster instead. Setting a constellation on a bench card ends the sync, and
		the rotation keeps its own levels again.
	</p>
	<p>
		The Library groups saved rotations by team. Its search turns a character, element, or reaction
		into a tag, and tags combine. Its <strong>Roster</strong> tab is where you mark who you own, which
		the Team Builder shares.
	</p>
	<p>
		<strong>Share</strong> copies a link, the KQM notation, or an image of the timeline. The link opens
		the rotation with its constellations and loadouts in a new tab without touching the reader’s roster.
		The KQM copy removes inputs that are specific to critcalc — time tokens, optional marks, and stack
		counts — and keeps the rest as you wrote it. The image is the whole timeline, not only the part on
		screen, with the notation written above it.
	</p>
</section>

<section>
	<h2 id="phone">On a phone</h2>
	<p>
		On a phone the composer docks to the bottom of the screen. Collapsed it shows the last line of
		the rotation. Tap it to open it with the keyboard, and tap anywhere else to close it. A row of
		keys above the keyboard offers the inputs that fit where the cursor is.
	</p>
	<p>
		The bench becomes a row above the timeline, which the <strong>Bench</strong> button in the view bar
		hides. Tapping a portrait on a phone opens the character’s details. The Buffs and Auras layers are
		turned off by default and the zoom starts wider than on desktop.
	</p>
</section>
