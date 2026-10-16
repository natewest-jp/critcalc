<!-- About chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 The BETA tag's target (2026-10-16; it pointed at Contribute until this
	 page existed). ⚓ Launch roadmap §8: the note is about the SURFACE, never
	 the data — the curation is the most careful part of the project — and ⛔ it
	 names no end condition (Nate, 2026-09-22). -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
</script>

<h1>Beta</h1>

<p class="flavor">
	A lens still on the grinder’s wheel. It already brings the sky into focus; the grinder simply
	hasn’t called it finished.
</p>

<p class="lede">
	The tools work, and they are still changing. The beta tag is about how they look and behave, not
	about the data inside them.
</p>

<section>
	<h2 id="what-changes">What still changes</h2>
	<p>
		Controls get moved, renamed and redrawn, sometimes from one week to the next. Something you got
		used to may look different the next time you visit, and some corners — narrow phones, Safari —
		have had less use than a desktop browser.
	</p>
	<p>
		Your saved data comes along when that happens. When the way a rotation or lineup is stored
		changes, what you saved is carried over to the new form.
	</p>
</section>

<section>
	<h2 id="what-doesnt">What the tag doesn’t cover</h2>
	<p>
		The character data is where most of the work has gone. Every kit is curated by hand from the kit
		text and timed against gcsim’s measured frames, and where a kit isn’t finished the tools say so
		instead of guessing. The
		<a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a> shows how far each
		character has got.
	</p>
	<p>
		That doesn’t make it free of mistakes. It means a wrong number is a bug to fix, not a rough edge
		to expect.
	</p>
</section>

<section>
	<h2 id="report">If something looks wrong</h2>
	<p>
		<a href={resolve('/contribute')}>Contribute</a> says how to report it. The
		<strong>Report a problem</strong> item in a tool’s <strong>⋯</strong> menu is the fastest way, because
		it sends a link to exactly what you were looking at.
	</p>
</section>
