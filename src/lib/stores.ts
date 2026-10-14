/**
 * src/lib/stores.ts
 *
 * Shared, persistent Svelte stores for critcalc tools.
 * All stores that need localStorage persistence are initialized from
 * localStorage on first load and write back on every change.
 */

import { writable } from 'svelte/store';
import { HUMAN_PAD_DEFAULT_F } from '$lib/sim/humanTiming';
import {
	NOTE_SET_IDS,
	ORDER_IDS,
	SOUND_MODES,
	SWAP_STYLES,
	VOICE_IDS,
	type NoteSetId,
	type OrderId,
	type SoundMode,
	type SwapStyle,
	type VoiceId
} from '$lib/playback/tones';
import { browser } from '$app/environment';
import { belowQuery } from '$lib/breakpoints';

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
	/**
	 * ⚓ "Synced to my roster" (lineups design §10.4): the characters you OWN
	 * are left out of `tabCon`, so they follow the roster live; a character you
	 * do not own keeps its stored level. Saving a synced document keeps it so.
	 * Setting an owned character's level by hand ends it — the badge reads
	 * itself.
	 */
	synced?: boolean;
	/** Last loaded from the bank (ms). The bank sorts by the newer of this and
	 *  `savedAt` (⚓ Nate 2026-10-08) — see {@link lastTouched}. */
	openedAt?: number;
};

/** When an entry was last saved OR opened — the bank's sort key. */
export function lastTouched(e: Pick<SavedNotation, 'savedAt' | 'openedAt'>): number {
	return Math.max(e.savedAt, e.openedAt ?? 0);
}

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
			fields: Partial<Pick<SavedNotation, 'name' | 'notation' | 'tabLoadout' | 'tabCon' | 'synced'>>
		) {
			store.update((items) =>
				persist(items.map((e) => (e.id === id ? { ...e, ...fields, savedAt: Date.now() } : e)))
			);
		},

		/** Loaded from the bank — moves it to the top of the list. */
		markOpened(id: string) {
			store.update((items) =>
				persist(items.map((e) => (e.id === id ? { ...e, openedAt: Date.now() } : e)))
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
// Saved boards (the Team Builder's bank — lineups design §9.6a)
// ---------------------------------------------------------------------------
//
// ⚓ Boards copy the rotation tabs completely (Nate 2026-10-08): open tabs, a
// saved list with Save/Load, and Recently closed. An entry stores each team's
// view at save time with every member's level pinned (as a saved rotation is
// densified), and keeps a team's pinned rotation (lineups design §10.2).

const SAVED_BOARDS_KEY = 'critcalc:savedBoards';

export type SavedBoardTeam = {
	id: string;
	slots: (string | null)[];
	con?: Record<string, number>;
	pinnedRotationId?: string;
};

export type SavedBoard = {
	id: string;
	name: string;
	preset: 'stygian' | 'abyss' | 'custom';
	/** A Stygian lineup's season (`Board.season`). */
	season?: string;
	teams: SavedBoardTeam[];
	noRepeats: boolean;
	savedAt: number;
	openedAt?: number;
};

function createSavedBoardsStore() {
	function load(): SavedBoard[] {
		if (!browser) return [];
		try {
			const parsed = JSON.parse(localStorage.getItem(SAVED_BOARDS_KEY) ?? '[]');
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	const store = writable<SavedBoard[]>(load());
	const persist = (items: SavedBoard[]) => {
		if (browser) localStorage.setItem(SAVED_BOARDS_KEY, JSON.stringify(items));
		return items;
	};
	return {
		subscribe: store.subscribe,
		save(entry: Omit<SavedBoard, 'id' | 'savedAt'>): string {
			const id = Math.random().toString(36).slice(2, 10);
			store.update((items) => persist([...items, { ...entry, id, savedAt: Date.now() }]));
			return id;
		},
		update(
			id: string,
			fields: Partial<Pick<SavedBoard, 'name' | 'teams' | 'noRepeats' | 'season'>>
		) {
			store.update((items) =>
				persist(items.map((e) => (e.id === id ? { ...e, ...fields, savedAt: Date.now() } : e)))
			);
		},
		markOpened(id: string) {
			store.update((items) =>
				persist(items.map((e) => (e.id === id ? { ...e, openedAt: Date.now() } : e)))
			);
		},
		rename(id: string, name: string) {
			store.update((items) => persist(items.map((e) => (e.id === id ? { ...e, name } : e))));
		},
		delete(id: string) {
			store.update((items) => persist(items.filter((e) => e.id !== id)));
		}
	};
}

export const savedBoards = createSavedBoardsStore();

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
		/** Replace the whole map in ONE write — the Roster tab's bulk actions and
		 *  its undo, which would otherwise persist once per character. */
		replaceAll(next: Record<string, number>) {
			store.set({ ...next });
			if (browser) localStorage.setItem(CONSTELLATION_KEY, JSON.stringify(next));
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
		/** Replace the whole map in ONE write (see constellations.replaceAll). */
		replaceAll(next: Record<string, OwnershipMark>) {
			store.set(persist({ ...next }));
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
	/** The planner's opt-in coverage strips under the notation box (⚓ Nate
	 *  2026-09-23): OFF by default — they make the tool taller and busier, so
	 *  they are a Settings choice, ⛔ never a toolbar button. */
	showCoverageStrips: boolean;
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
	 * ── HUMAN TIMING (2026-09-14) ─────────────────────────────────────────────
	 *
	 * The planner's Human plate (band B): pad the inputs the game does not
	 * buffer and/or let animations finish, so the chart shows a person's
	 * rotation rather than a macro's. `humanTiming` is the plate; the other
	 * three are what it does, set in the Settings modal. ⚓ `humanTimingMode` is
	 * a three-way choice rather than two checkboxes so the plate can never be
	 * lit and do nothing. Per TASTE like the layers, ⛔ never in the `?r=`
	 * codec — a shared link is read at the READER's setting, not the author's.
	 * ↻ ON by default since 2026-09-24; ↻ mode `padding` by default since 2026-09-30. Model + authority: `$lib/sim/humanTiming.ts`.
	 */
	humanTiming: boolean;
	humanTimingMode: HumanTimingMode;
	/** Frames added after every non-buffered input (KQM's starting point is 10). */
	humanTimingPadFrames: number;
	/** Draw the padding as a sliver on the active row (the parse pads either way). */
	showHumanPadding: boolean;
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
	/**
	 * ── PLAYBACK SOUND (playback round, 2026-09-29) ─────────────────────────
	 *
	 * Whether the planner's Play makes a sound at every input. Per TASTE like
	 * the layers: "I follow the rotation by ear" is a standing preference, and
	 * the sound is the half of playback that works with the tab hidden behind
	 * the game (`$lib/playback/playback.svelte.ts`). ⛔ Never in the `?r=`
	 * codec — a link carries a rotation, not the recipient's speakers.
	 */
	playbackSound: boolean;
	/** Metronome or a melodic voice (⚓ Nate 2026-09-29: sounds are personal —
	 *  chosen in Settings by listening). `$lib/playback/tones.ts` holds them. */
	playbackSoundMode: SoundMode;
	/** Which voice plays when the mode is melodic. */
	playbackVoice: VoiceId;
	/** Which role sits low, mid and high. */
	playbackOrder: OrderId;
	/** Which three steps of the pentatonic the roles take. */
	playbackNotes: NoteSetId;
	/** How the swap hums. */
	playbackSwap: SwapStyle;
	/** Master volume, 0–1. The tones have to sit against the game's own level,
	 *  and that is personal too. */
	playbackVolume: number;
};

/**
 * The resting layers at full width (below `toolMin`, see
 * TIMELINE_LAYER_DEFAULTS_NARROW). ↻ Nothing resets to them any more — band
 * B's reset narrowed to the zoom alone (2026-08-17).
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

/**
 * ⚓ NATE 2026-10-14: BELOW `toolMin` BOTH LAYERS START OFF. On a narrow screen
 * the chart's height is the scarce thing, and the buff rows and the aura lane
 * are the two things that spend it on what an ability grants rather than when
 * it is. `toolMin` because that is where the planner already turns narrow (the
 * bench becomes a row, the aside a drawer).
 *
 * ⚠️ A DEFAULT, NEVER A CHOICE — which is why the layers persist apart from
 * everything else (`timelineLayers`, holding only what was TOGGLED). This
 * store used to merge its defaults into the saved object and write the whole
 * thing back, so the first save of ANY setting stored both layers as if
 * chosen, and a width-dependent default could never reach that browser
 * again. The default is decided ONCE, at load: rotating a tablet mid-session
 * does not flip a layer, and once toggled a layer holds at every width.
 */
export const TIMELINE_LAYER_DEFAULTS_NARROW = {
	showAuraLane: false,
	showTimelineBuffs: false
} as const;

type LayerKey = keyof typeof TIMELINE_LAYER_DEFAULTS;
type ChosenLayers = Partial<Record<LayerKey, boolean>>;

function layerDefaults(): Record<LayerKey, boolean> {
	return browser && window.matchMedia(belowQuery('toolMin')).matches
		? { ...TIMELINE_LAYER_DEFAULTS_NARROW }
		: { ...TIMELINE_LAYER_DEFAULTS };
}

/** What was toggled, read back from storage — only booleans survive. */
function readChosenLayers(raw: unknown): ChosenLayers {
	const out: ChosenLayers = {};
	if (raw && typeof raw === 'object')
		for (const k of Object.keys(TIMELINE_LAYER_DEFAULTS) as LayerKey[]) {
			const v = (raw as Record<string, unknown>)[k];
			if (typeof v === 'boolean') out[k] = v;
		}
	return out;
}

/** Sound ON by default: the count-in and the tones are what make Play usable
 *  with the game in front of you, and a first press of Play that did nothing
 *  audible would leave the reader wondering what it was for. */
export const PLAYBACK_SOUND_DEFAULT = true;
/** ⚓ Nate's defaults, landed verbatim — a `tune(nate)`. ↻ 2026-09-30: the
 *  vibraphone, WEIGHTY, Anchor (A · D · E) — "the most solid, safest bet for
 *  most users" (Skill up the evening before). */
export const PLAYBACK_SOUND_DEFAULTS = {
	playbackSound: PLAYBACK_SOUND_DEFAULT,
	playbackSoundMode: 'melodic' as SoundMode,
	playbackVoice: 'vibraphone' as VoiceId,
	playbackOrder: 'weighty' as OrderId,
	playbackNotes: 'anchor' as NoteSetId,
	playbackSwap: 'humLow' as SwapStyle,
	playbackVolume: 0.7
} as const;

export type HumanTimingMode = 'padding' | 'animations' | 'both';

export const HUMAN_TIMING_DEFAULTS = {
	// ⚓ Nate 2026-09-24: ON for a new visitor — a person's rotation is the
	// honest first reading; frame-perfect is the thing you opt into.
	humanTiming: true,
	// ⚓ Nate 2026-09-30: PADDING, not both. Full animations model a player who
	// never cancels; a rotation someone knows (Flins' C1 `E sQ N5 E sQ N5 E sQ`)
	// cancels N5's recovery on purpose, and `both` pushed its last sQ out of the
	// stance. The pad is the reaction delay every player has; animations are opt-in.
	humanTimingMode: 'padding' as HumanTimingMode,
	humanTimingPadFrames: HUMAN_PAD_DEFAULT_F,
	showHumanPadding: true
};

const SITE_SETTINGS_DEFAULTS: SiteSettings = {
	useNewOutfits: false,
	showCoverageStrips: false,
	travelerVariant: 'aether',
	...HUMAN_TIMING_DEFAULTS,
	swapPing: 60, // a typical "decent connection"; 9 swap-delay frames (60 + 90 ms)
	...TIMELINE_LAYER_DEFAULTS,
	...PLAYBACK_SOUND_DEFAULTS
};

function loadSiteSettings(): SiteSettings {
	if (!browser) return { ...SITE_SETTINGS_DEFAULTS };
	try {
		const parsed = JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) ?? '{}');
		const merged: SiteSettings = { ...SITE_SETTINGS_DEFAULTS, ...parsed };
		// The layers: the width's default under whatever was TOGGLED. Top-level
		// `showAuraLane`/`showTimelineBuffs` keys were written before 2026-10-14
		// by every save, chosen or not, so they say nothing and are dropped.
		Object.assign(merged, layerDefaults(), readChosenLayers(parsed.timelineLayers));
		delete (merged as Record<string, unknown>).timelineLayers;
		// Migrate the legacy frame-based setting to ping-ms. ⚠️ Inverts the OLD
		// gcsim relationship (frames = ping × 0.12) ON PURPOSE: that is the formula
		// the stored frames were authored under, and the PING is what persists —
		// the current ping → frames conversion is `swapFramesForPing`.
		if (typeof parsed.swapPing !== 'number' && typeof parsed.swapFrames === 'number') {
			merged.swapPing = Math.round(parsed.swapFrames / 0.12);
		}
		delete (merged as Record<string, unknown>).swapFrames;
		// The playback sound settings were reshaped several times on 2026-09-29
		// (sets → a mode plus a voice; assignments → an order plus a note set;
		// the swap's slide → hums). A stored voice id becomes the voice; the
		// retired drum kit and the metronome become the metronome mode; anything
		// unknown falls back to the default.
		const RETIRED_VOICES: Record<string, VoiceId> = {
			epiano: 'pipe',
			musicbox: 'bell',
			kalimba: 'glass',
			handpan: 'glass'
		};
		const legacySet = parsed.playbackSoundSet as string | undefined;
		if (legacySet && parsed.playbackSoundMode === undefined) {
			if ((VOICE_IDS as readonly string[]).includes(legacySet) || legacySet in RETIRED_VOICES) {
				merged.playbackSoundMode = 'melodic';
				merged.playbackVoice = legacySet as VoiceId;
			} else if (legacySet === 'metronome' || legacySet === 'percussive') {
				merged.playbackSoundMode = 'metronome';
			}
		}
		delete (merged as Record<string, unknown>).playbackSoundSet;
		delete (merged as Record<string, unknown>).playbackAssignment;
		// The voices became materials (2026-09-29): the e-piano is the pipe it
		// sounded like, the music box the bell; the kalimba and handpan retired
		// to the glass, the nearest soft voice.
		const v = merged.playbackVoice as string;
		if (v in RETIRED_VOICES) merged.playbackVoice = RETIRED_VOICES[v];
		if (!SOUND_MODES.includes(merged.playbackSoundMode))
			merged.playbackSoundMode = PLAYBACK_SOUND_DEFAULTS.playbackSoundMode;
		if (!VOICE_IDS.includes(merged.playbackVoice))
			merged.playbackVoice = PLAYBACK_SOUND_DEFAULTS.playbackVoice;
		if (!ORDER_IDS.includes(merged.playbackOrder))
			merged.playbackOrder = PLAYBACK_SOUND_DEFAULTS.playbackOrder;
		if (!NOTE_SET_IDS.includes(merged.playbackNotes))
			merged.playbackNotes = PLAYBACK_SOUND_DEFAULTS.playbackNotes;
		if (!SWAP_STYLES.includes(merged.playbackSwap))
			merged.playbackSwap = PLAYBACK_SOUND_DEFAULTS.playbackSwap;
		return merged;
	} catch {
		return { ...SITE_SETTINGS_DEFAULTS };
	}
}

function readStoredChosenLayers(): ChosenLayers {
	try {
		return readChosenLayers(
			JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) ?? '{}').timelineLayers
		);
	} catch {
		return {};
	}
}

function createSiteSettingsStore() {
	const store = writable<SiteSettings>(loadSiteSettings());
	let chosenLayers: ChosenLayers = browser ? readStoredChosenLayers() : {};

	/** Everything but the effective layers, which are derived; what was
	 *  toggled travels as `timelineLayers`. */
	function persist(next: SiteSettings) {
		if (browser) {
			const { showAuraLane: _a, showTimelineBuffs: _b, ...rest } = next;
			localStorage.setItem(
				SITE_SETTINGS_KEY,
				JSON.stringify({ ...rest, timelineLayers: chosenLayers })
			);
		}
		return next;
	}

	return {
		subscribe: store.subscribe,
		setUseNewOutfits(value: boolean) {
			store.update((prev) => persist({ ...prev, useNewOutfits: value }));
		},
		setShowCoverageStrips(value: boolean) {
			store.update((prev) => persist({ ...prev, showCoverageStrips: value }));
		},
		setTravelerVariant(value: 'aether' | 'lumine') {
			store.update((prev) => persist({ ...prev, travelerVariant: value }));
		},
		setSwapPing(value: number) {
			store.update((prev) => persist({ ...prev, swapPing: value }));
		},
		/** One setter for the plate and its three settings — the same kind of
		 *  preference, written from two surfaces (band B and the modal). */
		setHumanTiming(next: Partial<Pick<SiteSettings, keyof typeof HUMAN_TIMING_DEFAULTS>>) {
			store.update((prev) => persist({ ...prev, ...next }));
		},
		/** One setter for both timeline layers — they are the same KIND of
		 *  preference, written from band B's two plates. Records them as CHOSEN. */
		setTimelineLayers(next: ChosenLayers) {
			chosenLayers = { ...chosenLayers, ...next };
			store.update((prev) => persist({ ...prev, ...next }));
		},
		/** One setter for the plate and its two settings — the same kind of
		 *  preference, written from two surfaces (band B and the modal). */
		setPlaybackSound(next: Partial<Pick<SiteSettings, keyof typeof PLAYBACK_SOUND_DEFAULTS>>) {
			store.update((prev) => persist({ ...prev, ...next }));
		}
	};
}

export const siteSettings = createSiteSettingsStore();
