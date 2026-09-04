<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { openArea, openNav, openSettings } from './chromeModal.svelte';
	import { defaultChapter, helpChapterForPath } from '$lib/help/areas';
	import { page } from '$app/state';

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
</script>

<header class="site-chrome">
	<a class="chrome-brand" href={resolve('/')} aria-label="critcalc.app home">
		<img src="/critcalc-logo-white.svg" alt="" />
		<span class="chrome-wordmark">critcalc.app</span>
	</a>

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
	<nav class="chrome-actions" aria-label="Site">
		<!-- THE COMPASS — every destination on the site, in one control.

		     ⚠ It is NARROW-ONLY, and the pairing is the whole design: below
		     40rem this appears and the three meta glyphs AND the centre tool
		     switcher all leave, because the bar physically cannot hold them
		     beside a wordmark. Measured, at 320px: brand 204.6 + padding 24 +
		     track gaps 16 + three 34px glyphs = 399.8 in a 320px bar, versus
		     278.6 with one. That 41px of slack is what lets `critcalc.app`
		     survive on a phone instead of the logo silently collapsing to 0px,
		     which is what it did before this round.
		     Derivation: docs/responsive-survey-2026-09-01.md § 8.2.

		     Artwork is Nate's, from assets-src/tools/navigation.svg — Genshin's
		     own compass, chosen because it is the shape a player already reads
		     as "where can I go". ⚠ Unlike the other three it is NOT a disc with
		     a hole: it is a 53:62 PORTRAIT mark in three paths, so it sizes to
		     25.6px wide at the shared 30px glyph height and cannot overflow the
		     34px button. -->
		<button class="chrome-btn chrome-btn--nav" aria-label="Go to" title="Go to" onclick={openNav}>
			<svg
				class="chrome-glyph is-compass"
				viewBox="0 0 53 62"
				fill-rule="evenodd"
				aria-hidden="true"
				><path
					d="M26.001,2.767C20.976,2.769 19.892,4.244 20.249,4.818C20.466,5.167 21.671,5.888 23.704,6.227L23.407,7.016C23.37,7.115 23.317,7.208 23.252,7.291C20.576,6.838 18.417,5.815 17.643,4.973C15.91,3.089 19.03,-0 26.011,0C32.992,0 36.112,3.089 34.38,4.973C33.605,5.815 31.446,6.838 28.771,7.291C28.705,7.208 28.653,7.115 28.615,7.016L28.318,6.227C30.352,5.888 31.556,5.167 31.773,4.818C32.131,4.244 31.046,2.769 26.022,2.767L27.746,7.343C27.844,7.603 27.996,7.84 28.193,8.036C28.39,8.233 28.626,8.385 28.886,8.483L33.489,10.218L28.886,11.953C28.626,12.051 28.39,12.203 28.193,12.4C27.996,12.596 27.844,12.833 27.746,13.093L26.952,16.831C26.841,16.829 26.123,16.807 26.011,16.807C25.9,16.807 25.182,16.829 25.071,16.831L24.277,13.093C24.179,12.833 24.026,12.596 23.83,12.4C23.633,12.203 23.397,12.051 23.136,11.953L18.533,10.218L23.136,8.483C23.397,8.385 23.633,8.233 23.83,8.036C24.026,7.84 24.179,7.603 24.277,7.343L26.001,2.767ZM5.152,50.671C1.916,46.335 -0,40.958 -0,35.137C-0,23.898 7.143,14.315 17.132,10.683L22.809,12.822C22.945,12.873 23.069,12.953 23.173,13.057C23.276,13.16 23.356,13.284 23.407,13.42L24.094,16.874C14.589,17.547 7.682,25.461 7.682,35.137C7.682,37.922 8.305,40.563 9.418,42.928C8.078,45.404 6.523,48.214 5.152,50.671ZM34.026,18.423C32.166,17.568 30.116,17.029 27.928,16.874L28.615,13.42C28.667,13.284 28.747,13.16 28.85,13.057C28.953,12.953 29.077,12.873 29.214,12.822L34.891,10.683C37.294,11.556 39.532,12.775 41.546,14.277C39.162,15.607 36.446,17.11 34.026,18.423ZM46.87,19.602C50.106,23.938 52.023,29.315 52.023,35.137C52.023,49.493 40.367,61.148 26.011,61.148C20.19,61.148 14.813,59.231 10.477,55.996C12.934,54.625 15.744,53.07 18.219,51.729C20.585,52.843 23.226,53.466 26.011,53.466C36.127,53.466 44.34,45.253 44.34,35.137C44.34,32.302 43.748,29.618 42.67,27.223C43.995,24.778 45.522,22.019 46.87,19.602ZM48.831,12.317C48.831,12.317 40.978,26.18 38.445,31.254C36.589,34.973 33.633,42.759 33.633,42.759C33.633,42.759 25.848,45.714 22.128,47.571C17.055,50.104 3.191,57.956 3.191,57.956C3.191,57.956 11.044,44.093 13.577,39.019C15.434,35.3 18.389,27.514 18.389,27.514C18.389,27.514 26.175,24.559 29.894,22.703C34.968,20.17 48.831,12.317 48.831,12.317Z"
				/><path
					class="glyph-dim"
					d="M12.021,37.975L7.706,36.077C7.69,35.765 7.682,35.452 7.682,35.137C7.682,34.821 7.69,34.508 7.706,34.196L15.041,30.97C14.11,33.291 12.943,36.093 12.021,37.975ZM21.845,24.166L25.071,16.831C25.382,16.815 25.696,16.807 26.011,16.807C26.327,16.807 26.64,16.815 26.952,16.831L28.849,21.147C26.968,22.069 24.166,23.235 21.845,24.166ZM40.001,32.298L44.317,34.196C44.333,34.508 44.34,34.821 44.34,35.137C44.34,35.452 44.333,35.765 44.317,36.077L36.982,39.303C37.913,36.982 39.079,34.18 40.001,32.298ZM30.177,46.107L26.952,53.442C26.64,53.458 26.327,53.466 26.011,53.466C25.696,53.466 25.382,53.458 25.071,53.442L23.173,49.127C25.054,48.204 27.857,47.038 30.177,46.107Z"
				/><path
					class="glyph-dim"
					d="M34.882,26.266C34.882,26.266 31.829,31.655 30.845,33.627C30.123,35.073 28.974,38.099 28.974,38.099C28.974,38.099 25.948,39.248 24.502,39.97C22.53,40.954 17.141,44.007 17.141,44.007C17.141,44.007 20.193,38.618 21.178,36.646C21.9,35.2 23.048,32.174 23.048,32.174C23.048,32.174 26.075,31.025 27.521,30.303C29.493,29.319 34.882,26.266 34.882,26.266ZM30.999,30.149C29.899,30.752 28.854,31.314 28.191,31.645C27.117,32.181 25.197,32.947 24.208,33.333C23.822,34.322 23.056,36.242 22.52,37.316C22.189,37.979 21.627,39.024 21.024,40.124C22.124,39.521 23.169,38.959 23.832,38.628C24.906,38.092 26.825,37.326 27.814,36.94C28.201,35.951 28.966,34.031 29.503,32.957C29.834,32.294 30.396,31.249 30.999,30.149Z"
				/></svg
			>
		</button>
		<button
			class="chrome-btn"
			aria-label="About critcalc"
			title="About"
			onclick={() => openArea('about', defaultChapter('about'))}
		>
			<svg class="chrome-glyph" viewBox="0 0 40 40" fill-rule="evenodd" aria-hidden="true"
				><path
					d="M241.24 88.27a20.87 20.87 0 0 1 0 41.72 20.87 20.87 0 0 1 0-41.72m2.07 13.38q0-.54-.5-1.13-.51-.6-1.19-.6l-.31-.04h-.4a2 2 0 0 0-1.34.54q-.62.55-.62 1.36v.36l.02.1q0 .63.57 1.13.55.48 1.31.48h.39q.77 0 1.4-.53.66-.57.65-1.16l.02-.15zm-1.5 3.93q-1.84 0-3.34.5-.8.3-.78.88-.02.58.81.99.63.29.75.7.14.45.13 3.04 0 2.6-.16 3.2-.15.6-.72 1.16-.7.7-.68 1.2.01.58.47.7.34.1 2.02.1h1.17q2.23 0 2.9-.22a1 1 0 0 0 .31-.18l.04-.05.03-.05.02-.06v-.21l-.08-.26q-.15-.26-.66-.8a3 3 0 0 1-.81-1.29q-.16-.65-.16-4.4a63 63 0 0 0-.07-4.19 1 1 0 0 0-.33-.57 1 1 0 0 0-.68-.19z"
					transform="translate(-211.3 -84.63)scale(.9588)"
				/></svg
			>
		</button>
		<button
			class="chrome-btn"
			aria-label="Help"
			title="Help"
			onclick={() => openArea('help', helpChapter)}
		>
			<svg class="chrome-glyph" viewBox="0 0 40 40" fill-rule="evenodd" aria-hidden="true"
				><path
					d="M241.24 88.27a20.87 20.87 0 0 1 0 41.72 20.87 20.87 0 0 1 0-41.72m-2.73 28.11q0 .8.6 1.4t1.51.6h.07l.33-.04q.66 0 1.25-.6.6-.59.6-1.35v-.14q0-.88-.64-1.45-.63-.56-1.4-.56h-.29l-.12.03q-.79 0-1.35.66t-.56 1.33zm-2.22-13.3q.01.8.4 1.12.26.24.71.24 1.01 0 1.75-1 .6-.86 1.45-.86t1.4.45q.52.45.52 1.26 0 .86-.37 1.52a10 10 0 0 1-1.28 1.67q-.92 1.03-1.1 1.33a3.3 3.3 0 0 0-.54 1.8q0 .96.34 1.68.38.81.96.8c.94 0 1.38-.35 1.38-.96q0-1.2.49-1.94.23-.35 1.72-1.72 2.06-1.92 2.06-4t-1.54-3.34a5.8 5.8 0 0 0-3.83-1.25q-2.31 0-3.68 1.07-.83.64-.84 1.9z"
					transform="translate(-211.3 -84.63)scale(.9588)"
				/></svg
			>
		</button>
		<button class="chrome-btn" aria-label="Settings" title="Settings" onclick={openSettings}>
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
		   Measured + the rejected alternative: docs/responsive-survey-2026-09-01.md
		   § N1 and § 8.2. */
		grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr);
		align-items: center;
		gap: 0.9rem;
		height: var(--chrome-h);
		padding: 0 clamp(1rem, 2vw, 2rem);
		/* The strip passes clicks through; its children catch their own. Listed
		   per class rather than as `> *` because the center's CONTENTS belong to
		   another component's style scope — `> *` would not reach them, but the
		   wrapper we own does. */
		pointer-events: none;
	}

	.chrome-brand,
	.chrome-center,
	.chrome-actions {
		pointer-events: auto;
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
	.chrome-glyph .glyph-dim {
		/* ⚠ STATED FOR BOTH, once. A child path does not inherit its parent's
		   transition — the same trap the bench card's ::before extension hit
		   (BenchBand.svelte) — so leaving this on .chrome-glyph alone would
		   ease the compass's body while its two dim paths SNAPPED. */
		transition: fill-opacity var(--t-quick);
	}

	.chrome-glyph {
		display: block;
		height: var(--chrome-glyph-size);
		width: auto;
		fill: currentColor;
		fill-opacity: 0.85;
	}

	.chrome-btn:hover .chrome-glyph,
	.chrome-btn:focus-visible .chrome-glyph {
		fill-opacity: 1;
	}

	/* THE COMPASS'S SECOND TONE. Nate's artwork paints these two paths at
	   rgb(179,179,179) against a white body — a 0.702 ratio, not an absolute
	   colour. Restated as paint alpha at BOTH chrome states so the mark keeps
	   the cluster's rest/hover contract (0.85 → 1, "change one, change all")
	   instead of pinning itself to one of them: a hard fill-opacity here would
	   have made the compass the only glyph that does not brighten on hover.
	   ⛔ NOT a wrapping <g opacity>, which would multiply correctly but breaks
	   the sub-pixel law — alpha belongs in the paint (/styleguide § Laws). */
	.chrome-glyph .glyph-dim {
		fill-opacity: 0.597; /* 0.85 × 0.702 */
	}

	.chrome-btn:hover .chrome-glyph .glyph-dim,
	.chrome-btn:focus-visible .chrome-glyph .glyph-dim {
		fill-opacity: 0.702; /* 1 × 0.702 */
	}

	/* The compass is the NARROW form of the whole navigation; above the compact
	   breakpoint the switcher is in the centre and the three glyphs are on the
	   right, so a fourth control reaching the same places would be redundant. */
	.chrome-btn--nav {
		display: none;
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
	   own stop, is the cautionary case). 47.5rem is already in the codebase —
	   HelpAreaShell's — and clears the requirement by ~95px.

	   ⚠ ChromeOverlay's own 40rem block is a DIFFERENT concern (overlay
	   padding) and is untouched. */
	@media (max-width: 47.5rem) {
		.site-chrome {
			gap: 0.5rem;
			padding: 0 0.75rem;
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

		/* About / Help / Settings — all three live in the compass panel now. */
		.chrome-btn:not(.chrome-btn--nav) {
			display: none;
		}

		.chrome-actions {
			gap: 0.4rem;
		}
	}

	/* (A reduced-motion block for the three chrome marks stood here. Retired
	   2026-08-12 with the fold onto --t-quick — the band is zeroed at :root
	   under the same query. See app.css § MOTION.) */
</style>
