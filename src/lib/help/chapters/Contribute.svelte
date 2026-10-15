<!-- About chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 ↻ 2026-10-15: the "Report something" section has its channel — the
	 feedback form ($lib/feedback.ts owns its address). A future Ko-fi / GitHub
	 Sponsors link belongs in "Supporting critcalc": not promised until it
	 exists. -->

<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { FEEDBACK_FORM_URL } from '$lib/feedback';
</script>

<h1>Contribute</h1>

<p class="lede">
	critcalc is built on data the Genshin community gathered and gave away. The most useful thing you
	can do for this site is to support the projects upstream of it.
</p>

<section>
	<h2 id="upstream">Support the projects this is built on</h2>
	<p>
		Every timing the Rotation Planner draws and every capability the Team Builder derives traces
		back to work done elsewhere, usually for free:
	</p>
	<ul>
		<li>
			<a href="https://gcsim.app" target="_blank" rel="noopener noreferrer">gcsim</a> — an open-source
			Genshin combat simulator, and our primary source for tick cadences, ability scalings, and targeting
			behavior. Its contributors measure the frames that make a frame-accurate timeline possible. Contributing
			a character implementation or a bug report there improves critcalc directly.
		</li>
		<li>
			<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer">Keqing Mains</a> — the
			theorycrafting standards, the calculation conventions, and the action notation the Rotation Planner
			reads. Their guides and libraries are the reason "KQM standard" means anything at all.
		</li>
		<li>
			<a href="https://github.com/theBowja/genshin-db" target="_blank" rel="noopener noreferrer"
				>genshin-db</a
			> — the datamined character, talent, and identity data every new character here starts from.
		</li>
	</ul>
	<p>
		Data flows downhill. A correction accepted upstream reaches critcalc — and every other community
		tool — rather than just this one.
	</p>
</section>

<section>
	<h2 id="report">Report something wrong</h2>
	<p>
		Wrong values, missing characters, and kits that behave differently in game than they do here are
		all worth flagging. Curation happens in stages, so "not curated yet" is a normal state rather
		than an oversight — but a value that is simply <em>wrong</em> is a bug.
	</p>
	<p>
		The <a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a> lists what each
		character’s kit has in the Rotation Planner so far, and what falls outside it, with the reason.
	</p>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- the external form -->
	<p>
		Send reports through the
		<a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">feedback form</a>. Inside
		a tool, <strong>Report a problem</strong> in the ⋯ menu opens the same form with a link to what you’re
		looking at already filled in.
	</p>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	<p>
		Checking a suspect value against <a
			href="https://gcsim.app"
			target="_blank"
			rel="noopener noreferrer">gcsim</a
		> is the fastest way to tell a curation gap from a genuine mistake.
	</p>
</section>

<section>
	<h2 id="supporting">Supporting critcalc</h2>
	<p>
		critcalc takes no money: no ads, no accounts, no analytics, nothing to subscribe to. It is a fan
		project and intends to stay one.
	</p>
	<p>
		So there is nothing to give here — which is the point of the section above. Send it upstream
		instead.
	</p>
</section>
