/**
 * The storage session (build plan §13, phase 2a): under the switch, the
 * Planner and the Builder open the active profile's CURRENT documents from
 * IndexedDB and AUTOSAVE to them (§4.1), instead of reading and writing their
 * localStorage tab keys.
 *
 * ⚓ Until the new bars land (2b), each tool still runs on its tab model and
 * each tab IS a document, keyed by the document's id (`convert.ts`). The tab
 * models are untouched apart from a persistence SINK: `persist()` hands this
 * module its snapshot rather than writing localStorage, so ⚓ localStorage is
 * left as the migration found it (copy-only, §13.1).
 *
 * ⚓ The two-tab rule (§13.3): a document is SAVED only by the tab holding its
 * lock. A tab that cannot take it, or loses it to "Edit here" elsewhere, shows
 * the document but stops saving it, and offers Edit here itself. ⏭ A real
 * read-only view of the editor comes with the new bars; until then the notice
 * says the changes are not being kept.
 */

import {
	boardFocus,
	boards,
	makeBoard,
	normalizeSlots,
	type Board,
	type BoardPreset
} from '$lib/boards.svelte';
import { teamKey } from '$lib/utils/notationEdit';
import {
	newTabId,
	rotationTabs,
	slotsFromNotation,
	type RotationTab
} from '$lib/rotationTabs.svelte';
import { notices, heldKey } from '$lib/notices.svelte';
import { ensureStorage, reopenStorage } from './boot';
import {
	boardToLineupBody,
	lineupLabel,
	lineupToBoard,
	nameToStore,
	rotationAsSaved,
	rotationLabel,
	rotationToTab,
	tabToRotationBody
} from './convert';
import {
	get,
	getAll,
	getMeta,
	modify,
	put,
	putMany,
	readAll,
	replaceAll,
	setMeta,
	tombstone,
	type Meta
} from './db';
import { buildStoreBackup, type StoreBackup, type StoreParse } from './backup';
import { MIGRATED_PROFILE_NAME, type MigrationResult } from './migrate';
import { applyBackup, buildEnvelope, downloadEnvelope } from '$lib/utils/settingsBackup';
import { settleDocuments } from './arrivals';
import { levelChanges, movedBody, type LevelChange } from './move';
import {
	exclusively,
	holdDocument,
	openStorageChannel,
	waitForDocument,
	type DocumentLock
} from './docLock';
import {
	applyRosterChanges,
	dropJournal,
	replayJournals,
	rosterChange,
	writeJournal,
	type JournalDoc,
	type RosterChanges
} from './journal';
import {
	bindRoster,
	siteSettings,
	type LoadoutEntry,
	type RosterPart,
	type SavedNotation
} from '$lib/stores';
import { get as storeGet } from 'svelte/store';
import { askOnFirstSave } from '$lib/utils/storageDurability';
import {
	THEORYCRAFT_ID,
	newId,
	type Picture,
	type ProfileColour,
	type Roster,
	type DocumentRecord,
	type LineupDocument,
	type ProfileRecord,
	type RotationBody,
	type RotationDocument,
	type TeamRecord
} from './records';

import {
	bakeLoadout,
	compactEntry,
	compactLoadouts,
	isEmptyEntry,
	membersOnly,
	retireRosterLoadout,
	teamOfSlots
} from './teamLoadout';
export { rotationAsSaved } from './convert';

/** Approved by Nate 2026-10-23. */
const MIGRATED_NOTICE = `Your roster, rotations, and lineups are now in a profile, ${MIGRATED_PROFILE_NAME}`;

/** How long typing must pause before a save (ms). `visibilitychange` flushes
 *  early, and what an unloading page could not write waits in its journal
 *  (journal.ts). */
export const SAVE_DELAY_MS = 400;

/** After a failed write, the next try: doubling from the first, up to the last (ms). */
const RETRY_MS = [1000, 30_000] as const;

/** Approved by Nate 2026-10-23. */
/** The save-failure banner's key (notices §3.3). */
const SAVE_FAILED_KEY = 'save-failed';
const SAVE_FAILED_NOTICE = 'Couldn’t save your changes.';

export type DocTool = 'planner' | 'builder';

/** The Library's recency key: last opened or last changed, whichever is later. */
export const recency = (d: Pick<DocumentRecord, 'openedAt' | 'updatedAt'>): number =>
	Math.max(d.openedAt ?? 0, d.updatedAt);

type Pending = {
	planner?: { tabs: RotationTab[]; activeId: string };
	builder?: { boards: Board[]; activeId: string };
};

/** One document a write would save, as `#collect` finds it. */
type Entry = {
	id: string;
	type: DocumentRecord['type'];
	name: string | null;
	body: RotationDocument['body'] | LineupDocument['body'];
};

class StorageSession {
	/** True once the session has loaded the profile's documents. */
	active = $state(false);
	profile = $state<ProfileRecord | null>(null);
	/** Documents shown here while another tab holds them (not being saved). */
	readOnly = $state<string[]>([]);
	/** The last save's time (ms): the save status reads it (⏭ 2b). */
	savedAt = $state<number | null>(null);
	saving = $state(false);

	#db: IDBDatabase | null = null;
	#channel: ReturnType<typeof openStorageChannel> | null = null;
	#locks = new Map<string, DocumentLock>();
	/** Last-written `{ name, body }` per document, so an unchanged one is not rewritten. */
	#written = new Map<string, string>();
	/** The record as last read or written, for the fields a tab does not carry. */
	#records = new Map<string, DocumentRecord>();
	/** The label the session DERIVED for an unnamed document (see nameToStore). */
	#derived = new Map<string, string>();
	#pending: Pending = {};
	/** What the running write took out of `#pending`, until it lands. */
	#inflight: Pending = {};
	#timer: ReturnType<typeof setTimeout> | undefined;
	/** ⚠ Never left rejected: a rejected chain would swallow every later flush. */
	#flushing: Promise<void> = Promise.resolve();
	/** This page's own name, for its unload journal. */
	#page = newId();

	/** Open the store and load the active profile's current documents. Falls
	 *  back to localStorage (today's behaviour) if the store is unavailable —
	 *  or if loading throws, so the tools never wait on a session that died. */
	async start(): Promise<void> {
		try {
			if (await this.#start()) return;
		} catch (err) {
			console.warn('[critcalc] the storage session failed to start', err);
		}
		rotationTabs.restore();
		boards.restore();
		settleDocuments(false);
	}

	async #start(): Promise<boolean> {
		const db = await ensureStorage();
		if (!db) return false;
		const meta = await getMeta(db);
		const profile = await this.#activeProfile(db, meta);
		if (!profile) return false;
		this.#db = db;
		this.#attach();
		this.#useProfile(profile);
		await this.#loadProfiles();
		// ⚓ Before the guests: a what-if copy made from a team's rotation
		// takes the team's loadout with it, so the team must hold it first.
		await this.#retireRosterLoadouts(db);
		if (!meta.guestsMadeAt) await this.#makeGuests(db);

		await this.#loadPlanner(profile);
		await this.#loadBuilder(profile);
		this.active = true;
		settleDocuments(true);
		if (meta.backupOffer) await this.#offerBackup(db);
		return true;
	}

	/** The profile the site opens in: the stored choice while it is live, else
	 *  Theorycraft (a profile deleted in another tab can leave the pointer). */
	async #activeProfile(db: IDBDatabase, meta: Meta): Promise<ProfileRecord | undefined> {
		const chosen = meta.activeProfileId
			? await get(db, 'profiles', meta.activeProfileId)
			: undefined;
		if (chosen && !chosen.deleted) return chosen;
		const tc = await get(db, 'profiles', THEORYCRAFT_ID);
		return tc && !tc.deleted ? tc : undefined;
	}

	/** Once, after the migration moved the player's data (§13.1). */
	async #offerBackup(db: IDBDatabase): Promise<void> {
		const download = async () => {
			const at = Date.now();
			const file = await this.backup(at);
			if (file) downloadEnvelope(file, at);
		};
		// Once ever, with a button that matters: it stays until dismissed, and
		// is marked seen only once it has gone (notices §3.2).
		notices.toast('info', MIGRATED_NOTICE, {
			actions: [{ label: 'Download a backup', run: () => void download() }],
			ms: null,
			onGone: () => void setMeta(db, { backupOffer: false })
		});
	}

	/** The channel and page listeners. ⚠ Once per page: the tools layout
	 *  mounts again after a visit to the landing, and a second listener would
	 *  save and broadcast everything twice. */
	#attach(): void {
		if (this.#channel) return;
		this.#channel = openStorageChannel();
		this.#channel.listen((msg) => {
			// A backup was restored in another tab: everything here is stale,
			// and saving it would write the old data back over the restore.
			if (msg.kind === 'replaced') {
				this.#freeze();
				location.reload();
				return;
			}
			if (msg.store === 'documents') {
				this.version++;
				if (msg.kind === 'deleted') void this.#deletedElsewhere(msg.id);
				else if (this.readOnly.includes(msg.id)) void this.#reload(msg.id);
				// Renamed, pinned, moved or paired over there: take it on, or the
				// next autosave here would write this tab's stale copy back.
				else if (this.#records.has(msg.id)) void this.#adopt(msg.id);
			}
			if (msg.store === 'teams') this.#teamsChanged();
			if (msg.store === 'profiles') {
				void this.#loadProfiles();
				if (msg.id === this.profile?.id) void this.#reloadProfile();
			}
		});
		addEventListener('keydown', this.#onKey);
		addEventListener('keydown', this.#onFlipKey, true);
		document.addEventListener('visibilitychange', this.#onVisibility);
		addEventListener('pagehide', this.#onPageHide);
		addEventListener('pageshow', this.#onPageShow);
	}

	/** The active profile alone, for a surface with no document (the landing,
	 *  the content pages): the top bar's picture. Idempotent. */
	async peekProfile(): Promise<void> {
		if (this.profile) return;
		const db = await ensureStorage();
		if (!db) return;
		// ⚓ Here too, not only in `start`: a cold load of Teams or the Library
		// peeks and never starts, and must not show a team without the
		// loadout the roster still holds for it.
		await this.#retireRosterLoadouts(db);
		const profile = await this.#activeProfile(db, await getMeta(db));
		if (profile && !this.profile) {
			this.#db ??= db;
			this.#attach();
			this.#useProfile(profile);
			await this.#loadProfiles();
		}
	}

	/** "Edit here": take the document from whichever tab holds it, pick up its
	 *  latest saved state, and resume saving it. */
	async editHere(id: string): Promise<void> {
		this.#stopWaiting(id);
		this.#locks.get(id)?.release();
		const lock = await holdDocument(id, { steal: true, onLost: () => this.#lost(id) });
		if (lock) this.#locks.set(id, lock);
		await this.#reload(id);
		this.readOnly = this.readOnly.filter((x) => x !== id);
	}

	/** A document's stored name — `null` for an unnamed one (its label is
	 *  derived) or one not yet saved. Reactive: it reads `names`. */
	nameOf(id: string): string | null {
		return this.names[id] ?? null;
	}

	/** Stored names by document id, mirrored for the top bar to read. */
	names = $state<Record<string, string | null>>({});

	/** Write everything pending now (⌘S, the tab hiding). Never rejects: a
	 *  failed write keeps its work pending and tries again (`#writeFailed`). */
	flush(): Promise<void> {
		clearTimeout(this.#timer);
		this.#flushing = this.#flushing
			.then(() => this.#write())
			.catch((err: unknown) => this.#writeFailed(err));
		return this.#flushing;
	}

	/** A write failed and its work is pending again. Set until one lands. */
	saveFailed = $state(false);
	#retries = 0;
	#retryTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * ⚠ Nothing here may give up quietly: before this, one failed write left
	 * the save chain rejected and every later flush a no-op, for the rest of
	 * the page, with nothing on screen. The work stays pending, the person is
	 * told once, and the write is tried again — on a fresh connection, since
	 * a lost one (WebKit, a tab left in the background) is the common cause.
	 */
	async #writeFailed(err: unknown): Promise<void> {
		console.warn('[critcalc] a save failed; trying again', err);
		if (this.#frozen) return;
		if (!this.saveFailed) {
			this.saveFailed = true;
			// A CONDITION, not an event: it stays until a write lands.
			notices.banner({
				key: SAVE_FAILED_KEY,
				kind: 'error',
				lead: SAVE_FAILED_NOTICE,
				body: 'Trying again… Your work stays in this tab until it saves.',
				actions: [{ label: 'Download a backup', run: () => void this.#downloadBackup() }]
			});
		}
		const old = this.#db;
		const db = await reopenStorage().catch(() => null);
		if (db && db !== old) {
			this.#db = db;
			try {
				old?.close();
			} catch {
				/* already closed */
			}
		}
		const wait = Math.min(RETRY_MS[0] * 2 ** this.#retries++, RETRY_MS[1]);
		clearTimeout(this.#retryTimer);
		this.#retryTimer = setTimeout(() => {
			void this.flush();
			void this.#flushRoster();
		}, wait);
	}

	#saveLanded(): void {
		this.#retries = 0;
		this.saveFailed = false;
		notices.clearBanner(SAVE_FAILED_KEY);
	}

	async #downloadBackup(): Promise<void> {
		const at = Date.now();
		const file = await this.backup(at).catch(() => null);
		if (file) downloadEnvelope(file, at);
		else notices.toast('error', 'Couldn’t make a backup file from this browser’s data.');
	}

	// ── The Library (phase 2c, §4.2 + §6.3) ─────────────────────────────────
	//
	// ⚓ The Library is the SWITCHER: each tool holds one document, and a row
	// puts its document in the tool. These work with or without a tool mounted
	// — off a tool (a section's own route, the landing) they move the profile's
	// CURRENT pointer, and the tools layout opens it on arrival.

	/** Bumped on every document write here or in another tab: the Library's
	 *  lists re-read on it. */
	version = $state(0);

	/** The active profile's live documents of one type. */
	async documents(type: DocumentRecord['type']): Promise<DocumentRecord[]> {
		await this.peekProfile();
		const db = this.#db ?? (await ensureStorage());
		if (!db || !this.profile) return [];
		const all = await getAll(db, 'documents', this.profile.id);
		return all.filter((d) => d.type === type);
	}

	/** The active profile's rotations in the saved-entry shape a lineup's pins
	 *  resolve against (`teamCon`): what the Builder draws and what its share
	 *  link carries read this one list. */
	async savedRotations(): Promise<SavedNotation[]> {
		const docs = await this.documents('rotation');
		return docs.flatMap((d) => (d.type === 'rotation' ? [rotationAsSaved(d)] : []));
	}

	/** The document a tool is showing, or the profile's current one off a tool.
	 *  `null` for a blank that is not a document yet. */
	currentId(tool: DocTool): string | null {
		if (this.active) {
			const id = tool === 'planner' ? rotationTabs.activeTabId : boards.activeBoardId;
			return this.#records.has(id) ? id : null;
		}
		return this.profile?.current[tool] ?? null;
	}

	/** Whether a live document of the active profile has this id. */
	async exists(id: string): Promise<boolean> {
		const db = this.#db ?? (await ensureStorage());
		const doc = db ? await get(db, 'documents', id) : undefined;
		return !!doc && !doc.deleted && doc.profileId === this.profile?.id;
	}

	/** Put a document in its tool. */
	async open(id: string): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		const doc = db ? await get(db, 'documents', id) : undefined;
		if (!db || !doc || doc.deleted) return;
		const tool: DocTool = doc.type === 'rotation' ? 'planner' : 'builder';
		const opened = await this.#patch(db, id, { openedAt: Date.now() });
		if (!opened) return;
		if (!this.active) {
			await this.#setCurrent(db, tool, id);
			return;
		}
		if (this.currentId(tool) === id) return;
		await this.flush();
		this.#rememberLeaving(tool);
		this.#release(tool);
		this.#show(opened);
	}

	/** A new, empty document in a tool. It becomes a document on its first
	 *  content, as a blank tab always has. */
	async create(
		tool: DocTool,
		preset?: BoardPreset,
		team?: readonly (string | null)[]
	): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		// A new lineup's shape (New lineup, in the Library or on a team in
		// Teams) and the team it starts with, taken by the blank the Builder
		// shows next: now, or when the tools load if they aren't yet.
		if (preset) this.#blankSeed = { preset, team };
		if (this.active) {
			await this.flush();
			this.#release(tool);
			this.#showBlank(tool);
		}
		// ⚓ The blank is the profile's current document, so a reload or a new
		// session reopens it rather than the previous one.
		if (db) await this.#setCurrent(db, tool, null);
	}

	/** ⚓ An empty name clears it: the label goes back to being derived (§4.2). */
	async rename(id: string, name: string): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		if (!db) return;
		const next = name.trim() || null;
		// The document this tab is EDITING is renamed through its tab, or the
		// next autosave would write the tab's old label back over it.
		if (this.active && this.#locks.has(id) && this.#relabel(id, next)) return this.flush();
		// Otherwise straight to the store — including a document shown here
		// read-only, whose tab cannot save (its label follows).
		const patched = await this.#patch(db, id, { name: next });
		if (patched && this.readOnly.includes(id)) this.#relabel(id, next);
	}

	/** Put a name on the tab or board showing a document; `null` goes back to
	 *  the derived label. False when no tool shows it. */
	#relabel(id: string, name: string | null): boolean {
		if (rotationTabs.tabs.some((t) => t.id === id)) {
			const label = name ?? this.#derived.get(id) ?? rotationLabel(rotationTabs.seats);
			if (!name) this.#derived.set(id, label);
			rotationTabs.tabs = rotationTabs.tabs.map((t) => (t.id === id ? { ...t, label } : t));
			return true;
		}
		if (boards.boards.some((b) => b.id === id)) {
			const label = name ?? this.#derived.get(id) ?? lineupLabel(boards.activeBoard);
			if (!name) this.#derived.set(id, label);
			boards.boards = boards.boards.map((b) => (b.id === id ? { ...b, label } : b));
			return true;
		}
		return false;
	}

	async setPinned(id: string, on: boolean): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		if (db) await this.#patch(db, id, { pinned: on ? true : undefined });
	}

	/** ⚓ A deletion is a TOMBSTONE (records.ts). The tool showing it moves to
	 *  the most recent other document, else a blank one. */
	async remove(id: string): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		const doc = db ? await get(db, 'documents', id) : undefined;
		if (!db || !doc || doc.deleted) return;
		const tool: DocTool = doc.type === 'rotation' ? 'planner' : 'builder';
		const showing = this.currentId(tool) === id;
		// Anything queued for it is written first, so nothing pending can
		// write it back after the tombstone.
		if (this.active) await this.flush();
		this.#tombstoned.add(id);
		await tombstone(db, 'documents', id, Date.now());
		this.#records.delete(id);
		this.#written.delete(id);
		this.#letGo(id);
		this.#channel?.post({ kind: 'deleted', store: 'documents', id, profileId: doc.profileId });
		this.version++;
		// Nothing left to show is a blank, never the first visit's sample.
		if (this.profile?.current[tool] === id) await this.#setCurrent(db, tool, null);
		if (showing) await this.#showNext(tool, doc.type);
	}

	/** A tool's document is gone: the most recent other one, else a blank.
	 *  Off a tool, `open` moves the pointer, so the tool arrives on it. */
	async #showNext(tool: DocTool, type: DocumentRecord['type']): Promise<void> {
		const next = (await this.documents(type)).sort((a, b) => recency(b) - recency(a))[0];
		if (next) await this.open(next.id);
		else if (this.active) this.#showBlank(tool);
	}

	/** Deleted in another tab (its Library, a Reset, a deleted profile). The
	 *  tool showing it moves on, as it would have here; nothing it holds is
	 *  saved, or the autosave would bring the document back. */
	async #deletedElsewhere(id: string): Promise<void> {
		if (this.#tombstoned.has(id)) return;
		const rec = this.#records.get(id);
		const tool: DocTool | null = rec ? (rec.type === 'rotation' ? 'planner' : 'builder') : null;
		const showing = !!tool && this.active && this.currentId(tool) === id;
		this.#tombstoned.add(id);
		this.#records.delete(id);
		this.#written.delete(id);
		this.#letGo(id);
		if (tool && rec && showing) await this.#showNext(tool, rec.type);
	}

	/** Changed in another tab without its content changing (renamed, pinned,
	 *  paired, moved): this tab's copy of the record catches up. */
	async #adopt(id: string): Promise<void> {
		const doc = this.#db ? await get(this.#db, 'documents', id) : undefined;
		if (!doc || doc.deleted || !this.#records.has(id)) return;
		const prev = this.#records.get(id)!;
		this.#records.set(id, doc);
		this.names[id] = doc.name;
		if (prev.name !== doc.name) {
			// The stored copy is what this tab now has written, so the relabel
			// alone does not send a save back.
			this.#written.set(id, JSON.stringify({ name: doc.name, body: doc.body }));
			this.#relabel(id, doc.name);
		}
		if (doc.type === 'rotation' && rotationTabs.activeTabId === id) this.#plannerContext(doc);
	}

	/** Settings' Reset (⚓ Nate 2026-10-23: the ACTIVE profile's, like the
	 *  roster resets): every document of one type, tombstoned, and the tool on
	 *  a blank. ⚠ Never the old localStorage keys, which stay as the migration
	 *  found them (copy-only, §13.1). */
	async removeAll(type: DocumentRecord['type']): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		if (!db || !this.profile) return;
		const tool: DocTool = type === 'rotation' ? 'planner' : 'builder';
		if (this.active) await this.flush();
		const now = Date.now();
		for (const d of await this.documents(type)) {
			this.#tombstoned.add(d.id);
			await tombstone(db, 'documents', d.id, now);
			this.#records.delete(d.id);
			this.#written.delete(d.id);
			this.#letGo(d.id);
			this.#channel?.post({
				kind: 'deleted',
				store: 'documents',
				id: d.id,
				profileId: d.profileId
			});
		}
		this.version++;
		await this.#setCurrent(db, tool, null);
		if (this.active) this.#showBlank(tool);
	}

	/** The active profile's teams, all of them (Settings' Reset everything). */
	async removeAllTeams(): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		const pid = this.profile?.id;
		if (!db || !pid) return;
		const now = Date.now();
		for (const t of await getAll(db, 'teams', pid)) {
			await tombstone(db, 'teams', t.id, now);
			this.#channel?.post({ kind: 'deleted', store: 'teams', id: t.id, profileId: pid });
		}
		this.#teamsChanged();
	}

	/** Deleted here: never saved again, whatever a stale snapshot holds. */
	#tombstoned = new Set<string>();

	/** Merge fields into a stored document, keeping the session's copy in step
	 *  (an autosave spreads it, so a stale copy would undo the change). */
	async #patch(
		db: IDBDatabase,
		id: string,
		fields: Partial<Pick<DocumentRecord, 'name' | 'openedAt' | 'pinned'>>
	): Promise<DocumentRecord | null> {
		const next = await modify(db, 'documents', id, (doc) => {
			if (!doc || doc.deleted) return null;
			const out = { ...doc, ...fields, updatedAt: Date.now() } as DocumentRecord;
			if (fields.pinned === undefined && 'pinned' in fields) delete out.pinned;
			return out;
		});
		if (!next) return null;
		if (this.#records.has(id)) this.#records.set(id, next);
		if ('name' in fields) this.names[id] = next.name;
		this.#channel?.post({ kind: 'saved', store: 'documents', id, profileId: next.profileId });
		this.version++;
		return next;
	}

	async #setCurrent(db: IDBDatabase, tool: DocTool, id: string | null): Promise<void> {
		this.#db ??= db;
		const pid = this.profile?.id ?? THEORYCRAFT_ID;
		await this.#putProfile(pid, (p) => ({ ...p, current: { ...p.current, [tool]: id } }));
	}

	/** Let go of the document a tool is leaving, so another tab may edit it. */
	#release(tool: DocTool): void {
		this.#letGo(tool === 'planner' ? rotationTabs.activeTabId : boards.activeBoardId);
	}

	/** Give a document up: its lock, any wait for it, its read-only mark. */
	#letGo(id: string): void {
		this.#locks.get(id)?.release();
		this.#locks.delete(id);
		this.#stopWaiting(id);
		if (this.readOnly.includes(id)) this.readOnly = this.readOnly.filter((x) => x !== id);
	}

	#show(doc: DocumentRecord): void {
		if (doc.type === 'rotation') {
			const tab = rotationToTab(doc);
			this.#remember(doc, tab.label);
			void this.#hold(doc.id);
			rotationTabs.restoreFrom({ tabs: [tab], activeTabId: tab.id }, false);
			this.#plannerContext(doc);
		} else {
			const board = lineupToBoard(doc);
			this.#remember(doc, board.label);
			void this.#hold(doc.id);
			boards.restoreFrom({ boards: [board], activeBoardId: board.id });
		}
	}

	/** The shape the next blank lineup takes, and its first team; once. A
	 *  plain blank is Stygian and empty. */
	#blankSeed: { preset: BoardPreset; team?: readonly (string | null)[] } | null = null;

	#showBlank(tool: DocTool): void {
		if (tool === 'planner') {
			const label = rotationLabel([]);
			const tab: RotationTab = { id: newTabId(), label, notation: '', viewedAt: Date.now() };
			this.#derived.set(tab.id, label);
			rotationTabs.restoreFrom({ tabs: [tab], activeTabId: tab.id }, false);
			this.#plannerContext(null);
		} else {
			const seed = this.#blankSeed;
			this.#blankSeed = null;
			const board = makeBoard('Lineup 1', seed?.preset ?? 'stygian');
			if (seed?.team) {
				// ⚓ A team placed from Teams arrives selected (design §3).
				board.teams[0] = { ...board.teams[0], slots: normalizeSlots(seed.team) };
				boardFocus.teamId = board.teams[0].id;
			}
			boards.restoreFrom({ boards: [board], activeBoardId: board.id });
		}
	}

	// ── Loading ─────────────────────────────────────────────────────────────

	async #loadPlanner(profile: ProfileRecord): Promise<void> {
		const doc = await this.#current(profile, 'planner');
		rotationTabs.persistSink = (tabs, activeId) => this.#queue({ planner: { tabs, activeId } });
		rotationTabs.canEdit = () => this.#mayEdit(this.currentId('planner'));
		if (profile.current.planner === null) {
			this.#showBlank('planner');
		} else if (doc?.type === 'rotation') {
			const tab = rotationToTab(doc);
			this.#remember(doc, tab.label);
			await this.#hold(doc.id);
			rotationTabs.restoreFrom({ tabs: [tab], activeTabId: tab.id }, false);
			this.#plannerContext(doc);
		} else {
			// No current rotation: Theorycraft's first visit opens on a sample
			// (§9.1), a real profile on an empty one. It becomes a document on
			// its first save. ⚠ A fresh blank FIRST, always: `restoreFrom(null)`
			// keeps whatever tab is there, which after a profile switch is the
			// OTHER profile's document (and the sample would write over its id).
			this.#showBlank('planner');
			if (profile.kind === 'theorycraft') rotationTabs.restoreFrom(null, true);
		}
	}

	async #loadBuilder(profile: ProfileRecord): Promise<void> {
		const doc = await this.#current(profile, 'builder');
		boards.persistSink = (list, activeId) => this.#queue({ builder: { boards: list, activeId } });
		boards.canEdit = (id) => this.#mayEdit(id);
		if (profile.current.builder === null) {
			this.#showBlank('builder');
		} else if (doc?.type === 'lineup') {
			const board = lineupToBoard(doc);
			this.#remember(doc, board.label);
			await this.#hold(doc.id);
			boards.restoreFrom({ boards: [board], activeBoardId: board.id });
		} else {
			// ⚠ Never `restoreFrom(null)`: it keeps the other profile's lineup.
			this.#showBlank('builder');
		}
	}

	async #current(profile: ProfileRecord, tool: DocTool): Promise<DocumentRecord | undefined> {
		const id = profile.current[tool];
		const doc = id && this.#db ? await get(this.#db, 'documents', id) : undefined;
		return doc && !doc.deleted ? doc : undefined;
	}

	#remember(doc: DocumentRecord, label: string): void {
		this.#records.set(doc.id, doc);
		this.names[doc.id] = doc.name;
		if (!doc.name) this.#derived.set(doc.id, label);
		this.#written.set(doc.id, JSON.stringify({ name: doc.name, body: doc.body }));
	}

	// ── The locks ───────────────────────────────────────────────────────────

	/** Hold a document if no other tab does; else show it without saving. */
	/** A document another tab holds is READ-ONLY here (notices round): an
	 *  edit is refused, and the banner comes back to say why. */
	#mayEdit(id: string | null): boolean {
		if (!id || !this.readOnly.includes(id)) return true;
		notices.recall(heldKey(id));
		return false;
	}

	async #hold(id: string): Promise<boolean> {
		if (this.#locks.has(id)) return true;
		if (this.readOnly.includes(id)) return false;
		const lock = await holdDocument(id, { onLost: () => this.#lost(id) });
		if (lock) {
			this.#locks.set(id, lock);
			return true;
		}
		this.readOnly = [...this.readOnly, id];
		this.#waitFor(id);
		return false;
	}

	#lost(id: string): void {
		this.#locks.delete(id);
		if (!this.readOnly.includes(id)) this.readOnly = [...this.readOnly, id];
		this.#waitFor(id);
	}

	/** Read-only documents waiting for the tab that holds them to let go. */
	#waiters = new Map<string, AbortController>();

	/**
	 * ⚓ A read-only document is taken back the moment the tab holding it lets
	 * go (closes, opens another, switches profile). Before this it was tried
	 * once: a tab could say "Open in another tab" with no tab holding it, and
	 * everything typed there went nowhere.
	 */
	#waitFor(id: string): void {
		if (this.#waiters.has(id)) return;
		const ac = new AbortController();
		this.#waiters.set(id, ac);
		void waitForDocument(id, { signal: ac.signal, onLost: () => this.#lost(id) }).then(
			async (lock) => {
				if (this.#waiters.get(id) === ac) this.#waiters.delete(id);
				if (!lock) return;
				if (!this.readOnly.includes(id) || this.#locks.has(id)) return lock.release();
				this.#locks.set(id, lock);
				// The tab that held it may have unloaded before its last save.
				if (this.#db) await replayJournals(this.#db);
				await this.#reload(id);
				this.readOnly = this.readOnly.filter((x) => x !== id);
			}
		);
	}

	#stopWaiting(id: string): void {
		this.#waiters.get(id)?.abort();
		this.#waiters.delete(id);
	}

	/** Re-read a document into whichever tool shows it. */
	async #reload(id: string): Promise<void> {
		const doc = this.#db ? await get(this.#db, 'documents', id) : undefined;
		if (!doc || doc.deleted) return;
		if (doc.type === 'rotation' && rotationTabs.tabs.some((t) => t.id === id)) {
			const tab = rotationToTab(doc);
			this.#remember(doc, this.#derived.get(id) ?? tab.label);
			rotationTabs.restoreFrom(
				{ tabs: rotationTabs.tabs.map((t) => (t.id === id ? tab : t)), activeTabId: id },
				false
			);
		} else if (doc.type === 'lineup' && boards.boards.some((b) => b.id === id)) {
			const board = lineupToBoard(doc);
			this.#remember(doc, this.#derived.get(id) ?? board.label);
			boards.restoreFrom({
				boards: boards.boards.map((b) => (b.id === id ? board : b)),
				activeBoardId: id
			});
		}
	}

	async #reloadProfile(): Promise<void> {
		// This tab's own roster edits go in first, so loading the stored roster
		// shows both tabs' changes rather than dropping this one's.
		await this.#flushRoster();
		const p = this.#db && this.profile ? await get(this.#db, 'profiles', this.profile.id) : null;
		if (!p) return;
		// Deleted in another tab: this one goes to Theorycraft too.
		if (p.deleted) return void this.switchTo(THEORYCRAFT_ID);
		this.#useProfile(p);
	}

	// ── Saving ──────────────────────────────────────────────────────────────

	/** Set while a backup is restored: nothing is saved over it. */
	#frozen = false;

	/** Stop saving for good (a restore, here or in another tab): nothing
	 *  pending, queued or journalled can write the old data back. */
	#freeze(): void {
		this.#frozen = true;
		clearTimeout(this.#timer);
		clearTimeout(this.#rosterTimer);
		clearTimeout(this.#retryTimer);
		this.#pending = {};
		this.#rosterPending = {};
		dropJournal(this.#page);
	}

	#queue(p: Pending): void {
		if (this.#frozen) return;
		this.#pending = { ...this.#pending, ...p };
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.flush(), SAVE_DELAY_MS);
	}

	/** The documents a pending write would save. */
	#collect({ planner, builder }: Pending): (Entry & { fresh: boolean })[] {
		const out: (Entry & { fresh: boolean })[] = [];
		const nameOf = (id: string, label: string) =>
			nameToStore(label, this.#derived.get(id), this.#records.get(id)?.name ?? null);
		for (const tab of planner?.tabs ?? []) {
			const body = tabToRotationBody(tab);
			const fresh = !this.#records.has(tab.id);
			// A blank tab is not a document until something is in it.
			if (fresh && !body.notation.trim() && body.slots.every((s) => !s)) continue;
			out.push({ id: tab.id, type: 'rotation', name: nameOf(tab.id, tab.label), body, fresh });
		}
		for (const board of builder?.boards ?? []) {
			const body = boardToLineupBody(board);
			const fresh = !this.#records.has(board.id);
			if (fresh && body.teams.every((t) => t.slots.every((s) => !s))) continue;
			out.push({ id: board.id, type: 'lineup', name: nameOf(board.id, board.label), body, fresh });
		}
		return out;
	}

	async #write(): Promise<void> {
		const db = this.#db;
		const profile = this.profile;
		const taken = this.#pending;
		this.#pending = {};
		const { planner, builder } = taken;
		if (this.#frozen || !db || !profile || (!planner && !builder)) return;
		this.#inflight = taken;
		this.saving = true;
		try {
			const now = Date.now();
			let wrote = false;
			let current = profile.current;
			for (const entry of this.#collect(taken)) {
				wrote = (await this.#save(db, entry, now)) || wrote;
			}
			if (planner && this.#records.has(planner.activeId)) {
				current = { ...current, planner: planner.activeId };
			}
			if (builder && this.#records.has(builder.activeId)) {
				current = { ...current, builder: builder.activeId };
			}
			if (
				current.planner !== profile.current.planner ||
				current.builder !== profile.current.builder
			) {
				const { planner: cp, builder: cb } = current;
				await this.#putProfile(profile.id, (p) => ({
					...p,
					current: { ...p.current, planner: cp, builder: cb }
				}));
			}
			if (wrote) this.savedAt = now;
			this.#saveLanded();
		} catch (err) {
			// Back in the queue for the next try, unless newer work for the
			// same tool arrived meanwhile.
			this.#pending = { ...taken, ...this.#pending };
			throw err;
		} finally {
			this.#inflight = {};
			this.saving = false;
		}
	}

	/** Write one document if it changed and this tab holds it. */
	async #save(db: IDBDatabase, entry: Entry, now: number): Promise<boolean> {
		const { id, type, body } = entry;
		let { name } = entry;
		if (this.#tombstoned.has(id) || this.#written.get(id) === JSON.stringify({ name, body })) {
			return false;
		}
		if (!(await this.#hold(id))) return false;
		const prev = this.#records.get(id);
		const fresh = {
			id,
			profileId: this.profile!.id,
			createdAt: now,
			...(this.#fromLink.has(id) ? { fromLink: true } : {})
		};
		let deleted = false;
		let renamed = false;
		// ⚓ Merged onto the STORED record in one transaction, never this tab's
		// copy spread over it: another tab may have renamed, pinned, paired,
		// moved or deleted the document since this one read it, and only the
		// CONTENT is this tab's to write (redesign bug sweep §1.3).
		const rec = await modify(db, 'documents', id, (stored) => {
			if (stored?.deleted) {
				deleted = true;
				return null;
			}
			// Renamed elsewhere while this tab kept the old name: the new one stands.
			if (stored && prev && stored.name !== prev.name && name === prev.name) {
				name = stored.name;
				renamed = true;
			}
			// ⚠ The tab snapshot holds $state proxies, which IndexedDB cannot clone.
			return $state.snapshot({
				...(stored ?? prev ?? fresh),
				type,
				name,
				body,
				updatedAt: now
			}) as DocumentRecord;
		});
		if (deleted || !rec) {
			void this.#deletedElsewhere(id);
			return false;
		}
		if (renamed) this.#relabel(id, name);
		this.#records.set(id, rec);
		this.names[id] = rec.name;
		this.#written.set(id, JSON.stringify({ name, body }));
		this.#channel?.post({ kind: 'saved', store: 'documents', id, profileId: rec.profileId });
		this.version++;
		// ⚓ The persist ask on the first save of work (Nate 2026-10-23), the old
		// Save's rule moved to autosave. Only a CHANGE to a document that already
		// exists counts: Theorycraft's sample is written on a first visit with
		// nobody touching it, and the prompt must have a reason the user can see.
		if (prev) askOnFirstSave();
		return true;
	}

	// ── Backup v3 (design §10, §12 Q11) ─────────────────────────────────────

	/** Every profile's live records and the person's settings, as a v3 file. */
	async backup(exportedAt: number): Promise<StoreBackup | null> {
		const db = this.#db ?? (await ensureStorage());
		if (!db) return null;
		if (this.active) await this.flush();
		await this.#flushRoster();
		return buildStoreBackup(await readAll(db), buildEnvelope(exportedAt).data, exportedAt);
	}

	/** Documents changed since a time — the Settings line under "Last backup". */
	async changedSince(at: number): Promise<number> {
		const db = this.#db ?? (await ensureStorage());
		if (!db) return 0;
		const all = await readAll(db);
		return all.documents.filter((d) => !d.deleted && d.updatedAt > at).length;
	}

	/**
	 * Restore a backup: ⚓ it REPLACES every profile in this browser, as v1/v2's
	 * Restore replaced the roster and saved work. Saving stops first, so
	 * nothing pending can write the old data back; the other tabs are told
	 * to reload; the caller reloads this one.
	 */
	async restore(parsed: Extract<StoreParse, { ok: true }>): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		if (!db) throw new Error('storage unavailable');
		// What is pending is written first, so a restore that fails has lost
		// nothing; then saving stops.
		if (this.active) await this.flush();
		await this.#flushRoster();
		this.#freeze();
		await this.#profileQueue;
		try {
			await replaceAll(
				db,
				$state.snapshot(parsed.store) as MigrationResult,
				Date.now(),
				parsed.legacy
			);
		} catch (err) {
			// Nothing was replaced (one transaction): carry on saving.
			this.#frozen = false;
			throw err;
		}
		for (const lock of this.#locks.values()) lock.release();
		this.#locks.clear();
		applyBackup(parsed.data);
		this.#channel?.post({ kind: 'replaced' });
	}

	// ── Compare and the guest star (phase 4, design §4.6) ───────────────────
	//
	// ⚓ A pair is stored on BOTH documents (`pairId`): reopening either brings
	// the other back, and only ✕ ends it (Nate 2026-10-23, §12 Q30). A what-if
	// pair crosses profiles: the real profile's rotation and its Theorycraft
	// copy, which shows inside the real profile as a GUEST — every value its
	// own, the roster not read (`rotationTabs.rosterless`).

	/** The Planner's document is a guest: Theorycraft's, shown in a real profile. */
	plannerGuest = $state(false);
	/** The Planner's document's partner, when it has a live one. */
	plannerPair = $state<{
		id: string;
		profileId: string;
		label: string;
		createdAt: number;
		/** This side, for naming the two. */
		self: { profileId: string; createdAt: number };
	} | null>(null);

	/** The document each tool showed before its current one (⌃`, §4.2). */
	#previous: Partial<Record<DocTool, string>> = {};

	#rememberLeaving(tool: DocTool): void {
		const id = this.currentId(tool);
		if (id) this.#previous[tool] = id;
	}

	#plannerContext(doc: DocumentRecord | null): void {
		const guest = !!doc && !!this.profile && doc.profileId !== this.profile.id;
		this.plannerGuest = guest;
		rotationTabs.rosterless = guest;
		const pairId = doc?.pairId;
		const pairOf = (p: DocumentRecord | undefined) =>
			p && !p.deleted && p.pairId === doc!.id
				? {
						id: p.id,
						profileId: p.profileId,
						createdAt: p.createdAt,
						self: { profileId: doc!.profileId, createdAt: doc!.createdAt },
						label:
							p.name ?? (p.type === 'rotation' ? rotationLabel(p.body.slots) : lineupLabel(p.body))
					}
				: null;
		// ⚠ Settled in the SAME tick when this session already knows the
		// partner (a flip always does: it is the document just left). Clearing
		// it and waiting for the store showed the unpaired form for a frame or
		// two on every flip, and the bench's foot shrank and regrew under it.
		this.plannerPair = pairId ? pairOf(this.#records.get(pairId)) : null;
		if (!pairId || !this.#db) return;
		// The store has the last word: another tab may have ended or renamed it.
		void get(this.#db, 'documents', pairId).then((p) => {
			if (rotationTabs.activeTabId !== doc!.id) return;
			this.plannerPair = pairOf(p);
		});
	}

	/** ⌃`: the pair's other side, else the previous document. */
	async other(tool: DocTool): Promise<void> {
		if (tool === 'planner' && this.plannerPair) return this.open(this.plannerPair.id);
		const prev = this.#previous[tool];
		if (prev && prev !== this.currentId(tool) && (await this.#alive(prev))) await this.open(prev);
	}

	async #alive(id: string): Promise<boolean> {
		const d = this.#db ? await get(this.#db, 'documents', id) : undefined;
		return !!d && !d.deleted;
	}

	/** The Planner's current rotation as a stored record, written first. */
	async #currentRotation(): Promise<RotationDocument | null> {
		if (!this.active || !this.#db) return null;
		await this.flush();
		const d = await get(this.#db, 'documents', rotationTabs.activeTabId);
		return d && !d.deleted && d.type === 'rotation' ? d : null;
	}

	/** Pair two documents, ending any pair either was in. `b` null ends `a`'s. */
	async #setPair(a: string, b: string | null): Promise<void> {
		const db = this.#db;
		if (!db) return;
		const now = Date.now();
		const write = async (id: string, pairId: string | undefined) => {
			const next = await modify(db, 'documents', id, (d) => {
				if (!d || d.deleted) return null;
				const out = { ...d, updatedAt: now } as DocumentRecord;
				if (pairId) out.pairId = pairId;
				else delete out.pairId;
				return out;
			});
			if (!next) return;
			if (this.#records.has(id)) this.#records.set(id, next);
			this.#channel?.post({ kind: 'saved', store: 'documents', id, profileId: next.profileId });
		};
		const unpairOld = async (id: string) => {
			const old = (await get(db, 'documents', id))?.pairId;
			if (old && old !== b && old !== a) await write(old, undefined);
		};
		await unpairOld(a);
		if (b) await unpairOld(b);
		await write(a, b ?? undefined);
		if (b) await write(b, a);
		this.version++;
	}

	/**
	 * ⚓ A WHAT-IF (§2.4, §4.6): an owned character's level chosen against the
	 * roster, in either direction, never edits the rotation. It makes a
	 * Theorycraft copy holding every level as the rotation ran (the roster's for
	 * owned characters) with this one changed, pairs the two and shows the
	 * copy. A rotation already paired with a guest takes the change there: the
	 * copy is where its what-ifs live.
	 */
	async whatIf(charId: string, level: number): Promise<void> {
		const profile = this.profile;
		if (profile?.kind !== 'real' || this.plannerGuest) return;
		const doc = await this.#currentRotation();
		if (!doc || !this.#db) return;
		const partner = doc.pairId ? await get(this.#db, 'documents', doc.pairId) : undefined;
		if (partner && !partner.deleted && partner.profileId === THEORYCRAFT_ID) {
			await this.open(partner.id);
			rotationTabs.setTabCon(charId, level);
			return;
		}
		const { constellations: roster, ownership: owned } = profile.roster;
		const ids = new Set<string>([
			...doc.body.slots.filter((id): id is string => !!id),
			...slotsFromNotation(doc.body.notation),
			...Object.keys(doc.body.con ?? {})
		]);
		const con: Record<string, number> = {};
		for (const id of ids) con[id] = rotationTabs.levelOf(id, roster, owned);
		con[charId] = level;
		const now = Date.now();
		const copy: RotationDocument = {
			id: newId(),
			updatedAt: now,
			profileId: THEORYCRAFT_ID,
			type: 'rotation',
			name: null,
			createdAt: now,
			openedAt: now,
			// The copy has no team in Theorycraft: what it inherited becomes its own.
			body: { ...bakeLoadout($state.snapshot(doc.body), this.plannerTeam ?? undefined), con }
		};
		await put(this.#db, 'documents', copy);
		this.#channel?.post({
			kind: 'saved',
			store: 'documents',
			id: copy.id,
			profileId: THEORYCRAFT_ID
		});
		await this.#setPair(doc.id, copy.id);
		await this.open(copy.id);
		// ↻ EVERY routed copy says so (notices round, 2026-10-26; was the first
		// only): each one puts a different document in front of the person.
		notices.toast('info', `Saved to Theorycraft · it doesn't match ${profile.name}'s roster`);
	}

	/** Compare → Duplicate and compare: a copy beside the original, where the
	 *  original lives (a copy of a profile's rotation fits it, §4.3), shown. */
	async duplicateAndCompare(): Promise<void> {
		const doc = await this.#currentRotation();
		if (!doc || !this.#db) return;
		const now = Date.now();
		const copy: RotationDocument = {
			...$state.snapshot(doc),
			id: newId(),
			name: null,
			createdAt: now,
			updatedAt: now,
			openedAt: now
		} as RotationDocument;
		delete copy.pinned;
		delete copy.pairId;
		delete copy.fromLink;
		await put(this.#db, 'documents', copy);
		this.#channel?.post({
			kind: 'saved',
			store: 'documents',
			id: copy.id,
			profileId: copy.profileId
		});
		await this.#setPair(doc.id, copy.id);
		await this.open(copy.id);
	}

	/** Compare → Compare with…: the Library's pick pairs the current rotation
	 *  with the one chosen; the Planner stays on the current one. */
	async compareWith(id: string): Promise<void> {
		const doc = await this.#currentRotation();
		if (!doc || doc.id === id) return;
		await this.#setPair(doc.id, id);
		this.#plannerContext(this.#records.get(doc.id) ?? doc);
	}

	/** ✕: the pair ends; both documents stay. */
	async endPair(): Promise<void> {
		const id = rotationTabs.activeTabId;
		const pair = this.plannerPair;
		if (!pair) return;
		await this.#setPair(id, null);
		const self = this.#records.get(id);
		if (self) this.#plannerContext(self);
		else this.plannerPair = null;
	}

	/** The partner of each document that has one, for the Library's guest rows
	 *  and marks. */
	async partners(docs: readonly DocumentRecord[]): Promise<Record<string, DocumentRecord>> {
		const db = this.#db ?? (await ensureStorage());
		const out: Record<string, DocumentRecord> = {};
		if (!db) return out;
		for (const d of docs) {
			if (!d.pairId) continue;
			const p = await get(db, 'documents', d.pairId);
			if (p && !p.deleted && p.pairId === d.id) out[d.id] = p;
		}
		return out;
	}

	/**
	 * ONCE (§10): a real profile's rotation holding its own level for an OWNED
	 * character that disagrees with the roster was a what-if waiting for this
	 * phase. Each gets its Theorycraft copy at the stored levels, paired, so
	 * nothing changes silently: ⇅ shows both. The stored levels are left where
	 * they are (copy-only; under the switch an owned character reads the roster).
	 */
	async #makeGuests(db: IDBDatabase): Promise<void> {
		// ⚓ Once, however many tabs open at the same moment after the migration
		// (two made two copies of one rotation): one runs, the rest find it done.
		await exclusively('guests', async () => {
			if ((await getMeta(db)).guestsMadeAt) return;
			await this.#makeGuestsNow(db);
		});
	}

	async #makeGuestsNow(db: IDBDatabase): Promise<void> {
		const now = Date.now();
		for (const p of await getAll(db, 'profiles')) {
			if (p.kind !== 'real') continue;
			const { constellations: roster, ownership: owned } = p.roster;
			const teams = (await getAll(db, 'teams', p.id)).filter((t) => !t.deleted);
			for (const d of await getAll(db, 'documents', p.id)) {
				if (d.type !== 'rotation' || d.pairId || !d.body.con) continue;
				const stored = d.body.con;
				const differs = Object.entries(stored).some(
					([id, lv]) => owned[id] === 'owned' && lv !== (roster[id] ?? 0)
				);
				if (!differs) continue;
				const con: Record<string, number> = {};
				for (const id of d.body.slots) if (id) con[id] = roster[id] ?? 0;
				Object.assign(con, stored);
				const copy: RotationDocument = {
					id: newId(),
					updatedAt: now,
					profileId: THEORYCRAFT_ID,
					type: 'rotation',
					name: d.name,
					createdAt: now,
					pairId: d.id,
					// No team in Theorycraft: what it inherited becomes its own.
					body: { ...bakeLoadout(d.body, teamOfSlots(teams, d.body.slots)), con }
				};
				// Both in one transaction: a tab closed mid-pass leaves no orphan
				// copy for the next pass to duplicate. ⚓ The rotation's own
				// `updatedAt` stays: pairing it is not an edit, and it must not
				// jump to the top of the Library.
				await putMany(db, 'documents', [copy, { ...d, pairId: copy.id }]);
			}
		}
		await setMeta(db, { guestsMadeAt: now });
	}

	// ── Teams (phase 3, design §3) ──────────────────────────────────────────
	//
	// ⚓ One team per SET of four characters, within a profile: the set is the
	// identity, the order is stored for display (party order, §12 Q2). Teams
	// are curated, never filed into, and exist only in real profiles (§2.2).

	/** Bumped on every team write here or in another tab. */
	teamsVersion = $state(0);

	#teamLoad = 0;

	/** The team the Planner's rotation IS, whose loadout it inherits. */
	get plannerTeam(): TeamRecord | null {
		return rotationTabs.team;
	}

	/**
	 * ⚓ The profile's teams, handed to the Planner's rotation state, which
	 * derives the team its rotation is and so the loadout it inherits
	 * (teamLoadout.ts) — as `rosterless` is handed over: pushed, never an
	 * effect. On every team write here or in another tab, and on a switch.
	 */
	async #reloadTeams(): Promise<void> {
		const n = ++this.#teamLoad;
		const list = await this.teams();
		if (n !== this.#teamLoad) return;
		rotationTabs.teams = list.map((t) => ({ ...t, label: t.name || rotationLabel(t.slots) }));
	}

	#teamsChanged(): void {
		this.teamsVersion++;
		void this.#reloadTeams();
	}

	/** One member's weapon or artifact set on a team: `update` merges into
	 *  what the team holds, and a part set to `undefined` is cleared. */
	async setTeamLoadout(id: string, charId: string, update: Partial<LoadoutEntry>): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		if (!db) return;
		const next = await modify(db, 'teams', id, (t) => {
			if (!t || t.deleted || !t.slots.includes(charId)) return null;
			const all = { ...(t.loadout ?? {}) };
			const entry = compactEntry({ ...(all[charId] ?? {}), ...update });
			if (isEmptyEntry(entry)) delete all[charId];
			else all[charId] = entry;
			const out: TeamRecord = { ...t, updatedAt: Date.now() };
			if (Object.keys(all).length) out.loadout = all;
			else delete out.loadout;
			return $state.snapshot(out) as TeamRecord;
		});
		if (!next) return;
		this.#channel?.post({ kind: 'saved', store: 'teams', id, profileId: next.profileId });
		this.#teamsChanged();
	}

	/** Settings' Reset › Loadouts: every team in the profile chooses none. A
	 *  rotation's own choices are its content, and stay. */
	async clearTeamLoadouts(): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		const pid = this.profile?.id;
		if (!db || !pid) return;
		const now = Date.now();
		const changed = (await getAll(db, 'teams', pid))
			.filter((t) => !t.deleted && t.loadout)
			.map((t) => {
				const out: TeamRecord = { ...t, updatedAt: now };
				delete out.loadout;
				return out;
			});
		if (!changed.length) return;
		await putMany(db, 'teams', changed);
		for (const t of changed)
			this.#channel?.post({ kind: 'saved', store: 'teams', id: t.id, profileId: pid });
		this.#teamsChanged();
	}

	/**
	 * ⚓ THE ROSTER'S LOADOUT RETIRES INTO TEAMS (teamLoadout.ts), once per
	 * profile that still holds one: after the migration, after a restore of a
	 * backup made before teams carried loadouts, or for a profile made under
	 * the switch before this. Read from the data, not a flag, so a restore
	 * brings it back round. Under a lock, as the guests are (two tabs opening
	 * together must not both move it).
	 */
	async #retireRosterLoadouts(db: IDBDatabase): Promise<void> {
		const holding = (await getAll(db, 'profiles')).some(
			(p) => !p.deleted && p.kind === 'real' && Object.keys(p.roster.loadout ?? {}).length
		);
		if (!holding) return;
		await exclusively('loadouts', async () => {
			for (const p of await getAll(db, 'profiles')) {
				if (p.deleted || p.kind !== 'real' || !Object.keys(p.roster.loadout ?? {}).length) continue;
				const teams = (await getAll(db, 'teams', p.id)).filter((t) => !t.deleted);
				const rots = (await getAll(db, 'documents', p.id)).filter(
					(d): d is RotationDocument => !d.deleted && d.type === 'rotation'
				);
				const out = retireRosterLoadout(
					p.roster.loadout,
					teams,
					rots.map((d) => d.body)
				);
				// ⚓ Not an edit: `updatedAt` stays, or every rotation would jump to
				// the top of the Library (the guests' precedent).
				const teamRecs = [...out.teams].map(([i, l]) => ({ ...teams[i], loadout: l }));
				const rotRecs = [...out.rotations].map(([i, l]) => ({
					...rots[i],
					body: { ...rots[i].body, loadout: l }
				}));
				if (teamRecs.length) await putMany(db, 'teams', teamRecs);
				if (rotRecs.length) await putMany(db, 'documents', rotRecs);
				await modify(db, 'profiles', p.id, (stored) =>
					stored && !stored.deleted
						? { ...stored, roster: { ...stored.roster, loadout: {} } }
						: null
				);
			}
		});
		await this.#loadProfiles();
		if (this.profile) {
			const fresh = await get(db, 'profiles', this.profile.id);
			if (fresh && !fresh.deleted) this.profile = fresh;
		}
		await this.#reloadTeams();
	}

	/** The active profile's teams, in the order made. Theorycraft has none. */
	async teams(): Promise<TeamRecord[]> {
		await this.peekProfile();
		const db = this.#db ?? (await ensureStorage());
		if (!db || this.profile?.kind !== 'real') return [];
		const all = await getAll(db, 'teams', this.profile.id);
		return all.sort((a, b) => a.createdAt - b.createdAt);
	}

	/** The profile's team holding this set of characters, if any. */
	async teamFor(slots: readonly (string | null)[]): Promise<TeamRecord | undefined> {
		const key = teamKey(slots);
		if (!key) return undefined;
		return (await this.teams()).find((t) => teamKey(t.slots) === key);
	}

	/**
	 * File a set as a team. ⚓ An existing set is not filed twice: the team
	 * that holds it comes back instead (`created` false). ⚓ An empty name is
	 * a derived label, as an unnamed document's is (§4.2).
	 */
	async saveTeam(
		slots: readonly (string | null)[],
		name = '',
		teamLoadout: Record<string, LoadoutEntry> = {}
	): Promise<{ team: TeamRecord; created: boolean } | null> {
		const db = this.#db ?? (await ensureStorage());
		if (!db || this.profile?.kind !== 'real' || !teamKey(slots)) return null;
		const existing = await this.teamFor(slots);
		if (existing) return { team: existing, created: false };
		const now = Date.now();
		const team: TeamRecord = {
			id: newId(),
			updatedAt: now,
			profileId: this.profile.id,
			name: name.trim(),
			slots: normalizeSlots(slots),
			createdAt: now
		};
		const lo = compactLoadouts(membersOnly(teamLoadout, team.slots));
		if (Object.keys(lo).length) team.loadout = lo;
		await this.#putTeam(db, team);
		// At once, not on the list's reload: the bench hands its own loadout
		// over to the team next, and must not show none in between.
		rotationTabs.teams = [
			...rotationTabs.teams,
			{ ...team, label: team.name || rotationLabel(team.slots) }
		];
		return { team, created: true };
	}

	/** Rename a team, change its members, or replace its loadout (Teams'
	 *  details save all three at once). Refused (false) when the new set is
	 *  another team's: one team per set. */
	async updateTeam(
		id: string,
		patch: {
			name?: string;
			slots?: readonly (string | null)[];
			loadout?: Record<string, LoadoutEntry>;
		}
	): Promise<boolean> {
		const db = this.#db ?? (await ensureStorage());
		const team = db ? await get(db, 'teams', id) : undefined;
		if (!db || !team || team.deleted) return false;
		if (patch.slots) {
			const other = await this.teamFor(patch.slots);
			if (other && other.id !== id) return false;
		}
		const next: TeamRecord = {
			...team,
			...(patch.name !== undefined && { name: patch.name.trim() }),
			...(patch.slots && { slots: normalizeSlots(patch.slots) }),
			updatedAt: Date.now()
		};
		if (patch.loadout) {
			const lo = compactLoadouts(patch.loadout);
			if (Object.keys(lo).length) next.loadout = lo;
			else delete next.loadout;
		}
		// ⚓ Whoever left takes their loadout with them; a newcomer has none.
		if (patch.slots && next.loadout) {
			const kept = membersOnly(next.loadout, next.slots);
			if (Object.keys(kept).length) next.loadout = kept;
			else delete next.loadout;
		}
		await this.#putTeam(db, next);
		return true;
	}

	/** ⚓ A TOMBSTONE. The rotations and lineups made from it stay. */
	async deleteTeam(id: string): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		if (!db) return;
		await tombstone(db, 'teams', id, Date.now());
		this.#channel?.post({ kind: 'deleted', store: 'teams', id, profileId: this.profile?.id });
		this.#teamsChanged();
	}

	async #putTeam(db: IDBDatabase, team: TeamRecord): Promise<void> {
		await put(db, 'teams', $state.snapshot(team) as TeamRecord);
		this.#channel?.post({ kind: 'saved', store: 'teams', id: team.id, profileId: team.profileId });
		this.#teamsChanged();
	}

	/**
	 * Plan a rotation (§3): a NEW rotation, the four seated in the team's
	 * order, resting, in an empty notation (§8.1). It becomes the Planner's
	 * current document; what was there stays in the Library.
	 */
	async planTeam(slots: readonly (string | null)[], con?: Record<string, number>): Promise<void> {
		const seated = rotationTabs.teamDocument(slots);
		await this.createRotation({
			notation: '',
			slots: seated.slots!,
			placed: seated.placed!,
			...(con && Object.keys(con).length ? { con: { ...con } } : {})
		});
	}

	/** A new rotation in the active profile, made the Planner's current
	 *  document (Plan a rotation; the Builder's "Try it with … in the
	 *  Planner"). What was there stays in the Library. */
	async createRotation(body: RotationBody, name: string | null = null): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		if (!db || !this.profile) return;
		const now = Date.now();
		const doc: RotationDocument = {
			id: newId(),
			updatedAt: now,
			profileId: this.profile.id,
			type: 'rotation',
			name,
			createdAt: now,
			openedAt: now,
			body: $state.snapshot(body) as RotationBody
		};
		await put(db, 'documents', doc);
		this.#channel?.post({
			kind: 'saved',
			store: 'documents',
			id: doc.id,
			profileId: doc.profileId
		});
		this.version++;
		if (this.active) {
			await this.flush();
			this.#release('planner');
			this.#show(doc);
		}
		await this.#setCurrent(db, 'planner', doc.id);
	}

	// ── Moving out of Theorycraft (phase 3, design §4.3) ────────────────────

	/** The real profiles a Theorycraft document can move to. */
	get moveTargets(): ProfileRecord[] {
		return this.profiles.filter((p) => p.kind === 'real');
	}

	/** What a move would change, for its confirmation: each owned character
	 *  whose level differs from the profile's roster. */
	async moveChanges(id: string, profileId: string): Promise<LevelChange[] | null> {
		const db = this.#db ?? (await ensureStorage());
		const doc = db ? await get(db, 'documents', id) : undefined;
		const target = db ? await get(db, 'profiles', profileId) : undefined;
		if (!doc || doc.deleted || !target || target.deleted) return null;
		// An arrival is not a document until its first save: write it now.
		if (this.active) await this.flush();
		const fresh = (db && (await get(db, 'documents', id))) || doc;
		return levelChanges(fresh, target.roster);
	}

	/**
	 * ⚓ MOVE, not copy (draft 5): the document leaves Theorycraft for the
	 * profile, its owned characters reading the roster from then on. The site
	 * switches to that profile and opens it there, so you see where it went.
	 */
	async moveTo(id: string, profileId: string): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		if (!db) return;
		const tool: DocTool =
			(await get(db, 'documents', id))?.type === 'lineup' ? 'builder' : 'planner';
		if (this.active) {
			await this.flush();
			if (this.currentId(tool) === id) {
				this.#release(tool);
				this.#showBlank(tool);
			}
		}
		const doc = await get(db, 'documents', id);
		const target = await get(db, 'profiles', profileId);
		if (!doc || doc.deleted || !target || target.deleted || target.kind !== 'real') return;
		const from = doc.profileId;
		const moved = {
			...doc,
			profileId,
			body: movedBody(doc, target.roster),
			updatedAt: Date.now()
		} as DocumentRecord;
		await put(db, 'documents', moved);
		this.#records.delete(id);
		this.#written.delete(id);
		this.#channel?.post({ kind: 'saved', store: 'documents', id, profileId });
		// The profile it left no longer points at it.
		await this.#putProfile(from, (p) =>
			p.current[tool] === id ? { ...p, current: { ...p.current, [tool]: null } } : p
		);
		this.version++;
		await this.switchTo(profileId);
		await this.open(id);
	}

	// ── Profiles (phase 2d, design §2) ──────────────────────────────────────

	/** Every live profile, Theorycraft first, then in the order made. */
	profiles = $state<ProfileRecord[]>([]);
	/** When the active profile last CHANGED (ms): the switch cue reads it. */
	switchedAt = $state<number | null>(null);

	/** ⚓ Seven real profiles at most: one per element colour (§2.3). */
	static readonly MAX_REAL = 7;

	get canAddProfile(): boolean {
		return this.profiles.filter((p) => p.kind === 'real').length < StorageSession.MAX_REAL;
	}

	/** Colours taken, by whom (a colour is exclusive, §2.3). */
	colourOwner(colour: ProfileColour): ProfileRecord | undefined {
		return this.profiles.find((p) => p.colour === colour);
	}

	/** False when nothing was created (no storage, the cap, a taken colour). */
	async createProfile(fields: {
		name: string;
		colour: ProfileColour;
		picture?: Picture;
	}): Promise<boolean> {
		const db = this.#db ?? (await ensureStorage());
		if (!db || !this.canAddProfile || this.colourOwner(fields.colour)) return false;
		const now = Date.now();
		const rec: ProfileRecord = {
			id: newId(),
			updatedAt: now,
			kind: 'real',
			name: fields.name.trim() || 'My account',
			colour: fields.colour,
			...(fields.picture ? { picture: fields.picture } : {}),
			// ⚓ An account fact (§13.5); the site's current choice to start.
			twin: storeGet(siteSettings).travelerVariant === 'lumine' ? 'lumine' : 'aether',
			roster: { constellations: {}, ownership: {}, loadout: {} },
			current: {},
			createdAt: now
		};
		await put(db, 'profiles', $state.snapshot(rec) as ProfileRecord);
		this.#channel?.post({ kind: 'saved', store: 'profiles', id: rec.id });
		await this.#loadProfiles();
		await this.switchTo(rec.id);
		return true;
	}

	async updateProfile(
		id: string,
		patch: Partial<Pick<ProfileRecord, 'name' | 'colour' | 'picture'>>
	): Promise<void> {
		if (id === THEORYCRAFT_ID) return;
		if (patch.colour && this.colourOwner(patch.colour)?.id !== id && this.colourOwner(patch.colour))
			return;
		await this.#putProfile(id, (p) => ({ ...p, ...patch }));
		await this.#loadProfiles();
	}

	/** ⚓ A TOMBSTONE, with every document in it. Theorycraft can't go. */
	async deleteProfile(id: string): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		if (!db || id === THEORYCRAFT_ID) return;
		if (this.profile?.id === id) await this.switchTo(THEORYCRAFT_ID);
		// Another tab may have left the site's pointer on it.
		if ((await getMeta(db)).activeProfileId === id) {
			await setMeta(db, { activeProfileId: THEORYCRAFT_ID });
		}
		const now = Date.now();
		for (const d of await getAll(db, 'documents', id)) {
			this.#tombstoned.add(d.id);
			await tombstone(db, 'documents', d.id, now);
			// A tab showing one must let it go, or its autosave writes it back.
			this.#channel?.post({ kind: 'deleted', store: 'documents', id: d.id, profileId: id });
		}
		for (const t of await getAll(db, 'teams', id)) await tombstone(db, 'teams', t.id, now);
		await tombstone(db, 'profiles', id, now);
		this.#channel?.post({ kind: 'deleted', store: 'profiles', id });
		this.version++;
		await this.#loadProfiles();
	}

	/**
	 * Make another profile the active one (§9.4): its roster, its current
	 * documents, and the switch cue. The documents on screen are written
	 * first and let go, so another tab may take them.
	 */
	async switchTo(id: string): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		if (!db || id === this.profile?.id) return;
		const next = await get(db, 'profiles', id);
		if (!next || next.deleted) return;
		if (this.active) {
			await this.flush();
			this.#release('planner');
			this.#release('builder');
		}
		await this.#flushRoster();
		await setMeta(db, { activeProfileId: id });
		this.#useProfile(next);
		if (this.active) {
			await this.#loadPlanner(next);
			await this.#loadBuilder(next);
		}
		this.version++;
		this.switchedAt = Date.now();
	}

	/** ⚓ Links open in Theorycraft (§9.3). `true` if that meant leaving a
	 *  real profile, which the arrival says out loud. */
	async toTheorycraft(): Promise<boolean> {
		if (!this.profile || this.profile.id === THEORYCRAFT_ID) return false;
		await this.switchTo(THEORYCRAFT_ID);
		return true;
	}

	/** An arriving rotation: Theorycraft's new current document, marked as
	 *  from a link. Whatever was there before is in the Library. */
	async receiveRotation(
		doc: Omit<RotationTab, 'id'>
	): Promise<{ switched: boolean; id: string; movable: boolean }> {
		const switched = await this.toTheorycraft();
		await this.flush();
		this.#release('planner');
		const tab: RotationTab = { ...doc, id: newTabId(), viewedAt: Date.now() };
		this.#fromLink.add(tab.id);
		// ⚓ Unnamed (§4.2): "Shared rotation" is the planner's word for an
		// arrival, not the sender's name for it, so the label stays derived.
		this.#derived.set(tab.id, tab.label);
		rotationTabs.restoreFrom({ tabs: [tab], activeTabId: tab.id }, false);
		return { switched, id: tab.id, movable: this.moveTargets.length > 0 };
	}

	async receiveLineup(board: Board): Promise<{ switched: boolean; id: string; movable: boolean }> {
		const switched = await this.toTheorycraft();
		await this.flush();
		this.#release('builder');
		const b: Board = { ...board, id: newTabId(), viewedAt: Date.now() };
		this.#fromLink.add(b.id);
		boards.restoreFrom({ boards: [b], activeBoardId: b.id });
		return { switched, id: b.id, movable: this.moveTargets.length > 0 };
	}

	/** Documents that arrived by link, marked on their first save. */
	#fromLink = new Set<string>();

	#useProfile(p: ProfileRecord): void {
		// Pending roster work belongs to the profile it was made in; it is
		// flushed before every switch, and must never land on another.
		if (this.profile?.id !== p.id) this.#rosterPending = {};
		this.profile = p;
		rotationTabs.teams = [];
		void this.#reloadTeams();
		this.#rosterBase = JSON.parse(JSON.stringify(p.roster)) as Roster;
		bindRoster(
			{
				constellations: p.roster.constellations,
				ownership: p.roster.ownership,
				// ⚓ RETIRED (teamLoadout.ts): a rotation inherits its TEAM's
				// loadout (`rotationTabs.inheritedLoadout`), never the roster's.
				loadout: {}
			},
			(part, value) => this.#queueRoster(part, value)
		);
	}

	async #loadProfiles(): Promise<void> {
		const db = this.#db;
		if (!db) return;
		const all = await getAll(db, 'profiles');
		this.profiles = all.sort(
			(a, b) =>
				Number(b.kind === 'theorycraft') - Number(a.kind === 'theorycraft') ||
				a.createdAt - b.createdAt
		);
	}

	// ── The roster, written to the active profile ───────────────────────────

	#rosterPending: Partial<Roster> = {};
	#rosterTimer: ReturnType<typeof setTimeout> | undefined;
	/** The roster as this tab last loaded or wrote it: what its edits are
	 *  measured against, so only the characters it changed are written. */
	#rosterBase: Roster = { constellations: {}, ownership: {}, loadout: {} };

	#rosterChanges(pending: Partial<Roster>): RosterChanges | null {
		const out: RosterChanges = {};
		for (const part of Object.keys(pending) as (keyof Roster)[]) {
			const change = rosterChange(
				this.#rosterBase[part] as Record<string, unknown>,
				pending[part] as Record<string, unknown>
			);
			if (change) out[part] = change;
		}
		return Object.keys(out).length ? out : null;
	}

	#queueRoster(part: RosterPart, value: object): void {
		if (this.#frozen) return;
		// ⚓ The roster's loadout is retired: the store is the inherited layer
		// and is never written back. Its one writer left, Settings' Reset ›
		// Loadouts, means this profile's team loadouts.
		if (part === 'loadout') {
			if (!Object.keys(value).length) void this.clearTeamLoadouts();
			return;
		}
		const key = part === 'ownership' ? 'ownership' : part;
		this.#rosterPending = { ...this.#rosterPending, [key]: value };
		clearTimeout(this.#rosterTimer);
		this.#rosterTimer = setTimeout(() => void this.#flushRoster(), SAVE_DELAY_MS);
	}

	async #flushRoster(): Promise<void> {
		clearTimeout(this.#rosterTimer);
		if (this.#frozen) return;
		const pending = this.#rosterPending;
		this.#rosterPending = {};
		const profile = this.profile;
		if (!profile || !Object.keys(pending).length) return;
		const changes = this.#rosterChanges(pending);
		if (!changes) return;
		try {
			// ⚓ Key by key onto what is stored: another tab editing the same
			// profile's roster keeps its own change (it was a whole-map write).
			await this.#putProfile(profile.id, (p) => ({
				...p,
				roster: applyRosterChanges(p.roster, changes)
			}));
			if (this.profile?.id === profile.id) Object.assign(this.#rosterBase, pending);
			this.#saveLanded();
		} catch (err) {
			if (this.profile?.id === profile.id) {
				this.#rosterPending = { ...pending, ...this.#rosterPending };
			}
			void this.#writeFailed(err);
		}
	}

	/**
	 * Every profile write goes through here, in order: it re-reads the stored
	 * record and applies one change, so a roster edit and a current-document
	 * move can never write over each other.
	 */
	#putProfile(id: string, change: (p: ProfileRecord) => ProfileRecord): Promise<void> {
		// ⚠ The CALL can fail; the queue never stays failed, or every profile
		// write after one failure would silently do nothing.
		const run = this.#profileQueue.then(async () => {
			const db = this.#db ?? (await ensureStorage());
			if (!db) return;
			// One transaction: a roster edit in another tab is never read stale.
			const next = await modify(db, 'profiles', id, (stored) =>
				stored && !stored.deleted
					? // ⚠ A plain copy: IndexedDB cannot clone a reactive proxy (DataCloneError).
						($state.snapshot({ ...change(stored), updatedAt: Date.now() }) as ProfileRecord)
					: null
			);
			if (!next) return;
			if (this.profile?.id === id) this.profile = next;
			this.#channel?.post({ kind: 'saved', store: 'profiles', id });
		});
		this.#profileQueue = run.catch(() => {});
		return run;
	}
	#profileQueue: Promise<void> = Promise.resolve();

	// ── Page events ─────────────────────────────────────────────────────────

	/** ⚓ ⌘S is caught and confirms the work is already saved (§4.1) — never
	 *  the browser's "Save page as". */
	#onKey = (e: KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
			e.preventDefault();
			void this.flush().then(() => {
				// A failing save says so again, rather than nothing at all; a
				// document another tab holds is not being saved here, so it
				// earns no ✓ (its pill already says why).
				if (this.saveFailed) return notices.recall(SAVE_FAILED_KEY);
				const held = (['planner', 'builder'] as const).some((t) => {
					const id = this.currentId(t);
					return !!id && this.readOnly.includes(id);
				});
				if (!held) this.savedAt = Date.now();
			});
		}
	};

	/**
	 * ⚓ ⌃` — ONE key, two jobs (Nate 2026-10-23, §12 Q26): flip the pair if the
	 * rotation has one, else back to the previous document.
	 *
	 * ↻ It was ⌥` and Nate caught it typing a ` into the notation: on a Mac
	 * ⌥` is a DEAD KEY (an accent waiting for its letter), so a focused text
	 * field writes the mark itself, and nearly every ⌥ combination types a
	 * character there. ⌃ types nothing on any platform (⌘` is the system's
	 * window switcher). Caught in the CAPTURE phase, so the editor never sees
	 * it whatever its keymap binds.
	 */
	#onFlipKey = (e: KeyboardEvent) => {
		if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.code !== 'Backquote') return;
		if (!this.active) return;
		// The menu state covers the tool and its address names a SECTION, so
		// the path is no guide: `/help/planner` over the Builder flipped the
		// Planner's document, unseen.
		if (document.querySelector('[data-menu-state]')) return;
		const tool: DocTool | null = location.pathname.includes('/planner')
			? 'planner'
			: location.pathname.includes('/builder')
				? 'builder'
				: null;
		if (!tool || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
		e.preventDefault();
		e.stopPropagation();
		void this.other(tool);
	};

	#onVisibility = () => {
		if (document.visibilityState === 'hidden') {
			void this.flush();
			void this.#flushRoster();
		}
	};

	/**
	 * ⚓ The page is going (a reload, a close, a navigation away): what is not
	 * saved yet goes into this page's journal, synchronously, because the
	 * IndexedDB write the flush starts may never finish (journal.ts). Only
	 * what this tab could have saved: documents it holds, and new ones.
	 */
	#onPageHide = () => {
		if (this.#frozen || !this.profile) return;
		const profileId = this.profile.id;
		const at = Date.now();
		const pending = { ...this.#inflight, ...this.#pending };
		const docs: JournalDoc[] = [];
		for (const e of this.#collect(pending)) {
			if (this.#tombstoned.has(e.id)) continue;
			if (this.#written.get(e.id) === JSON.stringify({ name: e.name, body: e.body })) continue;
			const known = this.#records.get(e.id);
			if (known ? !this.#locks.has(e.id) : this.readOnly.includes(e.id)) continue;
			const entry = JSON.parse(JSON.stringify(e)) as JournalDoc & { fresh: unknown };
			docs.push({
				id: entry.id,
				type: entry.type,
				name: entry.name,
				body: entry.body,
				profileId: known?.profileId ?? profileId,
				...(known
					? {}
					: { fresh: { createdAt: at, ...(this.#fromLink.has(e.id) ? { fromLink: true } : {}) } })
			});
		}
		const isDoc = (id: string) => this.#records.has(id) || docs.some((d) => d.id === id);
		const planner = pending.planner && isDoc(pending.planner.activeId);
		const builder = pending.builder && isDoc(pending.builder.activeId);
		const roster = this.#rosterChanges(this.#rosterPending);
		writeJournal(this.#page, {
			at,
			docs,
			...((planner || builder) && {
				current: {
					profileId,
					...(planner && { planner: pending.planner!.activeId }),
					...(builder && { builder: pending.builder!.activeId })
				}
			}),
			...(roster && { roster: { profileId, changes: roster } })
		});
		void this.flush();
		void this.#flushRoster();
	};

	/** Back from the back/forward cache: the page lives on and saves for itself. */
	#onPageShow = (e: PageTransitionEvent) => {
		if (e.persisted) dropJournal(this.#page);
	};
}

export const storageSession = new StorageSession();
