import { describe, expect, it } from 'vitest';
import { parseAnyBackup } from './backup';

/** A v3 file with one real profile carrying `instruments`. */
function file(instruments: unknown): string {
	return JSON.stringify({
		app: 'critcalc',
		version: 3,
		exportedAt: 1,
		data: {},
		store: {
			profiles: [
				{
					id: 'p1',
					updatedAt: 1,
					kind: 'real',
					name: 'Main',
					color: 'anemo',
					twin: 'aether',
					roster: {},
					current: {},
					createdAt: 1,
					instruments
				}
			]
		}
	});
}

const profileOf = (text: string) => {
	const r = parseAnyBackup(text, { now: 1, newId: () => 'x' });
	if (!r.ok) throw new Error(r.error);
	return r.store.profiles.find((p) => p.id === 'p1');
};

describe('a backup keeps the Visualizers’ saved instruments (overhaul round 4)', () => {
	it('restores each instrument’s state with its profile', () => {
		const states = { wish: { v: 3, pulls: 120 }, crit: { v: 1, cr: 0.8 } };
		expect(profileOf(file(states))?.instruments).toEqual(states);
	});

	it('drops a state that is not an object, and the field when nothing is left', () => {
		expect(profileOf(file({ wish: 7, crit: { v: 1 } }))?.instruments).toEqual({ crit: { v: 1 } });
		expect(profileOf(file({ wish: 'x' }))).not.toHaveProperty('instruments');
		expect(profileOf(file(null))).not.toHaveProperty('instruments');
	});
});

describe('a backup’s profile color', () => {
	it('reads the current spelling', () => {
		expect(profileOf(file(undefined))?.color).toBe('anemo');
	});

	it('still reads a file saved with the old spelling, and keeps only the new key', () => {
		const old = file(undefined).replace('"color"', '"colour"');
		expect(old).toContain('"colour"');
		const restored = profileOf(old);
		expect(restored?.color).toBe('anemo');
		expect(restored).not.toHaveProperty('colour');
	});
});
