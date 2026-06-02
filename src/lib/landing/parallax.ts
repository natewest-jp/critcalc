import { browser } from '$app/environment';
import { hasActiveSceneTransition, prefersReducedMotion } from './transition';

/**
 * Cursor parallax for the landing scene.
 *
 * On pointer move the whole scene (sky + stars + floor, wrapped in
 * `.parallax-world`) shifts a few px as one RIGID unit — honoring the
 * "everything at infinity" model, no differential-depth that would fight the
 * baked single-camera perspective — while the foreground content
 * (`.composition-inner`) counter-shifts a smaller amount the opposite way. The
 * two opposing motions read as depth.
 *
 * Why this is cheap where the camera pan is not: it's a tiny offset of cached
 * layers driven by an interactive lerp-follow, not a long full-viewport slide on
 * a scripted easing curve the eye can judge dropped frames against. Transforms
 * are written DIRECTLY to each wrapper's `style.transform` every frame — never
 * via an inherited custom property — so the ~1500 twinkle stars never restyle (a
 * transform change on a parent is a compositor op, not a descendant recalc; the
 * same reason the WAAPI pan is free).
 *
 * Registration mirrors the `sceneLayer` pattern: elements opt in via the
 * `parallaxLayer` action with a per-axis factor; the controller (started from
 * the landing page's onMount, so it only lives while the landing is mounted)
 * drives every registered element each frame.
 */

/** World horizontal travel at full cursor deflection (viewport edge), in dvh. */
export const PARALLAX_MAX_X_DVH = 2.2;

/** World vertical travel at full deflection, in dvh. Less than X — we glance
 *  side to side more than up/down, and vertical has less safe bleed (the floor
 *  is bottom-anchored; sky-bg backstops the rest). */
export const PARALLAX_MAX_Y_DVH = 1.0;

/** Smoothing toward the target each frame (0..1; higher = snappier follow). */
export const PARALLAX_LERP = 0.09;

/** World shift direction vs. the cursor. −1 = world shifts OPPOSITE the cursor
 *  (cursor right → world left); the content factor below then flips it so the
 *  foreground tracks the cursor. Flip to +1 to swap the whole feel. */
export const PARALLAX_WORLD_SIGN = -1;

/** Foreground (brand + heroes) shift as a fraction of the world shift. Negative
 *  → opposite the world (so it follows the cursor); |value| < 1 → moves less.
 *  This is the depth dial — bigger magnitude = more pronounced parallax. */
export const PARALLAX_CONTENT_FACTOR = 0.5;

/** Below this per-axis delta (px) we snap to target and let the loop idle. */
const SETTLE_EPS = 0.02;

interface ParallaxFactor {
	x: number;
	y: number;
}

const targets = new Map<HTMLElement, ParallaxFactor>();

/**
 * Svelte action: register an element to receive the parallax offset scaled by a
 * per-axis factor. The world wrapper uses `{ x: 1, y: 1 }`; the foreground
 * content uses {@link PARALLAX_CONTENT_FACTOR} on both axes so it counter-shifts.
 * The transform is written directly by the controller; this action only manages
 * registration and clears the transform on teardown.
 */
export function parallaxLayer(el: HTMLElement, factor: ParallaxFactor) {
	targets.set(el, factor);
	return {
		update(next: ParallaxFactor) {
			targets.set(el, next);
		},
		destroy() {
			targets.delete(el);
			el.style.transform = '';
		}
	};
}

/**
 * Start the parallax controller. Call from the landing page's onMount and return
 * the disposer straight from it; teardown stops tracking and resets every
 * registered layer. No-op (and attaches no listeners) on touch / coarse
 * pointers, under reduced motion, or on the server.
 */
export function startParallax(): () => void {
	if (!browser) return () => {};
	const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
	if (!fine || prefersReducedMotion()) return () => {};

	let targetX = 0;
	let targetY = 0;
	let curX = 0;
	let curY = 0;
	let raf = 0;
	let running = false;

	const vh = () => window.innerHeight / 100;

	function write() {
		for (const [el, f] of targets) {
			el.style.transform = `translate3d(${(curX * f.x).toFixed(2)}px, ${(curY * f.y).toFixed(2)}px, 0)`;
		}
	}

	function frame() {
		// During a scene transition the WAAPI pan owns the layers — ease parallax
		// to 0 so the pan stays pure, then resume after it settles.
		const suspended = hasActiveSceneTransition();
		const tx = suspended ? 0 : targetX;
		const ty = suspended ? 0 : targetY;
		curX += (tx - curX) * PARALLAX_LERP;
		curY += (ty - curY) * PARALLAX_LERP;
		if (Math.abs(tx - curX) < SETTLE_EPS) curX = tx;
		if (Math.abs(ty - curY) < SETTLE_EPS) curY = ty;
		write();
		if (curX !== tx || curY !== ty) {
			raf = requestAnimationFrame(frame);
		} else {
			running = false;
		}
	}

	function ensureRunning() {
		if (!running) {
			running = true;
			raf = requestAnimationFrame(frame);
		}
	}

	function onMove(e: PointerEvent) {
		const nx = (e.clientX / window.innerWidth) * 2 - 1;
		const ny = (e.clientY / window.innerHeight) * 2 - 1;
		targetX = PARALLAX_WORLD_SIGN * nx * PARALLAX_MAX_X_DVH * vh();
		targetY = PARALLAX_WORLD_SIGN * ny * PARALLAX_MAX_Y_DVH * vh();
		ensureRunning();
	}

	function recenter() {
		targetX = 0;
		targetY = 0;
		ensureRunning();
	}

	window.addEventListener('pointermove', onMove, { passive: true });
	window.addEventListener('pointerleave', recenter, { passive: true });
	window.addEventListener('blur', recenter);

	return () => {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerleave', recenter);
		window.removeEventListener('blur', recenter);
		if (raf) cancelAnimationFrame(raf);
		for (const el of targets.keys()) el.style.transform = '';
	};
}
