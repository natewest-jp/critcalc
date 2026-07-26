/** Readiness handshake between the loading veil and whatever it is covering.
 *
 * The veil's own dismissal rule — two frames after mount — is right for the
 * scene: one paint and the starfield is there. It is NOT right for a tool. A
 * tool restores from localStorage after hydration and then lazy-loads its
 * character payloads, so "painted" and "showing your actual rotation" are
 * hundreds of milliseconds apart. Uncovering in between is exactly the blink
 * this exists to hide (Nate, 2026-07-26).
 *
 * So a surface that finishes asynchronously CLAIMS the veil at component init
 * and releases it when its real content is on screen. Same shape as the
 * portal's registerToolReveal handshake. Surfaces that are ready at first
 * paint claim nothing and get the original behaviour.
 *
 * Claims are free when there is no veil to hold: claimVeilReady() hands back a
 * no-op unless the SSR-rendered veil is actually in the DOM, which is the same
 * "was this a real page load?" test the veil itself uses. SPA navigations
 * therefore cost nothing and cannot leak a pending claim.
 *
 * Ordering note: claim at component INIT, not in onMount. Page components are
 * constructed during the layout's render pass, so their script bodies all run
 * before any onMount fires — which is what lets the veil see every claim when
 * it takes its own reading.
 */

import { browser } from '$app/environment';

let claimed = 0;
let released = 0;
const listeners = new Set<() => void>();

const veilPresent = () => browser && document.getElementById('loading-veil') !== null;

/**
 * Claim the veil until this surface's content is really on screen. Returns the
 * release function — idempotent, and safe to call after the veil has gone.
 */
export function claimVeilReady(): () => void {
	if (!veilPresent()) return () => {};
	claimed++;
	let done = false;
	return () => {
		if (done) return;
		done = true;
		released++;
		if (released >= claimed) for (const fn of listeners) fn();
	};
}

/** True while some surface still owes the veil a release. */
export const veilClaimsPending = (): boolean => released < claimed;

/** Run `fn` once every outstanding claim has been released. */
export function onVeilReady(fn: () => void): () => void {
	if (!veilClaimsPending()) {
		fn();
		return () => {};
	}
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/**
 * Run `fn` after the browser has actually presented a frame. Two rAFs: the
 * first lands before the pending paint, the second after it — the same
 * double-frame guarantee the portal reveal and the tool cross-fade use.
 */
export function afterPaint(fn: () => void): () => void {
	let inner = 0;
	const outer = requestAnimationFrame(() => {
		inner = requestAnimationFrame(fn);
	});
	return () => {
		cancelAnimationFrame(outer);
		cancelAnimationFrame(inner);
	};
}
