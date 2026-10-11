import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/** The Marks weight SPECIMEN (2026-10-11) — dev-only, like /lab. It draws its
 *  own SVGs from MARK_NODES and does not change Mark.svelte. */
export const prerender = false;

export function load() {
	if (!dev) error(404, 'Not found');
}
