import { describe, expect, it } from 'vitest';
import { copyText, lapOffset, lapText, repeatNotation } from './repeat';
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
const parse = (n: string) => parseNotation(n, lookup, 9, {}, {}, team, null);

describe('repeatNotation', () => {
	it('joins the document to itself by a swap, trailing connectors dropped', () => {
		expect(repeatNotation('Fischl E > Bennett Q > ', 3)).toBe(
			'Fischl E > Bennett Q > Fischl E > Bennett Q > Fischl E > Bennett Q'
		);
		expect(lapText('A > B >\n')).toBe('A > B');
	});

	it('blanks stack asserts in the copies only, length preserved', () => {
		const doc = 'Bennett {coldDish:2} E';
		expect(copyText(doc)).toBe('Bennett              E');
		expect(copyText(doc).length).toBe(doc.length);
		const stream = repeatNotation(doc, 2);
		expect(stream.startsWith(doc)).toBe(true);
		expect(stream.slice(lapOffset(doc, 1))).toBe(copyText(doc));
	});

	it('an empty document repeats to nothing', () => {
		expect(repeatNotation('   ', 4)).toBe('   ');
	});
});

describe('the stream through the sim', () => {
	it('lap 2 waits for a cooldown the first lap left running', () => {
		const one = parse('Fischl E');
		const two = parse(repeatNotation('Fischl E', 2));
		const casts = two.events.filter((e) => e.kind === 'cast');
		expect(casts).toHaveLength(2);
		// Oz's skill is 25s: the second E cannot land before the first is ready.
		expect(casts[1].time).toBeGreaterThanOrEqual(casts[0].readyAt);
		expect(casts[1].time).toBeGreaterThan(one.totalDuration);
	});

	it('a swap back to the opener is charged, and a lap ending on the opener is not', () => {
		const stream = parse(repeatNotation('Fischl E > Bennett Q', 2));
		expect(stream.tracks).toHaveLength(4);
		// Bennett → Fischl at the seam: a real swap, swapF frames.
		expect(stream.tracks[2].activeStart).toBe(stream.tracks[1].activeEnd + 9);
		const same = parse(repeatNotation('Bennett E', 2));
		expect(same.tracks).toHaveLength(2);
		// Bennett → Bennett: nobody pressed swap.
		expect(same.tracks[1].activeStart).toBe(same.tracks[0].activeEnd);
	});

	it('one track per segment, so a lap is a fixed stride of tracks', () => {
		const doc = parse('Fischl E N2 > Bennett E Q');
		const stream = parse(repeatNotation('Fischl E N2 > Bennett E Q', 3));
		expect(stream.tracks.length).toBe(doc.tracks.length * 3);
		const lap2 = stream.tracks[doc.tracks.length];
		expect(lap2.characterId).toBe('fischl');
		expect(lap2.activeStart / FPS).toBeGreaterThan(doc.totalDuration / FPS);
	});
});
