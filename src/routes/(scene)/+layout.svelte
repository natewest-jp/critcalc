<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import ShootingStars from '$lib/components/landing/ShootingStars.svelte';
	import NoticeRegion from '$lib/components/NoticeRegion.svelte';
	import { sayAfterReload } from '$lib/notices.svelte';
	import LoadingVeil from '$lib/components/landing/LoadingVeil.svelte';
	import SiteChrome from '$lib/components/SiteChrome.svelte';
	import type TopBarT from '$lib/components/TopBar.svelte';
	import type MenuStateT from '$lib/components/MenuState.svelte';
	import type MoveDialogT from '$lib/components/MoveDialog.svelte';
	import type LinksDialogT from '$lib/components/LinksDialog.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { linksIntro, moveRequest } from '$lib/moveRequest.svelte';
	import { nextLayout } from '$lib/nextLayout';
	import { get } from 'svelte/store';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import ChromeModals from '$lib/components/ChromeModals.svelte';
	import {
		initScenePath,
		startSceneTransition,
		syncSceneCamera,
		hasActiveSceneTransition,
		sceneLayer,
		dimTarget,
		isToolPath,
		sceneOccluded,
		revealDelayMs,
		timeUntilSettle,
		FADE_DURATION_MS,
		FADE_OUT_MS,
		FADE_OVERLAP_MS
	} from '$lib/landing/transition';
	import { mountSceneGL, setStarKeepOut, type SceneGLHandle } from '$lib/landing/sceneGL';
	import { SCENE_DIM } from '$lib/landing/sceneDim';
	import VeilGround from '$lib/components/VeilGround.svelte';
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
	// tool horizontal crane on a direct hit to /visualizers or /builder.
	const initialDim = dimTarget(initialPath) * SCENE_DIM.wash;

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
	// The renderer failed to mount (no WebGL, or a plate that never decoded).
	// ⚠ The context is created BEFORE the plates load, and an alpha:false
	// canvas is opaque black until its first draw — so a failed mount must
	// also HIDE the canvas, or it covers the VeilGround fallback in black.
	let sceneFailed = $state(false);
	// The scene is part of first paint on EVERY route now (tools-over-scene),
	// so it claims the veil on tool cold loads too — the tool's own claim
	// still gates its content; the veil lifts when both have painted.
	const releaseVeil = claimVeilReady();
	/** The top bar, loaded only while the switch is on. */
	const nextOn = get(nextLayout);
	let TopBarC = $state<typeof TopBarT | null>(null);
	/** The menu state (phase 2c): ONE host for every surface — the landing, a
	 *  section's own route, and over a tool, which it covers without
	 *  unmounting (its sections are shallow history entries). */
	let MenuStateC = $state<typeof MenuStateT | null>(null);
	/** Move to a profile's confirmation (phase 3), loaded on first use. */
	let MoveDialogC = $state<typeof MoveDialogT | null>(null);
	$effect(() => {
		if (moveRequest.id && !MoveDialogC)
			void import('$lib/components/MoveDialog.svelte').then((m) => (MoveDialogC = m.default));
	});
	/** The one-time "links open in Theorycraft" dialog, loaded on first use. */
	let LinksDialogC = $state<typeof LinksDialogT | null>(null);
	$effect(() => {
		if (linksIntro.open && !LinksDialogC)
			void import('$lib/components/LinksDialog.svelte').then((m) => (LinksDialogC = m.default));
	});

	// A restore says so once the page is back (notices round).
	onMount(sayAfterReload);
	onMount(() => {
		if (!nextOn) return;
		void import('$lib/components/TopBar.svelte').then((m) => (TopBarC = m.default));
		void import('$lib/components/MenuState.svelte').then((m) => (MenuStateC = m.default));
	});

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
				sceneFailed = true;
				releaseVeil();
			}
		};
		const unsubOcc = sceneOccluded.subscribe((occ) => {
			if (!occ && !started) {
				started = true;
				void initGL();
			}
		});
		// ⚠️ THE CAMERA POSE IS PIXELS, worked out from the viewport height at the
		// moment it was set (crestPose: PAN_DVH% of vh). Rotating a phone on a
		// tool route kept the PORTRAIT pan in a landscape viewport — the camera
		// tilted up by twice what the shorter screen needs, so the world slid
		// down and plain background showed above it (Nate's phone, 2026-10-14).
		// The renderer already rebuilds its geometry from the new size; this
		// re-poses the camera to match. Never mid-transition — that leg is
		// re-deriving its own poses as it runs.
		const reposeOnResize = new ResizeObserver(() => {
			if (handle && !hasActiveSceneTransition()) syncSceneCamera();
		});
		reposeOnResize.observe(sceneCanvas);
		return () => {
			disposed = true;
			unsubOcc();
			reposeOnResize.disconnect();
			handle?.destroy();
		};
	});

	// TOOL-REST PAUSE (Nate 2026-08-06): once a tool leg SETTLES, stop the
	// twinkle loop. Behind the dim with a tool in front the twinkle is barely
	// perceptible, and the loop is a full-viewport GL redraw at refresh rate —
	// the only continuous cost on tool routes (ShootingStars already
	// suspends). This is deliberately NARROWER than sceneOccluded: the scene
	// stays PAINTED (occlusion also unpaints via .occluded, which would blank
	// the world behind the transparent shell — never assert it for this). The
	// camera's own animation loop draws independently of the twinkle loop, so
	// the world still sweeps under a frozen field: the ascend twinkles the
	// whole way up and freezes at settle, and a leg BETWEEN tools stays frozen
	// throughout (scheduleRest below). Resume is pop-free — sceneGL's star
	// clock holds the presented frame and banks the paused span. Restores the
	// scene-occlusion constraint's zero-rAF-behind-tools property, which the
	// tools-over-scene experiment had dropped wholesale.
	let sceneResting = $state(false);
	let restTimer: ReturnType<typeof setTimeout> | undefined;
	// Margin past camera settle before freezing: the ascend reveal's fade tail
	// ends FADE_OVERLAP_MS after settle, and the tool legs' fades are inside
	// their own settle windows — freeze only once everything visual has ended.
	const REST_AFTER_SETTLE_MS = FADE_OVERLAP_MS + 100;
	// ⚓ NATE 2026-08-07: the crest tool space is ONE rest. A leg that starts
	// and ends on a tool route must NOT wake the field — the world stays
	// frozen on the same frame for as long as you're up here, whichever tool
	// you're on. Only a leg that leaves tool space (the descend, or a static
	// page) thaws it. Waking mid-leg was visible: the field resumed at its
	// absolute-time phase, a whole different stage of the twinkle, flashing in
	// as the camera craned. (The clock half of this lives in sceneGL's star
	// clock — the camera's own loop draws every frame of that crane, so the
	// loop flag alone can't hold the frame.)
	function scheduleRest(toPath: string, fromPath?: string) {
		clearTimeout(restTimer);
		if (!(isToolPath(toPath) && !!fromPath && isToolPath(fromPath))) sceneResting = false;
		if (!isToolPath(toPath)) return;
		restTimer = setTimeout(() => {
			// A newer navigation re-scheduled (and un-rested) already; its own
			// timer owns the decision — this check just guards the stale fire.
			if (isToolPath(page.url.pathname)) sceneResting = true;
		}, timeUntilSettle() + REST_AFTER_SETTLE_MS);
	}

	onMount(() => {
		// Cold load on a tool route: no transition in flight, so this rests the
		// loop right after the margin (the mount's first frame is painted; on-
		// demand draws — resize, retune — run regardless of the loop).
		scheduleRest(initialPath);
		return () => clearTimeout(restTimer);
	});

	// The twinkle loop lives in the scene renderer now (the starfield-merge
	// chunk — the DOM TwinkleStars canvas retired; a DOM-translating star
	// canvas can't ride the camera pan). Keyed off occlusion (kept wired,
	// never asserted under tools-over-scene) and the tool-rest pause above.
	// During the ascend the route is already a tool while the world is still
	// in motion — rest flips only past settle, so stars keep twinkling through
	// the pan and the shell's fade-in. On the descend, beforeNavigate un-rests
	// before the choreography starts, so the field is live for the whole ride
	// down. (During a camera animation the animation loop draws and the
	// twinkle loop skips — no double-draw; sceneGL coordinates the two.)
	$effect(() => {
		if (!sceneHandle) return;
		if ($sceneOccluded || sceneResting) sceneHandle.stop();
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
		// After the kickoff, so timeUntilSettle() sees this leg's fresh clock.
		scheduleRest(nav.to.url.pathname, nav.from?.url.pathname);
	});

	// The brand keep-out (starPass.ts § STAR_KEEPOUT_*): hand the renderer the
	// lockup's box so the stars thin out around it. The chrome is FIXED, so the
	// box only moves when the viewport or the lockup's own size does (the
	// webfont landing, the compact wordmark).
	function publishBrandBox(node: HTMLElement) {
		const lockup = node.querySelector<HTMLElement>('.chrome-brand-group, .tb-brand');
		if (!lockup) return;
		// The chrome's own fade-in window (its `in:fade` below), read at mount as
		// that fade reads it, so the keep-out comes in WITH the lockup and not
		// at the click (⚓ Nate, 2026-10-18). With no transition in flight (a
		// cold load) the chrome does not fade, so neither does the keep-out.
		const reveal =
			timeUntilSettle() > 0
				? { start: performance.now() + revealDelayMs(), duration: FADE_DURATION_MS }
				: null;
		const publish = () => {
			const r = lockup.getBoundingClientRect();
			setStarKeepOut({ x: r.left, y: r.top, w: r.width, h: r.height }, reveal);
		};
		const ro = new ResizeObserver(publish);
		ro.observe(lockup);
		window.addEventListener('resize', publish);
		publish();
		return {
			destroy() {
				ro.disconnect();
				window.removeEventListener('resize', publish);
				setStarKeepOut(null);
			}
		};
	}
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
		<!-- ⚓ Nate 2026-09-26: what shows where the world has not drawn (the
		     frames before the renderer is live, or for good if WebGL fails) is
		     the VEIL GROUND, so a cold load's veil lifts onto its own colours.
		     Unmounted once the renderer owns the frame — the canvas is opaque
		     and covers it, and a full-viewport SVG filter has no business
		     sitting under a live canvas. -->
		{#if !sceneHandle}
			<VeilGround />
		{/if}
		<canvas class="scene-canvas" class:failed={sceneFailed} bind:this={sceneCanvas}></canvas>

		<ShootingStars />
	</div>

	<div
		class="dim"
		class:occluded={$sceneOccluded}
		class:gl-owned={sceneHandle !== null}
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
		{#if !isToolPath(pathname) && !(nextOn && !TopBarC)}
			<!-- Under the switch the TOP BAR (build plan §13, 2b), once loaded:
			     nothing until then, rather than a flash of the old bar. -->
			<div
				class="scene-chrome"
				use:publishBrandBox
				in:fade={{ duration: FADE_DURATION_MS, delay: revealDelayMs() }}
				out:fade={{ duration: FADE_OUT_MS }}
			>
				{#if nextOn && TopBarC}<TopBarC />{:else}<SiteChrome />{/if}
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

		<!-- Above the pages and the tools, below both top-bar hosts (z 10). -->
		{#if MenuStateC && menu.open}<MenuStateC />{/if}
		{#if MoveDialogC && moveRequest.id}{#key moveRequest.id}<MoveDialogC
					id={moveRequest.id}
				/>{/key}{/if}
		{#if LinksDialogC && linksIntro.open}<LinksDialogC />{/if}
		<!-- Toasts and dialogs (notices §3.2, §3.4): one home on every surface. -->
		<NoticeRegion />
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
		/* ↻ 2026-10-14: 100lvh, with the scene layers below — see .scene. */
		--px: calc(100lvh * var(--viewport-aspect) / var(--frame-w-src));

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
		/* ↻ 2026-09-24 (⚓ Nate): sky 0.45 → 0.38, "just a little too heavy";
		   the floor untouched.
		   ↻ 2026-09-25 (⚓ Nate): sky 0.38 → 0.32, backed off a little more
		   with the brightened plate. */
		--sky-grain: 0.32;
		/* ↻ 2026-09-26 (⚓ Nate): floor 0.3 → 0.25, backed off a little with
		   the hazed plate. */
		--floor-grain: 0.25;

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
	/* 🧪 EXPERIMENT (⚓ Nate 2026-10-14): the WORLD takes Safari's LARGE
	   viewport, which does not change while its toolbars move — a
	   pull-to-refresh moved the toolbars, the dynamic height changed under the
	   canvas mid-gesture, and the scene stretched. The page content keeps the
	   dynamic height. Cost: the scene is bottom-anchored, so with Safari's
	   toolbars showing, the horizon sits one toolbar lower, partly behind it.
	   `inset: 0` would pin the bottom too, so the box is top-anchored here. */
	.scene,
	.dim {
		bottom: auto;
		height: 100lvh;
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

	/* See sceneFailed: an unmounted context would sit over the fallback as a
	   black rectangle. */
	.scene-canvas.failed {
		display: none;
	}

	.dim {
		z-index: 1;
		/* ↻⚓ NATE 2026-09-26: the dim is the scene renderer's FINAL PASS now
		   (sceneGL.ts FS_DIM; formula + values in sceneDim.ts), so this layer
		   only paints until the renderer is live — the pre-mount frames of a
		   cold tool load, and a browser with no WebGL (no scene to curve, so a
		   straight wash at SCENE_DIM.wash is the whole formula). --scene-dim is
		   the nearest hex of the renderer's exact tint (SCENE_DIM_TINT). */
		background: var(--scene-dim);
		/* ⛔ NO MASK. A shaped scrim was built here (ellipse, then a soft rounded
		   box from two intersected 1-D falloffs) and ⚓ NATE scrapped it after
		   driving it: "it doesn't really buy us anything meaningful compared to
		   a plain dim." One uniform wash — don't rebuild the shape. What made
		   glass and bare text stop competing turned out to be BLUR, not
		   geometry; the argument is on TOOL_DIM in transition.ts. */
		pointer-events: none;
		/* Initial opacity is set inline at SSR time (style:opacity above);
		   WAAPI takes over via the sceneLayer action after hydration. */
		will-change: opacity;
	}

	/* The renderer owns the dim once it is live — painting this too would dim
	   the world twice. display (not visibility): nothing measures it, and the
	   WAAPI ride keeps running harmlessly on an unrendered box. */
	.dim.gl-owned {
		display: none;
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
	/* Under the switch (2c): above the menu state (z 9), which the top bar sits
	   on. Scoped, so nothing moves with the switch off. */
	:global(:root[data-next]) .scene-chrome {
		z-index: 10;
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

	/* A SHORT screen's page carries the footer at the END of its panel instead
	   (the pages layout), so the fixed one steps aside there. ↻ The landing's
	   too (responsive sweep item 6, ⚓ Nate 2026-10-15): on a landscape phone
	   the cards and the notices ran into the legal line, and the line is still
	   met at the end of every page (About included) on a short screen.
	   (max-height: 30rem): breakpoints.ts § THE HEIGHT AXIS; the literal,
	   because custom properties do not work in media queries. */
	@media (max-height: 30rem) {
		.scene-footer {
			display: none;
		}
	}

	/* Full-frame dark gradient beneath the footer (dark navy → transparent),
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
		/* ↻ 2026-09-26 (⚓ Nate): was rgba(2, 9, 31, 1) → rgba(3, 6, 16, 0),
		   with the re-graded plate; then #0d1124 → transparent; then the veil
		   ground's top colour (--veil-ground-top, #06080f) at 60% → 0, so it
		   blends with both the landing scene AND the VeilGround fallback that
		   shows where the plate never drew. Written as a literal because an
		   alpha on a var() would need a color-mix. */
		background: linear-gradient(to top, #06080f99, #06080f00);
	}
</style>
