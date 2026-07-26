<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { openArea, openSettings } from './chromeModal.svelte';
	import { defaultChapter, helpChapterForPath } from '$lib/help/areas';
	import { page } from '$app/state';

	// THE site chrome — one bar on every surface. Brand left, a host-supplied
	// centre, three meta glyphs right; identical pixels on the landing, the
	// content pages and inside a tool.
	//
	// The centre is a snippet rather than a prop because only the tools have
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
		center,
		onBrandClick
	}: {
		center?: Snippet;
		/** Tools pass their reverse-portal handler; elsewhere the brand is a plain link. */
		onBrandClick?: (event: MouseEvent) => void;
	} = $props();

	// The "?" is contextual: inside a tool it opens that tool's chapter, and
	// anywhere else the general FAQ.
	const helpChapter = $derived(helpChapterForPath(page.url.pathname));
</script>

<header class="site-chrome">
	<a class="chrome-brand" href={resolve('/')} onclick={onBrandClick} aria-label="critcalc.app home">
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
	     and the marks take their colour from the chrome via fill: currentColor.

	     ⚠️ Keep every mark GEOMETRY — paths and shapes, never <text>. An earlier
	     pass set the letters with dominant-baseline: central and produced two
	     WebKit-only faults Nate caught in Safari: glyphs sitting high in their
	     circles, and the mark lifting ~1px on hover, because WebKit
	     re-rasterizes text down a different path once a filter (the hover halo)
	     applies. Drawn shapes centre identically in both engines and hold still
	     under the halo. -->
	<nav class="chrome-actions" aria-label="Site">
		<button
			class="chrome-btn"
			aria-label="About critcalc"
			title="About"
			onclick={() => openArea('about', defaultChapter('about'))}
		>
			<svg class="chrome-glyph" viewBox="0 0 40 40" fill-rule="evenodd" aria-hidden="true"
				><path
					d="M241.24 88.27a20.87 20.87 0 0 1 0 41.72 20.87 20.87 0 0 1 0-41.72m1.12 16.16h-.24q-2.45 0-4.49.68c-.85.3-1.22.8-1.22 1.42 0 .58.37 1.13 1.24 1.54q.69.31.84.75.16.6.16 3.93 0 3.36-.2 4.16-.18.7-.9 1.4c-.67.67-.96 1.28-.96 1.76 0 .68.3 1.06.81 1.2q.45.14 2.74.14h1.55q3 0 3.9-.31.38-.14.53-.3l.14-.21.05-.14.01-.14v-.2l-.04-.23-.12-.25q-.2-.35-.9-1.08a4 4 0 0 1-1-1.6q-.2-.82-.2-5.73 0-5.1-.1-5.56a1.4 1.4 0 0 0-.55-.93q-.37-.3-1.05-.3m-4.85-4.88v.41l.02.17v.09q.03 1.03.94 1.83.87.77 2.09.77h.5q1.2 0 2.2-.84c.73-.62 1.05-1.28 1.05-1.93l.01-.09.02-.16v-.42q.02-.87-.8-1.84a2.5 2.5 0 0 0-1.97-.98q-.1 0-.26-.03l-.15-.01h-.52q-1.14 0-2.12.84-1.01.9-1.01 2.19"
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
					d="M241.24 88.27a20.87 20.87 0 0 1 0 41.72 20.87 20.87 0 0 1 0-41.72m2.94 30.16v.03-.06zl.02-.13v-.07q0-1.34-1.03-2.2a3.3 3.3 0 0 0-2.2-.83h-.34l-.25.03q-1.25.02-2.14 1.01-.88 1-.87 2v.16q0 1.2.95 2.11.93.9 2.38.9h.08l.47-.04q1.05-.02 2-.9a2.8 2.8 0 0 0 .93-2v-.04m-10-17.4c0 .88.29 1.47.72 1.82q.48.4 1.28.41 1.58.02 2.74-1.47.62-.84 1.48-.86.9 0 1.49.45.51.41.5 1.19 0 .94-.42 1.66-.49.82-1.6 2-1.28 1.35-1.53 1.75-.8 1.2-.79 2.54 0 1.31.5 2.32c.45.93 1.09 1.3 1.75 1.3.9 0 1.51-.23 1.87-.56q.49-.44.5-1.17-.02-1.32.55-2.15.3-.43 2.17-2.07 2.92-2.59 2.9-5.39 0-2.86-2.23-4.6a8.5 8.5 0 0 0-5.39-1.68q-3.25.01-5.17 1.44a3.3 3.3 0 0 0-1.31 2.8z"
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
	/* Three tracks: brand left, centre dead-centre, actions right. The equal
	   1fr flanks keep the middle centred on the strip regardless of how wide
	   the brand or the action cluster get — and the centre track holds its
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
		   per class rather than as `> *` because the centre's CONTENTS belong to
		   another component's style scope — `> *` would not reach them, but the
		   wrapper we own does. */
		pointer-events: none;
	}

	.chrome-brand,
	.chrome-center,
	.chrome-actions {
		pointer-events: auto;
	}

	.chrome-brand {
		justify-self: start;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: none;
	}

	/* Brand scale is the midpoint of the two bars this replaced (tool 3.4rem /
	   site 4.25rem logo), sized against the 64px strip. ONE definition now, so
	   the wordmark can no longer shift as you move landing → tool. */
	.chrome-brand img {
		width: 3.85rem;
		height: auto;
		/* Optical centring against the wordmark, not geometric: the mark's
		   visual mass sits low, so it rides up. */
		margin-top: -0.285em;
		opacity: 0.85;
		transition:
			opacity 200ms ease,
			filter 200ms ease;
	}

	.chrome-wordmark {
		font-family: var(--font-display);
		font-size: 1.33rem;
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-tight);
		color: var(--text);
		opacity: 0.9;
		transition: opacity 200ms ease;
	}

	.chrome-brand:hover img,
	.chrome-brand:focus-visible img {
		opacity: 1;
		filter: drop-shadow(0 0 8px rgba(108, 181, 255, 0.45));
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
		gap: 0.6rem;
	}

	/* The button is now only a hit target — the glyph carries the whole mark, so
	   there is no background, no border and no second colour. It rests at the
	   brand's opacity and hovers exactly like the brand does (full opacity plus
	   the same cool halo), which is the point: the cluster stops being a
	   separate visual system in the corner. Never resize on hover.
	   --chrome-glyph-size is the knob — all three marks share it, so the gear
	   silhouette and the two discs stay the same size as each other. */
	.chrome-btn {
		--chrome-glyph-size: 28px;
		/* The click target, independent of the art. At 28px the marks all but
		   fill it (the cog is widest at 29.4px), so raise this alongside the
		   glyph size if it ever grows again. */
		width: 30px;
		height: 30px;
		flex: none;
		display: grid;
		place-items: center;
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		opacity: 0.85;
		cursor: pointer;
		transition:
			opacity 200ms ease,
			filter 200ms ease;
	}

	.chrome-btn:hover,
	.chrome-btn:focus-visible {
		opacity: 1;
		filter: drop-shadow(0 0 8px rgba(108, 181, 255, 0.45));
	}

	/* Sized by HEIGHT with width following the artwork's own aspect, so each
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

	@media (prefers-reduced-motion: reduce) {
		.chrome-brand img,
		.chrome-wordmark,
		.chrome-btn {
			transition: none;
		}
	}
</style>
