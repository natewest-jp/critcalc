<!-- Help chapter. Rendered both at /help and inside the chrome's Help overlay —
	 see $lib/help/areas.ts. Every <h2> carries an id: the area shell reads them
	 to build the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round). ⚓ "Does it tell
	 me my damage number" is the one FAQ question where the project's aim is
	 stated (style guide §1.3); everywhere else, describe the thing. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { FEEDBACK_FORM_URL } from '$lib/feedback';
</script>

<h1>Help &amp; FAQ</h1>

<p class="lede">
	Questions about the site as a whole. Each tool has its own chapter alongside this one.
</p>

<section>
	<h2 id="what-it-is">What critcalc is</h2>

	<h3>What is critcalc?</h3>
	<p>
		Three theorycrafting tools for Genshin Impact: a Team Builder, a Rotation Planner and the
		Visualizers. <a href={resolve('/about')}>About</a> has the longer answer.
	</p>

	<h3>Does it tell me my damage number, or the best team?</h3>
	<p>
		Not the best team, and mostly not a damage total. The Rotation Planner draws when things happen
		— casts, buffs, auras — and doesn’t add up damage. The Team Builder shows what a team can
		provide and what a swap changes, without ranking teams.
	</p>
	<p>
		Damage Breakdown is the exception: it writes a single hit out as its formula and ends in a
		number for reaction damage. A direct hit comes out as a ratio instead, because the talent
		multiplier isn’t one of its inputs. Totals aren’t ruled out; they just aren’t what the tools are
		for right now.
	</p>

	<h3>Is critcalc official?</h3>
	<p>No. It’s an unofficial fan project, not affiliated with or endorsed by HoYoverse.</p>

	<h3>What does the beta tag mean?</h3>
	<p>
		That the tools are still changing. <a href={resolve('/beta')}>Beta</a> says what that does and doesn’t
		cover.
	</p>
</section>

<section>
	<h2 id="your-data">Your data</h2>

	<h3>Do I need an account?</h3>
	<p>
		No. Everything you set up — your roster, loadouts, saved rotations and lineups, settings — is
		stored in this browser and nowhere else. <a href={resolve('/privacy')}>Privacy</a> lists exactly what
		is kept and what ever leaves.
	</p>

	<h3>How do I move my data to another device?</h3>
	<p>
		In <a href={resolve('/settings')}>Settings</a>, <strong>Export…</strong> under
		<strong>Backup</strong> downloads one file; <strong>Import…</strong> under
		<strong>Restore</strong> loads it on the other device. The file carries your settings, roster, constellations,
		loadouts, saved rotations and saved lineups. Open tabs and the Visualizers layout stay behind.
	</p>

	<h3>What does a share link carry?</h3>
	<p>
		Only the thing you’re sharing, written into the link itself. A Rotation Planner link holds the
		notation and each character’s constellation and loadout; a Team Builder link holds the lineup’s
		teams and their constellations, but not their pinned rotations; a Visualizers link holds one
		instrument’s settings.
	</p>
	<p>
		A link opens at the reader’s own settings, not yours. If you share a rotation with Human timing
		on and they have it off, they see the frame-perfect version. Links can get long, and some chat
		apps cut them short; if one won’t open, that’s the usual cause.
	</p>
</section>

<section>
	<h2 id="the-data">The data behind it</h2>

	<h3>Where does the character data come from?</h3>
	<p>
		Each kit starts from genshin-db’s datamine and is curated by hand: effects and conditions from
		the kit text, frame counts measured against gcsim. Kits newer than genshin-db’s text are read
		from the Fandom wiki’s tooltips. <a href={resolve('/about')}>About</a> lists every source.
	</p>

	<h3>Is my character fully in?</h3>
	<p>
		The <a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a> answers that
		for every character, ability by ability, and gives the reason for anything the Rotation Planner leaves
		out. A character without curated frames still appears everywhere, marked “Not yet curated”, with generic
		timings standing in.
	</p>

	<h3>Something looks wrong.</h3>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- the external form -->
	<p>
		Please report it through the
		<a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">feedback form</a>. Inside
		a tool, <strong>Report a problem</strong> in the <strong>⋯</strong> menu opens the same form
		with a link to what you’re looking at already filled in, and a character’s details card has
		<strong>Something’s not right with this character</strong>.
	</p>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</section>

<section>
	<h2 id="timing">Timing</h2>

	<h3>Why is the timeline slower than the frame counts I know?</h3>
	<p>
		<strong>Human timing</strong> is on by default. It pads every input the game doesn’t buffer with
		a few frames of reaction time — 10 to start with, the KQM starting point. Normal attack into
		normal attack is free, because the game queues those for you. Turn it off in the Rotation
		Planner’s view bar to see the frame-perfect rotation, or tune it in
		<a href={resolve('/settings')}>Settings</a>.
	</p>
	<p>
		Swaps cost time either way: your ping plus about 90 ms, which comes to nine frames at the
		default 60 ms. Set your own ping under <strong>Swap ping</strong> in Settings.
	</p>

	<h3>Why does a skill come back later than its cooldown says?</h3>
	<p>
		Because for most skills the cooldown doesn’t start on the button press. It starts a few frames
		into the cast — eleven for Nahida’s skill — and the timeline draws it from there, as gcsim
		measures it. A few skills go further: Xilonen’s cooldown only starts once her Nightsoul state
		ends, so it runs after the stance rather than from the cast.
	</p>
</section>

<section>
	<h2 id="odds-and-ends">Odds and ends</h2>

	<h3>Which terminology does critcalc follow?</h3>
	<p>
		<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer">Keqing Mains</a>:
		its notation for rotations, its names for mechanics, and the game’s own names for reactions —
		Frozen and Overloaded, for instance.
	</p>

	<h3>Does it work on a phone?</h3>
	<p>
		Yes, down to 320px wide, though the Rotation Planner and Team Builder are easier with more room.
		On a phone the Rotation Planner’s composer docks to the bottom of the screen with a row of
		notation keys. You can also add the site to your home screen, and it opens without the browser’s
		bars.
	</p>
	<p>
		It needs a connection, though. Character data loads as you use it, so going offline partway
		through can leave a character half-loaded.
	</p>
</section>
