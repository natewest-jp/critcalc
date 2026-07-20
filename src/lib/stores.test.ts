import { describe, it, expect } from 'vitest';
import { deriveInitialOwnership } from './stores';

// Only the pure migration seed is unit-tested here — the localStorage-gated
// store bodies are `browser`-false under vitest (same accepted gap as the
// constellations/loadout stores), so they're exercised at the browser surface
// by the Team Builder probe instead.

describe('deriveInitialOwnership', () => {
	it('marks every character with an explicit constellation entry as owned', () => {
		const seed = deriveInitialOwnership({ bennett: 0, xiangling: 6, nahida: 2 });
		expect(seed).toEqual({ bennett: 'owned', xiangling: 'owned', nahida: 'owned' });
	});

	it('treats C0 the same as any other level — an explicit entry means owned', () => {
		expect(deriveInitialOwnership({ furina: 0 })).toEqual({ furina: 'owned' });
	});

	it('returns an empty ledger when no constellations are set', () => {
		expect(deriveInitialOwnership({})).toEqual({});
	});
});
