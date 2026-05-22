import { tweened, type Tweened } from 'svelte/motion';

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
export const TRANSITION_MS = 1000;

/** Tool-shell intro: starts ~40% into the tilt, finishes with it. */
export const TOOL_IN_DELAY_MS = 400;
export const TOOL_IN_DURATION_MS = 600;

/** Tool-shell exit: faster than the descend tilt so the tool clears
 *  before the landing heroes are mid-flight back in. */
export const TOOL_OUT_DURATION_MS = 700;

/** Reduced-motion fallback duration. */
export const REDUCED_MS = 200;

/**
 * Custom bezier easing matching CSS cubic-bezier(0.5, 0, 0.2, 1) — eases in
 * smoothly, then settles slowly at the end (mimicking a camera nodding up
 * and resting). Newton's method to solve x(t) = target, then plug t into y.
 */
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
	return (t: number) => {
		let x = t;
		for (let i = 0; i < 8; i++) {
			const oneMinus = 1 - x;
			const fx = 3 * oneMinus * oneMinus * x * p1x + 3 * oneMinus * x * x * p2x + x * x * x;
			const dfx =
				3 * oneMinus * oneMinus * p1x +
				6 * oneMinus * x * (p2x - p1x) +
				3 * x * x * (1 - p2x);
			if (dfx === 0) break;
			x = x - (fx - t) / dfx;
		}
		const oneMinus = 1 - x;
		return 3 * oneMinus * oneMinus * x * p1y + 3 * oneMinus * x * x * p2y + x * x * x;
	};
}

export const TILT_EASING = cubicBezier(0.5, 0, 0.2, 1);

/** True when the user has prefers-reduced-motion: reduce. Client-only. */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A path is "landing" iff it's exactly /; everything else under (scene) is a tool route. */
export const isLandingPath = (path: string) => path === '/';

export const panYTarget = (path: string) => (isLandingPath(path) ? 0 : PAN_TARGET_DVH);
export const dimTarget = (path: string) => (isLandingPath(path) ? 0 : DIM_TARGET);

/**
 * Create the pair of tweened stores that drive the persistent scene. Caller
 * provides the initial path so the stores snap to the correct state on cold
 * load (no animation if you refresh on /crit-visualizer, etc.).
 */
export function createSceneStores(initialPath: string): {
	panY: Tweened<number>;
	dimOpacity: Tweened<number>;
} {
	const panY = tweened(panYTarget(initialPath), {
		duration: TRANSITION_MS,
		easing: TILT_EASING
	});
	const dimOpacity = tweened(dimTarget(initialPath), {
		duration: TRANSITION_MS,
		easing: TILT_EASING
	});
	return { panY, dimOpacity };
}
