/**
 * src/lib/utils/resonance.test.ts
 *
 * The shared resonance model's two postures: strict (default — the in-game
 * full-party-of-four rule, Team Builder) and relaxed (`requireFullParty:
 * false` — the rotation planner's flexible-slot behavior). team.test.ts
 * covers the strict path through the builder re-export; this pins the
 * relaxed mode and the Canopy edge.
 */

import { describe, it, expect } from 'vitest';
import { deriveResonances } from './resonance';

describe('deriveResonances', () => {
	it('strict default: no resonance while the party is partial', () => {
		const r = deriveResonances(['pyro', 'pyro', null, null]);
		expect(r.active).toEqual([]);
		expect(r.needsFullTeam).toBe(true);
	});

	it('relaxed: an element pair resonates beside blank slots', () => {
		const r = deriveResonances(['pyro', 'pyro', null, null], { requireFullParty: false });
		expect(r.active.map((a) => a.key)).toEqual(['pyro']);
		expect(r.needsFullTeam).toBe(true);
	});

	it('relaxed: double resonance with one blank slot', () => {
		const r = deriveResonances(['hydro', 'hydro', 'pyro', null], { requireFullParty: false });
		expect(r.active.map((a) => a.key).sort()).toEqual(['hydro']);
		const r2 = deriveResonances(['hydro', 'hydro', 'pyro', 'pyro'], {
			requireFullParty: false
		});
		expect(r2.active.map((a) => a.key).sort()).toEqual(['hydro', 'pyro']);
	});

	it('Protective Canopy needs four distinct FILLED slots in both modes', () => {
		const full = ['pyro', 'hydro', 'anemo', 'geo'];
		expect(deriveResonances(full).active.map((a) => a.key)).toEqual(['canopy']);
		expect(deriveResonances(full, { requireFullParty: false }).active.map((a) => a.key)).toEqual([
			'canopy'
		]);
		// Three distinct + a blank is NOT canopy, even relaxed.
		expect(
			deriveResonances(['pyro', 'hydro', 'anemo', null], { requireFullParty: false }).active
		).toEqual([]);
	});

	it('every resonance carries structured tooltip rows', () => {
		for (const el of ['pyro', 'hydro', 'anemo', 'electro', 'cryo', 'geo', 'dendro']) {
			const r = deriveResonances([el, el, 'geo', 'hydro'], { requireFullParty: false });
			const res = r.active.find((a) => a.key === el);
			expect(res, el).toBeDefined();
			expect(res!.rows.length, el).toBeGreaterThan(0);
		}
	});
});
