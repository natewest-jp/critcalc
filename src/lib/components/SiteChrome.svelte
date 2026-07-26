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

	<!-- Three glyphs of equal weight. This cluster used to be dark marks on solid
	     discs, dimmed to 72% so it would stop shouting — a workaround that left
	     it reading differently from everything else in the bar. It now carries
	     the brand's own opacity and quiets down by carrying LESS MASS instead:
	     the gear is its own silhouette with no disc behind it, and the two discs
	     are knocked through, so the ground shows where the glyph is. -->
	<nav class="chrome-actions" aria-label="Site">
		<button
			class="chrome-btn"
			aria-label="About critcalc"
			title="About"
			onclick={() => openArea('about', defaultChapter('about'))}
		>
			<!-- Disc minus glyph: the mask paints the disc white (keep) and the
			     letter black (drop), so the letter is a genuine hole — whatever is
			     behind the chrome shows through it, and the mark never needs a
			     second colour. The letterform is <text> in the body face, so it is
			     the same glyph the chrome has always used. -->
			<svg class="chrome-glyph" viewBox="0 0 24 24" aria-hidden="true">
				<mask id="chrome-knockout-about">
					<circle cx="12" cy="12" r="12" fill="#fff" />
					<text x="12" y="12.5" class="chrome-knockout" style="font-size: 15px">i</text>
				</mask>
				<circle cx="12" cy="12" r="12" fill="currentColor" mask="url(#chrome-knockout-about)" />
			</svg>
		</button>
		<button
			class="chrome-btn"
			aria-label="Help"
			title="Help"
			onclick={() => openArea('help', helpChapter)}
		>
			<svg class="chrome-glyph" viewBox="0 0 24 24" aria-hidden="true">
				<mask id="chrome-knockout-help">
					<circle cx="12" cy="12" r="12" fill="#fff" />
					<text x="12" y="12.5" class="chrome-knockout" style="font-size: 14px">?</text>
				</mask>
				<circle cx="12" cy="12" r="12" fill="currentColor" mask="url(#chrome-knockout-help)" />
			</svg>
		</button>
		<button class="chrome-btn" aria-label="Settings" title="Settings" onclick={openSettings}>
			<!-- The same outline the stroked gear used, FILLED and with its inner
			     circle dropped: one solid silhouette — no disc, no hole. -->
			<svg class="chrome-glyph" viewBox="0 0 24 24" aria-hidden="true">
				<path
					fill="currentColor"
					d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"
				/>
			</svg>
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
		margin-top: -0.085em;
		opacity: 0.85;
		transition:
			opacity 200ms ease,
			filter 200ms ease;
	}

	.chrome-wordmark {
		font-family: var(--font-display);
		font-size: 1.28rem;
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
		gap: 0.55rem;
	}

	/* The button is now only a hit target — the glyph carries the whole mark, so
	   there is no background, no border and no second colour. It rests at the
	   brand's opacity and hovers exactly like the brand does (full opacity plus
	   the same cool halo), which is the point: the cluster stops being a
	   separate visual system in the corner. Never resize on hover.
	   --chrome-glyph-size is the knob — all three marks share it, so the gear
	   silhouette and the two discs stay the same size as each other. */
	.chrome-btn {
		--chrome-glyph-size: 22px;
		width: 29px; /* ≥ the mark: keeps a comfortable target around it */
		height: 29px;
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

	.chrome-glyph {
		display: block;
		width: var(--chrome-glyph-size);
		height: var(--chrome-glyph-size);
	}

	/* Knockout letterforms: black is dropped from the disc. Centred by anchor +
	   central baseline rather than by hand-nudged coordinates, so a font swap
	   can't slide them off-centre. */
	.chrome-knockout {
		font-family: var(--font-body);
		font-weight: var(--fw-bold);
		text-anchor: middle;
		dominant-baseline: central;
		fill: #000;
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
