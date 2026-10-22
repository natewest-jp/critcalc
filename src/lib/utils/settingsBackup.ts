/**
 * settingsBackup.ts — export/import of all critcalc localStorage state.
 *
 * critcalc keeps everything client-side (no accounts, no server), so this is how
 * a user backs up their data or moves it between devices. Export serializes the
 * `critcalc:*` keys into a versioned JSON envelope; import validates and
 * sanitizes an envelope before writing it back, then the caller reloads the page
 * so the stores re-hydrate from localStorage (they only read it at module init).
 *
 * `parseBackup` is pure (no localStorage / DOM) so it's unit-testable and so a
 * malformed or hand-edited file can never reach the stores unsanitized — a stray
 * NaN or bad shape would otherwise poison the parser.
 */

import { browser } from '$app/environment';
import { HUMAN_PAD_MAX_F, HUMAN_PAD_MIN_F } from '$lib/sim/humanTiming';
import { NOTE_SET_IDS, ORDER_IDS, SOUND_MODES, SWAP_STYLES, VOICE_IDS } from '$lib/playback/tones';
import { notationHasActions } from '$lib/utils/notationEdit';
import { MAX_NOTATION_CHARS } from '$lib/utils/tokenizer';
import { RECENTLY_CLOSED_CAP, TAB_LIMIT } from '$lib/tabSet';
import type { LoadoutEntry } from '$lib/stores';
import { recordBackup } from '$lib/utils/storageDurability';

// Must stay in sync with the private key constants in stores.ts.
export const BACKUP_KEYS = [
	'critcalc:siteSettings',
	'critcalc:constellations',
	'critcalc:ownership',
	'critcalc:loadout',
	'critcalc:savedNotations',
	'critcalc:savedBoards',
	// v2 (2026-10-21): the open documents too — a tab is unsaved work, the
	// thing a cleared browser loses with no other copy anywhere.
	'critcalc:rotationTabs',
	'critcalc:recentlyClosedRotations',
	'critcalc:boards',
	'critcalc:recentlyClosedBoards',
	'critcalc:vizWorkspace'
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];

/** v2 added the open documents (tabs, boards, Recently closed, the
 *  Visualizers' layout). A v1 file still loads: it just has none of them, and
 *  keys a file lacks are left as they are. */
export const BACKUP_VERSION = 2;

export type BackupData = Partial<Record<BackupKey, unknown>>;

export type BackupEnvelope = {
	app: 'critcalc';
	version: number;
	exportedAt: number;
	data: BackupData;
};

export type BackupCounts = {
	characters: number;
	owned: number;
	loadouts: number;
	rotations: number;
	lineups: number;
	/** Open Planner tabs plus open Team Builder lineups. */
	openTabs: number;
};

export type ParseResult =
	| { ok: true; data: BackupData; counts: BackupCounts }
	| { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

// ---------------------------------------------------------------------------
// Per-store sanitizers — each returns a clean value or `undefined` if the input
// isn't recognizable. They never throw and never trust incoming types.
// ---------------------------------------------------------------------------

function sanitizeSiteSettings(v: unknown): Record<string, unknown> | undefined {
	if (!isObject(v)) return undefined;
	const out: Record<string, unknown> = {};
	if (typeof v.useNewOutfits === 'boolean') out.useNewOutfits = v.useNewOutfits;
	if (v.travelerVariant === 'aether' || v.travelerVariant === 'lumine') {
		out.travelerVariant = v.travelerVariant;
	}
	if (typeof v.swapPing === 'number' && Number.isFinite(v.swapPing)) {
		out.swapPing = clamp(Math.round(v.swapPing), 0, 200);
	} else if (typeof v.swapFrames === 'number' && Number.isFinite(v.swapFrames)) {
		// Legacy frame-based backups: convert to ping-ms (gcsim: frames = ping × 0.12).
		out.swapPing = clamp(Math.round(v.swapFrames / 0.12), 0, 200);
	}
	// Human timing (2026-09-14) — the plate and its three settings.
	if (typeof v.humanTiming === 'boolean') out.humanTiming = v.humanTiming;
	if (
		v.humanTimingMode === 'padding' ||
		v.humanTimingMode === 'animations' ||
		v.humanTimingMode === 'both'
	) {
		out.humanTimingMode = v.humanTimingMode;
	}
	if (typeof v.humanTimingPadFrames === 'number' && Number.isFinite(v.humanTimingPadFrames)) {
		out.humanTimingPadFrames = clamp(
			Math.round(v.humanTimingPadFrames),
			HUMAN_PAD_MIN_F,
			HUMAN_PAD_MAX_F
		);
	}
	if (typeof v.showHumanPadding === 'boolean') out.showHumanPadding = v.showHumanPadding;
	if (typeof v.showCoverageStrips === 'boolean') out.showCoverageStrips = v.showCoverageStrips;
	// The layers persist only what was TOGGLED (2026-10-14), the rule of
	// stores.readChosenLayers. Top-level showAuraLane/showTimelineBuffs keys
	// were written by every save before then, chosen or not, and say nothing.
	if (isObject(v.timelineLayers)) {
		const layers: Record<string, boolean> = {};
		for (const k of ['showAuraLane', 'showTimelineBuffs']) {
			if (typeof v.timelineLayers[k] === 'boolean') layers[k] = v.timelineLayers[k];
		}
		out.timelineLayers = layers;
	}
	// The bench row (2026-10-15) — the same rule: present only once toggled.
	if (typeof v.benchRow === 'boolean') out.benchRow = v.benchRow;
	// Playback sound (2026-09-29) — each choice only if it names one that exists.
	if (typeof v.playbackSound === 'boolean') out.playbackSound = v.playbackSound;
	const oneOf = (key: string, allowed: readonly string[]) => {
		const x = v[key];
		if (typeof x === 'string' && allowed.includes(x)) out[key] = x;
	};
	oneOf('playbackSoundMode', SOUND_MODES);
	oneOf('playbackVoice', VOICE_IDS);
	oneOf('playbackOrder', ORDER_IDS);
	oneOf('playbackNotes', NOTE_SET_IDS);
	oneOf('playbackSwap', SWAP_STYLES);
	if (typeof v.playbackVolume === 'number' && Number.isFinite(v.playbackVolume)) {
		out.playbackVolume = clamp(v.playbackVolume, 0, 1);
	}
	return out;
}

function sanitizeConstellations(v: unknown): Record<string, number> | undefined {
	if (!isObject(v)) return undefined;
	const out: Record<string, number> = {};
	for (const [id, level] of Object.entries(v)) {
		if (typeof level === 'number' && Number.isFinite(level)) {
			out[id] = clamp(Math.round(level), 0, 6);
		}
	}
	return out;
}

function sanitizeOwnership(v: unknown): Record<string, 'owned' | 'wishlist'> | undefined {
	if (!isObject(v)) return undefined;
	const out: Record<string, 'owned' | 'wishlist'> = {};
	for (const [id, mark] of Object.entries(v)) {
		if (mark === 'owned' || mark === 'wishlist') out[id] = mark;
	}
	return out;
}

function sanitizeLoadout(v: unknown): Record<string, LoadoutEntry> | undefined {
	if (!isObject(v)) return undefined;
	const out: Record<string, LoadoutEntry> = {};
	for (const [id, entry] of Object.entries(v)) {
		if (!isObject(entry)) continue;
		const clean: LoadoutEntry = {};
		if (typeof entry.weaponId === 'string') clean.weaponId = entry.weaponId;
		if (
			typeof entry.weaponRefinement === 'number' &&
			entry.weaponRefinement >= 1 &&
			entry.weaponRefinement <= 5
		) {
			clean.weaponRefinement = Math.round(entry.weaponRefinement) as 1 | 2 | 3 | 4 | 5;
		}
		if (typeof entry.artifactSetId === 'string') clean.artifactSetId = entry.artifactSetId;
		if (Object.keys(clean).length > 0) out[id] = clean;
	}
	return out;
}

function isNotation(v: unknown): v is string {
	return typeof v === 'string' && v.length <= MAX_NOTATION_CHARS;
}

function finiteOr<T>(v: unknown, fallback: T): number | T {
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** A lineup's teams — shared by a saved lineup and an open one. */
function sanitizeTeams(v: unknown): Record<string, unknown>[] {
	const teams: Record<string, unknown>[] = [];
	for (const team of Array.isArray(v) ? v : []) {
		if (!isObject(team) || typeof team.id !== 'string') continue;
		const raw = Array.isArray(team.slots) ? team.slots : [];
		const clean: Record<string, unknown> = {
			id: team.id,
			slots: Array.from({ length: 4 }, (_, i) => (typeof raw[i] === 'string' ? raw[i] : null))
		};
		if (isObject(team.con)) {
			const con = sanitizeConstellations(team.con);
			if (con) clean.con = con;
		}
		if (typeof team.pinnedRotationId === 'string') clean.pinnedRotationId = team.pinnedRotationId;
		teams.push(clean);
	}
	return teams;
}

function sanitizeSavedNotations(v: unknown, now: number): Record<string, unknown>[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const out: Record<string, unknown>[] = [];
	for (const entry of v) {
		if (!isObject(entry)) continue;
		if (
			typeof entry.id !== 'string' ||
			typeof entry.name !== 'string' ||
			!isNotation(entry.notation)
		) {
			continue;
		}
		const clean: Record<string, unknown> = {
			id: entry.id,
			name: entry.name,
			notation: entry.notation,
			// ⛔ RETIRED FIELD, still READ (single truth, 2026-08-13). A backup taken
			// before the round carries an explicit team; carrying it through the
			// sanitizer is what lets documentBar.load fold it into the notation when
			// the entry is opened. Nothing writes it any more.
			manualSlots: Array.isArray(entry.manualSlots) ? entry.manualSlots : null,
			savedAt:
				typeof entry.savedAt === 'number' && Number.isFinite(entry.savedAt) ? entry.savedAt : now
		};
		const slots = sanitizeSlots(entry.slots);
		if (slots) clean.slots = slots;
		if (isObject(entry.tabLoadout)) clean.tabLoadout = entry.tabLoadout;
		if (isObject(entry.tabCon)) clean.tabCon = entry.tabCon;
		// A synced rotation follows the roster (lineups §10.4); `openedAt` is
		// half the Library's sort key (stores.lastTouched).
		if (entry.synced === true) clean.synced = true;
		if (typeof entry.openedAt === 'number' && Number.isFinite(entry.openedAt)) {
			clean.openedAt = entry.openedAt;
		}
		out.push(clean);
	}
	return out;
}

function sanitizeSavedBoards(v: unknown, now: number): Record<string, unknown>[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const out: Record<string, unknown>[] = [];
	for (const entry of v) {
		if (!isObject(entry)) continue;
		if (
			typeof entry.id !== 'string' ||
			typeof entry.name !== 'string' ||
			(entry.preset !== 'stygian' && entry.preset !== 'abyss' && entry.preset !== 'custom')
		) {
			continue;
		}
		const clean: Record<string, unknown> = {
			id: entry.id,
			name: entry.name,
			preset: entry.preset,
			teams: sanitizeTeams(entry.teams),
			noRepeats: entry.noRepeats === true,
			savedAt:
				typeof entry.savedAt === 'number' && Number.isFinite(entry.savedAt) ? entry.savedAt : now
		};
		if (typeof entry.season === 'string' && /^\d+\.\d+$/.test(entry.season)) {
			clean.season = entry.season;
		}
		if (typeof entry.openedAt === 'number' && Number.isFinite(entry.openedAt)) {
			clean.openedAt = entry.openedAt;
		}
		out.push(clean);
	}
	return out;
}

// ── Open documents (v2) ─────────────────────────────────────────────────────
// Shapes as `RotationTab` / `Board` and the tools' own loaders read them; the
// loaders still migrate at restore (a tab's retired `manualSlots`, a board's
// slot normalization), so these only refuse what would break a loader.

/** A rotation's party slots (design §8.1): four entries, each a string or
 *  null. Whether an id is a character is the loader's call (`normalizeSeats`). */
function sanitizeSlots(v: unknown): (string | null)[] | undefined {
	if (!Array.isArray(v)) return undefined;
	return v.slice(0, 4).map((id) => (typeof id === 'string' ? id : null));
}

function sanitizeRotationTab(v: unknown): Record<string, unknown> | null {
	if (!isObject(v) || typeof v.id !== 'string' || typeof v.label !== 'string') return null;
	if (!isNotation(v.notation)) return null;
	const clean: Record<string, unknown> = { id: v.id, label: v.label, notation: v.notation };
	const slots = sanitizeSlots(v.slots);
	if (slots) clean.slots = slots;
	const loadout = sanitizeLoadout(v.tabLoadout);
	if (loadout) clean.tabLoadout = loadout;
	const con = sanitizeConstellations(v.tabCon);
	if (con) clean.tabCon = con;
	if (typeof v.savedId === 'string') clean.savedId = v.savedId;
	if (v.synced === true) clean.synced = true;
	if (typeof v.sample === 'string') clean.sample = v.sample;
	const viewedAt = finiteOr(v.viewedAt, null);
	if (viewedAt !== null) clean.viewedAt = viewedAt;
	// ⛔ RETIRED, still READ — `migrateTab` folds it into the notation.
	if (Array.isArray(v.manualSlots)) clean.manualSlots = v.manualSlots;
	return clean;
}

function sanitizeBoard(v: unknown): Record<string, unknown> | null {
	if (!isObject(v) || typeof v.id !== 'string' || typeof v.label !== 'string') return null;
	if (v.preset !== 'stygian' && v.preset !== 'abyss' && v.preset !== 'custom') return null;
	const clean: Record<string, unknown> = {
		id: v.id,
		label: v.label,
		preset: v.preset,
		teams: sanitizeTeams(v.teams),
		noRepeats: v.noRepeats === true
	};
	if (typeof v.season === 'string' && /^\d+\.\d+$/.test(v.season)) clean.season = v.season;
	if (typeof v.savedId === 'string') clean.savedId = v.savedId;
	const viewedAt = finiteOr(v.viewedAt, null);
	if (viewedAt !== null) clean.viewedAt = viewedAt;
	return clean;
}

/** `{ <listKey>: T[], <activeKey>: id }`, the shape both tab states persist. */
function sanitizeTabState(
	v: unknown,
	listKey: string,
	activeKey: string,
	one: (v: unknown) => Record<string, unknown> | null
): Record<string, unknown> | undefined {
	if (!isObject(v) || !Array.isArray(v[listKey])) return undefined;
	const list = v[listKey]
		.map(one)
		.filter((t): t is Record<string, unknown> => t !== null)
		.slice(0, TAB_LIMIT);
	if (list.length === 0) return undefined;
	const active = list.some((t) => t.id === v[activeKey]) ? v[activeKey] : list[0].id;
	return { [listKey]: list, [activeKey]: active };
}

function sanitizeRecentlyClosed(
	v: unknown,
	one: (v: unknown) => Record<string, unknown> | null,
	now: number
): Record<string, unknown>[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const out: Record<string, unknown>[] = [];
	for (const entry of v) {
		if (!isObject(entry)) continue;
		const tab = one(entry.tab);
		if (tab) out.push({ tab, closedAt: finiteOr(entry.closedAt, now) });
	}
	return out.slice(0, RECENTLY_CLOSED_CAP);
}

/** The Visualizers' `loadWorkspace` repairs the assignment against the current
 *  instrument roster on read, so this keeps only the envelope it accepts. */
function sanitizeVizWorkspace(v: unknown): Record<string, unknown> | undefined {
	if (!isObject(v) || v.v !== 1 || !Array.isArray(v.assignment)) return undefined;
	const clean: Record<string, unknown> = {
		v: 1,
		assignment: v.assignment.filter((id) => typeof id === 'string')
	};
	if (typeof v.slots === 'number' || v.slots === 'auto') clean.slots = v.slots;
	return clean;
}

// ---------------------------------------------------------------------------
// Parse + validate (pure)
// ---------------------------------------------------------------------------

/**
 * Parse and sanitize a backup file's text. Never touches localStorage — the
 * returned `data` is safe to hand to {@link applyBackup}. `now` seeds any
 * missing `savedAt` timestamps (injectable for tests).
 */
export function parseBackup(text: string, now = Date.now()): ParseResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, error: 'That file isn’t valid JSON.' };
	}

	if (!isObject(parsed) || parsed.app !== 'critcalc' || !isObject(parsed.data)) {
		return { ok: false, error: 'That doesn’t look like a critcalc backup file.' };
	}

	const src = parsed.data as Record<string, unknown>;
	const data: BackupData = {};

	const settings = sanitizeSiteSettings(src['critcalc:siteSettings']);
	if (settings) data['critcalc:siteSettings'] = settings;
	const cons = sanitizeConstellations(src['critcalc:constellations']);
	if (cons) data['critcalc:constellations'] = cons;
	const own = sanitizeOwnership(src['critcalc:ownership']);
	if (own) data['critcalc:ownership'] = own;
	const load = sanitizeLoadout(src['critcalc:loadout']);
	if (load) data['critcalc:loadout'] = load;
	const notes = sanitizeSavedNotations(src['critcalc:savedNotations'], now);
	if (notes) data['critcalc:savedNotations'] = notes;
	const boards = sanitizeSavedBoards(src['critcalc:savedBoards'], now);
	if (boards) data['critcalc:savedBoards'] = boards;
	const tabs = sanitizeTabState(
		src['critcalc:rotationTabs'],
		'tabs',
		'activeTabId',
		sanitizeRotationTab
	);
	if (tabs) data['critcalc:rotationTabs'] = tabs;
	const closedTabs = sanitizeRecentlyClosed(
		src['critcalc:recentlyClosedRotations'],
		sanitizeRotationTab,
		now
	);
	if (closedTabs) data['critcalc:recentlyClosedRotations'] = closedTabs;
	const openBoards = sanitizeTabState(
		src['critcalc:boards'],
		'boards',
		'activeBoardId',
		sanitizeBoard
	);
	if (openBoards) data['critcalc:boards'] = openBoards;
	const closedBoards = sanitizeRecentlyClosed(
		src['critcalc:recentlyClosedBoards'],
		sanitizeBoard,
		now
	);
	if (closedBoards) data['critcalc:recentlyClosedBoards'] = closedBoards;
	const viz = sanitizeVizWorkspace(src['critcalc:vizWorkspace']);
	if (viz) data['critcalc:vizWorkspace'] = viz;

	if (Object.keys(data).length === 0) {
		return { ok: false, error: 'The backup had no recognizable critcalc data.' };
	}

	const counts: BackupCounts = {
		characters: Object.keys(cons ?? {}).length,
		owned: Object.values(own ?? {}).filter((m) => m === 'owned').length,
		loadouts: Object.keys(load ?? {}).length,
		// A names-only entry is a TEAM (library.isTeamEntry), not a rotation.
		rotations: (notes ?? []).filter((e) => notationHasActions(e.notation as string)).length,
		lineups: (boards ?? []).length,
		openTabs:
			((tabs?.tabs as unknown[]) ?? []).length + ((openBoards?.boards as unknown[]) ?? []).length
	};

	return { ok: true, data, counts };
}

// ---------------------------------------------------------------------------
// Read / write localStorage (browser only)
// ---------------------------------------------------------------------------

/** Snapshot every present `critcalc:*` key into an envelope. */
export function buildEnvelope(exportedAt = Date.now()): BackupEnvelope {
	const data: BackupData = {};
	if (browser) {
		for (const key of BACKUP_KEYS) {
			const raw = localStorage.getItem(key);
			if (raw == null) continue;
			try {
				data[key] = JSON.parse(raw);
			} catch {
				/* skip a corrupt key rather than fail the whole export */
			}
		}
	}
	return { app: 'critcalc', version: BACKUP_VERSION, exportedAt, data };
}

/** Serialize the current state and trigger a file download. */
export function downloadBackup(exportedAt = Date.now()): void {
	if (!browser) return;
	const json = JSON.stringify(buildEnvelope(exportedAt), null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const stamp = new Date(exportedAt).toISOString().slice(0, 10);
	const a = document.createElement('a');
	a.href = url;
	a.download = `critcalc-backup-${stamp}.json`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
	recordBackup(exportedAt);
}

/**
 * Write sanitized backup data to localStorage. Only keys present in `data` are
 * touched (absent keys are left as-is). The caller must reload the page
 * afterward so the stores re-read localStorage.
 */
export function applyBackup(data: BackupData): void {
	if (!browser) return;
	for (const key of BACKUP_KEYS) {
		if (Object.prototype.hasOwnProperty.call(data, key)) {
			localStorage.setItem(key, JSON.stringify(data[key]));
		}
	}
}
