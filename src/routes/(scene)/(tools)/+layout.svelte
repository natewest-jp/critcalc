<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import {
		FADE_DURATION_MS,
		FADE_OUT_MS,
		hasActiveSceneTransition,
		revealDelayMs,
		prefersReducedMotion
	} from '$lib/landing/transition';
	import SiteChrome from '$lib/components/SiteChrome.svelte';
	import ChromeModals from '$lib/components/ChromeModals.svelte';
	import BenchBand from '$lib/components/BenchBand.svelte';
	import { TOOLS } from './lib/toolChrome';
	import { prewarmPlannerCharacters } from './lib/prewarmPlanner';
	import { rotationTabs } from '$lib/rotationTabs.svelte';
	import { savedNotations } from '$lib/stores';

	let { children } = $props();

	// ---------------------------------------------------------------------------
	// Working-team lifecycle (bench-band round). The tab model lives in the
	// shared rotationTabs module; its restore + persistence belong HERE — the
	// layout stays mounted across every tool, and the Team Builder edits the
	// working team while the planner page is unmounted. Restore runs in onMount
	// (after hydration, before the next paint) so SSR markup and first client
	// paint stay deterministic.
	// ---------------------------------------------------------------------------

	onMount(() => {
		rotationTabs.restore();
	});

	// Auto-persist: persist() reads every persisted field, so this effect
	// re-runs on any tab-state change. Writes only to localStorage — never to
	// $state — so there's no circular reactivity.
	$effect(() => {
		rotationTabs.persist();
	});

	// Sync tab labels when save-bank entries are renamed from the overlay.
	// untrack() on the tabs read means only $savedNotations is a reactive
	// dependency, so a tab rename (which also calls savedNotations.rename)
	// doesn't re-enter this.
	$effect(() => {
		const bank = $savedNotations;
		rotationTabs.tabs = untrack(() => rotationTabs.tabs).map((t) => {
			if (!t.savedId) return t;
			const entry = bank.find((e) => e.id === t.savedId);
			if (!entry || entry.name === t.label) return t;
			return { ...t, label: entry.name };
		});
	});

	// Chrome identity derives from the route; the nav lists every tool and marks
	// the current one (see the centered switcher in the chrome strip).
	const tool = $derived(TOOLS.find((t) => page.url.pathname.startsWith(t.path)));

	// Reveal state (ascend choreography v2). Arriving via the camera pan, the
	// shell stays visibility:hidden — laid out (so editors still measure) but
	// UNPAINTED, off the raster pipeline — through most of the climb: a DevTools
	// trace (2026-06) showed the tool's one-time raster + its old entry fade
	// were the sole source of pan judder. Near settle `revealed` flips, which
	// makes the shell visible and runs a plain LINEAR CSS-opacity fade-in over
	// the crest sky, ending FADE_OVERLAP_MS past settle (the shared fade law —
	// the landing composition mirrors it on the way down). Cold load / reduced
	// motion / no transition → visible immediately.
	//
	// ⚠ TOOLS-OVER-SCENE EXPERIMENT (dire-retirement round, Nate 2026-08-05):
	// the shell is TRANSPARENT now — the live scene stays painted and animating
	// beneath the tools, so the scene-occlusion report (perf audit F4: two rAFs
	// after `covered`, sceneOccluded.set(true), scene releases ~90MB of
	// textures) is retired along with the `covered` state that gated it. The
	// precedent that says this is affordable: the previous setup ran the dire
	// border's three live GL canvases under every tool while the (occluded)
	// starfield merely paused. If tool-route perf regresses on real hardware,
	// this report is the first thing to bring back — transition.ts still
	// exports the store and the scene layout still honors it.
	let revealed = $state(!hasActiveSceneTransition());

	onMount(() => {
		if (revealed) return; // cold load — already visible
		if (prefersReducedMotion()) {
			revealed = true;
			return;
		}
		const timer = setTimeout(() => (revealed = true), revealDelayMs());
		return () => clearTimeout(timer);
	});

	// Exit: a plain opacity fade on any departure to a non-tool route. The
	// scene layout's beforeNavigate has already restored the scene and started
	// the camera descend by the time this outro runs, so the shell fades out
	// onto the moving world — the descend plays behind it. (The brand mark is
	// a plain link now; no interception needed.)
	function plainExit(_node: HTMLElement) {
		return { duration: FADE_OUT_MS, css: (t: number) => `opacity: ${t}` };
	}

	// Tool→tool cross-fade. Rather than the View Transitions API (which snapshots
	// the whole viewport — WebKit choked on snapshotting the heavy animated Dire
	// border, the original disqualifier; retired 2026-08-05, but the snapshot
	// model stays wrong for us: nothing here should freeze mid-transition), we
	// key the routed page on its path and cross-fade the two page layers —
	// nothing is snapshotted, so every engine behaves identically.
	//
	// The fade is PAINT-GATED, not wall-clock. Svelte's fade() starts its clock at
	// mount, so a heavy mount (the planner's ~200ms instantiation block on WebKit)
	// silently eats the first chunk of the fade and the content snaps in at partial
	// opacity. Instead the incoming page mounts at opacity 0, waits for its first
	// real paint (the double-rAF painted-frame trick), and only then
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
	// other, edges passing at the seam. Same paint/
	// settle gating as the fade; transform-only, so it stays compositor-side.
	// Distances (ribbon round, 2026-08-05): RP↔TB legs ride the RIBBON's
	// dock-to-dock distance — the ribbon sits at the seam of the virtual sheet
	// [atlas | ribbon | timeline], so ribbon and both tools pan as one rigid
	// body (see the panDist derivation in afterNavigate). Legs to/from the
	// Visualizers (no ribbon) ride the full viewport width as before.
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

	// ---------------------------------------------------------------------------
	// The bench band (bench-band round): ONE slot-card column for both benched
	// tools, rendered here — OUTSIDE the keyed page layers — so it survives
	// navigation and TRAVELS across the screen on the pan clock instead of
	// panning away with its tool. It docks over a [data-bench-anchor] gutter
	// each benched page reserves (planner: the label column's card cells; TB:
	// the bench zone's spacer). Position is measured from the real anchor and
	// applied as a transform in .tool-main coordinates — the band lives inside
	// the scrolled subtree, so it rides page scroll exactly like the gutter
	// beneath it (the planner's page scrolls; alignment under scroll is free).
	// ---------------------------------------------------------------------------

	const benchMode = $derived(
		tool?.path === '/rotation-planner' ? 'rp' : tool?.path === '/team-builder' ? 'tb' : null
	);

	let benchMount: HTMLDivElement | undefined = $state();
	let benchVisible = $state(false);
	let benchTraveling = $state(false);
	let benchTravelTimer: ReturnType<typeof setTimeout> | undefined;

	/** The current anchor position for `path`, in .tool-main coordinates,
	 *  compensating the page layer's own pan transform (a parked or mid-slide
	 *  layer measures displaced by exactly its translateX). The rect already
	 *  reflects any internal scroll of the anchor's zone — measuring IS the
	 *  scroll mirror; the zone's scroll events just ask for a re-measure. */
	function measureBenchAnchor(
		path: string
	): { x: number; y: number; anchorEl: HTMLElement } | null {
		if (!toolMain) return null;
		const pages = [...toolMain.querySelectorAll<HTMLElement>(':scope > .tool-page')];
		// Latest layer stamped with this path wins (matches the pan's own rule).
		const layer = pages.filter((p) => p.dataset.page === path).pop();
		const anchor = layer?.querySelector<HTMLElement>('[data-bench-anchor]');
		if (!layer || !anchor) return null;
		const ar = anchor.getBoundingClientRect();
		const mr = toolMain.getBoundingClientRect();
		const cs = getComputedStyle(layer).transform;
		const tx = cs === 'none' ? 0 : parseFloat(cs.split(',')[4]) || 0;
		return { x: ar.left - mr.left - tx, y: ar.top - mr.top, anchorEl: anchor };
	}

	/** Park the ribbon on the current page's dock, untransitioned. The no-dock
	 *  case (Visualizers, or a page that hasn't rendered yet) hides it. The
	 *  ribbon is a self-contained sibling now — it never scrolls or clips with
	 *  a frame zone (the TB zone starts its own scroll viewport BELOW the
	 *  ribbon instead; the old scroll-mirror/clip machinery retired with the
	 *  ribbon round). */
	function snapBench() {
		if (!benchMount) return;
		const a = measureBenchAnchor(page.url.pathname);
		if (!a) {
			benchVisible = false;
			return;
		}
		benchMount.style.transition = 'none';
		benchMount.style.transform = `translate(${a.x}px, ${a.y}px)`;
		benchVisible = true;
	}

	function benchCurrentXY(): { x: number; y: number } {
		if (!benchMount) return { x: 0, y: 0 };
		const cs = getComputedStyle(benchMount).transform;
		if (cs === 'none') return { x: 0, y: 0 };
		const parts = cs.split(',');
		return { x: parseFloat(parts[4]) || 0, y: parseFloat(parts[5]) || 0 };
	}

	/** The ribbon's leg of a tool pan — called from startFade so it rides the
	 *  exact same clock AND the same distance as the page layers (the rigid
	 *  sheet: on RP↔TB legs `panDist` is the dock-to-dock distance, so the
	 *  ribbon has zero motion relative to either tool).
	 *  - both tools docked → glide from the current dock to the new one
	 *  - into a docked tool → enter glued to the incoming page's motion
	 *  - out of docked tools → exit glued to the outgoing page's motion */
	function travelBench(dir: number, path: string, panDist: number) {
		if (!benchMount) return;
		const target = measureBenchAnchor(path);
		const glide = `transform ${SLIDE_MS}ms ${SLIDE_EASE}`;
		clearTimeout(benchTravelTimer);
		if (target) {
			if (!benchVisible) {
				// Enter riding the incoming layer: park at the dock displaced by the
				// layer's own parked offset, then release on the shared clock.
				benchMount.style.transition = 'none';
				benchMount.style.transform = `translate(${target.x + dir * panDist}px, ${target.y}px)`;
				void benchMount.getBoundingClientRect(); // flush the park before transitioning
				benchVisible = true;
			}
			benchMount.style.transition = dir ? glide : 'none';
			benchMount.style.transform = `translate(${target.x}px, ${target.y}px)`;
			benchTraveling = true;
			benchTravelTimer = setTimeout(() => {
				benchTraveling = false;
				// Re-dock precisely (layout may have settled further).
				snapBench();
			}, SLIDE_MS + 100);
		} else if (benchVisible) {
			// Exit with the pan: the same delta the outgoing layer travels, so the
			// ribbon reads as still docked to its departing frame.
			const cur = benchCurrentXY();
			benchMount.style.transition = dir ? glide : 'none';
			benchMount.style.transform = `translate(${cur.x - dir * panDist}px, ${cur.y}px)`;
			benchTravelTimer = setTimeout(() => {
				if (!measureBenchAnchor(page.url.pathname)) benchVisible = false;
			}, SLIDE_MS + 100);
		}
	}

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
		// First bench-band placement — the page subtree mounted before us, so
		// the anchor is measurable; this runs pre-paint.
		snapBench();
		// Font swap after hydration re-metrics the labels; re-measure once
		// settled (Bitter's metrics shift both the underline and the frame top).
		document.fonts?.ready.then(() => {
			measureUnderline();
			snapBench();
		});
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
		// 'enter' = initial load (cold load / ascend reveal owns that path). A lone
		// page layer means nothing to cross-fade (e.g. landing→tool, where the old
		// DOM lives outside this layout). Whenever the pan orchestration doesn't
		// run, the bench band just snaps to the new page's dock post-render.
		if (nav.type === 'enter' || prefersReducedMotion() || !toolMain) {
			requestAnimationFrame(snapBench);
			return;
		}
		const pages = [...toolMain.querySelectorAll<HTMLElement>(':scope > .tool-page')];
		if (pages.length < 2) {
			requestAnimationFrame(snapBench);
			return;
		}
		const path = page.url.pathname;
		const matches = pages.filter((p) => p.dataset.page === path);
		const incoming = matches[matches.length - 1] ?? pages[pages.length - 1];
		const outgoing = pages.filter((p) => p !== incoming);

		// Pan direction from the tool order: +1 = destination lies to the RIGHT
		// (content sweeps left), −1 mirrored, 0 = either side unknown → the
		// plain cross-fade handles it.
		const fromPath = nav.from?.url.pathname ?? '';
		const fromIdx = toolIndex(fromPath);
		const toIdx = toolIndex(path);
		const dir = fromIdx >= 0 && toIdx >= 0 ? Math.sign(toIdx - fromIdx) : 0;

		// Pan distance (ribbon round): when BOTH legs dock the ribbon (RP↔TB),
		// the pages translate by the dock-to-dock distance instead of 100vw —
		// the ribbon sits at the SEAM of the virtual sheet [atlas|ribbon|
		// timeline], so ribbon and both tools move as ONE rigid body and the
		// ribbon lands with zero motion relative to its siblings. The price is
		// a deliberate overlap: each page carries its own copy of the
		// under-ribbon dock region, so mid-pan the incoming page's dock strip
		// rides above the outgoing's (z below) — both are tucked-under frame
		// edges, and the ribbon covers most of the overlap. Legs to/from
		// Visualizers (no dock) keep the full-viewport distance. Docks are
		// measured BEFORE any parking so both layers read untransformed.
		const fromDock = dir ? measureBenchAnchor(fromPath) : null;
		const toDock = dir ? measureBenchAnchor(path) : null;
		const panDist = dir && fromDock && toDock ? Math.abs(toDock.x - fromDock.x) : window.innerWidth;

		// Freeze the incoming layer BEFORE the first paint of the new route: a
		// fresh mount starts hidden; a revived layer (caught mid-fade-out) holds
		// its current opacity so the fade-in resumes from there, not from a pop.
		// will-change promotes both layers NOW, so WebKit builds/rasters their
		// compositor layers during the mount paint (behind the held old page)
		// instead of at fade start — measured 2026-07-10: starting the opacity
		// transition on unpromoted layers cost WebKit 60–90ms of layerization
		// right as the fade opened, stuttering it. Cleared after the fade (the
		// full-viewport retina layers are ~25MB each — the retired Dire border
		// taught that oversized live compositor textures get Safari-evicted;
		// don't keep them alive).
		// 0.001, not 0: WebKit skips rasterizing a fully-transparent layer until
		// its opacity goes nonzero, which would land the raster cost (~40ms) at
		// fade start anyway. An imperceptible epsilon forces the raster to happen
		// here, pre-paint, with the layerization.
		incoming.style.willChange = dir ? 'transform, opacity' : 'opacity';
		incoming.style.transition = 'none';
		if (dir) {
			// Slide mode: a fresh mount parks off-screen (or, on a rigid-sheet
			// leg, at the sheet distance — its dock strip pre-overlaps the
			// outgoing page, invisible at opacity 0.001) on its entry side; a
			// revived layer (caught mid-slide-out) resumes from wherever its
			// matrix is right now instead of teleporting to the edge.
			incoming.style.transform =
				incoming.style.transform === ''
					? `translateX(${dir * panDist}px)`
					: getComputedStyle(incoming).transform;
			// Rigid-sheet legs OVERLAP the layers mid-pan; the incoming page
			// rides above so the shared dock region reads as one surface.
			incoming.style.zIndex = '2';
		}
		incoming.style.opacity =
			incoming.style.opacity === '' ? '0.001' : getComputedStyle(incoming).opacity;
		for (const o of outgoing) {
			o.style.willChange = dir ? 'transform' : 'opacity';
			if (dir) o.style.zIndex = '1';
		}

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
			// The ribbon's leg rides the exact same clock + distance as the layers.
			travelBench(dir, path, panDist);
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
					// The TRUE outgoing page exits by the sheet distance (it stays
					// rigid with the ribbon; on a rigid-sheet leg its dock strip
					// remains under the ribbon at settle, parked out fully by the
					// settle pass below). Stale third layers park at the full
					// viewport width — they must actually leave.
					const dist = o.dataset.page === fromPath ? panDist : window.innerWidth;
					// Already off-screen → park instantly; only layers currently
					// in (or partway across) the viewport get the animated exit.
					const cs = getComputedStyle(o).transform;
					const tx = cs === 'none' ? 0 : parseFloat(cs.split(',')[4]) || 0;
					const offscreen = Math.abs(tx) >= window.innerWidth - 1;
					o.style.transition = offscreen ? 'none' : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`;
					o.style.transform = `translateX(${side * dist}px)`;
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
			// is a plain static layer again. On rigid-sheet legs the outgoing
			// page only traveled the sheet distance — its dock strip is still
			// on-screen beneath the ribbon — so the settle pass parks every
			// outgoing layer the rest of the way out (untransitioned; the strip
			// it vacates is covered by the incoming page's own dock).
			setTimeout(
				() => {
					if (page.url.pathname === path && incoming.isConnected) {
						incoming.style.willChange = '';
						incoming.style.transform = '';
						incoming.style.transition = '';
						incoming.style.zIndex = '';
					}
					if (page.url.pathname !== path) return;
					for (const o of outgoing) {
						if (!o.isConnected) continue;
						const oIdx = toolIndex(o.dataset.page);
						const side = (oIdx >= 0 ? Math.sign(oIdx - toIdx) : 0) || -dir;
						const cs = getComputedStyle(o).transform;
						const tx = cs === 'none' ? 0 : parseFloat(cs.split(',')[4]) || 0;
						if (dir && Math.abs(tx) < window.innerWidth - 1) {
							o.style.transition = 'none';
							o.style.transform = `translateX(${side * window.innerWidth}px)`;
						}
						o.style.zIndex = '';
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

<div
	class="tool-shell"
	class:revealed
	style:--tool-fade="{FADE_DURATION_MS}ms"
	out:plainExit|global
>
	<!-- Tool chrome strip: the shared site chrome, with the tool switcher in its
	     center slot. Identical across all tools — and, apart from the switcher,
	     identical to the landing's. -->
	<div class="tool-chrome-mount">
		<SiteChrome>
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

		<!-- The bench band — one slot-card column, docked over the current
		     tool's [data-bench-anchor] gutter and gliding between docks on the
		     pan clock. Inside .tool-main so it scrolls with the page it's
		     docked to; above the page layers so it stays interactive. -->
		<div
			class="bench-band-mount"
			bind:this={benchMount}
			style:visibility={benchVisible ? 'visible' : 'hidden'}
		>
			<BenchBand
				mode={benchMode}
				traveling={benchTraveling}
				travelMs={SLIDE_MS}
				travelEase={SLIDE_EASE}
			/>
		</div>
	</div>
</div>

<svelte:window onresize={snapBench} />

<!-- Meta overlays. Outside .tool-shell deliberately: the shell is the thing
     the ascend reveals and fades, and nothing about a settings panel belongs
     to that choreography. -->
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
		/* TRANSPARENT — the tools float over the live scene (tools-over-scene
		   experiment, Nate 2026-08-05: no shell ground, no dim overlay; the
		   PANELS are what's opaque). The occlusion handshake retired with the
		   opacity — see the script comment. */
		background: transparent;

		/* Layout pads. --tool-pad-top is breathing room below the fixed chrome
		   (.tool-main adds --chrome-h itself; viewport-height workspaces
		   subtract both). 0.5rem holds content at the 72px top the site-chrome
		   probe pins; the dire border's fade-terminator rationale for that
		   number retired with the border — retune freely. The bottom pad lets
		   content end clear of the viewport edge. */
		--tool-pad-top: 0.5rem;
		--tool-pad-bottom: 3rem;
		--tool-pad-x: clamp(1rem, 2vw, 2rem);
		/* Suppressed through the ascend: laid out (editors measure correctly)
		   but visibility:hidden → UNPAINTED, off the raster pipeline, so the
		   shell's one-time raster never competes with the camera pan. .revealed
		   flips near settle and runs the fade-in (duration set inline from
		   FADE_DURATION_MS; linear per the shared fade law). Cold loads render
		   with .revealed already set — no transition runs on initial paint. */
		visibility: hidden;
		opacity: 0;
	}

	.tool-shell.revealed {
		visibility: visible;
		opacity: 1;
		transition: opacity var(--tool-fade, 0ms) linear;
	}

	/* ── Chrome strip ──────────────────────────────────────────────────────── */

	/* Fixed mount for the shared chrome (SiteChrome renders in flow; every host
	   pins it — the scene layout's .scene-chrome is the counterpart).
	   Fixed strip, take two (scroll-under round, 2026-07-24): originally backed
	   by the dire border's top waves + scrim; the border retired 2026-08-05, so
	   content now scrolls directly beneath the strip. ⚠ Strip legibility over
	   scrolled content was the complaint that un-fixed it once before (Nate
	   2026-07-21) — if it recurs, the fix is a chrome backing on the new
	   ground, not un-fixing. Pointer-events pass-through keeps it
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

	/* Chrome voice (Genshin-UI archetype): the switcher is site chrome, so it
	   speaks --chrome white and follows the chrome state contract (SiteChrome:
	   rest 0.85-translucent, hover/current opaque). Alpha on TEXT is fine —
	   the alpha law governs surfaces. */
	.chrome-nav-link {
		position: relative;
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: color-mix(in srgb, var(--chrome) 85%, transparent);
		padding: 0.15rem 0;
		transition: color 150ms ease;
	}

	a.chrome-nav-link:hover,
	a.chrome-nav-link:focus-visible {
		color: var(--chrome);
	}

	/* The page you're on: brighter, non-interactive, and set apart from the
	   navigable tools by an accent underline — "you are here", not a link. */
	.chrome-nav-link.is-current {
		color: var(--chrome);
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

	/* The bench band's mount: absolutely positioned in .tool-main coordinates
	   (the scrolled subtree), placed purely by transform so the travel stays
	   compositor-side. Above the page layers — it is the interactive bench;
	   the pages only reserve its footprint. */
	.bench-band-mount {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 3;
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
