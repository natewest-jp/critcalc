import { describe, expect, it, vi } from 'vitest';
import {
	exclusively,
	holdDocument,
	isHeld,
	openStorageChannel,
	waitForDocument,
	type StorageMessage
} from './docLock';

/**
 * A minimal Web Locks stand-in (Node 22 has no `navigator.locks`): exclusive
 * locks, `ifAvailable`, `steal`, and a plain request that WAITS its turn
 * (abortable by `signal`), per the spec's observable behaviour — a stolen
 * holder's `request()` promise rejects with an AbortError.
 */
function fakeLocks(): LockManager {
	type Held = { abort: (e: Error) => void };
	const held = new Map<string, Held>();
	const queue = new Map<string, (() => void)[]>();
	const abortError = (msg: string) => Object.assign(new Error(msg), { name: 'AbortError' });
	const grant = (
		name: string,
		cb: (lock: Lock | null) => unknown,
		resolve: (v: unknown) => void,
		reject: (e: unknown) => void
	) => {
		const entry: Held = { abort: reject };
		held.set(name, entry);
		Promise.resolve(cb({ name, mode: 'exclusive' } as Lock)).then(
			(v) => {
				if (held.get(name) === entry) {
					held.delete(name);
					queue.get(name)?.shift()?.();
				}
				resolve(v);
			},
			(e) => reject(e)
		);
	};
	const manager = {
		request(
			name: string,
			optionsOrCb: LockOptions | ((lock: Lock | null) => unknown),
			maybeCb?: (lock: Lock | null) => unknown
		) {
			// `request(name, callback)` is the spec's short form.
			const options = typeof optionsOrCb === 'function' ? {} : optionsOrCb;
			const cb = (typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb)!;
			return new Promise((resolve, reject) => {
				const current = held.get(name);
				if (current && options.ifAvailable) {
					resolve(cb(null));
					return;
				}
				if (current && options.steal) {
					current.abort(abortError('stolen'));
					grant(name, cb, resolve, reject);
					return;
				}
				if (!current) {
					grant(name, cb, resolve, reject);
					return;
				}
				const turn = () => grant(name, cb, resolve, reject);
				const q = queue.get(name) ?? [];
				q.push(turn);
				queue.set(name, q);
				options.signal?.addEventListener('abort', () => {
					const i = q.indexOf(turn);
					if (i < 0) return;
					q.splice(i, 1);
					reject(abortError('aborted'));
				});
			});
		},
		async query() {
			return { held: [...held.keys()].map((name) => ({ name, mode: 'exclusive' })), pending: [] };
		}
	};
	return manager as unknown as LockManager;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

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

describe('waiting for a document', () => {
	it('a read-only tab holds the document the moment the other tab lets go', async () => {
		const locks = fakeLocks();
		const a = await holdDocument('d1', {}, locks);
		const ac = new AbortController();
		let b: unknown = 'waiting';
		void waitForDocument('d1', { signal: ac.signal }, locks).then((l) => (b = l));
		await tick();
		expect(b).toBe('waiting');
		a!.release();
		await tick();
		await tick();
		expect(b).not.toBeNull();
		expect(b).not.toBe('waiting');
		expect(await isHeld('d1', locks)).toBe(true);
	});

	it('a wait this tab no longer wants resolves null and takes nothing', async () => {
		const locks = fakeLocks();
		const a = await holdDocument('d1', {}, locks);
		const ac = new AbortController();
		const b = waitForDocument('d1', { signal: ac.signal }, locks);
		ac.abort();
		expect(await b).toBeNull();
		a!.release();
		await tick();
		expect(await isHeld('d1', locks)).toBe(false);
	});
});

describe('without Web Locks (an insecure context, Safari before 15.4)', () => {
	it('every document is held here, as one tab would', async () => {
		expect(await holdDocument('d1', {}, undefined)).not.toBeNull();
		expect(await holdDocument('d1', {}, undefined)).not.toBeNull();
		const ac = new AbortController();
		expect(await waitForDocument('d1', { signal: ac.signal }, undefined)).not.toBeNull();
		expect(await isHeld('d1', undefined)).toBe(false);
	});

	it('an exclusive pass simply runs', async () => {
		expect(await exclusively('x', async () => 7, undefined)).toBe(7);
	});
});

describe('exclusively', () => {
	it('two tabs starting a once-only pass at the same moment run it one after the other', async () => {
		const locks = fakeLocks();
		const order: string[] = [];
		const pass = (who: string) =>
			exclusively(
				'guests',
				async () => {
					order.push(`${who} in`);
					await tick();
					order.push(`${who} out`);
				},
				locks
			);
		await Promise.all([pass('a'), pass('b')]);
		expect(order).toEqual(['a in', 'a out', 'b in', 'b out']);
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
