import { browser } from '$app/environment';

/**
 * Endpoint of the tilt-up pan, in dvh. Aligns the plate's top edge with the
 * viewport's top edge (math: plate is 1:1, sized to width = 100dvh * 16 / 9,
 * so plate height = 177.78dvh; bottom-anchored at 0; pan = 100dvh * 7 / 9 to
 * bring top edge to viewport top).
 */
export const PAN_TARGET_DVH = (100 * 7) / 9;

/** Dim overlay opacity at the tool-state endpoint. --bg over the scene. */
export const DIM_TARGET = 0.6;

/** Default duration of the tilt + dim + crossfade animation, in ms. */
export const TRANSITION_MS = 2500;

/** Fade speed multiplier vs. the transition itself. >1 means fades are
 *  faster than the pan. With strong ease-in-out the velocity peaks sharply
 *  in the middle; pushing fades to ~2.5× means UI chrome clears during the
 *  slow ease-in and only the scene is on screen through the fast frames. */
export const FADE_SPEED_MULTIPLIER = 2.5;

/** Fade duration for landing/tool elements. */
export const FADE_DURATION_MS = Math.round(TRANSITION_MS / FADE_SPEED_MULTIPLIER);

/** Delay for the incoming element so its fade starts after the outgoing
 *  one has cleared. */
export const FADE_OFFSET_MS = TRANSITION_MS - FADE_DURATION_MS;

/** Reduced-motion fallback duration for the dim cross-fade. Transform
 *  layers snap instantly. */
export const REDUCED_MS = 200;

/**
 * Easing for the tilt-up pan. WAAPI accepts a CSS easing string directly,
 * so the bezier runs natively on the compositor — no JS interpolation per
 * frame. Strong symmetric ease-in-out: very gentle at start/end, accelerates
 * sharply through the middle for the "magical" camera feel.
 */
export const TILT_EASING_CSS = 'cubic-bezier(0.5, 0, 0.5, 1.0)';

export type SceneLayerKind = 'plate' | 'twinkle' | 'composition' | 'tool-shell' | 'dim';

export const isLandingPath = (path: string) => path === '/';
export const panYTarget = (path: string) => (isLandingPath(path) ? 0 : PAN_TARGET_DVH);
export const dimTarget = (path: string) => (isLandingPath(path) ? 0 : DIM_TARGET);

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

function restTransform(kind: SceneLayerKind, path: string): string | null {
	const panY = panYTarget(path);
	switch (kind) {
		case 'plate':
		case 'twinkle':
		case 'composition':
			// Bottom-anchored, horizontally centered via translate(-50%).
			return `translate(-50%, ${panY}dvh)`;
		case 'tool-shell':
			// Attached to plate's top edge: at landing (panY=0) sits one pan-
			// distance above viewport; at tool (panY=PAN_TARGET) sits at 0.
			return `translateY(calc(${panY}dvh - ${PAN_TARGET_DVH}dvh))`;
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

function buildFromToKeyframes(
	kind: SceneLayerKind,
	fromPath: string,
	toPath: string
): Keyframe[] {
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
 * Kick off a scene transition. Cancels in-flight WAAPI animations on every
 * registered layer (baking current state via commitStyles) and starts fresh
 * compositor-thread animations from current → target rest. No main-thread
 * work per frame, no shared CSS variable to propagate.
 */
export function startSceneTransition(toPath: string): void {
	if (!browser) return;
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
