import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/**
 * The style reference is a DEVELOPMENT TOOL, not a page of the site.
 *
 * It is committed (so it survives branch switches, fresh checkouts and every
 * future session — a gitignored file can't be a shared authority), but it is
 * unreachable in production: `prerender = false` means no HTML page is emitted
 * (verified — `build/` contains no styleguide route), and the dev guard below
 * 404s it if the SPA fallback ever routes there. Vite does still emit the
 * route's lazy chunk (~21KB gz, JS + CSS) into build/_app/immutable/, but no
 * real page imports it, so it is never fetched and costs visitors nothing. If
 * that ever needs to be zero, exclude the directory at the Vite level rather
 * than deleting the page. It also lives OUTSIDE the (scene) group on purpose, so it renders
 * against the bare root layout — no chrome, no starfield, no parallax, no
 * loading veil — and specimens are judged on their own, not through the scene.
 */
export const prerender = false;

export function load() {
	if (!dev) error(404, 'Not found');
}
