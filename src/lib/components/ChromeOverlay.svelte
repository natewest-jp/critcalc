<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';
	import HRule from '$lib/components/HRule.svelte';
	import { parallaxLayer, PARALLAX_CONTENT_FACTOR } from '$lib/landing/parallax';

	// The shell every meta overlay wears — settings, help, about — on every
	// surface. Presentational only: the host decides when it exists and what
	// closing means (see ChromeModals).
	//
	// `compact` is the original single-column panel (Settings). `wide` is the
	// content areas: a fixed height with its own internal scroll regions, so a
	// sidebar can stay put while a chapter scrolls beside it.
	//
	// `parallax` drifts the PANEL with the cursor — never the backdrop, which
	// must stay pinned to the viewport. Transforming an already-fixed element
	// is fine (it is positioned first, then transformed); transforming an
	// ancestor is what would break the fixed positioning.

	let {
		title,
		onClose,
		size = 'compact',
		parallax = false,
		children
	}: {
		title: string;
		onClose: () => void;
		size?: 'compact' | 'wide';
		parallax?: boolean;
		children: Snippet;
	} = $props();

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="overlay-backdrop"
	class:on-scene={parallax}
	transition:fade={{ duration: 140 }}
	onclick={(event) => {
		if (event.target === event.currentTarget) onClose();
	}}
>
	<div
		class="overlay-panel"
		class:is-wide={size === 'wide'}
		role="dialog"
		aria-modal="true"
		aria-label={title}
		use:parallaxLayer={parallax ? { x: PARALLAX_CONTENT_FACTOR, y: PARALLAX_CONTENT_FACTOR } : null}
	>
		<header class="overlay-header">
			<h2 class="overlay-title">{title}</h2>
			<button class="overlay-close" onclick={onClose} aria-label="Close">
				<!-- Nate's close mark (assets-src/tools/close.svg), built like the three
				     chrome glyphs: the X is a HOLE in the disc (evenodd), so one path
				     takes currentColor and needs no mask. -->
				<svg class="overlay-close-glyph" viewBox="0 0 56 56" fill-rule="evenodd" aria-hidden="true"
					><path
						d="M28,0C43.454,0 56,12.546 56,28C56,43.454 43.454,56 28,56C12.546,56 0,43.454 0,28C0,12.546 12.546,0 28,0ZM30.782,28.021C30.782,27.807 31.831,26.686 33.93,24.659C36.028,22.632 37.077,21.454 37.077,21.125C37.077,20.796 36.798,20.366 36.239,19.836C35.681,19.306 35.219,19.041 34.854,19.041C34.488,19.041 33.285,20.062 31.244,22.103C29.203,24.144 28.115,25.164 27.979,25.164C27.842,25.164 26.747,24.136 24.691,22.081C22.636,20.026 21.458,18.998 21.157,18.998C20.856,18.998 20.416,19.27 19.836,19.814C19.256,20.359 18.966,20.799 18.966,21.136C18.966,21.472 19.997,22.672 22.06,24.734C24.122,26.797 25.153,27.893 25.153,28.021C25.153,28.15 24.115,29.253 22.038,31.33C19.961,33.407 18.923,34.56 18.923,34.789L18.923,35.111C18.923,35.255 19.209,35.595 19.782,36.132C20.355,36.669 20.813,36.937 21.157,36.937C21.501,36.937 22.693,35.917 24.734,33.876C26.775,31.835 27.842,30.814 27.936,30.814C28.029,30.814 29.139,31.846 31.266,33.908C33.393,35.971 34.603,37.002 34.896,37.002C35.19,37.002 35.62,36.726 36.186,36.175C36.751,35.623 37.034,35.187 37.034,34.864C37.034,34.542 35.992,33.339 33.908,31.255C31.824,29.171 30.782,28.093 30.782,28.021Z"
					/></svg
				>
			</button>
		</header>
		<div class="overlay-rule"><HRule /></div>
		<div class="overlay-body">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.overlay-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		place-items: center;
		padding: 2rem;
		background: rgba(3, 6, 14, 0.72);
	}

	/* Over the live scene the backdrop only has to separate the panel from the
	   starfield, not black it out — the whole point of keeping the parallax is
	   that you can still see what you are floating above. */
	.overlay-backdrop.on-scene {
		background: rgba(3, 6, 14, 0.45);
	}

	.overlay-panel {
		width: min(34rem, 100%);
		max-height: min(80svh, 40rem);
		overflow-y: auto;
		padding: 1.4rem 1.6rem 1.6rem;
		border-radius: var(--r-lg);
		background: var(--surface-raised);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.07),
			0 18px 60px rgba(0, 0, 0, 0.55);
	}

	/* Wide: a fixed-height panel that does NOT scroll itself — the body row
	   takes the remaining space and whatever is inside owns the scrolling, so
	   an area's sidebar can hold still while its chapter moves. */
	.overlay-panel.is-wide {
		width: min(64rem, 100%);
		height: min(82svh, 46rem);
		max-height: none;
		overflow: hidden;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
	}

	.overlay-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.overlay-title {
		font-size: var(--fs-3xl);
		font-weight: var(--fw-semibold);
	}

	/* Same treatment as the three chrome marks: the button is only a hit target,
	   the glyph carries the whole thing, and it rests dimmed and brightens to
	   full. NO hover glow — a filter on a hovered element forces its own
	   compositing layer and re-rasterizes the mark every frame of the fade
	   (SiteChrome learned this first). Dimming is fill-opacity on the GLYPH, not
	   opacity on the button: element opacity is a WebKit transparency layer. */
	.overlay-close {
		--overlay-close-size: 28px;
		width: 30px;
		height: 30px;
		flex: none;
		display: grid;
		place-items: center;
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		cursor: pointer;
	}

	.overlay-close-glyph {
		width: var(--overlay-close-size);
		height: var(--overlay-close-size);
		fill: currentColor;
		fill-opacity: 0.85;
		transition: fill-opacity 200ms ease;
	}

	.overlay-close:hover .overlay-close-glyph,
	.overlay-close:focus-visible .overlay-close-glyph {
		fill-opacity: 1;
	}

	/* The capped ornamental rule (Nate's artwork), not the old fading gradient.
	   Tinted and faded to match the header-adjacent rule on .kicker, so every
	   rule in the product reads as one family. Faintness is the GROUP fade —
	   never a translucent tint, which would show brighter notches at the
	   caps' 1–2px overlaps (see HRule). */
	.overlay-rule {
		margin: 0.85rem 0 1rem;
		--rule-tint: var(--gilt-dim);
		--rule-opacity: 0.35;
	}

	.overlay-body {
		display: grid;
		gap: 0.7rem;
		font-size: var(--fs-lg);
		line-height: var(--lh-relaxed);
		color: var(--muted);
	}

	/* Wide bodies host a whole area shell, which brings its own typography
	   (.prose) and its own scroll container — so this is just a box. */
	.overlay-panel.is-wide .overlay-body {
		display: block;
		min-height: 0;
		overflow: hidden;
		font-size: inherit;
		line-height: inherit;
		color: inherit;
	}

	.overlay-body :global(strong) {
		color: var(--text);
	}

	@media (max-width: 40rem) {
		.overlay-backdrop {
			padding: 1rem;
		}

		.overlay-panel.is-wide {
			height: min(88svh, 46rem);
		}
	}
</style>
