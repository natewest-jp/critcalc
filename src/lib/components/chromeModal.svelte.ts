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
 * ⚠ It exists because the chrome bar is OVER-SUBSCRIBED below 47.5rem,
 * measured: brand 204.4 + three 34px glyphs + padding and gaps wants ~400px in
 * a 320px bar. The tool switcher, About and Help fold in here; the form that
 * ships is 310.8px with 9.2px of slack.
 *
 * ⚓ THE SETTINGS COG DELIBERATELY STAYS OUT (Nate 2026-09-04). About and Help
 * are things you go and READ — they belong behind a navigation panel with
 * every other destination. Settings is a control you REACH FOR mid-task, and
 * burying that makes it feel further away than it is.
 *
 * ⚠ Settings is still LISTED in the panel as well, and ⛔ that is not a
 * duplicate to tidy away: the cog is an unlabelled glyph, and a reader who
 * does not recognise it will open this panel to look.
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
