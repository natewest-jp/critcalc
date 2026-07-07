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
	//   --dire-tint            edge hue (slightly red-leaning magenta, H 345)
	//   --dire-top-h           top edge height (gradient + wave zone)
	//   --dire-bottom-h        bottom edge height (tint/noise/halftone/waves)
	//   --dire-bottom-grad-h   bottom gradient reach (extends past the waves)
	//   --dire-wave-alpha      wave brightness multiplier (0.33 ≈ authored ramp)
	//   --dire-speed           global speed multiplier (1 = shipped feel)

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

		--tint: var(--dire-tint, hsl(345 85% 46%));
		--top-h: var(--dire-top-h, 200px);
		--bottom-h: var(--dire-bottom-h, 200px);
		--bottom-grad-h: var(--dire-bottom-grad-h, 300px);
		--wave-alpha: var(--dire-wave-alpha, 0.33);
		--speed: var(--dire-speed, 1);
	}

	/* ── Gradients (static) ────────────────────────────────────────────────── */

	.grad-top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: var(--top-h);
		background: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--tint) 22%, transparent),
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
			color-mix(in srgb, var(--tint) 34%, transparent),
			transparent
		);
	}

	/* ── Halftone ember field (bottom edge only) ───────────────────────────── */

	.tint-base {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--bottom-h);
		background: var(--tint);
	}

	.noise-clip {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--bottom-h);
		overflow: hidden;
	}

	/* Seamless upward scroll: the layer is one tile (600px) taller than its clip;
	   translating by exactly one tile height loops invisibly. Compositor-only. */
	.noise-scroll {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: calc(var(--bottom-h) + 600px);
		background-image: image-set(
			url('/assets/tools/dire-noise.avif') type('image/avif'),
			url('/assets/tools/dire-noise.webp') type('image/webp')
		);
		background-repeat: repeat;
		animation: dire-rise calc(40s / var(--speed)) linear infinite;
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
	   them. Vertically squashed if --dire-bottom-h shrinks below the authored
	   200px (acceptable for the prototype). */
	.halftone {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--bottom-h);
		background: url('/assets/tools/dire-halftone.png') repeat-x bottom;
		background-size: 10px var(--bottom-h);
	}

	/* ── Waves ─────────────────────────────────────────────────────────────── */

	/* Wider than the viewport so horizontal travel never exposes an edge; the
	   silhouette stretches with preserveAspectRatio="none" (organic shapes
	   tolerate it, and per-slot height differences add free variety). */
	.wave-slot {
		position: absolute;
		width: 170vw;
		left: -35vw;
		opacity: var(--wave-alpha);
	}

	.wave-slot svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	/* All slots stay exactly inside their edge zone — the shell's content padding
	   is derived from the zone heights, and the animated layers must never reach
	   under content (Safari scroll-stall pathology). Variety comes from mirroring,
	   phase offsets, and opacity, not from taller copies. */
	.bot-a {
		bottom: 0;
		height: var(--bottom-h);
	}

	.bot-b {
		bottom: 0;
		height: var(--bottom-h);
		transform: scaleX(-1);
		opacity: calc(var(--wave-alpha) * 0.75);
	}

	.top-a {
		top: 0;
		height: var(--top-h);
		transform: scaleY(-1);
	}

	.top-b {
		top: 0;
		height: var(--top-h);
		transform: scaleY(-1) scaleX(-1);
		opacity: calc(var(--wave-alpha) * 0.75);
	}

	/* Ping-pong travel: alternate + ease-in-out = drift to one side, ease into
	   the reversal. Periods are mutually indivisible so the four phases drift
	   forever and the composition never visibly repeats; negative delays start
	   each copy mid-phase. */
	.drift {
		position: absolute;
		inset: 0;
		animation: dire-drift calc(var(--drift-dur) / var(--speed)) ease-in-out infinite alternate;
	}

	.bot-a .drift {
		--drift-dur: 47s;
		--amp: 9vw;
	}

	.bot-b .drift {
		--drift-dur: 73s;
		--amp: 6vw;
		animation-delay: -20s;
	}

	.top-a .drift {
		--drift-dur: 59s;
		--amp: 7vw;
		animation-delay: -35s;
	}

	.top-b .drift {
		--drift-dur: 89s;
		--amp: 5vw;
		animation-delay: -8s;
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
