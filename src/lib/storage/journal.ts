/**
 * The unload journal (redesign bug sweep 2026-10-23, §1.1).
 *
 * Autosave waits `SAVE_DELAY_MS` for typing to pause, and an IndexedDB write
 * started while the page unloads may never finish: a reload inside that
 * window lost the last edit, where the old layout (synchronous localStorage)
 * kept it. So on `pagehide` the session writes what it has NOT saved yet to
 * localStorage, synchronously, under a key of its own page; the next page to
 * open the store replays every journal it finds and removes it.
 *
 * ⚓ A journal only ever fills a gap. A record changed after the journal was
 * written (the page came back from the back/forward cache and saved, or
 * another tab edited it since) wins; so does a deletion, and a restore, which
 * replaces everything at once.
 */

import { exclusively } from './docLock';
import { get, getMeta, put } from './db';
import type { DocumentRecord, ProfileRecord, Roster } from './records';

const PREFIX = 'critcalc:journal:';

/** A roster part's changes against the map the page last loaded or wrote. */
export type RosterChange = { set: Record<string, unknown>; del: string[] };
export type RosterChanges = Partial<Record<keyof Roster, RosterChange>>;

export type JournalDoc = {
	id: string;
	type: DocumentRecord['type'];
	name: string | null;
	body: DocumentRecord['body'];
	profileId: string;
	/** Not stored yet: what its first save would have given it. */
	fresh?: { createdAt: number; fromLink?: true };
};

export type Journal = {
	at: number;
	docs: JournalDoc[];
	/** A tool's current document moved to one of `docs`. */
	current?: { profileId: string; planner?: string; builder?: string };
	roster?: { profileId: string; changes: RosterChanges };
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What changed in a roster part: keys set (or set differently) and keys removed. */
export function rosterChange(
	base: Record<string, unknown>,
	next: Record<string, unknown>
): RosterChange | null {
	const set: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(next)) if (!same(base[k], v)) set[k] = v;
	const del = Object.keys(base).filter((k) => !(k in next));
	return Object.keys(set).length || del.length ? { set, del } : null;
}

/** ⚓ Applied KEY BY KEY onto the stored roster, so two tabs editing one
 *  profile's characters each keep their own change. */
export function applyRosterChanges(roster: Roster, changes: RosterChanges): Roster {
	const out = { ...roster };
	for (const part of Object.keys(changes) as (keyof Roster)[]) {
		const change = changes[part]!;
		const map: Record<string, unknown> = { ...roster[part] };
		for (const k of change.del) delete map[k];
		Object.assign(map, change.set);
		(out as Record<string, unknown>)[part] = map;
	}
	return out;
}

/** Synchronous: called from `pagehide`, where nothing asynchronous is sure to finish. */
export function writeJournal(page: string, journal: Journal): void {
	try {
		if (!journal.docs.length && !journal.current && !journal.roster) dropJournal(page);
		else localStorage.setItem(PREFIX + page, JSON.stringify(journal));
	} catch {
		// Storage full or refused: the IndexedDB write may still land.
	}
}

export function dropJournal(page: string): void {
	try {
		localStorage.removeItem(PREFIX + page);
	} catch {
		/* nothing to drop */
	}
}

function takeJournals(): Journal[] {
	const out: Journal[] = [];
	try {
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k?.startsWith(PREFIX)) keys.push(k);
		}
		for (const k of keys) {
			const raw = localStorage.getItem(k);
			localStorage.removeItem(k);
			try {
				const j = raw ? (JSON.parse(raw) as Journal) : null;
				if (j && typeof j.at === 'number' && Array.isArray(j.docs)) out.push(j);
			} catch {
				// A torn write: nothing to recover from it.
			}
		}
	} catch {
		/* no localStorage */
	}
	return out.sort((a, b) => a.at - b.at);
}

async function liveProfile(db: IDBDatabase, id: string): Promise<ProfileRecord | undefined> {
	const p = await get(db, 'profiles', id);
	return p && !p.deleted ? p : undefined;
}

/** Replay every journal left by a page that unloaded before its save landed. */
export async function replayJournals(db: IDBDatabase): Promise<void> {
	await exclusively('journal', async () => {
		const journals = takeJournals();
		if (!journals.length) return;
		const { migratedAt = 0 } = await getMeta(db);
		for (const j of journals) {
			// Written before a restore (or the migration): that replaced it all.
			if (j.at < migratedAt) continue;
			for (const d of j.docs) {
				const stored = await get(db, 'documents', d.id);
				if (stored) {
					if (stored.deleted || stored.updatedAt > j.at) continue;
					if (same({ n: stored.name, b: stored.body }, { n: d.name, b: d.body })) continue;
					await put(db, 'documents', {
						...stored,
						type: d.type,
						name: d.name,
						body: d.body,
						updatedAt: j.at
					} as DocumentRecord);
				} else if (d.fresh && (await liveProfile(db, d.profileId))) {
					await put(db, 'documents', {
						id: d.id,
						profileId: d.profileId,
						type: d.type,
						name: d.name,
						body: d.body,
						createdAt: d.fresh.createdAt,
						updatedAt: j.at,
						...(d.fresh.fromLink ? { fromLink: true } : {})
					} as DocumentRecord);
				}
			}
			const pid = j.roster?.profileId ?? j.current?.profileId;
			const profile = pid ? await liveProfile(db, pid) : undefined;
			// Changed since (its write landed after all, or another tab's): that wins.
			if (!profile || profile.updatedAt > j.at) continue;
			let next = profile;
			if (j.roster?.profileId === profile.id) {
				next = { ...next, roster: applyRosterChanges(next.roster, j.roster.changes) };
			}
			if (j.current?.profileId === profile.id) {
				const current = { ...next.current };
				for (const tool of ['planner', 'builder'] as const) {
					const id = j.current[tool];
					const doc = id ? await get(db, 'documents', id) : undefined;
					if (id && doc && !doc.deleted && doc.profileId === profile.id) current[tool] = id;
				}
				next = { ...next, current };
			}
			if (next !== profile) await put(db, 'profiles', { ...next, updatedAt: Date.now() });
		}
	});
}
