<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import TwinkleStars from '$lib/components/landing/TwinkleStars.svelte';
	import {
		initScenePath,
		startSceneTransition,
		sceneLayer,
		prefersReducedMotion,
		panYTarget,
		dimTarget,
		TRANSITION_MS
	} from '$lib/landing/transition';

	let { children } = $props();

	const PLATE = '/assets/landing/plate-frame16x9';

	// Set the baseline path once so cold loads on a tool URL snap layers to
	// tool rest state on mount (no entry animation from landing → tool).
	initScenePath(page.url.pathname);

	// Snapshot the initial pan/dim values from the cold-load path. Rendered as
	// inline style attributes below so the SSR HTML already carries the right
	// rest-state transform/opacity — without this, paint #1 shows the layer
	// uncentered (no translate(-50%)) or undimmed, and hydration would visibly
	// snap it into place. Captured into consts so the bindings don't track
	// page.url.pathname reactively — once hydration runs, the WAAPI animations
	// own these inline styles via direct el.style writes.
	const initialPanY = panYTarget(page.url.pathname);
	const initialDim = dimTarget(page.url.pathname);

	// Twinkle pause: still useful as a cheap reduction of GPU paint cost on
	// low-end devices during the pan. Toggles --twinkle-play between paused
	// and running; per-star animation-play-state reads it.
	let inMotion = $state(false);
	let inMotionTimer: ReturnType<typeof setTimeout> | null = null;

	beforeNavigate((nav) => {
		if (!nav.to) return;
		startSceneTransition(nav.to.url.pathname);

		if (prefersReducedMotion()) return;
		if (inMotionTimer) clearTimeout(inMotionTimer);
		inMotion = true;
		inMotionTimer = setTimeout(() => {
			inMotion = false;
		}, TRANSITION_MS);
	});
</script>

<!-- .scene-stack hosts only --twinkle-play (a coarse pause/run gate for star
	 animations); transforms and opacities are driven directly on the leaf
	 elements by the WAAPI orchestrator in transition.ts, so there is no
	 per-frame style recalc on a shared CSS variable. -->
<div class="scene-stack" style:--twinkle-play={inMotion ? 'paused' : 'running'}>
	<div class="scene">
		<picture
			class="plate"
			style:transform="translate(-50%, {initialPanY}dvh)"
			use:sceneLayer={'plate'}
		>
			<source
				type="image/avif"
				srcset="
					{PLATE}-1920w.avif 1920w,
					{PLATE}-2560w.avif 2560w,
					{PLATE}-3840w.avif 3840w"
				sizes="calc(100dvh * 16 / 9)"
			/>
			<source
				type="image/webp"
				srcset="
					{PLATE}-1920w.webp 1920w,
					{PLATE}-2560w.webp 2560w,
					{PLATE}-3840w.webp 3840w"
				sizes="calc(100dvh * 16 / 9)"
			/>
			<img
				class="plate__img"
				src="{PLATE}-1920w.webp"
				srcset="
					{PLATE}-1920w.webp 1920w,
					{PLATE}-2560w.webp 2560w,
					{PLATE}-3840w.webp 3840w"
				sizes="calc(100dvh * 16 / 9)"
				alt=""
				fetchpriority="high"
			/>
		</picture>

		<TwinkleStars {initialPanY} />
	</div>

	<div class="dim" style:opacity={initialDim} use:sceneLayer={'dim'}></div>

	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.scene-stack {
		/* Hosts --twinkle-play for descendants without contributing layout. */
		display: contents;
	}

	.scene,
	.dim,
	.content {
		position: fixed;
		inset: 0;
		width: 100dvw;
		height: 100dvh;
	}

	.scene {
		z-index: 0;
		overflow: hidden;
		background: var(--bg);
	}

	.dim {
		z-index: 1;
		background: var(--bg);
		pointer-events: none;
		/* Initial opacity is set inline at SSR time (style:opacity above);
		   WAAPI takes over via the sceneLayer action after hydration. */
		will-change: opacity;
	}

	.content {
		z-index: 2;
	}

	.plate {
		/* Lock the visible plate region to the bottom 16:9 frame of the 1:1 source,
		   always filling viewport height. The remaining top 7/16 overflows above
		   the viewport — preserved for tilt-up reveal. Transform is set inline
		   by the sceneLayer action and animated via WAAPI on the compositor
		   thread; will-change keeps the layer promoted so the first frame after
		   navigation doesn't trigger a re-promote stutter. */
		position: absolute;
		bottom: 0;
		left: 50%;
		width: calc(100dvh * 16 / 9);
		display: block;
		will-change: transform;
	}

	.plate__img {
		width: 100%;
		height: auto;
		display: block;
		max-width: none;
	}
</style>
