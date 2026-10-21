<!-- Privacy chapter — see $lib/help/areas.ts. Every <h2> carries an id; the area
	 shell reads them for the sidebar's table of contents.

	 Rewritten 2026-10-16 for launch, with Cloudflare Web Analytics on (enabled
	 in the Pages dashboard 2026-10-15; auto-injected, no code in the repo).
	 ⚠️ Every claim here is checked against the code: the key list is
	 stores.ts + boards + rotationTabs + documentBar + visualizers/workspace +
	 storageDurability (the last-backup stamp, and the persist ask on save);
	 Backup is settingsBackup.ts BACKUP_KEYS; Reset is SettingsPanel's
	 clearEverything. What Cloudflare collects is stated AS CLOUDFLARE STATES
	 IT (its Web Analytics FAQ) — we have not measured the beacon. Update
	 "Last updated" with any change. -->
<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<h1>Privacy</h1>

<p class="lede">
	critcalc has no accounts and no server of its own. What you set up stays in your browser. What
	leaves your browser is listed below.
</p>

<section>
	<h2 id="in-your-browser">What stays in your browser</h2>
	<p>Everything you create is kept in this browser’s local storage, on this device only:</p>
	<ul>
		<li>Your settings: display, Human timing, playback sound, and swap ping.</li>
		<li>Your roster: which characters you own or have wishlisted, and at what constellation.</li>
		<li>Weapon and artifact loadouts.</li>
		<li>Saved rotations and teams, and saved lineups.</li>
		<li>Open tabs in the Rotation Planner and the Team Builder, and their recently closed tabs.</li>
		<li>The Visualizers’ layout.</li>
		<li>When you last downloaded a backup, so Settings can tell you.</li>
	</ul>
	<p>
		critcalc sets no cookies. A backup file from <a href={resolve('/settings')}>Settings</a> carries
		all of it. <strong>Reset saved data</strong> in the same place clears your roster, loadouts, saved
		rotations, and saved lineups but keeps your settings. To remove everything, clear this site’s data
		in your browser.
	</p>
	<p>
		Browsers can clear a site’s storage on their own, for example after a while without a visit. The
		first time you save a rotation or lineup, critcalc asks your browser to keep this site’s data
		instead. Firefox shows you a prompt for this; other browsers decide by themselves. Settings
		shows what your browser answered.
	</p>
</section>

<section>
	<h2 id="what-leaves">What leaves it</h2>

	<h3>Share links, when you send one</h3>
	<p>
		A share link carries what you’re sharing inside the link itself: a rotation’s notation with its
		constellations and loadouts, a lineup’s teams, or one instrument’s settings. Nothing about you
		is added, and nothing is sent anywhere until you paste the link somewhere.
	</p>

	<h3>Reports, when you send one</h3>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- the external form -->
	<p>
		The feedback form is a Google Form. <strong>Report a problem</strong> opens it with some answers
		already filled in: which tool you were in, a share link to what you were looking at, critcalc’s
		build, and your browser’s user-agent string, plus the error message if something crashed. Those
		reach Google when the form opens, and become a report only if you submit it.
		<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"
			>Google’s privacy policy</a
		> covers the form.
	</p>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	<h3>Visit counts</h3>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- the external FAQ -->
	<p>
		critcalc uses Cloudflare Web Analytics to count visits: which pages are viewed, the referring
		site, the browser and device type, and the country. Cloudflare says it uses no cookies or local
		storage for this and doesn’t record the query string, so the rotation inside a share link isn’t
		part of it. Its
		<a
			href="https://developers.cloudflare.com/web-analytics/faq/"
			target="_blank"
			rel="noopener noreferrer">Web Analytics FAQ</a
		> has the details.
	</p>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	<h3>The host</h3>
	<p>
		critcalc is served by Cloudflare Pages. Like any web host, Cloudflare handles each request, your
		IP address included, to deliver the page.
	</p>
</section>

<section>
	<h2 id="not-here">What critcalc doesn’t have</h2>
	<p>
		No accounts, no ads, no third-party scripts beyond the analytics above, and no fonts or images
		loaded from anywhere else. Links to other sites open in a new tab, and those sites’ own policies
		apply there.
	</p>
</section>

<section>
	<h2 id="changes">Changes</h2>
	<p>If any of this changes, this page changes first.</p>
	<p>Last updated October 21, 2026.</p>
</section>
