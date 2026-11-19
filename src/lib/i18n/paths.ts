/**
 * Every internal URL on the site, in and out, goes through here.
 *
 * Out: `hrefTo('/planner')` is the link in the reader's locale (`/planner` in
 * English, `/ja/planner` in Japanese). Use it for every `href`, `goto`,
 * `pushState` and `replaceState` target.
 *
 * In: `routeOf(page.url)` is the route a URL shows, with the locale prefix
 * removed (`/ja/planner` → `/planner`). Use it wherever code asks which page
 * it is on. ⚠️ `page.url.pathname` itself keeps the prefix, because `reroute`
 * changes which route renders and not the URL, so a bare comparison against
 * '/planner' fails on every page but English.
 *
 * ⚠️ Call both at render or event time, never in a module-level constant: on
 * the server one module serves every locale the build prerenders, so a table
 * of localized links built at import would freeze the first page's locale.
 * Keep tables canonical (`'/planner'`) and localize where they are read.
 *
 * `src/lib/conventions.test.ts` holds the rule: nothing imports SvelteKit's
 * `resolve` (see `hrefTo`), and no markup or navigation call names a bare path.
 */
import type { Pathname } from '$app/types';
import { deLocalizeUrl, localizeHref } from '$lib/paraglide/runtime';

/**
 * A canonical path (`'/planner'`, optionally with `?query` or `#hash`),
 * localized for the reader. The `Pathname` type keeps it to a real route.
 *
 * ⚠️ Not SvelteKit's `resolve()`. While prerendering, `resolve` returns a
 * relative path (`./help`, because `paths.relative` is on), and
 * `localizeHref` makes anything that does not start with `/` absolute, so
 * every prerendered link came out as `http://sveltekit-prerender/help`. The
 * site is served from the domain root with no `paths.base`, so the root path
 * is the whole answer. A base path, if one is ever set, is prefixed here.
 */
export function hrefTo(path: Pathname | `${Pathname}?${string}` | `${Pathname}#${string}`): string {
	return localizeHref(path);
}

/** The canonical route a URL or pathname shows: `/ja/planner` → `/planner`. */
export function routeOf(url: URL | string): string {
	// Any origin will do: only the path is read back.
	return deLocalizeUrl(typeof url === 'string' ? new URL(url, 'https://critcalc.app') : url)
		.pathname;
}
