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

import { resolve } from '$app/paths';
import type { ChromeAreaId } from '$lib/help/areas';
import { chapterSection, menu } from '$lib/menuState.svelte';

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
	// ⚓ Under the switch (build plan §13, 2c) Help and About are sections of
	// the menu state, so every door into them — a chapter's link, Coverage's
	// opener — goes there.
	menu.show(chapterSection(area, chapter));
}

export function openSettings(): void {
	menu.show('settings');
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
 * Derivation: docs/rounds/responsive-survey-2026-09-01.md § 8.2.
 */
export function openNav(): void {
	menu.show('index');
}

export function closeChromeModal(): void {
	state = null;
}

/** In-modal chapter navigation — the sidebar/tabs switch without reopening. */
export function setChapter(chapter: string): void {
	if (state?.kind === 'area') state = { ...state, chapter };
}

/**
 * THE ROSTER BUTTON's opener (lineups design §11.6 item 1). The roster belongs
 * to the account, not to the document band A edits, so its button lives in the
 * site chrome beside the cog — but it opens the Library on its Roster tab, and
 * the Library is the tools layout's overlay. So the tools layout REGISTERS the
 * opener while it is mounted, and the chrome (and the compass, which takes the
 * button below `roomy`) opens the overlay exactly when there is one. Module
 * state, for the same reason as the modal state above — the button and the
 * overlay live in different subtrees.
 *
 * ↻ 2026-10-18 (⚓ Nate): the button is on EVERY surface. Where no opener is
 * registered (the landing, the static pages) it is a link to the `/library`
 * page on its Roster tab (`rosterHref`) — ⚠️ a real navigation, and only
 * where no tool is underneath to lose.
 */
let rosterOpener = $state<(() => void) | null>(null);

/**
 * ⚓ THE ONE "ARE WE ON A TOOL?" the chrome asks (2026-10-18): true while the
 * tools layout is mounted, i.e. while its registration stands. On a tool the
 * chrome's About, Help and Roster open OVERLAYS (⛔ never leave a tool
 * mid-task); off a tool (the landing, the static pages) they are LINKS to
 * their pages — /about, /help, /library — because those are things you go
 * and READ, and there is nothing underneath to lose. ⚓ Settings stays a
 * modal everywhere (a control you reach for mid-task, the compass round).
 * Read this, ⛔ not a second path test, so the three can never disagree.
 */
export function onTool(): boolean {
	return rosterOpener !== null;
}

export const roster = {
	get available() {
		return onTool();
	},
	open() {
		closeChromeModal();
		rosterOpener?.();
	}
};

/** The Roster button off the tools: the `/library` page on its Roster tab. */
export const rosterHref = `${resolve('/library')}?tab=roster`;

/** About and Help off the tools: their pages. Help goes to its INDEX — off a
 *  tool there is no current tool's chapter to guess. */
export const aboutHref = resolve('/about');
export const helpHref = resolve('/help');

/** Already on that page (the chrome marks it current and the click is a
 *  no-op): About on /about; Help on /help or any of its chapters. */
export function isAboutPage(pathname: string): boolean {
	return pathname === aboutHref;
}
export function isHelpPage(pathname: string): boolean {
	return pathname === helpHref || pathname.startsWith(`${helpHref}/`);
}

/** The click on a link to the page already showing: nothing (no re-navigation,
 *  no crossfade of the same page). Modified clicks still open a new tab. */
export function stayHere(event: MouseEvent): void {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
		return;
	event.preventDefault();
}

/** The tools layout's registration; the cleanup clears it only if it is still
 *  ours (two layouts are briefly alive during a page transition). */
export function registerRosterOpener(open: () => void): () => void {
	rosterOpener = open;
	return () => {
		if (rosterOpener === open) rosterOpener = null;
	};
}
