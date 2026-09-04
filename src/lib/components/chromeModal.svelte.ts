/** Which meta overlay the chrome has open, site-wide.
 *
 * The chrome buttons write this; a per-layout `<ChromeModals />` host reads it.
 * They have to be separate subtrees: on the scene layout the chrome sits inside
 * `.scene-chrome`, which carries a parallax transform — and a transform makes a
 * containing block for `position: fixed` descendants, so an overlay rendered
 * under the chrome would resolve `inset: 0` against a 64px-tall bar. Module
 * state is what lets the button and the panel live in different places.
 *
 * ⚠️ Opening one of these NEVER moves the URL (Nate, 2026-07-26). The tools
 * layout keys its page layer on `page.url.pathname`, so a shallow-routed URL
 * change would destroy and remount the entire tool — CodeMirror re-init, the
 * timeline's full recompute, the ~200ms WebKit mount block. Every chapter is
 * also a real prerendered route, but those exist for deep links and search
 * results, not for the overlay.
 */

import type { ChromeAreaId } from '$lib/help/areas';

export type ChromeModalState =
	| { kind: 'area'; area: ChromeAreaId; chapter: string }
	| { kind: 'settings' }
	| { kind: 'nav' }
	| null;

let state = $state<ChromeModalState>(null);

export const chromeModal = {
	get current() {
		return state;
	}
};

/** Open an area at a chapter (defaults to the area's first). */
export function openArea(area: ChromeAreaId, chapter: string): void {
	state = { kind: 'area', area, chapter };
}

export function openSettings(): void {
	state = { kind: 'settings' };
}

/**
 * The compass — every destination on the site in one panel (2026-09-04).
 *
 * ⚠ It exists because the chrome bar is OVER-SUBSCRIBED below 40rem, measured:
 * brand 204.6 + three 34px glyphs + padding and gaps needs ~400px, and a
 * 320px phone has 320. Rather than shrink targets or drop the wordmark, the
 * whole navigation — tool switcher AND the three meta glyphs — folds into one
 * button, which costs 34px and leaves 41px of slack at 320. Tool switching and
 * About/Help/Settings are all NAVIGATION; splitting them across four controls
 * spends 120px on a distinction a phone reader does not need.
 * Derivation: docs/responsive-survey-2026-09-01.md § 8.2.
 */
export function openNav(): void {
	state = { kind: 'nav' };
}

export function closeChromeModal(): void {
	state = null;
}

/** In-modal chapter navigation — the sidebar/tabs switch without reopening. */
export function setChapter(chapter: string): void {
	if (state?.kind === 'area') state = { ...state, chapter };
}
