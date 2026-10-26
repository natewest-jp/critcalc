<script lang="ts">
	import { scrollFade } from '$lib/actions/scrollFade';
	import { onMount, untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { resolve } from '$app/paths';
	import { dev } from '$app/environment';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import {
		FADE_DURATION_MS,
		FADE_OUT_MS,
		TOOL_NAV_MS,
		TILT_EASING_CSS,
		toolPoseShift,
		sceneTransitionStart,
		sceneTransitionWindow,
		hasActiveSceneTransition,
		revealDelayMs,
		prefersReducedMotion
	} from '$lib/landing/transition';
	import SiteChrome from '$lib/components/SiteChrome.svelte';
	import ChromeModals from '$lib/components/ChromeModals.svelte';
	import BenchBand from '$lib/components/BenchBand.svelte';
	import LibraryOverlay from '$lib/components/LibraryOverlay.svelte';
	import { library } from '$lib/library.svelte';
	import { registerRosterOpener } from '$lib/components/chromeModal.svelte';
	import TabLimitDialog from '$lib/components/TabLimitDialog.svelte';
	import { notices, heldKey } from '$lib/notices.svelte';
	import { nextLayout } from '$lib/nextLayout';
	import { T_QUICK } from '$lib/motion';
	import type { storageSession as StorageSessionT } from '$lib/storage/session.svelte';
	import type TopBarT from '$lib/components/TopBar.svelte';
	import { TOOLS } from './lib/toolChrome';
	import { prewarmPlannerCharacters } from './lib/prewarmPlanner';
	import { rotationTabs } from '$lib/rotationTabs.svelte';
	import { boards } from '$lib/boards.svelte';
	import { documentBar } from '$lib/documentBar.svelte';
	import ReportLink from '$lib/components/ReportLink.svelte';
	import { feedbackToolForPath } from '$lib/feedback';
	import { savedNotations, siteSettings } from '$lib/stores';
	import { TOOL_GUTTER } from '$lib/toolGutter';
	import { benchBand } from '$lib/benchBand.svelte';
	import { attachMediaFlags, below, benchRowHidden } from '$lib/media.svelte';
	import { getSceneGL, setStarVeil } from '$lib/landing/sceneGL';
	import type { StarVeilSet } from '$lib/landing/starPass';
	import { STAR_VEIL_SIDES_BELOW, type VeilBox } from '$lib/landing/starVeil';

	let { children } = $props();

	// ---------------------------------------------------------------------------
	// Working-team lifecycle (bench-band round). The tab model lives in the
	// shared rotationTabs module; its restore + persistence belong HERE — the
	// layout stays mounted across every tool, and the Team Builder's ⇄ errand
	// writes the Planner's tab while the planner page is unmounted. Restore runs in onMount
	// (after hydration, before the next paint) so SSR markup and first client
	// paint stay deterministic.
	// ---------------------------------------------------------------------------

	// ⚓ Under the switch (build plan §13, phase 2a) the documents come from the
	// new store instead: the profile's current rotation and lineup, autosaved.
	// Loaded on demand, so with the switch off none of it is downloaded.
	let session = $state<typeof StorageSessionT | null>(null);

	// ⚓ THE TWO-TAB RULE (§13.3), as a BANNER (notices §3.3): the document on
	// screen is held by another tab, so this one is read-only. The warning can
	// be put away for the session (two tabs side by side on a stream); an edit
	// calls it back (`rotationTabs.canEdit`). A new hold shows it again.
	$effect(() => {
		const s = session;
		const id =
			tool?.path === '/builder'
				? boards.activeBoardId
				: tool?.path === '/planner'
					? rotationTabs.activeTabId
					: null;
		if (!s || !id || !s.readOnly.includes(id)) return;
		const key = heldKey(id);
		const editHere = () => s.editHere(id);
		notices.banner({
			key,
			kind: 'warning',
			lead: 'Open in another tab.',
			body: 'This tab can look but not change it.',
			actions: [{ label: 'Edit here', run: editHere }],
			dismissable: true
		});
		if (tool?.path === '/planner') rotationTabs.held = { editHere };
		return () => {
			notices.clearBanner(key);
			rotationTabs.held = null;
		};
	});
	/** The top bar (phase 2b), loaded with the session. While the switch is on
	 *  and it has not arrived, the chrome mount shows NOTHING rather than
	 *  flashing the old bar. */
	let TopBarC = $state<typeof TopBarT | null>(null);
	const nextOn = get(nextLayout);

	onMount(() => {
		benchBand.noBandA = nextOn;
		if (nextOn) {
			void import('$lib/components/TopBar.svelte').then((m) => (TopBarC = m.default));
			void import('$lib/storage/session.svelte').then(async ({ storageSession }) => {
				await storageSession.start();
				session = storageSession;
			});
		} else {
			rotationTabs.restore();
			// After the tabs: a board team's link is checked against them.
			boards.restore();
		}

		// The breakpoint flags (responsive round, 2026-09-05) — what the bench
		// ribbon reads to pick its orientation and the Team Builder reads to
		// fold its band B. Attached HERE because this layout outlives every
		// tool page. The CSS halves of those decisions are pure @media blocks
		// on the same literals and need nothing from this; when the ribbon's
		// dock changes shape the ResizeObserver on it re-measures, so nothing
		// here has to call snapBench either.
		return attachMediaFlags();
	});

	// Auto-persist: persist() reads every persisted field, so this effect
	// re-runs on any tab-state change. Writes only to localStorage — never to
	// $state — so there's no circular reactivity.
	$effect(() => {
		rotationTabs.persist();
	});
	$effect(() => {
		boards.persist();
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
	// (the ribbon, chrome, underline). ↻ Only the Planner docks the ribbon
	// since the lineups round (2026-10-08), so every leg that involves it is
	// docked↔dockless and it rides the tool surface — see benchNavTransition.
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
	//
	// ↻ UNDER THE SWITCH (phase 2f, design §5.5; ⚓ Nate 2026-10-22): every tool
	// sits at the Planner's pose, so a tool-to-tool leg has no camera move and
	// no drift — a tool CHANGES IN PLACE, on a short fade of its own (the
	// crane-era values above stay the switch-off site's). 🎛️ Knobs for Nate:
	// out on the SURFACE band (--t-quick), in a touch slower so the new tool
	// settles rather than pops, no beat between them.
	//
	// ↻ 2026-10-25 (⚓ Nate): a CROSSFADE. The sequenced fades dipped to the
	// night between the two tools, and at this speed the dip read as a flicker.
	// With no drift there is nothing to shear, so the tools overlap. The OLD
	// tool HOLDS, fully lit, until the new one passes its paint gate (a slow
	// mount shows the old tool, not the night), then both fade on ONE start.
	// The fades stay LINEAR — the fade law (2026-05-30, ⚓ Nate: an eased fade's
	// visible time is not its duration; an ease-out in reads ~40% shorter
	// than a linear out). ↻ An eased pair (ease-out in, ease-in out) was tried
	// the same day: it holds the light where both tools put glass in one
	// place (in + (1 − in)·out — two linear fades dip to 75% at the midpoint,
	// the pair ~94%), and Nate kept linear, at the full-screen state's speed
	// (--t-quick), where a dip that short barely reads.
	// 🎛️ Knobs: CROSSFADE false restores the sequenced fades below.
	const INPLACE_CROSSFADE = true;
	const XFADE_MS = T_QUICK;
	const INPLACE_FADE_OUT_MS = T_QUICK;
	const INPLACE_FADE_IN_MS = 200;
	/** This leg crossfades (under the switch): both fades share one start. */
	const crossfade = nextOn && INPLACE_CROSSFADE;
	const TOOL_FADE_OUT_MS = crossfade
		? XFADE_MS
		: nextOn
			? INPLACE_FADE_OUT_MS
			: Math.round(TOOL_NAV_MS / 3);
	const TOOL_FADE_IN_MS = crossfade
		? XFADE_MS
		: nextOn
			? INPLACE_FADE_IN_MS
			: Math.round(TOOL_NAV_MS / 3);
	const TOOL_FADE_IN_DELAY_MS = crossfade ? 0 : nextOn ? TOOL_FADE_OUT_MS : TOOL_FADE_OUT_MS + 150;
	// The world clock for tool↔tool legs (TOOL_NAV_MS in transition.ts — it
	// drives the camera's crane on these legs too; retune it there and the
	// camera, drift, underline and dependent timers all move together). Under
	// the switch there is no crane, so the leg is just its two fades.
	const SLIDE_MS = crossfade ? XFADE_MS : nextOn ? TOOL_FADE_OUT_MS + TOOL_FADE_IN_MS : TOOL_NAV_MS;

	/** No tool-to-tool motion: the reader asked for less motion. The landing ↔
	 *  tool rise is not a tool-to-tool leg and keeps its own rule. ↻ 2026-10-25
	 *  (⚓ Nate): the Settings switch for tool transitions RETIRED — at the
	 *  full-screen state's speed the crossfade is no longer "fluff" worth an
	 *  opt-out, and the off path was misbehaving. */
	const toolMotionOff = (): boolean => prefersReducedMotion();
	const SLIDE_EASE = TILT_EASING_CSS;
	// Retention budget for the outgoing layer: outlasts the transition window
	// (camera, PAN_MS 2100 at most, + fade-in tail + settle pass) and doubles as the A→B→A
	// revival window. Only delays teardown of the (inert, invisible) old
	// subtree — not user-visible.
	const HOLD_MAX_MS = 4000;
	// Paint gate for the INCOMING layer's fade-in (used in afterNavigate, and by
	// the watchdog to bound how late a leg can legitimately still be fading).
	// The first rAF ticks put us past the new route's first paint; then frame
	// gaps are watched until the main thread has produced two consecutive clean
	// frames. WebKit runs 60–90ms of post-mount work (CodeMirror measure, the
	// timeline's first full style pass) 1–3 frames AFTER first paint — fading on
	// paint alone let those blocks stutter its opening. Capped so a
	// persistently-busy page still fades.
	const SETTLE_GAP_MS = 24;
	const SETTLE_CAP_MS = 450;

	/** Release a watchdog correction so this leg's fades can drive the layer
	 *  again — an `!important` pin outranks the animations the orchestration
	 *  runs on. Every pass calls this before it animates anything. */
	function clearWatchdogPin(el: HTMLElement) {
		if (el.style.getPropertyPriority('opacity') === 'important') {
			el.style.removeProperty('opacity');
		}
	}

	/** Cancel this layout's WAAPI animations on a layer, optionally baking the
	 *  current values into inline style first (transition.ts's pattern). */
	/** A departing layer's fade-out, from whatever opacity it holds now (a
	 *  one-keyframe animation), starting at `startTime` on the shared clock. */
	function fadeOut(el: HTMLElement, startTime: number) {
		const fade = el.animate([{ opacity: 0 }], {
			duration: TOOL_FADE_OUT_MS,
			fill: 'forwards',
			id: TOOL_NAV_ANIM
		});
		fade.startTime = startTime;
	}

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
	// The bench RIBBON: the Planner's slot cards, rendered here — OUTSIDE the
	// keyed page layers — so it outlives a page revival and rides the tool
	// pan on its own clock. It docks over the [data-bench-anchor] gutter
	// ToolStack reserves when `benched` (the label column's card cells).
	// Position is measured from the real anchor and
	// applied as a transform in .tool-main coordinates — the band lives inside
	// the scrolled subtree, so it rides page scroll exactly like the gutter
	// beneath it (the planner's page scrolls; alignment under scroll is free).
	// ---------------------------------------------------------------------------

	// ↻ 2026-10-08 (lineups design §2.1): the Team Builder has NO bench — it
	// builds several teams, so it cannot hold the Planner's one working team.
	// A crossing to it takes the ribbon away by the same path a crossing to the
	// Visualizers always has (the glide timing is Nate's, untouched).
	const benchMode = $derived(tool?.path === '/planner' ? 'rp' : null);

	let benchMount: HTMLDivElement | undefined = $state();
	let benchVisible = $state(false);
	// ↻ TAIL ROUND: `benchHeight`/`benchTraveling` retired with the stretch they
	// drove. The anchor is still measured, but only for x/y — see snapBench.

	let benchTravelTimer: ReturnType<typeof setTimeout> | undefined;
	// Set by benchNavTransition on a dockless→docked leg; fired from startFadeIn
	// with the incoming PAGE fade's actual startTime, so the ribbon's entrance
	// fade shares the page's paint gate — a slow planner mount delays both
	// together instead of the ribbon appearing before its tool.
	let benchGatedFadeIn: ((startTime: number) => void) | null = null;
	/** A crossfade's docked→dockless leg: the ribbon holds with its tool and
	 *  leaves on the incoming's gated start (startFadeIn calls it). */
	let benchGatedFadeOut: ((startTime: number) => void) | null = null;

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
	): { x: number; y: number; w: number; h: number; anchorEl: HTMLElement } | null {
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
		// rounded at the source (measured 97.109 on the planner — a quarter
		// pixel that WebKit could turn into a whole-pixel glyph jump on
		// arrival; rounding lands the dock on an integer).
		//
		// Rounded HERE, at the one measurement boundary, so the WAAPI drift
		// target and the rest position are the same number — round only at rest
		// and the strip lands, then ticks by up to half a pixel at settle.
		// Nothing abuts the strip vertically (it stands RIBBON_OVERHANG_Y proud
		// at both ends), so Y and H have no seam to break.
		return {
			x: Math.round(ar.left - mr.left - tx),
			y: Math.round(ar.top - mr.top),
			// WIDTH joined the contract with the row form (2026-09-05): a
			// horizontal strip spans whatever its tool spans, so the ribbon reads
			// it from the dock the way it always read its height's origin. The
			// column form ignores it (RIBBON_W is a constant).
			w: Math.round(ar.width),
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
			snapBench();
		});
		benchRO.disconnect();
		benchRO.observe(el);
		benchROTarget = el;
	}

	/** Park the ribbon on the current page's dock, untransitioned. The no-dock
	 *  case (the Builder, the Visualizers, or a page that hasn't rendered
	 *  yet) hides it. The
	 *  ribbon is a self-contained sibling now — it never scrolls or clips with
	 *  a frame zone (the old scroll-mirror/clip machinery retired with the
	 *  ribbon round). */
	function snapBench() {
		if (!benchMount) return;
		const a = measureBenchAnchor(page.url.pathname);
		if (!a) {
			benchVisible = false;
			return;
		}
		benchBand.dockW = a.w;
		benchMount.style.transition = 'none';
		benchMount.style.transform = `translate(${a.x}px, ${a.y}px)`;
		benchMount.style.opacity = '';
		benchVisible = true;
		observeBenchAnchor(a.anchorEl);
	}

	/** The ribbon during a tool navigation. ↻ Only the Planner has a dock
	 *  (lineups round, 2026-10-08), so every leg is docked↔dockless and the
	 *  ribbon is part of the TOOL SURFACE (Nate 2026-08-06, replacing the fade-in-place):
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
		benchGatedFadeOut = null;
		const target = measureBenchAnchor(toPath);
		const shift = toolPoseShift(fromPath, toPath);
		// Interrupts: bake whatever the previous leg left mid-flight, then
		// re-animate from there on a fresh full clock (the layers' own pattern).
		cancelToolNavAnims(mount, true);
		if (target) {
			benchBand.dockW = target.w;
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
				// Still visible on the way IN — only an INTERRUPT gets here now
				// (leave the planner, come back before the exit leg's timer hid
				// the ribbon): it is baked mid-drift/mid-fade, and these
				// one-keyframe animations glide it back to dock and back to opaque
				// on the world clock instead of stranding it there until settle.
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
			observeBenchAnchor(target.anchorEl);
			benchTravelTimer = setTimeout(
				() => {
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
			// The fade rides the departing tool's: at once when sequenced, on
			// the incoming's gated start when crossfading (it holds till then).
			const leave = (startTime: number) => {
				const fade = mount.animate([{ opacity: 0 }], {
					duration: TOOL_FADE_OUT_MS,
					fill: 'forwards',
					id: TOOL_NAV_ANIM
				});
				fade.startTime = startTime;
				clearTimeout(benchTravelTimer);
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
					Math.max(0, startTime + TOOL_FADE_OUT_MS - performance.now()) + 100
				);
			};
			if (crossfade) benchGatedFadeOut = leave;
			else leave(clock);
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

	// ---------------------------------------------------------------------------
	// THE STAR VEIL's content boxes ($lib/landing/starVeil.ts, 2026-10-18 ⚓
	// Nate): the stars sit at a floor behind the tool's CONTENT and rise over a
	// long feather everywhere else — under the chrome, the bands, the sides,
	// the foot. The content is the current page's SURFACE (ToolStack's
	// .tool-surface), split into ToolColumns' main and aside boxes where it has
	// them; ⛔ never the bands or the bench, which the feather is meant to run
	// under. Published in viewport px to the scene renderer, whose loop is
	// stopped behind tools, so every change that moves a box has to say so:
	//   · a ResizeObserver on the surface and its boxes (an aside opening
	//     narrows .tc-main, so the observer hears that too);
	//   · any scroll (capture phase — the planner page-scrolls, the
	//     Visualizers' tiles scroll inside);
	//   · the window, and the phone rule's breakpoint flipping.
	// Clipped to the viewport and rounded, then compared by the renderer, so a
	// scroll that moves nothing visible (a chart taller than the screen) costs
	// a measurement and no redraw.
	// On a navigation the change EASES across the scene transition's own
	// window (camera clock and easing); otherwise it lands in the next draw.
	// ⛔ Never published null on leaving: the veil rides the DIM's level, so
	// the descend fades it out by itself (see sceneGL's note).
	// ---------------------------------------------------------------------------
	let veilRO: ResizeObserver | undefined;
	let veilObserved: Element[] = [];

	function measureVeil(): StarVeilSet | null {
		if (!toolMain) return null;
		const pages = [...toolMain.querySelectorAll<HTMLElement>(':scope > .tool-page')];
		// The latest layer stamped with this path (the bench anchor's rule).
		const layer = pages.filter((p) => p.dataset.page === page.url.pathname).pop();
		const surface = layer?.querySelector<HTMLElement>('.tool-surface');
		if (!layer || !surface) return null;
		const cols = [...surface.querySelectorAll<HTMLElement>('.tc-main, .tc-aside-box')];
		const els: HTMLElement[] = cols.length ? cols : [surface];
		if (veilRO) {
			const next = [surface, ...cols];
			if (next.length !== veilObserved.length || next.some((el, i) => el !== veilObserved[i])) {
				veilRO.disconnect();
				for (const el of next) veilRO.observe(el);
				veilObserved = next;
			}
		}
		// A layer mid-leg carries its world-locked drift; measure where it RESTS.
		const cs = getComputedStyle(layer).transform;
		const tx = cs === 'none' ? 0 : new DOMMatrixReadOnly(cs).m41;
		const vw = window.innerWidth;
		const vh = getSceneGL()?.viewport().h ?? window.innerHeight;
		const boxes: VeilBox[] = [];
		for (const el of els) {
			const r = el.getBoundingClientRect();
			if (r.width <= 0 || r.height <= 0) continue;
			const x0 = Math.max(0, Math.round(r.left - tx));
			const x1 = Math.min(vw, Math.round(r.right - tx));
			const y0 = Math.max(0, Math.round(r.top));
			const y1 = Math.min(vh, Math.round(r.bottom));
			if (x1 > x0 && y1 > y0) boxes.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
		}
		return { boxes, sides: !below(STAR_VEIL_SIDES_BELOW) };
	}

	function publishVeil() {
		const set = measureVeil();
		if (set) setStarVeil(set, sceneTransitionWindow());
	}

	// ⚠ The observer only SCHEDULES a measurement, one frame out. Measuring in
	// its callback re-observes any box that just appeared (an aside opening),
	// and observing inside the callback queues a notification the same frame
	// cannot deliver — WebKit reports it as a page error ("ResizeObserver loop
	// completed with undelivered notifications"); e2e caught it, 2026-10-18.
	let veilRaf = 0;
	function scheduleVeil() {
		if (veilRaf) return;
		veilRaf = requestAnimationFrame(() => {
			veilRaf = 0;
			publishVeil();
		});
	}

	onMount(() => {
		if (typeof ResizeObserver !== 'undefined') veilRO = new ResizeObserver(scheduleVeil);
		publishVeil();
		const opts = { capture: true, passive: true } as const;
		document.addEventListener('scroll', publishVeil, opts);
		window.addEventListener('resize', publishVeil);
		document.fonts?.ready.then(publishVeil);
		return () => {
			veilRO?.disconnect();
			veilRO = undefined;
			veilObserved = [];
			cancelAnimationFrame(veilRaf);
			veilRaf = 0;
			document.removeEventListener('scroll', publishVeil, opts);
			window.removeEventListener('resize', publishVeil);
		};
	});

	// The phone rule's flag can flip after the window's resize has fired.
	$effect(() => {
		below(STAR_VEIL_SIDES_BELOW);
		untrack(publishVeil);
	});

	afterNavigate(() => {
		publishVeil();
	});

	// out: keeps the outgoing page in the DOM (Svelte marks it inert) under the
	// incoming one, and revivable if the user navigates straight back. Opacity is
	// driven by the afterNavigate orchestration — this emits no styles of its own.
	function holdPage(_node: Element) {
		return { duration: toolMotionOff() ? 0 : HOLD_MAX_MS };
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
		if (nav.to?.url.pathname.startsWith('/planner')) prewarmPlannerCharacters();
		// Cover the URL-flip → afterNavigate window (see the watchdog note).
		lastNavAt = performance.now();
		navSettleDeadline = watchdogDeadline(performance.now());
	});

	// ── Stale-layer watchdog (transition hardening, 2026-08-07) ───────────────
	// Defense in depth for the interrupt class this orchestration keeps
	// producing — the ghost layer (`47dfe8b`) and a tool settling INVISIBLE
	// after a nav storm were both the same shape: a pass that didn't drive
	// every live layer, leaving one pinned at a value nothing would ever come
	// back to correct.
	//
	// It prevents nothing. What it buys is the difference between "wrong for
	// seconds, reported as 'sometimes a tool pops in and hangs', no pattern
	// findable" and "corrected within the period, and LOUD in the console".
	// ⚠ It must NEVER heal silently: the warning is the sensor that feeds the
	// storm probe its next pattern, and probes assert `hits` stayed at 0 rather
	// than assert the geometry the heal would have hidden. If this ever fires
	// in normal use, the orchestration has a bug — go find it, don't raise the
	// period.
	//
	// Judged only PAST the leg's settle deadline: mid-flight every opacity is
	// legitimate (the incoming deliberately sits at 0 through its paint gate),
	// so there is nothing to judge until the choreography has had its say.
	//
	// ⚠ The deadline is armed in beforeNavigate, NOT just afterNavigate. There
	// is a real window between the URL flipping and afterNavigate running its
	// pass — the new route's module loads and its subtree mounts in there — and
	// during it the departing layer is legitimately still fully opaque while
	// `page.url.pathname` already names the destination. Arming only on the way
	// out let the watchdog judge inside that window and "correct" the outgoing
	// layer to 0 before its fade was ever created: a self-inflicted pop, and a
	// false positive convincing enough to send a bug hunt after it (it did).
	// A timestamp, not a flag — a cancelled or aborted navigation just lets it
	// expire instead of disabling the watchdog forever.
	const WATCHDOG_PERIOD_MS = 1500;
	/** Upper bound on when this leg's settle pass can still be running: the
	 *  world clock's own end, or a fade that starts as late as the paint gate's
	 *  cap allows — whichever lands later — plus the settle pass's margin. */
	const watchdogDeadline = (clock: number) =>
		Math.max(clock + SLIDE_MS, performance.now() + SETTLE_CAP_MS + TOOL_FADE_IN_MS) + 400;
	let navSettleDeadline = 0;
	let lastNavAt = 0;
	// Pass identity. Every deferred callback below (the paint gate, the settle)
	// captures its own pass and bails if a newer one has taken over. It used to
	// ask `page.url.pathname !== path` instead — which is only the same question
	// while paths are unique. A storm produces A→B→A→B, and there the OLDER
	// pass's settle timer passes that guard and runs with STALE captures: it
	// cancels the newer pass's in-flight animations, bakes a mid-flight opacity
	// onto a layer, and clears everything except opacity — stranding it partly
	// visible with nothing left to fade it. That is a ghost, and unlike the
	// Chrome-only stuck-layer bug it is ours and it is engine-independent.
	let navPass = 0;
	// `hits` is what probes assert on (must stay 0). `log` is what a human reads
	// afterwards — a hit with no context is just as unpatternable as the bug
	// reports were, so each one carries the layer roster and how long after the
	// navigation it was caught.
	const watchdog = { hits: 0, last: null as string | null, log: [] as unknown[] };

	function auditLayers() {
		if (!toolMain || document.hidden || performance.now() < navSettleDeadline) return;
		const path = page.url.pathname;
		const pages = [...toolMain.querySelectorAll<HTMLElement>(':scope > .tool-page')];
		// Same rule the pan and the dock measurement use: the latest layer
		// stamped with the current path is the real one.
		const current = pages.filter((p) => p.dataset.page === path).pop();
		for (const p of pages) {
			const o = parseFloat(getComputedStyle(p).opacity);
			const shouldShow = p === current;
			if (shouldShow ? o > 0.99 : o < 0.01) continue;
			watchdog.hits++;
			watchdog.last = `${p.dataset.page} at opacity ${o.toFixed(3)} (current route ${path})`;
			watchdog.log.push({
				at: Math.round(performance.now()),
				sinceNav: Math.round(performance.now() - lastNavAt),
				path,
				layer: p.dataset.page,
				o,
				inline: p.style.opacity,
				z: p.style.zIndex,
				anims: p.getAnimations().map((a) => `${a.id || 'svelte'}:${a.playState}`),
				roster: pages.map((q) => `${q.dataset.page}@${getComputedStyle(q).opacity}`)
			});
			console.warn(
				`[tools] stale layer watchdog: ${shouldShow ? 'the CURRENT route is not visible' : 'a departed layer is still painting'} — ${watchdog.last}. This is an orchestration bug; the layer has been corrected. Detail: window.__toolWatchdog.log`
			);
			// Heal — and NOT by clearing the inline style. Measured on the live
			// bug: once a layer is in this state, its computed opacity ignores
			// normal inline declarations AND new WAAPI animations, and only an
			// `!important` declaration moves it (see the memory note). So the
			// correction is asserted at the one priority that is known to land,
			// and the next navigation's pass removes it before animating.
			p.style.setProperty('opacity', shouldShow ? '1' : '0', 'important');
			// Verify on the next frame — a heal that silently fails is worse
			// than none, because it makes `hits` look like a handled problem.
			const entry = watchdog.log[watchdog.log.length - 1] as Record<string, unknown>;
			const want = shouldShow ? 1 : 0;
			requestAnimationFrame(() => {
				const got = parseFloat(getComputedStyle(p).opacity);
				entry.healed = Math.abs(got - want) < 0.01;
				if (!entry.healed) {
					console.warn(`[tools] stale layer watchdog: the correction did NOT take (still ${got}).`);
				}
			});
		}
	}

	onMount(() => {
		(window as unknown as Record<string, unknown>).__toolWatchdog = watchdog;
		const timer = setInterval(auditLayers, WATCHDOG_PERIOD_MS);
		return () => clearInterval(timer);
	});

	afterNavigate((nav) => {
		// Nothing is judgeable until this leg has settled, whichever branch
		// below runs — the early returns still reveal a page.
		navSettleDeadline = watchdogDeadline(sceneTransitionStart() ?? performance.now());
		// 'enter' = initial load (cold load / ascend reveal owns that path). A lone
		// page layer means nothing to cross-fade (e.g. landing→tool, where the old
		// DOM lives outside this layout). Whenever the pan orchestration doesn't
		// run, the bench band just snaps to the new page's dock post-render.
		if (nav.type === 'enter' || toolMotionOff() || !toolMain) {
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
		const myPass = ++navPass;
		const shift = toolPoseShift(fromPath, path);
		const clock = sceneTransitionStart() ?? performance.now();

		// Interrupts: bake whatever the previous leg left mid-flight, then
		// re-animate from there. (A REVIVED layer's animations died with its
		// reinsertion and its inline styles hold the old leg's baked values —
		// the two-keyframe drift below repositions it regardless.)
		for (const p of pages) {
			clearWatchdogPin(p);
			cancelToolNavAnims(p, true);
		}

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
			// rather than flashing back to full. A crossfade HOLDS it here and
			// fades it from startFadeIn, on the incoming's own start.
			if (!crossfade) fadeOut(o, clock);
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

		// The ribbon: drifts and fades with the planner's surface on the world
		// clock (the planner is the only tool that docks it).
		benchNavTransition(fromPath, path, clock);

		// Paint-gate + settle-gate for the INCOMING's fade-in (knobs above).
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
			// A crossfade's outgoing leaves on the SAME start (it held, lit,
			// through the gate).
			if (crossfade) for (const o of outgoing) if (o.isConnected) fadeOut(o, fadeStart);
			// The ribbon's entrance fade (dockless→docked legs) shares this exact
			// startTime — the band and its tool clear the paint gate together;
			// so does its exit fade on a crossfade (docked→dockless).
			benchGatedFadeIn?.(fadeStart);
			benchGatedFadeIn = null;
			benchGatedFadeOut?.(fadeStart);
			benchGatedFadeOut = null;
			const settleAt =
				Math.max(clock + SLIDE_MS, fadeStart + Math.max(TOOL_FADE_IN_MS, TOOL_FADE_OUT_MS)) -
				performance.now() +
				100;
			// Settle: bake + release. The incoming rests at natural layout; the
			// outgoing stays baked invisible through its retention window.
			setTimeout(() => {
				if (myPass !== navPass || !incoming.isConnected) return;
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
			if (myPass !== navPass || !incoming.isConnected) return;
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

	// The chrome's Roster button opens the Library, which lives here — so it
	// exists exactly while a tool is mounted (chromeModal.svelte.ts).
	onMount(() => registerRosterOpener(() => library.openRoster()));

	// ⚓ Back closes the library (Nate 2026-10-08): opening it pushed a shallow
	// history entry, so when that entry's state goes away, so does the overlay.
	$effect(() => {
		if (library.open && !page.state.library) library.open = false;
	});

	/** The share link a crash report carries: the document's, where the tool
	 *  keeps one in a store that outlives its page (the boundary only sees the
	 *  page fail, so the Visualizers' tile state is out of reach — its URL it
	 *  is). The Builder's bar loads on demand, as the layout never needs it. */
	async function crashShareUrl(): Promise<string | null> {
		const tool = feedbackToolForPath(page.url.pathname);
		if (tool === 'planner') return documentBar.shareUrl();
		if (tool === 'builder') return (await import('$lib/boardBar.svelte')).boardBar.shareUrl();
		return location.href;
	}
</script>

<div
	class="tool-shell scroll-fade"
	class:revealed
	style:--tool-fade="{FADE_DURATION_MS}ms"
	style:--tool-gutter="{TOOL_GUTTER}px"
	use:scrollFade={{ edges: 'start' }}
	out:plainExit|global
>
	<div class="tool-main" bind:this={toolMain}>
		{#key page.url.pathname}
			<div class="tool-page" use:stampPage out:holdPage>
				<!-- ⚠️ `+error.svelte` DOES NOT COVER THIS. SvelteKit's error page
				     catches load and routing failures; a throw during component
				     RENDER is a different animal, and before this boundary existed
				     it took the whole document down to a blank page — no chrome, no
				     scene, no way back, and (client-side) not even a status code.
				     The 2026-08-14 parser sweep found two live routes to exactly
				     that: unbounded `push(...)` spreads that RangeError on a large
				     enough rotation (docs/parser-hardening-2026-08-14.md §6).
				     Those get fixed at the source; this is the floor under them.

				     Scoped to .tool-page ON PURPOSE — the failure is contained to
				     the tool's own area, so the chrome, the scene and the bench band
				     all survive and the reader can simply navigate away. A boundary
				     any higher would take those down with it, which is most of what
				     made the blank page bad. -->
				<svelte:boundary>
					{@render children()}

					{#snippet failed(error, reset)}
						<div class="tool-crash">
							<h2>This tool ran into a problem.</h2>
							<p>
								The rest of the site is fine — you can switch tools above, or try again. Your saved
								rotations and lineups are untouched.
							</p>
							<div class="tool-crash__actions">
								<button class="btn btn--primary" onclick={reset}>Try again</button>
								<!-- The feedback form, with the error and — where the tool can
								     still make one — the document's share link. -->
								<ReportLink
									class="btn"
									prefill={{
										category: 'broken',
										tool: feedbackToolForPath(page.url.pathname),
										error
									}}
									shareUrl={crashShareUrl}>Report this</ReportLink
								>
							</div>
							{#if dev}
								<pre>{error instanceof Error ? (error.stack ?? error.message) : String(error)}</pre>
							{/if}
						</div>
					{/snippet}
				</svelte:boundary>
			</div>
		{/key}

		<!-- The bench band — the Planner's slot cards, docked over its
		     [data-bench-anchor] gutter and riding the pan clock in and out.
		     Inside .tool-main so it scrolls with the page it's
		     docked to; above the page layers so it stays interactive. -->
		<!-- ↻ 2026-10-15: and hidden while the planner's bench ROW is turned off
		     (band B's Bench plate) — the dock is display:none then, so the
		     strip would otherwise land 0×0 at its corner. The same condition
		     ToolStack drops the reserve on (`benchRowHidden`), and the anchor's
		     ResizeObserver re-snaps the strip when the row comes back. -->
		<div
			class="bench-band-mount"
			bind:this={benchMount}
			style:visibility={benchVisible && !benchRowHidden($siteSettings.showBenchRow)
				? 'visible'
				: 'hidden'}
		>
			<!-- ↻ TAIL ROUND 2026-08-12: four props gone. The strip used to be told
			     how tall to be, measured from the dock so its bottom edge met the
			     tool frame's; it ends in a POINT now and sizes to its own cards.
			     Nothing here measures its height any more — the anchor is still
			     measured for POSITION, which is a separate job. -->
			<BenchBand mode={benchMode} />
		</div>
	</div>
</div>

<!-- Tool chrome strip: the shared site chrome, with the tool switcher in its
     center slot. Identical across all tools — and, apart from the switcher,
     identical to the landing's. -->
<!-- ↻ 2026-10-14 (the chrome-fade round): OUTSIDE .tool-shell. The shell is
     the page's scroller and now wears a mask that rolls content off under
     this strip — a mask on the scroller would fade the strip with it. It
     keeps the shell's reveal + exit (its own `revealed` and plainExit) and
     its accent zone (`data-zone`, the rung portalled tool nodes use). -->
<div
	class="tool-chrome-mount"
	class:revealed
	data-zone="tool"
	style:--tool-fade="{FADE_DURATION_MS}ms"
	out:plainExit|global
>
	{#if nextOn}
		{#if TopBarC}<TopBarC />{/if}
	{:else}
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
	{/if}
</div>

<svelte:window onresize={snapBench} />

<!-- THE LIBRARY (lineups design §10.1a). Rendered by the LAYOUT, not by a
     tool: Load opens it in both tools, and it must outlive a tool pan. -->
{#if library.open}
	<LibraryOverlay />
{/if}

<!-- The make-room confirm: the tab limit is reached and something wants to
     open. Rendered HERE for the same reason as the bank — it acts on the
     DOCUMENTS, and it must outlive a tool pan mid-dialog. Keyed on the request
     so a second one re-seeds the pre-selection. -->
{#if documentBar.room}
	{#key documentBar.room}
		<TabLimitDialog
			tabs={documentBar.room.tabs}
			candidateId={documentBar.room.candidateId}
			onConfirm={(id) => documentBar.confirmRoom(id)}
			onCancel={() => documentBar.cancelRoom()}
		/>
	{/key}
{/if}

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
		/* Named, so a sticky box deep inside can ride this scroll (ToolColumns
		   `asideSticky`'s rise) without guessing which ancestor scrolls. */
		scroll-timeline: --tool-scroll block;
		/* TRANSPARENT — the tools float over the live scene (tools-over-scene
		   experiment, Nate 2026-08-05: no shell ground, no dim overlay; the
		   PANELS are what's opaque). The occlusion handshake retired with the
		   opacity — see the script comment. */
		background: transparent;

		/* --tool-gutter comes inline from TOOL_GUTTER ($lib/toolGutter) and is
		   declared HERE so every tool inherits one interior rhythm without
		   importing the constant itself. The band stack and the aside column
		   still take their gaps as inline px from BAND_STACK_GAP / COLUMN_GAP
		   (both derived from the same constant) because those components own
		   their own geometry; this is for the tools' own stylesheets, which
		   have no other way to reach a TypeScript number. */

		/* Layout pads. --tool-pad-top is breathing room below the fixed chrome
		   (.tool-main adds --chrome-h itself; viewport-height workspaces
		   subtract both). See the value below for its current reading. The bottom pad lets
		   content end clear of the viewport edge.

		   ↻ ⚓ NATE 2026-08-17: the bottom pad is 1.5rem, and the 24px it gives
		   back was SPENT — it funds the aura plot's 56 → 80 (AURA_PLOT_H). The
		   trade is why it moved: measured, the planner's chart frame lives in
		   `viewport − 300px` of fixed page, so at 1080p a heavy four-character
		   rotation was ALREADY ~30px into a page scroll and the lane had no
		   room to grow at the screen size most people are on. 24px still ends
		   content clear of the viewport edge, which is this pad's whole job.
		   ⚠ IT IS THREE TOOLS' MONEY, not the planner's: both viewport-fit
		   surfaces subtract this pad (.tool-stack--fill and the Visualizers'
		   .ws), so they get the same 24px as taller instruments. That is a
		   bonus, not an accident — ⛔ don't "fix" it by scoping the pad to the
		   planner, which would put the three tools' bottom edges on different
		   lines for the first time. */
		/* ↻ 🎛️ ⚓ Nate 2026-10-14: 0 (was 0.5rem). With the roll-off under the
		   chrome, the tool can start right at the strip's box (64) — the strip's
		   own content ends at 53, so 11px of air remain — and the fade line and
		   the content's top edge are now the same line. Still the knob. */
		--tool-pad-top: 0px;
		--tool-pad-bottom: 1.5rem;
		/* The site gutter (app.css --site-pad-x, which the top bar reads too).
		   ROUNDED to whole pixels, deliberately. This pad is the tool frames'
		   left edge, and the bench ribbon docks by measuring an anchor inside
		   that frame — so a fractional pad puts the whole strip at a fractional
		   x, and WebKit snaps glyphs to whole pixels while boxes keep sub-pixel
		   positions. Every label inside the ribbon then sits up to a pixel off
		   its own control in Safari, and by a DIFFERENT amount at every window
		   width (measured: 2vw gave 27.313 @1366, 28.797 @1440, 30.234 @1512 —
		   a full pixel of glyph range across one pixel of dock offset; see
		   scripts/probe-ink-centering.mjs). Rounding the token rather than the
		   ribbon's transform is what makes it free: the dock stays exactly
		   co-located with the frame it measures, so nothing in the tool-
		   transition machinery changes and no probe moves. Only widths under
		   1600 were ever affected — above that the clamp pins it at 2rem. */
		--tool-pad-x: var(--site-pad-x);
		/* Suppressed through the ascend: laid out (editors measure correctly)
		   but visibility:hidden → UNPAINTED, off the raster pipeline, so the
		   shell's one-time raster never competes with the camera pan. .revealed
		   flips near settle and runs the fade-in (duration set inline from
		   FADE_DURATION_MS; linear per the shared fade law). Cold loads render
		   with .revealed already set — no transition runs on initial paint. */
		visibility: hidden;
		opacity: 0;
		/* ⚓ THE ROLL-OFF UNDER THE CHROME (Nate 2026-10-14; ↻ 2026-10-15, his
		   hybrid). The chrome has NO ground: the wordmark and the glyph buttons
		   sit straight on the night, and so do the tools. A fade that ENDED at
		   the strip's bottom edge was content fading into a bar that does not
		   exist. So the roll-off now STARTS a little below the strip (content
		   whole until then) and climbs UP under it, transparent by the icons'
		   MIDLINE: a little content passes under the lower half of the glyphs,
		   already faint enough not to fight them. The shared .scroll-fade mask
		   does it (the eased ramp, START edge only; the screen's foot stays a
		   hard edge): the inset is the transparent end, and the length is set
		   HERE rather than through --scroll-fade, so --scroll-fade-scale does
		   not reach it. Both ends are named positions on the chrome, and a
		   multiplier would slide the opaque end off its anchor. It lives on the
		   SCROLLER, so it never moves with the scroll; only its length grows
		   over the first --scroll-fade-length px of travel.

		   📏 MEASURED 2026-10-15 at 390 and 1440 alike: the strip is 0–64, every
		   glyph's box is centred on y = 32 (tops 14.5–17, bottoms 47–49), and
		   the wordmark's baseline is y = 40. At the defaults (32 → 74) the mask
		   alpha is 0 at the midline, ≈.06 at the baseline, ≈.25–.33 across the
		   glyphs' bottom edges (≈.29 at 48), and 1 from y = 74.
		   🎛️ First values; Nate tunes by eye. */
		/* How far below the chrome's bottom edge the content is still whole. */
		--chrome-fade-below: 10px;
		/* Where the content is fully gone: the chrome glyphs' vertical midline
		   (the strip centres its children, so half its height). */
		--chrome-fade-end: calc(var(--chrome-h) / 2);
		--chrome-fade-start: calc(var(--chrome-h) + var(--chrome-fade-below));
		--scroll-fade-inset: var(--chrome-fade-end);
		--scroll-fade-length: calc(var(--chrome-fade-start) - var(--chrome-fade-end));
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
	/* The shell's reveal, restated — the strip left the shell (see markup). */
	.tool-chrome-mount {
		visibility: hidden;
		opacity: 0;
	}
	.tool-chrome-mount.revealed {
		visibility: visible;
		opacity: 1;
		transition: opacity var(--tool-fade, 0ms) linear;
	}
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
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: color-mix(in srgb, var(--chrome) 85%, transparent);
		padding: 0.15rem 0;
		transition: color var(--t-quick);
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

	/* The render-boundary fallback. Claims .ctx-dark's job by hand rather than
	   the class, because it is a bare notice on the dimmed world, not a tool
	   surface — no frame, no glass, nothing to mistake for apparatus. Centred in
	   the tool area so it reads as "this pane failed" rather than "the site
	   failed", which is the whole point of scoping the boundary here. */
	.tool-crash {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		min-height: 50svh;
		padding: clamp(1.5rem, 5vw, 3rem);
		text-align: center;
	}

	.tool-crash h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.tool-crash p {
		margin: 0;
		max-width: 32rem;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--muted);
	}

	.tool-crash__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
		margin-top: 0.5rem;
	}

	.tool-crash pre {
		max-width: 100%;
		margin: 1rem 0 0;
		padding: 0.75rem 1rem;
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		text-align: left;
		color: var(--muted);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
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

	/* (A narrow block tightened .chrome-nav's gap and label size at 40rem, for
	   a version of this bar where the switcher stayed in the centre and the
	   wordmark left. RETIRED 2026-09-04: the compass round inverted that trade,
	   so below 40rem SiteChrome collapses .chrome-center entirely and these
	   links are rendered by NavPanel instead. The rule could no longer fire —
	   ⛔ and a media query that cannot match is worse than none, because the
	   next reader will believe the switcher still has a narrow form. */

	/* (A reduced-motion block for .chrome-nav-link stood here. Retired with the
	   motion round — it spends --t-quick, and the band is zeroed at :root under
	   the same query. See app.css § MOTION.) */
</style>
