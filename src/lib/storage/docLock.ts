/**
 * Two browser tabs on one profile (design §13.3, ⚓ Nate approved).
 *
 * Each tab holds its own copy of a document in memory and autosaves, so the
 * tab that saved last would silently overwrite the other's work. Two pieces:
 *
 * - ⚓ **A per-DOCUMENT lock** (Web Locks): a document open in one tab is
 *   read-only in another, which offers "Edit here"; taking it STEALS the
 *   lock and the first tab is told it has lost it. Different documents in
 *   different tabs stay fully editable, so the browser can be the tab system.
 *   The browser holds and releases the locks itself, so a closed or crashed
 *   tab can never leave a stale one — the failure of a hand-rolled "is it
 *   open" flag.
 * - **A broadcast for everything else** (BroadcastChannel): a save tells the
 *   other tabs, which refresh whatever lists the record.
 *
 * Both APIs are in every current engine, Safari included. The lock manager
 * and the channel are injectable for tests.
 *
 * ⚠ Web Locks exist only in a SECURE context, and arrived in Safari 15.4 (as
 * did BroadcastChannel): an iPhone opening a dev server over LAN `http://`
 * has neither. Without them every document is held here — one tab's
 * behaviour, as the old layout had — rather than the tools never loading.
 */

import type { StoreName } from './db';

const lockName = (docId: string) => `critcalc:doc:${docId}`;

/** The browser's lock manager, where it has one. */
const browserLocks = (): LockManager | undefined => globalThis.navigator?.locks;

/** What a hold is without a lock manager: always granted, nothing to release. */
const UNLOCKED: DocumentLock = { release() {} };

export type DocumentLock = {
	/** Give the document up (closing it, opening another). */
	release(): void;
};

export type HoldOptions = {
	/** "Edit here": take the lock from whichever tab holds it. */
	steal?: boolean;
	/** Another tab took it ("Edit here" over there): go read-only. */
	onLost?: () => void;
};

/**
 * Try to hold a document for editing. Resolves the lock, or `null` when
 * another tab holds it (and `steal` was not asked) — the caller opens the
 * document read-only and offers "Edit here".
 */
export function holdDocument(
	docId: string,
	{ steal = false, onLost }: HoldOptions = {},
	locks: LockManager | undefined = browserLocks()
): Promise<DocumentLock | null> {
	if (!locks) return Promise.resolve(UNLOCKED);
	return new Promise((resolve) => {
		let release!: () => void;
		const held = new Promise<void>((r) => (release = r));
		let released = false;
		const handle: DocumentLock = {
			release() {
				released = true;
				release();
			}
		};
		// `steal` and `ifAvailable` may not be combined: a steal always succeeds.
		const options: LockOptions = steal ? { steal: true } : { ifAvailable: true };
		locks
			.request(lockName(docId), options, (lock) => {
				if (!lock) {
					resolve(null);
					return;
				}
				resolve(handle);
				return held; // held until release()
			})
			.catch((err: unknown) => {
				// A stolen lock rejects its holder's request with an AbortError.
				// Our own release never rejects, so this is the other tab.
				if (!released && (err as { name?: string })?.name === 'AbortError') onLost?.();
			});
	});
}

/**
 * Wait for a document another tab holds, and hold it the moment it is free
 * (that tab closed, or moved to another document). Resolves `null` if
 * `signal` aborts first — this tab moved on and no longer wants it.
 */
export function waitForDocument(
	docId: string,
	{ signal, onLost }: { signal: AbortSignal; onLost?: () => void },
	locks: LockManager | undefined = browserLocks()
): Promise<DocumentLock | null> {
	if (!locks) return Promise.resolve(UNLOCKED);
	return new Promise((resolve) => {
		let release!: () => void;
		const held = new Promise<void>((r) => (release = r));
		let granted = false;
		let released = false;
		const handle: DocumentLock = {
			release() {
				released = true;
				release();
			}
		};
		locks
			.request(lockName(docId), { signal }, () => {
				granted = true;
				resolve(handle);
				return held;
			})
			.catch((err: unknown) => {
				// Aborted while waiting: nobody wants it any more.
				if (!granted) return resolve(null);
				// Stolen after it was granted, as `holdDocument`'s are.
				if (!released && (err as { name?: string })?.name === 'AbortError') onLost?.();
			});
	});
}

/**
 * Run `fn` while no other tab runs the same `name` — a pass that must happen
 * once however many tabs open at the same moment. Without a lock manager it
 * simply runs.
 */
export async function exclusively<T>(
	name: string,
	fn: () => Promise<T>,
	locks: LockManager | undefined = browserLocks()
): Promise<T> {
	if (!locks) return fn();
	return (await locks.request(`critcalc:${name}`, fn)) as T;
}

/** Is the document held by some tab right now (this one included)? */
export async function isHeld(
	docId: string,
	locks: LockManager | undefined = browserLocks()
): Promise<boolean> {
	if (!locks) return false;
	const { held } = await locks.query();
	return (held ?? []).some((l) => l.name === lockName(docId));
}

// ── The broadcast ───────────────────────────────────────────────────────────

export const CHANNEL_NAME = 'critcalc:storage';

/** What a save tells the other tabs. Ids only: they re-read the record. */
export type StorageMessage =
	| { kind: 'saved'; store: StoreName; id: string; profileId?: string }
	| { kind: 'deleted'; store: StoreName; id: string; profileId?: string }
	/** A backup was restored, or everything deleted (`wiped`): every record
	 *  changed, so the other tabs reload. */
	| { kind: 'replaced'; wiped?: boolean };

/** A channel that reaches nobody, where the browser has no BroadcastChannel. */
const silentChannel = () =>
	({
		postMessage() {},
		addEventListener() {},
		removeEventListener() {},
		close() {}
	}) as unknown as BroadcastChannel;

export function openStorageChannel(
	make = (n: string) =>
		typeof BroadcastChannel === 'undefined' ? silentChannel() : new BroadcastChannel(n)
) {
	const channel = make(CHANNEL_NAME);
	return {
		/** Tell the OTHER tabs (a BroadcastChannel never echoes to its sender). */
		post(msg: StorageMessage) {
			channel.postMessage(msg);
		},
		/** Listen; returns the unsubscribe. */
		listen(fn: (msg: StorageMessage) => void): () => void {
			const handler = (e: MessageEvent<StorageMessage>) => fn(e.data);
			channel.addEventListener('message', handler);
			return () => channel.removeEventListener('message', handler);
		},
		close() {
			channel.close();
		}
	};
}
