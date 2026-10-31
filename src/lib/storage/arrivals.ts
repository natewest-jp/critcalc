/**
 * Where an ARRIVING document goes (design §9.3; build plan
 * §13, phase 2d). A shared link is read by its tool page as soon as the page
 * navigates, which on a cold load is BEFORE the storage session has loaded the
 * profile's documents — so applied straight away, it would be overwritten a
 * moment later by the session's restore. Arrivals wait for this instead.
 *
 * Kept free of imports so the tool bars can await it without pulling the
 * session (a lazy chunk) into every bundle.
 */

let settle!: (viaStore: boolean) => void;

/** Settles once the tools layout has decided where documents live: `true`
 *  when the storage session took over, `false` when it fell back to
 *  localStorage (no IndexedDB), where arrivals take today's path. */
export const documentsReady: Promise<boolean> = new Promise((r) => (settle = r));

export const settleDocuments = (viaStore: boolean): void => settle(viaStore);

const LINK_TAB_KEY = 'critcalc:linkTab';

/** ⚓ "This tab arrived by a link that left a real profile" (Nate 2026-10-27).
 *  Per TAB, so a reload there stays in Theorycraft while the next new tab
 *  opens back in the profile (`Meta.returnToProfileId`). Without
 *  sessionStorage it reads as unmarked: a reload then returns too. */
export const linkTab = {
	has(): boolean {
		try {
			return sessionStorage.getItem(LINK_TAB_KEY) === '1';
		} catch {
			return false;
		}
	},
	mark(): void {
		try {
			sessionStorage.setItem(LINK_TAB_KEY, '1');
		} catch {
			/* storage blocked: see above */
		}
	}
};

/** The notice an arrival shows when it had to leave a real profile. */
export const OPENED_IN_THEORYCRAFT = 'Opened in Theorycraft · your profiles are untouched';

/** A `?team=` naming no character we have. */
export const NO_TEAM_IN_LINK = 'That link names no character this site has, so nothing was added.';

/** A `?r=` / `?b=` that didn't decode: the likely reason and what to do. */
export const INVALID_SHARE_LINK =
	'That share link couldn’t be read. It may have been cut short when it was copied, so ask for the full link.';
