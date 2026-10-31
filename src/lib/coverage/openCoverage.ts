/**
 * src/lib/coverage/openCoverage.ts
 *
 * ⚓ Coverage opens OVER the surface you are on (⚓ Nate 2026-09-23): a link to
 * it — the Team Builder, the landing banner — opens the menu state's Coverage
 * section instead of navigating, so the tool stays where it was. The anchor keeps its real `/coverage?c=…` href, so a middle-
 * click or ⌘-click still opens the route in a new tab.
 *
 * The characters a link names travel through `pendingFocus`, read ONCE by the
 * list when it mounts.
 */

import { chapterSection, menu } from '$lib/menuState.svelte';

let pendingFocus: string[] | null = null;

/** The ids the opening link named, once; null when the list was opened some
 *  other way (the sidebar, the route without `?c=`). */
export function takeCoverageFocus(): string[] | null {
	const f = pendingFocus;
	pendingFocus = null;
	return f;
}

/** The static pages are routes too; on one of them a link simply navigates,
 *  as every other link in a chapter does. */
const PAGE_ROUTE = /^\/(about|help|contribute|privacy|settings|coverage)(\/|$)/;

export function openCoverage(event: MouseEvent, ids: string[] = []): void {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
		return; // a new tab: let the href work
	if (PAGE_ROUTE.test(location.pathname)) return;
	event.preventDefault();
	pendingFocus = ids.length > 0 ? ids : null;
	menu.show(chapterSection('about', 'coverage'));
}
