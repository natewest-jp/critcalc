import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CharacterData } from '$lib/types/character';
import { namesOf } from '$lib/data/abilityNameSources';
import { overwriteGetLocale, baseLocale, type Locale } from '$lib/paraglide/runtime';
import { abilityName, loadAbilityNames } from './abilityNames';

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

/** Names that are ours, composed from a game name and our words, with no
 *  single entry in the game's text. */
const KNOWN_GAPS: Record<string, Record<string, string[]>> = {
	ja: {
		arataki_itto: ['Fight Club Legend (Raging Oni King)'],
		chasca: ['Multitarget Fire (Tap)', 'End Nightsoul'],
		chiori: ['Kinu'],
		dahlia: ['Shield of Sacred Favor'],
		dehya: ['Molten Inferno: Indomitable Flame', 'Fiery Sanctum', 'Molten Inferno: Ranging Flame'],
		diluc: [
			'Searing Onslaught (E1)',
			'Searing Onslaught (E2)',
			'Searing Onslaught (E3)',
			'Phoenix'
		],
		escoffier: ['Cooking Mek (Cold Storage)'],
		flins: ['Pocztowy Demonspear (Manifest Flame)'],
		hu_tao: ['Secret Spear of Wangsheng (Paramita Papilio)'],
		iansan: ['Weighted Spike (Swift Stormflight)'],
		ifa: ['Airborne Disease Prevention (while hovering)'],
		ineffa: ['Optical Flow Shield Barrier'],
		keqing: ['Stellar Restoration (Blink)'],
		lan_yan: [
			'Feathermoon Ring (N follow-up, C1)',
			'Feathermoon Ring (N follow-up)',
			'Feathermoon Ring (E follow-up)'
		],
		linnea: ['Memo Heal Aura'],
		mavuika: ['Flamestrider Strikes', 'Rings of Searing Radiance'],
		mitya: ['Detection Core: Steady State', 'Detection Core: Overloaded'],
		mona: ['Phantom'],
		nicole: ['Shield of Blazing Light'],
		nilou: [
			'Sword Dance',
			'Whirling Steps 1',
			'Whirling Steps 2',
			'Water Wheel (Whirling Steps 3)'
		],
		noelle: ['Stone Armor'],
		prune: ['Witchlure Bell (Hunter-Seeker)'],
		shenhe: ['Talisman Spirit Field'],
		skirk: ['Havoc: Sunder (Seven-Phase Flash)'],
		tartaglia: [
			'Foul Legacy: Raging Tide (Melee Stance)',
			'Foul Legacy: Raging Tide (Exit Melee)',
			'Havoc: Obliteration (Ranged Stance)',
			'Havoc: Obliteration (Melee Stance)'
		],
		traveler_dendro: ['Foreign Thunderwood', 'LeaLotus Lamp'],
		traveler_geo: ['Wake of Earth Wall'],
		traveler_hydro: ['Rising Waters Bubble'],
		traveler_pyro: ['Foreign Emberblade'],
		valeriy: ['Supercharged Shield'],
		varesa: ['Fiery Passion Strikes'],
		varka: ['Favonius Bladework: Dancing Radiance (Sturm und Drang)'],
		wriothesley: ['Forceful Fists of Frost (Chilling Penalty)'],
		xianyun: ['Skyladder (1st Leap)', 'Skyladder (2nd Leap)', 'Skyladder (3rd Leap)'],
		xiao: ["Whirlwind Thrust (Yaksha's Mask)"],
		yaoyao: ['Yuegui: Jumping Mode'],
		yoimiya: ['Firework Flare-Up (Niwabi Fire-Dance)'],
		yumemizuki_mizuki: ['End Dreamdrifter'],
		yun_jin: ['Opening Flourish Shield'],
		zibai: ["Golden Blade's Petaled Touch (Lunar Phase Shift)", "Spirit Steed's Stride"]
	}
};

const as = (locale: Locale) => overwriteGetLocale(() => locale);
afterAll(() => as(baseLocale));

for (const locale of Object.keys(KNOWN_GAPS) as Locale[]) {
	describe(`${locale}: ability names`, () => {
		beforeAll(async () => {
			as(locale);
			await loadAbilityNames(locale);
		});

		it('names every ability, passive, constellation, summon, and shield', () => {
			const missing: Record<string, string[]> = {};
			for (const c of corpus) {
				if (NOT_IN_GAME.includes(c.id)) continue;
				const gaps = namesOf(c).filter((n) => abilityName(c.id, n) === n);
				if (gaps.length) missing[c.id] = gaps;
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
