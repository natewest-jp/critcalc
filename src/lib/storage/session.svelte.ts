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

import { boards, type Board } from '$lib/boards.svelte';
import { rotationTabs, type RotationTab } from '$lib/rotationTabs.svelte';
import { ensureStorage } from './boot';
import {
	boardToLineupBody,
	lineupToBoard,
	nameToStore,
	rotationToTab,
	tabToRotationBody
} from './convert';
import { get, getMeta, put } from './db';
import { holdDocument, openStorageChannel, type DocumentLock } from './docLock';
import {
	THEORYCRAFT_ID,
	type DocumentRecord,
	type LineupDocument,
	type ProfileRecord,
	type RotationDocument
} from './records';

/** How long typing must pause before a save (ms). Short enough that a closed
 *  tab rarely loses anything; `visibilitychange` flushes the rest. */
export const SAVE_DELAY_MS = 400;

export type DocTool = 'planner' | 'builder';

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
			return;
		}
		this.#db = db;
		this.profile = profile;

		await this.#loadPlanner(profile);
		await this.#loadBuilder(profile);

		this.#channel = openStorageChannel();
		this.#channel.listen((msg) => {
			if (msg.store === 'documents' && this.readOnly.includes(msg.id)) void this.#reload(msg.id);
			if (msg.store === 'profiles' && msg.id === this.profile?.id) void this.#reloadProfile();
		});
		addEventListener('keydown', this.#onKey);
		document.addEventListener('visibilitychange', this.#onVisibility);
		this.active = true;
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
		if (profile && !profile.deleted && !this.profile) this.profile = profile;
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

	// ── Loading ─────────────────────────────────────────────────────────────

	async #loadPlanner(profile: ProfileRecord): Promise<void> {
		const doc = await this.#current(profile, 'planner');
		rotationTabs.persistSink = (tabs, activeId) => this.#queue({ planner: { tabs, activeId } });
		if (doc?.type === 'rotation') {
			const tab = rotationToTab(doc);
			this.#remember(doc, tab.label);
			await this.#hold(doc.id);
			rotationTabs.restoreFrom({ tabs: [tab], activeTabId: tab.id }, false);
		} else {
			// No current rotation: Theorycraft's first visit opens on a sample
			// (§9.1), a real profile on an empty one. It becomes a document on
			// its first save.
			rotationTabs.restoreFrom(null, profile.kind === 'theorycraft');
		}
	}

	async #loadBuilder(profile: ProfileRecord): Promise<void> {
		const doc = await this.#current(profile, 'builder');
		boards.persistSink = (list, activeId) => this.#queue({ builder: { boards: list, activeId } });
		if (doc?.type === 'lineup') {
			const board = lineupToBoard(doc);
			this.#remember(doc, board.label);
			await this.#hold(doc.id);
			boards.restoreFrom({ boards: [board], activeBoardId: board.id });
		} else {
			boards.restoreFrom(null);
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
		if (p && !p.deleted) this.profile = p;
	}

	// ── Saving ──────────────────────────────────────────────────────────────

	#queue(p: Pending): void {
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
				// ⚠ A plain copy: `profile` is $state, and IndexedDB cannot clone
				// a reactive proxy (DataCloneError).
				const next = $state.snapshot({ ...profile, current, updatedAt: now }) as ProfileRecord;
				await put(db, 'profiles', next);
				this.profile = next;
				this.#channel?.post({ kind: 'saved', store: 'profiles', id: next.id });
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
		if (this.#written.get(id) === key) return false;
		if (!(await this.#hold(id))) return false;
		const prev = this.#records.get(id);
		const rec = {
			...(prev ?? { id, profileId: this.profile!.id, createdAt: now }),
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
		return true;
	}

	// ── Page events ─────────────────────────────────────────────────────────

	/** ⚓ ⌘S is caught and confirms the work is already saved (§4.1) — never
	 *  the browser's "Save page as". */
	#onKey = (e: KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
			e.preventDefault();
			void this.flush().then(() => (this.savedAt = Date.now()));
		}
	};

	#onVisibility = () => {
		if (document.visibilityState === 'hidden') void this.flush();
	};
}

export const storageSession = new StorageSession();
