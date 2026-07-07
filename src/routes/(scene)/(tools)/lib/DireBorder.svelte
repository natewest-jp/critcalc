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

	// Wave silhouette authored in assets-src/tools/waves.svg (2400×400, crest up,
	// body filling to the bottom edge). Stop opacities are the authored ramp ×3
	// so the slot-level --dire-wave-alpha (default 0.33) can push above 1×.
	const WAVE_PATH =
		'M0,68C0,68 234.288,2.126 445,31C655.712,59.874 752.628,133.263 1055,132C1306.373,130.95 1543.263,-6.623 1814,66C2084.18,138.474 2400,68 2400,68L2400,400L0,400L0,68Z';
</script>

{#snippet wave(id: string)}
	<svg viewBox="0 0 2400 400" preserveAspectRatio="none" aria-hidden="true">
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
	</svg>
{/snippet}

<div class="dire-border" aria-hidden="true">
	<!-- Top edge: lighter gradient + two flipped waves (chrome's quiet neighborhood) -->
	<div class="grad-top"></div>
	<div class="wave-slot top-a"><div class="drift">{@render wave('ta')}</div></div>
	<div class="wave-slot top-b"><div class="drift">{@render wave('tb')}</div></div>

	<!-- Bottom edge, back to front: tint base → rising noise veil → halftone
	     screen → gradient glow → two waves -->
	<div class="tint-base"></div>
	<div class="noise-clip"><div class="noise-scroll"></div></div>
	<div class="halftone"></div>
	<div class="grad-bottom"></div>
	<div class="wave-slot bot-a"><div class="drift">{@render wave('ba')}</div></div>
	<div class="wave-slot bot-b"><div class="drift">{@render wave('bb')}</div></div>
</div>

<style>
	.dire-border {
		position: fixed;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
		--tint: var(--dire-tint, hsl(343 85% 46%));
		--top-h: var(--dire-top-h, 75px);
		--top-grad-h: var(--dire-top-grad-h, 150px);
		--bottom-h: var(--dire-bottom-h, 100px);
		--bottom-grad-h: var(--dire-bottom-grad-h, 200px);
		--halftone-h: var(--dire-halftone-h, 200px);
		--wave-alpha: var(--dire-wave-alpha, 0.25);
		--speed: var(--dire-speed, 1);
		/* Natural wave-plate height at 170vw width (2400×400 source, 6:1) —
		   used to pin the crest line at the edge mark without distorting it */
		--wave-h: calc(170vw / 6);
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
			color-mix(in srgb, var(--tint) 15%, transparent),
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
			color-mix(in srgb, var(--tint) 18%, transparent),
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

	/* Wider than the viewport so horizontal travel never exposes an edge. Slots
	   keep the plate's authored 6:1 aspect (no vertical squash): each slot is
	   offset so the crest line tops out exactly at the edge mark (--top-h /
	   --bottom-h) and the plate's body hangs past the viewport edge, clipped by
	   the border's overflow. The crest still never reaches under content — the
	   shell's padding is derived from the same marks. */
	.wave-slot {
		position: absolute;
		width: 170vw;
		left: -35vw;
		aspect-ratio: 2400 / 400;
		opacity: var(--wave-alpha);
	}

	.wave-slot svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.bot-a {
		bottom: calc(var(--bottom-h) - var(--wave-h));
	}

	.bot-b {
		bottom: calc(var(--bottom-h) - var(--wave-h));
		transform: scaleX(-1);
		opacity: calc(var(--wave-alpha) * 0.75);
	}

	.top-a {
		top: calc(var(--top-h) - var(--wave-h));
		transform: scaleY(-1);
	}

	.top-b {
		top: calc(var(--top-h) - var(--wave-h));
		transform: scaleY(-1) scaleX(-1);
		opacity: calc(var(--wave-alpha) * 0.75);
	}

	/* Ping-pong travel: alternate + ease-in-out = drift to one side, ease into
	   the reversal. Periods are mutually indivisible so the four phases drift
	   forever and the composition never visibly repeats; negative delays start
	   each copy mid-phase. Base durations bake the 2026-07-07 tuning session
	   (original 47/73/59/89s ÷ 10) so --dire-speed: 1 = the tuned feel. */
	.drift {
		position: absolute;
		inset: 0;
		animation: dire-drift calc(var(--drift-dur) / var(--speed)) ease-in-out infinite alternate;
	}

	.bot-a .drift {
		--drift-dur: 4.7s;
		--amp: 9vw;
	}

	.bot-b .drift {
		--drift-dur: 7.3s;
		--amp: 6vw;
		animation-delay: -2s;
	}

	.top-a .drift {
		--drift-dur: 5.9s;
		--amp: 7vw;
		animation-delay: -3.5s;
	}

	.top-b .drift {
		--drift-dur: 8.9s;
		--amp: 5vw;
		animation-delay: -0.8s;
	}

	@keyframes dire-drift {
		from {
			transform: translateX(calc(var(--amp) * -1));
		}
		to {
			transform: translateX(var(--amp));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.drift,
		.noise-scroll {
			animation: none;
		}
	}
</style>
