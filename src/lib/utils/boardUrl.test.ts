import { describe, it, expect } from 'vitest';
import { encodeBoard, decodeBoard, type SharedBoard } from './boardUrl';
import { deflateToBase64Url } from './urlCodec';

const lineup: SharedBoard = {
	label: 'Stygian — week 3',
	noRepeats: true,
	teams: [
		{
			slots: ['furina', 'neuvillette', 'kaedehara_kazuha', 'zhongli'],
			constellations: { furina: 2, neuvillette: 0, kaedehara_kazuha: 0, zhongli: 0 }
		},
		{
			slots: ['mavuika', 'citlali', null, 'xilonen'],
			constellations: { mavuika: 0, citlali: 0, xilonen: 0 }
		}
	]
};

describe('boardUrl', () => {
	it('round-trips a lineup, C0s included', async () => {
		expect(await decodeBoard(await encodeBoard(lineup))).toEqual(lineup);
	});

	it('keeps an EXPLICIT 0 — a shared C0 must not fall back to the roster (§9.5)', async () => {
		const decoded = await decodeBoard(await encodeBoard(lineup));
		expect(decoded!.teams[0].constellations.neuvillette).toBe(0);
	});

	it('refuses an unknown marker, an empty board and an oversized one', async () => {
		expect(await decodeBoard('2~abc')).toBeNull();
		expect(await decodeBoard(await encodeBoard({ ...lineup, teams: [] }))).toBeNull();
		const huge = { ...lineup, teams: Array.from({ length: 13 }, () => lineup.teams[0]) };
		expect(await decodeBoard(await encodeBoard(huge))).toBeNull();
	});

	it('sanitizes a hostile payload into the shape', async () => {
		const dirty = {
			v: 1,
			label: 42,
			teams: [
				{
					slots: ['a', 7, 'x'.repeat(65), null, 'e'],
					con: { a: 9, ghost: 3, x: -1 }
				}
			]
		};
		const decoded = await decodeBoard('1~' + (await deflateToBase64Url(JSON.stringify(dirty))));
		expect(decoded).toEqual({
			label: 'Shared board',
			noRepeats: true,
			// four slots, wrong types and over-long ids emptied, the fifth dropped
			teams: [{ slots: ['a', null, null, null], constellations: { a: 6 } }]
		});
	});
});
