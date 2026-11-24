import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CharacterData } from '$lib/types/character';
import { namesOf } from '$lib/data/abilityNameSources';
import { overwriteGetLocale, baseLocale, type Locale } from '$lib/paraglide/runtime';
import { abilityName, compose, loadAbilityNames } from './abilityNames';
import { childrenOf, isOurWord, NOTATION, splitName } from '$lib/data/nameParts';
import ja from '$lib/data/abilityNames/ja.json';

/**
 * The game's ability names in other languages
 * (`scripts/generate-ability-names.mjs`, run by hand). A new character or a
 * renamed talent fails here until the generator runs again.
 */
const DIR = 'src/lib/data/characters';
const corpus: CharacterData[] = readdirSync(DIR)
	.filter((f) => f.endsWith('.json'))
	.map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));

/** Not a game character: the planner's placeholder kit. */
const NOT_IN_GAME = ['blank'];

/** Parts the game's text has no line for, left in English. */
const KNOWN_GAPS: Record<string, Record<string, string[]>> = {
	ja: {}
};

const TABLES: Record<string, Record<string, Record<string, string>>> = { ja };

/** The parts of `label` that would still show English: each leaf that is not
 *  a game name in `row`, one of our words, or notation. */
function gapsOf(row: Record<string, string>, label: string): string[] {
	if (row[label] || isOurWord(label) || NOTATION.test(label)) return [];
	const node = splitName(label);
	return node ? childrenOf(node).flatMap((c) => gapsOf(row, c)) : [label];
}

const as = (locale: Locale) => overwriteGetLocale(() => locale);
afterAll(() => as(baseLocale));

for (const locale of Object.keys(KNOWN_GAPS) as Locale[]) {
	describe(`${locale}: ability names`, () => {
		beforeAll(async () => {
			as(locale);
			await loadAbilityNames(locale);
		});

		it('names every part of every name and label the page shows', () => {
			const missing: Record<string, string[]> = {};
			for (const c of corpus) {
				if (NOT_IN_GAME.includes(c.id)) continue;
				const row = TABLES[locale][c.id] ?? {};
				const gaps = [...new Set(namesOf(c).flatMap((n) => gapsOf(row, n)))];
				if (gaps.length) missing[c.id] = gaps.sort();
			}
			expect(missing).toEqual(KNOWN_GAPS[locale]);
		});

		// The page tells a character's entries apart by name alone, so two
		// English names must never become one.
		it("no two of a character's names collide", () => {
			for (const c of corpus) {
				const names = namesOf(c);
				const shown = names.map((n) => abilityName(c.id, n));
				expect(new Set(shown).size, c.id).toBe(new Set(names).size);
			}
		});
	});
}

describe('composed labels', () => {
	// The parts are put back together by messages, so English must come back
	// letter for letter: otherwise the split misread the label.
	it('compose back to their English exactly', () => {
		as(baseLocale);
		for (const c of corpus) for (const n of namesOf(c)) expect(compose({}, n)).toBe(n);
	});

	it('put the game name and our words together in Japanese', async () => {
		as('ja');
		await loadAbilityNames('ja');
		expect(abilityName('diluc', 'Searing Onslaught (E1)')).toBe('逆焔の刃（E1）');
		expect(abilityName('bennett', 'Hold Lv.2')).toBe('長押しLv.2');
		// Coverage's cast and variant, joined by the interface's own dot.
		expect(abilityName('diluc', 'Searing Onslaught (E1) · Hold')).toBe('逆焔の刃（E1） · 長押し');
		expect(abilityName('xingqiu', 'A1: Hydropathic')).toBe(`A1：${ja.xingqiu.Hydropathic}`);
		as(baseLocale);
	});
});

describe('abilityName', () => {
	it('keeps English in English', () => {
		as(baseLocale);
		expect(abilityName('nahida', 'Illusory Heart')).toBe('Illusory Heart');
	});

	it("shows the game's name in Japanese", async () => {
		as('ja');
		await loadAbilityNames('ja');
		expect(abilityName('nahida', 'Illusory Heart')).toBe('心景幻成');
		expect(abilityName('nahida', 'Shrine of Maya')).toBe('摩耶の宮殿');
		expect(abilityName('chiori', 'Tamoto')).toBe('「たもと」');
		as(baseLocale);
	});

	it('falls back to English for a name it does not know', async () => {
		as('ja');
		await loadAbilityNames('ja');
		expect(abilityName('nahida', 'Not a Talent')).toBe('Not a Talent');
		as(baseLocale);
	});
});
