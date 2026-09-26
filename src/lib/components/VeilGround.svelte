<!-- The VEIL GROUND: the site's night gradient plus its grain, as one layer.
     ⚓ Nate 2026-09-26 — one formula for the loading veil, the 404, and any
     future surface that stands in for the world. The colours are the root
     tokens --veil-ground-top/-bottom (app.css holds their derivation); this
     component is what keeps the GRAIN with them, which a token cannot.

     It fills its containing block and paints under the content that follows
     it — give that content `position: relative` (an absolutely positioned
     layer paints above in-flow siblings otherwise). `fixed` pins it to the
     viewport instead, for a page whose content scrolls. -->
<script lang="ts">
	let { fixed = false }: { fixed?: boolean } = $props();
	// Per-instance filter id: two grounds on one page must not share one.
	// ($props.id() is SSR-stable, so the server's id and the client's agree.)
	const uid = $props.id();
	const grainId = `${uid}-grain`;
</script>

<div class="veil-ground" class:fixed aria-hidden="true">
	<!-- Grain: inline feTurbulence, not the scene's noise-128 tile — that tile
	     has a wrap seam that repeats every 128px once composited plainly over
	     near-black. Turbulence is continuous across the whole rect: no seams, no
	     tiling, no extra request. It also dithers the gradient, which spans only
	     a handful of 8-bit levels. -->
	<svg class="grain">
		<filter id={grainId}>
			<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" />
		</filter>
		<rect width="100%" height="100%" filter="url(#{grainId})" />
	</svg>
</div>

<style>
	.veil-ground {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, var(--veil-ground-top) 0%, var(--veil-ground-bottom) 100%);
		pointer-events: none;
	}

	.veil-ground.fixed {
		position: fixed;
	}

	.grain {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* High enough to dither the gradient's 8-bit steps, low enough to stay
		   subliminal. */
		opacity: 0.08;
	}
</style>
