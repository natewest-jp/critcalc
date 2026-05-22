<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import TwinkleStars from '$lib/components/landing/TwinkleStars.svelte';
	import {
		createSceneStores,
		pulseMotionBlur,
		panYTarget,
		dimTarget,
		prefersReducedMotion,
		TRANSITION_MS,
		REDUCED_MS,
		TILT_EASING
	} from '$lib/landing/transition';

	let { children } = $props();

	const PLATE = '/assets/landing/plate-frame16x9';

	// Stores snap to the correct state on cold load so direct URL hits (e.g.
	// refresh on /crit-visualizer) don't animate from landing → tool on mount.
	const { panY, dimOpacity, motionBlur } = createSceneStores(page.url.pathname);

	// Whether a pan is currently underway. Used to pause star twinkle animations
	// during the transition (frees GPU from per-star paint while it's busy with
	// the layered transforms + blur).
	let inMotion = $state(false);
	let motionBlurTimer: ReturnType<typeof setTimeout> | null = null;
	let inMotionTimer: ReturnType<typeof setTimeout> | null = null;

	beforeNavigate((nav) => {
		if (!nav.to) return;
		const reduced = prefersReducedMotion();
		const duration = reduced ? REDUCED_MS : TRANSITION_MS;
		const path = nav.to.url.pathname;
		panY.set(reduced ? 0 : panYTarget(path), {
			duration: reduced ? 0 : duration,
			easing: TILT_EASING
		});
		dimOpacity.set(dimTarget(path), { duration, easing: TILT_EASING });

		if (reduced) return;

		// Pulse motion blur 0 → peak → 0 to mask judder; pause twinkle for
		// the duration so per-star paint doesn't contend for GPU.
		if (motionBlurTimer) clearTimeout(motionBlurTimer);
		if (inMotionTimer) clearTimeout(inMotionTimer);
		motionBlurTimer = pulseMotionBlur(motionBlur);
		inMotion = true;
		inMotionTimer = setTimeout(() => {
			inMotion = false;
		}, TRANSITION_MS);
	});
</script>

<!-- .scene-stack hosts --pan-y so it inherits to descendants of both the
	 cosmic scene (plate, twinkle) and the page content (landing composition,
	 tool shell). All four layers consume the same variables, so they pan
	 and blur together as a single "scene at infinity."
	 --motion-blur drives a fake motion-blur radius (in pixels) on each layer.
	 --twinkle-play pauses star animations while a pan is underway. -->
<div
	class="scene-stack"
	style:--pan-y="{$panY}dvh"
	style:--motion-blur={$motionBlur}
	style:--twinkle-play={inMotion ? 'paused' : 'running'}
>
	<div class="scene">
		<picture class="plate">
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

		<TwinkleStars />
	</div>

	<div class="dim" style:opacity={$dimOpacity}></div>

	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.scene-stack {
		/* Hosts --pan-y for descendants without contributing layout. */
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
	}

	.content {
		z-index: 2;
	}

	.plate {
		/* Lock the visible plate region to the bottom 16:9 frame of the 1:1 source,
		   always filling viewport height. The remaining top 7/16 overflows above
		   the viewport — preserved for tilt-up reveal. --pan-y (set on .scene-stack)
		   drives the tilt; same variable is consumed by .twinkle, .composition,
		   and .tool-shell so the whole scene moves in lockstep.
		   --motion-blur (unitless number, set on .scene-stack) drives a fake
		   directional blur during the pan to mask judder.
		   will-change promotes this to a compositor layer so the pan + blur
		   run on GPU rather than triggering per-frame paint. */
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translate(-50%, var(--pan-y, 0));
		filter: blur(calc(var(--motion-blur, 0) * 1px));
		width: calc(100dvh * 16 / 9);
		display: block;
		will-change: transform, filter;
	}

	.plate__img {
		width: 100%;
		height: auto;
		display: block;
		max-width: none;
	}
</style>
