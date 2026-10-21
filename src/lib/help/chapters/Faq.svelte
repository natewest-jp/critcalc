<!-- Help chapter. Rendered both at /help and inside the chrome's Help overlay —
	 see $lib/help/areas.ts. Every <h2> carries an id: the area shell reads them
	 to build the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch (the static-pages round). ↻ 2026-10-18,
	 Nate's review: "What is critcalc?" and "Does it tell me my damage number"
	 are cut (About says what the site is; ⛔ the aim is not restated here) —
	 describe the thing. The home-screen links go to Google's and Apple's own
	 help pages. -->
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

	<h3>Is critcalc official?</h3>
	<p>
		No. It’s an unofficial fan project, not affiliated with or endorsed by HoYoverse. It’s also not
		created or backed by any company. This is a solo dev project.
	</p>

	<h3>What does the beta tag mean?</h3>
	<p>
		That the site is still in its early stages and could use some help. The
		<a href={resolve('/beta')}>Beta</a> page goes into a little more detail.
	</p>
</section>

<section>
	<h2 id="your-data">Your data</h2>

	<h3>Do I need an account?</h3>
	<p>
		No. Everything you set up (your roster, loadouts, saved rotations and lineups, and settings) is
		stored in this browser and nowhere else. <a href={resolve('/privacy')}>Privacy</a> lists exactly what
		is kept in your browser and what leaves it. Because nothing is kept anywhere else, clearing this site’s
		data in your browser erases it, so it’s worth downloading a backup now and then.
	</p>

	<h3>How do I move my data to another device?</h3>
	<p>
		In <a href={resolve('/settings')}>Settings</a> under <strong>Backup</strong>, click
		<strong>Export…</strong> to download all your data as one file. Move that file to the other
		device, then look for <strong>Restore</strong> and the <strong>Import…</strong> button to load that
		file’s data. The file carries your settings, roster, constellations, loadouts, saved rotations and
		lineups, open tabs, and the Visualizers’ layout.
	</p>

	<h3>What does a share link carry?</h3>
	<p>
		Only the thing you’re sharing, written into the link itself. A Rotation Planner link holds the
		notation and each character’s constellation and loadout; a Team Builder link holds the lineup’s
		teams and their constellations, but not their pinned rotations; a Visualizers link holds that
		one instrument’s settings.
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
		the kit text, frame counts measured against gcsim wherever it has the character. Kits newer than
		genshin-db’s text are read from the Fandom wiki’s tooltips. <a href={resolve('/about')}>About</a
		> gives the full list of sources behind this project.
	</p>

	<h3>Is my character fully in?</h3>
	<p>
		The <a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a> answers that
		for every character, ability by ability, and gives the reason for anything the Rotation Planner leaves
		out. A character without curated frames still appears everywhere, marked “Not yet curated”, with generic
		frame timings as a stand-in.
	</p>

	<h3>Something looks wrong.</h3>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- the external form -->
	<p>
		Please report it through the
		<a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">feedback form</a>. Inside
		a tool, <strong>Report a problem</strong> in the <strong>⋯</strong> menu opens the same form
		with a link to what you’re looking at already filled in. A character’s details card has its own
		link:
		<strong>Something not right with this character?</strong>
	</p>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</section>

<section>
	<h2 id="timing">Timing</h2>

	<h3>Why is the timeline faster or slower than the timing I know?</h3>
	<p>
		Check <strong>Human timing</strong> (it’s on by default). This pads every input the game doesn’t
		buffer with a few frames of reaction time — 10 to start with, which is the KQM starting point.
		Normal attack into normal attack is queued up by the game, so no padding is added there. Turn it
		off in the Rotation Planner’s view bar to see the frame-perfect rotation, or tune it in
		<a href={resolve('/settings')}>Settings</a>.
	</p>
	<p>
		Swapping characters costs time either way. Swaps are calculated as your ping plus about 90 ms.
		At critcalc’s default ping setting (60 ms), that results in nine frames for every swap. Set your
		own ping under <strong>Swap ping</strong> in Settings.
	</p>

	<h3>Why does a skill come back later than its cooldown says?</h3>
	<p>
		Because for most skills the cooldown doesn’t start on the button press. It starts a few frames
		into the cast (eleven frames for Nahida’s skill, for example), and the timeline draws it from
		there. A few skills start even later: Xilonen’s cooldown timer only begins once her Nightsoul
		state ends, so it runs after the stance rather than from the cast.
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
		On a phone the Rotation Planner starts with the Buffs and Auras layers off, and you can hide the
		bench.
	</p>
	<p>
		If you use critcalc on your phone often, I’d suggest adding it to your home screen, which opens
		the site without your browser’s bars. On an iPhone, it also stops Safari from clearing your data
		when you haven’t visited in a while. It still needs a connection: Character data loads as you
		use it, so going offline partway through can leave a character half-loaded.
	</p>
	<p>
		Here’s how to add it to your home screen on an
		<a
			href="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid"
			target="_blank"
			rel="noopener noreferrer">Android phone (Chrome)</a
		>
		and on an
		<a
			href="https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios"
			target="_blank"
			rel="noopener noreferrer">iPhone (Safari)</a
		>.
	</p>
</section>
