<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { openArea, openSettings } from './chromeModal.svelte';
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
		grid-template-columns: 1fr auto 1fr;
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
	.chrome-glyph {
		display: block;
		height: var(--chrome-glyph-size);
		width: auto;
		fill: currentColor;
		fill-opacity: 0.85;
		transition: fill-opacity var(--t-quick);
	}

	.chrome-btn:hover .chrome-glyph,
	.chrome-btn:focus-visible .chrome-glyph {
		fill-opacity: 1;
	}

	/* Narrow viewports: the wordmark is the first thing to go — the logo alone
	   still reads as the brand and still returns home, which buys the switcher
	   and the glyph cluster the room they need. 40rem is where measurement put
	   the squeeze: at 640px the tool switcher had ~15px of clearance from the
	   brand, and below that they touch. The switcher's own gap tightens in the
	   tools layout at the same breakpoint (it owns that markup, so it owns that
	   rule). First pass only; a full mobile pass across the tools is its own
	   job. */
	@media (max-width: 40rem) {
		.site-chrome {
			gap: 0.5rem;
			padding: 0 0.75rem;
		}

		.chrome-wordmark {
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
