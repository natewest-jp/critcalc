/**
 * BACKUP v3 (design §10, §12 Q11; build plan §13): under the switch the
 * player's work lives in IndexedDB, which the v1/v2 backup (`settingsBackup`,
 * the `critcalc:*` localStorage keys) never reads. v3 carries the store.
 *
 * ⚓ ALL PROFILES by default (Nate 2026-10-23): one file holds every real
 * profile and Theorycraft, with their rosters, teams, rotations and lineups,
 * and which one was active. The format does not require all of them, so a
 * single-profile export can be added later without a new version.
 *
 * Besides the store a v3 file carries the localStorage keys that belong to the
 * PERSON at this browser, not to a profile (§13.5): the site settings and the
 * Visualizers' layout. ⛔ Not the old roster or saved-entry keys: under the
 * switch they are the untouched pre-migration originals (copy-only), so a
 * backup carrying them would carry stale work beside the real one.
 *
 * Pure: no IndexedDB, no DOM. `parseAnyBackup` takes a v1, v2 or v3 file and
 * returns the records to write; v1/v2 go through the SAME migration a
 * browser's own localStorage does (§10).
 */

import {
	isNotation,
	parseBackup,
	sanitizeConstellations,
	sanitizeLoadout,
	sanitizeOwnership,
	sanitizePlaced,
	sanitizeSiteSettings,
	sanitizeSlots,
	sanitizeTeams,
	sanitizeVizWorkspace,
	type BackupData
} from '$lib/utils/settingsBackup';
import { migrate, type MigrationResult } from './migrate';
import {
	THEORYCRAFT_ID,
	makeTheorycraft,
	type DocumentRecord,
	type LineupBody,
	type Picture,
	type ProfileColour,
	type ProfileRecord,
	type RotationBody,
	type TeamRecord
} from './records';

export const STORE_BACKUP_VERSION = 3;

/** The localStorage keys a v3 file carries: the person's, not a profile's. */
export const PERSON_KEYS = ['critcalc:siteSettings', 'critcalc:vizWorkspace'] as const;

export type StoreBackup = {
	app: 'critcalc';
	version: 3;
	exportedAt: number;
	/** The person's settings, keyed as in localStorage (PERSON_KEYS). */
	data: BackupData;
	store: MigrationResult;
};

export type StoreCounts = {
	/** Real profiles' names, in the order made. */
	profiles: string[];
	rotations: number;
	lineups: number;
	teams: number;
};

export type StoreParse =
	| {
			ok: true;
			/** The person's settings to write back (PERSON_KEYS only). */
			data: BackupData;
			store: MigrationResult;
			counts: StoreCounts;
			/** v1/v2 went through the migration, so its what-if pass is still due. */
			legacy: boolean;
	  }
	| { ok: false; error: string };

// ── Building ────────────────────────────────────────────────────────────────

/** A v3 envelope from the live records (tombstones left out). */
export function buildStoreBackup(
	store: MigrationResult,
	person: BackupData,
	exportedAt: number
): StoreBackup {
	const data: BackupData = {};
	for (const k of PERSON_KEYS) if (person[k] !== undefined) data[k] = person[k];
	return {
		app: 'critcalc',
		version: 3,
		exportedAt,
		data,
		store: {
			profiles: store.profiles.filter((r) => !r.deleted),
			documents: store.documents.filter((r) => !r.deleted),
			teams: store.teams.filter((r) => !r.deleted),
			activeProfileId: store.activeProfileId
		}
	};
}

// ── Parsing ─────────────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const num = (v: unknown, fallback: number): number =>
	typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const COLOURS: readonly ProfileColour[] = [
	'pyro',
	'hydro',
	'anemo',
	'electro',
	'dendro',
	'cryo',
	'geo',
	'theorycraft'
];

function picture(v: unknown): Picture | undefined {
	if (!isObj(v)) return undefined;
	if (v.kind === 'art' && str(v.name)) return { kind: 'art', name: v.name };
	if (v.kind === 'character' && str(v.id)) return { kind: 'character', id: v.id };
	return undefined;
}

function profile(v: unknown, now: number): ProfileRecord | null {
	if (!isObj(v) || !str(v.id) || (v.kind !== 'real' && v.kind !== 'theorycraft')) return null;
	if (v.kind === 'theorycraft' && v.id !== THEORYCRAFT_ID) return null;
	const colour = COLOURS.includes(v.colour as ProfileColour) ? (v.colour as ProfileColour) : null;
	if (!colour || (v.kind === 'real') === (colour === 'theorycraft')) return null;
	const roster = isObj(v.roster) ? v.roster : {};
	const current: ProfileRecord['current'] = {};
	if (isObj(v.current)) {
		for (const t of ['planner', 'builder'] as const) {
			const c = v.current[t];
			if (c === null || str(c)) current[t] = c;
		}
	}
	const rec: ProfileRecord = {
		id: v.id,
		updatedAt: num(v.updatedAt, now),
		kind: v.kind,
		name: str(v.name) ? v.name.slice(0, 40) : v.kind === 'real' ? 'My profile' : 'Theorycraft',
		colour,
		twin: v.twin === 'lumine' ? 'lumine' : 'aether',
		roster: {
			constellations: sanitizeConstellations(roster.constellations) ?? {},
			ownership: sanitizeOwnership(roster.ownership) ?? {},
			loadout: sanitizeLoadout(roster.loadout) ?? {}
		},
		current,
		createdAt: num(v.createdAt, now)
	};
	const pic = picture(v.picture);
	if (pic) rec.picture = pic;
	if (v.lastTool === 'planner' || v.lastTool === 'builder' || v.lastTool === 'visualizers')
		rec.lastTool = v.lastTool;
	return rec;
}

function seats(v: unknown): (string | null)[] {
	const s = sanitizeSlots(v) ?? [];
	return Array.from({ length: 4 }, (_, i) => s[i] ?? null);
}

function rotationBody(v: unknown): RotationBody | null {
	if (!isObj(v) || !isNotation(v.notation)) return null;
	const placed = sanitizePlaced(v.placed) ?? [];
	const body: RotationBody = {
		notation: v.notation,
		slots: seats(v.slots),
		placed: Array.from({ length: 4 }, (_, i) => placed[i] ?? false)
	};
	const loadout = sanitizeLoadout(v.loadout);
	if (loadout && Object.keys(loadout).length) body.loadout = loadout;
	const con = sanitizeConstellations(v.con);
	if (con && Object.keys(con).length) body.con = con;
	if (str(v.sample)) body.sample = v.sample;
	return body;
}

function lineupBody(v: unknown): LineupBody | null {
	if (!isObj(v)) return null;
	if (v.preset !== 'stygian' && v.preset !== 'abyss' && v.preset !== 'custom') return null;
	const body: LineupBody = {
		preset: v.preset,
		noRepeats: v.noRepeats === true,
		teams: sanitizeTeams(v.teams) as LineupBody['teams']
	};
	if (typeof v.season === 'string' && /^\d+\.\d+$/.test(v.season)) body.season = v.season;
	return body;
}

function document(v: unknown, profiles: Set<string>, now: number): DocumentRecord | null {
	if (!isObj(v) || !str(v.id) || !str(v.profileId) || !profiles.has(v.profileId)) return null;
	const common = {
		id: v.id,
		updatedAt: num(v.updatedAt, now),
		profileId: v.profileId,
		name: str(v.name) ? v.name : null,
		createdAt: num(v.createdAt, now),
		...(typeof v.openedAt === 'number' && Number.isFinite(v.openedAt)
			? { openedAt: v.openedAt }
			: {}),
		...(v.pinned === true ? { pinned: true as const } : {}),
		...(v.fromLink === true ? { fromLink: true as const } : {}),
		...(str(v.pairId) ? { pairId: v.pairId } : {}),
		...(str(v.pairId) && v.pairHome === true ? { pairHome: true as const } : {})
	};
	if (v.type === 'rotation') {
		const body = rotationBody(v.body);
		return body ? { ...common, type: 'rotation', body } : null;
	}
	if (v.type === 'lineup') {
		const body = lineupBody(v.body);
		return body ? { ...common, type: 'lineup', body } : null;
	}
	return null;
}

function team(v: unknown, profiles: Set<string>, now: number): TeamRecord | null {
	if (!isObj(v) || !str(v.id) || !str(v.profileId) || !profiles.has(v.profileId)) return null;
	return {
		id: v.id,
		updatedAt: num(v.updatedAt, now),
		profileId: v.profileId,
		name: typeof v.name === 'string' ? v.name.slice(0, 80) : '',
		slots: seats(v.slots),
		...teamLoadoutOf(v.loadout),
		createdAt: num(v.createdAt, now)
	};
}

function teamLoadoutOf(v: unknown): Pick<TeamRecord, 'loadout'> {
	const loadout = sanitizeLoadout(v);
	return loadout && Object.keys(loadout).length ? { loadout } : {};
}

/** ↻ Any number of profiles, colours repeating (Nate 2026-10-26). ⚠ This
 *  used to drop a repeated colour and everything past seven, which would
 *  silently lose a profile now that both are allowed. */
function sanitizeStore(v: unknown, now: number): MigrationResult | null {
	if (!isObj(v) || !Array.isArray(v.profiles)) return null;
	const profiles: ProfileRecord[] = [];
	for (const raw of v.profiles) {
		const p = profile(raw, now);
		if (!p || profiles.some((x) => x.id === p.id)) continue;
		profiles.push(p);
	}
	// Theorycraft is built in: a file without it gets a fresh one.
	if (!profiles.some((p) => p.id === THEORYCRAFT_ID)) profiles.unshift(makeTheorycraft(now));
	const ids = new Set(profiles.map((p) => p.id));
	const documents: DocumentRecord[] = [];
	for (const raw of Array.isArray(v.documents) ? v.documents : []) {
		const d = document(raw, ids, now);
		if (d && !documents.some((x) => x.id === d.id)) documents.push(d);
	}
	const teams: TeamRecord[] = [];
	for (const raw of Array.isArray(v.teams) ? v.teams : []) {
		const t = team(raw, ids, now);
		if (t && !teams.some((x) => x.id === t.id)) teams.push(t);
	}
	// A pair whose other side did not come is no pair.
	const docIds = new Set(documents.map((d) => d.id));
	for (const d of documents)
		if (d.pairId && !docIds.has(d.pairId)) {
			delete d.pairId;
			delete d.pairHome;
		}
	// A current pointer to a document that did not come is a fresh start.
	for (const p of profiles) {
		for (const t of ['planner', 'builder'] as const) {
			const c = p.current[t];
			if (c && !docIds.has(c)) delete p.current[t];
		}
	}
	const active =
		str(v.activeProfileId) && ids.has(v.activeProfileId) ? v.activeProfileId : THEORYCRAFT_ID;
	return { profiles, documents, teams, activeProfileId: active };
}

export function countsOf(store: MigrationResult): StoreCounts {
	return {
		profiles: store.profiles.filter((p) => p.kind === 'real').map((p) => p.name),
		rotations: store.documents.filter((d) => d.type === 'rotation').length,
		lineups: store.documents.filter((d) => d.type === 'lineup').length,
		teams: store.teams.length
	};
}

/**
 * Any backup file, for the new storage. A v3 file restores its store; a v1 or
 * v2 file restores through the migration, exactly as the browser's own
 * localStorage did on the first visit under the switch (§10).
 */
export function parseAnyBackup(
	text: string,
	opts: { now?: number; newId: () => string }
): StoreParse {
	const now = opts.now ?? Date.now();
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: 'That file isn’t valid JSON.' };
	}
	if (!isObj(raw) || raw.app !== 'critcalc') {
		return { ok: false, error: 'That doesn’t look like a critcalc backup file.' };
	}
	if (raw.version === STORE_BACKUP_VERSION) {
		const store = sanitizeStore(raw.store, now);
		if (!store) return { ok: false, error: 'That backup’s profiles couldn’t be read.' };
		const src = isObj(raw.data) ? raw.data : {};
		const data: BackupData = {};
		const settings = sanitizeSiteSettings(src['critcalc:siteSettings']);
		if (settings) data['critcalc:siteSettings'] = settings;
		const viz = sanitizeVizWorkspace(src['critcalc:vizWorkspace']);
		if (viz) data['critcalc:vizWorkspace'] = viz;
		return { ok: true, data, store, counts: countsOf(store), legacy: false };
	}
	const legacy = parseBackup(text, now);
	if (!legacy.ok) return legacy;
	const store = migrate(legacy.data, { now, newId: opts.newId });
	const data: BackupData = {};
	for (const k of PERSON_KEYS) if (legacy.data[k] !== undefined) data[k] = legacy.data[k];
	return { ok: true, data, store, counts: countsOf(store), legacy: true };
}
