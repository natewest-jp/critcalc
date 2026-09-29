import { describe, expect, it } from 'vitest';
import { cuesFor } from './cues';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import { FPS } from '$lib/utils/frames';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(all.map((c) => [c.displayName, c]));
const lookup = (name: string): CharacterData | null => byName.get(name) ?? null;
const team = ['Fischl', 'Bennett'].map((n) => byName.get(n) ?? null);

describe('cuesFor', () => {
	it("marks every press once, in time order, and a swap at the previous track's end", () => {
		const rotation = parseNotation('Fischl E N2 > Bennett Q D', lookup, 9, {}, {}, team, null);
		const cues = cuesFor(rotation);
		expect(cues.map((c) => c.kind)).toEqual([
			'skill',
			'normal',
			'normal',
			'swap',
			'burst',
			'movement'
		]);
		for (let i = 1; i < cues.length; i++) expect(cues[i].t).toBeGreaterThanOrEqual(cues[i - 1].t);
		const swap = cues.find((c) => c.kind === 'swap')!;
		expect(swap.t).toBeCloseTo(rotation.tracks[0].activeEnd / FPS, 9);
		// The swap key is pressed BEFORE the next track opens: swapF later.
		expect(rotation.tracks[1].activeStart).toBeGreaterThan(rotation.tracks[0].activeEnd);
	});

	it('a wait is not a press, and two segments of one character are not a swap', () => {
		const rotation = parseNotation('Bennett E ~2s > Bennett Q', lookup, 9, {}, {}, team, null);
		const cues = cuesFor(rotation);
		expect(cues.map((c) => c.kind)).toEqual(['skill', 'burst']);
	});
});
