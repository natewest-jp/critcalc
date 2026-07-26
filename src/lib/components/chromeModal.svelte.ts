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

export function closeChromeModal(): void {
	state = null;
}

/** In-modal chapter navigation — the sidebar/tabs switch without reopening. */
export function setChapter(chapter: string): void {
	if (state?.kind === 'area') state = { ...state, chapter };
}
