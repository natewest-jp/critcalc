<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import TwinkleStars from '$lib/components/landing/TwinkleStars.svelte';
	import {
		createSceneStores,
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
	const { panY, dimOpacity } = createSceneStores(page.url.pathname);

	// Drive the tween whenever the URL inside (scene) changes. Navigations out
	// of (scene) — e.g. to /settings — unmount this layout entirely, so the
	// tween is moot.
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
	});
</script>

<div class="scene" style:--pan-y="{$panY}dvh">
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

<style>
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
		   the viewport — preserved for tilt-up reveal. --pan-y (set on .scene)
		   drives the tilt; the same variable is consumed by .twinkle. */
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translate(-50%, var(--pan-y, 0));
		width: calc(100dvh * 16 / 9);
		display: block;
	}

	.plate__img {
		width: 100%;
		height: auto;
		display: block;
		max-width: none;
	}
</style>
