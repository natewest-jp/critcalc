import { get } from 'svelte/store';
import { siteSettings } from '$lib/stores';
import { getAllCharacterIndex } from '$lib/data/characterLookup';
import { getAvatar, hasAvatar } from './getAvatar';

let warmed = false;

/** Prefetch every roster portrait (the `full` grid asset) at browser idle, so
 *  the first character grid a session opens (RP Source, TB Roster) paints from
 *  cache instead of fetching ~120 images at click time. The set is ~2.2MB of
 *  ~17KB files; with the year-long `/assets/*` Cache-Control this is a
 *  once-per-deploy cost. Runs once per session, client-only, skipped when the
 *  user asked for reduced data. Call from tool-page onMount. */
export function warmAvatars(): void {
	if (warmed || typeof window === 'undefined') return;
	const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
	if (conn?.saveData) return;
	warmed = true;

	const { useNewOutfits, travelerVariant } = get(siteSettings);
	// Set: the six traveler_* ids collapse to one aether/lumine URL.
	const queue = [
		...new Set(
			getAllCharacterIndex()
				.filter((c) => c.id !== 'blank' && hasAvatar(c.id))
				.map((c) => getAvatar(c.id, useNewOutfits, 'full', travelerVariant))
		)
	];

	// Safari has no requestIdleCallback — a short timeout approximates it. The
	// timeout option matters: without it, a busy page (dev-mode planner with a
	// saved rotation) starves idle callbacks and the warm-up crawls — measured
	// 41/117 after 6s. With it, each batch fires within 400ms regardless.
	const idle = (fn: () => void) =>
		'requestIdleCallback' in window
			? requestIdleCallback(fn, { timeout: 400 })
			: setTimeout(fn, 200);
	const BATCH = 24;
	const pump = () => {
		for (const src of queue.splice(0, BATCH)) {
			// fetch(), not new Image(): warming only needs the HTTP cache filled,
			// and Safari 26.x charges ~2ms of main-thread setup per img-with-src
			// (the same engine regression the grids' background-image divs dodge).
			fetch(src).catch(() => {});
		}
		if (queue.length) idle(pump);
	};
	idle(pump);
}
