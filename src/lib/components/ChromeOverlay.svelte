<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';
	import HRule from '$lib/components/HRule.svelte';
	import CloseMark from '$lib/components/CloseMark.svelte';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';

	// The shell every meta overlay wears — settings, help, about — on every
	// surface. Presentational only: the host decides when it exists and what
	// closing means (see ChromeModals).
	//
	// `compact` is the original single-column panel (Settings). `wide` is the
	// content areas: a fixed height with its own internal scroll regions, so a
	// sidebar can stay put while a chapter scrolls beside it.
	//
	// `onScene` marks an overlay floating over the live scene (landing/pages):
	// the backdrop lightens so the starfield stays visible behind the panel.
	// (It used to also drift the panel with the cursor — parallax was retired
	// with the ascend rebuild, 2026-08-02.)

	let {
		title,
		onClose,
		size = 'compact',
		onScene = false,
		heading,
		children
	}: {
		title: string;
		onClose: () => void;
		size?: 'compact' | 'wide';
		onScene?: boolean;
		/** Replaces the plain title — the About | Help tabs (AreaTabs). `title`
		 *  still names the dialog for assistive tech. */
		heading?: Snippet;
		children: Snippet;
	} = $props();

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<!-- ↻ 2026-08-12 (motion round): 140 by hand became --t-quick, the SURFACE
     band — a full-viewport scrim plus a raised panel is the largest thing that
     moves in this product, and size is what sets the clock (app.css § MOTION).
     10ms of change, which is nothing; the two things that changed underneath
     it are not. The duration now collapses to 0 under prefers-reduced-motion —
     this was the ONE animation on the site with no reduce path at all, because
     a JS transition cannot see a media query and the CSS blocks that honour the
     preference could never reach it. And outroInert stops the dismissed scrim
     from swallowing the click that lands in the fade after you close it. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="overlay-backdrop"
	class:on-scene={onScene}
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
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
	>
		<header class="overlay-header">
			{#if heading}
				{@render heading()}
			{:else}
				<h2 class="overlay-title">{title}</h2>
			{/if}
			<button class="overlay-close" onclick={onClose} aria-label="Close">
				<CloseMark />
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
	   starfield, not black it out — you can still see what you are floating
	   above. */
	.overlay-backdrop.on-scene {
		background: rgba(3, 6, 14, 0.45);
	}

	.overlay-panel {
		width: min(34rem, 100%);
		max-height: min(80svh, 40rem);
		overflow-y: auto;
		padding: 1.4rem 1.6rem 1.6rem;
		border-radius: var(--r-md); /* modals keep the softer corner — see the geometry block */
		background: var(--surface); /* modal role (Nate 2026-07-31) */
		border: 1px solid var(--border);
		box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
	}

	/* Wide: a fixed-height panel that does NOT scroll itself — the body row
	   takes the remaining space and whatever is inside owns the scrolling, so
	   an area's sidebar can hold still while its chapter moves. */
	.overlay-panel.is-wide {
		/* ⚓ Nate 2026-09-23: 72rem. Prose keeps its 56ch measure, so the width
		   is margin for reading and room for the coverage table. */
		width: min(72rem, 100%);
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
		font-size: var(--fs-4xl);
		font-weight: var(--fw-semibold);
	}

	/* Same treatment as the three chrome marks: the button is only a hit target,
	   the glyph carries the whole thing, and it rests dimmed and brightens to
	   full. NO hover glow — a filter on a hovered element forces its own
	   compositing layer and re-rasterizes the mark every frame of the fade
	   (SiteChrome learned this first). Dimming is fill-opacity on the GLYPH, not
	   opacity on the button: element opacity is a WebKit transparency layer. */
	/* The hit target; CloseMark is the mark (and owns its own hover/focus
	   fill-opacity). */
	.overlay-close {
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

	/* The capped ornamental rule (Nate's artwork), not the old fading gradient.
	   Tinted and faded to match the header-adjacent rule on .kicker, so every
	   rule in the product reads as one family. Faintness is the GROUP fade —
	   never a translucent tint, which would show brighter notches at the
	   caps' 1–2px overlaps (see HRule). */
	.overlay-rule {
		margin: 0.85rem 0 1rem;
		--rule-tint: var(--muted);
		--rule-opacity: 0.35;
	}

	.overlay-body {
		display: grid;
		/* An explicit min-0 track, so a wide child squeezes instead of pushing
		   the panel into a sideways scroll (the Settings overlay ran 73px wide
		   at 320). The wide form below is display: block and unaffected. */
		grid-template-columns: minmax(0, 1fr);
		gap: 0.7rem;
		font-size: var(--fs-xl);
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
