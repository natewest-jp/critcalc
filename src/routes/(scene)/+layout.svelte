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

	const FLOOR = '/assets/landing/floor';
	const SKY = '/assets/landing/sky';

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

<!-- The scene is composed from five layers stacked back-to-front:
	  sky-bg  →  CSS gradient + noise overlay (fills ultrawide gutters)
	  sky     →  baked sky image (gradient + galaxy dust + band + anchor stars)
	  twinkle →  CSS-animated stars (live twinkle over the baked anchors)
	  floor   →  baked floor image (ground + reflections)
	  dim     →  opacity overlay applied when in a tool state

	  All scene layers pan in lockstep via WAAPI animations on each leaf
	  element; transforms are written directly to el.style by the sceneLayer
	  action. .scene-stack carries only --twinkle-play (a coarse pause/run
	  gate for star animations) plus the horizon-line coordinate system in
	  source-image pixel space — derived CSS values flow from there. -->
<div class="scene-stack" style:--twinkle-play={inMotion ? 'paused' : 'running'}>
	<div class="scene">
		<div class="sky-bg" style:transform="translateY({initialPanY}dvh)" use:sceneLayer={'sky-bg'}></div>

		<picture
			class="sky"
			style:transform="translate(-50%, {initialPanY}dvh)"
			use:sceneLayer={'sky'}
		>
			<source
				type="image/avif"
				srcset="
					{SKY}-1920w.avif 1920w,
					{SKY}-2560w.avif 2560w,
					{SKY}-3440w.avif 3440w,
					{SKY}-5120w.avif 5120w"
				sizes="calc(100dvh * 21 / 9)"
			/>
			<source
				type="image/webp"
				srcset="
					{SKY}-1920w.webp 1920w,
					{SKY}-2560w.webp 2560w,
					{SKY}-3440w.webp 3440w,
					{SKY}-5120w.webp 5120w"
				sizes="calc(100dvh * 21 / 9)"
			/>
			<img
				class="sky__img"
				src="{SKY}-1920w.webp"
				srcset="
					{SKY}-1920w.webp 1920w,
					{SKY}-2560w.webp 2560w,
					{SKY}-3440w.webp 3440w,
					{SKY}-5120w.webp 5120w"
				sizes="calc(100dvh * 21 / 9)"
				alt=""
				fetchpriority="high"
			/>
		</picture>

		<TwinkleStars {initialPanY} />

		<picture
			class="floor"
			style:transform="translate(-50%, {initialPanY}dvh)"
			use:sceneLayer={'floor'}
		>
			<source
				type="image/avif"
				srcset="
					{FLOOR}-1920w.avif 1920w,
					{FLOOR}-2560w.avif 2560w,
					{FLOOR}-3440w.avif 3440w,
					{FLOOR}-5120w.avif 5120w"
				sizes="calc(100dvh * 21 / 9)"
			/>
			<source
				type="image/webp"
				srcset="
					{FLOOR}-1920w.webp 1920w,
					{FLOOR}-2560w.webp 2560w,
					{FLOOR}-3440w.webp 3440w,
					{FLOOR}-5120w.webp 5120w"
				sizes="calc(100dvh * 21 / 9)"
			/>
			<img
				class="floor__img"
				src="{FLOOR}-1920w.webp"
				srcset="
					{FLOOR}-1920w.webp 1920w,
					{FLOOR}-2560w.webp 2560w,
					{FLOOR}-3440w.webp 3440w,
					{FLOOR}-5120w.webp 5120w"
				sizes="calc(100dvh * 21 / 9)"
				alt=""
				fetchpriority="high"
			/>
		</picture>
	</div>

	<div class="dim" style:opacity={initialDim} use:sceneLayer={'dim'}></div>

	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.scene-stack {
		/* Hosts --twinkle-play for descendants without contributing layout, and
		   the horizon-line coordinate system below. */
		display: contents;

		/* --- Horizon-line coordinate system -----------------------------------
		   All scene geometry lives in source-image pixel space (the dimensions
		   exported from Blender). One scale factor (--px) converts source px
		   to CSS dvh, so changing the master dimensions only requires updating
		   the *-src values; all dependent positions flow automatically.

		   The plate's CSS width = 100dvh × viewport-aspect, mapped to scene-w-src
		   source pixels — that's the conversion. --pan-target falls out of the
		   scene/viewport delta automatically; if you change scene-h-src, the
		   transition's pan distance follows. */
		--scene-w-src: 5120;
		--scene-h-src: 3840;
		--floor-h-src: 1072;
		--sky-h-src: 2768;

		--viewport-aspect: calc(21 / 9);

		--px: calc(100dvh * var(--viewport-aspect) / var(--scene-w-src));

		--scene-w: calc(100dvh * var(--viewport-aspect));
		--scene-h: calc(var(--scene-h-src) * var(--px));
		--floor-h: calc(var(--floor-h-src) * var(--px));
		--sky-h: calc(var(--sky-h-src) * var(--px));

		/* Horizon = top of floor = bottom of sky baked image. */
		--horizon-y: var(--floor-h);

		/* Sky gradient stops. Picked to match the baked sky image's edge tone
		   near the gutter (where this CSS sky shows through on ultrawide). */
		--sky-top: #0a0e1a;
		--sky-bottom: #1f2a48;
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

	/* Layer 0: CSS sky gradient — fills ultrawide gutters where the baked sky
	   image doesn't reach. On 21:9-and-narrower viewports, fully covered by
	   .sky and visually invisible. Noise tile blended in for banding mitigation;
	   the tile is small (~5KB) and amortizes across the whole sky region. */
	.sky-bg {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100dvw;
		height: var(--scene-h);
		background:
			url('/assets/landing/noise-128.webp') repeat,
			linear-gradient(180deg, var(--sky-top) 0%, var(--sky-bottom) 100%);
		background-blend-mode: overlay, normal;
		z-index: 0;
		will-change: transform;
	}

	/* Layer 1: Baked sky image (gradient + dust + band + anchor stars). Sized
	   to the scene's 21:9 width and the sky's source-px height. Bottom edge
	   sits at the horizon line. */
	.sky {
		position: absolute;
		bottom: var(--horizon-y);
		left: 50%;
		width: var(--scene-w);
		height: var(--sky-h);
		display: block;
		z-index: 1;
		will-change: transform;
	}

	.sky__img {
		width: 100%;
		height: 100%;
		display: block;
		max-width: none;
	}

	/* Layer 3 (TwinkleStars is layer 2, defined in TwinkleStars.svelte):
	   Baked floor image. Above everything else in the scene so the reflections
	   feel "in front" and occlude any layer that should sit below the horizon. */
	.floor {
		position: absolute;
		bottom: 0;
		left: 50%;
		width: var(--scene-w);
		height: var(--floor-h);
		display: block;
		z-index: 3;
		will-change: transform;
	}

	.floor__img {
		width: 100%;
		height: 100%;
		display: block;
		max-width: none;
	}
</style>
