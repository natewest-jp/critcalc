import { describe, it, expect } from 'vitest';
import { tokenizeNotation } from './tokenizer';

/** Compact shape helper: 'kind:text' per token. */
const shape = (notation: string): string[] =>
	tokenizeNotation(notation).map((t) => `${t.kind}:${t.text}`);

describe('tokenizeNotation — concatenated run after character name (sweep 2026-07-05 #3)', () => {
	it('splits the documented header example instead of swallowing it into the name', () => {
		// 'Bennett QEN1N2~2s' is the module header's own example of supported
		// concatenated notation. Before the fix, the name-absorb loop classified
		// the whole run as 'unknown' and folded it into the character token,
		// silently dropping the entire segment downstream.
		expect(shape('Bennett QEN1N2~2s')).toEqual([
			'character:Bennett',
			'Q:Q',
			'E:E',
			'label:N1',
			'label:N2',
			'time:~2s'
		]);
	});

	it('keeps a multi-word name intact ahead of a concatenated run', () => {
		expect(shape('Hu Tao EN1C')).toEqual(['character:Hu Tao', 'E:E', 'label:N1', 'label:C']);
	});

	it('stops the name at a short run like QE', () => {
		expect(shape('Bennett QE N1N2')).toEqual([
			'character:Bennett',
			'Q:Q',
			'E:E',
			'label:N1',
			'label:N2'
		]);
	});

	it('still absorbs name words that merely START with an action char', () => {
		// 'Jin' starts with J (a dash-adjacent action char) but is not a pure
		// action run — it must remain part of the character name.
		expect(shape('Yun Jin E')).toEqual(['character:Yun Jin', 'E:E']);
		expect(shape('Kamisato Ayato Q')).toEqual(['character:Kamisato Ayato', 'Q:Q']);
	});
});

describe('tokenizeNotation — unspaced separator (sweep 2026-07-05 #9)', () => {
	it("emits a separator for '>' with no surrounding spaces", () => {
		// Before the fix the greedy \S+ alternative consumed 'Q>Raiden' as one
		// word, losing the segment split and folding the remainder into the name.
		expect(shape('Bennett Q>Raiden Q')).toEqual([
			'character:Bennett',
			'Q:Q',
			'separator:>',
			'character:Raiden',
			'Q:Q'
		]);
	});

	it("keeps '>' inside bracket groups as part of the group", () => {
		// The bracket alternative precedes the separator in the outer regex;
		// only bare '>' splits words.
		const tokens = tokenizeNotation('Raiden E 3[N1C] Q');
		expect(tokens.map((t) => t.kind)).toEqual(['character', 'E', 'label', 'Q']);
	});
});

describe('tokenizeNotation — source offsets survive the absorb loop', () => {
	it('reports correct from/to for tokens after a split concatenated run', () => {
		const tokens = tokenizeNotation('Bennett QEN1N2~2s');
		// 'Bennett'=0..7, 'Q'=8, 'E'=9, 'N1'=10..12, 'N2'=12..14, '~2s'=14..17
		const n2 = tokens.find((t) => t.text === 'N2')!;
		expect(n2.from).toBe(12);
		expect(n2.to).toBe(14);
		const time = tokens.find((t) => t.kind === 'time')!;
		expect(time.from).toBe(14);
		expect(time.to).toBe(17);
	});
});

describe('tokenizeNotation — sQ short-burst token (sQ primitive, 2026-07-17)', () => {
	it('classifies a space-separated sQ as a Q-kind token with its text preserved', () => {
		expect(shape('Flins E sQ')).toEqual(['character:Flins', 'E:E', 'Q:sQ']);
	});

	it('splits sQ out of a concatenated run (longest-match before bare Q/s)', () => {
		expect(shape('Varesa PsQ')).toEqual(['character:Varesa', 'label:P', 'Q:sQ']);
		expect(shape('Flins EsQQ')).toEqual(['character:Flins', 'E:E', 'Q:sQ', 'Q:Q']);
	});

	it('still absorbs name words starting with s into the character name', () => {
		// 's' is now an action-first char (for sQ); pure name words that start
		// with it must not terminate the name-absorb loop.
		expect(shape('Traveler sQ')).toEqual(['character:Traveler', 'Q:sQ']);
	});
});
