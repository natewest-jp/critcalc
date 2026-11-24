/**
 * The game's names for a character's abilities, passives, constellations,
 * summons, and shields, in the page's language. English comes from the
 * character data; every other locale from `src/lib/data/abilityNames/`, which
 * `scripts/generate-ability-names.mjs` writes from genshin-db and the game's
 * text maps.
 *
 * A locale's table loads only on that locale's pages, alongside the first
 * character payload (`loadCharacter` waits for it). The table is a SvelteMap,
 * so a name read before it lands re-renders once it does.
 *
 * ⚠️ Display only. The planner's row keys, the parser's lookups
 * (`filter.abilityName`), and anything compared against English keep the
 * English name: translate at the moment a name is shown, never upstream.
 */
import { browser } from '$app/environment';
import { SvelteMap } from 'svelte/reactivity';
import { baseLocale, getLocale } from './locale';

type Table = Record<string, Record<string, string>>;

const loaders = import.meta.glob('../data/abilityNames/*.json', { import: 'default' }) as Record<
	string,
	() => Promise<Table>
>;

const tables = new SvelteMap<string, Table>();
const inFlight = new Map<string, Promise<void>>();

/** Load a locale's names (the page's by default). Idempotent; English and a
 *  locale with no table resolve at once. */
export function loadAbilityNames(locale: string = getLocale()): Promise<void> {
	if (locale === baseLocale || tables.has(locale)) return Promise.resolve();
	const loader = loaders[`../data/abilityNames/${locale}.json`];
	if (!loader) return Promise.resolve();
	let pending = inFlight.get(locale);
	if (!pending) {
		pending = loader().then((t) => {
			tables.set(locale, t);
			inFlight.delete(locale);
		});
		inFlight.set(locale, pending);
	}
	return pending;
}

/** A name from `characterId`'s data, as the page shows it: the game's own
 *  name in the page's language, else the English as written. */
export function abilityName(characterId: string, english: string): string {
	const locale = getLocale();
	if (locale === baseLocale) return english;
	const table = tables.get(locale);
	if (!table) {
		// The server paints English; the browser swaps once the table lands.
		if (browser) void loadAbilityNames(locale);
		return english;
	}
	return table[characterId]?.[english] ?? english;
}
