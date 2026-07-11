<script lang="ts">
	// Dire border — the themed tool-interior edge treatment (Stygian Onslaught
	// "Dire mode" reference). Slow magenta waves travel along the top and bottom
	// viewport edges over gradient glows; the bottom edge adds a halftone ember
	// field: a static perforated dot screen over an upward-scrolling noise veil
	// on a solid tint base (static screen, moving luminance — the dots never
	// move, only their brightness).
	//
	// Split (docs/webgl-dire-border-handoff.md): the STATIC layers — gradient
	// glows, tint base, halftone dot screen — are CSS below; every ANIMATED
	// layer (six wave strips + the noise veil, formerly 7 live CSS animations
	// on oversized compositor textures — the Safari eviction-flash class) is
	// now three WebGL band canvases driven by ./direBorderGL. The canvases sit
	// exactly where the strips they replace sat in the paint order, so the CSS
	// layers stay sandwiched as before. Tuned values (per-layer durations, hue
	// shifts, margins, the alpha ramp) live in the GL module, copied verbatim
	// from the shipped CSS.
	//
	// Knobs (set on any ancestor — .tool-shell in practice — defaults below;
	// read by the GL module from the live cascade at mount/resize, or on demand
	// via window.__direRetune() after a devtools edit):
	//   --dire-tint            edge hue (slightly red-leaning magenta)
	//   --dire-top-h           top wave line: crest tops out at this mark
	//   --dire-top-grad-h      top gradient reach
	//   --dire-bottom-h        bottom wave line: crest tops out at this mark
	//   --dire-bottom-grad-h   bottom gradient reach (extends past the waves)
	//   --dire-halftone-h      ember field height (plate native size: 200px)
	//   --dire-wave-alpha      wave brightness multiplier
	//   --dire-speed           wave speed multiplier (1 = shipped/tuned feel)
	//   --dire-tile-w          wave tile width (wave size)
	//   --dire-noise-dur       noise rise time per 600px tile (independent of
	//                          wave speed — the two never tune well together)
	import { onMount } from 'svelte';
	import { createDireBorder } from './direBorderGL';

	let border: HTMLDivElement;
	let topCanvas: HTMLCanvasElement;
	let noiseCanvas: HTMLCanvasElement;
	let bottomCanvas: HTMLCanvasElement;

	onMount(() => {
		const handle = createDireBorder(border, {
			top: topCanvas,
			noise: noiseCanvas,
			bottom: bottomCanvas
		});
		handle.start();
		// Devtools re-tuning hook: knobs are read once at init, so a live
		// --dire-* edit needs window.__dire.retune() to reach the canvases.
		// (Also the verification probes' handle: running / start / stop.)
		(window as unknown as Record<string, unknown>).__dire = handle;
		return () => {
			delete (window as unknown as Record<string, unknown>).__dire;
			handle.destroy();
		};
	});
</script>

<div class="dire-border" bind:this={border} aria-hidden="true">
	<!-- Top edge: lighter gradient + the top wave canvas -->
	<div class="grad-top"></div>
	<canvas class="dire-gl gl-top" bind:this={topCanvas}></canvas>

	<!-- Bottom edge, back to front: tint base → rising noise veil (canvas) →
	     halftone screen → gradient glow → wave canvas. The noise canvas MUST
	     stay under the halftone (the plate is near-opaque black — the ember
	     look is noise through its dot holes) and the waves above it, which is
	     why the bottom edge takes two canvases. -->
	<div class="tint-base"></div>
	<canvas class="dire-gl gl-noise" bind:this={noiseCanvas}></canvas>
	<div class="halftone"></div>
	<div class="grad-bottom"></div>
	<canvas class="dire-gl gl-bottom" bind:this={bottomCanvas}></canvas>
</div>

<style>
	.dire-border {
		position: fixed;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
		--tint: var(--dire-tint, hsl(342 85% 46%));
		--top-h: var(--dire-top-h, 100px);
		--top-grad-h: var(--dire-top-grad-h, 200px);
		--bottom-h: var(--dire-bottom-h, 200px);
		--bottom-grad-h: var(--dire-bottom-grad-h, 300px);
		--halftone-h: var(--dire-halftone-h, 200px);
	}

	/* ── Gradients (static) ────────────────────────────────────────────────── */

	.grad-top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: var(--top-grad-h);
		background: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--tint) 25%, transparent),
			transparent
		);
	}

	.grad-bottom {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--bottom-grad-h);
		background: linear-gradient(
			to top,
			color-mix(in srgb, var(--tint) 35%, transparent),
			transparent
		);
	}

	/* ── Halftone ember field (bottom edge only) ───────────────────────────── */

	.tint-base {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--halftone-h);
		background: var(--tint);
	}

	/* Static perforated screen: opaque black with transparent dot holes, edge
	   fade baked into the plate. The dots never move — the noise moves under
	   them. Rendered at the plate's native height (--halftone-h = 200px) so the
	   dots stay crisp, independent of where the waves sit. */
	.halftone {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--halftone-h);
		background: url('/assets/tools/dire-halftone.png') repeat-x bottom;
		background-size: 10px var(--halftone-h);
	}

	/* ── Animated bands (WebGL) ────────────────────────────────────────────── */

	/* Each canvas covers exactly its band: the crest marks (--top-h/--bottom-h)
	   double as the canvas heights — the crest clamp in the GL module means no
	   wave ever paints above its mark. Empty until JS runs (the SSR gap the
	   starfield conversion accepted; the CSS gradients/tint/halftone carry the
	   treatment's first paint). */
	.dire-gl {
		position: absolute;
		left: 0;
		right: 0;
		display: block;
		width: 100%;
	}

	.gl-top {
		top: 0;
		height: var(--top-h);
	}

	.gl-noise {
		bottom: 0;
		height: var(--halftone-h);
	}

	.gl-bottom {
		bottom: 0;
		height: var(--bottom-h);
	}
</style>
