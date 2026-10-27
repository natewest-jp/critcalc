/**
 * The switch (build plan §13.1): everything the profiles-and-surfaces design
 * built landed on `main` behind it, and since the flip (2026-10-27) it is ON
 * by default. The old layout survives only as the switch's OFF state.
 *
 * - The default is the absence of the key, so a visitor carries nothing.
 *   Only a stored `'0'` turns it off. Nothing in the UI writes one: it is
 *   kept for the e2e suite (`e2e/fixtures/critcalc.ts` seeds it) and for
 *   `?next=0` in dev.
 * - `?next` / `?next=0` are read in DEV ONLY. A link must not be able to
 *   hand the public the old layout.
 *
 * ⚠ Its own key, deliberately not in `siteSettings`: it is a tester's switch,
 * not the player's data, so a backup must not carry it to another browser.
 * ⚠ `stores.ts` `underSwitch()` reads the same key raw (an import here would
 * be circular), so the two tests must change together.
 *
 * On, the site migrates its storage into IndexedDB (copy-only) and renders
 * the new layout; without usable IndexedDB the switch reads as off.
 */

import { writable } from 'svelte/store';
import { browser, dev } from '$app/environment';
import { safeRemoveItem, safeSetItem } from '$lib/stores';
import { storageUsable } from '$lib/storageUsable';

export { storageFailed } from '$lib/storageUsable';

const KEY = 'critcalc:nextLayout';

function read(): boolean {
	if (!browser) return false;
	try {
		return localStorage.getItem(KEY) !== '0';
	} catch {
		return false;
	}
}

function createSwitch() {
	const store = writable(read() && storageUsable());
	const set = (on: boolean) => {
		if (on) safeRemoveItem(KEY);
		else safeSetItem(KEY, '0');
		store.set(on && storageUsable());
	};
	const fromUrl = (url: URL) => {
		if (!dev) return;
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
		/** Dev only: read `?next` / `?next=0` off an address; anything else leaves it. */
		fromUrl
	};
}

export const nextLayout = createSwitch();
