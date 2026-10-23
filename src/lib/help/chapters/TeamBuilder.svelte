<!-- Help chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch against the LINEUPS tool (design doc
	 docs/team-builder-lineups-design.md §11 wins; swap mode is §11.6 item 20).
	 Glossary names: Lineup (never "board"), Characters (the grid), Roster (the
	 Library tab ONLY), "the team's capabilities" (never "fingerprint"). ⚠ The
	 Abyss banner + Opponents need a CURRENT cycle in season-dates.json, so the
	 copy says "when a cycle is listed". -->
<script lang="ts">
	import { nextLayout } from '$lib/nextLayout';
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
</script>

<h1>Team Builder</h1>

<p class="flavor">
	A brass disc of nested rings, each engraved with names. Turning four into alignment can answer
	many questions, or raise new ones.
</p>

<p class="lede">
	A party setup screen. Build a lineup of teams for Stygian Onslaught, the Spiral Abyss, or anything
	else, and each team shows what it can provide at the constellations it uses.
</p>

<section>
	<h2 id="lineups">Lineups</h2>
	{#if $nextLayout}
		<p>
			<strong>New lineup</strong>, in the Library under <strong>Lineups</strong>, starts a lineup in
			one of three shapes:
		</p>
	{:else}
		<p>
			<strong>+</strong> in the document bar starts a new lineup in one of three shapes:
		</p>
	{/if}
	<ul>
		<li>
			<strong>Stygian Onslaught</strong>: three teams, one per battlefield, each with its boss and
			the season’s checks.
		</li>
		<li>
			<strong>Spiral Abyss</strong>: two teams for Floor 12’s first and second half. While a current
			cycle is live, each half shows its blessing and <strong>Opponents</strong> list.
		</li>
		{#if $nextLayout}
			<li>
				<strong>Custom</strong>: one team to start, and <strong>Add team</strong> in the toolbar for more,
				up to twelve.
			</li>
		{:else}
			<li>
				<strong>Custom</strong>: one team to start, and <strong>Add team</strong> in the view bar for
				more, up to twelve.
			</li>
		{/if}
	</ul>
	{#if $nextLayout}
		<p>
			<strong>New lineup</strong> on a team in <strong>Teams</strong> does the same, and the lineup
			starts with that team. The Builder shows one lineup at a time and saves it as you work. The
			lineup’s name in the top bar opens <strong>Lineups</strong>, where each one can be pinned,
			renamed, or deleted.
		</p>
	{:else}
		<p>
			Each lineup is a tab: Double-click to rename it and drag to reorder. You can keep up to twelve
			tabs open at a time. A closed lineup with anyone in it goes to <strong>Recently closed</strong
			> in the Library.
		</p>
	{/if}
	<p>
		A new Stygian lineup follows the current season until you place someone in it; from then on it
		stays on that season. The season menu in its header has every earlier season.
	</p>
	<p>
		<strong>No repeats</strong> keeps each character on one team, the way the game does. It is on for
		Stygian and Abyss lineups and off for Custom ones. While it’s on, picking someone who is already on
		another team takes them off it, and picking them again adds them here. You can turn it on or off on
		any lineup. You may want to turn it off if you are preparing for the Menacing or lower difficulty
		levels of Stygian Onslaught.
	</p>
</section>

<section>
	<h2 id="building">Building a team</h2>
	<p>
		Click a team to select it. A banner in the team’s color says where your picks will go — “Adding
		to Battlefield 2 · 3/4”. Clicking a character card puts them in the first empty slot; clicking
		them again takes them out and leaves the others where they are. With no team chosen, picks fill
		the first team that has room and move on once it’s full.
	</p>
	<p>
		The magnifier on a card opens the character’s details: every capability with the ability that
		grants it, its constellation and any condition it needs, plus their cooldowns and Energy cost.
		Ownership is shown there but is edited in the Roster (see <a href="#roster">below</a>).
	</p>
	{#if !$nextLayout}
		<p>
			From the Library, a saved team or rotation can go straight onto the selected team, replacing
			its members. With no team selected it goes to the first empty one.
		</p>
	{/if}
</section>

<section>
	<h2 id="characters">Finding characters</h2>
	<p>
		The strip over <strong>Characters</strong> filters by role, by element and by what a character
		can provide. Roles are filtered one at a time; elements match any of those you pick;
		capabilities under
		<strong>Can provide</strong> match only characters who provide all of them. Choosing a role also sorts
		the grid into sections: Damage roles are sorted by element, while Support and Survivability roles
		are sorted by capability.
	</p>
	{#if $nextLayout}
		<p>
			The toolbar narrows further: <strong>Show</strong> for owned or wishlisted characters, a name
			search, and <strong>More</strong> for weapon, rarity, region, and factions like Hexerei or Moonsign.
		</p>
	{:else}
		<p>
			The view bar narrows further: <strong>Show</strong> for owned or wishlisted characters, a name
			search, and <strong>More</strong> for weapon, rarity, region, and factions like Hexerei or Moonsign.
		</p>
	{/if}
	{#if $nextLayout}
		<p>
			The column of icons on a card is that character’s own capabilities. Each is lit if it’s
			available at the constellations you’ve specified and dimmed if it needs a higher one (hover
			over it to find out what would unlock it). The constellation lens in the toolbar sets that
			level: C0 through C6, or <strong>My constellations</strong>, the default, which reads your
			roster. It changes the Characters grid only. A team reads your roster for characters you own
			and its own level for anyone else.
		</p>
	{:else}
		<p>
			The column of icons on a card is that character’s own capabilities. Each is lit if it’s
			available at the constellations you’ve specified and dimmed if it needs a higher one (hover
			over it to find out what would unlock it). The constellation lens in the view bar sets that
			level: C0 through C6, or <strong>My constellations</strong>, the default, which reads your
			roster. It changes the Characters grid display only; the teams are read at their own
			constellations.
		</p>
	{/if}
	<p>
		Some kits have no capability data yet. While you filter by capability they are listed separately
		under “Not yet curated”, because a missing icon there means unknown rather than no. The
		<a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a> shows where each
		character currently stands.
	</p>
</section>

<section>
	<h2 id="capabilities">What a team can provide</h2>
	<p>
		Each team shows fifteen capabilities in three groups: survival (healing, shields, cleanse,
		taunt), support (buffs, energy, RES shred, grouping, infusion, interruption RES) and off-field
		damage. A lit icon means someone on the team provides it, with a dot for each provider. A faint
		icon means nobody does. Dots on a faint icon are characters who would provide that at a higher
		constellation or on a different team.
	</p>
	<p>
		Conditions are read against the team. A buff that needs a Pyro-affected enemy lights only if
		someone applies Pyro, and a buff that is conditional on team composition only lights up when the
		condition is met. Adding a character can change a teammate’s capabilities this way, which is
		easiest to see by hovering a card with your cursor: The selected team previews how its
		capabilities would change with the character in focus.
	</p>
	<p>
		Click a faint capability to find who provides it. The Characters grid narrows to that capability
		and that team becomes the destination for your next pick.
	</p>
	<p>
		The icons say what a team can do, not how much or how often — there are no amounts or uptimes
		here. The Rotation Planner is where you can test this out.
	</p>
	<p>
		On a Stygian battlefield, the chips beside the boss are that battlefield’s checks. A thumbs up
		marks something the battlefield favors and a thumbs down something the boss resists. Once a team
		is on it, a check mark means the team brings a favored thing, and a warning means it does
		something the boss resists. A few checks can’t be read from a team (how often you plunge, for
		instance) and are left without a verdict. The boss’s magnifier opens its HP and mechanics in the
		game’s words. Enemy RES isn’t shown; you can check
		<a href="https://www.stygian.moe" target="_blank" rel="noopener noreferrer">Stygian.moe</a> for a
		breakdown of elemental resistances during the different phases of the battle.
	</p>
</section>

<section>
	<h2 id="swapping">Swapping a character</h2>
	<p>
		Click a portrait in the selected team to replace that character. The banner reads “Replacing
		Furina”, and the Characters grid regroups by what the swap would do to the team:
	</p>
	<ul>
		<li><strong>Keeps everything</strong>: Nothing the team provides is lost.</li>
		<li><strong>Trades</strong>: Something is lost, listed in the section header.</li>
		<li>
			<strong>Changes the reactions</strong>: The team’s reactions or resonance change, whether or
			not it also loses something.
		</li>
		<li><strong>Not yet curated</strong>: no capability data, so the swap can’t be read.</li>
	</ul>
	<p>
		What a candidate would add shows as green icons on their card. Only characters who play the same
		position (on field or off) are offered at first; a button at the foot of the grid shows the
		rest. Escape or the banner’s ✕ leaves without swapping.
	</p>
	<p>
		Picking someone makes the swap, and the notice above the lineup offers to <strong>Undo</strong>
		it. If the team had a pinned rotation, the pin drops, because the rotation was written for the old
		character; the notice then offers to open a copy in the Rotation Planner with the new character written
		in their place.
	</p>
	<p>
		The Rotation Planner sends you here too: Clicking a portrait on its bench opens swap mode for
		that team. Picking someone renames them in the notation and takes you back; Cancel returns
		without changing anything. An empty slot works the same way and adds someone instead.
	</p>
</section>

<section>
	<h2 id="rotations">Rotations</h2>
	{#if $nextLayout}
		<p>
			If this profile has a rotation for exactly the four characters in a team (in any order), you
			will see the pin under <strong>Planner</strong> become a menu, which you can use to pin a
			specific rotation to that team. Characters you don’t own then read that rotation’s
			constellations.
			<strong>Planner</strong> opens the pinned rotation, or a new rotation with the team’s names if nothing
			is pinned. Changing the team’s members drops the pin; the rotation itself stays in the Library.
		</p>
	{:else}
		<p>
			If you have already saved a rotation to your library for exactly the four characters in a team
			(in any order), you will see the pin under <strong>Planner</strong> become a menu, which you
			can use to pin a specific rotation to that team. The team will then read its capabilities at
			that rotation’s constellations.
			<strong>Planner</strong> opens the pinned rotation, or a new tab with the team’s names if nothing
			is pinned. Changing the team’s members drops the pin; the rotation itself stays in the Library under
			its original team.
		</p>
	{/if}
</section>

<section>
	{#if $nextLayout}
		<h2 id="roster">Your roster and sharing</h2>
	{:else}
		<h2 id="roster">Your roster, saving and sharing</h2>
	{/if}
	{#if $nextLayout}
		<p>
			Your roster is under <strong>Roster</strong> in the profile menu (your picture in the top
			bar), and <strong>Edit in Roster</strong> in a character’s details goes there too. Mark who
			you own, who you’re wishing for, and at what constellation. <strong>Show</strong>,
			<strong>My constellations</strong> and the constellation chips all read it, so filling in your roster
			makes the tools more useful. In Theorycraft there is no roster: every character is there at every
			level.
		</p>
	{:else}
		<p>
			Your roster lives in the Library’s <strong>Roster</strong> tab, also reached from
			<strong>Edit in Roster</strong> in a character’s details. Mark who you own, who you’re wishing
			for, and at what constellation. <strong>Show</strong>, <strong>My constellations</strong> and the
			constellation chips all read it, so filling in your roster makes the tools more useful.
		</p>
	{/if}
	{#if $nextLayout}
		<p>
			The chip on a team portrait is the constellation that team uses. A character you own is at
			your roster’s level; the chip is hollow for a character you don’t own.
		</p>
	{:else}
		<p>
			The chip on a team portrait is the constellation that team uses. If it is filled, you own at
			least that constellation. If it's hollow, the team uses a constellation higher than you have
			(or a character you don’t own).
		</p>
	{/if}
	{#if $nextLayout}
		<p>
			<strong>Share</strong> in the top bar copies a link with the lineup’s teams, preset, season, No
			repeats setting, and constellations. (Pinned rotations are not included.) It opens in Theorycraft
			for the reader.
		</p>
	{:else}
		<p>
			An unsaved lineup follows your roster as it changes. <strong>Save</strong> puts the lineup in
			the Library and fixes each member’s constellation as it was, so a saved lineup stays put.
			<strong>Share</strong> copies a link with the lineup’s teams, preset, season, No repeats setting
			and constellations. (Pinned rotations are not included.)
		</p>
	{/if}
</section>

<section>
	<h2 id="phone">On a phone</h2>
	<p>
		On narrower screens Characters and the Lineup are two panes with a button to switch between
		them. Filling a team takes you to the Lineup, and choosing a slot to fill takes you to
		Characters. There is no hover preview on touch.
	</p>
</section>
