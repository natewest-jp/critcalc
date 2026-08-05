<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import ShootingStars from '$lib/components/landing/ShootingStars.svelte';
	import LoadingVeil from '$lib/components/landing/LoadingVeil.svelte';
	import SiteChrome from '$lib/components/SiteChrome.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import ChromeModals from '$lib/components/ChromeModals.svelte';
	import {
		initScenePath,
		startSceneTransition,
		syncSceneCamera,
		sceneLayer,
		dimTarget,
		isToolPath,
		sceneOccluded,
		revealDelayMs,
		FADE_DURATION_MS,
		FADE_OUT_MS
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

	// ⚠ TOOLS-OVER-SCENE EXPERIMENT (Nate 2026-08-05): the tool shell is
	// transparent now, so NO route occludes — the scene stays painted and
	// live everywhere, including behind the tools. The handshake machinery
	// (this store, the .occluded unpaint below, the tools layout's old
	// report) is kept wired but never asserted; if tool-route perf regresses
	// on real hardware, re-seeding this from isToolPath + restoring the
	// report in the tools layout brings perf-audit-F4 behavior back.
	sceneOccluded.set(false);

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

	// The GL scene world (sceneGL.ts): plates + gradient in one canvas, camera
	// as a uniform — the DOM plate layers are gone (the ascend rebuild; a slow
	// eased DOM pan is unfixable on Firefox/WebRender). The renderer finishes
	// asynchronously (texture decode) and releases its veil claim after its
	// first presented frame. The occlusion-deferred mount path (skip GL until
	// navigating off a tool) is dormant while nothing occludes — with the
	// transparent shell the scene mounts immediately on every cold load,
	// including tool routes, where its texture decode now overlaps the tool's
	// hydration (accepted by the tools-over-scene experiment; revisit here if
	// tool cold loads feel heavier).
	let sceneCanvas: HTMLCanvasElement;
	let sceneHandle = $state<SceneGLHandle | null>(null);
	// The scene is part of first paint on EVERY route now (tools-over-scene),
	// so it claims the veil on tool cold loads too — the tool's own claim
	// still gates its content; the veil lifts when both have painted.
	const releaseVeil = claimVeilReady();
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
				sceneHandle = h;
				// Land on the current path's pose (rest, or a crest crane after a
				// deferred mount) before the first presented frame is relied on.
				syncSceneCamera();
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

	// The twinkle loop lives in the scene renderer now (the starfield-merge
	// chunk — the DOM TwinkleStars canvas retired; a DOM-translating star
	// canvas can't ride the camera pan). Keyed off OCCLUSION, not the route:
	// during the ascend the route is already a tool while the world is still
	// on screen (stars must keep twinkling through the pan and the shell's
	// fade-in); occlusion flips only once the shell is painted opaque — the
	// scene-occlusion constraint's ZERO-rAF-behind-tools moment. On the
	// descend, occlusion lifts at beforeNavigate, so the field is live for the
	// whole ride down. Resume is pop-free — star phases derive from absolute
	// time. (During a camera animation the animation loop draws and the
	// twinkle loop skips — no double-draw; sceneGL coordinates the two.)
	$effect(() => {
		if (!sceneHandle) return;
		if ($sceneOccluded) sceneHandle.stop();
		else sceneHandle.start();
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
		// from a tool this fires before the shell's fade-out starts, so the
		// one-time re-raster happens while the scene is still covered — and the
		// descend then plays behind the fading shell; heading to a content page
		// there is no shell to hide behind, but the scene simply needs to be
		// painted for it.
		if (!isToolPath(nav.to.url.pathname)) sceneOccluded.set(false);
		startSceneTransition(nav.to.url.pathname);
	});
</script>

<!-- The scene is composed from two layers stacked back-to-front:
	  scene-canvas →  the GL world (sky-bg gradient + sky/floor plates + grain
	                  + the twinkle starfield, camera as a uniform — sceneGL.ts;
	                  the DOM plate layers AND the DOM twinkle canvas are
	                  retired with the ascend rebuild)
	  dim          →  opacity overlay applied when in a tool state

	  .scene-stack still carries the horizon-line coordinate system in
	  source-image pixel space — the meteors size to it. -->
<div class="scene-stack">
	<div class="scene" class:occluded={$sceneOccluded}>
		<canvas class="scene-canvas" bind:this={sceneCanvas}></canvas>

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
			 crossfades. They ride the shared ascend clock: fade out quickly as the
			 camera starts its climb, fade back in near settle on the descend
			 (revealDelayMs = 0 when there's no transition, e.g. hydration).
			 Transitions are LOCAL on purpose — they play only when this {#if}
			 toggles, never on the layout's initial mount. -->
		{#if !isToolPath(pathname)}
			<div
				class="scene-chrome"
				in:fade={{ duration: FADE_DURATION_MS, delay: revealDelayMs() }}
				out:fade={{ duration: FADE_OUT_MS }}
			>
				<SiteChrome />
			</div>
			<div
				class="scene-footer-gradient"
				in:fade={{ duration: FADE_DURATION_MS, delay: revealDelayMs() }}
				out:fade={{ duration: FADE_OUT_MS }}
			></div>
			<div
				class="scene-footer"
				in:fade={{ duration: FADE_DURATION_MS, delay: revealDelayMs() }}
				out:fade={{ duration: FADE_OUT_MS }}
			>
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

	<!-- Abyssal-script loading veil (z:20, above everything). Lives here rather
		 than on the landing page so EVERY surface gets it: the scene's starfield
		 and a tool's localStorage-restored state both arrive after first paint,
		 and either one blinking into existence is the same defect. It renders
		 only into server-rendered HTML, so SPA navigations — including a
		 hero-card ascend into a tool — never see it. Tools hold it until their
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
		   contact) is master row 3026, so the sky image is the top 3026 rows
		   and the floor image the bottom 974. */
		--frame-w-src: 5120;
		--plate-w-src: 6400;
		--master-h-src: 4000;
		--sky-h-src: 3026;
		--floor-h-src: 974;
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
	   under the opaque shell, restored under the same cover. */
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

	/* Site-frame chrome: fixed full-width top bar, above the content within
	   .content's z:2 stacking context. */
	.scene-chrome {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 3;
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
