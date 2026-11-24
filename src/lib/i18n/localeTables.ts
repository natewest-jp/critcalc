/**
 * A table that exists once per locale besides English and loads only on that
 * locale's pages: the game's ability names (`abilityNames.ts`) and the kit
 * notes (`kitNotes.ts`). The loaded tables sit in a SvelteMap, so a read made
 * before its table lands re-renders once it does.
 */
import { browser } from '$app/environment';
import { SvelteMap } from 'svelte/reactivity';
import { baseLocale, getLocale } from './locale';

export function localeTables<T>(loaders: Record<string, () => Promise<T>>) {
	/** `import.meta.glob` keys by path; the file's basename is its locale. */
	const byLocale = new Map(
		Object.entries(loaders).map(([path, load]) => [path.replace(/^.*\/|\.json$/g, ''), load])
	);
	const tables = new SvelteMap<string, T>();
	const inFlight = new Map<string, Promise<void>>();

	/** Load a locale's table (the page's by default). Idempotent; English and
	 *  a locale with no table resolve at once. */
	function load(locale: string = getLocale()): Promise<void> {
		if (locale === baseLocale || tables.has(locale)) return Promise.resolve();
		const loader = byLocale.get(locale);
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

	/** The page's table, or null in English, or while it loads (the browser
	 *  starts the load; the server paints English). */
	function current(): T | null {
		const locale = getLocale();
		if (locale === baseLocale) return null;
		const table = tables.get(locale);
		if (!table && browser) void load(locale);
		return table ?? null;
	}

	return { load, current };
}
