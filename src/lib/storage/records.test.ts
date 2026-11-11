import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from './records';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('mints a v4 UUID', () => {
		expect(newId()).toMatch(V4);
	});

	// iOS 15.0–15.3 and insecure contexts have getRandomValues but no
	// randomUUID, and an id is minted at module import.
	it('mints a v4 UUID without crypto.randomUUID', () => {
		const real = globalThis.crypto;
		vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
		const ids = Array.from({ length: 200 }, newId);
		for (const id of ids) expect(id).toMatch(V4);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
