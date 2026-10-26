import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/** The notices lab (docs/notices-design.md): dev-only, local state, no
 *  stores. The /lab contract: no prerender, 404 in production. */
export const prerender = false;

export function load() {
	if (!dev) error(404, 'Not found');
}
