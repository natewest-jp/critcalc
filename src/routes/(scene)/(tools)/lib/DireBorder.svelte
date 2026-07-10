<script lang="ts">
	// Dire border — the themed tool-interior edge treatment (Stygian Onslaught
	// "Dire mode" reference). Slow magenta waves travel along the top and bottom
	// viewport edges over gradient glows; the bottom edge adds a halftone ember
	// field: a static perforated dot screen over an upward-scrolling noise veil
	// on a solid tint base (static screen, moving luminance — the dots never
	// move, only their brightness).
	//
	// Perf doctrine (Firefox/WebRender + Safari scroll-gesture): every animation
	// here is compositor-only — transform + opacity on pre-rasterized layers.
	// No SVG-internal animation, no filters, no masks, no blend modes.
	//
	// Knobs (set on any ancestor, defaults below):
	//   --dire-tint            edge hue (slightly red-leaning magenta, H 343)
	//   --dire-top-h           top wave line: crest tops out at this mark
	//   --dire-top-grad-h      top gradient reach
	//   --dire-bottom-h        bottom wave line: crest tops out at this mark
	//   --dire-bottom-grad-h   bottom gradient reach (extends past the waves)
	//   --dire-halftone-h      ember field height (plate native size: 200px)
	//   --dire-wave-alpha      wave brightness multiplier
	//   --dire-speed           wave speed multiplier (1 = shipped/tuned feel)
	//   --dire-noise-dur       noise rise time per 600px tile (independent of
	//                          wave speed — the two never tune well together)

	// Wave silhouette authored in assets-src/tools/waves.svg (2400×200, crest up,
	// body filling to the bottom edge) — more, shallower crests than the 400-tall
	// original. Stop opacities are the authored ramp ×3 so the slot-level
	// --dire-wave-alpha (default 0.25) can push above 1×.
	const WAVE_PATH =
		'M0,68C0,68 141.418,52.596 212.39,53C300.205,53.5 421.915,73.549 526.888,71C643.555,68.167 783.377,34.059 912.392,36C1045.319,38 1191.684,81 1324.447,83C1453.135,84.939 1580.264,48.328 1708.966,48C1839.608,47.667 1993.127,77.667 2108.299,81C2205.589,83.816 2400,68 2400,68L2400,200L0,200L0,68Z';
</script>

<!-- One horizontally-tiled strip: two copies of the (x-repeating) silhouette
     side by side inside a 4800-wide viewBox, so translating the strip by exactly
     one tile (−50%) loops seamlessly. One gradient per strip (ids stay unique). -->
{#snippet wave(id: string)}
	<svg class="wave-svg" viewBox="0 0 4800 200" preserveAspectRatio="none" aria-hidden="true">
		<defs>
			<linearGradient
				id="dire-wave-{id}"
				gradientUnits="userSpaceOnUse"
				x1="0"
				y1="23.68"
				x2="0"
				y2="400"
			>
				<stop offset="0" stop-color="var(--tint)" stop-opacity="0.3" />
				<stop offset="0.2" stop-color="var(--tint)" stop-opacity="0.18" />
				<stop offset="0.42" stop-color="var(--tint)" stop-opacity="0.06" />
				<stop offset="1" stop-color="var(--tint)" stop-opacity="0" />
			</linearGradient>
		</defs>
		<path d={WAVE_PATH} fill="url(#dire-wave-{id})" />
		<path d={WAVE_PATH} fill="url(#dire-wave-{id})" transform="translate(2400 0)" />
	</svg>
{/snippet}

<div class="dire-border" aria-hidden="true">
	<!-- Top edge: lighter gradient + three waves (two same-way, one opposite) -->
	<div class="grad-top"></div>
	<div class="wave-slot top-1"><div class="flow rev">{@render wave('t1')}</div></div>
	<div class="wave-slot top-2"><div class="flow rev">{@render wave('t2')}</div></div>
	<div class="wave-slot top-3"><div class="flow">{@render wave('t3')}</div></div>

	<!-- Bottom edge, back to front: tint base → rising noise veil → halftone
	     screen → gradient glow → three waves (two same-way, one opposite) -->
	<div class="tint-base"></div>
	<div class="noise-clip"><div class="noise-scroll"></div></div>
	<div class="halftone"></div>
	<div class="grad-bottom"></div>
	<div class="wave-slot bot-1"><div class="flow">{@render wave('b1')}</div></div>
	<div class="wave-slot bot-2"><div class="flow">{@render wave('b2')}</div></div>
	<div class="wave-slot bot-3"><div class="flow rev">{@render wave('b3')}</div></div>
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
		--wave-alpha: var(--dire-wave-alpha, 0.25);
		--speed: var(--dire-speed, 1);
		/* One wave tile (the 2400-unit repeating pattern) is displayed this wide;
		   each strip is two tiles so it can loop by translating exactly one tile.
		   --wave-h keeps the 2400×200 (12:1) source aspect; per-layer overrides
		   squash it for a flatter wave. */
		--tile-w: var(--dire-tile-w, 220vw);
		--wave-h: calc(var(--tile-w) / 12);
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

	.noise-clip {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--halftone-h);
		overflow: hidden;
	}

	/* Seamless upward scroll: the layer is one tile (600px) taller than its clip;
	   translating by exactly one tile height loops invisibly. Compositor-only. */
	.noise-scroll {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: calc(var(--halftone-h) + 600px);
		background-image: image-set(
			url('/assets/tools/dire-noise.avif') type('image/avif'),
			url('/assets/tools/dire-noise.webp') type('image/webp')
		);
		background-repeat: repeat;
		animation: dire-rise var(--dire-noise-dur, 8s) linear infinite;
	}

	@keyframes dire-rise {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-600px);
		}
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

	/* ── Waves ─────────────────────────────────────────────────────────────── */

	/* The silhouette repeats along x, so each layer scrolls continuously and loops
	   seamlessly: the strip is two tiles wide and translates by exactly one tile
	   (−50%). Per edge, two layers run the same way at different speeds (parallax)
	   and a third runs opposite (.rev); one same-way layer is y-squashed flatter
	   via a smaller --wave-h. Compositor-only (transform on a pre-rasterized SVG).
	   The crest tops out at the edge mark (--top-h / --bottom-h); the body hangs
	   past the viewport edge, clipped by the border's overflow. */
	.wave-slot {
		position: absolute;
		left: 0;
		right: 0;
		height: var(--wave-h);
		opacity: var(--wave-alpha);
		/* Each wave rides its own hue — --dire-tint rotated by --hue-shift degrees —
		   so the layers shimmer against each other and the base. Relative color
		   syntax keeps it tied to --dire-tint; no filter, so it stays doctrine-safe
		   (the shifted color just bakes into the SVG's gradient at raster time). */
		--tint: hsl(from var(--dire-tint, hsl(342 85% 46%)) calc(h + var(--hue-shift, 0)) s l);
	}

	.flow {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: calc(2 * var(--tile-w));
		animation: dire-flow calc(var(--flow-dur) / var(--speed)) linear infinite;
		/* Pin a stable GPU layer. The waves crawl (near-stationary between wraps),
		   so the compositor is tempted to demote the layer and re-create it at the
		   loop boundary — a one-frame flash. will-change + a 3D-transform keyframe
		   keep the layer promoted for the animation's whole life. */
		will-change: transform;
	}

	.flow.rev {
		animation-direction: reverse;
	}

	.wave-svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	@keyframes dire-flow {
		to {
			transform: translate3d(-50%, 0, 0);
		}
	}

	/* Bottom edge. min(0px, …) clamps the strip's bottom to at-or-below the
	   viewport edge, so shrinking --tile-w (→ smaller --wave-h) can never lift the
	   fill off the bottom and open a gap; the crest just rides a little lower. */
	.bot-1,
	.bot-2,
	.bot-3 {
		bottom: min(0px, calc(var(--bottom-h) - var(--wave-h)));
	}
	.bot-1 {
		--flow-dur: 30s;
		--wave-h: calc(var(--tile-w) / 15);
		--hue-shift: -1;
	}
	.bot-2 {
		--flow-dur: 38s;
		--wave-h: calc(var(--tile-w) / 15);
		--hue-shift: -2;
		opacity: calc(var(--wave-alpha) * 0.8);
		margin-bottom: -64px;
	}
	.bot-3 {
		--flow-dur: 46s;
		--wave-h: calc(var(--tile-w) / 15);
		--hue-shift: 5;
		opacity: calc(var(--wave-alpha) * 0.65);
		margin-bottom: -36px;
	}
	.bot-2 .flow {
		animation-delay: -7s;
	}
	.bot-3 .flow {
		animation-delay: -13s;
	}

	/* Top edge — mirrored so the crest points down into the viewport */
	.top-1,
	.top-2,
	.top-3 {
		top: min(0px, calc(var(--top-h) - var(--wave-h)));
		transform: scaleY(-1);
	}
	.top-1 {
		--flow-dur: 34s;
		--wave-h: calc(var(--tile-w) / 17);
		--hue-shift: -5;
	}
	.top-2 {
		--flow-dur: 42s;
		--wave-h: calc(var(--tile-w) / 17);
		--hue-shift: 7;
		opacity: calc(var(--wave-alpha) * 0.8);
		margin-top: -42px;
	}
	.top-3 {
		--flow-dur: 50s;
		--wave-h: calc(var(--tile-w) / 17);
		--hue-shift: -8;
		opacity: calc(var(--wave-alpha) * 0.65);
		margin-top: -21px;
	}
	.top-2 .flow {
		animation-delay: -5s;
	}
	.top-3 .flow {
		animation-delay: -17s;
	}

	@media (prefers-reduced-motion: reduce) {
		.flow,
		.noise-scroll {
			animation: none;
		}
	}
</style>
