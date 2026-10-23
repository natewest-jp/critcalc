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
	type TeamSlot
} from '$lib/boards.svelte';
import { teamKey } from '$lib/utils/notationEdit';
import {
	newTabId,
	rotationTabs,
	slotsFromNotation,
	type RotationTab
} from '$lib/rotationTabs.svelte';
import { documentBar } from '$lib/documentBar.svelte';
import { ensureStorage } from './boot';
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
import { get, getAll, getMeta, put, readAll, replaceAll, setMeta, tombstone } from './db';
import { buildStoreBackup, type StoreBackup, type StoreParse } from './backup';
import type { MigrationResult } from './migrate';
import { applyBackup, buildEnvelope } from '$lib/utils/settingsBackup';
import { settleDocuments } from './arrivals';
import { levelChanges, movedBody, type LevelChange } from './move';
import { holdDocument, openStorageChannel, type DocumentLock } from './docLock';
import { bindRoster, siteSettings, type RosterPart, type SavedNotation } from '$lib/stores';
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

export { rotationAsSaved } from './convert';

/** How long typing must pause before a save (ms). Short enough that a closed
 *  tab rarely loses anything; `visibilitychange` flushes the rest. */
export const SAVE_DELAY_MS = 400;

export type DocTool = 'planner' | 'builder';

/** The Library's recency key: last opened or last changed, whichever is later. */
export const recency = (d: Pick<DocumentRecord, 'openedAt' | 'updatedAt'>): number =>
	Math.max(d.openedAt ?? 0, d.updatedAt);

type Pending = {
	planner?: { tabs: RotationTab[]; activeId: string };
	builder?: { boards: Board[]; activeId: string };
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
	#timer: ReturnType<typeof setTimeout> | undefined;
	#flushing: Promise<void> = Promise.resolve();

	/** Open the store and load the active profile's current documents. Falls
	 *  back to localStorage (today's behaviour) if the store is unavailable. */
	async start(): Promise<void> {
		const db = await ensureStorage();
		const meta = db ? await getMeta(db) : {};
		const profile =
			db &&
			((meta.activeProfileId && (await get(db, 'profiles', meta.activeProfileId))) ||
				(await get(db, 'profiles', THEORYCRAFT_ID)));
		if (!db || !profile || profile.deleted) {
			rotationTabs.restore();
			boards.restore();
			settleDocuments(false);
			return;
		}
		this.#db = db;
		this.#attach();
		this.#useProfile(profile);
		await this.#loadProfiles();
		if (!meta.guestsMadeAt) await this.#makeGuests(db);

		await this.#loadPlanner(profile);
		await this.#loadBuilder(profile);
		this.active = true;
		settleDocuments(true);
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
				this.#frozen = true;
				location.reload();
				return;
			}
			if (msg.store === 'documents') {
				this.version++;
				if (this.readOnly.includes(msg.id)) void this.#reload(msg.id);
			}
			if (msg.store === 'teams') this.teamsVersion++;
			if (msg.store === 'profiles') {
				void this.#loadProfiles();
				if (msg.id === this.profile?.id) void this.#reloadProfile();
			}
		});
		addEventListener('keydown', this.#onKey);
		addEventListener('keydown', this.#onFlipKey, true);
		document.addEventListener('visibilitychange', this.#onVisibility);
	}

	/** The active profile alone, for a surface with no document (the landing,
	 *  the content pages): the top bar's picture. Idempotent. */
	async peekProfile(): Promise<void> {
		if (this.profile) return;
		const db = await ensureStorage();
		if (!db) return;
		const meta = await getMeta(db);
		const profile =
			(meta.activeProfileId && (await get(db, 'profiles', meta.activeProfileId))) ||
			(await get(db, 'profiles', THEORYCRAFT_ID));
		if (profile && !profile.deleted && !this.profile) {
			this.#db ??= db;
			this.#attach();
			this.#useProfile(profile);
			await this.#loadProfiles();
		}
	}

	/** "Edit here": take the document from whichever tab holds it, pick up its
	 *  latest saved state, and resume saving it. */
	async editHere(id: string): Promise<void> {
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

	/** Write everything pending now (⌘S, the tab hiding). */
	flush(): Promise<void> {
		clearTimeout(this.#timer);
		this.#flushing = this.#flushing.then(() => this.#write());
		return this.#flushing;
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
	async create(tool: DocTool): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
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
		// The document on screen is renamed THROUGH its tab, or the next
		// autosave would write the tab's old label back over it.
		if (this.active && rotationTabs.tabs.some((t) => t.id === id)) {
			const label = next ?? this.#derived.get(id) ?? rotationLabel(rotationTabs.seats);
			if (!next) this.#derived.set(id, label);
			rotationTabs.tabs = rotationTabs.tabs.map((t) => (t.id === id ? { ...t, label } : t));
			return this.flush();
		}
		if (this.active && boards.boards.some((b) => b.id === id)) {
			const label = next ?? this.#derived.get(id) ?? lineupLabel(boards.activeBoard);
			if (!next) this.#derived.set(id, label);
			boards.boards = boards.boards.map((b) => (b.id === id ? { ...b, label } : b));
			return this.flush();
		}
		await this.#patch(db, id, { name: next });
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
		this.#locks.get(id)?.release();
		this.#locks.delete(id);
		this.#channel?.post({ kind: 'deleted', store: 'documents', id, profileId: doc.profileId });
		this.version++;
		// Nothing left to show is a blank, never the first visit's sample.
		if (this.profile?.current[tool] === id) await this.#setCurrent(db, tool, null);
		if (!showing) return;
		// Off a tool, `open` moves the pointer, so the tool arrives on it.
		const next = (await this.documents(doc.type)).sort((a, b) => recency(b) - recency(a))[0];
		if (next) await this.open(next.id);
		else if (this.active) this.#showBlank(tool);
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
			this.#locks.get(d.id)?.release();
			this.#locks.delete(d.id);
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
		this.teamsVersion++;
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
		const doc = await get(db, 'documents', id);
		if (!doc || doc.deleted) return null;
		const next = { ...doc, ...fields, updatedAt: Date.now() } as DocumentRecord;
		if (fields.pinned === undefined && 'pinned' in fields) delete next.pinned;
		await put(db, 'documents', next);
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
		const id = tool === 'planner' ? rotationTabs.activeTabId : boards.activeBoardId;
		this.#locks.get(id)?.release();
		this.#locks.delete(id);
		this.readOnly = this.readOnly.filter((x) => x !== id);
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

	#showBlank(tool: DocTool): void {
		if (tool === 'planner') {
			const label = rotationLabel([]);
			const tab: RotationTab = { id: newTabId(), label, notation: '', viewedAt: Date.now() };
			this.#derived.set(tab.id, label);
			rotationTabs.restoreFrom({ tabs: [tab], activeTabId: tab.id }, false);
			this.#plannerContext(null);
		} else {
			const board = makeBoard('Lineup 1', 'stygian');
			boards.restoreFrom({ boards: [board], activeBoardId: board.id });
		}
	}

	// ── Loading ─────────────────────────────────────────────────────────────

	async #loadPlanner(profile: ProfileRecord): Promise<void> {
		const doc = await this.#current(profile, 'planner');
		rotationTabs.persistSink = (tabs, activeId) => this.#queue({ planner: { tabs, activeId } });
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
	async #hold(id: string): Promise<boolean> {
		if (this.#locks.has(id)) return true;
		if (this.readOnly.includes(id)) return false;
		const lock = await holdDocument(id, { onLost: () => this.#lost(id) });
		if (lock) {
			this.#locks.set(id, lock);
			return true;
		}
		this.readOnly = [...this.readOnly, id];
		return false;
	}

	#lost(id: string): void {
		this.#locks.delete(id);
		if (!this.readOnly.includes(id)) this.readOnly = [...this.readOnly, id];
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
		const p = this.#db && this.profile ? await get(this.#db, 'profiles', this.profile.id) : null;
		if (!p) return;
		// Deleted in another tab: this one goes to Theorycraft too.
		if (p.deleted) return void this.switchTo(THEORYCRAFT_ID);
		this.#useProfile(p);
	}

	// ── Saving ──────────────────────────────────────────────────────────────

	/** Set while a backup is restored: nothing is saved over it. */
	#frozen = false;

	#queue(p: Pending): void {
		if (this.#frozen) return;
		this.#pending = { ...this.#pending, ...p };
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.flush(), SAVE_DELAY_MS);
	}

	async #write(): Promise<void> {
		const db = this.#db;
		const profile = this.profile;
		const { planner, builder } = this.#pending;
		this.#pending = {};
		if (!db || !profile || (!planner && !builder)) return;
		this.saving = true;
		try {
			const now = Date.now();
			let wrote = false;
			let current = profile.current;
			if (planner) {
				for (const tab of planner.tabs) {
					const body = tabToRotationBody(tab);
					const fresh = !this.#records.has(tab.id);
					// A blank tab is not a document until something is in it.
					if (fresh && !body.notation.trim() && body.slots.every((s) => !s)) continue;
					const name = nameToStore(tab.label, this.#derived.get(tab.id));
					wrote = (await this.#save(db, tab.id, 'rotation', name, body, now)) || wrote;
				}
				if (this.#records.has(planner.activeId)) {
					current = { ...current, planner: planner.activeId };
				}
			}
			if (builder) {
				for (const board of builder.boards) {
					const body = boardToLineupBody(board);
					const fresh = !this.#records.has(board.id);
					if (fresh && body.teams.every((t) => t.slots.every((s) => !s))) continue;
					const name = nameToStore(board.label, this.#derived.get(board.id));
					wrote = (await this.#save(db, board.id, 'lineup', name, body, now)) || wrote;
				}
				if (this.#records.has(builder.activeId)) {
					current = { ...current, builder: builder.activeId };
				}
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
		} finally {
			this.saving = false;
		}
	}

	/** Write one document if it changed and this tab holds it. */
	async #save(
		db: IDBDatabase,
		id: string,
		type: DocumentRecord['type'],
		name: string | null,
		body: RotationDocument['body'] | LineupDocument['body'],
		now: number
	): Promise<boolean> {
		const key = JSON.stringify({ name, body });
		if (this.#tombstoned.has(id) || this.#written.get(id) === key) return false;
		if (!(await this.#hold(id))) return false;
		const prev = this.#records.get(id);
		const rec = {
			...(prev ?? {
				id,
				profileId: this.profile!.id,
				createdAt: now,
				...(this.#fromLink.has(id) ? { fromLink: true } : {})
			}),
			type,
			name,
			body,
			updatedAt: now
		} as DocumentRecord;
		// ⚠ The tab snapshot holds $state proxies, which IndexedDB cannot clone.
		await put(db, 'documents', $state.snapshot(rec) as DocumentRecord);
		this.#records.set(id, rec);
		this.names[id] = rec.name;
		this.#written.set(id, key);
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
		this.#frozen = true;
		clearTimeout(this.#timer);
		clearTimeout(this.#rosterTimer);
		this.#pending = {};
		this.#rosterPending = {};
		await this.#flushing;
		await this.#profileQueue;
		for (const lock of this.#locks.values()) lock.release();
		this.#locks.clear();
		await replaceAll(
			db,
			$state.snapshot(parsed.store) as MigrationResult,
			Date.now(),
			parsed.legacy
		);
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
		this.plannerPair = null;
		const pairId = doc?.pairId;
		if (!pairId || !this.#db) return;
		void get(this.#db, 'documents', pairId).then((p) => {
			if (!p || p.deleted || p.pairId !== doc!.id || rotationTabs.activeTabId !== doc!.id) return;
			this.plannerPair = {
				id: p.id,
				profileId: p.profileId,
				createdAt: p.createdAt,
				self: { profileId: doc!.profileId, createdAt: doc!.createdAt },
				label: p.name ?? (p.type === 'rotation' ? rotationLabel(p.body.slots) : lineupLabel(p.body))
			};
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
			const d = await get(db, 'documents', id);
			if (!d || d.deleted) return;
			const next = { ...d, updatedAt: now } as DocumentRecord;
			if (pairId) next.pairId = pairId;
			else delete next.pairId;
			await put(db, 'documents', next);
			if (this.#records.has(id)) this.#records.set(id, next);
			this.#channel?.post({ kind: 'saved', store: 'documents', id, profileId: d.profileId });
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
			body: { ...$state.snapshot(doc.body), con }
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
		// ⚓ The FIRST routed copy teaches the rule once; afterwards the white and
		// the status carry it (§4.6).
		if (!storeGet(siteSettings).seenGuestNotice) {
			siteSettings.markGuestNoticeSeen();
			documentBar.showNotice(`Saved to Theorycraft · it doesn't match ${profile.name}'s roster`);
		}
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
		const now = Date.now();
		for (const p of await getAll(db, 'profiles')) {
			if (p.kind !== 'real') continue;
			const { constellations: roster, ownership: owned } = p.roster;
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
					body: { ...d.body, con }
				};
				await put(db, 'documents', copy);
				await put(db, 'documents', { ...d, pairId: copy.id, updatedAt: now });
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
		name = ''
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
		await this.#putTeam(db, team);
		return { team, created: true };
	}

	/** Rename a team or change its members. Refused (false) when the new set
	 *  is another team's: one team per set. */
	async updateTeam(
		id: string,
		patch: { name?: string; slots?: readonly (string | null)[] }
	): Promise<boolean> {
		const db = this.#db ?? (await ensureStorage());
		const team = db ? await get(db, 'teams', id) : undefined;
		if (!db || !team || team.deleted) return false;
		if (patch.slots) {
			const other = await this.teamFor(patch.slots);
			if (other && other.id !== id) return false;
		}
		await this.#putTeam(db, {
			...team,
			...(patch.name !== undefined && { name: patch.name.trim() }),
			...(patch.slots && { slots: normalizeSlots(patch.slots) }),
			updatedAt: Date.now()
		});
		return true;
	}

	/** ⚓ A TOMBSTONE. The rotations and lineups made from it stay. */
	async deleteTeam(id: string): Promise<void> {
		const db = this.#db ?? (await ensureStorage());
		if (!db) return;
		await tombstone(db, 'teams', id, Date.now());
		this.#channel?.post({ kind: 'deleted', store: 'teams', id, profileId: this.profile?.id });
		this.teamsVersion++;
	}

	async #putTeam(db: IDBDatabase, team: TeamRecord): Promise<void> {
		await put(db, 'teams', $state.snapshot(team) as TeamRecord);
		this.#channel?.post({ kind: 'saved', store: 'teams', id: team.id, profileId: team.profileId });
		this.teamsVersion++;
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

	/**
	 * Add to a lineup (§3): the team goes into the current lineup's first EMPTY
	 * team, else a new one where the lineup can grow (a Custom one; an endgame
	 * mode's teams are the game's). ⚓ Nothing is overwritten. Returns the
	 * team's id, which the Builder selects on arrival, or null when full.
	 * ⚠ Needs the session ACTIVE (the Builder's board in memory), so a caller
	 * off a tool goes to the Builder and waits for `documentsReady` first.
	 */
	addToLineup(slots: readonly (string | null)[]): string | null {
		if (!this.active) return null;
		const board = boards.activeBoard;
		const seats: TeamSlot[] = normalizeSlots(slots);
		const target =
			board.teams.find((t) => t.slots.every((s) => s === null)) ??
			(board.preset === 'custom' ? boards.addTeam(board.id, seats) : undefined);
		if (!target) return null;
		boards.setTeam(board.id, target.id, seats);
		boardFocus.teamId = target.id;
		return target.id;
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

	async createProfile(fields: { name: string; colour: ProfileColour; picture?: Picture }) {
		const db = this.#db ?? (await ensureStorage());
		if (!db || !this.canAddProfile || this.colourOwner(fields.colour)) return;
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
		const now = Date.now();
		for (const d of await getAll(db, 'documents', id)) {
			this.#tombstoned.add(d.id);
			await tombstone(db, 'documents', d.id, now);
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
		this.profile = p;
		bindRoster(
			{
				constellations: p.roster.constellations,
				ownership: p.roster.ownership,
				loadout: p.roster.loadout
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

	#queueRoster(part: RosterPart, value: object): void {
		if (this.#frozen) return;
		const key = part === 'ownership' ? 'ownership' : part;
		this.#rosterPending = { ...this.#rosterPending, [key]: value };
		clearTimeout(this.#rosterTimer);
		this.#rosterTimer = setTimeout(() => void this.#flushRoster(), SAVE_DELAY_MS);
	}

	async #flushRoster(): Promise<void> {
		clearTimeout(this.#rosterTimer);
		const pending = this.#rosterPending;
		this.#rosterPending = {};
		if (!this.profile || !Object.keys(pending).length) return;
		await this.#putProfile(this.profile.id, (p) => ({ ...p, roster: { ...p.roster, ...pending } }));
	}

	/**
	 * Every profile write goes through here, in order: it re-reads the stored
	 * record and applies one change, so a roster edit and a current-document
	 * move can never write over each other.
	 */
	#putProfile(id: string, change: (p: ProfileRecord) => ProfileRecord): Promise<void> {
		this.#profileQueue = this.#profileQueue.then(async () => {
			const db = this.#db ?? (await ensureStorage());
			const stored = db ? await get(db, 'profiles', id) : undefined;
			if (!db || !stored || stored.deleted) return;
			// ⚠ A plain copy: IndexedDB cannot clone a reactive proxy (DataCloneError).
			const next = $state.snapshot({ ...change(stored), updatedAt: Date.now() }) as ProfileRecord;
			await put(db, 'profiles', next);
			if (this.profile?.id === id) this.profile = next;
			this.#channel?.post({ kind: 'saved', store: 'profiles', id });
		});
		return this.#profileQueue;
	}
	#profileQueue: Promise<void> = Promise.resolve();

	// ── Page events ─────────────────────────────────────────────────────────

	/** ⚓ ⌘S is caught and confirms the work is already saved (§4.1) — never
	 *  the browser's "Save page as". */
	#onKey = (e: KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
			e.preventDefault();
			void this.flush().then(() => (this.savedAt = Date.now()));
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
}

export const storageSession = new StorageSession();
