import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/** The library DEMO (lineups design §10.1, step 4) — dev-only, like /lab. Its
 *  data is a fixture on the page; it touches no store. */
export const prerender = false;

export function load() {
	if (!dev) error(404, 'Not found');
}
