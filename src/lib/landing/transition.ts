import { browser } from '$app/environment';

/**
 * Scene geometry — must mirror the --*-src / --viewport-aspect values on
 * .scene-stack in (scene)/+layout.svelte. The full scene image is bottom-
 * anchored at the viewport bottom; its CSS height in dvh is
 *   sceneH = 100 × viewportAspect × (sceneHSrc / sceneWSrc).
 * With the 21:9 / 5120×3840 master that is 100 × (21/9) × (3840/5120) = 175dvh.
 */
const VIEWPORT_ASPECT = 21 / 9;
const SCENE_W_SRC = 5120;
const SCENE_H_SRC = 3840;
const SCENE_H_DVH = 100 * VIEWPORT_ASPECT * (SCENE_H_SRC / SCENE_W_SRC);

/**
 * Endpoint of the tilt-up pan, in dvh. Panning the bottom-anchored scene up by
 * (sceneH − 100dvh) brings its top edge exactly to the viewport top, so the sky
 * fully covers the viewport in tool state — no band of page background above
 * the sky. (Previously hard-coded to 100×7/9 ≈ 77.78dvh from the old 1:1 / 16:9
 * plate; that overshot the 21:9 scene by ~2.78dvh and exposed --bg at the top.)
 */
export const PAN_TARGET_DVH = SCENE_H_DVH - 100;

/** Dim overlay opacity at the tool-state endpoint. --bg over the scene. */
export const DIM_TARGET = 0.6;

/**
 * Interim fade-only tool transition. The cinematic tilt-up pan + side crane are
 * retired pending the portal transition, so on tool entry the scene now stays
 * put and only the dim overlay + a content crossfade run. While true:
 *   - panYTarget / sideXTerm / toolShellWorldFrom collapse to no motion, so every
 *     world layer animates a zero-distance transform (a no-op) and opacity does
 *     all the work.
 * This also frees the transition from any dependence on sky headroom, so it's
 * already compatible with the lean (no-pan-headroom) plates. Flip to false to
 * restore the geometric pan/crane — the geometry consts below are kept intact.
 */
const FADE_ONLY = true;

/**
 * Side-tool horizontal crane.
 *
 * The two flanking tools pan *diagonally* — up and toward the clicked hero's
 * side — instead of straight up, using the horizontal overflow the 21:9 scene
 * has beyond the viewport. The camera leans toward the tool's side, so the
 * world layers shift the opposite way: Crit Visualizer is the left hero → the
 * world slides right to reveal the left sky; Team Builder is the right hero →
 * the world slides left. Rotation Planner (centre) and the landing rest lean 0.
 *
 * `SIDE_LEAN_DEG` is a fixed lean ANGLE off vertical; the horizontal travel is
 * tan(angle) × pan distance. It is then clamped to the per-side overflow
 *   O = (sceneW − 100dvw) / 2,   sceneW = 100dvh × 21/9
 * so the scene edge / gutter never enters frame. O shrinks to 0 as the viewport
 * widens toward 21:9, so ultrawide degrades gracefully to a straight tilt-up.
 * The 0.9 leaves a hair of margin against subpixel rounding at the very edge.
 *
 * This is the single tunable knob: raise the angle for a bolder lean (≈20° is
 * the most a 16:9 viewport can take before the clamp, not the angle, governs).
 */
export const SIDE_LEAN_DEG = 16;

const SIDE_MAG_DVH = Math.tan((SIDE_LEAN_DEG * Math.PI) / 180) * PAN_TARGET_DVH;
const SCENE_W_DVH = 100 * VIEWPORT_ASPECT;
const SIDE_X_CALC = `min(${SIDE_MAG_DVH.toFixed(3)}dvh, 0.9 * max(0px, (${SCENE_W_DVH.toFixed(3)}dvh - 100dvw) / 2))`;

/**
 * Crane direction per path: +1 shifts the world right (left tool), −1 left
 * (right tool), 0 = no lean (centre tool, landing, anything else).
 */
function sideSign(path: string): -1 | 0 | 1 {
	if (path === '/crit-visualizer') return 1;
	if (path === '/team-builder') return -1;
	return 0;
}

/** Signed crane term to splice into a translate() X, or '' for no lean. */
function sideXTerm(path: string): string {
	if (FADE_ONLY) return ''; // crane retired with the pan
	const sign = sideSign(path);
	if (sign === 0) return '';
	return `${sign > 0 ? '+' : '-'} ${SIDE_X_CALC}`;
}

/**
 * Tool reveal. A DevTools trace showed the tool's mount + its old Svelte in:fade
 * (a main-thread per-frame re-raster of the huge layer) were the sole source of
 * pan judder — the bare scene pan drops zero frames. So the shell stays
 * visibility:hidden (mounted + laid out, but UNPAINTED → off the raster
 * pipeline) until its fade-in begins, then fades in.
 *
 * Fade timing is SHARED with the landing composition (FADE_DURATION_MS /
 * FADE_OFFSET_MS / FADE_OUT_MS, defined below): a tool fades IN over
 * FADE_DURATION_MS ending exactly at settle — i.e. starting FADE_OFFSET_MS into
 * the pan, the same instant the landing UI fades in — and fades OUT over the
 * quicker FADE_OUT_MS. So a tool and the landing animate identically.
 *
 * Through all of it the shell's TRANSFORM is locked to the scene's pan — same
 * compositor clock, duration and easing (the tools layout drives a WAAPI
 * animation from toolShellWorldFrom → translate(0,0)). Its motion delta is then
 * identical to the background's, so it reads as pinned to a fixed point in the
 * world, descending and craning into centre with the scene rather than sliding
 * in independently. See getActiveReveal + toolShellWorldFrom.
 */

/**
 * World-locked "from" transform for the tool shell: one pan-distance above the
 * viewport plus the destination tool's full horizontal crane. Animating from
 * here to translate(0,0) in lockstep with the scene gives the shell the exact
 * same motion delta as the background (down by PAN_TARGET, sideways by the
 * crane), so it descends and cranes into centre as if pinned in the world. The
 * shell is full-viewport (inset:0), so these are absolute lengths — no -50%.
 */
export function toolShellWorldFrom(toolPath: string): string {
	if (FADE_ONLY) return 'translate(0, 0)'; // no world motion — fade only
	const sign = sideSign(toolPath);
	const hx = sign === 0 ? '0px' : `calc(${-sign} * (${SIDE_X_CALC}))`;
	return `translate(${hx}, ${-PAN_TARGET_DVH}dvh)`;
}

/**
 * Default duration of the transition window, in ms. In FADE_ONLY mode this is
 * the dim-overlay fade + content-crossfade window (brisk, no pan to cover); the
 * tall 2400ms value was paced for the cinematic tilt-up and is kept for when the
 * pan returns.
 */
export const TRANSITION_MS = FADE_ONLY ? 620 : 2400;

/** Fade speed multiplier vs. the transition itself. >1 means fades are
 *  faster than the pan. With strong ease-in-out the velocity peaks sharply
 *  in the middle; pushing fades to ~2.5× means UI chrome clears during the
 *  slow ease-in and only the scene is on screen through the fast frames. */
export const FADE_SPEED_MULTIPLIER = 4;

/** Fade-IN duration for landing + tool elements (the "pleasing" landing fade).
 *  In FADE_ONLY mode the crossfade IS the transition, so it's near the full
 *  window rather than a fraction of a longer pan. */
export const FADE_DURATION_MS = FADE_ONLY ? 460 : Math.round(TRANSITION_MS / FADE_SPEED_MULTIPLIER);

/** Delay for the incoming element so its fade-in starts after the outgoing one
 *  has cleared, ending exactly at settle. Shared by landing + tool. */
export const FADE_OFFSET_MS = TRANSITION_MS - FADE_DURATION_MS;

/** Fade-OUT duration — slightly quicker than the fade-in for a snappier exit.
 *  Shared by the landing composition out:fade and the tool's lockedExit. */
export const FADE_OUT_MS = FADE_ONLY ? 320 : Math.round(FADE_DURATION_MS * 1.0);

/**
 * Fade/camera overlap. The incoming fade-in is shifted to END this many ms AFTER
 * the camera settles (and so begins that much later too) — it "bleeds" past the
 * end of the camera move instead of finishing exactly at settle. Shared by the
 * landing composition in:fade and the tool reveal; 0 = end exactly at settle
 * (the prior behaviour).
 *
 * Side effect worth knowing: a larger value pushes the tool's reveal (its
 * visibility flip + one-time raster) LATER — toward, or past, settle — where the
 * camera is slower or stopped, so it costs fewer dropped frames. So this also
 * doubles as the dial for trading "fade overlaps the camera" against "reveal
 * lands on a calm scene".
 */
export const FADE_OVERLAP_MS = FADE_ONLY ? 160 : 300;

/** All four element fades (landing + tool, in + out) are LINEAR — opacity
 *  ramps uniformly, so the visible fade time equals its duration. An ease-out
 *  fade-in looked ~40% shorter than its duration (the slow 0.94→1.0 tail is
 *  imperceptible), which mismatched the linear fade-out at equal durations;
 *  keeping everything linear makes in/out and landing/tool all read identically.
 *  If we ever want a non-linear curve, apply it to ALL four (the tool reveal is
 *  a CSS animation, the others are Svelte fades — both must match). */

/** Reduced-motion fallback duration for the dim cross-fade. Transform
 *  layers snap instantly. */
export const REDUCED_MS = 200;

/**
 * Easing for the tilt-up pan. WAAPI accepts a CSS easing string directly,
 * so the bezier runs natively on the compositor — no JS interpolation per
 * frame. Strong symmetric ease-in-out: very gentle at start/end, accelerates
 * sharply through the middle for the "magical" camera feel.
 */
export const TILT_EASING_CSS = 'cubic-bezier(0.58, 0, 0.42, 1)';

// --- Portal transition (prototype) ------------------------------------------
//
// Replaces the dim/pan scene transition with an iris-style portal: on a hero
// click a vortex plate spirals open from the clicked card while a black backing
// fills the screen; once it's pure black the backing fades out to reveal the
// tool (mounted beneath, on its own black background → a dark-to-dark handoff
// that reads as the tool fading in from black). The whole effect is transform +
// opacity on a couple of pre-rendered layers, so it's compositor-cheap and
// Firefox-safe — no full-surface travel, no clip-path animating over live paint.
//
// While PORTAL is true the old startSceneTransition (pan + dim) is short-
// circuited; PortalTransition.svelte owns the visuals via a registered runner.
export const PORTAL = true;

export const PORTAL_SPIN_MS = 450; // vortex spiral + black-out duration
export const PORTAL_TOOL_FADE_MS = 550; // black → tool reveal after the spin
export const PORTAL_SPIN_DEG = 240; // clockwise rotation across the spin
export const PORTAL_SCALE_END = 2.6; // vortex final scale (× its 100vmax box)
export const PORTAL_VORTEX_FADE_AT = 0.65; // spin fraction where the vortex starts its rapid fade
export const PORTAL_REDUCED_MS = 180; // reduced-motion: brief black dip, no spin
export const PORTAL_HOLD_MS = 0; // hold at full black after blackout before the reveal fade
// (absorbs scheduling jitter so the tool flips visible UNDER the black backing
//  before that backing starts fading off it)
// Black backing eases IN (clear early so the vortex reads against the scene,
// blacks out late); the vortex bursts out (ease-out).
export const PORTAL_BLACK_EASING_CSS = 'cubic-bezier(0.5, 0, 0.75, 0.45)';
export const PORTAL_VORTEX_EASING_CSS = 'cubic-bezier(0, 0, 1, 1)';

export type PortalOrigin = { x: number; y: number };
type PortalRunner = (toPath: string, origin: PortalOrigin | null, onCovered?: () => void) => void;
let portalRunner: PortalRunner | null = null;

// Hero card centres, captured on the forward click (cards at rest) keyed by the
// destination tool path. The reverse transition reads these to collapse the
// spiral back to the right card without the landing being on-screen to measure.
const heroOrigins = new Map<string, PortalOrigin>();

/** Record a hero card's viewport-space centre for its tool path (forward click). */
export function setHeroOrigin(path: string, origin: PortalOrigin): void {
	heroOrigins.set(path, origin);
}

/** The stored hero centre for a tool path, or null (e.g. cold-loaded straight
 *  into a tool, so the landing never rendered → caller falls back to centre). */
export function getHeroOrigin(path: string): PortalOrigin | null {
	return heroOrigins.get(path) ?? null;
}

// Active-portal tracking, for the tool-shell suppression timing. The tool layout
// stays hidden (visibility:hidden, unpainted) from mount until the portal reaches
// full black, so its own entry animations play unseen and it never shows at the
// portal's growing edges; the portal then fades its black backing off the now-
// static tool as the single fade-in.
let portalStart: number | null = null;
let portalBlackoutMs = PORTAL_SPIN_MS;
let portalClearTimer: ReturnType<typeof setTimeout> | null = null;

/** PortalTransition.svelte registers its runner here on mount. */
export function registerPortalRunner(fn: PortalRunner): () => void {
	portalRunner = fn;
	return () => {
		if (portalRunner === fn) portalRunner = null;
	};
}

/**
 * Kick off a portal transition. Forward (toPath = a tool): spiral OPEN from
 * `origin` (the clicked hero's centre). Reverse (toPath = '/'): cover the tool,
 * then collapse the spiral back DOWN to `origin` (the card to return to), calling
 * `onCovered` at full black to run the actual navigation beneath the cover.
 * No-op if the portal layer isn't mounted yet.
 */
export function startPortalTransition(
	toPath: string,
	origin: PortalOrigin | null,
	onCovered?: () => void
): void {
	if (!browser || !PORTAL) return;
	portalStart = performance.now();
	portalBlackoutMs = prefersReducedMotion() ? PORTAL_REDUCED_MS : PORTAL_SPIN_MS;
	if (portalClearTimer) clearTimeout(portalClearTimer);
	portalClearTimer = setTimeout(
		() => {
			portalStart = null;
			portalClearTimer = null;
		},
		portalBlackoutMs + PORTAL_HOLD_MS + PORTAL_TOOL_FADE_MS + 100
	);
	portalRunner?.(toPath, origin, onCovered);
}

/** Whether a portal transition is in flight — the tool shell uses this on mount
 *  to decide whether to suppress itself. Always false on the server. */
export function hasActivePortal(): boolean {
	return browser && portalStart !== null;
}

/** Milliseconds until the in-flight portal reaches full black — the tool shell
 *  uses this on mount to detect a "mounted after blackout" late arrival. 0 if no
 *  portal / already black. */
export function portalTimeUntilBlackout(): number {
	if (!browser || portalStart === null) return 0;
	return Math.max(0, portalBlackoutMs - (performance.now() - portalStart));
}

// Reveal handshake. The portal DRIVES the tool reveal rather than the tool
// guessing the blackout time off a shared clock: at full black the portal calls
// revealToolNow() (the tool shell registered its un-suppress here), waits two
// frames so the shell is actually PAINTED opaque, then fades its backing off it.
// This closes the race that a fixed millisecond hold could never win — the
// backing never lifts before the tool is covering, so no scene flashes through.
let toolRevealCb: (() => void) | null = null;

/** The tool shell registers its un-suppress callback here while a portal is in
 *  flight; returns an unregister for cleanup on unmount. */
export function registerToolReveal(fn: () => void): () => void {
	toolRevealCb = fn;
	return () => {
		if (toolRevealCb === fn) toolRevealCb = null;
	};
}

/** Called by the portal at full black to un-suppress the tool shell. No-op if no
 *  shell is registered (cold load / reduced motion / tool not yet mounted). */
export function revealToolNow(): void {
	toolRevealCb?.();
}

export type SceneLayerKind = 'sky-bg' | 'sky' | 'twinkle' | 'floor' | 'composition' | 'dim';

export const isLandingPath = (path: string) => path === '/';
export const panYTarget = (path: string) => (FADE_ONLY || isLandingPath(path) ? 0 : PAN_TARGET_DVH);
// In PORTAL mode the dim overlay is vestigial — the tool supplies its own black
// background and startSceneTransition (which would animate the dim) is a no-op —
// so keep it at 0 always. Otherwise a cold load into a tool renders the dim at
// DIM_TARGET and nothing ever clears it, leaving a 0.6 black wash over the
// landing on return. (Non-PORTAL pan mode keeps the original behaviour.)
export const dimTarget = (path: string) => (PORTAL || isLandingPath(path) ? 0 : DIM_TARGET);

export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// --- WAAPI orchestrator ------------------------------------------------------
//
// Animations run directly on each leaf element's transform/opacity via the
// Web Animations API. Because those properties are composited, the entire
// animation runs on the compositor thread — main-thread work (SvelteKit
// navigation, hydration, GC, $effect chains) can't stutter it.
//
// Layers register themselves via the `sceneLayer` action on mount. On a
// navigation, `startSceneTransition` cancels any in-flight WAAPI animation
// on each registered layer (baking the current value via commitStyles) and
// kicks off a fresh single-keyframe animation from current → new target.
// Layers that mount mid-transition (e.g. tool-shell as the new route hydrates)
// join the in-flight animation with a startTime synced to the original
// start, so the WAAPI engine catches them up to lockstep automatically.

const ANIM_ID = 'scene-transition';

interface ActiveTransition {
	fromPath: string;
	toPath: string;
	startTime: number;
	duration: number;
}

let currentPath = '/';
let active: ActiveTransition | null = null;
const layers = new Map<HTMLElement, SceneLayerKind>();

export function restTransform(kind: SceneLayerKind, path: string): string | null {
	const panY = panYTarget(path);
	switch (kind) {
		case 'sky-bg':
			// CSS gradient layer sized to 100dvw — fills ultrawide gutters; no
			// horizontal centering since it already spans the full viewport. The
			// gradient is vertical, so a horizontal crane on it would be invisible;
			// it stays purely vertical even for side tools.
			return `translateY(${panY}dvh)`;
		case 'sky':
		case 'twinkle':
		case 'floor':
		case 'composition': {
			// Bottom-anchored, horizontally centered via translate(-50%). Side
			// tools add the crane term so the camera leans toward the clicked
			// hero (the −50% is element-relative centring; the term is the
			// absolute crane offset added on top).
			const x = sideXTerm(path);
			const tx = x ? `calc(-50% ${x})` : '-50%';
			return `translate(${tx}, ${panY}dvh)`;
		}
		case 'dim':
			return null;
	}
}

function restOpacity(kind: SceneLayerKind, path: string): number | null {
	return kind === 'dim' ? dimTarget(path) : null;
}

function applyRestState(el: HTMLElement, kind: SceneLayerKind, path: string): void {
	const t = restTransform(kind, path);
	const o = restOpacity(kind, path);
	if (t !== null) el.style.transform = t;
	if (o !== null) el.style.opacity = String(o);
}

function buildTargetKeyframe(kind: SceneLayerKind, toPath: string): Keyframe {
	if (kind === 'dim') return { opacity: restOpacity(kind, toPath)! };
	return { transform: restTransform(kind, toPath)! };
}

function buildFromToKeyframes(kind: SceneLayerKind, fromPath: string, toPath: string): Keyframe[] {
	if (kind === 'dim') {
		return [{ opacity: restOpacity(kind, fromPath)! }, { opacity: restOpacity(kind, toPath)! }];
	}
	return [
		{ transform: restTransform(kind, fromPath)! },
		{ transform: restTransform(kind, toPath)! }
	];
}

function cancelSceneAnimations(el: HTMLElement): void {
	for (const a of el.getAnimations()) {
		if (a.id !== ANIM_ID) continue;
		try {
			a.commitStyles();
		} catch {
			// Element detached or value non-interpolable — safe to skip.
		}
		a.cancel();
	}
}

function startFromCurrent(
	el: HTMLElement,
	kind: SceneLayerKind,
	toPath: string,
	duration: number,
	startTime: number | null
): void {
	// Single-keyframe form: WAAPI uses the current computed style as the from
	// keyframe. Combined with commitStyles before cancel, this gives clean
	// "interrupt from wherever you are" behavior.
	const anim = el.animate([buildTargetKeyframe(kind, toPath)], {
		duration,
		easing: TILT_EASING_CSS,
		fill: 'forwards',
		id: ANIM_ID
	});
	// Pin every layer in this transition to the same startTime so they share
	// one clock. Without this, persistent layers' actual startTime lands ~10–
	// 30ms after `active.startTime` (whenever the browser processes animate()),
	// while a layer that mid-mounts and joins via `joinInFlight` is pinned
	// to `active.startTime` exactly — the persistent layers would then finish
	// that same offset later, visible as a small end-of-pan drift between the
	// scene and the freshly-mounted page chrome.
	if (startTime !== null) anim.startTime = startTime;
}

function joinInFlight(el: HTMLElement, kind: SceneLayerKind, t: ActiveTransition): void {
	const anim = el.animate(buildFromToKeyframes(kind, t.fromPath, t.toPath), {
		duration: t.duration,
		easing: TILT_EASING_CSS,
		fill: 'forwards',
		id: ANIM_ID
	});
	// Pin startTime to the in-flight start so the WAAPI engine interpolates
	// this layer to "where it would be now" on the very first frame after
	// mount — no visible snap from the from-keyframe.
	anim.startTime = t.startTime;
}

/**
 * Initialize the current path tracker. Call once at scene-layout mount so
 * cold loads on a tool URL register the correct baseline (layers will then
 * apply tool rest state instead of landing).
 */
export function initScenePath(path: string): void {
	currentPath = path;
}

/**
 * Whether a scene pan is in flight right now. The tools layout uses this at
 * mount to decide between "arrived via a transition → suppress and reveal after
 * the camera settles" and "cold load / reduced motion → show immediately".
 * Always false on the server, so SSR renders the tool in its revealed state.
 */
export function hasActiveSceneTransition(): boolean {
	return browser && active !== null;
}

/**
 * Milliseconds until the in-flight pan finishes (0 if none / already settled).
 * The tools layout waits this long before revealing, so the tool's first paint
 * lands on a static scene instead of competing with the moving compositor.
 */
export function timeUntilSettle(): number {
	if (!browser || !active) return 0;
	const now = (document.timeline.currentTime as number) ?? performance.now();
	return Math.max(0, active.duration - (now - active.startTime));
}

/**
 * Snapshot of the in-flight pan for the tool-shell reveal: the compositor
 * `startTime` + `duration` (to lock the shell's transform to the scene's exact
 * clock) and the tool path involved (for the crane direction — toPath when
 * entering a tool, fromPath when returning to landing). Null on a cold load /
 * no active pan, in which case the shell just renders revealed at rest.
 */
export function getActiveReveal(): {
	startTime: number;
	duration: number;
	toolPath: string;
} | null {
	if (!browser || !active) return null;
	const toolPath = isLandingPath(active.toPath) ? active.fromPath : active.toPath;
	return { startTime: active.startTime, duration: active.duration, toolPath };
}

/**
 * Kick off a scene transition. Cancels in-flight WAAPI animations on every
 * registered layer (baking current state via commitStyles) and starts fresh
 * compositor-thread animations from current → target rest. No main-thread
 * work per frame, no shared CSS variable to propagate.
 */
export function startSceneTransition(toPath: string): void {
	if (!browser) return;
	// In portal mode the pan/dim system is retired — PortalTransition owns the
	// transition. Short-circuit so no scene layer animates and the tool isn't
	// suppressed (it renders revealed beneath the portal's black cover).
	if (PORTAL) return;
	if (toPath === currentPath) return;

	const fromPath = currentPath;
	currentPath = toPath;

	const reduced = prefersReducedMotion();
	if (reduced) {
		// Snap transform layers; cross-fade dim over REDUCED_MS for atmosphere.
		for (const [el, kind] of layers) {
			cancelSceneAnimations(el);
			if (kind === 'dim') {
				// Reduced motion: only one layer animates at a time (a brief dim
				// cross-fade); no need to pin a shared startTime.
				startFromCurrent(el, kind, toPath, REDUCED_MS, null);
			} else {
				applyRestState(el, kind, toPath);
			}
		}
		active = null;
		return;
	}

	const startTime = (document.timeline.currentTime as number) ?? performance.now();
	active = { fromPath, toPath, startTime, duration: TRANSITION_MS };

	// No twinkle freeze here anymore: the starfield is a single WebGL canvas
	// (one texture on the .twinkle layer), so a pan translates it without any
	// per-star re-raster — the freeze existed for the old 1400-span field.

	for (const [el, kind] of layers) {
		cancelSceneAnimations(el);
		startFromCurrent(el, kind, toPath, TRANSITION_MS, startTime);
	}

	// Clear `active` once this transition is finished so a layer that mounts
	// later doesn't try to catch up to a completed animation.
	setTimeout(() => {
		if (active && active.startTime === startTime) active = null;
	}, TRANSITION_MS + 50);
}

/**
 * Svelte action: register a DOM element as a scene layer of the given kind.
 * Sets its initial transform/opacity for the current path. If a transition
 * is in flight when the element mounts, joins it via a synced startTime so
 * the WAAPI engine snaps it to the current interpolated position on the
 * next frame — no visible jump from the from-keyframe.
 */
export function sceneLayer(el: HTMLElement, kind: SceneLayerKind) {
	if (!browser) return;

	layers.set(el, kind);

	if (active) {
		applyRestState(el, kind, active.fromPath);
		joinInFlight(el, kind, active);
	} else {
		applyRestState(el, kind, currentPath);
	}

	return {
		destroy() {
			cancelSceneAnimations(el);
			layers.delete(el);
		}
	};
}
