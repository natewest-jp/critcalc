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
	/**
	 * Per-tab constellation overrides (Layer 2), snapshot alongside the notation.
	 * Densified on save (resolved effective level for every slotted character) so
	 * a saved rotation stays faithful even if the roster's constellations change
	 * later — see the planner page's handleSave.
	 */
	tabCon?: Record<string, number>;
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
		update(
			id: string,
			fields: Partial<
				Pick<SavedNotation, 'name' | 'notation' | 'manualSlots' | 'tabLoadout' | 'tabCon'>
			>
		) {
			store.update((items) =>
				persist(items.map((e) => (e.id === id ? { ...e, ...fields, savedAt: Date.now() } : e)))
			);
		},

		/** Rename only — does not bump savedAt so sort order is stable. */
		rename(id: string, name: string) {
			store.update((items) => persist(items.map((e) => (e.id === id ? { ...e, name } : e))));
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
// Ownership: which characters the user owns / wishlists
// ---------------------------------------------------------------------------
//
// Keyed by characterId; value marks the character as owned or wishlisted.
// Absence = neither (unowned, not wishlisted). Sits alongside `constellations`
// as the roster ledger. Distinct from a constellation level: implicit-C0 no
// longer means "unowned" now that ownership is tracked explicitly.

const OWNERSHIP_KEY = 'critcalc:ownership';

export type OwnershipMark = 'owned' | 'wishlist';

/**
 * One-time migration seed: anyone who set an explicit constellation level did so
 * deliberately, which only makes sense for a character they own — so pre-existing
 * `constellations` entries imply ownership. Pure, so it's unit-testable without
 * localStorage.
 */
export function deriveInitialOwnership(
	cons: Record<string, number>
): Record<string, OwnershipMark> {
	const out: Record<string, OwnershipMark> = {};
	for (const id of Object.keys(cons)) out[id] = 'owned';
	return out;
}

function loadOwnership(): Record<string, OwnershipMark> {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(OWNERSHIP_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return typeof parsed === 'object' && parsed !== null ? parsed : {};
		}
	} catch {
		return {};
	}
	// No stored ownership yet — seed once from existing constellation entries so
	// returning users don't start with an empty roster, then persist so a later
	// explicit un-mark isn't re-seeded on every reload.
	const seeded = deriveInitialOwnership(loadConstellations());
	if (Object.keys(seeded).length > 0) {
		localStorage.setItem(OWNERSHIP_KEY, JSON.stringify(seeded));
	}
	return seeded;
}

function createOwnershipStore() {
	const store = writable<Record<string, OwnershipMark>>(loadOwnership());

	function persist(next: Record<string, OwnershipMark>) {
		if (browser) localStorage.setItem(OWNERSHIP_KEY, JSON.stringify(next));
		return next;
	}

	return {
		subscribe: store.subscribe,
		/** Mark a character owned/wishlisted, or pass null to clear the mark. */
		setMark(characterId: string, mark: OwnershipMark | null) {
			store.update((prev) => {
				const next = { ...prev };
				if (mark === null) delete next[characterId];
				else next[characterId] = mark;
				return persist(next);
			});
		},
		clear() {
			store.set({});
			if (browser) localStorage.removeItem(OWNERSHIP_KEY);
		}
	};
}

export const ownership = createOwnershipStore();

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
	/** Which traveler renders wherever a traveler_* character appears. */
	travelerVariant: 'aether' | 'lumine';
	swapFrames: number;
};

const SITE_SETTINGS_DEFAULTS: SiteSettings = {
	useNewOutfits: false,
	travelerVariant: 'aether',
	swapFrames: 8
};

function loadSiteSettings(): SiteSettings {
	if (!browser) return { ...SITE_SETTINGS_DEFAULTS };
	try {
		return {
			...SITE_SETTINGS_DEFAULTS,
			...JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) ?? '{}')
		};
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
		setTravelerVariant(value: 'aether' | 'lumine') {
			store.update((prev) => persist({ ...prev, travelerVariant: value }));
		},
		setSwapFrames(value: number) {
			store.update((prev) => persist({ ...prev, swapFrames: value }));
		}
	};
}

export const siteSettings = createSiteSettingsStore();
