/**
 * notationEdit.test.ts
 *
 * The single-truth rewrites operate on the user's OWN text, so the invariant
 * under test is mostly negative: what they must not touch. A search-and-replace
 * would corrupt `N2` and a rebuild would reformat spacing the user chose; both
 * are covered here, along with the join arithmetic (removing a middle segment
 * takes the `>` after it, removing the last takes the one before it) that is
 * the only genuinely fiddly part of the module.
 */

import { describe, it, expect } from 'vitest';
import {
	appendCharacterToNotation,
	deleteCharacterFromNotation,
	foldTeamIntoNotation,
	notationHasActions,
	notationSegments,
	orderedCharacterIds,
	renameCharacterInNotation,
	setTwinInNotation,
	seatTeam,
	seatsFromLegacy,
	awakeIds,
	emptySeating,
	makeSeating,
	placedSeating,
	type Seating
} from './notationEdit';

const FOUR = 'Bennett E Q > Xingqiu E Q > Zhongli E > Hu Tao E N2C';

describe('notationSegments / orderedCharacterIds', () => {
	it('reads one segment per name, in order', () => {
		expect(orderedCharacterIds(FOUR)).toEqual(['bennett', 'xingqiu', 'zhongli', 'hu_tao']);
	});

	it('resolves a multi-word name as one token', () => {
		expect(orderedCharacterIds('Hu Tao E > Yun Jin Q')).toEqual(['hu_tao', 'yun_jin']);
	});

	it('dedupes a character who appears in several segments', () => {
		expect(orderedCharacterIds('Bennett E > Xingqiu Q > Bennett Q')).toEqual([
			'bennett',
			'xingqiu'
		]);
	});

	it('does not cap at four — the fifth is the linter’s problem, not the store’s', () => {
		const five = 'Bennett > Xingqiu > Zhongli > Albedo > Nahida';
		expect(orderedCharacterIds(five)).toHaveLength(5);
	});

	it('leaves an unresolvable name out of the team but keeps its segment', () => {
		expect(orderedCharacterIds('Bennett E > Zhonli E')).toEqual(['bennett']);
		expect(notationSegments('Bennett E > Zhonli E')).toHaveLength(2);
	});

	it('knows a bare-name team from a written rotation', () => {
		expect(notationHasActions('Bennett > Xingqiu')).toBe(false);
		expect(notationHasActions('Bennett E > Xingqiu')).toBe(true);
		expect(notationHasActions('')).toBe(false);
	});
});

describe('renameCharacterInNotation', () => {
	it('replaces only the leading name token', () => {
		expect(renameCharacterInNotation(FOUR, 'zhongli', 'nahida')).toBe(
			'Bennett E Q > Xingqiu E Q > Nahida E > Hu Tao E N2C'
		);
	});

	it('renames every segment the character leads', () => {
		expect(
			renameCharacterInNotation('Bennett E > Xingqiu Q > Bennett Q', 'bennett', 'nahida')
		).toBe('Nahida E > Xingqiu Q > Nahida Q');
	});

	it('⚠ never touches an action token that shares letters with the name', () => {
		// The trap this module exists to avoid: "N" is in "Nahida", "C" is in
		// "Chongyun", and a text-level replace mangles both.
		const before = 'Nahida E N2C N5 > Chongyun E C1';
		expect(renameCharacterInNotation(before, 'nahida', 'bennett')).toBe(
			'Bennett E N2C N5 > Chongyun E C1'
		);
	});

	it('rewrites a multi-word name to a shorter one and back', () => {
		const once = renameCharacterInNotation('Hu Tao E N2C > Bennett Q', 'hu_tao', 'yelan');
		expect(once).toBe('Yelan E N2C > Bennett Q');
		expect(renameCharacterInNotation(once, 'yelan', 'hu_tao')).toBe('Hu Tao E N2C > Bennett Q');
	});

	it('is a no-op for somebody the notation does not name', () => {
		expect(renameCharacterInNotation(FOUR, 'nahida', 'furina')).toBe(FOUR);
	});
});

describe('deleteCharacterFromNotation', () => {
	it('takes the separator AFTER a middle segment', () => {
		expect(deleteCharacterFromNotation(FOUR, 'xingqiu')).toBe(
			'Bennett E Q > Zhongli E > Hu Tao E N2C'
		);
	});

	it('takes the separator BEFORE the last segment', () => {
		expect(deleteCharacterFromNotation(FOUR, 'hu_tao')).toBe(
			'Bennett E Q > Xingqiu E Q > Zhongli E'
		);
	});

	it('leaves no leading separator when the first segment goes', () => {
		expect(deleteCharacterFromNotation(FOUR, 'bennett')).toBe(
			'Xingqiu E Q > Zhongli E > Hu Tao E N2C'
		);
	});

	it('handles two ADJACENT deletions without eating a survivor', () => {
		// The overlap case: independently-computed spans would collide here,
		// because the `>` the middle deletion claims is the one the last
		// deletion wants to walk back over.
		const once = deleteCharacterFromNotation(FOUR, 'xingqiu');
		expect(deleteCharacterFromNotation(once, 'zhongli')).toBe('Bennett E Q > Hu Tao E N2C');
	});

	it('empties a one-character notation', () => {
		expect(deleteCharacterFromNotation('Bennett E Q', 'bennett')).toBe('');
	});

	it('removes every segment the character leads, not just the first', () => {
		expect(deleteCharacterFromNotation('Bennett E > Xingqiu Q > Bennett Q', 'bennett')).toBe(
			'Xingqiu Q'
		);
	});

	it('keeps a segment whose name resolves to nobody', () => {
		// It is not on the team, so clearing the team must not silently eat it.
		expect(deleteCharacterFromNotation('Bennett E > Zhonli E', 'bennett')).toBe('Zhonli E');
	});

	it('preserves the surviving segments byte-for-byte, odd spacing included', () => {
		expect(deleteCharacterFromNotation('Bennett  E   Q>Xingqiu E>Zhongli  E', 'xingqiu')).toBe(
			'Bennett  E   Q>Zhongli  E'
		);
	});
});

describe('appendCharacterToNotation', () => {
	it('starts an empty notation with a bare name', () => {
		expect(appendCharacterToNotation('', 'bennett')).toBe('Bennett');
		expect(appendCharacterToNotation('   ', 'bennett')).toBe('Bennett');
	});

	it('adds a separator to an existing rotation', () => {
		expect(appendCharacterToNotation('Bennett E Q', 'xingqiu')).toBe('Bennett E Q > Xingqiu');
	});

	it('completes a dangling separator instead of doubling it', () => {
		expect(appendCharacterToNotation('Bennett E Q > ', 'xingqiu')).toBe('Bennett E Q > Xingqiu');
	});
});

describe('foldTeamIntoNotation (the manualSlots migration)', () => {
	it('appends only the members the notation does not already name', () => {
		expect(foldTeamIntoNotation('Bennett E Q', ['bennett', 'xingqiu', 'blank', 'zhongli'])).toBe(
			'Bennett E Q > Xingqiu > Zhongli'
		);
	});

	it('keeps the team order for a notation that names nobody', () => {
		expect(foldTeamIntoNotation('', ['zhongli', 'bennett'])).toBe('Zhongli > Bennett');
	});

	it('drops blanks, nulls and ids with no character behind them', () => {
		expect(foldTeamIntoNotation('', ['blank', null, 'not-a-character', 'bennett'])).toBe('Bennett');
	});

	it('is a no-op without a legacy team', () => {
		expect(foldTeamIntoNotation(FOUR, null)).toBe(FOUR);
		expect(foldTeamIntoNotation(FOUR, undefined)).toBe(FOUR);
	});
});

/**
 * ⚓ CHARACTERS YOU PUT ON THE TEAM STAY UNTIL YOU REMOVE THEM; CHARACTERS
 * YOU TYPE COME AND GO WITH THE TEXT (design §8.1, Nate 2026-10-22). The
 * streamer's case and each of Nate's are named tests below.
 */
describe('seatTeam', () => {
	const TEAM = ['xiangling', 'bennett', 'chevreuse', 'kaedehara_kazuha'];
	/** Type `steps` one after another from `start`, as the editor would. */
	const typeInto = (start: Seating, ...steps: string[]) =>
		steps.reduce((s, text) => seatTeam(s, text), start);

	it('from an empty seating, reproduces the old derivation (first four, in order)', () => {
		expect(seatTeam(emptySeating(), FOUR).seats).toEqual([
			'bennett',
			'xingqiu',
			'zhongli',
			'hu_tao'
		]);
	});

	it('the streamer: a PLACED team rests through an empty notation', () => {
		const s = seatTeam(placedSeating(TEAM), '');
		expect(s.seats).toEqual(TEAM);
		expect(awakeIds(s.seats, '')).toEqual([]);
	});

	it('wakes placed characters in their OWN slots, whatever order the text names them in', () => {
		const text = 'Bennett E Q > Xiangling E Q';
		expect(seatTeam(placedSeating(TEAM), text).seats).toEqual(TEAM);
		expect(awakeIds(TEAM, text)).toEqual(['xiangling', 'bennett']);
	});

	it('Nate: a fresh tab, Xiangling typed then deleted — her slot EMPTIES, Kazuha takes it', () => {
		const s = typeInto(emptySeating(), 'Xiangling', '', 'Kazuha');
		expect(s.seats).toEqual(['kaedehara_kazuha', null, null, null]);
	});

	it('Nate: Xiangling E Q > Xingqiu, Xingqiu deleted, Yelan typed — Yelan takes slot 2', () => {
		const s = typeInto(
			emptySeating(),
			'Xiangling E Q > Xingqiu',
			'Xiangling E Q > ',
			'Xiangling E Q > Yelan'
		);
		expect(s.seats).toEqual(['xiangling', 'yelan', null, null]);
	});

	it('Nate: a full bench, ✕ empties slot 2 — typing fills slot 2', () => {
		const afterX = makeSeating(
			['xiangling', null, 'chevreuse', 'kaedehara_kazuha'],
			[true, false, true, true]
		);
		expect(seatTeam(afterX, 'Furina E').seats).toEqual([
			'xiangling',
			'furina',
			'chevreuse',
			'kaedehara_kazuha'
		]);
	});

	it('Nate: a lineup sends three — they rest, and typing fills the EMPTY slot first', () => {
		const three = placedSeating(['xiangling', 'bennett', 'chevreuse', null]);
		expect(seatTeam(three, 'Furina E').seats).toEqual([
			'xiangling',
			'bennett',
			'chevreuse',
			'furina'
		]);
	});

	it('with no empty slot, a newcomer takes the first RESTING placed seat', () => {
		const s = seatTeam(placedSeating(TEAM), 'Bennett E Q > Xiangling E Q > Furina E');
		expect(s.seats).toEqual(['xiangling', 'bennett', 'furina', 'kaedehara_kazuha']);
		// …and is TYPED there: deleting Furina now empties the seat.
		expect(seatTeam(s, 'Bennett E Q > Xiangling E Q').seats).toEqual([
			'xiangling',
			'bennett',
			null,
			'kaedehara_kazuha'
		]);
	});

	it('a typo fix returns a character to the slot they just left, not the lowest empty one', () => {
		// Slot 1 is empty (a ✕), Xiangling typed into slot 3.
		const start = makeSeating([null, 'bennett', 'xiangling', null], [false, true, false, false]);
		const s = typeInto(start, 'Bennett E > Xianglin', 'Bennett E > Xiangling');
		expect(s.seats).toEqual([null, 'bennett', 'xiangling', null]);
	});

	it('a fifth name with four AWAKE has nowhere to sit, and nobody moves for it', () => {
		const text = 'Bennett E > Xingqiu E > Zhongli E > Hu Tao E > Furina E';
		expect(seatTeam(emptySeating(), text).seats).toEqual([
			'bennett',
			'xingqiu',
			'zhongli',
			'hu_tao'
		]);
	});

	it('is idempotent', () => {
		const once = seatTeam(placedSeating(TEAM), 'Furina E > Bennett Q');
		expect(seatTeam(once, 'Furina E > Bennett Q')).toEqual(once);
	});

	it('keeps a placed Blank seated; only a LEGACY list reads blank as empty', () => {
		expect(seatTeam(placedSeating(['blank', null, null, null]), '').seats).toEqual([
			'blank',
			null,
			null,
			null
		]);
		expect(seatsFromLegacy(['bennett', 'blank', 'blank', 'blank'])).toEqual([
			'bennett',
			null,
			null,
			null
		]);
	});
});

// The Traveler's twin (twin frames round, 2026-10-28).
describe('setTwinInNotation', () => {
	it('names the twin in every segment the Traveler leads, and clears it to the bare name', () => {
		const pinned = setTwinInNotation(
			'Anemo Traveler E > Bennett Q > Anemo Traveler N2C',
			'traveler_anemo',
			'lumine'
		);
		expect(pinned).toBe('Anemo Lumine E > Bennett Q > Anemo Lumine N2C');
		expect(setTwinInNotation(pinned, 'traveler_anemo', null)).toBe(
			'Anemo Traveler E > Bennett Q > Anemo Traveler N2C'
		);
	});

	it('keeps a pinned twin when one Traveler is swapped for another', () => {
		expect(renameCharacterInNotation('Anemo Lumine E Q', 'traveler_anemo', 'traveler_geo')).toBe(
			'Geo Lumine E Q'
		);
		expect(renameCharacterInNotation('Anemo Lumine E Q', 'traveler_anemo', 'bennett')).toBe(
			'Bennett E Q'
		);
	});
});
