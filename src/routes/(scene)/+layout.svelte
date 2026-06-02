<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import TwinkleStars from '$lib/components/landing/TwinkleStars.svelte';
	import ShootingStars from '$lib/components/landing/ShootingStars.svelte';
	import {
		initScenePath,
		startSceneTransition,
		sceneLayer,
		dimTarget,
		restTransform
	} from '$lib/landing/transition';
	import { parallaxLayer } from '$lib/landing/parallax';

	let { children } = $props();

	const FLOOR = '/assets/landing/floor';
	const SKY = '/assets/landing/sky';

	// Plate tier widths (must match TIERS in scripts/optimize-bg.js). These are
	// full plate widths (frame + L/R bleed), the top tier = master width.
	const TIERS = [2000, 2670, 3585, 5340];
	const srcset = (base: string, ext: string) =>
		TIERS.map((w) => `${base}-${w}w.${ext} ${w}w`).join(', ');
	// Displayed image width = the plate. The frame is 100dvh×21/9 wide; the plate
	// is wider by the L/R bleed ratio (plate_w_src / frame_w_src = 5340/5120), so
	// the browser picks the tier against the actual rendered plate width.
	const SIZES = 'calc(100dvh * 21 / 9 * 5340 / 5120)';

	// Set the baseline path once so cold loads on a tool URL snap layers to
	// tool rest state on mount (no entry animation from landing → tool).
	const initialPath = page.url.pathname;
	initScenePath(initialPath);

	// Snapshot the cold-load rest state. Rendered as inline style attributes
	// below so the SSR HTML already carries the right rest-state transform/
	// opacity — without this, paint #1 shows the layer uncentered (no
	// translate(-50%)) or undimmed, and hydration would visibly snap it into
	// place. Captured into consts so the bindings don't track page.url.pathname
	// reactively — once hydration runs, the WAAPI animations own these inline
	// styles via direct el.style writes. Built from restTransform so the SSR
	// strings stay in lockstep with the sceneLayer action, including the side-
	// tool horizontal crane on a direct hit to /crit-visualizer or /team-builder.
	const initialDim = dimTarget(initialPath);
	const initialSkyBgTransform = restTransform('sky-bg', initialPath)!;
	const initialSceneTransform = restTransform('sky', initialPath)!; // shared by sky/twinkle/floor

	// Catch-all transition kickoff for navigations not started by a hero click
	// (brand-return, browser back/forward, direct nav). Hero clicks pre-start
	// the transition and defer the navigation a couple frames (see the landing
	// page), so this is a no-op for them — startSceneTransition early-returns
	// when the target path already matches the in-flight one.
	beforeNavigate((nav) => {
		if (!nav.to) return;
		startSceneTransition(nav.to.url.pathname);
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
	  action. .scene-stack carries the horizon-line coordinate system in
	  source-image pixel space — derived CSS values flow from there. -->
<div class="scene-stack">
	<div class="scene">
		<div class="sky-bg" style:transform={initialSkyBgTransform} use:sceneLayer={'sky-bg'}></div>

		<!-- Cursor-parallax group: sky + stars + floor shift together as one rigid
			unit. sky-bg is intentionally OUTSIDE so it stays a fixed full-viewport
			backdrop — any edge revealed by the shift shows the sky gradient, not raw
			--bg. The parallax controller writes this element's transform directly. -->
		<div class="parallax-world" use:parallaxLayer={{ x: 1, y: 1 }}>
			<picture class="sky" style:transform={initialSceneTransform} use:sceneLayer={'sky'}>
				<source type="image/avif" srcset={srcset(SKY, 'avif')} sizes={SIZES} />
				<source type="image/webp" srcset={srcset(SKY, 'webp')} sizes={SIZES} />
				<img
					class="sky__img"
					src="{SKY}-2000w.webp"
					srcset={srcset(SKY, 'webp')}
					sizes={SIZES}
					alt=""
					fetchpriority="high"
				/>
			</picture>

			<TwinkleStars initialTransform={initialSceneTransform} />

			<ShootingStars />

			<picture class="floor" style:transform={initialSceneTransform} use:sceneLayer={'floor'}>
				<source type="image/avif" srcset={srcset(FLOOR, 'avif')} sizes={SIZES} />
				<source type="image/webp" srcset={srcset(FLOOR, 'webp')} sizes={SIZES} />
				<img
					class="floor__img"
					src="{FLOOR}-2000w.webp"
					srcset={srcset(FLOOR, 'webp')}
					sizes={SIZES}
					alt=""
					fetchpriority="high"
				/>
			</picture>
		</div>
	</div>

	<div class="dim" style:opacity={initialDim} use:sceneLayer={'dim'}></div>

	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.scene-stack {
		/* Carries the horizon-line coordinate system below without contributing
		   layout. */
		display: contents;

		/* --- Horizon-line coordinate system -----------------------------------
		   All scene geometry lives in source-image pixel space. One scale factor
		   (--px) converts source px to CSS, so swapping the master only means
		   updating the *-src values; all dependent positions flow automatically.

		   The master is the 21:9 design FRAME (5120×2194) plus cursor-parallax
		   BLEED on every edge so a shift never pulls a gutter into view: 110px
		   left/right, 66px top/bottom → 5340×2326. Two width concepts matter:
		     --frame-w-src  the 21:9 frame — maps 1:1 to the viewport (the basis
		                    for --px). At a 21:9 viewport the frame fills it exactly.
		     --plate-w-src  the full image (frame + L/R bleed). The image is this
		                    wide, so it overflows the frame by 110px×--px ≈ 5dvh per
		                    side — the horizontal parallax reserve.
		   Vertically the floor image carries the 66px bottom bleed BELOW the frame
		   and the sky image the 66px top bleed ABOVE it (≈3dvh each — the vertical
		   reserve). The horizon (sky/floor contact) is master row 1451, so the sky
		   image is the top 1451 rows and the floor image the bottom 875. */
		--frame-w-src: 5120;
		--plate-w-src: 5340;
		--master-h-src: 2326;
		--sky-h-src: 1451;
		--floor-h-src: 875;
		--bleed-v-src: 66;

		--viewport-aspect: calc(21 / 9);

		/* Source-px → CSS, based on the FRAME mapping to the viewport. */
		--px: calc(100dvh * var(--viewport-aspect) / var(--frame-w-src));

		/* --scene-w is the IMAGE width (frame + bleed); --scene-h backs the
		   sky-bg gradient. sky/floor/twinkle/meteors all size to --scene-w. */
		--scene-w: calc(var(--plate-w-src) * var(--px));
		--scene-h: calc(var(--master-h-src) * var(--px));
		--floor-h: calc(var(--floor-h-src) * var(--px));
		--sky-h: calc(var(--sky-h-src) * var(--px));

		/* Horizon height above the viewport bottom. The frame bottom sits at the
		   viewport bottom; the floor image extends --bleed-v below that, so the
		   horizon (floor image's top edge) is (floor-h − bleed-v) up. */
		--horizon-y: calc((var(--floor-h-src) - var(--bleed-v-src)) * var(--px));

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

	/* Cursor-parallax group. Holds sky + stars + floor; the parallax controller
	   writes a small translate here each frame (direct style.transform, never an
	   inherited custom property — so the ~1500 twinkle stars never restyle).
	   position/inset:0 makes it the containing block for its absolutely-
	   positioned children, so their bottom/left anchors resolve exactly as they
	   did against .scene. Default transform is identity (parallax off → flat). */
	.parallax-world {
		position: absolute;
		inset: 0;
		transform: translate3d(0, 0, 0);
		will-change: transform;
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

	/* Layer 1: Baked sky image (gradient + dust + band + anchor stars). Sized to
	   the plate width (frame + L/R bleed) and the sky's source-px height. Bottom
	   edge sits at the horizon line; the top carries the upper bleed off-screen.
	   left:50% + translate(-50%) centres the plate on the frame (symmetric bleed). */
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
	   feel "in front" and occlude any layer that should sit below the horizon.
	   Sized to the plate width (frame + L/R bleed). The bottom bleed hangs
	   --bleed-v below the viewport bottom so the frame's bottom edge lands exactly
	   at the viewport bottom and the lower parallax reserve sits off-screen. */
	.floor {
		position: absolute;
		bottom: calc(-1 * var(--bleed-v-src) * var(--px));
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
