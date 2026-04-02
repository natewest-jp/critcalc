/**
 * src/lib/stores.ts
 *
 * Shared, persistent Svelte stores for critcalc tools.
 * All stores that need localStorage persistence are initialised from
 * localStorage on first load and write back on every change.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// ---------------------------------------------------------------------------
// Constellation levels
// ---------------------------------------------------------------------------
//
// Keyed by characterId (e.g. "bennett"), value is 0–6 (C0–C6).
// Persists across page loads and is shared across all tools.

const CONSTELLATION_KEY = 'critcalc:constellations';

function loadConstellations(): Record<string, number> {
	if (!browser) return {};
	try {
		return JSON.parse(localStorage.getItem(CONSTELLATION_KEY) ?? '{}');
	} catch {
		return {};
	}
}

function createConstellationStore() {
	const store = writable<Record<string, number>>(loadConstellations());

	return {
		subscribe: store.subscribe,
		setLevel(characterId: string, level: number) {
			store.update((prev) => {
				const next = { ...prev, [characterId]: level };
				if (browser) localStorage.setItem(CONSTELLATION_KEY, JSON.stringify(next));
				return next;
			});
		},
		clear() {
			store.set({});
			if (browser) localStorage.removeItem(CONSTELLATION_KEY);
		}
	};
}

export const constellations = createConstellationStore();

// ---------------------------------------------------------------------------
// Loadout: weapon and artifact labels
// ---------------------------------------------------------------------------
//
// Keyed by characterId. Values are free-text labels set by the user
// (e.g. "Aquila Favonia", "Noblesse Oblige 4pc").

const LOADOUT_KEY = 'critcalc:loadout';

type Loadout = { weapon?: string; artifact?: string };

function loadLoadout(): Record<string, Loadout> {
	if (!browser) return {};
	try {
		return JSON.parse(localStorage.getItem(LOADOUT_KEY) ?? '{}');
	} catch {
		return {};
	}
}

function createLoadoutStore() {
	const store = writable<Record<string, Loadout>>(loadLoadout());

	function persist(next: Record<string, Loadout>) {
		if (browser) localStorage.setItem(LOADOUT_KEY, JSON.stringify(next));
		return next;
	}

	return {
		subscribe: store.subscribe,
		setWeapon(characterId: string, label: string) {
			store.update((prev) => persist({ ...prev, [characterId]: { ...prev[characterId], weapon: label || undefined } }));
		},
		setArtifact(characterId: string, label: string) {
			store.update((prev) => persist({ ...prev, [characterId]: { ...prev[characterId], artifact: label || undefined } }));
		},
		clear() {
			store.set({});
			if (browser) localStorage.removeItem(LOADOUT_KEY);
		}
	};
}

export const loadout = createLoadoutStore();

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------
//
// Global display preferences. Persists across page loads.

const SITE_SETTINGS_KEY = 'critcalc:siteSettings';

type SiteSettings = {
	useNewOutfits: boolean;
	swapFrames: number;
};

const SITE_SETTINGS_DEFAULTS: SiteSettings = {
	useNewOutfits: false,
	swapFrames: 8
};

function loadSiteSettings(): SiteSettings {
	if (!browser) return { ...SITE_SETTINGS_DEFAULTS };
	try {
		return { ...SITE_SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) ?? '{}') };
	} catch {
		return { ...SITE_SETTINGS_DEFAULTS };
	}
}

function createSiteSettingsStore() {
	const store = writable<SiteSettings>(loadSiteSettings());

	function persist(next: SiteSettings) {
		if (browser) localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(next));
		return next;
	}

	return {
		subscribe: store.subscribe,
		setUseNewOutfits(value: boolean) {
			store.update((prev) => persist({ ...prev, useNewOutfits: value }));
		},
		setSwapFrames(value: number) {
			store.update((prev) => persist({ ...prev, swapFrames: value }));
		}
	};
}

export const siteSettings = createSiteSettingsStore();
