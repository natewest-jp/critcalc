import { browser } from '$app/environment';
import { prefersReducedMotion } from './transition';

/**
 * Ambient shooting stars for the landing sky.
 *
 * A scheduler fires one meteor at a jittered interval; each is a single DOM node
 * (a gradient streak — brightest at the leading end, fading to transparent along
 * the tail) animated with one WAAPI transform + opacity keyframe set, so it runs
 * entirely on the compositor. No box-shadow, no head bloom (just the gradient).
 * Only ~one meteor exists at a time, created on fire and removed on finish —
 * fire-and-forget, no reactive churn.
 *
 * The host element is clipped to the sky region so a meteor
 * never streaks across the floor.
 *
 * Why it's cross-browser cheap (where the camera pan was not): a single small
 * element on a short transform path — not a giant surface on a long slide. The
 * rotation is baked into the keyframes as a literal (NOT a CSS var — custom
 * properties in WAAPI keyframe values aren't honored in Firefox, our canary).
 */

// --- Tuning knobs --------------------------------------------------------

/** Gap between meteors — uniformly random in this range, re-rolled each fire.
 *  Infrequent: a meteor is a rare event you're lucky to catch, not a steady
 *  drizzle. */
export const MIN_INTERVAL_MS = 5000;
export const MAX_INTERVAL_MS = 30000;

/** Delay before the FIRST meteor after mount, so one never fires on the same
 *  frame as the landing settling in. Random in this range. */
export const FIRST_DELAY_MIN_MS = 4000;
export const FIRST_DELAY_MAX_MS = 12000;

/** Flight time of a single meteor, random per fire. Fast — a quick streak that
 *  darts across and is gone. */
export const DURATION_MIN_MS = 380;
export const DURATION_MAX_MS = 680;

/** Trail length in px (the visible streak). Random per fire. */
export const LENGTH_MIN_PX = 90;
export const LENGTH_MAX_PX = 210;

/** Travel angle BELOW horizontal, in degrees (meteors fall down-and-across).
 *  Random per fire; a tight range reads like one radiant rather than scatter. */
export const ANGLE_MIN_DEG = 16;
export const ANGLE_MAX_DEG = 34;

/** Head travel distance as a fraction of viewport width, random per fire. */
export const TRAVEL_MIN_FRAC = 0.32;
export const TRAVEL_MAX_FRAC = 0.58;

/** Probability a meteor enters from the right and falls down-LEFT instead of
 *  down-right. A little of both keeps the field from feeling mechanical. */
export const MIRROR_PROB = 0.25;

/** Peak opacity of the streak at its brightest mid-flight (the keyframes ramp
 *  0 → PEAK → 0). Below 1 so meteors read as faint, fleeting light rather than
 *  bold strokes. */
export const PEAK_OPACITY = 0.62;

/** Tail/mid tint of the streak, drawn from the same low-chroma star palette as
 *  the twinkle field (TwinkleStars.svelte) so meteors read as the same "kind of
 *  light" as the stars. White-biased; the head is always pure white (set in the
 *  component CSS). Weighted like the starfield's COLOR_MIX (white-heavy). */
const STREAK_TINTS: { c: string; w: number }[] = [
	{ c: '#ffffff', w: 0.7 }, // white
	{ c: 'color-mix(in srgb, white 92%, #ffd8a8)', w: 0.15 }, // warm
	{ c: 'color-mix(in srgb, white 92%, #c0d8ff)', w: 0.1 }, // cool
	{ c: 'color-mix(in srgb, white 85%, #ffd070)', w: 0.04 }, // yellow
	{ c: 'color-mix(in srgb, white 82%, #ffaa50)', w: 0.01 } // amber
];

function pickTint(rng: RNG): string {
	let roll = rng();
	for (const { c, w } of STREAK_TINTS) {
		if (roll < w) return c;
		roll -= w;
	}
	return STREAK_TINTS[0].c;
}

// --- Controller ----------------------------------------------------------

type RNG = () => number;

function between(rng: RNG, min: number, max: number): number {
	return min + rng() * (max - min);
}

interface Meteor {
	el: HTMLElement;
	dx: number;
	dy: number;
	rotateDeg: number;
	durationMs: number;
}

/**
 * Build one meteor element pre-styled for a single flight, plus the screen-space
 * travel vector and rotation. Caller appends it, runs the WAAPI animation with
 * the literal rotation baked in, and removes it on finish.
 */
function buildMeteor(rng: RNG): Meteor {
	const mirror = rng() < MIRROR_PROB;
	const angleDeg = between(rng, ANGLE_MIN_DEG, ANGLE_MAX_DEG);
	const length = between(rng, LENGTH_MIN_PX, LENGTH_MAX_PX);
	const durationMs = between(rng, DURATION_MIN_MS, DURATION_MAX_MS);
	const dist = between(rng, TRAVEL_MIN_FRAC, TRAVEL_MAX_FRAC) * window.innerWidth;
	const tint = pickTint(rng);

	// Screen-space travel vector first; the rotation is then DERIVED from it via
	// atan2 so the streak is always collinear with travel — single source of
	// truth, no special-case for the mirrored direction (which is where an
	// independently-computed angle could drift off-axis). The bar's leading end
	// is its right end (x = width); rotate(atan2(dy,dx)) points that end exactly
	// along (dx, dy), so the tail trails directly behind the direction of travel.
	const rad = (angleDeg * Math.PI) / 180;
	const dirX = mirror ? -1 : 1;
	const dx = Math.cos(rad) * dist * dirX;
	const dy = Math.sin(rad) * dist;
	const rotateDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

	// Spawn point as a % of the sky-region host. Bias toward the top, and toward
	// the entering edge, so the whole streak plays on-screen.
	const sx = mirror ? between(rng, 30, 100) : between(rng, 0, 70);
	const sy = between(rng, 2, 38);

	const el = document.createElement('span');
	el.className = 'meteor';
	el.style.left = `${sx.toFixed(2)}%`;
	el.style.top = `${sy.toFixed(2)}%`;
	el.style.width = `${length.toFixed(1)}px`;
	el.style.setProperty('--c', tint);
	// Static base transform so the pre-animation frame is already oriented (the
	// animation also carries the rotation, but fill:both + opacity 0 at t=0 keep
	// it invisible until the fade-in regardless).
	el.style.transform = `rotate(${rotateDeg.toFixed(2)}deg)`;

	return { el, dx, dy, rotateDeg, durationMs };
}

/**
 * Start the shooting-star scheduler inside `host` (the sky-region element).
 * Returns a disposer. No-op on the server or under reduced motion. Pauses while
 * the tab is hidden so meteors don't pile up unseen.
 */
export function startShootingStars(host: HTMLElement): () => void {
	if (!browser || prefersReducedMotion()) return () => {};

	// Runtime PRNG seeded off load time: varies between visits, deterministic
	// within a session. (The Math.random/Date.now caveat is for the build-time
	// star generator; this is plain runtime code.)
	let s = Date.now() >>> 0 || 1;
	const rng: RNG = () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	let timer: ReturnType<typeof setTimeout> | null = null;
	const live = new Set<Animation>();
	let disposed = false;

	function fire() {
		const { el, dx, dy, rotateDeg, durationMs } = buildMeteor(rng);
		host.appendChild(el);
		const r = `rotate(${rotateDeg.toFixed(2)}deg)`;
		const anim = el.animate(
			[
				{ transform: `translate3d(0,0,0) ${r}`, opacity: 0 },
				{ opacity: PEAK_OPACITY, offset: 0.12 },
				{ opacity: PEAK_OPACITY, offset: 0.7 },
				{ transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) ${r}`, opacity: 0 }
			],
			{ duration: durationMs, easing: 'linear', fill: 'both' }
		);
		live.add(anim);
		anim.finished
			.then(() => {
				el.remove();
				live.delete(anim);
			})
			.catch(() => {
				// Cancelled on dispose; teardown clears the host.
			});
	}

	function schedule(delay: number) {
		if (disposed) return;
		timer = setTimeout(() => {
			fire();
			schedule(between(rng, MIN_INTERVAL_MS, MAX_INTERVAL_MS));
		}, delay);
	}

	function onVisibility() {
		if (document.hidden) {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
		} else if (!timer && !disposed) {
			schedule(between(rng, MIN_INTERVAL_MS, MAX_INTERVAL_MS));
		}
	}

	document.addEventListener('visibilitychange', onVisibility);
	schedule(between(rng, FIRST_DELAY_MIN_MS, FIRST_DELAY_MAX_MS));

	return () => {
		disposed = true;
		if (timer) clearTimeout(timer);
		document.removeEventListener('visibilitychange', onVisibility);
		for (const a of live) a.cancel();
		live.clear();
		host.replaceChildren();
	};
}
