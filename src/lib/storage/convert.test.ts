import { describe, expect, it } from 'vitest';
import {
	boardToLineupBody,
	lineupLabel,
	lineupToBoard,
	nameToStore,
	rotationLabel,
	rotationToTab,
	tabToRotationBody
} from './convert';
import type { LineupDocument, RotationDocument } from './records';

const rotation: RotationDocument = {
	id: 'd1',
	updatedAt: 1,
	profileId: 'p',
	type: 'rotation',
	name: null,
	createdAt: 1,
	body: {
		notation: 'Bennett E Q > Xiangling Q',
		slots: ['bennett', 'xiangling', null, 'hu_tao'],
		placed: [false, false, false, true],
		con: { bennett: 6 }
	}
};

describe('convert', () => {
	it('an unnamed rotation is labelled by its characters’ full names', () => {
		expect(rotationLabel(rotation.body.slots)).toBe('Bennett · Xiangling · Hu Tao');
		expect(rotationLabel([null, null, null, null])).toBe('New rotation');
		expect(rotationToTab(rotation).label).toBe('Bennett · Xiangling · Hu Tao');
	});

	it('a rotation survives the round trip through a tab', () => {
		expect(tabToRotationBody(rotationToTab(rotation))).toEqual(rotation.body);
	});

	it('a lineup survives the round trip through a board', () => {
		const lineup: LineupDocument = {
			id: 'l1',
			updatedAt: 1,
			profileId: 'p',
			type: 'lineup',
			name: 'Week one',
			createdAt: 1,
			body: {
				preset: 'stygian',
				season: '7.1',
				noRepeats: true,
				teams: [{ id: 't', slots: ['bennett', null, null, null], pinnedRotationId: 'd1' }]
			}
		};
		const board = lineupToBoard(lineup);
		expect(board.label).toBe('Week one');
		expect(boardToLineupBody(board)).toEqual(lineup.body);
		expect(lineupLabel({ preset: 'stygian' })).toBe('Stygian');
		expect(lineupLabel({ preset: 'abyss' })).toBe('Abyss');
	});

	it('stores no name for a derived or minted label, the label once renamed', () => {
		expect(nameToStore('Bennett · Xiangling', 'Bennett · Xiangling')).toBeNull();
		expect(nameToStore('Tab 3', undefined)).toBeNull();
		expect(nameToStore('  ', undefined)).toBeNull();
		expect(nameToStore('Vape practice', 'Bennett · Xiangling')).toBe('Vape practice');
		// A name already stored stays, even one that looks minted (a saved
		// entry's name was the player's, typed or accepted at Save).
		expect(nameToStore('Tab 2', undefined, 'Tab 2')).toBe('Tab 2');
	});
});
