/**
 * The game's names for a character's abilities, passives, constellations,
 * summons, and shields, in the page's language. English comes from the
 * character data; every other locale from `src/lib/data/abilityNames/`, which
 * `scripts/generate-ability-names.mjs` writes from genshin-db and the game's
 * text maps.
 *
 * A locale's table loads only on that locale's pages, alongside the first
 * character payload (`loadCharacter` waits for it; `localeTables.ts`).
 *
 * A label composed from a game name and our words ("A1: Rekindle",
 * "Searing Onslaught (E1)") comes apart through `$lib/data/nameParts`; each
 * game name is looked up, each of our words is a message, notation stays, and
 * the parts go back together in the page's language (Searing Onslaught
 * (E1) → 逆焔の刃（E1）).
 *
 * ⚠️ Display only. The planner's row keys, the parser's lookups
 * (`filter.abilityName`), and anything compared against English keep the
 * English name: translate at the moment a name is shown, never upstream.
 */
import { localeTables } from './localeTables';
import { m } from '$lib/paraglide/messages';
import { elementLabel } from '$lib/utils/auraDisplay';
import {
	NOTATION,
	isOurWord,
	splitName,
	type NameNode,
	type OurWord,
	type SuffixWord
} from '$lib/data/nameParts';

type Table = Record<string, Record<string, string>>;

const names = localeTables(
	import.meta.glob('../data/abilityNames/*.json', { import: 'default' }) as Record<
		string,
		() => Promise<Table>
	>
);

/** Load a locale's names (the page's by default). */
export const loadAbilityNames = names.load;

/** A name from `characterId`'s data, as the page shows it: the game's own
 *  name in the page's language, else the English as written. */
export function abilityName(characterId: string, english: string): string {
	const table = names.current();
	return table ? compose(table[characterId] ?? {}, english) : english;
}

/** Our words, read at each use so they follow the page's language. */
const WORD: Record<OurWord, () => string> = {
	Hold: m.ability_hold,
	Press: m.ability_press,
	'Short Hold': m.ability_short_hold,
	Holding: m.ability_holding,
	Tap: m.ability_tap,
	Max: m.ability_max,
	Infusion: m.ability_infusion,
	Field: m.ability_field_alone,
	'Heal mode': m.ability_heal_mode,
	'Normal Attack': m.ability_normal_attack,
	'Elemental Skill': m.ability_elemental_skill,
	'Elemental Burst': m.ability_elemental_burst,
	'Aimed Shot': m.ability_aimed_shot,
	'Fully-Charged Aimed Shot': m.ability_fully_charged_aimed_shot,
	'After Hold E': m.ability_after_hold_e,
	'After Press E': m.ability_after_press_e,
	'Tap Fire': m.ability_tap_fire,
	'Exit Melee': m.ability_exit_melee,
	'1st Leap': m.ability_first_leap,
	'2nd Leap': m.ability_second_leap,
	'3rd Leap': m.ability_third_leap,
	'N follow-up': m.ability_n_follow_up,
	'E follow-up': m.ability_e_follow_up,
	'while hovering': m.ability_while_hovering,
	'faster ticks': m.ability_faster_ticks,
	'four rings': m.ability_four_rings,
	'recast extension': m.ability_recast_extension,
	Blink: m.ability_blink
};

const SUFFIX: Record<SuffixWord, (p: { name: string }) => string> = {
	'Shield Barrier': m.ability_shield_barrier,
	Shield: m.ability_shield,
	Field: m.ability_field,
	Mark: m.ability_mark,
	Bubble: m.ability_bubble,
	Aura: m.ability_aura,
	Wall: m.ability_wall,
	Strikes: m.ability_strikes,
	'RES shred': m.ability_res_shred
};

/** One label in the page's language: the game's name for it whole, else its
 *  parts composed, else the English as written. */
export function compose(row: Record<string, string>, s: string): string {
	if (row[s]) return row[s];
	if (isOurWord(s)) return WORD[s]();
	if (NOTATION.test(s)) return s;
	const node = splitName(s);
	return node ? composeNode(row, node, s) : s;
}

function composeNode(row: Record<string, string>, node: NameNode, s: string): string {
	const c = (x: string) => compose(row, x);
	const list = (xs: string[]) =>
		xs.map(c).reduce((first, second) => m.ability_detail_and({ first, second }));
	switch (node.kind) {
		case 'tagged':
			return (node.colon ? m.ability_tag_colon : m.ability_tag_space)({
				tag: node.tag,
				name: c(node.rest)
			});
		case 'tagDetail':
			return m.ability_detail({ name: node.tag, detail: list(node.details) });
		case 'paren':
			return m.ability_detail({ name: c(node.base), detail: list(node.details) });
		case 'joined':
			return m.ability_part({ name: c(node.head), part: c(node.part) });
		case 'numbered':
			return m.ability_step({ name: c(node.base), n: node.n });
		case 'suffix':
			return s.startsWith('"')
				? m.ability_quoted_mark({ name: c(node.base) })
				: SUFFIX[node.word]({ name: c(node.base) });
		case 'prefix': {
			const name = c(node.rest);
			if (node.word === 'End') return m.ability_end({ name });
			if (node.word === 'With') return m.ability_with({ name });
			return m.ability_in({ name });
		}
		case 'level':
			return (node.hold ? m.ability_hold_level : m.ability_level)({ level: node.level });
		case 'amount':
			return m.ability_amount({ name: c(node.base), amount: node.amount });
		case 'members':
			return (node.n === '1' ? m.ability_member : m.ability_members)({
				n: node.n,
				element: elementLabel(node.element.toLowerCase())
			});
		case 'timed':
			return m.ability_timed({ word: c(node.word), seconds: node.seconds });
	}
}
