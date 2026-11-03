import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/** The Crit heatmap's colour ramps, side by side (the stage round,
 *  docs/rounds/viz-stage-crit-2026-11-03.md): dev-only, local state. The /lab
 *  contract: no prerender, 404 in production. Retired once Nate picks. */
export const prerender = false;

export function load() {
	if (!dev) error(404, 'Not found');
}
