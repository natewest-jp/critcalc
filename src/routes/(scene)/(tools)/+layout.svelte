<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		FADE_OUT_MS,
		hasActivePortal,
		portalTimeUntilBlackout,
		registerToolReveal,
		startPortalTransition,
		getHeroOrigin,
		prefersReducedMotion,
		sceneOccluded
	} from '$lib/landing/transition';
	import DireBorder from './lib/DireBorder.svelte';
	import SiteChrome from '$lib/components/SiteChrome.svelte';
	import ChromeModals from '$lib/components/ChromeModals.svelte';
	import { TOOLS } from './lib/toolChrome';
	import { prewarmPlannerCharacters } from './lib/prewarmPlanner';

	let { children } = $props();

	// Chrome identity derives from the route; the nav lists every tool and marks
	// the current one (see the centered switcher in the chrome strip).
	const tool = $derived(TOOLS.find((t) => page.url.pathname.startsWith(t.path)));

	// Reveal state. While the portal spins, the shell stays visibility:hidden —
	// laid out (so editors still measure) but UNPAINTED — so it never shows at the
	// portal's growing edges and its own entry animations play unseen under the
	// black. The portal DRIVES the reveal: at full black it calls our registered
	// callback, waits until we're painted opaque, then fades its backing off us —
	// that backing fade is the single tool fade-in (dark-to-dark). Cold load /
	// reduced motion / no portal → visible immediately.
	let revealed = $state(!hasActivePortal());

	onMount(() => {
		if (revealed) return; // cold load — already visible
		if (prefersReducedMotion()) {
			revealed = true;
			return;
		}
		// Mounted after the portal already blacked out (very slow mount) → just show.
		if (portalTimeUntilBlackout() <= 0) {
			revealed = true;
			return;
		}
		// Otherwise let the portal un-suppress us at full black (handshake).
		return registerToolReveal(() => (revealed = true));
	});

	// Scene occlusion report (perf audit F4): two rAFs after the shell is
	// revealed it is PAINTED opaque (#000, inset:0) over the scene — the same
	// double-frame guarantee the portal reveal handshake uses — so the scene
	// layout can unpaint its layers and release their textures. Re-asserted on
	// every completed navigation within the tools layout (the path dependency),
	// which re-hides the scene if a cancelled exit to the landing restored it;
	// a cancelled exit with no follow-up nav just leaves the scene rastered
	// behind the opaque shell — correct, merely not minimal. The scene layout
	// itself flips this false on the way back to the landing.
	$effect(() => {
		void page.url.pathname;
		if (!revealed) return;
		let raf = requestAnimationFrame(() => {
			raf = requestAnimationFrame(() => sceneOccluded.set(true));
		});
		return () => cancelAnimationFrame(raf);
	});

	// Return to the landing via the reverse portal: the spiral collapses back down
	// to THIS tool's hero card (wherever the click happened), then the navigation
	// runs at full black so the landing swaps in unseen. The card center was
	// captured on the forward click; a cold load straight into the tool has none,
	// so the portal falls back to screen-center.
	function returnToLanding(event: MouseEvent) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		const origin = getHeroOrigin(page.url.pathname);
		startPortalTransition('/', origin, () => goto(resolve('/')));
	}

	// Exit fallback: a plain opacity fade for any non-portal departure (the portal
	// owns the reverse and covers the swap, so this is effectively invisible then).
	function plainExit(_node: HTMLElement) {
		return { duration: FADE_OUT_MS, css: (t: number) => `opacity: ${t}` };
	}

	// Tool→tool cross-fade. Rather than the View Transitions API (which snapshots
	// the whole viewport — and WebKit chokes on snapshotting the heavy, animated
	// Dire border, freezing then hard-cutting), we key the routed page on its path
	// and cross-fade the two page layers. The Dire border lives OUTSIDE .tool-main,
	// so it keeps animating live throughout — nothing is snapshotted, so every
	// engine behaves identically.
	//
	// The fade is PAINT-GATED, not wall-clock. Svelte's fade() starts its clock at
	// mount, so a heavy mount (the planner's ~200ms instantiation block on WebKit)
	// silently eats the first chunk of the fade and the content snaps in at partial
	// opacity. Instead the incoming page mounts at opacity 0, waits for its first
	// real paint (double rAF — the portal reveal handshake's trick), and only then
	// do both layers cross-fade via CSS transitions. The mount block plays out
	// behind the old page at full opacity (a brief hold that reads as "loading"),
	// and the fade always runs its full arc. Skipping fade() also skips its
	// getComputedStyle(node).opacity read, which forced a synchronous style recalc
	// of the freshly-mounted planner subtree (42ms of the Chrome nav block in the
	// 2026-07-10 profile).
	//
	// ⚠️ Orchestration lives in afterNavigate, NOT in per-element actions/module
	// state, because outroing keyed blocks can be REVIVED: navigate A→B→A within
	// the retention window and Svelte cancels A's outro and reinserts the SAME
	// element — still carrying whatever inline styles it faded out with, and
	// without re-running `use:` actions. A one-shot action scheme left revived
	// pages stuck at opacity 0 (the "navigates to an empty shell" bug).
	// afterNavigate runs on every navigation regardless of element freshness, so
	// every pass re-derives each layer's role (incoming = data-page matches the
	// new pathname; everything else outgoing) and restyles all of them.
	const XFADE_MS = 500;
	const XFADE_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'; // cubicInOut
	// Directional slide (simplification chunk 3): the tools sit left-to-right in
	// TOOLS order (TB / RP / Visualizers), so a tool→tool navigation PANS the
	// page-layer pair sideways instead of cross-fading — the outgoing page exits
	// toward its own side of the order and the incoming one sweeps in from the
	// other, edges passing at the seam (the TB bench and the RP portrait column
	// mirror each other there — the continuity the pan implies). Same paint/
	// settle gating as the fade; transform-only, so it stays compositor-side.
	// Both layers ride 100vw (the layer width), leaving a constant 2×pad gutter
	// between them mid-pan — reads as panels with a gap, by design.
	// A full-viewport pan wants to read as a camera move, not a snap — but the
	// first tuning (1200ms, a gentler in-out) overshot into sluggish, so the
	// retune (Nate 2026-07-26) cut a third off the clock AND front-loaded the
	// curve: ~80% of the distance is covered in the first half of the run, so
	// the pan arrives early and settles quietly instead of cruising. Duration
	// AND curve are Nate's, hand-tuned in the inspector over several rounds
	// (quintInOut: too much build-up; sineInOut: a touch flat). Treat the
	// numbers as design, not derivation.
	// EVERYTHING keyed to this motion derives from these two constants — the
	// layer transitions, the nav underline's glide, the de-promote timer. Only
	// probe-tool-slide.mjs samples the pan from the outside, and it polls for
	// the mid-flight state rather than assuming a wall-clock offset.
	const SLIDE_MS = 800;
	const SLIDE_EASE = 'cubic-bezier(0.33, 0, 0.18, 1)'; // Nate's hand-tuned in-out
	const toolIndex = (path: string | null | undefined) =>
		path == null ? -1 : TOOLS.findIndex((t) => path.startsWith(t.path));
	// Retention budget for the outgoing layer: it must outlast worst-case
	// mount-block hold (settle cap 450ms) + the longest motion (the slide), and
	// it doubles as the A→B→A revival window. Deliberately left at 2500 through
	// the slide retune — the motion now finishes by ~1250ms worst case, so the
	// surplus is pure revival headroom. Only delays teardown of the (inert,
	// off-screen) old subtree — not user-visible.
	const HOLD_MAX_MS = 2500;

	let toolMain: HTMLDivElement | undefined = $state();

	// Sliding nav underline: the current link's position within the nav, kept
	// fresh per route (and after webfont load — Bitter's metrics shift the
	// offsets). w=0 until first measurement → the bar is invisible and the
	// static ::after fallback shows instead, so SSR paints an underline with no
	// flash. The FIRST measurement places the bar untransitioned (it must not
	// glide in from x=0); transitions arm one frame later.
	let navEl: HTMLElement | undefined = $state();
	let underline = $state({ x: 0, w: 0 });
	let underlineAnimates = $state(false);

	function measureUnderline() {
		const cur = navEl?.querySelector<HTMLElement>('.chrome-nav-link.is-current');
		if (!cur) return;
		underline = { x: cur.offsetLeft, w: cur.offsetWidth };
	}

	$effect(() => {
		void tool; // re-measure on every route change
		measureUnderline();
		if (!underlineAnimates && !prefersReducedMotion()) {
			requestAnimationFrame(() => (underlineAnimates = true));
		}
	});

	onMount(() => {
		// Font swap after hydration re-metrics the labels; re-measure once settled.
		document.fonts?.ready.then(measureUnderline);
	});

	// out: keeps the outgoing page in the DOM (Svelte marks it inert) under the
	// incoming one, and revivable if the user navigates straight back. Opacity is
	// driven by the afterNavigate orchestration — this emits no styles of its own.
	function holdPage(_node: Element) {
		return { duration: prefersReducedMotion() ? 0 : HOLD_MAX_MS };
	}

	// use: stamps the page layer with the pathname it was created for. Actions run
	// once per element, so a revived layer keeps its original stamp — which is
	// exactly what lets afterNavigate recognize it as the incoming page again.
	function stampPage(node: HTMLElement) {
		node.dataset.page = page.url.pathname;
	}

	// Kick the planner's character-payload fetches at click time so they land
	// before the cross-fade instead of re-parsing the rotation mid-fade
	// (see prewarmPlanner.ts).
	beforeNavigate((nav) => {
		if (nav.to?.url.pathname.startsWith('/rotation-planner')) prewarmPlannerCharacters();
	});

	afterNavigate((nav) => {
		// 'enter' = initial load (cold load / portal reveal owns that path). A lone
		// page layer means nothing to cross-fade (e.g. landing→tool, where the old
		// DOM lives outside this layout).
		if (nav.type === 'enter' || prefersReducedMotion() || !toolMain) return;
		const pages = [...toolMain.querySelectorAll<HTMLElement>(':scope > .tool-page')];
		if (pages.length < 2) return;
		const path = page.url.pathname;
		const matches = pages.filter((p) => p.dataset.page === path);
		const incoming = matches[matches.length - 1] ?? pages[pages.length - 1];
		const outgoing = pages.filter((p) => p !== incoming);

		// Pan direction from the tool order: +1 = destination lies to the RIGHT
		// (content sweeps left), −1 mirrored, 0 = either side unknown → the
		// plain cross-fade handles it.
		const fromIdx = toolIndex(nav.from?.url.pathname);
		const toIdx = toolIndex(path);
		const dir = fromIdx >= 0 && toIdx >= 0 ? Math.sign(toIdx - fromIdx) : 0;

		// Freeze the incoming layer BEFORE the first paint of the new route: a
		// fresh mount starts hidden; a revived layer (caught mid-fade-out) holds
		// its current opacity so the fade-in resumes from there, not from a pop.
		// will-change promotes both layers NOW, so WebKit builds/rasters their
		// compositor layers during the mount paint (behind the held old page)
		// instead of at fade start — measured 2026-07-10: starting the opacity
		// transition on unpromoted layers cost WebKit 60–90ms of layerization
		// right as the fade opened, stuttering it. Cleared after the fade (the
		// full-viewport retina layers are ~25MB each — the Dire-border texture
		// lesson says don't keep those alive).
		// 0.001, not 0: WebKit skips rasterizing a fully-transparent layer until
		// its opacity goes nonzero, which would land the raster cost (~40ms) at
		// fade start anyway. An imperceptible epsilon forces the raster to happen
		// here, pre-paint, with the layerization.
		incoming.style.willChange = dir ? 'transform, opacity' : 'opacity';
		incoming.style.transition = 'none';
		if (dir) {
			// Slide mode: a fresh mount parks off-screen on its entry side; a
			// revived layer (caught mid-slide-out) resumes from wherever its
			// matrix is right now instead of teleporting to the edge.
			incoming.style.transform =
				incoming.style.transform === ''
					? `translateX(${dir * 100}vw)`
					: getComputedStyle(incoming).transform;
		}
		incoming.style.opacity =
			incoming.style.opacity === '' ? '0.001' : getComputedStyle(incoming).opacity;
		for (const o of outgoing) o.style.willChange = dir ? 'transform' : 'opacity';

		// Paint-gate + settle-gate. The first rAF ticks put us past the new
		// route's first paint; then keep watching frame gaps until the main
		// thread has produced two consecutive clean frames before starting the
		// fade. WebKit runs 60–90ms of post-mount work (CodeMirror measure, the
		// timeline's first full style pass) 1–3 frames AFTER first paint —
		// starting the fade on paint alone let those blocks stutter its opening.
		// Capped so a persistently-busy page still fades. Chrome/FF settle on
		// the first ticks, so this adds ~1 extra frame of hold there.
		const SETTLE_GAP_MS = 24;
		const SETTLE_CAP_MS = 450;
		const t0 = performance.now();
		let lastTs = 0;
		let quietFrames = 0;
		const startFade = () => {
			if (dir) {
				// The pan. Opacity JUMPS to 1 untransitioned — the layer is still
				// off-screen (or mid-slide) when it happens, so there's no pop;
				// only transform animates. The outgoing layers stay fully opaque
				// and exit toward their own side: panels passing, not fading.
				incoming.style.transition = `transform ${SLIDE_MS}ms ${SLIDE_EASE}`;
				incoming.style.opacity = '1';
				incoming.style.transform = 'translateX(0)';
				for (const o of outgoing) {
					if (!o.isConnected) continue;
					// Exit side is ORDER-relative per layer, not one side for all:
					// besides the true outgoing page, `outgoing` can hold a STALE
					// third page from an earlier nav still inside its retention
					// window, parked off-screen. Blanket-animating everything to
					// the new exit side sent that layer streaking across the
					// viewport at double speed (RP→TB→Viz showed RP flying past —
					// Nate, 2026-07-25). Order-relative sides also park a stale
					// layer where a later revival would correctly enter from.
					const oIdx = toolIndex(o.dataset.page);
					const side = (oIdx >= 0 ? Math.sign(oIdx - toIdx) : 0) || -dir;
					// Already off-screen → park instantly; only layers currently
					// in (or partway across) the viewport get the animated exit.
					const cs = getComputedStyle(o).transform;
					const tx = cs === 'none' ? 0 : parseFloat(cs.split(',')[4]) || 0;
					const offscreen = Math.abs(tx) >= window.innerWidth - 1;
					o.style.transition = offscreen ? 'none' : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`;
					o.style.transform = `translateX(${side * 100}vw)`;
					if (offscreen) o.style.willChange = '';
				}
			} else {
				incoming.style.transition = `opacity ${XFADE_MS}ms ${XFADE_EASE}`;
				incoming.style.opacity = '1';
				for (const o of outgoing) {
					if (!o.isConnected) continue;
					o.style.transition = `opacity ${XFADE_MS}ms ${XFADE_EASE}`;
					o.style.opacity = '0';
				}
			}
			// De-promote the settled layer once the motion is over — but only if
			// this navigation still owns it (a newer pass re-promotes and
			// re-times). The transform/transition also clear so the settled page
			// is a plain static layer again.
			setTimeout(
				() => {
					if (page.url.pathname === path && incoming.isConnected) {
						incoming.style.willChange = '';
						incoming.style.transform = '';
						incoming.style.transition = '';
					}
				},
				(dir ? SLIDE_MS : XFADE_MS) + 100
			);
		};
		const tick = (ts: number) => {
			// A newer navigation owns the layers now — its own pass restyled them.
			if (page.url.pathname !== path || !incoming.isConnected) return;
			quietFrames = lastTs !== 0 && ts - lastTs < SETTLE_GAP_MS ? quietFrames + 1 : 0;
			lastTs = ts;
			if (quietFrames >= 2 || ts - t0 > SETTLE_CAP_MS) {
				startFade();
				return;
			}
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
</script>

<div class="tool-shell" class:revealed out:plainExit|global>
	<DireBorder />

	<!-- Tool chrome strip: the shared site chrome, with the tool switcher in its
	     center slot, riding the border's quiet top zone. Identical across all
	     tools — and, apart from the switcher, identical to the landing's. -->
	<div class="tool-chrome-mount">
		<SiteChrome onBrandClick={returnToLanding}>
			{#snippet center()}
				<nav
					class="chrome-nav"
					class:nav-measured={underline.w > 0}
					aria-label="Tools"
					bind:this={navEl}
				>
					{#each TOOLS as t (t.path)}
						{#if t === tool}
							<span class="chrome-nav-link is-current" aria-current="page">{t.short}</span>
						{:else}
							<a class="chrome-nav-link" href={resolve(t.path)}>{t.short}</a>
						{/if}
					{/each}
					<!-- The shared "you are here" underline: one bar gliding between links
					     on navigation, riding the page pan's own duration + easing. The
					     per-link ::after below is the SSR/pre-measure fallback; it hides
					     once this bar has a measured position (nav-measured). -->
					<span
						class="chrome-nav-underline"
						style:transform="translateX({underline.x}px)"
						style:width="{underline.w}px"
						style:transition={underlineAnimates
							? `transform ${SLIDE_MS}ms ${SLIDE_EASE}, width ${SLIDE_MS}ms ${SLIDE_EASE}`
							: 'none'}
					></span>
				</nav>
			{/snippet}
		</SiteChrome>
	</div>

	<div class="tool-main" bind:this={toolMain}>
		{#key page.url.pathname}
			<div class="tool-page" use:stampPage out:holdPage>
				{@render children()}
			</div>
		{/key}
	</div>
</div>

<!-- Meta overlays. Outside .tool-shell deliberately: the shell is the thing the
     portal reveals and fades, and nothing about a settings panel belongs to
     that choreography. No parallax here — the controller is idle on tool
     routes, where the scene is occluded. -->
<ChromeModals />

<style>
	.tool-shell {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* x hidden, not auto: the directional tool→tool slide translates page
		   layers a full viewport sideways — overflow-x:auto would mint a
		   horizontal scrollbar for the off-screen layer mid-slide. Tools never
		   scroll the shell horizontally (wide content scrolls in its own
		   containers), so nothing is lost. */
		overflow-x: hidden;
		overflow-y: auto;
		/* Tool background: plain black base under the Dire border edge treatment.
		   Opaque, so it covers the cosmic scene behind — the portal's black fades
		   out onto this (dark-to-dark) and the tool reads as fading in from black. */
		background: #000;

		/* Dire border knobs. These size the edge treatment ONLY — the content
		   paddings below are independent of them now (see the note there).
		   --dire (the edge hue) now lives in app.css :root so it can double as
		   the shared --accent; it cascades in here, so the border still reads it. */
		/* Border brightness + tint — HAND-TUNED BY NATE 2026-07-31; treat the
		   numbers as design, not derivation.
		   · --dire-edge — THE border tint: the CSS gradients, the GL ember
		     glow, the fade-top seam, AND the GL waves' hue/sat all derive from
		     it (wave lightnesses stay pinned in direBorderGL's layer defs). A
		     literal, NOT calc-in-relative-color — an unsupported calc would
		     invalidate the gradient backgrounds on older Safari. The first cut
		     was --dire at lightness ×1.35 (l62), but HSL trades chroma for
		     whiteness above l50 and it read washed/pale — the tune sits at the
		     chroma peak instead (s100 l50), hue nudged 340→336.
		   · --dire-edge-boost — multiplies the GL wave stops' pinned
		     lightnesses (crestL/edgeL in direBorderGL.ts layer defs).
		   Border-only on purpose: --dire itself is the tool-zone accent (~148
		   call sites) and stays untouched. */
		--dire-edge: hsl(336, 100%, 50%);
		--dire-edge-boost: 1.25;
		--dire-top-h: 100px;
		--dire-top-grad-h: 250px;
		--dire-bottom-h: 200px;
		--dire-bottom-grad-h: 350px;
		--dire-halftone-h: 200px;
		/* Scroll-under: per-layer wave opacity — how firmly each wave body
		   occludes content passing beneath (three layers stack, so the deep
		   body is effectively opaque). 0.9 is Nate's editor-tuned value; the
		   fill gradients live in the GL module's layer defs. */
		--dire-wave-cover: 0.9;
		/* Wave tile width: smaller = smaller waves but MUCH lighter compositor
		   textures (memory ∝ tile-w²), which is what curbs the eviction-flash +
		   scroll judder. Dial to taste (down from the 220vw default). */
		--dire-tile-w: 130vw;
		/* Wave speed: 1 = the tuned feel (the ×10 tuning is baked into the base
		   durations). Noise pace is its own knob — they never tune well together. */
		--dire-speed: 0.5;
		--dire-noise-dur: 9.9s;
		/* Scroll-under geometry: the chrome is fixed again, backed by the TOP
		   waves painting over content (DireBorder's over-stratum, z2) — the top
		   pad parks rest content just clear of the top fade's terminator (that
		   lands at 70px; --chrome-h + 0.5rem puts content at 72px), and
		   mid-scroll it passes under the wave silhouettes. --tool-pad-top stays
		   "breathing room below the chrome" (.tool-main adds --chrome-h itself;
		   viewport-height workspaces subtract both, unchanged). It clears the
		   FADE, not the waves: the tallest wave's crests bottom out at ~75–79px
		   where its height meets its canvas mark (viewports ~1250–1450px), so a
		   passing crest can still tint the top few px of the first content row
		   there — measured 2026-07-26. The pad tracks --chrome-h: when the bar
		   grew 56 → 64px (one chrome site-wide) the pad halved 1rem → 0.5rem to
		   hold that same 72px content top. The BOTTOM edge does not occlude
		   (content draws over it, as ever), so its pad is just breathing room
		   that lets some of the border show beneath content. */
		--tool-pad-top: 0.5rem;
		--tool-pad-bottom: 3rem;
		--tool-pad-x: clamp(1rem, 2vw, 2rem);
		/* Suppressed during the portal spin: laid out (editors measure correctly)
		   but visibility:hidden → UNPAINTED, off the raster pipeline and invisible
		   at the portal's edges. .revealed flips it visible at full black. */
		visibility: hidden;
		opacity: 0;
	}

	.tool-shell.revealed {
		visibility: visible;
		opacity: 1;
	}

	/* ── Chrome strip ──────────────────────────────────────────────────────── */

	/* Fixed mount for the shared chrome (SiteChrome renders in flow; every host
	   pins it — the scene layout's .scene-chrome is the counterpart).
	   Fixed strip, take two (scroll-under round): content now scrolls UNDER the
	   dire border's raised edge treatment and fades into the top scrim before it
	   reaches this strip, so the two obstruction complaints that un-fixed it
	   (Nate 2026-07-21) are both addressed — the scrim keeps the strip legible,
	   and the chrome's own pointer-events pass-through keeps it
	   click-transparent. */
	.tool-chrome-mount {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		pointer-events: none;
	}

	/* Centered tool switcher — every tool in Bitter. It renders into the shared
	   chrome's center slot, so the grid centering lives there; this only needs
	   position:relative, for the sliding underline to position against the nav
	   rather than the links. */
	.chrome-nav {
		position: relative;
		display: flex;
		align-items: center;
		gap: 1.5rem;
		pointer-events: auto;
	}

	.chrome-nav-link {
		position: relative;
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--muted);
		padding: 0.15rem 0;
		transition: color 150ms ease;
	}

	a.chrome-nav-link:hover,
	a.chrome-nav-link:focus-visible {
		color: var(--text);
	}

	/* The page you're on: brighter, non-interactive, and set apart from the
	   navigable tools by an accent underline — "you are here", not a link. */
	.chrome-nav-link.is-current {
		color: var(--text);
		cursor: default;
	}

	/* SSR/pre-measure fallback underline — identical geometry to the sliding
	   bar; hides the moment the bar has a measured position. */
	.chrome-nav-link.is-current::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 1px;
		height: 2px;
		border-radius: 1px;
		background: var(--accent);
	}
	.chrome-nav.nav-measured .chrome-nav-link.is-current::after {
		content: none;
	}

	/* The sliding underline. transform/width come inline (measured); the
	   transition is inline too, so it shares SLIDE_MS/SLIDE_EASE with the page
	   pan — chrome and content glide as one move. The nav's content box bottom
	   coincides with the links' (flex row, natural heights, no nav padding),
	   so bottom: 1px lands exactly where the ::after fallback sits. */
	.chrome-nav-underline {
		position: absolute;
		left: 0;
		bottom: 1px;
		height: 2px;
		border-radius: 1px;
		background: var(--accent);
		pointer-events: none;
	}

	.tool-main {
		position: relative;
		z-index: 1;
		width: 100%;
		min-height: 100%;
		padding: calc(var(--chrome-h) + var(--tool-pad-top)) var(--tool-pad-x) var(--tool-pad-bottom);
		/* Single-cell grid so the outgoing + incoming page layers stack in the same
		   spot during the cross-fade — grid stacking rather than absolute positioning,
		   so the cell grows with content and page-scrolling tools keep scrolling. */
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}

	.tool-page {
		grid-area: 1 / 1;
		min-width: 0;
	}

	/* Narrow: the switcher tightens on the same breakpoint where the shared
	   chrome drops its wordmark, so the three tool labels keep clear of the
	   brand and the glyph cluster. Kept here rather than in SiteChrome because
	   this markup is ours — it renders into the chrome's center slot, and
	   Svelte scopes styles to where the markup is authored. */
	@media (max-width: 40rem) {
		.chrome-nav {
			gap: 0.9rem;
		}

		.chrome-nav-link {
			font-size: var(--fs-lg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chrome-nav-link {
			transition: none;
		}
	}
</style>
