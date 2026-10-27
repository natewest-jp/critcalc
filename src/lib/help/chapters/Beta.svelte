<!-- Beta chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 The BETA tag's target (2026-10-16; it pointed at Contribute until this
	 page existed). ↻ Rewritten by Nate 2026-10-18 in the first person: the
	 note now covers the data as well as the surface (the kits are where
	 checking matters most), and ⛔ it still names no end date. Style guide
	 §1.4: "I" for what is personal, "we" for modelling decisions. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
</script>

<h1>Beta</h1>

<p class="lede">
	critcalc may be rough around the edges for a bit. It’s a solo project, and while most things have
	been worked through, new problems still turn up.
</p>

<section>
	<h2 id="report">If something looks wrong</h2>
	<p>
		I’ve only been able to test the site on the few devices I own, so if something doesn’t look
		right on yours, <a href={resolve('/contribute')}>I’d like to hear about it</a>.
	</p>
	<p>
		The character data is where I could use the most help. Every kit is curated by hand from the kit
		text and timed against gcsim’s measured frames wherever gcsim has the character, and where a kit
		isn’t finished the tools say so instead of guessing. The
		<a href={resolve('/coverage')} onclick={(e) => openCoverage(e)}>coverage page</a> shows how far each
		character has gotten.
	</p>
	<p>
		That said, I don’t have all characters or constellations. Calling all mains! If you see
		something wrong with a character you know,
		<a href={resolve('/contribute')}>Contribute</a> says how to report it.
		<strong>Report a problem</strong>
		in the top bar’s <strong>?</strong> menu is the fastest way, because it sends a link to exactly what
		you were looking at.
	</p>
	<p>Any and all help is appreciated!</p>
</section>

<section>
	<h2 id="what-changes">What changes and what stays the same</h2>
	<p>
		The interface will keep changing for a while, and more features are on the way. Coverage of kits
		will improve as reports get filed and data gaps are uncovered.
	</p>
	<p>
		While that happens, your saved data won’t be lost. Everything in your Library stays in your
		browser through every update. It’s still worth downloading a backup now and then (<strong
			>Export…</strong
		> in Settings), because clearing your browser’s site data erases it. Settings shows when you last
		did.
	</p>
</section>
