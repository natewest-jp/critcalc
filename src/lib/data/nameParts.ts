/**
 * How a composed label in the character data comes apart: a game name plus
 * our words or notation ("A1: Rekindle", "Searing Onslaught (E1)", "Blade
 * Roller 2", "Opening Flourish Shield"). One level at a time, so a part can
 * be composed itself. `$lib/i18n/abilityNames` puts the parts back together
 * in the page's language; `scripts/generate-ability-names.mjs` splits a
 * label it can't find whole to look its parts up in the game's text.
 *
 * Notation (A1, C4, E1, N1) stays as players write it in every language.
 *
 * ⚠️ Runtime-import-free: the generator imports it under bare Node type
 * stripping.
 */

/** Our words, and the game's action words, that a label uses alone or as a
 *  part ("Hold", "N follow-up"). They are messages in `$lib/i18n/abilityNames`,
 *  never looked up in the game's text: a short word there matches the wrong
 *  line ("Field" is a rice field). */
export const OUR_WORDS = [
	'Hold',
	'Press',
	'Short Hold',
	'Holding',
	'Tap',
	'Max',
	'Infusion',
	'Field',
	'Heal mode',
	'Normal Attack',
	'Elemental Skill',
	'Elemental Burst',
	'Aimed Shot',
	'Fully-Charged Aimed Shot',
	'After Hold E',
	'After Press E',
	'Tap Fire',
	'Exit Melee',
	'1st Leap',
	'2nd Leap',
	'3rd Leap',
	'N follow-up',
	'E follow-up',
	'while hovering',
	'faster ticks',
	'four rings',
	'recast extension',
	'Blink'
] as const;
export type OurWord = (typeof OUR_WORDS)[number];
export const isOurWord = (s: string): s is OurWord => (OUR_WORDS as readonly string[]).includes(s);

/** Words a label puts after a name ("Opening Flourish Shield"). Each is a
 *  message in `$lib/i18n/abilityNames`. */
export const SUFFIX_WORDS = [
	'Shield Barrier',
	'Shield',
	'Field',
	'Mark',
	'Bubble',
	'Aura',
	'Wall',
	'Strikes',
	'RES shred'
] as const;
export type SuffixWord = (typeof SUFFIX_WORDS)[number];

export type NameNode =
	/** "A1: Rekindle", "C2 Ambush": notation, then a name. */
	| { kind: 'tagged'; tag: string; rest: string; colon: boolean }
	/** "C4 (Pathfinder's Blessing)": notation with a detail and no name. */
	| { kind: 'tagDetail'; tag: string; details: string[] }
	/** "Searing Onslaught (E1)", "Feathermoon Ring (N follow-up, C1)". */
	| { kind: 'paren'; base: string; details: string[] }
	/** "Molten Inferno: Ranging Flame", a name and its part. */
	| { kind: 'joined'; head: string; part: string }
	/** "Blade Roller 2", a hit or step of a name. */
	| { kind: 'numbered'; base: string; n: string }
	/** "Opening Flourish Shield", `"Focused Impression" Mark`. */
	| { kind: 'suffix'; base: string; word: SuffixWord }
	/** "End Nightsoul", "With Solar Isotoma", "in Inspiration Field". */
	| { kind: 'prefix'; word: 'End' | 'With' | 'in'; rest: string }
	/** "Hold Lv.2", "Lv 4", "Shattering Pressure (Lv 0–3)"'s detail. */
	| { kind: 'level'; hold: boolean; level: string }
	/** "Grace of Kenosis +300", a name and an amount. */
	| { kind: 'amount'; base: string; amount: string }
	/** "1 Hydro party member", "2 Hydro party members". */
	| { kind: 'members'; n: string; element: string }
	/** "Hold: 15s", "Press: 10s". */
	| { kind: 'timed'; word: string; seconds: string };

export const NOTATION = /^(?:[ANCEQP]\d+|[EQ]|NA|CA)$/;

const TAG = '(A1|A4|C[1-6])';

/** One level of a composed label, or null for a leaf (a name or a word). */
export function splitName(s: string): NameNode | null {
	if (isOurWord(s)) return null;
	let m: RegExpMatchArray | null;
	if ((m = s.match(new RegExp(`^${TAG}: (.+)$`))))
		return { kind: 'tagged', tag: m[1], rest: m[2], colon: true };
	if ((m = s.match(new RegExp(`^${TAG} \\(([^()]+)\\)$`))))
		return { kind: 'tagDetail', tag: m[1], details: m[2].split(', ') };
	if ((m = s.match(new RegExp(`^${TAG} (.+)$`))))
		return { kind: 'tagged', tag: m[1], rest: m[2], colon: false };
	if ((m = s.match(/^(Hold )?Lv ?\.?(\d+(?:–\d+)?)$/)))
		return { kind: 'level', hold: !!m[1], level: m[2] };
	if ((m = s.match(/^(Hold|Press): (\d+)s$/))) return { kind: 'timed', word: m[1], seconds: m[2] };
	if ((m = s.match(/^(\d+) (\w+) party members?$/)))
		return { kind: 'members', n: m[1], element: m[2] };
	if ((m = s.match(/^"(.+)" (\w+)$/)) && (SUFFIX_WORDS as readonly string[]).includes(m[2]))
		return { kind: 'suffix', base: m[1], word: m[2] as SuffixWord };
	if ((m = s.match(/^(.+) \(([^()]+)\)$/)))
		return { kind: 'paren', base: m[1], details: m[2].split(', ') };
	if ((m = s.match(/^(.+?): (.+)$/))) return { kind: 'joined', head: m[1], part: m[2] };
	if ((m = s.match(/^(End|With|in) (.+)$/)))
		return { kind: 'prefix', word: m[1] as 'End' | 'With' | 'in', rest: m[2] };
	if ((m = s.match(/^(.+) \+(\d+)$/))) return { kind: 'amount', base: m[1], amount: m[2] };
	if ((m = s.match(/^(.+) (\d+)$/))) return { kind: 'numbered', base: m[1], n: m[2] };
	for (const word of SUFFIX_WORDS)
		if (s.endsWith(` ${word}`)) return { kind: 'suffix', base: s.slice(0, -word.length - 1), word };
	return null;
}

/** The parts of `s` one level down that are themselves names or words. */
export function childrenOf(node: NameNode): string[] {
	switch (node.kind) {
		case 'tagged':
		case 'prefix':
			return [node.rest];
		case 'tagDetail':
			return node.details;
		case 'paren':
			return [node.base, ...node.details];
		case 'joined':
			return [node.head, node.part];
		case 'numbered':
		case 'suffix':
		case 'amount':
			return [node.base];
		default:
			return [];
	}
}
