<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import {
		FADE_DURATION_MS,
		FADE_OUT_MS,
		TOOL_NAV_MS,
		TILT_EASING_CSS,
		toolPoseShift,
		sceneTransitionStart,
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

	// Tool→tool transition — WORLD-LOCKED FADE (Nate 2026-08-05, replacing the
	// full-width slide). The scene is the one reference frame: on a tool→tool
	// navigation the GL camera cranes between the tools' crest poses (a couple
	// hundred px of world on screen — the scene doesn't hold three tool-widths
	// of terrain, and a full-viewport slide sheared against it), and each tool
	// surface is LOCKED to the world: it drifts by exactly the camera's
	// screen-space pose delta (toolPoseShift) while fading out/in. Two layers
	// site-wide: world-locked things (the tool frames) and screen-locked HUD
	// (the ribbon, chrome, underline). Continuity across the fade is the
	// RIBBON, which simply never moves — both tools dock it at the same screen
	// spot (bench left · work center · filters right, one grammar) and the
	// working team persists opaque while the world sweeps behind it.
	//
	// Mechanics:
	// - Transforms ride WAAPI with startTime pinned to the SCENE transition's
	//   own start (sceneTransitionStart — the camera kicked off at
	//   beforeNavigate), so the drift is glued to the terrain regardless of
	//   when each layer's animation is created. Curve + duration are the
	//   camera's (TILT_EASING_CSS / TOOL_NAV_MS — the tool-leg clock).
	// - The outgoing fade starts immediately (it is already painted). The
	//   incoming fade is PAINT-GATED as ever: a heavy mount (the planner's
	//   ~200ms WebKit block) must not eat the fade's first frames — the layer
	//   holds at opacity 0 until two quiet frames (cap 450ms), then fades on
	//   the shared clock, never earlier than TOOL_FADE_IN_DELAY_MS after it.
	// - Fades are LINEAR (the sitewide fade law) and faster than the pan, so
	//   surfaces clear during the gentle first leg of the camera's ease.
	//
	// ⚠️ Orchestration lives in afterNavigate, NOT in per-element actions/module
	// state, because outroing keyed blocks can be REVIVED: navigate A→B→A within
	// the retention window and Svelte cancels A's outro and reinserts the SAME
	// element — which KILLS its CSS transitions/animations and keeps its inline
	// styles. afterNavigate runs on every navigation regardless of element
	// freshness, so every pass re-derives each layer's role and re-animates.
	const TOOL_NAV_ANIM = 'tool-nav';
	// Fade knobs — RATIO-derived from the tool-leg clock (⚓ NATE 2026-08-05:
	// TOOL_NAV_MS/3 ≈ 667ms, landing where his 700ms browser tune sat; the
	// ascend's fades stay TRANSITION_MS/4 = 600 — up to ~100ms of cross-leg
	// fade disparity is accepted, and dropping TOOL_NAV_MS to 1800 would
	// restore parity if it ever grates). Plus a 150ms beat of pure world
	// between the outgoing clearing and the incoming's entrance.
	const TOOL_FADE_OUT_MS = Math.round(TOOL_NAV_MS / 3);
	const TOOL_FADE_IN_MS = Math.round(TOOL_NAV_MS / 3);
	const TOOL_FADE_IN_DELAY_MS = TOOL_FADE_OUT_MS + 150;
	// The world clock for tool↔tool legs (TOOL_NAV_MS in transition.ts — it
	// drives the camera's crane on these legs too; retune it there and the
	// camera, drift, underline and dependent timers all move together).
	const SLIDE_MS = TOOL_NAV_MS;
	const SLIDE_EASE = TILT_EASING_CSS;
	// Retention budget for the outgoing layer: outlasts the transition window
	// (camera 2400 + fade-in tail + settle pass) and doubles as the A→B→A
	// revival window. Only delays teardown of the (inert, invisible) old
	// subtree — not user-visible.
	const HOLD_MAX_MS = 4000;

	/** Cancel this layout's WAAPI animations on a layer, optionally baking the
	 *  current values into inline style first (transition.ts's pattern). */
	function cancelToolNavAnims(el: HTMLElement, commit = false) {
		for (const a of el.getAnimations()) {
			if (a.id !== TOOL_NAV_ANIM) continue;
			if (commit) {
				try {
					a.commitStyles();
				} catch {
					// Element detached or value non-interpolable — safe to skip.
				}
			}
			a.cancel();
		}
	}

	let toolMain: HTMLDivElement | undefined = $state();

	// ---------------------------------------------------------------------------
	// The bench RIBBON: ONE slot-card box for both benched tools, rendered
	// here — OUTSIDE the keyed page layers — as screen-locked HUD. Both tools
	// dock it at the SAME screen spot (bench left, one grammar), so across a
	// tool navigation it simply persists, opaque and motionless, while the
	// world-locked frames fade beneath it — the continuity of the transition.
	// It docks over a [data-bench-anchor] gutter
	// each benched page reserves (planner: the label column's card cells; TB:
	// the bench zone's left edge). Position is measured from the real anchor and
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
	let benchHeight = $state(0);
	let benchTravelTimer: ReturnType<typeof setTimeout> | undefined;
	// Set by benchNavTransition on a dockless→docked leg; fired from startFadeIn
	// with the incoming PAGE fade's actual startTime, so the ribbon's entrance
	// fade shares the page's paint gate — a slow planner mount delays both
	// together instead of the ribbon appearing before its tool.
	let benchGatedFadeIn: ((startTime: number) => void) | null = null;

	/** The current anchor rect for `path`, in .tool-main coordinates,
	 *  compensating the page layer's own pan transform (a parked or mid-slide
	 *  layer measures displaced by exactly its translateX). The rect already
	 *  reflects any internal scroll of the anchor's zone — measuring IS the
	 *  scroll mirror; the zone's scroll events just ask for a re-measure.
	 *  HEIGHT is part of the contract now (tall-bench round): each dock
	 *  stretches with its tool frame, so the strip's height is measured, never
	 *  summed from the cards. */
	function measureBenchAnchor(
		path: string
	): { x: number; y: number; h: number; anchorEl: HTMLElement } | null {
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
		// ROUNDED to whole pixels — the ribbon carries text, and WebKit snaps
		// glyphs to whole pixels while boxes keep sub-pixel positions, so every
		// label inside the strip sits up to a pixel off its own control in
		// Safari and by a DIFFERENT amount wherever the dock happens to land
		// (measured: a full pixel of glyph range across one pixel of dock
		// offset — scripts/probe-ink-centering.mjs has the numbers and the
		// method). Rounding makes that deterministic, so the cards' optical
		// nudges can be tuned to the font alone.
		//
		// The X axis is already whole by construction — --tool-pad-x rounds in
		// the layout, which is strictly better because the dock stays exactly
		// co-located with the frame it measures. This is the guard for any
		// future fractional layout, and it is the REAL fix on Y, where the
		// fraction comes from the text line boxes above the frame and can't be
		// rounded at the source (RP measured 97.109 against the TB's 97.375 —
		// a quarter pixel that WebKit could turn into a whole-pixel glyph jump
		// on arrival; rounding lands both docks on the same integer).
		//
		// Rounded HERE, at the one measurement boundary, so the WAAPI drift
		// target and the rest position are the same number — round only at rest
		// and the strip lands, then ticks by up to half a pixel at settle.
		// Nothing abuts the strip vertically (it stands RIBBON_OVERHANG_Y proud
		// at both ends), so Y and H have no seam to break.
		return {
			x: Math.round(ar.left - mr.left - tx),
			y: Math.round(ar.top - mr.top),
			h: Math.round(ar.height),
			anchorEl: anchor
		};
	}

	/** The dock grows and shrinks with its tool WITHOUT a window resize — the
	 *  planner's frame changes height on every notation edit, zoom, notes
	 *  toggle and tab-bar wrap. One observer, re-pointed whenever the docked
	 *  anchor changes. (Re-measuring can't resize the anchor — the strip is
	 *  absolutely positioned, out of the page's flow — so there is no loop.) */
	let benchRO: ResizeObserver | undefined;
	let benchROTarget: HTMLElement | undefined;
	function observeBenchAnchor(el: HTMLElement) {
		if (benchROTarget === el) return;
		if (typeof ResizeObserver === 'undefined') return;
		benchRO ??= new ResizeObserver(() => {
			if (!benchTraveling) snapBench();
		});
		benchRO.disconnect();
		benchRO.observe(el);
		benchROTarget = el;
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
		benchMount.style.opacity = '';
		benchHeight = a.h;
		benchVisible = true;
		observeBenchAnchor(a.anchorEl);
	}

	/** The ribbon during a tool navigation. Between two DOCKED tools it is
	 *  screen-locked HUD: it simply DOES NOT MOVE — both docks share one screen
	 *  spot, and the persistent opaque ribbon (same place, same team) IS the
	 *  continuity across the fade. Its card heights still relax between the
	 *  tools' rhythms on the world clock.
	 *
	 *  On a leg where one side has no dock (Visualizers), the ribbon is part of
	 *  the TOOL SURFACE instead (Nate 2026-08-06, replacing the fade-in-place):
	 *  it drifts by the camera's pose delta while fading, glued to the
	 *  departing/arriving frame — the page layers' exact recipe, WAAPI with
	 *  startTime pinned to the scene clock.
	 *
	 *  Everything here rides WAAPI (id TOOL_NAV_ANIM) rather than CSS
	 *  transitions, and that is ALSO the pop-in fix: a running animation
	 *  outranks inline style, so the ResizeObserver's snapBench — which fires
	 *  on observe() of a fresh anchor and again on every mount-time frame
	 *  resize — can no longer stomp an entrance fade to full opacity. */
	function benchNavTransition(fromPath: string, toPath: string, clock: number) {
		if (!benchMount) return;
		const mount = benchMount;
		clearTimeout(benchTravelTimer);
		benchGatedFadeIn = null;
		const target = measureBenchAnchor(toPath);
		const shift = toolPoseShift(fromPath, toPath);
		// Interrupts: bake whatever the previous leg left mid-flight, then
		// re-animate from there on a fresh full clock (the layers' own pattern).
		cancelToolNavAnims(mount, true);
		if (target) {
			const wasDocked = benchVisible;
			const dock = `translate(${target.x}px, ${target.y}px)`;
			if (!wasDocked) {
				// Entering from a dockless tool: dock hidden, drift in glued to
				// the incoming frame (−shift → 0 on the pinned clock), and fade
				// on the incoming PAGE's own gated fade-in (benchGatedFadeIn).
				// The 0-duration fill:forwards animation is a stomp-proof
				// opacity floor for the paint-gate window before the fade exists.
				mount.style.transform = dock;
				mount.style.opacity = '0';
				benchVisible = true;
				mount.animate([{ opacity: 0 }], { duration: 0, fill: 'forwards', id: TOOL_NAV_ANIM });
				const drift = mount.animate(
					[{ transform: `translate(${target.x - shift}px, ${target.y}px)` }, { transform: dock }],
					{ duration: SLIDE_MS, easing: SLIDE_EASE, fill: 'both', id: TOOL_NAV_ANIM }
				);
				drift.startTime = clock;
				benchGatedFadeIn = (startTime) => {
					const fade = mount.animate([{ opacity: 0 }, { opacity: 1 }], {
						duration: TOOL_FADE_IN_MS,
						fill: 'both',
						id: TOOL_NAV_ANIM
					});
					fade.startTime = startTime;
				};
			} else {
				// Docked→docked: nothing moves — both one-keyframe animations run
				// current→current in the normal case. They exist for interrupts:
				// a Viz leg cut short leaves the ribbon baked mid-drift/mid-fade,
				// and these glide it back to dock and back to opaque on the world
				// clock instead of stranding it there until settle.
				const drift = mount.animate([{ transform: dock }], {
					duration: SLIDE_MS,
					easing: SLIDE_EASE,
					fill: 'forwards',
					id: TOOL_NAV_ANIM
				});
				drift.startTime = clock;
				const fade = mount.animate([{ opacity: 1 }], {
					duration: TOOL_FADE_IN_MS,
					fill: 'forwards',
					id: TOOL_NAV_ANIM
				});
				fade.startTime = clock;
			}
			// Heights: relax between the tools' rhythms on the world clock when
			// docked throughout; snap when arriving from a DOCKLESS tool — the
			// strip is fading in at its new height, and growing it mid-fade
			// would read as the box inflating.
			benchTraveling = wasDocked;
			benchHeight = target.h;
			observeBenchAnchor(target.anchorEl);
			benchTravelTimer = setTimeout(
				() => {
					benchTraveling = false;
					cancelToolNavAnims(mount, false);
					mount.style.opacity = '';
					snapBench();
				},
				Math.max(0, clock + SLIDE_MS - performance.now()) + 100
			);
		} else if (benchVisible) {
			// Exiting toward a dockless tool: world-locked drift by the pose
			// delta + the linear fade-out, glued to the departing frame.
			const t = getComputedStyle(mount).transform;
			const m = t === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(t);
			const drift = mount.animate([{ transform: `translate(${m.e + shift}px, ${m.f}px)` }], {
				duration: SLIDE_MS,
				easing: SLIDE_EASE,
				fill: 'forwards',
				id: TOOL_NAV_ANIM
			});
			drift.startTime = clock;
			const fade = mount.animate([{ opacity: 0 }], {
				duration: TOOL_FADE_OUT_MS,
				fill: 'forwards',
				id: TOOL_NAV_ANIM
			});
			fade.startTime = clock;
			benchTravelTimer = setTimeout(
				() => {
					if (!measureBenchAnchor(page.url.pathname)) {
						benchVisible = false;
						cancelToolNavAnims(mount, false);
						mount.style.opacity = '';
					} else {
						// A newer nav re-docked us before this fired — defensive.
						snapBench();
					}
				},
				Math.max(0, clock + TOOL_FADE_OUT_MS - performance.now()) + 100
			);
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
		return () => {
			benchRO?.disconnect();
			benchRO = undefined;
			benchROTarget = undefined;
		};
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
		const fromPath = nav.from?.url.pathname ?? '';

		// The world's screen-space delta for this leg, and the scene's own
		// clock (the camera started at beforeNavigate). Pinning every WAAPI
		// startTime to `clock` glues the drift to the terrain regardless of
		// when each animation is created; if no scene transition is in flight
		// (edge cases), the drift just runs on its own matching clock.
		const shift = toolPoseShift(fromPath, path);
		const clock = sceneTransitionStart() ?? performance.now();

		// Interrupts: bake whatever the previous leg left mid-flight, then
		// re-animate from there. (A REVIVED layer's animations died with its
		// reinsertion and its inline styles hold the old leg's baked values —
		// the two-keyframe drift below repositions it regardless.)
		for (const p of pages) cancelToolNavAnims(p, true);

		// ── Outgoing: starts NOW. It is already painted and the camera is
		// already moving — waiting for the incoming's paint gate would visibly
		// detach it from the world. World-locked drift to its pose delta +
		// linear fade-out (the fade law: clears during the ease's gentle first
		// leg).
		//
		// ⚠ EVERY non-incoming layer gets the fade, not just the one we came
		// from (bug, 2026-08-06). The bake pass above writes each layer's
		// MID-FLIGHT opacity into its inline style; a third layer — one whose
		// own fade-out was interrupted by this navigation before it finished —
		// used to be skipped here as "already invisible", which is only true if
		// it had time to finish. Interrupt a leg ~300ms in and the previous
		// tool stayed pinned at its baked opacity (measured: 0.24) until
		// Svelte's HOLD_MAX_MS retention finally removed it — a ghost tool
		// hanging over/under the new one for a second or two, with no pattern
		// the user could pin down because it needs two fast navigations in a
		// row. z-index goes on every outgoing layer too: a stale one could
		// still be carrying the '2' it was given while it was the incoming, and
		// paint OVER the tool that replaced it.
		for (const o of outgoing) {
			if (!o.isConnected) continue;
			o.style.willChange = 'transform, opacity';
			o.style.zIndex = '1';
			// Drift belongs to the leg being left: only the layer we came FROM
			// is world-locked to this pose delta. A stale layer already carries
			// a baked transform from an older leg, and re-targeting it to this
			// leg's shift would jump it sideways on its way out.
			if (o.dataset.page === fromPath) {
				const drift = o.animate([{ transform: `translateX(${shift}px)` }], {
					duration: SLIDE_MS,
					easing: TILT_EASING_CSS,
					fill: 'forwards',
					id: TOOL_NAV_ANIM
				});
				drift.startTime = clock;
			}
			// One-keyframe fade: the implicit start is the layer's underlying
			// value, so a stale layer resumes from whatever it was baked at
			// rather than flashing back to full.
			const fade = o.animate([{ opacity: 0 }], {
				duration: TOOL_FADE_OUT_MS,
				fill: 'forwards',
				id: TOOL_NAV_ANIM
			});
			fade.startTime = clock;
		}

		// ── Incoming: world-locked from the start (it drifts −shift → 0 on the
		// pinned clock so its position is correct the moment it becomes
		// visible), but INVISIBLE until the paint gate below opens its fade.
		// will-change promotes it NOW so WebKit builds/rasters the compositor
		// layer during the mount paint instead of at fade start (measured
		// 2026-07-10: unpromoted layers cost 60–90ms of layerization right as
		// the fade opened). Cleared at settle — the full-viewport retina
		// layers are ~25MB each; don't keep them promoted.
		incoming.style.willChange = 'transform, opacity';
		incoming.style.zIndex = '2';
		incoming.style.transition = 'none';
		incoming.style.opacity = '0';
		incoming.style.transform = '';
		const drift = incoming.animate(
			[{ transform: `translateX(${-shift}px)` }, { transform: 'translateX(0px)' }],
			{
				duration: SLIDE_MS,
				easing: TILT_EASING_CSS,
				fill: 'forwards',
				id: TOOL_NAV_ANIM
			}
		);
		drift.startTime = clock;

		// The ribbon: persists in place across docked↔docked legs (both tools
		// dock it at the same screen spot); fades in place at the world clock
		// for legs where one side has no dock.
		benchNavTransition(fromPath, path, clock);

		// Paint-gate + settle-gate for the INCOMING's fade-in. The first rAF
		// ticks put us past the new route's first paint; then keep watching
		// frame gaps until the main thread has produced two consecutive clean
		// frames. WebKit runs 60–90ms of post-mount work (CodeMirror measure,
		// the timeline's first full style pass) 1–3 frames AFTER first paint —
		// fading on paint alone let those blocks stutter its opening. Capped so
		// a persistently-busy page still fades.
		const SETTLE_GAP_MS = 24;
		const SETTLE_CAP_MS = 450;
		const t0 = performance.now();
		let lastTs = 0;
		let quietFrames = 0;
		const startFadeIn = () => {
			const fade = incoming.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: TOOL_FADE_IN_MS,
				fill: 'forwards',
				id: TOOL_NAV_ANIM
			});
			// Sequenced on the shared clock (begin as the outgoing ends), but
			// never before the page has actually painted — the gate that got us
			// here. A future startTime simply waits.
			const fadeStart = Math.max(performance.now(), clock + TOOL_FADE_IN_DELAY_MS);
			fade.startTime = fadeStart;
			// The ribbon's entrance fade (dockless→docked legs) shares this exact
			// startTime — the band and its tool clear the paint gate together.
			benchGatedFadeIn?.(fadeStart);
			benchGatedFadeIn = null;
			const settleAt =
				Math.max(clock + SLIDE_MS, fadeStart + TOOL_FADE_IN_MS) - performance.now() + 100;
			// Settle: bake + release. The incoming rests at natural layout; the
			// outgoing stays baked invisible through its retention window.
			setTimeout(() => {
				if (page.url.pathname !== path || !incoming.isConnected) return;
				cancelToolNavAnims(incoming, true);
				incoming.style.willChange = '';
				incoming.style.zIndex = '';
				incoming.style.transition = '';
				incoming.style.transform = '';
				incoming.style.opacity = '';
				for (const o of outgoing) {
					if (!o.isConnected) continue;
					cancelToolNavAnims(o, true);
					o.style.willChange = '';
					o.style.zIndex = '';
				}
				snapBench();
			}, settleAt);
		};
		const tick = (ts: number) => {
			// A newer navigation owns the layers now — its own pass re-animates.
			if (page.url.pathname !== path || !incoming.isConnected) return;
			quietFrames = lastTs !== 0 && ts - lastTs < SETTLE_GAP_MS ? quietFrames + 1 : 0;
			lastTs = ts;
			if (quietFrames >= 2 || ts - t0 > SETTLE_CAP_MS) {
				startFadeIn();
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
				height={benchHeight}
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
		/* ROUNDED to whole pixels, deliberately. This pad is the tool frames'
		   left edge, and the bench ribbon docks by measuring an anchor inside
		   that frame — so a fractional pad puts the whole strip at a fractional
		   x, and WebKit snaps glyphs to whole pixels while boxes keep sub-pixel
		   positions. Every label inside the ribbon then sits up to a pixel off
		   its own control in Safari, and by a DIFFERENT amount at every window
		   width (measured: 2vw gave 27.313 @1366, 28.797 @1440, 30.234 @1512 —
		   a full pixel of glyph range across one pixel of dock offset; see
		   scripts/probe-ink-centering.mjs). Rounding HERE rather than at the
		   ribbon's transform is what makes it free: the dock stays exactly
		   co-located with the frame it measures, so nothing in the tool-
		   transition machinery changes and no probe moves. Only widths under
		   1600 were ever affected — above that the clamp pins it at 2rem.
		   First declaration is the fallback for engines without round(). */
		--tool-pad-x: clamp(1rem, 2vw, 2rem);
		--tool-pad-x: clamp(1rem, round(2vw, 1px), 2rem);
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
