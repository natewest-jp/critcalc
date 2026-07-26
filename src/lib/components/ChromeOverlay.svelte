<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';
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
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			</button>
		</header>
		<div class="overlay-rule"></div>
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
		border-radius: 8px;
		background: var(--surface);
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

	.overlay-close {
		width: 30px;
		height: 30px;
		flex: none;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 50%;
		background: var(--text);
		color: #0b1020;
		cursor: pointer;
		transition:
			background 150ms ease,
			box-shadow 150ms ease;
	}

	.overlay-close:hover {
		background: #fff;
		box-shadow: 0 0 10px rgba(230, 237, 248, 0.35);
	}

	.overlay-close svg {
		width: 14px;
		height: 14px;
	}

	/* Decorative hairline under the title — fades out to the right */
	.overlay-rule {
		height: 1px;
		margin: 0.85rem 0 1rem;
		background: linear-gradient(
			to right,
			color-mix(in srgb, var(--accent) 55%, transparent),
			transparent
		);
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
