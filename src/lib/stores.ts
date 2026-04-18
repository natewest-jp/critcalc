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
// Saved notations (save bank)
// ---------------------------------------------------------------------------
//
// A persistent bank of named rotations the user has explicitly saved.
// Shared across tools — eventually the Team Builder may load from here too.

const SAVED_NOTATIONS_KEY = 'critcalc:savedNotations';

export type SavedNotation = {
	id: string;
	name: string;
	notation: string;
	manualSlots: string[] | null;
	tabLoadout?: Record<string, LoadoutEntry>;
	savedAt: number; // Unix timestamp (ms)
};

function loadSavedNotations(): SavedNotation[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(SAVED_NOTATIONS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function createSavedNotationsStore() {
	const store = writable<SavedNotation[]>(loadSavedNotations());

	function persist(items: SavedNotation[]): SavedNotation[] {
		if (browser) localStorage.setItem(SAVED_NOTATIONS_KEY, JSON.stringify(items));
		return items;
	}

	return {
		subscribe: store.subscribe,

		/** Create a new entry. Returns the generated id. */
		save(entry: Omit<SavedNotation, 'id' | 'savedAt'>): string {
			const id = Math.random().toString(36).slice(2, 10);
			store.update((items) => persist([...items, { ...entry, id, savedAt: Date.now() }]));
			return id;
		},

		/** Update an existing entry's content and/or name in-place. */
		update(id: string, fields: Partial<Pick<SavedNotation, 'name' | 'notation' | 'manualSlots' | 'tabLoadout'>>) {
			store.update((items) =>
				persist(items.map((e) => (e.id === id ? { ...e, ...fields, savedAt: Date.now() } : e)))
			);
		},

		/** Rename only — does not bump savedAt so sort order is stable. */
		rename(id: string, name: string) {
			store.update((items) =>
				persist(items.map((e) => (e.id === id ? { ...e, name } : e)))
			);
		},

		delete(id: string) {
			store.update((items) => persist(items.filter((e) => e.id !== id)));
		}
	};
}

export const savedNotations = createSavedNotationsStore();

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
// Loadout: weapon and artifact selection per character
// ---------------------------------------------------------------------------
//
// Layer 1 (character defaults) — keyed by characterId, persisted to localStorage.
// Layer 2 (tab overrides) — lives in Tab.tabLoadout in the rotation planner page.
// Resolution: tab override wins over character default.

const LOADOUT_KEY = 'critcalc:loadout';

export type LoadoutEntry = {
	weaponId?: string;
	weaponRefinement?: 1 | 2 | 3 | 4 | 5;
	artifactSetId?: string;
};

function loadLoadout(): Record<string, LoadoutEntry> {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(LOADOUT_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		// Migrate: old free-text { weapon, artifact } entries are silently dropped
		// since they won't have weaponId/artifactSetId fields.
		if (typeof parsed !== 'object' || parsed === null) return {};
		return parsed;
	} catch {
		return {};
	}
}

function createLoadoutStore() {
	const store = writable<Record<string, LoadoutEntry>>(loadLoadout());

	function persist(next: Record<string, LoadoutEntry>) {
		if (browser) localStorage.setItem(LOADOUT_KEY, JSON.stringify(next));
		return next;
	}

	return {
		subscribe: store.subscribe,
		setWeapon(characterId: string, weaponId?: string, refinement?: 1 | 2 | 3 | 4 | 5) {
			store.update((prev) => {
				const entry: LoadoutEntry = { ...prev[characterId] };
				entry.weaponId = weaponId;
				entry.weaponRefinement = refinement;
				return persist({ ...prev, [characterId]: entry });
			});
		},
		setArtifact(characterId: string, artifactSetId?: string) {
			store.update((prev) => {
				const entry: LoadoutEntry = { ...prev[characterId] };
				entry.artifactSetId = artifactSetId;
				return persist({ ...prev, [characterId]: entry });
			});
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
