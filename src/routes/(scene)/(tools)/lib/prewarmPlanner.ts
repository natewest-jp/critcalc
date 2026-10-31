/**
 * prewarmPlanner.ts
 *
 * ⚓ NATE 2026-08-12: "there's a loading jump if you're clicking on a tab for
 * the first time. Should we preload/warm all currently open tabs' characters?"
 *
 * Yes — and note what the fix is NOT. The jump is a COLD PAYLOAD LOAD, not a
 * missing transition, and covering a variable-length wait with a fade would
 * slow down every fast switch without fixing the slow one. So the open tabs'
 * characters are warmed at idle, after the mount they would otherwise have
 * stolen frames from.
 *
 * ↻ 2026-10-31: the navigation-start warmer for the ACTIVE tab retired with the
 * old layout. It read the old layout's tabs from localStorage, which the
 * migration left frozen, and the profiles layout has nothing to read early: a
 * tool you leave is paused with its characters loaded, and on a cold arrival
 * the storage session has not loaded the rotation yet.
 *
 * Cost, measured 2026-08-12: character payloads are ~13KB median (133 chunks,
 * mean 14.8KB). loadCharacter is idempotent and dedupes in flight, so
 * re-asking for something already loaded is free. Best-effort by design: the
 * planner loads everything itself regardless.
 */

import { loadCharacter } from '$lib/data/characterData';
import { rotationTabs, tabCharacterIds } from '$lib/rotationTabs.svelte';

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
		// Active tab FIRST in the queue: the ordering is what stops a
		// speculative tab from being fetched ahead of the one on screen.
		const ordered = [
			...(rotationTabs.activeTab ? [rotationTabs.activeTab] : []),
			...rotationTabs.tabs.filter((t) => t.id !== rotationTabs.activeTabId)
		];
		const queue = [...new Set(ordered.flatMap(tabCharacterIds))];

		// ⚠ NO `timeout`, and that is the ONE place this deliberately differs from
		// warmAvatars. A timeout is an instruction to run EVEN IF THE PAGE IS
		// BUSY, which is the exact opposite of what "speculative, lower priority"
		// means — and the busiest moment on this page is the Source overlay's
		// roster mounting ~123 tiles in rAF batches, i.e. precisely when a forced
		// batch of chunk parses would be felt. warmAvatars needs its timeout
		// because those images are wanted by that very grid; these payloads are
		// wanted by a tab switch that has not happened yet, so waiting for real
		// idle costs nothing and starving until the page settles is CORRECT
		// behaviour rather than a failure mode.
		//
		// BATCH is small for the same reason: each landing chunk costs a
		// main-thread parse, and not spending frames on them is the whole point.
		const idle = (fn: () => void) =>
			'requestIdleCallback' in window ? requestIdleCallback(fn) : setTimeout(fn, 200);
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
