import { tweened, type Tweened } from 'svelte/motion';
import { cubicInOut } from 'svelte/easing';

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
export const TRANSITION_MS = 1600;

/** Fade speed multiplier vs. the transition itself. >1 means fades are
 *  faster than the pan. Faster fades = elements spend less time partially
 *  visible during the pan = less stutter contribution from UI chrome. */
export const FADE_SPEED_MULTIPLIER = 1.25;

/** Fade duration for landing/tool elements (~1.25× faster than the pan). */
export const FADE_DURATION_MS = Math.round(TRANSITION_MS / FADE_SPEED_MULTIPLIER);

/** Delay for the incoming element so its fade finishes when the pan settles.
 *  Outgoing fade has no delay. The gap (FADE_OFFSET_MS) at start/end is the
 *  "more sky" window where the outgoing element is gone but the incoming
 *  hasn't started yet. */
export const FADE_OFFSET_MS = TRANSITION_MS - FADE_DURATION_MS;

/** Peak fake-motion-blur radius in CSS pixels. Pulses 0 → peak → 0 over
 *  the transition, matching the velocity bell curve of the pan easing.
 *  Small values (~2-3px) mask judder convincingly without obvious blur. */
export const MOTION_BLUR_PEAK_PX = 2.5;

/** Reduced-motion fallback duration. */
export const REDUCED_MS = 200;

/**
 * Custom bezier easing. Currently configured as cubic-bezier(0.65, 0, 0.35, 1)
 * — a strong symmetric ease-in-out: extended slow phases at both ends with a
 * faster mid-transition, giving the camera nod a deliberate, cinematic feel.
 * Newton's method to solve x(t) = target, then plug t into y.
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

export const TILT_EASING = cubicBezier(0.65, 0, 0.35, 1);

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
 * Create the tweened stores that drive the persistent scene. Caller provides
 * the initial path so the stores snap to the correct state on cold load (no
 * animation if you refresh on /crit-visualizer, etc.). `motionBlur` starts at
 * 0 and is pulsed manually via two-phase tween — see pulseMotionBlur below.
 */
export function createSceneStores(initialPath: string): {
	panY: Tweened<number>;
	dimOpacity: Tweened<number>;
	motionBlur: Tweened<number>;
} {
	const panY = tweened(panYTarget(initialPath), {
		duration: TRANSITION_MS,
		easing: TILT_EASING
	});
	const dimOpacity = tweened(dimTarget(initialPath), {
		duration: TRANSITION_MS,
		easing: TILT_EASING
	});
	const motionBlur = tweened(0, {
		duration: TRANSITION_MS / 2,
		easing: cubicInOut
	});
	return { panY, dimOpacity, motionBlur };
}

/**
 * Pulse blur from 0 → peak → 0 over the transition. Both halves use
 * cubicInOut so the value changes slowly near 0 and near peak, producing a
 * smooth bell curve that approximates the velocity profile of the pan.
 * Returns the timer handle so the caller can clear it if the transition is
 * interrupted by a second navigation.
 */
export function pulseMotionBlur(motionBlur: Tweened<number>): ReturnType<typeof setTimeout> {
	const halfDur = TRANSITION_MS / 2;
	motionBlur.set(MOTION_BLUR_PEAK_PX, { duration: halfDur, easing: cubicInOut });
	return setTimeout(() => {
		motionBlur.set(0, { duration: halfDur, easing: cubicInOut });
	}, halfDur);
}
