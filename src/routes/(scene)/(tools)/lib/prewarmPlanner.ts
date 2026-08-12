/**
 * prewarmPlanner.ts
 *
 * Two warmers, and the difference between them is PRIORITY.
 *
 * ── 1. The ACTIVE tab, at NAVIGATION START ────────────────────────────────
 * Fires the planner's lazy character-payload fetches at click time instead of
 * after mount. The planner restores its active tab from localStorage and
 * lazy-loads each slotted character; when those chunks arrive staggered after
 * mount, each landing re-parses the rotation and rebuilds the timeline —
 * main-thread blocks that can land mid cross-fade (the residual fade stutter
 * measured 2026-07-10: 25–85ms blocks inside the fade window on WebKit).
 * Starting the fetches at click time gets the payloads resolved before or with
 * the mount, so the first parse already sees them and the staggered rebuilds
 * collapse.
 *
 * ── 2. The OTHER OPEN TABS, at IDLE AFTER MOUNT ───────────────────────────
 * ⚓ NATE 2026-08-12: "there's a loading jump if you're clicking on a tab for
 * the first time. Should we preload/warm all currently open tabs' characters?"
 *
 * Yes — and note what the fix is NOT. The jump is a COLD PAYLOAD LOAD, not a
 * missing transition, and covering a variable-length wait with a fade would
 * slow down every fast switch without fixing the slow one. The tab you have not
 * opened this session is precisely the one warmer #1 skips, because it only
 * ever looked at the active tab. So: same machinery, wider net, lower priority.
 *
 * ⚠ THE PRIORITY SPLIT IS THE DESIGN. These must not compete. The active tab is
 * what you are about to look at and it goes out at click time on the network's
 * full attention; the other tabs are speculative and wait for idle, after the
 * mount they would otherwise have stolen frames from.
 *
 * Cost, measured 2026-08-12: character payloads are ~13KB median (133 chunks,
 * mean 14.8KB). Six tabs × 4 slots is 24 ids before dedupe, and tabs overlap
 * heavily in practice — a full bank realistically resolves to 8–12 unique
 * chunks. loadCharacter is idempotent and dedupes in flight, so re-asking for
 * something already loaded is free.
 *
 * Both are best-effort by design: any storage/parse hiccup just skips the
 * prewarm — the planner loads everything itself after mount regardless.
 */

import { loadCharacter } from '$lib/data/characterData';
import {
	rotationTabs,
	tabCharacterIds,
	TABS_KEY,
	type RotationTab
} from '$lib/rotationTabs.svelte';

export function prewarmPlannerCharacters(): void {
	try {
		// Reads STORAGE, not the store: this runs at navigation start, which is
		// before the tools layout has called rotationTabs.restore().
		const raw = localStorage.getItem(TABS_KEY);
		if (!raw) return;
		const data = JSON.parse(raw) as {
			tabs?: Array<Pick<RotationTab, 'id' | 'notation' | 'manualSlots'>>;
			activeTabId?: string;
		};
		const active = data.tabs?.find((t) => t.id === data.activeTabId) ?? data.tabs?.[0];
		if (!active) return;

		for (const id of tabCharacterIds(active)) void loadCharacter(id);
	} catch {
		// best-effort — see module comment
	}
}

let warmedOtherTabs = false;

/**
 * Warm every OPEN tab's characters at idle. Call from the planner's onMount —
 * that is the tool where tabs get switched, and by then the store is restored,
 * so this reads `rotationTabs` rather than re-parsing storage.
 *
 * Once per session: the set only grows when you open a tab, and opening one
 * already loads what it needs.
 */
export function warmOpenTabCharacters(): void {
	if (warmedOtherTabs || typeof window === 'undefined') return;
	const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
	if (conn?.saveData) return;
	warmedOtherTabs = true;

	try {
		// Active tab FIRST in the queue. Warmer #1 has usually resolved it
		// already, which makes those entries free — and if this is a cold load
		// straight onto /rotation-planner, warmer #1 never ran and the ordering
		// is what stops a speculative tab from being fetched ahead of the one
		// on screen.
		const ordered = [
			...(rotationTabs.activeTab ? [rotationTabs.activeTab] : []),
			...rotationTabs.tabs.filter((t) => t.id !== rotationTabs.activeTabId)
		];
		const queue = [...new Set(ordered.flatMap(tabCharacterIds))];

		// Same idle shape as warmAvatars (Safari lacked requestIdleCallback, and
		// the `timeout` matters — a busy planner starves idle callbacks outright).
		// BATCH is small because each landing chunk costs a main-thread parse, and
		// the whole point of deferring these is to not spend frames on them.
		const idle = (fn: () => void) =>
			'requestIdleCallback' in window
				? requestIdleCallback(fn, { timeout: 500 })
				: setTimeout(fn, 200);
		const BATCH = 4;
		const pump = () => {
			for (const id of queue.splice(0, BATCH)) void loadCharacter(id);
			if (queue.length) idle(pump);
		};
		idle(pump);
	} catch {
		// best-effort — see module comment
	}
}
