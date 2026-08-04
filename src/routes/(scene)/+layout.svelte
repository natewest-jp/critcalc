<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import TwinkleStars from '$lib/components/landing/TwinkleStars.svelte';
	import ShootingStars from '$lib/components/landing/ShootingStars.svelte';
	import PortalTransition from '$lib/components/landing/PortalTransition.svelte';
	import LoadingVeil from '$lib/components/landing/LoadingVeil.svelte';
	import SiteChrome from '$lib/components/SiteChrome.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import ChromeModals from '$lib/components/ChromeModals.svelte';
	import {
		initScenePath,
		startSceneTransition,
		sceneLayer,
		dimTarget,
		restTransform,
		isToolPath,
		sceneOccluded
	} from '$lib/landing/transition';
	import { mountSceneGL, type SceneGLHandle } from '$lib/landing/sceneGL';
	import { claimVeilReady, afterPaint } from '$lib/landing/veilReady';

	let { children } = $props();

	// The site-frame chrome + footer show on the landing + static pages, never on
	// the tool routes (they carry their own chrome). Reactive so they appear/clear
	// as you navigate.
	const pathname = $derived(page.url.pathname);

	// Set the baseline path once so cold loads on a tool URL snap layers to
	// tool rest state on mount (no entry animation from landing → tool).
	const initialPath = page.url.pathname;
	initScenePath(initialPath);

	// Seed the occlusion state from the cold-load path: a direct hit on a tool
	// URL renders the scene unpainted from the first frame (the tool shell SSRs
	// revealed + opaque above it), so its textures are never rasterized. Only the
	// TOOL routes occlude — the landing and the static content pages render over a
	// visible scene. The tools layout flips this true after its reveal paints; our
	// beforeNavigate below flips it false on the way to any non-tool route. See
	// sceneOccluded in transition.ts for the full handshake contract.
	sceneOccluded.set(isToolPath(initialPath));

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
	const initialSceneTransform = restTransform('twinkle', initialPath)!;

	// The GL scene world (sceneGL.ts): plates + gradient in one canvas, camera
	// as a uniform — the DOM plate layers are gone (the ascend rebuild; a slow
	// eased DOM pan is unfixable on Firefox/WebRender). The renderer finishes
	// asynchronously (texture decode), so on a scene-visible cold load it
	// claims the veil and releases after its first presented frame. On a tool
	// cold load the scene is occluded: skip the claim (the tool holds its own)
	// and defer the whole GL mount — textures shouldn't compete with the tool's
	// hydration — until the first navigation back to a scene-visible route.
	let sceneCanvas: HTMLCanvasElement;
	const releaseVeil = !isToolPath(initialPath) ? claimVeilReady() : () => {};
	onMount(() => {
		let handle: SceneGLHandle | null = null;
		let disposed = false;
		let started = false;
		const initGL = async () => {
			try {
				const h = await mountSceneGL(sceneCanvas);
				if (disposed) {
					h.destroy();
					return;
				}
				handle = h;
				afterPaint(releaseVeil);
			} catch (err) {
				// No WebGL → no scene (deliberately no DOM fallback: two scene
				// implementations is how parity rots). The site itself still works.
				console.error('scene: GL mount failed', err);
				releaseVeil();
			}
		};
		const unsubOcc = sceneOccluded.subscribe((occ) => {
			if (!occ && !started) {
				started = true;
				void initGL();
			}
		});
		return () => {
			disposed = true;
			unsubOcc();
			handle?.destroy();
		};
	});

	// Catch-all transition kickoff for navigations not started by a hero click
	// (brand-return, browser back/forward, direct nav). Hero clicks pre-start
	// the transition and defer the navigation a couple frames (see the landing
	// page), so this is a no-op for them — startSceneTransition early-returns
	// when the target path already matches the in-flight one.
	beforeNavigate((nav) => {
		if (!nav.to) return;
		// Restore the scene BEFORE any departure choreography runs whenever the
		// destination is NOT a tool (the landing or a content page): heading back
		// to the landing this fires under the reverse portal's black cover (its
		// goto runs at full black) or before a non-portal exit's shell fade-out
		// begins, so the one-time re-raster is never visible; heading to a content
		// page there is no shell to hide behind, but the scene simply needs to be
		// painted for it.
		if (!isToolPath(nav.to.url.pathname)) sceneOccluded.set(false);
		startSceneTransition(nav.to.url.pathname);
	});
</script>

<!-- The scene is composed from three layers stacked back-to-front:
	  scene-canvas →  the GL world (sky-bg gradient + sky/floor plates + grain,
	                  camera as a uniform — sceneGL.ts; the old DOM plate layers
	                  are retired with the ascend rebuild)
	  twinkle      →  WebGL starfield canvas (live twinkle over the baked
	                  anchors; joins the scene canvas with the choreography
	                  chunk — a DOM-translating star canvas can't ride the pan)
	  dim          →  opacity overlay applied when in a tool state

	  .scene-stack still carries the horizon-line coordinate system in
	  source-image pixel space — the starfield and meteors size to it. -->
<div class="scene-stack">
	<div class="scene" class:occluded={$sceneOccluded}>
		<canvas class="scene-canvas" bind:this={sceneCanvas}></canvas>

		<TwinkleStars initialTransform={initialSceneTransform} />

		<ShootingStars />
	</div>

	<div
		class="dim"
		class:occluded={$sceneOccluded}
		style:opacity={initialDim}
		use:sceneLayer={'dim'}
	></div>

	<div class="content">
		{@render children()}

		<!-- Site-frame chrome (top) + footer (bottom, over a dark gradient). Shown
			 on the landing + static pages, never on tools. Live in the scene layout
			 so they're single persistent bars across landing↔pages (no remount, no
			 position shift, identical everywhere) while the content between them
			 crossfades. -->
		{#if !isToolPath(pathname)}
			<div class="scene-chrome">
				<SiteChrome />
			</div>
			<div class="scene-footer-gradient"></div>
			<div class="scene-footer">
				<SiteFooter />
			</div>

			<!-- Meta overlays (help / about / settings), a SIBLING of the chrome
				 rather than a child of it (historically the chrome carried a
				 parallax transform, which is a containing block for
				 position:fixed descendants). Rendered only off the tool routes
				 because the tools layout hosts its own copy (it is the one
				 painting over this scene). onScene keeps the translucent
				 over-the-starfield panel styling. -->
			<ChromeModals onScene />
		{/if}
	</div>

	<!-- Portal transition overlay (z:3, above content). Self-contained: idle and
		hidden until a hero click triggers it via startPortalTransition. -->
	<PortalTransition />

	<!-- Abyssal-script loading veil (z:20, above everything). Lives here rather
		 than on the landing page so EVERY surface gets it: the scene's starfield
		 and a tool's localStorage-restored state both arrive after first paint,
		 and either one blinking into existence is the same defect. It renders
		 only into server-rendered HTML, so SPA navigations — including a
		 hero-card portal into a tool — never see it. Tools hold it until their
		 real content is on screen (see veilReady.ts). -->
	<LoadingVeil />
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

		   The master is the 6400×4000 ascend plate: the 21:9 design FRAME (5120
		   wide) plus 640px of bleed left/right (full 16° crane + parallax
		   reserve on every viewport). Two width concepts matter:
		     --frame-w-src  the 21:9 frame — maps 1:1 to the viewport (the basis
		                    for --px). At a 21:9 viewport the frame fills it exactly.
		     --plate-w-src  the full image (frame + L/R bleed). The image is this
		                    wide, so it overflows the frame by 640px×--px per side.
		   Vertically the floor image carries the 66px bottom bleed BELOW the
		   frame; ABOVE the rest frame the sky carries the full ascend headroom
		   (~1740 src rows) the camera tilts up into — the crest pose mirrors
		   rest with 66px of bleed above the viewport. The horizon (sky/floor
		   contact) is master row 2675, so the sky image is the top 2675 rows
		   and the floor image the bottom 1325. */
		--frame-w-src: 5120;
		--plate-w-src: 6400;
		--master-h-src: 4000;
		--sky-h-src: 2675;
		--floor-h-src: 1325;
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

		/* THE grain knobs (Nate 2026-07-28, tuned by eye from 0.55/0.35).
		   Dithers the plates' smooth sky gradient, which bands — measured, 84%
		   of sampled sky rows sat in a flat luminance plateau up to 28px tall.
		   The banding is in the MASTER, not the encoder (see the note on
		   REGIONS in scripts/optimize-bg.js); quality cannot buy this back,
		   dither can. Sky runs hotter than floor — the floor's reflections give
		   it detail to hide steps behind.
		   ↻ Ascend rebuild: grain is applied IN the scene renderer's plate
		   shader now (sceneGL.ts) — same mid-grey tile, same overlay blend,
		   one texel per DEVICE pixel via gl_FragCoord (the old per-dppx
		   background-size ladder, for free). These knobs and the gradient
		   stops below are read from computed style at renderer init; after a
		   devtools edit call window.__scene.retune(). */
		--sky-grain: 0.45;
		--floor-grain: 0.3;

		/* Additive dither σ (8-bit levels) in the plate shader — breaks the
		   quantisation contours the overlay-blend grain can't reach: overlay's
		   dark branch scales with base brightness, so in the near-black top of
		   the ascend sky the grain does ~nothing and the smooth gradient bands
		   (measured 2026-08-04). Luminance-only, per device px. Measured
		   sweep on the rendered crest: σ0 = 30.2% plateau, σ0.75 = 1.5%,
		   σ1 = 0.6%, σ3 = 0.0% but reads heavy (Nate). Raise if the dark sky
		   still bands on a real display, lower if the top looks noisy; 0
		   disables. Read at renderer init — window.__scene.retune() after
		   devtools edits. */
		--scene-dither: 1;

		/* Sky gradient stops. Picked to match the baked sky image's edge tone
		   near the gutter (where the gradient shows through on ultrawide). */
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

	/* Scene occlusion (perf audit F4): while the opaque tool shell covers the
	   viewport, unpaint the scene + dim so the compositor releases their layer
	   textures. visibility (not display) keeps layout/WAAPI/measure intact, and
	   the handshake guarantees the flip only ever happens off-screen — hidden
	   under the shell/portal black, restored under the same cover. */
	.scene.occluded,
	.dim.occluded {
		visibility: hidden;
	}

	/* The GL scene world — one static-size canvas; all motion is the camera
	   uniform inside it (sceneGL.ts). First child of .scene, so the starfield
	   and meteors paint above it. */
	.scene-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
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

	/* Site-frame chrome: fixed full-width top bar, above the content but within
	   .content's z:2 stacking context, so the portal cover (z:3, a sibling of
	   .content) still hides it during tool transitions. */
	.scene-chrome {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 3;
		/* Parallax transform (written by parallaxLayer) — the bar drifts with the
		   scene like the heroes/panel do. */
		will-change: transform;
	}

	/* Footer pinned to the bottom edge, centered within its reserved height.
	   Non-interactive (disclaimer text only), so clicks pass through to the
	   backdrop beneath — clicking the footer area still closes a page. */
	.scene-footer {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		height: var(--site-footer-h);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 4;
		pointer-events: none;
		will-change: transform;
	}

	/* Full-frame dark gradient beneath the footer (very dark blue → transparent),
	   anchored to the viewport bottom. z:1 keeps it BEHIND the pages panel (z:2)
	   so it never darkens the panel — it backs the footer + the open scene. */
	.scene-footer-gradient {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		height: 200px;
		pointer-events: none;
		z-index: 1;
		background: linear-gradient(to top, rgba(2, 9, 31, 1), rgba(3, 6, 16, 0));
	}
</style>
