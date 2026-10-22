import { describe, expect, it, vi } from 'vitest';
import { holdDocument, isHeld, openStorageChannel, type StorageMessage } from './docLock';

/**
 * A minimal Web Locks stand-in (Node 22 has no `navigator.locks`): exclusive
 * locks, `ifAvailable` and `steal`, per the spec's observable behaviour —
 * a stolen holder's `request()` promise rejects with an AbortError.
 */
function fakeLocks(): LockManager {
	const held = new Map<string, { abort: (e: Error) => void }>();
	const manager = {
		request(name: string, options: LockOptions, cb: (lock: Lock | null) => unknown) {
			return new Promise((resolve, reject) => {
				const current = held.get(name);
				if (current && options.ifAvailable) {
					resolve(cb(null));
					return;
				}
				if (current && options.steal) {
					const err = new Error('stolen');
					err.name = 'AbortError';
					current.abort(err);
				}
				const entry = { abort: reject };
				held.set(name, entry);
				Promise.resolve(cb({ name, mode: 'exclusive' } as Lock)).then(
					(v) => {
						if (held.get(name) === entry) held.delete(name);
						resolve(v);
					},
					(e) => reject(e)
				);
			});
		},
		async query() {
			return { held: [...held.keys()].map((name) => ({ name, mode: 'exclusive' })), pending: [] };
		}
	};
	return manager as unknown as LockManager;
}

describe('document locks', () => {
	it('a document open in one tab is read-only in another', async () => {
		const locks = fakeLocks();
		const a = await holdDocument('d1', {}, locks);
		expect(a).not.toBeNull();
		expect(await holdDocument('d1', {}, locks)).toBeNull();
		// A different document stays editable.
		expect(await holdDocument('d2', {}, locks)).not.toBeNull();
	});

	it('Edit here steals the lock and tells the first tab', async () => {
		const locks = fakeLocks();
		const onLost = vi.fn();
		await holdDocument('d1', { onLost }, locks);
		const b = await holdDocument('d1', { steal: true }, locks);
		expect(b).not.toBeNull();
		await Promise.resolve();
		await Promise.resolve();
		expect(onLost).toHaveBeenCalledOnce();
	});

	it('release frees the document, and is not reported as lost', async () => {
		const locks = fakeLocks();
		const onLost = vi.fn();
		const a = await holdDocument('d1', { onLost }, locks);
		expect(await isHeld('d1', locks)).toBe(true);
		a!.release();
		await new Promise((r) => setTimeout(r, 0));
		expect(await isHeld('d1', locks)).toBe(false);
		expect(await holdDocument('d1', {}, locks)).not.toBeNull();
		expect(onLost).not.toHaveBeenCalled();
	});
});

describe('storage channel', () => {
	it('tells the other tabs, never its sender', async () => {
		const a = openStorageChannel();
		const b = openStorageChannel();
		const gotA: StorageMessage[] = [];
		const gotB: StorageMessage[] = [];
		a.listen((m) => gotA.push(m));
		const stop = b.listen((m) => gotB.push(m));
		a.post({ kind: 'saved', store: 'documents', id: 'd1', profileId: 'p' });
		await new Promise((r) => setTimeout(r, 20));
		expect(gotB).toEqual([{ kind: 'saved', store: 'documents', id: 'd1', profileId: 'p' }]);
		expect(gotA).toEqual([]);
		stop();
		a.close();
		b.close();
	});
});
