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
import type { LoadoutEntry } from '$lib/stores';

// Must stay in sync with the private key constants in stores.ts.
export const BACKUP_KEYS = [
	'critcalc:siteSettings',
	'critcalc:constellations',
	'critcalc:ownership',
	'critcalc:loadout',
	'critcalc:savedNotations'
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];

export const BACKUP_VERSION = 1;

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

function sanitizeSavedNotations(v: unknown, now: number): Record<string, unknown>[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const out: Record<string, unknown>[] = [];
	for (const entry of v) {
		if (!isObject(entry)) continue;
		if (
			typeof entry.id !== 'string' ||
			typeof entry.name !== 'string' ||
			typeof entry.notation !== 'string'
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
		if (isObject(entry.tabLoadout)) clean.tabLoadout = entry.tabLoadout;
		if (isObject(entry.tabCon)) clean.tabCon = entry.tabCon;
		out.push(clean);
	}
	return out;
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

	if (Object.keys(data).length === 0) {
		return { ok: false, error: 'The backup had no recognizable critcalc data.' };
	}

	const counts: BackupCounts = {
		characters: Object.keys(cons ?? {}).length,
		owned: Object.values(own ?? {}).filter((m) => m === 'owned').length,
		loadouts: Object.keys(load ?? {}).length,
		rotations: (notes ?? []).length
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
