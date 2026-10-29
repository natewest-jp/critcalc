/**
 * INTERACTION MOTION — the JS half of the three bands.
 *
 * The bands themselves are defined in `src/app.css` (§ MOTION), and CSS is
 * where almost every one of them is spent. This file exists for the handful of
 * surfaces that MOUNT AND UNMOUNT: Svelte's `transition:` directive takes a
 * number, and a number is the one thing a CSS custom property cannot hand it.
 *
 * ⚠ A HAND-SYNCED PAIR. Change a value here, change it in app.css § MOTION —
 * the comment there says the same thing from the other side. The numbers are
 * small and the two files are one grep apart; a generator or a computed-style
 * read would both cost more than the duplication does.
 *
 *     --t-snap   120ms   a CONTROL — hairline edges, go fast   (CSS only)
 *     --t-quick  150ms   a SURFACE — modals, popovers, menus
 *     --t-move   240ms   TRAVEL across a distance               (CSS only)
 *
 * The band is set by SIZE — how much screen the change occupies — not by what
 * caused it. The full argument, and why the first cut had it backwards, is in
 * app.css § MOTION. Everything that mounts through this file is a surface, so
 * T_QUICK is the only one with callers here.
 *
 * ⛔ NOT FOR THE SCENE. TOOL_NAV_MS, the camera crane, the star clock and the
 * loading veil are Nate-tuned and own their own clocks — see
 * $lib/landing/transition.ts. These bands are interaction motion inside a tool.
 */

import { linear, quartOut } from 'svelte/easing';

/** A CONTROL — buttons, chips, tabs, links, pips. CSS only; nothing mounts. */
export const T_SNAP = 120;

/** A SURFACE — modals, popovers, menus. The one the JS transitions spend. */
export const T_QUICK = 150;

/** TRAVEL across a distance. CSS only; one resident (the toggle thumb). */
export const T_MOVE = 240;

/**
 * ⚓ THE ARRIVAL RISE (Nate 2026-10-27, `/lab/toast-attention`): what appears
 * UNBIDDEN — a toast, the Roster's keys bar — rises into place so peripheral
 * vision catches its start. 🎛️ Nate's by-eye values: 30px, quartOut over
 * 300ms, the fade linear over T_QUICK (the fade law: a surface's fade is
 * linear, its movement may ease). quartOut 300 was matched to his first pick,
 * expoOut 450, over the first 90ms with about half its sub-pixel tail.
 *
 * The rise is ROUNDED to whole pixels: WebKit snaps glyphs to whole pixels
 * while a box glides, so a card settling at fractional offsets can shimmer
 * its text, and the keys bar's own note forbids a fractional transform. At
 * this speed the steps are invisible (checked in real Safari).
 */
export const RISE_PX = 30;
export const T_RISE = 300;

/** The rise as a Svelte `in:` transition. Two clocks: the movement eases
 *  over T_RISE, the opacity is linear over T_QUICK. Reduced motion is no
 *  motion, through `motion()`. */
export function riseIn(_node: Element) {
	const rMs = motion(T_RISE);
	const fMs = motion(T_QUICK);
	const duration = Math.max(rMs, fMs);
	return {
		duration,
		easing: linear,
		css: (t: number) => {
			const at = t * duration;
			const opacity = fMs ? Math.min(1, at / fMs) : 1;
			const y = Math.round((1 - quartOut(rMs ? Math.min(1, at / rMs) : 1)) * RISE_PX);
			return `opacity: ${opacity}; transform: translateY(${y}px);`;
		}
	};
}

/**
 * The band, or 0 when the reader has asked for less motion.
 *
 * Read at TRANSITION-CREATION time, which is the moment that matters: Svelte
 * evaluates the directive's options each time the element enters or leaves, so
 * a mid-session change of the OS setting is picked up on the next open without
 * a subscription. Same shape as the veil's check (LoadingVeil.svelte).
 *
 * SSR returns the full duration rather than 0 — transitions do not run during
 * SSR at all, and answering "no motion" from the server would be a guess about
 * a preference only the client can see.
 */
export function motion(ms: number): number {
	if (typeof window === 'undefined') return ms;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
}

/* ── The outro hazard, and the two lines that close it ──────────────────────
 *
 * A fading-out overlay is STILL IN THE DOM for the length of its fade, and a
 * full-screen dismiss backdrop that outlives its own visibility eats the next
 * click. That is the press-what-you-can-see shape this repo has already paid
 * for once (see `docs/rounds/bench-card-round.md`) — at 120ms it is rare enough to
 * never be reported and often enough to feel like the site dropped an input.
 *
 * `inert` is the whole fix in one word: it kills pointer events AND focus for
 * the subtree, which is exactly what "on its way out" means. Pair them —
 * Svelte runs the intro when an outro is INTERRUPTED by a reopen, so without
 * the arriving half a fast toggle would leave the surface permanently dead.
 *
 *     <div transition:fade={{ duration: motion(T_QUICK) }}
 *          onintrostart={introLive} onoutrostart={outroInert}>
 */

/** Attach to `onoutrostart`: the surface stops taking input the moment it starts leaving. */
export function outroInert(event: { currentTarget: EventTarget & HTMLElement }): void {
	event.currentTarget.inert = true;
}

/** Attach to `onintrostart`: undoes {@link outroInert} when a reopen interrupts the fade. */
export function introLive(event: { currentTarget: EventTarget & HTMLElement }): void {
	event.currentTarget.inert = false;
}

/**
 * The `behavior` for a programmatic smooth scroll — `'smooth'`, or `'auto'`
 * (instant) when the reader has asked for less motion.
 *
 * ⚠ The UA does NOT do this for us: Chrome animates `scrollTo({ behavior:
 * 'smooth' })` and `scrollIntoView` under `prefers-reduced-motion: reduce`, so
 * every smooth scroll asks here. Read at CALL time, like {@link motion}.
 */
export function scrollBehavior(): ScrollBehavior {
	return motion(1) === 0 ? 'auto' : 'smooth';
}
