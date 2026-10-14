<!-- Help chapter. Rendered both at /help and inside the chrome's Help overlay —
	 see $lib/help/areas.ts. Every <h2> carries an id: the area shell reads them
	 to build the sidebar's table of contents. -->
<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<h1>Help &amp; FAQ</h1>

<p class="lede">
	How the tools work, and answers to the questions that come up most. Each tool has its own chapter
	alongside this one.
</p>

<section>
	<h2 id="what-it-is">What critcalc is</h2>

	<h3>What is critcalc?</h3>
	<p>
		A set of Genshin Impact theorycrafting tools that <em>visualize</em> mechanics — crit odds, rotation
		timing, team capabilities — instead of reducing them to a single score.
	</p>

	<h3>Does it tell me my damage number or the best team?</h3>
	<p>
		No, by design. critcalc shows mechanics, not verdicts: no damage totals, no tier lists, no
		"synergy scores." It helps you <em>see</em> how the pieces fit; the judgment stays yours.
	</p>

	<h3>Is critcalc official?</h3>
	<p>No — it's an unofficial fan project, not affiliated with or endorsed by HoYoverse.</p>
</section>

<section>
	<h2 id="your-data">Your data</h2>

	<h3>Do I need an account? Is anything saved on a server?</h3>
	<p>
		No account, no sign-in, no server. Everything you set — your roster, loadouts, saved rotations,
		and settings — lives only in your own browser. See
		<a href={resolve('/privacy')}>Privacy</a> for the full picture.
	</p>

	<h3>How do I move my data to another device?</h3>
	<p>
		Open <strong>Settings</strong> (the gear, top right) and use <strong>Your data</strong> to export
		a backup file, then import it in the other browser. Because everything is local, that is also the
		only way it travels.
	</p>
</section>

<section>
	<h2 id="the-data">The data behind it</h2>

	<h3>Where does the character data come from?</h3>
	<p>
		It is curated in-house and cross-checked against
		<a href="https://gcsim.app" target="_blank" rel="noopener noreferrer">gcsim</a> and
		<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer">Keqing Mains</a>,
		seeded from the sources credited on the <a href={resolve('/about')}>About page</a>.
	</p>

	<h3>A value looks wrong, or a character is missing.</h3>
	<p>
		Some newer or niche kits aren't fully curated yet. Those are shown honestly as "not yet curated"
		rather than guessed at, and timing is only ever taken from gcsim or in-game kit text — never
		invented. If something still looks off, <a href={resolve('/contribute')}>let us know</a>.
	</p>

	<h3>Why do some characters show fewer details than others?</h3>
	<p>
		Curation happens in stages. A kit can have its capabilities mapped (who heals, who shields, who
		shreds RES) before its frame-accurate timing is measured. The Team Builder can use the first;
		the Rotation Planner needs the second, and says so plainly when it is missing.
	</p>
</section>

<section>
	<h2 id="odds-and-ends">Odds and ends</h2>

	<h3>Which terminology do you follow?</h3>
	<p>
		<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer">Keqing Mains</a> (KQM)
		standards throughout, including the rotation notation the planner reads.
	</p>

	<h3>Does the site work offline or on a phone?</h3>
	<p>
		It is a static site, so it loads fast and keeps working while you are on it. The tools are built
		for wide screens — the planner timeline in particular rewards the room — but they scale down.
	</p>
</section>
