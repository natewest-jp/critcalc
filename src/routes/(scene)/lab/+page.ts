import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/**
 * THE SPECIMEN BOARD (/lab) — a development tool, not a page of the site.
 *
 * Same contract as /styleguide: committed so it survives checkouts, prerender
 * disabled so no HTML is emitted, dev-guarded so the SPA fallback cannot route
 * to it in production.
 *
 * ⚠ IT LIVES INSIDE (scene) — that is the whole reason it exists as a separate
 * route rather than as another styleguide section. /styleguide deliberately
 * renders on the bare root layout, and that is right for a REFERENCE: a swatch
 * should be judged on its own. But the question this board answers is the
 * opposite one — what do these surfaces look like AT THE CREST, UNDER THE WASH,
 * WITH STARS BEHIND THEM — and there is no honest way to fake that. The
 * styleguide's glass grid uses a hand-drawn stand-in backdrop and says so.
 *
 * The other half is /lab's entry in TOOL_PATHS (landing/transition.ts), which
 * is what actually gets it the crest pose and the dim.
 */
export const prerender = false;

export function load() {
	if (!dev) error(404, 'Not found');
}
