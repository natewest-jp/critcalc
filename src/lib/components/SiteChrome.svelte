<script lang="ts">
	import { travelerTwin } from '$lib/travelerTwin.svelte';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import {
		closeChromeModal,
		isAboutPage,
		isHelpPage,
		onTool,
		openArea,
		openNav,
		openSettings,
		roster,
		rosterHref,
		stayHere
	} from './chromeModal.svelte';
	import { defaultChapter, helpChapterForPath } from '$lib/help/areas';
	import { page } from '$app/state';

	/** Per-instance prefix for the Roster mark's gradient ids (see its markup). */
	const uid = $props.id();

	// THE site chrome — one bar on every surface. Brand left, a host-supplied
	// center, three meta glyphs right; identical pixels on the landing, the
	// content pages and inside a tool.
	//
	// The center is a snippet rather than a prop because only the tools have
	// anything to put there: the tool switcher, with its measured gliding
	// underline riding the page pan's own duration. Keeping that markup in the
	// tools layout means the glide, and the probes that assert on it, are
	// untouched by this component existing. The landing passes nothing at all —
	// its hero cards ARE the tool nav.
	//
	// Positioning is the HOST's: this renders in flow, and .scene-chrome /
	// .tool-chrome-mount pin it. That is what lets the scene layout put a
	// parallax transform on the wrapper without this component caring.

	let {
		center
	}: {
		center?: Snippet;
	} = $props();

	// The "?" is contextual: inside a tool it opens that tool's chapter, and
	// anywhere else the general FAQ.
	const helpChapter = $derived(helpChapterForPath(page.url.pathname));
	const betaHere = $derived(page.url.pathname === resolve('/beta'));

	/** The BETA tag's click: the overlay on a tool, the page elsewhere. */
	function openBeta(event: MouseEvent): void {
		if (betaHere) return stayHere(event);
		if (!onTool()) return closeChromeModal();
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		openArea('about', 'beta');
	}
</script>

<header class="site-chrome">
	<!-- The brand and its BETA tag share column 1. The tag is a SIBLING link,
	     not a child — an anchor cannot nest in an anchor — so the two sit in
	     one flex group that owns the grid cell. -->
	<div class="chrome-brand-group">
		<a class="chrome-brand" href={resolve('/')} aria-label="critcalc.app home">
			<img src="/critcalc-logo-white.svg" alt="" />
			<span class="chrome-wordmark">critcalc.app</span>
		</a>
		<!-- BETA (launch roadmap §8, ⚓ Nate): the site LOOKS like it has a team
		     behind it, so a rough edge reads as "unreliable" rather than "one
		     person's project, still moving" — the tag re-frames that jolt. It is
		     a LINK, because a bare tag lowers expectations without giving anyone
		     anywhere to go. ↻ 2026-10-16: it lands on /beta, the "what beta means
		     here" note (it pointed at Contribute until that page existed).
		     ⚠ It points at the SURFACE, never the data — the curation is the
		     most rigorous part of the project and the linked note must say so.
		     🎛️ Gold, by Nate's ask 2026-09-16 (trying the accent first; a darker
		     gold is the fallback) — ⚠ this overrides §8's "chrome-toned pill"
		     and the block-not-word rule for this one mark, on his call. -->
		<!-- ↻ 2026-10-19 (⚓ Nate): it splits like About and Help (onTool()). On a
		     tool a plain click opens the About overlay at its Beta chapter rather
		     than leaving the tool; off a tool it is the link to /beta. It stays an
		     <a> either way, so a modified click still opens the page in a tab. -->
		<a
			class="chrome-beta"
			href={resolve('/beta')}
			title="What beta means here"
			aria-current={betaHere ? 'page' : undefined}
			onclick={openBeta}>BETA</a
		>
	</div>

	<div class="chrome-center">{@render center?.()}</div>

	<!-- Three marks of equal weight. This cluster used to be dark glyphs on solid
	     discs, dimmed to 72% so it would stop shouting — a workaround that left
	     it reading differently from everything else in the bar. It now carries
	     the brand's own opacity and quiets down by carrying LESS MASS instead.

	     Artwork is Nate's, from assets-src/tools/{about,help,settings}.svg. The
	     glyphs are HOLES in their discs (evenodd subpaths, so no mask is needed)
	     and the marks take their color from the chrome via fill: currentColor.

	     ⚠️ Keep every mark GEOMETRY — paths and shapes, never <text>. An earlier
	     pass set the letters with dominant-baseline: central and produced two
	     WebKit-only faults Nate caught in Safari: glyphs sitting high in their
	     circles, and the mark lifting ~1px on hover, because WebKit
	     re-rasterizes text down a different path once a filter applies. (That
	     filter — a hover halo — is gone now, but the rule stands: drawn shapes
	     center identically in both engines.) -->
	<nav class="chrome-actions" aria-label="Site actions">
		<!-- THE COMPASS — every destination on the site, in one control.

		     ⚠ It is NARROW-ONLY, and the pairing is the whole design: below
		     47.5rem this appears and the centre tool switcher, About and Help
		     all leave, because the bar physically cannot hold them beside a
		     wordmark. Measured at 320px: the old form wanted brand 204.4 +
		     padding 24 + gaps 16 + three 34px glyphs = 399.8 in a 320px bar.
		     The form that ships is 310.8 — compass and cog, 9.2px of slack —
		     and that is what lets `critcalc.app` survive on a phone instead of
		     the logo silently collapsing to 0px, which is what it did before.
		     Derivation: docs/rounds/responsive-survey-2026-09-01.md § 8.2.

		     Artwork is Nate's, from assets-src/tools/navigation.svg — Genshin's
		     own compass, chosen because it is the shape a player already reads
		     as "where can I go". ⚠ Unlike the other three it is NOT a disc with
		     a hole: it is a 53:62 PORTRAIT mark in three paths, so it sizes to
		     25.6px wide at the shared 30px glyph height and cannot overflow the
		     34px button. -->
		<button
			class="chrome-btn chrome-btn--nav"
			aria-label="Navigate"
			title="Navigate"
			onclick={openNav}
		>
			<svg
				class="chrome-glyph is-compass"
				viewBox="0 0 53 62"
				fill-rule="evenodd"
				aria-hidden="true"
				><path
					d="M25.071,16.831L24.277,13.093C24.179,12.833 24.026,12.596 23.83,12.4C23.633,12.203 23.397,12.051 23.136,11.953L18.533,10.218L23.136,8.483C23.397,8.385 23.633,8.233 23.83,8.036C24.026,7.84 24.179,7.603 24.277,7.343L26.001,2.767C20.976,2.769 19.892,4.244 20.249,4.818C20.466,5.167 21.671,5.888 23.704,6.227L23.407,7.016C23.37,7.115 23.317,7.208 23.252,7.291C20.576,6.838 18.417,5.815 17.643,4.973C15.91,3.089 19.03,-0 26.011,0C32.992,0 36.112,3.089 34.38,4.973C33.605,5.815 31.446,6.838 28.771,7.291C28.705,7.208 28.653,7.115 28.615,7.016L28.318,6.227C30.352,5.888 31.556,5.167 31.773,4.818C32.131,4.244 31.046,2.769 26.022,2.767L27.746,7.343C27.844,7.603 27.996,7.84 28.193,8.036C28.39,8.233 28.626,8.385 28.886,8.483L33.489,10.218L28.886,11.953C28.626,12.051 28.39,12.203 28.193,12.4C27.996,12.596 27.844,12.833 27.746,13.093L26.952,16.831L28.849,21.147C26.968,22.069 24.166,23.235 21.845,24.166L25.071,16.831ZM7.706,36.077C7.829,38.517 8.431,40.831 9.418,42.928C8.078,45.404 6.523,48.214 5.152,50.671C1.916,46.335 0,40.958 0,35.137C0,23.898 7.143,14.315 17.132,10.683L22.809,12.822C22.945,12.873 23.069,12.953 23.173,13.057C23.276,13.16 23.356,13.284 23.407,13.42L24.094,16.874C14.589,17.547 7.682,25.461 7.682,35.137C7.682,34.821 7.69,34.508 7.706,34.196L15.041,30.97C14.11,33.291 12.943,36.093 12.021,37.975L7.706,36.077ZM44.34,35.137C44.34,32.302 43.748,29.618 42.67,27.223C43.995,24.778 45.522,22.019 46.87,19.602C50.106,23.938 52.023,29.315 52.023,35.137C52.023,49.493 40.367,61.148 26.011,61.148C20.19,61.148 14.813,59.231 10.477,55.996C12.934,54.625 15.744,53.07 18.219,51.729C20.317,52.717 22.631,53.318 25.071,53.442L23.173,49.127C25.054,48.204 27.857,47.038 30.177,46.107L26.952,53.442C36.32,52.968 43.842,45.445 44.317,36.077L36.982,39.303C37.913,36.982 39.079,34.18 40.001,32.298L44.317,34.196C44.333,34.508 44.34,34.821 44.34,35.137ZM34.026,18.423C32.166,17.568 30.116,17.029 27.928,16.874L28.615,13.42C28.667,13.284 28.747,13.16 28.85,13.057C28.953,12.953 29.077,12.873 29.214,12.822L34.891,10.683C37.294,11.556 39.532,12.775 41.546,14.277C39.162,15.607 36.446,17.11 34.026,18.423ZM48.831,12.317C48.831,12.317 40.978,26.18 38.445,31.254C36.589,34.973 33.633,42.759 33.633,42.759C33.633,42.759 25.848,45.714 22.128,47.571C17.055,50.104 3.191,57.956 3.191,57.956C3.191,57.956 11.044,44.093 13.577,39.019C15.434,35.3 18.389,27.514 18.389,27.514C18.389,27.514 26.175,24.559 29.894,22.703C34.968,20.17 48.831,12.317 48.831,12.317Z"
				/><path
					d="M12.021,37.975L7.706,36.077C7.69,35.765 7.682,35.452 7.682,35.137C7.682,34.821 7.69,34.508 7.706,34.196L15.041,30.97C14.11,33.291 12.943,36.093 12.021,37.975ZM21.845,24.166L25.071,16.831C25.382,16.815 25.696,16.807 26.011,16.807C26.327,16.807 26.64,16.815 26.952,16.831L28.849,21.147C26.968,22.069 24.166,23.235 21.845,24.166ZM40.001,32.298L44.317,34.196C44.333,34.508 44.34,34.821 44.34,35.137C44.34,35.452 44.333,35.765 44.317,36.077L36.982,39.303C37.913,36.982 39.079,34.18 40.001,32.298ZM30.177,46.107L26.952,53.442C26.64,53.458 26.327,53.466 26.011,53.466C25.696,53.466 25.382,53.458 25.071,53.442L23.173,49.127C25.054,48.204 27.857,47.038 30.177,46.107Z"
					fill="#000"
					fill-opacity="0.31"
				/><path
					d="M34.882,26.266C34.882,26.266 31.829,31.655 30.845,33.627C30.123,35.073 28.974,38.099 28.974,38.099C28.974,38.099 25.948,39.248 24.502,39.97C22.53,40.954 17.141,44.007 17.141,44.007C17.141,44.007 20.193,38.618 21.178,36.646C21.9,35.2 23.048,32.174 23.048,32.174C23.048,32.174 26.075,31.025 27.521,30.303C29.493,29.319 34.882,26.266 34.882,26.266ZM30.999,30.149C29.899,30.752 28.854,31.314 28.191,31.645C27.117,32.181 25.197,32.947 24.208,33.333C23.822,34.322 23.056,36.242 22.52,37.316C22.189,37.979 21.627,39.024 21.024,40.124C22.124,39.521 23.169,38.959 23.832,38.628C24.906,38.092 26.825,37.326 27.814,36.94C28.201,35.951 28.966,34.031 29.503,32.957C29.834,32.294 30.396,31.249 30.999,30.149Z"
					fill="#000"
					fill-opacity="0.3"
				/></svg
			>
		</button>
		{#snippet aboutGlyph()}
			<svg class="chrome-glyph" viewBox="0 0 40 40" fill-rule="evenodd" aria-hidden="true"
				><path
					d="M241.24 88.27a20.87 20.87 0 0 1 0 41.72 20.87 20.87 0 0 1 0-41.72m2.07 13.38q0-.54-.5-1.13-.51-.6-1.19-.6l-.31-.04h-.4a2 2 0 0 0-1.34.54q-.62.55-.62 1.36v.36l.02.1q0 .63.57 1.13.55.48 1.31.48h.39q.77 0 1.4-.53.66-.57.65-1.16l.02-.15zm-1.5 3.93q-1.84 0-3.34.5-.8.3-.78.88-.02.58.81.99.63.29.75.7.14.45.13 3.04 0 2.6-.16 3.2-.15.6-.72 1.16-.7.7-.68 1.2.01.58.47.7.34.1 2.02.1h1.17q2.23 0 2.9-.22a1 1 0 0 0 .31-.18l.04-.05.03-.05.02-.06v-.21l-.08-.26q-.15-.26-.66-.8a3 3 0 0 1-.81-1.29q-.16-.65-.16-4.4a63 63 0 0 0-.07-4.19 1 1 0 0 0-.33-.57 1 1 0 0 0-.68-.19z"
					transform="translate(-211.3 -84.63)scale(.9588)"
				/></svg
			>
		{/snippet}
		{#snippet helpGlyph()}
			<svg class="chrome-glyph" viewBox="0 0 40 40" fill-rule="evenodd" aria-hidden="true"
				><path
					d="M241.24 88.27a20.87 20.87 0 0 1 0 41.72 20.87 20.87 0 0 1 0-41.72m-2.73 28.11q0 .8.6 1.4t1.51.6h.07l.33-.04q.66 0 1.25-.6.6-.59.6-1.35v-.14q0-.88-.64-1.45-.63-.56-1.4-.56h-.29l-.12.03q-.79 0-1.35.66t-.56 1.33zm-2.22-13.3q.01.8.4 1.12.26.24.71.24 1.01 0 1.75-1 .6-.86 1.45-.86t1.4.45q.52.45.52 1.26 0 .86-.37 1.52a10 10 0 0 1-1.28 1.67q-.92 1.03-1.1 1.33a3.3 3.3 0 0 0-.54 1.8q0 .96.34 1.68.38.81.96.8c.94 0 1.38-.35 1.38-.96q0-1.2.49-1.94.23-.35 1.72-1.72 2.06-1.92 2.06-4t-1.54-3.34a5.8 5.8 0 0 0-3.83-1.25q-2.31 0-3.68 1.07-.83.64-.84 1.9z"
					transform="translate(-211.3 -84.63)scale(.9588)"
				/></svg
			>
		{/snippet}
		<!-- ⚓ ABOUT AND HELP SPLIT LIKE ROSTER (Nate 2026-10-18; onTool() in
		     chromeModal.svelte.ts is the one test). On a tool they open the
		     overlay, and "?" opens that tool's chapter. Anywhere else they are
		     LINKS to their pages by the pages' crossfade — Help to its index, as
		     there is no tool chapter to guess. The page already showing is marked
		     aria-current and its click does nothing (stayHere): the switcher's
		     "you are here", kept focusable so a reader can still hear where they
		     are. -->
		{#if onTool()}
			<button
				class="chrome-btn"
				aria-label="About"
				title="About"
				onclick={() => openArea('about', defaultChapter('about'))}
			>
				{@render aboutGlyph()}
			</button>
			<button
				class="chrome-btn"
				aria-label="Help"
				title="Help"
				onclick={() => openArea('help', helpChapter)}
			>
				{@render helpGlyph()}
			</button>
		{:else}
			{@const aboutHere = isAboutPage(page.url.pathname)}
			{@const helpHere = isHelpPage(page.url.pathname)}
			<a
				class="chrome-btn"
				aria-label="About"
				title="About"
				href={resolve('/about')}
				aria-current={aboutHere ? 'page' : undefined}
				onclick={(e) => (aboutHere ? stayHere(e) : closeChromeModal())}
			>
				{@render aboutGlyph()}
			</a>
			<a
				class="chrome-btn"
				aria-label="Help"
				title="Help"
				href={resolve('/help')}
				aria-current={helpHere ? 'page' : undefined}
				onclick={(e) => (helpHere ? stayHere(e) : closeChromeModal())}
			>
				{@render helpGlyph()}
			</a>
		{/if}
		{#snippet rosterGlyph()}
			<!-- THE ROSTER (lineups design §11.6 item 1): the Library on its Roster
			     tab. Beside the cog because the roster belongs to the account, like
			     the settings, and reaches every tool. Below `roomy` it folds into
			     the compass with About and Help.

			     Artwork is Nate's, from assets-src/tools/character-{aether,lumine}.svg — the
			     game's Character button, the place a player sees what they own. Like
			     the compass it is a PORTRAIT mark (Aether 47:64, Lumine 51:58), and like the compass it
			     is NOT a disc with a hole: a silhouette in currentColor (so the
			     chrome's hover and state reach it) under two line-shading shapes,
			     linear gradients of translucent black that reproduce the game's
			     fading line art.
			     ⚠ The gradient ids are per INSTANCE (`$props.id()`): Affinity names
			     every export's gradients _Linear1/_Linear2 and an inlined SVG's ids
			     are global to the page, so a second chrome mid-transition — or any
			     other export — would hand this url(#…) the wrong gradient, or one
			     inside a display:none copy, which Chrome does not paint.
			     ⚠ fill-opacity="1" on the shading: .chrome-glyph's 0.85 inherits,
			     and the stops' alpha is the artwork's, not the hover state's.
			     The mark follows the travelerTwin store, like every Traveler
			     portrait on the site. -->
			{#if $travelerTwin === 'lumine'}
				<!-- Lumine, from assets-src/tools/character-lumine.svg (51:58): the silhouette and ONE hair-shading gradient. -->
				<svg
					class="chrome-glyph is-roster is-roster--lumine"
					viewBox="0 0 51 58"
					fill-rule="evenodd"
					aria-hidden="true"
					><defs
						><linearGradient
							id="{uid}-ros-hair"
							x1="0"
							y1="0"
							x2="1"
							y2="0"
							gradientUnits="userSpaceOnUse"
							gradientTransform="matrix(0,45.158914,-39.200477,0,27.476818,11.836501)"
							><stop offset="0" stop-color="#000" stop-opacity="0" /><stop
								offset="0.61"
								stop-color="#000"
								stop-opacity="0.66"
							/><stop offset="1" stop-color="#000" stop-opacity="0.31" /></linearGradient
						></defs
					><path
						d="M4.712,7.845C7.223,3.888 10.327,1.855 15.477,0.682C19.727,-0.287 26.353,-0.416 31.214,1.579C35.854,3.484 41.128,9.041 43.779,20.358C44.121,21.818 50.483,25.712 50.424,25.318L44.956,27.132L44.956,31.775C44.956,31.775 41.823,31.452 42.008,32.443C42.233,33.657 43.76,36.321 46.31,39.058C43.531,38.99 40.93,38.528 38.444,37.813L38.117,40.86C38.117,40.86 34.716,39.435 35.031,40.425C36.153,43.945 39.578,47.536 41.128,49.961C36.153,49.259 31.347,43.564 30.098,43.851C28.367,44.248 30.27,49.321 32.259,50.538C29.437,51.876 16.329,57.058 14.525,57.075C14.728,56.373 17.69,52.365 19.387,49.259C20.074,48.003 17.47,43.918 16.893,44.231C15.96,44.738 11.667,46.439 10.544,45.938C9.616,45.524 6.472,40.879 3.301,35.524C3.301,35.524 6.327,31.779 6.321,31.775C3.323,29.832 0.356,27.424 0.039,21.278C-0.361,13.546 2.412,11.471 4.712,7.845Z"
					/><path
						d="M4.771,30.701C5.574,28.535 6.721,23.72 5.514,14.689C5.372,13.632 5.257,13.002 5.195,12.612L5.136,12.277L5.151,12.274C5.135,12.069 5.166,11.99 5.261,11.921L5.26,11.911L5.27,11.915L5.317,11.886C5.473,11.796 5.664,11.835 5.779,11.957L5.803,11.964C5.819,11.97 5.98,12.205 7.118,13.421C10.224,16.742 16.337,22.766 17.728,28.87C18.64,32.87 17.252,35.589 16.016,37.194C17.803,36.955 18.816,36.176 19.921,34.815C20.4,34.226 21.262,34.61 21.249,35.277C21.248,35.326 21.004,37.075 20.186,38.69C20.047,38.964 19.903,39.212 19.758,39.438C23.89,38.421 30.531,36.026 31.171,29.73C31.249,28.96 31.418,28.863 32.707,28.874C34.097,28.885 34.31,28.957 37.133,29.144C33.301,25.907 33.544,22.238 32.028,18.062C31.457,16.492 30.87,15.651 30.867,15.627C30.842,15.423 30.926,15.216 30.901,15.013C31.075,15.123 31.303,15.127 31.477,15.237C31.622,15.33 32.177,16.45 32.231,16.559C34.442,21.021 33.832,26.025 39.006,29.173C39.012,29.177 39.614,29.415 39.553,29.891C39.52,30.142 39.298,30.386 38.975,30.378C37.721,30.346 36.569,30.274 35.52,30.215C37.02,31.148 39.358,32.414 42.301,33.345C42.481,33.767 42.733,34.259 43.055,34.8C40.35,33.946 37.195,32.519 33.991,30.139C33.421,30.119 32.889,30.112 32.395,30.13C32.382,30.252 32.365,30.38 32.345,30.514C33.356,31.89 35.718,34.98 39.541,38.11C39.173,38.016 38.807,37.917 38.444,37.813L38.347,38.719C35.584,36.188 33.662,33.737 32.141,31.539C31.895,32.509 31.445,33.656 30.593,34.834C31.282,35.785 33.004,38.017 35.468,40.076C35.14,40.063 34.945,40.152 35.031,40.425C35.161,40.833 35.323,41.243 35.508,41.651C33.833,40.228 31.925,38.23 30.092,35.473C29.632,36.016 29.081,36.56 28.418,37.092C28.729,38.34 29.341,41.057 30.479,43.896C30.329,43.844 30.202,43.827 30.098,43.851C29.745,43.932 29.543,44.208 29.462,44.606C29.22,44.087 28.998,43.571 28.794,43.065C28.651,45.803 28.045,49.228 26.36,52.926C26.346,52.957 26.332,52.988 26.318,53.018C25.89,53.188 25.453,53.359 25.012,53.531C28.001,46.814 27.414,40.419 27.07,38.053C25.624,38.97 23.783,39.82 21.437,40.522C21.153,41.739 20.466,44.319 19.106,47.16C18.901,46.671 18.637,46.171 18.36,45.726C19.022,44.53 19.823,42.87 20.51,40.784C19.785,40.978 19.015,41.158 18.199,41.323C18.194,41.324 17.363,41.635 16.998,41.091C16.85,40.871 16.76,40.414 17.163,40.079C18.051,39.34 18.629,38.638 19.073,37.582C17.975,38.263 16.414,38.833 14.355,38.673C13.739,38.626 13.473,37.911 13.899,37.472C15.501,35.82 17.546,33.285 16.432,28.756C16.137,28.758 15.241,28.644 15.146,28.632C10.379,28.027 8.205,25.384 7.026,22.004C7.145,25.263 6.939,28.714 5.983,31.554C5.575,31.284 5.168,31.002 4.771,30.701ZM6.118,13.529C7.273,20.359 7.861,26.972 15.963,27.238C15.211,25.194 13.858,22.793 11.654,19.956C9.885,17.677 7.429,14.991 6.118,13.529Z"
						fill="url(#{uid}-ros-hair)"
						fill-opacity="1"
					/></svg
				>
			{:else}
				<svg
					class="chrome-glyph is-roster"
					viewBox="0 0 47 64"
					fill-rule="evenodd"
					aria-hidden="true"
				>
					<defs>
						<linearGradient
							id="{uid}-ros-hair"
							x1="0"
							y1="0"
							x2="1"
							y2="0"
							gradientUnits="userSpaceOnUse"
							gradientTransform="matrix(0,37.107393,-35.53525,0,22.434811,19.238114)"
							><stop offset="0" stop-color="#000" stop-opacity="0" /><stop
								offset="0.64"
								stop-color="#000"
								stop-opacity="0.66"
							/><stop offset="1" stop-color="#000" stop-opacity="0.31" /></linearGradient
						>
						<linearGradient
							id="{uid}-ros-lapel"
							x1="0"
							y1="0"
							x2="1"
							y2="0"
							gradientUnits="userSpaceOnUse"
							gradientTransform="matrix(-12.83231,9.846156,-11.460507,-14.936263,24.886146,51.242753)"
							><stop offset="0" stop-color="#000" stop-opacity="0.66" /><stop
								offset="1"
								stop-color="#000"
								stop-opacity="0.31"
							/></linearGradient
						>
					</defs>
					<path
						d="M11.885,8.251C13.57,7.159 15.26,6.123 16.632,5.376C20.46,3.29 30.471,3.967 33.354,7.056C33.853,7.591 33.825,7.99 34.27,8.037C35.812,8.201 41.891,8.239 41.891,8.239C41.891,8.239 41.005,10.065 37.822,10.336C37.847,12.783 39.849,12.129 41.891,17.408C43.343,21.16 43.582,25.777 43.009,29.022C42.896,29.661 46.17,34.384 46.17,34.384C46.17,34.384 44.357,34.661 41.891,33.627C40.435,33.016 41.242,35.175 40.281,37.465C39.524,39.271 37.675,41.77 37.589,43.045C37.395,45.939 38.582,47.327 40.728,50.704L40.728,59.541C40.367,59.614 38.549,56.346 35.599,54.401C34.531,53.697 30.183,51.203 30.138,51.176C29.714,51.232 29.406,51.469 29.324,51.961C29.324,51.961 29.675,52.01 32.87,56.021C25.478,56.531 16.632,60.632 12.593,63.779C12.593,63.779 13.47,54.713 17.212,52.656C18.466,51.967 16.841,50.528 16.632,48.953C16.493,47.9 12.378,50.204 11.166,49.998C9.625,49.737 5.554,45.023 2.851,39.539C2.851,39.539 5.29,36.419 5.283,36.419C5.276,36.419 0,31.921 0,25.744C0,18.002 3.128,14.835 4.582,13.472C5.326,12.775 7.421,11.24 9.822,9.617C10.11,9.13 7.495,5.807 7.28,4.753C7.161,4.174 11.607,-1.519 19.168,0.39C19.168,0.39 13.506,1.515 11.488,3.862C10.566,4.934 10.263,8.215 11.885,8.251Z"
					/>
					<path
						d="M3.741,34.828L8.462,34.494C4.889,29.878 5.118,26.02 5.336,25.148L5.323,25.135L5.341,25.131C5.361,25.051 5.382,24.999 5.399,24.977C5.537,24.794 5.791,24.728 6.002,24.819C6.402,24.944 8.895,25.742 11.529,25.879C13.29,25.971 14.734,25.823 15.802,25.664C14.418,24.868 12.16,23.231 11.122,20.559C10.951,20.119 10.613,19.261 11.207,19.264C12.816,19.272 14.43,19.184 16.036,19.294C16.188,19.304 16.207,19.606 16.359,19.617L11.677,19.941C12.997,23.874 17.27,25.417 17.424,25.564C17.657,25.787 17.56,26.207 17.211,26.279C12.96,27.165 9.78,26.818 7.027,26.134C9.416,29.372 11.061,30.412 14.433,32.069C14.958,32.327 15.327,32.525 15.603,32.686C15.637,31.771 15.636,31.701 15.515,31.433C15.197,30.726 16.138,30.261 16.529,30.847C16.692,31.092 17.751,32.806 17.913,35.001C17.993,36.088 17.829,36.98 17.632,37.629C18.955,37.096 21.344,35.476 24.149,30.515C24.654,29.523 25.119,28.652 25.457,27.986C25.949,26.935 26.005,26.707 26.428,26.655C26.734,26.617 27.483,26.873 27.082,27.806C27.01,27.975 26.845,28.3 26.618,28.742C26.43,29.126 26.197,29.589 25.922,30.102C24.15,33.606 21.217,39.844 22.907,41.465C23.032,41.431 23.164,41.394 23.302,41.354C23.7,39.967 24.98,38.95 26.495,38.95C26.953,38.95 27.389,39.043 27.785,39.21C29.917,37.685 32.24,35.151 34.158,30.813C34.176,30.772 34.319,30.207 34.806,30.137C35.062,30.1 35.951,30.388 37.591,30.552C38.473,30.64 39.265,30.656 39.88,30.647C37.616,27.963 36.432,23.335 36.315,22.896C36.286,22.787 36.209,22.679 36.229,22.568C36.256,22.419 36.419,22.319 36.446,22.17C36.534,22.292 36.754,22.265 36.842,22.388C36.845,22.393 38.478,27.802 41.068,30.284C41.46,30.659 41.946,30.853 41.774,31.353C41.672,31.649 41.581,31.777 39.943,31.864C37.91,31.971 36.195,31.741 35.329,31.595C34.582,33.374 32.792,37.29 29.041,40.138C29.525,40.716 29.817,41.46 29.817,42.272C29.817,43.969 28.543,45.37 26.901,45.57C26.806,46.663 26.733,47.747 27.326,48.565C28.085,49.612 29.07,50.435 30.138,51.176C29.714,51.232 29.406,51.469 29.324,51.961C25.907,49.672 25.745,49.593 25.678,49.089C25.674,49.061 25.697,47.131 25.719,45.503C24.465,45.203 23.487,44.19 23.236,42.918L23.211,42.924C23.18,42.932 22.501,43.339 21.655,42.281C20.586,40.945 20.865,38.662 21.654,36.247C20.214,37.748 18.566,38.903 16.803,39.121C15.944,39.227 15.905,38.521 16.041,38.233C16.379,37.521 17.014,36.146 16.581,34.106C16.397,34.332 16.055,34.398 15.781,34.192C13.94,32.81 12.296,32.565 9.835,30.629C8.217,29.356 7.013,27.886 6.248,26.832C6.341,28.46 6.957,31.235 9.678,34.582C9.937,34.9 9.695,35.32 9.34,35.319L4.152,35.295C4.021,35.152 3.884,34.996 3.741,34.828ZM29.324,51.961C29.324,51.961 29.346,51.964 29.429,52.031C29.393,52.008 29.359,51.984 29.324,51.961ZM26.495,39.95C25.213,39.95 24.173,40.991 24.173,42.272C24.173,43.554 25.213,44.595 26.495,44.595C27.777,44.595 28.817,43.554 28.817,42.272C28.817,40.991 27.777,39.95 26.495,39.95Z"
						fill="url(#{uid}-ros-hair)"
						fill-opacity="1"
					/>
					<path
						d="M17.682,51.897C18.328,52.333 18.946,52.84 19.544,53.395C22.315,51.701 24.405,51.014 24.406,51.015C24.578,51.056 24.714,51.201 24.886,51.243C24.771,51.377 24.775,51.588 24.659,51.722C24.51,51.895 24.392,51.684 22.1,52.991C16.028,56.454 13.167,60.93 13.104,60.951C13.081,60.96 13.057,60.967 13.033,60.973C13.22,60.043 13.477,58.972 13.821,57.906C15.447,56.263 17.134,54.96 18.669,53.95C18.166,53.496 17.648,53.078 17.108,52.715C17.143,52.695 17.177,52.675 17.212,52.656C17.57,52.46 17.693,52.202 17.682,51.897Z"
						fill="url(#{uid}-ros-lapel)"
						fill-opacity="1"
					/>
				</svg>
			{/if}
		{/snippet}
		<!-- ⚓ ON EVERY SURFACE (Nate 2026-10-18). Inside a tool it opens the
		     Library OVER the tool — ⛔ never leave a tool mid-task. Anywhere else
		     no tool is mounted to host the overlay, so it is a plain LINK to the
		     /library page on its Roster tab: a page-to-page crossfade, ⛔ never
		     the tool ascend (/library is not a tool path). -->
		{#if roster.available}
			<button
				class="chrome-btn chrome-btn--roster"
				aria-label="Roster"
				title="Roster"
				onclick={roster.open}
			>
				{@render rosterGlyph()}
			</button>
		{:else}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- rosterHref IS resolve('/library') plus a query, which the rule cannot see through (chromeModal.svelte.ts) -->
			<a
				class="chrome-btn chrome-btn--roster"
				aria-label="Roster"
				title="Roster"
				href={rosterHref}
				onclick={closeChromeModal}
			>
				{@render rosterGlyph()}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
		<button
			class="chrome-btn chrome-btn--settings"
			aria-label="Settings"
			title="Settings"
			onclick={openSettings}
		>
			<!-- Two shapes, not one: the cog, plus a faint dark ring washed over it
			     at 15% that reads as a slight indentation (Nate's design). -->
			<svg class="chrome-glyph is-cog" viewBox="0 0 42 40" fill-rule="evenodd" aria-hidden="true"
				><path
					d="M137.6 90.83q2.52 4.32 5 8.66 1.14.6 2.22 1.29 5-.03 10-.01a32 32 0 0 1 6.6 11.44l-5 8.65q.06 1.3 0 2.57 2.52 4.32 5 8.66a32 32 0 0 1-6.6 11.44l-10-.01q-1.08.7-2.22 1.28-2.48 4.34-5 8.66a32 32 0 0 1-13.2 0q-2.52-4.31-5-8.66-1.14-.59-2.22-1.28-5 .02-10 0a32 32 0 0 1-6.6-11.43q2.5-4.35 5-8.66-.06-1.28 0-2.57l-5-8.65a32 32 0 0 1 6.6-11.44h10q1.08-.7 2.22-1.28 2.48-4.34 5-8.66a32 32 0 0 1 13.2 0m-6.6 17.23a14.1 14.1 0 1 1-.01 28.19 14.1 14.1 0 0 1 .01-28.19"
					transform="rotate(30 165.68 -71.11)scale(.65574)"
				/><path
					d="M257.06 109.7a12.46 12.46 0 1 1-.01 24.91 12.46 12.46 0 0 1 .01-24.92m0 1.43a11.02 11.02 0 1 0 .01 22.05 11.02 11.02 0 0 0 0-22.05"
					fill="#000"
					fill-opacity=".15"
					transform="translate(-247.6 -107.67)scale(1.04482)"
				/></svg
			>
		</button>
	</nav>
</header>

<style>
	/* Three tracks: brand left, center dead-center, actions right. The equal
	   1fr flanks keep the middle centered on the strip regardless of how wide
	   the brand or the action cluster get — and the center track holds its
	   column at zero width when a host passes no snippet, so the flanks stay
	   balanced on the landing too. */
	.site-chrome {
		position: relative;
		display: grid;
		/* ⚠⚠ THE FLANKS ARE `minmax(max-content, 1fr)`, NOT `1fr`, AND THAT ONE
		   WORD IS A BUG FIX (2026-09-04).

		   Plain `1fr` put the two occupants that must NEVER disappear on the
		   flexible tracks and the one that can safely collapse on the rigid
		   one — exactly backwards. On a tool route the centre `auto` track is
		   sized first, the action cluster's buttons carry `flex: none`, so the
		   entire shortfall landed on the brand; and because the logo is a
		   replaced element with a set height and `width: auto`, its min-content
		   contribution resolves to ZERO. Measured, the site's home link was
		   0px wide at 320 and 6px at 390 — it did not shrink gracefully, it
		   vanished. (⛔ `flex: none` on the image does nothing: the GRID TRACK
		   is what collapses, not the flex layout inside it.)

		   `max-content` as the track MINIMUM keeps the centring the comment
		   above argues for — both flanks still resolve to an equal `1fr`
		   whenever there is room — while refusing to crush either one when
		   there is not. Below 40rem the centre is empty anyway (the switcher
		   lives in the compass), so the crowded case no longer arises at all.
		   Measured + the rejected alternative: docs/rounds/responsive-survey-2026-09-01.md
		   § N1 and § 8.2. */
		grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr);
		align-items: center;
		gap: 0.9rem;
		height: var(--chrome-h);
		padding: 0 var(--site-pad-x);
		/* The strip passes clicks through; its children catch their own. Listed
		   per class rather than as `> *` because the center's CONTENTS belong to
		   another component's style scope — `> *` would not reach them, but the
		   wrapper we own does. */
		pointer-events: none;
	}

	.chrome-brand-group,
	.chrome-center,
	.chrome-actions {
		pointer-events: auto;
	}

	/* ⚠⚠ EACH CHILD NAMES ITS OWN COLUMN, AND THIS IS A BUG FIX (2026-09-04).
	   Auto-placement walks the children that EXIST, so the moment the compact
	   block below took .chrome-center out of the flow with `display: none`, the
	   action cluster became the second grid item and was placed in column 2 —
	   the centre track. `justify-self: end` then dutifully aligned it to the
	   right edge of THAT track, leaving it sitting against the wordmark with
	   50px of empty bar at 320 and 120px at 390. ⚓ Nate caught it in a phone
	   preview; the width sweep could not, because nothing overflowed and the
	   cluster's own box was the right size — it was simply in the wrong column.

	   Naming the columns makes the placement independent of how many children
	   happen to render, which is the property that was actually wanted here. */
	.chrome-brand-group {
		grid-column: 1;
		justify-self: start;
		display: flex;
		align-items: center;
		gap: 0.35rem; /* 🎛️ ⚓ NATE 2026-09-16 */
	}

	/* The tag hugs the wordmark's top-right like a superscript: in flow (so
	   the grid track reserves its width — an absolute tag would let the tool
	   switcher overlap it on a tight bar), lifted by `position: relative`,
	   which moves paint alone and keeps it off the transform-placed list.
	   Mono, bold, tracked at --ls-wider, the micro-label rung; the bar's one
	   gold (`--chrome-tag` — --accent is white in here) at the chrome's
	   resting alpha, full on hover: the chrome state contract.
	   ↻ A knockout PILL was tried between the two bare cuts (2026-09-16) and
	   Nate went back to the bare word. */
	.chrome-beta {
		position: relative;
		top: -0.5em; /* 🎛️ ⚓ NATE 2026-09-16 */
		/* ⚓ BODY, not mono (⚓ Nate 2026-09-21) — it is set as one voice with
		   the landing cards' kickers. ⚠ --fw-semibold is a REAL 600 on the
		   variable body face; this was --fw-bold on mono, where 700 folded to
		   that same 600 against a static cut. */
		font-family: var(--font-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		line-height: 1;
		color: var(--chrome-tag);
		text-decoration: none;
		opacity: 0.85;
		transition: opacity var(--t-quick);
	}

	.chrome-beta:hover,
	.chrome-beta:focus-visible {
		opacity: 1;
		outline: none;
	}

	.chrome-center {
		grid-column: 2;
	}

	.chrome-actions {
		grid-column: 3;
	}

	/* ══ THE BRAND IS ONE KNOB (⚓ NATE 2026-08-10) ═════════════════════════
	   The wordmark used to be an orphan literal (1.33rem) and the mark a second
	   one (2.09rem) tuned by eye against it, so the two could drift apart and
	   nothing would notice. They are now both derived from --brand-size, and
	   --brand-size IS --fs-4xl: ⚓ "unify Section headings and branding" — the
	   masthead and a section header are the same size, and gain or lose it
	   together.

	   ⚠ THE TWO RATIOS REPRODUCE NATE'S TUNING EXACTLY at the old brand size:
	   21.28 × 1.5714 = 33.44px (his 2.09rem) and 21.28 × −0.18 = −3.83px (his
	   −0.24em at a 16px root). They are his measurements re-expressed, not
	   re-derived — so the mark's proportion and optical lift survive the size
	   change instead of needing a fresh pass.
	   ⚠ The margin had to stop being `em`. On the <img> that resolved against
	   the INHERITED font-size, which is now the brand size — the lift would have
	   grown 50% on its own and pulled the mark off the baseline.

	   ⚠ Weight and tracking were ALREADY on tokens (--fw-medium / --ls-tight)
	   and are untouched: unifying the SIZE does not make the brand a heading. */
	.chrome-brand {
		--brand-size: var(--fs-4xl);
		/* The mark's height as a multiple of the wordmark — Nate's proportion. */
		--brand-mark: 1.5714;
		/* Optical lift, as a fraction of the brand size (was −0.24em). */
		--brand-lift: -0.18;
		justify-self: start;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: none;
		font-size: var(--brand-size);
	}

	/* Sized by HEIGHT, not width. The mark was redrawn for small sizes
	   (2026-07-28) and its box went from 4:3 to 1.6:1 — width-sizing would have
	   silently shortened it by 8px on a 64px strip. Height is what the strip
	   actually constrains, so it is the dimension that gets pinned; width
	   follows the artwork. ONE definition, so the brand can no longer shift as
	   you move landing → tool.

	   ⚠️ These two numbers ARE Nate's 2.2rem / -0.24em, converted. He tuned them
	   in devtools with `transform: rotate(7deg)`, where the element box stays the
	   UNROTATED ink box; the shipped file has the 7° lean baked into its path and
	   is cropped to the ROTATED ink, which for this mark is 0.95x as tall (the
	   lean brings its diagonals closer to the axes). Same rendered mark,
	   different box — so the height carries a x0.95 factor and the margin is
	   unchanged, the centring drift working out to 0.001em. `npm run build-logo`
	   prints that conversion on every run: if the art or the angle changes, read
	   it off there rather than re-deriving it here. */
	.chrome-brand img {
		height: calc(var(--brand-size) * var(--brand-mark));
		width: auto;
		margin-top: calc(var(--brand-size) * var(--brand-lift));
		opacity: 0.85;
		transition: opacity var(--t-quick);
	}

	/* The wordmark speaks --chrome (Genshin-UI archetype, Nate 2026-08-05:
	   site chrome + branding are pure white, the over-the-world voice). The
	   earlier gilt-hi/cool debate is superseded by the archetype. */
	.chrome-wordmark {
		font-family: var(--font-display);
		font-size: var(--brand-size);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-tight);
		color: var(--chrome);
		/* THE CHROME STATE CONTRACT (Nate 2026-08-05): every chrome mark rests
		   slightly translucent at 0.85 and hovers to opaque white — logo img,
		   wordmark, glyph cluster (fill-opacity, WebKit — see below) and the
		   tool switcher links (color-mix 85%, in the tools layout) all share
		   the same pair. Change one, change all.

		   ⚠ THE PAIR IS THE ALPHAS, AND ONLY THE ALPHAS. ⚓ Nate 2026-08-12: the
		   DURATION folded into --t-quick with the rest of the site's hover
		   states — this is a hover changing an alpha in place, which is that
		   band's whole job, and the private 200ms was never part of the
		   contract so much as beside it. The tell is that the four marks did
		   not even agree: the tool switcher links have been 150 all along. */
		opacity: 0.85;
		transition: opacity var(--t-quick);
	}

	/* Hover is opacity ALONE. This pair used to also carry a cool
	   drop-shadow halo; it was pretty, but a filter on a hovered element
	   forces its own compositing layer and re-rasterizes the mark on every
	   frame of the fade — over a bar that sits above the animated scene on
	   every route, Nate could feel it. Brightness reads the change on its
	   own and costs nothing. */
	.chrome-brand:hover img,
	.chrome-brand:focus-visible img {
		opacity: 1;
	}

	.chrome-brand:hover .chrome-wordmark,
	.chrome-brand:focus-visible .chrome-wordmark {
		opacity: 1;
	}

	.chrome-center {
		justify-self: center;
		display: flex;
		align-items: center;
	}

	.chrome-actions {
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	/* The button is now only a hit target — the glyph carries the whole mark, so
	   there is no background, no border and no second color. It rests at the
	   brand's 85% and hovers to full, exactly like the brand does and nothing
	   more, which is the point: the cluster stops being a separate visual
	   system in the corner. (The dimming itself is applied on .chrome-glyph
	   below, for WebKit reasons — see there.) Never resize on hover.
	   --chrome-glyph-size is the knob — all three marks share it, so the gear
	   silhouette and the two discs stay the same size as each other. */
	.chrome-btn {
		/* ↻ ⚓ NATE 2026-08-10: 28 → 30px. The type size-up moved every role up a
		   rung and the chrome glyphs were not part of it — they are geometry, not
		   type — so the corner cluster came out reading small beside a wordmark
		   that had grown to 24px. This is the rebalance, not a size change in its
		   own right. */
		--chrome-glyph-size: 30px;
		/* The click target, independent of the art — and it HAD to grow with the
		   glyph, per the note that used to stand here: the cog's box is 42:40, so
		   at 30px tall it is 31.5px WIDE and would have overflowed the old 30px
		   button. Raise this alongside the glyph size if it ever grows again. */
		width: 34px;
		height: 34px;
		flex: none;
		display: grid;
		place-items: center;
		padding: 0;
		border: none;
		background: none;
		color: var(--chrome);
		cursor: pointer;
	}

	/* ⚠️ The dimming lives on the GLYPH as fill-opacity, NOT on the button as
	   opacity — and it must stay there.

	   Element opacity below 1 makes WebKit render the subtree into a
	   transparency layer, and that layer is rasterized at ROUNDED device
	   coordinates. This cluster never sits on whole pixels: the 0.6rem gap is
	   9.6px, and .scene-chrome carries the cursor-parallax transform, so the
	   marks live at fractional x that changes as the pointer moves. Rounding a
	   moving fractional origin is a 1px horizontal jitter — which Nate saw on
	   the ⓘ, and only the ⓘ, because a single thin vertical stem is the one
	   shape in the cluster that makes a subpixel shift legible.

	   fill-opacity is a paint property on the shape. No transparency layer, no
	   promotion, no rounding — and it animates on the compositor's terms just
	   as smoothly. (The cog's dark inner ring carries its own fill-opacity as a
	   presentation attribute, so it keeps its 15% and is unaffected by this.)

	   Sized by HEIGHT with width following the artwork's own aspect, so each
	   file keeps the proportions it was drawn at (the cog's box is 42×40, the
	   discs' 40×40 — that extra width is side padding, not extra art).
	   Measured: at equal height all three paint the same 1:1 extent, so one
	   --chrome-glyph-size gives all three genuinely equal marks. If the cog ever
	   wants more reach to balance against the solid discs — its teeth have gaps
	   where the discs do not — override the variable on .is-cog alone. */
	.chrome-glyph,
	.chrome-glyph {
		display: block;
		height: var(--chrome-glyph-size);
		width: auto;
		fill: currentColor;
		fill-opacity: 0.85;
		transition: fill-opacity var(--t-quick);
	}

	.chrome-btn:hover .chrome-glyph,
	.chrome-btn:focus-visible .chrome-glyph,
	.chrome-btn[aria-current='page'] .chrome-glyph {
		fill-opacity: 1;
	}
	/* The page already showing (off a tool, About/Help link to their pages):
	   lit like the switcher's current link, and its click does nothing. */
	.chrome-btn[aria-current='page'] {
		cursor: default;
	}

	/* ⚠⚠ THE COMPASS'S SECOND TONE NEEDS NO CSS, AND THAT IS THE POINT.
	   ⚓ Nate 2026-09-04 redrew it the settings cog's way: the body is ONE
	   merged white shape (star points included) and the darker facets are
	   TRANSLUCENT BLACK washed over it, not an opaque grey beside it. A wash
	   darkens whatever is under it proportionally, so the facets hold their
	   ratio to the body automatically at rest AND on hover. That retired a
	   two-state alpha pair that stood here while the greys were opaque — and
	   with it the hazard the pair existed to dodge, that a child path does not
	   inherit its parent's transition and would have SNAPPED while the body
	   eased. One mark, one fill-opacity, exactly like the other three.

	   ⚠ The washes carry an explicit fill="#000" IN THE MARKUP, and it is not
	   redundant: the source file states only `fill-opacity`, which is black
	   standalone (SVG's initial fill) but INHERITS .chrome-glyph's
	   `fill: currentColor` once inlined — translucent WHITE on the chrome,
	   which would lighten the facets into the body instead of darkening them. */

	/* The compass is the NARROW form of the whole navigation; above the compact
	   breakpoint the switcher is in the centre and the three glyphs are on the
	   right, so a fourth control reaching the same places would be redundant. */
	.chrome-btn--nav {
		display: none;
		/* 🎛️ 30 → 33px, AND IT OVERRIDES RATHER THAN MOVING THE SHARED KNOB.
		   --chrome-glyph-size is documented as the one number all the marks
		   share so the gear and the two discs stay the same size as each other;
		   raising it there would have resized About and Help too, for a reason
		   that is the compass's alone.

		   ⚓ NATE 2026-09-04 read it as small beside the cog and put it at 32–33
		   in the inspector. Measured, he is reading something real and HEIGHT IS
		   THE WRONG FRAMING for this mark: rasterised at a 200px reference,
		   the compass's top 41 of 197 rows — the hanging loop and the star
		   points — carry less than half its peak ink, while the cog is dense
		   from row 9 to row 190. So equal HEIGHT hands the compass ~21% of its
		   box as ornament and the cog almost none, and it reads smaller.
		   Matching INK AREA instead gives 34.0px; matching the dense body alone
		   gives 37.1px and overshoots, because the loop still reads as part of
		   the mark. 33 is Nate's eye at the top of its range and just under
		   ink-parity, which is where a sparse-topped mark tends to land.

		   ⚠ At 53:62 this is 28.2px WIDE, inside the 34px button. That button is
		   the ceiling: the glyph cannot grow past 34 without the box growing
		   with it (the same tax the cog's 42:40 note records). */
		--chrome-glyph-size: 33px;
	}

	/* 🎛️ THE ROSTER MARK IS SIZED BY VISUAL WEIGHT, ⚓ Nate 2026-10-11 — the
	   compass's method, and the compass's answer. Measured as luminous ink per
	   height² (rasterised at 400px, the shading counted against it): About and
	   Help 0.71, the cog 0.56, the compass 0.431 and Aether 0.433 — so this mark
	   is as sparse as the compass, and lands where it did. Ink parity with the
	   cog is 34.2px; with the discs 38.6, past the 34px button that is the
	   ceiling. 33 sits just under cog parity, where Nate put the compass, and
	   makes the two portrait marks one size.
	   ↻ ⚓ NATE 2026-10-11, by eye: 34 — the button's ceiling (25px wide at
	   47:64), so the mark cannot grow again without the box growing with it. */
	.chrome-btn--roster {
		--chrome-glyph-size: 34px;
	}
	/* 🎛️ OPTICAL NUDGE, ⚓ Nate 2026-10-11 — 1px right, by eye. The profile
	   faces left, so its ink sits left of its box's centre. `position:
	   relative`, not a transform or a margin, for the compass lift's reasons
	   below: paint moves by a whole pixel and nothing becomes transform-placed. */
	.chrome-btn--roster .chrome-glyph {
		position: relative;
		left: 1px;
	}
	/* 🎛️ LUMINE IS ALIGNED TO AETHER BY THE FACE, ⚓ Nate 2026-10-11 ("align
	   their faces/chins"). Both profiles are built on the same two points,
	   read from the path data: the nose tip and the chin — Aether (2.85, 39.54)
	   → (11.17, 50.00), 13.36 units; Lumine (3.30, 35.52) → (10.54, 45.94),
	   12.68 units. Her face matches his 7.10px at 32.5px tall; 32 keeps the
	   mark on whole pixels (the face 1.5% smaller). Centred at 32 her chin
	   falls 2.7px left of his — 3px by the math — and ↻ ⚓ Nate set 2px by
	   eye, which splits the chin and the nose (her face is a shade shorter
	   than his, so no one shift lands both). It also answers her
	   weight: at Aether's 34px she carried 17% more ink; at 32, 4%. */
	.chrome-btn--roster .is-roster--lumine {
		height: 32px;
		left: 2px;
	}

	/* 🎛️ OPTICAL LIFT, ⚓ NATE 2026-09-04 — 1px, by eye, and it is the same
	   correction the brand mark carries as --brand-lift. The compass's visual
	   centre is not its geometric one: the hanging loop puts ink at the top
	   that the disc does not balance below, so a box-centred mark sits low
	   beside the cog. Centring centres the BOX, never the INK (/styleguide
	   § Laws).

	   ↻ It shipped at 2px for one commit, from a value trialled in the
	   inspector. ⚠ THE LIKELY TRAP, worth knowing before trialling the next
	   one: a transform applied INSIDE the svg moves in VIEWBOX UNITS, not CSS
	   pixels — at viewBox 0 0 53 62 rendered 33px tall, "2px" there is
	   2 × 33/62 = 1.06 CSS px, which is this value. A nudge tried on the inner
	   geometry and a nudge applied to the element are different measurements.

	   ⚠ `position: relative`, not a transform and not a margin. A margin would
	   be re-split by the button's `place-items: center` and move the glyph only
	   half as far; a transform would make the mark transform-placed, which is
	   the condition the sub-pixel law cares about. This shifts paint alone, by
	   a whole pixel, and takes the layout with it nowhere. */
	.chrome-btn--nav .chrome-glyph {
		position: relative;
		top: -1px;
	}

	/* Narrow viewports: the wordmark is the first thing to go — the logo alone
	   still reads as the brand and still returns home, which buys the switcher
	   and the glyph cluster the room they need. 40rem is where measurement put
	   the squeeze: at 640px the tool switcher had ~15px of clearance from the
	   brand, and below that they touch. The switcher's own gap tightens in the
	   tools layout at the same breakpoint (it owns that markup, so it owns that
	   rule). First pass only; a full mobile pass across the tools is its own
	   job. */
	/* ══ THE COMPACT SWAP (2026-09-04) ═══════════════════════════════════════
	   Below 40rem the bar keeps its IDENTITY and folds its NAVIGATION, which is
	   the reverse of what it used to do.

	   It used to drop the wordmark here and keep three glyphs plus the tool
	   switcher. That was the wrong half to give up: measured, the remaining
	   occupants still needed ~400px in a 320px bar, so the deficit fell on the
	   logo and the home link disappeared entirely (see the grid block above).
	   Folding all navigation into the compass costs one control and buys 121px,
	   which is what lets `critcalc.app` stay readable on a phone.

	   ⚠⚠ THE SWITCH IS AT 47.5rem, NOT THE 40rem THIS BAR USED TO USE, AND THE
	   OLD NUMBER WAS MEASURABLY WRONG FOR IT. 40rem was tuned for a bar that
	   DROPPED the wordmark, which needs only ~460px. Keeping the wordmark means
	   the full form needs padding 32 + brand 204 + gaps 28.8 + nav 274 + glyphs
	   126 = 664.8px — so at 641–672 the bar was over-subscribed and the
	   Settings glyph ran 8px off the right edge. Measured after the swap, which
	   is the only reason it was caught: the fix for the 320px end moved the
	   crowding up rather than removing it.

	   ⛔ 42rem (672px) would be the tight fit and is deliberately NOT used: it
	   would be a brand-new threshold, and the survey's § 5 argues this set must
	   shrink rather than grow (AtlasView's stray 620px, 20px off the chrome's
	   own stop, was the cautionary case — absorbed into `compact` 2026-09-22).
	   47.5rem is already in the codebase —
	   HelpAreaShell's — and clears the requirement by ~95px.

	   ⚠ ChromeOverlay's own 40rem block is a DIFFERENT concern (overlay
	   padding) and is untouched. */
	@media (max-width: 47.5rem) {
		.site-chrome {
			gap: 0.5rem;
			/* ⚠ 0.75rem → 0.5rem, and it is not a taste change: with the cog kept
			   beside the compass the bar needs 318.8px of a 320px viewport, and
			   1.2px of slack is not slack. The wordmark is set in --font-display,
			   a WEBFONT — if it ever falls back to a wider face, a bar that fit
			   by a pixel stops fitting. 8px of edge padding buys 8px of margin
			   for that, and 320 is the floor being protected (iPhone SE and the
			   older small Androids; 375 has 56px spare either way). */
			padding: 0 0.5rem;
		}

		/* The host's centre snippet — the tool switcher — is reachable from the
		   compass instead. ⚠ Hidden HERE rather than in the tools layout: the
		   track has to collapse on every surface, and only this component owns
		   one on all of them. */
		.chrome-center {
			display: none;
		}

		.chrome-btn--nav {
			display: grid;
		}

		/* ⚓ NATE 2026-09-04: THE COG STAYS OUT. About and Help are things you go
		   and READ — they belong behind the compass with every other
		   destination. Settings is a thing you REACH FOR mid-task, and burying
		   a control you toggle behind a navigation panel makes it feel further
		   away than it is. Two buttons at 320px is 318.8px of demand in a 320px
		   bar, so it is affordable — but only just, which is why the padding
		   below buys headroom rather than trusting 1.2px. */
		.chrome-btn:not(.chrome-btn--nav, .chrome-btn--settings) {
			display: none;
		}

		.chrome-actions {
			gap: 0.4rem;
		}
	}

	/* (A reduced-motion block for the three chrome marks stood here. Retired
	   2026-08-12 with the fold onto --t-quick — the band is zeroed at :root
	   under the same query. See app.css § MOTION.) */

	/* `compact` — 40rem, $lib/breakpoints.ts (the literal is written because
	   custom properties do not work in media queries). The 320px bar fits its
	   occupants with 1.2px to spare, so the tag is the one thing this form
	   sheds: the wordmark stays, the tag goes. */
	@media (max-width: 40rem) {
		.chrome-beta {
			display: none;
		}
	}
</style>
