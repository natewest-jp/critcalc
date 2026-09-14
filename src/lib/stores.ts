/**
 * src/lib/stores.ts
 *
 * Shared, persistent Svelte stores for critcalc tools.
 * All stores that need localStorage persistence are initialized from
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
	/** ⛔ RETIRED (single truth, 2026-08-13) — never written again. Entries saved
	 *  before the round still carry it, and documentBar.load folds it into the
	 *  notation on the way in (rotationTabs.LegacyTeam). */
	manualSlots?: string[] | null;
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
			fields: Partial<Pick<SavedNotation, 'name' | 'notation' | 'tabLoadout' | 'tabCon'>>
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
		},

		clear() {
			store.set([]);
			if (browser) localStorage.removeItem(SAVED_NOTATIONS_KEY);
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
	/**
	 * Network latency in milliseconds — the value Genshin shows top-right. The
	 * rotation planner converts it to swap-delay frames (`swapFramesForPing` in
	 * `$lib/utils/frames`: KQM's measured ping + 90 ms) so timings reflect real
	 * play. Stored as ms because that's the number players actually know.
	 */
	swapPing: number;
	/**
	 * ── THE PLANNER'S TIMELINE LAYERS (2026-08-17) ──────────────────────────
	 *
	 * What the timeline draws BESIDE ability timings. Both are toggled from
	 * band B; a reader who wants only "when does each cast happen" can turn
	 * both off and get exactly that.
	 *
	 * ⚠ WHY THESE PERSIST WHEN ZOOM DOES NOT (plannerView's header says view
	 * state is deliberately not stored). Zoom is per-LOOK — you set it for the
	 * rotation in front of you and it means nothing tomorrow. A layer toggle is
	 * per-TASTE: "I read timelines without buff rows" is a standing preference,
	 * and making someone re-hide them every session would be the tool
	 * forgetting something it was told. They live here rather than in
	 * plannerView for that reason alone.
	 *
	 * ⛔ NOT part of the document, and never in the `?r=` codec (format '2').
	 * A shared link carries a rotation, not the recipient's reading preferences
	 * — and a link that silently hid the recipient's buff rows would be a
	 * defect they could not attribute.
	 */
	showAuraLane: boolean;
	showTimelineBuffs: boolean;
};

/**
 * The resting layers, exported because band B's "Reset view" restores exactly
 * these — ⛔ two copies of this pair is how a reset comes to disagree with a
 * fresh browser.
 *
 * ↻ ⚓ NATE 2026-09-01: **BOTH ON.** The original call below (auras OFF) was
 * made the day the lane shipped, when it was one plot and the newest thing in
 * the tool. Since then it has taken the reposition above the axis, the shared
 * marker grammar, the event log, the crosshair and now the gadget strip — "the
 * lane has become so much of a feature it's time to make it the default". ⚠️ The
 * argument that retired is "a reader should have to opt into the most technical
 * surface": a lane nobody finds the toggle for is a lane nobody has, and the
 * reason it looked technical was that it was unfinished.
 *
 * ⚓ The ORIGINAL reasoning, kept because half of it still stands — the buff
 * rows have been part of the timeline's answer since long before the lane, so
 * hiding them by default would change what the planner IS for everyone who
 * never finds the toggle. That is why this pair has only ever moved one way.
 */
export const TIMELINE_LAYER_DEFAULTS = {
	showAuraLane: true,
	showTimelineBuffs: true
} as const;

const SITE_SETTINGS_DEFAULTS: SiteSettings = {
	useNewOutfits: false,
	travelerVariant: 'aether',
	swapPing: 60, // a typical "decent connection"; 9 swap-delay frames (60 + 90 ms)
	...TIMELINE_LAYER_DEFAULTS
};

function loadSiteSettings(): SiteSettings {
	if (!browser) return { ...SITE_SETTINGS_DEFAULTS };
	try {
		const parsed = JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) ?? '{}');
		const merged: SiteSettings = { ...SITE_SETTINGS_DEFAULTS, ...parsed };
		// Migrate the legacy frame-based setting to ping-ms. ⚠️ Inverts the OLD
		// gcsim relationship (frames = ping × 0.12) ON PURPOSE: that is the formula
		// the stored frames were authored under, and the PING is what persists —
		// the current ping → frames conversion is `swapFramesForPing`.
		if (typeof parsed.swapPing !== 'number' && typeof parsed.swapFrames === 'number') {
			merged.swapPing = Math.round(parsed.swapFrames / 0.12);
		}
		delete (merged as Record<string, unknown>).swapFrames;
		return merged;
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
		setSwapPing(value: number) {
			store.update((prev) => persist({ ...prev, swapPing: value }));
		},
		/** One setter for both timeline layers — they are the same KIND of
		 *  preference and band B's reset writes them together. */
		setTimelineLayers(next: Partial<Pick<SiteSettings, 'showAuraLane' | 'showTimelineBuffs'>>) {
			store.update((prev) => persist({ ...prev, ...next }));
		}
	};
}

export const siteSettings = createSiteSettingsStore();
