<!-- Help chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch against the LINEUPS tool (design doc
	 docs/team-builder-lineups-design.md §11 wins; swap mode is §11.6 item 20).
	 Glossary names: Lineup (never "board"), Characters (the grid), Roster (the
	 Library tab ONLY), "the team's capabilities" (never "fingerprint"). ⚠ The
	 Abyss banner + Opponents need a CURRENT cycle in season-dates.json, so the
	 copy says "when a cycle is listed". -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
</script>

<h1>Team Builder</h1>

<p class="flavor">
	A brass disc of nested rings, each engraved with a name. Turn four into alignment and the plate
	shows what they would hold between them. Which four, it has never once suggested.
</p>

<p class="lede">
	A party setup screen. Build a lineup of teams for Stygian Onslaught, the Spiral Abyss or anything
	else, and each team shows what it can provide at the constellations it uses.
</p>

<section>
	<h2 id="lineups">Lineups</h2>
	<p>
		<strong>+</strong> in the document bar starts a new lineup in one of three shapes:
	</p>
	<ul>
		<li>
			<strong>Stygian Onslaught</strong>: three teams, one per battlefield, each with its boss and
			the season’s checks.
		</li>
		<li>
			<strong>Spiral Abyss</strong>: two teams for Floor 12’s first and second half. While a current
			cycle is listed, each half shows its blessing and an <strong>Opponents</strong> list.
		</li>
		<li>
			<strong>Custom</strong>: one team to start, and <strong>Add team</strong> in the view bar for more,
			up to twelve.
		</li>
	</ul>
	<p>
		Each lineup is a tab: double-click to rename it, drag to reorder, and up to twelve stay open. A
		closed lineup with anyone in it goes to <strong>Recently closed</strong> in the Library.
	</p>
	<p>
		A new Stygian lineup follows the current season until you place someone in it; from then on it
		stays on that season. The season menu in its header reaches the earlier ones.
	</p>
	<p>
		<strong>No repeats</strong> keeps each character on one team, the way the game does. It is on for
		Stygian and Abyss lineups and off for Custom ones. While it’s on, picking someone who is already on
		another team moves them, and the notice says from where.
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
		Ownership is shown there but edited in the Roster (see <a href="#roster">below</a>).
	</p>
	<p>
		From the Library, a saved team or rotation can go straight onto the selected team, replacing its
		members. With no team selected it goes to the first empty one.
	</p>
</section>

<section>
	<h2 id="characters">Finding characters</h2>
	<p>
		The strip over <strong>Characters</strong> filters by role, by element and by what a character
		can provide. Roles go one at a time; elements match any of those you pick; capabilities under
		<strong>Can provide</strong> match only characters who provide all of them. Choosing a role also sorts
		the grid into sections — damage roles by element, Support and Survivability by capability — so one
		character can turn up in several.
	</p>
	<p>
		The view bar narrows further: <strong>Show</strong> for owned or wishlisted characters, a name
		search, and <strong>More</strong> for weapon, rarity, region and the Moonsign, Hexerei and Stellar
		factions.
	</p>
	<p>
		The column of icons on a card is that character’s own capabilities. Each is lit if it’s
		available at the constellation you’re reading at and dimmed if it needs a higher one; its
		tooltip says which. The constellation lens in the view bar sets that level — C0 through C6, or
		<strong>My constellations</strong>, the default, which reads your roster. It changes the
		Characters grid only; the teams are read at their own constellations.
	</p>
	<p>
		Some kits have no capability data yet. While you filter by capability they are listed separately
		under “Not yet curated”, because a missing icon there means unknown rather than no. The
		<a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a> shows where each
		one stands.
	</p>
</section>

<section>
	<h2 id="capabilities">What a team can provide</h2>
	<p>
		Each team shows fifteen capabilities in three groups: survival (healing, shields, cleanse,
		taunt), support (the buffs, Energy, RES shred, grouping, infusion, Interruption RES) and
		off-field damage. A lit icon means someone on the team provides it, with a dot for each
		provider. A faint icon means nobody does; dots on a faint icon are characters who would at a
		higher constellation, or on a different team.
	</p>
	<p>
		Conditions are read against the team. A buff that needs a Pyro-affected enemy lights only if
		someone applies Pyro, and a buff on Electro-Charged goes faint once a Lunar-Charged enabler
		joins, because the reaction stops being Electro-Charged. Adding a character can put out a
		teammate’s capability this way, which is easiest to see by hovering a card: with a mouse, the
		selected team redraws as it would be with them in it.
	</p>
	<p>
		Click a faint capability to find who provides it. Characters narrows to that capability and the
		team becomes the destination for your next pick.
	</p>
	<p>
		The icons say what a team can do, not how much or how often — there are no amounts or uptimes
		here. The Rotation Planner is where timing lives.
	</p>
	<p>
		On a Stygian battlefield, the chips beside the boss are that battlefield’s checks. A thumb up
		marks something the battlefield favors and a thumb down something the boss resists. Once a team
		is on it, a check mark means the team brings a favored thing, and a warning means it does
		something the boss resists. A few checks can’t be read from a team (how often you plunge, for
		instance) and are left without a verdict. The boss’s magnifier opens its HP and mechanics in the
		game’s words. Enemy RES isn’t shown, because the published figures don’t track the fight’s
		mechanics;
		<a href="https://www.stygian.moe" target="_blank" rel="noopener noreferrer">Stygian.moe</a> is the
		place for it.
	</p>
</section>

<section>
	<h2 id="swapping">Swapping a character</h2>
	<p>
		Click a portrait in the selected team to replace that character. The banner reads “Replacing
		Furina”, and Characters regroups by what the swap would do to the team:
	</p>
	<ul>
		<li><strong>Keeps everything</strong>: nothing the team provides is lost.</li>
		<li><strong>Trades</strong>: something is lost, listed in the section header.</li>
		<li>
			<strong>Changes the reactions</strong>: the team’s reactions or resonance change, whatever
			else does.
		</li>
		<li><strong>Not yet curated</strong>: no capability data, so the swap can’t be read.</li>
	</ul>
	<p>
		What a candidate would add shows as green icons on their card. Only characters who play the same
		position — on field or off — are offered at first; a button at the foot of the grid shows the
		rest. Escape or the banner’s ✕ leaves without swapping.
	</p>
	<p>
		Picking someone makes the swap, and the notice offers <strong>Undo</strong>. If the team had a
		pinned rotation, the pin drops, because the rotation was written for the old character; the
		notice then offers to open a copy in the Rotation Planner with the new name written in.
	</p>
	<p>
		The Rotation Planner sends you here too: clicking a portrait on its bench opens swap mode for
		that tab’s team. Picking someone renames them in the notation and takes you back; Cancel returns
		without changing anything. An empty slot works the same way and adds someone instead.
	</p>
</section>

<section>
	<h2 id="rotations">Rotations</h2>
	<p>
		A team’s rotations are the saved rotations written for exactly those four characters, in any
		order. Pin one from the menu under <strong>Planner</strong>, and the team reads its capabilities
		at that rotation’s constellations. <strong>Planner</strong> opens the pinned rotation, or a new tab
		with the team’s names if nothing is pinned. Changing the team’s members drops the pin; the rotation
		itself stays in the Library under its original team.
	</p>
</section>

<section>
	<h2 id="roster">Your roster, saving and sharing</h2>
	<p>
		Your roster lives in the Library’s <strong>Roster</strong> tab, also reached from
		<strong>Edit in Roster</strong> in a character’s details. Mark who you own, who you’re wishing
		for, and at what constellation. <strong>Show</strong>, <strong>My constellations</strong> and the
		constellation chips all read it, and the Rotation Planner shares it.
	</p>
	<p>
		The chip on a team portrait is the constellation that team uses. Filled, you own at least that
		much; hollow, the team asks for more than you have, or for someone you don’t own.
	</p>
	<p>
		An unsaved lineup follows your roster as it changes. <strong>Save</strong> puts the lineup in
		the Library and fixes each member’s constellation as it was, so a saved lineup stays put.
		<strong>Share</strong> copies a link with the lineup’s teams, preset, season, No repeats and constellations;
		pinned rotations stay with you.
	</p>
</section>

<section>
	<h2 id="phone">On a phone</h2>
	<p>
		On narrower screens Characters and the Lineup are two panes with a plate to switch between them.
		Filling a team takes you to the Lineup, and choosing a slot to fill takes you to Characters. The
		filter strip folds into three plates — roles, elements, capabilities — and the magnifier is
		always showing on each card. There is no hover preview on touch.
	</p>
</section>
