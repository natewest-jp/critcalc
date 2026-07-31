<script lang="ts">
	// Dire border — the themed tool-interior edge treatment (Stygian Onslaught
	// "Dire mode" reference). Slow magenta waves travel along the top and bottom
	// viewport edges; the bottom edge adds a halftone ember field: a static
	// procedural dot screen whose luminance is an upward-scrolling noise veil
	// (static screen, moving luminance — the dots never move, only their
	// brightness).
	//
	// SCROLL-UNDER layering (2026-07-24): TWO fixed strata sandwich the tool
	// content (.tool-main, z1) —
	//   .dire-under (z0): the static gradient glows, beneath content as the
	//     border always was, so no gradient ever washes over a tool surface.
	//   .dire-over (z2): the three WebGL band canvases (./direBorderGL). The
	//     wave bodies render near-opaque (coverage decoupled from shade in the
	//     shader), so THEY are what occludes content at the edges — content
	//     scrolls under the wave silhouette, no scrim, no over-gradient. The
	//     ember field is the noise shader itself now (procedural dot screen,
	//     glowing dots on transparent) painted ABOVE the bottom waves; the old
	//     tint-base + halftone-plate CSS layers are retired.
	//
	// In-frame overlay caveat: .tool-main is a stacking context, so nothing
	// inside it can paint above .dire-over — overlays that may reach the edge
	// zones must portal to <body> (the notation editor's tooltips do).
	//
	// Knobs (set on any ancestor — .tool-shell in practice — defaults below;
	// read by the GL module from the live cascade at mount/resize, or on demand
	// via window.__dire.retune() after a devtools edit):
	//   --dire-edge            border tint (ember, fade seam, wave hue/sat) —
	//                          falls back to --dire when unset
	//   --dire-grad-top-l      opaque top gradient's starting lightness
	//   --dire-grad-bottom-l   opaque bottom gradient's starting lightness
	//   --dire-top-h           top wave line: crest tops out at this mark
	//   --dire-top-grad-h      top gradient reach
	//   --dire-bottom-h        bottom wave line: crest tops out at this mark
	//   --dire-bottom-grad-h   bottom gradient reach (extends past the waves)
	//   --dire-halftone-h      ember field canvas height (field top itself
	//                          tracks the bottom wave crest + ~15px overshoot)
	//   --dire-wave-cover      per-layer wave opacity (Nate's tuning: 0.9);
	//                          fill colors are lightness pairs in the GL
	//                          module's layer defs, tint-relative
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

<!-- Under stratum: the static glows + the whole BOTTOM edge (waves, then the
     ember canvas on top so its glow dots land on the wave bodies) — content
     draws over these; bottom occlusion contributed nothing (Nate's final
     call). Also the GL module's measurement host (knob probe +
     ResizeObserver) — it must be a real box spanning the viewport, which is
     why the host is this stratum and not a wrapper. -->
<div class="dire-border dire-under" bind:this={border} aria-hidden="true">
	<div class="grad-top"></div>
	<div class="grad-bottom"></div>
	<canvas class="dire-gl gl-bottom" bind:this={bottomCanvas}></canvas>
	<canvas class="dire-gl gl-noise" bind:this={noiseCanvas}></canvas>
</div>

<!-- Over stratum: the TOP edge only, above the tool content — the occluding
     near-opaque waves are what back the fixed chrome. The fade overlay sits
     deepest (directly over content, under the waves), easing content out so
     the waves land on a settling ground rather than raw UI. Canvases are
     empty until JS runs (the SSR gap the starfield conversion accepted; the
     under-stratum glows carry the treatment's first paint). -->
<div class="dire-border dire-over" aria-hidden="true">
	<div class="fade-top"></div>
	<canvas class="dire-gl gl-top" bind:this={topCanvas}></canvas>
</div>

<style>
	.dire-border {
		position: fixed;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		/* --dire-edge = the brightened border tint (see the knob block in the
		   tools layout); falls back through --dire for any host that doesn't
		   set it. */
		--tint: var(--dire-edge, var(--dire, hsl(342 85% 46%)));
		--top-h: var(--dire-top-h, 100px);
		--top-grad-h: var(--dire-top-grad-h, 200px);
		--bottom-h: var(--dire-bottom-h, 200px);
		--bottom-grad-h: var(--dire-bottom-grad-h, 300px);
		--halftone-h: var(--dire-halftone-h, 200px);
	}

	.dire-under {
		z-index: 0;
	}

	/* Above .tool-main (z1): content scrolls UNDER the waves; the near-opaque
	   wave bodies (not a gradient) are the occluder. */
	.dire-over {
		z-index: 2;
	}

	/* ── Gradients (static, under content) ─────────────────────────────────── */

	/* OPAQUE, deliberately: these fade to solid #000 (the shell ground they
	   sit on), never to transparent. Semi-transparent CSS over black proved
	   display-dependent — on a P3 Mac the alpha path rendered hue-shifted and
	   under-saturated vs the identical opaque color, so the gradients could
	   never match the wave canvases (Nate isolated this 2026-07-31). The
	   starting lightnesses are the --dire-grad-*-l knobs in the tools
	   layout; hue/sat ride the tint. */
	.grad-top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: var(--top-grad-h);
		background: linear-gradient(
			to bottom,
			hsl(from var(--tint) h s var(--dire-grad-top-l, 17%)),
			#000
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
			hsl(from var(--tint) h s var(--dire-grad-bottom-l, 19%)),
			#000
		);
	}

	/* ── Fade overlays (static, over content, under the waves) ─────────────── */

	/* Nate's stack layer 5: a single-color transparency fade over the top of
	   the wave band. Lightness pinned LOW against the tint (l13, retuned with
	   the 2026-07-31 brightness round) — dim on purpose: it SHADOWS content
	   as it scrolls under rather than tinting it, and its lower edge
	   disappears into grad-top — the inspector-tuned invisible seam (Nate;
	   originally measured: no step >1/255 across the terminator, over bare
	   background and over scrolled content alike). This overlay sits OVER
	   content, so it is the one border layer that must stay semi-transparent
	   — its alpha ramp is unavoidable, and the seam tune absorbs it.
	   HEIGHT: the tallest wave's own height (tile-w / hDiv — keep the divisor
	   in lockstep with the GL module's layer defs) is the ceiling, but the
	   fade stops at 70% of the crest mark, i.e. ABOVE where the deepest wave
	   crests reach, so the fade lands entirely within the wave band and its
	   terminator sits just clear of the first content row (--tool-pad-top puts
	   that at --chrome-h + 0.5rem = 72px, ~2px below the 70px fade end). */
	.fade-top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: min(calc(var(--dire-tile-w, 220vw) / 17), calc(var(--top-h) * 0.7));
		background: linear-gradient(to bottom, hsl(from var(--tint) h s 13%), transparent);
	}

	/* ── Animated bands (WebGL) ────────────────────────────────────────────── */

	/* Each canvas covers exactly its band: the crest marks (--top-h/--bottom-h)
	   double as the canvas heights — the crest clamp in the GL module means no
	   wave ever paints above its mark. */
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
