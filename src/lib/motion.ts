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

/** A CONTROL — buttons, chips, tabs, links, pips. CSS only; nothing mounts. */
export const T_SNAP = 120;

/** A SURFACE — modals, popovers, menus. The one the JS transitions spend. */
export const T_QUICK = 150;

/** TRAVEL across a distance. CSS only; one resident (the toggle thumb). */
export const T_MOVE = 240;

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
 * for once (see [[project_bench_card_round]]) — at 120ms it is rare enough to
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
