<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { isToolPath, sceneLayer } from '$lib/landing/transition';
	import { createStarfield, type StarfieldHandle } from '$lib/landing/starfield';

	// Cold-load rest transform from the scene layout (already includes the pan
	// and any side-tool horizontal crane). Used as an SSR-time inline transform
	// so the very first paint already shows the twinkle layer at its correct
	// rest state — without this it would render at left:50% with no centering
	// translate, and hydration would visibly snap it into place. WAAPI takes
	// over via the sceneLayer action after hydration.
	let { initialTransform = 'translate(-50%, 0)' }: { initialTransform?: string } = $props();

	let canvas: HTMLCanvasElement;
	let field: StarfieldHandle | null = $state(null);

	// Tool routes fully occlude the scene, and the standing scene-occlusion
	// constraint demands ZERO live animation work behind them (WebKit stalls
	// every scroll-gesture start syncing whatever is live). For the canvas
	// field that means stopping the rAF loop outright — the last frame stays
	// in the canvas, and resume is pop-free because star phases derive from
	// absolute time. The starfield module additionally gates itself on
	// document.hidden, reduced motion and WebGL health. Only TOOL routes suspend
	// it — the landing AND the static pages keep the scene (and its twinkle) live.
	const suspended = $derived(isToolPath(page.url.pathname));

	onMount(() => {
		const f = createStarfield(canvas);
		field = f;
		return () => f.destroy();
	});

	$effect(() => {
		if (!field) return;
		if (suspended) field.stop();
		else field.start();
	});
</script>

<div
	class="twinkle"
	style:transform={initialTransform}
	use:sceneLayer={'twinkle'}
	aria-hidden="true"
>
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	/* The twinkle layer covers the sky region of the scene — bottom-anchored
	   at the horizon (top of floor), sized to the scene's full 21:9 width and
	   the sky image's source-px height. Star positions are sky-region-relative
	   %, i.e. y=0% is the top of the scene and y=100% is the horizon.
	   Transform is set inline by the sceneLayer action and animated via WAAPI
	   on the compositor thread, in lockstep with the sky and floor.

	   The field itself is ONE WebGL canvas of point sprites (see
	   $lib/landing/starfield.ts) — the pan/parallax transforms on this element
	   move the whole texture for free. The canvas paints nothing until JS runs;
	   the sky image's baked anchor stars cover that first-paint gap. */
	.twinkle {
		position: absolute;
		bottom: var(--horizon-y);
		left: 50%;
		width: var(--scene-w);
		height: var(--sky-h);
		pointer-events: none;
		z-index: 2;
		contain: layout paint;
		/* Promote to its own compositor layer so the pan transform only moves
		   a cached texture. */
		will-change: transform;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
