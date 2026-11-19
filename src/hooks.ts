import type { Reroute } from '@sveltejs/kit';
import { deLocalizeUrl } from '$lib/paraglide/runtime';

/**
 * `/ja/planner` renders the `/planner` route: the locale prefix is stripped
 * before SvelteKit matches a route, so the route tree stays the same for
 * every locale. ⚠️ `page.url` still holds the browser's URL, prefix and all.
 * Read a route from it through `routeOf` in `$lib/i18n/paths`.
 */
export const reroute: Reroute = ({ url }) => deLocalizeUrl(url).pathname;
