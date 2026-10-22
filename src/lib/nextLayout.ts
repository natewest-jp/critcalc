/**
 * The switch (build plan §13.1): everything the profiles-and-surfaces design
 * builds lands on `main` behind it, OFF by default, so users see nothing
 * until it becomes the default in one release.
 *
 * - `?next` turns it on for this browser and `?next=0` turns it off, so a
 *   tester can be handed it as a link. It persists until turned off.
 * - Settings shows a "Use the new layout" toggle ONLY while it is on, so the
 *   public never meets a half-built option, and whoever turned it on can turn
 *   it off without editing a URL.
 *
 * ⚠ Its own key, deliberately not in `siteSettings`: it is a tester's switch,
 * not the player's data, so a backup must not carry it to another browser.
 *
 * Phase 1: on, the site migrates its storage into IndexedDB (copy-only) and
 * changes nothing else.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { safeRemoveItem, safeSetItem } from '$lib/stores';

const KEY = 'critcalc:nextLayout';

function read(): boolean {
	if (!browser) return false;
	try {
		return localStorage.getItem(KEY) === '1';
	} catch {
		return false;
	}
}

function createSwitch() {
	const store = writable(read());
	const set = (on: boolean) => {
		if (on) safeSetItem(KEY, '1');
		else safeRemoveItem(KEY);
		store.set(on);
	};
	const fromUrl = (url: URL) => {
		if (!url.searchParams.has('next')) return;
		set(url.searchParams.get('next') !== '0');
	};
	// ⚠ Read the address at MODULE INIT, not in a layout's onMount: a child
	// layout mounts before its parent, so the tools layout would otherwise
	// decide on the switch before the root layout had read `?next`.
	if (browser) fromUrl(new URL(location.href));
	return {
		subscribe: store.subscribe,
		set,
		/** Read `?next` / `?next=0` off an address; anything else leaves it. */
		fromUrl
	};
}

export const nextLayout = createSwitch();
